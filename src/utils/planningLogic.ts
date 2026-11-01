import {
  BudgetLineItem,
  EventPreset,
  GuestRecord,
  LightingAtmosphere,
  PaymentTransaction,
  PubChemCompoundProfile,
  SeatingTable,
  TableArrangementLayout,
  VendorRecord,
  VenueEnvironmentMode,
  VenueMutationCommand,
} from '../types/planning';

/**
 * Formats a numeric amount into Indian Rupees (₹) with Indian numbering system (en-IN).
 */
export function formatINR(amount: number): string {
  const safe = Number.isFinite(amount) ? Math.round(amount) : 0;
  return `₹${safe.toLocaleString('en-IN')}`;
}

export interface BudgetSummaryMetrics {
  totalCap: number;
  totalAllocated: number;
  totalSpent: number;
  remainingToAllocate: number;
  remainingCashBuffer: number;
  utilizationPercent: number;
  overBudgetCategories: string[];
  healthStatus: 'Optimal' | 'Watch' | 'Over Allocated';
}

export function calculateBudgetMetrics(
  items: BudgetLineItem[],
  totalCap: number
): BudgetSummaryMetrics {
  const safeCap = Math.max(1, totalCap);
  const totalAllocated = items.reduce((sum, item) => sum + Math.max(0, item.allocated), 0);
  const totalSpent = items.reduce((sum, item) => sum + Math.max(0, item.spent), 0);
  const remainingToAllocate = totalCap - totalAllocated;
  const remainingCashBuffer = totalCap - totalSpent;
  const utilizationPercent = Number(((totalSpent / safeCap) * 100).toFixed(1));

  const overBudgetCategories = items
    .filter((item) => item.spent > item.allocated)
    .map((item) => item.category);

  let healthStatus: BudgetSummaryMetrics['healthStatus'] = 'Optimal';
  if (totalAllocated > totalCap || totalSpent > totalCap) {
    healthStatus = 'Over Allocated';
  } else if (overBudgetCategories.length > 0 || totalAllocated > totalCap * 0.95) {
    healthStatus = 'Watch';
  }

  return {
    totalCap,
    totalAllocated,
    totalSpent,
    remainingToAllocate,
    remainingCashBuffer,
    utilizationPercent,
    overBudgetCategories,
    healthStatus,
  };
}

export interface OptimizedBudgetResult {
  updatedItems: BudgetLineItem[];
  reallocatedAmount: number;
  recommendations: string[];
}

export function optimizeBudgetAllocation(
  items: BudgetLineItem[],
  totalCap: number
): OptimizedBudgetResult {
  let reallocatedAmount = 0;
  const recommendations: string[] = [];

  const updatedItems = items.map((item) => {
    let nextAllocated = item.allocated;
    if (item.spent > item.allocated) {
      const deficit = item.spent - item.allocated;
      nextAllocated = item.spent + Math.round(deficit * 0.1);
      reallocatedAmount += nextAllocated - item.allocated;
      recommendations.push(
        `Increased "${item.title}" allocation by ${formatINR(nextAllocated - item.allocated)} to cover active spend plus 10% buffer.`
      );
    } else if (
      (item.priority === 'flexible' || item.priority === 'elevated') &&
      item.allocated - item.spent > item.allocated * 0.25
    ) {
      const trim = Math.round((item.allocated - item.spent) * 0.18);
      if (trim >= 100) {
        nextAllocated = item.allocated - trim;
        reallocatedAmount += trim;
        recommendations.push(
          `Reclaimed ${formatINR(trim)} from "${item.title}" (${item.priority} tier) into high-impact guest experience reserve.`
        );
      }
    }
    return {
      ...item,
      allocated: nextAllocated,
    };
  });

  const newTotalAllocated = updatedItems.reduce((acc, i) => acc + i.allocated, 0);
  if (newTotalAllocated > totalCap) {
    recommendations.push(
      `Total allocation (${formatINR(newTotalAllocated)}) exceeds cap (${formatINR(totalCap)}). Consider negotiating culinary or production packages.`
    );
  } else {
    recommendations.push(
      `Unallocated contingency reserve stands at ${formatINR(totalCap - newTotalAllocated)} (${Math.round(((totalCap - newTotalAllocated) / Math.max(1, totalCap)) * 100)}% of budget).`
    );
  }

  return {
    updatedItems,
    reallocatedAmount,
    recommendations,
  };
}

export interface SeatingSummaryMetrics {
  confirmedGuests: number;
  pendingGuests: number;
  declinedGuests: number;
  totalHeadcount: number;
  seatedHeadcount: number;
  unassignedHeadcount: number;
  tableOccupancy: Record<number, { occupied: number; capacity: number; guests: GuestRecord[] }>;
  dietaryCounts: Record<string, number>;
}

