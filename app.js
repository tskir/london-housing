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
  const colors = series.map((_, i) => `hsl(${155 + i * 11 % 190} 48% ${35 + i % 3 * 8}%)`);
  chart?.destroy();
  chart = new Chart(document.querySelector('#chart'), {
    type: 'line',
    data: { labels: years, datasets: series.map((borough, i) => ({ ...borough, borderColor: colors[i], backgroundColor: colors[i], borderWidth: 2, pointRadius: 0, pointHoverRadius: 5, tension: .25 })) },
    options: { responsive:true, maintainAspectRatio:false, interaction:{mode:'index',intersect:false}, elements:{line:{spanGaps:true}}, plugins:{legend:{position:'bottom',labels:{boxWidth:12,usePointStyle:true,padding:15,font:{size:11}}}, tooltip:{callbacks:{label: item => ` ${item.dataset.label}: ${item.formattedValue} homes`}}}, scales:{x:{grid:{display:false},ticks:{maxTicksLimit:12}},y:{beginAtZero:true,grid:{color:'rgba(23,43,42,.08)'},ticks:{callback:value=>Number(value).toLocaleString()}}} }
  });
}

makeChart(window.DATA.aggregations);
status.textContent = `${window.DATA.hits.total.value.toLocaleString()} construction starts · pre-downloaded API data`;
