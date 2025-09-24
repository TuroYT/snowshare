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
- **Database**: SQLite with Prisma ORM
- **Authentication**: NextAuth.js with bcrypt password hashing
- **Special Features**: QR code generation, custom URL slugs

## Getting Started 🚀

### Prerequisites ✅
- Node.js 18+ and npm/yarn
- Or Docker and Docker Compose for containerized deployment

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
   # Database (SQLite)
   DATABASE_URL="file:./prisma/dev.db"
   
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

## Docker Deployment 🐳

For production deployment using Docker:

### Using Docker Compose (Recommended)

1. Clone the repository
   ```bash
   git clone https://github.com/TuroYT/snowshare
   cd snowshare
   ```

2. Create environment file
   ```bash
   cp .env.example .env.production
   # Edit .env.production with your production values:
   # NEXTAUTH_SECRET="your-production-secret-key"
   # NEXTAUTH_URL="https://your-domain.com"
   ```

3. Deploy with Docker Compose
   ```bash
   docker-compose up -d
   ```

The application will be available at `http://localhost:3000`. Data is persisted in Docker volumes:
- SQLite database: `snowshare_data` volume
- Uploaded files: `snowshare_uploads` volume

### Manual Docker Build

1. Build the Docker image
   ```bash
   docker build -t snowshare .
   ```

2. Run the container
   ```bash
   docker run -d \
     --name snowshare \
     -p 3000:3000 \
     -v snowshare_data:/app/data \
     -v snowshare_uploads:/app/uploads \
     -e NEXTAUTH_SECRET="your-secret-key" \
     -e NEXTAUTH_URL="http://localhost:3000" \
     snowshare
   ```

### Development with Docker

For development with Docker:
```bash
docker-compose -f docker-compose.dev.yml up
```

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

