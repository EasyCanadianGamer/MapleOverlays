'use strict';

// Runs fn(client) inside a transaction that holds a per-user advisory lock.
// The overlay and font caps count rows and then insert; without the lock two
// requests at once both count under the cap and both insert. Waiters queue
// here, and each sees the previous insert once the lock is released.
async function withUserLock(pool, scope, userId, fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`${scope}:${userId}`]);
    const out = await fn(client);
    await client.query('COMMIT');
    return out;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { withUserLock };
