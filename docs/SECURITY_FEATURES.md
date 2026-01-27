# Security Features

SnowShare includes several security features to protect your instance from spam and abuse.

## Email Verification

Email verification requires users to verify their email address before they can sign in to the platform.

### Configuration

Email verification can be enabled through the Admin Panel under the **Security** tab:

1. Navigate to **Admin** → **Security** tab
2. Toggle **Require Email Verification**
3. Configure SMTP settings (see below)
4. Save settings

### SMTP Configuration

To send verification emails, you need to configure SMTP settings:

#### Via Admin Panel (Recommended)

1. Go to **Admin** → **Security** tab
2. Fill in the SMTP configuration:
   - **SMTP Host**: Your mail server hostname (e.g., `smtp.gmail.com`)
   - **SMTP Port**: Port number (e.g., `587` for TLS, `465` for SSL)
   - **SMTP Username**: Your email address or username
   - **SMTP Password**: Your email password or app-specific password
   - **From Email**: The sender email address
   - **From Name**: The sender name (e.g., "SnowShare")
   - **Use SSL/TLS**: Check if using port 465, uncheck for port 587
3. Click **Send Test Email** to verify your configuration
4. Save settings

#### Via Environment Variables

You can also configure SMTP through environment variables in `.env`:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM_EMAIL=noreply@snowshare.local
SMTP_FROM_NAME=SnowShare
```

**Note**: Admin panel settings take precedence over environment variables.

### Common SMTP Providers

#### Gmail

1. Enable 2-factor authentication on your Google account
2. Generate an [App Password](https://myaccount.google.com/apppasswords)
3. Use these settings:
   - Host: `smtp.gmail.com`
   - Port: `587`
   - Secure: `false` (STARTTLS)
   - Username: Your Gmail address
   - Password: Your App Password

#### SendGrid

1. Create a SendGrid account and API key
2. Use these settings:
   - Host: `smtp.sendgrid.net`
   - Port: `587`
   - Secure: `false`
   - Username: `apikey`
   - Password: Your SendGrid API key

#### Outlook/Office 365

1. Use these settings:
   - Host: `smtp.office365.com`
   - Port: `587`
   - Secure: `false`
   - Username: Your Outlook email
   - Password: Your Outlook password

## CAPTCHA Protection

CAPTCHA protection helps prevent automated bot registrations by requiring users to complete a challenge.

### Supported Providers

SnowShare supports three CAPTCHA providers:

1. **Google reCAPTCHA v2** - Traditional checkbox "I'm not a robot"
2. **Google reCAPTCHA v3** - Invisible, score-based protection
3. **Cloudflare Turnstile** - Privacy-friendly reCAPTCHA alternative

### Configuration

#### Via Admin Panel (Recommended)

1. Go to **Admin** → **Security** tab
2. Toggle **Enable CAPTCHA**
3. Select your CAPTCHA provider
4. Enter your Site Key and Secret Key (see provider setup below)
5. Save settings

#### Via Environment Variables

```env
CAPTCHA_ENABLED=true
CAPTCHA_PROVIDER=recaptcha-v2
CAPTCHA_SITE_KEY=your-site-key
CAPTCHA_SECRET_KEY=your-secret-key
```

### Provider Setup

#### Google reCAPTCHA v2/v3

1. Visit [Google reCAPTCHA Admin](https://www.google.com/recaptcha/admin)
2. Register a new site
3. Choose reCAPTCHA v2 or v3
4. Add your domain(s)
5. Copy the Site Key and Secret Key
6. Enter them in the Security settings

#### Cloudflare Turnstile

1. Visit [Cloudflare Dashboard](https://dash.cloudflare.com/?to=/:account/turnstile)
2. Create a new site
3. Add your domain
4. Copy the Site Key and Secret Key
5. Enter them in the Security settings

### Best Practices

1. **For public instances**: Enable both email verification and CAPTCHA
2. **For private instances**: Email verification alone may be sufficient
3. **reCAPTCHA v3** provides invisible protection but may have false positives
4. **Turnstile** is recommended for privacy-conscious deployments
5. Always test your configuration with a test account before going live

## Security Considerations

### Password Storage

- All passwords are hashed using bcrypt with cost factor 12
- Passwords are never stored in plain text
- SMTP and CAPTCHA secret keys are stored in the database and should be backed up securely

### Email Verification Tokens

- Tokens are cryptographically secure random strings (32 bytes)
- Tokens expire after 24 hours
- Used tokens are immediately invalidated upon verification

### First User Setup

- The first user to register automatically becomes an admin
- Email verification and CAPTCHA are bypassed for the first user for easier setup
- Recommended: Enable security features immediately after first user setup

## Troubleshooting

### Email Verification Not Working

1. Check SMTP configuration in Admin → Security
2. Use the "Send Test Email" feature to verify SMTP settings
3. Check spam/junk folders
4. Verify firewall/network allows outbound SMTP connections
5. Check application logs for detailed error messages

### CAPTCHA Not Showing

1. Verify Site Key is correct
2. Check browser console for JavaScript errors
3. Ensure domain matches the one registered with provider
4. Try a different CAPTCHA provider
5. Check that CAPTCHA scripts aren't blocked by ad blockers

### Users Can't Verify Email

1. Check that verification link hasn't expired (24 hours)
2. Use the "Resend Verification Email" option
3. Verify SMTP settings are correct
4. Check database for `emailVerificationToken` and `emailVerificationExpires` fields

## Migration Guide

To enable these features on an existing instance:

1. Pull the latest code
2. Run database migrations:
   ```bash
   npx prisma migrate deploy
   ```
3. Restart the application
4. Configure security settings in Admin panel
5. Existing users will have `emailVerified` set to current timestamp (verified)
6. New users will need to verify their email if enabled

