import {
	IExecuteFunctions,
	IDataObject,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeConnectionTypes,
	NodeApiError,
	NodeOperationError,
	IHttpRequestMethods,
	IHttpRequestOptions,
	JsonObject,
} from 'n8n-workflow';

// ---------------------------------------------------------------------------
// Resource / operation catalogue
//
// InvoiceXpress exposes three "document" families (invoices, estimates,
// guides) that share the same shape of operations (create, get, list,
// update, change-state, email, pdf) but differ in the sub-type of document
// they create (e.g. an "invoice" resource can produce an invoice, a
// simplified invoice, a receipt, a credit note or a debit note).
// ---------------------------------------------------------------------------

const documentTypeOptions: Record<string, { name: string; value: string }[]> = {
	invoice: [
		{ name: 'Invoice', value: 'invoices' },
		{ name: 'Invoice Receipt', value: 'invoice_receipts' },
		{ name: 'Simplified Invoice', value: 'simplified_invoices' },
		{ name: 'Credit Note', value: 'credit_notes' },
		{ name: 'Debit Note', value: 'debit_notes' },
		{ name: 'Receipt', value: 'receipts' },
	],
	estimate: [
		{ name: 'Quote', value: 'quotes' },
		{ name: 'Proforma', value: 'proformas' },
		{ name: 'Fees Note', value: 'fees_notes' },
	],
	guide: [
		{ name: 'Shipping', value: 'shippings' },
		{ name: 'Transport', value: 'transports' },
		{ name: 'Devolution', value: 'devolutions' },
	],
};

const documentStateOptions: Record<string, { name: string; value: string }[]> = {
	invoice: [
		{ name: 'Finalized', value: 'finalized' },
		{ name: 'Settled', value: 'settled' },
		{ name: 'Canceled', value: 'canceled' },
		{ name: 'Deleted (Draft Only)', value: 'deleted' },
	],
	estimate: [
		{ name: 'Finalized', value: 'finalized' },
		{ name: 'Accepted', value: 'accepted' },
		{ name: 'Refused', value: 'refused' },
		{ name: 'Canceled', value: 'canceled' },
		{ name: 'Deleted (Draft Only)', value: 'deleted' },
	],
	guide: [
		{ name: 'Finalized', value: 'finalized' },
		{ name: 'Canceled', value: 'canceled' },
		{ name: 'Deleted (Draft Only)', value: 'deleted' },
	],
};

const documentFamilies = ['invoice', 'estimate', 'guide'];

