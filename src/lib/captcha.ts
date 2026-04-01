export async function verifyCaptcha(
  token: string,
  secretKey: string,
  provider: string
): Promise<boolean> {
  try {
    if (provider === "turnstile") {
      const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret: secretKey, response: token }),
      });
      const data = await response.json();
      return data.success === true;
    }

    if (provider === "recaptcha") {
      const params = new URLSearchParams({ secret: secretKey, response: token });
      const response = await fetch(
        `https://www.google.com/recaptcha/api/siteverify?${params.toString()}`,
        { method: "POST" }
      );
      const data = await response.json();
      return data.success === true;
    }

    return false;
  } catch {
    return false;
  }
}
