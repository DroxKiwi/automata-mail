"use client";

import { Bot, Loader2, RotateCcw, SendHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { AgentStreamEvent } from "@/lib/assistant/agent-stream-events";
import { FALLBACK_EMPTY_ASSISTANT_REPLY_FR } from "@/lib/assistant/fallback-copy";
import { cn } from "@/lib/utils";

type OllamaSettingsJson = {
  baseUrl?: string;
  model?: string;
  error?: string;
};

type ThreadMessage =
  | { id: string; role: "user"; content: string }
  | {
      id: string;
      role: "assistant";
      content: string;
      isError?: boolean;
      streaming?: boolean;
    }
  | { id: string; role: "thinking"; content: string; streaming?: boolean }
  | {
      id: string;
      role: "tool";
      tool: string;
      label: string;
      ok: boolean;
      palette: string;
    };

const ASSISTANT_THREAD_STORAGE_KEY = "exparta-assistant-thread-v1";
const ASSISTANT_UI_STORAGE_KEY = "exparta-assistant-ui-v1";

function scopedStorageKey(base: string, scope: string): string {
  return `${base}:${scope}`;
}

type AssistantUiPersisted = {
  surfacesVisible: boolean;
  chatOpen: boolean;
};

function messagesToJsonForStorage(msgs: ThreadMessage[]): string {
  const serializable = msgs
    .filter(
      (m) =>
        !(
          (m.role === "assistant" || m.role === "thinking") &&
          m.streaming
        ),
    )
    .map((m) => {
      if (m.role === "assistant") {
        return {
          id: m.id,
          role: m.role,
          content: m.content,
          ...(m.isError ? { isError: true as const } : {}),
        };
      }
      if (m.role === "thinking") {
        return { id: m.id, role: m.role, content: m.content };
      }
      return m;
    });
  return JSON.stringify(serializable);
}

function parseStoredThreadMessages(json: string): ThreadMessage[] | null {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return null;
  }
  if (!Array.isArray(data)) return null;
  const out: ThreadMessage[] = [];
  for (const item of data) {
    if (typeof item !== "object" || item === null) continue;
    const o = item as Record<string, unknown>;
    if (typeof o.id !== "string" || typeof o.role !== "string") continue;
    switch (o.role) {
      case "user":
        if (typeof o.content !== "string") continue;
        out.push({ id: o.id, role: "user", content: o.content });
        break;
      case "assistant":
        if (typeof o.content !== "string") continue;
        out.push({
          id: o.id,
          role: "assistant",
          content: o.content,
          isError: o.isError === true,
        });
        break;
      case "thinking":
        if (typeof o.content !== "string") continue;
        out.push({ id: o.id, role: "thinking", content: o.content });
        break;
      case "tool":
        if (
          typeof o.tool === "string" &&
          typeof o.label === "string" &&
          typeof o.ok === "boolean" &&
          typeof o.palette === "string"
        ) {
          out.push({
            id: o.id,
            role: "tool",
            tool: o.tool,
            label: o.label,
            ok: o.ok,
            palette: o.palette,
          });
        }
        break;
      default:
        break;
    }
  }
  return out;
}

const TOOL_PALETTE_CLASS: Record<string, string> = {
  violet: "border-transparent bg-[#6f133f] text-white",
  sky: "border-transparent bg-[#6f133f] text-white",
  cyan: "border-transparent bg-[#6f133f] text-white",
  emerald: "border-transparent bg-[#6f133f] text-white",
  amber: "border-transparent bg-[#6f133f] text-white",
  orange: "border-transparent bg-[#6f133f] text-white",
  slate: "border-transparent bg-[#6f133f] text-white",
};

function ThreadUserBubble({ content }: { content: string }) {
  return (
    <div className="ollama-buddy-bubble-animate-user flex w-full justify-end">
      <div className="w-max max-w-full rounded-2xl border border-transparent bg-primary px-3.5 py-2.5 text-left shadow-md ring-1 ring-black/10 transition-colors hover:border-primary/45">
        <p className="text-xs leading-relaxed whitespace-pre-wrap break-words text-primary-foreground">
          {content}
        </p>
      </div>
    </div>
  );
}

