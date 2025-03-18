const { Client } = require('@notionhq/client');

// This module is designed to be required directly, not bundled with Webpack
class NotionAPI {
    constructor() {
        this.client = null;
    }

    initialize(apiKey) {
        if (!apiKey) {
            throw new Error('API key is required to initialize Notion client');
        }

        this.client = new Client({
            auth: apiKey
        });

        return this;
    }

    async queryDatabase(databaseId) {
        if (!this.client) {
            throw new Error('Notion client not initialized. Call initialize() first');
        }

        if (!databaseId) {
            throw new Error('Database ID is required');
        }

        console.log(`Querying Notion database with ID ${databaseId}`);

        const response = await this.client.databases.query({
            database_id: databaseId
        });

        return response.results;
    }

    // Extract product data from a Notion page
    extractProductData(page) {
        return {
            name: page.properties.Name?.title[0]?.plain_text || 'Unnamed Product',
            sku: page.properties.SKU?.rich_text[0]?.plain_text || '',
            type: page.properties.Type?.select?.name || 'Uncategorized',
            barcode: page.properties.Barcode?.rich_text[0]?.plain_text || undefined,
            imageUrl: page.properties['Image URL']?.url || undefined
        };
    }
}

module.exports = new NotionAPI(); 