/**
 * Tests for the auth-constants module
 */
import { AUTH_MESSAGES } from "@/lib/auth-constants";

describe("AUTH_MESSAGES", () => {
  it("should have SIGN_IN_SUCCESS message", () => {
    expect(AUTH_MESSAGES.SIGN_IN_SUCCESS).toBe("Sign in successful");
    expect(typeof AUTH_MESSAGES.SIGN_IN_SUCCESS).toBe("string");
  });

  it("should have SIGN_OUT_SUCCESS message", () => {
    expect(AUTH_MESSAGES.SIGN_OUT_SUCCESS).toBe("Sign out successful");
    expect(typeof AUTH_MESSAGES.SIGN_OUT_SUCCESS).toBe("string");
  });

  it("should have SIGN_UP_SUCCESS message", () => {
    expect(AUTH_MESSAGES.SIGN_UP_SUCCESS).toBe("Account created successfully");
    expect(typeof AUTH_MESSAGES.SIGN_UP_SUCCESS).toBe("string");
  });

  it("should have INVALID_CREDENTIALS message", () => {
    expect(AUTH_MESSAGES.INVALID_CREDENTIALS).toBe("Invalid email or password");
    expect(typeof AUTH_MESSAGES.INVALID_CREDENTIALS).toBe("string");
  });

  it("should have PASSWORD_TOO_SHORT message", () => {
    expect(AUTH_MESSAGES.PASSWORD_TOO_SHORT).toContain("6");
    expect(typeof AUTH_MESSAGES.PASSWORD_TOO_SHORT).toBe("string");
  });

  it("should have EMAIL_REQUIRED message", () => {
    expect(AUTH_MESSAGES.EMAIL_REQUIRED).toBe("Email is required");
    expect(typeof AUTH_MESSAGES.EMAIL_REQUIRED).toBe("string");
  });

  it("should have PASSWORD_REQUIRED message", () => {
    expect(AUTH_MESSAGES.PASSWORD_REQUIRED).toBe("Password is required");
    expect(typeof AUTH_MESSAGES.PASSWORD_REQUIRED).toBe("string");
  });

  it("should have PASSWORDS_DO_NOT_MATCH message", () => {
    expect(AUTH_MESSAGES.PASSWORDS_DO_NOT_MATCH).toBe("Passwords do not match");
    expect(typeof AUTH_MESSAGES.PASSWORDS_DO_NOT_MATCH).toBe("string");
  });

  it("should have USER_ALREADY_EXISTS message", () => {
    expect(AUTH_MESSAGES.USER_ALREADY_EXISTS).toBe("A user with this email already exists");
    expect(typeof AUTH_MESSAGES.USER_ALREADY_EXISTS).toBe("string");
  });

  it("should have all messages as non-empty strings", () => {
    Object.values(AUTH_MESSAGES).forEach((message) => {
      expect(typeof message).toBe("string");
      expect(message.length).toBeGreaterThan(0);
    });
  });
});
