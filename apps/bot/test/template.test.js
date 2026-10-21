const { test } = require('node:test');
const assert = require('node:assert/strict');
const { resolveTemplate } = require('../src/template');

// Mock DB pool — simulates command_configs.count = 4, then 5 after increment
function makeMockDb(returnCount) {
  return {
    query: async (_sql, _params) => ({ rows: [{ count: returnCount }] }),
  };
}

test('{count} increments and returns the new count', async () => {
  const db = makeMockDb(5);
  const result = await resolveTemplate(
    'Deaths: {count}',
    { broadcasterId: 'ch1', command: 'deaths' },
    { db }
  );
  assert.equal(result, 'Deaths: 5');
});

test('{count} returns 0 when command is missing from ctx', async () => {
  const db = { query: async () => ({ rows: [] }) };
  const result = await resolveTemplate(
    'Count: {count}',
    { broadcasterId: 'ch1' },
    { db }
  );
  assert.equal(result, 'Count: 0');
});

test('{getcount deaths} reads another command count without incrementing', async () => {
  const db = makeMockDb(14);
  const result = await resolveTemplate(
    'Total deaths: {getcount deaths}',
    { broadcasterId: 'ch1', command: 'othercommand' },
    { db }
  );
  assert.equal(result, 'Total deaths: 14');
});

test('{getcount unknown} returns 0 when command not found', async () => {
  const db = { query: async () => ({ rows: [] }) };
  const result = await resolveTemplate(
    'Value: {getcount nope}',
    { broadcasterId: 'ch1', command: 'x' },
    { db }
  );
  assert.equal(result, 'Value: 0');
});

test('template with no counter variables is unaffected', async () => {
  const db = { query: async () => { throw new Error('should not query'); } };
  const result = await resolveTemplate(
    'Hello {user}!',
    { broadcasterId: 'ch1', command: 'hi', chatterLogin: 'alice' },
    { db }
  );
  assert.equal(result, 'Hello alice!');
});

test('{1.count} increments and returns the new count for a given target', async () => {
  const db = { query: async (_sql, _params) => ({ rows: [{ count: 3 }] }) };
  const result = await resolveTemplate(
    '{user} has hugged {1} {1.count} times',
    { broadcasterId: 'c1', command: 'hug', chatterLogin: 'dave', arg: 'alice' },
    { db }
  );
  assert.equal(result, 'dave has hugged alice 3 times');
});

test('{1.count} returns 0 when arg is empty', async () => {
  let queryCalled = false;
  const db = { query: async () => { queryCalled = true; return { rows: [] }; } };
  const result = await resolveTemplate(
    '{1.count} hits',
    { broadcasterId: 'c1', command: 'hug', arg: '' },
    { db }
  );
  assert.equal(result, '0 hits');
  assert.equal(queryCalled, false);
});

test('{1.count} is not resolved when template does not contain it', async () => {
  let upsertCalled = false;
  const db = {
    query: async (sql, _params) => {
      if (sql.includes('command_target_counts')) upsertCalled = true;
      return { rows: [{ count: 1 }] };
    },
  };
  const result = await resolveTemplate(
    'hello {user}',
    { broadcasterId: 'c1', command: 'hug', chatterLogin: 'alice' },
    { db }
  );
  assert.equal(result, 'hello alice');
  assert.equal(upsertCalled, false);
});
