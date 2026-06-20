# Studio Photuna Website

Standalone static website for Studio Photuna, deployed on Vercel.

## Pages

- `/` - Home
- `/account` - Account profile
- `/download` - Download page
- `/book-event` - Metro Manila booking request page
- `/bookings-admin` - Admin-only bookings and reviews page

## Deployment

The site uses `vercel.json` for clean URLs, rewrites, and security headers.
Supabase Row Level Security controls private data access for accounts,
bookings, reviews, and admin actions.
