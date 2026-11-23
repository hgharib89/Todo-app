# Hard bot v2 — benchmark against the previous Hard bot

**Setup.** Self-play in Kout Bo 4 with the default rules: 200 complete games (each to 54 points), 4 × 50 games with different seeds (`scripts/bench-bots.ts`). The new bot's team and the old bot's team switch sides every game. The new bot ran at a reduced budget to make the benchmark affordable here: **60 sampled deals per move** (the game uses 200, with a 1-second cap), 40 deals per trump suit when bidding.

| | **New Hard (v2)** | Old Hard (v1) |
|---|---|---|
| **Games won** | **117 (58.5 %)** | 83 (41.5 %) |
| Points scored (all hands) | 9,729 | 9,365 |
| Voluntary bids made | 430 / 503 (85.5 %) | 454 / 543 (83.6 %) |
| Forced Malzoom made | 810 / 1,173 (69.1 %) | 762 / 1,154 (66.0 %) |
| Larens made / bid | 0 / 1 | 0 / 0 |
| Bawn made / declared (only at 6–0) | 2 / 2 | 4 / 4 |
| Joker questions asked | 4 | 0 |
| **Jokers played on the last trick** | **17.2 %** | 27.7 % |
| Jokers still in hand when the hand's result was settled (per hand) | **0.32** | 0.38 |
| Average trick number of joker plays (all / while the result was still open) | 5.6 / 4.7 | 5.7 / 4.6 |
| Joker plays that won their trick (result still open) | 96.1 % | 95.8 % |

117–83 is about 2.4 standard errors above an even split.

**How we got there** (Bo 4, 80-game samples against the old bot):
- **New card play with the old bidding:** won 48–32. The card play is clearly stronger.
- **Bidding purely from simulation:** about even overall. The simulations see every card, so they overstate what a real bidder makes: it made only 74 % of its bids, and a failed bid costs double.
- **The fix:** the bid *level* now comes from the calibrated hand-strength estimate, while simulation chooses the trump suit, the joker question and the Bawn answer. That is the configuration measured above.

**Joker timing.** The old bot played 28 % of its jokers on the very last trick. The cause: under most contracts a joker can't be led, so a player who keeps winning tricks never gets to play it, until it is forced out as a cancelled last lead. The new bot treats such a "stuck" joker as a card to spend on someone else's trick while it still can (worth about as much as a trump of the same strength), and once a hand's result is settled it cashes its strongest cards first.

**Reproduce:**
```bash
cd kout
npx vite-node scripts/bench-bots.ts --games 50 --mode bo4 --seed 201 --deals 60 --timeMs 5000 --bidDeals 40
```
