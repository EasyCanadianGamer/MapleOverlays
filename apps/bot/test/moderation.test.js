const { test } = require('node:test');
const assert = require('node:assert/strict');
const { isExcessiveCaps } = require('../src/moderation');

test('flags a long keyboard-mash caps message', () => {
  assert.equal(isExcessiveCaps('AAAAAAAAAAAAAAAAAAAA'), true);
});

test('does not flag a short caps burst under the length floor', () => {
  assert.equal(isExcessiveCaps('LOL WOW'), false);
});

test('does not flag mixed-case sentences with occasional caps words', () => {
  assert.equal(isExcessiveCaps('that was a REALLY nice play honestly'), false);
});

test('does not flag lowercase messages', () => {
  assert.equal(isExcessiveCaps('this message is totally normal and long enough'), false);
});

test('flags a long, fully-uppercase sentence (still reads as shouting)', () => {
  assert.equal(isExcessiveCaps('THAT IS A COMPLETELY DIFFERENT SKIN TONE AND THE NOSE IS DIFFERENT'), true);
});

test('does not flag a message right at the 15-letter floor with 80% caps (below new 85% threshold)', () => {
  // 15 letters, 12 upper -> 80%, should no longer trip at the raised threshold
  assert.equal(isExcessiveCaps('AAAAAAAAAAAAbcd'), false);
});
