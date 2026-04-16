# Contributing to SnowShare 🤝

We're thrilled that you're interested in contributing to SnowShare! This document will guide you through the process of contributing to our secure file and link sharing platform.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Documentation](#documentation)
- [Issue Reporting](#issue-reporting)
- [Security Issues](#security-issues)

## Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md). Please read it before contributing.

## Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** 18+ and npm/yarn
- **PostgreSQL** database
- **Git** for version control
- A code editor (we recommend VS Code)

### Fork and Clone

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/snowshare.git
   cd snowshare
   ```
3. **Add the upstream remote**:
   ```bash
   git remote add upstream https://github.com/TuroYT/snowshare.git
   ```

## Development Setup

### Quick Start (recommended)

```bash
cp .env.example .env   # Fill in DATABASE_URL, NEXTAUTH_SECRET, etc.
make setup             # Install deps + run DB migrations
make dev               # Start dev server at http://localhost:3000
```

Run `make help` to see all available commands.

### Manual Setup

#### 1. Install Dependencies

```bash
npm install
```

#### 2. Environment Configuration

```bash
cp .env.example .env
```

Required values in `.env`:

| Variable          | Description                                   | Example                                           |
| ----------------- | --------------------------------------------- | ------------------------------------------------- |
| `DATABASE_URL`    | PostgreSQL connection string                  | `postgresql://user:pass@localhost:5432/snowshare` |
| `NEXTAUTH_URL`    | Base URL of the app                           | `http://localhost:3000`                           |
| `NEXTAUTH_SECRET` | Random secret (run `openssl rand -base64 32`) | —                                                 |
| `ALLOW_SIGNUP`    | Allow new user registrations                  | `true`                                            |

#### 3. Database Setup

```bash
npx prisma migrate dev   # Run migrations
npx prisma generate      # Generate Prisma client
```

#### 4. Start Development Server

```bash
make dev
```

The application will be available at `http://localhost:3000`.

### Which dev command should I use?

| Command                              | When to use                                                                                                                                            |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `make dev` / `npm run dev`           | **Default.** Custom server with tus protocol (resumable file uploads), IP quotas, and NextAuth JWT auth. Use this for any work involving file uploads. |
| `make dev-next` / `npm run dev:next` | Next.js only with Turbopack. Faster hot reload, but no file upload support. Use for UI-only work.                                                      |

### Git Hooks

Husky runs `lint-staged` on every commit, which automatically fixes ESLint errors and formats staged files with Prettier. If a commit is blocked, fix the reported errors and try again. You can bypass hooks with `git commit --no-verify` for exceptional cases.

## Making Changes

### Branch Naming Convention

Create descriptive branch names using one of these prefixes:

- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation updates
- `refactor/` - Code refactoring
- `test/` - Adding or updating tests
- `chore/` - Maintenance tasks

Examples:

- `feature/password-protected-shares`
- `fix/qr-code-generation-bug`
- `docs/update-api-documentation`

### Workflow

1. **Create a new branch** from `main`:

   ```bash
   git checkout main
   git pull upstream main
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** following our [coding standards](#coding-standards)

3. **Test your changes** thoroughly

4. **Commit your changes** with descriptive messages:

   ```bash
   git add .
   git commit -m "feat: add password protection for link shares"
   ```

5. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```

## Pull Request Process

### Before Submitting

- [ ] Ensure your code follows our [coding standards](#coding-standards)
- [ ] Run the linter: `npm run lint`
- [ ] Test your changes locally
- [ ] Update documentation if necessary
- [ ] Add tests for new functionality

### Submitting Your PR

1. **Create a Pull Request** from your branch to `main`
2. **Fill out the PR template** completely
3. **Link related issues** using keywords like "Fixes #123"
4. **Request review** from maintainers

### PR Title Format

Use conventional commit format:

- `feat: add new feature`
- `fix: resolve specific bug`
- `docs: update documentation`
- `refactor: improve code structure`
- `test: add missing tests`

## Coding Standards

### TypeScript/JavaScript

- Use **TypeScript** for all new code
- Follow **ESLint** configuration (run `npm run lint`)
- Use **camelCase** for variables and functions
- Use **PascalCase** for components and classes
- Use **kebab-case** for file names

### React Components

```typescript
// ✅ Good
interface ComponentProps {
  title: string;
  isVisible?: boolean;
}

export function MyComponent({ title, isVisible = false }: ComponentProps) {
  return (
    <div className="component-wrapper">
      {isVisible && <h1>{title}</h1>}
    </div>
  );
}
```

### Database/Prisma

- Use descriptive model names
- Follow existing naming conventions
- Always create migrations for schema changes
- Test migrations on development database first

### Styling

- Use **TailwindCSS** classes
- Keep components responsive
- Follow existing design patterns
- Maintain accessibility standards

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Writing Tests

- Write unit tests for utilities and hooks
- Write integration tests for API routes
- Write component tests for React components
- Follow the existing test structure in `__tests__/`

## Documentation

### Code Documentation

- Document complex functions with JSDoc comments
- Keep README.md updated
- Update API documentation for new endpoints
- Add inline comments for complex logic

### API Documentation

When adding new API routes, document them in the following format:

```typescript
/**
 * GET /api/shares
 * Retrieves user's shares with pagination
 *
 * @param page - Page number (default: 1)
 * @param limit - Items per page (default: 10)
 * @returns Array of user shares
 */
```

## Issue Reporting

### Bug Reports

When reporting bugs, please include:

- **Environment** (OS, browser, Node.js version)
- **Steps to reproduce** the issue
- **Expected behavior**
- **Actual behavior**
- **Screenshots** if applicable
- **Error messages** or console logs

### Feature Requests

For new features, please provide:

- **Clear description** of the feature
- **Use case** and motivation
- **Proposed solution** or implementation ideas
- **Alternatives considered**

## Security Issues

**⚠️ Please DO NOT report security vulnerabilities through public GitHub issues.**

For security issues:

1. Email the maintainers directly
2. Include detailed description of the vulnerability
3. Provide steps to reproduce if possible
4. Allow reasonable time for response before public disclosure

See our [Security Policy](SECURITY.md) for more details.

## Project Structure

Understanding our project structure will help you contribute effectively:

```
/
├── prisma/                 # Database schema and migrations
│   ├── schema.prisma      # Prisma schema definition
│   └── migrations/        # Database migrations
├── public/                # Static assets (images, icons)
├── src/
│   ├── app/               # Next.js App Router
│   │   ├── api/           # API routes
│   │   ├── auth/          # Authentication pages
│   │   └── s/             # Short link redirects
│   ├── components/        # Reusable React components
│   │   ├── FileShare.tsx  # File sharing component
│   │   ├── LinkShare.tsx  # Link sharing component
│   │   └── PasteShare.tsx # Text/code sharing component
│   ├── hooks/             # Custom React hooks
│   ├── lib/               # Utility functions
│   └── i18n/              # Internationalization
└── ...
```

## Getting Help

- **GitHub Discussions** - For questions and general discussions
- **GitHub Issues** - For bug reports and feature requests
- **Discord/Slack** - Real-time community chat (if available)

## Recognition

Contributors will be recognized in:

- Repository README
- Release notes
- Contributors section

## License

By contributing to SnowShare, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to SnowShare! 🎉 Your efforts help make secure file sharing accessible to everyone.
