const status = document.querySelector('#status');
const burgundy = '#7b2638';
const grey = '#b4b0aa';
const minYear = 1980;
const lagMinYear = 2020;
const maxYear = new Date().getUTCFullYear();

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
function boroughName(name) { return name.replace(/^London Borough of /, '').replace(/ Council$/, ''); }

function aggregate(records) {
  const years = Array.from({length:maxYear - minYear + 1}, (_, i) => minYear + i);
  const lagYears = Array.from({length:maxYear - lagMinYear + 1}, (_, i) => lagMinYear + i);
  const totals = new Map(years.map(year => [year, 0]));
  const overallLags = new Map();
  const boroughs = new Map();
  for (const record of records) {
    const borough = boroughName(record.borough || 'Unknown');
    const units = record.application_details?.residential_details?.total_no_proposed_residential_units || 0;
    const actual = parseDate(record.actual_commencement_date);
    const intended = parseDate(record.application_details?.intended_commencement_date);
    const item = boroughs.get(borough) || { records:0, complete:0, totals:new Map(), lags:new Map() };
    const actualYear = actual?.getUTCFullYear();
    const lagEligible = actualYear >= lagMinYear && actualYear <= maxYear;
    if (lagEligible) item.records++;
    if (lagEligible && actual && intended) {
      item.complete++;
      const year = actual.getUTCFullYear();
      const lag = item.lags.get(year) || {sum:0, count:0};
      lag.sum += monthsBetween(intended, actual);
      lag.count++;
      item.lags.set(year, lag);
      const overall = overallLags.get(year) || {sum:0, count:0};
      overall.sum += monthsBetween(intended, actual);
      overall.count++;
      overallLags.set(year, overall);
    }
    if (actual && actual.getUTCFullYear() >= minYear && actual.getUTCFullYear() <= maxYear) {
      const year = actual.getUTCFullYear();
      totals.set(year, totals.get(year) + units);
      item.totals.set(year, (item.totals.get(year) || 0) + units);
    }
    boroughs.set(borough, item);
  }
  return {years, lagYears, totals, overallLags, boroughs};
}

const endLabel = { id:'endLabel', afterDraw(chart) {
  const index = chart.$hoveredDataset;
  if (index === undefined || index < 0) return;
  const dataset = chart.data.datasets[index];
  let lastIndex = dataset.data.length - 1;
  while (lastIndex >= 0 && dataset.data[lastIndex] == null) lastIndex--;
  const point = chart.getDatasetMeta(index).data[lastIndex];
  if (!point) return;
  const context = chart.ctx;
  context.save();
  context.fillStyle = burgundy;
  context.font = '600 12px DM Sans';
  context.textBaseline = 'middle';
  context.fillText(dataset.label, point.x + 10, point.y);
  context.restore();
} };

function hoverOptions() { return {interaction:{mode:'nearest',intersect:false},onHover:(_, elements, chart) => { const index = elements[0]?.datasetIndex ?? -1; if (chart.$hoveredDataset !== index) { chart.$hoveredDataset = index; chart.update('none'); } }}; }
function styleDatasets(chart) { chart.data.datasets.forEach(dataset => { dataset.borderColor = context => context.chart.$hoveredDataset === context.datasetIndex ? burgundy : grey; dataset.borderWidth = context => context.chart.$hoveredDataset === context.datasetIndex ? 3 : 1.5; }); }

function makeTotalChart(data) {
  new Chart(document.querySelector('#total-chart'), {type:'line',data:{labels:data.years,datasets:[{label:'London',data:data.years.map(year => data.totals.get(year)),borderColor:burgundy,backgroundColor:'rgba(123,38,56,.1)',borderWidth:2.5,hoverBorderWidth:4,pointRadius:0,pointHoverRadius:4,fill:true,tension:.25}]},options:{responsive:true,maintainAspectRatio:false,...hoverOptions(),plugins:{legend:{display:false},tooltip:{enabled:false}},scales:{x:{grid:{display:false},ticks:{maxTicksLimit:12}},y:{beginAtZero:true,grid:{color:'rgba(23,43,42,.08)'},ticks:{callback:value=>Number(value).toLocaleString()}}}}});
}

