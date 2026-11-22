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
 *    - النقش / suits:  'S' = سبيت ♠ spades, 'H' = هاص ♥ hearts,
 *                      'D' = ديمن ♦ diamonds, 'C' = شريحة ♣ clubs
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
  /** قيمة "بوان" (كل الأكلات) / the Bawan value (all tricks) */
  bawan: number;
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
   * الستات المحذوفة من ورق بو ٤ (تُضاف لـ modes.bo4.removeCards). تُكتب رقم + نقش: '6H' = ٦♥.
   * The 6s removed from the Bo 4 deck (added to modes.bo4.removeCards), written rank + suit: '6H' = 6♥.
   */
  bo4Removed6s: string[];
  /**
   * أول موزع في اللعبة: 'random' أو رقم الكرسي (0 = أنت).
   * First dealer of the game: 'random' or a seat index (0 = you).
   */
  firstDealer: 'random' | number;
  /** الموزع ينتقل عكس عقارب الساعة كل يد / dealer passes counter-clockwise each hand */
  rotateDealer: boolean;
  /** إعدادات الجوكر النشطة (تُستبدل بالإعداد الجاهز المختار) / active joker rules (replaced by the chosen preset) */
  jokers: JokerRules;
  /** الإعداد الجاهز للجوكر المختار افتراضياً / default joker preset */
  activeJokerPreset: JokerPresetId;
  /** الإعدادات الجاهزة للجوكر / joker rule presets */
  jokerPresets: Record<JokerPresetId, JokerRules>;
  /**
   * إنهاء اليد مبكراً إذا جاب المزايد طلبه أو صار مستحيل يجيبه.
   * End the hand early once the bidding team has made, or can no longer make, its bid.
   */
  endHandEarly: boolean;
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
    /** الفوز فوراً إذا جاب فريق بوان في أول يد / instant win for making Bawan on the first hand */
    bawanFirstHandInstantWin: boolean;
  };
}

// ---------------------------------------------------------------------------
//  الإعدادات الجاهزة للجوكر / Joker presets
// ---------------------------------------------------------------------------

/** مشترك: من زايد ٩ يبدأ بأي جوكر، من زايد ٨ يبدأ بالأحمر فقط / bid 9 → any joker, bid 8 → red only */
const BID_8_9_LEAD: JokerRules['leadAllowedByBid'] = {
  9: { red: true, black: true },
  8: { red: true, black: false },
};

export const JOKER_PRESETS: Record<JokerPresetId, JokerRules> = {
  /**
   * الافتراضي: بوان → أي جوكر، ٨ → الأحمر فقط، أو بعد لعب إكَه وشايب وبنت وولد الحكم.
   * Default: bid 9 → either joker, bid 8 → red only, or once trump A, K, Q, J have all been played.
   */
  default: {
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
     * كوت بو ٤: ٤ لاعبين، فريقين من ٢، بدون ٢-٥ وبدون ستة الهاص وستة الشريحة (bo4Removed6s) + جوكرين = ٣٦ ورقة.
     * يبقى ستة السبيت وستة الديمن.
     * Kout Bo 4: 4 players, 2 teams of 2, remove 2–5 and the 6♥ and 6♣ (bo4Removed6s), add both jokers = 36 cards.
     * The 6♠ and 6♦ stay.
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

  // Red Joker > A > Black Joker > K Q J 10 ... 2
  trumpPowerOrder: ['XR', 14, 'XB', 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2],

  bidding: {
    values: [5, 6, 7, 8, 9],
    minVoluntaryBid: 6,
    names: { 5: 'ملزوم', 6: '٦', 7: '٧', 8: '٨', 9: 'بوان' },
    bawan: 9,
    singleRound: true,
    minRaise: 1,
    endOnMaxBid: true,
    forceDealerIfAllPass: true,
    malzoomBid: 5,
    forcedDealerMayRaise: true,
  },

  firstLead: 'rightOfBidder',
  bo4Removed6s: ['6H', '6C'],
  firstDealer: 'random',
  rotateDealer: true,

  activeJokerPreset: 'default',
  jokerPresets: JOKER_PRESETS,
  jokers: JOKER_PRESETS.default,

  endHandEarly: true,

  // | Bid | made | failed (to opponents) |
  // صف ٥ يُستخدم فقط إذا minVoluntaryBid ≤ ٥ (الملزوم يستخدم malzoomScoring).
  // Row 5 only applies if minVoluntaryBid ≤ 5 (the Malzoom bid uses malzoomScoring).
  scoring: {
    5: { made: 5, failed: 10 },
    6: { made: 6, failed: 12 },
    7: { made: 7, failed: 14 },
    8: { made: 8, failed: 16 },
    9: { made: 36, failed: 18 },
  },
  malzoomScoring: { made: 5, failed: 5 },

  gameEnd: {
    targetScore: 54,
    shutoutTarget: 36,
    bawanFirstHandInstantWin: true,
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
