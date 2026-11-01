import {
  BudgetLineItem,
  CollaboratorActivity,
  EventCategory,
  EventPreset,
  GuestRecord,
  LightingAtmosphere,
  MoodBoardItem,
  PaymentTransaction,
  PubChemCompoundProfile,
  SeatingTable,
  TableArrangementLayout,
  TimelineMilestone,
  VendorRecord,
  VenueEnvironmentMode,
} from '../types/planning';
import { computeTableLayoutCoordinates } from '../utils/planningLogic';

export function createArchitecturalMoodSvg(
  title: string,
  subtitle: string,
  bgHex: string,
  accentHex: string,
  secondaryHex: string,
  motif: 'glasshouse' | 'rooftop' | 'pavilion'
): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 750" width="1200" height="750">
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${bgHex}" />
        <stop offset="65%" stop-color="${secondaryHex}" />
        <stop offset="100%" stop-color="#0F172A" />
      </linearGradient>
      <radialGradient id="glow" cx="50%" cy="42%" r="48%">
        <stop offset="0%" stop-color="${accentHex}" stop-opacity="0.48" />
        <stop offset="100%" stop-color="${accentHex}" stop-opacity="0" />
      </radialGradient>
    </defs>
    <rect width="1200" height="750" fill="url(#sky)" />
    <circle cx="600" cy="315" r="390" fill="url(#glow)" />
    <g stroke="${accentHex}" stroke-opacity="0.22" stroke-width="1.5">
      <line x1="0" y1="520" x2="1200" y2="520" />
      <line x1="0" y1="575" x2="1200" y2="575" />
      <line x1="0" y1="645" x2="1200" y2="645" />
      <line x1="600" y1="320" x2="100" y2="750" />
      <line x1="600" y1="320" x2="350" y2="750" />
      <line x1="600" y1="320" x2="600" y2="750" />
      <line x1="600" y1="320" x2="850" y2="750" />
      <line x1="600" y1="320" x2="1100" y2="750" />
    </g>
    ${
      motif === 'glasshouse'
        ? `<g fill="none" stroke="#F8FAFC" stroke-opacity="0.45" stroke-width="2">
            <path d="M 180 520 L 180 230 Q 600 60 1020 230 L 1020 520 Z" />
            <path d="M 290 520 L 290 250 Q 600 110 910 250 L 910 520" />
            <line x1="600" y1="140" x2="600" y2="520" />
            <circle cx="600" cy="240" r="54" stroke="${accentHex}" stroke-width="3" />
          </g>`
        : motif === 'rooftop'
        ? `<g fill="none" stroke="#F8FAFC" stroke-opacity="0.42" stroke-width="2">
            <rect x="220" y="180" width="760" height="340" rx="16" />
            <circle cx="420" cy="260" r="24" fill="${accentHex}" fill-opacity="0.65" />
            <circle cx="600" cy="240" r="32" fill="${accentHex}" fill-opacity="0.85" />
            <circle cx="780" cy="260" r="24" fill="${accentHex}" fill-opacity="0.65" />
          </g>`
        : `<g fill="none" stroke="#F8FAFC" stroke-opacity="0.48" stroke-width="2.5">
            <polygon points="160,520 600,150 1040,520" />
            <polygon points="280,520 600,220 920,520" stroke="${accentHex}" />
          </g>`
    }
    <g fill="#F8FAFC" fill-opacity="0.88">
      <ellipse cx="380" cy="600" rx="95" ry="32" />
      <ellipse cx="600" cy="575" rx="115" ry="38" fill="${accentHex}" fill-opacity="0.9" />
      <ellipse cx="820" cy="600" rx="95" ry="32" />
    </g>
    <rect x="48" y="48" width="620" height="110" rx="8" fill="#0F172A" fill-opacity="0.76" stroke="#F8FAFC" stroke-opacity="0.2" />
    <text x="74" y="95" fill="#F8FAFC" font-family="Georgia, serif" font-size="26" font-weight="bold">${title}</text>
    <text x="74" y="130" fill="#CBD5E1" font-family="sans-serif" font-size="15">${subtitle}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// Single Sample Event (so the user can inspect and test changes right away, while creating their own events from scratch)
