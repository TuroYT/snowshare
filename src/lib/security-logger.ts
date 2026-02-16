/**
 * Security event logging utility
 * Provides structured logging for security-related events
 * Helps with monitoring, auditing, and incident response
 */

export enum SecurityEventType {
  // Authentication events
  LOGIN_SUCCESS = "login_success",
  LOGIN_FAILED = "login_failed",
  LOGOUT = "logout",
  
  // Registration events
  REGISTRATION_SUCCESS = "registration_success",
  REGISTRATION_FAILED = "registration_failed",
  REGISTRATION_RATE_LIMITED = "registration_rate_limited",
  
  // CAPTCHA events
  CAPTCHA_VALIDATION_SUCCESS = "captcha_validation_success",
  CAPTCHA_VALIDATION_FAILED = "captcha_validation_failed",
  CAPTCHA_CONFIG_TESTED = "captcha_config_tested",
  CAPTCHA_CONFIG_UPDATED = "captcha_config_updated",
  
  // Email verification events
  EMAIL_VERIFICATION_SENT = "email_verification_sent",
  EMAIL_VERIFICATION_SUCCESS = "email_verification_success",
  EMAIL_VERIFICATION_FAILED = "email_verification_failed",
  EMAIL_VERIFICATION_EXPIRED = "email_verification_expired",
  
  // Rate limiting events
  RATE_LIMIT_TRIGGERED = "rate_limit_triggered",
  
  // Configuration events
  SECURITY_SETTINGS_UPDATED = "security_settings_updated",
  SMTP_CONFIG_UPDATED = "smtp_config_updated",
  
  // Suspicious activity
  SUSPICIOUS_ACTIVITY = "suspicious_activity",
  INVALID_TOKEN = "invalid_token",
  UNAUTHORIZED_ACCESS_ATTEMPT = "unauthorized_access_attempt",
}

export enum SecurityEventSeverity {
  INFO = "info",
  WARNING = "warning",
  ERROR = "error",
  CRITICAL = "critical",
}

export interface SecurityEventData {
  type: SecurityEventType
  severity: SecurityEventSeverity
  message: string
  userId?: string
  email?: string
  ip?: string
  userAgent?: string
  metadata?: Record<string, unknown>
  timestamp: Date
}

/**
 * Log a security event
 * In production, this could be sent to a logging service, SIEM, or database
 * 
 * @param event - Security event data
 * 
 * @example
 * ```typescript
 * logSecurityEvent({
 *   type: SecurityEventType.LOGIN_FAILED,
 *   severity: SecurityEventSeverity.WARNING,
 *   message: "Failed login attempt",
 *   email: "user@example.com",
 *   ip: "192.168.1.1",
 *   metadata: { reason: "invalid_password" }
 * })
 * ```
 */
export function logSecurityEvent(event: Omit<SecurityEventData, "timestamp">): void {
  const fullEvent: SecurityEventData = {
    ...event,
    timestamp: new Date(),
  }

  // Format for console output
  const severity = fullEvent.severity.toUpperCase()
  const timestamp = fullEvent.timestamp.toISOString()
  
  let logMessage = `[${timestamp}] [SECURITY:${severity}] ${fullEvent.type} - ${fullEvent.message}`
  
  if (fullEvent.userId) logMessage += ` | userId=${fullEvent.userId}`
  if (fullEvent.email) logMessage += ` | email=${fullEvent.email}`
  if (fullEvent.ip) logMessage += ` | ip=${fullEvent.ip}`
  
  if (fullEvent.metadata && Object.keys(fullEvent.metadata).length > 0) {
    logMessage += ` | metadata=${JSON.stringify(fullEvent.metadata)}`
  }

  // Log to appropriate console level
  switch (fullEvent.severity) {
    case SecurityEventSeverity.CRITICAL:
    case SecurityEventSeverity.ERROR:
      console.error(logMessage)
      break
    case SecurityEventSeverity.WARNING:
      console.warn(logMessage)
      break
    case SecurityEventSeverity.INFO:
    default:
      console.log(logMessage)
      break
  }

  // In production, you could also:
  // - Send to external logging service (e.g., Sentry, LogRocket)
  // - Store in database for audit log
  // - Trigger alerts for critical events
  // - Send notifications to administrators
  
  // Example: Send critical events to database
  if (fullEvent.severity === SecurityEventSeverity.CRITICAL) {
    // TODO: Implement database logging for critical events
    // await prisma.securityLog.create({ data: fullEvent })
  }
}

