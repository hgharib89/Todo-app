import { JokerPresetId, ModeId, RULES, buildDeck } from '../engine';
import type { Difficulty } from '../bots';
import { Card } from './Card';
import { ar } from './layout';
import { DIFFICULTY_LABELS, MODE_LABELS, PRESET_LABELS, SPEED_LABELS, Settings, Speed } from './settings';
import { bidLabel } from './panels';

export function Home({ settings, hasSaved, onPlay, onResume, onSettings, onRules }: {
  settings: Settings;
  hasSaved: boolean;
  onPlay: (mode: ModeId) => void;
  onResume: () => void;
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
        <div className="home-row">
          <button className="btn ghost" onClick={onSettings}>
            ⚙ الإعدادات
          </button>
          <button className="btn ghost" onClick={onRules}>
            📖 القوانين
          </button>
        </div>
      </div>
      <p className="home-meta muted small">
        الجوكر: {PRESET_LABELS[settings.preset].name} · البوتات: {DIFFICULTY_LABELS[settings.difficulty]} · السرعة: {SPEED_LABELS[settings.speed]}
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
      <div className="field">
        <label>قوانين الجوكر</label>
        <div className="preset-list">
          {(Object.keys(PRESET_LABELS) as JokerPresetId[]).map((p) => (
            <button key={p} className={`preset ${settings.preset === p ? 'on' : ''}`} onClick={() => set('preset', p)}>
              <b>{PRESET_LABELS[p].name}</b>
              <span>{PRESET_LABELS[p].desc}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <label>مستوى البوتات</label>
        <Seg<Difficulty> value={settings.difficulty} onChange={(v) => set('difficulty', v)} options={[['easy', 'سهل'], ['medium', 'متوسط']]} />
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
          بو ٦: {ar(buildDeck(r, 'bo6').length)} ورقة (٥٢ + جوكرين) · بو ٤: {ar(buildDeck(r, 'bo4').length)} ورقة (بدون ٢–٥ والستات الحمر + جوكرين). كل لاعب {ar(r.modes.bo6.handSize)} أوراق.
        </p>
        <p>القوة: الجوكر الأحمر › إكَه الحكم › الجوكر الأسود › باقي الحكم › باقي النقوش.</p>
      </section>
      <section>
        <h3>المزايدة</h3>
        <p>
          تبدأ من يمين الموزع، وكل لاعب يتكلم مرة: طاف أو يزايد أعلى ({r.bidding.values.map((v) => bidLabel(r, v)).join('، ')}). إذا طاف الكل، الموزع ملزوم بـ{ar(r.bidding.forcedBidValue)}.
          صاحب أعلى طلب يختار الحكم ويبدأ أول أكلة.
        </p>
      </section>
      <section>
        <h3>اللعب</h3>
        <p>لازم تلحق النقش إذا عندك. إذا ما عندك تلعب أي ورقة. الجوكر ينلعب على أكلة غيرك في أي وقت. اللعب عكس عقارب الساعة.</p>
        <p>
          <b>الجوكر ({PRESET_LABELS[settings.preset].name}):</b> {PRESET_LABELS[settings.preset].desc}. إذا اضطر لاعب يبدأ بجوكر وهو آخر ورقة عنده بدون ما يحق له، يُلغى الجوكر والورقة اللي بعده تحدد النقش.
        </p>
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
            {r.bidding.values.map((v) => (
              <tr key={v}>
                <td>{bidLabel(r, v)}</td>
                <td>{ar(r.scoring[v].made)}</td>
                <td>{ar(r.scoring[v].failed)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>
          الفوز: الوصول لـ{ar(g.targetScore)}
          {g.shutoutScore !== null && <>، أو {ar(g.shutoutScore)} والخصم صفر</>}
          {g.bawanFirstHandInstantWin && <>، أو بوان من أول يد</>}.
        </p>
      </section>
    </div>
  );
}
