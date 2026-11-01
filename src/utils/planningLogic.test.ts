import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assignGuestToTableSafe,
  calculateBudgetMetrics,
  calculateSeatingMetrics,
  computeLightingAtmosphereProfile,
  computeTableLayoutCoordinates,
  evaluateCompoundSafety,
  evaluateEventReadiness,
  formatCleanChatReply,
  formatINR,
  generateCounterOffer,
  generateGuestSeatingQrPass,
  optimizeBudgetAllocation,
  parseNaturalLanguageVenueCommand,
  processVendorPayment,
  sanitizeInputText,
} from './planningLogic';
import { BudgetLineItem, GuestRecord, SeatingTable, VendorRecord } from '../types/planning';
import {
  computeOpeningCameraPose,
  computeOpeningModuleTargets,
} from './openingAnimationEngine';

test('formatINR formats amounts in Indian Rupees with Indian numbering system', () => {
  assert.equal(formatINR(4500000), '₹45,00,000');
  assert.equal(formatINR(150000), '₹1,50,000');
});

test('calculateBudgetMetrics accurately totals allocation, spend, and over-budget categories', () => {
  const items: BudgetLineItem[] = [
    {
      id: 'b1',
      category: 'Venue & Architecture',
      title: 'Royal Palace Courtyard Buyout',
      allocated: 1800000,
      spent: 1800000,
      notes: 'Paid deposit + final',
      priority: 'essential',
    },
    {
      id: 'b2',
      category: 'Floral & Botanicals',
      title: 'Hanging Jasmine & Orchid Canopy',
      allocated: 600000,
      spent: 680000,
      notes: 'Added aisle plinths',
      priority: 'elevated',
    },
  ];

  const metrics = calculateBudgetMetrics(items, 3000000);
  assert.equal(metrics.totalAllocated, 2400000);
  assert.equal(metrics.totalSpent, 2480000);
  assert.equal(metrics.remainingToAllocate, 600000);
  assert.equal(metrics.remainingCashBuffer, 520000);
  assert.deepEqual(metrics.overBudgetCategories, ['Floral & Botanicals']);
  assert.equal(metrics.healthStatus, 'Watch');
});

test('optimizeBudgetAllocation covers over-spent items and trims flexible slack in INR', () => {
  const items: BudgetLineItem[] = [
    {
      id: 'b1',
      category: 'Floral & Botanicals',
      title: 'Botanical Arch',
      allocated: 400000,
      spent: 450000,
      notes: '',
      priority: 'essential',
    },
    {
      id: 'b2',
      category: 'Attire & Styling',
      title: 'Custom Lounge Pillows',
      allocated: 500000,
      spent: 100000,
      notes: '',
      priority: 'flexible',
    },
  ];

  const res = optimizeBudgetAllocation(items, 1200000);
  assert.equal(res.updatedItems[0].allocated, 455000);
  assert.ok(res.updatedItems[1].allocated < 500000);
  assert.ok(res.recommendations[0].includes('₹'));
});

test('calculateSeatingMetrics and assignGuestToTableSafe enforce capacity and RSVP rules', () => {
  const tables: SeatingTable[] = [
    { tableNumber: 1, label: 'Head Table', capacity: 4, zone: 'Head Table', x: 0, z: 0 },
    { tableNumber: 2, label: 'Orchid Grove', capacity: 8, zone: 'VIP Garden', x: 4, z: 2 },
  ];
  const guests: GuestRecord[] = [
    {
      id: 'g1',
      fullName: 'Ananya Verma',
      email: 'ananya@example.com',
      rsvpStatus: 'Confirmed',
      plusOnes: 2,
      dietary: 'Vegan',
      tableNumber: 1,
      role: 'Bride Sister',
    },
    {
      id: 'g2',
      fullName: 'Rohan Malhotra',
      email: 'rohan@example.com',
      rsvpStatus: 'Confirmed',
      plusOnes: 1,
      dietary: 'Standard',
      tableNumber: null,
      role: 'College Friend',
    },
  ];

  const metrics = calculateSeatingMetrics(guests, tables);
  assert.equal(metrics.confirmedGuests, 5);
  assert.equal(metrics.seatedHeadcount, 3);
  assert.equal(metrics.unassignedHeadcount, 2);

  const overflowAttempt = assignGuestToTableSafe(guests, tables, 'g2', 1);
  assert.equal(overflowAttempt.ok, false);

  const validAttempt = assignGuestToTableSafe(guests, tables, 'g2', 2);
  assert.equal(validAttempt.ok, true);
  assert.equal(validAttempt.updatedGuests.find((g) => g.id === 'g2')?.tableNumber, 2);
});

