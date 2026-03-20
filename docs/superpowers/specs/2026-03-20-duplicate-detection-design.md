# Duplicate Detection for Record Create Operation

## Overview

Add optional duplicate detection to the Record > Create operation. Before creating a record, the node queries NetSuite via SuiteQL to check if a matching record already exists. If a duplicate is found, the item is skipped and a marker is output instead.

**Primary use case:** Prevent duplicate sales orders from being created in NetSuite.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Duplicate found behavior | Skip + output marker | User needs visibility into what was skipped without failing the workflow |
| Field matching | Multiple fields (AND) | Compound keys (e.g., PO number + customer) catch duplicates more precisely |
| Lookup method | SuiteQL query | Already supported by the node, flexible, works for any record type |
| Approach | Pre-check per order | Simple, reliable, fits the existing per-item loop |

## UI Properties

Three new properties added to the `properties` array, all scoped to `resource: ['record'], operation: ['create']`:

### 1. Enable Duplicate Detection (boolean toggle)

- **Name:** `enableDuplicateDetection`
- **Display name:** "Duplicate Detection"
- **Type:** `boolean`
- **Default:** `false`
- **displayOptions.show:** `{ resource: ['record'], operation: ['create'] }`

### 2. SuiteQL Table Name (string)

- **Name:** `duplicateCheckTable`
- **Display name:** "SuiteQL Table Name"
- **Type:** `string`
- **Required:** `true`
- **Default:** `''`
- **Placeholder:** `transaction`
- **Description:** "The SuiteQL table name to query for duplicates. Note: this may differ from the REST API record type (e.g., use 'transaction' for salesOrder, 'entity' for customer)."
- **displayOptions.show:** `{ resource: ['record'], operation: ['create'], enableDuplicateDetection: [true] }`

**Why a separate field:** SuiteQL table names do not match REST API record type names. For example, `salesOrder` in the REST API maps to the `transaction` table in SuiteQL (filtered by type). The user knows their NetSuite schema and must provide the correct SuiteQL table name.

### 3. Duplicate Check Fields (fixedCollection)

- **Name:** `duplicateCheckFields`
- **Display name:** "Duplicate Check Fields"
- **Type:** `fixedCollection`
- **typeOptions:** `{ multipleValues: true }`
- **displayOptions.show:** `{ resource: ['record'], operation: ['create'], enableDuplicateDetection: [true] }`
- **Sub-fields (in a group called `fieldValues`):**
  - **NetSuite Field** (`netsuiteField`): string, placeholder `otherrefnum`, description "The internal field name in NetSuite to check against"
  - **Match Value** (`matchValue`): string, supports expressions, placeholder `={{ $json.poNumber }}`, description "The value to match against"

## Duplicate Check Logic

Located inside the `resource === 'record'` block, **before** the Create POST request (between reading parameters at ~line 611 and building the URL at ~line 613).

### Flow

1. Read `enableDuplicateDetection` parameter (default `false`)
2. If disabled, skip to existing Create logic (no change)
3. If enabled, read `duplicateCheckTable` and `duplicateCheckFields.fieldValues` array
4. **Validate:** if toggle is on but no fields are provided, throw `NodeOperationError` ("At least one duplicate check field is required when duplicate detection is enabled")
5. Build SuiteQL query:
   ```sql
   SELECT id FROM transaction WHERE otherrefnum = 'PO-1234' AND entity = 42
   ```
   - Table name comes from `duplicateCheckTable` parameter
   - Values are escaped: single quotes doubled (`'` → `''`)
   - Numeric values (detected via `isNaN()` check) are left unquoted; string values are wrapped in single quotes
   - All conditions joined with `AND`
   - `FETCH FIRST 1 ROWS ONLY` appended for performance (only need to know if at least one exists)
6. Execute SuiteQL query:
   - **URL:** `https://{companyUrl}/services/rest/query/v1/suiteql?limit=1`
   - **Method:** `POST`
   - **Body:** `{ q: query }`
   - **Headers:** `Authorization` (OAuth 1.0a), `Content-Type: application/json`, `Prefer: transient`
   - Generate new OAuth timestamp/nonce for this request
   - Include `limit=1` in the OAuth signature base string (same pattern as existing SuiteQL block)
7. Evaluate result:
   - Check `response.items` array (same response structure as existing SuiteQL handler)
   - **Items returned (length > 0):** push skip marker to `returnData`, `continue` to next item in the for-loop
   - **No items:** fall through to existing Create logic (unchanged)
8. **Error handling:** if the SuiteQL query fails, the error bubbles up to the existing try/catch at line 1061, which respects `continueOnFail()`. No special handling needed — a failed duplicate check is treated the same as a failed create.

### Skip Marker Output

```json
{
  "skipped": true,
  "reason": "duplicate",
  "duplicateId": "12345",
  "recordType": "salesOrder",
  "matchedFields": { "otherrefnum": "PO-1234", "entity": "42" }
}
```

- `duplicateId` is extracted from the first row's `id` field in the SuiteQL response (`response.items[0].id`)
- `matchedFields` includes the field/value pairs that triggered the match, for debugging
- `recordType` comes from the existing parameter (the REST API name, not the SuiteQL table)

## Code Changes

All changes are in `nodes/NetSuite/NetSuite.node.ts`. No new files.

### Properties Array (before the `body` property at ~line 406)

Insert the 3 new UI property definitions (toggle, table name, fixedCollection).

### Execute Method (inside `resource === 'record'` block, between ~line 611 and ~line 613)

After reading `recordType`, `recordId`, `body` but **before** building the Create URL:

1. Read `enableDuplicateDetection`, `duplicateCheckTable`, and `duplicateCheckFields` parameters
2. If enabled and operation is `create`:
   - Validate at least one field mapping exists
   - Build SuiteQL query from table name and field mappings
   - Build SuiteQL URL with `?limit=1`
   - Generate OAuth signature for the SuiteQL endpoint (new timestamp/nonce, include `limit` param in signature)
   - Execute POST with `{ q: query }`, include `Prefer: transient` header
   - Parse `response.items` — if non-empty, push skip marker and `continue`
3. Existing Create logic remains untouched

### What Stays the Same

- All existing Create logic (URL building, OAuth signing, POST, Location header parsing)
- All other operations (Get, Update, Patch, Post, Transform)
- SuiteQL and RESTlet resource blocks
- No new files or dependencies
