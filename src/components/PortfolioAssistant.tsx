import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  FolderOpen,
  MessageSquare,
  RotateCcw,
  Send,
  X,
} from 'lucide-react';
import type { Project, Service } from '../types/portfolio';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  matchedServiceTitle?: string;
  matchedProjectSlug?: string;
  suggestContact?: boolean;
  followUpPrompts?: string[];
}

interface PortfolioAssistantProps {
  ownerName: string;
  accentColor: string;
  services: Service[];
  projects: Project[];
  onOpenProject: (slug: string) => void;
  onSelectServiceAndContact: (serviceTitle: string) => void;
  onGoToContact: () => void;
}

const STARTER_PROMPTS = [
  'Help me choose a service for my project',
  'Show AI automation and Google Drive work',
  'I need a website or portfolio built',
  'What video, SEO, or marketing work is offered?',
];

export function PortfolioAssistant({
  ownerName,
  accentColor,
  services,
  projects,
  onOpenProject,
  onSelectServiceAndContact,
  onGoToContact,
}: PortfolioAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      window.setTimeout(() => {
        inputRef.current?.focus();
      }, 60);
    }
  }, [isOpen]);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, loading, isOpen]);

  const sendMessage = async (textToSend: string) => {
    const trimmed = textToSend.trim();
    if (!trimmed || loading) return;

    setErrorMsg('');
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: trimmed,
    };

    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextHistory.slice(-10).map((m) => ({
            role: m.role,
            text: m.text,
          })),
        }),
      });

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json') && (res.status === 404 || res.status === 405)) {
        const lower = trimmed.toLowerCase();
        const matchedService = services.find((s) =>
          [s.title, s.category, ...s.details].some((k) =>
            lower.split(/\s+/).some((w) => w.length > 3 && k.toLowerCase().includes(w))
          )
        );
        const matchedProject = projects.find((p) =>
          [p.title, p.category, ...p.tools_used].some((k) =>
            lower.split(/\s+/).some((w) => w.length > 3 && k.toLowerCase().includes(w))
          )
        );
        const replyLines = [
          matchedService
            ? `${ownerName} offers ${matchedService.title}: ${matchedService.description}`
            : `${ownerName} works across Graphic Design, Video Editing, Website Development, AI Automation, Web Analytics, Social Strategy, SEO, and Training.`,
          matchedProject
            ? `You may also want to explore "${matchedProject.title}" (${matchedProject.category}).`
            : 'Let me know your project goals or jump straight to the contact section below.',
        ];
        setMessages((prev) => [
          ...prev,
          {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            text: replyLines.join(' '),
            matchedServiceTitle: matchedService?.title || '',
            matchedProjectSlug: matchedProject?.slug || '',
            suggestContact: true,
            followUpPrompts: ['Show AI automation & Google Drive work', 'Request a quote'],
          },
        ]);
        return;
      }

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Unable to reach the portfolio guide right now.');
        return;
      }

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        text: data.reply || 'How can I help you explore the portfolio?',
        matchedServiceTitle: data.matched_service_title || '',
        matchedProjectSlug: data.matched_project_slug || '',
        suggestContact: Boolean(data.suggest_contact),
        followUpPrompts: Array.isArray(data.follow_up_prompts) ? data.follow_up_prompts : [],
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      setErrorMsg('Network error while connecting to the portfolio guide.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    void sendMessage(input);
  };

  const handleClear = () => {
    setMessages([]);
    setErrorMsg('');
    setInput('');
  };

  return (
    <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 flex flex-col items-end">
      {isOpen && (
        <section
          aria-label="Portfolio Guide Assistant"
          className="mb-3 w-[calc(100vw-2rem)] sm:w-[400px] h-[min(540px,calc(100vh-7rem))] bg-[#F7F5F0] border border-[#E0DDD5] rounded-2xl shadow-xl flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="px-4 py-3.5 bg-[#FFFFFF] border-b border-[#E0DDD5] flex items-center justify-between gap-4 shrink-0">
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-[#181A18] truncate">Portfolio Guide</h2>
              <p className="text-xs text-[#5A5E58] truncate">
                Explore services and projects with {ownerName}
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={handleClear}
                  title="Reset conversation"
                  aria-label="Reset conversation"
                  className="w-8 h-8 rounded-lg border border-[#E0DDD5] bg-[#F7F5F0] hover:bg-[#EFECE6] text-[#5A5E58] hover:text-[#181A18] inline-flex items-center justify-center transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title="Close Portfolio Guide"
                aria-label="Close Portfolio Guide"
                className="w-8 h-8 rounded-lg border border-[#E0DDD5] bg-[#F7F5F0] hover:bg-[#EFECE6] text-[#5A5E58] hover:text-[#181A18] inline-flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages Body */}
          <div
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto p-4 space-y-4"
          >
            {messages.length === 0 ? (
              <div className="space-y-4">
                <div className="bg-[#FFFFFF] border border-[#E0DDD5] rounded-xl p-4">
                  <p className="text-sm font-semibold text-[#181A18] mb-1.5">
                    What are you looking to build or explore?
                  </p>
                  <p className="text-xs text-[#5A5E58] leading-relaxed">
                    Tell me your goal in English or Bengali—design, video editing, web development,
                    AI automation, data analysis, SEO, or digital marketing—and I will guide you
                    to the right service or project.
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-[#5A5E58]">Popular starting points</p>
                  <div className="flex flex-col gap-2">
                    {STARTER_PROMPTS.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => void sendMessage(prompt)}
                        className="text-left px-3.5 py-2.5 text-xs font-medium text-[#181A18] bg-[#FFFFFF] border border-[#E0DDD5] hover:border-[#1B5E4A] rounded-xl transition-colors flex items-center justify-between gap-2 cursor-pointer"
                      >
                        <span>{prompt}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-[#5A5E58] shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              messages.map((msg, index) => {
                const matchedProject = msg.matchedProjectSlug
                  ? projects.find((p) => p.slug === msg.matchedProjectSlug)
                  : undefined;
                const matchedService = msg.matchedServiceTitle
                  ? services.find((s) => s.title === msg.matchedServiceTitle)
                  : undefined;
                const isLastAssistant =
                  msg.role === 'assistant' && index === messages.length - 1;

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${
                      msg.role === 'user' ? 'items-end' : 'items-start'
                    }`}
                  >
                    <div
                      className={`max-w-[88%] rounded-2xl px-4 py-3 text-[13.5px] leading-relaxed whitespace-pre-line ${
                        msg.role === 'user'
                          ? 'bg-[#181A18] text-white'
                          : 'bg-[#FFFFFF] border border-[#E0DDD5] text-[#181A18]'
                      }`}
                    >
                      {msg.text}
                    </div>

                    {msg.role === 'assistant' &&
                      (matchedProject || matchedService || msg.suggestContact) && (
                        <div className="mt-2 flex flex-wrap gap-2 max-w-[92%]">
                          {matchedProject && (
                            <button
                              type="button"
                              onClick={() => {
                                setIsOpen(false);
                                onOpenProject(matchedProject.slug);
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white rounded-lg transition-opacity hover:opacity-90 cursor-pointer"
                              style={{ backgroundColor: accentColor }}
                            >
                              <span>View: {matchedProject.title}</span>
                              <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
                            </button>
                          )}

                          {matchedProject?.drive_url && (
                            <a
                              href={matchedProject.drive_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#181A18] bg-[#FFFFFF] border border-[#E0DDD5] hover:border-[#1B5E4A] rounded-lg transition-colors"
                            >
                              <FolderOpen className="w-3.5 h-3.5 text-[#1B5E4A]" />
                              <span>Google Drive</span>
                            </a>
                          )}

                          {matchedService && (
                            <button
                              type="button"
                              onClick={() => {
                                setIsOpen(false);
                                onSelectServiceAndContact(matchedService.title);
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#181A18] bg-[#EFECE6] hover:bg-[#E0DDD5] rounded-lg transition-colors cursor-pointer"
                            >
                              <span>Inquire: {matchedService.title}</span>
                              <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                            </button>
                          )}

                          {!matchedService && msg.suggestContact && (
                            <button
                              type="button"
                              onClick={() => {
                                setIsOpen(false);
                                onGoToContact();
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#181A18] bg-[#EFECE6] hover:bg-[#E0DDD5] rounded-lg transition-colors cursor-pointer"
                            >
                              <span>Go to Contact Form</span>
                              <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                            </button>
                          )}
                        </div>
                      )}

                    {isLastAssistant &&
                      msg.followUpPrompts &&
                      msg.followUpPrompts.length > 0 &&
                      !loading && (
                        <div className="mt-2.5 flex flex-col gap-1.5 w-full max-w-[92%]">
                          {msg.followUpPrompts.map((followUp) => (
                            <button
                              key={followUp}
                              type="button"
                              onClick={() => void sendMessage(followUp)}
                              className="text-left px-3 py-1.5 text-xs font-medium text-[#5A5E58] hover:text-[#181A18] bg-[#FFFFFF] border border-[#E0DDD5] hover:border-[#1B5E4A] rounded-lg transition-colors cursor-pointer"
                            >
                              {followUp}
                            </button>
                          ))}
                        </div>
                      )}
                  </div>
                );
              })
            )}

            {loading && (
              <div className="flex items-start">
                <div className="bg-[#FFFFFF] border border-[#E0DDD5] rounded-2xl px-4 py-2.5 text-xs font-medium text-[#5A5E58]">
                  Thinking...
                </div>
              </div>
            )}

            {errorMsg && (
              <div
                role="alert"
                className="p-3 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-xs font-medium text-[#991B1B]"
              >
                {errorMsg}
              </div>
            )}
          </div>

          {/* Input Bar */}
          <form
            onSubmit={handleSubmit}
            className="p-3 bg-[#FFFFFF] border-t border-[#E0DDD5] flex items-center gap-2 shrink-0"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about services, projects, or goals..."
              maxLength={800}
              disabled={loading}
              className="flex-1 min-w-0 px-3.5 py-2 text-sm bg-[#F7F5F0] border border-[#E0DDD5] rounded-lg focus:outline-none focus:border-[#1B5E4A] disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              aria-label="Send message"
              className="w-10 h-10 rounded-lg text-white inline-flex items-center justify-center shrink-0 transition-opacity disabled:opacity-45 cursor-pointer"
              style={{ backgroundColor: accentColor }}
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </section>
      )}

      {/* Compact Single-Line Floating Toggle */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        className="h-11 px-4 rounded-xl text-xs font-semibold text-white shadow-lg inline-flex items-center gap-2 whitespace-nowrap shrink-0 transition-transform hover:scale-[1.02] cursor-pointer"
        style={{ backgroundColor: isOpen ? '#181A18' : accentColor }}
      >
        {isOpen ? <X className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
        <span>{isOpen ? 'Close Guide' : 'Ask Portfolio Guide'}</span>
      </button>
    </div>
  );
}
