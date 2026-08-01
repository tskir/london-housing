const status = document.querySelector('#status');
const burgundy = '#7b2638';
const green = '#187a6e';
const minYear = 2000;
const delayMinYear = 2018;
const submissionMinYear = 2000;
const maxYear = 2025;
const sizeBands = [
  {label:'1–5 units', min:1, max:5},
  {label:'6–50 units', min:6, max:50},
  {label:'51–200 units', min:51, max:200},
  {label:'201–500 units', min:201, max:500},
  {label:'501+ units', min:501, max:Infinity}
];
const sizeColors = ['#7b2638','#157f9b','#d67c2f','#5b4b9a','#2f7d50'];

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

function statusLabel(value) { const label = String(value ?? '').trim(); return label || 'Unknown'; }

function monthsBetween(start, end) { return (end - start) / (1000 * 60 * 60 * 24 * 30.4375); }
function median(values) { const sorted = values.slice().sort((a,b) => a - b); const middle = Math.floor(sorted.length / 2); return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2; }
function weightedMedian(values) {
  const sorted = values.slice().sort((a,b) => a.value - b.value);
  const halfway = sorted.reduce((sum, item) => sum + item.weight, 0) / 2;
  let total = 0;
  for (const item of sorted) { total += item.weight; if (total >= halfway) return item.value; }
}
function delayMedian(values, mode) { return mode === 'units' ? weightedMedian(values) : median(values.map(item => item.value)); }

function aggregate(records, submissionRecords) {
  const years = Array.from({length:maxYear - minYear + 1}, (_, i) => minYear + i);
  const delayYears = Array.from({length:maxYear - delayMinYear + 1}, (_, i) => delayMinYear + i);
  const submissionYears = Array.from({length:maxYear - submissionMinYear + 1}, (_, i) => submissionMinYear + i);
  const byYear = new Map(years.map(year => [year, {homes:0, records:0, complete:0, completeHomes:0, council:[], developer:[]}]));
  const sizeByYear = sizeBands.map(() => new Map(delayYears.map(year => [year, {council:[], developer:[]}])));
  const submissionByYear = new Map(submissionYears.map(year => [year, new Map()]));
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
  const submissionTotals = new Map();
  for (const record of submissionRecords) {
    const submittedYear = parseDate(record.valid_date)?.getUTCFullYear();
    if (submittedYear < submissionMinYear || submittedYear > maxYear) continue;
    const units = record.application_details?.residential_details?.total_no_proposed_residential_units || 0;
    const label = statusLabel(record.status);
    const statusRow = submissionByYear.get(submittedYear);
    const current = statusRow.get(label) || {units:0, applications:0};
    current.units += units;
    current.applications++;
    statusRow.set(label, current);
    submissionTotals.set(label, (submissionTotals.get(label) || 0) + 1);
  }
  const statuses = [...submissionTotals.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 8).map(([label]) => label);
  const groupedSubmissionByYear = new Map(submissionYears.map(year => {
    const grouped = new Map(statuses.concat('Other').map(label => [label, {units:0, applications:0}]));
    for (const [label, values] of submissionByYear.get(year)) {
      const group = statuses.includes(label) ? label : 'Other';
      const current = grouped.get(group);
      current.units += values.units;
      current.applications += values.applications;
    }
    return [year, grouped];
  }));
  return {years, delayYears, submissionYears, byYear, sizeByYear, submissionByYear:groupedSubmissionByYear, statuses:statuses.concat('Other')};
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

function makeDataQualityTable(records) {
  const fields = [
    ['decision_date', 'approved'],
    ['actual_commencement_date', 'commenced'],
    ['actual_completion_date', 'completed']
  ];
  const rows = new Map(['Approved', 'Commenced', 'Completed'].map(label => [label, {units:0, approved:0, commenced:0, completed:0}]));
  for (const record of records) {
    const row = rows.get(statusLabel(record.status));
    if (!row) continue;
    const units = record.application_details?.residential_details?.total_no_proposed_residential_units || 0;
    row.units += units;
    for (const [field, key] of fields) if (parseDate(record[field])) row[key] += units;
  }
  const body = document.querySelector('#data-quality-body');
  body.replaceChildren();
  for (const [label, row] of rows) {
    const tableRow = document.createElement('tr');
    const statusCell = document.createElement('th');
    statusCell.scope = 'row';
    statusCell.textContent = label;
    tableRow.append(statusCell);
    for (const [, key] of fields) {
      const cell = document.createElement('td');
      cell.textContent = row.units ? `${(row[key] / row.units * 100).toFixed(1)}%` : '—';
      tableRow.append(cell);
    }
    body.append(tableRow);
  }
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
      const options = chartOptions(title, value => Number(value).toFixed(0), true);
      options.scales.y.max = key === 'developer' && mode === 'units' ? 40 : undefined;
      const created = new Chart(document.querySelector(`#${id}`), {type:'line',data:{labels:data.delayYears,datasets:sizeDelayDatasets(data, key, mode)},options});
      if (index === 0) sizeCouncilChart = created;
      else sizeDeveloperChart = created;
    } else {
      chart.data.datasets = sizeDelayDatasets(data, key, mode);
      chart.options.scales.y.title.text = title;
      chart.options.scales.y.max = key === 'developer' && mode === 'units' ? 40 : undefined;
      chart.update('none');
    }
  });
}

