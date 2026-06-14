import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { apiError, internalError, ErrorCode } from "@/lib/api-errors";
import { encryptSecret } from "@/lib/crypto-link";
import type { Settings } from "@/generated/prisma";

type SettingsInput = Record<string, unknown>;

function field<K extends keyof Settings>(
  data: SettingsInput,
  current: Settings,
  key: K
): Settings[K] {
  return key in data && data[key] !== undefined ? (data[key] as Settings[K]) : current[key];
}

function nullableString<K extends keyof Settings>(
  data: SettingsInput,
  current: Settings,
  key: K
): Settings[K] {
  return key in data && data[key] !== undefined
    ? (((data[key] as string) || null) as Settings[K])
    : current[key];
}

/** Like maskedSecret but encrypts the new value with AES-256-GCM when NEXTAUTH_SECRET is available. */
function encryptedSecret<K extends keyof Settings>(
  data: SettingsInput,
  current: Settings,
  key: K
): Settings[K] {
  const val = data[key];
  if (val !== undefined && val !== "••••••••") {
    if (typeof val !== "string" && val !== null) return current[key];
    const raw = (val || null) as Settings[K];
    const secret = process.env.NEXTAUTH_SECRET;
    if (raw && secret) {
      return encryptSecret(raw as string, secret) as Settings[K];
    }
    return raw;
  }
  return current[key];
}

const DEFAULT_TERMS = `# Terms of Use

Welcome to SnowShare! By using our platform, you agree to the following terms and conditions. Please read them carefully.

## 1. Acceptance of Terms
By accessing or using SnowShare, you agree to be bound by these Terms of Use and our Privacy Policy. If you do not agree, please do not use our platform.

## 2. Description of Service
SnowShare is a secure file, link, and paste sharing platform. We provide users with the ability to share content with expiration dates, user authentication, and quotas.

## 3. User Responsibilities
- You are responsible for maintaining the confidentiality of your account credentials.
- You agree not to use SnowShare for any illegal or unauthorized purposes.
- You must comply with all applicable laws and regulations.

## 4. Content Restrictions
- Do not upload or share content that is illegal, harmful, or violates the rights of others.
- We reserve the right to remove any content that violates these terms.

## 5. Privacy
Your use of SnowShare is subject to our Privacy Policy, which explains how we collect, use, and protect your information.

## 6. Limitation of Liability
SnowShare is provided "as is" without any warranties. We are not liable for any damages arising from your use of the platform.

## 7. Changes to Terms
We reserve the right to update these Terms of Use at any time. Changes will be effective upon posting.

## 8. Contact Us
If you have any questions about these Terms of Use, please contact us at support@snowshare.com.

Thank you for using SnowShare!`;

function d<T>(val: unknown, fallback: T): T {
  return val !== undefined ? (val as T) : fallback;
}

function buildFirstRunSettingsCreate(data: SettingsInput) {
  return {
    allowSignin: d(data.allowSignin, true),
    disableCredentialsLogin: d(data.disableCredentialsLogin, false),
    allowAnonFileShare: d(data.allowAnonFileShare, true),
    allowAnonLinkShare: d(data.allowAnonLinkShare, true),
    allowAnonPasteShare: d(data.allowAnonPasteShare, true),
    anoMaxUpload: (data.anoMaxUpload as number) || 2048,
    authMaxUpload: (data.authMaxUpload as number) || 51200,
    anoIpQuota: (data.anoIpQuota as number) || 4096,
    authIpQuota: (data.authIpQuota as number) || 102400,
    useGiBForAnon: d(data.useGiBForAnon, false),
    useGiBForAuth: d(data.useGiBForAuth, false),
    appName: (data.appName as string) || "SnowShare",
    appDescription: (data.appDescription as string) || "Share your files, pastes and URLs securely",
    logoUrl: (data.logoUrl as string) || null,
    faviconUrl: (data.faviconUrl as string) || null,
    primaryColor: (data.primaryColor as string) || "#3B82F6",
    primaryHover: (data.primaryHover as string) || "#2563EB",
    primaryDark: (data.primaryDark as string) || "#1E40AF",
    secondaryColor: (data.secondaryColor as string) || "#8B5CF6",
    secondaryHover: (data.secondaryHover as string) || "#7C3AED",
    secondaryDark: (data.secondaryDark as string) || "#6D28D9",
    backgroundColor: (data.backgroundColor as string) || "#111827",
    backgroundImageUrl: (data.backgroundImageUrl as string) || null,
    surfaceColor: (data.surfaceColor as string) || "#1F2937",
    textColor: (data.textColor as string) || "#F9FAFB",
    textMuted: (data.textMuted as string) || "#D1D5DB",
    borderColor: (data.borderColor as string) || "#374151",
    fontFamily: (data.fontFamily as string) || "Geist",
    allowIframeEmbedding: d(data.allowIframeEmbedding, false),
    termsOfUses: (data.termsOfUses as string) || DEFAULT_TERMS,
  };
}

