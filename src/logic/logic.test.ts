import { describe, expect, it, vi } from 'vitest';
import { checkText, normalize } from './checkAnswer';
import { DOTS, SHAPES, countryOutline } from './geo';
import { DEFAULT_SETTINGS } from './progress';
import { canAsk, countryPool, generateSession } from './questions';
import { BY_CODE, COUNTRIES, KINDS, MODES, type Kind, type Mode, type Settings } from './types';

const play = (kinds: Kind[], modes: Mode[]) => Object.fromEntries(kinds.map((k) => [k, modes]));

const c = (code: string) => BY_CODE.get(code)!;

describe('checkText', () => {
  it('принимает оба языка, алиасы, регистр, ё/е, диакритику', () => {
    for (const s of ['США', 'usa', 'United States', 'соединенные штаты америки', 'Америка']) {
      expect(checkText(s, c('USA'), 'name')).toBe('exact');
    }
    expect(checkText('кот-д’ивуар', c('CIV'), 'name')).toBe('exact');
    expect(checkText('Bogota', c('COL'), 'capital')).toBe('exact');
    expect(checkText('кишинев', c('MDA'), 'capital')).toBe('exact');
  });
  it('прощает опечатки', () => {
    expect(checkText('Францыя', c('FRA'), 'name')).toBe('fuzzy');
    expect(checkText('Kazakstan', c('KAZ'), 'name')).toBe('fuzzy');
  });
  it('не путает похожие страны', () => {
    expect(checkText('Austria', c('AUS'), 'name')).toBe('wrong');
    expect(checkText('Nigeria', c('NER'), 'name')).toBe('wrong');
    expect(checkText('UAE', c('USA'), 'name')).toBe('wrong');
    expect(checkText('', c('USA'), 'name')).toBe('wrong');
  });
  it('общие названия столиц засчитываются обеим странам', () => {
    expect(checkText('Kingston', c('JAM'), 'capital')).toBe('exact');
    expect(checkText('Kingston', c('NFK'), 'capital')).toBe('exact');
  });
  it('normalize', () => expect(normalize('  The  Gambia ')).toBe('gambia'));
});

describe('generateSession', () => {
  const all: Settings = { ...DEFAULT_SETTINGS, scope: 'all', regions: [...DEFAULT_SETTINGS.regions, 'Antarctic'], length: 'all' };

  it('без повторов, только допустимые сочетания, варианты корректны', () => {
    const qs = generateSession(all);
    expect(new Set(qs.map((q) => q.country.code)).size).toBe(qs.length);
    expect(qs.length).toBe(COUNTRIES.length);
    for (const q of qs) {
      expect(canAsk(q.country, q.kind)).toBe(true);
      if (q.mode === 'choice') {
        expect(q.options).toHaveLength(4);
        expect(q.options!.filter((o) => o.id === q.country.code)).toHaveLength(1);
        const labels = q.options!.map((o) => o.label.ru);
        expect(new Set(labels).size).toBe(labels.length);
      }
    }
  });
  it('уважает длину, регионы и scope', () => {
    const s: Settings = { ...DEFAULT_SETTINGS, regions: ['Europe'], length: 10, play: play(['capital'], ['text']) };
    const qs = generateSession(s);
    expect(qs).toHaveLength(10);
    expect(qs.every((q) => q.country.region === 'Europe' && q.country.sovereign && q.mode === 'text')).toBe(true);
    expect(countryPool(DEFAULT_SETTINGS).every((x) => x.sovereign)).toBe(true);
  });
  it('пропускает страны, о которых нельзя спросить', () => {
    const qs = generateSession({ ...all, play: play(['flag'], [...MODES]) });
    expect(qs.some((q) => q.country.code === 'GUF')).toBe(false);
    expect(KINDS).toContain('flag');
  });
});

describe('geo', () => {
  it('у каждой страны есть контур или точка, мелкие — точки', () => {
    const clickable = new Set([...SHAPES.map((s) => s.code), ...DOTS.map((d) => d.code)]);
    expect(COUNTRIES.filter((x) => !clickable.has(x.code)).map((x) => x.code)).toEqual([]);
    for (const code of ['MCO', 'VAT', 'SGP', 'MLT', 'TUV', 'GUF']) expect(DOTS.some((d) => d.code === code)).toBe(true);
    expect(DOTS.some((d) => d.code === 'FRA')).toBe(false);
    expect(countryOutline('RUS', 400, 300).length).toBeGreaterThan(100);
  });
});

