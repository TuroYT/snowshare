/**
 * @jest-environment node
 */

import { isLinkPreviewBot, previewBotResponse } from "@/lib/preview-bots";

describe("isLinkPreviewBot", () => {
  it.each([
    "Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)",
    "WhatsApp/2.23.20.0",
    "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)",
    "TelegramBot (like TwitterBot)",
    "facebookexternalhit/1.1 Facebot Twitterbot/1.0",
    "LinkedInBot/1.0 (compatible; Mozilla/5.0)",
    "Mozilla/5.0 (Windows NT 6.1; WOW64) SkypeUriPreview Preview/0.5",
  ])("detects %s", (ua) => {
    expect(isLinkPreviewBot(ua)).toBe(true);
  });

  it.each([
    null,
    "",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 discord/1.0.9170 Chrome/128.0 Electron/32.0 Safari/537.36",
    "Mozilla/5.0 AppleWebKit/537.36 Mattermost/5.9.0 Chrome/128.0 Electron/32.0 Safari/537.36",
    "curl/8.10.1",
  ])("lets %s through", (ua) => {
    expect(isLinkPreviewBot(ua)).toBe(false);
  });
});

describe("previewBotResponse", () => {
  it("returns an uncached page without preview metadata", async () => {
    const response = previewBotResponse();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.text();
    expect(body).not.toContain("og:");
    expect(body).toContain("noindex");
  });
});
