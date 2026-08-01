const status = document.querySelector('#status');
let chart;

function makeChart(data) {
  const years = data.years.buckets.map(bucket => new Date(bucket.key).getUTCFullYear());
  const boroughs = new Map();
  for (const borough of data.boroughs.buckets) {
    const name = borough.key.replace(/^London Borough of /, '').replace(/ Council$/, '');
    const totals = boroughs.get(name) || new Map();
    for (const bucket of borough.years.buckets) {
      const year = new Date(bucket.key).getUTCFullYear();
      totals.set(year, (totals.get(year) || 0) + (bucket.homes.value || 0));
    }
    boroughs.set(name, totals);
  }
  const series = [...boroughs].map(([label, totals]) => ({ label, data: years.map(year => totals.get(year) || 0) }));
  const grey = '#b4b0aa';
  const burgundy = '#7b2638';
  const endLabel = { id: 'endLabel', afterDraw(chart) {
    const index = chart.$hoveredDataset;
    if (index === undefined || index < 0) return;
    const point = chart.getDatasetMeta(index).data.at(-1);
    if (!point) return;
    const context = chart.ctx;
    context.save();
    context.fillStyle = burgundy;
    context.font = '600 12px DM Sans';
    context.textBaseline = 'middle';
    context.fillText(chart.data.datasets[index].label, point.x + 10, point.y);
    context.restore();
  } };
  chart?.destroy();
  chart = new Chart(document.querySelector('#chart'), {
    type: 'line',
    data: { labels: years, datasets: series.map(borough => ({ ...borough, borderColor: grey, backgroundColor: grey, borderWidth: 1.5, pointRadius: 0, pointHoverRadius: 0, tension: .25 })) },
    plugins: [endLabel],
    options: { responsive:true, maintainAspectRatio:false, layout:{padding:{right:120}}, interaction:{mode:'nearest',intersect:false}, onHover:(_, elements, chart) => { const index = elements[0]?.datasetIndex ?? -1; if (chart.$hoveredDataset !== index) { chart.$hoveredDataset = index; chart.update('none'); } }, elements:{line:{spanGaps:true}}, plugins:{legend:{display:false},tooltip:{enabled:false}}, scales:{x:{grid:{display:false},ticks:{maxTicksLimit:12}},y:{grid:{color:'rgba(23,43,42,.08)'},ticks:{callback:value=>Number(value).toLocaleString()}}} }
  });
  chart.options.animation = false;
  chart.config.data.datasets.forEach(dataset => {
    dataset.borderColor = context => context.chart.$hoveredDataset === context.datasetIndex ? burgundy : grey;
    dataset.borderWidth = context => context.chart.$hoveredDataset === context.datasetIndex ? 3 : 1.5;
  });
  chart.update('none');
}

makeChart(window.DATA.aggregations);
status.textContent = `${window.DATA.hits.total.value.toLocaleString()} construction starts · pre-downloaded API data`;
