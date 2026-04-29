/**
 * Email template rendering utilities.
 *
 * Templates support a small set of safe variables enclosed in double curly
 * braces: {{appName}}, {{shareTitle}}, {{shareUrl}}, {{verifyUrl}}.
 *
 * All variable values are HTML-escaped before being injected into HTML
 * templates.  Plain-text templates receive the raw (unescaped) values so
 * that URLs remain copy-pasteable.
 */

export type EmailType = "share" | "verify";

/** Variables available inside share-email templates. */
export interface ShareTemplateVars {
  appName: string;
  shareTitle: string;
  shareUrl: string;
}

/** Variables available inside verification-email templates. */
export interface VerifyTemplateVars {
  appName: string;
  verifyUrl: string;
}

export type TemplateVars = ShareTemplateVars | VerifyTemplateVars;

// ─── Default templates ────────────────────────────────────────────────────────

export const DEFAULT_SHARE_SUBJECT = `Someone shared "{{shareTitle}}" with you – {{appName}}`;

export const DEFAULT_SHARE_HTML = `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
  <h2 style="color: #111827;">You received a share</h2>
  <p style="color: #374151;">Someone shared <strong>{{shareTitle}}</strong> with you via <strong>{{appName}}</strong>.</p>
  <a href="{{shareUrl}}"
     style="display: inline-block; margin: 16px 0; padding: 12px 24px; background: #3B82F6; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600;">
    Access the share
  </a>
  <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 24px 0;" />
  <p style="color: #9CA3AF; font-size: 12px;">Or copy this URL: {{shareUrl}}</p>
</div>`;

export const DEFAULT_SHARE_TEXT = `Someone shared "{{shareTitle}}" with you via {{appName}}:\n\n{{shareUrl}}`;

export const DEFAULT_VERIFY_SUBJECT = `Verify your email – {{appName}}`;

export const DEFAULT_VERIFY_HTML = `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
  <h2 style="color: #111827;">Email Verification</h2>
  <p style="color: #374151;">Please click the button below to verify your email address for <strong>{{appName}}</strong>.</p>
  <a href="{{verifyUrl}}"
     style="display: inline-block; margin: 16px 0; padding: 12px 24px; background: #3B82F6; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600;">
    Verify Email
  </a>
  <p style="color: #6B7280; font-size: 14px;">This link expires in 24 hours.</p>
  <p style="color: #6B7280; font-size: 14px;">If you didn&#39;t create an account on {{appName}}, you can safely ignore this email.</p>
  <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 24px 0;" />
  <p style="color: #9CA3AF; font-size: 12px;">Or copy this URL: {{verifyUrl}}</p>
</div>`;

export const DEFAULT_VERIFY_TEXT = `Verify your email for {{appName}}:\n\n{{verifyUrl}}\n\nThis link expires in 24 hours.`;

// ─── Renderer ─────────────────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Render a template string by replacing `{{variable}}` placeholders.
 *
 * @param template   - The template string (may contain HTML or plain text).
 * @param vars       - Key/value map of variable replacements.
 * @param escapeVars - When `true` (default for HTML), variable values are
 *                     HTML-escaped before insertion.  Pass `false` for plain
 *                     text templates so that URLs stay intact.
 */
export function renderTemplate(
  template: string,
  vars: Record<string, string>,
  escapeVars = true
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    if (Object.prototype.hasOwnProperty.call(vars, key)) {
      const value = vars[key];
      return escapeVars ? escapeHtml(value) : value;
    }
    return match; // leave unknown placeholders unchanged
  });
}

// ─── Convenience renderers ────────────────────────────────────────────────────

/** Render a share email from raw template strings (or defaults). */
export function renderShareEmail(
  vars: ShareTemplateVars,
  templates?: {
    subject?: string | null;
    html?: string | null;
    text?: string | null;
  }
): { subject: string; html: string; text: string } {
  const varMap: Record<string, string> = {
    appName: vars.appName,
    shareTitle: vars.shareTitle,
    shareUrl: vars.shareUrl,
  };

  const subjectTpl = templates?.subject || DEFAULT_SHARE_SUBJECT;
  const htmlTpl = templates?.html || DEFAULT_SHARE_HTML;
  const textTpl = templates?.text || DEFAULT_SHARE_TEXT;

  return {
    subject: renderTemplate(subjectTpl, varMap, false),
    html: renderTemplate(htmlTpl, varMap, true),
    text: renderTemplate(textTpl, varMap, false),
  };
}

/** Render a verification email from raw template strings (or defaults). */
export function renderVerifyEmail(
  vars: VerifyTemplateVars,
  templates?: {
    subject?: string | null;
    html?: string | null;
    text?: string | null;
  }
): { subject: string; html: string; text: string } {
  const varMap: Record<string, string> = {
    appName: vars.appName,
    verifyUrl: vars.verifyUrl,
  };

  const subjectTpl = templates?.subject || DEFAULT_VERIFY_SUBJECT;
  const htmlTpl = templates?.html || DEFAULT_VERIFY_HTML;
  const textTpl = templates?.text || DEFAULT_VERIFY_TEXT;

  return {
    subject: renderTemplate(subjectTpl, varMap, false),
    html: renderTemplate(htmlTpl, varMap, true),
    text: renderTemplate(textTpl, varMap, false),
  };
}
