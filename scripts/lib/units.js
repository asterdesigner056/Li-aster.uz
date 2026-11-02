/**
 * Единицы измерения для узбекской версии.
 * В models/*.json значения пишутся по-русски ("5 050 мм", "330 кВт / 449 л.с."),
 * для /uz/ они автоматически переводятся ("5 050 mm", "330 kVt / 449 o.k.").
 */
const uzUnits = (s) => String(s)
  .replace(/кВт·ч/g, 'kVt·soat').replace(/кВт/g, 'kVt').replace(/Вт/g, 'Vt')
  .replace(/км\/ч/g, 'km/soat').replace(/л\/100 км/g, 'l/100 km').replace(/л\.с\./g, 'o.k.')
  .replace(/мм/g, 'mm').replace(/км/g, 'km').replace(/м²/g, 'm²').replace(/Н·м/g, 'N·m')
  .replace(/ГБ/g, 'GB').replace(/мин/g, 'daq').replace(/(\d) м\b/g, '$1 m').replace(/(\d) л\b/g, '$1 l')
  .replace(/(\d) т\b/g, '$1 t').replace(/(\d) с\b/g, '$1 s').replace(/(\d) В\b/g, '$1 V').replace(/ л$/g, ' l')
  .replace(/(\d) м$/g, '$1 m').replace(/(\d) с$/g, '$1 s').replace(/(\d) т$/g, '$1 t').replace(/(\d) В$/g, '$1 V');

module.exports = { uzUnits };
