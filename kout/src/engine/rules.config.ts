/**
 * ============================================================================
 *  rules.config.ts — كل قوانين اللعبة في ملف واحد / ALL game rules in ONE file
 * ============================================================================
 *
 *  عدّل القيم هنا لتغيير طريقة اللعب. المحرك (engine) يقرأ كل قانون من هذا الملف
 *  ولا توجد أي قيمة قانون مكتوبة في مكان آخر.
 *
 *  Edit the values below to change how the game is played. The engine reads
 *  every rule from this file — no rule value is hard-coded anywhere else.
 *
 *  ترميز الأوراق / Card notation:
 *    - النقش / suits:  'S' = سبيت ♠ spades, 'H' = هاس ♥ hearts,
 *                      'D' = ديمن ♦ diamonds, 'C' = كلفس ♣ clubs
 *    - الرتبة / ranks: 2..10, 11 = J (ولد), 12 = Q (بنت), 13 = K (شايب), 14 = A (إكَه)
 *    - الجوكر / jokers: 'XR' = الجوكر الأحمر (red joker), 'XB' = الجوكر الأسود (black joker)
 *    - ورقة / card id: suit + rank, e.g. 'S14' = A♠, 'H6' = 6♥, 'D10' = 10♦
 * ============================================================================
 */

export type Suit = 'S' | 'H' | 'D' | 'C';
export type JokerId = 'XR' | 'XB';
/** 2..14 (11=J, 12=Q, 13=K, 14=A) */
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;
export type ModeId = 'bo6' | 'bo4';
export type JokerPresetId = 'default' | 'strict' | 'stricter' | 'relaxed';

export type TeamLayout = 'alternate' | 'halves';

export interface ModeRules {
  /** عدد اللاعبين / number of players */
  players: number;
  /** عدد الأوراق لكل لاعب / cards dealt to each player */
  handSize: number;
  /** رتب تُحذف من كل النقوش / ranks removed from every suit */
  removeRanks: Rank[];
  /** أوراق محددة تُحذف ('H6' أو '6H') / specific cards removed (card ids, 'H6' or '6H') */
  removeCards: string[];
  /** الجوكرات المضافة للورق / jokers added to the deck */
  jokers: JokerId[];
  /**
   * ترتيب الفرق: 'alternate' = الشريك يجلس بالتناوب (كل ثاني كرسي).
   * في بو ٤ هذا يعني أن الشريك مقابلك، وفي بو ٦ الشركاء بالتناوب.
   * 'halves' = الشركاء متجاورين: النصف الأول من الكراسي فريق والنصف الثاني فريق.
   * Team layout: 'alternate' = partners on every other seat
   * (Bo4 → partner sits opposite; Bo6 → partners alternate).
   * 'halves' = partners sit side by side: the first half of the seats is one team, the rest the other.
   */
  teamLayout: TeamLayout;
  /** حجم دفعة التوزيع (كم ورقة لكل لاعب في كل لفة) / cards per player per dealing pass */
  dealChunk: number;
}

export interface BidRules {
  /**
   * كل قيم العقد الممكنة بالترتيب (تشمل قيمة الملزوم). المزايدة الاختيارية تبدأ من minVoluntaryBid.
   * Every possible contract value, ascending (including the Malzoom value).
   * Voluntary bids start at minVoluntaryBid.
   */
  values: number[];
  /**
   * أقل مزايدة اختيارية. أي قيمة أقل منها (مثل ٥) مسموحة فقط كملزوم.
   * Minimum voluntary bid. Lower values (e.g. 5) are only allowed as the forced Malzoom bid.
   */
  minVoluntaryBid: number;
  /** أسماء المزايدات / display names of the bids */
  names: Record<number, string>;
  /** قيمة "لارنس" (كل الأكلات) / the Larens value (all tricks) */
  larens: number;
  /**
   * كل لاعب يتكلم مرة واحدة فقط (لفة واحدة).
   * Each player gets exactly one turn to bid or pass (single round).
   */
  singleRound: boolean;
  /** يجب أن تكون المزايدة أعلى من الحالية بهذا المقدار على الأقل / minimum raise over current bid */
  minRaise: number;
  /** إذا وصل أحد لأعلى مزايدة تنتهي المزايدة فوراً / bidding stops immediately at the max bid */
  endOnMaxBid: boolean;
  /**
   * إذا طاف الجميع يُجبر الموزع على المزايدة (ملزوم).
   * If everyone passes, the dealer is forced to bid (Malzoom).
   */
  forceDealerIfAllPass: boolean;
  /**
   * قيمة الملزوم: الموزع يُجبر عليها إذا طاف الكل.
   * The Malzoom value: the dealer is forced to it when everyone passes.
   */
  malzoomBid: number;
  /**
   * هل يقدر الموزع الملزوم يرفع فوق قيمة الملزوم؟
   * May the forced dealer bid higher than the Malzoom value instead?
   */
  forcedDealerMayRaise: boolean;
}

