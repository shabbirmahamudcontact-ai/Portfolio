import profileShabbir from '../assets/images/profile_shabbir_1794638450090.jpg';
import projectAutomationData from '../assets/images/project_automation_data_1794638451622.jpg';
import projectBrandIdentity from '../assets/images/project_brand_identity_1794638450279.jpg';
import projectVideoProduction from '../assets/images/project_video_production_1794638452308.jpg';
import projectWebPlatform from '../assets/images/project_web_platform_1794638451665.jpg';
import studioWorkspace from '../assets/images/studio_workspace_1794638450083.jpg';

const BUNDLED_IMAGE_MAP: Record<string, string> = {
  '/src/assets/images/profile_shabbir_1794638450090.jpg': profileShabbir,
  '/src/assets/images/project_automation_data_1794638451622.jpg': projectAutomationData,
  '/src/assets/images/project_brand_identity_1794638450279.jpg': projectBrandIdentity,
  '/src/assets/images/project_video_production_1794638452308.jpg': projectVideoProduction,
  '/src/assets/images/project_web_platform_1794638451665.jpg': projectWebPlatform,
  '/src/assets/images/studio_workspace_1794638450083.jpg': studioWorkspace,
};

/**
 * Resolves asset URLs across Vite dev, Express production, and GitHub Pages subpaths.
 * Ensures bundled `src/assets/images/*` paths map to Vite-emitted chunks and root-relative
 * `public/` paths (`/assets/...`) respect the host subpath.
 */
export function resolveAssetUrl(rawUrl?: string | null): string {
  if (!rawUrl) return '';
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';

  if (BUNDLED_IMAGE_MAP[trimmed]) {
    return BUNDLED_IMAGE_MAP[trimmed];
  }

  // External HTTP(S), data URIs, or blob URLs stay untouched
  if (/^(https?:)?\/\//i.test(trimmed) || trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
    return trimmed;
  }

  // Resolve `/assets/...` (public folder) relative to Vite BASE_URL or current repo subpath
  if (trimmed.startsWith('/assets/')) {
    const base = (import.meta.env.BASE_URL || './').trim();
    if (base === './' || base === '.') {
      return `.${trimmed}`;
    }
    const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base;
    return `${cleanBase}${trimmed}`;
  }

  return trimmed;
}
