# Kout game server (Phase 1)

An **authoritative** multiplayer server for Diwaniya Kout, built with [Colyseus](https://colyseus.io) 0.18 (Node.js + TypeScript).
It imports the same `src/engine` and `src/engine/rules.config.ts` as the app, so the rules can never drift apart.

## What the server does

| | |
|---|---|
| **Owns the game** | Deals with a cryptographic seed, validates every action with the shared engine (`applyAction`), and applies every rule: Larens, Bawn on 7, the joker question, reneging and صيد, and scoring. |
| **Hidden information** | Each player receives only `viewFor(state, seat)`. That contains their own cards (the others are `"??"`), no RNG seed, no renege record and no rules object. The view is rotated so every player sits at seat 0. |
| **Clients only send actions** | Each action arrives as `{type, ...}`. The acting seat is always the sender's own seat: a client cannot act for someone else. |
| **Public matchmaking** | `joinOrCreate('kout', {mode: 'bo6' \| 'bo4'})`. A table waits `KOUT_PUBLIC_WAIT_SECONDS` (12 s) for more people, then Hard bots fill the empty seats. |
| **Private rooms** | `create('kout', {mode, private: true, preset})` gives a 6-letter code (e.g. `K7QF3M`) that is also the room id. Friends join with `joinById(code)` or via the link `…/kout/?room=CODE`, which the app shares on WhatsApp. The host starts the game, and bots fill the empty seats. Private rooms never appear in public matchmaking. |
| **Turn timer** | 20 s to bid or play. On timeout a Hard bot plays for that seat. After 2 timeouts in a row the player counts as away, and a bot plays at once until they act again. |
| **Reconnect** | A dropped player keeps their seat for 120 s while a bot covers their turns. They come back with the reconnection token: the app does this automatically, even after a page refresh. A player who leaves for good is replaced by a bot. |
| **Anti-cheat** | Hidden cards are never sent. Every message passes a token-bucket rate limit (12 burst, 6/s); flooders are logged and then disconnected, with a hard cap of 40 messages/s. Malformed, out-of-turn and illegal actions are rejected, logged and the client is re-synced. Repeated wrong catches or rejected actions are logged as `suspicious`. Browser origins can be allow-listed. |
| **Bots don't slow players down** | Hard bots think in a pool of worker threads (`src/botPool.ts`), so the main thread stays free for players' moves. Under heavy load they use fewer samples instead of queuing. |
| **Logs** | One JSON line per event (`fly logs`): `room_created`, `join`, `game_start`, `turn_timeout`, `rejected_action`, `suspicious`, `game_over`, … With `KOUT_METRICS=10`, rooms, players, CPU, memory and event-loop delay are logged every 10 s. |

Files: `src/KoutRoom.ts` (the room), `src/botPool.ts` + `src/botWorker.ts` (bots in worker threads), `src/view.ts` (per-player views and action mapping), `src/rateLimit.ts`, `src/codes.ts`, `src/config.ts` (timings), `src/app.ts` (server and `/healthz`), `loadtest/loadtest.ts`.

## Run it locally

```bash
cd kout
npm install
npm run server:dev                                   # ws://localhost:2567, health: http://localhost:2567/healthz
VITE_KOUT_SERVER=http://localhost:2567 npm run dev   # the app, with the «العب أونلاين» button
npm test                                             # includes tests/server/* (a real server with real clients)
```

## Settings (environment variables)

Game rules are **not** here; they stay in `src/engine/rules.config.ts`. These are server timings and limits:

| Variable | Default | |
|---|---|---|
| `PORT` | 2567 | |
| `KOUT_BID_SECONDS` / `KOUT_PLAY_SECONDS` | 20 / 20 | turn timer |
| `KOUT_REVIEW_SECONDS` | 8 | end-of-hand صيد window (only when someone could catch) |
| `KOUT_HANDOVER_SECONDS` | 7 | result screen before the next deal |
| `KOUT_PUBLIC_WAIT_SECONDS` | 12 | wait for humans before bots fill a public table |
| `KOUT_RECONNECT_SECONDS` | 120 | how long a dropped player keeps the seat |
| `KOUT_BOT_MIN_MS` / `KOUT_BOT_MAX_MS` | 700 / 1300 | bot "thinking" time |
| `KOUT_DRAW_ROUND_MS` / `KOUT_DEAL_PAUSE_MS` | 1300 / 2900 | pause at the start of a game while clients show the first-dealer card draw and the deal |
| `KOUT_BOT_SAMPLES` | 200 | sampled deals per Hard-bot move (PIMC; lower = less CPU) |
| `KOUT_BOT_TIME_MS` | 1000 | time budget per Hard-bot move (the bot thinks during its "thinking" pause) |
| `KOUT_BOT_WORKERS` | CPU cores | worker threads for bot thinking (0 = main thread) |
| `KOUT_RATE_CAPACITY` / `KOUT_RATE_PER_SECOND` / `KOUT_FLOOD_STRIKES` | 12 / 6 / 40 | rate limit |
| `KOUT_ALLOWED_ORIGINS` | (all) | comma-separated web origins allowed to connect |
| `KOUT_METRICS` | (off) | seconds between metrics log lines |

## Deploy to Fly.io: step by step

You need a Fly.io account with a payment card (Fly bills per use). Never share your password; the steps below use Fly's own login page and a deploy token.

1. Create an account at <https://fly.io/app/sign-up> and add a card under **Billing**.
2. Install the Fly command-line tool on your computer: macOS `brew install flyctl`; Windows (PowerShell) `iwr https://fly.io/install.ps1 -useb | iex`; Linux `curl -L https://fly.io/install.sh | sh`.
3. Log in by running `fly auth login`. It opens Fly's login page in your browser.
4. Create the app. The name must be unique on Fly, for example `diwaniya-kout-yourname`:
   ```bash
   cd kout
   fly apps create diwaniya-kout-yourname
   ```
   Put the same name on the `app = "…"` line of `kout/fly.toml`.
5. Deploy: run `fly deploy` from `kout/`. It builds the `Dockerfile` on Fly's builders.
6. Check it: run `fly status`, then open `https://diwaniya-kout-yourname.fly.dev/healthz`. It should show `{"ok":true,…}`.
7. Connect the website to the server. On GitHub, open the repository → **Settings → Secrets and variables → Actions → Variables → New repository variable**. Set name `KOUT_SERVER_URL` and value `https://diwaniya-kout-yourname.fly.dev`, then re-run the **Deploy site (with Kout) to GitHub Pages** workflow. The «🌐 العب أونلاين» button appears on the home screen.
8. Optional automatic server deploys: run `fly tokens create deploy -x 999999h`, then add the output as a repository **secret** named `FLY_API_TOKEN` (**Settings → Secrets and variables → Actions → Secrets**). From then on, every push to `main` that changes the server or the engine runs the tests and deploys (`.github/workflows/kout-server.yml`).
9. Watch it with `fly logs` (add `fly secrets set KOUT_METRICS=60` to get a metrics line every minute).

**Region.** `bom` (Mumbai) is the closest Fly region to the Gulf. You can change `primary_region` in `fly.toml`.

**Railway instead of Fly.** Create a project from the GitHub repo with root directory `kout`. Railway detects the `Dockerfile`. Set `PORT=2567`, expose the port, and use the generated `https://…up.railway.app` URL in step 7.

**Note on deploys.** Games live in the server's memory, so a deploy restarts the machine and ends running games (players see the reconnect banner, then go back to the menu). Deploy at quiet times. Persisting rooms comes with the database in Phase 2.

## Costs (rough estimates; check <https://fly.io/docs/about/pricing/>)

- One `shared-cpu-2x` machine with 1 GB of RAM, running all month, costs roughly **US$10–15 per month**. The load test shows it handles **600+ concurrent players** at 5.5 ms p99, or about 300 tables where everyone plays alone with bots.
- Traffic is small: a full game sends a few hundred small JSON messages per player, which comes to a few dollars of bandwidth even at thousands of games per day.
- To grow beyond one machine: Colyseus supports several processes or machines with Redis presence and driver (`@colyseus/redis-presence`, `@colyseus/redis-driver`, for example Upstash Redis). This is not needed at launch. The first step is a bigger machine (`performance-2x`).

## Load test

`npm run loadtest -- --url http://localhost:2567 --players 500 --duration 240` runs simulated players against a running server. Each one joins public matchmaking, takes 0.3–1.5 s per decision, plays with the Easy bot from its own view (so it sometimes reneges and gets caught), votes for the next hand, and starts a new game when one ends.
Results are in [`LOADTEST.md`](LOADTEST.md). In short, on 2 cores: 600 concurrent players answered in 0.6 ms (p50) and 5.5 ms (p99), with 0 errors and 0 drops.