export type TrumpRankName = 'A' | 'K' | 'Q' | 'J';

export interface JokerRules {
  /**
   * هل يجوز البدء بالجوكر أصلاً؟ false = ما يجوز تبدأ أكلة بجوكر أبداً (كل شروط البدء تحت تُتجاهل).
   * إذا ما بقى عند اللاعب إلا جوكرات ومضطر يبدأ، يطبّق illegalForcedLead.
   * May a joker ever be LED? false = a trick can never be started with a joker (all the
   * lead-permission rules below are ignored). A player left with only jokers falls under illegalForcedLead.
   */
  jokerLeadAllowed: boolean;
  /**
   * الجوكر المحترق: إذا انلعب الجوكر الأحمر (الكبير) قبل ما ينلعب الأسود (الصغير) في هذه اليد
   * (في أكلة سابقة أو قبله في نفس الأكلة)، يحترق: ما له قيمة وما يقدر ياخذ الأكلة.
   * Burned big joker: if the red (big) joker is played while the black (small) joker has NOT been
   * played yet this hand (in an earlier trick, or earlier in the same trick), it is burned: no value,
   * cannot win the trick. Once the small joker is out, the big joker is the strongest card as usual.
   */
  burnBigJokerBeforeSmall: boolean;
  /**
   * أي جوكر يُسمح بالبدء (اللعب أولاً) به حسب مزايدة فريق اللاعب البادئ.
   * يطبّق فقط على الفريق اللي فاز بالمزايدة.
   * Which joker may be LED depending on the leader's team bid.
   * Applies only when the leader is on the team that won the bid.
   *   مثال / example: { 9: { red: true, black: true }, 8: { red: true, black: false } }
   */
  leadAllowedByBid: Record<number, { red: boolean; black: boolean }>;
  /**
   * أوراق الحكم التي يجب أن تُلعب كلها (هذه اليد) قبل أن يُسمح لأي لاعب بالبدء بالجوكر.
   *   - مصفوفة رتب مثل ['A','K','Q','J']، أو
   *   - 'all' = كل أوراق الحكم الموجودة في الورق، أو
   *   - null = لا يفتح أبداً بهذه الطريقة.
   * Trump cards that must ALL have been played this hand before anyone may lead a joker.
   *   - array of ranks e.g. ['A','K','Q','J'], or
   *   - 'all' = every trump card in the deck, or
   *   - null = never unlocked this way.
   */
  leadUnlockedWhenTrumpsPlayed: TrumpRankName[] | 'all' | null;
  /**
   * إذا المزايد ما كان عنده هذه الورقة من الحكم (عند اختيار الحكم) يجوز البدء بالجوكر في أي وقت.
   * null = تعطيل.
   * If the bidder did NOT hold this trump card when trump was chosen, jokers may be led any time.
   * null = disabled.
   */
  leadUnlockedIfBidderLacks: TrumpRankName | null;
  /**
   * الجوكر المبدوء به بشكل قانوني يُعتبر حكماً (الباقي لازم يلعب حكم إذا عنده، أو جوكر).
   * A legally led joker counts as trump (others must play trump if able, or a joker).
   */
  ledJokerCountsAsTrump: boolean;
  /**
   * يجوز لعب الجوكر على أكلة بدأها غيرك حتى لو عندك من النقش المطلوب.
   * A joker may be played onto someone else's trick even when holding the led suit.
   */
  canPlayWhileHoldingLedSuit: boolean;
  /**
   * ماذا يحدث إذا اضطر لاعب للبدء بجوكر بشكل غير قانوني (الجوكر آخر أوراقه):
   *   - 'cancel'  = الجوكر يُلغى (بدون قيمة ولا يفوز)، والورقة التالية تحدد النقش.
   *                 إذا لعب اللاعب التالي جوكراً أيضاً يُلغى، والورقة بعده تحدد النقش.
   *   - 'asTrump' = يُعامل كبداية قانونية (يحسب حكم).
   * How a forced illegal joker lead (the joker is the player's last card(s)) is resolved:
   *   - 'cancel'  = the joker is void (no rank, cannot win); the next card sets the led suit.
   *                 If the next player also plays a joker it is void too, and the following card sets the suit.
   *   - 'asTrump' = treat it as a legal lead (counts as trump).
   */
  illegalForcedLead: 'cancel' | 'asTrump';
}