/**
 * Helper functions for common security events
 */

export function logLoginSuccess(userId: string, email: string, ip: string): void {
  logSecurityEvent({
    type: SecurityEventType.LOGIN_SUCCESS,
    severity: SecurityEventSeverity.INFO,
    message: "User logged in successfully",
    userId,
    email,
    ip,
  })
}

export function logLoginFailed(email: string, ip: string, reason: string): void {
  logSecurityEvent({
    type: SecurityEventType.LOGIN_FAILED,
    severity: SecurityEventSeverity.WARNING,
    message: "Login attempt failed",
    email,
    ip,
    metadata: { reason },
  })
}

export function logRegistrationSuccess(userId: string, email: string, ip: string): void {
  logSecurityEvent({
    type: SecurityEventType.REGISTRATION_SUCCESS,
    severity: SecurityEventSeverity.INFO,
    message: "New user registered",
    userId,
    email,
    ip,
  })
}

export function logRegistrationFailed(email: string, ip: string, reason: string): void {
  logSecurityEvent({
    type: SecurityEventType.REGISTRATION_FAILED,
    severity: SecurityEventSeverity.WARNING,
    message: "Registration attempt failed",
    email,
    ip,
    metadata: { reason },
  })
}

export function logRateLimitTriggered(endpoint: string, ip: string, limit: number): void {
  logSecurityEvent({
    type: SecurityEventType.RATE_LIMIT_TRIGGERED,
    severity: SecurityEventSeverity.WARNING,
    message: `Rate limit exceeded for ${endpoint}`,
    ip,
    metadata: { endpoint, limit },
  })
}

export function logCaptchaValidationFailed(ip: string, provider: string, errorCode?: string): void {
  logSecurityEvent({
    type: SecurityEventType.CAPTCHA_VALIDATION_FAILED,
    severity: SecurityEventSeverity.WARNING,
    message: "CAPTCHA validation failed",
    ip,
    metadata: { provider, errorCode },
  })
}

export function logUnauthorizedAccess(endpoint: string, ip: string, userId?: string): void {
  logSecurityEvent({
    type: SecurityEventType.UNAUTHORIZED_ACCESS_ATTEMPT,
    severity: SecurityEventSeverity.ERROR,
    message: `Unauthorized access attempt to ${endpoint}`,
    userId,
    ip,
    metadata: { endpoint },
  })
}

export function logSuspiciousActivity(description: string, ip: string, metadata?: Record<string, unknown>): void {
  logSecurityEvent({
    type: SecurityEventType.SUSPICIOUS_ACTIVITY,
    severity: SecurityEventSeverity.ERROR,
    message: description,
    ip,
    metadata,
  })
}

export function logSecuritySettingsUpdated(userId: string, changes: string[]): void {
  logSecurityEvent({
    type: SecurityEventType.SECURITY_SETTINGS_UPDATED,
    severity: SecurityEventSeverity.INFO,
    message: "Security settings were updated",
    userId,
    metadata: { changes },
  })
}

/**
 * Rate limit event aggregation
 * Prevents log flooding from repeated rate limit triggers
 */
const rateLimitLogCache = new Map<string, number>()

export function logRateLimitThrottled(endpoint: string, ip: string, limit: number): void {
  const key = `${endpoint}:${ip}`
  const lastLog = rateLimitLogCache.get(key) || 0
  const now = Date.now()
  
  // Only log once per minute per endpoint/IP combination
  if (now - lastLog > 60000) {
    logRateLimitTriggered(endpoint, ip, limit)
    rateLimitLogCache.set(key, now)
  }
}

// Cleanup old cache entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, timestamp] of rateLimitLogCache.entries()) {
    if (now - timestamp > 5 * 60 * 1000) {
      rateLimitLogCache.delete(key)
    }
  }
}, 5 * 60 * 1000)
