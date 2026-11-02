import { KIND_LABELS, STRINGS } from '../logic/i18n';
import { answerLabel } from '../logic/questions';
import { BY_CODE, firstTry, type Answer, type Lang, asksCapital } from '../logic/types';

interface Props {
  answers: Answer[];
  lang: Lang;
  onRetry: () => void;
  onNew: () => void;
  onSettings: () => void;
  onMistakes: () => void;
}

/** 0–2 — угадано с 1–3 попытки, 3 — не угадано. Совпадает с классами try1/try2/try3/wrong. */
const outcome = (a: Answer) => (a.solved ? a.attempts - 1 : 3);
const OUTCOME_CLASS = ['try1', 'try2', 'try3', 'wrong'];

export function ResultScreen({ answers, lang, onRetry, onNew, onSettings, onMistakes }: Props) {
  const t = STRINGS[lang];
  const mistakes = answers.filter((a) => !firstTry(a));
  const counts = [0, 0, 0, 0];
  answers.forEach((a) => counts[outcome(a)]++);

  // На карте ошибка — код страны, в вариантах — id варианта, в тексте — сам текст.
  const shown = (a: Answer, given: string) => {
    if (!given) return t.noAnswer;
    if (a.question.mode === 'text') return given;
    return a.question.options?.find((o) => o.id === given)?.label[lang] ?? answerLabel(BY_CODE.get(given)!, 'name', lang);
  };

  return (
    <div className="screen result">
      <h1>{t.results}</h1>
      <p className="score">{t.score(counts[0], answers.length)}</p>
      <p className="breakdown">
        {t.tries.map((label, i) => (
          <span key={i}><i className={`badge ${OUTCOME_CLASS[i]}`} /> {label}: {counts[i]}</span>
        ))}
      </p>

      {mistakes.length > 0 && (
        <>
          <h2>{t.mistakes}</h2>
          <ul className="mistakes">
            {mistakes.map((a, i) => (
              <li key={i}>
                <i className={`badge ${OUTCOME_CLASS[outcome(a)]}`} />
                <img className="flag-small" src={`${import.meta.env.BASE_URL}flags/${a.question.country.code}.svg`} alt="" />
                <b>{a.question.country.name[lang]}</b>
                {(asksCapital(a.question.kind) || a.question.kind === 'byCapital') && <> — {answerLabel(a.question.country, 'capital', lang)}</>}
                <span className="muted"> · {KIND_LABELS[lang][a.question.kind]} · {t.yourAnswer}: {a.wrong.map((g) => shown(a, g)).join(', ')}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="actions">
        {mistakes.length > 0 && <button type="button" className="primary" onClick={onRetry}>{t.retry}</button>}
        <button type="button" onClick={onNew}>{t.newSession}</button>
        <button type="button" onClick={onSettings}>{t.settings}</button>
        <button type="button" onClick={onMistakes}>{t.myMistakes}</button>
      </div>
    </div>
  );
}
