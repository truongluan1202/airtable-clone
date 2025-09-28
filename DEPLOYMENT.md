# 🚀 Vercel Deployment Guide

## Database Setup for Vercel

### 1. Environment Variables

Make sure these are set in your Vercel project settings:

```bash
DATABASE_URL=your_postgresql_connection_string
NEXTAUTH_SECRET=your_nextauth_secret
NEXTAUTH_URL=https://your-app.vercel.app
```

### 2. Database Migration & Seeding

The deployment is now configured to automatically:

1. **Run migrations** during build (`prisma migrate deploy`)
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
pnpm prisma migrate deploy && pnpm build
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

### 7. Database Reset (Development Only)

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
