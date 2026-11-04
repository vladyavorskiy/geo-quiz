import { beforeEach, describe, expect, it, vi } from 'vitest';

// Подменяем облако: «в облаке» лежит прогресс с другого устройства.
const pushed: unknown[] = [];
vi.mock('./cloud', () => ({
  pull: async () => ({ settings: { lang: 'en', length: 50 }, stats: { 'FRA:flag': { right: 5, wrong: 0 }, 'RUS:name': { right: 1, wrong: 1 } } }),
  push: async (d: unknown) => { pushed.push(d); },
  schedulePush: () => {},
}));

// Простой localStorage для node.
const store = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: () => null,
  length: 0,
} as Storage;

describe('syncWithCloud', () => {
  beforeEach(() => { store.clear(); pushed.length = 0; });

  it('сливает локальный и облачный прогресс, берёт настройки из облака и отправляет итог обратно', async () => {
    const { syncWithCloud, loadStats } = await import('./progress');
    localStorage.setItem('geo-quiz:stats:v1', JSON.stringify({ 'FRA:flag': { right: 2, wrong: 3 }, 'PER:shape': { right: 0, wrong: 1 } }));

    const settings = await syncWithCloud();

    expect(settings.lang).toBe('en');
    expect(settings.length).toBe(50);
    expect(settings.play.flag).toBeDefined(); // недостающее берётся из настроек по умолчанию
    expect(loadStats()).toEqual({
      'FRA:flag': { right: 5, wrong: 3, streak: 5 }, // в облаке 5 верных без ошибок — серия 5
      'PER:shape': { right: 0, wrong: 1 },
      'RUS:name': { right: 1, wrong: 1 },
    });
    expect(pushed).toHaveLength(1);
    expect((pushed[0] as { stats: unknown }).stats).toEqual(loadStats());
  });
});

describe('recordAnswer', () => {
  beforeEach(() => store.clear());
  it('ведёт серию верных ответов подряд и обнуляет её при ошибке', async () => {
    const { recordAnswer, loadStats, isLearned, LEARNED_STREAK: N } = await import('./progress');
    const { BY_CODE } = await import('./types');
    const q = { country: BY_CODE.get('FRA')!, mode: 'choice' as const, kind: 'flag' as const };
    for (let i = 1; i < N; i++) recordAnswer(q, true);
    expect(isLearned(loadStats()['FRA:flag'])).toBe(false);
    recordAnswer(q, true);
    expect(loadStats()['FRA:flag']).toEqual({ right: N, wrong: 0, streak: N });
    expect(isLearned(loadStats()['FRA:flag'])).toBe(true);
    recordAnswer(q, false);
    expect(loadStats()['FRA:flag']).toEqual({ right: N, wrong: 1, streak: 0 });
    expect(isLearned(loadStats()['FRA:flag'])).toBe(false);
  });
});
