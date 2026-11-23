import { JokerPresetId, ModeId, RULES, buildDeck, handPoints } from '../engine';
import type { Difficulty } from '../bots';
import { Card } from './Card';
import { ar } from './layout';
import { DIFFICULTY_LABELS, MODE_LABELS, PRESET_NAMES, SPEED_LABELS, Settings, Speed } from './settings';
import { describeBawn, describeDealer, describeFirstLead, describeJokerAsk, describeJokerPlay, describeLarens, describePowerOrder, describeRemovedCards, describeRenege, presetDescription } from './rulesText';
import { bidLabel } from './panels';
import { useInstall } from '../pwa/install';

/** Do the joker presets differ at all? Not when no preset allows leading a joker (then the picker is hidden). */
const PRESETS_MATTER = Object.values(RULES.jokerPresets).some((j) => j.jokerLeadAllowed);

export function Home({ settings, hasSaved, onPlay, onResume, onOnline, onSettings, onRules }: {
  settings: Settings;
  hasSaved: boolean;
  onPlay: (mode: ModeId) => void;
  onResume: () => void;
  /** shown only when a game server is configured */
  onOnline?: () => void;
  onSettings: () => void;
  onRules: () => void;
}) {
  return (
    <div className="home">
      <div className="logo-fan" aria-hidden>
        <Card id="XR" className="f1" />
        <Card id="H14" className="f2" />
        <Card id="S13" className="f3" />
      </div>
      <h1 className="title">ديوانية الكوت</h1>
      <p className="subtitle">كوت بو ٦ و بو ٤ — العب مع ربعك البوتات</p>
      <div className="home-actions">
        {hasSaved && (
          <button className="btn primary big" onClick={onResume}>
            ▶ كمّل اللعبة
          </button>
        )}
        <button className={`btn big ${hasSaved ? 'ghost' : 'primary'}`} onClick={() => onPlay('bo6')}>
          كوت بو ٦ <small>٦ لاعبين</small>
        </button>
        <button className="btn ghost big" onClick={() => onPlay('bo4')}>
          كوت بو ٤ <small>٤ لاعبين</small>
        </button>
        {onOnline && (
          <button className="btn big online-btn" onClick={onOnline}>
            🌐 العب أونلاين <small>مع ربعك أو لاعبين من كل مكان</small>
          </button>
        )}
        <div className="home-row">
          <button className="btn ghost" onClick={onSettings}>
            ⚙ الإعدادات
          </button>
          <button className="btn ghost" onClick={onRules}>
            📖 القوانين
          </button>
        </div>
      </div>
      <InstallHint />
      <p className="home-meta muted small">
        {PRESETS_MATTER && <>الجوكر: {PRESET_NAMES[settings.preset]} · </>}البوتات: {DIFFICULTY_LABELS[settings.difficulty]} · السرعة: {SPEED_LABELS[settings.speed]}
      </p>
    </div>
  );
}

function Seg<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="seg">
      {options.map(([v, label]) => (
        <button key={v} className={v === value ? 'on' : ''} onClick={() => onChange(v)}>
          {label}
        </button>
      ))}
    </div>
  );
}

