/**
 * @jest-environment node
 */

jest.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: jest.fn(),
    user: { count: jest.fn() },
    share: { groupBy: jest.fn(), aggregate: jest.fn() },
    shareFile: { aggregate: jest.fn() },
  },
}));

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { GET as health } from "@/app/api/health/route";
import { GET as metrics } from "@/app/api/metrics/route";

const p = prisma as unknown as {
  $queryRaw: jest.Mock;
  user: { count: jest.Mock };
  share: { groupBy: jest.Mock; aggregate: jest.Mock };
  shareFile: { aggregate: jest.Mock };
};

function req(auth?: string) {
  return new NextRequest("http://localhost/api/metrics", {
    headers: auth ? { authorization: auth } : {},
  });
}

describe("/api/health", () => {
  beforeEach(() => jest.spyOn(console, "error").mockImplementation(() => {}));
  afterEach(() => jest.restoreAllMocks());

  it("returns 200 when the database answers", async () => {
    p.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);
    const res = await health();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });

  it("returns 503 when the database is down", async () => {
    p.$queryRaw.mockRejectedValue(new Error("down"));
    const res = await health();
    expect(res.status).toBe(503);
  });
});

describe("/api/metrics", () => {
  const OLD = process.env.METRICS_TOKEN;
  afterEach(() => {
    process.env.METRICS_TOKEN = OLD;
  });

  it("is disabled without METRICS_TOKEN", async () => {
    delete process.env.METRICS_TOKEN;
    expect((await metrics(req("Bearer x"))).status).toBe(404);
  });

  it("rejects a wrong token", async () => {
    process.env.METRICS_TOKEN = "secret";
    expect((await metrics(req("Bearer nope"))).status).toBe(401);
    expect((await metrics(req())).status).toBe(401);
  });

  it("exposes counts and storage in Prometheus format", async () => {
    process.env.METRICS_TOKEN = "secret";
    p.user.count.mockResolvedValue(3);
    p.share.groupBy.mockResolvedValue([
      { type: "FILE", _count: { _all: 5 } },
      { type: "URL", _count: { _all: 2 } },
    ]);
    p.share.aggregate.mockResolvedValue({ _sum: { size: BigInt(100) } });
    p.shareFile.aggregate.mockResolvedValue({ _sum: { size: null } });

    const res = await metrics(req("Bearer secret"));
    const body = await res.text();
    expect(res.status).toBe(200);
    expect(body).toContain("snowshare_users 3");
    expect(body).toContain('snowshare_shares{type="FILE"} 5');
    expect(body).toContain("snowshare_storage_bytes 100");
  });
});