/** مستوى البوتات / bot difficulty */
export type BotLevel = 'easy' | 'medium' | 'hard';

export interface RenegeRules {
  /**
   * القطع الغلط مسموح فعلياً: أي لاعب يقدر يلعب أي ورقة من يده حتى لو عنده النقش المطلوب
   * (مثل الطاولة الحقيقية). المحرك يسجل كل قطع بصمت. قوانين الجوكر تبقى كما هي.
   * false = اللعبة تمنع الأوراق الغلط.
   * Reneging is physically possible: any player may play any card from their hand even when
   * holding the led suit (like a real table). The engine silently records every renege.
   * Joker rules still apply. false = the game blocks wrong cards.
   */
  allowRenege: boolean;
  /**
   * إذا انكشف القطع (أكاشف): اليد تنكسر على الفريق اللي قطع، والفريق اللي كاشف ياخذ (قيمة الطلب × هذا الرقم)،
   * والفريق اللي قطع ياخذ صفر. ينطبق سواء كان القاطع من فريق المزايد أو من الخصم.
   * When a renege is caught the hand is broken for the reneging team: the catching team gets
   * (bid value × this number) and the reneging team gets 0, whichever side reneged.
   */
  renegePenaltyMultiplier: number;
  /**
   * مكاشفة غلط: 'none' = ما يصير شي. 'brokenHand' = تنكسر اليد على الفريق اللي كاشف غلط.
   * A wrong catch: 'none' = nothing happens. 'brokenHand' = the hand is broken for the team that called it.
   */
  wrongCatchPenalty: 'none' | 'brokenHand';
  /**
   * احتمال أن البوت يكاشف إذا شاف دليل (البوت ما يشوف أوراق مخفية أبداً).
   * Chance a bot calls a catch when it has seen the evidence (bots never peek at hidden cards).
   */
  botCatchChance: Record<BotLevel, number>;
  /**
   * احتمال أن البوت يقطع غلط بالخطأ في كل ورقة يقدر يقطع فيها.
   * Chance a bot reneges by mistake on each card where it could.
   */
  botRenegeChance: Record<BotLevel, number>;
}

export interface ScoreRow {
  /** نقاط الفريق المزايد إذا جاب / points for the bidding team if made */
  made: number;
  /** نقاط الخصم إذا ما جاب المزايد / points for the opponents if failed */
  failed: number;
}

