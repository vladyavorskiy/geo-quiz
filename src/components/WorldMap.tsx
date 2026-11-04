import { useEffect, useRef, useState } from 'react';
import { DOTS, HEIGHT, SHAPES, WIDTH, boundsOf, centerOf } from '../logic/geo';
import type { Hint } from '../logic/hints';
import { BY_CODE } from '../logic/types';

/**
 * target — «вот эта страна» (в вопросах «назовите»), picked — ошибочный выбор,
 * try1/try2/try3 — угадано с 1-й/2-й/3-й попытки, wrong — не угадано.
 */
export type Mark = 'target' | 'selected' | 'picked' | 'try1' | 'try2' | 'try3' | 'wrong';

interface Props {
  marks?: Record<string, Mark>;
  /** Если задано — карта сама приблизится к этой стране (или к группе стран целиком). Без него зум не трогаем. */
  focus?: string | string[];
  onSelect?: (code: string) => void;
  /** Не показывать точки несуверенных территорий. */
  sovereignOnly?: boolean;
  /** Подсказка: страны вне hint.active затемняются и не кликаются. */
  hint?: Hint;
}

interface View { x: number; y: number; k: number }
const MAX_ZOOM = 60;
/** Точку прячем, когда контур страны на экране больше этого (в единицах карты²) — её уже видно и можно кликнуть саму. */
const DOT_HIDE_AREA = 150;

export function WorldMap({ marks = {}, focus, onSelect, sovereignOnly, hint }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [view, setView] = useState<View>({ x: 0, y: 0, k: 1 });
  const [box, setBox] = useState({ w: WIDTH, h: HEIGHT }); // viewBox под размер окна, карта по центру
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);

  const focusKey = Array.isArray(focus) ? focus.join(',') : focus; // массив пересоздаётся каждый рендер — сравниваем по содержимому
  useEffect(() => {
    if (!focus?.length) return;
    let b: [[number, number], [number, number]] | null;
    if (Array.isArray(focus)) {
      // Группу вписываем по центрам стран: контуры России, Фиджи и т.п. пересекают линию перемены дат и растянули бы рамку на весь мир.
      const pts = focus.map(centerOf);
      b = [[Math.min(...pts.map((p) => p[0])), Math.min(...pts.map((p) => p[1]))], [Math.max(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[1]))]];
    } else b = boundsOf(focus);
    if (!b) return;
    const [[x0, y0], [x1, y1]] = b;
    const fill = Array.isArray(focus) ? 0.75 : 0.3; // какую долю окна занимает цель
    const k = Math.min(8, Math.max(1, fill / Math.max((x1 - x0) / WIDTH, (y1 - y0) / HEIGHT)));
    setView({ k, x: WIDTH / 2 - k * (x0 + x1) / 2, y: HEIGHT / 2 - k * (y0 + y1) / 2 });
  }, [focusKey]);

  // Подгоняем viewBox под пропорции окна, чтобы карта заполняла его целиком.
  useEffect(() => {
    const svg = svgRef.current!;
    const ro = new ResizeObserver(([e]) => {
      const aspect = e.contentRect.width / e.contentRect.height;
      if (aspect > 0) setBox(aspect > WIDTH / HEIGHT ? { w: HEIGHT * aspect, h: HEIGHT } : { w: WIDTH, h: WIDTH / aspect });
    });
    ro.observe(svg);
    return () => ro.disconnect();
  }, []);

  // Колесо: React вешает wheel как passive, поэтому preventDefault нужен через addEventListener.
  useEffect(() => {
    const svg = svgRef.current!;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const [px, py] = toSvg(svg, e.clientX, e.clientY);
      setView((v) => zoomAt(v, Math.exp(-e.deltaY * 0.002), px, py));
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, []);

  const onPointerDown = (e: React.PointerEvent) => (drag.current = { x: e.clientX, y: e.clientY, moved: false });
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 4) return; // мелкое дрожание — ещё клик
    const [ax, ay] = toSvg(svgRef.current!, d.x, d.y);
    const [bx, by] = toSvg(svgRef.current!, e.clientX, e.clientY);
    d.moved = true;
    d.x = e.clientX;
    d.y = e.clientY;
    setView((v) => ({ ...v, x: v.x + bx - ax, y: v.y + by - ay }));
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const wasDrag = drag.current?.moved;
    drag.current = null;
    const code = (e.target as Element).getAttribute('data-code');
    if (!wasDrag && code && onSelect && (!hint || hint.active.has(code))) onSelect(code);
  };

  const cls = (code?: string) => {
    if (!code) return 'country';
    const dim = hint && !hint.active.has(code) ? ' dim' : '';
    return `country${marks[code] ? ' ' + marks[code] : ''}${dim}`;
  };
  const dots = DOTS.filter((d) =>
    (!sovereignOnly || BY_CODE.get(d.code)!.sovereign) && (d.area === 0 || d.area * view.k ** 2 < DOT_HIDE_AREA));

  return (
    <div className="map-wrap">
      <svg
        ref={svgRef}
        className={onSelect ? 'map clickable' : 'map'}
        viewBox={`${(WIDTH - box.w) / 2} ${(HEIGHT - box.h) / 2} ${box.w} ${box.h}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => (drag.current = null)}
      >
        <g transform={`translate(${view.x},${view.y}) scale(${view.k})`}>
          {SHAPES.map((s, i) => (
            <path key={i} className={cls(s.code)} d={s.d} data-code={s.code} strokeWidth={0.6 / view.k} />
          ))}
          {dots.map((d) => (
            <g key={d.code}>
              {/* видимая точка на экране слегка уменьшается при зуме (4 → 2.5), но не исчезает, пока страна мелкая */}
              <circle className={`dot ${cls(d.code)}`} cx={d.x} cy={d.y}
                r={(marks[d.code] ? 1.5 : 1) * Math.max(2.5, 4 / view.k ** 0.25) / view.k} strokeWidth={0.6 / view.k} />
              {/* невидимая зона клика постоянного экранного размера */}
              {!(hint && !hint.active.has(d.code)) && <circle className="dot-hit" data-code={d.code} cx={d.x} cy={d.y} r={7 / view.k} />}
            </g>
          ))}
          {hint?.circle && (
            <circle className="hint-circle" cx={hint.circle.x} cy={hint.circle.y} r={hint.circle.r} strokeWidth={2 / view.k} />
          )}
        </g>
      </svg>
      <div className="map-controls">
        <button type="button" onClick={() => setView((v) => zoomAt(v, 1.5, WIDTH / 2, HEIGHT / 2))}>+</button>
        <button type="button" onClick={() => setView((v) => zoomAt(v, 1 / 1.5, WIDTH / 2, HEIGHT / 2))}>−</button>
        <button type="button" onClick={() => setView({ x: 0, y: 0, k: 1 })}>⟲</button>
      </div>
    </div>
  );
}

/** Координаты экрана → координаты карты (учитывает viewBox и масштаб страницы). */
function toSvg(svg: SVGSVGElement, clientX: number, clientY: number): [number, number] {
  const p = new DOMPoint(clientX, clientY).matrixTransform(svg.getScreenCTM()!.inverse());
  return [p.x, p.y];
}

function zoomAt(v: View, factor: number, px: number, py: number): View {
  const k = Math.min(MAX_ZOOM, Math.max(1, v.k * factor));
  return { k, x: px - (px - v.x) * (k / v.k), y: py - (py - v.y) * (k / v.k) };
}
