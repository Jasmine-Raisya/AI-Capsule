# AI Capsule

CSE3CWA Assessment 3 requires fullstack development and deployment of: "AI Capsule" aiming to deliver services to users: a platform for managing AI prompts, and save successful prompts for future reference. The platform enables a "private library" for authenticated users (via github) to access several services which includes:
- Signing into account (via github)
- saving of prompts
- managing saved prompts in a dashboard
- CRUD (Creation, Read, Update(Edit), and Deletion) of prompt "capsules"
- review, reading, updating, and deletion(for optional fields) of prompt capsule details
Tnis project emplots React + Express API for routing whist SQLite stores and manages the "prompt capsules" mapped to the github userID of the owning user

## Deployment Specifications:

**Public HTTPS URL** · [https://jasmine-ai-capsule-fnd8h2hfe4bjc4cz.japanwest-01.azurewebsites.net](https://jasmine-ai-capsule-fnd8h2hfe4bjc4cz.japanwest-01.azurewebsites.net).

**Platform Details** · 
- Azure App Service Free (F1)
- Node.js 22
- Region: Japan West . 
- The GitHub Actions workflow: continuous deploy of `main` from github repository -  [AI-Capsule](https://github.com/Jasmine-Raisya/AI-Capsule).

## Installation and run instructions

Below lists the instructions to run the full app service locally:

1. Install Node.js 22.13 or later **within the Node 22 release line**, &  npm. 
2. Clone the Repository to your local machine
3. from the  project root/ `AI-capsule`  containing `package.json`  open a terminal.

   ```powershell
   node --version
   npm --version
   npm ci
   ```

2. Create   `.env`to setup environment variables on first setup.

   ```powershell
   Copy-Item .env.example .env
   ```

3. Register a **separate local GitHub OAuth app** at GitHub → Settings → Developer settings → OAuth apps → New OAuth App. Use these values:

   - Application name: `AI Capsule Local`
   - Homepage URL: `http://localhost:3000`
   - Authorization callback URL: `http://localhost:3000/auth/github/callback`

   On app registry: copy its client ID +  generate a client secret on the  settings page. You can refer to  [GitHub's OAuth app instructions](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app). 
-  local OAuth app should remain separate from the production registration.

4. Generate local secret: (session-signing JWT)

   ```powershell
   node -p "require('node:crypto').randomBytes(32).toString('hex')"
   ```

   You may now integrate the generated values to the `.env` populating the placeholders like in `.env.example`

   ```dotenv
   APP_URL=http://localhost:3000
   GITHUB_CLIENT_ID=your_local_client_id
   GITHUB_CLIENT_SECRET=your_local_client_secret
   JWT_SECRET=your_generated_random_secret
   ```

   `PORT` and `DATABASE_PATH` are optional fields
 The default database lives in `./data/capsules.db`relative to the local machine project folder, created on build + starting the application.

5. Build the React frontend and start Express:

   ```powershell
   npm run build
   npm start
   ```

   Click the url from the terminal output post build `http://localhost:3000`in local browser.. Use `localhost` exactly, not `127.0.0.1`, so the URL matches the registered callback and the development cookie behaviour. The application will now behave as expected, and mirrors the services like the Azure Instance. 

6. On changes to the codebase rerun: `npm run build` before restarting the application.
7.  Running `npm test` would trigger the  auto-integration tests, which comprises of OAuth Simulation -- not contacting GitHub directly. 

### Environment name variables (accessible via in Azure Deployment App Services)

| Name | Purpose |
| --- | --- |
| `GITHUB_CLIENT_ID` | OAuth app client ID registered via GitHub |
| `GITHUB_CLIENT_SECRET` | OAuth App secret  (server-side)      |
| `JWT_SECRET` | Random generated signing secret >= 32 bytes in length |
| `APP_URL` | public origin override for the deployed URL. on default, set`http://localhost:3000`. |
| `PORT` | Azure Provides the Port -- though in local would be defaulted to `3000`. |
| `DATABASE_PATH` | `./data/capsules.db` in .env.example, and when running locally, and is reflected in Azure for persistence of db |


## Azure Deploymemt Services:

Azure App Services is employed to host this application services via GutHub Actions. Therefore:
- deployed from `main` of the [AI-Capsule](https://github.com/Jasmine-Raisya/AI-Capsule) repository. on changes to `main` branch -> triggers the GitHub Actions workflow: build, test and deployment to Azure. 
- Workflow is set and located at stated repository: `.github/workflows/main_jasmine-ai-capsule.yml`.
- Azure App Services manages: 
1) Environment Variable Settings stores and manages confidential: `APP_URL`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `JWT_SECRET` and `DATABASE_PATH`.
- **GitHub OAuth Callback:**
utilizes the public URL (of the deployed app) followed by `/auth/github/callback`.

## Project File Structure

| Path | Responsibility |
| --- | --- |
| `server/start.js` |  Validation of environment variables, also starts SQLite + Express  on launch |
| `server/app.js` | Security headers, every route, JWT-protected capsule router and error handling. |
| `server/auth.js` | All Authentication Configrations: GitHub OAuth routes, JWT issue and verification, and the `requireUser` middleware. |
| `server/capsules.js` | SQLite schema, owner-scoped queries and request validation. |
| `shared/capsule-fields.js` | Capsule field labels and length limits, used by both the Express validator and the React form. |
| `src/main.jsx`, `src/Dashboard.jsx` | React landing page and the protected prompt library. |
| `test/app.test.js` | Integration test of OAuth, JWT protection, CRUD and ownership. |

## Mandatory API Routes

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

### Communication: React + Express:
utilizes HTTP requests to connect React to backend Express services
React Responsibilities: sends and utilize `fetch` requests to api backend --> Writes with JSON. 
Express Reponsibilities: requires capsule information from the front-end form including: `project_name`, `prompt_title`, `prompt_text`. non-mandatory fields include thus also accepts: `prompt_version`, `response_summary`, `category`, `usefulness`, (boolean:`reviewed`, `improved`), `screenshot_url`, and `notes`.
**Communication:**
1) React frontend: sends frontend requests (e.g. POST form data as JSON to api/...)
2) Express: through same-origin fetch, validates submitted fields from the POST/other actions, then persists the data via SQLite
3) On success/failure: sends a request back to React frontend to update the user interface/other expected behaviour. 
 NOTE: Updating or deleting a missing capsule or a capsule owned by another user returns `404`.

