# London's housing pipeline

A fully static, overall view of London's residential construction pipeline: starts, process completeness, council delay and developer delay.

The app is intentionally snapshot-based: `data.js` is the app's data source and is deployed alongside the HTML. The browser does not call the Planning London Datahub API, so the dashboard works on GitHub Pages without a backend or CORS dependency.

## Refresh the data

Run these commands from the repository root whenever a new API snapshot is needed:

```bash
api_key='be2rmRnt&'
PLD_API_KEY="$api_key" python3 fetch-data.py
```

`fetch-data.py` uses the API's scroll endpoint to download every record with `status.raw` equal to `Completed` or `Commenced`, more than zero proposed residential units, and a recorded construction start from 2000 through 2025. The fields are listed in `data-query.json`: submitted (`valid_date`), approved (`decision_date`), started (`actual_commencement_date`), status and residential units. The browser computes all charts locally. 2026 is excluded because it is an incomplete year. Negative date intervals are excluded from delay medians as invalid chronology, but remain part of the completeness denominator. The API key is the guest key documented in `pld-api.md`.

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

The final section breaks applications into six residential-unit bands—1, 2–5, 6–20, 21–50, 51–200 and 201+—and compares the median council and developer delays for each band.
