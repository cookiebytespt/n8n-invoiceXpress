import {
	ICredentialType,
	INodeProperties,
	ICredentialTestRequest,
} from 'n8n-workflow';

export class InvoiceXpressApi implements ICredentialType {
	name = 'invoiceXpressApi';
	displayName = 'InvoiceXpress API';
	icon = 'file:../nodes/InvoiceXpress/invoiceXpress.svg' as const;
	documentationUrl = 'https://developers.invoicexpress.com/docs/versions/2.0.0';
	properties: INodeProperties[] = [
		{
			displayName: 'Account Name',
			name: 'accountName',
			type: 'string',
			default: '',
			placeholder: 'mycompany',
			description:
				'The subdomain of your InvoiceXpress account, e.g. "mycompany" for mycompany.app.invoicexpress.com',
			required: true,
		},
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			description: 'API key from Account > Settings > API in InvoiceXpress',
			required: true,
		},
	];

	// InvoiceXpress authenticates via an api_key query string parameter, not headers.
	authenticate = {
		type: 'generic' as const,
		properties: {
			qs: {
				api_key: '={{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '=https://{{$credentials.accountName}}.app.invoicexpress.com',
			url: '/clients.json',
			method: 'GET',
			qs: {
				per_page: 1,
			},
		},
	};
}
