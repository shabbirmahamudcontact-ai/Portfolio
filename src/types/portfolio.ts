export interface SiteSettings {
  brand_name: string;
  owner_name: string;
  hero_headline: string;
  hero_description: string;
  hero_3d_name: string;
  outlined_statement: string;
  scrub_video_url: string;
  scrub_video_poster: string;
  scrub_video_title: string;
  scrub_video_subtitle: string;
  tagline: string;
  about_bio: string;
  profile_photo: string;
  logo_text: string;
  logo_url: string;
  favicon_url: string;
  accent_color: string;
  education_degree: string;
  education_institution: string;
  education_status: string;
  education_details: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  github_username: string;
  github_profile_url: string;
  cv_url: string;
  footer_note: string;
  seo_title: string;
  seo_description: string;
}

export interface Project {
  id: number;
  title: string;
  slug: string;
  category: string;
  short_description: string;
  description: string;
  goal: string;
  approach: string;
  results: string;
  mockup_type: 'laptop' | 'phone';
  thumbnail: string;
  gallery: string[];
  video_url: string;
  github_url: string;
  live_url: string;
  drive_url: string;
  tools_used: string[];
  completion_date: string;
  is_featured: boolean;
  is_published: boolean;
  is_sample: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface Service {
  id: number;
  title: string;
  slug: string;
  category: string;
  description: string;
  details: string[];
  image: string;
  cta_label: string;
  is_published: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface Skill {
  id: number;
  name: string;
  category: string;
  proficiency: number;
  metric_label: string;
  display_order: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface StatItem {
  id: number;
  number_value: number;
  suffix: string;
  label: string;
  detail: string;
  use_odometer: boolean;
  display_order: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface ExperienceItem {
  id: number;
  role_title: string;
  organization: string;
  period: string;
  location: string;
  description: string;
  highlights: string[];
  display_order: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface CertificationItem {
  id: number;
  title: string;
  issuer: string;
  issue_date: string;
  credential_id: string;
  credential_url: string;
  description: string;
  display_order: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface GitHubProject {
  id: number;
  repo_name: string;
  description: string;
  language: string;
  repo_url: string;
  live_url: string;
  docs_url: string;
  preview_image: string;
  is_featured: boolean;
  is_published: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface Testimonial {
  id: number;
  customer_name: string;
  customer_role: string;
  review: string;
  customer_image: string;
  is_published: boolean;
  created_at: string;
}

export type MessageStatus = 'unread' | 'read' | 'pending' | 'contacted' | 'archived';

export interface ContactMessage {
  id: number;
  full_name: string;
  email: string;
  phone: string;
  service: string;
  subject: string;
  budget: string;
  message: string;
  status: MessageStatus;
  created_at: string;
}

export interface SocialLink {
  id: number;
  platform: string;
  profile_url: string;
  display_order: number;
  is_enabled: boolean;
}

export interface MediaFile {
  id: number;
  file_name: string;
  file_url: string;
  file_type: string;
  file_size: number;
  uploaded_at: string;
}

export interface PublicPortfolioData {
  settings: SiteSettings;
  services: Service[];
  skills: Skill[];
  stats: StatItem[];
  experiences: ExperienceItem[];
  certifications: CertificationItem[];
  projects: Project[];
  githubProjects: GitHubProject[];
  testimonials: Testimonial[];
  socialLinks: SocialLink[];
}

export interface AdminDashboardStats {
  totalProjects: number;
  publishedProjects: number;
  totalServices: number;
  publishedServices: number;
  totalMessages: number;
  unreadMessages: number;
  totalGithubProjects: number;
  totalTestimonials: number;
  totalSkills: number;
  totalStats: number;
  totalExperiences: number;
  totalCertifications: number;
}

export interface AdminUser {
  id: number;
  username: string;
  role: string;
  mustChangePassword: boolean;
}

export const PORTFOLIO_CATEGORIES = [
  'Social Media Strategy',
  'AI for Marketing',
  'Web Analytics',
  'Training',
  'Graphic Design',
  'Video Editing',
  'Website Development',
  'AI Automation',
  'Data Analysis',
  'SEO',
  'Digital Marketing',
  'GitHub Projects',
] as const;
