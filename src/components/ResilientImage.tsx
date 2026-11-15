import { useEffect, useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import { resolveAssetUrl } from '../lib/assetUrl';

interface ResilientImageProps {
  src?: string;
  alt: string;
  className?: string;
  fallbackLabel?: string;
  lazy?: boolean;
}

export function ResilientImage({
  src,
  alt,
  className = '',
  fallbackLabel,
  lazy = true,
}: ResilientImageProps) {
  const resolvedSrc = resolveAssetUrl(src);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [resolvedSrc]);

  if (!resolvedSrc || hasError) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-[#EFECE6] text-[#5A5E58] border border-[#E0DDD5] ${className}`}
        role="img"
        aria-label={alt}
      >
        <ImageIcon className="w-6 h-6 opacity-40 mb-2" strokeWidth={1.5} />
        <span className="text-xs font-medium tracking-wide px-4 text-center opacity-75">
          {fallbackLabel || alt}
        </span>
      </div>
    );
  }

  return (
    <img
      src={resolvedSrc}
      alt={alt}
      loading={lazy ? 'lazy' : 'eager'}
      referrerPolicy="no-referrer"
      onError={() => setHasError(true)}
      className={className}
    />
  );
}
