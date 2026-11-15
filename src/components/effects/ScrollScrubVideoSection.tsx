import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Film } from 'lucide-react';
import { ResilientImage } from '../ResilientImage';

gsap.registerPlugin(ScrollTrigger);

interface ScrollScrubVideoSectionProps {
  videoUrl: string;
  posterUrl: string;
  title: string;
  subtitle: string;
  ownerName: string;
}

export function ScrollScrubVideoSection({
  videoUrl,
  posterUrl,
  title,
  subtitle,
  ownerName,
}: ScrollScrubVideoSectionProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [progressPct, setProgressPct] = useState(0);
  const [videoReady, setVideoReady] = useState(false);
  const [videoErrored, setVideoErrored] = useState(false);

  const fallbackPoster = posterUrl || '/src/assets/images/studio_workspace_1794638450083.jpg';
  const hasVideo = Boolean(videoUrl && !videoErrored);

  useEffect(() => {
    setVideoReady(false);
    setVideoErrored(false);
  }, [videoUrl]);

  useEffect(() => {
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced || !sectionRef.current || !stageRef.current) return;

    const ctx = gsap.context(() => {
      // Subtle spatial perspective tilt scrubbed by scroll
      gsap.fromTo(
        stageRef.current,
        {
          rotateX: 6,
          scale: 0.96,
        },
        {
          rotateX: -3,
          scale: 1.0,
          ease: 'none',
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top 80%',
            end: 'bottom 20%',
            scrub: 0.5,
            onUpdate: (self) => {
              setProgressPct(Math.round(self.progress * 100));
              const vid = videoRef.current;
              if (vid && vid.readyState >= 1 && Number.isFinite(vid.duration) && vid.duration > 0) {
                const targetTime = self.progress * vid.duration;
                if (Math.abs(vid.currentTime - targetTime) > 0.04) {
                  try {
                    vid.currentTime = targetTime;
                  } catch {
                    // Ignore seeking errors while buffering
                  }
                }
              }
            },
          },
        }
      );
    }, sectionRef);

    return () => {
      ctx.revert();
    };
  }, [hasVideo, videoUrl]);

  return (
    <section
      ref={sectionRef}
      id="reel"
      className="border-t border-[#E0DDD5] bg-[#141615] text-[#F7F5F0] overflow-hidden"
    >
      <div className="max-w-7xl mx-auto px-6 py-20 lg:py-24">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-10">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold tracking-wide text-[#C6A24B] mb-3 inline-flex items-center gap-2">
              <Film className="w-3.5 h-3.5" />
              Scroll-Scrubbed Studio Reel
            </p>
            <h2
              className="text-3xl sm:text-4xl font-bold tracking-tight text-white leading-tight"
              style={{ textWrap: 'balance' }}
            >
              {title || 'Interactive Spatial Reel & Workflow Preview'}
            </h2>
            <p className="text-sm sm:text-base text-white/70 mt-3 leading-relaxed">
              {subtitle ||
                'Scroll smoothly to scrub through the creative frame sequence, motion direction, and workflow deliverables.'}
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono-tabular text-white/75 shrink-0">
            <span>{ownerName}</span>
            <span aria-hidden="true">·</span>
            <span className="text-[#C6A24B]">Scroll Sync {String(progressPct).padStart(2, '0')}%</span>
          </div>
        </div>

        <div style={{ perspective: '1200px' }}>
          <div
            ref={stageRef}
            className="relative rounded-2xl overflow-hidden border border-white/15 bg-[#0C0E0D] aspect-[16/9] max-h-[540px] w-full shadow-2xl"
          >
            {/* Poster Fallback Layer */}
            <ResilientImage
              src={fallbackPoster}
              alt={title || 'Studio reel poster'}
              className={`w-full h-full object-cover transition-opacity duration-500 ${
                hasVideo && videoReady ? 'opacity-0' : 'opacity-90'
              }`}
            />

            {/* Optional Scroll-Scrubbed MP4 Video Layer */}
            {hasVideo && (
              <video
                ref={videoRef}
                src={videoUrl}
                poster={fallbackPoster}
                muted
                playsInline
                preload="auto"
                onLoadedMetadata={() => setVideoReady(true)}
                onError={() => setVideoErrored(true)}
                className="absolute inset-0 w-full h-full object-cover"
              />
            )}

            {/* Editorial Scroll Scrub Timeline HUD */}
            <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6 bg-gradient-to-t from-black/80 via-black/35 to-transparent flex flex-col gap-3">
              <div className="flex items-center justify-between text-[11px] font-mono-tabular text-white/80">
                <span>
                  {hasVideo
                    ? videoReady
                      ? 'GSAP ScrollTrigger MP4 Scrub Active'
                      : 'Buffering Video Frames (Poster Active)'
                    : 'Spatial Poster Sequence · Replaceable via Admin MP4 Upload'}
                </span>
                <span className="text-[#E2C374]">{progressPct}%</span>
              </div>
              <div className="h-1 w-full rounded-full bg-white/20 overflow-hidden">
                <div
                  className="h-full bg-[#C6A24B] transition-[width] duration-75"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
