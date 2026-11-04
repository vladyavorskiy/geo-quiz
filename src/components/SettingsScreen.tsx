import type { ReactNode } from 'react';
import { AccountPanel, type SyncState } from './AccountPanel';
import { KIND_HINTS, KIND_LABELS, MODE_LABELS, MODE_SHORT, REGION_LABELS, STRINGS } from '../logic/i18n';
import { LEARNED_STREAK, isLearned, loadStats } from '../logic/progress';
import { canAsk, countryPool, enabledCombos, fitsMode, regionProgress } from '../logic/questions';
import { KINDS, MODES, REGIONS, type Kind, type Mode, type Region, type Settings } from '../logic/types';

interface Props {
  settings: Settings;
  onChange: (s: Settings) => void;
  onStart: () => void;
  onMistakes: () => void;
  onStudy: (region: Region) => void;
  email: string | null;
  sync: SyncState;
}

const LENGTHS = [10, 20, 50, 'all'] as const;
const OPTION_COUNTS = [2, 3, 4, 6, 8];

export function SettingsScreen({ settings: s, onChange, onStart, onMistakes, onStudy, email, sync }: Props) {
  const t = STRINGS[s.lang];
  const combos = enabledCombos(s);
  const stats = loadStats();
  const progress = regionProgress(s, stats);
  const count = countryPool(s).filter((c) => combos.some(({ kind }) => canAsk(c, kind) && !(s.onlyNew && isLearned(stats[`${c.code}:${kind}`])))).length;
  const total = s.length === 'all' ? count : Math.min(count, s.length);
  const usesChoice = combos.some((x) => x.mode === 'choice');

  const toggleMode = (kind: Kind, mode: Mode) => {
    const cur = s.play[kind] ?? [];
    onChange({ ...s, play: { ...s.play, [kind]: cur.includes(mode) ? cur.filter((m) => m !== mode) : [...cur, mode] } });
  };
  const toggleRegion = (r: (typeof REGIONS)[number]) =>
    onChange({ ...s, regions: s.regions.includes(r) ? s.regions.filter((x) => x !== r) : [...s.regions, r] });

  return (
    <div className="screen settings">
      <header className="settings-head">
        <h1>{t.title}</h1>
        <div className="head-actions">
          <button type="button" onClick={onMistakes}>{t.myMistakes}</button>
          <Segmented
            label={t.language}
            value={s.lang}
            options={[['ru', 'Русский'], ['en', 'English']]}
            onPick={(lang) => onChange({ ...s, lang })}
          />
        </div>
      </header>

      <section>
        <h2 className="section-title">{t.kinds}</h2>
        <div className="kind-grid">
          {KINDS.map((kind) => {
            const active = (s.play[kind] ?? []).filter((m) => fitsMode(m, kind));
            return (
              <article key={kind} className={`kind-card${active.length ? '' : ' off'}`}>
                <KindPicture kind={kind} />
                <div className="kind-text">
                  <h3>{KIND_LABELS[s.lang][kind]}</h3>
                  <p>{KIND_HINTS[s.lang][kind]}</p>
                </div>
                <div className="mode-chips" role="group" aria-label={t.modes}>
                  {MODES.filter((m) => fitsMode(m, kind)).map((m) => (
                    <button key={m} type="button" className="chip" title={MODE_LABELS[s.lang][m]} aria-pressed={active.includes(m)} onClick={() => toggleMode(kind, m)}>
                      <ModeIcon mode={m} /> {MODE_SHORT[s.lang][m]}
                    </button>
                  ))}
                </div>
                {!active.length && <span className="kind-off">{t.modesOff}</span>}
              </article>
            );
          })}
        </div>
      </section>

      <div className="panels">
        <Panel title={t.length}>
          <Segmented
            label={t.length}
            value={s.length}
            options={LENGTHS.map((n) => [n, n === 'all' ? t.allNoRepeat : String(n)])}
            onPick={(length) => onChange({ ...s, length })}
          />
        </Panel>

        <Panel title={t.optionCount} muted={!usesChoice}>
          <Segmented
            label={t.optionCount}
            value={s.optionCount}
            options={OPTION_COUNTS.map((n) => [n, String(n)])}
            onPick={(optionCount) => onChange({ ...s, optionCount })}
          />
        </Panel>

        <Panel title={t.scope}>
          <Segmented
            label={t.scope}
            value={s.scope}
            options={[['sovereign', t.sovereign], ['all', t.all]]}
            onPick={(scope) => onChange({ ...s, scope })}
          />
        </Panel>

        <Panel title={t.map}>
          <label className="switch">
            <input type="checkbox" checked={s.keepMarks} onChange={() => onChange({ ...s, keepMarks: !s.keepMarks })} />
            <span className="switch-track" aria-hidden="true" />
            {t.keepMarks}
          </label>
        </Panel>

        <Panel title={t.cloud} wide>
          <AccountPanel lang={s.lang} email={email} sync={sync} />
        </Panel>

        <Panel title={t.regions} wide>
          <div className="region-grid">
            {REGIONS.map((r) => {
              const p = progress[r];
              return (
                <div key={r} className={`region-tile${s.regions.includes(r) ? ' on' : ''}`}>
                  <button type="button" className="chip" aria-pressed={s.regions.includes(r)} onClick={() => toggleRegion(r)}>
                    {REGION_LABELS[s.lang][r]}
                  </button>
                  <div className="region-meter" role="img" aria-label={t.learnedOf(p.learned, p.total)}>
                    <i style={{ width: `${p.total ? (100 * p.learned) / p.total : 0}%` }} />
                  </div>
                  <span className="region-count">{t.learnedOf(p.learned, p.total)}</span>
                  <button type="button" className="link" disabled={!p.total} onClick={() => onStudy(r)}>{t.study} →</button>
                </div>
              );
            })}
          </div>
          <label className="switch" title={t.onlyNewHint(LEARNED_STREAK)}>
            <input type="checkbox" checked={s.onlyNew} onChange={() => onChange({ ...s, onlyNew: !s.onlyNew })} />
            <span className="switch-track" aria-hidden="true" />
            {t.onlyNew}
          </label>
          <p className="account-note">{t.onlyNewHint(LEARNED_STREAK)}</p>
        </Panel>
      </div>

      <div className="start">
        <span>{total ? t.willAsk(total) : t.nothingToAsk}</span>
        <button type="button" className="primary" disabled={!total} onClick={onStart}>{t.start}</button>
      </div>
    </div>
  );
}