function ThreadToolTagBubble({
  label,
  ok,
  palette,
}: {
  label: string;
  ok: boolean;
  palette: string;
}) {
  const paletteClass =
    TOOL_PALETTE_CLASS[palette] ?? TOOL_PALETTE_CLASS.slate;
  return (
    <div className="ollama-buddy-bubble-animate-assistant flex w-full justify-start">
      <div
        className={cn(
          "inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium shadow-sm ring-1 ring-black/5 transition-colors hover:border-[#b93a79] dark:ring-white/10",
          paletteClass,
          !ok && "opacity-90 ring-destructive/30",
        )}
        role="status"
      >
        <span className="truncate">{label}</span>
        <span
          className={cn(
            "shrink-0 rounded px-1 py-px text-[9px] font-semibold uppercase",
            ok
              ? "bg-[#8f1f57] text-white"
              : "bg-[#5d1035] text-white",
          )}
          aria-hidden
        >
          {ok ? "ok" : "échec"}
        </span>
      </div>
    </div>
  );
}

function ThreadThinkingBubble({
  content,
  streaming,
}: {
  content: string;
  streaming?: boolean;
}) {
  return (
    <div className="ollama-buddy-bubble-animate-assistant flex w-full justify-start">
      <div
        className="max-w-full rounded-xl border border-transparent bg-muted/25 px-3 py-2 text-left shadow-sm ring-1 ring-black/[0.03] transition-colors hover:border-border dark:bg-muted/20 dark:ring-white/[0.06]"
        role="note"
        aria-label="Réflexion du modèle"
      >
        <p className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground/70">
          Réflexion
        </p>
        {streaming && !content ? (
          <p className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
            <Loader2 className="size-3 shrink-0 animate-spin" aria-hidden />
            …
          </p>
        ) : (
          <p className="mt-1 text-[11px] font-light leading-relaxed text-muted-foreground whitespace-pre-wrap break-words">
            {content}
            {streaming ? (
              <span
                className="ml-px inline-block h-2.5 w-0.5 translate-y-0.5 animate-pulse bg-muted-foreground/50 align-middle"
                aria-hidden
              />
            ) : null}
          </p>
        )}
      </div>
    </div>
  );
}

