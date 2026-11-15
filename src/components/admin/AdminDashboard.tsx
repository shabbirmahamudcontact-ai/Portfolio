import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Award,
  BarChart3,
  Briefcase,
  Check,
  Copy,
  Download,
  ExternalLink,
  FileText,
  FolderGit2,
  FolderKanban,
  Image as ImageIcon,
  Layers,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  MessageSquareQuote,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Shield,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  PORTFOLIO_CATEGORIES,
  type AdminDashboardStats,
  type AdminUser,
  type CertificationItem,
  type ContactMessage,
  type ExperienceItem,
  type GitHubProject,
  type MediaFile,
  type MessageStatus,
  type Project,
  type Service,
  type SiteSettings,
  type Skill,
  type SocialLink,
  type StatItem,
  type Testimonial,
} from '../../types/portfolio';
import { AdminLogin, ForcePasswordChange } from './AdminLogin';
import { GoogleDriveMediaImporter } from './GoogleDriveMediaImporter';
import { ResilientImage } from '../ResilientImage';
import { clearDriveAccessToken } from '../../lib/firebase';

type AdminTab =
  | 'overview'
  | 'content'
  | 'projects'
  | 'services'
  | 'stats_skills'
  | 'experience_certs'
  | 'github'
  | 'messages'
  | 'testimonials'
  | 'media'
  | 'settings'
  | 'security';

interface AdminSessionRow {
  id: number;
  ip_address: string;
  user_agent: string;
  expires_at: string;
  created_at: string;
  isCurrent: boolean;
}

interface AdminDashboardProps {
  onBackToSite: () => void;
  onDataUpdated: () => void;
}

