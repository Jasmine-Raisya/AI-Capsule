# AI Capsule

AI Capsule is a private library for AI prompts. Sign in with GitHub to save prompts, read them back, update their review details, and delete them. React calls the Express API on the same origin. SQLite stores each capsule under its owner's GitHub user ID.

## Deployment status

**Public HTTPS URL** · Pending deployment.

**Target platform** · Render Free Web Service. The checks below are local results. After deploying, record the actual public URL and both cloud cURL results here for the assessor.

## Run locally

Use Node.js 22.13 or later in the Node 22 release line and npm. Run the commands from the directory containing `package.json`.

1. Run `npm ci`.
2. Copy `.env.example` to `.env`. In PowerShell, run `Copy-Item .env.example .env`.
3. In GitHub, create a local OAuth App with homepage URL `http://localhost:3000` and callback URL `http://localhost:3000/auth/github/callback`. Put its client ID and secret in `.env`. [Register a GitHub OAuth App](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app)
4. Generate a session signing secret with `node -p "require('node:crypto').randomBytes(32).toString('hex')"`. Set `JWT_SECRET` in `.env` to the generated value.
5. Run `npm run build`, then `npm start`. Open `http://localhost:3000` in Chrome or Edge. Use that exact hostname for the Secure cookies and GitHub callback.

Express serves the built React frontend and the API on port 3000 by default. After changing the frontend, run `npm run build` again and reload the page. The landing page and health check also run locally when both GitHub settings are blank.

### Environment variables

| Name | Purpose |
| --- | --- |
| `GITHUB_CLIENT_ID` | Client ID for the OAuth App registered with GitHub |
| `GITHUB_CLIENT_SECRET` | OAuth App secret used for the server-side code exchange |
| `JWT_SECRET` | Random signing secret at least 32 bytes long |
| `APP_URL` | Optional public origin override. The local example uses `http://localhost:3000`. |
| `RENDER_EXTERNAL_URL` | Render-provided HTTPS origin if `APP_URL` is unset |
| `PORT` | Port supplied by the host. Defaults to `3000` locally. |
| `DATABASE_PATH` | Optional SQLite path. Defaults to `./data/capsules.db`. |

Keep the local `.env` private. In Render, enter secret values through the service's Environment settings.

## Deploy on Render

