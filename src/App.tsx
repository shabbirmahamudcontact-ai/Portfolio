/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import type { Project, PublicPortfolioData } from './types/portfolio';
import { PublicPortfolio } from './components/PublicPortfolio';
import { ProjectDetailView } from './components/ProjectDetailView';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { verifyFirestoreConnection } from './lib/firebase';
import { STATIC_PORTFOLIO_FALLBACK } from './data/staticPortfolioFallback';

function resolveRouteFromLocation(): string {
  if (typeof window === 'undefined') return '/';
  const hash = window.location.hash || '';
  if (hash.startsWith('#/')) {
    return hash.slice(1);
  }
  const path = window.location.pathname || '/';
  const adminIdx = path.indexOf('/admin');
  if (adminIdx !== -1) {
    return path.slice(adminIdx);
  }
  const projIdx = path.indexOf('/projects/');
  if (projIdx !== -1) {
    return path.slice(projIdx);
  }
  return '/';
}

export default function App() {
  const [route, setRoute] = useState<string>(() => resolveRouteFromLocation());
  const [portfolioData, setPortfolioData] = useState<PublicPortfolioData | null>(null);
  const [isStaticHost, setIsStaticHost] = useState(false);
  const [loading, setLoading] = useState(true);

  const syncSeoMeta = (data: PublicPortfolioData) => {
    if (data.settings?.seo_title) {
      document.title = data.settings.seo_title;
    }
    if (data.settings?.seo_description) {
      const metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) metaDesc.setAttribute('content', data.settings.seo_description);
    }
  };

  const fetchPortfolio = useCallback(async () => {
    if (typeof window !== 'undefined' && window.location.hostname.endsWith('github.io')) {
      setPortfolioData(STATIC_PORTFOLIO_FALLBACK);
      setIsStaticHost(true);
      syncSeoMeta(STATIC_PORTFOLIO_FALLBACK);
      setLoading(false);
      return;
    }
    try {
      const res = await fetch('/api/public/portfolio');
      const contentType = res.headers.get('content-type') || '';
      if (!res.ok || !contentType.includes('application/json')) {
        throw new Error('Backend API unavailable');
      }
      const json: PublicPortfolioData = await res.json();
      setPortfolioData(json);
      setIsStaticHost(false);
      syncSeoMeta(json);
    } catch {
      // Static hosting (e.g. GitHub Pages): gracefully serve full verified portfolio snapshot
      setPortfolioData(STATIC_PORTFOLIO_FALLBACK);
      setIsStaticHost(true);
      syncSeoMeta(STATIC_PORTFOLIO_FALLBACK);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchPortfolio();
    void verifyFirestoreConnection();
  }, [fetchPortfolio]);

  useEffect(() => {
    const syncRoute = () => setRoute(resolveRouteFromLocation());
    window.addEventListener('popstate', syncRoute);
    window.addEventListener('hashchange', syncRoute);
    return () => {
      window.removeEventListener('popstate', syncRoute);
      window.removeEventListener('hashchange', syncRoute);
    };
  }, []);

  const navigate = useCallback(
    (to: string) => {
      const normalized = to.startsWith('/') ? to : `/${to}`;
      const onGitHubPages =
        isStaticHost ||
        (typeof window !== 'undefined' && window.location.hostname.endsWith('github.io'));

      if (onGitHubPages) {
        window.location.hash = normalized === '/' ? '' : `#${normalized}`;
      } else if (window.location.pathname !== normalized) {
        window.history.pushState({}, '', normalized);
      }
      setRoute(normalized);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [isStaticHost]
  );

  // Separate Admin Dashboard route (/admin)
  if (route === '/admin' || route.startsWith('/admin/')) {
    return (
      <AdminDashboard
        onBackToSite={() => navigate('/')}
        onDataUpdated={() => void fetchPortfolio()}
      />
    );
  }

  if (loading && !portfolioData) {
    return (
      <div className="min-h-screen bg-[#F7F5F0] flex items-center justify-center px-6">
        <div className="text-center space-y-2">
          <p className="text-sm font-semibold text-[#181A18]">Shabbir Creative Visionary</p>
          <p className="text-xs text-[#5A5E58]">Loading portfolio...</p>
        </div>
      </div>
    );
  }

  const activeData = portfolioData || STATIC_PORTFOLIO_FALLBACK;

  // Individual Project Detail Route (/projects/:slug)
  const projectSlug = route.startsWith('/projects/')
    ? decodeURIComponent(route.replace('/projects/', '').split('/')[0])
    : '';
  const matchedProject: Project | undefined = projectSlug
    ? activeData.projects.find((p) => p.slug === projectSlug)
    : undefined;

  return (
    <AnimatePresence mode="wait">
      {matchedProject ? (
        <ProjectDetailView
          key={`project-${matchedProject.slug}`}
          project={matchedProject}
          onBack={() => navigate('/')}
          onInquire={() => {
            navigate('/');
            window.setTimeout(() => {
              document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
            }, 140);
          }}
        />
      ) : (
        <PublicPortfolio
          key="public-home"
          data={activeData}
          onOpenProject={(slug) => navigate(`/projects/${encodeURIComponent(slug)}`)}
          onNavigateAdmin={() => navigate('/admin')}
        />
      )}
    </AnimatePresence>
  );
}
