/**
 * Tests for constants and validation functions (constants.ts)
 */

import {
  isValidEmail,
  isValidUrl,
  isValidPassword,
  getUploadDir,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  MAX_URL_LENGTH,
  MAX_EMAIL_LENGTH,
  VALID_PASTE_LANGUAGES,
  isValidPasteLanguage,
} from "@/lib/constants";

describe("isValidEmail", () => {
  describe("valid emails", () => {
    it("should accept a standard email", () => {
      expect(isValidEmail("user@example.com")).toBe(true);
    });

    it("should accept email with subdomain", () => {
      expect(isValidEmail("user@mail.example.com")).toBe(true);
    });

    it("should accept email with plus sign", () => {
      expect(isValidEmail("user+tag@example.com")).toBe(true);
    });

    it("should accept email with dots in local part", () => {
      expect(isValidEmail("first.last@example.com")).toBe(true);
    });

    it("should accept email with hyphens", () => {
      expect(isValidEmail("user-name@example.com")).toBe(true);
    });

    it("should accept email with underscores", () => {
      expect(isValidEmail("user_name@example.com")).toBe(true);
    });
  });

  describe("invalid emails", () => {
    it("should reject an email without @", () => {
      expect(isValidEmail("userexample.com")).toBe(false);
    });

    it("should reject an email without domain", () => {
      expect(isValidEmail("user@")).toBe(false);
    });

    it("should reject an email without local part", () => {
      expect(isValidEmail("@example.com")).toBe(false);
    });

    it("should reject an empty string", () => {
      expect(isValidEmail("")).toBe(false);
    });

    it("should reject an email with backtick", () => {
      expect(isValidEmail("user`@example.com")).toBe(false);
    });

    it("should reject an email that is too long", () => {
      const longLocal = "a".repeat(MAX_EMAIL_LENGTH);
      expect(isValidEmail(`${longLocal}@example.com`)).toBe(false);
    });
  });
});

describe("isValidUrl", () => {
  describe("valid URLs", () => {
    it("should accept a valid http URL", () => {
      expect(isValidUrl("http://example.com").valid).toBe(true);
    });

    it("should accept a valid https URL", () => {
      expect(isValidUrl("https://example.com").valid).toBe(true);
    });

    it("should accept a URL with a path", () => {
      expect(isValidUrl("https://example.com/path/to/page").valid).toBe(true);
    });

    it("should accept a URL with query parameters", () => {
      expect(isValidUrl("https://example.com?q=test&page=1").valid).toBe(true);
    });

    it("should accept a URL with a port", () => {
      expect(isValidUrl("http://example.com:8080").valid).toBe(true);
    });
  });

  describe("invalid URLs", () => {
    it("should reject an empty string", () => {
      const result = isValidUrl("");
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should reject a URL without protocol", () => {
      const result = isValidUrl("example.com");
      expect(result.valid).toBe(false);
    });

    it("should reject a ftp URL", () => {
      const result = isValidUrl("ftp://example.com");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("HTTP");
    });

    it("should reject a javascript URL", () => {
      const result = isValidUrl("javascript:alert(1)");
      expect(result.valid).toBe(false);
    });

    it("should reject a data URL", () => {
      const result = isValidUrl("data:text/html,<script>alert(1)</script>");
      expect(result.valid).toBe(false);
    });

    it("should reject a non-string value", () => {
      const result = isValidUrl(null as unknown as string);
      expect(result.valid).toBe(false);
    });

    it("should reject a URL that is too long", () => {
      const longUrl = "https://example.com/" + "a".repeat(MAX_URL_LENGTH);
      const result = isValidUrl(longUrl);
      expect(result.valid).toBe(false);
    });
  });
});