export interface RulesConfig {
  modes: Record<ModeId, ModeRules>;
  /** ترتيب الأوراق داخل النقش من الأقوى للأضعف / rank order within a suit, strongest first */
  suitRankOrder: Rank[];
  /**
   * ترتيب قوة الحكم من الأقوى للأضعف. يشمل الجوكرات.
   * الافتراضي: الجوكر الأحمر > إكَه الحكم > الجوكر الأسود > باقي الحكم.
   * Trump power order, strongest first, including jokers.
   * Default: Red Joker > trump Ace > Black Joker > other trumps.
   */
  trumpPowerOrder: (Rank | JokerId)[];
  bidding: BidRules;
  /**
   * من يبدأ أول ورقة في اليد (صاحب أعلى مزايدة يختار الحكم دائماً):
   *   - 'rightOfBidder' = اللاعب اللي على يمين المزايد (التالي عكس عقارب الساعة)
   *   - 'bidder'        = المزايد نفسه
   *   - 'rightOfDealer' = اللاعب اللي على يمين الموزع
   * بعد أول أكلة، اللي يكسب الأكلة يبدأ اللي بعدها.
   * Who leads the first card of the hand (the winning bidder always chooses trump):
   *   - 'rightOfBidder' = the player to the bidder's right (next in counter-clockwise order)
   *   - 'bidder'        = the bidder
   *   - 'rightOfDealer' = the player to the dealer's right
   * After that, each trick's winner leads the next.
   */
  firstLead: 'rightOfBidder' | 'bidder' | 'rightOfDealer';
  /**
   * الستات المحذوفة من ورق بو ٤ (تُضاف لـ modes.bo4.removeCards). تُكتب رقم + نقش: '6D' = ٦♦ ديمن، '6C' = ٦♣ كلفس.
   * The 6s removed from the Bo 4 deck (added to modes.bo4.removeCards), written rank + suit: '6D' = 6♦, '6C' = 6♣.
   */
  bo4Removed6s: string[];
  /**
   * أول خبّاص (موزع) في بداية كل لعبة:
   *   - 'lowestCardDraw' = كل لاعب يسحب ورقة مكشوفة من ورق مخلوط (بدون الجوكر)، وأصغر ورقة تخبّص
   *                        (٢ أصغر شي والإكَه أكبر شي). إذا تعادلوا على الأصغر، المتعادلين بس يسحبون من جديد.
   *   - 'random'         = عشوائي.
   *   - رقم              = كرسي محدد (للاختبارات؛ ٠ = أنت).
   * First dealer of every new game:
   *   - 'lowestCardDraw' = each player draws one face-up card from a shuffled deck (no jokers); the LOWEST
   *                        card deals (2 lowest, Ace highest). A tie for lowest: only the tied players draw again.
   *   - 'random'         = random seat.
   *   - a number         = that seat (tests; 0 = you).
   */
  firstDealer: 'lowestCardDraw' | 'random' | number;
  /**
   * من يخبّص بعد كل يد:
   *   - 'loserKeepsDeal' = إذا فريق الخبّاص خسر اليد (ما سجّل ولا نقطة، حتى لو انكشف قطعه) يخبّص نفس الشخص مرة ثانية؛
   *                        وإذا فريقه سجّل نقاط، التخبيص ينتقل للي على يمينه (من الفريق الخسران).
   *   - 'alwaysRotate'   = التخبيص ينتقل للي على اليمين كل يد.
   * Who deals after each hand:
   *   - 'loserKeepsDeal' = if the dealer's team LOST the hand (scored 0, including being caught reneging) the same
   *                        player deals again; if it scored points, the deal passes to the player on the dealer's
   *                        right (counter-clockwise), who is on the losing team.
   *   - 'alwaysRotate'   = the deal passes to the right every hand.
   * After an all-pass redeal (only when forceDealerIfAllPass is off) the deal always passes to the right.
   */
  dealerRotation: 'loserKeepsDeal' | 'alwaysRotate';
  /** إعدادات الجوكر النشطة (تُستبدل بالإعداد الجاهز المختار) / active joker rules (replaced by the chosen preset) */
  jokers: JokerRules;
  /** الإعداد الجاهز للجوكر المختار افتراضياً / default joker preset */
  activeJokerPreset: JokerPresetId;
  /** الإعدادات الجاهزة للجوكر / joker rule presets */
  jokerPresets: Record<JokerPresetId, JokerRules>;
  /**
   * تُلعب كل يد لآخر ورقة (حتى لو انحسمت النتيجة)، عشان تنكشف كل الأوراق وينراجع القطع.
   * false = تنتهي اليد أول ما يجيب المزايد طلبه أو يصير مستحيل يجيبه.
   * Every hand is played to the last card (even once the result is decided), so every card
   * is seen and reneges can be reviewed. false = end the hand as soon as the bid is made or lost.
   */
  playToLastCard: boolean;
  /** القطع الغلط والمكاشفة (أكاشف) / reneging and catching */
  renege: RenegeRules;
  /** جدول النقاط لكل مزايدة / scoring table per bid value */
  scoring: Record<number, ScoreRow>;
  /** نقاط الملزوم / scoring for the forced (Malzoom) bid */
  malzoomScoring: ScoreRow;
  gameEnd: {
    /** الفوز عند الوصول لهذا الرقم أو أكثر / win when a team reaches this score or more */
    targetScore: number;
    /**
     * الفوز إذا وصل فريق لهذا الرقم والخصم صفر (null = تعطيل).
     * Win when a team reaches this score while the other team has 0 (null = disabled).
     */
    shutoutTarget: number | null;
  };
  /** لارنس (طلب ٩ = كل الأكلات) / Larens (bid 9 = every trick) */
  larens: LarensRules;
  /** باون على طلب ٧ / Bawn on a bid of 7 */
  bawn: BawnRules;
  /** سؤال الجوكر / asking partner about the other joker */
  jokerAsk: JokerAskRules;
}

