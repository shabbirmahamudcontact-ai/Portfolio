import { lazy, Suspense, useEffect, useMemo, useState, type FormEvent } from 'react';
import { motion } from 'motion/react';
import { z } from 'zod';
import {
  ArrowRight,
  ArrowUpRight,
  Award,
  Briefcase,
  CheckCircle2,
  Download,
  ExternalLink,
  FolderOpen,
  Github,
  GraduationCap,
  Mail,
  MapPin,
  Menu,
  MessageCircle,
  Phone,
  Search,
  X,
} from 'lucide-react';
import {
  PORTFOLIO_CATEGORIES,
  type PublicPortfolioData,
  type Project,
} from '../types/portfolio';
import { TiltCard3D } from './TiltCard3D';
import { ResilientImage } from './ResilientImage';
import { CvModal } from './CvModal';
import { PortfolioAssistant } from './PortfolioAssistant';
import { mirrorContactToFirestore } from '../lib/firebase';
import { CustomCursor } from './effects/CustomCursor';
import { MagneticButton } from './effects/MagneticButton';
import {
  AnimatedSectionTitle,
  KineticHeroHeadline,
  ScrollFillOutlineText,
  ScrollWordReveal,
  VelocityMarquee,
} from './effects/TypographyEffects';
import {
  AnimatedCounter,
  OdometerNumber,
  ProgressBar,
  ProgressRing,
} from './effects/NumberEffects';
import { ScrollScrubVideoSection } from './effects/ScrollScrubVideoSection';

const HeroSceneR3F = lazy(() => import('./three/HeroSceneR3F'));

interface PublicPortfolioProps {
  data: PublicPortfolioData;
  onOpenProject: (slug: string) => void;
  onNavigateAdmin: () => void;
}

interface LiveGithubRepo {
  id: number;
  repo_name: string;
  description: string;
  language: string;
  repo_url: string;
  live_url: string;
  updated_at: string;
}

const PROCESS_STEPS = [
  {
    step: '01',
    title: 'Understanding Requirements',
    description:
      'Clarifying objectives, target audience, timeline, and business constraints before any visual or technical work begins.',
  },
  {
    step: '02',
    title: 'Planning and Strategy',
    description:
      'Structuring information architecture, creative direction, workflow logic, and measurable milestones.',
  },
  {
    step: '03',
    title: 'Creative Development',
    description:
      'Executing design, video, web engineering, automation, or data systems with clean craftsmanship and responsive precision.',
  },
  {
    step: '04',
    title: 'Delivery and Improvement',
    description:
      'Testing across devices, refining details based on feedback, documenting workflows, and supporting ongoing growth.',
  },
];

const contactFormSchema = z.object({
  name: z.string().trim().min(2, 'Please enter your full name (at least 2 characters).').max(120),
  email: z.string().trim().email('Please enter a valid email address.').max(180),
  subject: z.string().trim().min(2, 'Please enter a subject (at least 2 characters).').max(160),
  message: z.string().trim().min(5, 'Please share a brief description of your project or inquiry.').max(4000),
});