describe("isValidUrl - SSRF protection", () => {
  it("rejects http://localhost", () => {
    expect(isValidUrl("http://localhost/admin").valid).toBe(false);
  });
  it("rejects http://127.0.0.1", () => {
    expect(isValidUrl("http://127.0.0.1:5432").valid).toBe(false);
  });
  it("rejects http://0.0.0.0", () => {
    expect(isValidUrl("http://0.0.0.0").valid).toBe(false);
  });
  it("rejects 10.x.x.x", () => {
    expect(isValidUrl("http://10.0.0.1").valid).toBe(false);
  });
  it("rejects 192.168.x.x", () => {
    expect(isValidUrl("http://192.168.1.1").valid).toBe(false);
  });
  it("rejects 172.16.x.x", () => {
    expect(isValidUrl("http://172.16.0.1").valid).toBe(false);
  });
  it("rejects 169.254.x.x (AWS metadata)", () => {
    expect(isValidUrl("http://169.254.169.254/latest/meta-data/").valid).toBe(false);
  });
  it("rejects [::1] IPv6 loopback", () => {
    expect(isValidUrl("http://[::1]/").valid).toBe(false);
  });
  it("rejects [::ffff:7f00:1] (IPv4-mapped 127.0.0.1)", () => {
    expect(isValidUrl("http://[::ffff:7f00:1]/").valid).toBe(false);
  });
  it("rejects [::ffff:a9fe:a9fe] (IPv4-mapped 169.254.169.254)", () => {
    expect(isValidUrl("http://[::ffff:a9fe:a9fe]/").valid).toBe(false);
  });
  it("rejects [::ffff:a00:1] (IPv4-mapped 10.0.0.1)", () => {
    expect(isValidUrl("http://[::ffff:a00:1]/").valid).toBe(false);
  });
});

describe("isValidPassword", () => {
  it("should define PASSWORD_MIN_LENGTH as 6", () => {
    expect(PASSWORD_MIN_LENGTH).toBe(6);
  });

  it("should define PASSWORD_MAX_LENGTH as 100", () => {
    expect(PASSWORD_MAX_LENGTH).toBe(100);
  });

  it("should accept a password at the minimum length", () => {
    expect(isValidPassword("a".repeat(PASSWORD_MIN_LENGTH))).toBe(true);
  });

  it("should accept a password at the maximum length", () => {
    expect(isValidPassword("a".repeat(PASSWORD_MAX_LENGTH))).toBe(true);
  });

  it("should accept a password between min and max", () => {
    expect(isValidPassword("mypassword123")).toBe(true);
  });

  it("should reject a password shorter than minimum", () => {
    expect(isValidPassword("a".repeat(PASSWORD_MIN_LENGTH - 1))).toBe(false);
  });

  it("should reject a password longer than maximum", () => {
    expect(isValidPassword("a".repeat(PASSWORD_MAX_LENGTH + 1))).toBe(false);
  });

  it("should reject an empty password", () => {
    expect(isValidPassword("")).toBe(false);
  });
});

describe("getUploadDir", () => {
  const originalEnv = process.env.UPLOAD_DIR;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.UPLOAD_DIR;
    } else {
      process.env.UPLOAD_DIR = originalEnv;
    }
  });

  it("should return the UPLOAD_DIR env variable when set", () => {
    process.env.UPLOAD_DIR = "/custom/upload/path";
    expect(getUploadDir()).toBe("/custom/upload/path");
  });

  it("should return a default path ending with 'uploads' when UPLOAD_DIR is not set", () => {
    delete process.env.UPLOAD_DIR;
    const dir = getUploadDir();
    expect(dir).toMatch(/uploads$/);
  });
});

describe("isValidPasteLanguage", () => {
  it("should accept all valid languages", () => {
    for (const lang of VALID_PASTE_LANGUAGES) {
      expect(isValidPasteLanguage(lang)).toBe(true);
    }
  });

  it("should accept PLAINTEXT", () => {
    expect(isValidPasteLanguage("PLAINTEXT")).toBe(true);
  });

  it("should accept JAVASCRIPT", () => {
    expect(isValidPasteLanguage("JAVASCRIPT")).toBe(true);
  });

  it("should accept TYPESCRIPT", () => {
    expect(isValidPasteLanguage("TYPESCRIPT")).toBe(true);
  });

  it("should accept PYTHON", () => {
    expect(isValidPasteLanguage("PYTHON")).toBe(true);
  });

  it("should reject lowercase language names", () => {
    expect(isValidPasteLanguage("javascript")).toBe(false);
  });

  it("should reject an unknown language", () => {
    expect(isValidPasteLanguage("COBOL")).toBe(false);
  });

  it("should reject an empty string", () => {
    expect(isValidPasteLanguage("")).toBe(false);
  });
});
