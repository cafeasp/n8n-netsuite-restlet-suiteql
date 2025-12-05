import {
	Icon,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

/**
 * Represents the credential type for the NetSuite OAuth1 API.
 * This class defines the structure and properties of the credentials
 * required to authenticate with the NetSuite API using OAuth 1.0a.
 */
export class NetSuiteOAuth1Api implements ICredentialType {
	// A unique name for the credential type
	name = 'netSuiteOAuth1Api';

	// The display name shown in the n8n UI
	displayName = 'NetSuite OAuth1 API';

	// Documentation link for users
	documentationUrl = 'https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_1545141316.html';

	icon: Icon = 'file:netsuite-icon-hex.svg';

	// Defines the fields that will appear in the credentials form
	properties: INodeProperties[] = [
		{
			displayName: 'Account ID',
			name: 'accountId',
			type: 'string',
			required: true,
			default: '',
			description: 'Your NetSuite Account ID',
		},
		{
			displayName: 'Company URL',
			name: 'companyUrl',
			type: 'string',
			required: true,
			default: '',
			placeholder: 'xxxxxxxx.suitetalk.api.netsuite.com',
			description: 'The base URL for the NetSuite SuiteTalk API (e.g., 1234567.suitetalk.api.netsuite.com)',
		},
		{
			displayName: 'Consumer Key',
			name: 'consumerKey',
			type: 'string',
			required: true,
			default: '',
			description: 'The Consumer Key from your NetSuite Integration record',
		},
		{
			displayName: 'Consumer Secret',
			name: 'consumerSecret',
			type: 'string',
			typeOptions: {
				password: true,
			},
			required: true,
			default: '',
			description: 'The Consumer Secret from your NetSuite Integration record',
		},
		{
			displayName: 'Token Key',
			name: 'tokenKey',
			type: 'string',
			required: true,
			default: '',
			description: 'The Token ID (Key) from your NetSuite Access Token',
		},
		{
			displayName: 'Token Secret',
			name: 'tokenSecret',
			type: 'string',
			typeOptions: {
				password: true,
			},
			required: true,
			default: '',
			description: 'The Token Secret from your NetSuite Access Token',
		},
	];
}
