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
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/getClientIp";
import crypto from "crypto";

interface RegistrationSettings {
  allowSignup: boolean;
  disableCredentialsLogin: boolean;
  captchaEnabled: boolean;
  captchaProvider: string | null;
  captchaSecretKey: string | null;
  emailVerificationRequired: boolean;
  smtpEnabled: boolean;
}

async function loadRegistrationSettings(): Promise<RegistrationSettings> {
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

async function verifyCaptchaIfRequired(
  request: NextRequest,
  settings: RegistrationSettings,
  isFirstUser: boolean,
  captchaToken: string | undefined
): Promise<NextResponse | null> {
  if (!settings.captchaEnabled || isFirstUser) return null;
  if (!captchaToken) return apiError(request, ErrorCode.CAPTCHA_REQUIRED);
  if (!settings.captchaProvider || !settings.captchaSecretKey) {
    return apiError(request, ErrorCode.CAPTCHA_INVALID);
  }
  const valid = await verifyCaptcha(
    captchaToken,
    settings.captchaSecretKey,
    settings.captchaProvider
  );
  if (!valid) return apiError(request, ErrorCode.CAPTCHA_INVALID);
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const clientIp = getClientIp(request);
    if (!checkRateLimit(`register:${clientIp}`, 10, 15 * 60_000)) {
      return apiError(request, ErrorCode.RATE_LIMIT_EXCEEDED);
    }

    const { email, password, isFirstUser, captchaToken } = await request.json();

    const userCount = await prisma.user.count();
    const isActuallyFirstUser = userCount === 0;

    const settings = await loadRegistrationSettings();

    // Allow registration if settings allow signup AND credentials login is enabled,
    // OR this is the first user being created
    if ((!settings.allowSignup || settings.disableCredentialsLogin) && !isActuallyFirstUser) {
      return apiError(request, ErrorCode.SIGNUP_DISABLED);
    }

    if (isFirstUser && !isActuallyFirstUser) {
      return apiError(request, ErrorCode.USERS_ALREADY_EXIST);
    }

    if (!email || !password) {
      return apiError(request, ErrorCode.EMAIL_PASSWORD_REQUIRED);
    }

    if (!isValidEmail(email)) {
      return apiError(request, ErrorCode.INVALID_EMAIL_FORMAT);
    }

    if (!isValidPassword(password)) {
      return apiError(request, ErrorCode.PASSWORD_LENGTH, {
        min: PASSWORD_MIN_LENGTH,
        max: PASSWORD_MAX_LENGTH,
      });
    }

    const captchaError = await verifyCaptchaIfRequired(
      request,
      settings,
      isActuallyFirstUser,
      captchaToken
    );
    if (captchaError) return captchaError;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return apiError(request, ErrorCode.USER_ALREADY_EXISTS);
    }

    const hashedPassword = await hashPassword(password);

    // First users are auto-verified (they're admins)
    const needsEmailVerification =
      settings.emailVerificationRequired && settings.smtpEnabled && !isActuallyFirstUser;

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        isAdmin: isActuallyFirstUser,
        emailVerified: needsEmailVerification ? null : new Date(),
      },
    });

    if (needsEmailVerification) {
      const token = crypto.randomBytes(32).toString("hex");
      const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await prisma.verificationToken.create({
        data: { identifier: `email-verify:${email}`, token, expires },
      });

      try {
        await sendVerificationEmail(email, token);
      } catch (emailError) {
        console.error("Failed to send verification email:", emailError);
        // Don't fail registration if email fails — user can request a resend
      }

      return NextResponse.json({
        message: "Account created. Please check your email to verify your account.",
        requiresVerification: true,
        user: { id: user.id, email: user.email },
      });
    }

    return NextResponse.json({
      message: "User created successfully",
      requiresVerification: false,
      user: { id: user.id, email: user.email },
    });
  } catch (error) {
    console.error("Registration error:", error);
    return internalError(request);
  }
}
