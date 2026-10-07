/**
 * Link preview bots (Discord, WhatsApp, Slack...) fetch every URL pasted in a chat.
 * Share routes that redirect or serve files would count those fetches as views and burn
 * single-use shares before the recipient opens them, so they answer bots with an empty page.
 */

const PREVIEW_BOT_PATTERN =
  /discordbot|whatsapp|slackbot|slack-imgproxy|telegrambot|twitterbot|facebookexternalhit|facebot|linkedinbot|skypeuripreview|mattermost-bot|redditbot|pinterestbot|embedly|iframely|vkshare|bitlybot|google-pagerenderer/i;

export function isLinkPreviewBot(userAgent: string | null | undefined): boolean {
  return !!userAgent && PREVIEW_BOT_PATTERN.test(userAgent);
}

/** Empty page without preview metadata: the bot shows no embed and no view is counted. */
export function previewBotResponse(): Response {
  return new Response(
    '<!doctype html><html><head><meta name="robots" content="noindex, nofollow"></head><body></body></html>',
    {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
    }
  );
}
