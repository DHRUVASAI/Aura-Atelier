import test from 'node:test';
import assert from 'node:assert/strict';
import { computeTableLayoutCoordinates } from './planningLogic';
import { SeatingTable } from '../types/planning';

test('computeTableLayoutCoordinates computes radial amphitheater layout without overlapping', () => {
  const tables: SeatingTable[] = [
    { tableNumber: 1, label: 'Table 1', capacity: 8, zone: 'Head Table', x: 0, z: 0 },
    { tableNumber: 2, label: 'Table 2', capacity: 8, zone: 'VIP Garden', x: 0, z: 0 },
    { tableNumber: 3, label: 'Table 3', capacity: 8, zone: 'VIP Garden', x: 0, z: 0 },
  ];
  const layout = computeTableLayoutCoordinates(tables, 'banquet-radial');
  assert.equal(layout.length, 3);
  assert.equal(layout[0].zone, 'Head Table');
  assert.ok(layout[1].z !== 0 || layout[1].x !== 0);
});

test('computeTableLayoutCoordinates computes royal U-shape formation', () => {
  const tables: SeatingTable[] = [
    { tableNumber: 1, label: 'Table 1', capacity: 8, zone: 'Head Table', x: 0, z: 0 },
    { tableNumber: 2, label: 'Table 2', capacity: 8, zone: 'VIP Garden', x: 0, z: 0 },
    { tableNumber: 3, label: 'Table 3', capacity: 8, zone: 'VIP Garden', x: 0, z: 0 },
  ];
  const layout = computeTableLayoutCoordinates(tables, 'royal-u-shape');
  assert.equal(layout.length, 3);
  assert.equal(layout[0].x, 0);
  assert.ok(layout[1].x < 0);
  assert.ok(layout[2].x > 0);
});
