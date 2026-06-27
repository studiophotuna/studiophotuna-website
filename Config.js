// Vercel Serverless Function — serves Supabase config from environment variables
// This prevents hardcoding keys in client-side JavaScript source code.
//
// SETUP: Add these environment variables in your Vercel project dashboard:
//   Settings → Environment Variables → Add:
//     SUPABASE_URL = https://elthktbvojsmvhtxxqnz.supabase.co
//     SUPABASE_ANON_KEY = (your anon key)
//
// The anon key is designed to be public (it's safe with RLS), but keeping it
// out of version-controlled source code is still good practice — it reduces
// the attack surface and prevents accidental exposure of the project ref.

export default function handler(req, res) {
  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // CORS — restrict to your own domain in production
  const allowedOrigins = [
    'https://studiophotuna.com',
    'https://www.studiophotuna.com',
    'https://studiophotuna.vercel.app',
    'http://localhost:3000',
    'http://127.0.0.1:5500'
  ];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  // Cache for 5 minutes — reduces serverless invocations
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');

  return res.status(200).json({
    u: process.env.SUPABASE_URL || '',
    k: process.env.SUPABASE_ANON_KEY || ''
  });
}
