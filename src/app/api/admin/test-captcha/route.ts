import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"

// Test CAPTCHA configuration without saving
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session || !session.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Check if user is admin
  const user = await prisma.user.findUnique({
    where: { id: session.user.id }
  })

  if (!user?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const { provider, siteKey, secretKey } = await request.json()

    if (!provider || !siteKey || !secretKey) {
      return NextResponse.json({ 
        error: "Missing required fields: provider, siteKey, and secretKey are required" 
      }, { status: 400 })
    }

    // Validate provider type
    const validProviders = ["recaptcha-v2", "recaptcha-v3", "turnstile"]
    if (!validProviders.includes(provider)) {
      return NextResponse.json({ 
        error: `Invalid provider. Must be one of: ${validProviders.join(", ")}` 
      }, { status: 400 })
    }

    // Generate a test token validation
    // Note: We can't fully test without a real token from the client
    // But we can validate the API keys format and connectivity

    let testResult: { success: boolean; error?: string }

    if (provider === "recaptcha-v2" || provider === "recaptcha-v3") {
      // Test reCAPTCHA connectivity with invalid token (should fail with specific error)
      const response = await fetch("https://www.google.com/recaptcha/api/siteverify", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: `secret=${secretKey}&response=test-token`,
        signal: AbortSignal.timeout(10000), // 10 second timeout
      })

      const data = await response.json()

      // If secret is invalid, Google returns specific error codes
      if (data["error-codes"] && data["error-codes"].includes("invalid-input-secret")) {
        testResult = {
          success: false,
          error: "Invalid secret key. Please check your reCAPTCHA configuration."
        }
      } else {
        // Secret key is valid (test token failed as expected)
        testResult = {
          success: true
        }
      }

    } else if (provider === "turnstile") {
      // Test Turnstile connectivity
      const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          secret: secretKey,
          response: "test-token",
        }),
        signal: AbortSignal.timeout(10000), // 10 second timeout
      })

      const data = await response.json()

      // Turnstile returns specific error codes
      if (data["error-codes"] && data["error-codes"].includes("invalid-input-secret")) {
        testResult = {
          success: false,
          error: "Invalid secret key. Please check your Turnstile configuration."
        }
      } else if (data["error-codes"] && data["error-codes"].includes("missing-input-secret")) {
        testResult = {
          success: false,
          error: "Secret key is missing or empty."
        }
      } else {
        // Secret key is valid (test token failed as expected)
        testResult = {
          success: true
        }
      }
    } else {
      testResult = {
        success: false,
        error: "Unknown provider"
      }
    }

    if (testResult.success) {
      return NextResponse.json({
        success: true,
        message: "CAPTCHA configuration is valid. Secret key verified successfully."
      })
    } else {
      return NextResponse.json({
        success: false,
        error: testResult.error || "CAPTCHA configuration test failed"
      }, { status: 400 })
    }

  } catch (error) {
    const err = error as Error
    console.error("Error testing CAPTCHA configuration:", error)
    
    // Detect network/timeout errors
    if (err.name === "AbortError" || err.message.includes("timeout")) {
      return NextResponse.json({
        success: false,
        error: "Connection timeout. Please check your network connection and try again."
      }, { status: 500 })
    }

    return NextResponse.json({
      success: false,
      error: err.message || "Failed to test CAPTCHA configuration"
    }, { status: 500 })
  }
}
