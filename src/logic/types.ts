import raw from '../data/countries.json';

export type Lang = 'ru' | 'en';
/** Как пользователь отвечает. */
export type Mode = 'map' | 'choice' | 'text';
/** О чём вопрос. */
// capital: страна → столица, byCapital: столица → страна; mapFlag / mapCapital: страна подсвечена на карте → её флаг / столица
export type Kind = 'name' | 'flag' | 'shape' | 'capital' | 'byCapital' | 'mapFlag' | 'mapCapital';
export type Region = 'Africa' | 'Americas' | 'Asia' | 'Europe' | 'Oceania' | 'Antarctic';

export const MODES: Mode[] = ['map', 'choice', 'text'];
export const KINDS: Kind[] = ['name', 'flag', 'shape', 'capital', 'byCapital', 'mapFlag', 'mapCapital'];

/** Ответ на вопрос — столица (а не название страны). */
export const asksCapital = (k: Kind) => k === 'capital' || k === 'mapCapital';
/** Страна в вопросе показана подсветкой на карте (в режимах выбора и ввода). */
export const showsOnMap = (k: Kind) => k === 'name' || k === 'mapFlag' || k === 'mapCapital';
export const REGIONS: Region[] = ['Africa', 'Americas', 'Asia', 'Europe', 'Oceania', 'Antarctic'];

export interface Country {
  code: string; // ISO alpha-3, он же имя файла флага: public/flags/<code>.svg
  region: Region;
  subregion: string; // напр. «Western Europe»; пусто у Антарктиды и т.п.
  sovereign: boolean;
  name: Record<Lang, string>;
  capital: Record<Lang, string[]>; // первый элемент — основной
  aliases: Record<Lang, string[]>; // дополнительные допустимые ответы (официальные названия и т.п.)
  latlng: [number, number];
  hasShape: boolean; // есть ли отдельный контур в Natural Earth
  flagShared: boolean; // флаг совпадает с флагом метрополии
}

export const COUNTRIES = raw as Country[];
export const BY_CODE = new Map(COUNTRIES.map((c) => [c.code, c]));

export interface Settings {
  lang: Lang;
  /** Для каждого типа вопроса — какими способами отвечать. Тип без способов выключен. */
  play: Partial<Record<Kind, Mode[]>>;
  regions: Region[];
  /** Только этот субрегион (напр. «Western Europe»). Задаётся при запуске из «Изучения», в настройках не хранится. */
  subregion?: string;
  scope: 'sovereign' | 'all';
  length: number | 'all';
  /** Закрашивать на карте страны, уже отвеченные в этой сессии. */
  keepMarks: boolean;
  /** Сколько вариантов в режиме выбора. */
  optionCount: number;
  /** Спрашивать только то, что ещё не выучено (см. isLearned). */
  onlyNew: boolean;
}

export interface Question {
  country: Country;
  mode: Mode;
  kind: Kind;
  options?: Option[]; // только для mode === 'choice'
}

/** Вариант ответа. id — код страны или «<код>:city:<n>» для города-обманки. */
export interface Option {
  id: string;
  label: Record<Lang, string>;
}

export interface Answer {
  question: Question;
  /** Сколько попыток ушло (1–3); при неудаче — все использованные. */
  attempts: number;
  solved: boolean;
  /** Ошибочные ответы по порядку (код страны или введённый текст; '' — «не знаю»). */
  wrong: string[];
}

/** «Чистый» ответ — с первой попытки; всё остальное попадает в «Повторить ошибки». */
export const firstTry = (a: Answer) => a.solved && a.attempts === 1;
