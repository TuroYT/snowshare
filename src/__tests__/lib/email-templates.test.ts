/**
 * @jest-environment node
 */

/**
 * Tests for email template rendering utilities (src/lib/email-templates.ts)
 */

import {
  renderTemplate,
  renderShareEmail,
  renderVerifyEmail,
  sanitizeEmailHtml,
  DEFAULT_SHARE_SUBJECT,
  DEFAULT_SHARE_HTML,
  DEFAULT_SHARE_TEXT,
  DEFAULT_VERIFY_SUBJECT,
  DEFAULT_VERIFY_HTML,
  DEFAULT_VERIFY_TEXT,
} from "@/lib/email-templates";

describe("email-templates", () => {
  // ─── renderTemplate ─────────────────────────────────────────────────────────

  describe("renderTemplate", () => {
    it("replaces known placeholders", () => {
      expect(renderTemplate("Hello {{name}}!", { name: "World" }, false)).toBe("Hello World!");
    });

    it("leaves unknown placeholders unchanged", () => {
      expect(renderTemplate("{{unknown}}", { name: "World" }, false)).toBe("{{unknown}}");
    });

    it("HTML-escapes values when escapeVars=true (default)", () => {
      const result = renderTemplate("<p>{{val}}</p>", { val: "<script>alert(1)</script>" });
      expect(result).toContain("&lt;script&gt;");
      expect(result).not.toContain("<script>");
    });

    it("does NOT HTML-escape values when escapeVars=false", () => {
      const result = renderTemplate("{{val}}", { val: "<b>bold</b>" }, false);
      expect(result).toBe("<b>bold</b>");
    });

    it("replaces multiple occurrences of the same placeholder", () => {
      const result = renderTemplate("{{x}} and {{x}}", { x: "foo" }, false);
      expect(result).toBe("foo and foo");
    });

    it("escapes ampersands in HTML mode", () => {
      const result = renderTemplate("{{val}}", { val: "A&B" }, true);
      expect(result).toBe("A&amp;B");
    });

    it("escapes double quotes in HTML mode", () => {
      const result = renderTemplate('href="{{val}}"', { val: 'say "hi"' }, true);
      expect(result).toBe('href="say &quot;hi&quot;"');
    });
  });

  // ─── renderShareEmail ────────────────────────────────────────────────────────

  describe("renderShareEmail", () => {
    const vars = {
      appName: "TestApp",
      shareTitle: "my-file.pdf",
      shareUrl: "https://example.com/f/abc",
    };

    it("returns rendered subject using default template when no custom template provided", () => {
      const { subject } = renderShareEmail(vars);
      expect(subject).toContain("my-file.pdf");
      expect(subject).toContain("TestApp");
    });

    it("returns rendered HTML using default template", () => {
      const { html } = renderShareEmail(vars);
      expect(html).toContain("https://example.com/f/abc");
      expect(html).toContain("TestApp");
    });

    it("returns rendered text using default template", () => {
      const { text } = renderShareEmail(vars);
      expect(text).toContain("https://example.com/f/abc");
    });

    it("uses custom subject template when provided", () => {
      const { subject } = renderShareEmail(vars, {
        subject: "Download {{shareTitle}} from {{appName}}",
      });
      expect(subject).toBe("Download my-file.pdf from TestApp");
    });

    it("uses custom HTML template when provided", () => {
      const { html } = renderShareEmail(vars, { html: "<a href='{{shareUrl}}'>Get it</a>" });
      expect(html).toContain("https://example.com/f/abc");
    });

    it("uses custom text template when provided", () => {
      const { text } = renderShareEmail(vars, { text: "URL: {{shareUrl}}" });
      expect(text).toBe("URL: https://example.com/f/abc");
    });

    it("HTML-escapes shareTitle in HTML template", () => {
      const xssVars = { ...vars, shareTitle: "<script>alert(1)</script>" };
      const { html } = renderShareEmail(xssVars);
      expect(html).toContain("&lt;script&gt;");
      expect(html).not.toContain("<script>alert");
    });

    it("does NOT HTML-escape shareTitle in text template", () => {
      const xssVars = { ...vars, shareTitle: "<script>" };
      const { text } = renderShareEmail(xssVars);
      expect(text).toContain("<script>");
    });

    it("falls back to defaults when templates are null", () => {
      const { subject, html, text } = renderShareEmail(vars, {
        subject: null,
        html: null,
        text: null,
      });
      expect(subject).toBeTruthy();
      expect(html).toBeTruthy();
      expect(text).toBeTruthy();
    });
  });

  // ─── renderVerifyEmail ───────────────────────────────────────────────────────

  describe("renderVerifyEmail", () => {
    const vars = {
      appName: "TestApp",
      verifyUrl: "https://example.com/auth/verify-email?token=abc&email=u%40e.com",
    };

    it("returns rendered subject using default template", () => {
      const { subject } = renderVerifyEmail(vars);
      expect(subject).toContain("TestApp");
    });

    it("returns rendered HTML containing verifyUrl", () => {
      const { html } = renderVerifyEmail(vars);
      // URL has & escaped to &amp; in HTML mode
      expect(html).toContain("https://example.com/auth/verify-email?token=abc");
      expect(html).toContain("u%40e.com");
    });

    it("returns rendered text containing verifyUrl", () => {
      const { text } = renderVerifyEmail(vars);
      expect(text).toContain(vars.verifyUrl);
    });

    it("uses custom subject when provided", () => {
      const { subject } = renderVerifyEmail(vars, { subject: "Confirm {{appName}} account" });
      expect(subject).toBe("Confirm TestApp account");
    });

    it("uses custom HTML when provided", () => {
      const { html } = renderVerifyEmail(vars, { html: "URL: {{verifyUrl}}" });
      // verifyUrl is HTML-escaped in HTML mode - & becomes &amp;
      expect(html).toContain("https://example.com/auth/verify-email?token=abc");
    });

    it("falls back to defaults when templates are null", () => {
      const { subject, html, text } = renderVerifyEmail(vars, {
        subject: null,
        html: null,
        text: null,
      });
      expect(subject).toBeTruthy();
      expect(html).toBeTruthy();
      expect(text).toBeTruthy();
    });
  });

  // ─── Default template constants ───────────────────────────────────────────────

  describe("default template constants", () => {
    it("DEFAULT_SHARE_SUBJECT contains expected placeholders", () => {
      expect(DEFAULT_SHARE_SUBJECT).toContain("{{shareTitle}}");
      expect(DEFAULT_SHARE_SUBJECT).toContain("{{appName}}");
    });

    it("DEFAULT_SHARE_HTML contains expected placeholders", () => {
      expect(DEFAULT_SHARE_HTML).toContain("{{shareUrl}}");
      expect(DEFAULT_SHARE_HTML).toContain("{{appName}}");
    });

    it("DEFAULT_SHARE_TEXT contains expected placeholders", () => {
      expect(DEFAULT_SHARE_TEXT).toContain("{{shareTitle}}");
      expect(DEFAULT_SHARE_TEXT).toContain("{{shareUrl}}");
    });

    it("DEFAULT_VERIFY_SUBJECT contains expected placeholders", () => {
      expect(DEFAULT_VERIFY_SUBJECT).toContain("{{appName}}");
    });

    it("DEFAULT_VERIFY_HTML contains expected placeholders", () => {
      expect(DEFAULT_VERIFY_HTML).toContain("{{verifyUrl}}");
      expect(DEFAULT_VERIFY_HTML).toContain("{{appName}}");
    });

    it("DEFAULT_VERIFY_TEXT contains expected placeholders", () => {
      expect(DEFAULT_VERIFY_TEXT).toContain("{{verifyUrl}}");
      expect(DEFAULT_VERIFY_TEXT).toContain("{{appName}}");
    });
  });

  // ─── sanitizeEmailHtml ────────────────────────────────────────────────────────

  describe("sanitizeEmailHtml", () => {
    it("removes <script> blocks", () => {
      const result = sanitizeEmailHtml("<p>Hi</p><script>alert(1)</script>");
      expect(result).not.toContain("<script>");
      expect(result).not.toContain("alert(1)");
      expect(result).toContain("<p>Hi</p>");
    });

    it("removes <script> blocks with attributes", () => {
      const result = sanitizeEmailHtml('<script type="text/javascript">evil()</script>');
      expect(result).not.toContain("evil");
    });

    it("removes inline event handlers", () => {
      const result = sanitizeEmailHtml('<a href="x" onclick="evil()">click</a>');
      expect(result).not.toContain("onclick");
      expect(result).not.toContain("evil()");
      expect(result).toContain("<a");
      expect(result).toContain("click</a>");
    });

    it("removes javascript: protocol in href", () => {
      const result = sanitizeEmailHtml('<a href="javascript:alert(1)">link</a>');
      expect(result).not.toContain("javascript:");
    });

    it("removes javascript: in mixed case", () => {
      const result = sanitizeEmailHtml('<a href="JavaScript:void(0)">x</a>');
      expect(result).not.toContain("JavaScript:");
    });

    it("preserves safe HTML untouched", () => {
      const safe = '<div style="color:red"><p>Hello <strong>World</strong></p></div>';
      expect(sanitizeEmailHtml(safe)).toBe(safe);
    });

    it("share email with malicious HTML template has script stripped", () => {
      const { html } = renderShareEmail(
        { appName: "App", shareTitle: "file", shareUrl: "https://example.com/f/x" },
        { html: "<p>{{shareTitle}}</p><script>steal()</script>" }
      );
      expect(html).not.toContain("<script>");
      expect(html).not.toContain("steal()");
      expect(html).toContain("<p>file</p>");
    });

    it("verify email with event-handler template has handler stripped", () => {
      const { html } = renderVerifyEmail(
        { appName: "App", verifyUrl: "https://example.com/verify" },
        { html: '<a href="{{verifyUrl}}" onmouseover="evil()">Verify</a>' }
      );
      expect(html).not.toContain("onmouseover");
      expect(html).not.toContain("evil()");
    });
  });
});