function makeBoroughChart(data) {
  const series = [...data.boroughs].map(([label, borough]) => ({label,data:data.years.map(year => borough.totals.get(year) || 0),borderColor:grey,backgroundColor:grey,borderWidth:1.5,pointRadius:0,pointHoverRadius:0,tension:.25}));
  const chart = new Chart(document.querySelector('#chart'), {type:'line',data:{labels:data.years,datasets:series},plugins:[endLabel],options:{...hoverOptions(),responsive:true,maintainAspectRatio:false,layout:{padding:{right:120}},elements:{line:{spanGaps:true}},plugins:{legend:{display:false},tooltip:{enabled:false}},scales:{x:{grid:{display:false},ticks:{maxTicksLimit:12}},y:{grid:{color:'rgba(23,43,42,.08)'},ticks:{callback:value=>Number(value).toLocaleString()}}}}});
  styleDatasets(chart);
}

function makeLagChart(data) {
  const series = [...data.boroughs].filter(([, borough]) => borough.records && borough.complete / borough.records >= .02).map(([label, borough]) => ({label,data:data.lagYears.map(year => borough.lags.has(year) ? borough.lags.get(year).sum / borough.lags.get(year).count : null),borderColor:grey,backgroundColor:grey,borderWidth:1.5,pointRadius:0,pointHoverRadius:0,tension:.25}));
  const chart = new Chart(document.querySelector('#lag-chart'), {type:'line',data:{labels:data.lagYears,datasets:series},plugins:[endLabel],options:{...hoverOptions(),responsive:true,maintainAspectRatio:false,layout:{padding:{right:120}},elements:{line:{spanGaps:true}},plugins:{legend:{display:false},tooltip:{enabled:false}},scales:{x:{grid:{display:false},ticks:{maxTicksLimit:12}},y:{title:{display:true,text:'Average lag (months)'},grid:{color:'rgba(23,43,42,.08)'},ticks:{callback:value=>Number(value).toFixed(0)}}}}});
  styleDatasets(chart);
}

function makeOverallLagChart(data) {
  new Chart(document.querySelector('#overall-lag-chart'), {type:'line',data:{labels:data.lagYears,datasets:[{label:'London',data:data.lagYears.map(year => data.overallLags.has(year) ? data.overallLags.get(year).sum / data.overallLags.get(year).count : null),borderColor:burgundy,backgroundColor:'rgba(123,38,56,.1)',borderWidth:2.5,hoverBorderWidth:4,pointRadius:0,pointHoverRadius:4,fill:true,tension:.25}]},options:{responsive:true,maintainAspectRatio:false,...hoverOptions(),plugins:{legend:{display:false},tooltip:{enabled:false}},scales:{x:{grid:{display:false},ticks:{maxTicksLimit:12}},y:{title:{display:true,text:'Average lag (months)'},grid:{color:'rgba(23,43,42,.08)'},ticks:{callback:value=>Number(value).toFixed(0)}}}}});
}

function makeCompleteness(data) {
  const rows = [...data.boroughs].map(([name, borough]) => [name, borough.records ? borough.complete / borough.records * 100 : 0]).sort((a,b) => b[1] - a[1]);
  const escape = text => text.replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
  document.querySelector('#completeness').innerHTML = rows.map(([name, percentage]) => `<tr><td>${escape(name)}</td><td>${percentage.toFixed(1)}%</td></tr>`).join('');
}

const data = aggregate(window.DATA.records);
makeTotalChart(data);
makeBoroughChart(data);
makeLagChart(data);
makeOverallLagChart(data);
makeCompleteness(data);
status.textContent = `${window.DATA.records.length.toLocaleString()} residential records · pre-downloaded API data`;
