import { useState } from 'react';
import { KIND_LABELS, STRINGS } from '../logic/i18n';
import { loadStats } from '../logic/progress';
import { answerLabel } from '../logic/questions';
import { BY_CODE, KINDS, asksCapital, type Country, type Kind, type Lang } from '../logic/types';

interface Props {
  lang: Lang;
  onBack: () => void;
}

interface Row { country: Country; right: number; wrong: number }

/** Ошибки из сохранённой статистики, по типам вопросов. Самые частые ошибки — сверху. */
export function groupMistakes(stats = loadStats()): Partial<Record<Kind, Row[]>> {
  const groups: Partial<Record<Kind, Row[]>> = {};
  for (const [key, { right, wrong }] of Object.entries(stats)) {
    const [code, kind] = key.split(':') as [string, Kind];
    const country = BY_CODE.get(code);
    if (!country || !KINDS.includes(kind) || wrong === 0) continue;
    (groups[kind] ??= []).push({ country, right, wrong });
  }
  for (const rows of Object.values(groups)) rows!.sort((a, b) => b.wrong - a.wrong || a.right - b.right);
  return groups;
}

export function MistakesScreen({ lang, onBack }: Props) {
  const t = STRINGS[lang];
  const [groups] = useState(() => groupMistakes());
  const kinds = KINDS.filter((k) => groups[k]?.length);
  const [tab, setTab] = useState<Kind | undefined>(kinds[0]);
  const rows = tab ? groups[tab]! : [];

  return (
    <div className="screen mistakes-screen">
      <header className="settings-head">
        <h1>{t.myMistakes}</h1>
        <button type="button" onClick={onBack}>{t.back}</button>
      </header>

      {!kinds.length ? (
        <p className="muted">{t.noMistakes}</p>
      ) : (
        <>
          <div className="region-chips" role="tablist">
            {kinds.map((k) => (
              <button key={k} type="button" role="tab" className="chip" aria-pressed={k === tab} aria-selected={k === tab} onClick={() => setTab(k)}>
                {KIND_LABELS[lang][k]} <span className="chip-count">{groups[k]!.length}</span>
              </button>
            ))}
          </div>

          <ul className="mistake-list">
            {rows.map(({ country, right, wrong }) => (
              <li key={country.code}>
                <img className="flag-small" src={`${import.meta.env.BASE_URL}flags/${country.code}.svg`} alt="" />
                <span className="mistake-name">
                  <b>{country.name[lang]}</b>
                  {(asksCapital(tab!) || tab === 'byCapital') && <> — {answerLabel(country, 'capital', lang)}</>}
                </span>
                <span className="mistake-bar" aria-hidden="true">
                  <i className="bar-wrong" style={{ flexGrow: wrong }} />
                  <i className="bar-right" style={{ flexGrow: right }} />
                </span>
                <span className="mistake-count">{t.mistakeCount(wrong, right + wrong)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
