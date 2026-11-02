import type { Stats } from './progress';
import { CITIES } from '../data/cities';
import { SCATTERED_SHAPES } from './geo';
import { COUNTRIES, asksCapital, type Country, type Kind, type Lang, type Mode, type Option, type Question, type Settings } from './types';

/*
 * Что значит каждая клетка матрицы «режим × тип»:
 *
 *             | map (кликнуть на карте)        | choice / text (выбрать / написать)
 * ------------+--------------------------------+-------------------------------------
 *  name       | дано название → найти страну   | страна подсвечена на карте → назвать
 *  flag       | дан флаг → найти страну        | дан флаг → назвать страну
 *  shape      | дан контур → найти страну      | дан контур → назвать страну
 *  capital    | —                              | дана страна → назвать столицу
 *  byCapital  | дана столица → найти страну    | дана столица → назвать страну
 *  mapFlag    | —                              | страна подсвечена → выбрать её флаг (только выбор)
 *  mapCapital | —                              | страна подсвечена → назвать столицу
 */

/** Подходит ли тип вопроса к режиму: флаг не напишешь текстом, а подсвеченную страну незачем искать на карте. */
export function fitsMode(mode: Mode, kind: Kind): boolean {
  if (kind === 'mapFlag') return mode === 'choice';
  if (kind === 'mapCapital' || kind === 'capital') return mode !== 'map'; // столицу на карте не кликнешь
  return true;
}

/** Все включённые пары «тип × способ ответа». */
export const enabledCombos = (s: Settings) =>
  (Object.entries(s.play) as [Kind, Mode[]][]).flatMap(([kind, modes]) => modes.filter((m) => fitsMode(m, kind)).map((mode) => ({ mode, kind })));

/** Территории, чья столица называется так же, как у суверенной страны (Kingston: Ямайка и Норфолк) — по столице не спрашиваем. */
const AMBIGUOUS_CAPITAL = new Set(
  COUNTRIES.filter((c) => !c.sovereign && c.capital.en.length &&
    COUNTRIES.some((o) => o.sovereign && (o.capital.en[0] === c.capital.en[0] || o.capital.ru[0] === c.capital.ru[0])))
    .map((c) => c.code),
);

/** Можно ли однозначно задать такой вопрос про эту страну. Режим не важен: на карте кликабельна любая страна (контур или точка). */
export function canAsk(c: Country, kind: Kind): boolean {
  if (kind === 'flag' || kind === 'mapFlag') return !c.flagShared;
  if (asksCapital(kind)) return c.capital.en.length > 0;
  if (kind === 'byCapital') return c.capital.en.length > 0 && !AMBIGUOUS_CAPITAL.has(c.code);
  if (kind === 'shape') return c.hasShape && !SCATTERED_SHAPES.has(c.code);
  return true;
}

/** Текст варианта ответа / правильного ответа. */
export function answerLabel(c: Country, kind: Kind, lang: Lang): string {
  return asksCapital(kind) ? c.capital[lang][0] : c.name[lang];
}

export function countryPool(s: Settings): Country[] {
  return COUNTRIES.filter((c) => (s.scope === 'all' || c.sovereign) && s.regions.includes(c.region));
}

function shuffle<T>(a: T[], rng: () => number): T[] {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

const optionOf = (c: Country, kind: Kind): Option => ({ id: c.code, label: { en: answerLabel(c, kind, 'en'), ru: answerLabel(c, kind, 'ru') } });

/**
 * count вариантов: правильный + обманки, по возможности из того же региона, с разными подписями.
 * Для «столица страны» половина обманок — другие крупные города этой же страны (src/data/cities.ts).
 */
function pickOptions(target: Country, kind: Kind, s: Settings, rng: () => number): Option[] {
  const options = [optionOf(target, kind)];
  const labels = new Set([options[0].label.en, options[0].label.ru]);
  const add = (o: Option) => {
    if (options.length >= s.optionCount || labels.has(o.label.en) || labels.has(o.label.ru)) return; // напр. две «Kingston»
    labels.add(o.label.en).add(o.label.ru);
    options.push(o);
  };

  if (asksCapital(kind)) {
    const cities = shuffle(CITIES[target.code] ?? [], rng).slice(0, Math.floor((s.optionCount - 1) / 2) || 1);
    cities.forEach((city, i) => {
      const [en, ru] = city.split('|');
      add({ id: `${target.code}:city:${i}`, label: { en, ru } });
    });
  }

  const ok = (c: Country) => c !== target && (s.scope === 'all' || c.sovereign) && canAsk(c, kind);
  const near = shuffle(COUNTRIES.filter((c) => ok(c) && c.region === target.region), rng);
  const far = shuffle(COUNTRIES.filter((c) => ok(c) && c.region !== target.region), rng);
  for (const c of [...near, ...far]) add(optionOf(c, kind));
  return shuffle(options, rng);
}

/** Чем чаще ошибались по стране (в выбранных типах вопросов), тем чаще она выпадает. */
function weight(c: Country, kinds: Kind[], stats: Stats): number {
  let right = 0, wrong = 0;
  for (const k of kinds) {
    right += stats[`${c.code}:${k}`]?.right ?? 0;
    wrong += stats[`${c.code}:${k}`]?.wrong ?? 0;
  }
  return 1 + (3 * wrong) / (right + wrong + 1);
}

/** Сессия: каждая страна не больше одного раза, режим и тип — случайные из выбранных и допустимых для неё. */
export function generateSession(s: Settings, stats: Stats = {}, rng: () => number = Math.random): Question[] {
  const all = enabledCombos(s);
  const kinds = [...new Set(all.map((x) => x.kind))];
  const ordered = countryPool(s)
    .map((c) => ({ c, key: rng() ** (1 / weight(c, kinds, stats)) })) // взвешенная выборка без повторов
    .sort((a, b) => b.key - a.key);

  const out: Question[] = [];
  for (const { c } of ordered) {
    if (s.length !== 'all' && out.length >= s.length) break;
    const combos = all.filter(({ kind }) => canAsk(c, kind));
    if (!combos.length) continue;
    const { mode, kind } = combos[Math.floor(rng() * combos.length)];
    out.push({ country: c, mode, kind, options: mode === 'choice' ? pickOptions(c, kind, s, rng) : undefined });
  }
  return out;
}

/** Повтор ошибок: те же вопросы в новом порядке. */
export function retrySession(questions: Question[], rng: () => number = Math.random): Question[] {
  return shuffle(questions, rng).map((q) => (q.options ? { ...q, options: shuffle(q.options, rng) } : q));
}
