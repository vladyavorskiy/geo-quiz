import { geoArea, geoAzimuthalEqualArea, geoCentroid, geoNaturalEarth1, geoPath } from 'd3-geo';
import type { Feature, FeatureCollection, MultiPolygon } from 'geojson';
import { feature } from 'topojson-client';
import topo from '../data/world.topo.json';
import { BY_CODE, COUNTRIES } from './types';

export const WIDTH = 960;
export const HEIGHT = 500;

const world = feature(topo as any, (topo as any).objects.countries) as unknown as FeatureCollection;
const projection = geoNaturalEarth1().fitSize([WIDTH, HEIGHT], { type: 'Sphere' });
const path = geoPath(projection);
const byCode = new Map(world.features.filter((f) => f.id).map((f) => [String(f.id), f]));

/** Все контуры карты. code === undefined — суша без страны в наших данных (Сомалиленд и т.п.), не кликается. */
export const SHAPES = world.features.map((f) => ({ code: f.id as string | undefined, d: path(f) ?? '' }));

/** Страна мельче этого (в px² при масштабе 1) получает кликабельную точку. ≈ размер Бельгии. */
const DOT_MAX_AREA = 20;

/**
 * Точки для мелких стран и для территорий без собственного контура (по координатам из данных).
 * area — площадь контура при масштабе 1 (0, если контура нет): по ней карта прячет точку, когда страна уже видна сама.
 */
export const DOTS = COUNTRIES.flatMap((c) => {
  const f = byCode.get(c.code);
  const area = f ? path.area(f) : 0;
  if (f && area >= DOT_MAX_AREA) return [];
  const p = projection(f ? geoCentroid(f) : [c.latlng[1], c.latlng[0]]);
  return p ? [{ code: c.code, x: p[0], y: p[1], area }] : [];
});

/** Точка страны на карте (по координатам из данных — у Франции и т.п. контур включает заморские части). */
export function centerOf(code: string): [number, number] {
  const [lat, lng] = BY_CODE.get(code)!.latlng;
  return projection([lng, lat]) ?? [0, 0];
}

/** Прямоугольник страны на карте (для автоприближения). */
export function boundsOf(code: string): [[number, number], [number, number]] | null {
  const f = byCode.get(code);
  if (f) return path.bounds(f);
  const dot = DOTS.find((d) => d.code === code);
  return dot ? [[dot.x, dot.y], [dot.x, dot.y]] : null;
}

/**
 * Контур страны в рамке w×h, в проекции с центром на самой стране (без искажений у полюсов).
 * Вписываем только крупные части (≥ 20% самой большой): иначе далёкие мелкие острова сжимают страну в точку
 * (Нидерланды с Карибами, Франция с Гвианой). Остальные части рисуются, но могут уйти за край рамки.
 */
export function countryOutline(code: string, w: number, h: number): string {
  const f = byCode.get(code);
  if (!f) return '';
  const main = mainPart(f);
  const [lon, lat] = geoCentroid(main);
  const proj = geoAzimuthalEqualArea().rotate([-lon, -lat]).fitExtent([[4, 4], [w - 4, h - 4]], main);
  return geoPath(proj)(f) ?? '';
}

function mainPart(f: Feature): Feature {
  if (f.geometry.type !== 'MultiPolygon') return f;
  const polys = (f.geometry as MultiPolygon).coordinates;
  const areas = polys.map((p) => geoArea({ type: 'Polygon', coordinates: p }));
  const max = Math.max(...areas);
  return { ...f, geometry: { type: 'MultiPolygon', coordinates: polys.filter((_, i) => areas[i] >= max * 0.2) } };
}

/**
 * Архипелаги из множества мелких островов (Кирибати, Мальдивы…): самый большой остров занимает < 15% рамки,
 * контур выглядит россыпью точек — в вопросах «контур» их не задаём.
 */
export const SCATTERED_SHAPES = new Set(
  [...byCode].filter(([, f]) => {
    if (f.geometry.type !== 'MultiPolygon') return false;
    const main = mainPart(f);
    const polys = (f.geometry as MultiPolygon).coordinates;
    const biggest = polys.reduce((a, p) => (geoArea({ type: 'Polygon', coordinates: p }) > geoArea({ type: 'Polygon', coordinates: a }) ? p : a));
    const [lon, lat] = geoCentroid(main);
    const proj = geoAzimuthalEqualArea().rotate([-lon, -lat]).fitSize([100, 100], main);
    const [[x0, y0], [x1, y1]] = geoPath(proj).bounds({ type: 'Polygon', coordinates: biggest });
    return Math.max(x1 - x0, y1 - y0) < 15;
  }).map(([code]) => code),
);