export const EVENT_PRESETS: EventPreset[] = [
  {
    id: 'evt-sample-royal',
    name: 'Sample: Aarav & Diya — Udaipur Courtyard Wedding',
    category: 'wedding',
    date: '2027-02-18',
    venueName: 'Suryagarh Heritage Courtyard & Glass Pavilion',
    guestCountTarget: 120,
    totalBudgetCap: 4500000, // ₹45,00,000
    themeTitle: 'Royal Sandstone, Mogra Jasmine & Candlelit Brass',
    themeSubtitle:
      'Cascading white mogra and Phalaenopsis orchids, sandstone plinths, brushed brass urli vessels, and live sitar quartet.',
    linenColor: '#F5F2EB',
    accentHex: '#C89D54',
    floorColor: '#EDE8DF',
    environmentMode: 'conservatory',
    tableLayout: 'banquet-radial',
    stageStyle: 'floral-mandap',
    lightingMode: 'golden',
    tableCount: 8,
    seatsPerTable: 8,
    isSample: true,
  },
];

export function generateTablesForCount(
  count: number,
  layout: TableArrangementLayout = 'banquet-radial'
): SeatingTable[] {
  const safeCount = Math.max(1, Math.min(16, count));
  const raw: SeatingTable[] = Array.from({ length: safeCount }, (_, i) => {
    const num = i + 1;
    const label =
      num === 1
        ? 'Table 01 · Head Table'
        : `Table ${num < 10 ? `0${num}` : num} · Royal Dining`;
    return {
      tableNumber: num,
      label,
      capacity: 8,
      zone: num === 1 ? 'Head Table' : 'VIP Garden',
      x: 0,
      z: 0,
    };
  });
  return computeTableLayoutCoordinates(raw, layout === 'custom' ? 'banquet-radial' : layout);
}

export function createUserCustomEvent(params: {
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
}): EventPreset {
  return {
    id: `evt-user-${Date.now()}`,
    name: params.name.trim() || 'My Custom Celebration',
    category: params.category,
    date: params.date || '2027-04-10',
    venueName: params.venueName.trim() || 'Custom Architectural Venue',
    guestCountTarget: Math.max(10, Number(params.guestCountTarget) || 80),
    totalBudgetCap: Math.max(25000, Number(params.totalBudgetCap) || 1500000),
    themeTitle: `${params.environmentMode === 'outdoor' ? 'Open-Air Garden' : params.environmentMode === 'indoor' ? 'Grand Indoor Ballroom' : 'Glasshouse Pavilion'} Direction`,
    themeSubtitle: `User-designed ${params.category} layout with ${params.tableCount} banquet tables in ${params.tableLayout} formation.`,
    linenColor: params.linenColor || '#F5F2EB',
    accentHex: params.accentHex || '#C89D54',
    floorColor: '#EDE8DF',
    environmentMode: params.environmentMode,
    tableLayout: params.tableLayout,
    stageStyle: 'floral-mandap',
    lightingMode: params.lightingMode,
    tableCount: Math.max(1, Math.min(16, Number(params.tableCount) || 6)),
    seatsPerTable: 8,
    isSample: false,
  };
}

export const INITIAL_BUDGET_ITEMS: Record<string, BudgetLineItem[]> = {
  'evt-sample-royal': [
    {
      id: 'b-wed-1',
      category: 'Venue & Architecture',
      title: 'Suryagarh Heritage Courtyard & Pavilion Buyout',
      allocated: 1400000,
      spent: 1400000,
      vendorId: 'ven-1',
      notes: 'Includes royal courtyard mandap lawn, reception pavilion, and hospitality suites.',
      priority: 'essential',
    },
    {
      id: 'b-wed-2',
      category: 'Culinary & Beverage',
      title: 'Royal Awadhi & Modern Indian 7-Course Tasting Banquet',
      allocated: 1350000,
      spent: 950000,
      vendorId: 'ven-2',
      notes: '120 guests + live chaat & artisan mocktail/aperitif conservatory bar.',
      priority: 'essential',
    },
    {
      id: 'b-wed-3',
      category: 'Floral & Botanicals',
      title: 'Suspended Jasmine, Marigold & White Orchid Mandap Canopy',
      allocated: 600000,
      spent: 680000,
      vendorId: 'ven-3',
      notes: 'Over-allocated due to added brass urli floral density along walkway.',
      priority: 'elevated',
    },
    {
      id: 'b-wed-4',
      category: 'Production & Audio',
      title: 'Warm Pin-Spot Lighting Rig & Acoustic Sitar Quartet Sound',
      allocated: 450000,
      spent: 225000,
      vendorId: 'ven-4',
      notes: '50% deposit settled; final sangeet cue sheet review pending.',
      priority: 'elevated',
    },
    {
      id: 'b-wed-5',
      category: 'Photography & Cinema',
      title: 'Editorial Wedding Cinema & Archival Fine-Art Stills Team',
      allocated: 400000,
      spent: 200000,
      notes: 'Includes mehendi, sangeet, and reception coverage.',
      priority: 'flexible',
    },
    {
      id: 'b-wed-6',
      category: 'Attire & Styling',
      title: 'Custom Chanderi Table Drapery, Brass Cutlery & Lounge Seating',
      allocated: 300000,
      spent: 110000,
      notes: 'Swatches approved; final guest headcount lock 14 days prior.',
      priority: 'flexible',
    },
  ],
};

