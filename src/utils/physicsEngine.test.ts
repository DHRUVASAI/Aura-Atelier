import test from 'node:test';
import assert from 'node:assert/strict';
import { VenueCannonPhysicsSimulator, evaluateArSpaceValidation } from './physicsEngine';
import { SeatingTable } from '../types/planning';

test('evaluateArSpaceValidation detects collision warning and calculates overlapping bounding circles', () => {
  const tables: SeatingTable[] = [
    { tableNumber: 1, label: 'Table 1', capacity: 8, zone: 'Head Table', x: 0, z: 0 },
    { tableNumber: 2, label: 'Table 2', capacity: 8, zone: 'VIP Garden', x: 0.8, z: 0.5 },
  ];
  const validation = evaluateArSpaceValidation(tables);
  assert.equal(validation.validationStatus, 'Collision Warning');
  assert.ok(validation.collisionCount >= 1);
});

test('VenueCannonPhysicsSimulator correctly resolves overlapping collisions with spring forces', () => {
  const tables: SeatingTable[] = [
    { tableNumber: 1, label: 'Table 1', capacity: 8, zone: 'Head Table', x: 0, z: 0 },
    { tableNumber: 2, label: 'Table 2', capacity: 8, zone: 'VIP Garden', x: 0.5, z: 0 },
  ];
  const sim = new VenueCannonPhysicsSimulator(tables, 2.0);
  let state = sim.step(0.016);
  for (let i = 0; i < 60; i++) {
    state = sim.step(0.016);
  }
  const t1 = state.states.find((s) => s.tableNumber === 1)!;
  const t2 = state.states.find((s) => s.tableNumber === 2)!;
  const finalDist = Math.hypot(t2.x - t1.x, t2.z - t1.z);
  assert.ok(finalDist >= 2.8);
  assert.ok(sim.totalCollisionEvents > 0);
});
