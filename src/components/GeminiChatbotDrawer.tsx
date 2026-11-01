import React, { useState } from 'react';
import { ChatMessage, EventPreset, VenueMutationCommand } from '../types/planning';
import {
  formatCleanChatReply,
  formatINR,
  parseNaturalLanguageVenueCommand,
} from '../utils/planningLogic';
import { MessageSquare, X, Send, Brain, Zap, Sparkles, CheckCircle2 } from 'lucide-react';

interface GeminiChatbotDrawerProps {
  preset: EventPreset;
  isOpen: boolean;
  onToggle: () => void;
  onApplyVenueCommand: (cmd: VenueMutationCommand) => void;
}

export const GeminiChatbotDrawer: React.FC<GeminiChatbotDrawerProps> = ({
  preset,
  isOpen,
  onToggle,
  onApplyVenueCommand,
}) => {
  const [mode, setMode] = useState<'deep-thinking' | 'general' | 'fast-lite'>('general');
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-welcome',
      role: 'assistant',
      content: formatCleanChatReply(
        `Namaste & welcome to Aura Atelier. I am connected to ${preset.name} (${formatINR(
          preset.totalBudgetCap
        )} budget, ${preset.guestCountTarget} guests).\n\nYou can ask me to change the 3D venue (e.g., "Switch to outdoor garden in U-shape with emerald green tablecloth"), toggle lighting atmosphere ("Sunset Warmth", "Midnight Gala", "Daylight Crisp"), optimize your ₹ Rupee budget, or draft vendor counter-offers.`
      ),
      timestamp: 'Just now',
    },
  ]);

  const sendPrompt = async (promptText: string) => {
    const trimmed = promptText.trim();
    if (!trimmed || isSending) return;

    // 1. Check if the user's message contains a 3D Venue mutation command
    const localVenueCmd = parseNaturalLanguageVenueCommand(trimmed);
    if (localVenueCmd) {
      onApplyVenueCommand(localVenueCmd);
    }

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setInput('');
    setIsSending(true);

    try {
      const res = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg.content,
          history: nextHistory.slice(-6),
          mode,
          eventContext: `${preset.name} (${preset.category}) at ${preset.venueName}, Date: ${preset.date}, Target Guests: ${preset.guestCountTarget}, Budget Cap: ${formatINR(preset.totalBudgetCap)}, Environment: ${preset.environmentMode || 'conservatory'}, Layout: ${preset.tableLayout || 'banquet-radial'}`,
        }),
      });
      const data = await res.json();

      // If server also extracted a venue command, apply it
      if (data.venueCommand && !localVenueCmd) {
        onApplyVenueCommand(data.venueCommand);
      }

      const appliedSummary =
        localVenueCmd?.summaryLabel || data.venueCommand?.summaryLabel || undefined;

      const rawReply =
        data.reply ||
        (appliedSummary
          ? `I have updated your 3D Venue to ${appliedSummary} and synchronized your floor plan.`
          : 'I have prepared those recommendations for your event.');

      setMessages((prev) => [
        ...prev,
        {
          id: `ast-${Date.now()}`,
          role: 'assistant',
          content: formatCleanChatReply(rawReply),
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          appliedVenueChange: appliedSummary,
        },
      ]);
    } catch {
      const appliedSummary = localVenueCmd?.summaryLabel;
      setMessages((prev) => [
        ...prev,
        {
          id: `ast-err-${Date.now()}`,
          role: 'assistant',
          content: formatCleanChatReply(
            appliedSummary
              ? `Done! I have updated the 3D Venue with ${appliedSummary}. You can inspect the new arrangement in the 3D viewport.`
              : `For ${preset.name} (${formatINR(preset.totalBudgetCap)}), I recommend locking your 50% venue and culinary escrow milestones first while preserving a 10% unallocated contingency reserve.`
          ),
          timestamp: 'Now',
          appliedVenueChange: appliedSummary,
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    sendPrompt(input);
  };

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={onToggle}
        aria-label="Open Aura Planning Assistant"
        className="fixed bottom-5 right-5 z-40 px-4 py-2.5 bg-slate-900 text-white text-xs font-semibold rounded-full shadow-xl border border-slate-700 hover:bg-slate-800 transition-colors flex items-center gap-2 cursor-pointer"
      >
        <MessageSquare className="w-4 h-4 text-amber-400" />
        <span>Aura Concierge & 3D Chat</span>
      </button>
    );
  }

  return (
    <aside
      aria-label="Aura Planning Assistant"
      className="fixed bottom-4 right-4 z-50 w-[min(420px,94vw)] h-[550px] bg-white border border-slate-200 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between">
        <div>
          <div className="text-sm font-bold flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Aura Planning & 3D Venue Assistant</span>
          </div>
          <div className="text-[11px] text-slate-300">
            Type to rearrange 3D venue, change colors, or plan ₹ budgets
          </div>
        </div>
        <button
          type="button"
          onClick={onToggle}
          aria-label="Close Aura Assistant"
          className="p-1.5 text-slate-300 hover:text-white rounded-md cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Response Style Selector Bar (Zero AI model names) */}
      <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-1 text-[11px]">
        <button
          type="button"
          onClick={() => setMode('deep-thinking')}
          className={`flex-1 py-1 px-2 rounded font-medium flex items-center justify-center gap-1 cursor-pointer ${
            mode === 'deep-thinking'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:bg-slate-200/70'
          }`}
        >
          <Brain className="w-3 h-3 text-amber-400" />
          <span>Deep Strategy</span>
        </button>
        <button
          type="button"
          onClick={() => setMode('general')}
          className={`flex-1 py-1 px-2 rounded font-medium flex items-center justify-center gap-1 cursor-pointer ${
            mode === 'general'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:bg-slate-200/70'
          }`}
        >
          <Sparkles className="w-3 h-3 text-blue-400" />
          <span>Balanced</span>
        </button>
        <button
          type="button"
          onClick={() => setMode('fast-lite')}
          className={`flex-1 py-1 px-2 rounded font-medium flex items-center justify-center gap-1 cursor-pointer ${
            mode === 'fast-lite'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:bg-slate-200/70'
          }`}
        >
          <Zap className="w-3 h-3 text-teal-400" />
          <span>Instant</span>
        </button>
      </div>

      {/* Scrollable Conversation Thread */}
      <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50/40">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-[88%] rounded-xl px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-wrap ${
                m.role === 'user'
                  ? 'bg-slate-900 text-white'
                  : 'bg-white border border-slate-200 text-slate-800'
              }`}
            >
              {formatCleanChatReply(m.content)}
            </div>
            {m.appliedVenueChange && (
              <div className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-[11px] font-medium text-emerald-800">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Applied to 3D Venue: {m.appliedVenueChange}</span>
              </div>
            )}
            <div className="text-[10px] text-slate-400 mt-1 font-mono">{m.timestamp}</div>
          </div>
        ))}
        {isSending && (
          <div className="text-xs text-slate-500 font-mono">
            Aura is updating your plan...
          </div>
        )}
      </div>

      {/* One-Click Chat-to-3D Venue & Budget Starters */}
      <div className="px-3 py-2 bg-white border-t border-slate-100 grid grid-cols-2 gap-1.5">
        {[
          { label: 'Outdoor Garden + U-Shape', prompt: 'Switch to outdoor garden in U-shape layout' },
          { label: 'Indoor Ballroom + Gold', prompt: 'Make venue indoor ballroom with crimson & gold' },
          { label: 'Emerald Linen + 2 Tables', prompt: 'Change tablecloth color to emerald green & add 2 tables' },
          { label: 'Optimize ₹45,00,000 Split', prompt: 'Optimize ₹45,00,000 wedding budget split' },
        ].map((q) => (
          <button
            key={q.label}
            type="button"
            onClick={() => sendPrompt(q.prompt)}
            className="px-2 py-1 text-[11px] bg-slate-100 text-slate-700 rounded-md hover:bg-amber-100 hover:text-slate-900 truncate text-left cursor-pointer"
          >
            {q.label}
          </button>
        ))}
      </div>

      {/* Input Form */}
      <form
        onSubmit={handleSend}
        className="p-3 bg-white border-t border-slate-200 flex items-center gap-2"
      >
        <input
          type="text"
          aria-label="Message Aura Planning Assistant"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g., Switch to outdoor garden with emerald linen..."
          className="flex-1 px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
        />
        <button
          type="submit"
          disabled={isSending}
          aria-label="Send chat message"
          className="p-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </aside>
  );
};
