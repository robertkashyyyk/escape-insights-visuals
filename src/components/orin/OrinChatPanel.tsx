import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { Sparkles, X, Send, Loader2, ArrowLeft, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useAuth, useRole } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { OrinMessageBubble } from "./OrinMessageBubble";
import { OrinSuggestedChips } from "./OrinSuggestedChips";
import { toast } from "sonner";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  loading?: boolean;
  created_at?: string;
}

interface OrinChatPanelProps {
  open: boolean;
  onClose: () => void;
}

export function OrinChatPanel({ open, onClose }: OrinChatPanelProps) {
  const location = useLocation();
  const { user, session, profile } = useAuth();
  const { role, isClient } = useRole();
  const isMobile = useIsMobile();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load conversation history
  useEffect(() => {
    if (!open || !user || historyLoaded) return;
    const loadHistory = async () => {
      const { data } = await supabase
        .from("orin_conversations")
        .select("id, role, content, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .limit(50);
      if (data && data.length > 0) {
        setMessages(data.map((m: any) => ({
          id: m.id,
          role: m.role as "user" | "assistant",
          content: m.content,
          created_at: m.created_at,
        })));
      }
      setHistoryLoaded(true);
    };
    loadHistory();
  }, [open, user, historyLoaded]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 200);
  }, [open]);

  const handleClearConversation = async () => {
    if (!user) return;
    await supabase.from("orin_conversations").delete().eq("user_id", user.id);
    setMessages([]);
  };

  const handleSend = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming || !session) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text.trim(),
      created_at: new Date().toISOString(),
    };
    const loadingMsg: Message = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      loading: true,
    };
    setMessages((prev) => [...prev, userMsg, loadingMsg]);
    setInput("");
    setIsStreaming(true);

    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/orin-chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            question: text.trim(),
            current_page: location.pathname,
          }),
        }
      );

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errData.error || `Error ${resp.status}`);
      }

      if (!resp.body) throw new Error("No response body");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let assistantText = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIdx: number;
        while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIdx);
          buffer = buffer.slice(newlineIdx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantText += content;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === loadingMsg.id
                    ? { ...m, content: assistantText, loading: false }
                    : m
                )
              );
            }
          } catch {
            // partial JSON
          }
        }
      }

      // Final flush
      if (buffer.trim()) {
        for (const raw of buffer.split("\n")) {
          if (!raw.startsWith("data: ")) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantText += content;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === loadingMsg.id
                    ? { ...m, content: assistantText, loading: false }
                    : m
                )
              );
            }
          } catch {}
        }
      }

      if (!assistantText.trim()) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === loadingMsg.id
              ? { ...m, content: "I wasn't able to generate a response. Please try again.", loading: false }
              : m
          )
        );
      }
    } catch (e: any) {
      console.error("Orin chat error:", e);
      toast.error(e.message || "Failed to get a response from Orin");
      setMessages((prev) =>
        prev.map((m) =>
          m.id === loadingMsg.id
            ? { ...m, content: e.message || "Something went wrong. Please try again.", loading: false }
            : m
        )
      );
    } finally {
      setIsStreaming(false);
    }
  }, [isStreaming, session, location.pathname]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(input);
    }
  };

  const subtitle = isClient ? "Your property intelligence" : "Your portfolio intelligence";
  const hasMessages = messages.length > 0;

  return (
    <>
      {/* Backdrop on mobile */}
      {open && isMobile && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      )}

      {/* Panel */}
      <div
        className={`fixed top-0 right-0 z-50 h-full flex flex-col border-l transition-transform duration-[250ms] ease-in-out
          ${isMobile ? "w-full" : "w-[420px]"}
          bg-card/95 backdrop-blur-xl border-primary/10
          ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-primary/10">
          <div className="flex items-center gap-2.5">
            {isMobile ? (
              <button onClick={onClose} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors mr-1">
                <ArrowLeft className="h-4 w-4" />
              </button>
            ) : null}
            <div className="h-8 w-8 rounded-lg bg-primary/15 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground font-display">Orin</span>
                <Badge className="bg-primary/15 text-primary border-primary/20 text-[9px] px-1.5 py-0 font-semibold tracking-wider">AI</Badge>
              </div>
              <p className="text-[10px] text-muted-foreground/60 mt-0.5">{subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {hasMessages && (
              <button
                onClick={handleClearConversation}
                className="p-1.5 rounded-md text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors"
                title="Clear conversation"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
            {!isMobile && (
              <button onClick={onClose} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Amber divider */}
        <div className="h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {!hasMessages && (
            <OrinSuggestedChips
              isOwner={isClient}
              ownerName={profile?.display_name || "there"}
              onSend={handleSend}
            />
          )}

          {messages.map((msg) => (
            <OrinMessageBubble key={msg.id} message={msg} />
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="px-4 py-3 border-t border-border/20 bg-card/50">
          <form
            onSubmit={(e) => { e.preventDefault(); handleSend(input); }}
            className="flex items-end gap-2"
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask Orin anything about your portfolio..."
              rows={1}
              className="flex-1 text-xs bg-secondary/30 border border-border/20 rounded-xl px-4 py-2.5 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/40 transition-all resize-none max-h-24"
            />
            <button
              type="submit"
              disabled={!input.trim() || isStreaming}
              className="p-2.5 rounded-xl bg-primary text-primary-foreground disabled:opacity-20 hover:bg-primary/90 transition-all shrink-0"
            >
              {isStreaming ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
