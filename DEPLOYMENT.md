# Vercel Deployment Guide

This guide will help you deploy your Airtable Clone to Vercel.

## Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **GitHub Repository**: Push your code to GitHub
3. **Database**: Set up a PostgreSQL database (recommended: Vercel Postgres, Supabase, or PlanetScale)

## Step 1: Database Setup

### Option A: Vercel Postgres (Recommended)

1. Go to your Vercel dashboard
2. Navigate to the Storage tab
3. Create a new Postgres database
4. Copy the connection string

### Option B: Supabase

1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Go to Settings > Database
4. Copy the connection string

### Option C: PlanetScale

1. Go to [planetscale.com](https://planetscale.com)
2. Create a new database
3. Copy the connection string

## Step 2: Environment Variables

Set up the following environment variables in your Vercel project:

### Required Variables

```bash
# Database
DATABASE_URL="postgresql://username:password@host:port/database"

# NextAuth
NEXTAUTH_SECRET="your-secret-key-here"
NEXTAUTH_URL="https://your-app.vercel.app"

# Google OAuth (if using Google sign-in)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
```

### How to Set Environment Variables in Vercel:

1. Go to your project dashboard
2. Click on Settings
3. Go to Environment Variables
4. Add each variable with the appropriate value

## Step 3: Deploy to Vercel

### Method 1: Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy
vercel

# For production deployment
vercel --prod
```

### Method 2: GitHub Integration

1. Go to [vercel.com](https://vercel.com)
2. Click "New Project"
3. Import your GitHub repository
4. Configure build settings:
   - Framework Preset: Next.js
   - Build Command: `pnpm build`
   - Output Directory: `.next`
   - Install Command: `pnpm install`
5. Add environment variables
6. Click "Deploy"

## Step 4: Database Migration

The project is configured to automatically handle database migrations during deployment:

- **Prisma Client Generation**: Automatically runs during the build process
- **Database Migrations**: Automatically runs after the build completes
- **No manual intervention required**: Everything is handled by the build scripts

### Manual Migration (if needed):

```bash
# Using Vercel CLI
vercel env pull .env.local
npx prisma migrate deploy
```

## Step 5: Google OAuth Setup (Optional)

If you're using Google sign-in:

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URIs:
   - `https://your-app.vercel.app/api/auth/callback/google`
6. Copy Client ID and Secret to Vercel environment variables

## Build Configuration

The project is already configured with:

- `vercel.json` for deployment settings
- Proper Next.js configuration
- Prisma setup for database
- Environment variable validation

## Troubleshooting

### Common Issues:

1. **Build Fails**: Check that all environment variables are set
2. **Database Connection**: Verify DATABASE_URL is correct
3. **Authentication**: Ensure NEXTAUTH_SECRET is set and NEXTAUTH_URL matches your domain
4. **Prisma Client Error**: If you see "Module '@prisma/client' has no exported member 'PrismaClient'", the Prisma client needs to be generated. This is now handled automatically in the build process.
5. **Database Migrations**: Make sure database migrations are run (handled automatically)

### Useful Commands:

```bash
# Check build locally
pnpm build

# Run database migrations
npx prisma migrate deploy

# Generate Prisma client
npx prisma generate

# View database
npx prisma studio
```

## Post-Deployment

1. **Test Authentication**: Try signing in/out
2. **Test Database**: Create a base and table
3. **Monitor Logs**: Check Vercel function logs for any errors
4. **Set up Custom Domain**: Configure your custom domain in Vercel settings

## Environment Variables Reference

| Variable               | Description                  | Required |
| ---------------------- | ---------------------------- | -------- |
| `DATABASE_URL`         | PostgreSQL connection string | Yes      |
| `NEXTAUTH_SECRET`      | Secret for NextAuth.js       | Yes      |
| `NEXTAUTH_URL`         | Your app's URL               | Yes      |
| `GOOGLE_CLIENT_ID`     | Google OAuth client ID       | No       |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret   | No       |

## Support

If you encounter issues:

1. Check Vercel function logs
2. Verify environment variables
3. Test database connection
4. Review Next.js build output