describe('hintFor', () => {
  it('каждый уровень содержит цель и сужает круг', async () => {
    const { hintFor } = await import('./hints');
    for (const code of ['FRA', 'PER', 'MCO', 'FJI', 'KAZ']) {
      const sizes = [1, 2, 3].map((lvl) => hintFor(c(code), lvl, COUNTRIES));
      sizes.forEach((h) => expect(h.active.has(code)).toBe(true));
      expect(sizes[0].active.size).toBeGreaterThanOrEqual(sizes[1].active.size);
      expect(sizes[2].active.size).toBe(6);
      expect(sizes[2].circle!.r).toBeGreaterThan(0);
    }
  });
});

describe('столицы и варианты', () => {
  const base: Settings = { ...DEFAULT_SETTINGS, length: 'all', regions: ['Europe', 'Asia', 'Africa', 'Americas', 'Oceania'] };

  it('столица страны: среди обманок есть города этой страны, число вариантов из настроек', () => {
    for (const n of [2, 3, 6, 8]) {
      const qs = generateSession({ ...base, play: play(['capital'], ['choice']), optionCount: n });
      expect(qs.every((q) => q.options!.length === n)).toBe(true);
      const rus = qs.find((q) => q.country.code === 'RUS')!;
      expect(rus.options!.some((o) => o.id.startsWith('RUS:city:'))).toBe(true);
      expect(rus.options!.map((o) => o.label.ru)).toContain('Москва');
    }
  });
  it('столицу на карте не кликают: «столица страны» без других способов не даёт вопросов, «страна по столице» — даёт', () => {
    expect(generateSession({ ...base, play: play(['capital'], ['map']) })).toHaveLength(0);
    const qs = generateSession({ ...base, play: play(['byCapital'], ['map']) });
    expect(qs.length).toBeGreaterThan(100);
    expect(qs.every((q) => q.kind === 'byCapital' && q.mode === 'map')).toBe(true);
  });
  it('у каждого типа свои способы ответа', () => {
    const qs = generateSession({ ...base, play: { flag: ['map'], capital: ['text'] } });
    for (const q of qs) expect(q.kind === 'flag' ? q.mode === 'map' : q.kind === 'capital' && q.mode === 'text').toBe(true);
    expect(new Set(qs.map((q) => q.kind)).size).toBe(2);
  });
  it('страна по столице: ответ — название страны', () => {
    expect(checkText('Ямайка', c('JAM'), 'byCapital')).toBe('exact');
    expect(checkText('Кингстон', c('JAM'), 'byCapital')).toBe('wrong');
    expect(canAsk(c('NFK'), 'byCapital')).toBe(false); // Kingston — уже столица Ямайки
    expect(canAsk(c('JAM'), 'byCapital')).toBe(true);
  });
});

describe('контуры', () => {
  it('архипелаги без главного острова не спрашиваем, страны с далёкими островами — спрашиваем', async () => {
    const { SCATTERED_SHAPES } = await import('./geo');
    for (const code of ['FSM', 'MDV', 'PYF']) expect(canAsk(c(code), 'shape')).toBe(false);
    for (const code of ['FRA', 'NLD', 'NZL', 'JPN', 'IDN', 'GBR']) expect(canAsk(c(code), 'shape')).toBe(true);
    expect(SCATTERED_SHAPES.size).toBeLessThan(20);
  });
});

describe('страна подсвечена на карте', () => {
  const base: Settings = { ...DEFAULT_SETTINGS, length: 'all' };
  it('флаг подсвеченной страны — только выбором, столица — выбором или текстом, но не кликом', () => {
    const qs = generateSession({ ...base, play: play(['mapFlag', 'mapCapital'], [...MODES]) });
    expect(qs.length).toBeGreaterThan(100);
    for (const q of qs) {
      if (q.kind === 'mapFlag') expect(q.mode).toBe('choice');
      if (q.kind === 'mapCapital') expect(q.mode).not.toBe('map');
    }
    expect(generateSession({ ...base, play: play(['mapFlag'], ['text']) })).toHaveLength(0);
  });
  it('столица подсвеченной страны: варианты — столицы и города, текст проверяется как столица', () => {
    const qs = generateSession({ ...base, play: play(['mapCapital'], ['choice']) });
    const rus = qs.find((q) => q.country.code === 'RUS')!;
    expect(rus.options!.map((o) => o.label.ru)).toContain('Москва');
    expect(rus.options!.some((o) => o.id.startsWith('RUS:city:'))).toBe(true);
    expect(checkText('Москва', c('RUS'), 'mapCapital')).toBe('exact');
    expect(checkText('Россия', c('RUS'), 'mapCapital')).toBe('wrong');
  });
});