### GitHub OAuth and application sessions

1) **Sign-in and Sessions:**
- requirements: `on click: sign-in`
a) redirects the browser. On redirect:
- assigned random `state`, saved with the `sign-in cookie`. thus linking the response with the specific attempt of signing in.
- assigned PKCE challenge. (secret hash stored in Express to mitigate intercaption) 
b) GitHub: redirects to Express callback
c) Express: verifies matching returned `state` to `sign-in cookie`. only on match -- will GitHub be contacted.
- on match: Express exchange code for the GitHub Access Token, providing the original PKCE verifier on exchange. 
d) The server then uses the token to  fetch the authenticated GitHub profile using GitHub's access token. [GitHub OAuth web application flow](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps#web-application-flow)

2) **Application Session**
- on successful sign-in, Express issues an eight-hour JWT storing in `cookie: token`: 
    - Secure (HTTPS)
    - HttpOnly (prevents READ by js in the page)
    - SameSite=Lax
- The JWT subject is set as the owner user GitHub ID (numeric) 
- Middleware verifies cookie token:
    - signature
    - expiry
    - issuer
    - audience
    uniform to all capsule routes. 
- Cookie creation and management is handled entirely on browser side, not react.
- Ownership of requests is dependent from the verified JWT, not the actual request. Express will only accept requests from valid owners and changes mirrors behaviour only to editable fields from the request body.

### Storage (SQLite)

**Setup:** 
requirements -- on startup
output:
1) Express: opens SQLite db, creates parent directory, table, ownership index if null (as configured in `/server/capsules.js`).

**Records:**
1) SQLite assign each record capsule: ID & dateTime of creation.
2) API: stores the owner GitHub UID in the stated table column
*therefore all CRUD operations/queries and changes to the database is mapped and filtered to the UID -- isolating the users actions to the capsules they created themselves. 

**Persistence** (not ephemeral)
1) Azure App Service: db lives in `/home/data/capsules.db`, outside the deployed application files. redeploying the Service shouldn't overwrite the persisted data to null, however on deletion of the App Service/capsules.db, the Azure App Services does not have automated backups, therefore lost data would be deleted forever.
*when running locally, on restart -- only local db files would be persisted

## Verification

**automated test script (server-side)**
action: running `npm test` runs one Express+SQLite integration test.
output: It uses canned GitHub test responses and a temporary database, thus test runs in isolation without ever contacting GitHub.
**BEHAVIOURS:**
1) Sign-in
-  fake provider code goes through the real callback route, triggering the sign-in mechanism
- PKCE challenge goes through verification
- session cookie has the necessary attributes
- on wrong `state`: stops the exchange and ignores the sign-in attempt.

2) Data & Ownership
- Conducts all CRUD Operations
- Persistence of data through SQLite reopening
- Two-user ownership.

3) Bad Request Handling
- on JWT attr: missing, invalid or expired, returns `401`, unauthorized. 
- Express derivation of owner ONLY FROM verified JWT, never from the request 
- Cross-origin writes rejected.

