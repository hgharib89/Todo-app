# ديوانية الكوت — Diwaniya Kout

A mobile-first, Arabic (RTL) web game of **Kout Bo 6** (كوت بو ٦) and **Kout Bo 4** (كوت بو ٤): you play with bot partners against bot opponents.
It is an original app. The name, card designs and UI are all made for this project, and it uses no branding or assets from any other Kout app.

- React + TypeScript + Vite, deployable to GitHub Pages
- A pure game engine (`src/engine`): `applyAction(state, action) → newState`, with no UI code and no hidden randomness
- **Every rule lives in one file:** [`src/engine/rules.config.ts`](src/engine/rules.config.ts)
- Bots: Easy (random legal moves) and Medium (heuristic bidding and play)
- A Vitest suite covering deck building, bidding, legal moves, every joker rule and preset, the trick winner, scoring and game end

## Run it

```bash
cd kout
npm install
npm run dev        # http://localhost:5173
npm test           # run the unit tests once
npm run build      # type-check + production build into kout/dist
npm run preview    # serve the production build
```

Node 18+ is required (CI uses Node 20).

## Deploy to GitHub Pages

The build uses `base: './'`, so `dist/` works from any sub-path.

**Option A: GitHub Actions (recommended).** The workflow [`.github/workflows/kout-pages.yml`](../.github/workflows/kout-pages.yml) runs the tests, builds the game and publishes the whole repository site: the existing root files stay at `/` and the game is served at `/kout/`.
1. Merge to `main`.
2. In the repository, open **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**.
3. The game will be at `https://<user>.github.io/<repo>/kout/`.

**Option B: manual.** Run `npm run build` and upload the contents of `kout/dist/` to any static host, or to a `gh-pages` branch.

## Editing the rules: `src/engine/rules.config.ts`

The engine reads every rule value from this file, and each option has a comment in Arabic and English. Edit it, then run `npm test` to see what changed.

| Section | What it controls |
|---|---|
| `modes.bo6` / `modes.bo4` | players, cards per player, removed ranks/cards (`removeRanks`, `removeCards`), jokers, dealing chunk size, `teamLayout` (`'alternate'`: partners on every other seat; `'halves'`: partners side by side) |
| `suitRankOrder` | rank order inside a suit (A K Q J 10 … 2) |
| `trumpPowerOrder` | trump strength including jokers, default `XR > A > XB > K > Q > …` |
| `bidding` | bid values (5–9), names (باب / بوان), single round, minimum raise, end on max bid, forced dealer (ملزوم) value, whether the forced dealer may raise |
| `firstLeader`, `firstDealer`, `rotateDealer` | who leads the first trick, who deals first, dealer rotation |
| `jokerPresets` + `activeJokerPreset` | the four joker presets (see below) |
| `endHandEarly` | stop the hand as soon as the bid is made or can no longer be made |
| `scoring`, `malzoomScoring` | points table |
| `gameEnd` | target score (101), shutout score (51 vs 0), Bawan-on-first-hand instant win |

### Joker options (inside each preset)

| Option | Meaning |
|---|---|
| `leadAllowedByBid` | which joker the bidding team may **lead** at each bid, e.g. `{ 9: {red:true, black:true}, 8: {red:true, black:false} }` |
| `leadUnlockedWhenTrumpsPlayed` | trump cards that must all be played before anyone may lead a joker: `['A','K','Q','J']`, `'all'`, or `null` (never) |
| `leadUnlockedIfBidderLacks` | e.g. `'A'`: if the bidder didn't hold the trump Ace when trump was chosen, jokers may be led any time |
| `ledJokerCountsAsTrump` | a legally led joker makes the others follow trump |
| `canPlayWhileHoldingLedSuit` | a joker may be played on someone else's trick even when you can follow suit |
| `illegalForcedLead` | `'cancel'`: a joker forced as the last card is void and the next card sets the suit (a joker played next is void too). `'asTrump'`: it is treated as a legal lead |

### Presets

| Preset | Joker lead allowed when… |
|---|---|
| `default` | team bid 9 → either joker; team bid 8 → red only; or trump A, K, Q, J have all been played |
| `strict` | only team bid 8/9 |
| `stricter` | all trump cards have been played, unless team bid 8/9 |
| `relaxed` | trump Ace has been played; or any time if the bidder didn't hold the trump Ace; plus bid 8/9 |

Players pick the preset in the in-game **Settings** screen. The preset descriptions in Settings and the joker text on the Rules screen are generated from the config (`src/ui/rulesText.ts`), so they always match what the engine does. To change what a preset does, edit `JOKER_PRESETS` in `rules.config.ts`. To try a one-off change in code or in a test, use `buildRules(preset, overrides)`:

```ts
buildRules('default', { endHandEarly: false, jokers: { illegalForcedLead: 'asTrump' } });
```

## Architecture

```
kout/src/
  engine/              pure, UI-free, fully unit-tested
    rules.config.ts    ← all rules
    cards.ts           card ids ('S14' = A♠, 'H10', 'XR'/'XB' jokers), deck building, power
    rng.ts             seeded RNG (the seed is kept in GameState, so the engine stays pure)
    game.ts            state machine: createGame, applyAction, legalActions, legalPlays, playerView
  bots/index.ts        chooseBotAction(state, 'easy' | 'medium'); picks only from legalActions
  ui/                  React screens, table, hand, panels, sounds (WebAudio, no files)
kout/tests/            Vitest suites
```

- Seats run **counter-clockwise**: seat `i+1` sits to the right of seat `i`. Dealing, bidding and play all go that way, and so does the dealer rotation. Teams follow `teamLayout`: with the default `'alternate'` the even seats play the odd seats, so in Bo 6 partners alternate and in Bo 4 partners sit opposite.
- **Online multiplayer later:** run the same engine on a server. Clients send `Action`s, the server validates them with `applyAction` (illegal actions throw) and sends each player `playerView(state, seat)`, which hides the other hands and the RNG seed.
- An unfinished game is saved in `localStorage` and can be resumed from the home screen. When it resumes, it is re-bound to the current `rules.config.ts`.
