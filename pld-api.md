## API endpoints

Base URL:

```text
https://planninglondondatahub.london.gov.uk/api-guest
```

Legacy/documented equivalent:

```text
https://planningdata.london.gov.uk/api-guest
```

Every request needs:

```http
X-API-AllowRequest: be2rmRnt&
```

Main endpoints:

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/` | API/Elasticsearch version information |
| `GET` | `/{index}/_count` | Count records |
| `GET` | `/{index}/_source/{id}` | Retrieve one record |
| `POST` | `/{index}/_search` | Search and filter records |
| `POST` | `/{index}/_search?scroll=1m` | Start a bulk extraction |
| `POST` | `/_search/scroll` | Retrieve the next bulk page |

Available indices include:

```text
applications
residential_units
existing_proposed_floorspace_details
other_resi_accommodation_unit_details
open_spaces_details
protected_spaces_details
```

`non-permanent_dwellings_details` is documented but currently returns HTTP 403.

See the [official API documentation](https://www.london.gov.uk/sites/default/files/planninglondondatahub_api_connection_technical_documentation_v1.pdf) and [technical schema](https://www.london.gov.uk/sites/default/files/planninglondondatahub_public_technical_schemav2.1.xlsx).

## Example queries and responses

### 1. Count applications

```bash
curl 'https://planninglondondatahub.london.gov.uk/api-guest/applications/_count' \
  -H 'X-API-AllowRequest: be2rmRnt&'
```

Response:

```json
{
  "count": 1274018,
  "_shards": {
    "total": 1,
    "successful": 1,
    "skipped": 0,
    "failed": 0
  }
}
```

The count changes as the live dataset is updated.

### 2. Retrieve one application

```bash
curl \
  'https://planninglondondatahub.london.gov.uk/api-guest/applications/_source/Newham-701491' \
  -H 'X-API-AllowRequest: be2rmRnt&'
```

Abbreviated response:

```json
{
  "id": "Newham-701491",
  "lpa_name": "Newham",
  "lpa_app_no": "701491",
  "status": "Approved",
  "valid_date": "01/01/2021",
  "decision_date": "15/04/2021",
  "application_details": {
    "...": "nested application data"
  }
}
```

Application IDs generally combine the planning authority and its application reference. Some reference characters are replaced with underscores.

### 3. Retrieve a small sample

```bash
curl -X POST \
  'https://planninglondondatahub.london.gov.uk/api-guest/applications/_search' \
  -H 'X-API-AllowRequest: be2rmRnt&' \
  -H 'Content-Type: application/json' \
  --data '{
    "size": 2,
    "query": {
      "match_all": {}
    },
    "_source": [
      "id",
      "lpa_name",
      "lpa_app_no",
      "status",
      "valid_date"
    ]
  }'
```

Abbreviated response:

```json
{
  "took": 2,
  "timed_out": false,
  "hits": {
    "total": {
      "value": 10000,
      "relation": "gte"
    },
    "hits": [
      {
        "_index": "applications",
        "_id": "Islington-P2025_0271_FUL",
        "_source": {
          "id": "Islington-P2025_0271_FUL",
          "lpa_name": "Islington",
          "lpa_app_no": "P2025/0271/FUL",
          "status": "Approved",
          "valid_date": "28/01/2025"
        }
      }
    ]
  }
}
```

The `10000/gte` value is Elasticsearch’s default total-hit tracking threshold, not the true number of matching records.

### 4. Filter by authority, type and date

```bash
curl -X POST \
  'https://planninglondondatahub.london.gov.uk/api-guest/applications/_search' \
  -H 'X-API-AllowRequest: be2rmRnt&' \
  -H 'Content-Type: application/json' \
  --data '{
    "size": 100,
    "query": {
      "bool": {
        "must": [
          {
            "term": {
              "lpa_name.raw": "Lambeth"
            }
          },
          {
            "term": {
              "application_type.raw": "All Other"
            }
          },
          {
            "range": {
              "valid_date": {
                "gte": "01/01/2021"
              }
            }
          }
        ]
      }
    },
    "_source": [
      "id",
      "lpa_name",
      "lpa_app_no",
      "application_type",
      "valid_date",
      "decision",
      "decision_date",
      "last_updated"
    ]
  }'
```

Response structure:

```json
{
  "hits": {
    "total": {
      "value": 1234,
      "relation": "eq"
    },
    "hits": [
      {
        "_id": "Lambeth-...",
        "_source": {
          "id": "Lambeth-...",
          "lpa_name": "Lambeth",
          "application_type": "All Other",
          "valid_date": "12/03/2024",
          "decision": "Approved"
        }
      }
    ]
  }
}
```

Use `.raw` fields for exact matching where the schema provides them.

### 5. Search residential units

```bash
curl -X POST \
  'https://planninglondondatahub.london.gov.uk/api-guest/residential_units/_search' \
  -H 'X-API-AllowRequest: be2rmRnt&' \
  -H 'Content-Type: application/json' \
  --data '{
    "size": 100,
    "query": {
      "term": {
        "lpa_name.raw": "Newham"
      }
    }
  }'
```

Abbreviated response:

```json
{
  "hits": {
    "hits": [
      {
        "_index": "residential_units",
        "_source": {
          "lpa_name": "Newham",
          "application_id": "Newham-...",
          "unit_type": "Flat",
          "tenure": "Market"
        }
      }
    ]
  }
}
```

Check the technical schema before relying on specific residential field names, as much of the same data is also nested inside `applications`.

### 6. Bulk extraction using scroll

Start the scroll:

```bash
curl -X POST \
  'https://planninglondondatahub.london.gov.uk/api-guest/applications/_search?scroll=1m' \
  -H 'X-API-AllowRequest: be2rmRnt&' \
  -H 'Content-Type: application/json' \
  --data '{
    "size": 1000,
    "query": {
      "match_all": {}
    },
    "_source": [
      "id",
      "lpa_name",
      "status",
      "valid_date",
      "last_updated"
    ]
  }'
```

Response:

```json
{
  "_scroll_id": "FGluY2x1ZGVf...",
  "hits": {
    "hits": [
      {
        "_id": "Islington-P2025_0271_FUL",
        "_source": {
          "id": "Islington-P2025_0271_FUL",
          "lpa_name": "Islington",
          "status": "Approved",
          "valid_date": "28/01/2025"
        }
      }
    ]
  }
}
```

Request the next page:

```bash
curl -X POST \
  'https://planninglondondatahub.london.gov.uk/api-guest/_search/scroll' \
  -H 'X-API-AllowRequest: be2rmRnt&' \
  -H 'Content-Type: application/json' \
  --data '{
    "scroll": "1m",
    "scroll_id": "FGluY2x1ZGVf..."
  }'
```

Continue using the latest `_scroll_id` until:

```json
{
  "hits": {
    "hits": []
  }
}
```

For routine housing analysis, query only the required fields and date range; downloading every nested application record is substantially larger than the headline record count.
