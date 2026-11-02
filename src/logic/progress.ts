import { pull, push, schedulePush } from './cloud';
import { KINDS, MODES, REGIONS, type Kind, type Mode, type Question, type Settings } from './types';

/** Счёт по паре «страна:тип», напр. "FRA:flag". */
export type Stats = Record<string, { right: number; wrong: number }>;

// При несовместимом изменении формата — увеличьте версию в ключе.
const SETTINGS_KEY = 'geo-quiz:settings:v1';
const STATS_KEY = 'geo-quiz:stats:v1';

export const DEFAULT_SETTINGS: Settings = {
  lang: 'ru',
  play: Object.fromEntries(KINDS.map((k) => [k, [...MODES]])),
  regions: REGIONS.filter((r) => r !== 'Antarctic'),
  scope: 'sovereign',
  length: 20,
  keepMarks: true,
  optionCount: 4,
};

function read<T>(key: string): Partial<T> {
  try {
    return JSON.parse(localStorage.getItem(key) ?? '{}');
  } catch {
    return {}; // повреждённые данные или недоступный localStorage — начинаем с нуля
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // приватный режим / переполнение — прогресс просто не сохранится
  }
}

export function loadSettings(): Settings {
  const saved = read<Settings & { modes?: Mode[]; kinds?: Kind[] }>(SETTINGS_KEY);
  // Старый формат: общий список способов ответа и общий список типов → у каждого выбранного типа все выбранные способы.
  if (!saved.play && saved.kinds && saved.modes) saved.play = Object.fromEntries(saved.kinds.map((k) => [k, [...saved.modes!]]));
  const { modes: _m, kinds: _k, ...rest } = saved;
  return { ...DEFAULT_SETTINGS, ...rest };
}
export function saveSettings(s: Settings) {
  write(SETTINGS_KEY, s);
  schedulePush(localData);
}
export const loadStats = (): Stats => read<Stats>(STATS_KEY) as Stats;

export function recordAnswer(q: Question, correct: boolean) {
  const stats = loadStats();
  const key = `${q.country.code}:${q.kind}`;
  const s = stats[key] ?? { right: 0, wrong: 0 };
  stats[key] = correct ? { ...s, right: s.right + 1 } : { ...s, wrong: s.wrong + 1 };
  write(STATS_KEY, stats);
  schedulePush(localData);
}

const localData = () => ({ settings: loadSettings(), stats: loadStats() });

/**
 * Слить два счёта: по каждой паре «страна:тип» берём больший счёт верных и больший — ошибок.
 * shortcut: ответы, данные на двух устройствах офлайн в одно и то же время, засчитаются по большему из них, а не суммой —
 *   для одного игрока это редкость; если станет важно, хранить в облаке журнал ответов вместо счётчиков.
 */
export function mergeStats(a: Stats, b: Stats): Stats {
  const out: Stats = { ...a };
  for (const [k, v] of Object.entries(b)) {
    const w = out[k];
    out[k] = w ? { right: Math.max(w.right, v.right), wrong: Math.max(w.wrong, v.wrong) } : v;
  }
  return out;
}

/**
 * Синхронизация после входа и при запуске: облачный прогресс сливается с локальным,
 * результат сохраняется в обе стороны. Настройки берутся из облака, если они там есть.
 */
export async function syncWithCloud(): Promise<Settings> {
  const remote = await pull();
  const stats = mergeStats(loadStats(), remote?.stats ?? {});
  write(STATS_KEY, stats);
  if (remote?.settings) write(SETTINGS_KEY, remote.settings);
  await push({ settings: loadSettings(), stats });
  return loadSettings();
}
