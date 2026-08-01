const status = document.querySelector('#status');
const burgundy = '#7b2638';
const green = '#759b8d';
const minYear = 2000;
const delayMinYear = 2018;
const maxYear = 2025;
const sizeBands = [
  {label:'1–5 units', min:1, max:5},
  {label:'6–50 units', min:6, max:50},
  {label:'51–200 units', min:51, max:200},
  {label:'201–500 units', min:201, max:500},
  {label:'501+ units', min:501, max:Infinity}
];
const sizeColors = ['#7b2638','#a34c5a','#c0787d','#759b8d','#47756d','#294d49'];

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
  const delayYears = Array.from({length:maxYear - delayMinYear + 1}, (_, i) => delayMinYear + i);
  const byYear = new Map(years.map(year => [year, {homes:0, records:0, complete:0, council:[], developer:[]}]));
  const unitValues = [];
  const sizeByYear = sizeBands.map(() => new Map(years.map(year => [year, {council:[], developer:[]}] )));
  for (const record of records) {
    const actual = parseDate(record.actual_commencement_date);
    const year = actual?.getUTCFullYear();
    if (!year || year < minYear || year > maxYear) continue;
    const row = byYear.get(year);
    const units = record.application_details?.residential_details?.total_no_proposed_residential_units || 0;
    const sizeIndex = sizeBands.findIndex(band => units >= band.min && units <= band.max);
    unitValues.push(units);
    row.records++;
    row.homes += units;
    const submitted = parseDate(record.valid_date);
    const approved = parseDate(record.decision_date);
    if (!submitted || !approved) continue;
    row.complete++;
    const councilDelay = monthsBetween(submitted, approved);
    const developerDelay = monthsBetween(approved, actual);
    if (councilDelay >= 0) row.council.push(councilDelay);
    if (developerDelay >= 0) row.developer.push(developerDelay);
    if (sizeIndex >= 0) {
      if (councilDelay >= 0) sizeByYear[sizeIndex].get(year).council.push(councilDelay);
      if (developerDelay >= 0) sizeByYear[sizeIndex].get(year).developer.push(developerDelay);
    }
  }
  return {years, delayYears, byYear, unitValues, sizeByYear};
}

function chartOptions(yTitle, yFormat = value => Number(value).toLocaleString(), showLegend = false) {
  return {responsive:true,maintainAspectRatio:false,interaction:{mode:'nearest',intersect:false},plugins:{legend:{display:showLegend,position:'bottom',labels:{boxWidth:12,usePointStyle:true,padding:14,font:{size:11}}},tooltip:{enabled:false}},scales:{x:{grid:{display:false},ticks:{maxTicksLimit:12}},y:{title:{display:true,text:yTitle},beginAtZero:true,grid:{color:'rgba(23,43,42,.08)'},ticks:{callback:yFormat}}}};
}

function makeLineChart(id, labels, values, color, yTitle, fill = false) {
  const chart = new Chart(document.querySelector(`#${id}`), {type:'line',data:{labels,datasets:[{data:values,borderColor:color,backgroundColor:fill ? `${color}22` : color,borderWidth:2.5,hoverBorderWidth:4,pointRadius:0,pointHoverRadius:4,fill,tension:.25}]},options:chartOptions(yTitle)});
  return chart;
}

function makeSizeHistogram(data) {
  const max = Math.max(...data.unitValues);
  const binCount = 30;
  const edges = Array.from({length:binCount + 1}, (_, i) => i === 0 ? 1 : Math.ceil(2 ** (Math.log2(max + 1) * i / binCount)));
  const counts = edges.slice(0, -1).map((edge, i) => data.unitValues.filter(value => value >= edge && (i === edges.length - 2 ? value <= edges[i + 1] : value < edges[i + 1])).length);
  const labels = edges.slice(0, -1).map((edge, i) => edge === edges[i + 1] - 1 ? `${edge}` : `${edge}–${edges[i + 1] - 1}`);
  new Chart(document.querySelector('#size-chart'), {type:'bar',data:{labels,datasets:[{data:counts,backgroundColor:burgundy,borderRadius:2,barPercentage:1,categoryPercentage:1}]},options:{...chartOptions('Applications'),scales:{x:{title:{display:true,text:'Proposed residential units · log-spaced bins'},grid:{display:false},ticks:{maxTicksLimit:12}},y:{title:{display:true,text:'Applications'},beginAtZero:true,grid:{color:'rgba(23,43,42,.08)'},ticks:{callback:value=>Number(value).toLocaleString()}}}}});
}

function makeSizeDelayChart(data, id, key, title) {
  const datasets = sizeBands.map((band, index) => ({label:band.label,data:data.delayYears.map(year => { const values=data.sizeByYear[index].get(year)[key]; return values.length ? median(values) : null; }),borderColor:sizeColors[index],backgroundColor:sizeColors[index],borderWidth:2,pointRadius:0,pointHoverRadius:4,tension:.25}));
  new Chart(document.querySelector(`#${id}`), {type:'line',data:{labels:data.delayYears,datasets},options:chartOptions(title, value => Number(value).toFixed(0), true)});
}

const data = aggregate(window.DATA.records);
const values = key => data.years.map(year => data.byYear.get(year)[key]);
makeLineChart('total-chart', data.years, values('homes'), burgundy, 'Residential units started', true);
makeLineChart('completeness-chart', data.years, data.years.map(year => data.byYear.get(year).complete / data.byYear.get(year).records * 100), green, 'Records with all three dates (%)');
makeLineChart('council-chart', data.delayYears, data.delayYears.map(year => data.byYear.get(year).council.length ? median(data.byYear.get(year).council) : null), burgundy, 'Median months');
makeLineChart('developer-chart', data.delayYears, data.delayYears.map(year => data.byYear.get(year).developer.length ? median(data.byYear.get(year).developer) : null), green, 'Median months');
makeSizeHistogram(data);
makeSizeDelayChart(data, 'size-council-chart', 'council', 'Median months');
makeSizeDelayChart(data, 'size-developer-chart', 'developer', 'Median months');
status.textContent = `${window.DATA.records.length.toLocaleString()} completed or commenced residential records · starts 2000–2025 · pre-downloaded API data`;
