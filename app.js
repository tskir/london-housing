const status = document.querySelector('#status');
const burgundy = '#7b2638';
const green = '#759b8d';
const minYear = 2000;
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

function aggregate(records) {
  const years = Array.from({length:maxYear - minYear + 1}, (_, i) => minYear + i);
  const byYear = new Map(years.map(year => [year, {homes:0, records:0, complete:0, council:[], developer:[]}]));
  for (const record of records) {
    const actual = parseDate(record.actual_commencement_date);
    const year = actual?.getUTCFullYear();
    if (!year || year < minYear || year > maxYear) continue;
    const row = byYear.get(year);
    row.records++;
    row.homes += record.application_details?.residential_details?.total_no_proposed_residential_units || 0;
    const submitted = parseDate(record.valid_date);
    const approved = parseDate(record.decision_date);
    if (!submitted || !approved) continue;
    row.complete++;
    const councilDelay = monthsBetween(submitted, approved);
    const developerDelay = monthsBetween(approved, actual);
    if (councilDelay >= 0) row.council.push(councilDelay);
    if (developerDelay >= 0) row.developer.push(developerDelay);
  }
  return {years, byYear};
}

function chartOptions(yTitle, yFormat = value => Number(value).toLocaleString()) {
  return {responsive:true,maintainAspectRatio:false,interaction:{mode:'nearest',intersect:false},plugins:{legend:{display:false},tooltip:{enabled:false}},scales:{x:{grid:{display:false},ticks:{maxTicksLimit:12}},y:{title:{display:true,text:yTitle},beginAtZero:true,grid:{color:'rgba(23,43,42,.08)'},ticks:{callback:yFormat}}}};
}

function makeLineChart(id, labels, values, color, yTitle, fill = false) {
  const chart = new Chart(document.querySelector(`#${id}`), {type:'line',data:{labels,datasets:[{data:values,borderColor:color,backgroundColor:fill ? `${color}22` : color,borderWidth:2.5,hoverBorderWidth:4,pointRadius:0,pointHoverRadius:4,fill,tension:.25}]},options:chartOptions(yTitle)});
  return chart;
}

const data = aggregate(window.DATA.records);
const values = key => data.years.map(year => data.byYear.get(year)[key]);
makeLineChart('total-chart', data.years, values('homes'), burgundy, 'Residential units started', true);
makeLineChart('completeness-chart', data.years, data.years.map(year => data.byYear.get(year).complete / data.byYear.get(year).records * 100), green, 'Records with all three dates (%)');
makeLineChart('council-chart', data.years, data.years.map(year => data.byYear.get(year).council.length ? median(data.byYear.get(year).council) : null), burgundy, 'Median months');
makeLineChart('developer-chart', data.years, data.years.map(year => data.byYear.get(year).developer.length ? median(data.byYear.get(year).developer) : null), green, 'Median months');
status.textContent = `${window.DATA.records.length.toLocaleString()} allowed residential records · starts 2000–2025 · pre-downloaded API data`;
