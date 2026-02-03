import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { apiError, internalError, ErrorCode } from "@/lib/api-errors";

export async function GET(request: NextRequest) {
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.id) {
        return apiError(request, ErrorCode.UNAUTHORIZED);
    }

    // Check if user is admin
    const user = await prisma.user.findUnique({
        where: { id: session.user.id }
    });

    if (!user?.isAdmin) {
        return apiError(request, ErrorCode.ADMIN_ONLY);
    }

    try {
        let settings = await prisma.settings.findFirst();

		const activeProvidersCount = await prisma.oAuthProvider.count({
            where: { enabled: true }
        });

        // Create default settings if not exist
        if (!settings) {
            settings = await prisma.settings.create({
                data: {
                    allowSignin: true,
                    disableCredentialsLogin: false,
                    allowAnonFileShare: true,
                    allowAnonLinkShare: true,
                    allowAnonPasteShare: true,
                    anoMaxUpload: 2048,
                    authMaxUpload: 51200,
                    anoIpQuota: 4096,
                    authIpQuota: 102400,
                    useGiBForAnon: false,
                    useGiBForAuth: false,
                    termsOfUses: `# Terms of Use

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

Thank you for using SnowShare!`
                }
            });
        }

        return NextResponse.json({ settings, hasActiveSSO: activeProvidersCount > 0 });
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
        where: { id: session.user.id }
    });

    if (!user?.isAdmin) {
        return apiError(request, ErrorCode.ADMIN_ONLY);
    }

    try {
        const data = await request.json();

		if (data.disableCredentialsLogin === true) {
            const activeProvidersCount = await prisma.oAuthProvider.count({
                where: { enabled: true }
            });
            if (activeProvidersCount === 0) {
                return apiError(request, ErrorCode.NO_SSO_PROVIDERS);
            }
        }

        let settings = await prisma.settings.findFirst();

        if (!settings) {
            settings = await prisma.settings.create({
                data: {
                    allowSignin: data.allowSignin !== undefined ? data.allowSignin : true,
                    disableCredentialsLogin: data.disableCredentialsLogin !== undefined ? data.disableCredentialsLogin : false,
                    allowAnonFileShare: data.allowAnonFileShare !== undefined ? data.allowAnonFileShare : true,
                    allowAnonLinkShare: data.allowAnonLinkShare !== undefined ? data.allowAnonLinkShare : true,
                    allowAnonPasteShare: data.allowAnonPasteShare !== undefined ? data.allowAnonPasteShare : true,
                    anoMaxUpload: data.anoMaxUpload || 2048,
                    authMaxUpload: data.authMaxUpload || 51200,
                    anoIpQuota: data.anoIpQuota || 4096,
                    authIpQuota: data.authIpQuota || 102400,
                    useGiBForAnon: data.useGiBForAnon !== undefined ? data.useGiBForAnon : false,
                    useGiBForAuth: data.useGiBForAuth !== undefined ? data.useGiBForAuth : false,
                    appName: data.appName || "SnowShare",
                    appDescription: data.appDescription || "Share your files, pastes and URLs securely",
                    logoUrl: data.logoUrl || null,
                    faviconUrl: data.faviconUrl || null,
                    primaryColor: data.primaryColor || "#3B82F6",
                    primaryHover: data.primaryHover || "#2563EB",
                    primaryDark: data.primaryDark || "#1E40AF",
                    secondaryColor: data.secondaryColor || "#8B5CF6",
                    secondaryHover: data.secondaryHover || "#7C3AED",
                    secondaryDark: data.secondaryDark || "#6D28D9",
                    backgroundColor: data.backgroundColor || "#111827",
                    surfaceColor: data.surfaceColor || "#1F2937",
                    textColor: data.textColor || "#F9FAFB",
                    textMuted: data.textMuted || "#D1D5DB",
                    borderColor: data.borderColor || "#374151",
                    termsOfUses:
                        data.termsOfUses ||
                        `# Terms of Use

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

Thank you for using SnowShare!`
                }
            });
        } else {
            settings = await prisma.settings.update({
                where: { id: settings.id },
                data: {
                    allowSignin: data.allowSignin !== undefined ? data.allowSignin : settings.allowSignin,
                    disableCredentialsLogin: data.disableCredentialsLogin !== undefined ? data.disableCredentialsLogin : settings.disableCredentialsLogin,
                    allowAnonFileShare:
                        data.allowAnonFileShare !== undefined ? data.allowAnonFileShare : settings.allowAnonFileShare,
                    allowAnonLinkShare:
                        data.allowAnonLinkShare !== undefined ? data.allowAnonLinkShare : settings.allowAnonLinkShare,
                    allowAnonPasteShare:
                        data.allowAnonPasteShare !== undefined ? data.allowAnonPasteShare : settings.allowAnonPasteShare,
                    anoMaxUpload: data.anoMaxUpload || settings.anoMaxUpload,
                    authMaxUpload: data.authMaxUpload || settings.authMaxUpload,
                    anoIpQuota: data.anoIpQuota || settings.anoIpQuota,
                    authIpQuota: data.authIpQuota || settings.authIpQuota,
                    useGiBForAnon: data.useGiBForAnon !== undefined ? data.useGiBForAnon : settings.useGiBForAnon,
                    useGiBForAuth: data.useGiBForAuth !== undefined ? data.useGiBForAuth : settings.useGiBForAuth,
                    appName: data.appName !== undefined ? data.appName : settings.appName,
                    appDescription: data.appDescription !== undefined ? data.appDescription : settings.appDescription,
                    logoUrl: data.logoUrl !== undefined ? data.logoUrl : settings.logoUrl,
                    faviconUrl: data.faviconUrl !== undefined ? data.faviconUrl : settings.faviconUrl,
                    primaryColor: data.primaryColor !== undefined ? data.primaryColor : settings.primaryColor,
                    primaryHover: data.primaryHover !== undefined ? data.primaryHover : settings.primaryHover,
                    primaryDark: data.primaryDark !== undefined ? data.primaryDark : settings.primaryDark,
                    secondaryColor: data.secondaryColor !== undefined ? data.secondaryColor : settings.secondaryColor,
                    secondaryHover: data.secondaryHover !== undefined ? data.secondaryHover : settings.secondaryHover,
                    secondaryDark: data.secondaryDark !== undefined ? data.secondaryDark : settings.secondaryDark,
                    backgroundColor:
                        data.backgroundColor !== undefined ? data.backgroundColor : settings.backgroundColor,
                    surfaceColor: data.surfaceColor !== undefined ? data.surfaceColor : settings.surfaceColor,
                    textColor: data.textColor !== undefined ? data.textColor : settings.textColor,
                    textMuted: data.textMuted !== undefined ? data.textMuted : settings.textMuted,
                    borderColor: data.borderColor !== undefined ? data.borderColor : settings.borderColor,
                    termsOfUses: data.termsOfUses !== undefined ? data.termsOfUses : settings.termsOfUses
                }
            });
        }

        return NextResponse.json({ settings });
    } catch (error) {
        console.error("Error updating settings:", error);
        return internalError(request);
    }
}
