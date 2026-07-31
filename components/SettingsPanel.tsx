"use client";

import { useState, useEffect } from "react";
import { X, Brain, ScreenShare, MessageSquareText, Languages, Cpu, Trash2, Save, Check, Github, Link2 } from "lucide-react";
import { NEXO_MODELS, type NexoModelId } from "@/lib/models";

interface UserSettings {
  memory_content: string;
  screen_share_enabled: boolean;
  response_length: "short" | "balanced" | "detailed";
  language_preference: "auto" | "sinhala" | "english";
  default_model: string;
}

const DEFAULT_SETTINGS: UserSettings = {
  memory_content: "",
  screen_share_enabled: false,
  response_length: "balanced",
  language_preference: "auto",
  default_model: "nexio-1.1",
};

export function SettingsPanel({
  open,
  onClose,
  sessionId,
  onClearHistory,
  onSettingsChange,
}: {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  onClearHistory: () => void;
  onSettingsChange?: (settings: UserSettings) => void;
}) {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [memoryDraft, setMemoryDraft] = useState("");
  const [saved, setSaved] = useState(false);
  const [memorySaving, setMemorySaving] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [loading, setLoading] = useState(true);

  // GitHub States
  const [githubConnected, setGithubConnected] = useState(false);
  const [githubUsername, setGithubUsername] = useState('');
  const [repos, setRepos] = useState<any[]>([]);
  const [selectedRepo, setSelectedRepo] = useState('');

  useEffect(() => {
    async function loadSettings() {
      if (!sessionId) return;
      setLoading(true);
      try {
        const res = await fetch(`/api/settings?sessionId=${sessionId}`);
        const data = res.ok ? await res.json() : null;

        if (data) {
          const loaded = {
            memory_content: data.memory_content || "",
            screen_share_enabled: data.screen_share_enabled ?? false,
            response_length: data.response_length || "balanced",
            language_preference: data.language_preference || "auto",
            default_model: data.default_model || "nexio-1.1",
          };
          setSettings(loaded);
          setMemoryDraft(loaded.memory_content);
        }

        // Check GitHub connection
        const ghRes = await fetch(`/api/github/repos?sessionId=${sessionId}`);
        if (ghRes.ok) {
          const ghData = await ghRes.json();
          setGithubConnected(true);
          setGithubUsername(ghData.username || '');
          setRepos(ghData.repos || []);
          setSelectedRepo(ghData.selectedRepo || '');
        }
      } catch (err) {
        console.error("Error loading settings:", err);
      } finally {
        setLoading(false);
      }
    }

    if (open) {
      loadSettings();
    }
  }, [open, sessionId]);

  async function saveSettings(newSettings: UserSettings) {
    setSettings(newSettings);
    if (!sessionId) return;

    try {
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, ...newSettings }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onSettingsChange?.(newSettings);
    } catch (err) {
      console.error("Error saving settings:", err);
    }
  }

  async function saveMemory() {
    setMemorySaving(true);
    await saveSettings({ ...settings, memory_content: memoryDraft });
    setMemorySaving(false);
  }

  function handleClearHistory() {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    onClearHistory();
    setConfirmClear(false);
  }

  if (!open) return null;

  const memoryDirty = memoryDraft !== settings.memory_content;

  return (
    <div
      className="fixed inset-0 z-[100] flex justify-end bg-ink/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="h-full w-full max-w-sm overflow-y-auto border-l border-edge bg-panel shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-edge bg-panel px-5 py-4">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-lg font-black text-ink tracking-tight uppercase">Nexus Settings</h2>
            <div className="h-1.5 w-1.5 rounded-full bg-cyan animate-pulse" />
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-ink-faint hover:bg-void hover:text-ink transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan border-t-transparent" />
          </div>
        ) : (
          <div className="space-y-8 p-6 pb-24">
            {/* Memory Section */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-ink">
                  <Brain className="h-4 w-4 text-cyan" />
                  <h3 className="font-display text-sm font-semibold">NEXO Memory</h3>
                </div>
                {memoryDirty && (
                  <button
                    onClick={saveMemory}
                    disabled={memorySaving}
                    className="flex items-center gap-1.5 text-[10px] font-black text-cyan hover:text-cyan-dim uppercase tracking-widest"
                  >
                    <Save className="h-3 w-3" /> Save Changes
                  </button>
                )}
              </div>
              <textarea
                value={memoryDraft}
                onChange={(e) => setMemoryDraft(e.target.value)}
                placeholder="Tell NEXO something to remember about you (e.g., 'I prefer TypeScript', 'My name is Alex')..."
                className="w-full min-h-[120px] rounded-2xl border border-edge bg-void/50 p-4 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:border-cyan/50 resize-none transition-all"
              />
              <p className="mt-2 text-[10px] text-ink-muted leading-relaxed">
                NEXO uses this context across all chats to provide a more personalized experience.
              </p>
            </section>

            {/* GitHub Integration */}
            <section className="border-t border-edge pt-5">
              <div className="flex items-center gap-2 text-ink mb-3">
                <Github className="h-4 w-4 text-cyan" />
                <h3 className="font-display text-sm font-semibold">GitHub Connection</h3>
              </div>
              
              {!githubConnected ? (
                <button
                  onClick={() => {
                    const clientId = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID;
                    window.location.href = `https://github.com/login/oauth/authorize?client_id=${clientId}&scope=repo,user&state=${sessionId}`;
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#24292e] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#2f363d]"
                >
                  <Github className="h-4 w-4" />
                  Connect GitHub
                </button>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-lg border border-edge bg-void/50 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                      <span className="text-xs font-bold text-ink">Connected as {githubUsername}</span>
                    </div>
                    <button 
                      onClick={async () => {
                        await fetch(`/api/github/auth?sessionId=${sessionId}`, { method: 'DELETE' });
                        setGithubConnected(false);
                        setRepos([]);
                        setSelectedRepo('');
                      }}
                      className="text-[10px] font-bold text-red-400 hover:underline"
                    >
                      Disconnect
                    </button>
                  </div>
                  
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">Active Repository</label>
                    <select
                      value={selectedRepo}
                      onChange={async (e) => {
                        const repo = e.target.value;
                        setSelectedRepo(repo);
                        await fetch('/api/github/repos', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ sessionId, selectedRepo: repo })
                        });
                      }}
                      className="w-full rounded-lg border border-edge bg-void px-3 py-2 text-sm text-ink focus:outline-none focus:border-cyan/50"
                    >
                      <option value="">Select a repository...</option>
                      {repos.map((repo: any) => (
                        <option key={repo.id} value={repo.full_name}>
                          {repo.full_name}
                        </option>
                      ))}
                    </select>
                    <p className="text-[10px] text-ink-muted leading-relaxed">
                      Nexo Coder will use this repository to read and edit code.
                    </p>
                  </div>
                </div>
              )}
            </section>

            {/* Screen Share */}
            <section className="flex items-center justify-between">
              <div className="flex items-start gap-2">
                <ScreenShare className="mt-0.5 h-4 w-4 flex-shrink-0 text-cyan" />
                <div>
                  <h3 className="font-display text-sm font-semibold text-ink">Share screen with NEXO</h3>
                  <p className="text-xs text-ink-muted">Allow NEXO to request screen access during chats.</p>
                </div>
              </div>
              <button
                onClick={() => saveSettings({ ...settings, screen_share_enabled: !settings.screen_share_enabled })}
                className={`relative h-6 w-11 flex-shrink-0 rounded-full transition ${
                  settings.screen_share_enabled ? "bg-cyan" : "bg-edge"
                }`}
                aria-label="Toggle screen share permission"
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
                    settings.screen_share_enabled ? "left-5" : "left-0.5"
                  }`}
                />
              </button>
            </section>

            {/* Response Length */}
            <section>
              <div className="flex items-center gap-2 text-ink">
                <MessageSquareText className="h-4 w-4 text-cyan" />
                <h3 className="font-display text-sm font-semibold">Response Length</h3>
              </div>
              <div className="mt-2 flex gap-2">
                {(["short", "balanced", "detailed"] as const).map((opt) => (
                  <button
                    key={opt}
                    onClick={() => saveSettings({ ...settings, response_length: opt })}
                    className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium capitalize transition ${
                      settings.response_length === opt
                        ? "border-cyan bg-cyan/10 text-cyan"
                        : "border-edge text-ink-muted hover:border-cyan/30"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </section>

            {/* Language Preference */}
            <section>
              <div className="flex items-center gap-2 text-ink">
                <Languages className="h-4 w-4 text-cyan" />
                <h3 className="font-display text-sm font-semibold">Language</h3>
              </div>
              <div className="mt-2 flex gap-2">
                {(["auto", "sinhala", "english"] as const).map((opt) => (
                  <button
                    key={opt}
                    onClick={() => saveSettings({ ...settings, language_preference: opt })}
                    className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium capitalize transition ${
                      settings.language_preference === opt
                        ? "border-cyan bg-cyan/10 text-cyan"
                        : "border-edge text-ink-muted hover:border-cyan/30"
                    }`}
                  >
                    {opt === "auto" ? "Auto" : opt}
                  </button>
                ))}
              </div>
            </section>

            {/* Default Model */}
            <section>
              <div className="flex items-center gap-2 text-ink">
                <Cpu className="h-4 w-4 text-cyan" />
                <h3 className="font-display text-sm font-semibold">Default Model</h3>
              </div>
              <select
                value={settings.default_model}
                onChange={(e) => saveSettings({ ...settings, default_model: e.target.value })}
                className="mt-2 w-full rounded-lg border border-edge bg-void px-3 py-2 text-sm text-ink focus:outline-none focus:border-cyan/50"
              >
                {NEXO_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </section>

            {/* Clear History */}
            <section className="border-t border-edge pt-5">
              <button
                onClick={handleClearHistory}
                className={`flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition ${
                  confirmClear
                    ? "border-red-500 bg-red-500/10 text-red-500"
                    : "border-edge text-ink-muted hover:border-red-500/40 hover:text-red-500"
                }`}
              >
                <Trash2 className="h-4 w-4" />
                {confirmClear ? "Tap again to confirm" : "Clear all chat history"}
              </button>
            </section>

            {saved && (
              <div className="flex items-center justify-center gap-1.5 text-xs text-cyan">
                <Check className="h-3.5 w-3.5" />
                Saved
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