test('generateCounterOffer and processVendorPayment compute accurate financials in INR', () => {
  const vendor: VendorRecord = {
    id: 'v1',
    name: 'Lumiere Acoustic & Lighting',
    category: 'Production & Audio',
    contactEmail: 'bookings@lumiere.example.com',
    quotedAmount: 1000000,
    negotiatedTarget: 850000,
    paidAmount: 200000,
    status: 'Negotiating',
    rating: 4.9,
    leverageNotes: ['Weekday Thursday load-in', 'Full upfront 50% escrow deposit'],
    checklist: [],
  };

  const offer = generateCounterOffer(vendor, 'Aarav & Diya Royal Wedding');
  assert.equal(offer.projectedSavings, 150000);
  assert.equal(offer.savingsPercent, 15);
  assert.ok(offer.emailBody.includes('₹'));

  const payment = processVendorPayment(vendor, 300000, 'Escrow Wire');
  assert.equal(payment.ok, true);
  assert.equal(payment.updatedVendor?.paidAmount, 500000);
  assert.equal(payment.updatedVendor?.status, 'Deposit Paid');
  assert.equal(payment.transaction?.escrowFee, 4500);
});

test('evaluateCompoundSafety classifies volatility and Lipinski rules accurately', () => {
  const linaloolEval = evaluateCompoundSafety({
    molecularWeight: 154.25,
    xlogp: 2.9,
    tpsa: 20.2,
    hBondDonorCount: 1,
    hBondAcceptorCount: 1,
    ghsHazards: ['H317: May cause an allergic skin reaction (Sensitizer)'],
  });

  assert.equal(linaloolEval.volatilityClass, 'High Aroma Volatility');
  assert.equal(linaloolEval.lipinskiCompliant, true);
  assert.ok(linaloolEval.safetySummary.includes('sensitizer/irritant'));
});

test('sanitizeInputText strips XSS scripts, angle brackets, and clamps length', () => {
  const raw = '  <script>alert(1)</script>Botanical <b>Orchid</b> & javascript:void(0)  ';
  const cleaned = sanitizeInputText(raw, 60);
  assert.equal(cleaned.includes('<script>'), false);
  assert.equal(cleaned.includes('<'), false);
  assert.equal(cleaned.includes('javascript:'), false);
  assert.ok(cleaned.includes('Botanical Orchid'));
});

test('evaluateEventReadiness dynamically prioritizes budget overrun then unseated guests', () => {
  const tables: SeatingTable[] = [
    { tableNumber: 1, label: 'Head Table', capacity: 8, zone: 'Head Table', x: 0, z: 0 },
  ];
  const guests: GuestRecord[] = [
    {
      id: 'g1',
      fullName: 'Aria Chen',
      email: 'aria@example.com',
      rsvpStatus: 'Confirmed',
      plusOnes: 1,
      dietary: 'Nut-Free',
      tableNumber: null,
      role: 'VIP Guest',
    },
  ];
  const vendors: VendorRecord[] = [];
  const overBudgetItems: BudgetLineItem[] = [
    {
      id: 'b1',
      category: 'Floral & Botanicals',
      title: 'Orchid Canopy',
      allocated: 500000,
      spent: 620000,
      notes: '',
      priority: 'elevated',
    },
  ];

  const decision1 = evaluateEventReadiness(
    { name: 'Test Gala', totalBudgetCap: 2500000 },
    overBudgetItems,
    vendors,
    guests,
    tables
  );
  assert.equal(decision1.targetSection, 'budget-payments');
  assert.equal(decision1.dietaryAdvisoryCount, 2);

  const balancedItems: BudgetLineItem[] = [{ ...overBudgetItems[0], allocated: 700000 }];
  const decision2 = evaluateEventReadiness(
    { name: 'Test Gala', totalBudgetCap: 2500000 },
    balancedItems,
    vendors,
    guests,
    tables
  );
  assert.equal(decision2.targetSection, 'rsvp-modal');
  assert.ok(decision2.nextBestActionLabel.includes('Seat 2 Unassigned Guests'));
});

test('computeTableLayoutCoordinates and parseNaturalLanguageVenueCommand handle spatial arrangements and chat commands', () => {
  const baseTables: SeatingTable[] = [
    { tableNumber: 1, label: 'Table 01', capacity: 8, zone: 'Head Table', x: 0, z: 0 },
    { tableNumber: 2, label: 'Table 02', capacity: 8, zone: 'VIP Garden', x: 0, z: 0 },
    { tableNumber: 3, label: 'Table 03', capacity: 8, zone: 'VIP Garden', x: 0, z: 0 },
  ];
  const uShape = computeTableLayoutCoordinates(baseTables, 'royal-u-shape');
  assert.equal(uShape[0].x, 0);
  assert.ok(uShape[1].x < 0);
  assert.ok(uShape[2].x > 0);

  const parsed = parseNaturalLanguageVenueCommand(
    'Please switch to an outdoor garden in U-shape layout with emerald green linen and add 2 tables'
  );
  assert.ok(parsed);
  assert.equal(parsed?.environmentMode, 'outdoor');
  assert.equal(parsed?.tableLayout, 'royal-u-shape');
  assert.equal(parsed?.linenColor, '#0F5132');
  assert.equal(parsed?.addTableCount, 2);
});

