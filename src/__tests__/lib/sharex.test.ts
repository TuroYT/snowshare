import { buildShareXConfig } from "@/lib/sharex";

describe("buildShareXConfig", () => {
  it("builds a multipart file uploader pointing at /api/v1/upload", () => {
    const c = buildShareXConfig("https://share.example.com/", "sk_abc", "files");
    expect(c.RequestURL).toBe("https://share.example.com/api/v1/upload");
    expect(c.Body).toBe("MultipartFormData");
    expect(c.FileFormName).toBe("file");
    expect(c.Headers).toEqual({ Authorization: "Bearer sk_abc" });
    expect(c.URL).toBe("https://share.example.com/f/{json:share.slug}");
  });

  it("builds a URL shortener posting a URL share to /api/v1/shares", () => {
    const c = buildShareXConfig("https://share.example.com", "sk_abc", "links");
    expect(c.RequestURL).toBe("https://share.example.com/api/v1/shares");
    expect(c.DestinationType).toBe("URLShortener");
    expect(JSON.parse(c.Data as string)).toEqual({ type: "URL", urlOriginal: "{input}" });
    expect(c.URL).toBe("https://share.example.com/l/{json:share.slug}");
  });
});
