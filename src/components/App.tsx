import { useEffect, useState } from 'react';
import { supabase } from '../logic/cloud';
import { loadSettings, loadStats, saveSettings, syncWithCloud } from '../logic/progress';
import { generateSession, retrySession } from '../logic/questions';
import { firstTry, type Answer, type Question, type Region, type Settings } from '../logic/types';
import { QuizScreen } from './QuizScreen';
import type { SyncState } from './AccountPanel';
import { MistakesScreen } from './MistakesScreen';
import { StudyScreen } from './StudyScreen';
import { ResultScreen } from './ResultScreen';
import { SettingsScreen } from './SettingsScreen';

type Screen = 'settings' | 'quiz' | 'result' | 'mistakes' | 'study';

export function App() {
  const [screen, setScreen] = useState<Screen>('settings');
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [session, setSession] = useState(0); // меняется при каждом старте, чтобы QuizScreen начинался заново
  const [studyRegion, setStudyRegion] = useState<Region>('Europe');
  const [email, setEmail] = useState<string | null>(null);
  const [sync, setSync] = useState<SyncState>('off');

  // Вход/выход в облако: после входа (и при запуске, если уже вошли) сливаем прогресс с облачным.
  useEffect(() => {
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((event, auth) => {
      if (!['INITIAL_SESSION', 'SIGNED_IN', 'SIGNED_OUT'].includes(event)) return;
      setEmail(auth?.user.email ?? null);
      if (!auth) return setSync('off');
      setSync('syncing');
      // setTimeout: Supabase не советует вызывать свои методы прямо из этого обработчика
      setTimeout(() => syncWithCloud().then((s) => { setSettings(s); setSync('ok'); }, (e) => { console.warn(e); setSync('error'); }));
    });
    return () => data.subscription.unsubscribe();
  }, []);

  function start(qs: Question[]) {
    setQuestions(qs);
    setSession((n) => n + 1);
    setScreen('quiz');
  }

  function changeSettings(s: Settings) {
    setSettings(s);
    saveSettings(s);
  }

  return (
    <main>
      {screen === 'settings' && (
        <SettingsScreen settings={settings} onChange={changeSettings} onStart={() => start(generateSession(settings, loadStats()))} onMistakes={() => setScreen('mistakes')} onStudy={(r) => { setStudyRegion(r); setScreen('study'); }} email={email} sync={sync} />
      )}
      {screen === 'quiz' && (
        <QuizScreen key={session} questions={questions} lang={settings.lang} sovereignOnly={settings.scope === 'sovereign'} keepMarks={settings.keepMarks} onFinish={(a) => { setAnswers(a); setScreen('result'); }} />
      )}
      {screen === 'result' && (
        <ResultScreen
          answers={answers}
          lang={settings.lang}
          onRetry={() => start(retrySession(answers.filter((a) => !firstTry(a)).map((a) => a.question)))}
          onNew={() => start(generateSession(settings, loadStats()))}
          onSettings={() => setScreen('settings')}
          onMistakes={() => setScreen('mistakes')}
        />
      )}
      {screen === 'study' && (
        <StudyScreen
          region={studyRegion}
          settings={settings}
          onBack={() => setScreen('settings')}
          onQuiz={(onlyNew, subregion) => start(generateSession({ ...settings, regions: [studyRegion], subregion, onlyNew }, loadStats()))}
        />
      )}
      {screen === 'mistakes' && <MistakesScreen lang={settings.lang} onBack={() => setScreen('settings')} />}
    </main>
  );
}
