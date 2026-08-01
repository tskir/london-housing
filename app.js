const status = document.querySelector('#status');
const burgundy = '#7b2638';
const green = '#759b8d';
const minYear = 2000;
const delayMinYear = 2018;
const maxYear = 2025;

function parseDate(value) {
  if (!value) return null;
  const text = String(value);
  let match = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (match) return new Date(Date.UTC(+match[3], +match[2] - 1, +match[1]));
  match = text.match(/^(\d{2})\/(\d{4})$/);
  if (match) return new Date(Date.UTC(+match[2], +match[1] - 1, 1));
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

function monthsBetween(start, end) { return (end - start) / (1000 * 60 * 60 * 24 * 30.4375); }
function median(values) { const sorted = values.slice().sort((a,b) => a - b); const middle = Math.floor(sorted.length / 2); return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2; }
function weightedMedian(values) {
  const sorted = values.slice().sort((a,b) => a.value - b.value);
  const halfway = sorted.reduce((sum, item) => sum + item.weight, 0) / 2;
  let total = 0;
  for (const item of sorted) { total += item.weight; if (total >= halfway) return item.value; }
}
function delayMedian(values, mode) { return mode === 'units' ? weightedMedian(values) : median(values.map(item => item.value)); }

function aggregate(records) {
  const years = Array.from({length:maxYear - minYear + 1}, (_, i) => minYear + i);
  const delayYears = Array.from({length:maxYear - delayMinYear + 1}, (_, i) => delayMinYear + i);
  const byYear = new Map(years.map(year => [year, {homes:0, records:0, complete:0, completeHomes:0, council:[], developer:[]}]));
  for (const record of records) {
    const actual = parseDate(record.actual_commencement_date);
    const year = actual?.getUTCFullYear();
    if (!year || year < minYear || year > maxYear) continue;
    const row = byYear.get(year);
    const units = record.application_details?.residential_details?.total_no_proposed_residential_units || 0;
    row.records++;
    row.homes += units;
    const submitted = parseDate(record.valid_date);
    const approved = parseDate(record.decision_date);
    if (!submitted || !approved) continue;
    row.complete++;
    row.completeHomes += units;
    const councilDelay = monthsBetween(submitted, approved);
    const developerDelay = monthsBetween(approved, actual);
    if (councilDelay >= 0) row.council.push({value:councilDelay, weight:units});
    if (developerDelay >= 0) row.developer.push({value:developerDelay, weight:units});
  }
  return {years, delayYears, byYear};
}

function chartOptions(yTitle, yFormat = value => Number(value).toLocaleString()) {
  return {responsive:true,maintainAspectRatio:false,interaction:{mode:'nearest',intersect:false},plugins:{legend:{display:false},tooltip:{enabled:false}},scales:{x:{grid:{display:false},ticks:{maxTicksLimit:12}},y:{title:{display:true,text:yTitle},beginAtZero:true,grid:{color:'rgba(23,43,42,.08)'},ticks:{callback:yFormat}}}};
}

function makeLineChart(id, labels, values, color, yTitle, fill = false) {
  return new Chart(document.querySelector(`#${id}`), {type:'line',data:{labels,datasets:[{data:values,borderColor:color,backgroundColor:fill ? `${color}22` : color,borderWidth:2.5,hoverBorderWidth:4,pointRadius:0,pointHoverRadius:4,fill,tension:.25}]},options:chartOptions(yTitle)});
}

let completenessChart;
function makeCompletenessChart(data, mode = 'units') {
  const units = mode === 'units';
  const values = data.years.map(year => {
    const row = data.byYear.get(year);
    const denominator = units ? row.homes : row.records;
    const numerator = units ? row.completeHomes : row.complete;
    return denominator ? numerator / denominator * 100 : null;
  });
  const title = units ? 'Records with all three dates · % of units' : 'Records with all three dates · % of applications';
  if (!completenessChart) completenessChart = makeLineChart('completeness-chart', data.years, values, green, title);
  else { completenessChart.data.datasets[0].data = values; completenessChart.options.scales.y.title.text = title; completenessChart.update('none'); }
}

let councilChart;
let developerChart;
function makeDelayCharts(data, mode = 'units') {
  const title = mode === 'units' ? 'Median months · unit-weighted' : 'Median months · per application';
  const council = data.delayYears.map(year => { const values = data.byYear.get(year).council; return values.length ? delayMedian(values, mode) : null; });
  const developer = data.delayYears.map(year => { const values = data.byYear.get(year).developer; return values.length ? delayMedian(values, mode) : null; });
  if (!councilChart) {
    councilChart = makeLineChart('council-chart', data.delayYears, council, burgundy, title);
    developerChart = makeLineChart('developer-chart', data.delayYears, developer, green, title);
  } else {
    councilChart.data.datasets[0].data = council;
    developerChart.data.datasets[0].data = developer;
    councilChart.options.scales.y.title.text = title;
    developerChart.options.scales.y.title.text = title;
    councilChart.update('none');
    developerChart.update('none');
  }
}

const data = aggregate(window.DATA.records);
const values = key => data.years.map(year => data.byYear.get(year)[key]);
makeLineChart('total-chart', data.years, values('homes'), burgundy, 'Residential units started', true);
makeCompletenessChart(data);
makeDelayCharts(data);
document.querySelectorAll('[data-completeness-mode]').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('[data-completeness-mode]').forEach(item => { item.classList.toggle('active', item === button); item.setAttribute('aria-pressed', item === button); });
  makeCompletenessChart(data, button.dataset.completenessMode);
}));
document.querySelectorAll('[data-delay-mode]').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('[data-delay-mode]').forEach(item => { item.classList.toggle('active', item === button); item.setAttribute('aria-pressed', item === button); });
  makeDelayCharts(data, button.dataset.delayMode);
}));
status.textContent = `${window.DATA.records.length.toLocaleString()} completed or commenced residential records · starts 2000–2025 · pre-downloaded API data`;
