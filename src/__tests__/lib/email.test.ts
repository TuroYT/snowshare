/**
 * @jest-environment node
 */

/**
 * Tests for the email utility (src/lib/email.ts)
 */

const mockSendMail = jest.fn();
const mockCreateTransport = jest.fn(() => ({ sendMail: mockSendMail }));

jest.mock("nodemailer", () => ({
  createTransport: mockCreateTransport,
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    settings: {
      findFirst: jest.fn(),
    },
  },
}));

import { sendVerificationEmail, isEmailEnabled } from "@/lib/email";
import { prisma } from "@/lib/prisma";

const mockSettingsFindFirst = prisma.settings.findFirst as jest.Mock;

const smtpSettings = {
  smtpEnabled: true,
  smtpHost: "smtp.example.com",
  smtpPort: 587,
  smtpUser: "user@example.com",
  smtpPassword: "secret",
  smtpFrom: "noreply@example.com",
  smtpSecure: false,
  appName: "TestApp",
};

describe("email utility", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSendMail.mockResolvedValue({ messageId: "test-id" });
    process.env.NEXTAUTH_URL = "http://localhost:3000";
  });

  afterEach(() => {
    delete process.env.NEXTAUTH_URL;
  });

  // ─── isEmailEnabled ─────────────────────────────────────────────────────────

  describe("isEmailEnabled", () => {
    it("should return true when SMTP is enabled and host is configured", async () => {
      mockSettingsFindFirst.mockResolvedValue(smtpSettings);

      const result = await isEmailEnabled();

      expect(result).toBe(true);
    });

    it("should return false when SMTP is disabled", async () => {
      mockSettingsFindFirst.mockResolvedValue({ ...smtpSettings, smtpEnabled: false });

      const result = await isEmailEnabled();

      expect(result).toBe(false);
    });

    it("should return false when smtpHost is missing", async () => {
      mockSettingsFindFirst.mockResolvedValue({ ...smtpSettings, smtpHost: null });

      const result = await isEmailEnabled();

      expect(result).toBe(false);
    });

    it("should return false when settings are not found", async () => {
      mockSettingsFindFirst.mockResolvedValue(null);

      const result = await isEmailEnabled();

      expect(result).toBe(false);
    });
  });

  // ─── sendVerificationEmail ───────────────────────────────────────────────────

  describe("sendVerificationEmail", () => {
    it("should return false when SMTP is not configured", async () => {
      mockSettingsFindFirst.mockResolvedValue({ ...smtpSettings, smtpEnabled: false });

      const result = await sendVerificationEmail("user@example.com", "my-token");

      expect(result).toBe(false);
      expect(mockSendMail).not.toHaveBeenCalled();
    });

    it("should return false when smtpHost is missing", async () => {
      mockSettingsFindFirst.mockResolvedValue({ ...smtpSettings, smtpHost: null });

      const result = await sendVerificationEmail("user@example.com", "my-token");

      expect(result).toBe(false);
      expect(mockSendMail).not.toHaveBeenCalled();
    });

    it("should create a transporter with the correct SMTP settings", async () => {
      mockSettingsFindFirst.mockResolvedValue(smtpSettings);

      await sendVerificationEmail("user@example.com", "my-token");

      expect(mockCreateTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          host: "smtp.example.com",
          port: 587,
          secure: false,
          auth: { user: "user@example.com", pass: "secret" },
        })
      );
    });

    it("should send an email to the recipient", async () => {
      mockSettingsFindFirst.mockResolvedValue(smtpSettings);

      await sendVerificationEmail("recipient@example.com", "my-token");

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({ to: "recipient@example.com" })
      );
    });

    it("should include the verification link in the email body", async () => {
      mockSettingsFindFirst.mockResolvedValue(smtpSettings);

      await sendVerificationEmail("user@example.com", "abc123");

      const callArgs = mockSendMail.mock.calls[0][0];
      expect(callArgs.html).toContain(
        "/auth/verify-email?token=abc123&email=user%40example.com"
      );
      expect(callArgs.text).toContain(
        "/auth/verify-email?token=abc123&email=user%40example.com"
      );
    });

    it("should use the appName in the email subject", async () => {
      mockSettingsFindFirst.mockResolvedValue({ ...smtpSettings, appName: "MySnowShare" });

      await sendVerificationEmail("user@example.com", "tok");

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({ subject: expect.stringContaining("MySnowShare") })
      );
    });

    it("should use the smtpFrom address as the sender", async () => {
      mockSettingsFindFirst.mockResolvedValue(smtpSettings);

      await sendVerificationEmail("user@example.com", "tok");

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({ from: expect.stringContaining("noreply@example.com") })
      );
    });

    it("should fall back to smtpUser as sender when smtpFrom is absent", async () => {
      mockSettingsFindFirst.mockResolvedValue({ ...smtpSettings, smtpFrom: null });

      await sendVerificationEmail("user@example.com", "tok");

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({ from: expect.stringContaining("user@example.com") })
      );
    });

    it("should create a transporter without auth when smtpUser/smtpPassword are absent", async () => {
      mockSettingsFindFirst.mockResolvedValue({
        ...smtpSettings,
        smtpUser: null,
        smtpPassword: null,
      });

      await sendVerificationEmail("user@example.com", "tok");

      expect(mockCreateTransport).toHaveBeenCalledWith(
        expect.objectContaining({ auth: undefined })
      );
    });

    it("should use NEXTAUTH_URL as the base URL in the verification link", async () => {
      process.env.NEXTAUTH_URL = "https://myapp.example.com";
      mockSettingsFindFirst.mockResolvedValue(smtpSettings);

      await sendVerificationEmail("user@example.com", "tok123");

      const callArgs = mockSendMail.mock.calls[0][0];
      expect(callArgs.html).toContain("https://myapp.example.com/auth/verify-email");
    });

    it("should return true on successful send", async () => {
      mockSettingsFindFirst.mockResolvedValue(smtpSettings);

      const result = await sendVerificationEmail("user@example.com", "tok");

      expect(result).toBe(true);
    });

    it("should propagate errors thrown by nodemailer sendMail", async () => {
      mockSettingsFindFirst.mockResolvedValue(smtpSettings);
      mockSendMail.mockRejectedValue(new Error("SMTP connection refused"));

      await expect(sendVerificationEmail("user@example.com", "tok")).rejects.toThrow(
        "SMTP connection refused"
      );
    });

    it("should use smtpSecure: true when configured", async () => {
      mockSettingsFindFirst.mockResolvedValue({ ...smtpSettings, smtpSecure: true });

      await sendVerificationEmail("user@example.com", "tok");

      expect(mockCreateTransport).toHaveBeenCalledWith(
        expect.objectContaining({ secure: true })
      );
    });

    it("should use default port 587 when smtpPort is null", async () => {
      mockSettingsFindFirst.mockResolvedValue({ ...smtpSettings, smtpPort: null });

      await sendVerificationEmail("user@example.com", "tok");

      expect(mockCreateTransport).toHaveBeenCalledWith(
        expect.objectContaining({ port: 587 })
      );
    });
  });
});
