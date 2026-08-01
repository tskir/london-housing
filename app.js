const status = document.querySelector('#status');
const burgundy = '#7b2638';
const green = '#759b8d';
const minYear = 2000;
const delayMinYear = 2018;
const submissionMinYear = 2020;
const maxYear = 2025;
const sizeBands = [
  {label:'1–5 units', min:1, max:5},
  {label:'6–50 units', min:6, max:50},
  {label:'51–200 units', min:51, max:200},
  {label:'201–500 units', min:201, max:500},
  {label:'501+ units', min:501, max:Infinity}
];
const sizeColors = ['#7b2638','#95515e','#b17b83','#759b8d','#47756d'];

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
  const submissionYears = Array.from({length:maxYear - submissionMinYear + 1}, (_, i) => submissionMinYear + i);
  const byYear = new Map(years.map(year => [year, {homes:0, records:0, complete:0, completeHomes:0, council:[], developer:[]}]));
  const sizeByYear = sizeBands.map(() => new Map(delayYears.map(year => [year, {council:[], developer:[]}])));
  const submissionByYear = new Map(submissionYears.map(year => [year, new Map()]));
  const submissionStatuses = new Set();
  for (const record of records) {
    const actual = parseDate(record.actual_commencement_date);
    const year = actual?.getUTCFullYear();
    if (!year || year < minYear || year > maxYear) continue;
    const row = byYear.get(year);
    const units = record.application_details?.residential_details?.total_no_proposed_residential_units || 0;
    const sizeIndex = sizeBands.findIndex(band => units >= band.min && units <= band.max);
    row.records++;
    row.homes += units;
    const submitted = parseDate(record.valid_date);
    const submittedYear = submitted?.getUTCFullYear();
    if (submittedYear >= submissionMinYear && submittedYear <= maxYear) {
      const label = String(record.status || 'Unknown');
      const statusRow = submissionByYear.get(submittedYear);
      const current = statusRow.get(label) || {units:0, applications:0};
      current.units += units;
      current.applications++;
      statusRow.set(label, current);
      submissionStatuses.add(label);
    }
    const approved = parseDate(record.decision_date);
    if (!submitted || !approved) continue;
    row.complete++;
    row.completeHomes += units;
    const councilDelay = monthsBetween(submitted, approved);
    const developerDelay = monthsBetween(approved, actual);
    if (councilDelay >= 0) row.council.push({value:councilDelay, weight:units});
    if (developerDelay >= 0) row.developer.push({value:developerDelay, weight:units});
    if (sizeIndex >= 0 && year >= delayMinYear) {
      const sizeRow = sizeByYear[sizeIndex].get(year);
      if (councilDelay >= 0) sizeRow.council.push({value:councilDelay, weight:units});
      if (developerDelay >= 0) sizeRow.developer.push({value:developerDelay, weight:units});
    }
  }
  const preferredStatusOrder = ['Completed', 'Commenced'];
  const statuses = [...submissionStatuses].sort((a, b) => {
    const aIndex = preferredStatusOrder.indexOf(a);
    const bIndex = preferredStatusOrder.indexOf(b);
    return (aIndex < 0 ? preferredStatusOrder.length : aIndex) - (bIndex < 0 ? preferredStatusOrder.length : bIndex) || a.localeCompare(b);
  });
  return {years, delayYears, submissionYears, byYear, sizeByYear, submissionByYear, statuses};
}

