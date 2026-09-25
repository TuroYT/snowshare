/**
 * @jest-environment node
 */

import fs from "fs";
import os from "os";
import path from "path";
import { NextRequest } from "next/server";
import { MultipartError, receiveMultipart } from "@/lib/multipart-upload";

const BOUNDARY = "----snowshare-test-boundary";

function multipartBody(parts: { name: string; filename?: string; content: string | Buffer }[]) {
  const chunks: Buffer[] = [];
  for (const part of parts) {
    const disposition = part.filename
      ? `form-data; name="${part.name}"; filename="${part.filename}"`
      : `form-data; name="${part.name}"`;
    chunks.push(Buffer.from(`--${BOUNDARY}\r\nContent-Disposition: ${disposition}\r\n`));
    if (part.filename) chunks.push(Buffer.from("Content-Type: application/octet-stream\r\n"));
    chunks.push(Buffer.from("\r\n"));
    chunks.push(Buffer.isBuffer(part.content) ? part.content : Buffer.from(part.content));
    chunks.push(Buffer.from("\r\n"));
  }
  chunks.push(Buffer.from(`--${BOUNDARY}--\r\n`));
  return Buffer.concat(chunks);
}

function makeRequest(body: Buffer): NextRequest {
  return new NextRequest("http://localhost/api/upload", {
    method: "POST",
    body: new Uint8Array(body),
    headers: { "content-type": `multipart/form-data; boundary=${BOUNDARY}` },
  });
}

/** Fails the test instead of hanging forever */
function withTimeout<T>(promise: Promise<T>, ms = 5000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timed out")), ms)),
  ]);
}

describe("receiveMultipart", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "snowshare-multipart-"));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  const options = () => ({ tempDir, maxFileBytes: 100, maxTotalBytes: 1000, maxFiles: 2 });

  it("streams files to disk and returns fields", async () => {
    const body = multipartBody([
      { name: "slug", content: "my-slug" },
      { name: "file", filename: "a.txt", content: "hello" },
    ]);

    const { fields, files } = await withTimeout(receiveMultipart(makeRequest(body), options()));

    expect(fields.slug).toBe("my-slug");
    expect(files).toHaveLength(1);
    expect(files[0].size).toBe(5);
    expect(fs.readFileSync(files[0].tempPath, "utf8")).toBe("hello");
  });

  it.each([150, 200 * 1024, 5 * 1024 * 1024])(
    "rejects a %i-byte file over the limit without hanging",
    async (size) => {
      const body = multipartBody([
        { name: "file", filename: "big.bin", content: Buffer.alloc(size) },
      ]);

      await expect(
        withTimeout(receiveMultipart(makeRequest(body), options()))
      ).rejects.toMatchObject({ kind: "FILE_TOO_LARGE" });
      // Temporary files are cleaned up
      expect(fs.readdirSync(tempDir)).toEqual([]);
    }
  );

  it("rejects too many files", async () => {
    const body = multipartBody([
      { name: "f1", filename: "1.txt", content: "a" },
      { name: "f2", filename: "2.txt", content: "b" },
      { name: "f3", filename: "3.txt", content: "c" },
    ]);

    await expect(
      withTimeout(receiveMultipart(makeRequest(body), options()))
    ).rejects.toBeInstanceOf(MultipartError);
    expect(fs.readdirSync(tempDir)).toEqual([]);
  });

  it("never keeps directory components from the client filename", async () => {
    const body = multipartBody([{ name: "file", filename: "../../evil.txt", content: "x" }]);

    const { files } = await withTimeout(receiveMultipart(makeRequest(body), options()));

    expect(files[0].filename).toBe("evil.txt");
    expect(path.dirname(files[0].tempPath)).toBe(tempDir);
  });
});
