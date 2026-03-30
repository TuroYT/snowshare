/**
 * Tests for the CAPTCHA verification utility (src/lib/captcha.ts)
 */

const mockFetch = jest.fn();
global.fetch = mockFetch;

import { verifyCaptcha } from "@/lib/captcha";

function mockSuccess() {
  mockFetch.mockResolvedValue({
    json: jest.fn().mockResolvedValue({ success: true }),
  });
}

function mockFailure() {
  mockFetch.mockResolvedValue({
    json: jest.fn().mockResolvedValue({ success: false, "error-codes": ["invalid-input-response"] }),
  });
}

describe("verifyCaptcha", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── Cloudflare Turnstile ───────────────────────────────────────────────────

  describe("Cloudflare Turnstile", () => {
    it("should return true when Turnstile verification succeeds", async () => {
      mockSuccess();

      const result = await verifyCaptcha("valid-token", "secret-key", "turnstile");

      expect(result).toBe(true);
    });

    it("should return false when Turnstile verification fails", async () => {
      mockFailure();

      const result = await verifyCaptcha("invalid-token", "secret-key", "turnstile");

      expect(result).toBe(false);
    });

    it("should call the Turnstile siteverify endpoint", async () => {
      mockSuccess();

      await verifyCaptcha("my-token", "my-secret", "turnstile");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://challenges.cloudflare.com/turnstile/v0/siteverify",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ secret: "my-secret", response: "my-token" }),
        })
      );
    });

    it("should return false on network error for Turnstile", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      const result = await verifyCaptcha("token", "secret", "turnstile");

      expect(result).toBe(false);
    });
  });

  // ─── Google reCAPTCHA ───────────────────────────────────────────────────────

  describe("Google reCAPTCHA", () => {
    it("should return true when reCAPTCHA verification succeeds", async () => {
      mockSuccess();

      const result = await verifyCaptcha("valid-token", "secret-key", "recaptcha");

      expect(result).toBe(true);
    });

    it("should return false when reCAPTCHA verification fails", async () => {
      mockFailure();

      const result = await verifyCaptcha("invalid-token", "secret-key", "recaptcha");

      expect(result).toBe(false);
    });

    it("should call the reCAPTCHA siteverify endpoint with POST", async () => {
      mockSuccess();

      await verifyCaptcha("my-token", "my-secret", "recaptcha");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("www.google.com/recaptcha/api/siteverify"),
        expect.objectContaining({ method: "POST" })
      );
    });

    it("should include secret and response as query params for reCAPTCHA", async () => {
      mockSuccess();

      await verifyCaptcha("my-token", "my-secret", "recaptcha");

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain("secret=my-secret");
      expect(calledUrl).toContain("response=my-token");
    });

    it("should return false on network error for reCAPTCHA", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      const result = await verifyCaptcha("token", "secret", "recaptcha");

      expect(result).toBe(false);
    });
  });

  // ─── Unknown provider ───────────────────────────────────────────────────────

  describe("unknown provider", () => {
    it("should return false for an unrecognized provider", async () => {
      const result = await verifyCaptcha("token", "secret", "unknown-provider");

      expect(result).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should return false for an empty provider string", async () => {
      const result = await verifyCaptcha("token", "secret", "");

      expect(result).toBe(false);
    });
  });

  // ─── Edge cases ─────────────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("should return false when the API response has no success field", async () => {
      mockFetch.mockResolvedValue({
        json: jest.fn().mockResolvedValue({}),
      });

      const result = await verifyCaptcha("token", "secret", "turnstile");

      expect(result).toBe(false);
    });

    it("should return false when success is not strictly true", async () => {
      mockFetch.mockResolvedValue({
        json: jest.fn().mockResolvedValue({ success: 1 }),
      });

      const result = await verifyCaptcha("token", "secret", "recaptcha");

      expect(result).toBe(false);
    });
  });
});