1. Push this project directory to its own GitHub repository and connect that repository to a new Render **Web Service**. Choose **Node** and **Free**. If the repository holds this project in a subdirectory, enter the subdirectory as the **Root Directory**. [Render's Express deployment guide](https://render.com/docs/deploy-node-express-app)
2. In the service settings, set the build command to `npm ci --include=dev && npm run build`, the start command to `npm start`, and the health check path to `/api/health`. The included `render.yaml` also declares these settings for a repository with the project at the root.
3. Copy the service's assigned `https://…onrender.com` URL. Register a GitHub OAuth App with that homepage URL and add `/auth/github/callback` to it for the callback URL. Use the deployed OAuth App's credentials on Render and keep the local OAuth App for development.
4. Set `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` and `JWT_SECRET` in Render. Render sets `RENDER_EXTERNAL_URL` and `PORT`. For a custom domain, set `APP_URL` to its HTTPS origin and update GitHub's callback URL to match. [Render's environment variable reference](https://render.com/docs/environment-variables)
5. Deploy and open the public URL. Confirm `/api/health` returns `{"status":"ok"}`. Run both unauthenticated checks below, then sign in with GitHub and create, reload, edit and delete a capsule.

### Storage and limitation

On startup, Express opens SQLite, creates the parent directory, and initializes `capsules` and its ownership index if absent. The database assigns the record ID and creation timestamp. The API stores the verified GitHub user ID in `user_id`. Every list, update, and delete query matches that owner. A local database file persists across restarts.

Render Free's filesystem is ephemeral. A restart, redeploy, or idle spin-down can erase the SQLite file and the saved capsules. An attached persistent disk on a supported plan can preserve the file if `DATABASE_PATH` points to the mounted disk. [Render Free service limits](https://render.com/docs/free#local-files-lost-on-redeploy)

## Pages and API

| Method and path | Access | Result |
| --- | --- | --- |
| `GET /` | Public | Explains AI Capsule and links to GitHub sign-in. |
| `GET /login` | Public | Starts the GitHub OAuth flow. |
| `GET /auth/github/callback` | OAuth callback | Validates the sign-in attempt and starts a session. |
| `GET /dashboard` | Signed in | Opens the React prompt library. |
| `GET /api/health` | Public | Returns `{"status":"ok"}`. |
| `GET /api/session` | Signed in | Returns the current GitHub login name for the header. |
| `GET /api/capsules` | Signed in | Lists only the signed-in user's capsules. |
| `POST /api/capsules` | Signed in | Creates a capsule and returns it with `201`. |
| `PUT /api/capsules/:id` | Signed in | Replaces the editable fields on an owned capsule and returns it. |
| `DELETE /api/capsules/:id` | Signed in | Deletes an owned capsule and returns `204`. |
| `POST /logout` | Same origin | Clears the session cookie in the browser. |

React uses same-origin `fetch` requests and sends JSON for writes. Express requires `project_name`, `prompt_title` and `prompt_text`. The form also accepts `prompt_version`, `response_summary`, `category`, `usefulness`, `reviewed`, `improved`, `screenshot_url`, and `notes`. `reviewed` and `improved` are booleans in JSON. Updating or deleting a missing capsule or a capsule owned by another user returns `404`.

### GitHub OAuth and application sessions

Express sends the browser to GitHub with a random state and a PKCE challenge. The callback compares the returned state with the sign-in cookie and supplies the original PKCE verifier when exchanging the code. The server then fetches the authenticated GitHub profile using GitHub's access token. [GitHub OAuth web application flow](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps#web-application-flow)

Express issues an eight-hour JWT and places it in `token`, a Secure, HttpOnly, SameSite=Lax cookie. The JWT subject is the numeric GitHub user ID. Middleware verifies the signature, expiry, issuer and audience on all capsule routes. React relies on the browser to send the cookie. Express derives the owner from the verified JWT and accepts only the editable fields from the request body.

## Verification

Run `npm test` for the Express and SQLite integration test. It uses GitHub test responses and a temporary database. The test exchanges a fake provider code through the real callback, verifies the PKCE challenge and cookie attributes, and checks that a wrong state stops the exchange. It exercises create, read, update, delete, persistence after reopening SQLite, and two-user ownership. It checks `401` for missing, invalid or expired JWTs, and verifies that Express ignores a browser-supplied owner ID and rejects cross-origin writes.

A local Chrome run used a simulated GitHub account to check the compiled React app. The browser saved a capsule, reloaded and opened it, updated its version and review fields, and deleted it. After sign-out, opening `/dashboard` redirected to the landing page.

### Required cloud cURL checks

Replace `https://YOUR-APP` with the actual deployed origin. In Windows PowerShell, use `curl.exe` if `curl` resolves to an alias.

```sh
curl -i https://YOUR-APP/api/capsules
curl -i -H "Cookie: token=fake-token-123" https://YOUR-APP/api/capsules
```

| Check | Observed locally | Public result |
| --- | --- | --- |
| Missing cookie | `401 Unauthorized`, `{"error":"Unauthorized"}` | Pending deployment |
| Fake session cookie | `401 Unauthorized`, `{"error":"Unauthorized"}` | Pending deployment |

### Record the 3–5 minute submission video

1. Show the public HTTPS URL and the `/api/health` JSON response.
2. Run both cURL checks from the previous section and show their `401` status codes.
3. Sign in through GitHub and show the protected dashboard.
4. Add a capsule, reload and open it, edit its version and review fields, then delete it.
5. Show the Render service settings and environment variable names with secret values hidden. Describe how the SQLite file is created and when Render Free can lose it. Keep the application JWT out of the recording.
6. Check the recording plays with audio and submit the source ZIP and MP4 directly to the LMS.

## AI-assisted development

OpenAI Codex generated and reviewed the implementation, tests and deployment configuration. The built-in OpenAI ImageGen tool created `public/capsule-art.jpg` from a prompt for a frosted chartreuse archive capsule holding paper cards in a dark olive studio.

The first Express draft set `Referrer-Policy: no-referrer`. In Chrome, that made the sign-out form send `Origin: null`, so Express rejected it with `403`. Changing the policy to `same-origin` restored the browser's same-origin form submission. The app still rejects cross-origin sign-out requests. [Fetch standard for the Origin header](https://fetch.spec.whatwg.org/#origin-header)

The implementation serves React and the API from one Express process. The browser can send its Secure session cookie with same-origin requests, and deployment needs one public origin for both the UI and OAuth callback. The integration test verifies the Express OAuth callback against a simulated provider and exercises SQLite ownership with two GitHub IDs. Live GitHub verification and the required public cURL checks are pending deployment.
