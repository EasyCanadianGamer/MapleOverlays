const { test } = require('node:test');
const assert = require('node:assert/strict');
const { deriveChatRoles } = require('../src/eventsub');

function event(overrides = {}) {
  return {
    broadcaster_user_id: 'b1',
    chatter_user_id:     'c1',
    badges:              [],
    ...overrides,
  };
}

test('deriveChatRoles: plain viewer gets no roles', () => {
  assert.deepEqual(deriveChatRoles(event()), {
    isSubscriber: false, isVip: false, isModerator: false, isBroadcaster: false,
  });
});

test('deriveChatRoles: chatter_user_id === broadcaster_user_id is the broadcaster', () => {
  const result = deriveChatRoles(event({ chatter_user_id: 'b1' }));
  assert.equal(result.isBroadcaster, true);
  assert.equal(result.isModerator, true); // broadcaster is always their own moderator
});

test('deriveChatRoles: moderator badge sets isModerator', () => {
  const result = deriveChatRoles(event({ badges: [{ set_id: 'moderator', id: '1' }] }));
  assert.equal(result.isModerator, true);
  assert.equal(result.isBroadcaster, false);
});

test('deriveChatRoles: vip badge sets isVip only', () => {
  const result = deriveChatRoles(event({ badges: [{ set_id: 'vip', id: '1' }] }));
  assert.equal(result.isVip, true);
  assert.equal(result.isModerator, false);
});

test('deriveChatRoles: subscriber badge sets isSubscriber', () => {
  const result = deriveChatRoles(event({ badges: [{ set_id: 'subscriber', id: '12' }] }));
  assert.equal(result.isSubscriber, true);
});

test('deriveChatRoles: founder badge also counts as subscriber', () => {
  const result = deriveChatRoles(event({ badges: [{ set_id: 'founder', id: '0' }] }));
  assert.equal(result.isSubscriber, true);
});

test('deriveChatRoles: missing badges array defaults everything false (except broadcaster check)', () => {
  const result = deriveChatRoles(event({ badges: undefined }));
  assert.deepEqual(result, { isSubscriber: false, isVip: false, isModerator: false, isBroadcaster: false });
});