function ThreadAssistantBubble({
  content,
  isError,
  streaming,
}: {
  content: string;
  isError?: boolean;
  streaming?: boolean;
}) {
  return (
    <div className="ollama-buddy-bubble-animate-assistant flex w-full justify-start">
      <div
        className={cn(
          "w-max max-w-full rounded-2xl border px-3.5 py-2.5 text-left shadow-md ring-1 transition-colors",
          isError
            ? "border-destructive/40 bg-[color-mix(in_srgb,var(--destructive)_10%,var(--card))] text-destructive ring-destructive/15"
            : "border-transparent bg-card text-foreground ring-black/5 hover:border-border dark:ring-white/10",
        )}
      >
        {streaming && !content ? (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden />
            Réponse…
          </p>
        ) : (
          <div
            className={cn(
              "text-xs leading-relaxed break-words",
              isError ? "text-destructive" : "text-foreground",
              "prose prose-xs max-w-none dark:prose-invert prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-pre:my-2 prose-code:before:content-none prose-code:after:content-none",
            )}
            role={isError ? "alert" : undefined}
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
            {streaming ? (
              <span
                className="ml-px inline-block h-3 w-0.5 translate-y-0.5 animate-pulse bg-primary align-middle"
                aria-hidden
              />
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

type ParsedAssistantSegment =
  | {
      type: "tool";
      tool: string;
      label: string;
      ok: boolean;
      palette: string;
    }
  | { type: "thinking"; content: string }
  | { type: "text"; content: string };

function parseAssistantSegments(data: {
  segments?: unknown;
  reply?: string;
}): ParsedAssistantSegment[] {
  const raw = data.segments;
  if (!Array.isArray(raw) || raw.length === 0) {
    const r = typeof data.reply === "string" ? data.reply : "";
    return [{ type: "text", content: r }];
  }
  const out: ParsedAssistantSegment[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const o = item as Record<string, unknown>;
    if (o.type === "tool") {
      if (
        typeof o.tool === "string" &&
        typeof o.label === "string" &&
        typeof o.ok === "boolean" &&
        typeof o.palette === "string"
      ) {
        out.push({
          type: "tool",
          tool: o.tool,
          label: o.label,
          ok: o.ok,
          palette: o.palette,
        });
      }
      continue;
    }
    if (o.type === "thinking" && typeof o.content === "string") {
      const t = o.content.trim();
      if (t.length > 0) out.push({ type: "thinking", content: o.content });
      continue;
    }
    if (o.type === "text" && typeof o.content === "string") {
      out.push({ type: "text", content: o.content });
    }
  }
  if (out.length === 0) {
    return [
      { type: "text", content: typeof data.reply === "string" ? data.reply : "" },
    ];
  }
  return out;
}

/**
 * Assistant flottant : fil à gauche du buddy, saisie à droite. Fermeture par clic extérieur ou Échap.
 */
export function OllamaBuddy({ userScopeKey }: { userScopeKey?: string }) {
  const router = useRouter();
  const storageScope = (userScopeKey?.trim().toLowerCase() || "anonymous").replace(/\s+/g, "");
  const threadStorageKey = scopedStorageKey(ASSISTANT_THREAD_STORAGE_KEY, storageScope);
  const uiStorageKey = scopedStorageKey(ASSISTANT_UI_STORAGE_KEY, storageScope);
  const [chatOpen, setChatOpen] = useState(false);
  /** false = tout est replié (sauf le bouton) ; true = fil + panneau possibles selon chatOpen. */
  const [surfacesVisible, setSurfacesVisible] = useState(true);
  const [uiRestored, setUiRestored] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [threadHydrated, setThreadHydrated] = useState(false);

  const [settingsLoading, setSettingsLoading] = useState(false);
  const [modelLabel, setModelLabel] = useState<string | null>(null);
  const [baseUrlHint, setBaseUrlHint] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [pendingMutation, setPendingMutation] = useState<{
    token: string;
    summary: string;
  } | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const threadScrollRef = useRef<HTMLDivElement>(null);
  const buddyRootRef = useRef<HTMLDivElement>(null);
  const streamThinkingIdRef = useRef<string | null>(null);
  const streamAssistantIdRef = useRef<string | null>(null);

  const collapseAssistant = useCallback(() => {
    setSurfacesVisible(false);
    setChatOpen(false);
  }, []);

  useEffect(() => {
    if (!surfacesVisible) return;
    const onPointerDown = (e: PointerEvent) => {
      const root = buddyRootRef.current;
      if (!root || root.contains(e.target as Node)) return;
      collapseAssistant();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [surfacesVisible, collapseAssistant]);

  const loadSettings = useCallback(async () => {
    setSettingsLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/settings/ollama");
      const data = (await res.json()) as OllamaSettingsJson;
      if (!res.ok) {
        setLoadError(data.error ?? "Chargement impossible.");
        setModelLabel(null);
        setBaseUrlHint(null);
        return;
      }
      setModelLabel(data.model?.trim() || null);
      setBaseUrlHint(data.baseUrl?.trim() || null);
    } catch {
      setLoadError("Erreur réseau.");
      setModelLabel(null);
      setBaseUrlHint(null);
    } finally {
      setSettingsLoading(false);
    }
  }, []);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(uiStorageKey);
      if (raw) {
        const j = JSON.parse(raw) as Partial<AssistantUiPersisted>;
        if (typeof j.surfacesVisible === "boolean") {
          setSurfacesVisible(j.surfacesVisible);
        }
        if (typeof j.chatOpen === "boolean") {
          setChatOpen(j.chatOpen);
        }
      }
    } catch {
      /* ignore */
    }
    setUiRestored(true);
  }, []);

  useEffect(() => {
    if (!uiRestored) return;
    try {
      const payload: AssistantUiPersisted = { surfacesVisible, chatOpen };
      sessionStorage.setItem(uiStorageKey, JSON.stringify(payload));
    } catch {
      /* ignore */
    }
  }, [uiRestored, surfacesVisible, chatOpen, uiStorageKey]);

  useEffect(() => {
    if (!chatOpen) return;
    void loadSettings();
  }, [chatOpen, loadSettings]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(threadStorageKey);
      if (raw) {
        const parsed = parseStoredThreadMessages(raw);
        if (parsed && parsed.length > 0) {
          setMessages(parsed);
        }
      }
    } catch {
      /* ignore */
    }
    setThreadHydrated(true);
  }, [threadStorageKey]);

  useEffect(() => {
    if (!threadHydrated) return;
    try {
      if (messages.length === 0) {
        localStorage.removeItem(threadStorageKey);
      } else {
        localStorage.setItem(
          threadStorageKey,
          messagesToJsonForStorage(messages),
        );
      }
    } catch {
      /* quota / navigation privée */
    }
  }, [messages, threadHydrated, threadStorageKey]);

  useEffect(() => {
    if (!chatOpen) return;
    const t = window.setTimeout(() => textareaRef.current?.focus(), 100);
    return () => window.clearTimeout(t);
  }, [chatOpen]);

  useEffect(() => {
    if (!surfacesVisible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        collapseAssistant();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [surfacesVisible, collapseAssistant]);

  useEffect(() => {
    if (chatOpen) return;
    abortRef.current?.abort();
    abortRef.current = null;
    setMessage("");
    setIsSending(false);
  }, [chatOpen]);

  useEffect(() => {
    const threadShown = messages.length > 0 && surfacesVisible;
    if (!threadShown) return;

    const scrollThreadToBottom = () => {
      const el = threadScrollRef.current;
      if (el) {
        el.scrollTop = el.scrollHeight;
      }
    };

    scrollThreadToBottom();
    const raf = requestAnimationFrame(() => {
      scrollThreadToBottom();
      requestAnimationFrame(scrollThreadToBottom);
    });
    const t = window.setTimeout(scrollThreadToBottom, 160);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(t);
    };
  }, [messages, isSending, surfacesVisible]);

  function toggleChat() {
    if (!surfacesVisible) {
      setSurfacesVisible(true);
      setChatOpen(true);
      return;
    }
    setChatOpen((v) => !v);
  }

  const resetThread = useCallback(() => {
    streamThinkingIdRef.current = null;
    streamAssistantIdRef.current = null;
    abortRef.current?.abort();
    abortRef.current = null;
    setMessages([]);
    setPendingMutation(null);
    setConfirmError(null);
    setIsSending(false);
    try {
      localStorage.removeItem(threadStorageKey);
    } catch {
      /* ignore */
    }
  }, [threadStorageKey]);

  const sendDisabled =
    isSending ||
    settingsLoading ||
    !modelLabel ||
    Boolean(loadError) ||
    !message.trim();

  const sendMessage = useCallback(async () => {
    const text = message.trim();
    if (!text || !modelLabel || loadError || isSending) return;

    setPendingMutation(null);
    setConfirmError(null);

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    const userId = crypto.randomUUID();
    const nextForApi: { role: "user" | "assistant"; content: string }[] = [
      ...messages
        .filter(
          (
            m,
          ): m is
            | Extract<ThreadMessage, { role: "user" }>
            | Extract<ThreadMessage, { role: "assistant" }> =>
            m.role === "user" ||
            (m.role === "assistant" &&
              (m.content.trim().length > 0 || Boolean(m.isError))),
        )
        .map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: text },
    ];

    const assistPlaceholderId = crypto.randomUUID();
    streamThinkingIdRef.current = null;
    streamAssistantIdRef.current = assistPlaceholderId;

    setMessages((prev) => [
      ...prev,
      { id: userId, role: "user", content: text },
      {
        id: assistPlaceholderId,
        role: "assistant",
        content: "",
        streaming: true,
      },
    ]);
    setMessage("");
    setIsSending(true);

    const applyStreamEvent = (ev: AgentStreamEvent) => {
      switch (ev.type) {
        case "thinking_delta": {
          if (!ev.text) return;
          setMessages((prev) => {
            let tid = streamThinkingIdRef.current;
            if (!tid) {
              tid = crypto.randomUUID();
              streamThinkingIdRef.current = tid;
              const aid = streamAssistantIdRef.current;
              const insertIdx =
                aid !== null ? prev.findIndex((m) => m.id === aid) : -1;
              const thinkingMsg = {
                id: tid,
                role: "thinking" as const,
                content: ev.text,
                streaming: true,
              };
              if (insertIdx >= 0) {
                return [
                  ...prev.slice(0, insertIdx),
                  thinkingMsg,
                  ...prev.slice(insertIdx),
                ];
              }
              return [...prev, thinkingMsg];
            }
            return prev.map((m) =>
              m.id === tid && m.role === "thinking"
                ? { ...m, content: m.content + ev.text }
                : m,
            );
          });
          return;
        }
        case "content_delta": {
          if (!ev.text) return;
          setMessages((prev) => {
            const aid = streamAssistantIdRef.current;
            if (aid) {
              const exists = prev.some(
                (m) => m.id === aid && m.role === "assistant",
              );
              if (exists) {
                return prev.map((m) =>
                  m.id === aid && m.role === "assistant"
                    ? { ...m, content: m.content + ev.text }
                    : m,
                );
              }
            }
            const newId = crypto.randomUUID();
            streamAssistantIdRef.current = newId;
            return [
              ...prev,
              {
                id: newId,
                role: "assistant" as const,
                content: ev.text,
                streaming: true,
              },
            ];
          });
          return;
        }
        case "stream_reset": {
          streamThinkingIdRef.current = null;
          const nextAid = crypto.randomUUID();
          streamAssistantIdRef.current = nextAid;
          setMessages((prev) => [
            ...prev.map((m) =>
              (m.role === "assistant" || m.role === "thinking") && m.streaming
                ? { ...m, streaming: false }
                : m,
            ),
            {
              id: nextAid,
              role: "assistant" as const,
              content: "",
              streaming: true,
            },
          ]);
          return;
        }
        case "tool": {
          setMessages((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              role: "tool" as const,
              tool: ev.tool,
              label: ev.label,
              ok: ev.ok,
              palette: ev.palette,
            },
          ]);
          return;
        }
        case "content_final": {
          setMessages((prev) => {
            const aid = streamAssistantIdRef.current;
            if (aid) {
              return prev.map((m) =>
                m.id === aid && m.role === "assistant"
                  ? { ...m, content: ev.text, streaming: false }
                  : m,
              );
            }
            const nid = crypto.randomUUID();
            streamAssistantIdRef.current = nid;
            return [
              ...prev,
              {
                id: nid,
                role: "assistant" as const,
                content: ev.text,
                streaming: false,
              },
            ];
          });
          return;
        }
        case "done": {
          const replyText =
            typeof ev.reply === "string" ? ev.reply.trim() : "";
          streamThinkingIdRef.current = null;
          streamAssistantIdRef.current = null;
          setMessages((prev) =>
            prev.map((m) => {
              if (
                (m.role === "assistant" || m.role === "thinking") &&
                m.streaming
              ) {
                if (
                  m.role === "assistant" &&
                  !m.content.trim() &&
                  replyText.length > 0
                ) {
                  return {
                    ...m,
                    content: ev.reply,
                    streaming: false,
                  };
                }
                return { ...m, streaming: false };
              }
              return m;
            }),
          );
          const nav =
            typeof ev.navigation === "string" && ev.navigation.length > 0
              ? ev.navigation
              : null;
          if (nav) {
            router.push(nav);
          }
          const pm = ev.pendingMutation;
          if (
            pm &&
            typeof pm.token === "string" &&
            pm.token.length > 0 &&
            typeof pm.summary === "string"
          ) {
            setPendingMutation({ token: pm.token, summary: pm.summary });
          } else {
            setPendingMutation(null);
          }
          return;
        }
        case "error": {
          streamThinkingIdRef.current = null;
          streamAssistantIdRef.current = null;
          setMessages((prev) => [
            ...prev.filter(
              (m) =>
                !(
                  (m.role === "assistant" || m.role === "thinking") &&
                  m.streaming
                ),
            ),
            {
              id: crypto.randomUUID(),
              role: "assistant",
              content: ev.message,
              isError: true,
            },
          ]);
          return;
        }
        default:
          return;
      }
    };

    try {
      const res = await fetch("/api/assistant/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextForApi }),
        signal: ac.signal,
      });

      if (!res.ok) {
        const errText = await res.text();
        let errMsg = `Erreur ${res.status}`;
        const firstLine = errText.trim().split("\n")[0];
        if (firstLine) {
          try {
            const j = JSON.parse(firstLine) as AgentStreamEvent;
            if (j.type === "error") errMsg = j.message;
          } catch {
            /* ignore */
          }
        }
        applyStreamEvent({ type: "error", message: errMsg });
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        applyStreamEvent({
          type: "error",
          message: "Réponse vide du serveur.",
        });
        return;
      }

      const dec = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          const t = line.trim();
          if (!t) continue;
          try {
            applyStreamEvent(JSON.parse(t) as AgentStreamEvent);
          } catch {
            /* ligne NDJSON invalide */
          }
        }
      }
      if (buf.trim()) {
        try {
          applyStreamEvent(JSON.parse(buf.trim()) as AgentStreamEvent);
        } catch {
          /* ignore */
        }
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        streamThinkingIdRef.current = null;
        streamAssistantIdRef.current = null;
        setMessages((prev) =>
          prev.filter(
            (m) =>
              !(
                (m.role === "assistant" || m.role === "thinking") &&
                m.streaming
              ),
          ),
        );
        return;
      }
      const msg = e instanceof Error ? e.message : "Erreur inconnue.";
      applyStreamEvent({ type: "error", message: msg });
    } finally {
      setIsSending(false);
    }
  }, [message, modelLabel, loadError, isSending, messages, router]);

  const confirmPendingMutation = useCallback(async () => {
    if (!pendingMutation) return;
    setConfirmLoading(true);
    setConfirmError(null);
    try {
      const res = await fetch("/api/assistant/confirm-mutation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: pendingMutation.token }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        ok?: boolean;
      };
      if (!res.ok) {
        setConfirmError(data.error ?? `Erreur ${res.status}`);
        return;
      }
      setPendingMutation(null);
      router.refresh();
    } catch {
      setConfirmError("Erreur réseau.");
    } finally {
      setConfirmLoading(false);
    }
  }, [pendingMutation, router]);

  function onTextareaKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!sendDisabled) void sendMessage();
    }
  }

  const showThread = messages.length > 0;
  const showHint = messages.length === 0;
  const chromeMotionClass =
    "transition-all duration-500 ease-in-out motion-reduce:transition-none";

  return (
    <div className="pointer-events-none fixed bottom-0 left-24 right-0 z-[45] flex justify-center p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6 md:left-80">
      <div
        ref={buddyRootRef}
        className="flex max-w-full flex-row items-end justify-center gap-2 sm:gap-3"
      >
        {showThread && surfacesVisible ? (
          <div className={chromeMotionClass}>
            <div
              ref={threadScrollRef}
              className="pointer-events-auto max-h-[min(50vh,26rem)] min-w-0 max-w-[min(20rem,calc(100vw-10rem))] overflow-y-auto overscroll-y-contain rounded-lg pr-1"
              role="log"
              aria-label="Fil de discussion avec l'assistant"
            >
              <div className="flex min-h-min flex-col gap-3 pb-1">
                {messages.map((m) => {
                  const isLast = messages[messages.length - 1]?.id === m.id;
                  const streamActive =
                    isSending &&
                    m.role === "assistant" &&
                    !m.isError &&
                    isLast &&
                    Boolean(m.streaming);
                  if (m.role === "user") {
                    return <ThreadUserBubble key={m.id} content={m.content} />;
                  }
                  if (m.role === "tool") {
                    return (
                      <ThreadToolTagBubble
                        key={m.id}
                        label={m.label}
                        ok={m.ok}
                        palette={m.palette}
                      />
                    );
                  }
                  if (m.role === "thinking") {
                    return (
                      <ThreadThinkingBubble
                        key={m.id}
                        content={m.content}
                        streaming={m.streaming}
                      />
                    );
                  }
                  return (
                    <ThreadAssistantBubble
                      key={m.id}
                      content={m.content}
                      isError={m.isError}
                      streaming={streamActive}
                    />
                  );
                })}
                <div className="h-px w-full shrink-0" aria-hidden />
              </div>
            </div>
          </div>
        ) : null}

        <div className="flex shrink-0 flex-col items-center">
          {showHint ? (
            <div className="ollama-buddy-bubble-animate pointer-events-none mb-1.5 flex justify-center">
              <div className="max-w-[min(17rem,calc(100vw-7rem))] rounded-2xl border border-transparent bg-card px-3.5 py-2.5 text-center shadow-md ring-1 ring-black/5 transition-colors hover:border-border dark:ring-white/10">
                <p className="text-xs font-semibold leading-snug text-foreground">
                  Psst… Besoin d&apos;un coup de main ?
                </p>
                <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                  Assistant Ollama — ouvre-moi quand tu veux.
                </p>
              </div>
            </div>
          ) : null}

          <Button
            type="button"
            className="pointer-events-auto h-14 w-14 shrink-0 rounded-full border border-primary/30 bg-primary p-0 text-primary-foreground shadow-lg ring-4 ring-background transition hover:scale-105 hover:bg-primary/90"
            aria-label={
              !surfacesVisible
                ? "Rouvrir la conversation avec l'assistant Ollama"
                : "Ouvrir ou fermer l'assistant Ollama"
            }
            aria-expanded={surfacesVisible}
            onClick={toggleChat}
          >
            <Bot className="size-7" aria-hidden />
          </Button>
        </div>

        {chatOpen && surfacesVisible ? (
          <div
            className={cn(
              chromeMotionClass,
              "ollama-buddy-chat-bubble-animate pointer-events-auto min-w-0 max-w-[min(22rem,calc(100vw-8rem))] rounded-2xl border border-transparent bg-card p-3 shadow-md ring-1 ring-black/5 transition-colors hover:border-border dark:ring-white/10",
            )}
          >
            <p className="text-xs font-semibold text-foreground">Assistant</p>
            {pendingMutation ? (
              <div
                className="mb-2 rounded-lg border border-amber-500/35 bg-amber-500/10 p-2.5 dark:bg-amber-500/15"
                role="region"
                aria-label="Confirmation requise"
              >
                <p className="text-[10px] font-semibold text-foreground">
                  Archivage en attente de confirmation
                </p>
                <p className="mt-1 text-[10px] leading-snug text-muted-foreground">
                  {pendingMutation.summary}
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="mt-2 h-8 w-full text-[11px]"
                  disabled={confirmLoading}
                  onClick={() => void confirmPendingMutation()}
                >
                  {confirmLoading ? (
                    <Loader2 className="size-3.5 animate-spin" aria-hidden />
                  ) : (
                    "Confirmer l’archivage"
                  )}
                </Button>
                {confirmError ? (
                  <p className="mt-1.5 text-[10px] text-destructive" role="alert">
                    {confirmError}
                  </p>
                ) : null}
              </div>
            ) : null}
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {settingsLoading
                ? "Chargement des réglages…"
                : loadError
                  ? loadError
                  : modelLabel
                    ? (
                        <>
                          Modèle{" "}
                          <span className="font-mono text-foreground">{modelLabel}</span>
                          {baseUrlHint ? (
                            <>
                              {" "}
                              ·{" "}
                              <span className="break-all font-mono text-[10px]">
                                {baseUrlHint}
                              </span>
                            </>
                          ) : null}
                        </>
                      )
                    : "Aucun modèle — configure Ollama dans Réglages."}
            </p>
            <div className="mt-2 flex gap-2">
              <Textarea
                ref={textareaRef}
                id="ollama-buddy-message"
                name="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={onTextareaKeyDown}
                placeholder="Écris ton message…"
                rows={3}
                disabled={isSending}
                className="min-h-[4.5rem] flex-1 resize-none rounded-xl border-border bg-background/80 text-sm dark:bg-input/20"
                aria-label="Message pour l'assistant Ollama"
              />
              <div className="flex shrink-0 items-end gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-11 w-11 rounded-xl border-border bg-background/80"
                  disabled={isSending || messages.length === 0}
                  title="Effacer le fil de discussion"
                  aria-label="Réinitialiser la conversation"
                  onClick={resetThread}
                >
                  <RotateCcw className="size-4" aria-hidden />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  className="h-11 w-11 shrink-0 rounded-xl"
                  disabled={sendDisabled}
                  aria-label="Envoyer le message"
                  onClick={() => void sendMessage()}
                >
                  {isSending ? (
                    <Loader2 className="size-5 animate-spin" aria-hidden />
                  ) : (
                    <SendHorizontal className="size-5" aria-hidden />
                  )}
                </Button>
              </div>
            </div>
            <p className="mt-1.5 text-[10px] text-muted-foreground">
              Fil conservé sur cet appareil · Entrée envoie · Maj+Entrée nouvelle
              ligne · Échap ou clic à l’extérieur referme l’assistant
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
