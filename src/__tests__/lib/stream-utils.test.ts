/**
 * @jest-environment node
 */

/**
 * Tests for stream utilities (stream-utils.ts)
 */

import { parseRangeHeader, nodeStreamToWebStream } from "@/lib/stream-utils";
import { Readable } from "stream";

describe("parseRangeHeader", () => {
  const FILE_SIZE = 1000;

  describe("valid ranges", () => {
    it("should parse a basic range", () => {
      const result = parseRangeHeader("bytes=0-499", FILE_SIZE);
      expect(result).toEqual({ start: 0, end: 499 });
    });

    it("should parse a range starting from a non-zero position", () => {
      const result = parseRangeHeader("bytes=500-999", FILE_SIZE);
      expect(result).toEqual({ start: 500, end: 999 });
    });

    it("should parse a range to the last byte", () => {
      const result = parseRangeHeader("bytes=0-999", FILE_SIZE);
      expect(result).toEqual({ start: 0, end: 999 });
    });

    it("should default end to fileSize - 1 when end is omitted", () => {
      const result = parseRangeHeader("bytes=500-", FILE_SIZE);
      expect(result).toEqual({ start: 500, end: 999 });
    });

    it("should parse a single byte range", () => {
      const result = parseRangeHeader("bytes=0-0", FILE_SIZE);
      expect(result).toEqual({ start: 0, end: 0 });
    });

    it("should parse a range for the last byte only", () => {
      const result = parseRangeHeader("bytes=999-999", FILE_SIZE);
      expect(result).toEqual({ start: 999, end: 999 });
    });
  });

  describe("invalid ranges", () => {
    it("should return null for an empty string", () => {
      const result = parseRangeHeader("", FILE_SIZE);
      expect(result).toBeNull();
    });

    it("should return null when start > end", () => {
      const result = parseRangeHeader("bytes=500-100", FILE_SIZE);
      expect(result).toBeNull();
    });

    it("should return null when start is out of bounds", () => {
      const result = parseRangeHeader("bytes=1000-1999", FILE_SIZE);
      expect(result).toBeNull();
    });

    it("should return null when end exceeds fileSize - 1", () => {
      const result = parseRangeHeader("bytes=0-1000", FILE_SIZE);
      expect(result).toBeNull();
    });

    it("should return null for negative start", () => {
      const result = parseRangeHeader("bytes=-1-499", FILE_SIZE);
      expect(result).toBeNull();
    });

    it("should return null for non-numeric values", () => {
      const result = parseRangeHeader("bytes=abc-def", FILE_SIZE);
      expect(result).toBeNull();
    });

    it("should return null when format has too many parts", () => {
      const result = parseRangeHeader("bytes=0-499-999", FILE_SIZE);
      expect(result).toBeNull();
    });

    it("should return null for a missing separator", () => {
      const result = parseRangeHeader("bytes=0", FILE_SIZE);
      expect(result).toBeNull();
    });
  });

  describe("edge cases with file size", () => {
    it("should work with a 1-byte file", () => {
      const result = parseRangeHeader("bytes=0-0", 1);
      expect(result).toEqual({ start: 0, end: 0 });
    });

    it("should reject a range that starts at position 1 for a 1-byte file", () => {
      const result = parseRangeHeader("bytes=1-1", 1);
      expect(result).toBeNull();
    });

    it("should work with a large file size", () => {
      const largeSize = 10 * 1024 * 1024 * 1024; // 10 GB
      const result = parseRangeHeader(`bytes=0-${largeSize - 1}`, largeSize);
      expect(result).toEqual({ start: 0, end: largeSize - 1 });
    });
  });
});

describe("nodeStreamToWebStream", () => {
  it("should convert a Node.js readable stream to a Web ReadableStream", async () => {
    const data = "hello world";
    const nodeStream = Readable.from([Buffer.from(data)]);
    const webStream = nodeStreamToWebStream(nodeStream);

    expect(webStream).toBeInstanceOf(ReadableStream);

    const reader = webStream.getReader();
    const chunks: Uint8Array[] = [];
    let done = false;

    while (!done) {
      const result = await reader.read();
      done = result.done;
      if (result.value) {
        chunks.push(result.value);
      }
    }

    const combined = Buffer.concat(chunks).toString();
    expect(combined).toBe(data);
  });

  it("should forward errors from the Node.js stream", async () => {
    const nodeStream = new Readable({
      read() {
        this.emit("error", new Error("stream error"));
      },
    });

    const webStream = nodeStreamToWebStream(nodeStream);
    const reader = webStream.getReader();

    await expect(reader.read()).rejects.toThrow("stream error");
  });

  it("should cancel the Node.js stream when the web stream is cancelled", async () => {
    const nodeStream = new Readable({
      read() {
        // never push data
      },
    });

    const destroySpy = jest.spyOn(nodeStream, "destroy");
    const webStream = nodeStreamToWebStream(nodeStream);
    const reader = webStream.getReader();

    await reader.cancel();
    expect(destroySpy).toHaveBeenCalled();
  });

  it("should handle multiple chunks", async () => {
    const chunks = ["chunk1", "chunk2", "chunk3"];
    const nodeStream = Readable.from(chunks.map((c) => Buffer.from(c)));
    const webStream = nodeStreamToWebStream(nodeStream);

    const reader = webStream.getReader();
    const received: string[] = [];
    let done = false;

    while (!done) {
      const result = await reader.read();
      done = result.done;
      if (result.value) {
        received.push(Buffer.from(result.value).toString());
      }
    }

    expect(received.join("")).toBe(chunks.join(""));
  });
});