export const INITIAL_VENDORS: VendorRecord[] = [
  {
    id: 'ven-1',
    name: 'Suryagarh Heritage Estates & Pavilions',
    category: 'Venue & Architecture',
    contactEmail: 'events@suryagarh-heritage.example.com',
    quotedAmount: 1550000,
    negotiatedTarget: 1400000,
    paidAmount: 1400000,
    status: 'Paid in Full',
    rating: 4.95,
    leverageNotes: [
      'Full upfront wire settlement',
      'Shared in-house kitchen partner reduces utility surcharge',
    ],
    checklist: [
      { id: 'chk-1', task: 'Countersign heritage courtyard permissions addendum', completed: true, dueDate: '2026-11-15' },
      { id: 'chk-2', task: 'Submit 3D floorplan seating layout to venue manager', completed: true, dueDate: '2026-12-01' },
      { id: 'chk-3', task: 'Confirm 10:00 AM floral load-in gate access', completed: false, dueDate: '2027-02-01' },
    ],
  },
  {
    id: 'ven-2',
    name: 'Dastarkhwan Royal Culinary Collective',
    category: 'Culinary & Beverage',
    contactEmail: 'concierge@dastarkhwan-culinary.example.com',
    quotedAmount: 1520000,
    negotiatedTarget: 1350000,
    paidAmount: 675000,
    status: 'Deposit Paid',
    rating: 4.92,
    leverageNotes: [
      'Guaranteed minimum 115 adult plates',
      'Bundle welcome high-tea and late-night kulfi bar',
    ],
    checklist: [
      { id: 'chk-4', task: 'Complete Bioscience Allergen & Floral Terpene Cross-Check', completed: true, dueDate: '2026-11-20' },
      { id: 'chk-5', task: 'Lock final vegan, nut-free, and Jain/Gluten-Free seat matrix', completed: false, dueDate: '2027-02-05' },
    ],
  },
  {
    id: 'ven-3',
    name: 'Atelier Mogra & Sculptural Flora',
    category: 'Floral & Botanicals',
    contactEmail: 'studio@ateliermogra.example.com',
    quotedAmount: 760000,
    negotiatedTarget: 600000,
    paidAmount: 200000,
    status: 'Negotiating',
    rating: 4.88,
    leverageNotes: [
      'Repurpose sangeet floral urns to reception head table',
      'Use locally grown Udaipur jasmine and white orchids',
    ],
    checklist: [
      { id: 'chk-6', task: 'Approve hanging mandap floral rigging certificate', completed: true, dueDate: '2026-12-05' },
      { id: 'chk-7', task: 'Finalize low-pollen hypoallergenic table centerpiece spec', completed: false, dueDate: '2027-01-25' },
    ],
  },
  {
    id: 'ven-4',
    name: 'Lumiere Architectural Lighting & Acoustics',
    category: 'Production & Audio',
    contactEmail: 'production@lumiereacoustics.example.com',
    quotedAmount: 520000,
    negotiatedTarget: 450000,
    paidAmount: 225000,
    status: 'Contracted',
    rating: 4.9,
    leverageNotes: [
      'In-house truss points already pre-rigged in pavilion',
      'Off-peak morning load-in window',
    ],
    checklist: [
      { id: 'chk-8', task: 'Verify 2700K warm dimmer curve for dinner service', completed: false, dueDate: '2027-02-10' },
    ],
  },
];

export const INITIAL_TABLES: SeatingTable[] = generateTablesForCount(8, 'banquet-radial');