export function SettingsScreen({ settings, onChange, onBack }: { settings: Settings; onChange: (s: Settings) => void; onBack: () => void }) {
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => onChange({ ...settings, [k]: v });
  return (
    <div className="page">
      <div className="page-head">
        <button className="icon-btn" onClick={onBack} aria-label="رجوع">
          →
        </button>
        <h2>الإعدادات</h2>
      </div>
      <div className="field">
        <label>نوع اللعبة</label>
        <Seg<ModeId> value={settings.mode} onChange={(v) => set('mode', v)} options={[['bo6', MODE_LABELS.bo6], ['bo4', MODE_LABELS.bo4]]} />
      </div>
      {PRESETS_MATTER && (
        <div className="field">
          <label>قوانين الجوكر</label>
          <div className="preset-list">
            {(Object.keys(RULES.jokerPresets) as JokerPresetId[]).map((p) => (
              <button key={p} className={`preset ${settings.preset === p ? 'on' : ''}`} onClick={() => set('preset', p)}>
                <b>{PRESET_NAMES[p]}</b>
                <span>{presetDescription(p, RULES)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="field">
        <label>مستوى البوتات</label>
        <Seg<Difficulty> value={settings.difficulty} onChange={(v) => set('difficulty', v)} options={(['easy', 'medium', 'hard'] as Difficulty[]).map((d) => [d, DIFFICULTY_LABELS[d]])} />
      </div>
      <div className="field">
        <label>سرعة اللعب</label>
        <Seg<Speed> value={settings.speed} onChange={(v) => set('speed', v)} options={[['slow', 'بطيء'], ['normal', 'عادي'], ['fast', 'سريع']]} />
      </div>
      <div className="field">
        <label>الصوت</label>
        <Seg<'on' | 'off'> value={settings.sound ? 'on' : 'off'} onChange={(v) => set('sound', v === 'on')} options={[['on', 'تشغيل'], ['off', 'إيقاف']]} />
      </div>
      <p className="muted small">التغييرات تطبق على اللعبة الجديدة.</p>
    </div>
  );
}

export function RulesScreen({ settings, onBack }: { settings: Settings; onBack: () => void }) {
  const r = RULES;
  const voluntary = r.bidding.values.filter((v) => v >= r.bidding.minVoluntaryBid);
  const g = r.gameEnd;
  return (
    <div className="page rules">
      <div className="page-head">
        <button className="icon-btn" onClick={onBack} aria-label="رجوع">
          →
        </button>
        <h2>القوانين</h2>
      </div>
      <section>
        <h3>الورق</h3>
        <p>
          بو ٦: {ar(buildDeck(r, 'bo6').length)} ورقة (٥٢ + جوكرين) · بو ٤: {ar(buildDeck(r, 'bo4').length)} ورقة (بدون {ar(Math.min(...r.modes.bo4.removeRanks))}–{ar(Math.max(...r.modes.bo4.removeRanks))} و{describeRemovedCards(r, 'bo4')} + جوكرين). كل لاعب {ar(r.modes.bo6.handSize)} أوراق.
        </p>
        <p>{describePowerOrder(r)}</p>
      </section>
      <section>
        <h3>الخبّاص</h3>
        {describeDealer(r).map((t) => (
          <p key={t}>{t}</p>
        ))}
      </section>
      <section>
        <h3>المزايدة</h3>
        <p>
          تبدأ من يمين الموزع، وكل لاعب يتكلم مرة: طاف أو يزايد أعلى ({voluntary.map((v) => bidLabel(r, v)).join('، ')}). أقل مزايدة {ar(r.bidding.minVoluntaryBid)}. إذا طاف الكل، الموزع ملزوم بـ{ar(r.bidding.malzoomBid)}
          {r.bidding.forcedDealerMayRaise && <> (أو يزايد أعلى)</>}.
          {describeFirstLead(r)} بعدها اللي يكسب الأكلة يبدأ.
        </p>
      </section>
      <section>
        <h3>اللعب</h3>
        <p>لازم تلحق النقش إذا عندك. إذا ما عندك تلعب أي ورقة. اللعب عكس عقارب الساعة.</p>
        <p>
          <b>البدء بالجوكر{PRESETS_MATTER && <> ({PRESET_NAMES[settings.preset]})</>}:</b> {presetDescription(settings.preset, r)}.
        </p>
        {describeJokerPlay(r.jokerPresets[settings.preset]).map((t) => (
          <p key={t}>{t}</p>
        ))}
      </section>
      <section>
        <h3>القطع والمكاشفة (أكاشف)</h3>
        {describeRenege(r).map((t) => (
          <p key={t}>{t}</p>
        ))}
      </section>
      <section>
        <h3>النقاط</h3>
        <table className="pad-table">
          <thead>
            <tr>
              <th>الطلب</th>
              <th>إذا جاب</th>
              <th>إذا انكسر (للخصم)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>ملزوم</td>
              <td>{ar(r.malzoomScoring.made)}</td>
              <td>{ar(r.malzoomScoring.failed)}</td>
            </tr>
            {voluntary.map((v) => {
              const [made] = handPoints(r, { team: 0, value: v, forced: false }, true);
              const [, failed] = handPoints(r, { team: 0, value: v, forced: false }, false);
              const larensGame = v === r.bidding.larens && r.larens.larensWinsGame;
              return (
                <tr key={v}>
                  <td>{bidLabel(r, v)}</td>
                  <td>{larensGame ? 'قيم (الفوز باللعبة)' : ar(made)}</td>
                  <td>{ar(failed)}</td>
                </tr>
              );
            })}
            {r.bawn.bawnOnBid !== null && (
              <tr>
                <td>باون (على {ar(r.bawn.bawnOnBid)})</td>
                <td>{ar(r.bawn.bawnWinPoints)}</td>
                <td>{ar(r.bawn.bawnFailPoints)}</td>
              </tr>
            )}
          </tbody>
        </table>
        <p>
          الفوز: الوصول لـ{ar(g.targetScore)}
          {g.shutoutTarget !== null && <>، أو {ar(g.shutoutTarget)} والخصم صفر</>}
          {r.larens.larensWinsGame && <>، أو {bidLabel(r, r.bidding.larens)}</>}.
        </p>
      </section>
      <section>
        <h3>{bidLabel(r, r.bidding.larens)} والباون وسؤال الجوكر</h3>
        {[...describeLarens(r), ...describeBawn(r), ...describeJokerAsk(r)].map((t) => (
          <p key={t}>{t}</p>
        ))}
      </section>
    </div>
  );
}

/** "Install the game" button (Android/desktop), or the Add-to-Home-Screen hint on iPhone/iPad. */
function InstallHint() {
  const { mode, install } = useInstall();
  if (mode === 'prompt') {
    return (
      <button className="btn ghost install-btn" onClick={install}>
        📲 ثبّت اللعبة على جهازك
      </button>
    );
  }
  if (mode === 'ios') {
    return <p className="install-hint muted small">للتثبيت على الآيفون: اضغط مشاركة ⬆︎ ثم «إضافة إلى الشاشة الرئيسية»</p>;
  }
  return null;
}
