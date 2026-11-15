import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'portfolio.db');
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Initialize relational schema
db.exec(`
  CREATE TABLE IF NOT EXISTS admin_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'admin',
    must_change_password INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS admin_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    ip_address TEXT NOT NULL DEFAULT '',
    user_agent TEXT NOT NULL DEFAULT '',
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES admin_users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS login_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip_address TEXT NOT NULL,
    username TEXT NOT NULL DEFAULT '',
    attempted_at TEXT NOT NULL DEFAULT (datetime('now')),
    success INTEGER NOT NULL DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_time ON login_attempts(ip_address, attempted_at);

  CREATE TABLE IF NOT EXISTS site_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    setting_key TEXT NOT NULL UNIQUE,
    setting_value TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL,
    short_description TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    thumbnail TEXT NOT NULL DEFAULT '',
    gallery TEXT NOT NULL DEFAULT '[]',
    video_url TEXT NOT NULL DEFAULT '',
    github_url TEXT NOT NULL DEFAULT '',
    live_url TEXT NOT NULL DEFAULT '',
    drive_url TEXT NOT NULL DEFAULT '',
    goal TEXT NOT NULL DEFAULT '',
    approach TEXT NOT NULL DEFAULT '',
    results TEXT NOT NULL DEFAULT '',
    mockup_type TEXT NOT NULL DEFAULT 'laptop',
    tools_used TEXT NOT NULL DEFAULT '[]',
    completion_date TEXT NOT NULL DEFAULT '',
    is_featured INTEGER NOT NULL DEFAULT 0,
    is_published INTEGER NOT NULL DEFAULT 1,
    is_sample INTEGER NOT NULL DEFAULT 0,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_projects_category ON projects(category);
  CREATE INDEX IF NOT EXISTS idx_projects_published ON projects(is_published, display_order);

  CREATE TABLE IF NOT EXISTS services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    details TEXT NOT NULL DEFAULT '[]',
    image TEXT NOT NULL DEFAULT '',
    cta_label TEXT NOT NULL DEFAULT 'Discuss This Service',
    is_published INTEGER NOT NULL DEFAULT 1,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS skills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT '',
    proficiency INTEGER NOT NULL DEFAULT 85,
    metric_label TEXT NOT NULL DEFAULT '',
    display_order INTEGER NOT NULL DEFAULT 0,
    is_published INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    number_value REAL NOT NULL DEFAULT 0,
    suffix TEXT NOT NULL DEFAULT '',
    label TEXT NOT NULL,
    detail TEXT NOT NULL DEFAULT '',
    use_odometer INTEGER NOT NULL DEFAULT 1,
    display_order INTEGER NOT NULL DEFAULT 0,
    is_published INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS experiences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role_title TEXT NOT NULL,
    organization TEXT NOT NULL,
    period TEXT NOT NULL DEFAULT '',
    location TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    highlights TEXT NOT NULL DEFAULT '[]',
    display_order INTEGER NOT NULL DEFAULT 0,
    is_published INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS certifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    issuer TEXT NOT NULL,
    issue_date TEXT NOT NULL DEFAULT '',
    credential_id TEXT NOT NULL DEFAULT '',
    credential_url TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    display_order INTEGER NOT NULL DEFAULT 0,
    is_published INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS github_projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    repo_name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    language TEXT NOT NULL DEFAULT '',
    repo_url TEXT NOT NULL DEFAULT '',
    live_url TEXT NOT NULL DEFAULT '',
    docs_url TEXT NOT NULL DEFAULT '',
    preview_image TEXT NOT NULL DEFAULT '',
    is_featured INTEGER NOT NULL DEFAULT 0,
    is_published INTEGER NOT NULL DEFAULT 1,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS testimonials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_name TEXT NOT NULL,
    customer_role TEXT NOT NULL DEFAULT '',
    review TEXT NOT NULL,
    customer_image TEXT NOT NULL DEFAULT '',
    is_published INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS contact_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    service TEXT NOT NULL DEFAULT '',
    subject TEXT NOT NULL DEFAULT '',
    budget TEXT NOT NULL DEFAULT '',
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'unread',
    ip_address TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_contact_messages_status ON contact_messages(status, created_at);

  CREATE TABLE IF NOT EXISTS social_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    platform TEXT NOT NULL,
    profile_url TEXT NOT NULL DEFAULT '',
    display_order INTEGER NOT NULL DEFAULT 0,
    is_enabled INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS media_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size INTEGER NOT NULL DEFAULT 0,
    uploaded_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Idempotent schema migrations for existing SQLite databases
const projectColumns = db.prepare("PRAGMA table_info('projects')").all() as Array<{ name: string }>;
const ensureProjectColumn = (col: string, defSql: string) => {
  if (!projectColumns.some((c) => c.name === col)) {
    db.exec(`ALTER TABLE projects ADD COLUMN ${col} ${defSql}`);
  }
};
ensureProjectColumn('drive_url', "TEXT NOT NULL DEFAULT ''");
ensureProjectColumn('goal', "TEXT NOT NULL DEFAULT ''");
ensureProjectColumn('approach', "TEXT NOT NULL DEFAULT ''");
ensureProjectColumn('results', "TEXT NOT NULL DEFAULT ''");
ensureProjectColumn('mockup_type', "TEXT NOT NULL DEFAULT 'laptop'");

const messageColumns = db.prepare("PRAGMA table_info('contact_messages')").all() as Array<{ name: string }>;
if (!messageColumns.some((c) => c.name === 'subject')) {
  db.exec("ALTER TABLE contact_messages ADD COLUMN subject TEXT NOT NULL DEFAULT ''");
}

function seedInitialData() {
  // 1. Seed initial admin account only if none exists
  const adminCount = (db.prepare('SELECT COUNT(*) as count FROM admin_users').get() as { count: number }).count;
  if (adminCount === 0) {
    const initialPassword = process.env.INITIAL_ADMIN_PASSWORD || 'shabbir2026';
    const initialUsername = process.env.INITIAL_ADMIN_USERNAME || 'shabbirmahamud';
    const passwordHash = bcrypt.hashSync(initialPassword, 12);
    db.prepare(`
      INSERT INTO admin_users (username, password_hash, role, must_change_password)
      VALUES (?, ?, 'admin', 1)
    `).run(initialUsername, passwordHash);
  }

  // 2. Seed site settings (verified personal & brand details only)
  const defaultSettings: Record<string, string> = {
    brand_name: 'Shabbir Creative Visionary',
    owner_name: 'Shabbir Mahamud',
    hero_headline: 'Turning Creative Ideas Into Digital Experiences.',
    hero_description:
      "I'm Shabbir Mahamud — a creative digital professional working across design, video, website development, AI automation, data, and digital marketing.",
    hero_3d_name: 'Shabbir Mahamud',
    outlined_statement: 'SOCIAL STRATEGY · ANALYTICS · APPLIED AI',
    scrub_video_url: '',
    scrub_video_poster: '/src/assets/images/studio_workspace_1794638450083.jpg',
    scrub_video_title: 'Interactive Spatial Reel & Workflow Preview',
    scrub_video_subtitle:
      'Scroll smoothly through the frame sequence to preview strategy systems, creative direction, and analytics deliverables.',
    tagline: 'Creative Ideas. Smart Technology. Meaningful Digital Experiences.',
    about_bio:
      "I'm Shabbir Mahamud, currently pursuing my Master's in Economics at National University. Alongside my academic journey, I explore the intersection of creativity, technology, and business.\n\nMy interests include graphic design, video production, website creation, AI-powered automation, business data analysis, SEO, and digital marketing.\n\nI enjoy learning new technologies and developing practical digital solutions that make work easier, communication better, and businesses more effective.",
    profile_photo: '/assets/aistudio/AI_Strategy_Meeting_in_a_Modern_Office_d006ac39.png',
    logo_text: 'Shabbir Creative Visionary',
    logo_url: '',
    favicon_url: '',
    accent_color: '#1B5E4A',
    education_degree: "Master's in Economics (Final Year)",
    education_institution: 'National University, Bangladesh',
    education_status: 'Final Year — Ongoing',
    education_details:
      'Focusing on economic analysis alongside practical digital systems, creative production, and applied technology.',
    phone: '01799-722719',
    whatsapp: '01799-722719',
    email: 'shabbirmahamudd@gmail.com',
    address: 'Gaibandha Thana Para, Gaibandha Sadar, Gaibandha, Bangladesh',
    github_username: '',
    github_profile_url: '',
    cv_url: '',
    footer_note: 'Shabbir Creative Visionary — Gaibandha, Bangladesh.',
    seo_title: 'Shabbir Creative Visionary — Shabbir Mahamud | Creative & Digital Tech',
    seo_description:
      'Portfolio of Shabbir Mahamud (Shabbir Creative Visionary) — Graphic Design, Video Editing, Website Development, AI Automation, Data Analysis, SEO, and Digital Marketing.',
  };

  const upsertSetting = db.prepare(`
    INSERT OR IGNORE INTO site_settings (setting_key, setting_value)
    VALUES (?, ?)
  `);
  const insertSettingsTx = db.transaction(() => {
    for (const [key, value] of Object.entries(defaultSettings)) {
      upsertSetting.run(key, value);
    }
  });
  insertSettingsTx();

  db.prepare(`UPDATE site_settings SET setting_value = 'Shabbir Mahamud' WHERE setting_key = 'hero_3d_name' AND setting_value = 'Yeasin'`).run();

  // 3. Seed 8 consolidated, non-overlapping core services if empty
  const serviceCount = (db.prepare('SELECT COUNT(*) as count FROM services').get() as { count: number }).count;
  if (serviceCount === 0) {
    const initialServices = [
      {
        title: 'Graphic Design',
        slug: 'graphic-design',
        category: 'Visual & Brand Design',
        description:
          'Cohesive visual systems, promotional graphics, and brand assets structured for clarity, recognition, and commercial impact.',
        details: [
          'Social Media Graphics',
          'Promotional Banners',
          'Business Graphics',
          'Brand Visuals',
          'Marketing Materials',
          'Creative Designs',
        ],
        image: '/src/assets/images/project_brand_identity_1794638450279.jpg',
        cta_label: 'Request Design Work',
        display_order: 1,
      },
      {
        title: 'Video Editing',
        slug: 'video-editing',
        category: 'Motion & Post-Production',
        description:
          'Structured editing, pacing, motion graphics, and color-balanced video production tailored for social platforms and business communication.',
        details: [
          'Promotional Videos',
          'Social Media Video Editing',
          'Business Videos',
          'Short-Form Video Content',
          'Motion Graphics',
          'Professional Video Production',
        ],
        image: '/src/assets/images/project_video_production_1794638452308.jpg',
        cta_label: 'Start Video Project',
        display_order: 2,
      },
      {
        title: 'Website Design and Development',
        slug: 'website-design-and-development',
        category: 'Web & UI/UX Engineering',
        description:
          'Responsive, accessible websites from clean UI/UX architecture and GitHub version control to production full-stack deployment.',
        details: [
          'Personal & Business Websites',
          'E-commerce & Landing Pages',
          'UI/UX & Responsive Design',
          'Frontend & Backend Builds',
          'GitHub Repository & Docs',
          'Website Maintenance',
        ],
        image: '/src/assets/images/project_web_platform_1794638451665.jpg',
        cta_label: 'Plan Your Website',
        display_order: 3,
      },
      {
        title: 'AI Solutions & Marketing Automation',
        slug: 'ai-solutions-and-workflow-automation',
        category: 'Automation & Applied AI',
        description:
          'Practical n8n pipelines and AI for marketing connecting WhatsApp, Messenger, Telegram, email, and automated lead routing.',
        details: [
          'n8n Workflow Development',
          'WhatsApp & Messenger Bots',
          'Email & Lead Automation',
          'AI Marketing Workflows',
          'AI Agent Integration',
          'Prompt Systems',
        ],
        image: '/assets/aistudio/AI_Strategy_Meeting_in_a_Modern_Office_d006ac39.png',
        cta_label: 'Automate Workflows',
        display_order: 4,
      },
      {
        title: 'Web Analytics & Business Data',
        slug: 'business-data-analysis',
        category: 'Analytics & Reporting',
        description:
          'Event tracking, conversion funnels, spreadsheet automation, and clean visual reporting turning raw traffic and records into clarity.',
        details: [
          'Web Event & Funnel Tracking',
          'Traffic Attribution',
          'Spreadsheet Automation',
          'Business Reporting',
          'Data Visualization',
          'Data Organization',
        ],
        image: '/src/assets/images/project_automation_data_1794638451622.jpg',
        cta_label: 'Setup Analytics & Data',
        display_order: 5,
      },
      {
        title: 'Social Media Strategy & Marketing',
        slug: 'digital-marketing',
        category: 'Strategy & Growth',
        description:
          'Structured editorial calendars, Facebook ad campaigns, audience positioning, and creative direction aligned with business goals.',
        details: [
          'Editorial Calendars',
          'Social Media Marketing',
          'Facebook Ads & Campaigns',
          'Audience Positioning',
          'Marketing Creative Design',
          'Platform Analytics',
        ],
        image: '/src/assets/images/project_brand_identity_1794638450279.jpg',
        cta_label: 'Launch Strategy',
        display_order: 6,
      },
      {
        title: 'SEO and Content Optimization',
        slug: 'seo-and-content-optimization',
        category: 'Search & Content',
        description:
          'Search-structured copy, targeted keyword research, and technical on-page optimization designed to improve organic discoverability.',
        details: [
          'SEO-Friendly Content',
          'Keyword Research',
          'On-Page SEO',
          'Website Content Optimization',
          'Content Strategy',
        ],
        image: '/src/assets/images/studio_workspace_1794638450083.jpg',
        cta_label: 'Optimize Search Presence',
        display_order: 7,
      },
      {
        title: 'Digital Skills Training',
        slug: 'training',
        category: 'Mentorship & Workshops',
        description:
          'Hands-on practical training in graphic design, video editing, website creation, spreadsheet workflows, and applied AI tools.',
        details: [
          '1-on-1 Coaching',
          'Team Workflow Training',
          'AI Productivity Sessions',
          'Portfolio Guidance',
        ],
        image: '/src/assets/images/studio_workspace_1794638450083.jpg',
        cta_label: 'Request Training',
        display_order: 8,
      },
    ];

    const insertService = db.prepare(`
      INSERT INTO services (title, slug, category, description, details, image, cta_label, is_published, display_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
    `);
    const tx = db.transaction(() => {
      for (const s of initialServices) {
        insertService.run(
          s.title,
          s.slug,
          s.category,
          s.description,
          JSON.stringify(s.details),
          s.image,
          s.cta_label,
          s.display_order
        );
      }
    });
    tx();
  }

  // 4. Seed clearly labelled sample portfolio placeholders (strictly marked is_sample = 1, no fake client claims)
  const projectCount = (db.prepare('SELECT COUNT(*) as count FROM projects').get() as { count: number }).count;
  if (projectCount === 0) {
    const sampleProjects = [
      {
        title: 'Minimalist Brand System & Visual Kit (Sample Placeholder)',
        slug: 'sample-brand-system-visual-kit',
        category: 'Graphic Design',
        short_description:
          'Clearly labelled sample placeholder demonstrating brand stationery, color palette, and social layout presentation.',
        description:
          'This is a sample portfolio placeholder entry ready to be replaced or edited inside the Admin Dashboard with genuine client or personal graphic design deliverables, project notes, and high-resolution gallery assets.',
        thumbnail: '/src/assets/images/project_brand_identity_1794638450279.jpg',
        gallery: ['/src/assets/images/project_brand_identity_1794638450279.jpg'],
        tools_used: ['Adobe Illustrator', 'Adobe Photoshop', 'Figma'],
        completion_date: 'Sample Entry',
        is_featured: 1,
        is_sample: 1,
        display_order: 1,
      },
      {
        title: 'Editorial Business Web Architecture (Sample Placeholder)',
        slug: 'sample-editorial-web-architecture',
        category: 'Website Development',
        short_description:
          'Clearly labelled sample placeholder showcasing responsive editorial layout structure, typography hierarchy, and SEO markup.',
        description:
          'This is a sample portfolio placeholder entry demonstrating how website design and full-stack development projects are presented—including live preview links, GitHub repository links, and technology stack tags. Replace via Admin Dashboard when uploading genuine web projects.',
        thumbnail: '/src/assets/images/project_web_platform_1794638451665.jpg',
        gallery: ['/src/assets/images/project_web_platform_1794638451665.jpg'],
        tools_used: ['React', 'TypeScript', 'Tailwind CSS'],
        completion_date: 'Sample Entry',
        is_featured: 1,
        is_sample: 1,
        display_order: 2,
      },
      {
        title: 'Documentary & Promo Cut Sequence (Sample Placeholder)',
        slug: 'sample-video-production-sequence',
        category: 'Video Editing',
        short_description:
          'Clearly labelled sample placeholder illustrating promotional video pacing, color grading, and motion graphics delivery.',
        description:
          'This is a sample portfolio placeholder entry for video editing and motion graphics work. The Admin Dashboard supports attaching video preview URLs or uploading MP4/WebM reels directly.',
        thumbnail: '/src/assets/images/project_video_production_1794638452308.jpg',
        gallery: ['/src/assets/images/project_video_production_1794638452308.jpg'],
        tools_used: ['Premiere Pro', 'DaVinci Resolve', 'After Effects'],
        completion_date: 'Sample Entry',
        is_featured: 1,
        is_sample: 1,
        display_order: 3,
      },
      {
        title: 'Workflow Automation & Reporting Sheet (Sample Placeholder)',
        slug: 'sample-automation-reporting-workflow',
        category: 'AI Automation',
        short_description:
          'Clearly labelled sample placeholder illustrating n8n messaging workflows, structured spreadsheets, and reporting dashboards.',
        description:
          'This is a sample portfolio placeholder entry showing how AI workflow automation (WhatsApp, Telegram, Email, n8n) and business data reporting projects appear in the gallery. Edit or unpublish anytime from the Admin Dashboard.',
        thumbnail: '/src/assets/images/project_automation_data_1794638451622.jpg',
        gallery: ['/src/assets/images/project_automation_data_1794638451622.jpg'],
        tools_used: ['n8n', 'Google Sheets', 'AI Agents'],
        completion_date: 'Sample Entry',
        is_featured: 1,
        is_sample: 1,
        display_order: 4,
      },
    ];

    const insertProject = db.prepare(`
      INSERT INTO projects (
        title, slug, category, short_description, description, thumbnail, gallery,
        video_url, github_url, live_url, tools_used, completion_date,
        is_featured, is_published, is_sample, display_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?, '', '', '', ?, ?, ?, 1, ?, ?)
    `);
    const tx = db.transaction(() => {
      for (const p of sampleProjects) {
        insertProject.run(
          p.title,
          p.slug,
          p.category,
          p.short_description,
          p.description,
          p.thumbnail,
          JSON.stringify(p.gallery),
          JSON.stringify(p.tools_used),
          p.completion_date,
          p.is_featured,
          p.is_sample,
          p.display_order
        );
      }
    });
    tx();
  }

  // 5. Seed disabled empty social slots (strictly no invented URLs; only displayed when admin enters real URL & enables)
  const socialCount = (db.prepare('SELECT COUNT(*) as count FROM social_links').get() as { count: number }).count;
  if (socialCount === 0) {
    const platforms = ['Facebook', 'Instagram', 'LinkedIn', 'GitHub', 'Behance', 'YouTube'];
    const insertSocial = db.prepare(`
      INSERT INTO social_links (platform, profile_url, display_order, is_enabled)
      VALUES (?, '', ?, 0)
    `);
    platforms.forEach((platform, idx) => insertSocial.run(platform, idx + 1));
  }

  // 6. Seed built-in studio media entries so Media Library starts populated with the actual generated images
  const mediaCount = (db.prepare('SELECT COUNT(*) as count FROM media_files').get() as { count: number }).count;
  if (mediaCount === 0) {
    const builtInImages = [
      { name: 'profile_shabbir.jpg', url: '/src/assets/images/profile_shabbir_1794638450090.jpg', type: 'image/jpeg' },
      { name: 'studio_workspace.jpg', url: '/src/assets/images/studio_workspace_1794638450083.jpg', type: 'image/jpeg' },
      { name: 'project_brand_identity.jpg', url: '/src/assets/images/project_brand_identity_1794638450279.jpg', type: 'image/jpeg' },
      { name: 'project_web_platform.jpg', url: '/src/assets/images/project_web_platform_1794638451665.jpg', type: 'image/jpeg' },
      { name: 'project_video_production.jpg', url: '/src/assets/images/project_video_production_1794638452308.jpg', type: 'image/jpeg' },
      { name: 'project_automation_data.jpg', url: '/src/assets/images/project_automation_data_1794638451622.jpg', type: 'image/jpeg' },
    ];
    const insertMedia = db.prepare(`
      INSERT INTO media_files (file_name, file_url, file_type, file_size)
      VALUES (?, ?, ?, 0)
    `);
    builtInImages.forEach((m) => insertMedia.run(m.name, m.url, m.type));
  }

  // 7. Idempotently ensure the Google Drive portfolio project and its image asset exist
  const driveThumbUrl = '/assets/aistudio/AI_Strategy_Meeting_in_a_Modern_Office_d006ac39.png';
  const driveSlug = 'ai-strategy-google-drive-portfolio';
  const existingDriveProject = db.prepare('SELECT id FROM projects WHERE slug = ?').get(driveSlug);
  if (!existingDriveProject) {
    db.prepare(`
      INSERT INTO projects (
        title, slug, category, short_description, description, thumbnail, gallery,
        video_url, github_url, live_url, drive_url, tools_used, completion_date,
        is_featured, is_published, is_sample, display_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?, '', '', '', ?, ?, ?, 1, 1, 0, 0)
    `).run(
      'AI Strategy & Creative Portfolio Archive',
      driveSlug,
      'AI Automation',
      'Curated Google Drive project archive showcasing AI strategy presentations, digital workflows, and creative deliverables.',
      'A curated Google Drive portfolio archive presenting applied AI strategy, workflow automation concepts, and multidisciplinary creative deliverables by Shabbir Mahamud. Open the linked Google Drive folder to browse full presentation decks, visual files, and supporting project resources.',
      driveThumbUrl,
      JSON.stringify([driveThumbUrl]),
      'https://drive.google.com/drive/folders/18UuRwT_4piU28udO4G3pSaY2IXBcwpxD',
      JSON.stringify(['Google Drive', 'AI Strategy', 'Workflow Automation', 'Creative Presentation']),
      '2026'
    );
  }

  const existingDriveMedia = db.prepare('SELECT id FROM media_files WHERE file_url = ?').get(driveThumbUrl);
  if (!existingDriveMedia) {
    db.prepare(`
      INSERT INTO media_files (file_name, file_url, file_type, file_size)
      VALUES (?, ?, 'image/png', 0)
    `).run('AI_Strategy_Meeting_in_a_Modern_Office.png', driveThumbUrl);
  }

  // 8. Update About Me profile photo if still using the initial default image
  db.prepare(`
    UPDATE site_settings
    SET setting_value = ?, updated_at = datetime('now')
    WHERE setting_key = 'profile_photo' AND setting_value = '/src/assets/images/profile_shabbir_1794638450090.jpg'
  `).run(driveThumbUrl);

  // 9. Consolidate any legacy overlapping services into the 8 clean non-overlapping practices
  const duplicateServiceSlugs = ['social-media-strategy', 'ai-for-marketing', 'web-analytics', 'github-and-development-workflow'];
  const currentSlugs = new Set(
    (db.prepare('SELECT slug FROM services').all() as Array<{ slug: string }>).map((r) => r.slug)
  );
  if (duplicateServiceSlugs.some((slug) => currentSlugs.has(slug))) {
    db.prepare(
      `DELETE FROM services WHERE slug IN ('social-media-strategy', 'ai-for-marketing', 'web-analytics', 'github-and-development-workflow')`
    ).run();

    db.prepare(`
      UPDATE services SET
        title = 'Website Design and Development',
        description = 'Responsive, accessible websites from clean UI/UX architecture and GitHub version control to production full-stack deployment.',
        details = ?
      WHERE slug = 'website-design-and-development'
    `).run(
      JSON.stringify([
        'Personal & Business Websites',
        'E-commerce & Landing Pages',
        'UI/UX & Responsive Design',
        'Frontend & Backend Builds',
        'GitHub Repository & Docs',
        'Website Maintenance',
      ])
    );

    db.prepare(`
      UPDATE services SET
        title = 'AI Solutions & Marketing Automation',
        description = 'Practical n8n pipelines and AI for marketing connecting WhatsApp, Messenger, Telegram, email, and automated lead routing.',
        details = ?
      WHERE slug = 'ai-solutions-and-workflow-automation'
    `).run(
      JSON.stringify([
        'n8n Workflow Development',
        'WhatsApp & Messenger Bots',
        'Email & Lead Automation',
        'AI Marketing Workflows',
        'AI Agent Integration',
        'Prompt Systems',
      ])
    );

    db.prepare(`
      UPDATE services SET
        title = 'Web Analytics & Business Data',
        category = 'Analytics & Reporting',
        description = 'Event tracking, conversion funnels, spreadsheet automation, and clean visual reporting turning raw traffic and records into clarity.',
        details = ?
      WHERE slug = 'business-data-analysis'
    `).run(
      JSON.stringify([
        'Web Event & Funnel Tracking',
        'Traffic Attribution',
        'Spreadsheet Automation',
        'Business Reporting',
        'Data Visualization',
        'Data Organization',
      ])
    );

    db.prepare(`
      UPDATE services SET
        title = 'Social Media Strategy & Marketing',
        category = 'Strategy & Growth',
        description = 'Structured editorial calendars, Facebook ad campaigns, audience positioning, and creative direction aligned with business goals.',
        details = ?
      WHERE slug = 'digital-marketing'
    `).run(
      JSON.stringify([
        'Editorial Calendars',
        'Social Media Marketing',
        'Facebook Ads & Campaigns',
        'Audience Positioning',
        'Marketing Creative Design',
        'Platform Analytics',
      ])
    );

    db.prepare(`UPDATE services SET display_order = 8 WHERE slug = 'training'`).run();
  }

  // 10. Seed initial verified Skills if empty
  const skillCount = (db.prepare('SELECT COUNT(*) as count FROM skills').get() as { count: number }).count;
  if (skillCount === 0) {
    const initialSkills = [
      { name: 'Social Media Strategy', category: 'Strategy', proficiency: 92, metric_label: 'Editorial & Growth', order: 1 },
      { name: 'AI for Marketing & n8n', category: 'Automation', proficiency: 90, metric_label: 'Workflows & Agents', order: 2 },
      { name: 'Web & Brand Design', category: 'Design', proficiency: 91, metric_label: 'UI/UX & Visual Systems', order: 3 },
      { name: 'Web Analytics & Data', category: 'Analytics', proficiency: 88, metric_label: 'Reporting & Sheets', order: 4 },
      { name: 'Video Production', category: 'Motion', proficiency: 87, metric_label: 'Premiere & DaVinci', order: 5 },
      { name: 'SEO & Content Systems', category: 'Search', proficiency: 86, metric_label: 'On-Page & Keywords', order: 6 },
    ];
    const insertSkill = db.prepare(`
      INSERT INTO skills (name, category, proficiency, metric_label, display_order, is_published)
      VALUES (?, ?, ?, ?, ?, 1)
    `);
    initialSkills.forEach((sk) =>
      insertSkill.run(sk.name, sk.category, sk.proficiency, sk.metric_label, sk.order)
    );
  }

  // 11. Seed initial factual Stats if empty (strictly non-fabricated real structural metrics)
  const statCount = (db.prepare('SELECT COUNT(*) as count FROM stats').get() as { count: number }).count;
  if (statCount === 0) {
    const initialStats = [
      { num: 8, suffix: '+', label: 'Core Digital Services', detail: 'From social strategy & AI automation to full-stack web delivery.', odo: 1, order: 1 },
      { num: 100, suffix: '%', label: 'Database-Driven CMS', detail: 'Every stat, project, skill, and media asset stays editable.', odo: 1, order: 2 },
      { num: 4, suffix: '', label: 'Structured Delivery Phases', detail: 'Discovery, Strategy, Creative Build, and Continuous Improvement.', odo: 1, order: 3 },
      { num: 360, suffix: '°', label: 'Creative & Tech Integration', detail: 'Combining design, video, analytics, and applied AI.', odo: 0, order: 4 },
    ];
    const insertStat = db.prepare(`
      INSERT INTO stats (number_value, suffix, label, detail, use_odometer, display_order, is_published)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `);
    initialStats.forEach((st) =>
      insertStat.run(st.num, st.suffix, st.label, st.detail, st.odo, st.order)
    );
  } else {
    db.prepare(`
      UPDATE stats SET number_value = 8 WHERE label = 'Core Digital Services' AND number_value = 12
    `).run();
  }

  // 12. Remove redundant seeded experience entries that duplicate the About & Education blocks
  db.prepare(`
    DELETE FROM experiences
    WHERE (role_title = ? AND organization = ?)
       OR (role_title = ? AND organization = ?)
  `).run(
    'Creative Digital Professional & Founder',
    'Shabbir Creative Visionary',
    "Master's in Economics (Final Year)",
    'National University, Bangladesh'
  );

  // 13. Ensure existing projects have structured Goal, Approach, Results & Mockup Type if empty
  db.prepare(`
    UPDATE projects
    SET
      goal = CASE WHEN trim(goal) = '' THEN 'Create an accessible, well-structured digital showcase communicating clear creative and technical value.' ELSE goal END,
      approach = CASE WHEN trim(approach) = '' THEN 'Combined disciplined visual hierarchy, modern tooling, and structured workflow documentation tailored to the project brief.' ELSE approach END,
      results = CASE WHEN trim(results) = '' THEN 'Delivered a cohesive, ready-to-share archive and responsive presentation accessible across desktop and mobile.' ELSE results END
    WHERE trim(goal) = '' OR trim(approach) = '' OR trim(results) = ''
  `).run();
}

seedInitialData();

export default db;
export { UPLOADS_DIR };