export const INITIAL_GUESTS: GuestRecord[] = [
  {
    id: 'gst-1',
    fullName: 'Aarav Singhania & Diya Kapoor',
    email: 'aarav.diya@example.com',
    rsvpStatus: 'Confirmed',
    plusOnes: 1,
    dietary: 'Standard',
    tableNumber: 1,
    role: 'Couple of Honor',
  },
  {
    id: 'gst-2',
    fullName: 'Dr. Rajesh & Meera Kapoor',
    email: 'rajesh.kapoor@example.com',
    rsvpStatus: 'Confirmed',
    plusOnes: 1,
    dietary: 'Gluten-Free',
    tableNumber: 1,
    role: 'Parents of Bride',
  },
  {
    id: 'gst-3',
    fullName: 'Vikramaditya & Sunita Singhania',
    email: 'sunita.singhania@example.com',
    rsvpStatus: 'Confirmed',
    plusOnes: 1,
    dietary: 'Nut-Free',
    tableNumber: 1,
    role: 'Parents of Groom',
  },
  {
    id: 'gst-4',
    fullName: 'Ananya Verma',
    email: 'ananya.verma@example.com',
    rsvpStatus: 'Confirmed',
    plusOnes: 1,
    dietary: 'Vegan',
    tableNumber: 2,
    role: 'Sister of Bride',
  },
  {
    id: 'gst-5',
    fullName: 'Kabir Malhotra',
    email: 'kabir.m@example.com',
    rsvpStatus: 'Confirmed',
    plusOnes: 1,
    dietary: 'Standard',
    tableNumber: 2,
    role: 'Best Man',
  },
  {
    id: 'gst-6',
    fullName: 'Rohan & Neha Deshmukh',
    email: 'rohan.deshmukh@example.com',
    rsvpStatus: 'Confirmed',
    plusOnes: 1,
    dietary: 'Standard',
    tableNumber: 3,
    role: 'Architecture Studio Partners',
  },
  {
    id: 'gst-7',
    fullName: 'Zoya Khan',
    email: 'zoya.khan@example.com',
    rsvpStatus: 'Confirmed',
    plusOnes: 2,
    dietary: 'Halal/Kosher',
    tableNumber: 3,
    role: 'College Friends',
  },
  {
    id: 'gst-8',
    fullName: 'Siddharth Nair',
    email: 'siddharth.nair@example.com',
    rsvpStatus: 'Confirmed',
    plusOnes: 1,
    dietary: 'Nut-Free',
    tableNumber: null,
    role: 'Unassigned VIP Guest',
  },
  {
    id: 'gst-9',
    fullName: 'Priya Patel & Dev Sharma',
    email: 'priya.patel@example.com',
    rsvpStatus: 'Pending',
    plusOnes: 1,
    dietary: 'Vegan',
    tableNumber: null,
    role: 'Family Friends',
  },
];

export const INITIAL_TRANSACTIONS: PaymentTransaction[] = [
  {
    id: 'tx-seed-1',
    vendorId: 'ven-1',
    vendorName: 'Suryagarh Heritage Estates & Pavilions',
    amount: 1400000,
    escrowFee: 21000,
    totalCharged: 1421000,
    method: 'Escrow Wire',
    timestamp: '2026-10-18T14:20:00Z',
    referenceCode: 'AURA-982KL1',
    status: 'Escrow Protected',
  },
  {
    id: 'tx-seed-2',
    vendorId: 'ven-2',
    vendorName: 'Dastarkhwan Royal Culinary Collective',
    amount: 675000,
    escrowFee: 0,
    totalCharged: 675000,
    method: 'ACH Direct',
    timestamp: '2026-10-25T19:05:00Z',
    referenceCode: 'AURA-441VBN',
    status: 'Settled',
  },
];

export const INITIAL_TIMELINE: TimelineMilestone[] = [
  {
    id: 'ms-1',
    time: '16:00',
    title: 'Sitar Quartet Soundcheck & Courtyard Doors Open',
    owner: 'Lumiere Acoustics',
    locationZone: 'North Courtyard Gate',
    status: 'Completed',
    syncedToCalendar: true,
  },
  {
    id: 'ms-2',
    time: '17:00',
    title: 'Royal Varmala & Golden Hour Mandap Ceremony',
    owner: 'Lead Planner',
    locationZone: 'Ceremonial Mandap Stage',
    status: 'On Track',
    syncedToCalendar: true,
  },
  {
    id: 'ms-3',
    time: '18:30',
    title: 'Sunset High-Tea & Botanical Aperitif Reception',
    owner: 'Dastarkhwan Culinary',
    locationZone: 'East Sandstone Terrace',
    status: 'On Track',
  },
  {
    id: 'ms-4',
    time: '20:00',
    title: 'Seated 7-Course Royal Banquet & Family Toasts',
    owner: 'Maitre D',
    locationZone: 'Main Banquet Floor (Tables 01–08)',
    status: 'On Track',
  },
];

