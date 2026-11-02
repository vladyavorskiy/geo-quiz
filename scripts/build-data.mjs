// Собирает src/data/countries.json, src/data/world.topo.json и public/flags/*.svg из npm-пакетов.
// Запуск: npm run build-data (нужно только если хотите обновить данные; результат уже лежит в репозитории).
import { writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import capitalsRu from './capitals-ru.mjs';

const require = createRequire(import.meta.url);
const countries = require('world-countries');
const topo = require('world-atlas/countries-50m.json');
const flagsDir = new URL('../node_modules/flag-icons/flags/4x3/', import.meta.url);

// Контуры: TopoJSON с id = ISO numeric. Перепишем id на cca3 и выкинем лишние свойства.
const byNumeric = new Map(countries.filter((c) => c.ccn3).map((c) => [c.ccn3, c.cca3]));
const byName = { Kosovo: 'UNK' }; // у Косово нет числового кода
const withShape = new Set();
for (const g of topo.objects.countries.geometries) {
  const code = byNumeric.get(g.id) ?? byName[g.properties.name];
  g.id = code; // undefined → некликабельная суша (Сомалиленд, Сев. Кипр…)
  g.properties = {};
  if (code) withShape.add(code);
}

// Флаги: копируем SVG. Эти территории официально используют флаг метрополии — по флагу их не спрашиваем.
const SHARED_FLAGS = new Set(['GUF', 'GLP', 'MYT', 'REU', 'MAF', 'BLM', 'SPM', 'WLF', 'BVT', 'SJM', 'HMD', 'UMI']);
mkdirSync(new URL('../public/flags/', import.meta.url), { recursive: true });
for (const c of countries) {
  copyFileSync(new URL(`${c.cca2.toLowerCase()}.svg`, flagsDir), new URL(`../public/flags/${c.cca3}.svg`, import.meta.url));
}

const latin = (s) => /^[\p{Script=Latin}\d\s.'’,()-]+$/u.test(s);
const uniq = (a) => [...new Set(a.filter(Boolean))];

const out = countries.map((c) => ({
  code: c.cca3,
  region: c.region,
  subregion: c.subregion ?? '',
  sovereign: c.unMember || c.cca3 === 'PSE', // 193 члена ООН + Ватикан (в данных помечен членом) + Палестина = 195
  name: { en: c.name.common, ru: c.translations.rus.common },
  capital: { en: c.capital ?? [], ru: capitalsRu[c.cca3]?.split('|') ?? [] },
  aliases: {
    en: uniq([c.name.official, ...c.altSpellings.filter((s) => s.length >= 3 && latin(s))]),
    ru: uniq([c.translations.rus.official]),
  },
  latlng: c.latlng,
  hasShape: withShape.has(c.cca3),
  flagShared: SHARED_FLAGS.has(c.cca3),
}));

const missingRu = out.filter((c) => c.capital.en.length && !c.capital.ru.length).map((c) => c.code);
if (missingRu.length) throw new Error('Нет русских столиц: ' + missingRu.join(' '));

writeFileSync(new URL('../src/data/countries.json', import.meta.url), JSON.stringify(out, null, 1));
writeFileSync(new URL('../src/data/world.topo.json', import.meta.url), JSON.stringify(topo));
console.log(`countries: ${out.length}, sovereign: ${out.filter((c) => c.sovereign).length}, ` +
  `no shape: ${out.filter((c) => !c.hasShape).map((c) => c.code).join(' ')}, ` +
  `shared flags: ${out.filter((c) => c.flagShared).map((c) => c.code).join(' ')}`);
