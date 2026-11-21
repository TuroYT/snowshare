import { createServer } from "node:http";
import { parse } from "node:url";
import { AsyncLocalStorage } from "node:async_hooks";
import next from "next";
import { Server as TusServer } from "@tus/server";
import { FileStore } from "@tus/file-store";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import cron from "node-cron";
import { CLIENT_IP_HEADER, resolveClientIp } from "./src/lib/getClientIp.js";
import { authenticateFromRequest, createTusHooks } from "./src/lib/tus-server.js";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "localhost";
const port = Number.parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Carries the authenticated uploader into the tus callbacks
const requestContext = new AsyncLocalStorage();

function getUploadDir() {
  return process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");
}

function getTusTempDir() {
  return path.join(getUploadDir(), ".tus-temp");
}

// Same resolution rules as src/lib/getClientIp.ts
function getClientIpFromHttpReq(req) {
  const header = (name) => {
    const value = req.headers?.[name];
    return Array.isArray(value) ? value.join(",") : value;
  };
  return resolveClientIp({
    forwardedFor: header("x-forwarded-for"),
    realIp: header("x-real-ip"),
    remoteAddress: req.socket?.remoteAddress,
  });
}

// Shared TypeScript modules, loaded once (tsx resolves the .js paths to the .ts sources)
let libsPromise;
function loadLibs() {
  libsPromise ??= Promise.all([
    import("./src/lib/prisma.js"),
    import("./src/lib/upload-share.js"),
    import("./src/lib/quota-shared.js"),
    import("./src/lib/files.js"),
    import("./src/lib/storage.js"),
    import("./src/lib/settings.js"),
    import("./src/lib/webhooks.js"),
  ]).then(([prismaLib, uploadShare, quota, files, storage, settings, webhooks]) => ({
    prisma: prismaLib.prisma,
    ...uploadShare,
    ...quota,
    ...files,
    ...storage,
    ...settings,
    ...webhooks,
  }));
  return libsPromise;
}

const uploadsDir = getUploadDir();
const tusTempDir = getTusTempDir();

if (!existsSync(uploadsDir)) {
  mkdirSync(uploadsDir, { recursive: true });
}
if (!existsSync(tusTempDir)) {
  mkdirSync(tusTempDir, { recursive: true });
}

const tusServer = new TusServer({
  path: "/api/tus",
  datastore: new FileStore({ directory: tusTempDir }),
  // Per-user file size limit, enforced by tus on creation and while bytes are written, so
  // uploads with Upload-Defer-Length cannot exceed it either
  async maxSize() {
    const libs = await loadLibs();
    const context = requestContext.getStore();
    const settings = await libs.getSettingsCached();
    const maxMB = context?.isAuthenticated
      ? settings?.authMaxUpload || 51200
      : settings?.anoMaxUpload || 2048;
    return maxMB * 1024 * 1024;
  },
  respectForwardedHeaders: true,
  generateUrl(req, { proto: _proto, host: _host, path, id }) {
    // Use relative URL to avoid protocol mismatch behind reverse proxies (CSP 'self')
    return `${path}/${id}`;
  },

  ...createTusHooks({
    loadLibs,
    getRequestContext: () => requestContext.getStore(),
    tusTempDir,
  }),
});

async function handleTus(req, res) {
  const clientIp = getClientIpFromHttpReq(req);
  const { userId, isAuthenticated, retryAfter } = await authenticateFromRequest(req, clientIp);

  if (retryAfter) {
    res.writeHead(429, { "Content-Type": "application/json", "Retry-After": String(retryAfter) });
    res.end(JSON.stringify({ error: "TOO_MANY_REQUESTS" }));
    return;
  }

  const context = {
    clientIp,
    userId,
    isAuthenticated,
    timestamp: Date.now(),
  };

  return requestContext.run(context, () => {
    return tusServer.handle(req, res);
  });
}

// Full cleanup (expired shares, abandoned tus uploads, orphan files), never overlapping runs
let cleanupRunning = false;
async function runScheduledCleanup(runCleanup) {
  if (cleanupRunning) {
    console.warn("[Cleanup] Previous run still in progress, skipping");
    return;
  }
  cleanupRunning = true;
  try {
    await runCleanup();
  } catch (error) {
    console.error("[Cleanup] Error during scheduled cleanup:", error);
  } finally {
    cleanupRunning = false;
  }
}

process.on("unhandledRejection", (reason) => {
  console.error("[Server] Unhandled promise rejection:", reason);
});

try {
  await app.prepare();
  const { runCleanup } = await import("./scripts/cleanup-expired-shares.ts");
  const cleanupTask = cron.schedule("0 * * * *", () => runScheduledCleanup(runCleanup));
  console.log("> Scheduled hourly cleanup (expired shares, abandoned uploads, orphan files)");

  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      const { pathname } = parsedUrl;

      if (pathname.startsWith("/api/tus")) {
        await handleTus(req, res);
        return;
      }

      // Pass the client IP resolved from the socket to Next.js routes. Always overwritten,
      // so a client cannot forge it.
      req.headers[CLIENT_IP_HEADER] = getClientIpFromHttpReq(req);

      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error("Server error:", err);
      res.statusCode = 500;
      res.end("Internal server error");
    }
  });

  // Large single-request uploads (non-tus) can legitimately take longer than Node's
  // default 5-minute request timeout; idle sockets are still closed by keepAliveTimeout
  server.requestTimeout = 0;

  server.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log(
      `> Tus upload endpoint: http://${hostname}:${port}/api/tus (resumable uploads enabled)`
    );
  });

  let shuttingDown = false;
  const shutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`> ${signal} received, shutting down gracefully`);
    cleanupTask.stop();
    const forceExit = setTimeout(() => process.exit(1), 10_000);
    forceExit.unref();
    server.close(async () => {
      try {
        const { prisma } = await import("./src/lib/prisma.js");
        await prisma.$disconnect();
      } catch (error) {
        console.error("> Error while disconnecting Prisma:", error);
      }
      process.exit(0);
    });
    server.closeIdleConnections?.();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
} catch (error) {
  console.error("> Failed to start server:", error);
  process.exit(1);
}
