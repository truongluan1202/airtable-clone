# 🚀 Vercel Deployment Guide

## Database Setup for Vercel

### 1. Environment Variables

Make sure these are set in your Vercel project settings:

```bash
DATABASE_URL=your_postgresql_connection_string
NEXTAUTH_SECRET=your_nextauth_secret
NEXTAUTH_URL=https://your-app.vercel.app
```

### 2. Database Schema & Seeding

The deployment is now configured to automatically:

1. **Push schema changes** during build (`prisma db push`)
2. **Seed the database** with initial data (`prisma db seed`)

### 3. What Gets Created

The seed script automatically creates:

- 👤 **Default user**: `demo@example.com`
- 🏢 **Default workspace**: "My Workspace"
- 📁 **Default base**: "My Base"
- 📊 **Sample table**: "Sample Table" with 10 rows of fake data
- 📋 **Columns**: Name (text), Email (text), Age (number)

### 4. Deployment Commands

The build process now runs:

```bash
pnpm prisma db push && pnpm build
```

And after build:

```bash
prisma db seed
```

### 5. Troubleshooting

**If deployment fails:**

1. Check that `DATABASE_URL` is correctly set in Vercel
2. Ensure your database allows connections from Vercel's IP ranges
3. Check the build logs for migration errors

**Common Migration Issues:**

- **"type already exists" error**: The database schema already exists but migrations are out of sync
- **Solution**: Run `npx prisma migrate resolve --applied <migration_name>` to mark migrations as applied
- **Failed migrations in production**: Use `prisma db push` instead of `prisma migrate deploy` for simpler deployment

**If no workspace appears:**

1. The seed script only runs if no users exist
2. If you need to re-seed, you can manually run the seed script
3. Or create a new database to trigger fresh seeding

### 6. Manual Seeding (if needed)

If you need to manually seed the database:

```bash
# Connect to your production database
npx prisma db seed
```

### 7. Schema Changes

For schema changes in production:

```bash
# Push schema changes directly (recommended for deployment)
npx prisma db push

# Or use migrations for complex changes
npx prisma migrate dev --name your_migration_name
```

### 8. Database Reset (Development Only)

For local development, if you need to reset:

```bash
npx prisma migrate reset
npx prisma db seed
```

## ✅ Ready to Deploy!

Your app should now deploy successfully to Vercel with:

- ✅ Database migrations applied
- ✅ Initial data seeded
- ✅ Default workspace available
- ✅ Sample data to get started
