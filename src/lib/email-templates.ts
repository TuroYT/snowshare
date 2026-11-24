import sanitizeHtml from "sanitize-html";

export type EmailType = "share" | "verify" | "reset";

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

/** Variables available inside password-reset email templates. */
export interface ResetTemplateVars {
  appName: string;
  resetUrl: string;
}

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

export const DEFAULT_RESET_SUBJECT = `Reset your password – {{appName}}`;

export const DEFAULT_RESET_HTML = `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
  <h2 style="color: #111827;">Reset your password</h2>
  <p style="color: #374151;">We received a request to reset the password of your <strong>{{appName}}</strong> account. Click the button below to choose a new one.</p>
  <a href="{{resetUrl}}"
     style="display: inline-block; margin: 16px 0; padding: 12px 24px; background: #3B82F6; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600;">
    Set a new password
  </a>
  <p style="color: #6B7280; font-size: 14px;">This link expires in 1 hour and can be used once.</p>
  <p style="color: #6B7280; font-size: 14px;">If you didn&#39;t ask for this, you can safely ignore this email: your password will not change.</p>
  <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 24px 0;" />
  <p style="color: #9CA3AF; font-size: 12px;">Or copy this URL: {{resetUrl}}</p>
</div>`;

export const DEFAULT_RESET_TEXT = `We received a request to reset your {{appName}} password. Choose a new one here:\n\n{{resetUrl}}\n\nThis link expires in 1 hour and can be used once. If you didn't ask for this, ignore this email: your password will not change.`;

function escapeHtml(str: string): string {
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * Strips scripts, inline event handlers and `javascript:` URIs from an admin-supplied HTML
 * template, so DB-stored templates cannot carry active payloads.
 */
export function sanitizeEmailHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.filter(
      (tag) => tag !== "script" && tag !== "style"
    ),
    allowedAttributes: {
      a: ["href", "name", "target", "rel", "style"],
      div: ["style"],
      p: ["style"],
      h1: ["style"],
      h2: ["style"],
      h3: ["style"],
      h4: ["style"],
      h5: ["style"],
      h6: ["style"],
      span: ["style"],
      strong: ["style"],
      em: ["style"],
      hr: ["style"],
      "*": ["style"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesAppliedToAttributes: ["href", "src", "cite"],
    allowProtocolRelative: false,
  });
}

/** Replaces `{{variable}}` placeholders. Pass `escapeVars = false` for plain-text templates so URLs stay intact. */
export function renderTemplate(
  template: string,
  vars: Record<string, string>,
  escapeVars = true
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    if (Object.hasOwn(vars, key)) {
      const value = vars[key];
      return escapeVars ? escapeHtml(value) : value;
    }
    return match;
  });
}

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
  const htmlTpl = sanitizeEmailHtml(templates?.html || DEFAULT_SHARE_HTML);
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
  const htmlTpl = sanitizeEmailHtml(templates?.html || DEFAULT_VERIFY_HTML);
  const textTpl = templates?.text || DEFAULT_VERIFY_TEXT;

  return {
    subject: renderTemplate(subjectTpl, varMap, false),
    html: renderTemplate(htmlTpl, varMap, true),
    text: renderTemplate(textTpl, varMap, false),
  };
}

/** Render a password-reset email from raw template strings (or defaults). */
export function renderResetEmail(
  vars: ResetTemplateVars,
  templates?: {
    subject?: string | null;
    html?: string | null;
    text?: string | null;
  }
): { subject: string; html: string; text: string } {
  const varMap: Record<string, string> = {
    appName: vars.appName,
    resetUrl: vars.resetUrl,
  };

  const subjectTpl = templates?.subject || DEFAULT_RESET_SUBJECT;
  const htmlTpl = sanitizeEmailHtml(templates?.html || DEFAULT_RESET_HTML);
  const textTpl = templates?.text || DEFAULT_RESET_TEXT;

  return {
    subject: renderTemplate(subjectTpl, varMap, false),
    html: renderTemplate(htmlTpl, varMap, true),
    text: renderTemplate(textTpl, varMap, false),
  };
}