**Manual Testing (Browser Check)**
requirements: React App Compiled running locally (Chrome Browser) -- signed in, in simulation.
- capsule created and saved.
- page is refreshed, capsule is persisted
- capsule details are read and edited.
- updating of form fields and saved.
- capsule is deleted.
- use re-sign-in (signs out and signs back in from the landing page), verifies that on sign out, editing the URL to `/dashboard` would redirect it back to the landing page since user state is has no sign-in state.

### Required cloud cURL checks

In Windows PowerShell, use `curl.exe` if `curl` resolves to an alias. These checks were run against the live deployment on 23 November 2026.

```sh
curl -i https://jasmine-ai-capsule-fnd8h2hfe4bjc4cz.japanwest-01.azurewebsites.net/api/capsules
curl -i -H "Cookie: token=fake-token-123" https://jasmine-ai-capsule-fnd8h2hfe4bjc4cz.japanwest-01.azurewebsites.net/api/capsules
```

| Check | Observed locally | Public result |
| --- | --- | --- |
| Missing cookie | `401 Unauthorized`, `{"error":"Unauthorized"}` | `401 Unauthorized`, `{"error":"Unauthorized"}` |
| Fake session cookie | `401 Unauthorized`, `{"error":"Unauthorized"}` | `401 Unauthorized`, `{"error":"Unauthorized"}` |

## Honest Limitations of the Submitted Application 
- Utilizing Azure's free model, persistence services are only done via single instance of SQLite file. This imposes a security risk in the event of data loss. For instance, deletion of the App Service would also delete all of the persisted capsules. The free Azure model also 'sleeps' when idle, which could invoke a slight delay within seconds of receiving a request after a prolonged period of time. 

## AI-assisted development

### AI-use Statement: 
Sol 6.2 Model by Open AI -- Codex was used in parallel for the development of this project. I have also employed Claude Code: Opus to assess the quality and design principles integrated in the code. Image generation tools by open AI was used to generate the image plastered in the landing page. Sol Model also aided in creation of this README. All AI-generated outputs await my approval and several follow-ups have to be made especially regarding the directory & management of credentials. I remain accountable for the submitted codebase, deploymentm, and system behaviour.

### One Problem Identified:
- the `sign out` form returned `Origin: null` mid development of the project, thus rejecting the request with `403`. This was due to a configuration issues of  `Referrer-Policy: no-referrer` setting of the Express draft. therefore the site would reject its own sign-out from its own site.

### One Problem Corrected:
- the Referrer-Policy is configured to same-origin, therefore the sign-out form submission remain accessible and working. 

### How OAuth login, JWT verification and protected API behaviour were verified;
- integration tests simulated GitHub’s responses and exercised the Express OAuth callback. 

**Scripted Tests** (lives in repository)
- Behaviours checked: (via scripted integration testing)
  -  Server issued a session cookie in condition of  successful OAuth Callback (via GitHub)
  - failed callback(invalid state) is rejected by server
  - JWT protection on the capsule API. 
  
**Manual Testing:** 
1) Curl testing of requests:
    - Request with no auth token 
    - Request with a fake token
  2) GitHub Sign-in method on deployed app
- tested the sign-in page with two GitHub users: both succeed and passed all manual tests including refresh of webpage, sign-out and sign-in which persists the owners 'capsules' on both accounts.

### How CRUD behaviour and user data ownership were verified;
**Manual Testing**
1) **CRUD**
- requirements: signed in with GitHub account
- action: CREATE capsule, saved it, refresh the site confirming the persistence(READ: accessing the details by viewing the capsule), edited the capsule(UPDATE) and proceed with DELETION of the same capsule. 
- output: the system behaved as expected with the CRUD behaviour as per assignment specification with persistence verified.
The integration tests used two simulated GitHub users to check that each user could access only their own records. They also checked that the server ignored a user_id supplied by the browser.
2. **OWNERSHIP**
   - requirements: 2 GitHub Accounts were utilized to confirm that user CRUD requests and ownership of the capsules are isolated. 
   - actions: sign-in, view dashboard, conduct the CRUD testing in isolation. switch between accounts and ensuring that the capsules displayed are only those owned by the signed in user.
   - output: the system behaved as expected
   - Additionally: curl requests using a synthetic user_id is ignored by the browser

### One implementation or deployment decision you made and can explain independently.
- I chose to use one single Azure App Service Application to host and serve the frontend and Express API service. The reasoning behind this is for the sake of simplicity: having a single public origin to make the authentication and deployment independent of hefty CORS configurations, also addressing the smaller scale and the relatively simple service. 