describe('мои ошибки', () => {
  it('группирует по типам вопросов, без верных-без-ошибок и мусорных ключей, частые ошибки сверху', async () => {
    const { groupMistakes } = await import('../components/MistakesScreen');
    const g = groupMistakes({
      'FRA:flag': { right: 3, wrong: 1 }, 'PER:flag': { right: 0, wrong: 4 }, 'DEU:flag': { right: 5, wrong: 0 },
      'RUS:capital': { right: 1, wrong: 2 }, 'XXX:flag': { right: 0, wrong: 1 }, 'FRA:oldKind': { right: 0, wrong: 1 },
    });
    expect(g.flag!.map((r) => r.country.code)).toEqual(['PER', 'FRA']);
    expect(g.capital!.map((r) => r.country.code)).toEqual(['RUS']);
    expect(Object.keys(g).sort()).toEqual(['capital', 'flag']);
  });
});

describe('облако', () => {
  it('слияние счёта: по каждой паре берётся больший счёт, новые пары добавляются', async () => {
    const { mergeStats } = await import('./progress');
    expect(mergeStats(
      { 'FRA:flag': { right: 3, wrong: 1 }, 'PER:flag': { right: 0, wrong: 2 } },
      { 'FRA:flag': { right: 2, wrong: 4 }, 'RUS:capital': { right: 1, wrong: 0 } },
    )).toEqual({ 'FRA:flag': { right: 3, wrong: 4, streak: 0 }, 'PER:flag': { right: 0, wrong: 2 }, 'RUS:capital': { right: 1, wrong: 0 } });
  });
  it('без ключей Supabase облако выключено, приложение работает локально', async () => {
    // Локально Vitest читает .env.local с настоящими ключами — убираем их на время теста и грузим модуль заново.
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
    vi.resetModules();
    try {
      const { supabase, pull } = await import('./cloud');
      expect(supabase).toBeNull();
      expect(await pull()).toBeNull();
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe('выучено и прогресс по регионам', () => {
  it('isLearned: нужна серия из LEARNED_STREAK верных подряд; старые записи без streak — по отсутствию ошибок', async () => {
    const { isLearned, LEARNED_STREAK: N } = await import('./progress');
    expect(isLearned(undefined)).toBe(false);
    expect(isLearned({ right: N, wrong: 0, streak: N })).toBe(true);
    expect(isLearned({ right: N + 3, wrong: 1, streak: N - 1 })).toBe(false);
    expect(isLearned({ right: N, wrong: 0 })).toBe(true);
    expect(isLearned({ right: N - 1, wrong: 0 })).toBe(false);
    expect(isLearned({ right: N + 1, wrong: 1 })).toBe(false);
  });

  it('regionProgress считает страну выученной, только если выучены все включённые типы', async () => {
    const { regionProgress } = await import('./questions');
    const { LEARNED_STREAK: N } = await import('./progress');
    const s: Settings = { ...DEFAULT_SETTINGS, play: { flag: ['choice'], capital: ['text'] } };
    const p0 = regionProgress(s, {});
    expect(p0.Europe.learned).toBe(0);
    expect(p0.Europe.total).toBeGreaterThan(40);
    const ok = { right: N, wrong: 0, streak: N };
    expect(regionProgress(s, { 'FRA:flag': ok }).Europe.learned).toBe(0); // столицу ещё не выучили
    expect(regionProgress(s, { 'FRA:flag': ok, 'FRA:capital': ok }).Europe.learned).toBe(1);
  });

  it('«только невыученные» пропускает выученные пары', async () => {
    const { LEARNED_STREAK: N } = await import('./progress');
    const ok = { right: N, wrong: 0, streak: N };
    const s: Settings = { ...DEFAULT_SETTINGS, regions: ['Europe'], length: 'all', play: { flag: ['choice'] }, onlyNew: true };
    const all = generateSession({ ...s, onlyNew: false });
    const fresh = generateSession(s, { 'FRA:flag': ok, 'DEU:flag': ok });
    expect(fresh).toHaveLength(all.length - 2);
    expect(fresh.some((q) => q.country.code === 'FRA')).toBe(false);
  });
});

describe('субрегион', () => {
  it('сессия только по выбранному субрегиону', () => {
    const qs = generateSession({ ...DEFAULT_SETTINGS, regions: ['Europe'], subregion: 'Western Europe', length: 'all', play: { flag: ['choice'] } });
    expect(qs.length).toBeGreaterThan(3);
    expect(qs.every((q) => q.country.subregion === 'Western Europe')).toBe(true);
    expect(countryPool({ ...DEFAULT_SETTINGS, regions: ['Europe'] }).some((c) => c.subregion !== 'Western Europe')).toBe(true);
  });
});
