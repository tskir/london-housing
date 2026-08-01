#!/usr/bin/env python3
"""Download the residential-only API snapshot used by the static dashboard."""

import json
import os
from pathlib import Path
from urllib.request import Request, urlopen

BASE = 'https://planninglondondatahub.london.gov.uk/api-guest'
API_KEY = os.environ.get('PLD_API_KEY', 'be2rmRnt&')


def request(url, payload):
    body = json.dumps(payload).encode()
    response = urlopen(Request(url, data=body, headers={
        'Content-Type': 'application/json',
        'X-API-AllowRequest': API_KEY,
    }))
    return json.load(response)


query = json.loads(Path('data-query.json').read_text())
result = request(f'{BASE}/applications/_search?scroll=1m', query)
records = []

while True:
    hits = result.get('hits', {}).get('hits', [])
    records.extend(hit['_source'] for hit in hits)
    if not hits:
        break
    result = request(f'{BASE}/_search/scroll', {'scroll': '1m', 'scroll_id': result['_scroll_id']})

Path('data.js').write_text('window.DATA = ' + json.dumps({'records': records}, separators=(',', ':')) + ';\n')
print(f'Wrote {len(records):,} residential records to data.js')
