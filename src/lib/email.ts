import crypto from "crypto"
import nodemailer from "nodemailer"
import { prisma } from "./prisma"

export interface EmailOptions {
  to: string
  subject: string
  html: string
  text?: string
}

/**
 * Get SMTP configuration from database settings
 */
async function getSmtpConfig() {
  const settings = await prisma.settings.findFirst()
  
  if (!settings?.smtpHost || !settings?.smtpPort) {
    throw new Error("SMTP configuration not found. Please configure SMTP in admin settings.")
  }

  return {
    host: settings.smtpHost,
    port: settings.smtpPort,
    secure: settings.smtpSecure ?? true,
    auth: settings.smtpUser && settings.smtpPassword ? {
      user: settings.smtpUser,
      pass: settings.smtpPassword,
    } : undefined,
    from: {
      email: settings.smtpFromEmail || settings.smtpUser || "noreply@snowshare.local",
      name: settings.smtpFromName || "SnowShare"
    }
  }
}

/**
 * Create nodemailer transporter with current SMTP settings
 */
async function createTransporter() {
  const config = await getSmtpConfig()
  
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth,
  })
}

/**
 * Send an email using configured SMTP settings
 */
export async function sendEmail(options: EmailOptions): Promise<void> {
  const transporter = await createTransporter()
  const config = await getSmtpConfig()
  
  await transporter.sendMail({
    from: `"${config.from.name}" <${config.from.email}>`,
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html,
  })
}

/**
 * Send a test email to verify SMTP configuration
 */
export async function sendTestEmail(toEmail: string): Promise<void> {
  await sendEmail({
    to: toEmail,
    subject: "SnowShare - Test Email",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #3B82F6;">Test Email</h2>
        <p>This is a test email from SnowShare to verify your SMTP configuration.</p>
        <p>If you received this email, your SMTP settings are configured correctly.</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
        <p style="color: #6b7280; font-size: 12px;">
          This is an automated message from SnowShare. Please do not reply to this email.
        </p>
      </div>
    `,
    text: "This is a test email from SnowShare to verify your SMTP configuration. If you received this email, your SMTP settings are configured correctly."
  })
}

/**
 * Generate a verification token
 */
export function generateVerificationToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

/**
 * Send email verification email
 */
export async function sendVerificationEmail(
  email: string,
  token: string,
  baseUrl: string
): Promise<void> {
  const verificationUrl = `${baseUrl}/auth/verify-email?token=${token}`
  
  await sendEmail({
    to: email,
    subject: "SnowShare - Verify Your Email Address",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #3B82F6;">Verify Your Email Address</h2>
        <p>Thank you for registering with SnowShare!</p>
        <p>Please click the button below to verify your email address:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationUrl}" 
             style="background-color: #3B82F6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Verify Email Address
          </a>
        </div>
        <p style="color: #6b7280; font-size: 14px;">
          Or copy and paste this link into your browser:
        </p>
        <p style="color: #3B82F6; word-break: break-all; font-size: 12px;">
          ${verificationUrl}
        </p>
        <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">
          This verification link will expire in 24 hours.
        </p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
        <p style="color: #6b7280; font-size: 12px;">
          If you did not create an account, please ignore this email.
        </p>
      </div>
    `,
    text: `Thank you for registering with SnowShare!\n\nPlease verify your email address by clicking the following link:\n${verificationUrl}\n\nThis link will expire in 24 hours.\n\nIf you did not create an account, please ignore this email.`
  })
}
