# London homes started

A fully static dashboard of homes whose construction has started, by year and London borough.

The app is intentionally snapshot-based: `data.js` is the app's data source and is deployed alongside the HTML. The browser does not call the Planning London Datahub API, so the dashboard works on GitHub Pages without a backend or CORS dependency.

## Refresh the data

Run these commands from the repository root whenever a new API snapshot is needed:

```bash
api_key='be2rmRnt&'
PLD_API_KEY="$api_key" python3 fetch-data.py
```

`fetch-data.py` uses the API's scroll endpoint to download every record with more than zero proposed residential units, using the fields listed in `data-query.json`. The browser then computes homes started, average lag in months from `actual_commencement_date` minus `application_details.intended_commencement_date`, and completeness percentages locally. Records before 1980 are excluded from time series because the API contains malformed historical dates. The API key is the guest key documented in `pld-api.md`.

After updating `data.js`, commit and push it to publish the new snapshot.

## Run locally

```bash
python3 -m http.server 8000
```

Open <http://localhost:8000>.

## Published dashboard

[Open the dashboard on GitHub Pages](https://tskir.github.io/london-housing/).

If the link returns 404, enable Pages once in the repository: **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: `main` → Folder: `/ (root)`**.

The app loads Chart.js from jsDelivr, so the chart needs an internet connection.
