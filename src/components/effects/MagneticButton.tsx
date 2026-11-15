import { useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import { useReducedMotion } from 'motion/react';

interface MagneticButtonProps {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  target?: string;
  rel?: string;
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'dark';
  accentColor?: string;
  showArrow?: boolean;
  cursorLabel?: string;
  className?: string;
  ariaLabel?: string;
}

export function MagneticButton({
  children,
  onClick,
  href,
  target,
  rel,
  type = 'button',
  disabled = false,
  variant = 'primary',
  accentColor = '#1B5E4A',
  showArrow = true,
  cursorLabel,
  className = '',
  ariaLabel,
}: MagneticButtonProps) {
  const ref = useRef<HTMLElement>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const prefersReducedMotion = useReducedMotion();

  const handleMouseMove = (e: MouseEvent<HTMLElement>) => {
    if (disabled || prefersReducedMotion || !ref.current) return;
    if (typeof window !== 'undefined' && !window.matchMedia('(pointer: fine)').matches) return;
    const rect = ref.current.getBoundingClientRect();
    const dx = e.clientX - (rect.left + rect.width / 2);
    const dy = e.clientY - (rect.top + rect.height / 2);
    const maxPull = 8;
    const nx = Math.max(-maxPull, Math.min(maxPull, dx * 0.22));
    const ny = Math.max(-maxPull, Math.min(maxPull, dy * 0.22));
    setOffset({ x: nx, y: ny });
  };

  const handleMouseLeave = () => {
    setOffset({ x: 0, y: 0 });
  };

  const baseStyle =
    variant === 'primary'
      ? { backgroundColor: accentColor, color: '#FFFFFF', borderColor: accentColor }
      : variant === 'dark'
        ? { backgroundColor: '#181A18', color: '#FFFFFF', borderColor: '#181A18' }
        : { backgroundColor: '#FFFFFF', color: '#181A18', borderColor: '#E0DDD5' };

  const sweepColor = variant === 'secondary' ? '#C6A24B' : '#D6B25E';
  const hoverTextClass =
    variant === 'secondary' ? 'group-hover:text-[#181A18]' : 'group-hover:text-[#181A18]';

  const sharedClasses = `group relative inline-flex items-center justify-center overflow-hidden rounded-lg border px-6 py-3 text-sm font-semibold whitespace-nowrap select-none transition-transform duration-200 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C6A24B] focus-visible:ring-offset-2 focus-visible:ring-offset-[#F7F5F0] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer ${className}`;

  const innerContent = (
    <>
      {/* Champagne-gold clip-path sweep background */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 transition-[clip-path] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] [clip-path:inset(0_100%_0_0)] group-hover:[clip-path:inset(0_0%_0_0)]"
        style={{ backgroundColor: sweepColor }}
      />

      {/* Rolling text label + sliding arrow */}
      <span className={`relative z-10 inline-flex items-center gap-2 transition-colors duration-200 ${hoverTextClass}`}>
        <span className="relative inline-flex flex-col overflow-hidden leading-[1.25] h-[1.25em]">
          <span className="inline-flex items-center transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-y-full">
            {children}
          </span>
          <span
            aria-hidden="true"
            className="inline-flex items-center absolute left-0 top-0 translate-y-full transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-y-0"
          >
            {children}
          </span>
        </span>

        {showArrow && (
          <span className="relative inline-flex items-center justify-center w-4 h-4 overflow-hidden shrink-0">
            <ArrowRight className="w-4 h-4 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-5" />
            <ArrowRight
              aria-hidden="true"
              className="w-4 h-4 absolute -translate-x-5 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-0"
            />
          </span>
        )}
      </span>
    </>
  );

  const transformStyle = {
    ...baseStyle,
    transform: `translate3d(${offset.x.toFixed(2)}px, ${offset.y.toFixed(2)}px, 0px)`,
  };

  if (href) {
    return (
      <a
        ref={ref as React.RefObject<HTMLAnchorElement>}
        href={href}
        target={target}
        rel={rel}
        aria-label={ariaLabel}
        data-cursor={cursorLabel}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={transformStyle}
        className={sharedClasses}
      >
        {innerContent}
      </a>
    );
  }

  return (
    <button
      ref={ref as React.RefObject<HTMLButtonElement>}
      type={type}
      disabled={disabled}
      onClick={onClick}
      aria-label={ariaLabel}
      data-cursor={cursorLabel}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={transformStyle}
      className={sharedClasses}
    >
      {innerContent}
    </button>
  );
}
