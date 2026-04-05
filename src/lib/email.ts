import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";

async function getSmtpConfig() {
  const settings = await prisma.settings.findFirst({
    select: {
      smtpEnabled: true,
      smtpHost: true,
      smtpPort: true,
      smtpUser: true,
      smtpPassword: true,
      smtpFrom: true,
      smtpSecure: true,
      appName: true,
    },
  });

  if (!settings?.smtpEnabled || !settings.smtpHost) {
    return null;
  }

  return settings;
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

  const transporter = nodemailer.createTransport({
    host: config.smtpHost!,
    port: config.smtpPort ?? 587,
    secure: config.smtpSecure,
    auth:
      config.smtpUser && config.smtpPassword
        ? { user: config.smtpUser, pass: config.smtpPassword }
        : undefined,
  });

  const fromAddress = config.smtpFrom || config.smtpUser || `noreply@snowshare`;

  await transporter.sendMail({
    from: `"${appName}" <${fromAddress}>`,
    to: email,
    subject: `Verify your email – ${appName}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #111827;">Email Verification</h2>
        <p style="color: #374151;">Please click the button below to verify your email address for <strong>${appName}</strong>.</p>
        <a href="${verifyUrl}"
           style="display: inline-block; margin: 16px 0; padding: 12px 24px; background: #3B82F6; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600;">
          Verify Email
        </a>
        <p style="color: #6B7280; font-size: 14px;">This link expires in 24 hours.</p>
        <p style="color: #6B7280; font-size: 14px;">If you didn't create an account on ${appName}, you can safely ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 24px 0;" />
        <p style="color: #9CA3AF; font-size: 12px;">Or copy this URL: ${verifyUrl}</p>
      </div>
    `,
    text: `Verify your email for ${appName}:\n\n${verifyUrl}\n\nThis link expires in 24 hours.`,
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

  const appName = config.appName || "SnowShare";
  const fromAddress = config.smtpFrom || config.smtpUser || `noreply@snowshare`;

  const transporter = nodemailer.createTransport({
    host: config.smtpHost!,
    port: config.smtpPort ?? 587,
    secure: config.smtpSecure,
    auth:
      config.smtpUser && config.smtpPassword
        ? { user: config.smtpUser, pass: config.smtpPassword }
        : undefined,
  });

  for (const recipient of recipients) {
    await transporter.sendMail({
      from: `"${appName}" <${fromAddress}>`,
      to: recipient,
      subject: `Someone shared "${shareTitle}" with you – ${appName}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #111827;">You received a share</h2>
          <p style="color: #374151;">Someone shared <strong>${shareTitle}</strong> with you via <strong>${appName}</strong>.</p>
          <a href="${shareUrl}"
             style="display: inline-block; margin: 16px 0; padding: 12px 24px; background: #3B82F6; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600;">
            Access the share
          </a>
          <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 24px 0;" />
          <p style="color: #9CA3AF; font-size: 12px;">Or copy this URL: ${shareUrl}</p>
        </div>
      `,
      text: `Someone shared "${shareTitle}" with you via ${appName}:\n\n${shareUrl}`,
    });
  }

  return true;
}
