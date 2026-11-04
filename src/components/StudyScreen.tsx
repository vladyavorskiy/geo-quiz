import { useMemo, useState } from 'react';
import { KIND_LABELS, REGION_LABELS, STRINGS, SUBREGION_RU } from '../logic/i18n';
import { isLearned, loadStats } from '../logic/progress';
import { askableKinds, generateSession } from '../logic/questions';
import { COUNTRIES, type Country, type Region, type Settings } from '../logic/types';
import { WorldMap, type Mark } from './WorldMap';

interface Props {
  region: Region;
  settings: Settings;
  onBack: () => void;
  /** Начать викторину по этому региону (или только по субрегиону); onlyNew — только невыученное. */
  onQuiz: (onlyNew: boolean, subregion?: string) => void;
}

/**
 * Режим «Изучение»: карта региона без вопросов. Нажимаете на страну — видите её флаг, столицу и
 * насколько она выучена. Отсюда же запускается проверка по этому региону.
 */
export function StudyScreen({ region, settings: s, onBack, onQuiz }: Props) {
  const t = STRINGS[s.lang];
  const [stats] = useState(loadStats);
  const [selected, setSelected] = useState<string | undefined>();
  const [sub, setSub] = useState<string | undefined>(); // выбранный субрегион; undefined — весь регион

  const regionCountries = useMemo(
    () => COUNTRIES.filter((c) => c.region === region && (s.scope === 'all' || c.sovereign))
      .sort((a, b) => a.name[s.lang].localeCompare(b.name[s.lang], s.lang)),
    [region, s.scope, s.lang],
  );
  const countries = useMemo(() => regionCountries.filter((c) => !sub || c.subregion === sub), [regionCountries, sub]);
  const codes = useMemo(() => countries.map((c) => c.code), [countries]);
  const learned = (c: Country) => {
    const kinds = askableKinds(c, s);
    return kinds.length > 0 && kinds.every((k) => isLearned(stats[`${c.code}:${k}`]));
  };
  const progress = {
    learned: countries.filter(learned).length,
    total: countries.filter((c) => askableKinds(c, s).length).length,
  };
  // Сколько вопросов будет в проверке — чтобы не запускать пустую сессию.
  const [newCount, allCount] = useMemo(
    () => [true, false].map((onlyNew) => generateSession({ ...s, regions: [region], subregion: sub, length: 'all', onlyNew }, stats).length),
    [s, region, sub, stats],
  );

  const marks: Record<string, Mark> = {};
  for (const c of countries) if (learned(c)) marks[c.code] = 'try1';
  if (selected) marks[selected] = 'selected'; // светлее, чем 'target': тёмно-синяя страна сливалась с затемнёнными

  // Список по субрегионам: так проще учить небольшими группами соседей.
  const groups = new Map<string, Country[]>();
  for (const c of regionCountries) groups.set(c.subregion, [...(groups.get(c.subregion) ?? []), c]);
  const pickSub = (next?: string) => {
    setSub(next);
    if (next && regionCountries.find((c) => c.code === selected)?.subregion !== next) setSelected(undefined);
  };
  const subName = (sub: string) => (s.lang === 'ru' ? SUBREGION_RU[sub] ?? sub : sub) || REGION_LABELS[s.lang][region];

  const sel = countries.find((c) => c.code === selected);

  return (
    <div className="screen study">
      <div className="progress">
        <button type="button" className="link" onClick={onBack}>← {t.back}</button>
        <span>{REGION_LABELS[s.lang][region]}{sub && ` · ${subName(sub)}`} · {t.learnedOf(progress.learned, progress.total)}</span>
      </div>

      <div className="study-body">
        <WorldMap
          focus={codes}
          hint={{ active: new Set(codes) }}
          marks={marks}
          onSelect={setSelected}
          sovereignOnly={s.scope === 'sovereign'}
        />

        <aside className="study-side">
          {groups.size > 1 && (
            <div className="region-chips sub-chips" role="group" aria-label={t.subregionWord}>
              <button type="button" className="chip" aria-pressed={!sub} onClick={() => pickSub(undefined)}>{t.wholeRegion}</button>
              {[...groups.keys()].map((g) => (
                <button key={g} type="button" className="chip" aria-pressed={sub === g} onClick={() => pickSub(g)}>{subName(g)}</button>
              ))}
            </div>
          )}

          {sel ? (
            <div className="study-card">
              <img src={`${import.meta.env.BASE_URL}flags/${sel.code}.svg`} alt="" />
              <h2>{sel.name[s.lang]}</h2>
              <dl>
                <dt>{t.capitalWord}</dt><dd>{sel.capital[s.lang][0] ?? '—'}</dd>
                <dt>{t.subregionWord}</dt><dd>{subName(sel.subregion)}</dd>
              </dl>
              <ul className="study-status">
                {askableKinds(sel, s).map((k) => {
                  const st = stats[`${sel.code}:${k}`];
                  const state = isLearned(st) ? 'learned' : st ? 'seen' : 'new';
                  return (
                    <li key={k} className={state}>
                      <span>{KIND_LABELS[s.lang][k]}</span>
                      <span>{state === 'learned' ? t.statusLearned : st ? t.mistakeCount(st.wrong, st.right + st.wrong) : t.statusNever}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            <p className="muted">{t.studyPick}</p>
          )}

          <div className="study-list">
            {[...groups].filter(([g]) => !sub || g === sub).map(([g, list]) => (
              <section key={g}>
                <h3>{subName(g)}</h3>
                <div className="region-chips">
                  {list.map((c) => (
                    <button key={c.code} type="button" className={`chip${learned(c) ? ' learned' : ''}`} aria-pressed={c.code === selected} onClick={() => setSelected(c.code)}>
                      {c.name[s.lang]}
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <div className="study-actions">
            <button type="button" className="primary" disabled={!newCount} onClick={() => onQuiz(true, sub)}>{t.quizNew}</button>
            <button type="button" disabled={!allCount} onClick={() => onQuiz(false, sub)}>{t.quizRegion}</button>
          </div>
        </aside>
      </div>
    </div>
  );
}
