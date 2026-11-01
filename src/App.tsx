import { useEffect, useState } from 'react';
import {
  createUserCustomEvent,
  EVENT_PRESETS,
  generateTablesForCount,
  INITIAL_BUDGET_ITEMS,
  INITIAL_COLLABORATOR_FEED,
  INITIAL_GUESTS,
  INITIAL_MOODBOARDS,
  INITIAL_TABLES,
  INITIAL_TIMELINE,
  INITIAL_TRANSACTIONS,
  INITIAL_VENDORS,
} from './data/seedEvents';
import {
  BudgetLineItem,
  CollaboratorActivity,
  EventCategory,
  EventPreset,
  GuestRecord,
  LightingAtmosphere,
  MoodBoardItem,
  PaymentTransaction,
  SeatingTable,
  TableArrangementLayout,
  TimelineMilestone,
  VendorRecord,
  VenueEnvironmentMode,
  VenueMutationCommand,
} from './types/planning';
import {
  assignGuestToTableSafe,
  calculateBudgetMetrics,
  calculateSeatingMetrics,
  computeTableLayoutCoordinates,
  evaluateEventReadiness,
  formatINR,
  optimizeBudgetAllocation,
  processVendorPayment,
} from './utils/planningLogic';
import { LandingPage } from './components/LandingPage';
import { VenueScene3D } from './components/VenueScene3D';
import { SeatingAndRsvpModal } from './components/SeatingAndRsvpModal';
import { BudgetAndPaymentsView } from './components/BudgetAndPaymentsView';
import { VendorsAndThemesView } from './components/VendorsAndThemesView';
import { BioscienceAndWorkspaceView } from './components/BioscienceAndWorkspaceView';
import { GeminiChatbotDrawer } from './components/GeminiChatbotDrawer';
import { CustomSelectPopover } from './components/CustomSelectPopover';
import { OpeningCinematic3D } from './components/OpeningCinematic3D';
import {
  googleSignIn,
  initAuth,
  logout,
  subscribeWorkspaceAuth,
} from './services/firebaseAuth';

type ActiveSection =
  | 'landing'
  | 'spatial-3d'
  | 'budget-payments'
  | 'vendors-themes'
  | 'bioscience-workspace';

