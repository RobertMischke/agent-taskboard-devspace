import test from 'node:test';
import assert from 'node:assert/strict';
import { createReviewClient } from '../dist/index.js';

test('API client reads the current pairing token for each request', async () => {
  let token = 'first-session';
  const auth = [];
  const client = createReviewClient({ token: () => token, fetch: async (_url, init) => {
    auth.push(new Headers(init.headers).get('Authorization'));
    return new Response('{}', { status: 200 });
  } });
  await client.getDocument('project', 'document');
  token = 'refreshed-session';
  await client.getDocument('project', 'document');
  assert.deepEqual(auth, ['Bearer first-session', 'Bearer refreshed-session']);
});
