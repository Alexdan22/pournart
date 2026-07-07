# Pour n Art Ecommerce

Full-stack ecommerce site for Pour n Art, a premium handmade resin art store.

## Stack

- Next.js 16 App Router
- TypeScript
- Prisma + SQLite for local development
- Custom cookie session auth
- Razorpay Orders/Checkout verification routes
- Resend-backed role-based email notification layer

## Local Setup

```bash
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

Open `http://localhost:3000`.

The local database is `prisma/dev.db` and is intentionally ignored by Git.

## Seeded Admin

- Email: `admin@pournart.local`
- Password: `Admin@12345`

Change this before production.

## Environment

Copy `.env.example` to `.env` and fill production values:

- `SESSION_SECRET`
- `DATABASE_URL`
- `NEXT_PUBLIC_SITE_URL` or `EMAIL_APP_URL` for canonical SEO URLs
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `NEXT_PUBLIC_RAZORPAY_KEY_ID`
- `RAZORPAY_WEBHOOK_SECRET`
- Shiprocket settings: `SHIPROCKET_EMAIL`, `SHIPROCKET_PASSWORD`, `SHIPROCKET_PICKUP_LOCATION`, `SHIPROCKET_CHANNEL_ID`, `SHIPROCKET_PICKUP_PINCODE`, and default package dimensions
- Resend settings: `RESEND_API_KEY`, role senders, and `EMAIL_ADMIN`
- `NEXT_PUBLIC_WHATSAPP_NUMBER`

## Useful Commands

```bash
npm run lint
npm run build
npm run db:migrate
npm run db:deploy
npm run db:seed
npm run db:studio
```

## Deployment Direction

Cheapest scalable path: Vercel for the app plus a managed Postgres provider such as Neon/Supabase. The current local SQLite setup is for development; before production, switch Prisma datasource to Postgres and run a production migration.
