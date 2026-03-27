# Record Delete by Internal ID — Design Spec

**Date:** 2026-03-26
**Status:** Approved

## Summary

Add a "Delete" operation to the Record resource in the n8n NetSuite node. This allows users to delete a NetSuite record by specifying its record type and internal ID, using the NetSuite REST API's native DELETE endpoint.

## Motivation

The node currently supports Create, Get, Update (PUT), Update (PATCH), Post Action, and Transform for records. Delete is the missing CRUD operation. Users currently have no way to delete records without building a custom RESTlet or using a separate tool.

## Design

### UI Properties

Two fields, displayed when `resource: 'record'` and `operation: 'delete'`:

| Field | Name | Type | Required | Description |
|-------|------|------|----------|-------------|
| Record Type | `recordType` | string | Yes | The NetSuite record type (e.g., `salesOrder`, `customer`, `invoice`) |
| Internal ID | `recordId` | string | Yes | The NetSuite internal ID of the record to delete |

These match the existing Record > Get fields exactly.

### Operation Dropdown

- **Label:** `Delete`
- **Value:** `delete`
- **Action:** `Delete a record by internal ID`
- **Position:** Appended at the end of the Record operations list (after Transform)

### API Call

```
DELETE https://{companyUrl}/services/rest/record/v1/{recordType}/{recordId}
```

- OAuth 1.0a signed using the existing HMAC-SHA256 signature process
- Same signing logic as GET — method changes to `DELETE`, no request body
- No query parameters required

### Output

On successful deletion, the node outputs a confirmation object:

```json
{
  "deleted": true,
  "recordType": "salesOrder",
  "recordId": "12345"
}
```

This is constructed by the node (not returned by NetSuite) since DELETE typically returns 204 No Content.

### Error Handling

- Uses the existing `continueOnFail()` pattern already in the node's execute method
- Common error scenarios: record not found (404), insufficient permissions (403), record in use / cannot be deleted (422)
- No special error handling beyond the existing try/catch

### Scope

- Single record deletion only (one ID per execution)
- No dry-run or confirmation toggle
- No batch delete support — users handle batches via n8n's built-in looping

## Files Changed

1. **`nodes/NetSuite/NetSuite.node.ts`** — Add delete operation to dropdown, add display properties, add execution logic

## Out of Scope

- Batch/bulk delete
- Dry-run / preview mode
- Custom RESTlet-based deletion
- Cascade delete options (NetSuite handles cascading per its own configuration)
