import { useState } from 'react';
import { GameState, ModeId, buildRules } from './engine';
import { GameScreen, newGame } from './ui/GameScreen';
import { Home, RulesScreen, SettingsScreen } from './ui/Screens';
import { Settings, loadSavedGame, loadSettings, saveGame, saveSettings } from './ui/settings';

type Screen = { name: 'home' } | { name: 'settings' } | { name: 'rules' } | { name: 'game'; game: GameState };

function restore(): GameState | null {
  const g = loadSavedGame<GameState>();
  if (!g || !g.rules || g.phase === 'gameOver') return null;
  // always play with the CURRENT rules.config.ts (keeps the saved joker preset)
  return { ...g, rules: buildRules(g.rules.activeJokerPreset) };
}

export default function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const [saved, setSaved] = useState<GameState | null>(restore);

  const update = (s: Settings) => {
    setSettings(s);
    saveSettings(s);
  };

  if (screen.name === 'game') {
    return (
      <GameScreen
        key={screen.game.seed}
        settings={settings}
        initial={screen.game}
        onToggleSound={() => update({ ...settings, sound: !settings.sound })}
        onExit={() => {
          setSaved(restore());
          setScreen({ name: 'home' });
        }}
      />
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
      onSettings={() => setScreen({ name: 'settings' })}
      onRules={() => setScreen({ name: 'rules' })}
    />
  );
}