const statusPalette = ['#332288','#88ccee','#117733','#ddcc77','#cc6677','#44aa99','#882255','#aa4499','#999999'];
let submissionChart;
function submissionTooltipLabel(context, mode, relative) {
  const value = relative ? `${Number(context.raw).toFixed(1)}%` : `${Number(context.raw).toLocaleString()} ${mode === 'units' ? 'units' : 'applications'}`;
  return `${context.dataset.label}: ${value}`;
}
function makeSubmissionChart(data, mode = 'units', scale = 'absolute') {
  const relative = scale === 'relative';
  const measure = relative ? (mode === 'units' ? 'Share of residential units (%)' : 'Share of applications (%)') : (mode === 'units' ? 'Residential units' : 'Applications');
  const totals = data.submissionYears.map(year => data.statuses.reduce((sum, label) => sum + (data.submissionByYear.get(year).get(label)?.[mode] || 0), 0));
  const datasets = data.statuses.map((label, index) => ({
    label,
    data: data.submissionYears.map((year, yearIndex) => {
      const value = data.submissionByYear.get(year).get(label)?.[mode] || 0;
      return relative && totals[yearIndex] ? value / totals[yearIndex] * 100 : value;
    }),
    backgroundColor: statusPalette[index % statusPalette.length],
    borderWidth: 0
  }));
  const options = chartOptions(measure, value => relative ? `${value}%` : Number(value).toLocaleString(), true);
  options.plugins.tooltip = {enabled:true,callbacks:{label:context => submissionTooltipLabel(context, mode, relative)}};
  options.scales = {x:{stacked:true,grid:{display:false}},y:{stacked:true,max:relative ? 100 : undefined,title:{display:true,text:measure},beginAtZero:true,grid:{color:'rgba(23,43,42,.08)'},ticks:{callback:value=>relative ? `${value}%` : Number(value).toLocaleString()}}};
  if (!submissionChart) {
    submissionChart = new Chart(document.querySelector('#submission-chart'), {type:'bar',data:{labels:data.submissionYears,datasets},options});
  } else {
    submissionChart.data.datasets = datasets;
    submissionChart.options.plugins.tooltip.callbacks.label = context => submissionTooltipLabel(context, mode, relative);
    submissionChart.options.scales.y.title.text = measure;
    submissionChart.options.scales.y.max = relative ? 100 : undefined;
    submissionChart.options.scales.y.ticks.callback = value => relative ? `${value}%` : Number(value).toLocaleString();
    submissionChart.update('none');
  }
}

