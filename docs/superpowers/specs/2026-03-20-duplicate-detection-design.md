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

### 2. Duplicate Check Fields (fixedCollection)

- **Name:** `duplicateCheckFields`
- **Display name:** "Duplicate Check Fields"
- **Type:** `fixedCollection`
- **typeOptions:** `{ multipleValues: true }`
- **displayOptions.show:** `{ resource: ['record'], operation: ['create'], enableDuplicateDetection: [true] }`
- **Sub-fields (in a group called `fieldValues`):**
  - **NetSuite Field** (`netsuiteField`): string, placeholder `otherrefnum`, description "The internal field name in NetSuite to check"
  - **Match Value** (`matchValue`): string, supports expressions, placeholder `={{ $json.poNumber }}`, description "The value to match against"

## Duplicate Check Logic

Located inside the `resource === 'record'` block, **before** the Create POST request.

### Flow

1. Read `enableDuplicateDetection` parameter (default `false`)
2. If disabled, skip to existing Create logic (no change)
3. If enabled, read `duplicateCheckFields.fieldValues` array
4. Build SuiteQL query:
   ```sql
   SELECT id FROM {recordType} WHERE field1 = 'value1' AND field2 = 'value2'
   ```
   - `recordType` comes from the existing parameter
   - Values are escaped (single quotes doubled) to prevent SuiteQL injection
   - All conditions joined with `AND`
5. Execute SuiteQL query against `https://{companyUrl}/services/rest/query/v1/suiteql`
   - Generate new OAuth timestamp/nonce for this request
   - Use the same signing pattern already in the node
6. Evaluate result:
   - **Rows returned:** push skip marker to `returnData`, `continue` to next item
   - **No rows:** fall through to existing Create logic (unchanged)

### Skip Marker Output

```json
{
  "skipped": true,
  "reason": "duplicate",
  "duplicateId": "12345",
  "recordType": "salesOrder"
}
```

- `duplicateId` is extracted from the first row's `id` field in the SuiteQL response

## Code Changes

All changes are in `nodes/NetSuite/NetSuite.node.ts`. No new files.

### Properties Array (~line 406, before the `body` property)

Insert the 3 new UI property definitions.

### Execute Method (inside `resource === 'record'` block, ~line 608-640)

After reading `recordType`, `recordId`, `body` but **before** building the Create URL:

1. Read `enableDuplicateDetection` and `duplicateCheckFields` parameters
2. If enabled and operation is `create`:
   - Build SuiteQL query from field mappings
   - Generate OAuth signature for SuiteQL endpoint
   - Execute query
   - If duplicate found: push skip marker, `continue`
3. Existing Create logic remains untouched

### What Stays the Same

- All existing Create logic (URL building, OAuth signing, POST, Location header parsing)
- All other operations (Get, Update, Patch, Post, Transform)
- SuiteQL and RESTlet resource blocks
- No new files or dependencies