function chartOptions(yTitle, yFormat = value => Number(value).toLocaleString(), showLegend = false) {
  return {responsive:true,maintainAspectRatio:false,interaction:{mode:'nearest',intersect:false},plugins:{legend:{display:showLegend,position:'bottom',labels:{boxWidth:12,usePointStyle:true,padding:14,font:{size:11}}},tooltip:{enabled:false}},scales:{x:{grid:{display:false},ticks:{maxTicksLimit:12}},y:{title:{display:true,text:yTitle},beginAtZero:true,grid:{color:'rgba(23,43,42,.08)'},ticks:{callback:yFormat}}}};
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

function sizeDelayDatasets(data, key, mode) {
  return sizeBands.map((band, index) => ({
    label: band.label,
    data: data.delayYears.map(year => {
      const values = data.sizeByYear[index].get(year)[key];
      return values.length ? delayMedian(values, mode) : null;
    }),
    borderColor: sizeColors[index],
    backgroundColor: sizeColors[index],
    borderWidth: 2,
    hoverBorderWidth: 4,
    pointRadius: 0,
    pointHoverRadius: 4,
    tension: .25
  }));
}

let sizeCouncilChart;
let sizeDeveloperChart;
function makeSizeDelayCharts(data, mode = 'units') {
  const title = mode === 'units' ? 'Median months · unit-weighted' : 'Median months · per application';
  const charts = [[sizeCouncilChart, 'size-council-chart', 'council'], [sizeDeveloperChart, 'size-developer-chart', 'developer']];
  charts.forEach(([chart, id, key], index) => {
    if (!chart) {
      const created = new Chart(document.querySelector(`#${id}`), {type:'line',data:{labels:data.delayYears,datasets:sizeDelayDatasets(data, key, mode)},options:chartOptions(title, value => Number(value).toFixed(0), true)});
      if (index === 0) sizeCouncilChart = created;
      else sizeDeveloperChart = created;
    } else {
      chart.data.datasets = sizeDelayDatasets(data, key, mode);
      chart.options.scales.y.title.text = title;
      chart.update('none');
    }
  });
}

const statusColors = {Completed:burgundy, Commenced:green};
let submissionChart;
function makeSubmissionChart(data, mode = 'units') {
  const measure = mode === 'units' ? 'Residential units' : 'Applications';
  const datasets = data.statuses.map(label => ({
    label,
    data: data.submissionYears.map(year => data.submissionByYear.get(year).get(label)?.[mode] || 0),
    backgroundColor: statusColors[label] || '#9aaba4',
    borderWidth: 0
  }));
  if (!submissionChart) {
    submissionChart = new Chart(document.querySelector('#submission-chart'), {type:'bar',data:{labels:data.submissionYears,datasets},options:{...chartOptions(measure, value => Number(value).toLocaleString(), true),scales:{x:{stacked:true,grid:{display:false}},y:{stacked:true,title:{display:true,text:measure},beginAtZero:true,grid:{color:'rgba(23,43,42,.08)'},ticks:{callback:value=>Number(value).toLocaleString()}}}}});
  } else {
    submissionChart.data.datasets = datasets;
    submissionChart.options.scales.y.title.text = measure;
    submissionChart.update('none');
  }
}

const data = aggregate(window.DATA.records);
const values = key => data.years.map(year => data.byYear.get(year)[key]);
makeLineChart('total-chart', data.years, values('homes'), burgundy, 'Residential units started', true);
makeCompletenessChart(data);
makeDelayCharts(data);
makeSizeDelayCharts(data);
makeSubmissionChart(data);
document.querySelectorAll('[data-completeness-mode]').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('[data-completeness-mode]').forEach(item => { item.classList.toggle('active', item === button); item.setAttribute('aria-pressed', item === button); });
  makeCompletenessChart(data, button.dataset.completenessMode);
}));
document.querySelectorAll('[data-delay-mode]').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('[data-delay-mode]').forEach(item => { item.classList.toggle('active', item === button); item.setAttribute('aria-pressed', item === button); });
  makeDelayCharts(data, button.dataset.delayMode);
  makeSizeDelayCharts(data, button.dataset.delayMode);
}));
document.querySelectorAll('[data-submission-mode]').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('[data-submission-mode]').forEach(item => { item.classList.toggle('active', item === button); item.setAttribute('aria-pressed', item === button); });
  makeSubmissionChart(data, button.dataset.submissionMode);
}));
status.textContent = `${window.DATA.records.length.toLocaleString()} completed or commenced residential records · starts 2000–2025 · pre-downloaded API data`;