function Panel({ title, wide, muted, children }: { title: string; wide?: boolean; muted?: boolean; children: ReactNode }) {
  return (
    <section className={`panel${wide ? ' wide' : ''}${muted ? ' muted-panel' : ''}`}>
      <h3>{title}</h3>
      {children}
    </section>
  );
}

/** Переключатель «один из нескольких» в виде сегментов. */
function Segmented<T extends string | number>({ label, value, options, onPick }: {
  label: string; value: T; options: (readonly [T, string])[]; onPick: (v: T) => void;
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map(([v, text]) => (
        <button key={String(v)} type="button" aria-pressed={v === value} onClick={() => onPick(v)}>{text}</button>
      ))}
    </div>
  );
}

/* ---------- Картинки: «что дано → что нужно ответить» ---------- */

type Glyph = 'map' | 'mapLit' | 'text' | 'flag' | 'shape' | 'city';
const PICTURES: Record<Kind, [Glyph, Glyph, boolean?]> = {
  name: ['mapLit', 'text', true], // true — в обе стороны: найти по названию или назвать подсвеченную
  flag: ['flag', 'text'],
  shape: ['shape', 'text'],
  capital: ['text', 'city'],
  byCapital: ['city', 'text'],
  mapFlag: ['mapLit', 'flag'],
  mapCapital: ['mapLit', 'city'],
};

function KindPicture({ kind }: { kind: Kind }) {
  const [from, to, both] = PICTURES[kind];
  return (
    <svg className="kind-pic" viewBox="0 0 132 56" aria-hidden="true">
      <g transform="translate(4 4)"><GlyphArt g={from} /></g>
      <text x="66" y="34" textAnchor="middle" className="pic-arrow">{both ? '⇄' : '→'}</text>
      <g transform="translate(80 4)"><GlyphArt g={to} /></g>
    </svg>
  );
}

const LAND = 'M6 14c4-6 12-7 17-4 4 2 9 1 12 4 3 4 0 9-4 11-5 3-9 9-15 7-5-1-6-6-9-9-3-3-4-6-1-9z';

/** Каждый значок вписан в 48×48. */
function GlyphArt({ g }: { g: Glyph }) {
  switch (g) {
    case 'map':
    case 'mapLit':
      return (
        <>
          <rect className="pic-sea" x="0" y="4" width="48" height="40" rx="6" />
          <path className="pic-land" d={LAND} transform="translate(2 4)" />
          <path className={g === 'mapLit' ? 'pic-lit' : 'pic-land'} d="M30 26l7-3 6 4-1 7-7 2-5-4z" />
        </>
      );
    case 'text':
      return (
        <>
          <rect className="pic-card" x="0" y="10" width="48" height="28" rx="6" />
          <text x="24" y="30" textAnchor="middle" className="pic-letters">Aa</text>
        </>
      );
    case 'flag':
      return (
        <>
          <rect className="pic-flag-1" x="2" y="10" width="15" height="28" />
          <rect className="pic-flag-2" x="17" y="10" width="14" height="28" />
          <rect className="pic-flag-3" x="31" y="10" width="15" height="28" />
          <rect className="pic-outline" x="2" y="10" width="44" height="28" />
        </>
      );
    case 'shape':
      return <path className="pic-lit" d={LAND} transform="translate(2 2) scale(1.05)" />;
    case 'city':
      return (
        <>
          <path className="pic-pin" d="M24 4c-9 0-15 7-15 15 0 11 15 25 15 25s15-14 15-25c0-8-6-15-15-15z" />
          <path className="pic-star" d="M24 11l2.4 5 5.4.6-4 3.7 1.1 5.4-4.9-2.8-4.9 2.8 1.1-5.4-4-3.7 5.4-.6z" />
        </>
      );
  }
}

/** Маленький значок способа ответа на кнопке-чипе. */
function ModeIcon({ mode }: { mode: Mode }) {
  return (
    <svg className="mode-icon" viewBox="0 0 16 16" aria-hidden="true">
      {mode === 'map' && <path d="M3 2l9 5-4 1 2.5 5-1.8.8L6.2 9 3 12z" />}
      {mode === 'choice' && <><rect x="1" y="1" width="6" height="6" rx="1.5" /><rect x="9" y="1" width="6" height="6" rx="1.5" /><rect x="1" y="9" width="6" height="6" rx="1.5" /><rect x="9" y="9" width="6" height="6" rx="1.5" /></>}
      {mode === 'text' && <><rect className="stroke" x="1.5" y="4" width="13" height="8" rx="2" /><path className="stroke" d="M10 6v4" /></>}
    </svg>
  );
}
