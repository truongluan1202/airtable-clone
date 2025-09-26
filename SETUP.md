# Airtable Clone Setup

This is an Airtable clone built with Next.js, tRPC, Prisma, and NextAuth.

## Prerequisites

- Node.js 18+
- PostgreSQL database
- Google OAuth credentials

## Setup Instructions

### 1. Environment Variables

Copy the example environment file and fill in your values:

```bash
cp .env.example .env
```

Required environment variables:

- `DATABASE_URL`: PostgreSQL connection string
- `NEXTAUTH_SECRET`: Random secret for NextAuth (generate with `openssl rand -base64 32`)
- `NEXTAUTH_URL`: Your app URL (http://localhost:3000 for development)
- `GOOGLE_CLIENT_ID`: Google OAuth client ID
- `GOOGLE_CLIENT_SECRET`: Google OAuth client secret

### 2. Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Google+ API
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client IDs"
5. Set authorized redirect URIs:
   - Development: `http://localhost:3000/api/auth/callback/google`
   - Production: `https://yourdomain.com/api/auth/callback/google`

### 3. Database Setup

1. Create a PostgreSQL database
2. Run database migrations:

```bash
npx prisma migrate dev --name init
```

### 4. Install Dependencies

```bash
pnpm install
```

### 5. Run Development Server

```bash
pnpm dev
```

Visit `http://localhost:3000` to see the application.

## Features Implemented

- ✅ Google OAuth authentication with NextAuth
- ✅ User session management
- ✅ Basic dashboard UI
- ✅ Database schema for flexible columns (EAV model)
- ✅ Prisma ORM setup

## Next Steps

- [ ] Implement base creation
- [ ] Implement table creation with TanStack Table
- [ ] Add cell editing with keyboard navigation
- [ ] Implement virtualized scrolling for large datasets
- [ ] Add search and filtering
- [ ] Implement views with filters and sorting
