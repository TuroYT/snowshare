<p align="center">
   <img src="public/logo.svg" alt="SnowShare Logo" width="120" style="margin-bottom: 10px;" />
</p>

<h1 align="center" style="font-family: 'Segoe UI', Arial, sans-serif; color: #3b82f6; font-size: 2.5rem; margin-bottom: 0.5em;">SnowShare</h1>

<p align="center" style="font-size: 1.15rem; color: #374151; font-weight: 500; margin-bottom: 1.5em;">
   SnowShare is a modern, <b>secure</b> file and link sharing platform built with Next.js, Prisma, and NextAuth.<br>
   It provides a clean, user-friendly interface for sharing URLs, text snippets, and files with customizable options for expiration, privacy, and access.
</p>

## Features ✨

### LinkShare 🔗
- Share any URL with a customizable shortened link
- Set expiration times (1 day to solar explosion) ⏳
- Option for no expiration (authenticated users)
- Custom slugs for personalized links
- Password protection for enhanced security 🔒
- Instant QR code generation for shared links 📱

### PasteShare 📋
- Share code snippets and text with syntax highlighting 🎨
- Support for multiple programming languages
- Expiration options and password protection 🔒
- Ideal for sharing code samples, configuration files, or any text content

### FileShare 📁
- Secure file uploads with size limits
- Automatic file type detection
- Download tracking 📥
- Same expiration and protection features

### User Management 👥
- User registration and authentication via NextAuth 🔑
- Extended privileges for registered users (longer expiration times, more storage)
- Track and manage your shared content

## Tech Stack 🧰

- **Frontend**: Next.js 15.5, React 19.1, TailwindCSS 4
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js with bcrypt password hashing
- **Special Features**: QR code generation, custom URL slugs

## Getting Started 🚀

- Node.js 18+ and npm/yarn
- PostgreSQL database
### Prerequisites ✅
- Node.js 18+ and npm/yarn
- PostgreSQL database

- Node.js 18+ and npm/yarn
- PostgreSQL database

### Installation 🛠️

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

## Project Structure 🗂️

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

## 🙏 Acknowledgments

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License ⚖️

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments / Credits 🙌

- [Next.js](https://nextjs.org/) - The React Framework
- [Prisma](https://www.prisma.io/) - Next-generation ORM
- [NextAuth.js](https://next-auth.js.org/) - Authentication for Next.js
- [TailwindCSS](https://tailwindcss.com/) - Utility-first CSS framework

## Contributors 👥

[![](https://opencollective.com/html-react-parser/contributors.svg?width=890&button=false)](https://github.com/TuroYT/snowshare/graphs/contributors)