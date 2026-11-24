import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { parse } from 'cookie';
import express from 'express';
import jwt from 'jsonwebtoken';

const oauthCookie = '__Host-capsule_oauth';
const sessionSeconds = 8 * 60 * 60;
const cookieOptions = { httpOnly: true, secure: true, sameSite: 'lax', path: '/' };
const jwtOptions = { issuer: 'ai-capsule', audience: 'ai-capsule-web' };

function cookies(req) {
  return parse(req.headers.cookie || '');
}

function sameState(expected, actual) {
  if (typeof actual !== 'string') return false;
  const left = Buffer.from(expected);
  const right = Buffer.from(actual);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function createAuth({ origin, clientId, clientSecret, jwtSecret, oauthFetch = fetch }) {
  const routes = express.Router();
  const redirectUri = new URL('/auth/github/callback', origin).href;

  function readUser(req) {
    const token = cookies(req).token;
    if (!token) return null;

    try {
      const claims = jwt.verify(token, jwtSecret, { ...jwtOptions, algorithms: ['HS256'] });
      if (typeof claims.sub === 'string' && /^[1-9]\d*$/.test(claims.sub) &&
          typeof claims.login === 'string' && typeof claims.exp === 'number') {
        return { id: claims.sub, login: claims.login };
      }
    } catch {
      return null;
    }
    return null;
  }

  function requireUser(req, res, next) {
    req.user = readUser(req);
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    next();
  }

  function sameOrigin(req, res, next) {
    const requestOrigin = req.get('Origin');
    if (requestOrigin && requestOrigin !== origin) {
      return res.status(403).json({ error: 'Request origin is not allowed.' });
    }
    next();
  }

  routes.get('/login', (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (readUser(req)) return res.redirect('/dashboard');
    if (!clientId) return res.redirect('/?sign_in=unavailable');

    const state = randomBytes(32).toString('base64url');
    const verifier = randomBytes(32).toString('base64url');
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    const url = new URL('https://github.com/login/oauth/authorize');
    url.search = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256',
    }).toString();

    res.cookie(oauthCookie, `${state}.${verifier}`, { ...cookieOptions, maxAge: 10 * 60 * 1000 });
    res.redirect(url.href);
  });

  routes.get('/auth/github/callback', async (req, res) => {
    const [state, verifier] = (cookies(req)[oauthCookie] || '').split('.');
    const { code, error } = req.query;
    res.set('Cache-Control', 'no-store');
    res.clearCookie(oauthCookie, cookieOptions);

    if (!clientId || !verifier || !sameState(state, req.query.state)) {
      return res.redirect('/?sign_in=expired');
    }
    if (error || typeof code !== 'string' || !code) return res.redirect('/?sign_in=cancelled');

    try {
      const exchange = await oauthFetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          code_verifier: verifier,
          code,
        }),
        redirect: 'error',
        signal: AbortSignal.timeout(10_000),
      });
      const { access_token: accessToken } = exchange.ok ? await exchange.json() : {};
      if (typeof accessToken !== 'string' || !accessToken) return res.redirect('/?sign_in=failed');

      const identity = await oauthFetch('https://api.github.com/user', {
        headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${accessToken}`, 'User-Agent': 'AI-Capsule' },
        redirect: 'error',
        signal: AbortSignal.timeout(10_000),
      });
      const { id, login } = identity.ok ? await identity.json() : {};
      if (!Number.isSafeInteger(id) || id <= 0 || typeof login !== 'string' || !login) {
        return res.redirect('/?sign_in=failed');
      }

      const token = jwt.sign({ login }, jwtSecret, {
        ...jwtOptions,
        subject: String(id),
        expiresIn: sessionSeconds,
        algorithm: 'HS256',
      });
      res.cookie('token', token, { ...cookieOptions, maxAge: sessionSeconds * 1000 });
      res.redirect('/dashboard');
    } catch {
      res.redirect('/?sign_in=failed');
    }
  });

  routes.post('/logout', sameOrigin, (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.clearCookie('token', cookieOptions);
    res.redirect(303, '/');
  });

  return { routes, readUser, requireUser, sameOrigin };
}
