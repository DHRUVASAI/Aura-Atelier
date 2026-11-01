import test from 'node:test';
import assert from 'node:assert/strict';
import { formatCleanChatReply, parseNaturalLanguageVenueCommand } from './planningLogic';

test('formatCleanChatReply formats chat markdown properly for UI display', () => {
  const input = '### Venue Plan\n\n* **Outdoor Garden**: Selected\n\n`Success`';
  const result = formatCleanChatReply(input);
  assert.equal(result.includes('###'), false);
  assert.equal(result.includes('`'), false);
  assert.ok(result.includes('• Outdoor Garden: Selected'));
});

test('parseNaturalLanguageVenueCommand correctly interprets user voice/chat prompts', () => {
  const cmd = parseNaturalLanguageVenueCommand('switch to outdoor garden in imperial columns layout with emerald linen and add 3 tables');
  assert.ok(cmd);
  assert.equal(cmd?.environmentMode, 'outdoor');
  assert.equal(cmd?.tableLayout, 'imperial-columns');
  assert.equal(cmd?.linenColor, '#0F5132');
  assert.equal(cmd?.addTableCount, 3);
});
