import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { Request, Response, NextFunction } from 'express';
import db from './db.ts';

export const SESSION_COOKIE_NAME = 'scv_admin_session';
const SESSION_TTL_HOURS = 24;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

export interface AuthenticatedAdmin {
  id: number;
  username: string;
  role: string;
  mustChangePassword: boolean;
  sessionId: number;
}

export interface AuthRequest extends Request {
  admin?: AuthenticatedAdmin;
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

export function isRequestHttps(req: Request): boolean {
  return req.secure || req.headers['x-forwarded-proto'] === 'https';
}

export function setSessionCookie(req: Request, res: Response, rawToken: string): void {
  const secure = isRequestHttps(req);
  res.cookie(SESSION_COOKIE_NAME, rawToken, {
    httpOnly: true,
    secure,
    sameSite: secure ? 'none' : 'lax',
    path: '/',
    maxAge: SESSION_TTL_HOURS * 60 * 60 * 1000,
  });
}

export function clearSessionCookie(req: Request, res: Response): void {
  const secure = isRequestHttps(req);
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure,
    sameSite: secure ? 'none' : 'lax',
    path: '/',
  });
}

export function checkLoginRateLimit(ip: string): { allowed: boolean; retryAfterSeconds: number } {
  const cutoff = new Date(Date.now() - LOCKOUT_MINUTES * 60 * 1000).toISOString();
  const row = db
    .prepare(
      `SELECT COUNT(*) as failures, MAX(attempted_at) as last_attempt
       FROM login_attempts
       WHERE ip_address = ? AND success = 0 AND attempted_at >= ?`
    )
    .get(ip, cutoff) as { failures: number; last_attempt: string | null };

  if (row.failures >= MAX_FAILED_ATTEMPTS && row.last_attempt) {
    const lastMs = new Date(row.last_attempt).getTime();
    const unlockMs = lastMs + LOCKOUT_MINUTES * 60 * 1000;
    const retryAfterSeconds = Math.max(1, Math.ceil((unlockMs - Date.now()) / 1000));
    return { allowed: false, retryAfterSeconds };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

export function recordLoginAttempt(ip: string, username: string, success: boolean): void {
  db.prepare(
    `INSERT INTO login_attempts (ip_address, username, attempted_at, success)
     VALUES (?, ?, ?, ?)`
  ).run(ip, username, new Date().toISOString(), success ? 1 : 0);

  if (success) {
    db.prepare(`DELETE FROM login_attempts WHERE ip_address = ? AND success = 0`).run(ip);
  }
}

export function createAdminSession(userId: number, req: Request): string {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000).toISOString();
  const ip = getClientIp(req);
  const ua = String(req.headers['user-agent'] || '').slice(0, 300);

  db.prepare(
    `INSERT INTO admin_sessions (user_id, token_hash, ip_address, user_agent, expires_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(userId, tokenHash, ip, ua, expiresAt);

  // Prune expired sessions
  db.prepare(`DELETE FROM admin_sessions WHERE expires_at < ?`).run(new Date().toISOString());

  return rawToken;
}

export function verifyPassword(plain: string, hash: string): boolean {
  return bcrypt.compareSync(plain, hash);
}

export function hashPassword(plain: string): string {
  return bcrypt.hashSync(plain, 12);
}

export function getSessionFromRequest(req: Request): AuthenticatedAdmin | null {
  const rawToken = req.cookies?.[SESSION_COOKIE_NAME];
  if (!rawToken || typeof rawToken !== 'string') {
    return null;
  }
  const tokenHash = hashToken(rawToken);
  const row = db
    .prepare(
      `SELECT s.id as session_id, s.expires_at, u.id as user_id, u.username, u.role, u.must_change_password
       FROM admin_sessions s
       INNER JOIN admin_users u ON u.id = s.user_id
       WHERE s.token_hash = ?`
    )
    .get(tokenHash) as
    | {
        session_id: number;
        expires_at: string;
        user_id: number;
        username: string;
        role: string;
        must_change_password: number;
      }
    | undefined;

  if (!row) return null;
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    db.prepare(`DELETE FROM admin_sessions WHERE id = ?`).run(row.session_id);
    return null;
  }

  return {
    id: row.user_id,
    username: row.username,
    role: row.role,
    mustChangePassword: Boolean(row.must_change_password),
    sessionId: row.session_id,
  };
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  const admin = getSessionFromRequest(req);
  if (!admin) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  if (admin.role !== 'admin') {
    res.status(403).json({ error: 'Insufficient permissions' });
    return;
  }
  req.admin = admin;
  next();
}
