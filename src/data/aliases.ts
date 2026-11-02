// Ваши дополнительные допустимые ответы при вводе текстом (оба языка принимаются всегда).
// Ключ — код страны (ISO alpha-3, см. countries.json). Регистр, ё/е, дефисы и диакритика не важны.
export const NAME_ALIASES: Record<string, string[]> = {
  USA: ['США', 'Америка', 'Соединенные Штаты', 'America', 'US'],
  GBR: ['Англия', 'Британия', 'Соединённое Королевство', 'UK', 'Britain', 'England'],
  ARE: ['ОАЭ', 'Эмираты', 'UAE', 'Emirates'],
  CZE: ['Чехия', 'Чешская Республика', 'Czech Republic'],
  NLD: ['Голландия', 'Holland'],
  CIV: ['Берег Слоновой Кости', 'Ivory Coast'],
  COD: ['ДРК', 'Демократическая Республика Конго', 'DRC', 'DR Congo', 'Congo-Kinshasa'],
  COG: ['Республика Конго', 'Congo-Brazzaville'],
  PRK: ['КНДР', 'Северная Корея', 'North Korea'],
  KOR: ['Южная Корея', 'Корея', 'South Korea'],
  MMR: ['Бирма', 'Burma'],
  SWZ: ['Свазиленд', 'Swaziland'],
  MKD: ['Македония', 'Macedonia'],
  TUR: ['Türkiye', 'Турция'],
  CPV: ['Кабо-Верде', 'Острова Зелёного Мыса', 'Cape Verde'],
  TLS: ['Тимор-Лесте', 'East Timor'],
  VAT: ['Ватикан', 'Vatican', 'Holy See'],
  BIH: ['Босния', 'Bosnia'],
  CAF: ['ЦАР', 'CAR'],
};

export const CAPITAL_ALIASES: Record<string, string[]> = {
  USA: ['Вашингтон', 'Washington', 'Washington DC'],
  UKR: ['Kiev'],
  MNG: ['Улаанбаатар', 'Ulaanbaatar'],
  IND: ['Дели', 'Delhi'],
  MMR: ['Нейпьидо', 'Naypyitaw', 'Nay Pyi Taw'],
  KAZ: ['Нур-Султан', 'Nur-Sultan'],
  SMR: ['San Marino'],
  VAT: ['Vatican'],
};
