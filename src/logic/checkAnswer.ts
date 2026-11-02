import { CAPITAL_ALIASES, NAME_ALIASES } from '../data/aliases';
import { COUNTRIES, type Country, type Kind, asksCapital } from './types';

/** «Санкт-Петербург», «санкт петербург», «САНКТ—ПЕТЕРБУРГ» → одно и то же. Также ё→е, é→e, «The Gambia»→«gambia». */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '') // диакритика (в т.ч. ё→е, й→и — одинаково с обеих сторон, не страшно)
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/^the /, '');
}

/** Все допустимые ответы на вопрос «что это за страна» / «какая столица» (оба языка). */
export function acceptedAnswers(c: Country, kind: Kind): string[] {
  return asksCapital(kind)
    ? [...c.capital.en, ...c.capital.ru, ...(CAPITAL_ALIASES[c.code] ?? [])]
    : [c.name.en, c.name.ru, ...c.aliases.en, ...c.aliases.ru, ...(NAME_ALIASES[c.code] ?? [])];
}

export function levenshtein(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

/** Сколько опечаток прощаем: в коротких словах ни одной (USA/UAE), дальше 1, в длинных 2. */
const tolerance = (len: number) => (len <= 3 ? 0 : len <= 6 ? 1 : 2);

const cache = new Map<string, string[]>();
function normalizedAnswers(c: Country, kind: Kind) {
  const key = c.code + kind;
  if (!cache.has(key)) cache.set(key, acceptedAnswers(c, kind).map(normalize));
  return cache.get(key)!;
}

export type TextVerdict = 'exact' | 'fuzzy' | 'wrong';

/**
 * Проверка текстового ответа. Опечатка засчитывается, только если ответ не ближе
 * (или так же близок) к другой стране — иначе «Austria» прошла бы за «Australia», а «Nigeria» за «Niger».
 */
export function checkText(input: string, target: Country, kind: Kind, all: Country[] = COUNTRIES): TextVerdict {
  const n = normalize(input);
  if (!n) return 'wrong';
  const dist = (c: Country) => Math.min(...normalizedAnswers(c, kind).map((a) => levenshtein(n, a)));
  const d = dist(target);
  if (d === 0) return 'exact';
  if (d > tolerance(n.length)) return 'wrong';
  return all.some((c) => c !== target && dist(c) <= d) ? 'wrong' : 'fuzzy';
}
