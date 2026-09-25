/**
 * @jest-environment node
 */

jest.mock("@/lib/settings", () => ({
  getSettingsCached: jest.fn(),
}));

import { GET } from "@/app/api/settings/branding/route";
import { getSettingsCached } from "@/lib/settings";

describe("GET /api/settings/branding", () => {
  it("never exposes secrets stored in the settings row", async () => {
    (getSettingsCached as jest.Mock).mockResolvedValue({
      appName: "Acme",
      primaryColor: "#000000",
      smtpPassword: "smtp-secret",
      s3SecretAccessKey: "s3-secret",
      captchaSecretKey: "captcha-secret",
    });

    const res = await GET();
    const body = await res.json();

    expect(body.branding.appName).toBe("Acme");
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain("smtp-secret");
    expect(serialized).not.toContain("s3-secret");
    expect(serialized).not.toContain("captcha-secret");
    expect(body.branding).not.toHaveProperty("smtpPassword");
  });

  it("returns defaults when no settings exist", async () => {
    (getSettingsCached as jest.Mock).mockResolvedValue(null);

    const body = await (await GET()).json();

    expect(body.branding.appName).toBe("SnowShare");
  });
});
