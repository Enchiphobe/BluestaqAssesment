# BluestaqAssesment
Assessment for Bluestaq

# Notes API

Team-based note taking REST API. Express 5 + TypeScript + SQLite (`better-sqlite3`).

## Run it

First install dependencies:

```
npm install
```

Then start the server:

```
npm run dev        # auto-restarts on save (tsx watch)
```

The server starts on http://localhost:3000 and creates `data/notes.db` on first run.

Production-style:

```
npm run build
npm start
```

Other scripts: `npm run typecheck` and `npm test`.

Try requests with `requests.http` (VSCode "REST Client" extension).

## Reset the database for a fresh build

If you want to start from a clean SQLite state, remove the existing DB files before restarting the app:

On Windows, use:

```powershell
Remove-Item data\notes.db*
```

On Linux/macOS, use:

```bash
rm -f data/notes.db*
```

This clears the SQLite database and related files so the app can recreate the schema and seed data from scratch on the next run.

## Configuration

Environment variables (see `env.example`).

| Variable     | Default              | Notes                                                   |
|--------------|----------------------|---------------------------------------------------------|
| `PORT`       | `3000`               | HTTP port for the app                                    |
| `JWT_SECRET` | insecure dev default | Required when `NODE_ENV=production`                     |
| `DB_PATH`    | `data/notes.db`      | Use `:memory:` for throwaway or test-only runs          |

## Structure

```
src/
  server.ts            starts the listener
  app.ts               middleware + route mounting
  config.ts            environment + JWT constants
  db.ts                SQLite setup and schema
  types.ts             shared model types
  errors.ts            HTTP error classes
  seed.ts              development seed data
  auth/                routes + service (register, login, /auth/me)
  users/               routes + service + repository
  teams/               routes + service + repository
  notes/               routes + service + repository
  middleware/          authenticate, requireTeamAccess, errorHandler
```

Each feature follows the same flow: **routes** (HTTP in/out) -> **service**
(validation and rules, no Express) -> **repository** (the only code with SQL).

## Endpoints

All routes below require a valid `Authorization: Bearer <token>` header unless the route is public.

| Method | Path | Who |
|--------|------|-----|
| POST | `/auth/register` | anyone |
| POST | `/auth/login` | anyone |
| GET | `/auth/me` | logged in |
| GET | `/users` | admin |
| PATCH | `/users/:userId/role` `{role}` | admin |
| POST | `/teams` `{name, visibility?}` | logged in |
| GET | `/teams` | logged in |
| GET | `/teams?all=true` | admin |
| GET | `/teams/public` | logged in |
| POST | `/teams/:teamId/join` | logged in |
| GET | `/teams/:teamId` | team member or admin |
| PATCH | `/teams/:teamId` `{name?, visibility?}` | team manager or admin |
| DELETE | `/teams/:teamId` | team manager or admin |
| POST | `/teams/:teamId/members` `{email, role?}` | team manager or admin |
| PATCH | `/teams/:teamId/members/:userId` `{role}` | team manager or admin |
| DELETE | `/teams/:teamId/members/:userId` | team manager or admin, or yourself |
| GET | `/teams/:teamId/notes` (`?q=` `?tag=` `?pinned=`) | team member or admin |
| GET | `/teams/:teamId/notes/tags` | team member or admin |
| POST | `/teams/:teamId/notes` `{title, content, tags?, pinned?}` | team member or admin |
| GET | `/teams/:teamId/notes/:noteId` | team member or admin |
| PATCH | `/teams/:teamId/notes/:noteId` `{title?, content?, tags?, pinned?}` | note author, team manager, or admin |
| DELETE | `/teams/:teamId/notes/:noteId` | note author, team manager, or admin |

Access rules:

- `admin` users can open any team and list all teams/users.
- Team membership controls access to team data.
- `manager` is the team-level role; admins are treated as managers everywhere they can access a team.
- `member` can read notes, create notes, and edit their own notes.
- Personal teams are intentionally restricted to the owner and admins and cannot be shared or modified by others.
- Public teams can be joined by any logged-in user; private teams cannot be joined by ID.

# 1. Log in and keep the token
```
$login = Invoke-RestMethod -Method Post -Uri http://localhost:3000/auth/login `
  -ContentType "application/json" `
  -Body '{"email":"manager@example.com","password":"manager"}'
$headers = @{ Authorization = "Bearer $($login.token)" }
```

# 2. List your teams
```
$teams = Invoke-RestMethod -Uri http://localhost:3000/teams -Headers $headers
$team = $teams | Where-Object { $_.name -eq "Demo Team" }
```

# 3. Create the note
```
Invoke-RestMethod -Method Post -Uri "http://localhost:3000/teams/$($team.id)/notes" `
  -Headers $headers -ContentType "application/json" `
  -Body '{"title":"This works","content":"This works","tags":["work"],"pinned":true}'
```

# 4. Confirm the note landed
```
Invoke-RestMethod -Uri "http://localhost:3000/teams/$($team.id)/notes" -Headers $headers
```

# 5. Useful admin actions
```
$adminLogin = Invoke-RestMethod -Method Post -Uri http://localhost:3000/auth/login `
  -ContentType "application/json" `
  -Body '{"email":"admin@example.com","password":"admin"}'
$adminHeaders = @{ Authorization = "Bearer $($adminLogin.token)" }

# List all teams
Invoke-RestMethod -Uri http://localhost:3000/teams?all=true -Headers $adminHeaders

# Find the user's ID, then promote them to admin
$users = Invoke-RestMethod -Uri http://localhost:3000/users -Headers $adminHeaders
$users | Select-Object id, email, role
$target = $users | Where-Object { $_.email -eq "member@example.com" }
Invoke-RestMethod -Method Patch -Uri "http://localhost:3000/users/$($target.id)/role" `
  -Headers $adminHeaders -ContentType "application/json" `
  -Body '{"role":"admin"}'
```

Seeded users are created automatically in development mode:

- `admin@example.com` / `admin`
- `manager@example.com` / `manager`
- `member@example.com` / `member`

Each user also gets a personal team on registration.