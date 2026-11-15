import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import multer from 'multer';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import db, { UPLOADS_DIR } from './src/server/db.ts';
import { generatePortfolioChatReply, type ChatTurnInput } from './src/server/gemini.ts';
import {
  AuthRequest,
  SESSION_COOKIE_NAME,
  checkLoginRateLimit,
  clearSessionCookie,
  createAdminSession,
  getClientIp,
  getSessionFromRequest,
  hashPassword,
  hashToken,
  recordLoginAttempt,
  requireAdmin,
  setSessionCookie,
  verifyPassword,
} from './src/server/auth.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

function cleanText(val: unknown, maxLength = 2000): string {
  if (typeof val !== 'string') return '';
  return val.replace(/\0/g, '').trim().slice(0, maxLength);
}

function cleanUrl(val: unknown, maxLength = 1000): string {
  const s = cleanText(val, maxLength);
  if (!s) return '';
  if (s.startsWith('/') && !s.startsWith('//')) return s;
  try {
    const parsed = new URL(s);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return s;
    }
  } catch {
    return '';
  }
  return '';
}

function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return base || `item-${Date.now()}`;
}

function parseJsonArray(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function getSettingsMap(): Record<string, string> {
  const rows = db.prepare('SELECT setting_key, setting_value FROM site_settings').all() as Array<{
    setting_key: string;
    setting_value: string;
  }>;
  const map: Record<string, string> = {};
  for (const r of rows) {
    map[r.setting_key] = r.setting_value;
  }
  return map;
}

function serializeProject(row: Record<string, any>) {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    category: row.category,
    short_description: row.short_description,
    description: row.description,
    goal: row.goal || '',
    approach: row.approach || '',
    results: row.results || '',
    mockup_type: row.mockup_type === 'phone' ? ('phone' as const) : ('laptop' as const),
    thumbnail: row.thumbnail,
    gallery: parseJsonArray(row.gallery),
    video_url: row.video_url,
    github_url: row.github_url,
    live_url: row.live_url,
    drive_url: row.drive_url || '',
    tools_used: parseJsonArray(row.tools_used),
    completion_date: row.completion_date,
    is_featured: Boolean(row.is_featured),
    is_published: Boolean(row.is_published),
    is_sample: Boolean(row.is_sample),
    display_order: row.display_order,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function serializeService(row: Record<string, any>) {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    category: row.category,
    description: row.description,
    details: parseJsonArray(row.details),
    image: row.image,
    cta_label: row.cta_label,
    is_published: Boolean(row.is_published),
    display_order: row.display_order,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function serializeSkill(row: Record<string, any>) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    proficiency: Math.max(0, Math.min(100, Number(row.proficiency ?? 85))),
    metric_label: row.metric_label || '',
    display_order: row.display_order,
    is_published: Boolean(row.is_published),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function serializeStat(row: Record<string, any>) {
  return {
    id: row.id,
    number_value: Number(row.number_value ?? 0),
    suffix: row.suffix || '',
    label: row.label,
    detail: row.detail || '',
    use_odometer: Boolean(row.use_odometer),
    display_order: row.display_order,
    is_published: Boolean(row.is_published),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function serializeExperience(row: Record<string, any>) {
  return {
    id: row.id,
    role_title: row.role_title,
    organization: row.organization,
    period: row.period || '',
    location: row.location || '',
    description: row.description || '',
    highlights: parseJsonArray(row.highlights),
    display_order: row.display_order,
    is_published: Boolean(row.is_published),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function serializeCertification(row: Record<string, any>) {
  return {
    id: row.id,
    title: row.title,
    issuer: row.issuer,
    issue_date: row.issue_date || '',
    credential_id: row.credential_id || '',
    credential_url: row.credential_url || '',
    description: row.description || '',
    display_order: row.display_order,
    is_published: Boolean(row.is_published),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function serializeGithubProject(row: Record<string, any>) {
  return {
    id: row.id,
    repo_name: row.repo_name,
    description: row.description,
    language: row.language,
    repo_url: row.repo_url,
    live_url: row.live_url,
    docs_url: row.docs_url,
    preview_image: row.preview_image,
    is_featured: Boolean(row.is_featured),
    is_published: Boolean(row.is_published),
    display_order: row.display_order,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// Configure Multer for validated uploads
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/webm',
  'application/pdf',
]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().replace(/[^a-z0-9.]/g, '');
    const safeExt = ext || '.bin';
    const randomName = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${safeExt}`;
    cb(null, randomName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(new Error('Unsupported file type. Allowed: JPG, PNG, WebP, GIF, MP4, WebM, PDF.'));
      return;
    }
    cb(null, true);
  },
});

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      frameguard: false,
    })
  );
  app.use(cookieParser());
  app.use(express.json({ limit: '2mb' }));

  // Serve uploaded files safely
  app.use(
    '/uploads',
    express.static(UPLOADS_DIR, {
      setHeaders: (res) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
      },
    })
  );

  // SEO: robots.txt & sitemap.xml
  app.get('/robots.txt', (req, res) => {
    const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    res.type('text/plain').send(
      `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\n\nSitemap: ${baseUrl}/sitemap.xml\n`
    );
  });

  app.get('/sitemap.xml', (req, res) => {
    const baseUrl = (process.env.APP_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
    const publishedProjects = db
      .prepare('SELECT slug, updated_at FROM projects WHERE is_published = 1 ORDER BY display_order ASC')
      .all() as Array<{ slug: string; updated_at: string }>;

    const urls = [
      `  <url><loc>${baseUrl}/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>`,
      ...publishedProjects.map(
        (p) =>
          `  <url><loc>${baseUrl}/projects/${encodeURIComponent(p.slug)}</loc><lastmod>${p.updated_at.split(' ')[0]}</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>`
      ),
    ];

    res.type('application/xml').send(
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>`
    );
  });

  // ---------------------------------------------------------------------------
  // PUBLIC API ROUTES
  // ---------------------------------------------------------------------------
  app.get('/api/public/portfolio', (_req, res) => {
    const settings = getSettingsMap();
    const services = (
      db.prepare('SELECT * FROM services WHERE is_published = 1 ORDER BY display_order ASC, id ASC').all() as any[]
    ).map(serializeService);
    const skills = (
      db.prepare('SELECT * FROM skills WHERE is_published = 1 ORDER BY display_order ASC, id ASC').all() as any[]
    ).map(serializeSkill);
    const stats = (
      db.prepare('SELECT * FROM stats WHERE is_published = 1 ORDER BY display_order ASC, id ASC').all() as any[]
    ).map(serializeStat);
    const experiences = (
      db.prepare('SELECT * FROM experiences WHERE is_published = 1 ORDER BY display_order ASC, id ASC').all() as any[]
    ).map(serializeExperience);
    const certifications = (
      db.prepare('SELECT * FROM certifications WHERE is_published = 1 ORDER BY display_order ASC, id ASC').all() as any[]
    ).map(serializeCertification);
    const projects = (
      db.prepare('SELECT * FROM projects WHERE is_published = 1 ORDER BY is_featured DESC, display_order ASC, id DESC').all() as any[]
    ).map(serializeProject);
    const githubProjects = (
      db
        .prepare('SELECT * FROM github_projects WHERE is_published = 1 ORDER BY is_featured DESC, display_order ASC, id DESC')
        .all() as any[]
    ).map(serializeGithubProject);
    const testimonials = (
      db.prepare('SELECT * FROM testimonials WHERE is_published = 1 ORDER BY id DESC').all() as any[]
    ).map((t) => ({ ...t, is_published: Boolean(t.is_published) }));
    const socialLinks = (
      db
        .prepare("SELECT * FROM social_links WHERE is_enabled = 1 AND trim(profile_url) != '' ORDER BY display_order ASC, id ASC")
        .all() as any[]
    ).map((s) => ({ ...s, is_enabled: Boolean(s.is_enabled) }));

    res.json({
      settings,
      services,
      skills,
      stats,
      experiences,
      certifications,
      projects,
      githubProjects,
      testimonials,
      socialLinks,
    });
  });

  app.get('/api/public/projects/:slug', (req, res) => {
    const slug = cleanText(req.params.slug, 200);
    const row = db.prepare('SELECT * FROM projects WHERE slug = ? AND is_published = 1').get(slug) as any;
    if (!row) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    res.json(serializeProject(row));
  });

  // Public GitHub API proxy (keeps optional GITHUB_TOKEN server-side only)
  app.get('/api/github/repos', async (req, res) => {
    const settings = getSettingsMap();
    const requestedUser = cleanText(req.query.username, 60) || settings.github_username;
    if (!requestedUser || !/^[a-zA-Z0-9-]+$/.test(requestedUser)) {
      res.json({ username: '', repos: [], configured: false });
      return;
    }

    try {
      const headers: Record<string, string> = {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'Shabbir-Creative-Visionary-Portfolio',
      };
      if (process.env.GITHUB_TOKEN) {
        headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
      }
      const response = await fetch(
        `https://api.github.com/users/${encodeURIComponent(requestedUser)}/repos?sort=updated&per_page=12`,
        { headers }
      );
      if (!response.ok) {
        res.status(200).json({ username: requestedUser, repos: [], configured: true, apiUnavailable: true });
        return;
      }
      const data = (await response.json()) as any[];
      const repos = data
        .filter((r) => !r.fork)
        .slice(0, 9)
        .map((r) => ({
          id: r.id,
          repo_name: r.name,
          description: r.description || '',
          language: r.language || '',
          repo_url: r.html_url,
          live_url: r.homepage || '',
          updated_at: r.updated_at,
        }));
      res.json({ username: requestedUser, repos, configured: true, apiUnavailable: false });
    } catch {
      res.status(200).json({ username: requestedUser, repos: [], configured: true, apiUnavailable: true });
    }
  });

  // Contact form submission with Zod validation, rate limiting & spam honeypot
  const contactSchema = z.object({
    name: z.string().trim().min(2, 'Please enter your full name (at least 2 characters).').max(120),
    email: z.string().trim().email('Please provide a valid email address.').max(180),
    subject: z.string().trim().min(2, 'Please enter a subject (at least 2 characters).').max(160),
    message: z.string().trim().min(5, 'Please share a brief description of your project or inquiry.').max(4000),
    phone: z.string().trim().max(40).optional().default(''),
    service: z.string().trim().max(120).optional().default(''),
    budget: z.string().trim().max(80).optional().default(''),
  });

  app.post('/api/contact', (req, res) => {
    const ip = getClientIp(req);

    // Honeypot check
    if (req.body?.company_website) {
      res.status(400).json({ error: 'Invalid submission.' });
      return;
    }

    // Rate limit: max 5 contact submissions per 15 mins per IP
    const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const recentCount = (
      db
        .prepare('SELECT COUNT(*) as count FROM contact_messages WHERE ip_address = ? AND created_at >= ?')
        .get(ip, cutoff) as { count: number }
    ).count;
    if (recentCount >= 5) {
      res.status(429).json({ error: 'Too many messages sent recently. Please try again shortly.' });
      return;
    }

    const candidate = {
      name: cleanText(req.body?.name ?? req.body?.full_name, 120),
      email: cleanText(req.body?.email, 180),
      subject: cleanText(req.body?.subject ?? req.body?.service, 160),
      message: cleanText(req.body?.message, 4000),
      phone: cleanText(req.body?.phone, 40),
      service: cleanText(req.body?.service ?? req.body?.subject, 120),
      budget: cleanText(req.body?.budget, 80),
    };

    const parsed = contactSchema.safeParse(candidate);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.issues[0]?.message || 'Please check the contact form fields.',
      });
      return;
    }

    const valid = parsed.data;
    try {
      db.prepare(
        `INSERT INTO contact_messages (full_name, email, phone, service, subject, budget, message, status, ip_address, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'unread', ?, ?)`
      ).run(
        valid.name,
        valid.email,
        valid.phone,
        valid.service || valid.subject,
        valid.subject,
        valid.budget,
        valid.message,
        ip,
        new Date().toISOString()
      );

      res.status(201).json({
        success: true,
        message: "Thank you for contacting me! Your message has been received. I'll get back to you soon.",
      });
    } catch (error) {
      console.error('Failed to save contact message:', error);
      res.status(500).json({ error: 'Unable to save your message right now. Please try again or contact via WhatsApp/Email.' });
    }
  });

  // Public AI Portfolio Guide Chat endpoint (server-side Gemini API)
  const chatRateBuckets = new Map<string, number[]>();
  app.post('/api/chat', async (req, res) => {
    const ip = getClientIp(req);
    const now = Date.now();
    const windowMs = 10 * 60 * 1000;
    const recent = (chatRateBuckets.get(ip) || []).filter((ts) => now - ts < windowMs);
    if (recent.length >= 25) {
      res.status(429).json({
        error: 'Too many chat requests in a short period. Please wait a few minutes and try again.',
      });
      return;
    }
    recent.push(now);
    chatRateBuckets.set(ip, recent);

    const rawMessages = Array.isArray(req.body?.messages) ? req.body.messages : [];
    const cleanedMessages: ChatTurnInput[] = rawMessages
      .filter(
        (m: any) =>
          m &&
          (m.role === 'user' || m.role === 'assistant') &&
          typeof m.text === 'string' &&
          m.text.trim().length > 0
      )
      .slice(-10)
      .map((m: any) => ({
        role: m.role as 'user' | 'assistant',
        text: cleanText(m.text, 1000),
      }));

    if (
      cleanedMessages.length === 0 ||
      cleanedMessages[cleanedMessages.length - 1].role !== 'user'
    ) {
      res.status(400).json({ error: 'Please enter a message to ask the Portfolio Guide.' });
      return;
    }

    try {
      const settings = getSettingsMap();
      const services = (
        db.prepare('SELECT * FROM services WHERE is_published = 1 ORDER BY display_order ASC, id ASC').all() as any[]
      ).map(serializeService);
      const projects = (
        db.prepare('SELECT * FROM projects WHERE is_published = 1 ORDER BY is_featured DESC, display_order ASC, id DESC').all() as any[]
      ).map(serializeProject);
      const githubProjects = (
        db
          .prepare('SELECT * FROM github_projects WHERE is_published = 1 ORDER BY is_featured DESC, display_order ASC, id DESC')
          .all() as any[]
      ).map(serializeGithubProject);
      const socialLinks = (
        db
          .prepare("SELECT * FROM social_links WHERE is_enabled = 1 AND trim(profile_url) != '' ORDER BY display_order ASC, id ASC")
          .all() as any[]
      ).map((s) => ({
        platform: s.platform,
        profile_url: s.profile_url,
      }));

      const result = await generatePortfolioChatReply(cleanedMessages, {
        settings,
        services,
        projects,
        githubProjects,
        socialLinks,
      });

      res.json(result);
    } catch (err: any) {
      console.error('Portfolio chat error:', err);
      const msg = String(err?.message || '');
      if (msg.includes('GEMINI_API_KEY_MISSING')) {
        res.status(503).json({
          error: 'Portfolio Guide AI is not configured yet. Please ensure GEMINI_API_KEY is set in Settings > Secrets.',
        });
        return;
      }
      if (msg.includes('403') || msg.includes('PERMISSION_DENIED') || msg.includes('API_KEY_INVALID')) {
        res.status(502).json({
          error: 'The Gemini API key could not be authorized. Please check your key in Settings > Secrets.',
        });
        return;
      }
      if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
        res.status(429).json({
          error: 'The AI guide is temporarily busy. Please try again in a moment.',
        });
        return;
      }
      res.status(500).json({
        error: 'Unable to generate a response right now. Please try again or use the Contact form below.',
      });
    }
  });

  // ---------------------------------------------------------------------------
  // ADMIN AUTH ROUTES
  // ---------------------------------------------------------------------------
  app.get('/api/auth/me', (req, res) => {
    const admin = getSessionFromRequest(req);
    if (!admin) {
      res.status(401).json({ authenticated: false });
      return;
    }
    res.json({
      authenticated: true,
      user: {
        id: admin.id,
        username: admin.username,
        role: admin.role,
        mustChangePassword: admin.mustChangePassword,
      },
    });
  });

  app.post('/api/auth/login', (req, res) => {
    const ip = getClientIp(req);
    const rateCheck = checkLoginRateLimit(ip);
    if (!rateCheck.allowed) {
      res.status(429).json({
        error: `Too many failed login attempts. Please wait ${Math.ceil(rateCheck.retryAfterSeconds / 60)} minute(s) before trying again.`,
      });
      return;
    }

    const username = cleanText(req.body?.username, 80);
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!username || !password) {
      res.status(400).json({ error: 'Username and password are required.' });
      return;
    }

    const user = db
      .prepare('SELECT id, username, password_hash, role, must_change_password FROM admin_users WHERE username = ?')
      .get(username) as
      | { id: number; username: string; password_hash: string; role: string; must_change_password: number }
      | undefined;

    if (!user || !verifyPassword(password, user.password_hash)) {
      recordLoginAttempt(ip, username, false);
      res.status(401).json({ error: 'Invalid username or password.' });
      return;
    }

    recordLoginAttempt(ip, username, true);
    const rawToken = createAdminSession(user.id, req);
    setSessionCookie(req, res, rawToken);

    res.json({
      authenticated: true,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        mustChangePassword: Boolean(user.must_change_password),
      },
    });
  });

  app.post('/api/auth/logout', (req, res) => {
    const rawToken = req.cookies?.[SESSION_COOKIE_NAME];
    if (rawToken && typeof rawToken === 'string') {
      db.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').run(hashToken(rawToken));
    }
    clearSessionCookie(req, res);
    res.json({ success: true });
  });

  app.post('/api/auth/change-password', requireAdmin, (req: AuthRequest, res) => {
    const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
    const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';
    const newUsername = cleanText(req.body?.newUsername, 80);

    if (newPassword.length < 8) {
      res.status(400).json({ error: 'New password must be at least 8 characters long.' });
      return;
    }

    const user = db
      .prepare('SELECT id, username, password_hash FROM admin_users WHERE id = ?')
      .get(req.admin!.id) as { id: number; username: string; password_hash: string } | undefined;

    if (!user || !verifyPassword(currentPassword, user.password_hash)) {
      res.status(400).json({ error: 'Current password is incorrect.' });
      return;
    }

    if (verifyPassword(newPassword, user.password_hash)) {
      res.status(400).json({ error: 'Please choose a new password different from the current password.' });
      return;
    }

    const targetUsername = newUsername && newUsername.length >= 3 ? newUsername : user.username;
    const newHash = hashPassword(newPassword);

    try {
      db.prepare(
        `UPDATE admin_users SET username = ?, password_hash = ?, must_change_password = 0, updated_at = datetime('now') WHERE id = ?`
      ).run(targetUsername, newHash, user.id);

      // Rotate session token for security
      db.prepare('DELETE FROM admin_sessions WHERE user_id = ? AND id != ?').run(user.id, req.admin!.sessionId);

      res.json({
        success: true,
        user: {
          id: user.id,
          username: targetUsername,
          role: req.admin!.role,
          mustChangePassword: false,
        },
      });
    } catch {
      res.status(400).json({ error: 'Username already taken or invalid.' });
    }
  });

  // ---------------------------------------------------------------------------
  // PROTECTED ADMIN API ROUTES (All guarded by requireAdmin)
  // ---------------------------------------------------------------------------
  app.use('/api/admin', requireAdmin);

  // Enforce mandatory password change before allowing other admin mutations if desired,
  // while still allowing dashboard read/password change.
  app.get('/api/admin/overview', (_req, res) => {
    const totalProjects = (db.prepare('SELECT COUNT(*) as c FROM projects').get() as { c: number }).c;
    const publishedProjects = (db.prepare('SELECT COUNT(*) as c FROM projects WHERE is_published = 1').get() as { c: number }).c;
    const totalServices = (db.prepare('SELECT COUNT(*) as c FROM services').get() as { c: number }).c;
    const publishedServices = (db.prepare('SELECT COUNT(*) as c FROM services WHERE is_published = 1').get() as { c: number }).c;
    const totalMessages = (db.prepare('SELECT COUNT(*) as c FROM contact_messages').get() as { c: number }).c;
    const unreadMessages = (db.prepare("SELECT COUNT(*) as c FROM contact_messages WHERE status = 'unread'").get() as { c: number }).c;
    const totalGithubProjects = (db.prepare('SELECT COUNT(*) as c FROM github_projects').get() as { c: number }).c;
    const totalTestimonials = (db.prepare('SELECT COUNT(*) as c FROM testimonials').get() as { c: number }).c;
    const totalSkills = (db.prepare('SELECT COUNT(*) as c FROM skills').get() as { c: number }).c;
    const totalStats = (db.prepare('SELECT COUNT(*) as c FROM stats').get() as { c: number }).c;
    const totalExperiences = (db.prepare('SELECT COUNT(*) as c FROM experiences').get() as { c: number }).c;
    const totalCertifications = (db.prepare('SELECT COUNT(*) as c FROM certifications').get() as { c: number }).c;
    const recentMessages = db
      .prepare('SELECT id, full_name, email, phone, service, subject, budget, message, status, created_at FROM contact_messages ORDER BY id DESC LIMIT 5')
      .all();

    res.json({
      stats: {
        totalProjects,
        publishedProjects,
        totalServices,
        publishedServices,
        totalMessages,
        unreadMessages,
        totalGithubProjects,
        totalTestimonials,
        totalSkills,
        totalStats,
        totalExperiences,
        totalCertifications,
      },
      recentMessages,
    });
  });

  // Settings
  app.get('/api/admin/settings', (_req, res) => {
    res.json(getSettingsMap());
  });

  app.put('/api/admin/settings', (req, res) => {
    const allowedKeys = new Set([
      'brand_name',
      'owner_name',
      'hero_headline',
      'hero_description',
      'hero_3d_name',
      'outlined_statement',
      'scrub_video_url',
      'scrub_video_poster',
      'scrub_video_title',
      'scrub_video_subtitle',
      'tagline',
      'about_bio',
      'profile_photo',
      'logo_text',
      'logo_url',
      'favicon_url',
      'accent_color',
      'education_degree',
      'education_institution',
      'education_status',
      'education_details',
      'phone',
      'whatsapp',
      'email',
      'address',
      'github_username',
      'github_profile_url',
      'cv_url',
      'footer_note',
      'seo_title',
      'seo_description',
    ]);

    const urlKeys = new Set([
      'profile_photo',
      'logo_url',
      'favicon_url',
      'github_profile_url',
      'cv_url',
      'scrub_video_url',
      'scrub_video_poster',
    ]);
    const updates = req.body && typeof req.body === 'object' ? req.body : {};

    const upsert = db.prepare(`
      INSERT INTO site_settings (setting_key, setting_value, updated_at)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value, updated_at = datetime('now')
    `);

    const tx = db.transaction(() => {
      for (const [key, rawVal] of Object.entries(updates)) {
        if (!allowedKeys.has(key)) continue;
        const val = urlKeys.has(key) ? cleanUrl(rawVal, 1000) : cleanText(rawVal, 4000);
        upsert.run(key, val);
      }
    });
    tx();
    res.json(getSettingsMap());
  });

  // Projects CRUD
  app.get('/api/admin/projects', (_req, res) => {
    const rows = db.prepare('SELECT * FROM projects ORDER BY display_order ASC, id DESC').all() as any[];
    res.json(rows.map(serializeProject));
  });

  app.post('/api/admin/projects', (req, res) => {
    const title = cleanText(req.body?.title, 200);
    const category = cleanText(req.body?.category, 100) || 'Website Development';
    if (!title) {
      res.status(400).json({ error: 'Project title is required.' });
      return;
    }
    let slug = slugify(cleanText(req.body?.slug, 120) || title);
    const existingSlug = db.prepare('SELECT id FROM projects WHERE slug = ?').get(slug);
    if (existingSlug) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }

    const maxOrder = (db.prepare('SELECT COALESCE(MAX(display_order), 0) as m FROM projects').get() as { m: number }).m;
    const gallery = Array.isArray(req.body?.gallery) ? req.body.gallery.map((u: unknown) => cleanUrl(u)).filter(Boolean) : [];
    const tools = Array.isArray(req.body?.tools_used)
      ? req.body.tools_used.map((t: unknown) => cleanText(t, 60)).filter(Boolean)
      : [];

    const mockupType = req.body?.mockup_type === 'phone' ? 'phone' : 'laptop';

    const info = db
      .prepare(
        `INSERT INTO projects (
          title, slug, category, short_description, description, goal, approach, results, mockup_type,
          thumbnail, gallery, video_url, github_url, live_url, drive_url, tools_used, completion_date,
          is_featured, is_published, is_sample, display_order
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        title,
        slug,
        category,
        cleanText(req.body?.short_description, 500),
        cleanText(req.body?.description, 8000),
        cleanText(req.body?.goal, 2000),
        cleanText(req.body?.approach, 3000),
        cleanText(req.body?.results, 2000),
        mockupType,
        cleanUrl(req.body?.thumbnail),
        JSON.stringify(gallery),
        cleanUrl(req.body?.video_url),
        cleanUrl(req.body?.github_url),
        cleanUrl(req.body?.live_url),
        cleanUrl(req.body?.drive_url),
        JSON.stringify(tools),
        cleanText(req.body?.completion_date, 60),
        req.body?.is_featured ? 1 : 0,
        req.body?.is_published !== false ? 1 : 0,
        req.body?.is_sample ? 1 : 0,
        maxOrder + 1
      );

    const created = db.prepare('SELECT * FROM projects WHERE id = ?').get(info.lastInsertRowid) as any;
    res.status(201).json(serializeProject(created));
  });

  app.put('/api/admin/projects/:id', (req, res) => {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as any;
    if (!existing) {
      res.status(404).json({ error: 'Project not found.' });
      return;
    }

    const title = cleanText(req.body?.title, 200) || existing.title;
    const category = cleanText(req.body?.category, 100) || existing.category;
    const gallery = Array.isArray(req.body?.gallery)
      ? req.body.gallery.map((u: unknown) => cleanUrl(u)).filter(Boolean)
      : parseJsonArray(existing.gallery);
    const tools = Array.isArray(req.body?.tools_used)
      ? req.body.tools_used.map((t: unknown) => cleanText(t, 60)).filter(Boolean)
      : parseJsonArray(existing.tools_used);
    const nextMockup =
      req.body?.mockup_type !== undefined
        ? req.body.mockup_type === 'phone'
          ? 'phone'
          : 'laptop'
        : existing.mockup_type || 'laptop';

    db.prepare(
      `UPDATE projects SET
        title = ?, category = ?, short_description = ?, description = ?,
        goal = ?, approach = ?, results = ?, mockup_type = ?,
        thumbnail = ?, gallery = ?, video_url = ?, github_url = ?, live_url = ?, drive_url = ?,
        tools_used = ?, completion_date = ?, is_featured = ?, is_published = ?,
        is_sample = ?, display_order = ?, updated_at = datetime('now')
       WHERE id = ?`
    ).run(
      title,
      category,
      req.body?.short_description !== undefined ? cleanText(req.body.short_description, 500) : existing.short_description,
      req.body?.description !== undefined ? cleanText(req.body.description, 8000) : existing.description,
      req.body?.goal !== undefined ? cleanText(req.body.goal, 2000) : existing.goal || '',
      req.body?.approach !== undefined ? cleanText(req.body.approach, 3000) : existing.approach || '',
      req.body?.results !== undefined ? cleanText(req.body.results, 2000) : existing.results || '',
      nextMockup,
      req.body?.thumbnail !== undefined ? cleanUrl(req.body.thumbnail) : existing.thumbnail,
      JSON.stringify(gallery),
      req.body?.video_url !== undefined ? cleanUrl(req.body.video_url) : existing.video_url,
      req.body?.github_url !== undefined ? cleanUrl(req.body.github_url) : existing.github_url,
      req.body?.live_url !== undefined ? cleanUrl(req.body.live_url) : existing.live_url,
      req.body?.drive_url !== undefined ? cleanUrl(req.body.drive_url) : existing.drive_url,
      JSON.stringify(tools),
      req.body?.completion_date !== undefined ? cleanText(req.body.completion_date, 60) : existing.completion_date,
      req.body?.is_featured !== undefined ? (req.body.is_featured ? 1 : 0) : existing.is_featured,
      req.body?.is_published !== undefined ? (req.body.is_published ? 1 : 0) : existing.is_published,
      req.body?.is_sample !== undefined ? (req.body.is_sample ? 1 : 0) : existing.is_sample,
      typeof req.body?.display_order === 'number' ? req.body.display_order : existing.display_order,
      id
    );

    const updated = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as any;
    res.json(serializeProject(updated));
  });

  app.post('/api/admin/projects/reorder', (req, res) => {
    const orderedIds = Array.isArray(req.body?.orderedIds) ? req.body.orderedIds.map(Number).filter(Number.isFinite) : [];
    const stmt = db.prepare('UPDATE projects SET display_order = ? WHERE id = ?');
    const tx = db.transaction(() => {
      orderedIds.forEach((id: number, idx: number) => stmt.run(idx + 1, id));
    });
    tx();
    res.json({ success: true });
  });

  app.delete('/api/admin/projects/:id', (req, res) => {
    db.prepare('DELETE FROM projects WHERE id = ?').run(Number(req.params.id));
    res.json({ success: true });
  });

  // Services CRUD
  app.get('/api/admin/services', (_req, res) => {
    const rows = db.prepare('SELECT * FROM services ORDER BY display_order ASC, id ASC').all() as any[];
    res.json(rows.map(serializeService));
  });

  app.post('/api/admin/services', (req, res) => {
    const title = cleanText(req.body?.title, 200);
    if (!title) {
      res.status(400).json({ error: 'Service title is required.' });
      return;
    }
    let slug = slugify(title);
    if (db.prepare('SELECT id FROM services WHERE slug = ?').get(slug)) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }
    const maxOrder = (db.prepare('SELECT COALESCE(MAX(display_order), 0) as m FROM services').get() as { m: number }).m;
    const details = Array.isArray(req.body?.details)
      ? req.body.details.map((d: unknown) => cleanText(d, 120)).filter(Boolean)
      : [];

    const info = db
      .prepare(
        `INSERT INTO services (title, slug, category, description, details, image, cta_label, is_published, display_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        title,
        slug,
        cleanText(req.body?.category, 100),
        cleanText(req.body?.description, 3000),
        JSON.stringify(details),
        cleanUrl(req.body?.image),
        cleanText(req.body?.cta_label, 60) || 'Discuss This Service',
        req.body?.is_published !== false ? 1 : 0,
        maxOrder + 1
      );

    const created = db.prepare('SELECT * FROM services WHERE id = ?').get(info.lastInsertRowid) as any;
    res.status(201).json(serializeService(created));
  });

  app.put('/api/admin/services/:id', (req, res) => {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM services WHERE id = ?').get(id) as any;
    if (!existing) {
      res.status(404).json({ error: 'Service not found.' });
      return;
    }

    const details = Array.isArray(req.body?.details)
      ? req.body.details.map((d: unknown) => cleanText(d, 120)).filter(Boolean)
      : parseJsonArray(existing.details);

    db.prepare(
      `UPDATE services SET
        title = ?, category = ?, description = ?, details = ?, image = ?,
        cta_label = ?, is_published = ?, display_order = ?, updated_at = datetime('now')
       WHERE id = ?`
    ).run(
      cleanText(req.body?.title, 200) || existing.title,
      req.body?.category !== undefined ? cleanText(req.body.category, 100) : existing.category,
      req.body?.description !== undefined ? cleanText(req.body.description, 3000) : existing.description,
      JSON.stringify(details),
      req.body?.image !== undefined ? cleanUrl(req.body.image) : existing.image,
      req.body?.cta_label !== undefined ? cleanText(req.body.cta_label, 60) : existing.cta_label,
      req.body?.is_published !== undefined ? (req.body.is_published ? 1 : 0) : existing.is_published,
      typeof req.body?.display_order === 'number' ? req.body.display_order : existing.display_order,
      id
    );

    const updated = db.prepare('SELECT * FROM services WHERE id = ?').get(id) as any;
    res.json(serializeService(updated));
  });

  app.delete('/api/admin/services/:id', (req, res) => {
    db.prepare('DELETE FROM services WHERE id = ?').run(Number(req.params.id));
    res.json({ success: true });
  });

  // GitHub Projects CRUD
  app.get('/api/admin/github-projects', (_req, res) => {
    const rows = db.prepare('SELECT * FROM github_projects ORDER BY display_order ASC, id DESC').all() as any[];
    res.json(rows.map(serializeGithubProject));
  });

  app.post('/api/admin/github-projects', (req, res) => {
    const repoName = cleanText(req.body?.repo_name, 150);
    if (!repoName) {
      res.status(400).json({ error: 'Repository name is required.' });
      return;
    }
    const maxOrder = (db.prepare('SELECT COALESCE(MAX(display_order), 0) as m FROM github_projects').get() as { m: number }).m;
    const info = db
      .prepare(
        `INSERT INTO github_projects (
          repo_name, description, language, repo_url, live_url, docs_url, preview_image,
          is_featured, is_published, display_order
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        repoName,
        cleanText(req.body?.description, 1500),
        cleanText(req.body?.language, 60),
        cleanUrl(req.body?.repo_url),
        cleanUrl(req.body?.live_url),
        cleanUrl(req.body?.docs_url),
        cleanUrl(req.body?.preview_image),
        req.body?.is_featured ? 1 : 0,
        req.body?.is_published !== false ? 1 : 0,
        maxOrder + 1
      );
    const created = db.prepare('SELECT * FROM github_projects WHERE id = ?').get(info.lastInsertRowid) as any;
    res.status(201).json(serializeGithubProject(created));
  });

  app.put('/api/admin/github-projects/:id', (req, res) => {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM github_projects WHERE id = ?').get(id) as any;
    if (!existing) {
      res.status(404).json({ error: 'GitHub project not found.' });
      return;
    }
    db.prepare(
      `UPDATE github_projects SET
        repo_name = ?, description = ?, language = ?, repo_url = ?, live_url = ?,
        docs_url = ?, preview_image = ?, is_featured = ?, is_published = ?,
        display_order = ?, updated_at = datetime('now')
       WHERE id = ?`
    ).run(
      cleanText(req.body?.repo_name, 150) || existing.repo_name,
      req.body?.description !== undefined ? cleanText(req.body.description, 1500) : existing.description,
      req.body?.language !== undefined ? cleanText(req.body.language, 60) : existing.language,
      req.body?.repo_url !== undefined ? cleanUrl(req.body.repo_url) : existing.repo_url,
      req.body?.live_url !== undefined ? cleanUrl(req.body.live_url) : existing.live_url,
      req.body?.docs_url !== undefined ? cleanUrl(req.body.docs_url) : existing.docs_url,
      req.body?.preview_image !== undefined ? cleanUrl(req.body.preview_image) : existing.preview_image,
      req.body?.is_featured !== undefined ? (req.body.is_featured ? 1 : 0) : existing.is_featured,
      req.body?.is_published !== undefined ? (req.body.is_published ? 1 : 0) : existing.is_published,
      typeof req.body?.display_order === 'number' ? req.body.display_order : existing.display_order,
      id
    );
    const updated = db.prepare('SELECT * FROM github_projects WHERE id = ?').get(id) as any;
    res.json(serializeGithubProject(updated));
  });

  app.delete('/api/admin/github-projects/:id', (req, res) => {
    db.prepare('DELETE FROM github_projects WHERE id = ?').run(Number(req.params.id));
    res.json({ success: true });
  });

  // Contact Messages Management & CSV Export
  app.get('/api/admin/messages', (req, res) => {
    const status = cleanText(req.query.status, 30);
    const search = cleanText(req.query.search, 120).toLowerCase();
    let rows = db
      .prepare('SELECT id, full_name, email, phone, service, subject, budget, message, status, created_at FROM contact_messages ORDER BY id DESC')
      .all() as any[];

    if (status && status !== 'all') {
      rows = rows.filter((r) => r.status === status);
    }
    if (search) {
      rows = rows.filter(
        (r) =>
          r.full_name.toLowerCase().includes(search) ||
          r.email.toLowerCase().includes(search) ||
          (r.subject || '').toLowerCase().includes(search) ||
          r.service.toLowerCase().includes(search) ||
          r.message.toLowerCase().includes(search)
      );
    }
    res.json(rows);
  });

  app.patch('/api/admin/messages/:id', (req, res) => {
    const id = Number(req.params.id);
    const status = cleanText(req.body?.status, 30);
    const allowedStatuses = new Set(['unread', 'read', 'pending', 'contacted', 'archived']);
    if (!allowedStatuses.has(status)) {
      res.status(400).json({ error: 'Invalid status value.' });
      return;
    }
    db.prepare('UPDATE contact_messages SET status = ? WHERE id = ?').run(status, id);
    const updated = db
      .prepare('SELECT id, full_name, email, phone, service, subject, budget, message, status, created_at FROM contact_messages WHERE id = ?')
      .get(id);
    res.json(updated);
  });

  app.delete('/api/admin/messages/:id', (req, res) => {
    db.prepare('DELETE FROM contact_messages WHERE id = ?').run(Number(req.params.id));
    res.json({ success: true });
  });

  app.get('/api/admin/messages/export', (_req, res) => {
    const rows = db
      .prepare('SELECT id, full_name, email, phone, service, subject, budget, message, status, created_at FROM contact_messages ORDER BY id DESC')
      .all() as any[];

    const escapeCsv = (val: unknown) => {
      let s = String(val ?? '');
      if (/^[=+\-@]/.test(s)) {
        s = `'${s}`;
      }
      return `"${s.replace(/"/g, '""')}"`;
    };

    const header = ['ID', 'Full Name', 'Email', 'Phone', 'Subject', 'Service', 'Budget', 'Message', 'Status', 'Submitted At'].join(',');
    const lines = rows.map((r) =>
      [r.id, r.full_name, r.email, r.phone, r.subject || '', r.service, r.budget, r.message, r.status, r.created_at]
        .map(escapeCsv)
        .join(',')
    );

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="contact-inquiries.csv"');
    res.send([header, ...lines].join('\n'));
  });

  // Skills CRUD
  app.get('/api/admin/skills', (_req, res) => {
    const rows = db.prepare('SELECT * FROM skills ORDER BY display_order ASC, id ASC').all() as any[];
    res.json(rows.map(serializeSkill));
  });

  app.post('/api/admin/skills', (req, res) => {
    const name = cleanText(req.body?.name, 120);
    if (!name) {
      res.status(400).json({ error: 'Skill name is required.' });
      return;
    }
    const maxOrder = (db.prepare('SELECT COALESCE(MAX(display_order), 0) as m FROM skills').get() as { m: number }).m;
    const proficiency = Math.max(0, Math.min(100, Math.round(Number(req.body?.proficiency ?? 85))));
    const info = db
      .prepare(
        `INSERT INTO skills (name, category, proficiency, metric_label, display_order, is_published)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        name,
        cleanText(req.body?.category, 80),
        Number.isFinite(proficiency) ? proficiency : 85,
        cleanText(req.body?.metric_label, 120),
        typeof req.body?.display_order === 'number' ? req.body.display_order : maxOrder + 1,
        req.body?.is_published !== false ? 1 : 0
      );
    const created = db.prepare('SELECT * FROM skills WHERE id = ?').get(info.lastInsertRowid) as any;
    res.status(201).json(serializeSkill(created));
  });

  app.put('/api/admin/skills/:id', (req, res) => {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM skills WHERE id = ?').get(id) as any;
    if (!existing) {
      res.status(404).json({ error: 'Skill not found.' });
      return;
    }
    const proficiency =
      req.body?.proficiency !== undefined
        ? Math.max(0, Math.min(100, Math.round(Number(req.body.proficiency))))
        : existing.proficiency;
    db.prepare(
      `UPDATE skills SET name = ?, category = ?, proficiency = ?, metric_label = ?, display_order = ?, is_published = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(
      cleanText(req.body?.name, 120) || existing.name,
      req.body?.category !== undefined ? cleanText(req.body.category, 80) : existing.category,
      Number.isFinite(proficiency) ? proficiency : existing.proficiency,
      req.body?.metric_label !== undefined ? cleanText(req.body.metric_label, 120) : existing.metric_label,
      typeof req.body?.display_order === 'number' ? req.body.display_order : existing.display_order,
      req.body?.is_published !== undefined ? (req.body.is_published ? 1 : 0) : existing.is_published,
      id
    );
    const updated = db.prepare('SELECT * FROM skills WHERE id = ?').get(id) as any;
    res.json(serializeSkill(updated));
  });

  app.delete('/api/admin/skills/:id', (req, res) => {
    db.prepare('DELETE FROM skills WHERE id = ?').run(Number(req.params.id));
    res.json({ success: true });
  });

  // Stats CRUD
  app.get('/api/admin/stats', (_req, res) => {
    const rows = db.prepare('SELECT * FROM stats ORDER BY display_order ASC, id ASC').all() as any[];
    res.json(rows.map(serializeStat));
  });

  app.post('/api/admin/stats', (req, res) => {
    const label = cleanText(req.body?.label, 120);
    if (!label) {
      res.status(400).json({ error: 'Stat label is required.' });
      return;
    }
    const maxOrder = (db.prepare('SELECT COALESCE(MAX(display_order), 0) as m FROM stats').get() as { m: number }).m;
    const numVal = Number(req.body?.number_value ?? 0);
    const info = db
      .prepare(
        `INSERT INTO stats (number_value, suffix, label, detail, use_odometer, display_order, is_published)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        Number.isFinite(numVal) ? numVal : 0,
        cleanText(req.body?.suffix, 16),
        label,
        cleanText(req.body?.detail, 300),
        req.body?.use_odometer !== false ? 1 : 0,
        typeof req.body?.display_order === 'number' ? req.body.display_order : maxOrder + 1,
        req.body?.is_published !== false ? 1 : 0
      );
    const created = db.prepare('SELECT * FROM stats WHERE id = ?').get(info.lastInsertRowid) as any;
    res.status(201).json(serializeStat(created));
  });

  app.put('/api/admin/stats/:id', (req, res) => {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM stats WHERE id = ?').get(id) as any;
    if (!existing) {
      res.status(404).json({ error: 'Stat not found.' });
      return;
    }
    const numVal =
      req.body?.number_value !== undefined && Number.isFinite(Number(req.body.number_value))
        ? Number(req.body.number_value)
        : existing.number_value;
    db.prepare(
      `UPDATE stats SET number_value = ?, suffix = ?, label = ?, detail = ?, use_odometer = ?, display_order = ?, is_published = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(
      numVal,
      req.body?.suffix !== undefined ? cleanText(req.body.suffix, 16) : existing.suffix,
      cleanText(req.body?.label, 120) || existing.label,
      req.body?.detail !== undefined ? cleanText(req.body.detail, 300) : existing.detail,
      req.body?.use_odometer !== undefined ? (req.body.use_odometer ? 1 : 0) : existing.use_odometer,
      typeof req.body?.display_order === 'number' ? req.body.display_order : existing.display_order,
      req.body?.is_published !== undefined ? (req.body.is_published ? 1 : 0) : existing.is_published,
      id
    );
    const updated = db.prepare('SELECT * FROM stats WHERE id = ?').get(id) as any;
    res.json(serializeStat(updated));
  });

  app.delete('/api/admin/stats/:id', (req, res) => {
    db.prepare('DELETE FROM stats WHERE id = ?').run(Number(req.params.id));
    res.json({ success: true });
  });

  // Experience Timeline CRUD
  app.get('/api/admin/experiences', (_req, res) => {
    const rows = db.prepare('SELECT * FROM experiences ORDER BY display_order ASC, id ASC').all() as any[];
    res.json(rows.map(serializeExperience));
  });

  app.post('/api/admin/experiences', (req, res) => {
    const roleTitle = cleanText(req.body?.role_title, 160);
    const organization = cleanText(req.body?.organization, 160);
    if (!roleTitle || !organization) {
      res.status(400).json({ error: 'Role title and organization are required.' });
      return;
    }
    const maxOrder = (db.prepare('SELECT COALESCE(MAX(display_order), 0) as m FROM experiences').get() as { m: number }).m;
    const highlights = Array.isArray(req.body?.highlights)
      ? req.body.highlights.map((h: unknown) => cleanText(h, 240)).filter(Boolean)
      : [];
    const info = db
      .prepare(
        `INSERT INTO experiences (role_title, organization, period, location, description, highlights, display_order, is_published)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        roleTitle,
        organization,
        cleanText(req.body?.period, 80),
        cleanText(req.body?.location, 120),
        cleanText(req.body?.description, 2000),
        JSON.stringify(highlights),
        typeof req.body?.display_order === 'number' ? req.body.display_order : maxOrder + 1,
        req.body?.is_published !== false ? 1 : 0
      );
    const created = db.prepare('SELECT * FROM experiences WHERE id = ?').get(info.lastInsertRowid) as any;
    res.status(201).json(serializeExperience(created));
  });

  app.put('/api/admin/experiences/:id', (req, res) => {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM experiences WHERE id = ?').get(id) as any;
    if (!existing) {
      res.status(404).json({ error: 'Experience entry not found.' });
      return;
    }
    const highlights = Array.isArray(req.body?.highlights)
      ? req.body.highlights.map((h: unknown) => cleanText(h, 240)).filter(Boolean)
      : parseJsonArray(existing.highlights);
    db.prepare(
      `UPDATE experiences SET role_title = ?, organization = ?, period = ?, location = ?, description = ?, highlights = ?, display_order = ?, is_published = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(
      cleanText(req.body?.role_title, 160) || existing.role_title,
      cleanText(req.body?.organization, 160) || existing.organization,
      req.body?.period !== undefined ? cleanText(req.body.period, 80) : existing.period,
      req.body?.location !== undefined ? cleanText(req.body.location, 120) : existing.location,
      req.body?.description !== undefined ? cleanText(req.body.description, 2000) : existing.description,
      JSON.stringify(highlights),
      typeof req.body?.display_order === 'number' ? req.body.display_order : existing.display_order,
      req.body?.is_published !== undefined ? (req.body.is_published ? 1 : 0) : existing.is_published,
      id
    );
    const updated = db.prepare('SELECT * FROM experiences WHERE id = ?').get(id) as any;
    res.json(serializeExperience(updated));
  });

  app.delete('/api/admin/experiences/:id', (req, res) => {
    db.prepare('DELETE FROM experiences WHERE id = ?').run(Number(req.params.id));
    res.json({ success: true });
  });

  // Certifications CRUD
  app.get('/api/admin/certifications', (_req, res) => {
    const rows = db.prepare('SELECT * FROM certifications ORDER BY display_order ASC, id ASC').all() as any[];
    res.json(rows.map(serializeCertification));
  });

  app.post('/api/admin/certifications', (req, res) => {
    const title = cleanText(req.body?.title, 160);
    const issuer = cleanText(req.body?.issuer, 160);
    if (!title || !issuer) {
      res.status(400).json({ error: 'Certification title and issuer are required.' });
      return;
    }
    const maxOrder = (db.prepare('SELECT COALESCE(MAX(display_order), 0) as m FROM certifications').get() as { m: number }).m;
    const info = db
      .prepare(
        `INSERT INTO certifications (title, issuer, issue_date, credential_id, credential_url, description, display_order, is_published)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        title,
        issuer,
        cleanText(req.body?.issue_date, 80),
        cleanText(req.body?.credential_id, 120),
        cleanUrl(req.body?.credential_url),
        cleanText(req.body?.description, 1500),
        typeof req.body?.display_order === 'number' ? req.body.display_order : maxOrder + 1,
        req.body?.is_published !== false ? 1 : 0
      );
    const created = db.prepare('SELECT * FROM certifications WHERE id = ?').get(info.lastInsertRowid) as any;
    res.status(201).json(serializeCertification(created));
  });

  app.put('/api/admin/certifications/:id', (req, res) => {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM certifications WHERE id = ?').get(id) as any;
    if (!existing) {
      res.status(404).json({ error: 'Certification not found.' });
      return;
    }
    db.prepare(
      `UPDATE certifications SET title = ?, issuer = ?, issue_date = ?, credential_id = ?, credential_url = ?, description = ?, display_order = ?, is_published = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(
      cleanText(req.body?.title, 160) || existing.title,
      cleanText(req.body?.issuer, 160) || existing.issuer,
      req.body?.issue_date !== undefined ? cleanText(req.body.issue_date, 80) : existing.issue_date,
      req.body?.credential_id !== undefined ? cleanText(req.body.credential_id, 120) : existing.credential_id,
      req.body?.credential_url !== undefined ? cleanUrl(req.body.credential_url) : existing.credential_url,
      req.body?.description !== undefined ? cleanText(req.body.description, 1500) : existing.description,
      typeof req.body?.display_order === 'number' ? req.body.display_order : existing.display_order,
      req.body?.is_published !== undefined ? (req.body.is_published ? 1 : 0) : existing.is_published,
      id
    );
    const updated = db.prepare('SELECT * FROM certifications WHERE id = ?').get(id) as any;
    res.json(serializeCertification(updated));
  });

  app.delete('/api/admin/certifications/:id', (req, res) => {
    db.prepare('DELETE FROM certifications WHERE id = ?').run(Number(req.params.id));
    res.json({ success: true });
  });

  // Testimonials CRUD
  app.get('/api/admin/testimonials', (_req, res) => {
    const rows = db.prepare('SELECT * FROM testimonials ORDER BY id DESC').all() as any[];
    res.json(rows.map((r) => ({ ...r, is_published: Boolean(r.is_published) })));
  });

  app.post('/api/admin/testimonials', (req, res) => {
    const customerName = cleanText(req.body?.customer_name, 120);
    const review = cleanText(req.body?.review, 2000);
    if (!customerName || !review) {
      res.status(400).json({ error: 'Customer name and review text are required.' });
      return;
    }
    const info = db
      .prepare(
        `INSERT INTO testimonials (customer_name, customer_role, review, customer_image, is_published)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(
        customerName,
        cleanText(req.body?.customer_role, 120),
        review,
        cleanUrl(req.body?.customer_image),
        req.body?.is_published !== false ? 1 : 0
      );
    const created = db.prepare('SELECT * FROM testimonials WHERE id = ?').get(info.lastInsertRowid) as any;
    res.status(201).json({ ...created, is_published: Boolean(created.is_published) });
  });

  app.put('/api/admin/testimonials/:id', (req, res) => {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM testimonials WHERE id = ?').get(id) as any;
    if (!existing) {
      res.status(404).json({ error: 'Testimonial not found.' });
      return;
    }
    db.prepare(
      `UPDATE testimonials SET customer_name = ?, customer_role = ?, review = ?, customer_image = ?, is_published = ? WHERE id = ?`
    ).run(
      cleanText(req.body?.customer_name, 120) || existing.customer_name,
      req.body?.customer_role !== undefined ? cleanText(req.body.customer_role, 120) : existing.customer_role,
      cleanText(req.body?.review, 2000) || existing.review,
      req.body?.customer_image !== undefined ? cleanUrl(req.body.customer_image) : existing.customer_image,
      req.body?.is_published !== undefined ? (req.body.is_published ? 1 : 0) : existing.is_published,
      id
    );
    const updated = db.prepare('SELECT * FROM testimonials WHERE id = ?').get(id) as any;
    res.json({ ...updated, is_published: Boolean(updated.is_published) });
  });

  app.delete('/api/admin/testimonials/:id', (req, res) => {
    db.prepare('DELETE FROM testimonials WHERE id = ?').run(Number(req.params.id));
    res.json({ success: true });
  });

  // Social Links CRUD
  app.get('/api/admin/social-links', (_req, res) => {
    const rows = db.prepare('SELECT * FROM social_links ORDER BY display_order ASC, id ASC').all() as any[];
    res.json(rows.map((r) => ({ ...r, is_enabled: Boolean(r.is_enabled) })));
  });

  app.post('/api/admin/social-links', (req, res) => {
    const platform = cleanText(req.body?.platform, 80);
    if (!platform) {
      res.status(400).json({ error: 'Platform name is required.' });
      return;
    }
    const maxOrder = (db.prepare('SELECT COALESCE(MAX(display_order), 0) as m FROM social_links').get() as { m: number }).m;
    const info = db
      .prepare('INSERT INTO social_links (platform, profile_url, display_order, is_enabled) VALUES (?, ?, ?, ?)')
      .run(platform, cleanUrl(req.body?.profile_url), maxOrder + 1, req.body?.is_enabled ? 1 : 0);
    const created = db.prepare('SELECT * FROM social_links WHERE id = ?').get(info.lastInsertRowid) as any;
    res.status(201).json({ ...created, is_enabled: Boolean(created.is_enabled) });
  });

  app.put('/api/admin/social-links/:id', (req, res) => {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM social_links WHERE id = ?').get(id) as any;
    if (!existing) {
      res.status(404).json({ error: 'Social link not found.' });
      return;
    }
    db.prepare('UPDATE social_links SET platform = ?, profile_url = ?, display_order = ?, is_enabled = ? WHERE id = ?').run(
      cleanText(req.body?.platform, 80) || existing.platform,
      req.body?.profile_url !== undefined ? cleanUrl(req.body.profile_url) : existing.profile_url,
      typeof req.body?.display_order === 'number' ? req.body.display_order : existing.display_order,
      req.body?.is_enabled !== undefined ? (req.body.is_enabled ? 1 : 0) : existing.is_enabled,
      id
    );
    const updated = db.prepare('SELECT * FROM social_links WHERE id = ?').get(id) as any;
    res.json({ ...updated, is_enabled: Boolean(updated.is_enabled) });
  });

  app.delete('/api/admin/social-links/:id', (req, res) => {
    db.prepare('DELETE FROM social_links WHERE id = ?').run(Number(req.params.id));
    res.json({ success: true });
  });

  // Media Library Upload & Delete
  app.get('/api/admin/media', (_req, res) => {
    const rows = db.prepare('SELECT * FROM media_files ORDER BY id DESC').all();
    res.json(rows);
  });

  app.post('/api/admin/media', (req, res) => {
    upload.single('file')(req, res, (err) => {
      if (err) {
        res.status(400).json({ error: err.message || 'Upload failed.' });
        return;
      }
      if (!req.file) {
        res.status(400).json({ error: 'No file provided.' });
        return;
      }
      const fileUrl = `/uploads/${req.file.filename}`;
      const info = db
        .prepare('INSERT INTO media_files (file_name, file_url, file_type, file_size) VALUES (?, ?, ?, ?)')
        .run(cleanText(req.file.originalname, 200), fileUrl, req.file.mimetype, req.file.size);
      const created = db.prepare('SELECT * FROM media_files WHERE id = ?').get(info.lastInsertRowid);
      res.status(201).json(created);
    });
  });

  app.delete('/api/admin/media/:id', (req, res) => {
    const id = Number(req.params.id);
    const file = db.prepare('SELECT * FROM media_files WHERE id = ?').get(id) as any;
    if (file && typeof file.file_url === 'string' && file.file_url.startsWith('/uploads/')) {
      const diskPath = path.join(UPLOADS_DIR, path.basename(file.file_url));
      if (fs.existsSync(diskPath)) {
        fs.unlinkSync(diskPath);
      }
    }
    db.prepare('DELETE FROM media_files WHERE id = ?').run(id);
    res.json({ success: true });
  });

  // Google Drive Folder List & Asset Import (Client-side Google OAuth Bearer token)
  const extractDriveFolderId = (rawInput: string): string | null => {
    const input = rawInput.trim();
    if (!input) return null;
    if (/^[a-zA-Z0-9_-]{10,120}$/.test(input)) {
      return input;
    }
    try {
      const parsed = new URL(input);
      if (!parsed.hostname.includes('google.com')) return null;
      const folderMatch = parsed.pathname.match(/\/folders\/([a-zA-Z0-9_-]{10,120})/);
      if (folderMatch) return folderMatch[1];
      const idParam = parsed.searchParams.get('id');
      if (idParam && /^[a-zA-Z0-9_-]{10,120}$/.test(idParam)) {
        return idParam;
      }
    } catch {
      return null;
    }
    return null;
  };

  const getBearerToken = (req: AuthRequest): string | null => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) return null;
    const token = header.slice(7).trim();
    return token.length > 10 ? token : null;
  };

  const MIME_TO_EXT: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'video/mp4': '.mp4',
    'video/webm': '.webm',
    'application/pdf': '.pdf',
  };

  const GOOGLE_EXPORT_MAP: Record<string, { mimeType: string; ext: string }> = {
    'application/vnd.google-apps.document': { mimeType: 'application/pdf', ext: '.pdf' },
    'application/vnd.google-apps.presentation': { mimeType: 'application/pdf', ext: '.pdf' },
    'application/vnd.google-apps.spreadsheet': { mimeType: 'application/pdf', ext: '.pdf' },
    'application/vnd.google-apps.drawing': { mimeType: 'image/png', ext: '.png' },
  };

  app.post('/api/admin/media/drive/list', async (req: AuthRequest, res) => {
    const token = getBearerToken(req);
    if (!token) {
      res.status(401).json({
        error: 'Google Drive authorization required. Please sign in with Google.',
        authExpired: true,
      });
      return;
    }

    const folderUrl = cleanText(req.body?.folderUrl, 500);
    const folderId = extractDriveFolderId(folderUrl);
    if (!folderId) {
      res.status(400).json({
        error: 'Please enter a valid Google Drive folder URL or folder ID.',
      });
      return;
    }

    try {
      const folderMetaRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
          folderId
        )}?fields=id,name,mimeType&supportsAllDrives=true`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (folderMetaRes.status === 401 || folderMetaRes.status === 403) {
        res.status(401).json({
          error: 'Google Drive access expired or permission denied. Please sign in with Google again.',
          authExpired: true,
        });
        return;
      }

      if (!folderMetaRes.ok) {
        const errText = await folderMetaRes.text();
        res.status(folderMetaRes.status === 404 ? 404 : 400).json({
          error:
            folderMetaRes.status === 404
              ? 'Google Drive folder not found or you do not have access to view it.'
              : `Unable to read folder metadata (${errText.slice(0, 120)}).`,
        });
        return;
      }

      const folderMeta = (await folderMetaRes.json()) as {
        id: string;
        name: string;
        mimeType: string;
      };

      if (folderMeta.mimeType !== 'application/vnd.google-apps.folder') {
        res.status(400).json({
          error: 'The provided Google Drive link does not point to a folder.',
        });
        return;
      }

      const params = new URLSearchParams({
        q: `'${folderId}' in parents and trashed = false`,
        fields: 'files(id,name,mimeType,size,thumbnailLink,webViewLink,modifiedTime)',
        pageSize: '100',
        orderBy: 'folder,modifiedTime desc',
        supportsAllDrives: 'true',
        includeItemsFromAllDrives: 'true',
      });

      const listRes = await fetch(
        `https://www.googleapis.com/drive/v3/files?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (listRes.status === 401 || listRes.status === 403) {
        res.status(401).json({
          error: 'Google Drive authorization expired. Please sign in with Google again.',
          authExpired: true,
        });
        return;
      }

      if (!listRes.ok) {
        res.status(502).json({ error: 'Failed to list files from Google Drive.' });
        return;
      }

      const listJson = (await listRes.json()) as { files?: any[] };
      const items = (listJson.files || []).map((f) => {
        const isFolder = f.mimeType === 'application/vnd.google-apps.folder';
        const isDirectMedia = ALLOWED_MIME_TYPES.has(f.mimeType);
        const isExportableDoc = Boolean(GOOGLE_EXPORT_MAP[f.mimeType]);
        return {
          id: String(f.id),
          name: String(f.name || 'Untitled'),
          mimeType: String(f.mimeType || ''),
          size: Number(f.size || 0),
          thumbnailLink: typeof f.thumbnailLink === 'string' ? f.thumbnailLink : '',
          webViewLink: typeof f.webViewLink === 'string' ? f.webViewLink : '',
          modifiedTime: typeof f.modifiedTime === 'string' ? f.modifiedTime : '',
          isFolder,
          importable: isDirectMedia || isExportableDoc,
        };
      });

      res.json({
        folder: { id: folderMeta.id, name: folderMeta.name },
        files: items,
      });
    } catch (err) {
      console.error('Google Drive list error:', err);
      res.status(500).json({ error: 'Network error while connecting to Google Drive.' });
    }
  });

  app.post('/api/admin/media/drive/import', async (req: AuthRequest, res) => {
    const token = getBearerToken(req);
    if (!token) {
      res.status(401).json({
        error: 'Google Drive authorization required. Please sign in with Google.',
        authExpired: true,
      });
      return;
    }

    const fileIds: string[] = Array.isArray(req.body?.fileIds)
      ? req.body.fileIds
          .filter((id: unknown): id is string => typeof id === 'string' && /^[a-zA-Z0-9_-]{10,120}$/.test(id))
          .slice(0, 20)
      : [];

    if (fileIds.length === 0) {
      res.status(400).json({ error: 'Please select at least one valid Google Drive file to import.' });
      return;
    }

    const imported: any[] = [];
    const failed: Array<{ id: string; name: string; error: string }> = [];
    const maxBytes = 20 * 1024 * 1024;

    for (const fileId of fileIds) {
      let displayName = fileId;
      try {
        const metaRes = await fetch(
          `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
            fileId
          )}?fields=id,name,mimeType,size&supportsAllDrives=true`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (metaRes.status === 401 || metaRes.status === 403) {
          res.status(401).json({
            error: 'Google Drive authorization expired during import. Please sign in with Google again.',
            authExpired: true,
            imported,
          });
          return;
        }

        if (!metaRes.ok) {
          failed.push({ id: fileId, name: displayName, error: 'Unable to read file metadata.' });
          continue;
        }

        const meta = (await metaRes.json()) as {
          id: string;
          name: string;
          mimeType: string;
          size?: string;
        };
        displayName = cleanText(meta.name, 180) || fileId;

        const exportSpec = GOOGLE_EXPORT_MAP[meta.mimeType];
        const isDirectMedia = ALLOWED_MIME_TYPES.has(meta.mimeType);

        if (!isDirectMedia && !exportSpec) {
          failed.push({
            id: fileId,
            name: displayName,
            error: `Unsupported file type (${meta.mimeType}).`,
          });
          continue;
        }

        if (meta.size && Number(meta.size) > maxBytes) {
          failed.push({
            id: fileId,
            name: displayName,
            error: 'File exceeds the 20MB Media Library limit.',
          });
          continue;
        }

        const downloadUrl = exportSpec
          ? `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
              fileId
            )}/export?mimeType=${encodeURIComponent(exportSpec.mimeType)}`
          : `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
              fileId
            )}?alt=media&supportsAllDrives=true`;

        const fileRes = await fetch(downloadUrl, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!fileRes.ok) {
          failed.push({
            id: fileId,
            name: displayName,
            error: 'Failed to download file contents from Google Drive.',
          });
          continue;
        }

        const arrayBuffer = await fileRes.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        if (buffer.length === 0 || buffer.length > maxBytes) {
          failed.push({
            id: fileId,
            name: displayName,
            error: buffer.length === 0 ? 'Downloaded file is empty.' : 'File exceeds 20MB limit.',
          });
          continue;
        }

        const targetMime = exportSpec ? exportSpec.mimeType : meta.mimeType;
        const originalExt = path.extname(displayName).toLowerCase().replace(/[^a-z0-9.]/g, '');
        const safeExt = exportSpec
          ? exportSpec.ext
          : originalExt || MIME_TO_EXT[targetMime] || '.bin';
        const savedFileName = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${safeExt}`;
        const savedDiskPath = path.join(UPLOADS_DIR, savedFileName);

        fs.writeFileSync(savedDiskPath, buffer);

        const finalDisplayName = exportSpec && !displayName.toLowerCase().endsWith(exportSpec.ext)
          ? `${displayName}${exportSpec.ext}`
          : displayName;
        const fileUrl = `/uploads/${savedFileName}`;

        const info = db
          .prepare('INSERT INTO media_files (file_name, file_url, file_type, file_size) VALUES (?, ?, ?, ?)')
          .run(cleanText(finalDisplayName, 200), fileUrl, targetMime, buffer.length);

        const created = db.prepare('SELECT * FROM media_files WHERE id = ?').get(info.lastInsertRowid);
        imported.push(created);
      } catch (err) {
        console.error('Drive import file error:', err);
        failed.push({ id: fileId, name: displayName, error: 'Unexpected import error.' });
      }
    }

    res.status(imported.length > 0 ? 201 : 400).json({
      imported,
      failed,
    });
  });

  // Admin Session Management
  app.get('/api/admin/sessions', (req: AuthRequest, res) => {
    const rows = db
      .prepare('SELECT id, ip_address, user_agent, expires_at, created_at FROM admin_sessions WHERE user_id = ? ORDER BY id DESC')
      .all(req.admin!.id) as any[];
    res.json(
      rows.map((r) => ({
        ...r,
        isCurrent: r.id === req.admin!.sessionId,
      }))
    );
  });

  app.delete('/api/admin/sessions/:id', (req: AuthRequest, res) => {
    const sessionId = Number(req.params.id);
    db.prepare('DELETE FROM admin_sessions WHERE id = ? AND user_id = ?').run(sessionId, req.admin!.id);
    res.json({ success: true });
  });

  // ---------------------------------------------------------------------------
  // VITE / STATIC SPA SERVING
  // ---------------------------------------------------------------------------
  const httpServer = http.createServer(app);

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const hmrDisabled = process.env.DISABLE_HMR === 'true';

    if (hmrDisabled) {
      app.get('/@vite/client', (_req, res) => {
        res.type('application/javascript').send(`
const sheetsMap = new Map();
const linkSheetsMap = new Map();
if ("document" in globalThis) {
  document.querySelectorAll("style[data-vite-dev-id]").forEach((el) => {
    sheetsMap.set(el.getAttribute("data-vite-dev-id"), el);
  });
  document.querySelectorAll('link[rel="stylesheet"][data-vite-dev-id]').forEach((el) => {
    linkSheetsMap.set(el.getAttribute("data-vite-dev-id"), el);
  });
}
let lastInsertedStyle;
export function updateStyle(id, content) {
  if (linkSheetsMap.has(id)) return;
  let style = sheetsMap.get(id);
  if (!style) {
    style = document.createElement("style");
    style.setAttribute("type", "text/css");
    style.setAttribute("data-vite-dev-id", id);
    style.textContent = content;
    if (!lastInsertedStyle) {
      document.head.appendChild(style);
      setTimeout(() => { lastInsertedStyle = void 0; }, 0);
    } else {
      lastInsertedStyle.insertAdjacentElement("afterend", style);
    }
    lastInsertedStyle = style;
  } else if (style.textContent !== content) {
    style.textContent = content;
  }
  sheetsMap.set(id, style);
}
export function removeStyle(id) {
  if (linkSheetsMap.has(id)) {
    document.querySelectorAll('link[rel="stylesheet"][data-vite-dev-id="' + CSS.escape(id) + '"]').forEach((el) => el.remove());
    linkSheetsMap.delete(id);
  }
  const style = sheetsMap.get(id);
  if (style) {
    document.head.removeChild(style);
    sheetsMap.delete(id);
  }
}
export function createHotContext() {
  return {
    data: {},
    accept() {},
    acceptExports() {},
    dispose() {},
    prune() {},
    decline() {},
    invalidate() {},
    on() {},
    off() {},
    send() {},
  };
}
export function injectQuery(url, queryToInject) {
  if (url[0] !== "." && url[0] !== "/") return url;
  const pathname = url.replace(/[?#].*$/, "");
  const { search, hash } = new URL(url, "http://vite.dev");
  return pathname + "?" + queryToInject + (search ? "&" + search.slice(1) : "") + (hash || "");
}
export class ErrorOverlay extends HTMLElement {}
`);
      });
    }

    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        ...(hmrDisabled ? { hmr: false, ws: false } : { ws: { server: httpServer } }),
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use('/projects/assets', express.static(path.join(distDir, 'assets')));
    app.use('/admin/assets', express.static(path.join(distDir, 'assets')));
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