export default function App() {
  const [showOpening3D, setShowOpening3D] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1' || params.get('seatingPass')) {
      return false;
    }
    return true;
  });
  const [activeSection, setActiveSection] = useState<ActiveSection>('landing');
  const [presets, setPresets] = useState<EventPreset[]>(EVENT_PRESETS);
  const [selectedPresetId, setSelectedPresetId] = useState<string>(EVENT_PRESETS[0].id);

  const [budgetByPreset, setBudgetByPreset] =
    useState<Record<string, BudgetLineItem[]>>(INITIAL_BUDGET_ITEMS);
  const [vendorsByPreset, setVendorsByPreset] = useState<Record<string, VendorRecord[]>>({
    [EVENT_PRESETS[0].id]: INITIAL_VENDORS,
  });
  const [guestsByPreset, setGuestsByPreset] = useState<Record<string, GuestRecord[]>>({
    [EVENT_PRESETS[0].id]: INITIAL_GUESTS,
  });
  const [tablesByPreset, setTablesByPreset] = useState<Record<string, SeatingTable[]>>({
    [EVENT_PRESETS[0].id]: INITIAL_TABLES,
  });

  const [selectedTableNumber, setSelectedTableNumber] = useState<number | null>(1);
  const [transactions, setTransactions] = useState<PaymentTransaction[]>(INITIAL_TRANSACTIONS);
  const [timeline, setTimeline] = useState<TimelineMilestone[]>(INITIAL_TIMELINE);
  const [collaboratorFeed, setCollaboratorFeed] =
    useState<CollaboratorActivity[]>(INITIAL_COLLABORATOR_FEED);
  const [moodBoards, setMoodBoards] = useState<MoodBoardItem[]>(INITIAL_MOODBOARDS);

  const [isRsvpModalOpen, setIsRsvpModalOpen] = useState<boolean>(false);
  const [rsvpModalTab, setRsvpModalTab] = useState<'roster' | 'share-qr'>('roster');
  const [shareGuestId, setShareGuestId] = useState<string | null>(null);
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [stagedEmail, setStagedEmail] = useState<{
    to: string;
    subject: string;
    body: string;
  } | null>(null);
  const [isWorkspaceConnected, setIsWorkspaceConnected] = useState<boolean>(false);
  const [workspaceUserEmail, setWorkspaceUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const unsubInit = initAuth();
    const unsubState = subscribeWorkspaceAuth((state) => {
      setIsWorkspaceConnected(state.isAuthenticated);
      setWorkspaceUserEmail(state.userEmail);
    });
    return () => {
      unsubInit();
      unsubState();
    };
  }, []);

  // Detect scanned QR pass URL (?seatingPass=<guestId>) on mobile devices
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const scannedGuestId = params.get('seatingPass');
    const scannedTable = Number(params.get('table'));
    if (scannedGuestId) {
      setActiveSection('spatial-3d');
      if (Number.isFinite(scannedTable) && scannedTable > 0) {
        setSelectedTableNumber(scannedTable);
      }
      setShareGuestId(scannedGuestId);
      setRsvpModalTab('share-qr');
      setIsRsvpModalOpen(true);
    }
  }, []);

  const activePreset =
    presets.find((p) => p.id === selectedPresetId) || presets[0];
  const currentBudgetItems = budgetByPreset[activePreset.id] || [];
  const vendors = vendorsByPreset[activePreset.id] || [];
  const guests = guestsByPreset[activePreset.id] || [];
  const tables = tablesByPreset[activePreset.id] || INITIAL_TABLES;

  const budgetMetrics = calculateBudgetMetrics(
    currentBudgetItems,
    activePreset.totalBudgetCap
  );
  const seatingMetrics = calculateSeatingMetrics(guests, tables);
  const readinessDecision = evaluateEventReadiness(
    activePreset,
    currentBudgetItems,
    vendors,
    guests,
    tables
  );

  const logActivity = (actor: string, role: string, action: string, amountDelta?: number) => {
    setCollaboratorFeed((prev) => [
      {
        id: `act-${Date.now()}`,
        actor,
        role,
        action,
        timestamp: 'Just now',
        amountDelta,
      },
      ...prev,
    ]);
  };

  // Update active preset settings (Outdoor/Indoor, Colors, Lighting, Stage, Cap)
  const handleUpdatePresetSettings = (updates: Partial<EventPreset>) => {
    setPresets((prev) =>
      prev.map((p) => (p.id === activePreset.id ? { ...p, ...updates } : p))
    );
  };

  // Auto-Arrange Tables by layout preset
  const handleApplyTableLayout = (layout: TableArrangementLayout) => {
    setTablesByPreset((prev) => {
      const current = prev[activePreset.id] || INITIAL_TABLES;
      return {
        ...prev,
        [activePreset.id]: computeTableLayoutCoordinates(current, layout),
      };
    });
    handleUpdatePresetSettings({ tableLayout: layout });
    logActivity('Lead Producer', '3D Floor Studio', `Arranged tables in ${layout} formation`);
  };

  // Move single table manually by dragging on floor
  const handleMoveTable = (tableNumber: number, x: number, z: number) => {
    setTablesByPreset((prev) => {
      const current = prev[activePreset.id] || INITIAL_TABLES;
      return {
        ...prev,
        [activePreset.id]: current.map((t) =>
          t.tableNumber === tableNumber ? { ...t, x, z } : t
        ),
      };
    });
    handleUpdatePresetSettings({ tableLayout: 'custom' });
  };

  // Sync multiple table positions after @react-three/cannon physics collision resolution
  const handleSyncTablesFromPhysics = (
    updatedCoords: { tableNumber: number; x: number; z: number }[]
  ) => {
    const coordMap = new Map(updatedCoords.map((c) => [c.tableNumber, c]));
    setTablesByPreset((prev) => {
      const current = prev[activePreset.id] || INITIAL_TABLES;
      return {
        ...prev,
        [activePreset.id]: current.map((t) => {
          const next = coordMap.get(t.tableNumber);
          return next ? { ...t, x: next.x, z: next.z } : t;
        }),
      };
    });
  };

  const handleAddTable = () => {
    setTablesByPreset((prev) => {
      const current = prev[activePreset.id] || INITIAL_TABLES;
      if (current.length >= 16) return prev;
      const nextNum = current.length + 1;
      const added: SeatingTable = {
        tableNumber: nextNum,
        label: `Table ${nextNum < 10 ? `0${nextNum}` : nextNum} · Royal Dining`,
        capacity: 8,
        zone: nextNum % 2 === 0 ? 'East Terrace' : 'West Pavilion',
        x: 0,
        z: 0,
      };
      const nextLayout =
        activePreset.tableLayout && activePreset.tableLayout !== 'custom'
          ? activePreset.tableLayout
          : 'banquet-radial';
      const arranged = computeTableLayoutCoordinates([...current, added], nextLayout);
      return {
        ...prev,
        [activePreset.id]: arranged,
      };
    });
  };

  const handleRemoveTable = () => {
    setTablesByPreset((prev) => {
      const current = prev[activePreset.id] || INITIAL_TABLES;
      if (current.length <= 1) return prev;
      const trimmed = current.slice(0, current.length - 1);
      return {
        ...prev,
        [activePreset.id]: trimmed,
      };
    });
  };

  // Execute natural language 3D Venue mutations from Chat
  const handleApplyVenueCommand = (cmd: VenueMutationCommand) => {
    const presetUpdates: Partial<EventPreset> = {};
    if (cmd.environmentMode) presetUpdates.environmentMode = cmd.environmentMode;
    if (cmd.tableLayout) presetUpdates.tableLayout = cmd.tableLayout;
    if (cmd.linenColor) presetUpdates.linenColor = cmd.linenColor;
    if (cmd.accentHex) presetUpdates.accentHex = cmd.accentHex;
    if (cmd.floorColor) presetUpdates.floorColor = cmd.floorColor;
    if (cmd.stageStyle) presetUpdates.stageStyle = cmd.stageStyle;
    if (cmd.lightingMode) presetUpdates.lightingMode = cmd.lightingMode;
    if (typeof cmd.lightIntensity === 'number') presetUpdates.lightIntensity = cmd.lightIntensity;

    if (Object.keys(presetUpdates).length > 0) {
      handleUpdatePresetSettings(presetUpdates);
    }

    setTablesByPreset((prev) => {
      let nextTables = [...(prev[activePreset.id] || INITIAL_TABLES)];
      if (cmd.addTableCount && cmd.addTableCount > 0) {
        for (let i = 0; i < cmd.addTableCount; i++) {
          if (nextTables.length >= 16) break;
          const nextNum = nextTables.length + 1;
          nextTables.push({
            tableNumber: nextNum,
            label: `Table ${nextNum < 10 ? `0${nextNum}` : nextNum} · Royal Dining`,
            capacity: 8,
            zone: 'VIP Garden',
            x: 0,
            z: 0,
          });
        }
      }
      if (cmd.removeTableCount && cmd.removeTableCount > 0) {
        const targetLen = Math.max(1, nextTables.length - cmd.removeTableCount);
        nextTables = nextTables.slice(0, targetLen);
      }

      const layoutToUse =
        cmd.tableLayout ||
        (cmd.addTableCount || cmd.removeTableCount
          ? activePreset.tableLayout || 'banquet-radial'
          : null);
      if (layoutToUse && layoutToUse !== 'custom') {
        nextTables = computeTableLayoutCoordinates(nextTables, layoutToUse);
      }

      return {
        ...prev,
        [activePreset.id]: nextTables,
      };
    });

    if (cmd.summaryLabel) {
      logActivity('Aura Chat Assistant', '3D Venue Studio', `Updated: ${cmd.summaryLabel}`);
    }
  };

  // Create a new User-Defined Custom Event from the Landing Page
  const handleCreateCustomEvent = (params: {
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
  }) => {
    const newPreset = createUserCustomEvent(params);
    const newTables = generateTablesForCount(params.tableCount, params.tableLayout);

    setPresets((prev) => [newPreset, ...prev]);
    setSelectedPresetId(newPreset.id);
    setTablesByPreset((prev) => ({ ...prev, [newPreset.id]: newTables }));
    setSelectedTableNumber(1);

    if (params.startWithBlankLedger) {
      setBudgetByPreset((prev) => ({ ...prev, [newPreset.id]: [] }));
      setVendorsByPreset((prev) => ({ ...prev, [newPreset.id]: [] }));
      setGuestsByPreset((prev) => ({ ...prev, [newPreset.id]: [] }));
    } else {
      setBudgetByPreset((prev) => ({
        ...prev,
        [newPreset.id]: [
          {
            id: `b-u1-${Date.now()}`,
            category: 'Venue & Architecture',
            title: `${newPreset.venueName} Booking`,
            allocated: Math.round(params.totalBudgetCap * 0.35),
            spent: 0,
            notes: 'Custom venue allocation',
            priority: 'essential',
          },
          {
            id: `b-u2-${Date.now()}`,
            category: 'Culinary & Beverage',
            title: `Catering for ${params.guestCountTarget} Guests`,
            allocated: Math.round(params.totalBudgetCap * 0.3),
            spent: 0,
            notes: 'Custom catering allocation',
            priority: 'essential',
          },
        ],
      }));
      setVendorsByPreset((prev) => ({ ...prev, [newPreset.id]: [] }));
      setGuestsByPreset((prev) => ({ ...prev, [newPreset.id]: [] }));
    }

    setActiveSection('spatial-3d');
    logActivity(
      'Host Creator',
      'Event Studio',
      `Created custom event "${newPreset.name}" (${formatINR(newPreset.totalBudgetCap)})`
    );
  };

  const handleAssignGuest = (guestId: string, tableNumber: number | null) => {
    const res = assignGuestToTableSafe(guests, tables, guestId, tableNumber);
    if (res.ok) {
      setGuestsByPreset((prev) => ({
        ...prev,
        [activePreset.id]: res.updatedGuests,
      }));
      const g = guests.find((item) => item.id === guestId);
      if (g) {
        logActivity(
          'Lead Producer',
          'Spatial Coordinator',
          tableNumber
            ? `Seated ${g.fullName} at Table 0${tableNumber}`
            : `Moved ${g.fullName} to unassigned queue`
        );
      }
    }
    return { ok: res.ok, error: res.error };
  };

  const handleAddGuest = (newGuest: Omit<GuestRecord, 'id'>) => {
    const created: GuestRecord = {
      ...newGuest,
      id: `gst-${Date.now()}`,
    };
    setGuestsByPreset((prev) => ({
      ...prev,
      [activePreset.id]: [created, ...(prev[activePreset.id] || [])],
    }));
    logActivity(
      created.fullName,
      'RSVP Portal',
      `Confirmed RSVP (+${created.plusOnes} guest, ${created.dietary})`
    );
  };

  const handleUpdateRsvpStatus = (guestId: string, status: GuestRecord['rsvpStatus']) => {
    setGuestsByPreset((prev) => ({
      ...prev,
      [activePreset.id]: (prev[activePreset.id] || []).map((g) =>
        g.id === guestId
          ? {
              ...g,
              rsvpStatus: status,
              tableNumber: status === 'Declined' ? null : g.tableNumber,
            }
          : g
      ),
    }));
  };

  const handleOptimizeBudget = () => {
    const result = optimizeBudgetAllocation(
      currentBudgetItems,
      activePreset.totalBudgetCap
    );
    setBudgetByPreset((prev) => ({
      ...prev,
      [activePreset.id]: result.updatedItems,
    }));
    logActivity(
      'Budget Optimizer',
      'Financial Engine',
      `Rebalanced ${formatINR(result.reallocatedAmount)} across department allocations`,
      result.reallocatedAmount
    );
    return result.recommendations;
  };

  const handleAddBudgetItem = (item: Omit<BudgetLineItem, 'id'>) => {
    const created: BudgetLineItem = {
      ...item,
      id: `b-${Date.now()}`,
    };
    setBudgetByPreset((prev) => ({
      ...prev,
      [activePreset.id]: [...(prev[activePreset.id] || []), created],
    }));
    logActivity(
      'Lead Producer',
      'Finance Desk',
      `Added "${created.title}" (${formatINR(created.allocated)})`,
      created.allocated
    );
  };

  const handleUpdateBudgetItem = (id: string, allocated: number, spent: number) => {
    setBudgetByPreset((prev) => ({
      ...prev,
      [activePreset.id]: (prev[activePreset.id] || []).map((item) =>
        item.id === id ? { ...item, allocated: Math.max(0, allocated), spent: Math.max(0, spent) } : item
      ),
    }));
  };

  const handleDeleteBudgetItem = (id: string) => {
    setBudgetByPreset((prev) => ({
      ...prev,
      [activePreset.id]: (prev[activePreset.id] || []).filter((item) => item.id !== id),
    }));
  };

  const handleProcessVendorPayment = (
    vendorId: string,
    amount: number,
    method: PaymentTransaction['method']
  ) => {
    const targetVendor = vendors.find((v) => v.id === vendorId);
    if (!targetVendor) return { ok: false, error: 'Vendor not found.' };

    const res = processVendorPayment(targetVendor, amount, method);
    if (!res.ok || !res.updatedVendor || !res.transaction) {
      return { ok: false, error: res.error };
    }

    setVendorsByPreset((prev) => ({
      ...prev,
      [activePreset.id]: (prev[activePreset.id] || []).map((v) =>
        v.id === vendorId ? res.updatedVendor! : v
      ),
    }));
    setTransactions((prev) => [res.transaction!, ...prev]);

    setBudgetByPreset((prev) => ({
      ...prev,
      [activePreset.id]: (prev[activePreset.id] || []).map((b) =>
        b.vendorId === vendorId || b.category === targetVendor.category
          ? { ...b, spent: b.spent + amount }
          : b
      ),
    }));

    logActivity(
      'Host Treasury',
      'Payment Gateway',
      `Settled ${formatINR(amount)} to ${targetVendor.name} via ${method}`,
      amount
    );

    return { ok: true };
  };

  const handleToggleChecklist = (vendorId: string, checklistId: string) => {
    setVendorsByPreset((prev) => ({
      ...prev,
      [activePreset.id]: (prev[activePreset.id] || []).map((v) =>
        v.id === vendorId
          ? {
              ...v,
              checklist: v.checklist.map((c) =>
                c.id === checklistId ? { ...c, completed: !c.completed } : c
              ),
            }
          : v
      ),
    }));
  };

  const handleAddVendor = (vendor: Omit<VendorRecord, 'id'>) => {
    const created: VendorRecord = {
      ...vendor,
      id: `ven-${Date.now()}`,
    };
    setVendorsByPreset((prev) => ({
      ...prev,
      [activePreset.id]: [...(prev[activePreset.id] || []), created],
    }));
  };

  const handleAddMilestone = (milestone: Omit<TimelineMilestone, 'id'>) => {
    setTimeline((prev) => [...prev, { ...milestone, id: `ms-${Date.now()}` }]);
    logActivity('Lead Producer', 'Timeline Desk', `Added cue "${milestone.title}" at ${milestone.time}`);
  };

  const handleAddMoodBoard = (board: MoodBoardItem) => {
    setMoodBoards((prev) => [board, ...prev]);
    logActivity('Creative Director', 'Mood Board Studio', `Generated ${board.resolution} render "${board.title}"`);
  };

  const handleExecuteReadinessAction = () => {
    if (readinessDecision.targetSection === 'rsvp-modal') {
      setIsRsvpModalOpen(true);
    } else {
      setActiveSection(readinessDecision.targetSection);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-slate-900">
      {/* Interactive 3D Architectural Module Opening Animation */}
      {showOpening3D && (
        <OpeningCinematic3D
          onEnterLanding={() => setShowOpening3D(false)}
          onLaunch3DStudioDirectly={() => {
            setShowOpening3D(false);
            setActiveSection('spatial-3d');
          }}
        />
      )}

      {/* WCAG 2.1 AA Skip-to-Main-Content Link */}
      <a
        href="#main-workspace"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-amber-500 focus:text-slate-950 focus:font-semibold focus:rounded-lg"
      >
        Skip to main workspace
      </a>

      {/* 3-Zone Top Bar Contract (Brand Wordmark — 4 Concise Links — 1 Primary Action) */}
      <header className="h-14 sm:h-16 flex items-center justify-between gap-3 sm:gap-8 px-4 sm:px-6 bg-white border-b border-slate-200 sticky top-0 z-30">
        {/* Zone 1: Brand Wordmark (returns to Landing Page) */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setActiveSection('landing');
          }}
          className="text-base sm:text-lg font-bold tracking-tight text-slate-900 font-display whitespace-nowrap shrink-0"
        >
          Aura Atelier
        </a>

        {/* Zone 2: 4 Single-line Navigation Links */}
        <nav aria-label="Primary Workspace Navigation" className="flex items-center gap-3 sm:gap-6 text-xs sm:text-sm font-medium text-slate-600 overflow-x-auto">
          <button
            type="button"
            aria-current={activeSection === 'spatial-3d' ? 'page' : undefined}
            onClick={() => setActiveSection('spatial-3d')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeSection === 'spatial-3d'
                ? 'text-slate-900 font-semibold underline underline-offset-8 decoration-2 decoration-slate-900'
                : 'hover:text-slate-900'
            }`}
          >
            3D Venue
          </button>
          <button
            type="button"
            aria-current={activeSection === 'budget-payments' ? 'page' : undefined}
            onClick={() => setActiveSection('budget-payments')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeSection === 'budget-payments'
                ? 'text-slate-900 font-semibold underline underline-offset-8 decoration-2 decoration-slate-900'
                : 'hover:text-slate-900'
            }`}
          >
            Budget & Pay
          </button>
          <button
            type="button"
            aria-current={activeSection === 'vendors-themes' ? 'page' : undefined}
            onClick={() => setActiveSection('vendors-themes')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeSection === 'vendors-themes'
                ? 'text-slate-900 font-semibold underline underline-offset-8 decoration-2 decoration-slate-900'
                : 'hover:text-slate-900'
            }`}
          >
            Vendors & Decor
          </button>
          <button
            type="button"
            aria-current={activeSection === 'bioscience-workspace' ? 'page' : undefined}
            onClick={() => setActiveSection('bioscience-workspace')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeSection === 'bioscience-workspace'
                ? 'text-slate-900 font-semibold underline underline-offset-8 decoration-2 decoration-slate-900'
                : 'hover:text-slate-900'
            }`}
          >
            Molecular Safety
          </button>
        </nav>

        {/* Zone 3: 1 Primary Action Button */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={() => setIsRsvpModalOpen(true)}
            className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Guests ({seatingMetrics.confirmedGuests})
          </button>
        </div>
      </header>

      {/* Clean Secondary Event Bar (Shown when inside Studio Views — Zero native select dropdowns) */}
      {activeSection !== 'landing' && (
        <div className="bg-slate-900 text-slate-200 px-4 sm:px-6 py-2 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-slate-400">Active Event:</span>
            {presets.length === 1 ? (
              <span className="text-amber-400 font-semibold px-2.5 py-1 rounded-md bg-slate-800/80 border border-slate-700/80">
                {activePreset.name} ({formatINR(activePreset.totalBudgetCap)})
              </span>
            ) : (
              <CustomSelectPopover
                ariaLabel="Switch Active Event"
                variant="dark"
                value={selectedPresetId}
                onChange={(val) => setSelectedPresetId(val)}
                options={presets.map((p) => ({
                  value: p.id,
                  label: `${p.name} (${formatINR(p.totalBudgetCap)})`,
                  sublabel: `${p.venueName} · ${p.date}`,
                }))}
              />
            )}

            <button
              type="button"
              onClick={() => setActiveSection('landing')}
              className="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium cursor-pointer"
            >
              + Create New Event
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3 font-mono tabular-nums text-slate-300">
            {!isWorkspaceConnected ? (
              <button
                type="button"
                onClick={() => googleSignIn()}
                className="px-2.5 py-1 rounded-md bg-white text-slate-900 hover:bg-slate-100 font-sans font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <span className="w-2 h-2 rounded-full bg-blue-600" />
                <span>Sign in with Google</span>
              </button>
            ) : (
              <div className="flex items-center gap-2 font-sans bg-emerald-950/80 border border-emerald-700/70 text-emerald-300 px-2.5 py-1 rounded-md">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="truncate max-w-[160px]">{workspaceUserEmail}</span>
                <button
                  type="button"
                  onClick={() => logout()}
                  className="text-slate-300 hover:text-white underline ml-1 cursor-pointer"
                >
                  Sign Out
                </button>
              </div>
            )}
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={handleExecuteReadinessAction}
              title={readinessDecision.nextBestActionReason}
              className="text-amber-400 hover:text-amber-300 underline underline-offset-4 font-sans font-medium cursor-pointer"
            >
              Next Step: {readinessDecision.nextBestActionLabel} →
            </button>
            <span aria-hidden="true">·</span>
            <span>
              Spent: {formatINR(budgetMetrics.totalSpent)} / {formatINR(activePreset.totalBudgetCap)}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Seated: {seatingMetrics.seatedHeadcount}/{seatingMetrics.totalHeadcount}
            </span>
          </div>
        </div>
      )}

      {/* Main Content Viewport */}
      <main id="main-workspace" className="flex-1">
        {activeSection === 'landing' && (
          <LandingPage
            onOpenSampleEvent={() => {
              setSelectedPresetId(EVENT_PRESETS[0].id);
              setActiveSection('spatial-3d');
            }}
            onCreateCustomEvent={handleCreateCustomEvent}
            onReplayOpening={() => setShowOpening3D(true)}
          />
        )}

        {activeSection === 'spatial-3d' && (
          <VenueScene3D
            preset={activePreset}
            tables={tables}
            guests={guests}
            seatingMetrics={seatingMetrics}
            selectedTableNumber={selectedTableNumber}
            onSelectTable={(num) => setSelectedTableNumber(num)}
            onOpenRsvpModal={() => {
              setRsvpModalTab('roster');
              setIsRsvpModalOpen(true);
            }}
            onOpenShareSeating={() => {
              setRsvpModalTab('share-qr');
              setIsRsvpModalOpen(true);
            }}
            onOpenChat={() => setIsChatOpen(true)}
            onUpdatePresetSettings={handleUpdatePresetSettings}
            onApplyTableLayout={handleApplyTableLayout}
            onMoveTable={handleMoveTable}
            onSyncTablesFromPhysics={handleSyncTablesFromPhysics}
            onAddTable={handleAddTable}
            onRemoveTable={handleRemoveTable}
          />
        )}

        {activeSection === 'budget-payments' && (
          <BudgetAndPaymentsView
            preset={activePreset}
            budgetItems={currentBudgetItems}
            budgetMetrics={budgetMetrics}
            vendors={vendors}
            transactions={transactions}
            timeline={timeline}
            collaboratorFeed={collaboratorFeed}
            onOptimizeBudget={handleOptimizeBudget}
            onAddBudgetItem={handleAddBudgetItem}
            onUpdateBudgetItem={handleUpdateBudgetItem}
            onDeleteBudgetItem={handleDeleteBudgetItem}
            onUpdateBudgetCap={(newCap) =>
              handleUpdatePresetSettings({ totalBudgetCap: Math.max(10000, newCap) })
            }
            onProcessPayment={handleProcessVendorPayment}
            onAddMilestone={handleAddMilestone}
          />
        )}

        {activeSection === 'vendors-themes' && (
          <VendorsAndThemesView
            preset={activePreset}
            vendors={vendors}
            moodBoards={moodBoards}
            onToggleChecklist={handleToggleChecklist}
            onAddVendor={handleAddVendor}
            onAddMoodBoard={handleAddMoodBoard}
            onSendToWorkspaceEmail={(to, subject, body) => {
              setStagedEmail({ to, subject, body });
              setActiveSection('bioscience-workspace');
            }}
          />
        )}

        {activeSection === 'bioscience-workspace' && (
          <BioscienceAndWorkspaceView
            preset={activePreset}
            vendors={vendors}
            timeline={timeline}
            stagedEmail={stagedEmail}
          />
        )}
      </main>

      {/* Guest RSVP & Table Assignment Portal + Share Seating QR Passes */}
      <SeatingAndRsvpModal
        isOpen={isRsvpModalOpen}
        onClose={() => setIsRsvpModalOpen(false)}
        guests={guests}
        tables={tables}
        seatingMetrics={seatingMetrics}
        selectedTableNumber={selectedTableNumber}
        eventName={activePreset.name}
        venueName={activePreset.venueName}
        initialTab={rsvpModalTab}
        initialShareGuestId={shareGuestId}
        onAssignGuest={handleAssignGuest}
        onAddGuest={handleAddGuest}
        onUpdateRsvpStatus={handleUpdateRsvpStatus}
      />

      {/* Persistent Planning & 3D Venue Chat Assistant */}
      <GeminiChatbotDrawer
        preset={activePreset}
        isOpen={isChatOpen}
        onToggle={() => setIsChatOpen((prev) => !prev)}
        onApplyVenueCommand={handleApplyVenueCommand}
      />
    </div>
  );
}
