import { prisma } from "@/lib/prisma";

export async function GET() {
    const termsOfUse = await prisma.settings.findFirst({
        select: {
            termsOfUses: true
        }
    });

    let termsOfUseText = termsOfUse?.termsOfUses;
    if (!termsOfUseText) {
        termsOfUseText = `# Terms of Use

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
    }

    
    return new Response(termsOfUseText, {
        headers: {
            "Content-Type": "text/plain; charset=utf-8"
        }
    });
}
