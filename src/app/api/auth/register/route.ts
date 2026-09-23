import { NextRequest, NextResponse } from "next/server";
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
import { Prisma } from "@/generated/prisma";
import crypto from "crypto";

function isPrismaError(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
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

    // Get DB settings
    let allowSignup = true;
    let disableCredentialsLogin = false;
    let captchaEnabled = false;
    let captchaProvider: string | null = null;
    let captchaSecretKey: string | null = null;
    let emailVerificationRequired = false;
    let smtpEnabled = false;

    const settings = await prisma.settings.findFirst({
      select: {
        allowSignin: true,
        disableCredentialsLogin: true,
        captchaEnabled: true,
        captchaProvider: true,
        captchaSecretKey: true,
        emailVerificationRequired: true,
        smtpEnabled: true,
      },
    });

    if (settings) {
      allowSignup = settings.allowSignin;
      disableCredentialsLogin = settings.disableCredentialsLogin;
      captchaEnabled = settings.captchaEnabled;
      captchaProvider = settings.captchaProvider;
      captchaSecretKey = settings.captchaSecretKey;
      emailVerificationRequired = settings.emailVerificationRequired;
      smtpEnabled = settings.smtpEnabled;
    }

    // Allow registration if:
    // 1. Settings allow signup (allowSignin), AND credentials login is NOT disabled
    // 2. OR This is the first user being created (database is empty)
    if ((!allowSignup || disableCredentialsLogin) && !isActuallyFirstUser) {
      return apiError(request, ErrorCode.SIGNUP_DISABLED);
    }

    // If claiming to be first user but database has users, reject
    if (isFirstUser && !isActuallyFirstUser) {
      return apiError(request, ErrorCode.USERS_ALREADY_EXIST);
    }

    if (!email || !password) {
      return apiError(request, ErrorCode.EMAIL_PASSWORD_REQUIRED);
    }

    // Validate email format
    if (!isValidEmail(email)) {
      return apiError(request, ErrorCode.INVALID_EMAIL_FORMAT);
    }

    // Validate password length
    if (!isValidPassword(password)) {
      return apiError(request, ErrorCode.PASSWORD_LENGTH, {
        min: PASSWORD_MIN_LENGTH,
        max: PASSWORD_MAX_LENGTH,
      });
    }

    // Verify CAPTCHA if enabled (skip for first user setup)
    if (captchaEnabled && !isActuallyFirstUser) {
      if (!captchaToken) {
        return apiError(request, ErrorCode.CAPTCHA_REQUIRED);
      }
      if (!captchaProvider || !captchaSecretKey) {
        return apiError(request, ErrorCode.CAPTCHA_INVALID);
      }
      const captchaValid = await verifyCaptcha(captchaToken, captchaSecretKey, captchaProvider);
      if (!captchaValid) {
        return apiError(request, ErrorCode.CAPTCHA_INVALID);
      }
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
    const needsEmailVerification = emailVerificationRequired && smtpEnabled && !isActuallyFirstUser;

    const userData = {
      email,
      password: hashedPassword,
      // Mark as verified immediately if verification is not required
      emailVerified: needsEmailVerification ? null : new Date(),
    };

    // Create the user. The first user becomes admin: re-check the count inside a
    // serializable transaction so two concurrent setup requests cannot both get admin.
    let user;
    try {
      user = isActuallyFirstUser
        ? await prisma.$transaction(
            async (tx) => {
              const isStillFirst = (await tx.user.count()) === 0;
              return tx.user.create({ data: { ...userData, isAdmin: isStillFirst } });
            },
            { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
          )
        : await prisma.user.create({ data: { ...userData, isAdmin: false } });
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

    // Send verification email if required
    if (needsEmailVerification) {
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
