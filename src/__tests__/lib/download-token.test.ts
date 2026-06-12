import { issueDownloadToken, validateDownloadToken } from "@/lib/download-token";

describe("download-token", () => {
  it("validates a freshly issued token", () => {
    const token = issueDownloadToken("share-abc");
    expect(validateDownloadToken(token, "share-abc")).toBe(true);
  });

  it("rejects a token for the wrong shareId", () => {
    const token = issueDownloadToken("share-abc");
    expect(validateDownloadToken(token, "share-xyz")).toBe(false);
  });

  it("rejects an expired token", () => {
    const token = issueDownloadToken("share-exp", 1);
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(validateDownloadToken(token, "share-exp")).toBe(false);
        resolve();
      }, 20);
    });
  });

  it("rejects an unknown token string", () => {
    expect(validateDownloadToken("not-a-real-token", "share-abc")).toBe(false);
  });
});
