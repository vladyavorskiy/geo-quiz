import { useEffect, useRef, useState } from 'react';
import { checkText, type TextVerdict } from '../logic/checkAnswer';
import { countryOutline } from '../logic/geo';
import { MAX_HINT, hintFor } from '../logic/hints';
import { REGION_LABELS, STRINGS, SUBREGION_RU } from '../logic/i18n';
import { recordAnswer } from '../logic/progress';
import { answerLabel } from '../logic/questions';
import { beep } from '../logic/sound';
import { BY_CODE, COUNTRIES, firstTry, type Answer, type Lang, type Question, showsOnMap, asksCapital } from '../logic/types';
import { WorldMap, type Mark } from './WorldMap';

interface Props {
  questions: Question[];
  lang: Lang;
  sovereignOnly: boolean;
  keepMarks: boolean;
  onFinish: (answers: Answer[]) => void;
}

const MAX_TRIES = 3;

export function QuizScreen({ questions, lang, sovereignOnly, keepMarks, onFinish }: Props) {
  const t = STRINGS[lang];
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [wrong, setWrong] = useState<string[]>([]); // ошибочные попытки в текущем вопросе
  const [done, setDone] = useState<{ solved: boolean; fuzzy: boolean } | null>(null);
  const [hintLevel, setHintLevel] = useState(0);
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const [popup, setPopup] = useState<{ text: string; final: boolean } | null>(null); // сообщение об ошибке по центру

  const q = questions[index];
  const c = q.country;
  const rightAnswer = answerLabel(c, q.kind, lang);
  // Что показать в панели после ответа: страну, а в вопросах о столицах — «страна — столица».
  const fullAnswer = asksCapital(q.kind) || q.kind === 'byCapital' ? `${c.name[lang]} — ${c.capital[lang][0]}` : c.name[lang];
  const attempts = done?.solved ? wrong.length + 1 : wrong.length;
  // На карте кликают страны, поэтому ошибку там называем названием страны; в вариантах — подписью варианта.
  const pickedLabel = (id: string) => q.options?.find((o) => o.id === id)?.label[lang] ?? answerLabel(BY_CODE.get(id)!, 'name', lang);

  function finish(solved: boolean, wrongs: string[], fuzzy = false) {
    const a: Answer = { question: q, solved, attempts: solved ? wrongs.length + 1 : wrongs.length, wrong: wrongs };
    recordAnswer(q, firstTry(a));
    setAnswers((prev) => [...prev, a]);
    setDone({ solved, fuzzy });
  }

  function attempt(given: string, verdict: TextVerdict) {
    if (done || (given && wrong.includes(given))) return; // повторный клик по уже отвергнутому — не считаем
    beep(verdict !== 'wrong');
    if (verdict !== 'wrong') return finish(true, wrong, verdict === 'fuzzy');
    const wrongs = [...wrong, given];
    const left = MAX_TRIES - wrongs.length;
    const final = !given || left === 0; // '' — «не знаю»
    setWrong(wrongs);
    if (q.mode === 'text') setText(''); // неверный текст виден во всплывающем окне — поле очищаем для новой попытки
    setPopup({
      final,
      text: final ? t.wrong(fullAnswer) : q.mode === 'text' ? t.youTyped(given, left) : t.youPicked(pickedLabel(given), left),
    });
    if (final) finish(false, wrongs);
  }

  function next() {
    if (index + 1 >= questions.length) return onFinish(answers);
    setIndex(index + 1);
    setWrong([]);
    setDone(null);
    setHintLevel(0);
    setText('');
  }

  // Любая клавиша закрывает всплывашку; Enter или пробел после ответа — следующий вопрос (в текстовом режиме Enter до ответа отправляет форму).
  // В режиме ввода текста курсор всегда в поле: на новом вопросе и после закрытия окна с ошибкой.
  useEffect(() => {
    if (q.mode === 'text' && !done && !popup) inputRef.current?.focus();
  }, [index, done, popup, q.mode]);

  useEffect(() => {
    if (!done && !popup) return;
    const onKey = (e: KeyboardEvent) => {
      if (popup) {
        e.preventDefault();
        setPopup(null);
      } else if (done && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault(); // иначе пробел прокрутит страницу или нажмёт кнопку в фокусе
        next();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const pickCode = (code: string) => attempt(code, code === c.code ? 'exact' : 'wrong');
  const resultMark: Mark = done?.solved ? (`try${attempts}` as Mark) : 'wrong';

  // Подсветка на карте.
  const marks: Record<string, Mark> = {};
  if (keepMarks) answers.forEach((a) => (marks[a.question.country.code] = a.solved ? (`try${a.attempts}` as Mark) : 'wrong'));
  if (q.mode === 'map') wrong.forEach((code) => code && (marks[code] = 'picked'));
  if (q.mode !== 'map' && showsOnMap(q.kind)) marks[c.code] = done ? resultMark : 'target';
  if (q.mode === 'map' && done) marks[c.code] = resultMark;

  const hint = q.mode === 'map' && hintLevel > 0
    ? hintFor(c, hintLevel, sovereignOnly ? COUNTRIES.filter((x) => x.sovereign) : COUNTRIES)
    : undefined;
  const hintText = !hint ? '' : hint.circle ? t.hintCircle
    : t.hintArea(hintLevel === 1 ? REGION_LABELS[lang][c.region] : lang === 'ru' ? SUBREGION_RU[c.subregion] ?? c.subregion : c.subregion);

  const last = wrong[wrong.length - 1];
  const message = done
    ? done.solved ? `${t.correctOnTry(attempts)} ${fullAnswer}.` + (done.fuzzy ? t.spelled(rightAnswer) : '') : t.wrong(fullAnswer)
    : wrong.length
      ? q.mode === 'text' ? t.youTyped(last, MAX_TRIES - wrong.length) : t.youPicked(pickedLabel(last), MAX_TRIES - wrong.length)
      : hintText;
  const barClass = done ? resultMark : wrong.length ? 'picked' : '';
  const showMap = q.mode === 'map' || showsOnMap(q.kind);

  return (
    <div className={`screen quiz${showMap ? ' with-map' : ''}`}>
      <div className="progress">
        <span>{t.question(index + 1, questions.length)}</span>
        <button type="button" className="link" onClick={() => onFinish(answers)}>{t.finish}</button>
      </div>

      <Prompt q={q} lang={lang} />

      {showMap && (
        <WorldMap
          marks={marks}
          hint={done ? undefined : hint}
          focus={q.mode !== 'map' || (done && !done.solved) ? c.code : undefined}
          onSelect={q.mode === 'map' && !done ? pickCode : undefined}
          sovereignOnly={sovereignOnly}
        />
      )}

      {q.mode === 'choice' && (
        <div className={`options${q.kind === 'mapFlag' ? ' flags' : ''}`}>
          {q.options!.map((o) => {
            const state = o.id === c.code && done ? resultMark : wrong.includes(o.id) ? 'picked' : '';
            return (
              <button key={o.id} type="button" className={`option ${state}`} disabled={!!done || !!state} onClick={() => pickCode(o.id)}>
                {q.kind === 'mapFlag' ? <img src={`${import.meta.env.BASE_URL}flags/${o.id}.svg`} alt="" /> : o.label[lang]}
              </button>
            );
          })}
        </div>
      )}

      {q.mode === 'text' && (
        <form className="text-answer" onSubmit={(e) => { e.preventDefault(); if (text.trim()) attempt(text.trim(), checkText(text, c, q.kind)); }}>
          <input ref={inputRef} value={text} disabled={!!done} placeholder={t.typeAnswer} onChange={(e) => setText(e.target.value)} />
          <button type="submit" disabled={!!done}>{t.check}</button>
          <button type="button" disabled={!!done} onClick={() => attempt('', 'wrong')}>{t.skip}</button>
        </form>
      )}

      {popup && (
        <div className="popup-overlay" onClick={() => setPopup(null)}>
          <div className={`popup${popup.final ? ' wrong' : ''}`}>{popup.text}</div>
        </div>
      )}

      <div className={`bar ${barClass}`}>
        <span>{message}</span>
        <div className="bar-buttons">
          {q.mode === 'map' && !done && hintLevel < MAX_HINT && (
            <button type="button" onClick={() => setHintLevel(hintLevel + 1)}>{t.hint(hintLevel + 1, MAX_HINT)}</button>
          )}
          {done && <button type="button" className="primary" onClick={next} title={t.nextHint}>{t.next}</button>}
        </div>
      </div>
    </div>
  );
}

function Prompt({ q, lang }: { q: Question; lang: Lang }) {
  const t = STRINGS[lang];
  const c = q.country;
  const onMap = q.mode === 'map';
  const [big, setBig] = useState(false);
  // Флаг и контур — в рамке одного размера (4:3). На карте рамка маленькая, по клику открывается крупно.
  const content = q.kind === 'flag'
    ? <img src={`${import.meta.env.BASE_URL}flags/${c.code}.svg`} alt="" />
    : <svg className="outline" viewBox="0 0 400 300"><path d={countryOutline(c.code, 400, 300)} /></svg>;
  const media = (
    <>
      <div className={`prompt-media${onMap ? ' zoomable' : ''}`} title={onMap ? t.enlarge : undefined} onClick={() => onMap && setBig(true)}>
        {content}
      </div>
      {big && <div className="popup-overlay" onClick={() => setBig(false)}><div className="prompt-media big">{content}</div></div>}
    </>
  );

  switch (q.kind) {
    case 'name':
      return <div className="prompt"><h2>{onMap ? t.findOnMap(c.name[lang]) : t.whichCountry}</h2></div>;
    case 'flag':
      return <div className="prompt"><h2>{onMap ? t.findByFlag : t.whoseFlag}</h2>{media}</div>;
    case 'shape':
      return <div className="prompt"><h2>{onMap ? t.findByShape : t.whichCountry}</h2>{media}</div>;
    case 'capital':
      return <div className="prompt"><h2>{t.capitalOf(c.name[lang])}</h2></div>;
    case 'mapFlag':
      return <div className="prompt"><h2>{t.highlightedFlag}</h2></div>;
    case 'mapCapital':
      return <div className="prompt"><h2>{t.highlightedCapital}</h2></div>;
    case 'byCapital':
      return <div className="prompt"><h2>{onMap ? t.findByCapital(c.capital[lang][0]) : t.whoseCapital(c.capital[lang][0])}</h2></div>;
  }
}
