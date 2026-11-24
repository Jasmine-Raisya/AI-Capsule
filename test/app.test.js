import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import jwt from 'jsonwebtoken';
import { createApp } from '../server/app.js';
import { openCapsules } from '../server/capsules.js';

const owner = { id: 291, login: 'first-student' };
const other = { id: 834, login: 'second-student' };
const origin = 'https://capsule.example';
const jwtSecret = randomBytes(32);
const example = {
  project_name: 'SmartFarm',
  prompt_title: 'Summarize sensor readings',
  prompt_version: 'v1',
  prompt_text: 'Group the supplied readings by crop.\nCall out missing observations.',
  response_summary: 'The model grouped readings and identified the missing entry.',
  category: 'Coding',
  usefulness: 'Good',
  reviewed: true,
  improved: false,
  screenshot_url: 'https://example.org/sensor.png',
  notes: 'Tested with sample readings.',
};

test('OAuth, session enforcement, and private capsule CRUD through Express', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'ai-capsule-test-'));
  const databasePath = join(directory, 'capsules.db');
  const { db, statements } = openCapsules(databasePath);
  const authorizations = new Map();
  const oauthCalls = [];

  const oauthFetch = async (url, options) => {
    oauthCalls.push(url);
    if (url === 'https://github.com/login/oauth/access_token') {
      const code = options.body.get('code');
      const verifier = options.body.get('code_verifier');
      assert.equal(options.body.get('redirect_uri'), `${origin}/auth/github/callback`);
      assert.equal(createHash('sha256').update(verifier).digest('base64url'), authorizations.get(code));
      return Response.json({ access_token: `test-${code}` });
    }
    assert.equal(url, 'https://api.github.com/user');
    return Response.json(options.headers.Authorization === 'Bearer test-owner' ? owner : other);
  };

  const app = createApp({
    statements, origin, dist: resolve('dist'), jwtSecret, oauthFetch,
    clientId: 'test-client', clientSecret: 'test-client-secret',
  });
  const server = app.listen(0, '127.0.0.1');
  t.after(async () => {
    await new Promise(done => server.close(done));
    db.close();
    await rm(directory, { recursive: true, force: true });
  });
  await once(server, 'listening');
  const url = `http://127.0.0.1:${server.address().port}`;

  function call(path, { cookie, method = 'GET', body, originHeader } = {}) {
    const headers = {};
    if (cookie) headers.Cookie = cookie;
    if (originHeader) headers.Origin = originHeader;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    return fetch(url + path, { method, headers, body: JSON.stringify(body), redirect: 'manual' });
  }

  async function oauthStart() {
    const login = await call('/login');
    assert.equal(login.status, 302);
    const authorize = new URL(login.headers.get('location'));
    assert.equal(authorize.origin + authorize.pathname, 'https://github.com/login/oauth/authorize');
    assert.equal(authorize.searchParams.get('code_challenge_method'), 'S256');
    const cookie = login.headers.getSetCookie()[0];
    assert.match(cookie, /^__Host-capsule_oauth=/);
    assert.match(cookie, /; HttpOnly; Secure; SameSite=Lax/i);
    return { authorize, cookie: cookie.split(';')[0] };
  }

  async function signIn(code) {
    const { authorize, cookie } = await oauthStart();
    const state = authorize.searchParams.get('state');
    authorizations.set(code, authorize.searchParams.get('code_challenge'));
    const callback = await call(`/auth/github/callback?state=${state}&code=${code}`, { cookie });
    assert.equal(callback.headers.get('location'), '/dashboard');
    const session = callback.headers.getSetCookie().find(value => value.startsWith('token='));
    assert.match(session, /; HttpOnly; Secure; SameSite=Lax/i);
    assert.match(session, /; Path=\//i);
    return session.split(';')[0];
  }

  await t.test('public health, dashboard redirect, and every capsule method require a valid session', async () => {
    const health = await call('/api/health');
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { status: 'ok' });
    const dashboard = await call('/dashboard');
    assert.equal(dashboard.status, 302);
    assert.equal(dashboard.headers.get('location'), '/?sign_in=required');
    for (const cookie of [undefined, 'token=fake-token-123']) {
      for (const [method, path] of [['GET', ''], ['POST', ''], ['PUT', '/1'], ['DELETE', '/1']]) {
        const response = await call(`/api/capsules${path}`, { method, cookie });
        assert.equal(response.status, 401);
        assert.deepEqual(await response.json(), { error: 'Unauthorized' });
      }
    }
    const expired = jwt.sign({ login: owner.login }, jwtSecret, {
      subject: String(owner.id), issuer: 'ai-capsule', audience: 'ai-capsule-web', expiresIn: -1,
    });
    assert.equal((await call('/api/capsules', { cookie: `token=${expired}` })).status, 401);
  });

  await t.test('a callback with incorrect state never calls GitHub or issues a session', async () => {
    const { cookie } = await oauthStart();
    const response = await call('/auth/github/callback?state=wrong&code=owner', { cookie });
    assert.equal(response.headers.get('location'), '/?sign_in=expired');
    assert.equal(response.headers.getSetCookie().some(value => value.startsWith('token=')), false);
    assert.deepEqual(oauthCalls, []);
  });

  await t.test('two OAuth users can only access their own records', async () => {
    const ownerCookie = await signIn('owner');
    const otherCookie = await signIn('other');
    const session = await call('/api/session', { cookie: ownerCookie });
    assert.deepEqual(await session.json(), { login: owner.login });
    const invalidOrigin = await call('/api/capsules', {
      method: 'POST', cookie: ownerCookie, body: example, originHeader: 'https://unrelated.example',
    });
    assert.equal(invalidOrigin.status, 403);
    const invalidEvidence = await call('/api/capsules', {
      method: 'POST', cookie: ownerCookie, body: { ...example, screenshot_url: 'file:///example.png' },
    });
    assert.equal(invalidEvidence.status, 400);
    const tooLong = await call('/api/capsules', {
      method: 'POST', cookie: ownerCookie, body: { ...example, prompt_title: 'x'.repeat(161) },
    });
    assert.deepEqual(await tooLong.json(), { error: 'Prompt title must be 160 characters or fewer.' });
    const notJson = await fetch(`${url}/api/capsules`, {
      method: 'POST', headers: { Cookie: ownerCookie, 'Content-Type': 'text/plain' }, body: 'prompt',
    });
    assert.equal(notJson.status, 415);
    assert.equal((await call('/api/capsules/abc', { method: 'DELETE', cookie: ownerCookie })).status, 400);

    const creation = await call('/api/capsules', {
      method: 'POST', cookie: ownerCookie, body: { ...example, user_id: String(other.id) },
    });
    assert.equal(creation.status, 201);
    const record = await creation.json();
    assert.deepEqual(record, { ...example, id: record.id, created_at: record.created_at });
    assert.ok(Number.isFinite(Date.parse(record.created_at)));
    assert.equal(db.prepare('SELECT user_id FROM capsules WHERE id = ?').get(record.id).user_id, String(owner.id));
    const path = `/api/capsules/${record.id}`;

    assert.deepEqual(await (await call('/api/capsules', { cookie: ownerCookie })).json(), [record]);
    assert.deepEqual(await (await call('/api/capsules', { cookie: otherCookie })).json(), []);
    assert.equal((await call(path, { method: 'PUT', cookie: otherCookie, body: example })).status, 404);
    assert.equal((await call(path, { method: 'DELETE', cookie: otherCookie })).status, 404);

    const update = await call(path, {
      method: 'PUT', cookie: ownerCookie, body: { ...example, prompt_version: 'v2', improved: true },
    });
    assert.equal(update.status, 200);
    const updated = await update.json();
    assert.deepEqual(updated, { ...record, prompt_version: 'v2', improved: true });
    const reopened = openCapsules(databasePath);
    try {
      assert.equal(reopened.statements.list.get({ user_id: String(owner.id) }).prompt_version, 'v2');
    } finally {
      reopened.db.close();
    }
    assert.equal((await call(path, { method: 'DELETE', cookie: ownerCookie })).status, 204);
    assert.deepEqual(await (await call('/api/capsules', { cookie: ownerCookie })).json(), []);

    const foreignSignOut = await call('/logout', { method: 'POST', cookie: ownerCookie, originHeader: 'https://unrelated.example' });
    assert.equal(foreignSignOut.status, 403);
    assert.deepEqual(foreignSignOut.headers.getSetCookie(), []);
    const signOut = await call('/logout', { method: 'POST', cookie: ownerCookie, originHeader: origin });
    assert.equal(signOut.status, 303);
    assert.match(signOut.headers.getSetCookie()[0], /^token=;.*; HttpOnly; Secure; SameSite=Lax/i);
  });
});
