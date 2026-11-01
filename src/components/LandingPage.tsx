import React, { useState } from 'react';
import {
  EventCategory,
  LightingAtmosphere,
  TableArrangementLayout,
  VenueEnvironmentMode,
} from '../types/planning';
import { formatINR } from '../utils/planningLogic';
import {
  Sparkles,
  Layers,
  MessageSquare,
  IndianRupee,
  ArrowRight,
  Home,
  Trees,
} from 'lucide-react';
import { CustomSelectPopover } from './CustomSelectPopover';

interface LandingPageProps {
  onOpenSampleEvent: () => void;
  onCreateCustomEvent: (params: {
    name: string;
    category: EventCategory;
    date: string;
    venueName: string;
    guestCountTarget: number;
    totalBudgetCap: number;
    environmentMode: VenueEnvironmentMode;
    tableLayout: TableArrangementLayout;
    tableCount: number;
    linenColor: string;
    accentHex: string;
    lightingMode: LightingAtmosphere;
    startWithBlankLedger: boolean;
  }) => void;
  onReplayOpening?: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onOpenSampleEvent,
  onCreateCustomEvent,
  onReplayOpening,
}) => {
  // Interactive 3D Hero Block Preview State
  const [previewEnv, setPreviewEnv] = useState<VenueEnvironmentMode>('outdoor');
  const [previewLayout, setPreviewLayout] = useState<TableArrangementLayout>('banquet-radial');
  const [previewColor, setPreviewColor] = useState<string>('#0F5132');
  const [tilt, setTilt] = useState<{ rx: number; ry: number }>({ rx: 22, ry: -18 });

  // Custom Event Creation Form State (100% user-driven)
  const [eventName, setEventName] = useState('');
  const [category, setCategory] = useState<EventCategory>('wedding');
  const [eventDate, setEventDate] = useState('2027-03-20');
  const [venueName, setVenueName] = useState('');
  const [guestCount, setGuestCount] = useState(100);
  const [budgetINR, setBudgetINR] = useState(2500000);
  const [environmentMode, setEnvironmentMode] = useState<VenueEnvironmentMode>('outdoor');
  const [tableLayout, setTableLayout] = useState<TableArrangementLayout>('banquet-radial');
  const [tableCount, setTableCount] = useState(8);
  const [linenColor, setLinenColor] = useState('#F5F2EB');
  const [accentHex, setAccentHex] = useState('#D4AF37');
  const [lightingMode, setLightingMode] = useState<LightingAtmosphere>('golden');
  const [startWithBlankLedger, setStartWithBlankLedger] = useState(true);

  const handleHeroMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width - 0.5;
    const ny = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({
      rx: 20 - ny * 16,
      ry: -18 + nx * 24,
    });
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreateCustomEvent({
      name: eventName.trim() || 'My Custom Celebration',
      category,
      date: eventDate,
      venueName: venueName.trim() || 'Custom Architectural Venue',
      guestCountTarget: guestCount,
      totalBudgetCap: budgetINR,
      environmentMode,
      tableLayout,
      tableCount,
      linenColor,
      accentHex,
      lightingMode,
      startWithBlankLedger,
    });
  };

  // Compute miniature 3D block positions for the interactive hero isometric stage
  const miniTables = Array.from({ length: 6 }, (_, i) => {
    if (previewLayout === 'royal-u-shape') {
      const side = i < 2 ? -75 : i < 4 ? 75 : 0;
      const depth = i < 2 ? (i - 0.5) * 65 : i < 4 ? (i - 2.5) * 65 : -78;
      return { x: side, y: depth };
    }
    if (previewLayout === 'imperial-columns') {
      const col = i % 2 === 0 ? -55 : 55;
      const row = Math.floor(i / 2) * 58 - 55;
      return { x: col, y: row };
    }
    const angle = (i / 6) * Math.PI * 2;
    return { x: Math.cos(angle) * 76, y: Math.sin(angle) * 62 + 10 };
  });

  return (
    <div className="bg-[#0B0F19] text-slate-100 overflow-x-hidden">
      {/* 1. HERO SECTION WITH INTERACTIVE 3D ARCHITECTURAL BLOCKS */}
      <section className="relative min-h-[88vh] flex items-center py-16 px-6 border-b border-slate-800/80 overflow-hidden">
        {/* Ambient Radial Glow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[520px] rounded-full opacity-25 blur-3xl"
          style={{
            background:
              'radial-gradient(circle, rgba(212,175,55,0.45) 0%, rgba(13,148,136,0.2) 50%, transparent 75%)',
          }}
        />

        <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative z-10">
          {/* Left 6 Columns: Editorial Value Proposition */}
          <div className="lg:col-span-6 space-y-6">
            <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-amber-400">
              <span>3D Spatial Venue Studio · ₹ INR Financial Engine</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-[54px] font-bold tracking-tight leading-[1.08] font-display text-white">
              Choreograph Every Table, Color & Rupee in Interactive 3D.
            </h1>

            <p className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-[60ch]">
              Switch effortlessly between open-air starlit gardens, grand indoor ballrooms, and
              glasshouse pavilions. Rearrange banquet tables automatically, drag them by hand, or
              simply tell the chat assistant what you want changed—all priced in Indian Rupees (₹).
            </p>

            {/* Primary & Secondary Action Pair */}
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <a
                href="#create-event-studio"
                className="px-6 py-3.5 text-sm font-semibold bg-amber-500 text-slate-950 rounded-xl hover:bg-amber-400 transition-colors flex items-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer"
              >
                <span>Create Your Own Event</span>
                <ArrowRight className="w-4 h-4" />
              </a>

              <button
                type="button"
                onClick={onOpenSampleEvent}
                className="px-5 py-3.5 text-sm font-semibold text-slate-100 bg-slate-900 border border-slate-700 rounded-xl hover:bg-slate-800 hover:border-slate-500 transition-colors cursor-pointer"
              >
                Explore Sample Demo (₹45,00,000)
              </button>

              {onReplayOpening && (
                <button
                  type="button"
                  onClick={onReplayOpening}
                  className="px-4 py-3.5 text-xs font-semibold text-amber-300 bg-slate-950 border border-amber-500/40 rounded-xl hover:bg-slate-900 transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>Google Flow Intro Video / Replay</span>
                </button>
              )}
            </div>

            {/* Key Capabilities Footnote */}
            <div className="pt-4 grid grid-cols-3 gap-4 border-t border-slate-800/90 text-xs text-slate-400">
              <div>
                <div className="font-mono font-bold text-white text-base">Outdoor & Indoor</div>
                <div>Instant 3D Venue Switching</div>
              </div>
              <div>
                <div className="font-mono font-bold text-white text-base">Chat or Drag</div>
                <div>Dual-Mode Scene Editing</div>
              </div>
              <div>
                <div className="font-mono font-bold text-white text-base">100% ₹ INR</div>
                <div>Zero Hardcoded Lock-In</div>
              </div>
            </div>
          </div>

          {/* Right 6 Columns: Interactive 3D Isometric Spatial Block Stage */}
          <div className="lg:col-span-6">
            <div
              onMouseMove={handleHeroMouseMove}
              onMouseLeave={() => setTilt({ rx: 22, ry: -18 })}
              className="relative rounded-2xl bg-slate-900/90 border border-slate-800 p-6 shadow-2xl overflow-hidden"
            >
              {/* Top Interactive Controls for the 3D Block Preview */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-800 text-xs">
                <span className="font-mono text-slate-400">
                  Interactive 3D Block Preview (Move cursor to orbit)
                </span>
                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                  {(
                    [
                      { id: 'outdoor', label: 'Outdoor' },
                      { id: 'indoor', label: 'Indoor' },
                      { id: 'conservatory', label: 'Glasshouse' },
                    ] as const
                  ).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setPreviewEnv(m.id)}
                      className={`px-2.5 py-1 rounded font-medium transition-colors cursor-pointer ${
                        previewEnv === m.id
                          ? 'bg-amber-500 text-slate-950 font-semibold'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 3D Isometric Perspective Block Container */}
              <div
                className="h-[340px] flex items-center justify-center select-none"
                style={{ perspective: '1100px' }}
              >
                <div
                  className="relative w-[300px] h-[250px] transition-transform duration-200 ease-out"
                  style={{
                    transformStyle: 'preserve-3d',
                    transform: `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
                  }}
                >
                  {/* Base 3D Architectural Slab Block */}
                  <div
                    className={`absolute inset-0 rounded-2xl border-2 transition-colors duration-500 shadow-2xl ${
                      previewEnv === 'outdoor'
                        ? 'bg-emerald-950/90 border-emerald-500/50'
                        : previewEnv === 'indoor'
                        ? 'bg-stone-900/95 border-amber-500/50'
                        : 'bg-slate-900/95 border-teal-400/50'
                    }`}
                    style={{ transform: 'translateZ(0px)' }}
                  >
                    <div
                      className="w-full h-full opacity-25"
                      style={{
                        backgroundImage:
                          'linear-gradient(to right, #94a3b8 1px, transparent 1px), linear-gradient(to bottom, #94a3b8 1px, transparent 1px)',
                        backgroundSize: '30px 30px',
                      }}
                    />
                  </div>

                  {/* Floating 3D Ceremonial Mandap / Stage Block */}
                  <div
                    className="absolute left-1/2 -translate-x-1/2 top-4 w-32 h-12 rounded-lg bg-amber-500/90 border border-amber-200 shadow-lg flex items-center justify-center text-[11px] font-mono font-bold text-slate-950"
                    style={{ transform: 'translateZ(34px)' }}
                  >
                    ROYAL STAGE
                  </div>

                  {/* Floating 3D Banquet Table Blocks */}
                  {miniTables.map((pos, idx) => (
                    <div
                      key={idx}
                      className="absolute w-11 h-11 rounded-full border-2 border-amber-300 shadow-md flex items-center justify-center text-[10px] font-mono font-bold text-white transition-all duration-300"
                      style={{
                        left: `calc(50% + ${pos.x}px - 22px)`,
                        top: `calc(54% + ${pos.y}px - 22px)`,
                        backgroundColor: previewColor,
                        transform: 'translateZ(24px)',
                      }}
                    >
                      T{idx + 1}
                    </div>
                  ))}

                  {/* Floating Overhead Canopy / Chandelier Layer Block */}
                  <div
                    className="absolute inset-4 rounded-xl border border-dashed border-amber-400/60 pointer-events-none flex items-end justify-between p-2 text-[10px] font-mono text-amber-300"
                    style={{ transform: 'translateZ(64px)' }}
                  >
                    <span>
                      {previewEnv === 'outdoor'
                        ? '★ Starlit Festoon Canopy'
                        : previewEnv === 'indoor'
                        ? '❖ Grand Ballroom Coffered Ceiling'
                        : '⌒ Glasshouse Botanical Arches'}
                    </span>
                    <span>Z-Layer +6.4m</span>
                  </div>
                </div>
              </div>

              {/* Bottom Quick Layout & Color Controls for the 3D Block Preview */}
              <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400">Arrangement:</span>
                  {(
                    [
                      { id: 'banquet-radial', label: 'Radial' },
                      { id: 'royal-u-shape', label: 'U-Shape' },
                      { id: 'imperial-columns', label: 'Columns' },
                    ] as const
                  ).map((ly) => (
                    <button
                      key={ly.id}
                      type="button"
                      onClick={() => setPreviewLayout(ly.id)}
                      className={`px-2.5 py-1 rounded border transition-colors cursor-pointer ${
                        previewLayout === ly.id
                          ? 'bg-slate-800 border-amber-400 text-white'
                          : 'border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {ly.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400">Table Color:</span>
                  {[
                    { hex: '#0F5132', name: 'Emerald' },
                    { hex: '#881337', name: 'Crimson' },
                    { hex: '#1E293B', name: 'Navy' },
                    { hex: '#B45309', name: 'Marigold' },
                  ].map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => setPreviewColor(c.hex)}
                      aria-label={`Preview ${c.name} table color`}
                      className={`w-5 h-5 rounded-full border-2 cursor-pointer ${
                        previewColor === c.hex ? 'border-white scale-110' : 'border-slate-600'
                      }`}
                      style={{ backgroundColor: c.hex }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. SCROLL-ANIMATED ASYMMETRIC BENTO CAPABILITIES */}
      <section className="py-20 px-6 max-w-7xl mx-auto space-y-12">
        <div className="max-w-3xl space-y-2">
          <p className="text-xs font-mono uppercase tracking-widest text-amber-400">
            01. Spatial & Financial Architecture
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold font-display text-white">
            Designed Around Your Decisions—Never Locked Into Templates.
          </h2>
          <p className="text-sm sm:text-base text-slate-400">
            Every dimension of your venue, seating chart, and Rupee budget responds immediately to
            manual controls or natural language chat commands.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Card 1: Span 7 */}
          <div className="md:col-span-7 p-7 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-amber-500/40 transition-all duration-300 hover:-translate-y-1 flex flex-col justify-between space-y-6">
            <div className="space-y-3">
              <div className="text-xs font-mono text-amber-400">01. 3D Venue Modes & Self-Arranging Tables</div>
              <h3 className="text-xl font-bold text-white font-display">
                Outdoor Starlit Lawns, Indoor Grand Ballrooms & Glasshouse Pavilions
              </h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                Switch your entire 3D venue between an open-air garden with festoon string lights,
                an enclosed royal ballroom with chandeliers, or an architectural conservatory.
                Auto-arrange tables into Radial, U-Shape, Imperial Columns, or Cabaret formations—or
                drag individual tables directly across the floor.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3 pt-2 text-xs font-mono text-slate-300">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-2">
                <Trees className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Outdoor Lawn</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-2">
                <Home className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Indoor Hall</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-2">
                <Layers className="w-4 h-4 text-teal-400 shrink-0" />
                <span>Drag & Auto-Layout</span>
              </div>
            </div>
          </div>

          {/* Card 2: Span 5 */}
          <div className="md:col-span-5 p-7 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-teal-500/40 transition-all duration-300 hover:-translate-y-1 flex flex-col justify-between space-y-6">
            <div className="space-y-3">
              <div className="text-xs font-mono text-teal-400">02. Chat-to-3D Scene Control</div>
              <h3 className="text-xl font-bold text-white font-display">
                Edit the Venue by Typing in Chat or Clicking Controls
              </h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                Type commands like{' '}
                <span className="text-amber-300 font-mono">
                  &ldquo;Switch to outdoor garden in U-shape with emerald green linen and add 2 tables&rdquo;
                </span>{' '}
                and watch the 3D scene update before your eyes.
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-emerald-400 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 shrink-0" />
              <span>Applied: Outdoor Garden · U-Shape · Emerald Linen</span>
            </div>
          </div>

          {/* Card 3: Span 5 */}
          <div className="md:col-span-5 p-7 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-amber-500/40 transition-all duration-300 hover:-translate-y-1 flex flex-col justify-between space-y-6">
            <div className="space-y-3">
              <div className="text-xs font-mono text-amber-400">03. Indian Rupee (₹) Financial Engine</div>
              <h3 className="text-xl font-bold text-white font-display">
                Real-Time ₹ Budget Rebalancing & Vendor Escrow
              </h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                Track every department in Indian Rupees (₹), automatically cover overspent items
                from flexible reserves, generate vendor counter-offers, and log escrow disbursements.
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <IndianRupee className="w-4 h-4 text-amber-400" />
                <span>Sample Wedding Cap</span>
              </span>
              <span className="text-emerald-400 font-bold">₹45,00,000</span>
            </div>
          </div>

          {/* Card 4: Span 7 */}
          <div className="md:col-span-7 p-7 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-emerald-500/40 transition-all duration-300 hover:-translate-y-1 flex flex-col justify-between space-y-6">
            <div className="space-y-3">
              <div className="text-xs font-mono text-emerald-400">
                04. Guest RSVPs, Allergen Safety & Google Workspace Sync
              </div>
              <h3 className="text-xl font-bold text-white font-display">
                Capacity-Checked Seating, PubChem Allergen Scout & Live Workspace Dispatch
              </h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                Assign confirmed guests to 3D tables without exceeding seat capacity, inspect
                culinary and floral compounds via live NCBI PubChem molecular data, and synchronize
                negotiation emails and run-of-show schedules to Gmail, Calendar, Docs, and Tasks.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
              <span className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800">
                Live PubChem Molecular Safety
              </span>
              <span className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800">
                Gmail & Calendar Sync
              </span>
              <span className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800">
                1K / 2K / 4K Mood Boards
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 3. USER-DRIVEN CUSTOM EVENT CREATOR STUDIO */}
      <section
        id="create-event-studio"
        className="py-20 px-6 border-t border-slate-800 bg-slate-950/70"
      >
        <div className="max-w-5xl mx-auto space-y-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="space-y-2">
              <p className="text-xs font-mono uppercase tracking-widest text-amber-400">
                02. Start From Scratch or Test Sample
              </p>
              <h2 className="text-3xl sm:text-4xl font-bold font-display text-white">
                Create Your Custom Event Studio
              </h2>
              <p className="text-sm text-slate-400">
                Set your own event title, Rupee budget, indoor/outdoor venue style, table count, and
                colors—or launch the single sample wedding to test editing an existing plan.
              </p>
            </div>

            <button
              type="button"
              onClick={onOpenSampleEvent}
              className="px-4 py-2.5 text-xs font-semibold text-amber-300 bg-slate-900 border border-amber-500/40 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Load Sample Demo Event Instead (₹45,00,000) →
            </button>
          </div>

          <form
            onSubmit={handleCreateSubmit}
            className="p-6 sm:p-8 rounded-2xl bg-slate-900 border border-slate-800 space-y-6 shadow-2xl"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              <div>
                <label htmlFor="custom-evt-name" className="block text-xs font-medium text-slate-300 mb-1.5">
                  Event Name *
                </label>
                <input
                  id="custom-evt-name"
                  type="text"
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  placeholder="e.g., Riya & Kabir — Royal Sangeet"
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-950 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <span className="block text-xs font-medium text-slate-300 mb-1.5">
                  Event Category
                </span>
                <CustomSelectPopover
                  id="custom-evt-cat"
                  ariaLabel="Event Category"
                  variant="dark"
                  size="md"
                  className="w-full"
                  value={category}
                  onChange={(val) => setCategory(val as EventCategory)}
                  options={[
                    { value: 'wedding', label: 'Wedding / Sangeet / Reception' },
                    { value: 'birthday', label: 'Milestone Birthday / Private Gala' },
                    { value: 'community', label: 'Community Festival / Cultural Symposium' },
                  ]}
                />
              </div>

              <div>
                <label htmlFor="custom-evt-date" className="block text-xs font-medium text-slate-300 mb-1.5">
                  Event Date
                </label>
                <input
                  id="custom-evt-date"
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-950 border border-slate-700 rounded-lg text-white font-mono"
                />
              </div>

              <div>
                <label htmlFor="custom-evt-venue" className="block text-xs font-medium text-slate-300 mb-1.5">
                  Venue Name
                </label>
                <input
                  id="custom-evt-venue"
                  type="text"
                  value={venueName}
                  onChange={(e) => setVenueName(e.target.value)}
                  placeholder="e.g., Taj Lake Palace Lawn"
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-950 border border-slate-700 rounded-lg text-white"
                />
              </div>

              <div>
                <label htmlFor="custom-evt-budget" className="block text-xs font-medium text-slate-300 mb-1.5">
                  Total Budget Cap in Rupees (₹)
                </label>
                <input
                  id="custom-evt-budget"
                  type="number"
                  min={10000}
                  step={25000}
                  value={budgetINR}
                  onChange={(e) => setBudgetINR(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-950 border border-slate-700 rounded-lg text-white font-mono tabular-nums"
                />
                <span className="text-[11px] text-amber-400 font-mono mt-1 block">
                  Formatted: {formatINR(budgetINR)}
                </span>
              </div>

              <div>
                <label htmlFor="custom-evt-guests" className="block text-xs font-medium text-slate-300 mb-1.5">
                  Target Guest Count & 3D Tables
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    id="custom-evt-guests"
                    type="number"
                    min={10}
                    max={1000}
                    value={guestCount}
                    onChange={(e) => setGuestCount(Number(e.target.value))}
                    title="Target Guests"
                    className="w-full px-3 py-2.5 text-sm bg-slate-950 border border-slate-700 rounded-lg text-white font-mono"
                  />
                  <CustomSelectPopover
                    ariaLabel="Number of 3D Banquet Tables"
                    variant="dark"
                    size="md"
                    className="w-full"
                    value={String(tableCount)}
                    onChange={(val) => setTableCount(Number(val))}
                    options={[4, 6, 8, 10, 12, 14].map((n) => ({
                      value: String(n),
                      label: `${n} Tables (${n * 8} seats)`,
                    }))}
                  />
                </div>
              </div>
            </div>

            {/* 3D Venue Environment, Arrangement & Color Options */}
            <div className="pt-4 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-5">
              <div>
                <span className="block text-xs font-medium text-slate-300 mb-2">
                  3D Venue Setting
                </span>
                <div className="grid grid-cols-3 gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
                  {(
                    [
                      { id: 'outdoor', label: 'Outdoor' },
                      { id: 'indoor', label: 'Indoor' },
                      { id: 'conservatory', label: 'Glasshouse' },
                    ] as const
                  ).map((env) => (
                    <button
                      key={env.id}
                      type="button"
                      onClick={() => setEnvironmentMode(env.id)}
                      className={`py-2 rounded font-medium transition-colors cursor-pointer ${
                        environmentMode === env.id
                          ? 'bg-amber-500 text-slate-950 font-semibold'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {env.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="block text-xs font-medium text-slate-300 mb-2">
                  Initial Table Arrangement
                </span>
                <CustomSelectPopover
                  id="custom-evt-layout"
                  ariaLabel="Initial Table Arrangement"
                  variant="dark"
                  size="md"
                  className="w-full"
                  value={tableLayout}
                  onChange={(val) => setTableLayout(val as TableArrangementLayout)}
                  options={[
                    { value: 'banquet-radial', label: 'Radial Amphitheater' },
                    { value: 'royal-u-shape', label: 'Royal U-Shape Courtyard' },
                    { value: 'imperial-columns', label: 'Imperial Parallel Rows' },
                    { value: 'cabaret-cluster', label: 'Cabaret Staggered Clusters' },
                  ]}
                />
              </div>

              <div>
                <span className="block text-xs font-medium text-slate-300 mb-2">
                  Table Linen & Accent Colors
                </span>
                <div className="flex items-center gap-3 bg-slate-950 px-3 py-2 rounded-lg border border-slate-800">
                  <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="color"
                      value={linenColor}
                      onChange={(e) => setLinenColor(e.target.value)}
                      className="w-6 h-6 rounded border-0 cursor-pointer bg-transparent"
                    />
                    <span>Linen</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="color"
                      value={accentHex}
                      onChange={(e) => setAccentHex(e.target.value)}
                      className="w-6 h-6 rounded border-0 cursor-pointer bg-transparent"
                    />
                    <span>Runner</span>
                  </label>
                  <CustomSelectPopover
                    ariaLabel="Lighting Atmosphere"
                    variant="dark"
                    className="ml-auto"
                    value={lightingMode}
                    onChange={(val) => setLightingMode(val as LightingAtmosphere)}
                    options={[
                      { value: 'golden', label: 'Golden Hour' },
                      { value: 'candlelight', label: 'Candlelight' },
                      { value: 'daylight', label: 'Daylight' },
                      { value: 'twilight', label: 'Twilight' },
                    ]}
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4">
              <label className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={startWithBlankLedger}
                  onChange={(e) => setStartWithBlankLedger(e.target.checked)}
                  className="rounded border-slate-700 accent-amber-500"
                />
                <span>
                  Start with an empty budget, vendor & guest list (I will enter my own items)
                </span>
              </label>

              <button
                type="submit"
                className="px-6 py-3 text-sm font-semibold bg-amber-500 text-slate-950 rounded-xl hover:bg-amber-400 transition-colors flex items-center gap-2 cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>Launch My 3D Event Studio</span>
              </button>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
};
