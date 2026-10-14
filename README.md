# BluestaqAssesment
Assessment for Bluestaq

# Notes API

Team-based note taking REST API. Express 5 + TypeScript + SQLite (`better-sqlite3`).

## Run it

```
npm install
npm run dev        # auto-restarts on save (tsx watch)
```

The server starts on http://localhost:3000 and creates `data/notes.db` on first run.

Production-style:

```
npm run build
npm start
```

Other scripts: `npm run typecheck`.

Try requests with `requests.http` (VSCode "REST Client" extension).

## Configuration

Environment variables (see `.env.example`). Node 20.6+ can load a file with
`node --env-file=.env dist/server.js`.

| Variable     | Default              | Notes                                          |
|--------------|----------------------|------------------------------------------------|
| `PORT`       | `3000`               |                                                |
| `JWT_SECRET` | insecure dev default | **Required** when `NODE_ENV=production`        |
| `DB_PATH`    | `data/notes.db`      | `:memory:` works for throwaway runs            |

## Structure

```
src/
  server.ts            starts the listener
  app.ts               middleware + route mounting
  config.ts  db.ts  types.ts  errors.ts
  middleware/          authenticate, requireTeamMember, errorHandler
  auth/                routes + service (register, login, /auth/me)
  users/               repository
  teams/               routes + service + repository (teams, members, roles)
  notes/               routes + service + repository (always scoped by teamId)
```

Each feature follows the same flow: **routes** (HTTP in/out) -> **service**
(validation and rules, no Express) -> **repository** (the only code with SQL).

## Endpoints

All except `/health` and `/auth/register|login` need `Authorization: Bearer <token>`.

| Method | Path | Who |
|--------|------|-----|
| POST | `/auth/register` | anyone |
| POST | `/auth/login` | anyone |
| GET | `/auth/me` | logged in |
| POST | `/teams` | logged in (creator becomes owner) |
| GET | `/teams` | logged in (your teams) |
| POST | `/teams/join` `{joinCode}` | logged in |
| GET | `/teams/:teamId` | member (join code visible to admin/owner only) |
| DELETE | `/teams/:teamId` | owner |
| POST | `/teams/:teamId/join-code` | admin/owner (regenerate) |
| POST | `/teams/:teamId/members` `{email, role?}` | admin/owner (only the owner can add admins) |
| PATCH | `/teams/:teamId/members/:userId` `{role}` | owner |
| DELETE | `/teams/:teamId/members/:userId` | owner, admin (members only), or yourself |
| GET | `/teams/:teamId/notes` (`?q=` `?tag=` `?pinned=`) | member |
| GET | `/teams/:teamId/notes/tags` | member |
| POST | `/teams/:teamId/notes` | member |
| GET | `/teams/:teamId/notes/:noteId` | member |
| PATCH | `/teams/:teamId/notes/:noteId` | author, admin, or owner |
| DELETE | `/teams/:teamId/notes/:noteId` | author, admin, or owner |

Roles: `owner` > `admin` > `member`. Notes are visible to the whole team.

# 1. Log in and keep the token
```
$login = Invoke-RestMethod -Method Post -Uri http://localhost:3000/auth/login `
  -ContentType "application/json" `
  -Body '{"email":"owner@example.com","password":"owner"}'
$headers = @{ Authorization = "Bearer $($login.token)" }
```

# 2. Find your team's ID (the seed created "Demo Team")
```
$team = @(Invoke-RestMethod -Uri http://localhost:3000/teams -Headers $headers)[0]
```

# 3. Create the note
```
Invoke-RestMethod -Method Post -Uri "http://localhost:3000/teams/$($team.id)/notes" `
  -Headers $headers -ContentType "application/json" `
  -Body '{"title":"This works","content":"This works"}'
```

# 4. Confirm the note landed
```
Invoke-RestMethod -Uri "http://localhost:3000/teams/$($team.id)/notes" -Headers $headers
```