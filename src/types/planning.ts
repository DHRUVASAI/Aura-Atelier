export type EventCategory = 'wedding' | 'birthday' | 'community';

export type VenueEnvironmentMode = 'outdoor' | 'indoor' | 'conservatory';

export type TableArrangementLayout =
  | 'banquet-radial'
  | 'royal-u-shape'
  | 'imperial-columns'
  | 'cabaret-cluster'
  | 'custom';

export type StageBackdropStyle = 'floral-mandap' | 'royal-velvet' | 'minimal-arch';

export type LightingAtmosphere =
  | 'sunset-warmth'
  | 'midnight-gala'
  | 'daylight-crisp'
  | 'golden'
  | 'candlelight'
  | 'daylight'
  | 'twilight';

export interface EventPreset {
  id: string;
  name: string;
  category: EventCategory;
  date: string;
  venueName: string;
  guestCountTarget: number;
  totalBudgetCap: number;
  themeTitle: string;
  themeSubtitle: string;
  linenColor: string;
  accentHex: string;
  floorColor?: string;
  environmentMode?: VenueEnvironmentMode;
  tableLayout?: TableArrangementLayout;
  stageStyle?: StageBackdropStyle;
  lightingMode: LightingAtmosphere;
  lightIntensity?: number;
  tableCount: number;
  seatsPerTable: number;
  isSample?: boolean;
}

export interface VenueMutationCommand {
  environmentMode?: VenueEnvironmentMode;
  tableLayout?: TableArrangementLayout;
  linenColor?: string;
  accentHex?: string;
  floorColor?: string;
  stageStyle?: StageBackdropStyle;
  lightingMode?: LightingAtmosphere;
  lightIntensity?: number;
  addTableCount?: number;
  removeTableCount?: number;
  moveTable?: { tableNumber: number; x: number; z: number };
  summaryLabel?: string;
}

export interface BudgetLineItem {
  id: string;
  category:
    | 'Venue & Architecture'
    | 'Culinary & Beverage'
    | 'Floral & Botanicals'
    | 'Production & Audio'
    | 'Attire & Styling'
    | 'Photography & Cinema';
  title: string;
  allocated: number;
  spent: number;
  vendorId?: string;
  notes: string;
  priority: 'essential' | 'elevated' | 'flexible';
}

export interface VendorChecklistItem {
  id: string;
  task: string;
  completed: boolean;
  dueDate: string;
}

export interface VendorRecord {
  id: string;
  name: string;
  category: string;
  contactEmail: string;
  quotedAmount: number;
  negotiatedTarget: number;
  paidAmount: number;
  status: 'Quoted' | 'Negotiating' | 'Contracted' | 'Deposit Paid' | 'Paid in Full';
  rating: number;
  leverageNotes: string[];
  checklist: VendorChecklistItem[];
}

export interface PaymentTransaction {
  id: string;
  vendorId: string;
  vendorName: string;
  amount: number;
  escrowFee: number;
  totalCharged: number;
  method: 'Escrow Wire' | 'Corporate Card' | 'ACH Direct';
  timestamp: string;
  referenceCode: string;
  status: 'Settled' | 'Escrow Protected';
}

export interface GuestRecord {
  id: string;
  fullName: string;
  email: string;
  rsvpStatus: 'Confirmed' | 'Pending' | 'Declined';
  plusOnes: number;
  dietary: 'Standard' | 'Vegan' | 'Gluten-Free' | 'Nut-Free' | 'Halal/Kosher';
  tableNumber: number | null; // null if unassigned
  role: string;
}

export interface SeatingTable {
  tableNumber: number;
  label: string;
  capacity: number;
  zone: 'Head Table' | 'VIP Garden' | 'West Pavilion' | 'East Terrace';
  x: number;
  z: number;
}

export interface TimelineMilestone {
  id: string;
  time: string;
  title: string;
  owner: string;
  locationZone: string;
  status: 'Completed' | 'On Track' | 'At Risk';
  syncedToCalendar?: boolean;
}

export interface CollaboratorActivity {
  id: string;
  actor: string;
  role: string;
  action: string;
  timestamp: string;
  amountDelta?: number;
}

export interface MoodBoardItem {
  id: string;
  title: string;
  category: EventCategory;
  prompt: string;
  resolution: '1K' | '2K' | '4K';
  aspectRatio: '16:9' | '4:3' | '1:1';
  imageUrl: string;
  palette: string[];
  architecturalNotes: string;
  createdAt: string;
}

export interface PubChemCompoundProfile {
  cid: number;
  queryName: string;
  title: string;
  iupacName: string;
  molecularFormula: string;
  molecularWeight: number;
  canonicalSmiles: string;
  inchiKey: string;
  xlogp: number;
  tpsa: number;
  hBondDonorCount: number;
  hBondAcceptorCount: number;
  rotatableBondCount: number;
  eventContextRole: string;
  allergenRiskLevel: 'Low / Safe' | 'Moderate Sensitizer' | 'High Allergen / Caution';
  ghsHazards: string[];
  cateringFloralGuidance: string;
  provenanceUrl: string;
  isLivePubChem: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  appliedVenueChange?: string;
}
