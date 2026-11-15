import { useState, type FormEvent } from 'react';
import { Lock, KeyRound, ShieldAlert } from 'lucide-react';
import type { AdminUser } from '../../types/portfolio';

interface AdminLoginProps {
  onSuccess: (user: AdminUser) => void;
  onBackToSite: () => void;
}

export function AdminLogin({ onSuccess, onBackToSite }: AdminLoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        setError(
          'Admin CMS requires the full-stack server environment. Static hosts such as GitHub Pages only serve the public portfolio.'
        );
        return;
      }
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Authentication failed.');
        return;
      }
      onSuccess(json.user);
    } catch {
      setError('Unable to reach authentication server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F5F0] text-[#181A18] flex flex-col justify-center items-center px-6 py-12">
      <div className="w-full max-w-md bg-[#FFFFFF] border border-[#E0DDD5] rounded-2xl p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-[#181A18] text-white flex items-center justify-center shrink-0">
            <Lock className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">Admin Access</h1>
            <p className="text-xs text-[#5A5E58]">Shabbir Creative Visionary</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="admin-username" className="block text-xs font-semibold mb-1.5">
              Username
            </label>
            <input
              id="admin-username"
              type="text"
              required
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-[#F7F5F0] border border-[#E0DDD5] rounded-lg focus:outline-none focus:border-[#1B5E4A]"
            />
          </div>

          <div>
            <label htmlFor="admin-password" className="block text-xs font-semibold mb-1.5">
              Password
            </label>
            <input
              id="admin-password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-[#F7F5F0] border border-[#E0DDD5] rounded-lg focus:outline-none focus:border-[#1B5E4A]"
            />
          </div>

          {error && (
            <div
              role="alert"
              className="p-3 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-xs font-medium text-[#991B1B] flex items-start gap-2"
            >
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-[#1B5E4A] hover:bg-[#144738] rounded-lg transition-colors disabled:opacity-60 cursor-pointer"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-[#E0DDD5] text-center">
          <button
            type="button"
            onClick={onBackToSite}
            className="text-xs font-medium text-[#5A5E58] hover:text-[#181A18] cursor-pointer"
          >
            Return to Public Portfolio
          </button>
        </div>
      </div>
    </div>
  );
}

interface ForcePasswordChangeProps {
  user: AdminUser;
  onUpdated: (user: AdminUser) => void;
  onLogout: () => void;
}

export function ForcePasswordChange({ user, onUpdated, onLogout }: ForcePasswordChangeProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Failed to update password.');
        return;
      }
      onUpdated(json.user);
    } catch {
      setError('Network error while updating password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F5F0] text-[#181A18] flex flex-col justify-center items-center px-6 py-12">
      <div className="w-full max-w-md bg-[#FFFFFF] border border-[#E0DDD5] rounded-2xl p-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-[#1B5E4A] text-white flex items-center justify-center shrink-0">
            <KeyRound className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">Update Initial Password</h1>
            <p className="text-xs text-[#5A5E58]">Signed in as {user.username}</p>
          </div>
        </div>

        <p className="text-xs text-[#5A5E58] leading-relaxed mb-6">
          For account security, you must replace the initial setup password before accessing the
          admin dashboard.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="force-current" className="block text-xs font-semibold mb-1.5">
              Current Password
            </label>
            <input
              id="force-current"
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-[#F7F5F0] border border-[#E0DDD5] rounded-lg focus:outline-none focus:border-[#1B5E4A]"
            />
          </div>

          <div>
            <label htmlFor="force-new" className="block text-xs font-semibold mb-1.5">
              New Password (minimum 8 characters)
            </label>
            <input
              id="force-new"
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-[#F7F5F0] border border-[#E0DDD5] rounded-lg focus:outline-none focus:border-[#1B5E4A]"
            />
          </div>

          <div>
            <label htmlFor="force-confirm" className="block text-xs font-semibold mb-1.5">
              Confirm New Password
            </label>
            <input
              id="force-confirm"
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-[#F7F5F0] border border-[#E0DDD5] rounded-lg focus:outline-none focus:border-[#1B5E4A]"
            />
          </div>

          {error && (
            <div
              role="alert"
              className="p-3 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-xs font-medium text-[#991B1B]"
            >
              {error}
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 px-4 text-sm font-semibold text-white bg-[#1B5E4A] hover:bg-[#144738] rounded-lg transition-colors disabled:opacity-60 cursor-pointer"
            >
              {loading ? 'Updating...' : 'Save New Password'}
            </button>
            <button
              type="button"
              onClick={onLogout}
              className="py-2.5 px-4 text-sm font-medium text-[#5A5E58] hover:text-[#181A18] bg-[#EFECE6] rounded-lg cursor-pointer"
            >
              Log Out
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
