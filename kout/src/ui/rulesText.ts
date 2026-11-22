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

/** When may a joker be led? e.g. "لارنس: أي جوكر · ٨: الأحمر فقط · أو بعد نزول إكَه وشايب وبنت وولد الحكم" */
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

/** The reneging & catching rules (القطع والصيد) as sentences, from rules.renege / rules.playToLastCard. */
export function describeRenege(rules: RulesConfig): string[] {
  const r = rules.renege;
  const out: string[] = [];
  out.push(rules.playToLastCard ? 'كل يد تنلعب لآخر ورقة.' : 'اليد تنتهي أول ما تنحسم النتيجة.');
  if (!r.allowRenege) {
    out.push('اللعبة تمنع القطع الغلط: لازم تلحق النقش إذا عندك.');
    return out;
  }
  out.push('تقدر تلعب أي ورقة من يدك، بس إذا ما لحقت النقش وعندك منه هذا قطع غلط (الجوكر مو قطع).');
  out.push('الصيد: إذا لاعب ما لحق نقش، وبعدين لعب من نفس النقش في نفس اليد، تقدر تصيده. وفي آخر اليد تنراجع كل الأوراق ويقدر أي أحد يصيد.');
  out.push(`إذا انصاد القطع: تنكسر اليد على الفريق اللي قطع، والفريق اللي صاد ياخذ ${ar(r.renegePenaltyMultiplier)} أضعاف الطلب، واللي قطع ياخذ صفر.`);
  out.push(r.wrongCatchPenalty === 'none' ? 'الصيد الغلط ما عليه شي.' : 'الصيد الغلط: تنكسر اليد على الفريق اللي صاد.');
  const pct = (x: number) => `${ar(Math.round(x * 100))}٪`;
  out.push(`البوتات تصيد بس من اللي شافته: صعب ${pct(r.botCatchChance.hard)}، متوسط ${pct(r.botCatchChance.medium)}، سهل ${pct(r.botCatchChance.easy)}.`);
  return out;
}

/** Larens (لارنس) rules as sentences, from rules.larens. */
export function describeLarens(rules: RulesConfig): string[] {
  const l = rules.larens;
  const name = bidName(rules, rules.bidding.larens);
  return [
    l.larensWinsGame
      ? `${name} (طلب ${ar(rules.bidding.larens)}): إذا أخذ الفريق المزايد كل الأكلات يفوز باللعبة كلها فوراً (قيم) مهما كانت النتيجة.`
      : `${name} (طلب ${ar(rules.bidding.larens)}): إذا أخذ الفريق المزايد كل الأكلات ياخذ ${ar(l.larensMadePoints)}.`,
    `إذا انكسر ${name}: الخصم ياخذ ${ar(l.larensFailPoints)}.`,
  ];
}

/** Bawn (باون) rules as sentences, from rules.bawn. */
export function describeBawn(rules: RulesConfig): string[] {
  const b = rules.bawn;
  if (b.bawnOnBid === null) return [];
  return [
    `الباون: إذا الطلب ${ar(b.bawnOnBid)} ووصل الفريق المزايد ${ar(b.bawnAskAtTricks)} أكلات، ينسأل المزايد: «تبي باون؟»`,
    `إذا قال نعم لازم ياخذون كل الأكلات الباقية: إذا جابوها ياخذون ${ar(b.bawnWinPoints)}، وإذا راحت عليهم أكلة تنكسر والخصم ياخذ ${ar(b.bawnFailPoints)}. وإذا قال لا تكمل اليد عادي.`,
  ];
}

/** Joker-question (سؤال الجوكر) rules as sentences, from rules.jokerAsk. */
export function describeJokerAsk(rules: RulesConfig): string[] {
  const j = rules.jokerAsk;
  if (!j.allowJokerAsk) return [];
  return [
    `سؤال الجوكر: اللي عنده جوكر واحد بس يقدر يسأل شريكه في دوره بالمزايدة: «عندك الجوكر الثاني؟» والجواب يطلع على الطاولة.`,
    `إذا عنده: السائل مجبور يطلب ${bidName(rules, j.jokerAskYesBid)}. إذا ما عنده: مجبور يطلب ${bidName(rules, j.jokerAskNoBid)}. السؤال يجوز بس إذا الطلبين لسا مسموحين.`,
  ];
}

/** Who deals (الخبّاص), from rules.firstDealer and rules.dealerRotation. */
export function describeDealer(rules: RulesConfig): string[] {
  const first =
    rules.firstDealer === 'lowestCardDraw'
      ? 'أول خبّاص في كل لعبة: كل لاعب يسحب ورقة مكشوفة (بدون الجوكر)، وأصغر ورقة تخبّص (٢ أصغر شي والإكَه أكبر شي). إذا تعادلوا، المتعادلين بس يسحبون من جديد.'
      : 'أول خبّاص في كل لعبة يتحدد عشوائياً.';
  const after =
    rules.dealerRotation === 'loserKeepsDeal'
      ? 'بعد كل يد: إذا فريق الخبّاص ما سجّل ولا نقطة (خسر، حتى لو انصاد بقطع) يخبّص نفسه مرة ثانية. وإذا سجّل نقاط، التخبيص ينتقل للي على يمينه.'
      : 'بعد كل يد: التخبيص ينتقل للي على يمين الخبّاص.';
  return [first, after];
}