export interface LarensRules {
  /**
   * إذا جاب الفريق المزايد لارنس (كل الأكلات) يفوز باللعبة كلها فوراً (قيم) مهما كانت النتيجة.
   * Making Larens (every trick) wins the WHOLE GAME immediately (قيم), whatever the score.
   */
  larensWinsGame: boolean;
  /** نقاط لارنس إذا جابوه و larensWinsGame = false / points for making Larens when larensWinsGame is false */
  larensMadePoints: number;
  /** نقاط الخصم إذا انكسر لارنس / opponents' points when Larens fails */
  larensFailPoints: number;
}

export interface BawnRules {
  /**
   * الطلب اللي يجوز فيه الباون (null = بدون باون).
   * The bid on which Bawn may be declared (null = no Bawn).
   */
  bawnOnBid: number | null;
  /**
   * أول ما يوصل الفريق المزايد لهذا العدد من الأكلات والخصم ما أخذ ولا أكلة، ينسأل المزايد: "تبي باون؟".
   * إذا نعم: لازم ياخذون كل الأكلات الباقية (كل الـ٩). إذا الخصم أخذ أي أكلة، ما في باون وما ينسأل.
   * As soon as the bidding team reaches this many tricks — while the opponents have NONE — the bidder is
   * asked "تبي باون؟". If yes, the team must win every remaining trick (all 9). If the opponents have
   * taken any trick, Bawn is impossible and the question never comes.
   */
  bawnAskAtTricks: number;
  /** نقاط الباون إذا نجح / points when Bawn succeeds */
  bawnWinPoints: number;
  /** نقاط الخصم إذا انكسر الباون / opponents' points when Bawn fails */
  bawnFailPoints: number;
}

export interface JokerAskRules {
  /**
   * لاعب عنده جوكر واحد بالضبط يقدر يسأل شريكه في دوره بالمزايدة: "عندك الجوكر الثاني؟".
   * الجواب تلقائي وصادق ويبين على الطاولة. (في بو ٦: الجواب "عندي" إذا أي شريك عنده.)
   * A player holding exactly one joker may ask on their bidding turn: "عندك الجوكر الثاني؟".
   * The answer is automatic, truthful and shown on the table. (In Bo 6: "yes" if any partner has it.)
   */
  allowJokerAsk: boolean;
  /** إذا الشريك عنده الجوكر الثاني، السائل مجبور يطلب هذا / forced bid when the partner has it */
  jokerAskYesBid: number;
  /** إذا ما عنده، السائل مجبور يطلب هذا / forced bid when the partner doesn't */
  jokerAskNoBid: number;
}

// ---------------------------------------------------------------------------
//  الإعدادات الجاهزة للجوكر / Joker presets
// ---------------------------------------------------------------------------

