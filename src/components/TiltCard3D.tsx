import { useRef, useState, type ReactNode, type MouseEvent } from 'react';

interface TiltCard3DProps {
  children: ReactNode;
  className?: string;
  maxTilt?: number;
  cursorLabel?: string;
}

export function TiltCard3D({
  children,
  className = '',
  maxTilt = 5,
  cursorLabel = 'View',
}: TiltCard3DProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState(
    'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1,1,1)'
  );
  const [glare, setGlare] = useState({ x: 50, y: 50, opacity: 0 });

  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (prefersReducedMotion || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const rotateY = (x - 0.5) * (maxTilt * 2);
    const rotateX = (0.5 - y) * (maxTilt * 2);
    setTransform(
      `perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) scale3d(1.015,1.015,1.015)`
    );
    setGlare({ x: x * 100, y: y * 100, opacity: 1 });
  };

  const handleMouseLeave = () => {
    setTransform('perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1,1,1)');
    setGlare((prev) => ({ ...prev, opacity: 0 }));
  };

  return (
    <div
      ref={cardRef}
      data-cursor={cursorLabel}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        transform,
        transition: 'transform 220ms cubic-bezier(0.16, 1, 0.3, 1)',
        willChange: 'transform',
      }}
      className={`relative ${className}`}
    >
      {children}
      {/* Champagne-gold & soft specular glare overlay on hover */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-2xl transition-opacity duration-300"
        style={{
          opacity: glare.opacity,
          background: `radial-gradient(circle 280px at ${glare.x}% ${glare.y}%, rgba(226, 195, 116, 0.22), rgba(255, 255, 255, 0.06) 45%, transparent 72%)`,
        }}
      />
    </div>
  );
}
