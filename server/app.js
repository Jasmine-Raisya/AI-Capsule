import { join } from 'node:path';
import express from 'express';
import { installAuth } from './auth.js';
import { readCapsule, validateCapsule } from './capsules.js';

export function createApp({ statements, dist, ...authConfig }) {
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.set({
      'Content-Security-Policy': "default-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
      'Referrer-Policy': 'same-origin',
      'X-Content-Type-Options': 'nosniff',
    });
    if (req.path.startsWith('/api/')) res.set('Cache-Control', 'no-store');
    next();
  });

  const { readUser, requireUser, sameOrigin } = installAuth(app, authConfig);
  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
  app.get('/api/session', requireUser, (req, res) => res.json({ login: req.user.login }));

  const capsules = express.Router();
  capsules.use(requireUser);
  const json = express.json({ limit: '128kb' });

  function capsuleInput(req, res, next) {
    if (!req.is('application/json')) return res.status(415).json({ error: 'Send application/json.' });
    const { values, error } = validateCapsule(req.body);
    if (error) return res.status(400).json({ error });
    req.capsule = values;
    next();
  }

  capsules.param('id', (req, res, next, value) => {
    const id = Number(value);
    if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(id)) {
      return res.status(400).json({ error: 'Invalid capsule ID.' });
    }
    req.capsuleId = id;
    next();
  });

  capsules.get('/', (req, res) => {
    res.json(statements.list.all({ user_id: req.user.id }).map(readCapsule));
  });
  capsules.post('/', sameOrigin, json, capsuleInput, (req, res) => {
    const row = statements.create.get({ ...req.capsule, user_id: req.user.id });
    res.status(201).json(readCapsule(row));
  });
  capsules.put('/:id', sameOrigin, json, capsuleInput, (req, res) => {
    const row = statements.update.get({ ...req.capsule, id: req.capsuleId, user_id: req.user.id });
    if (!row) return res.status(404).json({ error: 'Capsule not found.' });
    res.json(readCapsule(row));
  });
  capsules.delete('/:id', sameOrigin, (req, res) => {
    const result = statements.remove.run({ id: req.capsuleId, user_id: req.user.id });
    if (!result.changes) return res.status(404).json({ error: 'Capsule not found.' });
    res.status(204).end();
  });
  app.use('/api/capsules', capsules);
  app.use('/api', (req, res) => res.status(404).json({ error: 'API route not found.' }));

  function sendPage(req, res) {
    res.set('Cache-Control', 'no-store').sendFile(join(dist, 'index.html'));
  }
  app.get('/', sendPage);
  app.get('/dashboard', (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (!readUser(req)) return res.redirect('/?sign_in=required');
    sendPage(req, res);
  });
  app.use(express.static(dist, { index: false, redirect: false }));
  app.use((req, res) => res.status(404).type('text').send('Page not found.'));

  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON.' });
    if (error.type === 'entity.too.large') return res.status(413).json({ error: 'This capsule is too large.' });
    if (error.status >= 400 && error.status < 500) {
      return res.status(error.status).json({ error: 'Request could not be processed.' });
    }
    console.error('AI Capsule request failed:', error.code || error.name);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  });

  return app;
}