/** مشترك: من زايد ٩ يبدأ بأي جوكر، من زايد ٨ يبدأ بالأحمر فقط / bid 9 → any joker, bid 8 → red only */
/** مشترك بين كل الإعدادات: ممنوع البدء بالجوكر، والأحمر يحترق قبل الأسود. Shared by every preset. */
const JOKER_COMMON = { jokerLeadAllowed: false, burnBigJokerBeforeSmall: true } as const;

const BID_8_9_LEAD: JokerRules['leadAllowedByBid'] = {
  9: { red: true, black: true },
  8: { red: true, black: false },
};

export const JOKER_PRESETS: Record<JokerPresetId, JokerRules> = {
  /**
   * الافتراضي: لارنس → أي جوكر، ٨ → الأحمر فقط، أو بعد لعب إكَه وشايب وبنت وولد الحكم.
   * Default: bid 9 → either joker, bid 8 → red only, or once trump A, K, Q, J have all been played.
   */
  default: {
    ...JOKER_COMMON,
    leadAllowedByBid: BID_8_9_LEAD,
    leadUnlockedWhenTrumpsPlayed: ['A', 'K', 'Q', 'J'],
    leadUnlockedIfBidderLacks: null,
    ledJokerCountsAsTrump: true,
    canPlayWhileHoldingLedSuit: true,
    illegalForcedLead: 'cancel',
  },
  /**
   * صارم: فقط مزايدة ٨ أو ٩ تسمح بالبدء بالجوكر.
   * Strict: only a bid of 8/9 allows leading a joker.
   */
  strict: {
    ...JOKER_COMMON,
    leadAllowedByBid: BID_8_9_LEAD,
    leadUnlockedWhenTrumpsPlayed: null,
    leadUnlockedIfBidderLacks: null,
    ledJokerCountsAsTrump: true,
    canPlayWhileHoldingLedSuit: true,
    illegalForcedLead: 'cancel',
  },
  /**
   * أصرم: لازم تنلعب كل أوراق الحكم أولاً إلا إذا المزايدة ٨ أو ٩.
   * Stricter: all trump cards must be played first, unless bid 8/9.
   */
  stricter: {
    ...JOKER_COMMON,
    leadAllowedByBid: BID_8_9_LEAD,
    leadUnlockedWhenTrumpsPlayed: 'all',
    leadUnlockedIfBidderLacks: null,
    ledJokerCountsAsTrump: true,
    canPlayWhileHoldingLedSuit: true,
    illegalForcedLead: 'cancel',
  },
  /**
   * مرن: يكفي لعب إكَه الحكم فقط. وإذا المزايد ما عنده إكَه الحكم يجوز البدء بالجوكر أي وقت.
   * Relaxed: only the trump Ace must be played first; if the bidder doesn't hold the trump Ace,
   * a joker can be led any time.
   */
  relaxed: {
    ...JOKER_COMMON,
    leadAllowedByBid: BID_8_9_LEAD,
    leadUnlockedWhenTrumpsPlayed: ['A'],
    leadUnlockedIfBidderLacks: 'A',
    ledJokerCountsAsTrump: true,
    canPlayWhileHoldingLedSuit: true,
    illegalForcedLead: 'cancel',
  },
};

// ---------------------------------------------------------------------------
//  القوانين / The rules
// ---------------------------------------------------------------------------

