export const AUTH_MESSAGES = {
  SIGN_IN_SUCCESS: "Sign in successful",
  SIGN_OUT_SUCCESS: "Sign out successful",
  SIGN_UP_SUCCESS: "Account created successfully",
  INVALID_CREDENTIALS: "Invalid email or password",
  PASSWORD_TOO_SHORT: `Password must be at least 6 characters`,
  EMAIL_REQUIRED: "Email is required",
  PASSWORD_REQUIRED: "Password is required",
  PASSWORDS_DO_NOT_MATCH: "Passwords do not match",
  USER_ALREADY_EXISTS: "A user with this email already exists",
} as const;
