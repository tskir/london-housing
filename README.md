# London homes started

A fully static dashboard of homes whose construction has started, by year and London borough.

The app is intentionally snapshot-based: `data.js` is the app's data source and is deployed alongside the HTML. The browser does not call the Planning London Datahub API, so the dashboard works on GitHub Pages without a backend or CORS dependency.

## Refresh the data

Run these commands from the repository root whenever a new API snapshot is needed:

```bash
today=$(date +%d/%m/%Y)
api_key='be2rmRnt&'

curl -sS 'https://planninglondondatahub.london.gov.uk/api-guest/applications/_search' \
  -H "X-API-AllowRequest: $api_key" \
  -H 'Content-Type: application/json' \
  --data-binary @- <<EOF | sed 's/^/window.DATA = /; s/$/;/' > data.js
{"size":0,"track_total_hits":true,"query":{"range":{"actual_commencement_date":{"gte":"01/01/1980","lte":"$today"}}},"aggs":{"years":{"date_histogram":{"field":"actual_commencement_date","calendar_interval":"year","min_doc_count":1},"aggs":{"homes":{"sum":{"field":"application_details.residential_details.total_no_proposed_residential_units"}}}},"boroughs":{"terms":{"field":"borough.raw","size":100},"aggs":{"years":{"date_histogram":{"field":"actual_commencement_date","calendar_interval":"year","min_doc_count":1},"aggs":{"homes":{"sum":{"field":"application_details.residential_details.total_no_proposed_residential_units"}}}}}}}}
EOF
```

The query uses `actual_commencement_date` for the year and sums `application_details.residential_details.total_no_proposed_residential_units`. Records before 1980 are excluded because the live dataset contains malformed historical dates. The API key is the guest key documented in `pld-api.md`.

After updating `data.js`, commit and push it to publish the new snapshot.

## Run locally

```bash
python3 -m http.server 8000
```

Open <http://localhost:8000>.

## Published dashboard

[Open the dashboard on GitHub Pages](https://tskir.github.io/london-housing/).

The app loads Chart.js from jsDelivr, so the chart needs an internet connection.
