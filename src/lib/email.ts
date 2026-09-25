import nodemailer from "nodemailer";
import { getSettingsCached } from "@/lib/settings";
import { renderShareEmail, renderVerifyEmail } from "@/lib/email-templates";

async function getSmtpConfig() {
  const settings = await getSettingsCached();

  if (!settings?.smtpEnabled || !settings.smtpHost) {
    return null;
  }

  return settings;
}

function createSmtpTransporter(config: NonNullable<Awaited<ReturnType<typeof getSmtpConfig>>>) {
  return nodemailer.createTransport({
    host: config.smtpHost!,
    port: config.smtpPort ?? 587,
    secure: config.smtpSecure,
    auth:
      config.smtpUser && config.smtpPassword
        ? { user: config.smtpUser, pass: config.smtpPassword }
        : undefined,
  });
}

export async function isEmailEnabled(): Promise<boolean> {
  const config = await getSmtpConfig();
  return config !== null;
}

export async function sendVerificationEmail(email: string, token: string): Promise<boolean> {
  const config = await getSmtpConfig();
  if (!config) return false;

  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const verifyUrl = `${baseUrl}/auth/verify-email?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;
  const appName = config.appName || "SnowShare";

  const transporter = createSmtpTransporter(config);

  const fromAddress = config.smtpFrom || config.smtpUser || `noreply@snowshare`;

  const { subject, html, text } = renderVerifyEmail(
    { appName, verifyUrl },
    {
      subject: config.verifyEmailSubject,
      html: config.verifyEmailHtml,
      text: config.verifyEmailText,
    }
  );

  await transporter.sendMail({
    from: `"${appName}" <${fromAddress}>`,
    to: email,
    subject,
    html,
    text,
  });

  return true;
}

export async function sendShareEmail(
  shareUrl: string,
  shareTitle: string,
  recipients: string[]
): Promise<boolean> {
  const config = await getSmtpConfig();
  if (!config) return false;

  if (recipients.length === 0) return false;

  const appName = config.appName || "SnowShare";
  const fromAddress = config.smtpFrom || config.smtpUser || `noreply@snowshare`;

  const transporter = createSmtpTransporter(config);

  const { subject, html, text } = renderShareEmail(
    { appName, shareTitle, shareUrl },
    {
      subject: config.shareEmailSubject,
      html: config.shareEmailHtml,
      text: config.shareEmailText,
    }
  );

  for (const recipient of recipients) {
    await transporter.sendMail({
      from: `"${appName}" <${fromAddress}>`,
      to: recipient,
      subject,
      html,
      text,
    });
  }

  return true;
}
