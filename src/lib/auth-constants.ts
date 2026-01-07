export const AUTH_CONSTANTS = {
  MIN_PASSWORD_LENGTH: 6,
  MAX_PASSWORD_LENGTH: 128,
  SESSION_MAX_AGE: 30 * 24 * 60 * 60, // 30 days
  SALT_ROUNDS: 12,
} as const

export const AUTH_ROUTES = {
  SIGN_IN: "/auth/signin",
  SIGN_UP: "/auth/signup",
  SIGN_OUT: "/auth/signout",
  HOME: "/",
  DASHBOARD: "/dashboard",
} as const