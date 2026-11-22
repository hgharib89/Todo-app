import { Suspense, lazy, useEffect, useState } from 'react';
import type { OnlineSession } from './net/online';
import { GameState, ModeId, buildRules } from './engine';
import { GameScreen, newGame } from './ui/GameScreen';
import { Home, RulesScreen, SettingsScreen } from './ui/Screens';
// online play (and its network library) is loaded only when used
const OnlineMenu = lazy(() => import('./ui/OnlineScreens').then((m) => ({ default: m.OnlineMenu })));
const OnlineRoom = lazy(() => import('./ui/OnlineScreens').then((m) => ({ default: m.OnlineRoom })));
const loading = <p className="center muted" style={{ paddingTop: '40vh' }}>…</p>;
import { Settings, loadSavedGame, loadSettings, saveGame, saveSettings } from './ui/settings';
import { isRoomCode } from '../server/src/codes-shared';
import { hasOnlineSeat, onlineAvailable } from './net/config';

type Screen =
  | { name: 'home' }
  | { name: 'settings' }
  | { name: 'rules' }
  | { name: 'game'; game: GameState }
  | { name: 'online'; code: string }
  | { name: 'room'; session: OnlineSession };

function restore(): GameState | null {
  const g = loadSavedGame<GameState>();
  if (!g || !g.rules || g.phase === 'gameOver') return null;
  // always play with the CURRENT rules.config.ts (keeps the saved joker preset)
  return { ...g, tricks: g.tricks ?? [], reneges: g.reneges ?? [], lastCatch: g.lastCatch ?? null, rules: buildRules(g.rules.activeJokerPreset) };
}

/** ?room=CODE from a WhatsApp invite */
function inviteCode(): string {
  try {
    const c = new URLSearchParams(window.location.search).get('room')?.toUpperCase() ?? '';
    return isRoomCode(c) ? c : '';
  } catch {
    return '';
  }
}

export default function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [screen, setScreen] = useState<Screen>(() => (onlineAvailable() && inviteCode() ? { name: 'online', code: inviteCode() } : { name: 'home' }));
  const [saved, setSaved] = useState<GameState | null>(restore);

  // a page refresh in the middle of an online game: go back to the same seat
  useEffect(() => {
    if (onlineAvailable() && hasOnlineSeat()) {
      import('./net/online').then((m) => m.resumeRoom()).then((session) => session && setScreen({ name: 'room', session }));
    }
  }, []);

  const update = (s: Settings) => {
    setSettings(s);
    saveSettings(s);
  };
  const toggleSound = () => update({ ...settings, sound: !settings.sound });

  if (screen.name === 'game') {
    return (
      <GameScreen
        key={screen.game.seed}
        settings={settings}
        initial={screen.game}
        onToggleSound={toggleSound}
        onExit={() => {
          setSaved(restore());
          setScreen({ name: 'home' });
        }}
      />
    );
  }
  if (screen.name === 'online') {
    return (
      <Suspense fallback={loading}>
        <OnlineMenu
          settings={settings}
          onSettings={update}
          initialCode={screen.code}
          onRoom={(session) => setScreen({ name: 'room', session })}
          onBack={() => setScreen({ name: 'home' })}
        />
      </Suspense>
    );
  }
  if (screen.name === 'room') {
    return (
      <Suspense fallback={loading}>
        <OnlineRoom session={screen.session} settings={settings} onToggleSound={toggleSound} onExit={() => setScreen({ name: 'online', code: '' })} />
      </Suspense>
    );
  }
  if (screen.name === 'settings') return <SettingsScreen settings={settings} onChange={update} onBack={() => setScreen({ name: 'home' })} />;
  if (screen.name === 'rules') return <RulesScreen settings={settings} onBack={() => setScreen({ name: 'home' })} />;
  return (
    <Home
      settings={settings}
      hasSaved={!!saved}
      onResume={() => saved && setScreen({ name: 'game', game: saved })}
      onPlay={(mode: ModeId) => {
        const s = { ...settings, mode };
        update(s);
        saveGame(null);
        setScreen({ name: 'game', game: newGame(s) });
      }}
      onOnline={onlineAvailable() ? () => setScreen({ name: 'online', code: '' }) : undefined}
      onSettings={() => setScreen({ name: 'settings' })}
      onRules={() => setScreen({ name: 'rules' })}
    />
  );
}