function makeStatusCloud(records) {
  const counts = new Map();
  for (const record of records) {
    const label = statusLabel(record.status);
    counts.set(label, (counts.get(label) || 0) + 1);
  }
  const entries = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const cloud = document.querySelector('#status-cloud');
  cloud.replaceChildren();
  cloud.style.height = `${Math.max(620, entries.length * 14)}px`;
  const low = Math.log10(entries[entries.length - 1][1]);
  const high = Math.log10(entries[0][1]);
  const words = [];
  for (const [index, [label, count]] of entries.entries()) {
    const word = document.createElement('span');
    const scale = high === low ? 28 : 10 + (Math.log10(count) - low) / (high - low) * 54;
    word.className = 'status-word';
    word.style.setProperty('--word-size', `${scale.toFixed(1)}px`);
    word.title = `${count.toLocaleString()} applications`;
    word.textContent = label;
    word.setAttribute('role', 'listitem');
    word.dataset.index = index;
    cloud.append(word);
    words.push(word);
  }
  const placed = [];
  const width = cloud.clientWidth;
  const height = cloud.clientHeight;
  const canPlace = candidate => candidate.left >= 8 && candidate.top >= 8 && candidate.right <= width - 8 && candidate.bottom <= height - 8 && placed.every(item => candidate.right + 8 < item.left || candidate.left - 8 > item.right || candidate.bottom + 8 < item.top || candidate.top - 8 > item.bottom);
  for (const word of words) {
    const wordWidth = word.offsetWidth;
    const wordHeight = word.offsetHeight;
    let position;
    for (let step = 0; step < 8000 && !position; step++) {
      const angle = step * .45;
      const radius = 7 * Math.sqrt(step);
      const left = width / 2 + Math.cos(angle) * radius - wordWidth / 2;
      const top = height / 2 + Math.sin(angle) * radius * .62 - wordHeight / 2;
      const candidate = {left, top, right:left + wordWidth, bottom:top + wordHeight};
      if (canPlace(candidate)) position = candidate;
    }
    if (!position) {
      for (let top = 8; top <= height - wordHeight - 8 && !position; top += 8) {
        for (let left = 8; left <= width - wordWidth - 8; left += 8) {
          const candidate = {left, top, right:left + wordWidth, bottom:top + wordHeight};
          if (canPlace(candidate)) position = candidate;
        }
      }
    }
    if (!position) throw new Error('Could not place status word');
    word.style.left = `${position.left}px`;
    word.style.top = `${position.top}px`;
    placed.push({...position, right:position.left + wordWidth, bottom:position.top + wordHeight});
  }
}

const data = aggregate(window.DATA.records, window.DATA.submission_records || window.DATA.records);
const values = key => data.years.map(year => data.byYear.get(year)[key]);
makeLineChart('total-chart', data.years, values('homes'), burgundy, 'Residential units started', true);
makeCompletenessChart(data);
makeDataQualityTable(window.DATA.submission_records || window.DATA.records);
makeDelayCharts(data);
makeSizeDelayCharts(data);
makeSubmissionChart(data);
makeStatusCloud(window.DATA.submission_records || window.DATA.records);
let submissionMode = 'units';
let submissionScale = 'absolute';
document.querySelectorAll('[data-completeness-mode]').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('[data-completeness-mode]').forEach(item => { item.classList.toggle('active', item === button); item.setAttribute('aria-pressed', item === button); });
  makeCompletenessChart(data, button.dataset.completenessMode);
}));
document.querySelectorAll('[data-delay-mode]').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('[data-delay-mode]').forEach(item => { item.classList.toggle('active', item === button); item.setAttribute('aria-pressed', item === button); });
  makeDelayCharts(data, button.dataset.delayMode);
}));
document.querySelectorAll('[data-size-delay-mode]').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('[data-size-delay-mode]').forEach(item => { item.classList.toggle('active', item === button); item.setAttribute('aria-pressed', item === button); });
  makeSizeDelayCharts(data, button.dataset.sizeDelayMode);
}));
document.querySelectorAll('[data-submission-mode]').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('[data-submission-mode]').forEach(item => { item.classList.toggle('active', item === button); item.setAttribute('aria-pressed', item === button); });
  submissionMode = button.dataset.submissionMode;
  makeSubmissionChart(data, submissionMode, submissionScale);
}));
document.querySelectorAll('[data-submission-scale]').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('[data-submission-scale]').forEach(item => { item.classList.toggle('active', item === button); item.setAttribute('aria-pressed', item === button); });
  submissionScale = button.dataset.submissionScale;
  makeSubmissionChart(data, submissionMode, submissionScale);
}));
status.textContent = `${window.DATA.records.length.toLocaleString()} completed or commenced residential records · ${window.DATA.submission_records?.length.toLocaleString() || window.DATA.records.length.toLocaleString()} all-status submissions · pre-downloaded API data`;
