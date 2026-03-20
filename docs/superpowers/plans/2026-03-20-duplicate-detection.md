# Duplicate Detection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add optional duplicate detection to the Record > Create operation so duplicate records (e.g., sales orders) are skipped with a marker output.

**Architecture:** Before each Create POST, an optional SuiteQL query checks if a matching record exists. If found, the item is skipped and a `{ skipped: true, duplicateId }` marker is output. All changes are in a single file.

**Tech Stack:** TypeScript, n8n node SDK, NetSuite SuiteQL REST API, OAuth 1.0a

**Spec:** `docs/superpowers/specs/2026-03-20-duplicate-detection-design.md`

---

### Task 1: Add UI properties for duplicate detection

**Files:**
- Modify: `nodes/NetSuite/NetSuite.node.ts` (insert before the `body` property in the `properties` array)

- [ ] **Step 1: Add the three new properties**

Find the `body` property definition — it starts with `{ displayName: 'Body', name: 'body', type: 'json',`. Insert the following properties immediately **before** it:

```typescript
			// Duplicate Detection (Record > Create only)
			{
				displayName: 'Duplicate Detection',
				name: 'enableDuplicateDetection',
				type: 'boolean',
				displayOptions: {
					show: {
						resource: ['record'],
						operation: ['create'],
					},
				},
				default: false,
				description: 'Whether to check for existing duplicates before creating a record. Uses a SuiteQL query to look up matching field values.',
			},
			{
				displayName: 'SuiteQL Table Name',
				name: 'duplicateCheckTable',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['record'],
						operation: ['create'],
						enableDuplicateDetection: [true],
					},
				},
				default: '',
				placeholder: 'transaction',
				description: 'The SuiteQL table name to query for duplicates. Note: this may differ from the REST API record type (e.g., use "transaction" for salesOrder, "entity" for customer).',
			},
			{
				displayName: 'Duplicate Check Fields',
				name: 'duplicateCheckFields',
				type: 'fixedCollection',
				typeOptions: {
					multipleValues: true,
				},
				displayOptions: {
					show: {
						resource: ['record'],
						operation: ['create'],
						enableDuplicateDetection: [true],
					},
				},
				default: {},
				description: 'Fields to match against for duplicate detection. All conditions are combined with AND logic.',
				options: [
					{
						name: 'fieldValues',
						displayName: 'Field',
						values: [
							{
								displayName: 'NetSuite Field',
								name: 'netsuiteField',
								type: 'string',
								default: '',
								placeholder: 'otherrefnum',
								description: 'The internal field name in NetSuite to check against',
							},
							{
								displayName: 'Match Value',
								name: 'matchValue',
								type: 'string',
								default: '',
								placeholder: '={{ $json.poNumber }}',
								description: 'The value to match against',
							},
						],
					},
				],
			},
```

- [ ] **Step 2: Verify the build compiles**

Run: `cd /Users/admin/Documents/GitHub/n8n-netsuite-restlet-suiteql && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add nodes/NetSuite/NetSuite.node.ts
git commit -m "feat: add duplicate detection UI properties for Record > Create"
```

---

### Task 2: Add duplicate check logic in the execute method

**Files:**
- Modify: `nodes/NetSuite/NetSuite.node.ts` (insert inside the `resource === 'record'` block)

- [ ] **Step 1: Add duplicate check logic**

Find the line `const body = this.getNodeParameter('body', i, {}) as object;` inside the `} else if (resource === 'record') {` block. Insert the following code block immediately **after** that line and **before** the line `let url = ...`:

