import { NextRequest, NextResponse } from "next/server";
import { getSettingsCached } from "@/lib/settings";
import { prisma } from "@/lib/prisma";
import {
  isValidEmail,
  isValidPassword,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
} from "@/lib/constants";
import { apiError, internalError, ErrorCode } from "@/lib/api-errors";
import { hashPassword } from "@/lib/security";
import { verifyCaptcha } from "@/lib/captcha";
import { sendVerificationEmail } from "@/lib/email";
import { detectLocale, translate } from "@/lib/i18n-server";
import { getClientIp } from "@/lib/getClientIp";
import { consumeRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import type { Prisma } from "@/generated/prisma";
import crypto from "node:crypto";

function isPrismaError(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}

type RegistrationSettings = {
  allowSignup: boolean;
  disableCredentialsLogin: boolean;
  captchaEnabled: boolean;
  captchaProvider: string | null;
  captchaSecretKey: string | null;
  emailVerificationRequired: boolean;
  smtpEnabled: boolean;
};

async function loadRegistrationSettings(): Promise<RegistrationSettings> {
  const settings = await getSettingsCached();

  if (!settings) {
    return {
      allowSignup: true,
      disableCredentialsLogin: false,
      captchaEnabled: false,
      captchaProvider: null,
      captchaSecretKey: null,
      emailVerificationRequired: false,
      smtpEnabled: false,
    };
  }

  return {
    allowSignup: settings.allowSignin,
    disableCredentialsLogin: settings.disableCredentialsLogin,
    captchaEnabled: settings.captchaEnabled,
    captchaProvider: settings.captchaProvider,
    captchaSecretKey: settings.captchaSecretKey,
    emailVerificationRequired: settings.emailVerificationRequired,
    smtpEnabled: settings.smtpEnabled,
  };
}

/** Validates the submitted email and password, returning an error response if invalid. */
function validateCredentials(
  request: NextRequest,
  email: unknown,
  password: unknown
): NextResponse | null {
  if (!email || !password) {
    return apiError(request, ErrorCode.EMAIL_PASSWORD_REQUIRED);
  }

  // Validate email format
  if (!isValidEmail(email as string)) {
    return apiError(request, ErrorCode.INVALID_EMAIL_FORMAT);
  }

  // Validate password length
  if (!isValidPassword(password as string)) {
    return apiError(request, ErrorCode.PASSWORD_LENGTH, {
      min: PASSWORD_MIN_LENGTH,
      max: PASSWORD_MAX_LENGTH,
    });
  }
  return null;
}

/** Verifies the CAPTCHA, returning an error response if it is missing or invalid. */
async function checkCaptcha(
  request: NextRequest,
  captchaToken: string | undefined,
  settings: RegistrationSettings
): Promise<NextResponse | null> {
  if (!captchaToken) {
    return apiError(request, ErrorCode.CAPTCHA_REQUIRED);
  }
  if (!settings.captchaProvider || !settings.captchaSecretKey) {
    return apiError(request, ErrorCode.CAPTCHA_INVALID);
  }
  const captchaValid = await verifyCaptcha(
    captchaToken,
    settings.captchaSecretKey,
    settings.captchaProvider
  );
  if (!captchaValid) {
    return apiError(request, ErrorCode.CAPTCHA_INVALID);
  }
  return null;
}

/**
 * Creates the user. The first user becomes admin: re-check the count inside a
 * serializable transaction so two concurrent setup requests cannot both get admin.
 */
async function createUser(
  userData: { email: string; password: string; emailVerified: Date | null },
  isActuallyFirstUser: boolean
) {
  if (!isActuallyFirstUser) {
    return prisma.user.create({ data: { ...userData, isAdmin: false } });
  }
  return prisma.$transaction(
    async (tx) => {
      const isStillFirst = (await tx.user.count()) === 0;
      return tx.user.create({ data: { ...userData, isAdmin: isStillFirst } });
    },
    { isolationLevel: "Serializable" satisfies Prisma.TransactionIsolationLevel }
  );
}

/** Stores a verification token and emails it. Email failures do not fail the registration. */
async function sendVerification(email: string) {
  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  await prisma.verificationToken.create({
    data: {
      identifier: `email-verify:${email}`,
      token,
      expires,
    },
  });

  try {
    await sendVerificationEmail(email, token);
  } catch (emailError) {
    console.error("Failed to send verification email:", emailError);
    // Don't fail registration if email fails — user can request a resend
  }
}

function checkSignupAllowed(
  request: NextRequest,
  settings: Awaited<ReturnType<typeof loadRegistrationSettings>>,
  isFirstUser: boolean,
  isActuallyFirstUser: boolean
): NextResponse | null {
  // Allow registration if:
  // 1. Settings allow signup (allowSignin), AND credentials login is NOT disabled
  // 2. OR This is the first user being created (database is empty)
  if ((!settings.allowSignup || settings.disableCredentialsLogin) && !isActuallyFirstUser) {
    return apiError(request, ErrorCode.SIGNUP_DISABLED);
  }

  // If claiming to be first user but database has users, reject
  if (isFirstUser && !isActuallyFirstUser) {
    return apiError(request, ErrorCode.USERS_ALREADY_EXIST);
  }

  return null;
}

async function createUserOrError(
  request: NextRequest,
  userData: Parameters<typeof createUser>[0],
  isActuallyFirstUser: boolean
) {
  try {
    return await createUser(userData, isActuallyFirstUser);
  } catch (error) {
    if (isPrismaError(error, "P2002")) {
      return apiError(request, ErrorCode.USER_ALREADY_EXISTS);
    }
    if (isPrismaError(error, "P2034")) {
      // Serialization conflict: another first user was created concurrently
      return apiError(request, ErrorCode.USERS_ALREADY_EXIST);
    }
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    const retryAfter = consumeRateLimit("register", getClientIp(request));
    if (retryAfter > 0) {
      return rateLimitResponse(request, retryAfter);
    }

    const { email, password, isFirstUser, captchaToken } = await request.json();

    // Check if this is the first user setup
    const userCount = await prisma.user.count();
    const isActuallyFirstUser = userCount === 0;

    const settings = await loadRegistrationSettings();

    const signupError = checkSignupAllowed(request, settings, isFirstUser, isActuallyFirstUser);
    if (signupError) return signupError;

    const credentialsError = validateCredentials(request, email, password);
    if (credentialsError) return credentialsError;

    // Verify CAPTCHA if enabled (skip for first user setup)
    if (settings.captchaEnabled && !isActuallyFirstUser) {
      const captchaError = await checkCaptcha(request, captchaToken, settings);
      if (captchaError) return captchaError;
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return apiError(request, ErrorCode.USER_ALREADY_EXISTS);
    }

    // Hash the password
    const hashedPassword = await hashPassword(password);

    // Determine if email verification is needed
    // First users are auto-verified (they're admins), skip verification
    const needsEmailVerification =
      settings.emailVerificationRequired && settings.smtpEnabled && !isActuallyFirstUser;

    const userData = {
      email,
      password: hashedPassword,
      // Mark as verified immediately if verification is not required
      emailVerified: needsEmailVerification ? null : new Date(),
    };

    const created = await createUserOrError(request, userData, isActuallyFirstUser);
    if (created instanceof NextResponse) return created;
    const user = created;

    // Send verification email if required
    if (needsEmailVerification) {
      await sendVerification(email);

      return NextResponse.json({
        message: translate(detectLocale(request), "api.messages.account_created_verify_email"),
        requiresVerification: true,
        user: { id: user.id, email: user.email },
      });
    }

    return NextResponse.json({
      message: translate(detectLocale(request), "api.messages.user_created"),
      requiresVerification: false,
      user: { id: user.id, email: user.email },
    });
  } catch (error) {
    console.error("Registration error:", error);
    return internalError(request);
  }
}
