# Geo Quiz

Тренажёр стран, флагов, контуров и столиц. React + TypeScript + Vite, карта на d3-geo (обычный SVG).

## Запуск

```
npm install
npm run dev      # http://localhost:5173
npm test         # тесты логики
npm run build    # сборка в dist/
```

## Структура

```
src/
  data/
    countries.json   250 стран: коды, названия ru/en, столицы, регион, флаги (сгенерирован)
    world.topo.json  контуры Natural Earth 50m, id = код страны (сгенерирован)
    aliases.ts       ваши дополнительные допустимые ответы — правьте здесь
    cities.ts        крупные города стран — обманки в вопросе «столица страны»
  logic/             чистый TS без React
    types.ts         типы и список стран
    questions.ts     генератор вопросов (матрица режим × тип — в комментарии вверху файла)
    checkAnswer.ts   проверка текста: нормализация, алиасы, опечатки
    progress.ts      настройки и статистика по «страна:тип»: localStorage + синхронизация с облаком
    cloud.ts         Supabase: вход, загрузка и сохранение прогресса
    geo.ts           проекции, контуры, точки для мелких стран
    hints.ts         подсказки на карте (часть света → субрегион → круг)
    sound.ts         звук верного/неверного ответа (Web Audio)
    i18n.ts          строки интерфейса ru/en
    logic.test.ts
  components/        App (переключает экраны), SettingsScreen, QuizScreen, WorldMap, ResultScreen
  styles.css
public/flags/        SVG-флаги, <код>.svg
scripts/             build-data.mjs + capitals-ru.mjs — пересборка src/data (npm run build-data)
```

## Частые правки

- Принимать ещё один вариант ответа → `src/data/aliases.ts`.
- Исправить русское название столицы → `scripts/capitals-ru.mjs`, затем `npm run build-data`
  (или прямо в `src/data/countries.json`, но пересборка его перезапишет).
- Добавить города-обманки → `src/data/cities.ts`.
- Порог «мелкая страна → точка» → `DOT_MAX_AREA` в `src/logic/geo.ts`.
- Насколько прощаются опечатки → `tolerance` в `src/logic/checkAnswer.ts`.
- Как часто повторяются страны с ошибками → `weight` в `src/logic/questions.ts`.

## Облачное сохранение (Supabase)

Без настройки прогресс хранится только в браузере. Чтобы он был общим на всех ваших устройствах:

1. Зарегистрируйтесь на https://supabase.com и создайте проект (бесплатный тариф).
2. **SQL Editor → New query**: вставьте содержимое `supabase/schema.sql`, нажмите **Run**.
3. **Authentication → Sign In / Providers → Email**: выключите **Confirm email** (иначе после регистрации
   придётся подтверждать почту по ссылке).
4. **Project Settings → API** (или **Data API** / **API Keys**): скопируйте *Project URL* и *anon public* ключ.
5. В папке проекта скопируйте `.env.example` в `.env.local` и вставьте туда эти два значения.
6. Перезапустите `npm run dev`. В настройках игры появится панель «Сохранение в облаке» —
   нажмите «Создать аккаунт» один раз, на других устройствах — «Войти» с теми же email и паролем.

На каждом устройстве нужен свой `.env.local` (он не попадает в git). Прогресс из браузера
при первом входе не теряется: он сливается с облачным.

## Публикация на GitHub Pages

Сайт собирается и выкладывается сам при каждом push в ветку `main` (`.github/workflows/deploy.yml`).
Один раз в репозитории на GitHub:

1. **Settings → Pages → Build and deployment → Source**: выберите **GitHub Actions**.
2. **Settings → Secrets and variables → Actions → вкладка Variables → New repository variable**:
   `VITE_SUPABASE_URL` и `VITE_SUPABASE_ANON_KEY` — те же значения, что в `.env.local`.
3. Запустите сборку: вкладка **Actions → Deploy to GitHub Pages → Run workflow** (или просто сделайте push).

Адрес сайта: `https://<логин>.github.io/<имя-репозитория>/`. Бесплатно Pages работает только для публичных
репозиториев; `.env.local` в репозиторий не попадает.

Сбросить локальный прогресс: в консоли браузера `localStorage.clear()`.