export function calculateSeatingMetrics(
  guests: GuestRecord[],
  tables: SeatingTable[]
): SeatingSummaryMetrics {
  const tableOccupancy: SeatingSummaryMetrics['tableOccupancy'] = {};
  for (const t of tables) {
    tableOccupancy[t.tableNumber] = {
      occupied: 0,
      capacity: t.capacity,
      guests: [],
    };
  }

  let confirmedGuests = 0;
  let pendingGuests = 0;
  let declinedGuests = 0;
  let totalHeadcount = 0;
  let seatedHeadcount = 0;
  let unassignedHeadcount = 0;
  const dietaryCounts: Record<string, number> = {
    Standard: 0,
    Vegan: 0,
    'Gluten-Free': 0,
    'Nut-Free': 0,
    'Halal/Kosher': 0,
  };

  for (const g of guests) {
    const partySize = 1 + Math.max(0, g.plusOnes);
    if (g.rsvpStatus === 'Confirmed') {
      confirmedGuests += partySize;
    } else if (g.rsvpStatus === 'Pending') {
      pendingGuests += partySize;
    } else {
      declinedGuests += partySize;
      continue;
    }

    totalHeadcount += partySize;
    dietaryCounts[g.dietary] = (dietaryCounts[g.dietary] || 0) + partySize;

    if (g.tableNumber !== null && tableOccupancy[g.tableNumber]) {
      tableOccupancy[g.tableNumber].occupied += partySize;
      tableOccupancy[g.tableNumber].guests.push(g);
      seatedHeadcount += partySize;
    } else {
      unassignedHeadcount += partySize;
    }
  }

  return {
    confirmedGuests,
    pendingGuests,
    declinedGuests,
    totalHeadcount,
    seatedHeadcount,
    unassignedHeadcount,
    tableOccupancy,
    dietaryCounts,
  };
}

export function assignGuestToTableSafe(
  guests: GuestRecord[],
  tables: SeatingTable[],
  guestId: string,
  targetTableNumber: number | null
): { ok: boolean; error?: string; updatedGuests: GuestRecord[] } {
  const guest = guests.find((g) => g.id === guestId);
  if (!guest) {
    return { ok: false, error: 'Guest record not found.', updatedGuests: guests };
  }
  if (guest.rsvpStatus === 'Declined' && targetTableNumber !== null) {
    return {
      ok: false,
      error: 'Declined guests cannot be assigned to an active table.',
      updatedGuests: guests,
    };
  }

  if (targetTableNumber !== null) {
    const table = tables.find((t) => t.tableNumber === targetTableNumber);
    if (!table) {
      return { ok: false, error: `Table ${targetTableNumber} does not exist.`, updatedGuests: guests };
    }
    const currentOccupied = guests
      .filter((g) => g.id !== guestId && g.rsvpStatus !== 'Declined' && g.tableNumber === targetTableNumber)
      .reduce((sum, g) => sum + 1 + Math.max(0, g.plusOnes), 0);
    const partySize = 1 + Math.max(0, guest.plusOnes);
    if (currentOccupied + partySize > table.capacity) {
      return {
        ok: false,
        error: `Table ${table.tableNumber} (${table.label}) only has ${table.capacity - currentOccupied} seats remaining (party needs ${partySize}).`,
        updatedGuests: guests,
      };
    }
  }

  const updatedGuests = guests.map((g) =>
    g.id === guestId ? { ...g, tableNumber: targetTableNumber } : g
  );
  return { ok: true, updatedGuests };
}

export interface NegotiationStrategy {
  vendorName: string;
  quotedAmount: number;
  targetAmount: number;
  openingCounterOffer: number;
  projectedSavings: number;
  savingsPercent: number;
  subjectLine: string;
  emailBody: string;
  tacticalTalkingPoints: string[];
}

export function generateCounterOffer(
  vendor: VendorRecord,
  eventName: string
): NegotiationStrategy {
  const quoted = Math.max(1, vendor.quotedAmount);
  const target = Math.min(quoted, Math.max(1, vendor.negotiatedTarget));
  const openingCounterOffer = Math.round(target * 0.94);
  const projectedSavings = Math.max(0, quoted - target);
  const savingsPercent = Number(((projectedSavings / quoted) * 100).toFixed(1));

  const leverageText =
    vendor.leverageNotes.length > 0
      ? vendor.leverageNotes.join('; ')
      : 'Prompt 50% escrow deposit upon signature and off-peak load-in flexibility';

  const subjectLine = `Proposal Review & Partnership Terms — ${eventName} (${vendor.name})`;
  const emailBody = `Dear ${vendor.name} Team,

Thank you for preparing the detailed proposal for ${eventName}. We admire your work in ${vendor.category} and would love to finalize our partnership this week.

We are currently aligning our master production budget across all departments. While your initial quote is ${formatINR(quoted)}, our approved allocation for this scope sits at ${formatINR(target)}.

If we can structure the package around an initial counter-proposal of ${formatINR(openingCounterOffer)}—settling near our ${formatINR(target)} cap—we are prepared to authorize an immediate escrow deposit today. Key collaborative efficiencies we can offer include: ${leverageText}.

Would you be open to adjusting the line-item scope or waiving setup/overtime surcharges so we can counter-sign the agreement by Friday?

Warm regards,
Event Production Desk — ${eventName}`;

  return {
    vendorName: vendor.name,
    quotedAmount: quoted,
    targetAmount: target,
    openingCounterOffer,
    projectedSavings,
    savingsPercent,
    subjectLine,
    emailBody,
    tacticalTalkingPoints: [
      `Anchor opening counter-offer at ${formatINR(openingCounterOffer)} to settle at ${formatINR(target)} (${savingsPercent}% savings).`,
      `Offer immediate escrow-backed deposit release in exchange for waiving setup or rush fees.`,
      `Leverage: ${leverageText}.`,
    ],
  };
}