export function PublicPortfolio({
  data,
  onOpenProject,
  onNavigateAdmin,
}: PublicPortfolioProps) {
  const {
    settings,
    services,
    skills = [],
    stats = [],
    experiences = [],
    certifications = [],
    projects,
    githubProjects,
    testimonials,
    socialLinks,
  } = data;

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedServiceId, setExpandedServiceId] = useState<number | null>(null);
  const [cvModalOpen, setCvModalOpen] = useState(false);

  // Live GitHub API state (fetched only if github_username is configured in Admin)
  const [liveRepos, setLiveRepos] = useState<LiveGithubRepo[]>([]);
  const [githubApiLoading, setGithubApiLoading] = useState(false);

  // Contact Form state (Zod-validated)
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [subject, setSubject] = useState('');
  const [serviceInterest, setServiceInterest] = useState('');
  const [budget, setBudget] = useState('');
  const [message, setMessage] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState('');
  const [submitError, setSubmitError] = useState('');

  const accentColor = settings.accent_color || '#1B5E4A';

  useEffect(() => {
    if (!settings.github_username) {
      setLiveRepos([]);
      return;
    }
    let cancelled = false;
    setGithubApiLoading(true);
    fetch(`/api/github/repos?username=${encodeURIComponent(settings.github_username)}`)
      .then((r) => r.json())
      .then((res) => {
        if (!cancelled && Array.isArray(res.repos)) {
          setLiveRepos(res.repos);
        }
      })
      .catch(() => {
        if (!cancelled) setLiveRepos([]);
      })
      .finally(() => {
        if (!cancelled) setGithubApiLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [settings.github_username]);

  const filteredProjects = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return projects.filter((project) => {
      const matchesCategory = selectedCategory === 'All' || project.category === selectedCategory;
      const matchesQuery =
        !q ||
        project.title.toLowerCase().includes(q) ||
        project.short_description.toLowerCase().includes(q) ||
        project.category.toLowerCase().includes(q) ||
        project.tools_used.some((t) => t.toLowerCase().includes(q));
      return matchesCategory && matchesQuery;
    });
  }, [projects, selectedCategory, searchQuery]);

  const marqueeItems = useMemo(() => {
    const combined = [
      ...services.map((s) => s.title),
      ...skills.map((sk) => sk.name),
    ];
    return Array.from(new Set(combined)).filter(Boolean);
  }, [services, skills]);

  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleServiceInquire = (serviceTitle: string) => {
    setServiceInterest(serviceTitle);
    setSubject(`Inquiry: ${serviceTitle}`);
    scrollToSection('contact');
  };

  const formatPhoneHref = (raw: string) => {
    const digits = raw.replace(/[^\d+]/g, '');
    if (digits.startsWith('0')) return `tel:+880${digits.slice(1)}`;
    if (digits.startsWith('+')) return `tel:${digits}`;
    return `tel:+880${digits}`;
  };

  const formatWhatsappHref = (raw: string) => {
    const digits = raw.replace(/\D/g, '');
    if (digits.startsWith('0')) return `https://wa.me/880${digits.slice(1)}`;
    if (digits.startsWith('880')) return `https://wa.me/${digits}`;
    return `https://wa.me/880${digits}`;
  };

  const handleContactSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    setSubmitSuccess('');

    const effectiveSubject = subject.trim() || serviceInterest.trim();
    const validation = contactFormSchema.safeParse({
      name: fullName,
      email,
      subject: effectiveSubject,
      message,
    });

    if (!validation.success) {
      setSubmitError(validation.error.issues[0]?.message || 'Please review your form entries.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: validation.data.name,
        full_name: validation.data.name,
        email: validation.data.email,
        subject: validation.data.subject,
        phone: phone.trim(),
        service: serviceInterest.trim() || validation.data.subject,
        budget: budget.trim(),
        message: validation.data.message,
        company_website: honeypot,
      };
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json') && (res.status === 404 || res.status === 405)) {
        await mirrorContactToFirestore(payload);
        setSubmitSuccess(
          "Thank you for contacting me! Your inquiry has been recorded. For the quickest response, feel free to also reach out via WhatsApp or email."
        );
        setFullName('');
        setEmail('');
        setPhone('');
        setSubject('');
        setServiceInterest('');
        setBudget('');
        setMessage('');
        return;
      }

      const json = await res.json();
      if (!res.ok) {
        setSubmitError(json.error || 'Unable to send message. Please try again.');
        return;
      }

      // Best-effort Firestore sync after server DB confirmation
      void mirrorContactToFirestore(payload).catch(() => {});

      setSubmitSuccess(
        json.message ||
          "Thank you for contacting me! Your message has been received. I'll get back to you soon."
      );
      setFullName('');
      setEmail('');
      setPhone('');
      setSubject('');
      setServiceInterest('');
      setBudget('');
      setMessage('');
    } catch {
      setSubmitError('Network error while sending your message. Please reach out via WhatsApp or Email.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="min-h-screen bg-[#F7F5F0] text-[#181A18]"
    >
      <CustomCursor />

      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-40 bg-[#F7F5F0]/95 border-b border-[#E0DDD5]">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line Wordmark */}
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="var-weight-hover text-base sm:text-lg font-bold tracking-tight text-[#181A18] whitespace-nowrap shrink-0 flex items-center gap-2.5"
          >
            {settings.logo_url ? (
              <img
                src={settings.logo_url}
                alt={settings.brand_name}
                className="h-7 w-auto object-contain"
              />
            ) : null}
            <span>{settings.logo_text || settings.brand_name}</span>
          </a>

          {/* Zone 2: 5 Single-line Nav Links with Variable Weight Hover */}
          <nav
            className="hidden md:flex items-center gap-7 text-sm font-medium text-[#5A5E58]"
            aria-label="Primary Navigation"
          >
            <button
              type="button"
              onClick={() => scrollToSection('about')}
              className="var-weight-hover hover:text-[#181A18] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              About
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('services')}
              className="var-weight-hover hover:text-[#181A18] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Services
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('skills')}
              className="var-weight-hover hover:text-[#181A18] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Skills
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('portfolio')}
              className="var-weight-hover hover:text-[#181A18] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Portfolio
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('contact')}
              className="var-weight-hover hover:text-[#181A18] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Contact
            </button>
          </nav>

          {/* Zone 3: 1 Primary Magnetic CTA + Mobile Toggle */}
          <div className="flex items-center gap-3 shrink-0">
            <MagneticButton
              onClick={() => scrollToSection('contact')}
              accentColor={accentColor}
              showArrow={false}
              cursorLabel="Hire"
              className="hidden sm:inline-flex px-4 py-2 text-xs"
            >
              Let's Work Together
            </MagneticButton>
            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={mobileMenuOpen}
              className="md:hidden inline-flex items-center justify-center w-11 h-11 rounded-lg border border-[#E0DDD5] bg-[#FFFFFF] text-[#181A18] cursor-pointer"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-[#E0DDD5] bg-[#F7F5F0] px-6 py-4 space-y-2">
            {[
              { label: 'About', id: 'about' },
              { label: 'Services', id: 'services' },
              { label: 'Skills', id: 'skills' },
              { label: 'Portfolio', id: 'portfolio' },
              { label: 'Experience', id: 'experience' },
              { label: 'Contact', id: 'contact' },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => scrollToSection(item.id)}
                className="block w-full text-left py-2.5 text-base font-medium text-[#181A18] border-b border-[#E0DDD5]/60 last:border-b-0 cursor-pointer"
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
      </header>

      <main id="top">
        {/* HERO SECTION */}
        <section className="max-w-7xl mx-auto px-6 pt-10 pb-14 lg:pt-16 lg:pb-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
            <div className="lg:col-span-6 flex flex-col justify-center py-4">
              <p className="text-xs font-semibold tracking-wide text-[#5A5E58] mb-4">
                {settings.owner_name} · {settings.brand_name}
              </p>

              <KineticHeroHeadline
                text={settings.hero_headline}
                className="text-4xl sm:text-5xl xl:text-[3.5rem] font-bold tracking-tight text-[#181A18] leading-[1.08] mb-6"
              />

              <p className="text-base sm:text-lg text-[#5A5E58] leading-relaxed max-w-xl mb-8">
                {settings.hero_description}
              </p>

              <div className="flex flex-wrap items-center gap-4">
                <MagneticButton
                  onClick={() => scrollToSection('portfolio')}
                  accentColor={accentColor}
                  cursorLabel="View"
                >
                  Explore My Work
                </MagneticButton>
                <MagneticButton
                  onClick={() => scrollToSection('contact')}
                  variant="secondary"
                  showArrow={false}
                  cursorLabel="Open"
                >
                  Let's Work Together
                </MagneticButton>
              </div>

              <p className="text-xs text-[#5A5E58] mt-8 pt-6 border-t border-[#E0DDD5] max-w-md font-editorial italic text-sm">
                "{settings.tagline}"
              </p>
            </div>

            {/* Right Interactive React Three Fiber 3D Studio Viewport */}
            <div className="lg:col-span-6 min-h-[400px] lg:min-h-[540px] rounded-2xl border border-[#C6A24B]/30 bg-[#111412] overflow-hidden relative shadow-sm">
              <Suspense
                fallback={
                  <div className="w-full h-full flex items-center justify-center p-8 text-xs font-mono-tabular text-[#D7D2C6]">
                    Initializing 3D Studio Scene...
                  </div>
                }
              >
                <HeroSceneR3F
                  name3D={settings.hero_3d_name || 'Shabbir Mahamud'}
                  accentColor={accentColor}
                  ownerName={settings.owner_name}
                />
              </Suspense>
            </div>
          </div>

          {/* Full-width 4-Column Discipline Strip below Hero Split */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-12 pt-8 border-t border-[#E0DDD5]">
            {[
              {
                index: '01.',
                title: 'Visual & Video Craft',
                detail: 'Brand graphics, promotional visuals, and structured video editing.',
              },
              {
                index: '02.',
                title: 'Web Architecture',
                detail: 'Responsive portfolios, business sites, and full-stack web builds.',
              },
              {
                index: '03.',
                title: 'AI & Data Systems',
                detail: 'n8n workflow automation, messaging bots, and reporting sheets.',
              },
              {
                index: '04.',
                title: 'SEO & Digital Growth',
                detail: 'Social strategy, keyword planning, analytics, and practical training.',
              },
            ].map((item) => (
              <div key={item.index} className="space-y-1.5">
                <p className="text-xs font-mono-tabular text-[#C6A24B] font-semibold">{item.index}</p>
                <h2 className="var-weight-hover text-sm font-semibold text-[#181A18]">{item.title}</h2>
                <p className="text-xs text-[#5A5E58] leading-relaxed">{item.detail}</p>
              </div>
            ))}
          </div>
        </section>

        {/* SCROLL-VELOCITY MARQUEE OF SERVICES & SKILLS */}
        <VelocityMarquee items={marqueeItems} />

        {/* LARGE OUTLINED STATEMENT THAT FILLS ON SCROLL */}
        <section className="bg-[#F7F5F0] border-b border-[#E0DDD5]">
          <div className="max-w-7xl mx-auto px-6 py-12 lg:py-16">
            <ScrollFillOutlineText
              text={settings.outlined_statement || 'SOCIAL STRATEGY · ANALYTICS · APPLIED AI'}
            />
          </div>
        </section>

        {/* ABOUT ME & EDUCATION SECTION */}
        <section id="about" className="bg-[#FFFFFF]">
          <div className="max-w-7xl mx-auto px-6 py-20 lg:py-24">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-stretch">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.5 }}
                className="lg:col-span-5"
              >
                <div className="aspect-[3/4] lg:h-full max-h-[580px] w-full overflow-hidden rounded-2xl border border-[#E0DDD5] bg-[#EFECE6]">
                  <ResilientImage
                    src={settings.profile_photo}
                    alt={`${settings.owner_name} portrait`}
                    className="w-full h-full object-cover object-top"
                  />
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.5, delay: 0.08 }}
                className="lg:col-span-7 flex flex-col justify-between space-y-8"
              >
                <div>
                  <AnimatedSectionTitle
                    eyebrow="About Me"
                    title={'Bridging creativity, practical\ntechnology, and business clarity.'}
                    className="mb-6"
                  />
                  <ScrollWordReveal
                    text={settings.about_bio}
                    className="text-[15px] leading-[1.75]"
                  />
                </div>

                {/* Education Block (Verified Ongoing / Final Year Status) */}
                <div className="p-6 rounded-2xl bg-[#F7F5F0] border border-[#E0DDD5]">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-[#FFFFFF] border border-[#E0DDD5] flex items-center justify-center shrink-0 text-[#1B5E4A]">
                      <GraduationCap className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-[#5A5E58]">
                        Education · {settings.education_status}
                      </p>
                      <h3 className="text-lg font-bold text-[#181A18] mt-0.5">
                        {settings.education_degree}
                      </h3>
                      <p className="text-sm font-medium text-[#1B5E4A] mt-0.5">
                        {settings.education_institution}
                      </p>
                      {settings.education_details && (
                        <p className="text-sm text-[#5A5E58] mt-2 leading-relaxed">
                          {settings.education_details}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* CV Download & Active Social Links */}
                <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-[#E0DDD5]">
                  <MagneticButton
                    onClick={() => setCvModalOpen(true)}
                    variant="dark"
                    showArrow={false}
                    cursorLabel="Open"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download / View CV
                  </MagneticButton>

                  {socialLinks.length > 0 && (
                    <div className="flex flex-wrap items-center gap-4 text-sm font-medium text-[#5A5E58]">
                      {socialLinks.map((link) => (
                        <a
                          key={link.id}
                          href={link.profile_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="var-weight-hover inline-flex items-center gap-1 hover:text-[#181A18] transition-colors"
                        >
                          {link.platform}
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* STATS SECTION (DB-driven Odometer & Eased Counters) */}
        {stats.length > 0 && (
          <section id="stats" className="border-t border-[#E0DDD5] bg-[#141615] text-[#F7F5F0]">
            <div className="max-w-7xl mx-auto px-6 py-16 lg:py-20">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                {stats.map((stat, idx) => (
                  <motion.div
                    key={stat.id}
                    initial={{ opacity: 0, y: 18 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.3 }}
                    transition={{ duration: 0.45, delay: idx * 0.09, ease: [0.16, 1, 0.3, 1] }}
                    className="border-t border-[#C6A24B]/50 pt-5 space-y-2"
                  >
                    <div className="text-4xl sm:text-5xl font-display font-extrabold tracking-tight text-white">
                      {stat.use_odometer && Number.isInteger(stat.number_value) ? (
                        <OdometerNumber value={stat.number_value} suffix={stat.suffix} />
                      ) : (
                        <AnimatedCounter value={stat.number_value} suffix={stat.suffix} />
                      )}
                    </div>
                    <h3 className="text-sm font-semibold text-white">{stat.label}</h3>
                    {stat.detail && (
                      <p className="text-xs text-white/65 leading-relaxed">{stat.detail}</p>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* SERVICES SECTION (DB-backed Multidisciplinary Services) */}
        <section id="services" className="border-t border-[#E0DDD5] bg-[#F7F5F0]">
          <div className="max-w-7xl mx-auto px-6 py-20 lg:py-24">
            <AnimatedSectionTitle
              eyebrow="Services & Capabilities"
              title={'Multidisciplinary practices built\naround real business outcomes.'}
              className="max-w-2xl mb-14"
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {services.map((service, idx) => {
                const isExpanded = expandedServiceId === service.id;
                const num = String(idx + 1).padStart(2, '0');
                return (
                  <motion.article
                    key={service.id}
                    initial={{ opacity: 0, y: 14 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.1 }}
                    transition={{ duration: 0.4, delay: (idx % 2) * 0.06 }}
                    className="bg-[#FFFFFF] border border-[#E0DDD5] rounded-2xl p-6 sm:p-7 flex flex-col justify-between transition-colors hover:border-[#C6A24B]"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-4 mb-4">
                        <span className="text-xs font-mono-tabular text-[#5A5E58]">
                          {num}. {service.category}
                        </span>
                      </div>

                      <h3 className="var-weight-hover text-xl font-bold text-[#181A18] mb-3">
                        {service.title}
                      </h3>
                      <p className="text-sm text-[#5A5E58] leading-relaxed mb-5">
                        {service.description}
                      </p>

                      {service.details && service.details.length > 0 && (
                        <div className="mb-6">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-[#181A18]">
                            {(isExpanded ? service.details : service.details.slice(0, 6)).map(
                              (detail) => (
                                <p key={detail} className="py-1 border-b border-[#EFECE6]">
                                  {detail}
                                </p>
                              )
                            )}
                          </div>
                          {service.details.length > 6 && (
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedServiceId(isExpanded ? null : service.id)
                              }
                              className="mt-2.5 text-xs font-semibold text-[#1B5E4A] hover:underline cursor-pointer"
                            >
                              {isExpanded
                                ? 'Show fewer deliverables'
                                : `+ ${service.details.length - 6} more capabilities`}
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="pt-4 border-t border-[#E0DDD5] flex items-center justify-between gap-4">
                      <button
                        type="button"
                        onClick={() => handleServiceInquire(service.title)}
                        data-cursor="Open"
                        className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1B5E4A] hover:text-[#144738] transition-colors cursor-pointer"
                      >
                        {service.cta_label || 'Discuss This Service'}
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.article>
                );
              })}
            </div>
          </div>
        </section>

        {/* SKILLS & CAPABILITY RINGS SECTION */}
        {skills.length > 0 && (
          <section id="skills" className="border-t border-[#E0DDD5] bg-[#FFFFFF]">
            <div className="max-w-7xl mx-auto px-6 py-20 lg:py-24">
              <AnimatedSectionTitle
                eyebrow="Core Proficiencies"
                title={'Measurable capability across strategy,\nproduction, analytics, and automation.'}
                className="max-w-2xl mb-14"
              />

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {skills.map((skill, idx) => (
                  <motion.div
                    key={skill.id}
                    initial={{ opacity: 0, y: 14 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.2 }}
                    transition={{ duration: 0.4, delay: (idx % 3) * 0.06 }}
                    className="bg-[#F7F5F0] border border-[#E0DDD5] rounded-2xl p-6 space-y-4"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        {skill.category && (
                          <p className="text-[11px] font-mono-tabular uppercase tracking-wider text-[#1B5E4A]">
                            {skill.category}
                          </p>
                        )}
                        <h3 className="text-base font-bold text-[#181A18] mt-0.5">{skill.name}</h3>
                        {skill.metric_label && (
                          <p className="text-xs text-[#5A5E58] mt-0.5">{skill.metric_label}</p>
                        )}
                      </div>
                      <ProgressRing percentage={skill.proficiency} accentColor="#C6A24B" />
                    </div>
                    <ProgressBar percentage={skill.proficiency} />
                  </motion.div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* SCROLL-SCRUBBED 3D VIDEO SECTION (GSAP ScrollTrigger) */}
        <ScrollScrubVideoSection
          videoUrl={settings.scrub_video_url}
          posterUrl={settings.scrub_video_poster}
          title={settings.scrub_video_title}
          subtitle={settings.scrub_video_subtitle}
          ownerName={settings.owner_name}
        />

        {/* WORKING PROCESS & OPTIONAL EXPERIENCE TIMELINE */}
        <section id="experience" className="border-t border-[#E0DDD5] bg-[#F7F5F0]">
          <div className="max-w-7xl mx-auto px-6 py-20 lg:py-24">
            {experiences.length > 0 && (
              <>
                <AnimatedSectionTitle
                  eyebrow="Experience Timeline"
                  title={'Selected roles and practical\ncollaboration milestones.'}
                  className="max-w-2xl mb-14"
                />
                <div className="space-y-6 mb-16">
                  {experiences.map((exp, idx) => (
                    <motion.div
                      key={exp.id}
                      initial={{ opacity: 0, y: 14 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, amount: 0.2 }}
                      transition={{ duration: 0.45, delay: idx * 0.08 }}
                      className="bg-[#FFFFFF] border border-[#E0DDD5] rounded-2xl p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
                    >
                      <div className="lg:col-span-4 space-y-1">
                        <p className="text-xs font-mono-tabular text-[#C6A24B] font-semibold inline-flex items-center gap-1.5">
                          <Briefcase className="w-3.5 h-3.5" />
                          {exp.period || 'Ongoing'}
                        </p>
                        <h3 className="text-lg font-bold text-[#181A18]">{exp.role_title}</h3>
                        <p className="text-sm font-medium text-[#1B5E4A]">{exp.organization}</p>
                        {exp.location && (
                          <p className="text-xs text-[#5A5E58]">{exp.location}</p>
                        )}
                      </div>

                      <div className="lg:col-span-8 space-y-3">
                        {exp.description && (
                          <p className="text-sm text-[#5A5E58] leading-relaxed">{exp.description}</p>
                        )}
                        {exp.highlights && exp.highlights.length > 0 && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 pt-2 border-t border-[#EFECE6]">
                            {exp.highlights.map((item) => (
                              <p key={item} className="text-xs text-[#181A18] py-1">
                                · {item}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </>
            )}

            <AnimatedSectionTitle
              eyebrow="Working Process"
              title={'Structured delivery from clear\ndiscovery to measurable launch.'}
              className="max-w-2xl mb-12"
            />

            {/* Working Process 4-Step Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 relative">
              {PROCESS_STEPS.map((item, idx) => (
                <motion.div
                  key={item.step}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.45, delay: idx * 0.08 }}
                  className="relative pt-5 border-t-2 border-[#181A18]"
                >
                  <span className="text-xs font-mono-tabular font-semibold text-[#1B5E4A]">
                    Step {item.step}
                  </span>
                  <h3 className="text-lg font-bold text-[#181A18] mt-2 mb-2">{item.title}</h3>
                  <p className="text-sm text-[#5A5E58] leading-relaxed">{item.description}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* PORTFOLIO / MY WORK SECTION */}
        <section id="portfolio" className="border-t border-[#E0DDD5] bg-[#FFFFFF]">
          <div className="max-w-7xl mx-auto px-6 py-20 lg:py-24">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-10">
              <AnimatedSectionTitle
                eyebrow="Selected Portfolio"
                title={'Structured work across design,\nmotion, web, and automation.'}
                className="max-w-2xl"
              />

              {/* Search Bar */}
              <div className="relative w-full lg:w-72">
                <Search className="w-4 h-4 text-[#5A5E58] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search projects or tools..."
                  aria-label="Search portfolio projects"
                  className="w-full pl-10 pr-4 py-2.5 text-sm bg-[#F7F5F0] border border-[#E0DDD5] rounded-lg focus:outline-none focus:border-[#1B5E4A]"
                />
              </div>
            </div>

            {/* Category Filter Buttons */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-3 mb-10">
              {['All', ...PORTFOLIO_CATEGORIES].map((category) => {
                const active = selectedCategory === category;
                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setSelectedCategory(category)}
                    className={`px-3.5 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      active
                        ? 'bg-[#181A18] text-white'
                        : 'bg-[#F7F5F0] text-[#5A5E58] hover:text-[#181A18] hover:bg-[#EFECE6]'
                    }`}
                  >
                    {category}
                  </button>
                );
              })}
            </div>

            {/* Project Gallery Grid */}
            {filteredProjects.length === 0 ? (
              <div className="rounded-2xl border border-[#E0DDD5] bg-[#F7F5F0] p-12 text-center">
                <p className="text-base font-semibold text-[#181A18]">No matching projects found</p>
                <p className="text-sm text-[#5A5E58] mt-1">
                  Try clearing the search query or selecting a different category filter.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategory('All');
                    setSearchQuery('');
                  }}
                  className="mt-4 px-4 py-2 text-xs font-semibold text-white bg-[#1B5E4A] rounded-lg cursor-pointer"
                >
                  Reset Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {filteredProjects.map((project: Project, idx: number) => (
                  <motion.div
                    key={project.id}
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.12 }}
                    transition={{ duration: 0.45, delay: (idx % 2) * 0.06 }}
                  >
                    <TiltCard3D className="h-full" cursorLabel="View">
                      <article
                        onClick={() => onOpenProject(project.slug)}
                        className="group h-full bg-[#F7F5F0] border border-[#E0DDD5] rounded-2xl overflow-hidden flex flex-col cursor-pointer transition-colors hover:border-[#C6A24B]"
                      >
                        <div className="aspect-[4/3] w-full overflow-hidden bg-[#EFECE6]">
                          <ResilientImage
                            src={project.thumbnail}
                            alt={project.title}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                          />
                        </div>

                        <div className="p-6 flex-1 flex flex-col justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-[#5A5E58] mb-2">
                              <span className="font-semibold text-[#1B5E4A]">{project.category}</span>
                              {project.completion_date && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span>{project.completion_date}</span>
                                </>
                              )}
                              {project.is_sample && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span>Sample Placeholder</span>
                                </>
                              )}
                            </div>

                            <h3 className="var-weight-hover text-xl font-bold text-[#181A18] group-hover:text-[#1B5E4A] transition-colors mb-2">
                              {project.title}
                            </h3>

                            <p className="text-sm text-[#5A5E58] leading-relaxed mb-4">
                              {project.short_description}
                            </p>
                          </div>

                          <div className="pt-4 border-t border-[#E0DDD5] flex items-center justify-between gap-4">
                            <span className="text-xs text-[#5A5E58] truncate">
                              {project.tools_used.join(' · ')}
                            </span>
                            <div className="flex items-center gap-3 shrink-0">
                              {project.drive_url && (
                                <a
                                  href={project.drive_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#1B5E4A] hover:underline whitespace-nowrap"
                                >
                                  <FolderOpen className="w-3.5 h-3.5" />
                                  Google Drive
                                </a>
                              )}
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#181A18] whitespace-nowrap">
                                View Details
                                <ArrowUpRight className="w-3.5 h-3.5" />
                              </span>
                            </div>
                          </div>
                        </div>
                      </article>
                    </TiltCard3D>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* CERTIFICATIONS SECTION (Shown only when verified certifications are published in Admin) */}
        {certifications.length > 0 && (
          <section id="certifications" className="border-t border-[#E0DDD5] bg-[#F7F5F0]">
            <div className="max-w-7xl mx-auto px-6 py-20 lg:py-24">
              <AnimatedSectionTitle
                eyebrow="Credentials & Verification"
                title={'Verified certifications and\nstructured learning records.'}
                className="max-w-2xl mb-12"
              />

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {certifications.map((cert) => (
                  <article
                    key={cert.id}
                    className="bg-[#FFFFFF] border border-[#E0DDD5] rounded-2xl p-6 flex flex-col justify-between space-y-4"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 text-xs text-[#5A5E58] mb-2">
                        <span className="font-semibold text-[#1B5E4A] inline-flex items-center gap-1.5">
                          <Award className="w-3.5 h-3.5 text-[#C6A24B]" />
                          {cert.issuer}
                        </span>
                        {cert.issue_date && (
                          <span className="font-mono-tabular">{cert.issue_date}</span>
                        )}
                      </div>
                      <h3 className="text-lg font-bold text-[#181A18] mb-2">{cert.title}</h3>
                      {cert.description && (
                        <p className="text-sm text-[#5A5E58] leading-relaxed">{cert.description}</p>
                      )}
                    </div>

                    {(cert.credential_id || cert.credential_url) && (
                      <div className="pt-4 border-t border-[#E0DDD5] flex items-center justify-between gap-3 text-xs">
                        {cert.credential_id && (
                          <span className="font-mono-tabular text-[#5A5E58] truncate">
                            ID: {cert.credential_id}
                          </span>
                        )}
                        {cert.credential_url && (
                          <a
                            href={cert.credential_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-semibold text-[#1B5E4A] hover:underline shrink-0"
                          >
                            Verify
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* DEVELOPMENT & OPEN SOURCE (GITHUB) SECTION */}
        <section id="open-source" className="border-t border-[#E0DDD5] bg-[#FFFFFF]">
          <div className="max-w-7xl mx-auto px-6 py-20 lg:py-24">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
              <AnimatedSectionTitle
                eyebrow="Development & Open Source"
                title={'Source code, documentation,\nand version-controlled builds.'}
                className="max-w-2xl"
              />

              {settings.github_profile_url && (
                <MagneticButton
                  href={settings.github_profile_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="secondary"
                  showArrow={false}
                  cursorLabel="Open"
                >
                  <Github className="w-4 h-4 mr-2" />
                  Visit GitHub Profile
                </MagneticButton>
              )}
            </div>

            {githubProjects.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {githubProjects.map((repo) => (
                  <article
                    key={repo.id}
                    className="bg-[#F7F5F0] border border-[#E0DDD5] rounded-2xl overflow-hidden flex flex-col justify-between"
                  >
                    {repo.preview_image && (
                      <div className="aspect-[16/9] w-full overflow-hidden border-b border-[#E0DDD5]">
                        <ResilientImage
                          src={repo.preview_image}
                          alt={repo.repo_name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div className="p-6 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between gap-2 text-xs text-[#5A5E58] mb-2">
                          <span className="font-mono-tabular">
                            {repo.language || 'Repository'}
                          </span>
                          {repo.is_featured && (
                            <span className="text-[#1B5E4A] font-medium">Featured</span>
                          )}
                        </div>
                        <h3 className="text-lg font-bold text-[#181A18] mb-2">
                          {repo.repo_name}
                        </h3>
                        <p className="text-sm text-[#5A5E58] leading-relaxed mb-5">
                          {repo.description}
                        </p>
                      </div>

                      <div className="pt-4 border-t border-[#E0DDD5] flex flex-wrap items-center gap-4 text-xs font-semibold">
                        {repo.repo_url && (
                          <a
                            href={repo.repo_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[#181A18] hover:text-[#1B5E4A]"
                          >
                            <Github className="w-3.5 h-3.5" />
                            Repository
                          </a>
                        )}
                        {repo.live_url && (
                          <a
                            href={repo.live_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[#1B5E4A] hover:underline"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            Live Demo
                          </a>
                        )}
                        {repo.docs_url && (
                          <a
                            href={repo.docs_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[#5A5E58] hover:text-[#181A18]"
                          >
                            Docs
                          </a>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : githubApiLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[1, 2, 3].map((n) => (
                  <div
                    key={n}
                    className="h-44 rounded-2xl border border-[#E0DDD5] bg-[#F7F5F0] animate-pulse"
                  />
                ))}
              </div>
            ) : liveRepos.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {liveRepos.map((repo) => (
                  <article
                    key={repo.id}
                    className="bg-[#F7F5F0] border border-[#E0DDD5] rounded-2xl p-6 flex flex-col justify-between"
                  >
                    <div>
                      <p className="text-xs font-mono-tabular text-[#5A5E58] mb-2">
                        {repo.language || 'Public Repository'}
                      </p>
                      <h3 className="text-lg font-bold text-[#181A18] mb-2">{repo.repo_name}</h3>
                      <p className="text-sm text-[#5A5E58] leading-relaxed mb-5">
                        {repo.description || 'Public GitHub repository.'}
                      </p>
                    </div>
                    <div className="pt-4 border-t border-[#E0DDD5] flex items-center gap-4 text-xs font-semibold">
                      <a
                        href={repo.repo_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[#181A18] hover:text-[#1B5E4A]"
                      >
                        <Github className="w-3.5 h-3.5" />
                        View Source
                      </a>
                      {repo.live_url && (
                        <a
                          href={repo.live_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[#1B5E4A] hover:underline"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          Live URL
                        </a>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-[#E0DDD5] bg-[#F7F5F0] p-8 sm:p-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                <div className="space-y-1.5 max-w-xl">
                  <h3 className="text-base font-bold text-[#181A18]">
                    GitHub Showcase Ready for Connection
                  </h3>
                  <p className="text-sm text-[#5A5E58] leading-relaxed">
                    Repositories and live development deployments are published here once linked in
                    the studio settings or synced via the public GitHub API.
                  </p>
                </div>
                <MagneticButton
                  onClick={() => scrollToSection('contact')}
                  variant="secondary"
                  showArrow={false}
                  className="px-4 py-2.5 text-xs"
                >
                  Request Code Samples
                </MagneticButton>
              </div>
            )}
          </div>
        </section>

        {/* TESTIMONIALS SECTION */}
        <section className="border-t border-[#E0DDD5] bg-[#F7F5F0]">
          <div className="max-w-7xl mx-auto px-6 py-20 lg:py-24">
            <AnimatedSectionTitle
              eyebrow="Client Feedback"
              title={'Verified perspectives from\ncollaborators and clients.'}
              className="max-w-2xl mb-12"
            />

            {testimonials.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {testimonials.map((t) => (
                  <blockquote
                    key={t.id}
                    className="bg-[#FFFFFF] border border-[#E0DDD5] rounded-2xl p-6 flex flex-col justify-between space-y-6"
                  >
                    <p className="text-sm text-[#181A18] leading-relaxed">"{t.review}"</p>
                    <div className="flex items-center gap-3 pt-4 border-t border-[#E0DDD5]">
                      {t.customer_image && (
                        <ResilientImage
                          src={t.customer_image}
                          alt={t.customer_name}
                          className="w-10 h-10 rounded-full object-cover border border-[#E0DDD5]"
                        />
                      )}
                      <div>
                        <p className="text-sm font-semibold text-[#181A18]">{t.customer_name}</p>
                        {t.customer_role && (
                          <p className="text-xs text-[#5A5E58]">{t.customer_role}</p>
                        )}
                      </div>
                    </div>
                  </blockquote>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-[#E0DDD5] bg-[#FFFFFF] p-8 text-sm text-[#5A5E58]">
                Verified client testimonials are published here directly upon project completion.
              </div>
            )}
          </div>
        </section>

        {/* GET IN TOUCH SECTION */}
        <section id="contact" className="border-t border-[#E0DDD5] bg-[#FFFFFF]">
          <div className="max-w-7xl mx-auto px-6 py-20 lg:py-24">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
              {/* Left Contact Info & Direct Channels */}
              <div className="lg:col-span-5 space-y-8">
                <AnimatedSectionTitle
                  eyebrow="Get in Touch"
                  title={"Let's discuss your project\nor collaboration."}
                  subtitle={
                    <p className="text-sm text-[#5A5E58] leading-relaxed">
                      Reach out directly via phone, WhatsApp, or email, or submit your project
                      brief using the form.
                    </p>
                  }
                />

                <div className="space-y-4 text-sm">
                  <div className="flex items-start gap-3">
                    <Phone className="w-4 h-4 text-[#1B5E4A] mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-[#5A5E58]">Phone & WhatsApp</p>
                      <p className="font-semibold text-[#181A18] tabular-nums">{settings.phone}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Mail className="w-4 h-4 text-[#1B5E4A] mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-[#5A5E58]">Email</p>
                      <p className="font-semibold text-[#181A18]">{settings.email}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <MapPin className="w-4 h-4 text-[#1B5E4A] mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-[#5A5E58]">Location</p>
                      <p className="font-medium text-[#181A18] leading-relaxed">
                        {settings.address}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Functional Action Buttons */}
                <div className="flex flex-wrap gap-3 pt-2">
                  <MagneticButton
                    href={formatPhoneHref(settings.phone)}
                    variant="secondary"
                    showArrow={false}
                    className="px-4 py-2.5 text-xs"
                  >
                    <Phone className="w-3.5 h-3.5 mr-1.5" />
                    Call Now
                  </MagneticButton>
                  <MagneticButton
                    href={formatWhatsappHref(settings.whatsapp)}
                    target="_blank"
                    rel="noopener noreferrer"
                    accentColor={accentColor}
                    showArrow={false}
                    className="px-4 py-2.5 text-xs"
                  >
                    <MessageCircle className="w-3.5 h-3.5 mr-1.5" />
                    Chat on WhatsApp
                  </MagneticButton>
                  <MagneticButton
                    href={`mailto:${settings.email}`}
                    variant="secondary"
                    showArrow={false}
                    className="px-4 py-2.5 text-xs"
                  >
                    <Mail className="w-3.5 h-3.5 mr-1.5" />
                    Send Email
                  </MagneticButton>
                </div>
              </div>

              {/* Right Zod-Validated Contact Form */}
              <div className="lg:col-span-7 bg-[#F7F5F0] border border-[#E0DDD5] rounded-2xl p-6 sm:p-8">
                <form onSubmit={handleContactSubmit} className="space-y-5" noValidate>
                  {/* Honeypot anti-spam field */}
                  <input
                    type="text"
                    name="company_website"
                    value={honeypot}
                    onChange={(e) => setHoneypot(e.target.value)}
                    tabIndex={-1}
                    autoComplete="off"
                    className="hidden"
                    aria-hidden="true"
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label htmlFor="contact-name" className="block text-xs font-semibold text-[#181A18] mb-1.5">
                        Full Name *
                      </label>
                      <input
                        id="contact-name"
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Your full name"
                        className="w-full px-3.5 py-2.5 text-sm bg-[#FFFFFF] border border-[#E0DDD5] rounded-lg focus:outline-none focus:border-[#1B5E4A]"
                      />
                    </div>
                    <div>
                      <label htmlFor="contact-email" className="block text-xs font-semibold text-[#181A18] mb-1.5">
                        Email Address *
                      </label>
                      <input
                        id="contact-email"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="w-full px-3.5 py-2.5 text-sm bg-[#FFFFFF] border border-[#E0DDD5] rounded-lg focus:outline-none focus:border-[#1B5E4A]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label htmlFor="contact-subject" className="block text-xs font-semibold text-[#181A18] mb-1.5">
                        Subject *
                      </label>
                      <input
                        id="contact-subject"
                        type="text"
                        required
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        placeholder="Project inquiry, strategy, or training"
                        className="w-full px-3.5 py-2.5 text-sm bg-[#FFFFFF] border border-[#E0DDD5] rounded-lg focus:outline-none focus:border-[#1B5E4A]"
                      />
                    </div>
                    <div>
                      <label htmlFor="contact-service" className="block text-xs font-semibold text-[#181A18] mb-1.5">
                        Service Interested In
                      </label>
                      <select
                        id="contact-service"
                        value={serviceInterest}
                        onChange={(e) => {
                          setServiceInterest(e.target.value);
                          if (!subject.trim() && e.target.value) {
                            setSubject(`Inquiry: ${e.target.value}`);
                          }
                        }}
                        className="w-full px-3.5 py-2.5 text-sm bg-[#FFFFFF] border border-[#E0DDD5] rounded-lg focus:outline-none focus:border-[#1B5E4A]"
                      >
                        <option value="">Select a service</option>
                        {services.map((s) => (
                          <option key={s.id} value={s.title}>
                            {s.title}
                          </option>
                        ))}
                        <option value="General Inquiry">General Inquiry</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label htmlFor="contact-phone" className="block text-xs font-semibold text-[#181A18] mb-1.5">
                        Phone Number (Optional)
                      </label>
                      <input
                        id="contact-phone"
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+880..."
                        className="w-full px-3.5 py-2.5 text-sm bg-[#FFFFFF] border border-[#E0DDD5] rounded-lg focus:outline-none focus:border-[#1B5E4A]"
                      />
                    </div>
                    <div>
                      <label htmlFor="contact-budget" className="block text-xs font-semibold text-[#181A18] mb-1.5">
                        Project Budget (Optional)
                      </label>
                      <input
                        id="contact-budget"
                        type="text"
                        value={budget}
                        onChange={(e) => setBudget(e.target.value)}
                        placeholder="e.g. $300 - $800 or BDT estimate"
                        className="w-full px-3.5 py-2.5 text-sm bg-[#FFFFFF] border border-[#E0DDD5] rounded-lg focus:outline-none focus:border-[#1B5E4A]"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="contact-message" className="block text-xs font-semibold text-[#181A18] mb-1.5">
                      Project Details / Message *
                    </label>
                    <textarea
                      id="contact-message"
                      required
                      rows={4}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Tell me about your goals, timeline, and what you would like to build..."
                      className="w-full px-3.5 py-2.5 text-sm bg-[#FFFFFF] border border-[#E0DDD5] rounded-lg focus:outline-none focus:border-[#1B5E4A]"
                    />
                  </div>

                  {submitError && (
                    <div
                      role="alert"
                      className="p-3.5 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-xs font-medium text-[#991B1B]"
                    >
                      {submitError}
                    </div>
                  )}

                  {submitSuccess && (
                    <div
                      role="status"
                      className="p-4 rounded-lg bg-[#ECFDF5] border border-[#A7F3D0] text-sm font-medium text-[#065F46] flex items-start gap-2.5"
                    >
                      <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                      <span>{submitSuccess}</span>
                    </div>
                  )}

                  <MagneticButton
                    type="submit"
                    disabled={submitting}
                    accentColor={accentColor}
                    className="w-full sm:w-auto"
                    cursorLabel="Send"
                  >
                    {submitting ? 'Sending Message...' : 'Send Message'}
                  </MagneticButton>
                </form>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* MINIMAL EDITORIAL FOOTER + SUBTLE CORNER ADMIN LINK */}
      <footer className="border-t border-[#E0DDD5] bg-[#EFECE6]">
        <div className="max-w-7xl mx-auto px-6 py-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <p className="text-sm font-bold text-[#181A18]">{settings.brand_name}</p>
            <p className="text-xs text-[#5A5E58] mt-1">
              {settings.owner_name} · {settings.footer_note}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-xs font-medium text-[#5A5E58]">
            {socialLinks.map((link) => (
              <a
                key={link.id}
                href={link.profile_url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[#181A18] transition-colors"
              >
                {link.platform}
              </a>
            ))}
            <span>© {new Date().getFullYear()} {settings.owner_name}</span>
          </div>
        </div>

        {/* Very small, low-contrast Admin link at the very bottom */}
        <div className="max-w-7xl mx-auto px-6 pb-3 flex justify-end">
          <a
            href="/admin"
            onClick={(e) => {
              e.preventDefault();
              onNavigateAdmin();
            }}
            className="text-[10px] tracking-wide text-[#5A5E58]/40 hover:text-[#5A5E58]/75 transition-colors"
          >
            Admin
          </a>
        </div>
      </footer>

      {cvModalOpen && (
        <CvModal settings={settings} services={services} onClose={() => setCvModalOpen(false)} />
      )}

      <PortfolioAssistant
        ownerName={settings.owner_name}
        accentColor={accentColor}
        services={services}
        projects={projects}
        onOpenProject={onOpenProject}
        onSelectServiceAndContact={handleServiceInquire}
        onGoToContact={() => scrollToSection('contact')}
      />
    </motion.div>
  );
}
