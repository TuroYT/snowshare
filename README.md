# SnowShare

SnowShare is a modern, secure file and link sharing platform built with Next.js, Prisma, and NextAuth. It provides a clean, user-friendly interface for sharing URLs, text snippets, and files with customizable options for expiration, privacy, and access.

![SnowShare Logo](public/logo.svg)

## Features

### LinkShare
- Share any URL with a customizable shortened link
- Set expiration times (1 day to solar explosion)
- Option for no expiration (authenticated users)
- Custom slugs for personalized links
- Password protection for enhanced security
- Instant QR code generation for shared links

### PasteShare
- Share code snippets and text with syntax highlighting
- Support for multiple programming languages
- Expiration options and password protection
- Ideal for sharing code samples, configuration files, or any text content

### FileShare
- Secure file uploads with size limits
- Automatic file type detection
- Download tracking
- Same expiration and protection features

### User Management
- User registration and authentication via NextAuth
- Extended privileges for registered users (longer expiration times, more storage)
- Track and manage your shared content

## Tech Stack

- **Frontend**: Next.js 15.5, React 19.1, TailwindCSS 4
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js with bcrypt password hashing
- **Special Features**: QR code generation, custom URL slugs

## Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn
- PostgreSQL database

### Installation

1. Clone the repository
   ```
   git clone https://github.com/TuroYT/snowshare
   cd snowshare
   ```

2. Install dependencies
   ```
   npm install
   ```

3. Set up environment variables
   Create a `.env` file in the root directory with the following variables:
   ```
   # Database
   DATABASE_URL="postgresql://username:password@localhost:5432/snowshare"
   
   # NextAuth
   NEXTAUTH_URL="http://localhost:3000"
   NEXTAUTH_SECRET="your-secret-key"

   # Auth (allow or disallow user signups)
   ALLOW_SIGNUP=true
   ```

4. Initialize the database
   ```
   npx prisma migrate dev
   ```

5. Start the development server
   ```
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Project Structure

```
/
├── prisma/                # Prisma schema and migrations
├── public/                # Static assets
└── src/
    ├── app/               # Next.js App Router structure
    │   ├── api/           # API routes
    │   ├── auth/          # Authentication pages
    │   ├── protected/     # Protected slugs and shares
    │   └── s/             # Short link redirects
    ├── components/        # React components
    ├── hooks/             # Custom React hooks
    └── lib/               # Utility functions and shared code
```

## Deployment

This project can be deployed on platforms that support Next.js applications:

1. **Vercel** (recommended)
   ```
   npm install -g vercel
   vercel
   ```

2. **Other platforms**
   - Build the project: `npm run build`
   - Start the production server: `npm start`

## Security Features

- Password hashing with bcrypt
- Encrypted file storage
- Link expiration
- Password-protected shares
- Rate limiting for API routes

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- [Next.js](https://nextjs.org/) - The React Framework
- [Prisma](https://www.prisma.io/) - Next-generation ORM
- [NextAuth.js](https://next-auth.js.org/) - Authentication for Next.js
- [TailwindCSS](https://tailwindcss.com/) - Utility-first CSS framework