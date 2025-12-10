# n8n-nodes-netsuite-restlet-suiteql

This is an n8n community node that lets you interact with NetSuite using OAuth 1.0a authentication. It supports both RESTlet operations and SuiteQL queries.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/reference/license/) workflow automation platform.

## Features

- **OAuth 1.0a Authentication**: Secure authentication using NetSuite's OAuth 1.0a standard
- **SuiteQL Support**: Execute SQL-like queries against your NetSuite data
  - **Automatic Pagination**: Fetch all pages of results automatically
  - **Configurable Limits**: Control the number of results per page
  - **Smart OAuth Handling**: Proper signature generation for paginated requests
- **RESTlet Operations**: Call custom NetSuite RESTlet scripts
  - **Automatic Pagination**: Fetch all pages of results with configurable start/end indices
  - **Flexible Configuration**: Customize field names for pagination and results
  - **Custom Company URL**: Support for different RESTlet domains
- **Record Operations**: Full CRUD operations on NetSuite records
  - Create records
  - Get records by ID
  - Update records (PUT and PATCH)
  - Post actions to records
  - Transform records (e.g., Sales Order to Invoice)

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation.

### npm

```bash
npm install n8n-nodes-netsuite-restlet-suiteql
```

### n8n

1. Go to **Settings** > **Community Nodes**
2. Select **Install**
3. Enter `n8n-nodes-netsuite-restlet-suiteql` in the **Package Name** field
4. Click **Install**

## Configuration

### Prerequisites

Before using this node, you need to set up OAuth 1.0a authentication in NetSuite:

1. **Create an Integration Record**:
   - Navigate to Setup > Integration > Manage Integrations > New
   - Check "Token-Based Authentication"
   - Save and note down the **Consumer Key** and **Consumer Secret**

2. **Create an Access Token**:
   - Navigate to Setup > Users/Roles > Access Tokens > New
   - Select your Integration, User, and Role
   - Save and note down the **Token ID** and **Token Secret**

### Credentials

When setting up the NetSuite OAuth1 API credentials in n8n, you'll need:

- **Account ID**: Your NetSuite account ID
- **Company URL**: Your NetSuite SuiteTalk API URL (e.g., `1234567.suitetalk.api.netsuite.com`)
- **RESTlet Company URL** (optional): Your NetSuite RESTlet API URL (e.g., `1234567.restlets.api.netsuite.com`). Leave empty to use the Company URL above.
- **Consumer Key**: From your Integration record
- **Consumer Secret**: From your Integration record
- **Token Key**: Token ID from your Access Token
- **Token Secret**: Token Secret from your Access Token

## Operations

### SuiteQL

Execute SQL-like queries against your NetSuite data with automatic pagination support.

#### Parameters

- **Query**: The SuiteQL query to execute
- **Return All Pages**: Toggle to automatically fetch all pages of results
  - When **enabled**: Automatically follows pagination links until all data is retrieved
  - When **disabled**: Returns only the specified number of results
- **Limit**: Maximum number of results per page (1-1000, only visible when "Return All Pages" is disabled)

#### Pagination

When "Return All Pages" is enabled, the node will:
- Execute your query and retrieve the first page of results
- Automatically detect if more data is available (via `hasMore` field)
- Follow the `next` link in the response to fetch subsequent pages
- Combine all items from all pages into a single result
- Return the complete dataset with proper OAuth authentication for each request

This eliminates the need to manually handle pagination when working with large datasets.

**Example Query**:
```sql
SELECT id, companyName, email FROM customer WHERE subsidiary = '1' LIMIT 10
```

**Example Query with Pagination**:
```sql
SELECT
    Item.id,
    Item.itemId as sku,
    SUM(InventoryBalance.quantityAvailable) as total_quantity
FROM
    Item
LEFT JOIN
    InventoryBalance ON InventoryBalance.item = Item.id
WHERE
    BUILTIN.DF(Item.itemType) IN ('Assembly/Bill of Materials','Inventory Item')
    AND Item.isinactive = 'F'
GROUP BY
    Item.id, Item.itemId
ORDER BY
    Item.id ASC
```
*With "Return All Pages" enabled, this query will automatically fetch all inventory items across multiple pages.*

### RESTlet Operations

Call custom NetSuite RESTlet scripts with automatic pagination support.

#### Parameters

- **Script ID**: The Script ID of your RESTlet (e.g., `customscript_my_restlet`)
- **Deploy ID**: The Deploy ID of your RESTlet (e.g., `customdeploy_my_restlet`)
- **Body**: JSON body to send to the RESTlet
- **Return All**: Toggle to automatically paginate through all results
  - When **enabled**: Additional pagination options appear
- **Page Size**: Number of records to fetch per page (default: 1000)
- **Start Index Field**: Field name in the request body for the start index (default: `start`)
- **End Index Field**: Field name in the request body for the end index (default: `end`)
- **Results Field**: Field name in the response containing the results array (default: `results`)

#### Pagination

When "Return All" is enabled, the node will:
- Automatically increment the start/end index fields in your request body
- Make multiple requests to fetch all pages of data
- Stop when it receives fewer results than the page size (indicating the last page)
- Combine all results into a single response with a `total` count

**Example Body (without pagination)**:
```json
{
  "id": "19405",
  "type": "savesearchdata",
  "start": 0,
  "end": 1000
}
```

**Example with Pagination Enabled**:
- Set "Return All" to **true**
- Set "Page Size" to **1000**
- Set "Start Index Field" to **start**
- Set "End Index Field" to **end**
- Set "Results Field" to **results**
- The node will automatically update `start` and `end` values in each request

The response will contain:
```json
{
  "results": [...all items from all pages...],
  "total": 5432
}
```

### Record Operations

#### Create
Create a new record in NetSuite.

**Example Body**:
```json
{
  "entity": "12345",
  "trandate": "2024-12-04",
  "item": {
    "items": [
      {
        "item": "123",
        "quantity": 1,
        "rate": 100
      }
    ]
  }
}
```

#### Get
Retrieve a record by its internal ID.

#### Update (PUT)
Replace an entire record with new data.

#### Update (PATCH)
Update specific fields of a record without replacing the entire record.

#### Post Action
Post a specific action to a record.

#### Transform
Transform one record type into another (e.g., Sales Order to Invoice).

**Parameters**:
- **Record Type**: The source record type (e.g., `salesOrder`)
- **Target Record Type**: The destination record type (e.g., `invoice`)
- **Record ID**: The ID of the source record
- **Body**: Optional JSON to override fields in the transformed record

## Resources

- [n8n community nodes documentation](https://docs.n8n.io/integrations/community-nodes/)
- [NetSuite SuiteTalk REST Web Services](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/chapter_1540391670.html)
- [NetSuite SuiteQL](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_156257770590.html)
- [NetSuite OAuth 1.0 Setup](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_1545141316.html)

## Version History

### 1.0.0
- Initial release
- SuiteQL query execution with automatic pagination support
- **Return All Pages** feature for fetching complete datasets
- Configurable limit per page (1-1000 results)
- RESTlet operations with automatic pagination
  - Configurable start/end index fields
  - Configurable results field name
  - Custom RESTlet Company URL support
- Full Record CRUD operations
- OAuth 1.0a authentication with proper signature handling for paginated requests
- Record transformation support

## License

[MIT](LICENSE)

## Support

For issues, questions, or contributions, please visit the [GitHub repository](https://github.com/cafeasp/n8n-netsuite-restlet-suiteql).

## Author

**cafeasp**

---

**Note**: This is a community-maintained node and is not officially supported by n8n or Oracle NetSuite.
