# Load test report: Kout game server (Phase 1)

**Date:** 2026-11-22 · **Server:** the production bundle (`npm run server:build`, Node 22), default timings · **Client:** `server/loadtest/loadtest.ts`, real WebSocket clients using the Colyseus SDK.
The server was pinned to **2 CPU cores** (`taskset -c 0,1`, `KOUT_BOT_WORKERS=2`) to match the recommended Fly machine (`shared-cpu-2x`, 1 GB). The simulated clients ran on the other 2 cores.

Simulated players behave like people. Each one:
- joins matchmaking and takes 0.3–1.5 s per decision;
- plays from its own view (the server never sends it other cards) with the Easy bot, so it sometimes reneges and gets caught («أكاشف»);
- votes for the next hand, and starts a new game when one ends.

**Latency** is the time from sending a move (bid, trump, card, Bawn answer, joker question) to receiving the server's answer. "Next hand" votes are not timed, because they wait for the other players.

## Results

| Scenario | Concurrent players | Tables | Moves answered | Move latency p50 / p90 / p99 / max | Server CPU (of 200%) | Memory | Event-loop delay p99 | Errors / drops |
|---|---|---|---|---|---|---|---|---|
| **A. Public matchmaking**, 3 min | **600** | 118 | 21,464 | **0.6 / 1.1 / 5.5 / 61 ms** | avg 9 %, max 10 % | 145 MB | ≤ 3.9 ms | 0 / 0 |
| **B. Every player alone with bots**, 2 min | 150 (+≈700 Hard bots) | 150 | 3,065 | 0.5 / 1.8 / 6.8 / 109 ms | avg 91 %, max 139 % | 220 MB | ≤ 4.6 ms | 0 / 0 |
| **C. Every player alone with bots**, 2 min | 300 (+≈1,300 Hard bots) | 300 | 6,045 | 0.5 / 2.2 / 6.1 / 71 ms | avg 143 %, max 183 % | 253 MB | ≤ 4.5 ms | 0 / 0 |

In scenario A, 486 games were played to the end in 3 minutes (756 joins, 0 join errors). An earlier 4-core run with 500 players gave the same picture: 506 games, 0 errors, 0 drops.

## What we learned (and fixed)

- **Bots are the real cost, not players.** Real players cost almost nothing: in scenario A the server sits at about 9 % of one core. The CPU goes into Hard-bot Monte Carlo thinking.
- **First version: bots on the main thread.** In the first run of B and C, bot thinking ran on the server's single main thread. At 150 solo tables the CPU hit 100 % and human moves took up to **2–4 s** (p99 2.0 s at 150 tables, 4.1 s at 300).
- **Fix: a worker-thread pool** (`server/src/botPool.ts`, one worker per core, `KOUT_BOT_WORKERS`). The main thread stays free for players, so human moves stay at **~6 ms p99** even at 300 bot-heavy tables on 2 cores.
- **Load shedding.** When the bot queue backs up, bots use fewer Monte Carlo samples (40 → 20 → 10). They get slightly weaker under extreme load instead of slowing everyone down. This happened briefly at 300 solo tables (`bot_overload` in the logs).
- **Memory** stays small: about 0.25–0.4 MB per table.

## Capacity guide (one `shared-cpu-2x` machine)

- **Mostly human tables:** well over **600 concurrent players**; CPU would allow several thousand. The limit is the connection cap in `fly.toml` (`soft_limit 3000`).
- **Mostly bot tables** (players alone with bots): **about 300 tables** stay smooth. Beyond that, bots think with fewer samples. For more, use a bigger machine (`performance-2x` or `-4x`), since workers scale with cores, or add a second machine with Redis (see `README.md`).

## How to reproduce

```bash
cd kout
npm run server:build
KOUT_METRICS=10 KOUT_BOT_WORKERS=2 taskset -c 0,1 node server/dist/index.cjs > server.log &
taskset -c 2,3 npm run loadtest -- --players 600 --duration 180          # scenario A
taskset -c 2,3 npm run loadtest -- --solo --players 300 --duration 120   # scenario C
grep '"metrics"' server.log                                              # CPU, memory, event-loop delay every 10 s
```
