import { lazy, Suspense, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  Calendar,
  ExternalLink,
  FolderOpen,
  Github,
  Laptop,
  Play,
  Smartphone,
  Wrench,
} from 'lucide-react';
import type { Project } from '../types/portfolio';
import { ResilientImage } from './ResilientImage';
import { MagneticButton } from './effects/MagneticButton';
import { AnimatedSectionTitle } from './effects/TypographyEffects';

const ProjectDeviceMockup3D = lazy(() => import('./three/ProjectDeviceMockup3D'));

interface ProjectDetailViewProps {
  project: Project;
  onBack: () => void;
  onInquire: (category: string) => void;
}

export function ProjectDetailView({ project, onBack, onInquire }: ProjectDetailViewProps) {
  const images = Array.from(
    new Set([project.thumbnail, ...(project.gallery || [])].filter(Boolean))
  );
  const [activeImage, setActiveImage] = useState(images[0] || '');
  const [viewMode, setViewMode] = useState<'3d' | '2d'>('3d');
  const [deviceType, setDeviceType] = useState<'laptop' | 'phone'>(
    project.mockup_type === 'phone' ? 'phone' : 'laptop'
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
      className="min-h-screen bg-[#F7F5F0] text-[#181A18]"
    >
      <header className="sticky top-0 z-30 bg-[#F7F5F0]/95 border-b border-[#E0DDD5]">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-6">
          <button
            type="button"
            onClick={onBack}
            className="var-weight-hover inline-flex items-center gap-2 text-sm font-medium text-[#181A18] hover:text-[#1B5E4A] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Portfolio
          </button>

          <MagneticButton
            onClick={() => onInquire(project.category)}
            className="px-4 py-2 text-xs"
            cursorLabel="Inquire"
          >
            Discuss Similar Project
          </MagneticButton>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12 lg:py-16">
        {/* Clean unboxed editorial metadata */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-[#5A5E58] mb-4">
          <span className="text-[#1B5E4A] font-semibold">{project.category}</span>
          {project.completion_date && (
            <>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {project.completion_date}
              </span>
            </>
          )}
          {project.is_sample && (
            <>
              <span aria-hidden="true">·</span>
              <span>Sample Portfolio Placeholder</span>
            </>
          )}
        </div>

        <AnimatedSectionTitle title={project.title} className="max-w-4xl mb-6" />

        {project.short_description && (
          <p className="text-lg text-[#5A5E58] max-w-3xl leading-relaxed mb-8">
            {project.short_description}
          </p>
        )}

        {/* Primary Media & Interactive 3D Device Showcase */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start mb-14">
          <div className="lg:col-span-8 space-y-4">
            {/* Showcase Mode Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-[#EFECE6] border border-[#E0DDD5]">
                <button
                  type="button"
                  onClick={() => setViewMode('3d')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                    viewMode === '3d' ? 'bg-[#181A18] text-white' : 'text-[#5A5E58] hover:text-[#181A18]'
                  }`}
                >
                  Interactive 3D Mockup
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('2d')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                    viewMode === '2d' ? 'bg-[#181A18] text-white' : 'text-[#5A5E58] hover:text-[#181A18]'
                  }`}
                >
                  Original Full Image
                </button>
              </div>

              {viewMode === '3d' && (
                <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-[#FFFFFF] border border-[#E0DDD5]">
                  <button
                    type="button"
                    onClick={() => setDeviceType('laptop')}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md cursor-pointer ${
                      deviceType === 'laptop' ? 'bg-[#C6A24B] text-[#181A18]' : 'text-[#5A5E58]'
                    }`}
                  >
                    <Laptop className="w-3.5 h-3.5" />
                    Laptop
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeviceType('phone')}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md cursor-pointer ${
                      deviceType === 'phone' ? 'bg-[#C6A24B] text-[#181A18]' : 'text-[#5A5E58]'
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    Phone
                  </button>
                </div>
              )}
            </div>

            {viewMode === '3d' ? (
              <Suspense
                fallback={
                  <div className="aspect-[4/3] w-full rounded-2xl border border-[#E0DDD5] bg-[#EFECE6] flex items-center justify-center text-xs text-[#5A5E58]">
                    Loading 3D Device Showcase...
                  </div>
                }
              >
                <ProjectDeviceMockup3D
                  imageUrl={activeImage}
                  title={project.title}
                  deviceType={deviceType}
                />
              </Suspense>
            ) : (
              <div className="aspect-[4/3] w-full overflow-hidden rounded-2xl border border-[#E0DDD5] bg-[#FFFFFF]">
                <ResilientImage
                  src={activeImage}
                  alt={project.title}
                  lazy={false}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {images.length > 1 && (
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
                {images.map((img, idx) => (
                  <button
                    key={img + idx}
                    type="button"
                    onClick={() => setActiveImage(img)}
                    className={`aspect-[4/3] rounded-lg overflow-hidden border transition-all cursor-pointer ${
                      activeImage === img
                        ? 'border-[#C6A24B] ring-2 ring-[#C6A24B]/30'
                        : 'border-[#E0DDD5] opacity-75 hover:opacity-100'
                    }`}
                  >
                    <ResilientImage
                      src={img}
                      alt={`${project.title} gallery ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}

            {/* Case Study Breakdown: Goal, Approach, Results */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-4">
              <div className="bg-[#FFFFFF] border border-[#E0DDD5] rounded-2xl p-5 space-y-2">
                <p className="text-[11px] font-mono-tabular uppercase tracking-wider text-[#C6A24B]">
                  01 · Project Goal
                </p>
                <p className="text-sm text-[#181A18] leading-relaxed">
                  {project.goal ||
                    'Establish a clear, structured creative and technical deliverable aligned with measurable objectives.'}
                </p>
              </div>
              <div className="bg-[#FFFFFF] border border-[#E0DDD5] rounded-2xl p-5 space-y-2">
                <p className="text-[11px] font-mono-tabular uppercase tracking-wider text-[#1B5E4A]">
                  02 · Strategic Approach
                </p>
                <p className="text-sm text-[#181A18] leading-relaxed">
                  {project.approach ||
                    'Combined modular architecture, editorial hierarchy, and practical automation tooling.'}
                </p>
              </div>
              <div className="bg-[#FFFFFF] border border-[#E0DDD5] rounded-2xl p-5 space-y-2">
                <p className="text-[11px] font-mono-tabular uppercase tracking-wider text-[#181A18]">
                  03 · Key Results
                </p>
                <p className="text-sm text-[#181A18] leading-relaxed">
                  {project.results ||
                    'Delivered a cohesive, responsive outcome ready for stakeholder review and real-world use.'}
                </p>
              </div>
            </div>

            {project.video_url && (
              <div className="pt-4">
                <h2 className="text-sm font-semibold text-[#181A18] mb-3 inline-flex items-center gap-2">
                  <Play className="w-4 h-4 text-[#1B5E4A]" />
                  Video Preview
                </h2>
                <div className="rounded-2xl overflow-hidden border border-[#E0DDD5] bg-[#141615]">
                  <video
                    src={project.video_url}
                    controls
                    preload="metadata"
                    className="w-full max-h-[440px]"
                  />
                </div>
              </div>
            )}
          </div>

          <aside className="lg:col-span-4 bg-[#FFFFFF] border border-[#E0DDD5] rounded-2xl p-6 space-y-6">
            <div>
              <h2 className="text-xs font-semibold text-[#5A5E58] mb-2">Project Overview</h2>
              <p className="text-sm text-[#181A18] leading-relaxed whitespace-pre-line">
                {project.description || project.short_description}
              </p>
            </div>

            {project.tools_used && project.tools_used.length > 0 && (
              <div className="pt-5 border-t border-[#E0DDD5]">
                <h3 className="text-xs font-semibold text-[#5A5E58] mb-3 inline-flex items-center gap-1.5">
                  <Wrench className="w-3.5 h-3.5" />
                  Tools & Technologies
                </h3>
                <p className="text-sm text-[#181A18] font-medium leading-relaxed">
                  {project.tools_used.join(' · ')}
                </p>
              </div>
            )}

            {(project.live_url || project.drive_url || project.github_url) && (
              <div className="pt-5 border-t border-[#E0DDD5] flex flex-col gap-3">
                {project.live_url && (
                  <MagneticButton
                    href={project.live_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full justify-center"
                    cursorLabel="Open"
                  >
                    <ExternalLink className="w-4 h-4 mr-1.5" />
                    View Live Project
                  </MagneticButton>
                )}
                {project.drive_url && (
                  <MagneticButton
                    href={project.drive_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full justify-center"
                    cursorLabel="Open"
                  >
                    <FolderOpen className="w-4 h-4 mr-1.5" />
                    Open Google Drive Folder
                  </MagneticButton>
                )}
                {project.github_url && (
                  <MagneticButton
                    href={project.github_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    variant="secondary"
                    className="w-full justify-center"
                    cursorLabel="Open"
                  >
                    <Github className="w-4 h-4 mr-1.5" />
                    GitHub Repository
                  </MagneticButton>
                )}
              </div>
            )}
          </aside>
        </div>
      </main>
    </motion.div>
  );
}