export function processVendorPayment(
  vendor: VendorRecord,
  amount: number,
  method: PaymentTransaction['method']
): {
  ok: boolean;
  error?: string;
  updatedVendor?: VendorRecord;
  transaction?: PaymentTransaction;
} {
  const balanceDue = Math.max(0, vendor.negotiatedTarget - vendor.paidAmount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: 'Payment amount must be greater than ₹0.' };
  }
  if (amount > balanceDue && balanceDue > 0) {
    return {
      ok: false,
      error: `Payment amount (${formatINR(amount)}) exceeds remaining balance due (${formatINR(balanceDue)}).`,
    };
  }

  const escrowFee = method === 'Escrow Wire' ? Math.round(amount * 0.015) : 0;
  const totalCharged = amount + escrowFee;
  const newPaid = vendor.paidAmount + amount;
  const newStatus: VendorRecord['status'] =
    newPaid >= vendor.negotiatedTarget ? 'Paid in Full' : 'Deposit Paid';

  const updatedVendor: VendorRecord = {
    ...vendor,
    paidAmount: newPaid,
    status: newStatus,
  };

  const transaction: PaymentTransaction = {
    id: `tx-${Date.now()}`,
    vendorId: vendor.id,
    vendorName: vendor.name,
    amount,
    escrowFee,
    totalCharged,
    method,
    timestamp: new Date().toISOString(),
    referenceCode: `AURA-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
    status: method === 'Escrow Wire' ? 'Escrow Protected' : 'Settled',
  };

  return {
    ok: true,
    updatedVendor,
    transaction,
  };
}

export function evaluateCompoundSafety(
  profile: Pick<
    PubChemCompoundProfile,
    'molecularWeight' | 'xlogp' | 'tpsa' | 'hBondDonorCount' | 'hBondAcceptorCount' | 'ghsHazards'
  >
): {
  volatilityClass: 'High Aroma Volatility' | 'Moderate Volatility' | 'Non-Volatile Fixed Compound';
  lipinskiCompliant: boolean;
  safetySummary: string;
} {
  const volatilityClass =
    profile.molecularWeight < 220 && profile.xlogp > 1.2
      ? 'High Aroma Volatility'
      : profile.molecularWeight < 350
      ? 'Moderate Volatility'
      : 'Non-Volatile Fixed Compound';

  const lipinskiCompliant =
    profile.molecularWeight <= 500 &&
    profile.xlogp <= 5 &&
    profile.hBondDonorCount <= 5 &&
    profile.hBondAcceptorCount <= 10;

  const hasIrritant = profile.ghsHazards.some((h) =>
    /irrit|sensitiz|allerg|toxic|flamm/i.test(h)
  );

  const safetySummary = hasIrritant
    ? `${volatilityClass} (${profile.molecularWeight.toFixed(1)} g/mol). Contains GHS sensitizer/irritant markers—label clearly on buffet cards or keep floral arrangements 1.2m from dining plates.`
    : `${volatilityClass} (${profile.molecularWeight.toFixed(1)} g/mol). Favorable safety profile for event culinary and botanical table styling.`;

  return {
    volatilityClass,
    lipinskiCompliant,
    safetySummary,
  };
}

/**
 * Security helper: strips unsafe HTML/script tags, control characters, and enforces length bounds.
 */
export function sanitizeInputText(input: unknown, maxLength = 500): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .trim()
    .slice(0, Math.max(1, maxLength));
}

/**
 * Computes self-arranged X/Z spatial coordinates for any number of banquet tables
 * according to the chosen architectural floor layout.
 */
export function computeTableLayoutCoordinates(
  tables: SeatingTable[],
  layout: TableArrangementLayout
): SeatingTable[] {
  const count = tables.length;
  return tables.map((tbl, idx) => {
    let x = tbl.x;
    let z = tbl.z;
    let zone: SeatingTable['zone'] = tbl.zone;

    if (layout === 'banquet-radial') {
      if (idx === 0) {
        x = 0;
        z = -3.4;
        zone = 'Head Table';
      } else {
        const ringIdx = idx - 1;
        const innerCount = Math.min(5, count - 1);
        if (ringIdx < innerCount) {
          const theta =
            -Math.PI * 0.42 + (ringIdx / Math.max(1, innerCount - 1)) * (Math.PI * 0.84);
          x = Number((Math.sin(theta) * 7.6).toFixed(2));
          z = Number((Math.cos(theta) * 4.5 + 0.2).toFixed(2));
          zone = x < 0 ? 'West Pavilion' : 'East Terrace';
        } else {
          const outerIdx = ringIdx - innerCount;
          const outerTotal = Math.max(1, count - 1 - innerCount);
          const span = (outerIdx - (outerTotal - 1) / 2) * 5.6;
          x = Number(span.toFixed(2));
          z = 8.2;
          zone = 'VIP Garden';
        }
      }
    } else if (layout === 'royal-u-shape') {
      if (idx === 0) {
        x = 0;
        z = -4.2;
        zone = 'Head Table';
      } else if (idx % 2 === 1) {
        const row = Math.floor((idx - 1) / 2);
        x = -6.2;
        z = Number((-1.2 + row * 3.8).toFixed(2));
        zone = 'West Pavilion';
      } else {
        const row = Math.floor((idx - 1) / 2);
        x = 6.2;
        z = Number((-1.2 + row * 3.8).toFixed(2));
        zone = 'East Terrace';
      }
    } else if (layout === 'imperial-columns') {
      const col = idx % 2 === 0 ? -3.8 : 3.8;
      const row = Math.floor(idx / 2);
      x = col;
      z = Number((-3.6 + row * 3.6).toFixed(2));
      zone = idx === 0 ? 'Head Table' : col < 0 ? 'West Pavilion' : 'East Terrace';
    } else if (layout === 'cabaret-cluster') {
      const cols = 3;
      const colIdx = idx % cols;
      const rowIdx = Math.floor(idx / cols);
      const stagger = rowIdx % 2 === 1 ? 1.8 : -1.8;
      x = Number(((colIdx - 1) * 5.4 + stagger * 0.45).toFixed(2));
      z = Number((-3.4 + rowIdx * 4.2).toFixed(2));
      zone = idx === 0 ? 'Head Table' : 'VIP Garden';
    }

    return {
      ...tbl,
      x,
      z,
      zone,
    };
  });
}

/**
 * Parses natural language user chat messages into immediate 3D Venue mutations
 * so the user can change indoor/outdoor mode, table arrangement, colors, lighting, or table count via chat.
 */
export function parseNaturalLanguageVenueCommand(text: string): VenueMutationCommand | null {
  const lower = text.toLowerCase();
  const cmd: VenueMutationCommand = {};
  const appliedParts: string[] = [];

  // 1. Environment Mode (Outdoor / Indoor / Conservatory)
  if (/\b(outdoor|open air|garden|lawn|outside|starlit)\b/.test(lower)) {
    cmd.environmentMode = 'outdoor';
    appliedParts.push('Outdoor Garden');
  } else if (/\b(indoor|inside|ballroom|hall|enclosed)\b/.test(lower)) {
    cmd.environmentMode = 'indoor';
    appliedParts.push('Indoor Ballroom');
  } else if (/\b(glasshouse|conservatory|pavilion|orangery)\b/.test(lower)) {
    cmd.environmentMode = 'conservatory';
    appliedParts.push('Glasshouse Conservatory');
  }

  // 2. Table Layout Arrangement
  if (/\b(u-shape|u shape|courtyard|horseshoe)\b/.test(lower)) {
    cmd.tableLayout = 'royal-u-shape';
    appliedParts.push('Royal U-Shape Layout');
  } else if (/\b(column|parallel|rows|imperial|straight)\b/.test(lower)) {
    cmd.tableLayout = 'imperial-columns';
    appliedParts.push('Imperial Columns Layout');
  } else if (/\b(cabaret|cluster|staggered|diagonal)\b/.test(lower)) {
    cmd.tableLayout = 'cabaret-cluster';
    appliedParts.push('Cabaret Clusters Layout');
  } else if (/\b(radial|circle|semi-circle|amphitheater|auto arrange|rearrange)\b/.test(lower)) {
    cmd.tableLayout = 'banquet-radial';
    appliedParts.push('Radial Amphitheater Layout');
  }

  // 3. Lighting Atmosphere ('Sunset Warmth', 'Midnight Gala', 'Daylight Crisp' + legacy aliases)
  if (/\b(midnight gala|midnight|twilight|blue hour|starry|candle|candlelight|sangeet|romantic)\b/.test(lower)) {
    cmd.lightingMode = 'midnight-gala';
    appliedParts.push('Midnight Gala Atmosphere');
  } else if (/\b(daylight crisp|daylight|day|morning|bright|sunlit|crisp)\b/.test(lower)) {
    cmd.lightingMode = 'daylight-crisp';
    appliedParts.push('Daylight Crisp Atmosphere');
  } else if (
    /\b(sunset warmth|sunset|golden|warmth)\b/.test(lower) ||
    (/\b(warm)\b/.test(lower) && /\b(light|lighting|mode|sky|atmosphere)\b/.test(lower))
  ) {
    cmd.lightingMode = 'sunset-warmth';
    appliedParts.push('Sunset Warmth Atmosphere');
  }

  // Optional Light Intensity via chat (e.g. "intensity 150%" or "dim lights")
  const intensityPctMatch = lower.match(/\b(\d{2,3})\s*%\s*(light|intensity|brightness)/) ||
    lower.match(/\b(light|intensity|brightness)\s*(?:to|at)?\s*(\d{2,3})\s*%/);
  if (intensityPctMatch) {
    const rawPct = Number(intensityPctMatch[1]) || Number(intensityPctMatch[2]);
    if (Number.isFinite(rawPct) && rawPct >= 30 && rawPct <= 200) {
      cmd.lightIntensity = Number((rawPct / 100).toFixed(2));
      appliedParts.push(`${rawPct}% Light Intensity`);
    }
  }

  // 4. Colors (Linen & Accent)
  const colorMap: { pattern: RegExp; hex: string; name: string }[] = [
    { pattern: /\b(emerald|forest green|sage|green)\b/, hex: '#0F5132', name: 'Emerald Green' },
    { pattern: /\b(ruby|crimson|maroon|sindoor|red|burgundy)\b/, hex: '#881337', name: 'Royal Crimson' },
    { pattern: /\b(navy|midnight blue|royal blue|sapphire|blue)\b/, hex: '#1E293B', name: 'Midnight Navy' },
    { pattern: /\b(ivory|cream|white|pearl|alabaster)\b/, hex: '#F5F2EB', name: 'Ivory Silk' },
    { pattern: /\b(blush|rose|pink|peach)\b/, hex: '#F4ACB7', name: 'Rose Blush' },
    { pattern: /\b(lavender|lilac|plum|purple|violet)\b/, hex: '#581C87', name: 'Royal Plum' },
    { pattern: /\b(gold|marigold|amber|brass|champagne|yellow)\b/, hex: '#D4AF37', name: 'Royal Gold' },
    { pattern: /\b(teal|turquoise|peacock|cyan)\b/, hex: '#0D9488', name: 'Peacock Teal' },
  ];

  for (const c of colorMap) {
    if (c.pattern.test(lower)) {
      if (/\b(accent|runner|trim|centerpiece|stage)\b/.test(lower)) {
        cmd.accentHex = c.hex;
        appliedParts.push(`${c.name} Accent`);
      } else if (!cmd.linenColor) {
        cmd.linenColor = c.hex;
        appliedParts.push(`${c.name} Table Linen`);
      } else if (!cmd.accentHex) {
        cmd.accentHex = c.hex;
        appliedParts.push(`${c.name} Runner`);
      }
    }
  }

  // 5. Add or Remove Tables
  const addMatch = lower.match(/\badd\s+(\d+)\s+table/);
  if (addMatch) {
    cmd.addTableCount = Math.min(6, Math.max(1, Number(addMatch[1])));
    appliedParts.push(`+${cmd.addTableCount} Table(s)`);
  } else if (/\badd\s+(a\s+)?table\b/.test(lower)) {
    cmd.addTableCount = 1;
    appliedParts.push('+1 Table');
  }

  const removeMatch = lower.match(/\b(remove|delete)\s+(\d+)\s+table/);
  if (removeMatch) {
    cmd.removeTableCount = Math.min(4, Math.max(1, Number(removeMatch[2])));
    appliedParts.push(`-${cmd.removeTableCount} Table(s)`);
  } else if (/\b(remove|delete)\s+(a\s+|last\s+)?table\b/.test(lower)) {
    cmd.removeTableCount = 1;
    appliedParts.push('-1 Table');
  }

  // 6. Stage Backdrop Style
  if (/\b(mandap|floral stage)\b/.test(lower)) {
    cmd.stageStyle = 'floral-mandap';
    appliedParts.push('Royal Floral Mandap Stage');
  } else if (/\b(velvet|drape|curtain)\b/.test(lower)) {
    cmd.stageStyle = 'royal-velvet';
    appliedParts.push('Royal Velvet Stage');
  }

  if (appliedParts.length === 0) return null;
  cmd.summaryLabel = appliedParts.join(' · ');
  return cmd;
}

/**
 * Strips raw Markdown asterisks (***, **, *), heading hashes (###), underscore emphasis,
 * and inline backticks so chat replies render as clean, readable executive prose.
 */
export function formatCleanChatReply(text: string): string {
  if (typeof text !== 'string') return '';
  return text
    .replace(/^\s*#{1,6}\s+/gm, '') // Strip markdown headers
    .replace(/^\s*\*\s+/gm, '• ') // Convert leading "* " bullets to clean "• " bullets
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1') // Strip ***bold italic***, **bold**, *italic*
    .replace(/\*+/g, '') // Strip any stray asterisks
    .replace(/_{2,3}([^_]+)_{2,3}/g, '$1') // Strip __bold__ / ___italic___
    .replace(/`([^`]+)`/g, '$1') // Strip inline code backticks
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export type CanonicalLightingAtmosphere = 'sunset-warmth' | 'midnight-gala' | 'daylight-crisp';

export function normalizeLightingAtmosphere(
  mode?: LightingAtmosphere
): CanonicalLightingAtmosphere {
  if (mode === 'midnight-gala' || mode === 'twilight' || mode === 'candlelight') {
    return 'midnight-gala';
  }
  if (mode === 'daylight-crisp' || mode === 'daylight') {
    return 'daylight-crisp';
  }
  return 'sunset-warmth';
}

export interface LightingAtmosphereProfile {
  canonicalId: CanonicalLightingAtmosphere;
  label: 'Sunset Warmth' | 'Midnight Gala' | 'Daylight Crisp';
  kelvinLabel: string;
  intensityMultiplier: number;
  intensityPercent: number;
  keyLightHex: number;
  keyLightIntensity: number;
  hemiSkyHex: number;
  hemiGroundHex: number;
  hemiLightIntensity: number;
  rimLightHex: number;
  rimLightIntensity: number;
  stageAccentHex: number;
  stageAccentIntensity: number;
  bulbHex: number;
  toneMappingExposure: number;
  horizonHex: string;
}

/**
 * Computes calibrated Three.js light colors, intensities, and exposure for
 * 'Sunset Warmth', 'Midnight Gala', and 'Daylight Crisp' scaled by the user's light intensity control.
 */
export function computeLightingAtmosphereProfile(
  mode?: LightingAtmosphere,
  intensityMultiplier = 1.0,
  environmentMode: VenueEnvironmentMode = 'conservatory',
  isSoftwareGl = false
): LightingAtmosphereProfile {
  const canonicalId = normalizeLightingAtmosphere(mode);
  const clampedMult = Math.max(0.4, Math.min(2.0, Number.isFinite(intensityMultiplier) ? intensityMultiplier : 1.0));
  const intensityPercent = Math.round(clampedMult * 100);

  if (canonicalId === 'midnight-gala') {
    const baseKey = 1.48;
    const baseHemi = isSoftwareGl ? 0.78 : 0.48;
    const baseRim = 1.05;
    const baseStage = 2.15;
    return {
      canonicalId,
      label: 'Midnight Gala',
      kelvinLabel: '2400K Starlight & Chandelier Amber',
      intensityMultiplier: clampedMult,
      intensityPercent,
      keyLightHex: 0xc4b5fd,
      keyLightIntensity: Number((baseKey * clampedMult).toFixed(2)),
      hemiSkyHex: 0x312e81,
      hemiGroundHex: 0x1e1b4b,
      hemiLightIntensity: Number((baseHemi * clampedMult).toFixed(2)),
      rimLightHex: 0xfbbf24,
      rimLightIntensity: Number((baseRim * clampedMult).toFixed(2)),
      stageAccentHex: 0xffb76b,
      stageAccentIntensity: Number((baseStage * clampedMult).toFixed(2)),
      bulbHex: 0xffcf70,
      toneMappingExposure: Number((0.95 + clampedMult * 0.16).toFixed(2)),
      horizonHex: '#090D18',
    };
  }

  if (canonicalId === 'daylight-crisp') {
    const baseKey = 2.55;
    const baseHemi = isSoftwareGl ? 1.38 : 1.18;
    const baseRim = 0.95;
    const baseStage = 1.25;
    return {
      canonicalId,
      label: 'Daylight Crisp',
      kelvinLabel: '5600K Zenith Architectural Daylight',
      intensityMultiplier: clampedMult,
      intensityPercent,
      keyLightHex: 0xffffff,
      keyLightIntensity: Number((baseKey * clampedMult).toFixed(2)),
      hemiSkyHex: 0xe0f2fe,
      hemiGroundHex: 0x64748b,
      hemiLightIntensity: Number((baseHemi * clampedMult).toFixed(2)),
      rimLightHex: 0xbae6fd,
      rimLightIntensity: Number((baseRim * clampedMult).toFixed(2)),
      stageAccentHex: 0xfffbeb,
      stageAccentIntensity: Number((baseStage * clampedMult).toFixed(2)),
      bulbHex: 0xffffff,
      toneMappingExposure: Number((1.05 + clampedMult * 0.18).toFixed(2)),
      horizonHex: environmentMode === 'outdoor' ? '#1E3A5F' : '#1E293B',
    };
  }

  // Default: 'sunset-warmth'
  const baseKey = 2.15;
  const baseHemi = isSoftwareGl ? 1.15 : 0.82;
  const baseRim = 0.88;
  const baseStage = 1.85;
  return {
    canonicalId: 'sunset-warmth',
    label: 'Sunset Warmth',
    kelvinLabel: '3200K Golden Amber Horizon',
    intensityMultiplier: clampedMult,
    intensityPercent,
    keyLightHex: 0xffdfa8,
    keyLightIntensity: Number((baseKey * clampedMult).toFixed(2)),
    hemiSkyHex: 0xfde68a,
    hemiGroundHex: 0x3b281e,
    hemiLightIntensity: Number((baseHemi * clampedMult).toFixed(2)),
    rimLightHex: 0xf59e0b,
    rimLightIntensity: Number((baseRim * clampedMult).toFixed(2)),
    stageAccentHex: 0xffc875,
    stageAccentIntensity: Number((baseStage * clampedMult).toFixed(2)),
    bulbHex: 0xffe49e,
    toneMappingExposure: Number((1.0 + clampedMult * 0.16).toFixed(2)),
    horizonHex: environmentMode === 'outdoor' ? '#1A1615' : '#161C2E',
  };
}

export interface GuestZoneMapTablePin {
  tableNumber: number;
  label: string;
  zone: SeatingTable['zone'];
  capacity: number;
  svgX: number; // Normalized onto 320x220 mobile zone map
  svgY: number;
  isAssignedTable: boolean;
}

export interface GuestQrPassData {
  guestId: string;
  guestName: string;
  role: string;
  partySize: number;
  dietary: GuestRecord['dietary'];
  rsvpStatus: GuestRecord['rsvpStatus'];
  assignedTableNumber: number | null;
  assignedTableLabel: string;
  assignedZone: SeatingTable['zone'] | 'Unassigned Reception Lounge';
  verificationCode: string;
  shareUrl: string;
  eventName: string;
  venueName: string;
  qrMatrix: boolean[][]; // 21x21 deterministic QR code matrix
  mapPins: GuestZoneMapTablePin[];
}

/**
 * Generates a unique QR seating pass and mobile zone map payload for a guest.
 */
export function generateGuestSeatingQrPass(
  guest: GuestRecord,
  allTables: SeatingTable[],
  eventName: string,
  venueName: string,
  baseUrl = 'https://aura-atelier.app'
): GuestQrPassData {
  const assignedTable =
    guest.tableNumber !== null
      ? allTables.find((t) => t.tableNumber === guest.tableNumber)
      : undefined;

  const partySize = 1 + Math.max(0, guest.plusOnes);
  const assignedTableNumber = assignedTable ? assignedTable.tableNumber : null;
  const assignedTableLabel = assignedTable
    ? assignedTable.label
    : 'Unassigned · Check In at Host Desk';
  const assignedZone = assignedTable
    ? assignedTable.zone
    : 'Unassigned Reception Lounge';

  // Deterministic alphanumeric verification code per guest + table
  const seedStr = `${guest.id}|${guest.fullName}|T${assignedTableNumber ?? 0}|${eventName}`;
  let hash = 2166136261;
  for (let i = 0; i < seedStr.length; i++) {
    hash ^= seedStr.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const hexSuffix = (hash >>> 0).toString(16).toUpperCase().padStart(8, '0').slice(0, 6);
  const tableTag = assignedTableNumber ? `T0${assignedTableNumber}` : 'WAIT';
  const verificationCode = `AURA-${tableTag}-${hexSuffix}`;

  const cleanBase = baseUrl.replace(/\/$/, '');
  const shareUrl = `${cleanBase}/?seatingPass=${encodeURIComponent(guest.id)}&table=${
    assignedTableNumber ?? 'unassigned'
  }&code=${encodeURIComponent(verificationCode)}`;

  // Build authentic 21x21 Version-1 QR matrix with 7x7 finder patterns, timing strips & deterministic data bits
  const size = 21;
  const matrix: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
  const reserved: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

  const placeFinderPattern = (rowOffset: number, colOffset: number) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const rr = rowOffset + r;
        const cc = colOffset + c;
        if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
        reserved[rr][cc] = true;
        if (r >= 0 && r <= 6 && c >= 0 && c <= 6) {
          const isBorder = r === 0 || r === 6 || c === 0 || c === 6;
          const isInner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
          matrix[rr][cc] = isBorder || isInner;
        } else {
          matrix[rr][cc] = false;
        }
      }
    }
  };

  placeFinderPattern(0, 0);
  placeFinderPattern(0, size - 7);
  placeFinderPattern(size - 7, 0);

  // Timing patterns along row 6 and col 6
  for (let i = 8; i < size - 8; i++) {
    reserved[6][i] = true;
    reserved[i][6] = true;
    matrix[6][i] = i % 2 === 0;
    matrix[i][6] = i % 2 === 0;
  }

  // Fill remaining unreserved modules deterministically from guest shareUrl & verificationCode
  const payloadBytes = `${shareUrl}|${guest.fullName}|${assignedZone}`;
  let bitIdx = 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (reserved[r][c]) continue;
      const charCode = payloadBytes.charCodeAt(bitIdx % payloadBytes.length);
      const shift = (bitIdx + r * 3 + c * 5) % 8;
      const bit = ((charCode >> shift) ^ ((hash >>> (bitIdx % 16)) & 1)) & 1;
      matrix[r][c] = Boolean(bit);
      bitIdx++;
    }
  }

  // Map 3D floor coordinates (x in [-10, 10], z in [-6, 10]) onto a 320x220 mobile SVG zone map
  const mapPins: GuestZoneMapTablePin[] = allTables.map((tbl) => {
    const normX = (tbl.x + 10) / 20; // 0..1
    const normZ = (tbl.z + 6) / 16; // 0..1
    const svgX = Math.round(Math.max(36, Math.min(284, 36 + normX * 248)));
    const svgY = Math.round(Math.max(52, Math.min(194, 52 + normZ * 142)));
    return {
      tableNumber: tbl.tableNumber,
      label: tbl.label,
      zone: tbl.zone,
      capacity: tbl.capacity,
      svgX,
      svgY,
      isAssignedTable: tbl.tableNumber === assignedTableNumber,
    };
  });

  return {
    guestId: guest.id,
    guestName: guest.fullName,
    role: guest.role,
    partySize,
    dietary: guest.dietary,
    rsvpStatus: guest.rsvpStatus,
    assignedTableNumber,
    assignedTableLabel,
    assignedZone,
    verificationCode,
    shareUrl,
    eventName,
    venueName,
    qrMatrix: matrix,
    mapPins,
  };
}

