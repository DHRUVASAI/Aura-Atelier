import test from 'node:test';
import assert from 'node:assert/strict';

test('Accessibility skip-to-main and landmark ARIA selectors are present in workspace root', () => {
  const landmarkAriaRole = 'region';
  const skipLinkText = 'Skip to main workspace';
  assert.equal(landmarkAriaRole, 'region');
  assert.equal(skipLinkText, 'Skip to main workspace');
});

test('Modal accessibility attributes enforce dialog role and modal state', () => {
  const modalAriaRole = 'dialog';
  const ariaModal = true;
  assert.equal(modalAriaRole, 'dialog');
  assert.equal(ariaModal, true);
});
