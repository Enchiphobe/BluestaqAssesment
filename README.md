# Bluestaq Assesment
This Repository was created as part of an assesment for BlueStaq.

## Design Decisions
### Language and Framework
This required very little thought. I was building on my personal Windows desktop, which I almost never use for development. I had no languages or frameworks installed or set up. Just VSCode. I picked plain node and no framework for speed to deploy, since it could all be set up in about 5 minutes. In a production or corporate environment, the result would likely be different, but the considerations would likely be similar. For an app targetting a small number of teams, designed to be usable quickly, choosing something that'll get devs up quickly and the product launched sooner are critical considerations. But it'd probably result in SpringBoot or something the team is already very familiar with.

### Design Decisions
#### Authorization Structure
I wrestled with how to set up authorization. The initial design included one top-level owner, team admins, and regular members. This worked cleanly for a pretty stagnant use case, but didn't reflect how I've seen multiple interactive teams function. Teams get created and destroyed semi-frequently, sometimes folks are members of one team but owners of another, etc. And this structure also didn't cleanly support personal notes. I decided to migrate the auth structure to one with two top-level roles: admin and user. Admins can do everything, usershave resource-scoped permissions on a given team. They would all be managers of their own personal team as well. With this in place, I had to figure out how to add/remove members to a given team. My initial design included managers inviting users to teams with an email code - but I did not have time to implement such functionality. So I allowed them to just edit the teams with an API call. I also realized this would be secure, but not really functional for many types of teams. So I also created two types of teams - public and private. Public ones could be joined by anybody, private required adding by a manager.

#### Data
I initially just had notes stored as jsons locally. This worked as a proof of concept, but wasn't very robust and could not handle growth well. In a production environment I would probably set up a DynamoDB to scale well and handle schema updates cleanly as the app grew. But implementing that in a local-only app would be too difficult in three hours. I split the difference and set up an SQLite DB. Testing it was, initially, annoying, because I had to register users and stuff, so I added a seeding script to make it usable right at deploy. I was pretty proud of that - it would have no effect on production performance but making development easier and faster is always nice.

#### Operational Excellence
These were things I was keeping in mind, but pushed back to the end of the project. I wanted to add normal latency and reliability safeguards: pagination, throttling. But in order to deliver a full feature suite sooner, pushed them to the end and therefore did not test them as well as I would have liked. 

### What I would change/do next
- Add an MCP layer. REST APIs are cool but the future is MCPs. I think if you're building new APIs, you have to consider that humans are going to stop using them in the near future, it'll just be agents. 
- Add a UI. Not part of the prompt so I didn't bother, but it's an obvious next step.
- Divorce notes from teams. Notes are currently scoped just to teams, but making them shareable between teams would save users a lot of copy-pasting time.


# Notes API

Team-based note taking REST API. Express 5 + TypeScript + SQLite (`better-sqlite3`).

# Quickstart Guide

## Install Dependencies

```
npm install
```

## Run test suite

Run unit and API tests with:

```
npm test
```

The API tests start their own server and use an in-memory database, so you do not need to start the API separately.

## Reset DB (Optional)
The SQLite DB is retained by default. If you want to deploy a fully fresh build, first delete it.

On Windows, use:

```powershell
Remove-Item data\notes.db*
```

On Linux/macOS, use:

```bash
rm -f data/notes.db*
```

Seeded users are created automatically alongside a new db when running in development mode with no existing local db:

- `admin@example.com` / `admin`
- `manager@example.com` / `manager`
- `member@example.com` / `member`

Each user also gets a personal team on registration.

## Run Locally
```
npm run dev        # auto-restarts on save (tsx watch)
```

The server starts on http://localhost:3000 and creates `data/notes.db` on first run.

## Run Production-Style
Production-style:

```
npm run build
npm start
```

## Verify
### Windows (Powershell)
#### 1. Log in and keep the token
```
$login = Invoke-RestMethod -Method Post -Uri http://localhost:3000/auth/login `
  -ContentType "application/json" `
  -Body '{"email":"manager@example.com","password":"manager"}'
$headers = @{ Authorization = "Bearer $($login.token)" }
```

#### 2. List your teams
```
$teams = Invoke-RestMethod -Uri http://localhost:3000/teams -Headers $headers
$team = $teams | Where-Object { $_.name -eq "Demo Team" }
```

#### 3. Create the note
```
Invoke-RestMethod -Method Post -Uri "http://localhost:3000/teams/$($team.id)/notes" `
  -Headers $headers -ContentType "application/json" `
  -Body '{"title":"This works","content":"This works","tags":["work"],"pinned":true}'
```

#### 4. Confirm the note landed
```
Invoke-RestMethod -Uri "http://localhost:3000/teams/$($team.id)/notes" -Headers $headers
```

#### 5. Useful admin actions
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

### Linux/macOS (Bash)

These examples use `curl` and `jq` to make the same requests from Bash. Install `jq` if it is not already available.

#### 1. Log in and keep the token
```bash
TOKEN=$(curl -fsS -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"manager@example.com","password":"manager"}' | jq -r '.token')
```

#### 2. Find your Demo Team ID
```bash
TEAM_ID=$(curl -fsS http://localhost:3000/teams \
  -H "Authorization: Bearer $TOKEN" | jq -r '.[] | select(.name == "Demo Team") | .id')
```

#### 3. Create a note
```bash
curl -fsS -X POST "http://localhost:3000/teams/$TEAM_ID/notes" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"title":"This works","content":"This works","tags":["work"],"pinned":true}'
```

#### 4. Search notes and confirm it landed
```bash
curl -fsS --get "http://localhost:3000/teams/$TEAM_ID/notes" \
  -H "Authorization: Bearer $TOKEN" \
  --data-urlencode 'q=This works'
```

#### 5. Useful admin actions
```bash
ADMIN_TOKEN=$(curl -fsS -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"admin"}' | jq -r '.token')

# List all teams
curl -fsS 'http://localhost:3000/teams?all=true' \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq

# Find the user's ID, then promote them to admin
USERS=$(curl -fsS http://localhost:3000/users \
  -H "Authorization: Bearer $ADMIN_TOKEN")
printf '%s\n' "$USERS" | jq '.[] | {id, email, role}'
TARGET_ID=$(printf '%s\n' "$USERS" | jq -r '.[] | select(.email == "member@example.com") | .id')
curl -fsS -X PATCH "http://localhost:3000/users/$TARGET_ID/role" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"role":"admin"}'
```

### Other Notes
Other scripts: `npm run typecheck`.

Try requests with `requests.http` (VSCode "REST Client" extension).


# Development Guide 
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
| GET | `/teams/:teamId/members` | team member or admin |
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

Collection endpoints accept `?page=` and `?limit=`. The defaults are page 1 and 25 items; the maximum page size is 100. Pagination metadata is returned in the `X-Page`, `X-Page-Size`, `X-Total-Count`, and `X-Total-Pages` response headers. This applies to users, team lists, team members, and notes.

Requests are limited to 300 per IP every 15 minutes. Registration is additionally limited to 10 attempts per IP per hour. A limited request returns `429 Too Many Requests`. If the API is behind a reverse proxy, configure Express to trust only the proxy hops you control so client IP-based limits work correctly.

Access rules:

- `admin` users can open any team and list all teams/users.
- Team membership controls access to team data.
- `manager` is the team-level role; admins are treated as managers everywhere they can access a team.
- `member` can read notes, create notes, and edit their own notes.
- Personal teams are intentionally restricted to the owner and admins and cannot be shared or modified by others.
- Public teams can be joined by any logged-in user; private teams cannot be joined by ID.