test('VenueCannonPhysicsSimulator resolves overlapping table collisions and gravity drop placement', async () => {
  const { VenueCannonPhysicsSimulator, evaluateArSpaceValidation } = await import('./physicsEngine');
  const overlappingTables: SeatingTable[] = [
    { tableNumber: 1, label: 'Table 01', capacity: 8, zone: 'Head Table', x: 0, z: 0 },
    { tableNumber: 2, label: 'Table 02', capacity: 8, zone: 'VIP Garden', x: 1.0, z: 0 },
  ];

  // Check AR space validation detects tight/collision state before physics separation
  const initialValidation = evaluateArSpaceValidation(overlappingTables);
  assert.equal(initialValidation.validationStatus, 'Collision Warning');
  assert.ok(initialValidation.collisionCount >= 1);

  // Initialize simulator with elevated gravity drop height (3.5m)
  const sim = new VenueCannonPhysicsSimulator(overlappingTables, 3.5);
  let lastResult = sim.step(0.016);
  assert.ok(lastResult.states[0].y > 1.0); // Elevated above ground initially

  for (let i = 0; i < 90; i++) {
    lastResult = sim.step(0.016);
  }

  const t1 = lastResult.states.find((s) => s.tableNumber === 1)!;
  const t2 = lastResult.states.find((s) => s.tableNumber === 2)!;
  const separatedDist = Math.hypot(t2.x - t1.x, t2.z - t1.z);

  // Tables should have separated horizontally (>= 2.85m for 1.45m radius cylinders) and settled onto the floor (y ~ 0)
  assert.ok(separatedDist >= 2.85);
  assert.ok(t1.y <= 0.15);
  assert.ok(sim.totalCollisionEvents > 0);
});

test('formatCleanChatReply removes all ***, **, * and markdown formatting from chat replies', () => {
  const raw =
    'Namaste! I am connected to **Sample: Aarav & Diya — Udaipur Courtyard Wedding**.\n\n* **Spatial Sightlines**: Switch to *"Outdoor Garden"* or ***Midnight Gala***!';
  const cleaned = formatCleanChatReply(raw);
  assert.equal(cleaned.includes('*'), false);
  assert.ok(cleaned.includes('Sample: Aarav & Diya — Udaipur Courtyard Wedding'));
  assert.ok(cleaned.includes('• Spatial Sightlines: Switch to "Outdoor Garden" or Midnight Gala!'));
});

test('computeLightingAtmosphereProfile computes Sunset Warmth, Midnight Gala, and Daylight Crisp with light intensity scaling', () => {
  const sunset100 = computeLightingAtmosphereProfile('sunset-warmth', 1.0, 'outdoor');
  const sunset150 = computeLightingAtmosphereProfile('sunset-warmth', 1.5, 'outdoor');
  const midnight = computeLightingAtmosphereProfile('midnight-gala', 1.0, 'indoor');
  const daylight = computeLightingAtmosphereProfile('daylight-crisp', 1.2, 'conservatory');

  assert.equal(sunset100.label, 'Sunset Warmth');
  assert.equal(sunset150.intensityPercent, 150);
  assert.ok(sunset150.keyLightIntensity > sunset100.keyLightIntensity);
  assert.equal(midnight.label, 'Midnight Gala');
  assert.equal(daylight.label, 'Daylight Crisp');
  assert.equal(daylight.intensityPercent, 120);
});

test('generateGuestSeatingQrPass creates unique 21x21 QR matrix, verification code, and mobile zone map pins', () => {
  const tables: SeatingTable[] = [
    { tableNumber: 1, label: 'Table 01 · Head Table', capacity: 8, zone: 'Head Table', x: 0, z: -3.4 },
    { tableNumber: 2, label: 'Table 02 · Royal Dining', capacity: 8, zone: 'VIP Garden', x: 5.2, z: 2.4 },
  ];
  const guest1: GuestRecord = {
    id: 'gst-1',
    fullName: 'Aarav Singhania & Diya Kapoor',
    email: 'aarav@example.com',
    rsvpStatus: 'Confirmed',
    plusOnes: 1,
    dietary: 'Standard',
    tableNumber: 1,
    role: 'Couple of Honor',
  };
  const guest2: GuestRecord = {
    id: 'gst-4',
    fullName: 'Ananya Verma',
    email: 'ananya@example.com',
    rsvpStatus: 'Confirmed',
    plusOnes: 1,
    dietary: 'Vegan',
    tableNumber: 2,
    role: 'Sister of Bride',
  };

  const pass1 = generateGuestSeatingQrPass(guest1, tables, 'Udaipur Wedding', 'Suryagarh Courtyard');
  const pass2 = generateGuestSeatingQrPass(guest2, tables, 'Udaipur Wedding', 'Suryagarh Courtyard');

  assert.equal(pass1.qrMatrix.length, 21);
  assert.equal(pass1.qrMatrix[0].length, 21);
  assert.notEqual(pass1.verificationCode, pass2.verificationCode);
  assert.notEqual(pass1.shareUrl, pass2.shareUrl);
  assert.equal(pass1.assignedZone, 'Head Table');
  assert.equal(pass2.assignedZone, 'VIP Garden');
  assert.equal(pass1.mapPins.find((p) => p.tableNumber === 1)?.isAssignedTable, true);
  assert.equal(pass2.mapPins.find((p) => p.tableNumber === 2)?.isAssignedTable, true);
});

