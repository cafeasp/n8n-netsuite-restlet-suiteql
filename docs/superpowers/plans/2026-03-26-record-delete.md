# Record Delete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Delete operation to the Record resource so users can delete NetSuite records by record type and internal ID.

**Architecture:** Extends the existing Record resource with a new `delete` operation. Uses the same REST API pattern as other record operations (`DELETE /record/v1/{recordType}/{recordId}`) with identical OAuth 1.0a signing. Returns a node-constructed confirmation object since NetSuite returns 204 No Content.

**Tech Stack:** TypeScript, n8n-workflow SDK, NetSuite REST API

---

### Task 1: Add Delete to the Record operations dropdown

**Files:**
- Modify: `nodes/NetSuite/NetSuite.node.ts:355-362`

- [ ] **Step 1: Add the delete option to the Record operations array**

In `nodes/NetSuite/NetSuite.node.ts`, find the Record operations options array (line ~355) and append the delete option after the transform entry:

```typescript
// Before (line 361):
					{ name: 'Transform', value: 'transform', action: 'Transform a record (e.g. Sales Order to Invoice)' },

// After:
					{ name: 'Transform', value: 'transform', action: 'Transform a record (e.g. Sales Order to Invoice)' },
					{ name: 'Delete', value: 'delete', action: 'Delete a record by internal ID' },
```

- [ ] **Step 2: Add `'delete'` to the Record ID displayOptions**

The existing Record ID field (line ~395-405) only shows for `['get', 'update', 'patch', 'post', 'transform']`. Add `'delete'` to this list:

```typescript
// Before (line 400):
						operation: ['get', 'update', 'patch', 'post', 'transform'],

// After:
						operation: ['get', 'update', 'patch', 'post', 'transform', 'delete'],
```

- [ ] **Step 3: Commit**

```bash
git add nodes/NetSuite/NetSuite.node.ts
git commit -m "feat: add Delete operation to Record resource dropdown"
```

### Task 2: Add Delete execution logic

**Files:**
- Modify: `nodes/NetSuite/NetSuite.node.ts:819,829-842,844,894,903-920`

- [ ] **Step 1: Add `'delete'` to the URL ID-append list**

Find the line that appends the record ID to the URL (line ~819):

```typescript
// Before:
					if (['get', 'update', 'patch', 'post', 'transform'].includes(operation) && recordId) {

// After:
					if (['get', 'update', 'patch', 'post', 'transform', 'delete'].includes(operation) && recordId) {
```

- [ ] **Step 2: Add `delete` to the method map**

Find the `methodMap` object (line ~829):

```typescript
// Before:
					const methodMap: { [key: string]: string } = {
						get: 'GET',
						create: 'POST',
						update: 'PUT',
						patch: 'PATCH',
						post: 'POST',
						transform: 'POST',
					};

// After:
					const methodMap: { [key: string]: string } = {
						get: 'GET',
						create: 'POST',
						update: 'PUT',
						patch: 'PATCH',
						post: 'POST',
						transform: 'POST',
						delete: 'DELETE',
					};
```

- [ ] **Step 3: Exclude delete from sending a body**

Find the `requestData` assignment (line ~838-842):

```typescript
// Before:
					requestData = {
						url,
						method: methodMap[operation],
						body: ['get'].includes(operation) ? undefined : body,
					};

// After:
					requestData = {
						url,
						method: methodMap[operation],
						body: ['get', 'delete'].includes(operation) ? undefined : body,
					};
```

- [ ] **Step 4: Add `'delete'` to the Record ID required check**

Find the Record ID validation (line ~844):

```typescript
// Before:
					if (!recordId && ['get', 'update', 'patch', 'post', 'transform'].includes(operation)) {

// After:
					if (!recordId && ['get', 'update', 'patch', 'post', 'transform', 'delete'].includes(operation)) {
```

- [ ] **Step 5: Add `'DELETE'` to the request method type union**

Find the `options` object method type (line ~894):

```typescript
// Before:
						method: requestData.method as 'POST' | 'GET' | 'PUT' | 'PATCH',

// After:
						method: requestData.method as 'POST' | 'GET' | 'PUT' | 'PATCH' | 'DELETE',
```

- [ ] **Step 6: Handle delete response with confirmation object**

Find the response handling block (line ~903-920). Add a delete-specific handler before the existing create handler:

```typescript
					// Handle response - NetSuite often returns 204 with Location header for Create operations
					let responseData: any = response.body || {};

					// If Delete operation, return confirmation object (NetSuite returns 204 No Content)
					if (operation === 'delete') {
						responseData = {
							deleted: true,
							recordType,
							recordId,
						};
					}

					// If Create operation and we got a Location header, extract the ID
					if (operation === 'create' && response.headers && response.headers.location) {
```

- [ ] **Step 7: Commit**

```bash
git add nodes/NetSuite/NetSuite.node.ts
git commit -m "feat: implement Record > Delete execution logic"
```

### Task 3: Update README documentation

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add Delete to the Record operations section in README**

Find the Record operations section in `README.md` and add a Delete subsection after the existing operations. Follow the same formatting pattern as the other operations:

```markdown
### Record > Delete

Delete a record by internal ID.

| Parameter   | Description                                    |
|------------|------------------------------------------------|
| Record Type | The record type (e.g., `salesOrder`, `customer`) |
| Record ID   | The internal ID of the record to delete         |

**Output:**
```json
{
  "deleted": true,
  "recordType": "salesOrder",
  "recordId": "12345"
}
```
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add Record > Delete to README"
```

### Task 4: Build and verify

**Files:**
- No new files

- [ ] **Step 1: Run the TypeScript build**

```bash
npm run build
```

Expected: Build completes with no errors.

- [ ] **Step 2: Verify the compiled output includes delete**

```bash
grep -n "'delete'" dist/nodes/NetSuite/NetSuite.node.js | head -5
```

Expected: Multiple matches showing the delete operation in the compiled JavaScript.

- [ ] **Step 3: Commit build (if dist is tracked)**

If `dist/` is not gitignored, commit the build output:

```bash
git add dist/
git commit -m "chore: build dist for Record > Delete"
```

If `dist/` is gitignored (which it is per project memory), skip this step.
