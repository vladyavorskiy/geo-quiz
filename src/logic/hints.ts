import { centerOf } from './geo';
import type { Country } from './types';

/**
 * Подсказки для режима «на карте». Каждый уровень сужает круг стран, остальные затемняются:
 *  1 — часть света, 2 — субрегион, 3 — круг из ближайших стран (цель не в центре круга).
 * Активные страны всегда идут одним куском карты: так подсказка учит, где страна, а не превращает вопрос в «угадай из 6».
 */
export const MAX_HINT = 3;
const CIRCLE_COUNT = 6;

export interface Hint {
  active: Set<string>;
  circle?: { x: number; y: number; r: number };
}

/** pool — страны, которые сейчас есть на карте. */
export function hintFor(target: Country, level: number, pool: Country[]): Hint {
  if (level === 1) return { active: codes(pool.filter((c) => c.region === target.region)) };
  if (level === 2 && target.subregion) return { active: codes(pool.filter((c) => c.subregion === target.subregion)) };

  const [tx, ty] = centerOf(target.code);
  const near = pool
    .map((c) => ({ c, p: centerOf(c.code) }))
    .sort((a, b) => Math.hypot(a.p[0] - tx, a.p[1] - ty) - Math.hypot(b.p[0] - tx, b.p[1] - ty))
    .slice(0, CIRCLE_COUNT);
  const x = near.reduce((s, n) => s + n.p[0], 0) / near.length;
  const y = near.reduce((s, n) => s + n.p[1], 0) / near.length;
  const r = Math.max(...near.map((n) => Math.hypot(n.p[0] - x, n.p[1] - y))) + 6;
  return { active: codes(near.map((n) => n.c)), circle: { x, y, r } };
}

const codes = (cs: Country[]) => new Set(cs.map((c) => c.code));