export const INITIAL_COLLABORATOR_FEED: CollaboratorActivity[] = [
  {
    id: 'col-1',
    actor: 'Diya Kapoor (Bride)',
    role: 'Host',
    action: 'Assigned Ananya Verma +1 to Table 02',
    timestamp: '12 mins ago',
  },
  {
    id: 'col-2',
    actor: 'Lead Producer',
    role: 'Planner',
    action: 'Generated Counter-Offer for Atelier Mogra (-₹1,60,000 target reduction)',
    timestamp: '43 mins ago',
    amountDelta: -160000,
  },
  {
    id: 'col-3',
    actor: 'Aarav Singhania (Groom)',
    role: 'Host',
    action: 'Released ₹6,75,000 50% Culinary Deposit via Direct Transfer',
    timestamp: '2 hours ago',
    amountDelta: 675000,
  },
];

export const INITIAL_MOODBOARDS: MoodBoardItem[] = [
  {
    id: 'mb-1',
    title: 'Udaipur Courtyard — Candlelit Sandstone & Mogra Canopy',
    category: 'wedding',
    prompt:
      'Royal Indian courtyard wedding reception at golden hour, sandstone banquet tables with ivory chanderi linen, brass urlis, cascading white mogra and orchids.',
    resolution: '2K',
    aspectRatio: '16:9',
    imageUrl: createArchitecturalMoodSvg(
      'Udaipur Heritage Courtyard',
      '2K Architectural Concept · Sandstone, Ivory Silk & Brass Pin-Spots',
      '#1E293B',
      '#C89D54',
      '#334155',
      'glasshouse'
    ),
    palette: ['#F5F2EB', '#C89D54', '#2D3A2E', '#0F172A'],
    architecturalNotes:
      '2700K warm pin-spots suspended over carved stone arches; low-profile brass urli vessels keep cross-table sightlines unobstructed.',
    createdAt: '2026-11-01',
  },
];

