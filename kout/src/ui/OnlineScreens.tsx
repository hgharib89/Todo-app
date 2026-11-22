import { useEffect, useState } from 'react';
import type { ModeId } from '../engine';
import { type OnlineSession, createPrivate, inviteLink, joinByCode, quickMatch, useOnlineSession, whatsappLink } from '../net/online';
import { GameScreen } from './GameScreen';
import { MODE_LABELS, PRESET_NAMES, type Settings } from './settings';
import { ar } from './layout';

/** Arabic text for a failed connection. */
function errorText(e: unknown): string {
  const m = String((e as Error)?.message ?? e);
  if (/not found|expired|invalid/i.test(m)) return 'ما لقينا طاولة بهالكود، أو بدأت اللعبة فيها';
  if (/full|locked/i.test(m)) return 'الطاولة مليانة أو بدأت اللعب';
  return 'ما قدرنا نوصل للسيرفر — جرّب مرة ثانية';
}

export function OnlineMenu({ settings, onSettings, initialCode, onRoom, onBack }: {
  settings: Settings;
  onSettings: (s: Settings) => void;
  initialCode: string;
  onRoom: (session: OnlineSession) => void;
  onBack: () => void;
}) {
  const [name, setName] = useState(settings.playerName);
  const [code, setCode] = useState(initialCode);
  const [mode, setMode] = useState<ModeId>(settings.mode);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const player = name.trim() || 'لاعب';

  const go = async (fn: () => Promise<OnlineSession>) => {
    if (name.trim() !== settings.playerName) onSettings({ ...settings, playerName: name.trim() });
    setBusy(true);
    setErr(null);
    try {
      onRoom(await fn());
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  // opened from an invite link: join straight away once there is a name
  useEffect(() => {
    if (initialCode && settings.playerName) go(() => joinByCode(initialCode, settings.playerName));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="page online">
      <div className="page-head">
        <button className="icon-btn" onClick={onBack} aria-label="رجوع">
          →
        </button>
        <h2>العب أونلاين</h2>
      </div>
      <div className="field">
        <label>اسمك على الطاولة</label>
        <input className="text-in" value={name} maxLength={16} placeholder="مثلاً: بو فهد" onChange={(e) => setName(e.target.value)} />
      </div>

      <div className="field">
        <label>لعب سريع — مع لاعبين من كل مكان</label>
        <div className="home-row">
          <button className="btn primary" disabled={busy} onClick={() => go(() => quickMatch('bo6', player))}>
            {MODE_LABELS.bo6}
          </button>
          <button className="btn primary" disabled={busy} onClick={() => go(() => quickMatch('bo4', player))}>
            {MODE_LABELS.bo4}
          </button>
        </div>
        <p className="muted small">إذا ما اكتملت الطاولة خلال ثواني، البوتات تكمّل الكراسي الفاضية.</p>
      </div>

      <div className="field">
        <label>طاولة خاصة مع ربعك</label>
        <div className="seg">
          {(['bo6', 'bo4'] as ModeId[]).map((m) => (
            <button key={m} className={mode === m ? 'on' : ''} onClick={() => setMode(m)}>
              {MODE_LABELS[m]}
            </button>
          ))}
        </div>
        <button className="btn ghost" disabled={busy} onClick={() => go(() => createPrivate(mode, player, settings.preset))}>
          ➕ سوّ طاولة وادعِ ربعك
        </button>
        <p className="muted small">قوانين الجوكر: {PRESET_NAMES[settings.preset]} (من الإعدادات)</p>
      </div>

      <div className="field">
        <label>عندك كود طاولة؟</label>
        <div className="home-row">
          <input className="text-in code" value={code} maxLength={6} placeholder="K7QF3M" onChange={(e) => setCode(e.target.value.toUpperCase())} />
          <button className="btn ghost" disabled={busy || code.trim().length !== 6} onClick={() => go(() => joinByCode(code, player))}>
            ادخل
          </button>
        </div>
      </div>
      {busy && <p className="center muted">جاري الاتصال…</p>}
      {err && <p className="center err">{err}</p>}
    </div>
  );
}

/** A joined room: the lobby while waiting, then the game (the server sends the view). */
export function OnlineRoom({ session, settings, onToggleSound, onExit }: { session: OnlineSession; settings: Settings; onToggleSound: () => void; onExit: (msg?: string) => void }) {
  const state = useOnlineSession(session);
  const st = { ...state, send: (a: Parameters<OnlineSession['send']>[0]) => session.send(a), start: () => session.start(), leave: () => session.leave() };
  const [now, setNow] = useState(Date.now());
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (st.left && !st.game) onExit('خرجت من الطاولة');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st.left]);

  if (st.game) {
    return (
      <GameScreen
        key={session.room.roomId}
        settings={settings}
        online={{ state: { ...st, game: st.game }, send: st.send, leave: async () => { await st.leave(); onExit(); } }}
        onToggleSound={onToggleSound}
        onExit={async () => {
          await st.leave();
          onExit();
        }}
      />
    );
  }

  const lobby = st.lobby;
  const leave = async () => {
    await st.leave();
    onExit();
  };
  const startsIn = lobby?.startsInMs != null ? Math.max(0, Math.ceil((lobby.startsInMs - (now - st.lobbyAt)) / 1000)) : null;
  return (
    <div className="page lobby">
      <div className="page-head">
        <button className="icon-btn" onClick={leave} aria-label="خروج">
          →
        </button>
        <h2>{lobby?.isPrivate ? 'طاولتك الخاصة' : 'ندوّر لك لاعبين…'}</h2>
      </div>
      {!lobby && <p className="center muted">جاري الاتصال…</p>}
      {lobby && (
        <>
          {lobby.code && (
            <div className="invite">
              <p className="muted small">كود الطاولة</p>
              <div className="code big-code">{lobby.code}</div>
              <div className="home-row">
                <a className="btn primary" href={whatsappLink(lobby.code)} target="_blank" rel="noreferrer">
                  📲 ادعِ بالواتساب
                </a>
                <button
                  className="btn ghost"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(inviteLink(lobby.code!));
                      setCopied(true);
                    } catch {
                      /* ignore */
                    }
                  }}
                >
                  {copied ? '✓ انسخ' : '🔗 انسخ الرابط'}
                </button>
              </div>
            </div>
          )}
          <p className="muted center">{MODE_LABELS[lobby.mode]} · {lobby.seats.filter(Boolean).length}/{ar(lobby.seats.length)} لاعبين</p>
          <div className="lobby-seats">
            {lobby.seats.map((s, i) => (
              <div key={i} className={`lobby-seat ${s ? 'taken' : ''} ${i % 2 === 0 ? 'us' : 'them'}`}>
                <span className="avatar small">{s ? (i === 0 ? '★' : s.name[0]) : '?'}</span>
                <span>{s ? s.name + (i === 0 ? ' (أنت)' : '') : 'ننتظر…'}</span>
                <span className="muted small">{i % 2 === 0 ? 'فريقك' : 'الخصم'}</span>
              </div>
            ))}
          </div>
          {lobby.isPrivate ? (
            lobby.isHost ? (
              <button className="btn primary big" onClick={st.start}>
                ابدأ اللعب — البوتات تكمّل الكراسي الفاضية
              </button>
            ) : (
              <p className="center muted">ننتظر صاحب الطاولة يبدأ…</p>
            )
          ) : (
            startsIn !== null && <p className="center muted">إذا ما اكتملت، البوتات تكمّل بعد {ar(startsIn)} ثانية</p>
          )}
        </>
      )}
    </div>
  );
}
