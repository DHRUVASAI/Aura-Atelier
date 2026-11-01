import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateEventReadiness, calculateBudgetMetrics } from './planningLogic';
import { BudgetLineItem, GuestRecord, SeatingTable, VendorRecord } from '../types/planning';

test('evaluateEventReadiness computes correct readiness score and recommended action when budget is optimal', () => {
  const preset = { name: 'Aarav & Diya Udaipur Wedding', totalBudgetCap: 4500000 };
  const budgetItems: BudgetLineItem[] = [
    {
      id: 'b1',
      category: 'Venue & Architecture',
      title: 'Palace Courtyard Buyout',
      allocated: 1800000,
      spent: 1800000,
      notes: 'Paid',
      priority: 'essential',
    },
  ];
  const vendors: VendorRecord[] = [
    {
      id: 'v1',
      name: 'Lumiere Acoustics',
      category: 'Production & Audio',
      contactEmail: 'lumiere@example.com',
      quotedAmount: 1000000,
      negotiatedTarget: 850000,
      paidAmount: 850000,
      status: 'Paid in Full',
      rating: 4.9,
      leverageNotes: ['Early deposit'],
      checklist: [{ id: 'c1', task: 'Load-in schedule', completed: true, dueDate: '2026-11-01' }],
    },
  ];
  const guests: GuestRecord[] = [
    {
      id: 'g1',
      fullName: 'Ananya Verma',
      email: 'ananya@example.com',
      rsvpStatus: 'Confirmed',
      plusOnes: 1,
      dietary: 'Vegan',
      tableNumber: 1,
      role: 'Bridesmaid',
    },
  ];
  const tables: SeatingTable[] = [
    { tableNumber: 1, label: 'Table 1', capacity: 8, zone: 'Head Table', x: 0, z: 0 },
  ];

  const decision = evaluateEventReadiness(preset, budgetItems, vendors, guests, tables);
  assert.equal(decision.statusLabel, 'Production Ready');
  assert.ok(decision.readinessScore >= 85);
  assert.equal(decision.dietaryAdvisoryCount, 2);
});

test('calculateBudgetMetrics accurately computes utilization percentage and cash buffer', () => {
  const items: BudgetLineItem[] = [
    {
      id: 'b1',
      category: 'Culinary & Beverage',
      title: 'Royal Feast',
      allocated: 1500000,
      spent: 1400000,
      notes: '',
      priority: 'essential',
    },
  ];
  const metrics = calculateBudgetMetrics(items, 3000000);
  assert.equal(metrics.totalAllocated, 1500000);
  assert.equal(metrics.totalSpent, 1400000);
  assert.equal(metrics.remainingCashBuffer, 1600000);
  assert.equal(metrics.utilizationPercent, 46.7);
  assert.equal(metrics.healthStatus, 'Optimal');
});