export function AdminDashboard({ onBackToSite, onDataUpdated }: AdminDashboardProps) {
  const [authChecked, setAuthChecked] = useState(false);
  const [user, setUser] = useState<AdminUser | null>(null);
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Dashboard data state
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [recentMessages, setRecentMessages] = useState<ContactMessage[]>([]);
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [skillsList, setSkillsList] = useState<Skill[]>([]);
  const [statsList, setStatsList] = useState<StatItem[]>([]);
  const [experiences, setExperiences] = useState<ExperienceItem[]>([]);
  const [certifications, setCertifications] = useState<CertificationItem[]>([]);
  const [githubProjects, setGithubProjects] = useState<GitHubProject[]>([]);
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>([]);
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [sessions, setSessions] = useState<AdminSessionRow[]>([]);

  // Module sub-states
  const [saving, setSaving] = useState(false);
  const [editingProject, setEditingProject] = useState<Partial<Project> | null>(null);
  const [projectToolsInput, setProjectToolsInput] = useState('');
  const [projectGalleryInput, setProjectGalleryInput] = useState('');

  const [editingService, setEditingService] = useState<Partial<Service> | null>(null);
  const [serviceDetailsInput, setServiceDetailsInput] = useState('');

  const [editingStat, setEditingStat] = useState<Partial<StatItem> | null>(null);
  const [editingSkill, setEditingSkill] = useState<Partial<Skill> | null>(null);
  const [editingExperience, setEditingExperience] = useState<Partial<ExperienceItem> | null>(null);
  const [expHighlightsInput, setExpHighlightsInput] = useState('');
  const [editingCertification, setEditingCertification] = useState<Partial<CertificationItem> | null>(null);

  const [editingGithub, setEditingGithub] = useState<Partial<GitHubProject> | null>(null);
  const [fetchedPublicRepos, setFetchedPublicRepos] = useState<any[]>([]);
  const [fetchingRepos, setFetchingRepos] = useState(false);

  const [editingTestimonial, setEditingTestimonial] = useState<Partial<Testimonial> | null>(null);
  const [newSocialPlatform, setNewSocialPlatform] = useState('');
  const [newSocialUrl, setNewSocialUrl] = useState('');

  const [messageStatusFilter, setMessageStatusFilter] = useState<string>('all');
  const [messageSearch, setMessageSearch] = useState('');
  const [selectedMessage, setSelectedMessage] = useState<ContactMessage | null>(null);

  const [mediaPickerTarget, setMediaPickerTarget] = useState<((url: string) => void) | null>(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState('');

  // Security form state
  const [secCurrentPassword, setSecCurrentPassword] = useState('');
  const [secNewPassword, setSecNewPassword] = useState('');
  const [secNewUsername, setSecNewUsername] = useState('');

  // Ensure /admin is never indexed by search engines
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => {
      document.head.removeChild(meta);
    };
  }, []);

  const showToast = useCallback((type: 'success' | 'error', text: string) => {
    setToast({ type, text });
    window.setTimeout(() => {
      setToast((prev) => (prev?.text === text ? null : prev));
    }, 4000);
  }, []);

  const loadAllAdminData = useCallback(async () => {
    try {
      const [
        ovRes,
        setRes,
        projRes,
        srvRes,
        skRes,
        stRes,
        expRes,
        certRes,
        ghRes,
        msgRes,
        testRes,
        socRes,
        medRes,
        sesRes,
      ] = await Promise.all([
        fetch('/api/admin/overview'),
        fetch('/api/admin/settings'),
        fetch('/api/admin/projects'),
        fetch('/api/admin/services'),
        fetch('/api/admin/skills'),
        fetch('/api/admin/stats'),
        fetch('/api/admin/experiences'),
        fetch('/api/admin/certifications'),
        fetch('/api/admin/github-projects'),
        fetch('/api/admin/messages'),
        fetch('/api/admin/testimonials'),
        fetch('/api/admin/social-links'),
        fetch('/api/admin/media'),
        fetch('/api/admin/sessions'),
      ]);

      if (ovRes.status === 401) {
        setUser(null);
        return;
      }

      const [ov, st, pr, sv, sk, sl, ex, ct, gh, ms, ts, sc, md, ss] = await Promise.all([
        ovRes.json(),
        setRes.json(),
        projRes.json(),
        srvRes.json(),
        skRes.json(),
        stRes.json(),
        expRes.json(),
        certRes.json(),
        ghRes.json(),
        msgRes.json(),
        testRes.json(),
        socRes.json(),
        medRes.json(),
        sesRes.json(),
      ]);

      setStats(ov.stats);
      setRecentMessages(ov.recentMessages || []);
      setSettings(st);
      setProjects(pr);
      setServices(sv);
      setSkillsList(Array.isArray(sk) ? sk : []);
      setStatsList(Array.isArray(sl) ? sl : []);
      setExperiences(Array.isArray(ex) ? ex : []);
      setCertifications(Array.isArray(ct) ? ct : []);
      setGithubProjects(gh);
      setMessages(ms);
      setTestimonials(ts);
      setSocialLinks(sc);
      setMediaFiles(md);
      setSessions(ss);
    } catch {
      showToast('error', 'Failed to load dashboard data.');
    }
  }, [showToast]);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => {
        if (res?.authenticated && res.user) {
          setUser(res.user);
          if (!res.user.mustChangePassword) {
            void loadAllAdminData();
          }
        }
      })
      .finally(() => setAuthChecked(true));
  }, [loadAllAdminData]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    clearDriveAccessToken();
    setUser(null);
  };

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-[#F7F5F0] flex items-center justify-center text-sm text-[#5A5E58]">
        Verifying session...
      </div>
    );
  }

  if (!user) {
    return (
      <AdminLogin
        onSuccess={(loggedInUser) => {
          setUser(loggedInUser);
          if (!loggedInUser.mustChangePassword) {
            void loadAllAdminData();
          }
        }}
        onBackToSite={onBackToSite}
      />
    );
  }

  if (user.mustChangePassword) {
    return (
      <ForcePasswordChange
        user={user}
        onUpdated={(updatedUser) => {
          setUser(updatedUser);
          void loadAllAdminData();
        }}
        onLogout={handleLogout}
      />
    );
  }

  // Save Site Settings
  const handleSaveSettings = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!settings) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error('Save failed');
      const updated = await res.json();
      setSettings(updated);
      onDataUpdated();
      showToast('success', 'Settings saved and synced to public website.');
    } catch {
      showToast('error', 'Unable to save settings.');
    } finally {
      setSaving(false);
    }
  };

  // Upload media file helper
  const handleFileUpload = async (
    e: ChangeEvent<HTMLInputElement>,
    onUploaded?: (file: MediaFile) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingMedia(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/admin/media', {
        method: 'POST',
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Upload failed');
      setMediaFiles((prev) => [json, ...prev]);
      showToast('success', `Uploaded ${json.file_name}`);
      if (onUploaded) onUploaded(json);
    } catch (err: any) {
      showToast('error', err.message || 'Upload failed.');
    } finally {
      setUploadingMedia(false);
      e.target.value = '';
    }
  };

  // Project CRUD handlers
  const openNewProject = () => {
    setEditingProject({
      title: '',
      category: 'Website Development',
      short_description: '',
      description: '',
      goal: '',
      approach: '',
      results: '',
      mockup_type: 'laptop',
      thumbnail: '',
      video_url: '',
      github_url: '',
      live_url: '',
      drive_url: '',
      completion_date: '',
      is_featured: false,
      is_published: true,
      is_sample: false,
    });
    setProjectToolsInput('');
    setProjectGalleryInput('');
  };

  const openEditProject = (p: Project) => {
    setEditingProject(p);
    setProjectToolsInput((p.tools_used || []).join(', '));
    setProjectGalleryInput((p.gallery || []).join('\n'));
  };

  const handleSaveProject = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingProject) return;
    setSaving(true);
    const payload = {
      ...editingProject,
      tools_used: projectToolsInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      gallery: projectGalleryInput
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
    };
    try {
      const isNew = !editingProject.id;
      const res = await fetch(
        isNew ? '/api/admin/projects' : `/api/admin/projects/${editingProject.id}`,
        {
          method: isNew ? 'POST' : 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to save project.');
      setEditingProject(null);
      await loadAllAdminData();
      onDataUpdated();
      showToast('success', isNew ? 'Project created.' : 'Project updated.');
    } catch (err: any) {
      showToast('error', err.message || 'Failed to save project.');
    } finally {
      setSaving(false);
    }
  };

  const handleReorderProject = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= projects.length) return;
    const copy = [...projects];
    const [moved] = copy.splice(index, 1);
    copy.splice(target, 0, moved);
    setProjects(copy);
    await fetch('/api/admin/projects/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderedIds: copy.map((p) => p.id) }),
    });
    onDataUpdated();
  };

  const handleToggleProjectFlag = async (p: Project, field: 'is_published' | 'is_featured') => {
    const res = await fetch(`/api/admin/projects/${p.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: !p[field] }),
    });
    if (res.ok) {
      await loadAllAdminData();
      onDataUpdated();
    }
  };

  const handleDeleteProject = async (id: number) => {
    await fetch(`/api/admin/projects/${id}`, { method: 'DELETE' });
    await loadAllAdminData();
    onDataUpdated();
    showToast('success', 'Project deleted.');
  };

  // Service CRUD
  const openEditService = (s: Service) => {
    setEditingService(s);
    setServiceDetailsInput((s.details || []).join('\n'));
  };

  const openNewService = () => {
    setEditingService({
      title: '',
      category: '',
      description: '',
      image: '',
      cta_label: 'Discuss This Service',
      is_published: true,
    });
    setServiceDetailsInput('');
  };

  const handleSaveService = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingService) return;
    setSaving(true);
    const payload = {
      ...editingService,
      details: serviceDetailsInput
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
    };
    try {
      const isNew = !editingService.id;
      const res = await fetch(
        isNew ? '/api/admin/services' : `/api/admin/services/${editingService.id}`,
        {
          method: isNew ? 'POST' : 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) throw new Error('Failed to save service.');
      setEditingService(null);
      await loadAllAdminData();
      onDataUpdated();
      showToast('success', isNew ? 'Service added.' : 'Service updated.');
    } catch {
      showToast('error', 'Failed to save service.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteService = async (id: number) => {
    await fetch(`/api/admin/services/${id}`, { method: 'DELETE' });
    await loadAllAdminData();
    onDataUpdated();
    showToast('success', 'Service deleted.');
  };

  // Stats, Skills, Experience, Certification CRUD
  const handleSaveStat = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingStat) return;
    setSaving(true);
    try {
      const isNew = !editingStat.id;
      const res = await fetch(isNew ? '/api/admin/stats' : `/api/admin/stats/${editingStat.id}`, {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingStat),
      });
      if (!res.ok) throw new Error('Failed to save stat.');
      setEditingStat(null);
      await loadAllAdminData();
      onDataUpdated();
      showToast('success', isNew ? 'Stat added.' : 'Stat updated.');
    } catch {
      showToast('error', 'Failed to save stat.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSkill = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingSkill) return;
    setSaving(true);
    try {
      const isNew = !editingSkill.id;
      const res = await fetch(isNew ? '/api/admin/skills' : `/api/admin/skills/${editingSkill.id}`, {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingSkill),
      });
      if (!res.ok) throw new Error('Failed to save skill.');
      setEditingSkill(null);
      await loadAllAdminData();
      onDataUpdated();
      showToast('success', isNew ? 'Skill added.' : 'Skill updated.');
    } catch {
      showToast('error', 'Failed to save skill.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveExperience = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingExperience) return;
    setSaving(true);
    const payload = {
      ...editingExperience,
      highlights: expHighlightsInput
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
    };
    try {
      const isNew = !editingExperience.id;
      const res = await fetch(
        isNew ? '/api/admin/experiences' : `/api/admin/experiences/${editingExperience.id}`,
        {
          method: isNew ? 'POST' : 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) throw new Error('Failed to save experience.');
      setEditingExperience(null);
      await loadAllAdminData();
      onDataUpdated();
      showToast('success', isNew ? 'Experience added.' : 'Experience updated.');
    } catch {
      showToast('error', 'Failed to save experience.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCertification = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingCertification) return;
    setSaving(true);
    try {
      const isNew = !editingCertification.id;
      const res = await fetch(
        isNew ? '/api/admin/certifications' : `/api/admin/certifications/${editingCertification.id}`,
        {
          method: isNew ? 'POST' : 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(editingCertification),
        }
      );
      if (!res.ok) throw new Error('Failed to save certification.');
      setEditingCertification(null);
      await loadAllAdminData();
      onDataUpdated();
      showToast('success', isNew ? 'Certification added.' : 'Certification updated.');
    } catch {
      showToast('error', 'Failed to save certification.');
    } finally {
      setSaving(false);
    }
  };

  // GitHub CRUD & Public API Fetch
  const handleFetchGithubPublic = async () => {
    if (!settings?.github_username) {
      showToast('error', 'Enter a GitHub username first.');
      return;
    }
    setFetchingRepos(true);
    try {
      const res = await fetch(
        `/api/github/repos?username=${encodeURIComponent(settings.github_username)}`
      );
      const json = await res.json();
      setFetchedPublicRepos(json.repos || []);
      if (!json.repos?.length) {
        showToast('error', 'No public non-fork repositories returned or API unavailable.');
      } else {
        showToast('success', `Fetched ${json.repos.length} public repositories.`);
      }
    } catch {
      showToast('error', 'Unable to reach GitHub API.');
    } finally {
      setFetchingRepos(false);
    }
  };

  const handleImportGithubRepo = async (repo: any) => {
    const res = await fetch('/api/admin/github-projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        repo_name: repo.repo_name,
        description: repo.description,
        language: repo.language,
        repo_url: repo.repo_url,
        live_url: repo.live_url,
        is_featured: true,
        is_published: true,
      }),
    });
    if (res.ok) {
      await loadAllAdminData();
      onDataUpdated();
      showToast('success', `Imported ${repo.repo_name}.`);
    }
  };

  const handleSaveGithubProject = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingGithub) return;
    setSaving(true);
    try {
      const isNew = !editingGithub.id;
      const res = await fetch(
        isNew
          ? '/api/admin/github-projects'
          : `/api/admin/github-projects/${editingGithub.id}`,
        {
          method: isNew ? 'POST' : 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(editingGithub),
        }
      );
      if (!res.ok) throw new Error('Failed to save repository.');
      setEditingGithub(null);
      await loadAllAdminData();
      onDataUpdated();
      showToast('success', isNew ? 'Repository added.' : 'Repository updated.');
    } catch {
      showToast('error', 'Failed to save repository.');
    } finally {
      setSaving(false);
    }
  };

  // Messages actions
  const filteredMessages = messages.filter((m) => {
    const matchStatus = messageStatusFilter === 'all' || m.status === messageStatusFilter;
    const q = messageSearch.trim().toLowerCase();
    const matchSearch =
      !q ||
      m.full_name.toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q) ||
      m.service.toLowerCase().includes(q) ||
      m.message.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  const handleUpdateMessageStatus = async (id: number, status: MessageStatus) => {
    const res = await fetch(`/api/admin/messages/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      const updated = await res.json();
      setMessages((prev) => prev.map((m) => (m.id === id ? updated : m)));
      if (selectedMessage?.id === id) setSelectedMessage(updated);
      void loadAllAdminData();
    }
  };

  const handleDeleteMessage = async (id: number) => {
    await fetch(`/api/admin/messages/${id}`, { method: 'DELETE' });
    if (selectedMessage?.id === id) setSelectedMessage(null);
    await loadAllAdminData();
    showToast('success', 'Message deleted.');
  };

  // Testimonials CRUD
  const handleSaveTestimonial = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingTestimonial) return;
    setSaving(true);
    try {
      const isNew = !editingTestimonial.id;
      const res = await fetch(
        isNew
          ? '/api/admin/testimonials'
          : `/api/admin/testimonials/${editingTestimonial.id}`,
        {
          method: isNew ? 'POST' : 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(editingTestimonial),
        }
      );
      if (!res.ok) throw new Error('Save failed');
      setEditingTestimonial(null);
      await loadAllAdminData();
      onDataUpdated();
      showToast('success', isNew ? 'Testimonial added.' : 'Testimonial updated.');
    } catch {
      showToast('error', 'Failed to save testimonial.');
    } finally {
      setSaving(false);
    }
  };

  // Social Links
  const handleUpdateSocial = async (link: SocialLink, patch: Partial<SocialLink>) => {
    const res = await fetch(`/api/admin/social-links/${link.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...link, ...patch }),
    });
    if (res.ok) {
      await loadAllAdminData();
      onDataUpdated();
    }
  };

  const handleAddSocial = async (e: FormEvent) => {
    e.preventDefault();
    if (!newSocialPlatform.trim()) return;
    const res = await fetch('/api/admin/social-links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        platform: newSocialPlatform.trim(),
        profile_url: newSocialUrl.trim(),
        is_enabled: Boolean(newSocialUrl.trim()),
      }),
    });
    if (res.ok) {
      setNewSocialPlatform('');
      setNewSocialUrl('');
      await loadAllAdminData();
      onDataUpdated();
      showToast('success', 'Social link added.');
    }
  };

  // Security password/username update
  const handleUpdateCredentials = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: secCurrentPassword,
          newPassword: secNewPassword,
          newUsername: secNewUsername.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to update credentials.');
      setUser(json.user);
      setSecCurrentPassword('');
      setSecNewPassword('');
      setSecNewUsername('');
      showToast('success', 'Account credentials updated.');
    } catch (err: any) {
      showToast('error', err.message || 'Update failed.');
    } finally {
      setSaving(false);
    }
  };

  const navItems: Array<{ id: AdminTab; label: string; icon: any; badge?: number }> = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'content', label: 'Website Content', icon: FileText },
    { id: 'projects', label: 'Projects', icon: FolderKanban },
    { id: 'services', label: 'Services', icon: Briefcase },
    { id: 'stats_skills', label: 'Stats & Skills', icon: BarChart3 },
    { id: 'experience_certs', label: 'Experience & Certs', icon: Award },
    { id: 'github', label: 'GitHub & Code', icon: FolderGit2 },
    {
      id: 'messages',
      label: 'Messages',
      icon: Mail,
      badge: stats?.unreadMessages || 0,
    },
    { id: 'testimonials', label: 'Testimonials', icon: MessageSquareQuote },
    { id: 'media', label: 'Media Library', icon: ImageIcon },
    { id: 'settings', label: 'Settings & Socials', icon: Settings },
    { id: 'security', label: 'Account Security', icon: Shield },
  ];

  const activeLabel = navItems.find((n) => n.id === activeTab)?.label || 'Overview';

  return (
    <div className="min-h-screen bg-[#F7F5F0] text-[#181A18] flex">
      {/* Mobile Sidebar Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Responsive Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-[#141615] text-[#F7F5F0] flex flex-col justify-between transition-transform duration-200 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="p-5">
          <div className="flex items-center justify-between gap-2 pb-5 border-b border-white/10">
            <div>
              <p className="text-sm font-bold tracking-tight text-white">Studio Admin</p>
              <p className="text-xs text-white/60">{user.username}</p>
            </div>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-1.5 text-white/70 hover:text-white cursor-pointer"
              aria-label="Close sidebar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <nav className="mt-5 space-y-1" aria-label="Admin Navigation">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(item.id);
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#1B5E4A] text-white'
                      : 'text-white/75 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4 shrink-0" />
                    {item.label}
                  </span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="text-[11px] font-mono-tabular px-1.5 py-0.5 rounded bg-white text-[#141615] font-semibold">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-5 border-t border-white/10 space-y-2">
          <button
            type="button"
            onClick={onBackToSite}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-white/80 hover:text-white hover:bg-white/5 rounded-lg cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            View Public Portfolio
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-red-300 hover:text-red-200 hover:bg-white/5 rounded-lg cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Log Out
          </button>
        </div>
      </aside>

      {/* Main Content Workspace */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-16 bg-[#FFFFFF] border-b border-[#E0DDD5] px-6 flex items-center justify-between gap-4 sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg border border-[#E0DDD5] text-[#181A18] cursor-pointer"
              aria-label="Open menu"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="text-xs sm:text-sm text-[#5A5E58] flex items-center gap-2">
              <span>Admin</span>
              <span aria-hidden="true">/</span>
              <span className="font-semibold text-[#181A18]">{activeLabel}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void loadAllAdminData()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#5A5E58] hover:text-[#181A18] border border-[#E0DDD5] rounded-lg cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </button>
          </div>
        </header>

        {toast && (
          <div className="px-6 pt-4">
            <div
              role="status"
              className={`px-4 py-3 rounded-lg border text-xs font-medium flex items-center justify-between ${
                toast.type === 'success'
                  ? 'bg-[#ECFDF5] border-[#A7F3D0] text-[#065F46]'
                  : 'bg-[#FEF2F2] border-[#FECACA] text-[#991B1B]'
              }`}
            >
              <span>{toast.text}</span>
              <button
                type="button"
                onClick={() => setToast(null)}
                className="cursor-pointer ml-4"
                aria-label="Dismiss notification"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        <main className="flex-1 p-6 max-w-6xl w-full mx-auto space-y-8">
          {/* MODULE: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {[
                  { label: 'Total Projects', value: stats?.totalProjects ?? 0 },
                  { label: 'Published Projects', value: stats?.publishedProjects ?? 0 },
                  { label: 'Total Services', value: stats?.totalServices ?? 0 },
                  { label: 'Total Messages', value: stats?.totalMessages ?? 0 },
                  { label: 'Unread Inquiries', value: stats?.unreadMessages ?? 0 },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="bg-[#FFFFFF] border border-[#E0DDD5] rounded-xl p-5"
                  >
                    <p className="text-xs font-medium text-[#5A5E58]">{stat.label}</p>
                    <p className="text-2xl font-bold font-mono-tabular text-[#181A18] mt-1">
                      {stat.value}
                    </p>
                  </div>
                ))}
              </div>

              <div className="bg-[#FFFFFF] border border-[#E0DDD5] rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-[#E0DDD5] flex items-center justify-between">
                  <h2 className="text-sm font-bold">Recent Contact Messages</h2>
                  <button
                    type="button"
                    onClick={() => setActiveTab('messages')}
                    className="text-xs font-semibold text-[#1B5E4A] hover:underline cursor-pointer"
                  >
                    View All Messages
                  </button>
                </div>
                {recentMessages.length === 0 ? (
                  <div className="p-8 text-center text-sm text-[#5A5E58]">
                    No contact inquiries received yet.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#F7F5F0] text-[#5A5E58] border-b border-[#E0DDD5]">
                        <tr>
                          <th className="py-3 px-4 font-semibold">Sender</th>
                          <th className="py-3 px-4 font-semibold">Service</th>
                          <th className="py-3 px-4 font-semibold">Status</th>
                          <th className="py-3 px-4 font-semibold text-right">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E0DDD5]">
                        {recentMessages.map((msg) => (
                          <tr
                            key={msg.id}
                            onClick={() => {
                              setSelectedMessage(msg);
                              setActiveTab('messages');
                            }}
                            className="hover:bg-[#F7F5F0] cursor-pointer"
                          >
                            <td className="py-3 px-4">
                              <p className="font-semibold text-[#181A18]">{msg.full_name}</p>
                              <p className="text-[#5A5E58]">{msg.email}</p>
                            </td>
                            <td className="py-3 px-4 text-[#5A5E58]">
                              {msg.service || 'General'}
                            </td>
                            <td className="py-3 px-4 capitalize font-medium text-[#181A18]">
                              {msg.status}
                            </td>
                            <td className="py-3 px-4 text-right font-mono-tabular text-[#5A5E58]">
                              {msg.created_at.split('T')[0]}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* MODULE: WEBSITE CONTENT */}
          {activeTab === 'content' && settings && (
            <form
              onSubmit={handleSaveSettings}
              className="bg-[#FFFFFF] border border-[#E0DDD5] rounded-2xl p-6 space-y-6"
            >
              <div className="flex items-center justify-between border-b border-[#E0DDD5] pb-4">
                <h2 className="text-base font-bold">Website Content & Personal Profile</h2>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#1B5E4A] hover:bg-[#144738] rounded-lg cursor-pointer"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-semibold mb-1.5">Brand Name</label>
                  <input
                    type="text"
                    value={settings.brand_name}
                    onChange={(e) => setSettings({ ...settings, brand_name: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm bg-[#F7F5F0] border border-[#E0DDD5] rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5">Owner Full Name</label>
                  <input
                    type="text"
                    value={settings.owner_name}
                    onChange={(e) => setSettings({ ...settings, owner_name: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm bg-[#F7F5F0] border border-[#E0DDD5] rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5">Header Logo Text</label>
                  <input
                    type="text"
                    value={settings.logo_text}
                    onChange={(e) => setSettings({ ...settings, logo_text: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm bg-[#F7F5F0] border border-[#E0DDD5] rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5">Primary Tagline</label>
                  <input
                    type="text"
                    value={settings.tagline}
                    onChange={(e) => setSettings({ ...settings, tagline: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm bg-[#F7F5F0] border border-[#E0DDD5] rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5">Hero Headline</label>
                <input
                  type="text"
                  value={settings.hero_headline}
                  onChange={(e) => setSettings({ ...settings, hero_headline: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm bg-[#F7F5F0] border border-[#E0DDD5] rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5">Hero Description</label>
                <textarea
                  rows={3}
                  value={settings.hero_description}
                  onChange={(e) => setSettings({ ...settings, hero_description: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm bg-[#F7F5F0] border border-[#E0DDD5] rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5">About Me Biography</label>
                <textarea
                  rows={6}
                  value={settings.about_bio}
                  onChange={(e) => setSettings({ ...settings, about_bio: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm bg-[#F7F5F0] border border-[#E0DDD5] rounded-lg"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 items-end">
                <div>
                  <label className="block text-xs font-semibold mb-1.5">Profile Photo URL</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={settings.profile_photo}
                      onChange={(e) =>
                        setSettings({ ...settings, profile_photo: e.target.value })
                      }
                      className="flex-1 px-3.5 py-2 text-sm bg-[#F7F5F0] border border-[#E0DDD5] rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setMediaPickerTarget(() => (url: string) =>
                          setSettings((s) => (s ? { ...s, profile_photo: url } : s))
                        )
                      }
                      className="px-3 py-2 text-xs font-semibold bg-[#EFECE6] hover:bg-[#E0DDD5] rounded-lg cursor-pointer"
                    >
                      Pick Media
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5">Footer Note</label>
                  <input
                    type="text"
                    value={settings.footer_note}
                    onChange={(e) => setSettings({ ...settings, footer_note: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm bg-[#F7F5F0] border border-[#E0DDD5] rounded-lg"
                  />
                </div>
              </div>

              <div className="pt-5 border-t border-[#E0DDD5] space-y-4">
                <h3 className="text-sm font-bold">3D Hero Typography, Statement & Scroll-Scrubbed Reel</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold mb-1.5">
                      Extruded 3D Hero Name (Champagne Gold)
                    </label>
                    <input
                      type="text"
                      value={settings.hero_3d_name || ''}
                      onChange={(e) => setSettings({ ...settings, hero_3d_name: e.target.value })}
                      placeholder="Shabbir Mahamud"
                      className="w-full px-3.5 py-2 text-sm bg-[#F7F5F0] border border-[#E0DDD5] rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5">
                      Scroll-Fill Outlined Statement
                    </label>
                    <input
                      type="text"
                      value={settings.outlined_statement || ''}
                      onChange={(e) =>
                        setSettings({ ...settings, outlined_statement: e.target.value })
                      }
                      className="w-full px-3.5 py-2 text-sm bg-[#F7F5F0] border border-[#E0DDD5] rounded-lg"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold mb-1.5">
                      Scroll-Scrubbed MP4 Video URL
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={settings.scrub_video_url || ''}
                        onChange={(e) =>
                          setSettings({ ...settings, scrub_video_url: e.target.value })
                        }
                        placeholder="/uploads/reel.mp4 (optional)"
                        className="flex-1 px-3.5 py-2 text-sm bg-[#F7F5F0] border border-[#E0DDD5] rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setMediaPickerTarget(() => (url: string) =>
                            setSettings((s) => (s ? { ...s, scrub_video_url: url } : s))
                          )
                        }
                        className="px-3 py-2 text-xs font-semibold bg-[#EFECE6] hover:bg-[#E0DDD5] rounded-lg cursor-pointer"
                      >
                        Pick Media
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5">
                      Scroll-Scrubbed Video Poster Fallback URL
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={settings.scrub_video_poster || ''}
                        onChange={(e) =>
                          setSettings({ ...settings, scrub_video_poster: e.target.value })
                        }
                        className="flex-1 px-3.5 py-2 text-sm bg-[#F7F5F0] border border-[#E0DDD5] rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setMediaPickerTarget(() => (url: string) =>
                            setSettings((s) => (s ? { ...s, scrub_video_poster: url } : s))
                          )
                        }
                        className="px-3 py-2 text-xs font-semibold bg-[#EFECE6] hover:bg-[#E0DDD5] rounded-lg cursor-pointer"
                      >
                        Pick Media
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold mb-1.5">Reel Section Title</label>
                    <input
                      type="text"
                      value={settings.scrub_video_title || ''}
                      onChange={(e) =>
                        setSettings({ ...settings, scrub_video_title: e.target.value })
                      }
                      className="w-full px-3.5 py-2 text-sm bg-[#F7F5F0] border border-[#E0DDD5] rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5">Reel Section Subtitle</label>
                    <input
                      type="text"
                      value={settings.scrub_video_subtitle || ''}
                      onChange={(e) =>
                        setSettings({ ...settings, scrub_video_subtitle: e.target.value })
                      }
                      className="w-full px-3.5 py-2 text-sm bg-[#F7F5F0] border border-[#E0DDD5] rounded-lg"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-5 border-t border-[#E0DDD5] space-y-4">
                <h3 className="text-sm font-bold">Education Details</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold mb-1.5">Degree Title</label>
                    <input
                      type="text"
                      value={settings.education_degree}
                      onChange={(e) =>
                        setSettings({ ...settings, education_degree: e.target.value })
                      }
                      className="w-full px-3.5 py-2 text-sm bg-[#F7F5F0] border border-[#E0DDD5] rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5">Institution</label>
                    <input
                      type="text"
                      value={settings.education_institution}
                      onChange={(e) =>
                        setSettings({ ...settings, education_institution: e.target.value })
                      }
                      className="w-full px-3.5 py-2 text-sm bg-[#F7F5F0] border border-[#E0DDD5] rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5">Academic Status</label>
                    <input
                      type="text"
                      value={settings.education_status}
                      onChange={(e) =>
                        setSettings({ ...settings, education_status: e.target.value })
                      }
                      className="w-full px-3.5 py-2 text-sm bg-[#F7F5F0] border border-[#E0DDD5] rounded-lg"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5">
                    Relevant Academic Information
                  </label>
                  <textarea
                    rows={2}
                    value={settings.education_details}
                    onChange={(e) =>
                      setSettings({ ...settings, education_details: e.target.value })
                    }
                    className="w-full px-3.5 py-2 text-sm bg-[#F7F5F0] border border-[#E0DDD5] rounded-lg"
                  />
                </div>
              </div>
            </form>
          )}

          {/* MODULE: PROJECTS */}
          {activeTab === 'projects' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold">Portfolio Projects ({projects.length})</h2>
                <button
                  type="button"
                  onClick={openNewProject}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#1B5E4A] hover:bg-[#144738] rounded-lg cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  Add Project
                </button>
              </div>

              {editingProject && (
                <form
                  onSubmit={handleSaveProject}
                  className="bg-[#FFFFFF] border border-[#E0DDD5] rounded-2xl p-6 space-y-5"
                >
                  <div className="flex items-center justify-between border-b border-[#E0DDD5] pb-3">
                    <h3 className="text-sm font-bold">
                      {editingProject.id ? 'Edit Project' : 'Create Project'}
                    </h3>
                    <button
                      type="button"
                      onClick={() => setEditingProject(null)}
                      className="text-xs text-[#5A5E58] hover:text-[#181A18] cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold mb-1.5">Project Title *</label>
                      <input
                        type="text"
                        required
                        value={editingProject.title || ''}
                        onChange={(e) =>
                          setEditingProject({ ...editingProject, title: e.target.value })
                        }
                        className="w-full px-3.5 py-2 text-sm bg-[#F7F5F0] border border-[#E0DDD5] rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1.5">Category *</label>
                      <select
                        value={editingProject.category || 'Website Development'}
                        onChange={(e) =>
                          setEditingProject({ ...editingProject, category: e.target.value })
                        }
                        className="w-full px-3.5 py-2 text-sm bg-[#F7F5F0] border border-[#E0DDD5] rounded-lg"
                      >
                        {PORTFOLIO_CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1.5">Short Description</label>
                    <input
                      type="text"
                      value={editingProject.short_description || ''}
                      onChange={(e) =>
                        setEditingProject({
                          ...editingProject,
                          short_description: e.target.value,
                        })
                      }
                      className="w-full px-3.5 py-2 text-sm bg-[#F7F5F0] border border-[#E0DDD5] rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1.5">
                      Detailed Description
                    </label>
                    <textarea
                      rows={4}
                      value={editingProject.description || ''}
                      onChange={(e) =>
                        setEditingProject({ ...editingProject, description: e.target.value })
                      }
                      className="w-full px-3.5 py-2 text-sm bg-[#F7F5F0] border border-[#E0DDD5] rounded-lg"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold mb-1.5">Project Goal</label>
                      <textarea
                        rows={3}
                        value={editingProject.goal || ''}
                        onChange={(e) =>
                          setEditingProject({ ...editingProject, goal: e.target.value })
                        }
                        className="w-full px-3.5 py-2 text-sm bg-[#F7F5F0] border border-[#E0DDD5] rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1.5">Strategic Approach</label>
                      <textarea
                        rows={3}
                        value={editingProject.approach || ''}
                        onChange={(e) =>
                          setEditingProject({ ...editingProject, approach: e.target.value })
                        }
                        className="w-full px-3.5 py-2 text-sm bg-[#F7F5F0] border border-[#E0DDD5] rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1.5">Results & Outcome</label>
                      <textarea
                        rows={3}
                        value={editingProject.results || ''}
                        onChange={(e) =>
                          setEditingProject({ ...editingProject, results: e.target.value })
                        }
                        className="w-full px-3.5 py-2 text-sm bg-[#F7F5F0] border border-[#E0DDD5] rounded-lg"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1.5">
                      Default 3D Mockup Device (Detail Page)
                    </label>
                    <select
                      value={editingProject.mockup_type || 'laptop'}
                      onChange={(e) =>
                        setEditingProject({
                          ...editingProject,
                          mockup_type: e.target.value === 'phone' ? 'phone' : 'laptop',
                        })
                      }
                      className="w-full sm:w-64 px-3.5 py-2 text-sm bg-[#F7F5F0] border border-[#E0DDD5] rounded-lg"
                    >
                      <option value="laptop">3D Laptop Mockup</option>
                      <option value="phone">3D Smartphone Mockup</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold mb-1.5">Thumbnail URL</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={editingProject.thumbnail || ''}
                          onChange={(e) =>
                            setEditingProject({ ...editingProject, thumbnail: e.target.value })
                          }
                          className="flex-1 px-3.5 py-2 text-sm bg-[#F7F5F0] border border-[#E0DDD5] rounded-lg"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setMediaPickerTarget(() => (url: string) =>
                              setEditingProject((p) => (p ? { ...p, thumbnail: url } : p))
                            )
                          }
                          className="px-3 py-2 text-xs font-semibold bg-[#EFECE6] rounded-lg cursor-pointer"
                        >
                          Pick
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1.5">
                        Video Preview URL (MP4/WebM)
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={editingProject.video_url || ''}
                          onChange={(e) =>
                            setEditingProject({ ...editingProject, video_url: e.target.value })
                          }
                          className="flex-1 px-3.5 py-2 text-sm bg-[#F7F5F0] border border-[#E0DDD5] rounded-lg"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setMediaPickerTarget(() => (url: string) =>
                              setEditingProject((p) => (p ? { ...p, video_url: url } : p))
                            )
                          }
                          className="px-3 py-2 text-xs font-semibold bg-[#EFECE6] rounded-lg cursor-pointer"
                        >
                          Pick
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-xs font-semibold mb-1.5">
                        GitHub Repository URL
                      </label>
                      <input
                        type="url"
                        value={editingProject.github_url || ''}
                        onChange={(e) =>
                          setEditingProject({ ...editingProject, github_url: e.target.value })
                        }
                        className="w-full px-3.5 py-2 text-sm bg-[#F7F5F0] border border-[#E0DDD5] rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1.5">Live Project URL</label>
                      <input
                        type="url"
                        value={editingProject.live_url || ''}
                        onChange={(e) =>
                          setEditingProject({ ...editingProject, live_url: e.target.value })
                        }
                        className="w-full px-3.5 py-2 text-sm bg-[#F7F5F0] border border-[#E0DDD5] rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1.5">
                        Google Drive Folder URL
                      </label>
                      <input
                        type="url"
                        placeholder="https://drive.google.com/drive/folders/..."
                        value={editingProject.drive_url || ''}
                        onChange={(e) =>
                          setEditingProject({ ...editingProject, drive_url: e.target.value })
                        }
                        className="w-full px-3.5 py-2 text-sm bg-[#F7F5F0] border border-[#E0DDD5] rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1.5">Completion Date</label>
                      <input
                        type="text"
                        placeholder="e.g. October 2026"
                        value={editingProject.completion_date || ''}
                        onChange={(e) =>
                          setEditingProject({
                            ...editingProject,
                            completion_date: e.target.value,
                          })
                        }
                        className="w-full px-3.5 py-2 text-sm bg-[#F7F5F0] border border-[#E0DDD5] rounded-lg"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold mb-1.5">
                        Tools Used (comma-separated)
                      </label>
                      <input
                        type="text"
                        value={projectToolsInput}
                        onChange={(e) => setProjectToolsInput(e.target.value)}
                        placeholder="React, TypeScript, Tailwind CSS"
                        className="w-full px-3.5 py-2 text-sm bg-[#F7F5F0] border border-[#E0DDD5] rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1.5">
                        Gallery Image URLs (one per line)
                      </label>
                      <textarea
                        rows={2}
                        value={projectGalleryInput}
                        onChange={(e) => setProjectGalleryInput(e.target.value)}
                        className="w-full px-3.5 py-2 text-sm bg-[#F7F5F0] border border-[#E0DDD5] rounded-lg"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-6 text-xs font-medium">
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(editingProject.is_featured)}
                        onChange={(e) =>
                          setEditingProject({ ...editingProject, is_featured: e.target.checked })
                        }
                      />
                      Featured Project
                    </label>
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingProject.is_published !== false}
                        onChange={(e) =>
                          setEditingProject({ ...editingProject, is_published: e.target.checked })
                        }
                      />
                      Published on Website
                    </label>
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(editingProject.is_sample)}
                        onChange={(e) =>
                          setEditingProject({ ...editingProject, is_sample: e.target.checked })
                        }
                      />
                      Label as Sample Placeholder
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2.5 text-xs font-semibold text-white bg-[#1B5E4A] hover:bg-[#144738] rounded-lg cursor-pointer"
                  >
                    {saving ? 'Saving...' : 'Save Project'}
                  </button>
                </form>
              )}

              <div className="bg-[#FFFFFF] border border-[#E0DDD5] rounded-2xl divide-y divide-[#E0DDD5]">
                {projects.map((p, idx) => (
                  <div
                    key={p.id}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-16 h-12 rounded-lg overflow-hidden border border-[#E0DDD5] shrink-0">
                        <ResilientImage
                          src={p.thumbnail}
                          alt={p.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-[#181A18] truncate">{p.title}</p>
                        <p className="text-xs text-[#5A5E58]">
                          {p.category} · {p.is_published ? 'Published' : 'Draft'}
                          {p.is_featured ? ' · Featured' : ''}
                          {p.is_sample ? ' · Sample' : ''}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => void handleReorderProject(idx, -1)}
                        disabled={idx === 0}
                        aria-label="Move up"
                        className="p-2 rounded-lg border border-[#E0DDD5] text-[#5A5E58] hover:text-[#181A18] disabled:opacity-30 cursor-pointer"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleReorderProject(idx, 1)}
                        disabled={idx === projects.length - 1}
                        aria-label="Move down"
                        className="p-2 rounded-lg border border-[#E0DDD5] text-[#5A5E58] hover:text-[#181A18] disabled:opacity-30 cursor-pointer"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleToggleProjectFlag(p, 'is_published')}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[#E0DDD5] hover:bg-[#F7F5F0] cursor-pointer"
                      >
                        {p.is_published ? 'Unpublish' : 'Publish'}
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditProject(p)}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg bg-[#EFECE6] hover:bg-[#E0DDD5] cursor-pointer"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeleteProject(p.id)}
                        aria-label={`Delete ${p.title}`}
                        className="p-2 rounded-lg text-[#991B1B] hover:bg-[#FEF2F2] cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* MODULE: SERVICES */}
          {activeTab === 'services' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold">Services ({services.length})</h2>
                <button
                  type="button"
                  onClick={openNewService}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#1B5E4A] hover:bg-[#144738] rounded-lg cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  Add Service
                </button>
              </div>

              {editingService && (
                <form
                  onSubmit={handleSaveService}
                  className="bg-[#FFFFFF] border border-[#E0DDD5] rounded-2xl p-6 space-y-4"
                >
                  <div className="flex items-center justify-between border-b border-[#E0DDD5] pb-3">
                    <h3 className="text-sm font-bold">
                      {editingService.id ? 'Edit Service' : 'New Service'}
                    </h3>
                    <button
                      type="button"
                      onClick={() => setEditingService(null)}
                      className="text-xs text-[#5A5E58] cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold mb-1.5">Service Title *</label>
                      <input
                        type="text"
                        required
                        value={editingService.title || ''}
                        onChange={(e) =>
                          setEditingService({ ...editingService, title: e.target.value })
                        }
                        className="w-full px-3.5 py-2 text-sm bg-[#F7F5F0] border border-[#E0DDD5] rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1.5">Category Label</label>
                      <input
                        type="text"
                        value={editingService.category || ''}
                        onChange={(e) =>
                          setEditingService({ ...editingService, category: e.target.value })
                        }
                        className="w-full px-3.5 py-2 text-sm bg-[#F7F5F0] border border-[#E0DDD5] rounded-lg"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5">Description</label>
                    <textarea
                      rows={3}
                      value={editingService.description || ''}
                      onChange={(e) =>
                        setEditingService({ ...editingService, description: e.target.value })
                      }
                      className="w-full px-3.5 py-2 text-sm bg-[#F7F5F0] border border-[#E0DDD5] rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5">
                      Service Deliverables / Sub-items (one per line)
                    </label>
                    <textarea
                      rows={5}
                      value={serviceDetailsInput}
                      onChange={(e) => setServiceDetailsInput(e.target.value)}
                      className="w-full px-3.5 py-2 text-sm bg-[#F7F5F0] border border-[#E0DDD5] rounded-lg"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold mb-1.5">Cover Image URL</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={editingService.image || ''}
                          onChange={(e) =>
                            setEditingService({ ...editingService, image: e.target.value })
                          }
                          className="flex-1 px-3.5 py-2 text-sm bg-[#F7F5F0] border border-[#E0DDD5] rounded-lg"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setMediaPickerTarget(() => (url: string) =>
                              setEditingService((s) => (s ? { ...s, image: url } : s))
                            )
                          }
                          className="px-3 py-2 text-xs font-semibold bg-[#EFECE6] rounded-lg cursor-pointer"
                        >
                          Pick
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1.5">CTA Button Label</label>
                      <input
                        type="text"
                        value={editingService.cta_label || ''}
                        onChange={(e) =>
                          setEditingService({ ...editingService, cta_label: e.target.value })
                        }
                        className="w-full px-3.5 py-2 text-sm bg-[#F7F5F0] border border-[#E0DDD5] rounded-lg"
                      />
                    </div>
                  </div>
                  <label className="inline-flex items-center gap-2 text-xs font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingService.is_published !== false}
                      onChange={(e) =>
                        setEditingService({ ...editingService, is_published: e.target.checked })
                      }
                    />
                    Published on Website
                  </label>
                  <div>
                    <button
                      type="submit"
                      disabled={saving}
                      className="px-5 py-2.5 text-xs font-semibold text-white bg-[#1B5E4A] rounded-lg cursor-pointer"
                    >
                      Save Service
                    </button>
                  </div>
                </form>
              )}

              <div className="bg-[#FFFFFF] border border-[#E0DDD5] rounded-2xl divide-y divide-[#E0DDD5]">
                {services.map((s) => (
                  <div
                    key={s.id}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div>
                      <p className="text-sm font-bold text-[#181A18]">{s.title}</p>
                      <p className="text-xs text-[#5A5E58]">
                        {s.category} · {s.details.length} items ·{' '}
                        {s.is_published ? 'Published' : 'Hidden'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          await fetch(`/api/admin/services/${s.id}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ is_published: !s.is_published }),
                          });
                          await loadAllAdminData();
                          onDataUpdated();
                        }}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[#E0DDD5] cursor-pointer"
                      >
                        {s.is_published ? 'Unpublish' : 'Publish'}
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditService(s)}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg bg-[#EFECE6] cursor-pointer"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeleteService(s.id)}
                        className="p-2 text-[#991B1B] hover:bg-[#FEF2F2] rounded-lg cursor-pointer"
                        aria-label={`Delete ${s.title}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* MODULE: STATS & SKILLS */}
          {activeTab === 'stats_skills' && (
            <div className="space-y-10">
              {/* Stats Section */}
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold">Public Stats & Odometers ({statsList.length})</h2>
                    <p className="text-xs text-[#5A5E58]">
                      Edit numbers, suffixes (+, %, K, °), labels, and rolling odometer styles.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setEditingStat({
                        number_value: 0,
                        suffix: '+',
                        label: '',
                        detail: '',
                        use_odometer: true,
                        is_published: true,
                      })
                    }
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#1B5E4A] rounded-lg cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    Add Stat
                  </button>
                </div>

                {editingStat && (
                  <form
                    onSubmit={handleSaveStat}
                    className="bg-[#FFFFFF] border border-[#E0DDD5] rounded-2xl p-6 space-y-4"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-semibold mb-1.5">Number Value *</label>
                        <input
                          type="number"
                          step="any"
                          required
                          value={editingStat.number_value ?? 0}
                          onChange={(e) =>
                            setEditingStat({ ...editingStat, number_value: Number(e.target.value) })
                          }
                          className="w-full px-3.5 py-2 text-sm bg-[#F7F5F0] border border-[#E0DDD5] rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold mb-1.5">Suffix (+, %, K)</label>
                        <input
                          type="text"
                          value={editingStat.suffix || ''}
                          onChange={(e) =>
                            setEditingStat({ ...editingStat, suffix: e.target.value })
                          }
                          className="w-full px-3.5 py-2 text-sm bg-[#F7F5F0] border border-[#E0DDD5] rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold mb-1.5">Stat Label *</label>
                        <input
                          type="text"
                          required
                          value={editingStat.label || ''}
                          onChange={(e) =>
                            setEditingStat({ ...editingStat, label: e.target.value })
                          }
                          className="w-full px-3.5 py-2 text-sm bg-[#F7F5F0] border border-[#E0DDD5] rounded-lg"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1.5">Supporting Detail</label>
                      <input
                        type="text"
                        value={editingStat.detail || ''}
                        onChange={(e) =>
                          setEditingStat({ ...editingStat, detail: e.target.value })
                        }
                        className="w-full px-3.5 py-2 text-sm bg-[#F7F5F0] border border-[#E0DDD5] rounded-lg"
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-6 text-xs font-medium">
                      <label className="inline-flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editingStat.use_odometer !== false}
                          onChange={(e) =>
                            setEditingStat({ ...editingStat, use_odometer: e.target.checked })
                          }
                        />
                        Use Odometer Digit Roll
                      </label>
                      <label className="inline-flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editingStat.is_published !== false}
                          onChange={(e) =>
                            setEditingStat({ ...editingStat, is_published: e.target.checked })
                          }
                        />
                        Published on Website
                      </label>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        type="submit"
                        disabled={saving}
                        className="px-4 py-2 text-xs font-semibold text-white bg-[#1B5E4A] rounded-lg cursor-pointer"
                      >
                        Save Stat
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingStat(null)}
                        className="text-xs text-[#5A5E58] cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}

                <div className="bg-[#FFFFFF] border border-[#E0DDD5] rounded-2xl divide-y divide-[#E0DDD5]">
                  {statsList.map((st) => (
                    <div key={st.id} className="p-4 flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-bold text-[#181A18]">
                          <span className="font-mono-tabular text-[#1B5E4A] mr-2">
                            {st.number_value}
                            {st.suffix}
                          </span>
                          {st.label}
                        </p>
                        <p className="text-xs text-[#5A5E58]">
                          {st.use_odometer ? 'Odometer' : 'Counter'} ·{' '}
                          {st.is_published ? 'Published' : 'Hidden'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingStat(st)}
                          className="px-3 py-1.5 text-xs bg-[#EFECE6] rounded-lg cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await fetch(`/api/admin/stats/${st.id}`, { method: 'DELETE' });
                            await loadAllAdminData();
                            onDataUpdated();
                          }}
                          className="p-2 text-[#991B1B] hover:bg-[#FEF2F2] rounded-lg cursor-pointer"
                          aria-label={`Delete ${st.label}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Skills Section */}
              <div className="space-y-5 pt-6 border-t border-[#E0DDD5]">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold">Skills & Progress Rings ({skillsList.length})</h2>
                    <p className="text-xs text-[#5A5E58]">
                      Displayed with animated SVG rings and progress bars on the public site.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setEditingSkill({
                        name: '',
                        category: 'Strategy',
                        proficiency: 90,
                        metric_label: '',
                        is_published: true,
                      })
                    }
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#1B5E4A] rounded-lg cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    Add Skill
                  </button>
                </div>

                {editingSkill && (
                  <form
                    onSubmit={handleSaveSkill}
                    className="bg-[#FFFFFF] border border-[#E0DDD5] rounded-2xl p-6 space-y-4"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-semibold mb-1.5">Skill Name *</label>
                        <input
                          type="text"
                          required
                          value={editingSkill.name || ''}
                          onChange={(e) =>
                            setEditingSkill({ ...editingSkill, name: e.target.value })
                          }
                          className="w-full px-3.5 py-2 text-sm bg-[#F7F5F0] border border-[#E0DDD5] rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold mb-1.5">Category</label>
                        <input
                          type="text"
                          value={editingSkill.category || ''}
                          onChange={(e) =>
                            setEditingSkill({ ...editingSkill, category: e.target.value })
                          }
                          className="w-full px-3.5 py-2 text-sm bg-[#F7F5F0] border border-[#E0DDD5] rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold mb-1.5">Proficiency (0-100)</label>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={editingSkill.proficiency ?? 85}
                          onChange={(e) =>
                            setEditingSkill({
                              ...editingSkill,
                              proficiency: Number(e.target.value),
                            })
                          }
                          className="w-full px-3.5 py-2 text-sm bg-[#F7F5F0] border border-[#E0DDD5] rounded-lg"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1.5">Focus Subtitle</label>
                      <input
                        type="text"
                        value={editingSkill.metric_label || ''}
                        onChange={(e) =>
                          setEditingSkill({ ...editingSkill, metric_label: e.target.value })
                        }
                        className="w-full px-3.5 py-2 text-sm bg-[#F7F5F0] border border-[#E0DDD5] rounded-lg"
                      />
                    </div>
                    <div className="flex items-center gap-4">
                      <button
                        type="submit"
                        disabled={saving}
                        className="px-4 py-2 text-xs font-semibold text-white bg-[#1B5E4A] rounded-lg cursor-pointer"
                      >
                        Save Skill
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingSkill(null)}
                        className="text-xs text-[#5A5E58] cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}

                <div className="bg-[#FFFFFF] border border-[#E0DDD5] rounded-2xl divide-y divide-[#E0DDD5]">
                  {skillsList.map((sk) => (
                    <div key={sk.id} className="p-4 flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-bold text-[#181A18]">{sk.name}</p>
                        <p className="text-xs text-[#5A5E58]">
                          {sk.category} · {sk.proficiency}% · {sk.is_published ? 'Published' : 'Hidden'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingSkill(sk)}
                          className="px-3 py-1.5 text-xs bg-[#EFECE6] rounded-lg cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await fetch(`/api/admin/skills/${sk.id}`, { method: 'DELETE' });
                            await loadAllAdminData();
                            onDataUpdated();
                          }}
                          className="p-2 text-[#991B1B] hover:bg-[#FEF2F2] rounded-lg cursor-pointer"
                          aria-label={`Delete ${sk.name}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* MODULE: EXPERIENCE & CERTIFICATIONS */}
          {activeTab === 'experience_certs' && (
            <div className="space-y-10">
              {/* Experience Timeline */}
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold">Experience Timeline ({experiences.length})</h2>
                    <p className="text-xs text-[#5A5E58]">
                      Keep all experience and ongoing academic milestones factually accurate.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingExperience({
                        role_title: '',
                        organization: '',
                        period: '',
                        location: '',
                        description: '',
                        is_published: true,
                      });
                      setExpHighlightsInput('');
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#1B5E4A] rounded-lg cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    Add Experience
                  </button>
                </div>

                {editingExperience && (
                  <form
                    onSubmit={handleSaveExperience}
                    className="bg-[#FFFFFF] border border-[#E0DDD5] rounded-2xl p-6 space-y-4"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold mb-1.5">Role / Degree Title *</label>
                        <input
                          type="text"
                          required
                          value={editingExperience.role_title || ''}
                          onChange={(e) =>
                            setEditingExperience({ ...editingExperience, role_title: e.target.value })
                          }
                          className="w-full px-3.5 py-2 text-sm bg-[#F7F5F0] border border-[#E0DDD5] rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold mb-1.5">Organization / Institution *</label>
                        <input
                          type="text"
                          required
                          value={editingExperience.organization || ''}
                          onChange={(e) =>
                            setEditingExperience({ ...editingExperience, organization: e.target.value })
                          }
                          className="w-full px-3.5 py-2 text-sm bg-[#F7F5F0] border border-[#E0DDD5] rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold mb-1.5">Period</label>
                        <input
                          type="text"
                          value={editingExperience.period || ''}
                          onChange={(e) =>
                            setEditingExperience({ ...editingExperience, period: e.target.value })
                          }
                          placeholder="e.g. Ongoing or 2024 - Present"
                          className="w-full px-3.5 py-2 text-sm bg-[#F7F5F0] border border-[#E0DDD5] rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold mb-1.5">Location</label>
                        <input
                          type="text"
                          value={editingExperience.location || ''}
                          onChange={(e) =>
                            setEditingExperience({ ...editingExperience, location: e.target.value })
                          }
                          className="w-full px-3.5 py-2 text-sm bg-[#F7F5F0] border border-[#E0DDD5] rounded-lg"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1.5">Description</label>
                      <textarea
                        rows={3}
                        value={editingExperience.description || ''}
                        onChange={(e) =>
                          setEditingExperience({ ...editingExperience, description: e.target.value })
                        }
                        className="w-full px-3.5 py-2 text-sm bg-[#F7F5F0] border border-[#E0DDD5] rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1.5">
                        Key Highlights (one per line)
                      </label>
                      <textarea
                        rows={3}
                        value={expHighlightsInput}
                        onChange={(e) => setExpHighlightsInput(e.target.value)}
                        className="w-full px-3.5 py-2 text-sm bg-[#F7F5F0] border border-[#E0DDD5] rounded-lg"
                      />
                    </div>
                    <div className="flex items-center gap-4">
                      <button
                        type="submit"
                        disabled={saving}
                        className="px-4 py-2 text-xs font-semibold text-white bg-[#1B5E4A] rounded-lg cursor-pointer"
                      >
                        Save Experience
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingExperience(null)}
                        className="text-xs text-[#5A5E58] cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}

                <div className="bg-[#FFFFFF] border border-[#E0DDD5] rounded-2xl divide-y divide-[#E0DDD5]">
                  {experiences.map((ex) => (
                    <div key={ex.id} className="p-4 flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-bold">{ex.role_title}</p>
                        <p className="text-xs text-[#5A5E58]">
                          {ex.organization} · {ex.period} · {ex.is_published ? 'Published' : 'Hidden'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingExperience(ex);
                            setExpHighlightsInput((ex.highlights || []).join('\n'));
                          }}
                          className="px-3 py-1.5 text-xs bg-[#EFECE6] rounded-lg cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await fetch(`/api/admin/experiences/${ex.id}`, { method: 'DELETE' });
                            await loadAllAdminData();
                            onDataUpdated();
                          }}
                          className="p-2 text-[#991B1B] hover:bg-[#FEF2F2] rounded-lg cursor-pointer"
                          aria-label={`Delete ${ex.role_title}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Certifications */}
              <div className="space-y-5 pt-6 border-t border-[#E0DDD5]">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold">Verified Certifications ({certifications.length})</h2>
                    <p className="text-xs text-[#5A5E58]">
                      Add genuine verified certificates and credential URLs.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setEditingCertification({
                        title: '',
                        issuer: '',
                        issue_date: '',
                        credential_id: '',
                        credential_url: '',
                        description: '',
                        is_published: true,
                      })
                    }
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#1B5E4A] rounded-lg cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    Add Certification
                  </button>
                </div>

                {editingCertification && (
                  <form
                    onSubmit={handleSaveCertification}
                    className="bg-[#FFFFFF] border border-[#E0DDD5] rounded-2xl p-6 space-y-4"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold mb-1.5">Certification Title *</label>
                        <input
                          type="text"
                          required
                          value={editingCertification.title || ''}
                          onChange={(e) =>
                            setEditingCertification({ ...editingCertification, title: e.target.value })
                          }
                          className="w-full px-3.5 py-2 text-sm bg-[#F7F5F0] border border-[#E0DDD5] rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold mb-1.5">Issuing Organization *</label>
                        <input
                          type="text"
                          required
                          value={editingCertification.issuer || ''}
                          onChange={(e) =>
                            setEditingCertification({ ...editingCertification, issuer: e.target.value })
                          }
                          className="w-full px-3.5 py-2 text-sm bg-[#F7F5F0] border border-[#E0DDD5] rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold mb-1.5">Issue Date</label>
                        <input
                          type="text"
                          value={editingCertification.issue_date || ''}
                          onChange={(e) =>
                            setEditingCertification({ ...editingCertification, issue_date: e.target.value })
                          }
                          className="w-full px-3.5 py-2 text-sm bg-[#F7F5F0] border border-[#E0DDD5] rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold mb-1.5">Credential ID</label>
                        <input
                          type="text"
                          value={editingCertification.credential_id || ''}
                          onChange={(e) =>
                            setEditingCertification({ ...editingCertification, credential_id: e.target.value })
                          }
                          className="w-full px-3.5 py-2 text-sm bg-[#F7F5F0] border border-[#E0DDD5] rounded-lg"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1.5">Verification URL</label>
                      <input
                        type="url"
                        value={editingCertification.credential_url || ''}
                        onChange={(e) =>
                          setEditingCertification({ ...editingCertification, credential_url: e.target.value })
                        }
                        className="w-full px-3.5 py-2 text-sm bg-[#F7F5F0] border border-[#E0DDD5] rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1.5">Description</label>
                      <textarea
                        rows={2}
                        value={editingCertification.description || ''}
                        onChange={(e) =>
                          setEditingCertification({ ...editingCertification, description: e.target.value })
                        }
                        className="w-full px-3.5 py-2 text-sm bg-[#F7F5F0] border border-[#E0DDD5] rounded-lg"
                      />
                    </div>
                    <div className="flex items-center gap-4">
                      <button
                        type="submit"
                        disabled={saving}
                        className="px-4 py-2 text-xs font-semibold text-white bg-[#1B5E4A] rounded-lg cursor-pointer"
                      >
                        Save Certification
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingCertification(null)}
                        className="text-xs text-[#5A5E58] cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}

                <div className="bg-[#FFFFFF] border border-[#E0DDD5] rounded-2xl divide-y divide-[#E0DDD5]">
                  {certifications.length === 0 ? (
                    <p className="p-8 text-center text-sm text-[#5A5E58]">
                      No certifications added yet. Click "Add Certification" to publish verified credentials.
                    </p>
                  ) : (
                    certifications.map((cert) => (
                      <div key={cert.id} className="p-4 flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-bold">{cert.title}</p>
                          <p className="text-xs text-[#5A5E58]">
                            {cert.issuer} {cert.issue_date ? `· ${cert.issue_date}` : ''} ·{' '}
                            {cert.is_published ? 'Published' : 'Hidden'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingCertification(cert)}
                            className="px-3 py-1.5 text-xs bg-[#EFECE6] rounded-lg cursor-pointer"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              await fetch(`/api/admin/certifications/${cert.id}`, { method: 'DELETE' });
                              await loadAllAdminData();
                              onDataUpdated();
                            }}
                            className="p-2 text-[#991B1B] hover:bg-[#FEF2F2] rounded-lg cursor-pointer"
                            aria-label={`Delete ${cert.title}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* MODULE: GITHUB & OPEN SOURCE */}
          {activeTab === 'github' && settings && (
            <div className="space-y-6">
              <div className="bg-[#FFFFFF] border border-[#E0DDD5] rounded-2xl p-6 space-y-4">
                <h2 className="text-base font-bold">GitHub Profile & Public API Sync</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold mb-1.5">GitHub Username</label>
                    <input
                      type="text"
                      placeholder="e.g. your-github-handle"
                      value={settings.github_username}
                      onChange={(e) =>
                        setSettings({ ...settings, github_username: e.target.value })
                      }
                      className="w-full px-3.5 py-2 text-sm bg-[#F7F5F0] border border-[#E0DDD5] rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5">
                      GitHub Profile URL
                    </label>
                    <input
                      type="url"
                      placeholder="https://github.com/..."
                      value={settings.github_profile_url}
                      onChange={(e) =>
                        setSettings({ ...settings, github_profile_url: e.target.value })
                      }
                      className="w-full px-3.5 py-2 text-sm bg-[#F7F5F0] border border-[#E0DDD5] rounded-lg"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => void handleSaveSettings()}
                    className="px-4 py-2 text-xs font-semibold text-white bg-[#1B5E4A] rounded-lg cursor-pointer"
                  >
                    Save GitHub Settings
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleFetchGithubPublic()}
                    disabled={fetchingRepos}
                    className="px-4 py-2 text-xs font-semibold text-[#181A18] bg-[#EFECE6] hover:bg-[#E0DDD5] rounded-lg cursor-pointer"
                  >
                    {fetchingRepos ? 'Fetching...' : 'Fetch Public Repositories'}
                  </button>
                </div>

                {fetchedPublicRepos.length > 0 && (
                  <div className="pt-4 border-t border-[#E0DDD5] space-y-2">
                    <p className="text-xs font-semibold text-[#5A5E58]">
                      Available Public Repositories (click Import to feature):
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {fetchedPublicRepos.map((repo) => (
                        <div
                          key={repo.id}
                          className="p-3 rounded-lg border border-[#E0DDD5] bg-[#F7F5F0] flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-bold truncate">{repo.repo_name}</p>
                            <p className="text-[11px] text-[#5A5E58] truncate">
                              {repo.language || 'Code'} · {repo.description}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => void handleImportGithubRepo(repo)}
                            className="px-2.5 py-1 text-xs font-semibold text-white bg-[#181A18] rounded cursor-pointer shrink-0"
                          >
                            Import
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold">
                  Curated GitHub Projects ({githubProjects.length})
                </h3>
                <button
                  type="button"
                  onClick={() =>
                    setEditingGithub({
                      repo_name: '',
                      description: '',
                      language: '',
                      repo_url: '',
                      live_url: '',
                      docs_url: '',
                      preview_image: '',
                      is_featured: true,
                      is_published: true,
                    })
                  }
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#1B5E4A] rounded-lg cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  Add Repository Manually
                </button>
              </div>

              {editingGithub && (
                <form
                  onSubmit={handleSaveGithubProject}
                  className="bg-[#FFFFFF] border border-[#E0DDD5] rounded-2xl p-6 space-y-4"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold mb-1.5">
                        Repository Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={editingGithub.repo_name || ''}
                        onChange={(e) =>
                          setEditingGithub({ ...editingGithub, repo_name: e.target.value })
                        }
                        className="w-full px-3.5 py-2 text-sm bg-[#F7F5F0] border border-[#E0DDD5] rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1.5">
                        Primary Language
                      </label>
                      <input
                        type="text"
                        value={editingGithub.language || ''}
                        onChange={(e) =>
                          setEditingGithub({ ...editingGithub, language: e.target.value })
                        }
                        className="w-full px-3.5 py-2 text-sm bg-[#F7F5F0] border border-[#E0DDD5] rounded-lg"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5">Description</label>
                    <textarea
                      rows={2}
                      value={editingGithub.description || ''}
                      onChange={(e) =>
                        setEditingGithub({ ...editingGithub, description: e.target.value })
                      }
                      className="w-full px-3.5 py-2 text-sm bg-[#F7F5F0] border border-[#E0DDD5] rounded-lg"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold mb-1.5">Repository URL</label>
                      <input
                        type="url"
                        value={editingGithub.repo_url || ''}
                        onChange={(e) =>
                          setEditingGithub({ ...editingGithub, repo_url: e.target.value })
                        }
                        className="w-full px-3.5 py-2 text-sm bg-[#F7F5F0] border border-[#E0DDD5] rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1.5">
                        Live Deployment URL
                      </label>
                      <input
                        type="url"
                        value={editingGithub.live_url || ''}
                        onChange={(e) =>
                          setEditingGithub({ ...editingGithub, live_url: e.target.value })
                        }
                        className="w-full px-3.5 py-2 text-sm bg-[#F7F5F0] border border-[#E0DDD5] rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1.5">
                        Documentation URL
                      </label>
                      <input
                        type="url"
                        value={editingGithub.docs_url || ''}
                        onChange={(e) =>
                          setEditingGithub({ ...editingGithub, docs_url: e.target.value })
                        }
                        className="w-full px-3.5 py-2 text-sm bg-[#F7F5F0] border border-[#E0DDD5] rounded-lg"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <button
                      type="submit"
                      className="px-4 py-2 text-xs font-semibold text-white bg-[#1B5E4A] rounded-lg cursor-pointer"
                    >
                      Save Repository
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingGithub(null)}
                      className="px-4 py-2 text-xs font-medium text-[#5A5E58] cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              <div className="bg-[#FFFFFF] border border-[#E0DDD5] rounded-2xl divide-y divide-[#E0DDD5]">
                {githubProjects.length === 0 ? (
                  <p className="p-8 text-center text-sm text-[#5A5E58]">
                    No GitHub repositories added yet.
                  </p>
                ) : (
                  githubProjects.map((g) => (
                    <div key={g.id} className="p-4 flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-bold">{g.repo_name}</p>
                        <p className="text-xs text-[#5A5E58]">
                          {g.language || 'Code'} · {g.is_published ? 'Published' : 'Hidden'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingGithub(g)}
                          className="px-3 py-1.5 text-xs font-medium bg-[#EFECE6] rounded-lg cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await fetch(`/api/admin/github-projects/${g.id}`, {
                              method: 'DELETE',
                            });
                            await loadAllAdminData();
                            onDataUpdated();
                          }}
                          className="p-2 text-[#991B1B] hover:bg-[#FEF2F2] rounded-lg cursor-pointer"
                          aria-label={`Delete ${g.repo_name}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* MODULE: CONTACT MESSAGES */}
          {activeTab === 'messages' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-1.5">
                  {['all', 'unread', 'read', 'pending', 'contacted', 'archived'].map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setMessageStatusFilter(status)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg capitalize cursor-pointer ${
                        messageStatusFilter === status
                          ? 'bg-[#181A18] text-white'
                          : 'bg-[#FFFFFF] border border-[#E0DDD5] text-[#5A5E58]'
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-[#5A5E58] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="search"
                      value={messageSearch}
                      onChange={(e) => setMessageSearch(e.target.value)}
                      placeholder="Search inquiries..."
                      className="pl-8 pr-3 py-1.5 text-xs bg-[#FFFFFF] border border-[#E0DDD5] rounded-lg"
                    />
                  </div>
                  <a
                    href="/api/admin/messages/export"
                    download="contact-inquiries.csv"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#1B5E4A] hover:bg-[#144738] rounded-lg whitespace-nowrap"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Export CSV
                  </a>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className="lg:col-span-7 bg-[#FFFFFF] border border-[#E0DDD5] rounded-2xl divide-y divide-[#E0DDD5]">
                  {filteredMessages.length === 0 ? (
                    <p className="p-10 text-center text-sm text-[#5A5E58]">
                      No contact messages match your current filter.
                    </p>
                  ) : (
                    filteredMessages.map((m) => (
                      <div
                        key={m.id}
                        onClick={() => {
                          setSelectedMessage(m);
                          if (m.status === 'unread') {
                            void handleUpdateMessageStatus(m.id, 'read');
                          }
                        }}
                        className={`p-4 cursor-pointer transition-colors ${
                          selectedMessage?.id === m.id ? 'bg-[#EFECE6]/70' : 'hover:bg-[#F7F5F0]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-bold text-[#181A18]">{m.full_name}</p>
                          <span className="text-xs font-mono-tabular text-[#5A5E58] capitalize">
                            {m.status} · {m.created_at.split('T')[0]}
                          </span>
                        </div>
                        <p className="text-xs text-[#5A5E58] mt-0.5">
                          {m.email} {m.subject ? `· ${m.subject}` : m.service ? `· ${m.service}` : ''}
                        </p>
                        <p className="text-xs text-[#181A18] mt-2 line-clamp-2">{m.message}</p>
                      </div>
                    ))
                  )}
                </div>

                <div className="lg:col-span-5 bg-[#FFFFFF] border border-[#E0DDD5] rounded-2xl p-6">
                  {selectedMessage ? (
                    <div className="space-y-5">
                      <div className="border-b border-[#E0DDD5] pb-4">
                        <p className="text-xs font-mono-tabular text-[#5A5E58] capitalize">
                          Status: {selectedMessage.status} ·{' '}
                          {new Date(selectedMessage.created_at).toLocaleString()}
                        </p>
                        <h3 className="text-lg font-bold mt-1">{selectedMessage.full_name}</h3>
                        <p className="text-xs text-[#1B5E4A] font-medium">
                          {selectedMessage.email}
                          {selectedMessage.phone ? ` · ${selectedMessage.phone}` : ''}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <p className="text-[#5A5E58]">Subject / Service</p>
                          <p className="font-semibold mt-0.5">
                            {selectedMessage.subject || selectedMessage.service || 'Not specified'}
                          </p>
                        </div>
                        <div>
                          <p className="text-[#5A5E58]">Budget</p>
                          <p className="font-semibold mt-0.5">
                            {selectedMessage.budget || 'Not specified'}
                          </p>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-[#E0DDD5]">
                        <p className="text-xs text-[#5A5E58] mb-1.5">Message</p>
                        <p className="text-sm text-[#181A18] whitespace-pre-line leading-relaxed">
                          {selectedMessage.message}
                        </p>
                      </div>

                      <div className="pt-4 border-t border-[#E0DDD5] space-y-3">
                        <p className="text-xs font-semibold text-[#5A5E58]">Update Status</p>
                        <div className="flex flex-wrap gap-2">
                          {(['unread', 'read', 'pending', 'contacted', 'archived'] as MessageStatus[]).map(
                            (st) => (
                              <button
                                key={st}
                                type="button"
                                onClick={() =>
                                  void handleUpdateMessageStatus(selectedMessage.id, st)
                                }
                                className={`px-2.5 py-1.5 text-xs font-medium rounded-lg capitalize cursor-pointer ${
                                  selectedMessage.status === st
                                    ? 'bg-[#1B5E4A] text-white'
                                    : 'bg-[#F7F5F0] border border-[#E0DDD5] text-[#181A18]'
                                }`}
                              >
                                {st}
                              </button>
                            )
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleDeleteMessage(selectedMessage.id)}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#991B1B] hover:underline pt-2 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Delete Inquiry
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-[#5A5E58] text-center py-12">
                      Select an inquiry from the list to inspect full details and update its status.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* MODULE: TESTIMONIALS */}
          {activeTab === 'testimonials' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold">Testimonials ({testimonials.length})</h2>
                <button
                  type="button"
                  onClick={() =>
                    setEditingTestimonial({
                      customer_name: '',
                      customer_role: '',
                      review: '',
                      customer_image: '',
                      is_published: true,
                    })
                  }
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#1B5E4A] rounded-lg cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  Add Testimonial
                </button>
              </div>

              {editingTestimonial && (
                <form
                  onSubmit={handleSaveTestimonial}
                  className="bg-[#FFFFFF] border border-[#E0DDD5] rounded-2xl p-6 space-y-4"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold mb-1.5">Customer Name *</label>
                      <input
                        type="text"
                        required
                        value={editingTestimonial.customer_name || ''}
                        onChange={(e) =>
                          setEditingTestimonial({
                            ...editingTestimonial,
                            customer_name: e.target.value,
                          })
                        }
                        className="w-full px-3.5 py-2 text-sm bg-[#F7F5F0] border border-[#E0DDD5] rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1.5">
                        Role / Organization
                      </label>
                      <input
                        type="text"
                        value={editingTestimonial.customer_role || ''}
                        onChange={(e) =>
                          setEditingTestimonial({
                            ...editingTestimonial,
                            customer_role: e.target.value,
                          })
                        }
                        className="w-full px-3.5 py-2 text-sm bg-[#F7F5F0] border border-[#E0DDD5] rounded-lg"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5">Customer Photo URL</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={editingTestimonial.customer_image || ''}
                        onChange={(e) =>
                          setEditingTestimonial({
                            ...editingTestimonial,
                            customer_image: e.target.value,
                          })
                        }
                        className="flex-1 px-3.5 py-2 text-sm bg-[#F7F5F0] border border-[#E0DDD5] rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setMediaPickerTarget(() => (url: string) =>
                            setEditingTestimonial((t) =>
                              t ? { ...t, customer_image: url } : t
                            )
                          )
                        }
                        className="px-3 py-2 text-xs font-semibold bg-[#EFECE6] rounded-lg cursor-pointer"
                      >
                        Pick
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5">Review Quote *</label>
                    <textarea
                      rows={3}
                      required
                      value={editingTestimonial.review || ''}
                      onChange={(e) =>
                        setEditingTestimonial({ ...editingTestimonial, review: e.target.value })
                      }
                      className="w-full px-3.5 py-2 text-sm bg-[#F7F5F0] border border-[#E0DDD5] rounded-lg"
                    />
                  </div>
                  <div className="flex items-center gap-4">
                    <button
                      type="submit"
                      className="px-4 py-2 text-xs font-semibold text-white bg-[#1B5E4A] rounded-lg cursor-pointer"
                    >
                      Save Testimonial
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingTestimonial(null)}
                      className="text-xs text-[#5A5E58] cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              <div className="bg-[#FFFFFF] border border-[#E0DDD5] rounded-2xl divide-y divide-[#E0DDD5]">
                {testimonials.length === 0 ? (
                  <p className="p-8 text-center text-sm text-[#5A5E58]">
                    No testimonials added yet. Add verified client feedback above.
                  </p>
                ) : (
                  testimonials.map((t) => (
                    <div key={t.id} className="p-4 flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-bold">{t.customer_name}</p>
                        <p className="text-xs text-[#5A5E58] line-clamp-1">{t.review}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            await fetch(`/api/admin/testimonials/${t.id}`, {
                              method: 'PUT',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ is_published: !t.is_published }),
                            });
                            await loadAllAdminData();
                            onDataUpdated();
                          }}
                          className="px-3 py-1.5 text-xs border border-[#E0DDD5] rounded-lg cursor-pointer"
                        >
                          {t.is_published ? 'Unpublish' : 'Publish'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingTestimonial(t)}
                          className="px-3 py-1.5 text-xs bg-[#EFECE6] rounded-lg cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await fetch(`/api/admin/testimonials/${t.id}`, { method: 'DELETE' });
                            await loadAllAdminData();
                            onDataUpdated();
                          }}
                          className="p-2 text-[#991B1B] hover:bg-[#FEF2F2] rounded-lg cursor-pointer"
                          aria-label={`Delete ${t.customer_name}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* MODULE: MEDIA LIBRARY */}
          {activeTab === 'media' && (
            <div className="space-y-6">
              <div className="bg-[#FFFFFF] border border-[#E0DDD5] rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold">Media Library ({mediaFiles.length})</h2>
                  <p className="text-xs text-[#5A5E58] mt-1">
                    Upload JPG, PNG, WebP, GIF, MP4, WebM, or PDF files (max 20MB).
                  </p>
                </div>
                <label className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-[#1B5E4A] hover:bg-[#144738] rounded-lg cursor-pointer">
                  <Upload className="w-4 h-4" />
                  {uploadingMedia ? 'Uploading...' : 'Upload File'}
                  <input
                    type="file"
                    accept="image/*,video/mp4,video/webm,application/pdf"
                    onChange={(e) => void handleFileUpload(e)}
                    className="hidden"
                  />
                </label>
              </div>

              <GoogleDriveMediaImporter
                onImported={(imported) =>
                  setMediaFiles((prev) => [...imported, ...prev])
                }
                onToast={showToast}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {mediaFiles.map((file) => (
                  <div
                    key={file.id}
                    className="bg-[#FFFFFF] border border-[#E0DDD5] rounded-xl overflow-hidden flex flex-col"
                  >
                    <div className="aspect-[16/10] bg-[#EFECE6] overflow-hidden flex items-center justify-center">
                      {file.file_type.startsWith('video/') ? (
                        <video src={file.file_url} controls className="w-full h-full object-cover" />
                      ) : file.file_type === 'application/pdf' ? (
                        <span className="text-xs font-semibold text-[#5A5E58]">PDF Document</span>
                      ) : (
                        <ResilientImage
                          src={file.file_url}
                          alt={file.file_name}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                    <div className="p-4 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold truncate">{file.file_name}</p>
                        <p className="text-[11px] font-mono-tabular text-[#5A5E58]">
                          {file.file_type}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard?.writeText(file.file_url);
                            setCopiedUrl(file.file_url);
                            window.setTimeout(() => setCopiedUrl(''), 1500);
                          }}
                          className="p-2 text-[#5A5E58] hover:text-[#181A18] rounded-lg cursor-pointer"
                          title="Copy file URL"
                        >
                          {copiedUrl === file.file_url ? (
                            <Check className="w-3.5 h-3.5 text-[#1B5E4A]" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await fetch(`/api/admin/media/${file.id}`, { method: 'DELETE' });
                            setMediaFiles((prev) => prev.filter((m) => m.id !== file.id));
                          }}
                          className="p-2 text-[#991B1B] hover:bg-[#FEF2F2] rounded-lg cursor-pointer"
                          aria-label={`Delete ${file.file_name}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* MODULE: SETTINGS & SOCIAL LINKS */}
          {activeTab === 'settings' && settings && (
            <div className="space-y-8">
              <form
                onSubmit={handleSaveSettings}
                className="bg-[#FFFFFF] border border-[#E0DDD5] rounded-2xl p-6 space-y-5"
              >
                <div className="flex items-center justify-between border-b border-[#E0DDD5] pb-4">
                  <h2 className="text-base font-bold">Contact, Branding, CV & SEO Settings</h2>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 text-xs font-semibold text-white bg-[#1B5E4A] rounded-lg cursor-pointer"
                  >
                    Save Settings
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold mb-1.5">Phone Number</label>
                    <input
                      type="text"
                      value={settings.phone}
                      onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                      className="w-full px-3.5 py-2 text-sm bg-[#F7F5F0] border border-[#E0DDD5] rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5">WhatsApp Number</label>
                    <input
                      type="text"
                      value={settings.whatsapp}
                      onChange={(e) => setSettings({ ...settings, whatsapp: e.target.value })}
                      className="w-full px-3.5 py-2 text-sm bg-[#F7F5F0] border border-[#E0DDD5] rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5">Email Address</label>
                    <input
                      type="email"
                      value={settings.email}
                      onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                      className="w-full px-3.5 py-2 text-sm bg-[#F7F5F0] border border-[#E0DDD5] rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5">Accent Theme Color</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={settings.accent_color || '#1B5E4A'}
                        onChange={(e) =>
                          setSettings({ ...settings, accent_color: e.target.value })
                        }
                        className="h-9 w-12 rounded border border-[#E0DDD5] bg-white cursor-pointer"
                      />
                      <input
                        type="text"
                        value={settings.accent_color}
                        onChange={(e) =>
                          setSettings({ ...settings, accent_color: e.target.value })
                        }
                        className="flex-1 px-3.5 py-2 text-sm font-mono-tabular bg-[#F7F5F0] border border-[#E0DDD5] rounded-lg"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1.5">Address / Location</label>
                  <input
                    type="text"
                    value={settings.address}
                    onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm bg-[#F7F5F0] border border-[#E0DDD5] rounded-lg"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold mb-1.5">Logo Image URL</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={settings.logo_url}
                        onChange={(e) => setSettings({ ...settings, logo_url: e.target.value })}
                        className="flex-1 px-3.5 py-2 text-sm bg-[#F7F5F0] border border-[#E0DDD5] rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setMediaPickerTarget(() => (url: string) =>
                            setSettings((s) => (s ? { ...s, logo_url: url } : s))
                          )
                        }
                        className="px-3 py-2 text-xs font-semibold bg-[#EFECE6] rounded-lg cursor-pointer"
                      >
                        Pick
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5">CV PDF URL</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={settings.cv_url}
                        onChange={(e) => setSettings({ ...settings, cv_url: e.target.value })}
                        className="flex-1 px-3.5 py-2 text-sm bg-[#F7F5F0] border border-[#E0DDD5] rounded-lg"
                      />
                      <label className="px-3 py-2 text-xs font-semibold bg-[#EFECE6] rounded-lg cursor-pointer">
                        Upload PDF
                        <input
                          type="file"
                          accept="application/pdf"
                          onChange={(e) =>
                            void handleFileUpload(e, (file) =>
                              setSettings((s) => (s ? { ...s, cv_url: file.file_url } : s))
                            )
                          }
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-[#E0DDD5] space-y-4">
                  <h3 className="text-sm font-bold">SEO Metadata</h3>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5">SEO Page Title</label>
                    <input
                      type="text"
                      value={settings.seo_title}
                      onChange={(e) => setSettings({ ...settings, seo_title: e.target.value })}
                      className="w-full px-3.5 py-2 text-sm bg-[#F7F5F0] border border-[#E0DDD5] rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5">
                      SEO Meta Description
                    </label>
                    <textarea
                      rows={2}
                      value={settings.seo_description}
                      onChange={(e) =>
                        setSettings({ ...settings, seo_description: e.target.value })
                      }
                      className="w-full px-3.5 py-2 text-sm bg-[#F7F5F0] border border-[#E0DDD5] rounded-lg"
                    />
                  </div>
                </div>
              </form>

              {/* Social Links Manager */}
              <div className="bg-[#FFFFFF] border border-[#E0DDD5] rounded-2xl p-6 space-y-5">
                <div>
                  <h2 className="text-base font-bold">Social Media Links</h2>
                  <p className="text-xs text-[#5A5E58] mt-1">
                    Only platforms with an active URL and enabled visibility appear on the public
                    website.
                  </p>
                </div>

                <div className="divide-y divide-[#E0DDD5]">
                  {socialLinks.map((link) => (
                    <div
                      key={link.id}
                      className="py-3 flex flex-col sm:flex-row sm:items-center gap-3"
                    >
                      <input
                        type="text"
                        value={link.platform}
                        onChange={(e) =>
                          setSocialLinks((prev) =>
                            prev.map((s) =>
                              s.id === link.id ? { ...s, platform: e.target.value } : s
                            )
                          )
                        }
                        className="w-full sm:w-36 px-3 py-1.5 text-xs font-semibold bg-[#F7F5F0] border border-[#E0DDD5] rounded-lg"
                      />
                      <input
                        type="url"
                        placeholder="https://..."
                        value={link.profile_url}
                        onChange={(e) =>
                          setSocialLinks((prev) =>
                            prev.map((s) =>
                              s.id === link.id ? { ...s, profile_url: e.target.value } : s
                            )
                          )
                        }
                        className="flex-1 px-3 py-1.5 text-xs bg-[#F7F5F0] border border-[#E0DDD5] rounded-lg"
                      />
                      <label className="inline-flex items-center gap-1.5 text-xs font-medium cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          checked={link.is_enabled}
                          onChange={(e) =>
                            void handleUpdateSocial(link, { is_enabled: e.target.checked })
                          }
                        />
                        Enabled
                      </label>
                      <button
                        type="button"
                        onClick={() => void handleUpdateSocial(link, link)}
                        className="px-3 py-1.5 text-xs font-semibold bg-[#181A18] text-white rounded-lg cursor-pointer shrink-0"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await fetch(`/api/admin/social-links/${link.id}`, { method: 'DELETE' });
                          await loadAllAdminData();
                          onDataUpdated();
                        }}
                        className="p-1.5 text-[#991B1B] cursor-pointer"
                        aria-label={`Delete ${link.platform}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                <form onSubmit={handleAddSocial} className="pt-4 border-t border-[#E0DDD5] flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    placeholder="Custom Platform"
                    value={newSocialPlatform}
                    onChange={(e) => setNewSocialPlatform(e.target.value)}
                    className="sm:w-44 px-3 py-2 text-xs bg-[#F7F5F0] border border-[#E0DDD5] rounded-lg"
                  />
                  <input
                    type="url"
                    placeholder="https://..."
                    value={newSocialUrl}
                    onChange={(e) => setNewSocialUrl(e.target.value)}
                    className="flex-1 px-3 py-2 text-xs bg-[#F7F5F0] border border-[#E0DDD5] rounded-lg"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-semibold text-white bg-[#1B5E4A] rounded-lg cursor-pointer whitespace-nowrap"
                  >
                    Add Platform
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* MODULE: ACCOUNT SECURITY */}
          {activeTab === 'security' && (
            <div className="space-y-8">
              <form
                onSubmit={handleUpdateCredentials}
                className="bg-[#FFFFFF] border border-[#E0DDD5] rounded-2xl p-6 space-y-5 max-w-xl"
              >
                <h2 className="text-base font-bold">Account Credentials</h2>
                <div className="text-xs text-[#5A5E58]">
                  Current Username: <strong className="text-[#181A18]">{user.username}</strong> · Role:{' '}
                  <strong className="text-[#181A18]">{user.role}</strong>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1.5">
                    New Username (optional)
                  </label>
                  <input
                    type="text"
                    placeholder={user.username}
                    value={secNewUsername}
                    onChange={(e) => setSecNewUsername(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-[#F7F5F0] border border-[#E0DDD5] rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5">Current Password *</label>
                  <input
                    type="password"
                    required
                    value={secCurrentPassword}
                    onChange={(e) => setSecCurrentPassword(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-[#F7F5F0] border border-[#E0DDD5] rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5">
                    New Password * (min 8 chars)
                  </label>
                  <input
                    type="password"
                    required
                    value={secNewPassword}
                    onChange={(e) => setSecNewPassword(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-[#F7F5F0] border border-[#E0DDD5] rounded-lg"
                  />
                </div>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 text-xs font-semibold text-white bg-[#1B5E4A] rounded-lg cursor-pointer"
                >
                  Update Credentials
                </button>
              </form>

              <div className="bg-[#FFFFFF] border border-[#E0DDD5] rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-[#E0DDD5]">
                  <h2 className="text-sm font-bold">Active Login Sessions</h2>
                </div>
                <div className="divide-y divide-[#E0DDD5]">
                  {sessions.map((s) => (
                    <div
                      key={s.id}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <p className="font-semibold text-[#181A18]">
                          {s.isCurrent ? 'Current Session' : 'Session'} · {s.ip_address}
                        </p>
                        <p className="text-[#5A5E58] truncate max-w-xl mt-0.5">{s.user_agent}</p>
                      </div>
                      {!s.isCurrent && (
                        <button
                          type="button"
                          onClick={async () => {
                            await fetch(`/api/admin/sessions/${s.id}`, { method: 'DELETE' });
                            setSessions((prev) => prev.filter((row) => row.id !== s.id));
                          }}
                          className="px-3 py-1.5 text-xs font-medium text-[#991B1B] border border-[#FECACA] rounded-lg cursor-pointer"
                        >
                          Revoke
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Media Picker Modal */}
      {mediaPickerTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-[#FFFFFF] border border-[#E0DDD5] rounded-2xl max-w-3xl w-full max-h-[85vh] overflow-y-auto p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-[#E0DDD5] pb-3">
              <h3 className="text-sm font-bold">Select Media Asset</h3>
              <button
                type="button"
                onClick={() => setMediaPickerTarget(null)}
                className="p-1 text-[#5A5E58] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {mediaFiles.map((file) => (
                <button
                  key={file.id}
                  type="button"
                  onClick={() => {
                    mediaPickerTarget(file.file_url);
                    setMediaPickerTarget(null);
                  }}
                  className="text-left border border-[#E0DDD5] hover:border-[#1B5E4A] rounded-xl overflow-hidden cursor-pointer"
                >
                  <div className="aspect-[4/3] bg-[#EFECE6]">
                    <ResilientImage
                      src={file.file_url}
                      alt={file.file_name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <p className="p-2 text-[11px] font-medium truncate">{file.file_name}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
