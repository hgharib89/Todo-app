// Arabic rule descriptions generated from the rules config, so the UI text always
// matches what the engine actually does. No rule values live here.
import { JokerPresetId, JokerRules, RulesConfig, SUIT_NAME_AR, TrumpRankName, parseCard, removedCards } from '../engine';
import { ar } from './layout';

export const TRUMP_RANK_AR: Record<TrumpRankName, string> = { A: 'إكَه', K: 'شايب', Q: 'بنت', J: 'ولد' };

function joinAr(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(' و')} و${items[items.length - 1]}`;
}

function bidName(rules: RulesConfig, v: number): string {
  const n = rules.bidding.names[v];
  return n && n !== ar(v) ? n : ar(v);
}

/** When may a joker be led? e.g. "بوان: أي جوكر · ٨: الأحمر فقط · أو بعد نزول إكَه وشايب وبنت وولد الحكم" */
export function describeJokerLead(jr: JokerRules, rules: RulesConfig): string {
  const parts: string[] = [];
  const bids = Object.keys(jr.leadAllowedByBid)
    .map(Number)
    .sort((a, b) => b - a);
  for (const v of bids) {
    const p = jr.leadAllowedByBid[v];
    if (!p || (!p.red && !p.black)) continue;
    const which = p.red && p.black ? 'أي جوكر' : p.red ? 'الأحمر فقط' : 'الأسود فقط';
    parts.push(`${bidName(rules, v)}: ${which}`);
  }
  const unlock = jr.leadUnlockedWhenTrumpsPlayed;
  if (unlock === 'all') parts.push('أو بعد نزول كل أوراق الحكم');
  else if (unlock && unlock.length) parts.push(`أو بعد نزول ${joinAr(unlock.map((r) => TRUMP_RANK_AR[r]))} الحكم`);
  if (jr.leadUnlockedIfBidderLacks) {
    parts.push(`وإذا المزايد ما عنده ${TRUMP_RANK_AR[jr.leadUnlockedIfBidderLacks]} الحكم يجوز أي وقت`);
  }
  if (parts.length === 0) return 'ما يجوز البدء بالجوكر';
  return parts.join(' · ');
}

/** The remaining joker rules (following, counting as trump, forced lead), as full sentences. */
export function describeJokerPlay(jr: JokerRules): string[] {
  return [
    jr.canPlayWhileHoldingLedSuit
      ? 'الجوكر ينلعب على أكلة غيرك في أي وقت، حتى لو عندك النقش.'
      : 'الجوكر ما ينلعب على أكلة غيرك إذا عندك النقش المطلوب (إلا إذا النقش حكم).',
    jr.ledJokerCountsAsTrump
      ? 'إذا بدأت بالجوكر بشكل قانوني يحسب حكم، والباقي لازم يلعبون حكم إذا عندهم.'
      : 'إذا بدأت بالجوكر ما يحدد النقش، وأول ورقة عادية بعده تحدد النقش.',
    jr.illegalForcedLead === 'cancel'
      ? 'إذا اضطر لاعب يبدأ بجوكر وهو آخر ورقة عنده بدون ما يحق له، يُلغى الجوكر والورقة اللي بعده تحدد النقش (وإذا انلعب جوكر بعده يُلغى بعد).'
      : 'إذا اضطر لاعب يبدأ بجوكر وهو آخر ورقة عنده، يُحسب كبداية قانونية.',
  ];
}

export function presetDescription(preset: JokerPresetId, rules: RulesConfig): string {
  return describeJokerLead(rules.jokerPresets[preset], rules);
}

/** Who leads the first card, as a sentence. */
export function describeFirstLead(rules: RulesConfig): string {
  switch (rules.firstLead) {
    case 'bidder':
      return 'صاحب أعلى طلب يختار الحكم ويبدأ أول ورقة.';
    case 'rightOfDealer':
      return 'صاحب أعلى طلب يختار الحكم، واللي على يمين الموزع يبدأ أول ورقة.';
    case 'rightOfBidder':
    default:
      return 'صاحب أعلى طلب يختار الحكم، واللي على يمينه يبدأ أول ورقة.';
  }
}

/** Arabic list of the specific cards removed from a mode's deck, e.g. "٦ هاص و٦ سبيت". */
export function describeRemovedCards(rules: RulesConfig, mode: 'bo4' | 'bo6'): string {
  return removedCards(rules, mode)
    .map((id) => {
      const c = parseCard(id);
      return c.suit && c.rank ? `${ar(c.rank)} ${SUIT_NAME_AR[c.suit]}` : id;
    })
    .join(' و');
}
