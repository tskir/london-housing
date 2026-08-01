const status = document.querySelector('#status');
const burgundy = '#7b2638';
const grey = '#b4b0aa';

const endLabel = { id: 'endLabel', afterDraw(chart) {
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

function hoverOptions() {
  return { interaction:{mode:'nearest',intersect:false}, onHover:(_, elements, chart) => { const index = elements[0]?.datasetIndex ?? -1; if (chart.$hoveredDataset !== index) { chart.$hoveredDataset = index; chart.update('none'); } } };
}

function boroughName(name) { return name.replace(/^London Borough of /, '').replace(/ Council$/, ''); }

function makeChart(data) {
  const years = data.allYears.years.buckets.map(bucket => new Date(bucket.key).getUTCFullYear());
  const boroughs = new Map();
  for (const borough of data.boroughs.buckets) {
    const name = boroughName(borough.key);
    const totals = boroughs.get(name) || new Map();
    for (const bucket of borough.started.years.buckets) totals.set(new Date(bucket.key).getUTCFullYear(), bucket.homes.value || 0);
    boroughs.set(name, totals);
  }
  const series = [...boroughs].map(([label, totals]) => ({ label, data: years.map(year => totals.get(year) || 0) }));
  const chart = new Chart(document.querySelector('#chart'), { type:'line', data:{labels:years,datasets:series.map(borough => ({...borough,borderColor:grey,backgroundColor:grey,borderWidth:1.5,pointRadius:0,pointHoverRadius:0,tension:.25}))}, plugins:[endLabel], options:{...hoverOptions(),responsive:true,maintainAspectRatio:false,layout:{padding:{right:120}},elements:{line:{spanGaps:true}},plugins:{legend:{display:false},tooltip:{enabled:false}},scales:{x:{grid:{display:false},ticks:{maxTicksLimit:12}},y:{grid:{color:'rgba(23,43,42,.08)'},ticks:{callback:value=>Number(value).toLocaleString()}}}} });
  chart.data.datasets.forEach(dataset => { dataset.borderColor = context => context.chart.$hoveredDataset === context.datasetIndex ? burgundy : grey; dataset.borderWidth = context => context.chart.$hoveredDataset === context.datasetIndex ? 3 : 1.5; });
}

function makeTotalChart(buckets) {
  new Chart(document.querySelector('#total-chart'), { type:'line', data:{labels:buckets.map(bucket => new Date(bucket.key).getUTCFullYear()),datasets:[{label:'London',data:buckets.map(bucket => bucket.homes.value || 0),borderColor:burgundy,backgroundColor:'rgba(123,38,56,.1)',borderWidth:2.5,hoverBorderWidth:4,pointRadius:0,pointHoverRadius:4,fill:true,tension:.25}]}, options:{responsive:true,maintainAspectRatio:false,...hoverOptions(),plugins:{legend:{display:false},tooltip:{enabled:false}},scales:{x:{grid:{display:false},ticks:{maxTicksLimit:12}},y:{beginAtZero:true,grid:{color:'rgba(23,43,42,.08)'},ticks:{callback:value=>Number(value).toLocaleString()}}}} });
}

function makeLagChart(data) {
  const years = data.allYears.years.buckets.map(bucket => new Date(bucket.key).getUTCFullYear());
  const datasets = data.boroughs.buckets.map(borough => {
    const lags = new Map(borough.lag.years.buckets.map(bucket => [new Date(bucket.key).getUTCFullYear(), bucket.lagMonths.value]));
    return { label:boroughName(borough.key), data:years.map(year => lags.has(year) ? {x:lags.get(year),y:year} : null), borderColor:grey, backgroundColor:grey, borderWidth:1.5, pointRadius:0, pointHoverRadius:0, tension:.25 };
  });
  const chart = new Chart(document.querySelector('#lag-chart'), { type:'line', data:{datasets}, plugins:[endLabel], options:{...hoverOptions(),indexAxis:'y',responsive:true,maintainAspectRatio:false,layout:{padding:{right:120}},elements:{line:{spanGaps:true}},plugins:{legend:{display:false},tooltip:{enabled:false}},scales:{x:{title:{display:true,text:'Average lag (months)'},grid:{color:'rgba(23,43,42,.08)'}},y:{type:'linear',reverse:true,min:years[0],max:years.at(-1),ticks:{stepSize:1,maxTicksLimit:12,callback:value=>Number(value).toString()},grid:{display:false}}}} });
  chart.data.datasets.forEach(dataset => { dataset.borderColor = context => context.chart.$hoveredDataset === context.datasetIndex ? burgundy : grey; dataset.borderWidth = context => context.chart.$hoveredDataset === context.datasetIndex ? 3 : 1.5; });
}

function makeCompleteness(boroughs) {
  const rows = boroughs.map(borough => [boroughName(borough.key), borough.doc_count ? borough.complete.doc_count / borough.doc_count * 100 : 0]).sort((a,b) => a[0].localeCompare(b[0]));
  document.querySelector('#completeness').innerHTML = rows.map(([name, percentage]) => `<tr><td>${name.replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]))}</td><td>${percentage.toFixed(1)}%</td></tr>`).join('');
}

makeChart(window.DATA.aggregations);
makeTotalChart(window.DATA.aggregations.allYears.years.buckets);
makeLagChart(window.DATA.aggregations);
makeCompleteness(window.DATA.aggregations.boroughs.buckets);
status.textContent = `${window.DATA.hits.total.value.toLocaleString()} residential records · pre-downloaded API data`;
