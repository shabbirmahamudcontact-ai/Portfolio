import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

let cachedClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;
  if (!cachedClient) {
    cachedClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return cachedClient;
}

export interface ChatTurnInput {
  role: 'user' | 'assistant';
  text: string;
}

export interface PortfolioChatContext {
  settings: Record<string, string>;
  services: Array<{
    title: string;
    category: string;
    description: string;
    details: string[];
  }>;
  projects: Array<{
    title: string;
    slug: string;
    category: string;
    short_description: string;
    tools_used: string[];
    drive_url: string;
    live_url: string;
    github_url: string;
    is_sample: boolean;
  }>;
  githubProjects: Array<{
    repo_name: string;
    description: string;
    language: string;
    repo_url: string;
  }>;
  socialLinks: Array<{
    platform: string;
    profile_url: string;
  }>;
}

export interface PortfolioChatReply {
  reply: string;
  matched_service_title: string;
  matched_project_slug: string;
  suggest_contact: boolean;
  follow_up_prompts: string[];
}

export async function generatePortfolioChatReply(
  messages: ChatTurnInput[],
  context: PortfolioChatContext
): Promise<PortfolioChatReply> {
  const ai = getGeminiClient();
  if (!ai) {
    throw new Error('GEMINI_API_KEY_MISSING');
  }

  const serviceListText = context.services
    .map(
      (s, idx) =>
        `${idx + 1}. "${s.title}" (${s.category}) — ${s.description} | Capabilities: ${s.details.join(', ')}`
    )
    .join('\n');

  const projectListText = context.projects
    .map(
      (p, idx) =>
        `${idx + 1}. Title: "${p.title}" | slug: "${p.slug}" | Category: ${p.category}${
          p.is_sample ? ' (Sample Placeholder)' : ''
        } | Summary: ${p.short_description} | Tools: ${p.tools_used.join(', ')}${
          p.drive_url ? ` | Google Drive: ${p.drive_url}` : ''
        }${p.live_url ? ` | Live: ${p.live_url}` : ''}${
          p.github_url ? ` | GitHub: ${p.github_url}` : ''
        }`
    )
    .join('\n');

  const githubListText =
    context.githubProjects.length > 0
      ? context.githubProjects
          .map(
            (g) =>
              `- ${g.repo_name} (${g.language || 'Code'}): ${g.description} | ${g.repo_url}`
          )
          .join('\n')
      : 'None listed right now.';

  const socialText =
    context.socialLinks.length > 0
      ? context.socialLinks.map((s) => `${s.platform}: ${s.profile_url}`).join(', ')
      : 'Use phone, WhatsApp, or email below.';

  const systemInstruction = `You are the Portfolio Guide for ${
    context.settings.brand_name || 'Shabbir Creative Visionary'
  }, representing ${context.settings.owner_name || 'Shabbir Mahamud'}.

Your job is to help visitors discover what they are interested in—whether they need a creative service, want to explore relevant portfolio projects (including the Google Drive archive), or want to start a collaboration—and recommend the single best-fitting service or project from the verified portfolio data below.

Verified Owner & Brand Profile:
- Name: ${context.settings.owner_name || 'Shabbir Mahamud'}
- Brand: ${context.settings.brand_name || 'Shabbir Creative Visionary'}
- Location: ${context.settings.address || 'Gaibandha, Bangladesh'}
- Education: ${context.settings.education_degree || "Master's in Economics (Final Year)"} at ${
    context.settings.education_institution || 'National University, Bangladesh'
  } (${context.settings.education_status || 'Final Year — Ongoing'})
- Phone / WhatsApp: ${context.settings.phone || '01799-722719'}
- Email: ${context.settings.email || 'shabbirmahamudd@gmail.com'}
- Social Links: ${socialText}
- Bio: ${context.settings.about_bio || ''}

Verified Active Services (use exact "title" for matched_service_title):
${serviceListText || 'No active services configured.'}

Verified Published Portfolio Projects (use exact "slug" for matched_project_slug):
${projectListText || 'No published projects configured.'}

GitHub / Open Source Repositories:
${githubListText}

Strict Rules:
1. Stay grounded strictly in the verified facts above. NEVER invent years of experience, client counts, ratings, certifications, pricing packages, or completed degrees (keep Master's in Economics accurately described as ongoing / final year).
2. Keep replies clear, warm, structured, and concise (2 to 3 short paragraphs or short readable lines; no markdown bold syntax clutter, no emojis).
3. Match the visitor's language naturally (reply in Bengali if they write in Bengali/Bangla, otherwise in English).
4. If the visitor shares a goal or problem, ask one helpful clarifying question or suggest the most relevant service/project so they find what fits their interest best.
5. For "matched_service_title", return the exact string of one of the Verified Active Services titles above only if relevant, otherwise "".
6. For "matched_project_slug", return the exact string of one of the Verified Published Portfolio Projects slugs above only if relevant, otherwise "".
7. Set "suggest_contact" to true when the visitor asks about hiring, pricing, timelines, or wants to start a project.
8. Return 2 or 3 short, natural "follow_up_prompts" (each under 45 characters) that help the visitor continue exploring.`;

  // Normalize alternating conversation turns starting from the first user message
  const firstUserIndex = messages.findIndex((m) => m.role === 'user');
  const trimmed = firstUserIndex >= 0 ? messages.slice(firstUserIndex) : messages;
  const contents = trimmed.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.text }],
  }));

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents,
    config: {
      systemInstruction,
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          reply: {
            type: Type.STRING,
            description: 'Helpful conversational answer guiding the visitor.',
          },
          matched_service_title: {
            type: Type.STRING,
            description: 'Exact title from the verified services list, or empty string.',
          },
          matched_project_slug: {
            type: Type.STRING,
            description: 'Exact slug from the verified projects list, or empty string.',
          },
          suggest_contact: {
            type: Type.BOOLEAN,
            description: 'Whether to highlight contacting Shabbir directly.',
          },
          follow_up_prompts: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: '2 to 3 concise follow-up questions for the visitor.',
          },
        },
        required: [
          'reply',
          'matched_service_title',
          'matched_project_slug',
          'suggest_contact',
          'follow_up_prompts',
        ],
      },
    },
  });

  const rawText = (response.text ?? '').trim();
  const parsed = JSON.parse(rawText) as Partial<PortfolioChatReply>;

  const validServiceTitles = new Set(context.services.map((s) => s.title));
  const validProjectSlugs = new Set(context.projects.map((p) => p.slug));

  const matchedService =
    typeof parsed.matched_service_title === 'string' &&
    validServiceTitles.has(parsed.matched_service_title)
      ? parsed.matched_service_title
      : '';

  const matchedProject =
    typeof parsed.matched_project_slug === 'string' &&
    validProjectSlugs.has(parsed.matched_project_slug)
      ? parsed.matched_project_slug
      : '';

  return {
    reply:
      typeof parsed.reply === 'string' && parsed.reply.trim()
        ? parsed.reply.trim()
        : 'I can help you explore Shabbir’s services and portfolio work. What kind of project or skill are you looking for?',
    matched_service_title: matchedService,
    matched_project_slug: matchedProject,
    suggest_contact: Boolean(parsed.suggest_contact),
    follow_up_prompts: Array.isArray(parsed.follow_up_prompts)
      ? parsed.follow_up_prompts
          .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
          .slice(0, 3)
      : [],
  };
}
