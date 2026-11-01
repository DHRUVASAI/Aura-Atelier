import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../server';

test('GET /api/health returns ok status', async () => {
  const res = await request(app).get('/api/health');
  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'ok');
  assert.equal(res.body.service, 'Aura Atelier Engine');
});

test('GET /api/science/pubchem/linalool returns valid compound profile', async () => {
  const res = await request(app).get('/api/science/pubchem/linalool');
  assert.equal(res.status, 200);
  assert.equal(res.body.title, 'Linalool');
  assert.equal(res.body.molecularWeight, 154.25);
  assert.equal(res.body.molecularFormula, 'C10H18O');
});
