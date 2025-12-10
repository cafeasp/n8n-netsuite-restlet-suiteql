import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
	NodeConnectionType,
} from 'n8n-workflow';
import * as crypto from 'crypto';

/**
 * Implements the main logic for the NetSuite Custom Node.
 */
export class NetSuite implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'NetSuite RESTlet & SuiteQL',
		name: 'netSuite',
		icon: 'file:netsuite-icon-hex.svg',
		group: ['input'],
		version: 1,
		subtitle: '={{$parameter["resource"]}}: {{$parameter["operation"]}}',
		description: 'Interact with the NetSuite API using OAuth 1.0a - RESTlet and SuiteQL support',
		defaults: {
			name: 'NetSuite',
		},
		inputs: ['main'] as NodeConnectionType[],
		outputs: ['main'] as NodeConnectionType[],
		credentials: [
			{
				name: 'netSuiteOAuth1Api',
				required: true,
			},
		],
		properties: [
			// Resource: Defines what part of the API to interact with.
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'SuiteQL',
						value: 'suiteql',
					},
					{
						name: 'Record',
						value: 'record',
					},
					{
						name: 'RESTlet',
						value: 'restlet',
					},
				],
				default: 'suiteql',
				required: true,
				description: 'The API resource to access',
			},

			// SuiteQL Operations
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['suiteql'],
					},
				},
				options: [
					{
						name: 'Execute Query',
						value: 'executeQuery',
						action: 'Execute a SuiteQL query',
					},
				],
				default: 'executeQuery',
				description: 'The operation to perform',
			},
			{
				displayName: 'Query',
				name: 'query',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						operation: ['executeQuery'],
						resource: ['suiteql'],
					},
				},
				default: 'SELECT * FROM currency',
				description: 'The SuiteQL query to execute',
				typeOptions: {
					rows: 5,
				},
			},
			{
				displayName: 'Return All Pages',
				name: 'returnAll',
				type: 'boolean',
				displayOptions: {
					show: {
						operation: ['executeQuery'],
						resource: ['suiteql'],
					},
				},
				default: false,
				description: 'Whether to automatically fetch all pages of results. When enabled, will follow the "next" link until all data is retrieved.',
			},
			{
				displayName: 'Limit',
				name: 'limit',
				type: 'number',
				displayOptions: {
					show: {
						operation: ['executeQuery'],
						resource: ['suiteql'],
						returnAll: [false],
					},
				},
				default: 1000,
				description: 'Maximum number of results to return per page',
				typeOptions: {
					minValue: 1,
					maxValue: 1000,
				},
			},

			// RESTlet Operations
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['restlet'],
					},
				},
				options: [
					{
						name: 'Call RESTlet',
						value: 'call',
						action: 'Call a RESTlet script',
					},
				],
				default: 'call',
				description: 'The operation to perform',
			},
			{
				displayName: 'Script ID',
				name: 'scriptId',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['restlet'],
					},
				},
				default: '',
				placeholder: 'customscript_my_restlet',
				description: 'The Script ID of the RESTlet',
			},
			{
				displayName: 'Deploy ID',
				name: 'deployId',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['restlet'],
					},
				},
				default: '',
				placeholder: 'customdeploy_my_restlet',
				description: 'The Deploy ID of the RESTlet',
			},
			{
				displayName: 'Body',
				name: 'restletBody',
				type: 'json',
				required: true,
				displayOptions: {
					show: {
						resource: ['restlet'],
					},
				},
				default: '{\n  "id": "search_id",\n  "type": "savesearchdata",\n  "start": 0,\n  "end": 1000\n}',
				description: 'The JSON body for the RESTlet request',
			},
			{
				displayName: 'Return All',
				name: 'returnAll',
				type: 'boolean',
				displayOptions: {
					show: {
						resource: ['restlet'],
					},
				},
				default: false,
				description: 'Whether to automatically paginate through all results',
			},
			{
				displayName: 'Page Size',
				name: 'pageSize',
				type: 'number',
				displayOptions: {
					show: {
						resource: ['restlet'],
						returnAll: [true],
					},
				},
				default: 1000,
				description: 'Number of records to fetch per page',
			},
			{
				displayName: 'Start Index Field',
				name: 'startIndexField',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['restlet'],
						returnAll: [true],
					},
				},
				default: 'start',
				description: 'The field name in the request body for the start index',
			},
			{
				displayName: 'End Index Field',
				name: 'endIndexField',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['restlet'],
						returnAll: [true],
					},
				},
				default: 'end',
				description: 'The field name in the request body for the end index',
			},
			{
				displayName: 'Results Field',
				name: 'resultsField',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['restlet'],
						returnAll: [true],
					},
				},
				default: 'results',
				description: 'The field name in the response that contains the results array',
			},

			// Record Operations
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['record'],
					},
				},
				options: [
					{ name: 'Create', value: 'create', action: 'Create a record' },
					{ name: 'Get', value: 'get', action: 'Get a record by ID' },
					{ name: 'Update (PUT)', value: 'update', action: 'Update a full record by ID' },
					{ name: 'Update (PATCH)', value: 'patch', action: 'Partially update a record by ID' },
					{ name: 'Post Action', value: 'post', action: 'Post an action to a record' },
					{ name: 'Transform', value: 'transform', action: 'Transform a record (e.g. Sales Order to Invoice)' },
				],
				default: 'get',
				description: 'The operation to perform on the record',
			},
			{
				displayName: 'Record Type',
				name: 'recordType',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['record'],
					},
				},
				default: 'salesOrder',
				description: 'The source record type (e.g., salesOrder)',
			},
			{
				displayName: 'Target Record Type',
				name: 'targetRecordType',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['record'],
						operation: ['transform'],
					},
				},
				default: 'invoice',
				description: 'The record type to transform into (e.g., invoice)',
			},
			{
				displayName: 'Record ID',
				name: 'recordId',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['record'],
						operation: ['get', 'update', 'patch', 'post', 'transform'],
					},
				},
				default: '',
				description: 'The internal ID of the record',
			},
			{
				displayName: 'Body',
				name: 'body',
				type: 'json',
				displayOptions: {
					show: {
						resource: ['record'],
						operation: ['create', 'update', 'patch', 'post', 'transform'],
					},
				},
				default: '{}',
				description: 'The JSON body for the request. For transform, use this to override fields on the new record.',
			},
		],
	};

	/**
	 * Executes the node's logic.
	 * @param this The context for the execution.
	 * @returns The result of the execution.
	 */
	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const resource = this.getNodeParameter('resource', 0) as string;

		// Get credentials
		const credentials = await this.getCredentials('netSuiteOAuth1Api');
		const {
			accountId,
			companyUrl,
			restletCompanyUrl,
			consumerKey,
			consumerSecret,
			tokenKey,
			tokenSecret,
		} = credentials;

		for (let i = 0; i < items.length; i++) {
			try {
				const operation = this.getNodeParameter('operation', i) as string;
				let requestData: { url: string; method: string; body?: object };

				// --- Configure Request based on Resource and Operation ---
				if (resource === 'suiteql') {
					const query = this.getNodeParameter('query', i) as string;
					const returnAll = this.getNodeParameter('returnAll', i, false) as boolean;
					const limit = this.getNodeParameter('limit', i, 1000) as number;

					// Build initial URL
					const baseUrl = `https://${companyUrl}/services/rest/query/v1/suiteql`;
					let queryUrl = baseUrl;
					if (!returnAll) {
						queryUrl += `?limit=${limit}`;
					}

					requestData = {
						url: queryUrl,
						method: 'POST',
						body: { q: query },
					};

					// --- OAuth 1.0a Header Generation for initial request ---
					let timestamp = Math.floor(Date.now() / 1000).toString();
					let nonce = crypto.randomBytes(16).toString('hex');

					let oauthParams: Record<string, string> = {
						oauth_consumer_key: consumerKey as string,
						oauth_token: tokenKey as string,
						oauth_signature_method: 'HMAC-SHA256',
						oauth_timestamp: timestamp,
						oauth_nonce: nonce,
						oauth_version: '1.0',
					};

					// Include URL query parameters in signature if present
					const allParams: Record<string, string> = { ...oauthParams };
					if (!returnAll) {
						allParams['limit'] = limit.toString();
					}

					let sortedParams = Object.keys(allParams)
						.sort()
						.map(key => `${encodeURIComponent(key)}=${encodeURIComponent(allParams[key])}`)
						.join('&');

					let baseString = `${requestData.method}&${encodeURIComponent(baseUrl)}&${encodeURIComponent(sortedParams)}`;
					let signingKey = `${encodeURIComponent(consumerSecret as string)}&${encodeURIComponent(tokenSecret as string)}`;

					let signature = crypto
						.createHmac('sha256', signingKey)
						.update(baseString)
						.digest('base64');

					let authHeader = `OAuth realm="${accountId}",` +
						`oauth_consumer_key="${oauthParams.oauth_consumer_key}",` +
						`oauth_token="${oauthParams.oauth_token}",` +
						`oauth_signature_method="${oauthParams.oauth_signature_method}",` +
						`oauth_timestamp="${oauthParams.oauth_timestamp}",` +
						`oauth_nonce="${oauthParams.oauth_nonce}",` +
						`oauth_version="${oauthParams.oauth_version}",` +
						`oauth_signature="${encodeURIComponent(signature)}"`;

					// --- API Request ---
					const options = {
						headers: {
							'Authorization': authHeader,
							'Content-Type': 'application/json',
							'Prefer': 'transient',
						},
						method: requestData.method as 'POST' | 'GET' | 'PUT' | 'PATCH',
						body: requestData.body,
						url: requestData.url,
						json: true,
					};

					let response: any = await this.helpers.request(options);
					let allItems = response.items || [];

					// Handle pagination if returnAll is true
					if (returnAll && response.hasMore) {
						while (response.hasMore && response.links) {
							const nextLink = response.links.find((link: any) => link.rel === 'next');
							if (!nextLink) break;

							const nextUrl = nextLink.href;

							// Parse URL to separate base URL and query parameters
							const urlObj = new URL(nextUrl);
							const baseUrl = `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`;
							
							// Generate new OAuth signature for pagination request
							timestamp = Math.floor(Date.now() / 1000).toString();
							nonce = crypto.randomBytes(16).toString('hex');

							oauthParams = {
								oauth_consumer_key: consumerKey as string,
								oauth_token: tokenKey as string,
								oauth_signature_method: 'HMAC-SHA256',
								oauth_timestamp: timestamp,
								oauth_nonce: nonce,
								oauth_version: '1.0',
							};

							// Combine OAuth params with URL query params for signature
							const allParams: Record<string, string> = { ...oauthParams };
							urlObj.searchParams.forEach((value, key) => {
								allParams[key] = value;
							});

							sortedParams = Object.keys(allParams)
								.sort()
								.map(key => `${encodeURIComponent(key)}=${encodeURIComponent(allParams[key])}`)
								.join('&');

							baseString = `POST&${encodeURIComponent(baseUrl)}&${encodeURIComponent(sortedParams)}`;
							signingKey = `${encodeURIComponent(consumerSecret as string)}&${encodeURIComponent(tokenSecret as string)}`;

							signature = crypto
								.createHmac('sha256', signingKey)
								.update(baseString)
								.digest('base64');

							authHeader = `OAuth realm="${accountId}",` +
								`oauth_consumer_key="${oauthParams.oauth_consumer_key}",` +
								`oauth_token="${oauthParams.oauth_token}",` +
								`oauth_signature_method="${oauthParams.oauth_signature_method}",` +
								`oauth_timestamp="${oauthParams.oauth_timestamp}",` +
								`oauth_nonce="${oauthParams.oauth_nonce}",` +
								`oauth_version="${oauthParams.oauth_version}",` +
								`oauth_signature="${encodeURIComponent(signature)}"`;

							const nextOptions = {
								headers: {
									'Authorization': authHeader,
									'Content-Type': 'application/json',
									'Prefer': 'transient',
								},
								method: 'POST' as 'POST',
								body: requestData.body,
								url: nextUrl,
								json: true,
							};

							response = await this.helpers.request(nextOptions);
							if (response.items) {
								allItems = allItems.concat(response.items);
							}
						}
					}

					// Return combined response
					returnData.push({
						json: {
							...response,
							items: allItems,
							count: allItems.length,
							hasMore: false, // Set to false since we've fetched all
						},
						pairedItem: { item: i },
					});

				} else if (resource === 'record') {
					const recordType = this.getNodeParameter('recordType', i) as string;
					const recordId = this.getNodeParameter('recordId', i, '') as string;
					const body = this.getNodeParameter('body', i, {}) as object;

					let url = `https://${companyUrl}/services/rest/record/v1/${recordType}`;

					// Append ID for operations that target a specific record
					if (['get', 'update', 'patch', 'post', 'transform'].includes(operation) && recordId) {
						url += `/${recordId}`;
					}

					// Specific logic for Transform
					if (operation === 'transform') {
						const targetRecordType = this.getNodeParameter('targetRecordType', i) as string;
						url += `/!transform/${targetRecordType}`;
					}

					const methodMap: { [key: string]: string } = {
						get: 'GET',
						create: 'POST',
						update: 'PUT',
						patch: 'PATCH',
						post: 'POST',
						transform: 'POST',
					};

					requestData = {
						url,
						method: methodMap[operation],
						body: ['get'].includes(operation) ? undefined : body,
					};

					if (!recordId && ['get', 'update', 'patch', 'post', 'transform'].includes(operation)) {
						throw new NodeOperationError(this.getNode(), 'Record ID is required for this operation.');
					}

					// --- OAuth 1.0a Header Generation ---
					const timestamp = Math.floor(Date.now() / 1000).toString();
					const nonce = crypto.randomBytes(16).toString('hex');

					const oauthParams = {
						oauth_consumer_key: consumerKey as string,
						oauth_token: tokenKey as string,
						oauth_signature_method: 'HMAC-SHA256',
						oauth_timestamp: timestamp,
						oauth_nonce: nonce,
						oauth_version: '1.0',
					};

					const sortedParams = Object.keys(oauthParams)
						.sort()
						.map(key => `${encodeURIComponent(key)}=${encodeURIComponent(oauthParams[key as keyof typeof oauthParams])}`)
						.join('&');

					const baseString = `${requestData.method}&${encodeURIComponent(requestData.url)}&${encodeURIComponent(sortedParams)}`;
					const signingKey = `${encodeURIComponent(consumerSecret as string)}&${encodeURIComponent(tokenSecret as string)}`;

					const signature = crypto
						.createHmac('sha256', signingKey)
						.update(baseString)
						.digest('base64');

					const authHeader = `OAuth realm="${accountId}",` +
						`oauth_consumer_key="${oauthParams.oauth_consumer_key}",` +
						`oauth_token="${oauthParams.oauth_token}",` +
						`oauth_signature_method="${oauthParams.oauth_signature_method}",` +
						`oauth_timestamp="${oauthParams.oauth_timestamp}",` +
						`oauth_nonce="${oauthParams.oauth_nonce}",` +
						`oauth_version="${oauthParams.oauth_version}",` +
						`oauth_signature="${encodeURIComponent(signature)}"`;

					// --- API Request ---
					const options = {
						headers: {
							'Authorization': authHeader,
							'Content-Type': 'application/json',
							'Prefer': 'transient',
						},
						method: requestData.method as 'POST' | 'GET' | 'PUT' | 'PATCH',
						body: requestData.body,
						url: requestData.url,
						json: true,
					};

					const response = await this.helpers.request(options);
					returnData.push({ json: response, pairedItem: { item: i } });

				} else if (resource === 'restlet') {
					const scriptId = this.getNodeParameter('scriptId', i) as string;
					const deployId = this.getNodeParameter('deployId', i) as string;
					const restletBody = this.getNodeParameter('restletBody', i) as string;
					const returnAll = this.getNodeParameter('returnAll', i, false) as boolean;

					// Parse the JSON body
					let parsedBody: any;
					try {
						parsedBody = typeof restletBody === 'string' ? JSON.parse(restletBody) : restletBody;
					} catch (parseError) {
						throw new NodeOperationError(this.getNode(), `Invalid JSON in RESTlet body: ${parseError}`);
					}

					// Use RESTlet Company URL if provided, otherwise fall back to regular Company URL
					const restletBaseUrl = restletCompanyUrl || companyUrl;
					
					// Build RESTlet URL with script and deploy parameters
					const restletUrl = `https://${restletBaseUrl}/app/site/hosting/restlet.nl?script=${scriptId}&deploy=${deployId}`;

					if (returnAll) {
						// Pagination logic
						const pageSize = this.getNodeParameter('pageSize', i, 1000) as number;
						const startIndexField = this.getNodeParameter('startIndexField', i, 'start') as string;
						const endIndexField = this.getNodeParameter('endIndexField', i, 'end') as string;
						const resultsField = this.getNodeParameter('resultsField', i, 'results') as string;

						let allResults: any[] = [];
						let currentStart = parsedBody[startIndexField] || 0; // Use initial value from body if provided
						let hasMore = true;

						while (hasMore) {
							// Update pagination fields in the body
							const paginatedBody = {
								...parsedBody,
								[startIndexField]: currentStart,
								[endIndexField]: currentStart + pageSize,
							};

							// Generate OAuth for this request
							const timestamp = Math.floor(Date.now() / 1000).toString();
							const nonce = crypto.randomBytes(16).toString('hex');

							const oauthParams: Record<string, string> = {
								oauth_consumer_key: consumerKey as string,
								oauth_token: tokenKey as string,
								oauth_signature_method: 'HMAC-SHA256',
								oauth_timestamp: timestamp,
								oauth_nonce: nonce,
								oauth_version: '1.0',
							};

							const allParams: Record<string, string> = { 
								...oauthParams,
								script: scriptId,
								deploy: deployId,
							};

							const sortedParams = Object.keys(allParams)
								.sort()
								.map(key => `${encodeURIComponent(key)}=${encodeURIComponent(allParams[key])}`)
								.join('&');

							const baseUrl = `https://${restletBaseUrl}/app/site/hosting/restlet.nl`;
							const baseString = `POST&${encodeURIComponent(baseUrl)}&${encodeURIComponent(sortedParams)}`;
							const signingKey = `${encodeURIComponent(consumerSecret as string)}&${encodeURIComponent(tokenSecret as string)}`;

							const signature = crypto
								.createHmac('sha256', signingKey)
								.update(baseString)
								.digest('base64');

							const authHeader = `OAuth realm="${accountId}",` +
								`oauth_consumer_key="${oauthParams.oauth_consumer_key}",` +
								`oauth_token="${oauthParams.oauth_token}",` +
								`oauth_signature_method="${oauthParams.oauth_signature_method}",` +
								`oauth_timestamp="${oauthParams.oauth_timestamp}",` +
								`oauth_nonce="${oauthParams.oauth_nonce}",` +
								`oauth_version="${oauthParams.oauth_version}",` +
								`oauth_signature="${encodeURIComponent(signature)}"`;

							const options = {
								headers: {
									'Authorization': authHeader,
									'Content-Type': 'application/json',
								},
								method: 'POST' as const,
								body: paginatedBody,
								url: restletUrl,
								json: true,
							};

							const response = await this.helpers.request(options);

							// Check if response has the results field
							if (resultsField in response) {
								const results = response[resultsField];
								
								if (Array.isArray(results) && results.length > 0) {
									allResults = allResults.concat(results);
									currentStart += pageSize;
									
									// Check if we got fewer results than requested (last page)
									if (results.length < pageSize) {
										hasMore = false;
									}
								} else {
									// Empty results array means no more data
									hasMore = false;
								}
							} else {
								// If results field doesn't exist, return the whole response
								// and stop pagination
								returnData.push({ json: response, pairedItem: { item: i } });
								hasMore = false;
								break;
							}
						}

						// Only push aggregated results if we actually collected them
						if (allResults.length > 0 || resultsField in (allResults as any)) {
							returnData.push({ json: { [resultsField]: allResults, total: allResults.length }, pairedItem: { item: i } });
						}

					} else {
						// Single request without pagination
						requestData = {
							url: restletUrl,
							method: 'POST',
							body: parsedBody,
						};

						// --- OAuth 1.0a Header Generation for RESTlet ---
						const timestamp = Math.floor(Date.now() / 1000).toString();
						const nonce = crypto.randomBytes(16).toString('hex');

						const oauthParams: Record<string, string> = {
							oauth_consumer_key: consumerKey as string,
							oauth_token: tokenKey as string,
							oauth_signature_method: 'HMAC-SHA256',
							oauth_timestamp: timestamp,
							oauth_nonce: nonce,
							oauth_version: '1.0',
						};

						// Include URL query parameters in signature
						const allParams: Record<string, string> = { 
							...oauthParams,
							script: scriptId,
							deploy: deployId,
						};

						const sortedParams = Object.keys(allParams)
							.sort()
							.map(key => `${encodeURIComponent(key)}=${encodeURIComponent(allParams[key])}`)
							.join('&');

						const baseUrl = `https://${restletBaseUrl}/app/site/hosting/restlet.nl`;
						const baseString = `${requestData.method}&${encodeURIComponent(baseUrl)}&${encodeURIComponent(sortedParams)}`;
						const signingKey = `${encodeURIComponent(consumerSecret as string)}&${encodeURIComponent(tokenSecret as string)}`;

						const signature = crypto
							.createHmac('sha256', signingKey)
							.update(baseString)
							.digest('base64');

						const authHeader = `OAuth realm="${accountId}",` +
							`oauth_consumer_key="${oauthParams.oauth_consumer_key}",` +
							`oauth_token="${oauthParams.oauth_token}",` +
							`oauth_signature_method="${oauthParams.oauth_signature_method}",` +
							`oauth_timestamp="${oauthParams.oauth_timestamp}",` +
							`oauth_nonce="${oauthParams.oauth_nonce}",` +
							`oauth_version="${oauthParams.oauth_version}",` +
							`oauth_signature="${encodeURIComponent(signature)}"`;

						// --- API Request ---
						const options = {
							headers: {
								'Authorization': authHeader,
								'Content-Type': 'application/json',
							},
							method: requestData.method as 'POST',
							body: requestData.body,
							url: requestData.url,
							json: true,
						};

						const response = await this.helpers.request(options);
						returnData.push({ json: response, pairedItem: { item: i } });
					}

				} else {
					throw new NodeOperationError(this.getNode(), `The resource "${resource}" is not supported.`);
				}

			} catch (error) {
				if (this.continueOnFail()) {
					if (error instanceof Error) {
						returnData.push({ json: { error: error.message }, pairedItem: { item: i } });
					} else {
						returnData.push({ json: { error: JSON.stringify(error) }, pairedItem: { item: i } });
					}
					continue;
				}
				if (error instanceof Error) {
					throw new NodeOperationError(this.getNode(), error);
				}
				throw new NodeOperationError(this.getNode(), new Error(String(error)));
			}
		}

		return [this.helpers.returnJsonArray(returnData)];
	}
}
