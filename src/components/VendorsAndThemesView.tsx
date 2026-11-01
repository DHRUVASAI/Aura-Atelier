import React, { useEffect, useState } from 'react';
import { EventPreset, MoodBoardItem, VendorRecord } from '../types/planning';
import { formatINR, generateCounterOffer, NegotiationStrategy } from '../utils/planningLogic';
import { Sparkles, Zap, Brain, CheckSquare, Image as ImageIcon, Send, Plus } from 'lucide-react';
import { CustomSelectPopover } from './CustomSelectPopover';

interface VendorsAndThemesViewProps {
  preset: EventPreset;
  vendors: VendorRecord[];
  moodBoards: MoodBoardItem[];
  onToggleChecklist: (vendorId: string, checklistId: string) => void;
  onAddVendor: (vendor: Omit<VendorRecord, 'id'>) => void;
  onAddMoodBoard: (board: MoodBoardItem) => void;
  onSendToWorkspaceEmail?: (to: string, subject: string, body: string) => void;
}

export const VendorsAndThemesView: React.FC<VendorsAndThemesViewProps> = ({
  preset,
  vendors,
  moodBoards,
  onToggleChecklist,
  onAddVendor,
  onAddMoodBoard,
  onSendToWorkspaceEmail,
}) => {
  const [selectedVendorId, setSelectedVendorId] = useState<string>(
    vendors[2]?.id || vendors[0]?.id || ''
  );
  const [negotiationFastMode, setNegotiationFastMode] = useState<boolean>(false);
  const [isGeneratingOffer, setIsGeneratingOffer] = useState<boolean>(false);

  // Add Custom Vendor Form State
  const [newVendorName, setNewVendorName] = useState('');
  const [newVendorCat, setNewVendorCat] = useState('Floral & Botanicals');
  const [newVendorEmail, setNewVendorEmail] = useState('');
  const [newVendorQuote, setNewVendorQuote] = useState(450000);
  const [newVendorTarget, setNewVendorTarget] = useState(380000);

  const fallbackVendor: VendorRecord = {
    id: 'ven-empty',
    name: 'Custom Event Partner',
    category: 'Venue & Architecture',
    contactEmail: 'partner@example.com',
    quotedAmount: 500000,
    negotiatedTarget: 420000,
    paidAmount: 0,
    status: 'Negotiating',
    rating: 4.9,
    leverageNotes: ['Immediate 50% escrow deposit upon signature'],
    checklist: [],
  };

  const activeVendor =
    vendors.find((v) => v.id === selectedVendorId) || vendors[0] || fallbackVendor;

  const [strategy, setStrategy] = useState<NegotiationStrategy>(() =>
    generateCounterOffer(activeVendor, preset.name)
  );

  useEffect(() => {
    setStrategy(generateCounterOffer(activeVendor, preset.name));
  }, [activeVendor.id, preset.name]);

  // Mood Board Image Generator State
  const [imagePrompt, setImagePrompt] = useState(
    'Candlelit royal courtyard reception with sandstone banquet tables, cascading white mogra and orchids, and warm brass urlis'
  );
  const [imageTitle, setImageTitle] = useState('Courtyard Reception Table Styling');
  const [imageSize, setImageSize] = useState<'1K' | '2K' | '4K'>('2K');
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '4:3' | '1:1'>('16:9');
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);

  // Theme Concept Generator State
  const [themeStyleInput, setThemeStyleInput] = useState(
    'Royal sandstone, jasmine garlands, warm brass lamps, acoustic sitar'
  );
  const [generatedThemeConcept, setGeneratedThemeConcept] = useState<{
    themeTitle: string;
    themeSubtitle: string;
    architecturalNotes: string;
    palette: string[];
    signatureMoments: string[];
  } | null>(null);
  const [isGeneratingTheme, setIsGeneratingTheme] = useState(false);

  const handleSelectVendor = (vendor: VendorRecord) => {
    setSelectedVendorId(vendor.id);
    setStrategy(generateCounterOffer(vendor, preset.name));
  };

  const handleCreateVendor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVendorName.trim()) return;
    onAddVendor({
      name: newVendorName.trim(),
      category: newVendorCat,
      contactEmail: newVendorEmail.trim() || 'vendor@example.com',
      quotedAmount: Math.max(1000, Number(newVendorQuote) || 100000),
      negotiatedTarget: Math.max(1000, Number(newVendorTarget) || 85000),
      paidAmount: 0,
      status: 'Negotiating',
      rating: 4.9,
      leverageNotes: [
        'Immediate 50% escrow deposit upon signature',
        'Off-peak morning load-in schedule',
      ],
      checklist: [
        {
          id: `chk-${Date.now()}`,
          task: 'Finalize scope addendum and load-in timing',
          completed: false,
          dueDate: preset.date,
        },
      ],
    });
    setNewVendorName('');
    setNewVendorEmail('');
  };

  const handleRunAiNegotiator = async () => {
    setIsGeneratingOffer(true);
    try {
      const res = await fetch('/api/gemini/negotiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendorName: activeVendor.name,
          category: activeVendor.category,
          quotedAmount: activeVendor.quotedAmount,
          targetAmount: activeVendor.negotiatedTarget,
          leverageNotes: activeVendor.leverageNotes,
          eventName: preset.name,
          fastMode: negotiationFastMode,
        }),
      });
      const data = await res.json();
      const base = generateCounterOffer(activeVendor, preset.name);
      setStrategy({
        ...base,
        subjectLine: data.subjectLine || base.subjectLine,
        openingCounterOffer: Number(data.openingCounterOffer || base.openingCounterOffer),
        emailBody: data.emailBody || base.emailBody,
        tacticalTalkingPoints:
          Array.isArray(data.tacticalTalkingPoints) && data.tacticalTalkingPoints.length > 0
            ? data.tacticalTalkingPoints
            : base.tacticalTalkingPoints,
      });
    } catch {
      setStrategy(generateCounterOffer(activeVendor, preset.name));
    } finally {
      setIsGeneratingOffer(false);
    }
  };

  const buildClientMoodBoardSvg = (titleText: string, promptText: string) => {
    const safeTitle = titleText.replace(/[<>&"']/g, '');
    const safePrompt = promptText.slice(0, 95).replace(/[<>&"']/g, '');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#0f172a"/>
          <stop offset="55%" stop-color="#1e293b"/>
          <stop offset="100%" stop-color="${preset.accentHex || '#D4AF37'}"/>
        </linearGradient>
      </defs>
      <rect width="1280" height="720" fill="url(#bg)"/>
      <circle cx="980" cy="240" r="210" fill="${preset.linenColor || '#F5F0E6'}" fill-opacity="0.12"/>
      <circle cx="320" cy="520" r="260" fill="${preset.accentHex || '#D4AF37'}" fill-opacity="0.15"/>
      <rect x="72" y="72" width="1136" height="576" rx="24" fill="none" stroke="${preset.accentHex || '#D4AF37'}" stroke-opacity="0.45" stroke-width="2"/>
      <text x="116" y="160" fill="${preset.accentHex || '#D4AF37'}" font-family="Georgia, serif" font-size="20" letter-spacing="3">AURA ATELIER · ARCHITECTURAL MOOD BOARD (${imageSize})</text>
      <text x="116" y="230" fill="#ffffff" font-family="Georgia, serif" font-size="44" font-weight="bold">${safeTitle}</text>
      <text x="116" y="290" fill="#cbd5e1" font-family="system-ui, sans-serif" font-size="22">${safePrompt}</text>
      <rect x="116" y="510" width="90" height="44" rx="8" fill="${preset.linenColor || '#F5F0E6'}"/>
      <rect x="222" y="510" width="90" height="44" rx="8" fill="${preset.accentHex || '#D4AF37'}"/>
      <rect x="328" y="510" width="90" height="44" rx="8" fill="#1E293B" stroke="#475569"/>
    </svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  };

  const handleGenerateMoodBoardImage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imagePrompt.trim()) return;
    setIsGeneratingImage(true);
    const cleanTitle = imageTitle.trim() || 'Custom Event Mood Board';
    try {
      const res = await fetch('/api/gemini/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: imagePrompt.trim(),
          imageSize,
          aspectRatio,
          title: cleanTitle,
        }),
      });
      const data = res.ok ? await res.json() : null;
      const imageUrl =
        data?.imageUrl || buildClientMoodBoardSvg(cleanTitle, imagePrompt.trim());
      onAddMoodBoard({
        id: `mb-${Date.now()}`,
        title: `${cleanTitle} (${imageSize})`,
        category: preset.category,
        prompt: imagePrompt.trim(),
        resolution: imageSize,
        aspectRatio,
        imageUrl,
        palette: [preset.linenColor, preset.accentHex, '#1E293B', '#0F172A'],
        architecturalNotes: `Synthesized studio concept at ${imageSize} (${aspectRatio}).`,
        createdAt: new Date().toISOString().slice(0, 10),
      });
    } catch {
      onAddMoodBoard({
        id: `mb-${Date.now()}`,
        title: `${cleanTitle} (${imageSize})`,
        category: preset.category,
        prompt: imagePrompt.trim(),
        resolution: imageSize,
        aspectRatio,
        imageUrl: buildClientMoodBoardSvg(cleanTitle, imagePrompt.trim()),
        palette: [preset.linenColor, preset.accentHex, '#1E293B', '#0F172A'],
        architecturalNotes: `Synthesized studio concept at ${imageSize} (${aspectRatio}).`,
        createdAt: new Date().toISOString().slice(0, 10),
      });
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleGenerateThemeConcept = async () => {
    setIsGeneratingTheme(true);
    try {
      const res = await fetch('/api/gemini/theme-ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: preset.category,
          guestCount: preset.guestCountTarget,
          budgetCap: preset.totalBudgetCap,
          stylePrompt: themeStyleInput,
          fastMode: negotiationFastMode,
        }),
      });
      if (!res.ok) throw new Error('Fallback to local studio synthesis');
      const data = await res.json();
      setGeneratedThemeConcept(data);
    } catch {
      setGeneratedThemeConcept({
        themeTitle: `${preset.name} — Bespoke Architectural Direction`,
        themeSubtitle: `Curated for ${preset.guestCountTarget} guests (${formatINR(preset.totalBudgetCap)} cap)`,
        architecturalNotes: `Combines ${themeStyleInput} with ${preset.lightingMode || 'sunset-warmth'} illumination, custom ${preset.linenColor} table linens, and ${preset.accentHex} metallic accents.`,
        palette: [preset.linenColor, preset.accentHex, '#1E293B', '#0F766E'],
        signatureMoments: [
          'Processional courtyard entrance framed by warm brass urlis',
          'Acoustic ensemble synchronized with golden-hour perimeter lighting',
        ],
      });
    } finally {
      setIsGeneratingTheme(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-12">
      {/* Section 1: Automated Vendor Negotiation & Checklists */}
      <section className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <p className="text-xs text-slate-500">
              02. Automated Contract Negotiation · ₹ INR Counter-Offers & Checklists
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 font-display mt-1">
              Vendor Checklists & Counter-Offer Negotiator
            </h1>
          </div>

          {/* Strategy Mode Switcher (No model names) */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setNegotiationFastMode(false)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                !negotiationFastMode
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Brain className="w-3.5 h-3.5 text-amber-600" />
              <span>Deep Strategy Mode</span>
            </button>
            <button
              type="button"
              onClick={() => setNegotiationFastMode(true)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                negotiationFastMode
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-teal-600" />
              <span>Instant Draft Mode</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left 5 Columns: Vendor Roster + Add Custom Vendor Form */}
          <div className="lg:col-span-5 space-y-4">
            {vendors.map((v) => {
              const isSelected = v.id === activeVendor.id;
              const savings = Math.max(0, v.quotedAmount - v.negotiatedTarget);
              return (
                <div
                  key={v.id}
                  onClick={() => handleSelectVendor(v)}
                  className={`p-5 rounded-xl border transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-white border-slate-900 shadow-sm'
                      : 'bg-white border-slate-200 hover:border-slate-400'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">{v.name}</h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {v.category} · Status: {v.status} · Rating {v.rating}
                      </p>
                    </div>
                    <div className="text-right font-mono tabular-nums">
                      <div className="text-xs text-slate-400 line-through">
                        Quote: {formatINR(v.quotedAmount)}
                      </div>
                      <div className="text-sm font-bold text-slate-900">
                        Target: {formatINR(v.negotiatedTarget)}
                      </div>
                      <div className="text-[11px] text-emerald-700 font-semibold">
                        Save {formatINR(savings)}
                      </div>
                    </div>
                  </div>

                  {/* Vendor Checklist Items */}
                  <div
                    className="mt-4 pt-3 border-t border-slate-100 space-y-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                      <CheckSquare className="w-3.5 h-3.5 text-slate-500" />
                      <span>Contract & Production Checklist</span>
                    </div>
                    {v.checklist.map((chk) => (
                      <label
                        key={chk.id}
                        className="flex items-center justify-between gap-2 text-xs text-slate-700 cursor-pointer"
                      >
                        <span className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={chk.completed}
                            onChange={() => onToggleChecklist(v.id, chk.id)}
                            className="rounded border-slate-300 accent-slate-900"
                          />
                          <span className={chk.completed ? 'line-through text-slate-400' : ''}>
                            {chk.task}
                          </span>
                        </span>
                        <span className="font-mono tabular-nums text-[11px] text-slate-400 shrink-0">
                          {chk.dueDate}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Add Custom Vendor Form */}
            <form
              onSubmit={handleCreateVendor}
              className="p-4 bg-white border border-slate-200 rounded-xl space-y-3"
            >
              <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5" />
                <span>Add Your Own Vendor Partner (₹)</span>
              </h3>
              <div className="grid grid-cols-2 gap-2.5">
                <input
                  type="text"
                  value={newVendorName}
                  onChange={(e) => setNewVendorName(e.target.value)}
                  placeholder="Vendor Name *"
                  className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-md"
                />
                <input
                  type="email"
                  value={newVendorEmail}
                  onChange={(e) => setNewVendorEmail(e.target.value)}
                  placeholder="Vendor Email"
                  className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-md"
                />
                <input
                  type="number"
                  value={newVendorQuote}
                  onChange={(e) => setNewVendorQuote(Number(e.target.value))}
                  placeholder="Initial Quote (₹)"
                  title="Initial Quote in Rupees"
                  className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-md font-mono"
                />
                <input
                  type="number"
                  value={newVendorTarget}
                  onChange={(e) => setNewVendorTarget(Number(e.target.value))}
                  placeholder="Target Budget (₹)"
                  title="Target Cap in Rupees"
                  className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-md font-mono"
                />
              </div>
              <div className="flex items-center gap-2">
                <CustomSelectPopover
                  ariaLabel="Vendor Category"
                  variant="light"
                  className="flex-1"
                  value={newVendorCat}
                  onChange={(val) => setNewVendorCat(val)}
                  options={[
                    { value: 'Venue & Architecture', label: 'Venue & Architecture' },
                    { value: 'Culinary & Beverage', label: 'Culinary & Beverage' },
                    { value: 'Floral & Botanicals', label: 'Floral & Botanicals' },
                    { value: 'Production & Audio', label: 'Production & Audio' },
                    { value: 'Photography & Cinema', label: 'Photography & Cinema' },
                  ]}
                />
                <button
                  type="submit"
                  className="px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-md hover:bg-slate-800 cursor-pointer"
                >
                  Add Vendor
                </button>
              </div>
            </form>
          </div>

          {/* Right 7 Columns: Automated Counter-Offer Desk */}
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
              <div>
                <div className="text-xs text-slate-500">
                  Selected Partner · {activeVendor.contactEmail}
                </div>
                <h2 className="text-lg font-bold text-slate-900 mt-0.5">
                  {activeVendor.name} — Counter-Proposal Desk
                </h2>
              </div>
              <button
                type="button"
                onClick={handleRunAiNegotiator}
                disabled={isGeneratingOffer}
                className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>
                  {isGeneratingOffer
                    ? 'Synthesizing Counter-Offer...'
                    : 'Regenerate Negotiation Script'}
                </span>
              </button>
            </div>

            {/* Financial Anchors in INR */}
            <div className="grid grid-cols-3 gap-4 p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs">
              <div>
                <div className="text-slate-500">Initial Vendor Quote</div>
                <div className="text-base font-bold text-slate-900 font-mono tabular-nums mt-0.5">
                  {formatINR(strategy.quotedAmount)}
                </div>
              </div>
              <div>
                <div className="text-slate-500">Opening Counter-Anchor</div>
                <div className="text-base font-bold text-amber-700 font-mono tabular-nums mt-0.5">
                  {formatINR(strategy.openingCounterOffer)}
                </div>
              </div>
              <div>
                <div className="text-slate-500">Target Settlement Savings</div>
                <div className="text-base font-bold text-emerald-700 font-mono tabular-nums mt-0.5">
                  {formatINR(strategy.projectedSavings)} ({strategy.savingsPercent}%)
                </div>
              </div>
            </div>

            {/* Tactical Talking Points */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-800">
                Tactical Leverage & Value-Add Concessions
              </div>
              <ul className="space-y-1.5 text-xs text-slate-600 list-disc pl-4">
                {strategy.tacticalTalkingPoints.map((pt, idx) => (
                  <li key={idx}>{pt}</li>
                ))}
              </ul>
            </div>

            {/* Editable Counter-Proposal Email */}
            <div className="space-y-2">
              <label htmlFor="neg-subject" className="block text-xs font-medium text-slate-700">
                Subject Line
              </label>
              <input
                id="neg-subject"
                type="text"
                value={strategy.subjectLine}
                onChange={(e) => setStrategy({ ...strategy, subjectLine: e.target.value })}
                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md font-medium text-slate-900"
              />

              <label htmlFor="neg-body" className="block text-xs font-medium text-slate-700 mt-2">
                Negotiation Script (Ready for Gmail Dispatch)
              </label>
              <textarea
                id="neg-body"
                rows={9}
                value={strategy.emailBody}
                onChange={(e) => setStrategy({ ...strategy, emailBody: e.target.value })}
                className="w-full p-3 text-xs bg-slate-50 border border-slate-300 rounded-md font-mono text-slate-800 leading-relaxed"
              />
            </div>

            {onSendToWorkspaceEmail && (
              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-slate-500">
                  Mode: {negotiationFastMode ? 'Instant Draft' : 'Deep Contract Strategy'}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    onSendToWorkspaceEmail(
                      activeVendor.contactEmail,
                      strategy.subjectLine,
                      strategy.emailBody
                    )
                  }
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Stage in Gmail Workspace Dispatch</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Section 2: Theme Curation & High-Quality Mood Board Studio (1K / 2K / 4K) */}
      <section className="space-y-6 pt-6 border-t border-slate-200">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs text-slate-500">
              03. Spatial Aesthetic Direction · Studio Decor Renders (1K, 2K, 4K Resolution Control)
            </p>
            <h2 className="text-2xl font-bold text-slate-900 font-display mt-1">
              Theme Suggestions & Event Decor Mood Boards
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left 4 Columns: High-Quality Image Generator + Theme Synthesizer */}
          <div className="lg:col-span-4 space-y-6">
            <form
              onSubmit={handleGenerateMoodBoardImage}
              className="p-5 bg-white border border-slate-200 rounded-xl space-y-4"
            >
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-slate-700" />
                <span>Generate Decor Mood Board</span>
              </h3>

              <div>
                <label htmlFor="mb-title-input" className="block text-xs font-medium text-slate-700 mb-1">
                  Board Title
                </label>
                <input
                  id="mb-title-input"
                  type="text"
                  value={imageTitle}
                  onChange={(e) => setImageTitle(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md"
                />
              </div>

              <div>
                <label htmlFor="mb-prompt-input" className="block text-xs font-medium text-slate-700 mb-1">
                  Architectural & Decor Prompt
                </label>
                <textarea
                  id="mb-prompt-input"
                  rows={3}
                  value={imagePrompt}
                  onChange={(e) => setImagePrompt(e.target.value)}
                  className="w-full p-2.5 text-xs bg-white border border-slate-300 rounded-md"
                />
              </div>

              {/* 1K / 2K / 4K Image Size Affordance */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="block text-xs font-medium text-slate-700 mb-1">
                    Resolution Size
                  </span>
                  <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md">
                    {(['1K', '2K', '4K'] as const).map((sz) => (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => setImageSize(sz)}
                        className={`flex-1 py-1 text-xs font-mono font-semibold rounded transition-colors cursor-pointer ${
                          imageSize === sz
                            ? 'bg-slate-900 text-white'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {sz}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="block text-xs font-medium text-slate-700 mb-1">
                    Aspect Ratio
                  </span>
                  <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md">
                    {(['16:9', '4:3', '1:1'] as const).map((ar) => (
                      <button
                        key={ar}
                        type="button"
                        onClick={() => setAspectRatio(ar)}
                        className={`flex-1 py-1 text-xs font-mono font-semibold rounded transition-colors cursor-pointer ${
                          aspectRatio === ar
                            ? 'bg-slate-900 text-white'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {ar}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isGeneratingImage}
                className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-60"
              >
                {isGeneratingImage
                  ? `Rendering ${imageSize} Mood Board...`
                  : `Generate ${imageSize} Decor Render`}
              </button>
            </form>

            {/* Theme Concept Generator */}
            <div className="p-5 bg-white border border-slate-200 rounded-xl space-y-3">
              <h3 className="text-sm font-bold text-slate-900">
                Theme & Sensory Direction Generator
              </h3>
              <input
                type="text"
                aria-label="Theme aesthetic direction"
                value={themeStyleInput}
                onChange={(e) => setThemeStyleInput(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md"
              />
              <button
                type="button"
                onClick={handleGenerateThemeConcept}
                disabled={isGeneratingTheme}
                className="w-full py-2 px-4 text-xs font-semibold text-slate-900 bg-slate-100 border border-slate-300 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
              >
                {isGeneratingTheme ? 'Curating Theme Concept...' : 'Synthesize Theme Brief'}
              </button>

              {generatedThemeConcept && (
                <div className="pt-3 border-t border-slate-200 space-y-2 text-xs">
                  <div className="font-bold text-slate-900 text-sm">
                    {generatedThemeConcept.themeTitle}
                  </div>
                  <p className="text-slate-600">{generatedThemeConcept.themeSubtitle}</p>
                  <p className="text-slate-500">{generatedThemeConcept.architecturalNotes}</p>
                  <div className="flex items-center gap-2 pt-1">
                    {(generatedThemeConcept.palette || []).map((hex, i) => (
                      <div key={i} className="flex items-center gap-1">
                        <span
                          className="w-4 h-4 rounded-full border border-slate-300 inline-block"
                          style={{ backgroundColor: hex }}
                        />
                        <span className="font-mono text-[11px] text-slate-600">{hex}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right 8 Columns: Curated Mood Board Gallery */}
          <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-6">
            {moodBoards.map((board) => (
              <article
                key={board.id}
                className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col"
              >
                <div className="relative aspect-video bg-slate-900 overflow-hidden">
                  <img
                    src={board.imageUrl}
                    alt={board.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-5 flex-1 flex flex-col justify-between space-y-3">
                  <div className="space-y-1.5">
                    <div className="text-xs text-slate-500 font-mono">
                      Resolution: {board.resolution} · Ratio: {board.aspectRatio} · Created {board.createdAt}
                    </div>
                    <h3 className="text-base font-bold text-slate-900">{board.title}</h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {board.architecturalNotes}
                    </p>
                  </div>

                  {/* Color Swatch Strip */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {board.palette.map((hex, idx) => (
                        <div key={idx} className="flex items-center gap-1">
                          <span
                            className="w-4 h-4 rounded-full border border-slate-300"
                            style={{ backgroundColor: hex }}
                          />
                          <span className="font-mono text-[11px] text-slate-500">{hex}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};