export const CURATED_PUBCHEM_PROFILES: Record<string, PubChemCompoundProfile> = {
  linalool: {
    cid: 6549,
    queryName: 'Linalool',
    title: 'Linalool (Floral Monoterpene Alcohol)',
    iupacName: '3,7-dimethylocta-1,6-dien-3-ol',
    molecularFormula: 'C10H18O',
    molecularWeight: 154.25,
    canonicalSmiles: 'CC(=CCCC(C)(C=C)O)C',
    inchiKey: 'CDOSHBSSFJOMGT-UHFFFAOYSA-N',
    xlogp: 2.9,
    tpsa: 20.2,
    hBondDonorCount: 1,
    hBondAcceptorCount: 1,
    rotatableBondCount: 4,
    eventContextRole: 'Primary aromatic volatile in jasmine, lavender, and coriander floral centerpieces.',
    allergenRiskLevel: 'Moderate Sensitizer',
    ghsHazards: [
      'H315: Causes skin irritation in concentrated essential oil form',
      'H317: Oxidized linalool hydroperoxides may trigger allergic contact dermatitis',
    ],
    cateringFloralGuidance:
      'Keep high-linalool floral arrangements at least 1.0m from open food service; prefer low-volatile Phalaenopsis orchids on dining tables with sensitive guests.',
    provenanceUrl: 'https://pubchem.ncbi.nlm.nih.gov/compound/6549',
    isLivePubChem: false,
  },
  vanillin: {
    cid: 1183,
    queryName: 'Vanillin',
    title: 'Vanillin (Bourbon Vanilla Bean Aldehyde)',
    iupacName: '4-hydroxy-3-methoxybenzaldehyde',
    molecularFormula: 'C8H8O3',
    molecularWeight: 152.15,
    canonicalSmiles: 'COC1=C(C=CC(=C1)C=O)O',
    inchiKey: 'MWOOGOJBHIARFG-UHFFFAOYSA-N',
    xlogp: 1.2,
    tpsa: 46.5,
    hBondDonorCount: 1,
    hBondAcceptorCount: 3,
    rotatableBondCount: 2,
    eventContextRole: 'Signature aromatic compound in celebration tier cakes, kulfi glazes, and ambient scenting.',
    allergenRiskLevel: 'Low / Safe',
    ghsHazards: ['GRAS (Generally Recognized As Safe) at culinary concentrations'],
    cateringFloralGuidance:
      'Safe across all guest dietary profiles (Vegan, Gluten-Free, Nut-Free, Halal/Kosher when alcohol-free carrier is used).',
    provenanceUrl: 'https://pubchem.ncbi.nlm.nih.gov/compound/1183',
    isLivePubChem: false,
  },
  capsaicin: {
    cid: 1548943,
    queryName: 'Capsaicin',
    title: 'Capsaicin (TRPV1 Vanilloid Receptor Agonist)',
    iupacName: '(E)-N-[(4-hydroxy-3-methoxyphenyl)methyl]-8-methylnon-6-enamide',
    molecularFormula: 'C18H27NO3',
    molecularWeight: 305.4,
    canonicalSmiles: 'CC(C)/C=C/CCCCC(=O)NCC1=CC(=C(C=C1)O)OC',
    inchiKey: 'YKPUWZUDDOIDPM-SOFGYWHQSA-N',
    xlogp: 3.6,
    tpsa: 58.6,
    hBondDonorCount: 2,
    hBondAcceptorCount: 3,
    rotatableBondCount: 9,
    eventContextRole: 'Active pungency alkaloid in spiced appetizers and signature chili-mango mocktails.',
    allergenRiskLevel: 'Moderate Sensitizer',
    ghsHazards: [
      'H315/H318: Mucosal and ocular TRPV1 nociceptor activator',
      'Nightshade intolerance trigger for sensitive guests',
    ],
    cateringFloralGuidance:
      'Label spice intensity on buffet cards and keep separate serving tongs from mild/kids appetizers.',
    provenanceUrl: 'https://pubchem.ncbi.nlm.nih.gov/compound/1548943',
    isLivePubChem: false,
  },
  histamine: {
    cid: 774,
    queryName: 'Histamine',
    title: 'Histamine (Biogenic Amine in Aged Ferments)',
    iupacName: '2-(1H-imidazol-5-yl)ethanamine',
    molecularFormula: 'C5H9N3',
    molecularWeight: 111.15,
    canonicalSmiles: 'C1=C(NC=N1)CCN',
    inchiKey: 'NTYJJOPFIAHURM-UHFFFAOYSA-N',
    xlogp: -0.7,
    tpsa: 54.7,
    hBondDonorCount: 2,
    hBondAcceptorCount: 2,
    rotatableBondCount: 2,
    eventContextRole: 'Biogenic amine monitored in aged cheeses, ferments, and seafood stations.',
    allergenRiskLevel: 'High Allergen / Caution',
    ghsHazards: [
      'H317/H334: Vasoactive amine; triggers flushing or headaches in DAO-deficient guests',
    ],
    cateringFloralGuidance:
      'Pair fermented stations with fresh non-alcoholic botanical options and maintain < 4°C cold-chain on raw bars.',
    provenanceUrl: 'https://pubchem.ncbi.nlm.nih.gov/compound/774',
    isLivePubChem: false,
  },
  caffeine: {
    cid: 2519,
    queryName: 'Caffeine',
    title: 'Caffeine (Methylxanthine CNS Stimulant)',
    iupacName: '1,3,7-trimethylpurine-2,6-dione',
    molecularFormula: 'C8H10N4O2',
    molecularWeight: 194.19,
    canonicalSmiles: 'CN1C=NC2=C1C(=O)N(C(=O)N2C)C',
    inchiKey: 'RYYVLZVUVIJVGH-UHFFFAOYSA-N',
    xlogp: -0.1,
    tpsa: 58.4,
    hBondDonorCount: 0,
    hBondAcceptorCount: 3,
    rotatableBondCount: 0,
    eventContextRole: 'Filter coffee, masala chai & espresso bar service after 21:00.',
    allergenRiskLevel: 'Low / Safe',
    ghsHazards: ['Stimulant; offer decaffeinated herbal kahwa for evening reception guests'],
    cateringFloralGuidance:
      'Provide decaf and saffron-almond milk options for late-night dessert service so elderly guests can partake.',
    provenanceUrl: 'https://pubchem.ncbi.nlm.nih.gov/compound/2519',
    isLivePubChem: false,
  },
};
