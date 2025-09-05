export class AuthError extends Error {
  constructor(message: string, public code?: string) {
    super(message)
    this.name = "AuthError"
  }
}

export const AuthErrorCodes = {
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  USER_ALREADY_EXISTS: "USER_ALREADY_EXISTS",
  USER_NOT_FOUND: "USER_NOT_FOUND",
  INVALID_TOKEN: "INVALID_TOKEN",
  SESSION_EXPIRED: "SESSION_EXPIRED",
} as const

export function getErrorMessage(error: unknown): string {
  if (error instanceof AuthError) {
    return error.message
  }
  
  if (error instanceof Error) {
    return error.message
  }
  
  return "Une erreur inattendue s'est produite"
}