export const RULES: RulesConfig = {
  modes: {
    /** كوت بو ٦: ٦ لاعبين، فريقين من ٣، ٥٢ ورقة + جوكرين = ٥٤، ٩ أوراق لكل لاعب */
    /** Kout Bo 6: 6 players, 2 teams of 3, 52 cards + 2 jokers = 54, 9 cards each */
    bo6: {
      players: 6,
      handSize: 9,
      removeRanks: [],
      removeCards: [],
      jokers: ['XR', 'XB'],
      teamLayout: 'alternate',
      dealChunk: 3,
    },
    /**
     * كوت بو ٤: ٤ لاعبين، فريقين من ٢، بدون ٢-٥ وبدون ستة الديمن وستة الكلفس (bo4Removed6s) + جوكرين = ٣٦ ورقة.
     * يبقى ستة السبيت وستة الهاس.
     * Kout Bo 4: 4 players, 2 teams of 2, remove 2–5 and the 6♦ and 6♣ (bo4Removed6s), add both jokers = 36 cards.
     * The 6♠ and 6♥ stay.
     */
    bo4: {
      players: 4,
      handSize: 9,
      removeRanks: [2, 3, 4, 5],
      removeCards: [],
      jokers: ['XR', 'XB'],
      teamLayout: 'alternate',
      dealChunk: 3,
    },
  },

  // A K Q J 10 9 8 7 6 5 4 3 2
  suitRankOrder: [14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2],

  // الجوكر الأحمر › الجوكر الأسود › إكَه الحكم › شايب … ٢  (الأحمر يحترق إذا انلعب قبل الأسود: jokers.burnBigJokerBeforeSmall)
  // Red Joker > Black Joker > trump A > K Q J 10 ... 2  (the red one burns if played before the black: see jokers.burnBigJokerBeforeSmall)
  trumpPowerOrder: ['XR', 'XB', 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2],

  bidding: {
    values: [5, 6, 7, 8, 9],
    minVoluntaryBid: 6,
    names: { 5: 'ملزوم', 6: '٦', 7: '٧', 8: '٨', 9: 'لارنس' },
    larens: 9,
    singleRound: true,
    minRaise: 1,
    endOnMaxBid: true,
    forceDealerIfAllPass: true,
    malzoomBid: 5,
    forcedDealerMayRaise: true,
  },

  firstLead: 'rightOfBidder',
  bo4Removed6s: ['6D', '6C'],
  firstDealer: 'lowestCardDraw',
  dealerRotation: 'loserKeepsDeal',

  activeJokerPreset: 'default',
  jokerPresets: JOKER_PRESETS,
  jokers: JOKER_PRESETS.default,

  playToLastCard: true,

  renege: {
    allowRenege: true,
    renegePenaltyMultiplier: 2,
    wrongCatchPenalty: 'none',
    botCatchChance: { easy: 0.25, medium: 0.6, hard: 1 },
    botRenegeChance: { easy: 0.06, medium: 0.03, hard: 0 },
  },

  // | Bid | made | failed (to opponents) |
  // صف ٥ يُستخدم فقط إذا minVoluntaryBid ≤ ٥ (الملزوم يستخدم malzoomScoring).
  // Row 5 only applies if minVoluntaryBid ≤ 5 (the Malzoom bid uses malzoomScoring).
  scoring: {
    5: { made: 5, failed: 10 },
    6: { made: 6, failed: 12 },
    7: { made: 7, failed: 14 },
    8: { made: 8, failed: 16 },
    // ٩ = لارنس: نقاطه في larens تحت / 9 = Larens: scored by the larens settings below
  },
  malzoomScoring: { made: 5, failed: 5 },

  gameEnd: {
    targetScore: 54,
    shutoutTarget: 36,
  },

  larens: {
    larensWinsGame: true,
    larensMadePoints: 18,
    larensFailPoints: 18,
  },

  bawn: {
    bawnOnBid: 7,
    bawnAskAtTricks: 6,
    bawnWinPoints: 36,
    bawnFailPoints: 18,
  },

  jokerAsk: {
    allowJokerAsk: true,
    jokerAskYesBid: 9,
    jokerAskNoBid: 8,
  },
};

/**
 * يبني نسخة من القوانين مع إعداد جوكر جاهز وتعديلات اختيارية.
 * Build a rules object using a joker preset plus optional overrides.
 */
export function buildRules(
  preset: JokerPresetId = RULES.activeJokerPreset,
  overrides: Partial<Omit<RulesConfig, 'jokers'>> & { jokers?: Partial<JokerRules> } = {},
): RulesConfig {
  const { jokers: jokerOverrides, ...rest } = overrides;
  return {
    ...RULES,
    ...rest,
    activeJokerPreset: preset,
    jokers: { ...RULES.jokerPresets[preset], ...(jokerOverrides ?? {}) },
  };
}