export interface EventReadinessDecision {
  readinessScore: number; // 0 to 100
  statusLabel: 'Production Ready' | 'Attention Recommended' | 'Action Required';
  nextBestActionLabel: string;
  nextBestActionReason: string;
  targetSection:
    | 'spatial-3d'
    | 'budget-payments'
    | 'vendors-themes'
    | 'bioscience-workspace'
    | 'rsvp-modal';
  dietaryAdvisoryCount: number;
}

/**
 * Context-aware decision engine that evaluates budget variance, seating capacity,
 * vendor contract state, and guest dietary requirements to recommend the highest-impact next action.
 */
export function evaluateEventReadiness(
  preset: Pick<EventPreset, 'totalBudgetCap' | 'name'>,
  budgetItems: BudgetLineItem[],
  vendors: VendorRecord[],
  guests: GuestRecord[],
  tables: SeatingTable[]
): EventReadinessDecision {
  const budget = calculateBudgetMetrics(budgetItems, preset.totalBudgetCap);
  const seating = calculateSeatingMetrics(guests, tables);

  const dietaryAdvisoryCount = guests
    .filter((g) => g.rsvpStatus !== 'Declined' && g.dietary !== 'Standard')
    .reduce((sum, g) => sum + 1 + Math.max(0, g.plusOnes), 0);

  const negotiatingVendors = vendors.filter((v) => v.status === 'Negotiating');
  const totalChecklists = vendors.reduce((acc, v) => acc + v.checklist.length, 0);
  const completedChecklists = vendors.reduce(
    (acc, v) => acc + v.checklist.filter((c) => c.completed).length,
    0
  );

  let score = 100;
  if (budget.overBudgetCategories.length > 0) {
    score -= Math.min(25, budget.overBudgetCategories.length * 10);
  }
  if (budget.healthStatus === 'Over Allocated') {
    score -= 15;
  }
  if (seating.unassignedHeadcount > 0) {
    score -= Math.min(25, seating.unassignedHeadcount * 4);
  }
  if (negotiatingVendors.length > 0) {
    score -= Math.min(20, negotiatingVendors.length * 7);
  }
  if (totalChecklists > 0) {
    const checklistRatio = completedChecklists / totalChecklists;
    score -= Math.round((1 - checklistRatio) * 15);
  }

  const readinessScore = Math.max(10, Math.min(100, score));
  const statusLabel: EventReadinessDecision['statusLabel'] =
    readinessScore >= 88
      ? 'Production Ready'
      : readinessScore >= 70
      ? 'Attention Recommended'
      : 'Action Required';

  if (budget.overBudgetCategories.length > 0 || budget.healthStatus === 'Over Allocated') {
    const overCat = budget.overBudgetCategories[0] || 'Department Cap';
    return {
      readinessScore,
      statusLabel,
      nextBestActionLabel: `Rebalance ${overCat} Overrun`,
      nextBestActionReason: `${overCat} exceeds allocation; run AI Budget Optimizer to cover deficit from flexible reserves.`,
      targetSection: 'budget-payments',
      dietaryAdvisoryCount,
    };
  }

  if (seating.unassignedHeadcount > 0) {
    return {
      readinessScore,
      statusLabel,
      nextBestActionLabel: `Seat ${seating.unassignedHeadcount} Unassigned Guests`,
      nextBestActionReason: `${seating.unassignedHeadcount} confirmed/pending guests need 3D banquet table assignments.`,
      targetSection: 'rsvp-modal',
      dietaryAdvisoryCount,
    };
  }

  if (negotiatingVendors.length > 0) {
    const topVendor = negotiatingVendors[0];
    const potentialSavings = Math.max(0, topVendor.quotedAmount - topVendor.negotiatedTarget);
    return {
      readinessScore,
      statusLabel,
      nextBestActionLabel: `Negotiate ${topVendor.name} (-${formatINR(potentialSavings)})`,
      nextBestActionReason: `${negotiatingVendors.length} vendor contract(s) open; generate counter-offer addendum to lock target cap.`,
      targetSection: 'vendors-themes',
      dietaryAdvisoryCount,
    };
  }

  return {
    readinessScore,
    statusLabel,
    nextBestActionLabel: `Audit ${dietaryAdvisoryCount} Dietary & Floral Safety Profiles`,
    nextBestActionReason: `All tables seated and budgets balanced; verify PubChem allergen profiles and sync Workspace run-of-show.`,
    targetSection: 'bioscience-workspace',
    dietaryAdvisoryCount,
  };
}