```typescript
					// --- Duplicate Detection (Create only) ---
					if (operation === 'create') {
						const enableDuplicateDetection = this.getNodeParameter('enableDuplicateDetection', i, false) as boolean;

						if (enableDuplicateDetection) {
							const duplicateCheckTable = this.getNodeParameter('duplicateCheckTable', i) as string;
							const duplicateCheckFields = this.getNodeParameter('duplicateCheckFields', i, {}) as {
								fieldValues?: Array<{ netsuiteField: string; matchValue: string }>;
							};

							const fieldValues = duplicateCheckFields.fieldValues || [];

							if (fieldValues.length === 0) {
								throw new NodeOperationError(
									this.getNode(),
									'At least one duplicate check field is required when duplicate detection is enabled.',
								);
							}

							// Validate table name (alphanumeric and underscores only)
							if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(duplicateCheckTable)) {
								throw new NodeOperationError(
									this.getNode(),
									`Invalid SuiteQL table name: "${duplicateCheckTable}". Use only letters, numbers, and underscores.`,
								);
							}

							// Build WHERE conditions with proper escaping
							const conditions = fieldValues.map((field) => {
								const col = field.netsuiteField;
								const val = field.matchValue;

								// Validate column name (alphanumeric, underscores, dots for joined fields)
								if (!/^[a-zA-Z_][a-zA-Z0-9_.]*$/.test(col)) {
									throw new NodeOperationError(
										this.getNode(),
										`Invalid field name: "${col}". Use only letters, numbers, underscores, and dots.`,
									);
								}

								// Strict numeric check: only plain integers and decimals
								if (/^-?\d+(\.\d+)?$/.test(val)) {
									return `${col} = ${val}`;
								}
								const escaped = val.replace(/'/g, "''");
								return `${col} = '${escaped}'`;
							});

							const query = `SELECT id FROM ${duplicateCheckTable} WHERE ${conditions.join(' AND ')} FETCH FIRST 1 ROWS ONLY`;

							// Execute SuiteQL duplicate check
							const dupCheckBaseUrl = `https://${companyUrl}/services/rest/query/v1/suiteql`;
							const dupCheckUrl = `${dupCheckBaseUrl}?limit=1`;

							const dupTimestamp = Math.floor(Date.now() / 1000).toString();
							const dupNonce = crypto.randomBytes(16).toString('hex');

							const dupOauthParams: Record<string, string> = {
								oauth_consumer_key: consumerKey as string,
								oauth_token: tokenKey as string,
								oauth_signature_method: 'HMAC-SHA256',
								oauth_timestamp: dupTimestamp,
								oauth_nonce: dupNonce,
								oauth_version: '1.0',
							};

							// Include limit in signature params (same pattern as existing SuiteQL block)
							const dupAllParams: Record<string, string> = {
								...dupOauthParams,
								limit: '1',
							};

							const dupSortedParams = Object.keys(dupAllParams)
								.sort()
								.map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(dupAllParams[key])}`)
								.join('&');

							const dupBaseString = `POST&${encodeURIComponent(dupCheckBaseUrl)}&${encodeURIComponent(dupSortedParams)}`;
							const dupSigningKey = `${encodeURIComponent(consumerSecret as string)}&${encodeURIComponent(tokenSecret as string)}`;

							const dupSignature = crypto
								.createHmac('sha256', dupSigningKey)
								.update(dupBaseString)
								.digest('base64');

							const dupAuthHeader =
								`OAuth realm="${accountId}",` +
								`oauth_consumer_key="${dupOauthParams.oauth_consumer_key}",` +
								`oauth_token="${dupOauthParams.oauth_token}",` +
								`oauth_signature_method="${dupOauthParams.oauth_signature_method}",` +
								`oauth_timestamp="${dupOauthParams.oauth_timestamp}",` +
								`oauth_nonce="${dupOauthParams.oauth_nonce}",` +
								`oauth_version="${dupOauthParams.oauth_version}",` +
								`oauth_signature="${encodeURIComponent(dupSignature)}"`;

							const dupOptions = {
								headers: {
									'Authorization': dupAuthHeader,
									'Content-Type': 'application/json',
									'Prefer': 'transient',
								},
								method: 'POST' as const,
								body: { q: query },
								url: dupCheckUrl,
								json: true,
							};

							const dupResponse: any = await this.helpers.request(dupOptions);
							const dupItems = dupResponse.items || [];

							if (dupItems.length > 0) {
								// Duplicate found — skip creation, output marker
								const matchedFields: Record<string, string> = {};
								for (const field of fieldValues) {
									matchedFields[field.netsuiteField] = field.matchValue;
								}

								returnData.push({
									json: {
										skipped: true,
										reason: 'duplicate',
										duplicateId: String(dupItems[0].id),
										recordType,
										matchedFields,
									},
									pairedItem: { item: i },
								});
								continue;
							}
						}
					}
```

- [ ] **Step 2: Verify the build compiles**

Run: `cd /Users/admin/Documents/GitHub/n8n-netsuite-restlet-suiteql && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add nodes/NetSuite/NetSuite.node.ts
git commit -m "feat: add duplicate detection SuiteQL check before Record Create"
```

---

### Task 3: Build and verify

**Files:**
- None (build verification only)

- [ ] **Step 1: Run full build**

Run: `cd /Users/admin/Documents/GitHub/n8n-netsuite-restlet-suiteql && npm run build`
Expected: Build succeeds, `dist/` output generated with no errors

- [ ] **Step 2: Verify the compiled output contains the new properties**

Run: `grep -c 'enableDuplicateDetection' dist/nodes/NetSuite/NetSuite.node.js`
Expected: At least 2 matches (property definition + parameter read)

Run: `grep -c 'duplicateCheckTable' dist/nodes/NetSuite/NetSuite.node.js`
Expected: At least 2 matches

Run: `grep -c 'duplicateCheckFields' dist/nodes/NetSuite/NetSuite.node.js`
Expected: At least 2 matches

- [ ] **Step 3: Commit build output**

```bash
git add dist/
git commit -m "build: compile duplicate detection feature"
```

---

### Task 4: Version bump

**Files:**
- Modify: `package.json` (version field)

- [ ] **Step 1: Bump patch version**

In `package.json`, change:
```json
"version": "1.0.12"
```
to:
```json
"version": "1.0.13"
```

- [ ] **Step 2: Commit**

```bash
git add package.json
git commit -m "1.0.13"
```
