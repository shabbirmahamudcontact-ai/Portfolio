export interface WebGLCapabilities {
  webglSupported: boolean;
  isSoftwareRenderer: boolean;
  isMobile: boolean;
  isLowPower: boolean;
  reducedMotion: boolean;
}

let cachedCaps: WebGLCapabilities | null = null;

export function detectWebGLCapabilities(): WebGLCapabilities {
  if (typeof window === 'undefined') {
    return {
      webglSupported: false,
      isSoftwareRenderer: true,
      isMobile: false,
      isLowPower: true,
      reducedMotion: false,
    };
  }

  const reducedMotion = Boolean(
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
  const isMobile = window.innerWidth < 768;

  if (cachedCaps) {
    return {
      ...cachedCaps,
      isMobile,
      reducedMotion,
      isLowPower: cachedCaps.isSoftwareRenderer || isMobile || reducedMotion || (navigator.hardwareConcurrency || 4) <= 2,
    };
  }

  let webglSupported = false;
  let isSoftwareRenderer = false;

  try {
    const canvas = document.createElement('canvas');
    const gl =
      (canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: false }) as WebGL2RenderingContext | null) ||
      (canvas.getContext('webgl', { failIfMajorPerformanceCaveat: false }) as WebGLRenderingContext | null);

    if (gl) {
      webglSupported = true;
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        const renderer = String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '');
        if (/SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(renderer)) {
          isSoftwareRenderer = true;
        }
      }
      const loseCtx = gl.getExtension('WEBGL_lose_context');
      loseCtx?.loseContext();
    }
  } catch {
    webglSupported = false;
  }

  const lowCores = typeof navigator.hardwareConcurrency === 'number' && navigator.hardwareConcurrency <= 2;

  cachedCaps = {
    webglSupported,
    isSoftwareRenderer,
    isMobile,
    isLowPower: isSoftwareRenderer || isMobile || reducedMotion || lowCores,
    reducedMotion,
  };

  return cachedCaps;
}
