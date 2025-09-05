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

export const AUTH_MESSAGES = {
  SIGN_IN_SUCCESS: "Connexion réussie",
  SIGN_OUT_SUCCESS: "Déconnexion réussie",
  SIGN_UP_SUCCESS: "Compte créé avec succès",
  INVALID_CREDENTIALS: "Email ou mot de passe incorrect",
  PASSWORD_TOO_SHORT: `Le mot de passe doit contenir au moins ${AUTH_CONSTANTS.MIN_PASSWORD_LENGTH} caractères`,
  EMAIL_REQUIRED: "L'email est requis",
  PASSWORD_REQUIRED: "Le mot de passe est requis",
  PASSWORDS_DO_NOT_MATCH: "Les mots de passe ne correspondent pas",
  USER_ALREADY_EXISTS: "Un utilisateur avec cet email existe déjà",
} as const