function buildSettingsUpdateData(data: SettingsInput, current: Settings) {
  return {
    allowSignin: field(data, current, "allowSignin"),
    disableCredentialsLogin: field(data, current, "disableCredentialsLogin"),
    allowAnonFileShare: field(data, current, "allowAnonFileShare"),
    allowAnonLinkShare: field(data, current, "allowAnonLinkShare"),
    allowAnonPasteShare: field(data, current, "allowAnonPasteShare"),
    anoMaxUpload: (data.anoMaxUpload as number) || current.anoMaxUpload,
    authMaxUpload: (data.authMaxUpload as number) || current.authMaxUpload,
    anoIpQuota: (data.anoIpQuota as number) || current.anoIpQuota,
    authIpQuota: (data.authIpQuota as number) || current.authIpQuota,
    useGiBForAnon: field(data, current, "useGiBForAnon"),
    useGiBForAuth: field(data, current, "useGiBForAuth"),
    appName: field(data, current, "appName"),
    appDescription: field(data, current, "appDescription"),
    logoUrl: field(data, current, "logoUrl"),
    faviconUrl: field(data, current, "faviconUrl"),
    primaryColor: field(data, current, "primaryColor"),
    primaryHover: field(data, current, "primaryHover"),
    primaryDark: field(data, current, "primaryDark"),
    secondaryColor: field(data, current, "secondaryColor"),
    secondaryHover: field(data, current, "secondaryHover"),
    secondaryDark: field(data, current, "secondaryDark"),
    backgroundColor: field(data, current, "backgroundColor"),
    backgroundImageUrl: field(data, current, "backgroundImageUrl"),
    surfaceColor: field(data, current, "surfaceColor"),
    textColor: field(data, current, "textColor"),
    textMuted: field(data, current, "textMuted"),
    borderColor: field(data, current, "borderColor"),
    fontFamily: field(data, current, "fontFamily"),
    termsOfUses: field(data, current, "termsOfUses"),
    captchaEnabled: field(data, current, "captchaEnabled"),
    captchaProvider: field(data, current, "captchaProvider"),
    captchaSiteKey: field(data, current, "captchaSiteKey"),
    captchaSecretKey: encryptedSecret(data, current, "captchaSecretKey"),
    smtpEnabled: field(data, current, "smtpEnabled"),
    smtpHost: nullableString(data, current, "smtpHost"),
    smtpPort: field(data, current, "smtpPort"),
    smtpUser: nullableString(data, current, "smtpUser"),
    smtpPassword: encryptedSecret(data, current, "smtpPassword"),
    smtpFrom: nullableString(data, current, "smtpFrom"),
    smtpSecure: field(data, current, "smtpSecure"),
    emailVerificationRequired: field(data, current, "emailVerificationRequired"),
    allowIframeEmbedding: field(data, current, "allowIframeEmbedding"),
    s3Enabled: field(data, current, "s3Enabled"),
    s3Endpoint: nullableString(data, current, "s3Endpoint"),
    s3Region: nullableString(data, current, "s3Region"),
    s3Bucket: nullableString(data, current, "s3Bucket"),
    s3AccessKeyId: nullableString(data, current, "s3AccessKeyId"),
    s3SecretAccessKey: encryptedSecret(data, current, "s3SecretAccessKey"),
  };
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user?.id) {
    return apiError(request, ErrorCode.UNAUTHORIZED);
  }

  // Check if user is admin
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });

  if (!user?.isAdmin) {
    return apiError(request, ErrorCode.ADMIN_ONLY);
  }

  try {
    let settings = await prisma.settings.findFirst();

    const activeProvidersCount = await prisma.oAuthProvider.count({
      where: { enabled: true },
    });

    if (!settings) {
      settings = await prisma.settings.create({ data: buildFirstRunSettingsCreate({}) });
    }

    // Never expose secret keys to the client
    const safeSettings = {
      ...settings,
      captchaSecretKey: settings.captchaSecretKey ? "••••••••" : null,
      smtpPassword: settings.smtpPassword ? "••••••••" : null,
      allowIframeEmbedding: settings.allowIframeEmbedding,
      s3SecretAccessKey: settings.s3SecretAccessKey ? "••••••••" : null,
    };

    return NextResponse.json({ settings: safeSettings, hasActiveSSO: activeProvidersCount > 0 });
  } catch (error) {
    console.error("Error fetching settings:", error);
    return internalError(request);
  }
}

export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user?.id) {
    return apiError(request, ErrorCode.UNAUTHORIZED);
  }

  // Check if user is admin
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });

  if (!user?.isAdmin) {
    return apiError(request, ErrorCode.ADMIN_ONLY);
  }

  try {
    const data = await request.json();

    if (data.disableCredentialsLogin === true) {
      const activeProvidersCount = await prisma.oAuthProvider.count({
        where: { enabled: true },
      });
      if (activeProvidersCount === 0) {
        return apiError(request, ErrorCode.NO_SSO_PROVIDERS);
      }
    }

    let settings = await prisma.settings.findFirst();

    if (!settings) {
      settings = await prisma.settings.create({ data: buildFirstRunSettingsCreate(data) });
    } else {
      settings = await prisma.settings.update({
        where: { id: settings.id },
        data: buildSettingsUpdateData(data, settings),
      });
    }

    const safeUpdated = {
      ...settings,
      captchaSecretKey: settings.captchaSecretKey ? "••••••••" : null,
      smtpPassword: settings.smtpPassword ? "••••••••" : null,
      s3SecretAccessKey: settings.s3SecretAccessKey ? "••••••••" : null,
    };

    return NextResponse.json({ settings: safeUpdated });
  } catch (error) {
    console.error("Error updating settings:", error);
    return internalError(request);
  }
}
