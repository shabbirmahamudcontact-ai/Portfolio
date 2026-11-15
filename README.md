# Shabbir Creative Visionary — Personal Portfolio & Admin System

Full-stack portfolio website and content management system built for **Shabbir Mahamud** (`Shabbir Creative Visionary`).

## Architecture Overview

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Motion, Three.js (PBR studio sculpture with software-WebGL guard & reduced-motion support)
- **Backend**: Express (`server.ts`) serving public portfolio APIs, SEO endpoints (`/sitemap.xml`, `/robots.txt`), GitHub public API proxy, validated contact submissions, Multer media uploads, and protected `/api/admin/*` endpoints
- **Database**: Persistent SQLite (`data/portfolio.db`) with WAL mode + Firebase Firestore (`firebase-blueprint.json` & hardened `firestore.rules`)
- **Security**:
  - Passwords hashed with `bcryptjs` (cost 12)
  - Mandatory password change on first login (`must_change_password`)
  - HTTP-only session cookies (`scv_admin_session`) with SHA-256 token hashing
  - Login brute-force rate limiting (5 attempts / 15-minute lockout)
  - Contact form rate limiting + honeypot protection
  - `helmet` security headers & input/URL sanitization
  - Admin route (`/admin`) excluded from search indexing (`robots.txt` & `noindex`)

## Environment Variables

Copy `.env.example` to configure optional runtime variables:

- `APP_URL`: Public deployment URL for canonical sitemap generation
- `GITHUB_TOKEN`: Optional server-side GitHub token for higher public API rate limits
- `INITIAL_ADMIN_USERNAME` / `INITIAL_ADMIN_PASSWORD`: Initial setup credentials (only used when seeding an empty `admin_users` table)

## Local Development & Production Build

```bash
npm install
npm run dev      # Starts Express + Vite dev server on port 3000
npm run lint     # TypeScript type-checking
npm run build    # Builds Vite production bundle to dist/
npm run start    # Runs production Express server on port 3000
```
