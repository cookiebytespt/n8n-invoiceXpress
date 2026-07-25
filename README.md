# n8n-nodes-invoicexpress

[![CI](https://github.com/cookiebytespt/n8n-invoiceXpress/actions/workflows/ci.yml/badge.svg)](https://github.com/cookiebytespt/n8n-invoiceXpress/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/n8n-nodes-invoicexpress.svg)](https://www.npmjs.com/package/n8n-nodes-invoicexpress)

An n8n community node for the [InvoiceXpress](https://www.invoicexpress.com/) API (v2).

Covers every method group in InvoiceXpress's public API, each mapped to a **Resource** in the node:

| Resource | Operations | Notes |
|---|---|---|
| **Invoice** | Create, Get, Get Many, Update, Change State, Send by Email, Get PDF | Document Type switches between Invoice, Invoice Receipt, Simplified Invoice, Credit Note, Debit Note, Receipt |
| **Estimate** | Create, Get, Get Many, Update, Change State, Send by Email, Get PDF | Document Type: Quote, Proforma, Fees Note |
| **Guide** | Create, Get, Get Many, Update, Change State, Send by Email, Get PDF | Document Type: Shipping, Transport, Devolution |
| **Client** | Create, Get, Get Many, Update, Find by Name, Find by Code, Get Invoices | |
| **Item** | Create, Get, Get Many, Update, Delete | |
| **Tax** | Create, Get, Get Many, Update, Delete | |
| **Sequence** | Create, Get, Get Many, Register, Set as Current | Registers/selects the sequential numbering used by documents |

## Install

Inside your n8n instance:

```
Settings → Community Nodes → Install → n8n-nodes-invoicexpress
```

Or manually:

```bash
npm install
npm run build
```

then copy (or symlink) this folder into `~/.n8n/nodes/` (or wherever your n8n instance loads custom nodes from), and restart n8n.

## Postman collection

A Postman collection covering every request the node can make lives in [`postman/`](./postman) —
import `InvoiceXpress.postman_collection.json` plus `InvoiceXpress.postman_environment.json`
(fill in `account_name` and `api_key`) to exercise the API directly, independent of n8n.

## Credentials

Create an **InvoiceXpress API** credential with:

- **Account Name** — the subdomain of your account, e.g. `mycompany` for `mycompany.app.invoicexpress.com`
- **API Key** — found in InvoiceXpress under *Account → Settings → API*

The node authenticates by appending `api_key` to every request's query string, per InvoiceXpress's documented auth scheme.

## Body payloads

Documents (Invoice/Estimate/Guide) and entities (Client/Item/Tax/Sequence) accept either:

- **Simplified fields** (Client Name, Date, Due Date, Items) for the common case, or
- Raw **Body (JSON)**, which is merged over the simplified fields (or used alone if "Simplify Body" is off) — use this for anything the simplified UI doesn't expose (discounts, currency, tax exemption, retention, observations, custom sequence, etc.), matching the shape documented at https://developers.invoicexpress.com/docs/versions/2.0.0.

## Rate limits

InvoiceXpress enforces 780 requests/minute per account (HTTP 429 if exceeded); this node does not do its own throttling.

## Development

```bash
npm install
npm run lint    # n8n community-node lint rules, via @n8n/node-cli
npm run build   # compile TypeScript and copy static assets to dist/
npm run dev     # run n8n locally with this node loaded, rebuilding on change
```

Every pull request and push to `main` runs lint + build in CI (see
[`.github/workflows/ci.yml`](./.github/workflows/ci.yml)). Tagging a version
(e.g. `git tag 0.1.0 && git push --tags` — or `npm run release`, which does
this interactively) triggers
[`.github/workflows/publish.yml`](./.github/workflows/publish.yml), which
publishes to npm with provenance. See that workflow file for one-time npm
Trusted Publisher / token setup.

## Sources

Built from InvoiceXpress's public API documentation:
- https://developers.invoicexpress.com/docs/versions/2.0.0
- https://docs.invoicexpress.com/invoices
- https://docs.invoicexpress.com/clients
- https://docs.invoicexpress.com/items
- https://docs.invoicexpress.com/taxes
- https://docs.invoicexpress.com/estimates
- https://docs.invoicexpress.com/guides
- https://docs.invoicexpress.com/sequences