test('computeOpeningModuleTargets generates 14 distinct 3D module transforms across assemble, exploded, vortex, and hyperdrive modes', () => {
  const assembled = computeOpeningModuleTargets('assemble', 0, 1.5);
  const exploded = computeOpeningModuleTargets('exploded', 1.0, 1.5);
  const vortex = computeOpeningModuleTargets('vortex', 0.4, 2.0);
  const hyperdrive = computeOpeningModuleTargets('hyperdrive', 0.5, 3.0);

  assert.equal(assembled.length, 14);
  assert.equal(exploded.length, 14);
  assert.equal(vortex.length, 14);
  assert.equal(hyperdrive.length, 14);

  const mandapAssembled = assembled.find((m) => m.id === 'mandap-core')!;
  const mandapExploded = exploded.find((m) => m.id === 'mandap-core')!;
  assert.ok(
    mandapExploded.position[1] > mandapAssembled.position[1],
    'Exploded mode elevates the Royal Mandap sanctuary vertically'
  );

  const poseDefault = computeOpeningCameraPose('assemble', 0, 0, 0.2, 1.0);
  const poseWarp = computeOpeningCameraPose('hyperdrive', 0.5, -0.5, 0.8, 1.0);
  assert.equal(poseDefault.fov, 45);
  assert.equal(poseWarp.fov, 62);
});

test('computeSimpleOpeningTimeline smoothly interpolates 3.2s opening intro from 0% to 100% auto-complete', async () => {
  const { computeSimpleOpeningTimeline } = await import('./openingAnimationEngine');
  const start = computeSimpleOpeningTimeline(0, 3.2);
  const mid = computeSimpleOpeningTimeline(1.6, 3.2);
  const done = computeSimpleOpeningTimeline(3.2, 3.2);

  assert.equal(start.progressPercent, 0);
  assert.equal(start.isComplete, false);
  assert.equal(mid.progressPercent, 50);
  assert.ok(mid.archRiseY > start.archRiseY);
  assert.ok(mid.cameraZ < start.cameraZ);
  assert.equal(done.progressPercent, 100);
  assert.equal(done.isComplete, true);
  assert.equal(done.archRiseY, 0);
});

test('GOOGLE_FLOW_PROMPTS and computeVideoOpeningProgress provide valid 16:9 prompts and synchronized Aura Atelier title reveal states', async () => {
  const {
    GOOGLE_FLOW_PROMPTS,
    DEFAULT_GOOGLE_FLOW_VIDEO_PATH,
    computeVideoOpeningProgress,
  } = await import('./openingAnimationEngine');
  assert.equal(GOOGLE_FLOW_PROMPTS.length, 3);
  assert.ok(GOOGLE_FLOW_PROMPTS[0].prompt.includes('AURA ATELIER'));
  assert.equal(GOOGLE_FLOW_PROMPTS[0].aspectRatio, '16:9');
  assert.ok(DEFAULT_GOOGLE_FLOW_VIDEO_PATH.includes('Camera_gliding_into_botanical'));

  const pStart = computeVideoOpeningProgress(0.5, 9.0);
  const pMid = computeVideoOpeningProgress(4.5, 9.0);
  const pEnd = computeVideoOpeningProgress(9.0, 9.0);

  assert.equal(pStart.isComplete, false);
  assert.equal(pStart.lightingBadge, 'SUNSET WARMTH');
  assert.equal(pMid.progressPercent, 50);
  assert.equal(pMid.phaseLabel, 'Aligning 3D Spatial Architecture');
  assert.equal(pMid.lightingBadge, 'TWILIGHT MORPH');
  assert.equal(pMid.titleOpacity, 1);
  assert.equal(pEnd.progressPercent, 100);
  assert.equal(pEnd.lightingBadge, 'MIDNIGHT GALA');
  assert.equal(pEnd.isComplete, true);
});






