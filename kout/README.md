# ديوانية الكوت — Diwaniya Kout

A mobile-first, Arabic (RTL) web game of **Kout Bo 6** (كوت بو ٦) and **Kout Bo 4** (كوت بو ٤): you play with bot partners against bot opponents.
It is an original app. The name, card designs and UI are all made for this project, and it uses no branding or assets from any other Kout app.

- React + TypeScript + Vite, deployable to GitHub Pages
- A pure game engine (`src/engine`): `applyAction(state, action) → newState`, with no UI code and no hidden randomness
- **Every rule lives in one file:** [`src/engine/rules.config.ts`](src/engine/rules.config.ts)
- Bots: Easy (random legal moves), Medium (heuristic bidding and play) and **Hard** (the default: card counting, void inference, hand-strength bidding and Monte Carlo card play)
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

## Install it as an app (PWA)

The game is an installable Progressive Web App that works fully offline.

- **Manifest** (`public/manifest.webmanifest`): name «ديوانية الكوت» (short name «الكوت»), RTL Arabic, `display: standalone`, portrait orientation, theme and background colour `#0b2226`.
- **Icons** (`public/icons/`): original artwork in 192 and 512 px (plus maskable versions), a 180 px Apple touch icon, a 32 px favicon and an SVG. The source is `assets/icon.svg`; regenerate the PNGs with `node scripts/make-icons.cjs` (needs Playwright's Chromium).
- **Offline**: the build generates `dist/sw.js` (`pwa/serviceWorkerPlugin.ts` + `pwa/sw.template.js`). It precaches every built file, including the bundled Arabic fonts (no Google Fonts request), and its cache version changes with every build. Pages are network-first with the cached app as fallback; files are cache-first. It only handles requests inside its own folder, so it doesn't clash with other apps on the same site.
- **iOS**: `apple-mobile-web-app-capable`, a `black-translucent` status bar, the home-screen title and the touch icon give full-screen standalone mode. Safe-area padding keeps the UI clear of the notch.
- **Installing**: Android and desktop Chrome show a «ثبّت اللعبة» button on the home screen. On iPhone and iPad the home screen shows the Share → Add to Home Screen hint.
- **Check it**: run `npm run build`, serve `dist/`, then run `node scripts/check-pwa.cjs <url>`. It checks installability, precaching, and that the game loads and deals a hand offline.

## Editing the rules: `src/engine/rules.config.ts`

The engine reads every rule value from this file, and each option has a comment in Arabic and English. Edit it, then run `npm test` to see what changed.

| Section | What it controls |
|---|---|
| `modes.bo6` / `modes.bo4` | players, cards per player, removed ranks/cards (`removeRanks`, `removeCards`, which accepts `'H6'` or `'6H'`), jokers, dealing chunk size, `teamLayout` (`'alternate'`: partners on every other seat; `'halves'`: partners side by side) |
| `suitRankOrder` | rank order inside a suit (A K Q J 10 … 2) |
| `trumpPowerOrder` | trump strength including jokers, default `XR > A > XB > K > Q > …` |
| `bidding` | contract values (5–9), `minVoluntaryBid` (6: players may bid 6, 7, 8 or 9), `malzoomBid` (5: only the forced dealer may take it), names (ملزوم / لارنس), single round, minimum raise, end on max bid, whether the forced dealer may raise instead |
| `firstLead` | who leads the first card of the hand: `'rightOfBidder'` (default: the player to the winning bidder's right; the bidder still chooses trump), `'bidder'` or `'rightOfDealer'`. After that the trick winner leads |
| `bo4Removed6s` | the 6s removed from the Bo 4 deck, written rank + suit: default `['6H', '6C']` (the 6♠ and 6♦ stay), giving 36 cards |
| `firstDealer`, `rotateDealer` | who deals first, dealer rotation |
| `jokerPresets` + `activeJokerPreset` | the four joker presets (see below) |
| `playToLastCard` | `true` (default): every hand is played to the last card. `false`: stop as soon as the bid is made or can no longer be made |
| `renege` | reneging and catching (القطع والصيد), see below: `allowRenege`, `renegePenaltyMultiplier`, `wrongCatchPenalty`, `botCatchChance`, `botRenegeChance` |
| `scoring`, `malzoomScoring` | points table |
| `gameEnd` | `targetScore` (54: first team to 54+ wins), `shutoutTarget` (36: 36+ while the other team has 0 wins; `null` disables it) |
| `larens` | bid 9 = لارنس: `larensWinsGame` (true: making it wins the whole game at once, قيم), `larensFailPoints` (18 to the opponents), `larensMadePoints` (only used when `larensWinsGame` is false) |
| `bawn` | باون: `bawnOnBid` (7; `null` = off), `bawnAskAtTricks` (6), `bawnWinPoints` (36), `bawnFailPoints` (18) |
| `jokerAsk` | سؤال الجوكر: `allowJokerAsk`, `jokerAskYesBid` (9 = Larens), `jokerAskNoBid` (8) |

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
buildRules('default', { playToLastCard: false, jokers: { illegalForcedLead: 'asTrump' } });
```

## Reneging and catching (القطع والصيد)

Like a real table, the game doesn't stop you playing a wrong card.

- **Reneging.** With `renege.allowRenege` (default `true`), any card in your hand can be played even when you hold the led suit. Only the joker rules still block cards. The engine silently records every renege in `state.reneges`, which is hidden: `playerView` strips it and bots never read it.
- **Evidence.** A catch needs proof everyone can see: the player didn't follow suit S in one trick, then played an S card later in the same hand. `renegeEvidence(state)` finds this from the table alone. Because every hand is played to the last card (`playToLastCard`), every renege has proof by the end of the hand.
- **Calling صيد.** During play, anyone can call صيد on an opponent (action `CATCH`, or the 🎯 صيد button: pick the opponent, then the trick). After the last card the hand goes to a short `review` phase where the table can still catch. `END_REVIEW` then scores the hand normally.
- **Penalty.** A correct catch breaks the hand for the reneging team, whether it bid or defended. The catchers get bid × `renegePenaltyMultiplier` (2) and the renegers get 0. A wrong catch does nothing (`wrongCatchPenalty: 'none'`); `'brokenHand'` would break the hand for the caller instead.
- **Bots.** Bots catch only from visible evidence, with chance `botCatchChance` (Hard 100%, Medium 60%, Easy 25%), deciding once per piece of evidence and once more at the review. Easy and Medium occasionally renege by mistake (`botRenegeChance`: Easy 6%, Medium 3% of the cards where they could; Hard 0%).

## Larens, Bawn and the joker question

- **Larens (لارنس, bid 9).** If the bidding team takes all 9 tricks it wins the whole game on the spot (قيم), whatever the score. If it fails, the opponents get 18.
- **Bawn (باون).** On a bid of 7, the moment the bidding team has 6 tricks, play pauses (`bawnAsk` phase) and the bidder is asked «تبي باون؟» (action `BAWN`).
  - **No:** the hand goes on as a normal 7.
  - **Yes:** the team must win every remaining trick. If it does, it gets 36; if it loses one, the hand is broken and the opponents get 18.
  - A «باون» badge shows in the header once it is declared. Hard bots decide by simulating the rest of the hand from what they can see; Easy and Medium say yes when every card they hold is a sure winner.
- **Joker question (سؤال الجوكر).** On their bidding turn, a player holding exactly one joker may ask «عندك الجوكر الثاني؟» (action `JOKER_ASK`, only while 8 and 9 are still legal bids).
  - The answer is automatic and truthful, and is shown on the table under the partner. In Bo 6, "yes" means any partner has it.
  - Yes forces a Larens bid; no forces an 8.
  - Hard bots also use the answer when they imagine the hidden hands.

## Bots

Bots play from `legalPlays`, so they follow whatever `rules.config.ts` says. The only exception is the configured chance of a mistaken renege for Easy and Medium. They read only their own hand plus public information.

| Level | Bidding | Play |
|---|---|---|
| Easy | mostly passes, otherwise a low bid | random legal card |
| Medium | rough trick estimate | simple rules: draw trumps, cash winners, play low behind a winning partner |
| **Hard** (default) | hand strength per trump suit (jokers, trump Ace, length, side winners, ruffs) plus what the bidding says about partners, turned into a chance of making each bid; it bids only when that chance is at least 70% and the expected score is positive, and only bids Larens with a monster hand (valuing a Larens as winning the game); it asks about the joker when the expected result beats its best plain bid and an 8 would still be safe | **Monte Carlo**: tracks every played card, infers who is out of which suit, then samples hidden hands that fit (40 by default), plays each candidate card out to the end of the hand and picks the best average result; ties go to the cheaper card, so jokers and the trump Ace are kept for when they matter, and it doesn't overtake a winning partner |

In simulated games (Hard team against Medium team) Hard won 18 of 30 Bo 4 games and 14 of 16 Bo 6 games (with the first card led from the bidder's right). A Hard move takes about 12 ms in Bo 4 and 17 ms in Bo 6 on average.

## Architecture

```
kout/src/
  engine/              pure, UI-free, fully unit-tested
    rules.config.ts    ← all rules
    cards.ts           card ids ('S14' = A♠, 'H10', 'XR'/'XB' jokers), deck building, power
    rng.ts             seeded RNG (the seed is kept in GameState, so the engine stays pure)
    game.ts            state machine: createGame, applyAction, legalActions, legalPlays, playerView
  bots/index.ts        chooseBotAction(state, 'easy' | 'medium' | 'hard'); picks only from legalActions
  bots/hard.ts         card counting, void inference, bidding by hand strength, Monte Carlo play
  ui/                  React screens, table, hand, panels, sounds (WebAudio, no files)
kout/tests/            Vitest suites
```

- Seats run **counter-clockwise**: seat `i+1` sits to the right of seat `i`. Dealing, bidding and play all go that way, and so does the dealer rotation. Teams follow `teamLayout`: with the default `'alternate'` the even seats play the odd seats, so in Bo 6 partners alternate and in Bo 4 partners sit opposite.
- **Online multiplayer later:** run the same engine on a server. Clients send `Action`s, the server validates them with `applyAction` (illegal actions throw) and sends each player `playerView(state, seat)`, which hides the other hands and the RNG seed.
- An unfinished game is saved in `localStorage` and can be resumed from the home screen. When it resumes, it is re-bound to the current `rules.config.ts`.