export class InvoiceXpress implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'InvoiceXpress',
		name: 'invoiceXpress',
		icon: 'file:invoiceXpress.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["resource"] + ": " + $parameter["operation"]}}',
		description: 'Consume the InvoiceXpress invoicing API',
		defaults: { name: 'InvoiceXpress' },
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'invoiceXpressApi',
				required: true,
			},
		],
		properties: [
			// -----------------------------------------------------------------
			// Resource
			// -----------------------------------------------------------------
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Client', value: 'client' },
					{ name: 'Estimate', value: 'estimate', description: 'Quotes, proformas, fees notes' },
					{ name: 'Guide', value: 'guide', description: 'Shipping, transport and devolution guides' },
					{ name: 'Invoice', value: 'invoice', description: 'Invoices, receipts, credit/debit notes' },
					{ name: 'Item', value: 'item' },
					{ name: 'Sequence', value: 'sequence' },
					{ name: 'Tax', value: 'tax' },
				],
				default: 'invoice',
			},

			// -----------------------------------------------------------------
			// Operations — document families (invoice / estimate / guide)
			// -----------------------------------------------------------------
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: documentFamilies } },
				options: [
					{ name: 'Change State', value: 'changeState', action: 'Change document state' },
					{ name: 'Create', value: 'create', action: 'Create a document' },
					{ name: 'Get', value: 'get', action: 'Get a document' },
					{ name: 'Get Many', value: 'getAll', action: 'Get many documents' },
					{ name: 'Get PDF', value: 'getPdf', action: 'Get a document PDF' },
					{ name: 'Send by Email', value: 'sendEmail', action: 'Email a document to the client' },
					{ name: 'Update', value: 'update', action: 'Update a document' },
				],
				default: 'create',
			},

			// -----------------------------------------------------------------
			// Operations — client
			// -----------------------------------------------------------------
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['client'] } },
				options: [
					{ name: 'Create', value: 'create', action: 'Create a client' },
					{ name: 'Find by Code', value: 'findByCode', action: 'Find a client by code' },
					{ name: 'Find by Name', value: 'findByName', action: 'Find a client by name' },
					{ name: 'Get', value: 'get', action: 'Get a client' },
					{ name: 'Get Invoices', value: 'getInvoices', action: 'Get a client invoices' },
					{ name: 'Get Many', value: 'getAll', action: 'Get many clients' },
					{ name: 'Update', value: 'update', action: 'Update a client' },
				],
				default: 'create',
			},

			// -----------------------------------------------------------------
			// Operations — item / tax (identical shapes, incl. delete)
			// -----------------------------------------------------------------
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['item', 'tax'] } },
				options: [
					{ name: 'Create', value: 'create', action: 'Create' },
					{ name: 'Delete', value: 'delete', action: 'Delete' },
					{ name: 'Get', value: 'get', action: 'Get' },
					{ name: 'Get Many', value: 'getAll', action: 'Get many' },
					{ name: 'Update', value: 'update', action: 'Update' },
				],
				default: 'create',
			},

			// -----------------------------------------------------------------
			// Operations — sequence
			// -----------------------------------------------------------------
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['sequence'] } },
				options: [
					{ name: 'Create', value: 'create', action: 'Create a sequence' },
					{ name: 'Get', value: 'get', action: 'Get a sequence' },
					{ name: 'Get Many', value: 'getAll', action: 'Get many sequences' },
					{ name: 'Register', value: 'register', action: 'Register a sequence with the tax authority' },
					{ name: 'Set as Current', value: 'setCurrent', action: 'Set a sequence as the default' },
				],
				default: 'create',
			},

			// -----------------------------------------------------------------
			// Document type sub-selector (only for the 3 document families)
			// -----------------------------------------------------------------
			{
				displayName: 'Document Type',
				name: 'documentType',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['invoice'] } },
				options: documentTypeOptions.invoice,
				default: 'invoices',
			},
			{
				displayName: 'Document Type',
				name: 'documentType',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['estimate'] } },
				options: documentTypeOptions.estimate,
				default: 'quotes',
			},
			{
				displayName: 'Document Type',
				name: 'documentType',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['guide'] } },
				options: documentTypeOptions.guide,
				default: 'shippings',
			},

			// -----------------------------------------------------------------
			// Document / entity ID (get, update, delete, changeState, email, pdf...)
			// -----------------------------------------------------------------
			{
				displayName: 'Document ID',
				name: 'documentId',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: {
						resource: documentFamilies,
						operation: ['get', 'update', 'changeState', 'sendEmail', 'getPdf'],
					},
				},
			},
			{
				displayName: 'Client ID',
				name: 'entityId',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: { resource: ['client'], operation: ['get', 'update', 'getInvoices'] },
				},
			},
			{
				displayName: 'Item ID',
				name: 'entityId',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: { resource: ['item'], operation: ['get', 'update', 'delete'] },
				},
			},
			{
				displayName: 'Tax ID',
				name: 'entityId',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: { resource: ['tax'], operation: ['get', 'update', 'delete'] },
				},
			},
			{
				displayName: 'Sequence ID',
				name: 'entityId',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: { resource: ['sequence'], operation: ['get', 'register', 'setCurrent'] },
				},
			},

			// -----------------------------------------------------------------
			// Change state value
			// -----------------------------------------------------------------
			{
				displayName: 'New State',
				name: 'state',
				type: 'options',
				displayOptions: { show: { resource: ['invoice'], operation: ['changeState'] } },
				options: documentStateOptions.invoice,
				default: 'finalized',
			},
			{
				displayName: 'New State',
				name: 'state',
				type: 'options',
				displayOptions: { show: { resource: ['estimate'], operation: ['changeState'] } },
				options: documentStateOptions.estimate,
				default: 'finalized',
			},
			{
				displayName: 'New State',
				name: 'state',
				type: 'options',
				displayOptions: { show: { resource: ['guide'], operation: ['changeState'] } },
				options: documentStateOptions.guide,
				default: 'finalized',
			},

			// -----------------------------------------------------------------
			// Find by name / code (client)
			// -----------------------------------------------------------------
			{
				displayName: 'Name',
				name: 'name',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['client'], operation: ['findByName'] } },
			},
			{
				displayName: 'Code',
				name: 'code',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['client'], operation: ['findByCode'] } },
			},

			// -----------------------------------------------------------------
			// Body payload for create / update / register / setCurrent, as JSON.
			// InvoiceXpress payloads are deeply nested (e.g. invoice.items[]) so
			// a raw JSON field is exposed alongside a few common convenience
			// fields for the most frequent case (documents).
			// -----------------------------------------------------------------
			{
				displayName: 'Simplify Body',
				name: 'simplify',
				type: 'boolean',
				default: true,
				description:
					'Whether to build the body from the fields below instead of supplying raw JSON',
				displayOptions: {
					show: {
						resource: [...documentFamilies, 'client', 'item', 'tax', 'sequence'],
						operation: ['create', 'update'],
					},
				},
			},
			{
				displayName: 'Client Name or ID',
				name: 'clientName',
				type: 'string',
				default: '',
				description: 'Name of the client this document is for (matched or created by InvoiceXpress)',
				displayOptions: {
					show: { resource: documentFamilies, operation: ['create', 'update'], simplify: [true] },
				},
			},
			{
				displayName: 'Date',
				name: 'date',
				type: 'string',
				default: '',
				placeholder: 'YYYY/MM/DD',
				displayOptions: {
					show: { resource: documentFamilies, operation: ['create', 'update'], simplify: [true] },
				},
			},
			{
				displayName: 'Due Date',
				name: 'dueDate',
				type: 'string',
				default: '',
				placeholder: 'YYYY/MM/DD',
				displayOptions: {
					show: { resource: ['invoice', 'estimate'], operation: ['create', 'update'], simplify: [true] },
				},
			},
			{
				displayName: 'Items',
				name: 'items',
				type: 'fixedCollection',
				typeOptions: { multipleValues: true },
				default: {},
				placeholder: 'Add Item',
				displayOptions: {
					show: { resource: documentFamilies, operation: ['create', 'update'], simplify: [true] },
				},
				options: [
					{
						displayName: 'Item',
						name: 'item',
						values: [
							{
						displayName: 'Description',
						name: 'description',
						type: 'string',
						default: '',
							},
							{
						displayName: 'Name',
						name: 'name',
						type: 'string',
						default: '',
							},
							{
						displayName: 'Quantity',
						name: 'quantity',
						type: 'number',
						default: 1
							},
							{
						displayName: 'Tax Name',
						name: 'tax_name',
						type: 'string',
						default: '',
							},
							{
						displayName: 'Unit Price',
						name: 'unit_price',
						type: 'number',
						default: 0
							},
						],
					},
				],
			},
			{
				displayName: 'Body (JSON)',
				name: 'bodyJson',
				type: 'json',
				default: '{}',
				description:
					'Raw JSON payload matching the InvoiceXpress schema for this resource (used as-is, or merged over the simplified fields when "Simplify Body" is off)',
				displayOptions: {
					show: {
						resource: [...documentFamilies, 'client', 'item', 'tax', 'sequence'],
						operation: ['create', 'update'],
					},
				},
			},
			{
				displayName: 'Body (JSON)',
				name: 'bodyJson',
				type: 'json',
				default: '{}',
				description: 'Raw JSON payload for registering/setting the sequence, if required by your account',
				displayOptions: { show: { resource: ['sequence'], operation: ['register', 'setCurrent'] } },
			},

			// -----------------------------------------------------------------
			// Get PDF options
			// -----------------------------------------------------------------
			{
				displayName: 'Second Copy',
				name: 'secondCopy',
				type: 'boolean',
				default: false,
				displayOptions: { show: { resource: documentFamilies, operation: ['getPdf'] } },
			},

			// -----------------------------------------------------------------
			// Filters / pagination for "Get Many"
			// -----------------------------------------------------------------
			{
				displayName: 'Return All',
				name: 'returnAll',
				type: 'boolean',
				description: 'Whether to return all results or only up to a given limit',
				default: false,
				displayOptions: {
					show: {
						resource: [...documentFamilies, 'client', 'item', 'tax', 'sequence'],
						operation: ['getAll', 'getInvoices'],
					},
				},
			},
			{
				displayName: 'Limit',
				name: 'limit',
				type: 'number',
				description: 'Max number of results to return',
				default: 50,
				typeOptions: { minValue: 1 },
				displayOptions: {
					show: {
						resource: [...documentFamilies, 'client', 'item', 'tax', 'sequence'],
						operation: ['getAll', 'getInvoices'],
						returnAll: [false],
					},
				},
			},
			{
				displayName: 'Filters (JSON)',
				name: 'filtersJson',
				type: 'json',
				default: '{}',
				description:
					'Extra query-string filters as a JSON object, e.g. {"status[]":"finalized","date[start]":"2026/01/01"}',
				displayOptions: {
					show: {
						resource: [...documentFamilies, 'client', 'item', 'tax', 'sequence'],
						operation: ['getAll', 'getInvoices'],
					},
				},
			},
		],
		usableAsTool: true,
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;

		const credentials = await this.getCredentials('invoiceXpressApi');
		const baseURL = `https://${credentials.accountName}.app.invoicexpress.com`;

		for (let i = 0; i < items.length; i++) {
			try {
				let method: IHttpRequestMethods = 'GET';
				let endpoint = '';
				let qs: IDataObject = {};
				let body: IDataObject = {};

				const docType = documentFamilies.includes(resource)
					? (this.getNodeParameter('documentType', i) as string)
					: undefined;

				const buildDocumentBody = (): IDataObject => {
					const simplify = this.getNodeParameter('simplify', i, true) as boolean;
					const bodyJsonRaw = this.getNodeParameter('bodyJson', i, '{}') as string;
					const extra = bodyJsonRaw ? (JSON.parse(bodyJsonRaw) as IDataObject) : {};

					if (!simplify) return extra;

					const doc: IDataObject = {};
					const clientName = this.getNodeParameter('clientName', i, '') as string;
					const date = this.getNodeParameter('date', i, '') as string;
					if (clientName) doc.client = { name: clientName };
					if (date) doc.date = date;
					if (resource === 'invoice' || resource === 'estimate') {
						const dueDate = this.getNodeParameter('dueDate', i, '') as string;
						if (dueDate) doc.due_date = dueDate;
					}
					const itemsCollection = this.getNodeParameter('items', i, {}) as {
						item?: IDataObject[];
					};
					if (itemsCollection.item?.length) {
						doc.items = itemsCollection.item;
					}
					return { ...doc, ...extra };
				};

				const buildEntityBody = (): IDataObject => {
					const bodyJsonRaw = this.getNodeParameter('bodyJson', i, '{}') as string;
					return bodyJsonRaw ? (JSON.parse(bodyJsonRaw) as IDataObject) : {};
				};

				const applyFilters = () => {
					const returnAll = this.getNodeParameter('returnAll', i, false) as boolean;
					if (!returnAll) {
						qs.per_page = this.getNodeParameter('limit', i, 50);
					}
					const filtersRaw = this.getNodeParameter('filtersJson', i, '{}') as string;
					if (filtersRaw) {
						qs = { ...qs, ...(JSON.parse(filtersRaw) as IDataObject) };
					}
				};

				// -------------------------------------------------------------
				// Document families: invoice / estimate / guide
				// -------------------------------------------------------------
				if (documentFamilies.includes(resource)) {
					switch (operation) {
						case 'create':
							method = 'POST';
							endpoint = `/${docType}.json`;
							body = { [resource]: buildDocumentBody() };
							break;
						case 'get': {
							const id = this.getNodeParameter('documentId', i) as string;
							method = 'GET';
							endpoint = `/${docType}/${id}.json`;
							break;
						}
						case 'getAll':
							method = 'GET';
							endpoint = `/${resource === 'guide' ? 'guides' : resource === 'estimate' ? 'estimates' : 'invoices'}.json`;
							applyFilters();
							break;
						case 'update': {
							const id = this.getNodeParameter('documentId', i) as string;
							method = 'PUT';
							endpoint = `/${docType}/${id}.json`;
							body = { [resource]: buildDocumentBody() };
							break;
						}
						case 'changeState': {
							const id = this.getNodeParameter('documentId', i) as string;
							const state = this.getNodeParameter('state', i) as string;
							method = 'PUT';
							endpoint = `/${docType}/${id}/change-state.json`;
							body = { [resource]: { state } };
							break;
						}
						case 'sendEmail': {
							const id = this.getNodeParameter('documentId', i) as string;
							method = 'PUT';
							endpoint = `/${docType}/${id}/email-document.json`;
							body = buildEntityBody();
							break;
						}
						case 'getPdf': {
							const id = this.getNodeParameter('documentId', i) as string;
							const secondCopy = this.getNodeParameter('secondCopy', i, false) as boolean;
							method = 'GET';
							endpoint = `/api/pdf/${id}.json`;
							if (secondCopy) qs.second_copy = 'true';
							break;
						}
						default:
							throw new NodeOperationError(this.getNode(), `Unknown operation "${operation}"`, {
								itemIndex: i,
							});
					}
				}

				// -------------------------------------------------------------
				// Client
				// -------------------------------------------------------------
				else if (resource === 'client') {
					switch (operation) {
						case 'create':
							method = 'POST';
							endpoint = '/clients.json';
							body = { client: buildEntityBody() };
							break;
						case 'get': {
							const id = this.getNodeParameter('entityId', i) as string;
							method = 'GET';
							endpoint = `/clients/${id}.json`;
							break;
						}
						case 'getAll':
							method = 'GET';
							endpoint = '/clients.json';
							applyFilters();
							break;
						case 'update': {
							const id = this.getNodeParameter('entityId', i) as string;
							method = 'PUT';
							endpoint = `/clients/${id}.json`;
							body = { client: buildEntityBody() };
							break;
						}
						case 'findByName':
							method = 'GET';
							endpoint = '/clients/find-by-name.json';
							qs.client_name = this.getNodeParameter('name', i) as string;
							break;
						case 'findByCode':
							method = 'GET';
							endpoint = '/clients/find-by-code.json';
							qs.client_code = this.getNodeParameter('code', i) as string;
							break;
						case 'getInvoices': {
							const id = this.getNodeParameter('entityId', i) as string;
							method = 'GET';
							endpoint = `/clients/${id}/invoices.json`;
							applyFilters();
							break;
						}
						default:
							throw new NodeOperationError(this.getNode(), `Unknown operation "${operation}"`, {
								itemIndex: i,
							});
					}
				}

				// -------------------------------------------------------------
				// Item / Tax (identical CRUD shape)
				// -------------------------------------------------------------
				else if (resource === 'item' || resource === 'tax') {
					const collection = resource === 'item' ? 'items' : 'taxes';
					const wrapperKey = resource === 'item' ? 'item' : 'tax';
					switch (operation) {
						case 'create':
							method = 'POST';
							endpoint = `/${collection}.json`;
							body = { [wrapperKey]: buildEntityBody() };
							break;
						case 'get': {
							const id = this.getNodeParameter('entityId', i) as string;
							method = 'GET';
							endpoint = `/${collection}/${id}.json`;
							break;
						}
						case 'getAll':
							method = 'GET';
							endpoint = `/${collection}.json`;
							applyFilters();
							break;
						case 'update': {
							const id = this.getNodeParameter('entityId', i) as string;
							method = 'PUT';
							endpoint = `/${collection}/${id}.json`;
							body = { [wrapperKey]: buildEntityBody() };
							break;
						}
						case 'delete': {
							const id = this.getNodeParameter('entityId', i) as string;
							method = 'DELETE';
							endpoint = `/${collection}/${id}.json`;
							break;
						}
						default:
							throw new NodeOperationError(this.getNode(), `Unknown operation "${operation}"`, {
								itemIndex: i,
							});
					}
				}

				// -------------------------------------------------------------
				// Sequence
				// -------------------------------------------------------------
				else if (resource === 'sequence') {
					switch (operation) {
						case 'create':
							method = 'POST';
							endpoint = '/sequences.json';
							body = { sequence: buildEntityBody() };
							break;
						case 'get': {
							const id = this.getNodeParameter('entityId', i) as string;
							method = 'GET';
							endpoint = `/sequences/${id}.json`;
							break;
						}
						case 'getAll':
							method = 'GET';
							endpoint = '/sequences.json';
							applyFilters();
							break;
						case 'register': {
							const id = this.getNodeParameter('entityId', i) as string;
							method = 'PUT';
							endpoint = `/sequences/${id}/register.json`;
							body = { sequence: buildEntityBody() };
							break;
						}
						case 'setCurrent': {
							const id = this.getNodeParameter('entityId', i) as string;
							method = 'PUT';
							endpoint = `/sequences/${id}/set_current.json`;
							body = { sequence: buildEntityBody() };
							break;
						}
						default:
							throw new NodeOperationError(this.getNode(), `Unknown operation "${operation}"`, {
								itemIndex: i,
							});
					}
				}

				const options: IHttpRequestOptions = {
					method,
					url: `${baseURL}${endpoint}`,
					qs,
					body: Object.keys(body).length ? body : undefined,
					json: true,
				};

				const responseData = await this.helpers.httpRequestWithAuthentication.call(
					this,
					'invoiceXpressApi',
					options,
				);

				if (Array.isArray(responseData)) {
					returnData.push(
						...responseData.map((entry) => ({ json: entry as IDataObject, pairedItem: { item: i } })),
					);
				} else {
					returnData.push({ json: responseData as IDataObject, pairedItem: { item: i } });
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message },
						pairedItem: { item: i },
					});
					continue;
				}
				throw new NodeApiError(this.getNode(), error as JsonObject, { itemIndex: i });
			}
		}

		return [returnData];
	}
}
