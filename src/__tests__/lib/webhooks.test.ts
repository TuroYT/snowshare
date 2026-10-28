/**
 * @jest-environment node
 */

jest.mock("@/lib/settings", () => ({ getSettingsCached: jest.fn() }));
jest.mock("@/lib/prisma", () => ({ prisma: { share: { findUnique: jest.fn() } } }));

import crypto from "crypto";
import { getSettingsCached } from "@/lib/settings";
import { prisma } from "@/lib/prisma";
import { emitShareEvent, isValidWebhookUrl, signWebhookBody } from "@/lib/webhooks";

const settings = getSettingsCached as jest.Mock;
const findUnique = prisma.share.findUnique as jest.Mock;
const fetchMock = jest.fn();

const share = {
  id: "s1",
  slug: "abc",
  type: "FILE" as const,
  ownerId: "u1",
  expiresAt: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = fetchMock as unknown as typeof fetch;
  fetchMock.mockResolvedValue({ ok: true, status: 200 });
  process.env.NEXTAUTH_URL = "https://share.example.com";
  jest.spyOn(console, "error").mockImplementation(() => {});
});

describe("isValidWebhookUrl", () => {
  it("accepts http(s) only", () => {
    expect(isValidWebhookUrl("https://hooks.example.com/x")).toBe(true);
    expect(isValidWebhookUrl("http://10.0.0.2:8080")).toBe(true);
    expect(isValidWebhookUrl("file:///etc/passwd")).toBe(false);
    expect(isValidWebhookUrl("not a url")).toBe(false);
  });
});

describe("emitShareEvent", () => {
  it("does nothing without a configured URL", async () => {
    settings.mockResolvedValue({ webhookUrl: null });
    await emitShareEvent("share.created", share);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("POSTs a signed JSON event", async () => {
    settings.mockResolvedValue({ webhookUrl: "https://hooks.example.com", webhookSecret: "k" });
    await emitShareEvent("share.created", share);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://hooks.example.com");
    const body = JSON.parse(init.body);
    expect(body.event).toBe("share.created");
    expect(body.share).toMatchObject({ slug: "abc", url: "https://share.example.com/f/abc" });
    const expected = "sha256=" + crypto.createHmac("sha256", "k").update(init.body).digest("hex");
    expect(init.headers["X-SnowShare-Signature"]).toBe(expected);
    expect(signWebhookBody("k", init.body)).toBe(expected);
  });

  it("looks the share up by id and never throws on network errors", async () => {
    settings.mockResolvedValue({ webhookUrl: "https://hooks.example.com", webhookSecret: null });
    findUnique.mockResolvedValue(share);
    fetchMock.mockRejectedValue(new Error("boom"));
    await expect(emitShareEvent("share.accessed", "s1")).resolves.toBeUndefined();
    expect(fetchMock.mock.calls[0][1].headers["X-SnowShare-Signature"]).toBeUndefined();
  });
});
