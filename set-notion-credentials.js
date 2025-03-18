const ElectronStore = require('electron-store');

// Initialize the store
const store = new ElectronStore();

// Parse Notion URL to extract the database ID
const notionUrl = 'https://www.notion.so/1a5a6ab779f880249414f243ee5e2108?v=1a5a6ab779f880909696000c20ffa2c8';
const databaseId = notionUrl.split('?')[0].split('/').pop();

// Notion API key
const notionApiKey = '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';

// Set the credentials in the store
store.set('notionApiKey', notionApiKey);
store.set('notionDatabaseId', databaseId);
store.set('syncEnabled', true);
store.set('syncIntervalMinutes', 5); // Sync every 5 minutes

console.log('Notion credentials set:');
console.log('Database ID:', databaseId);
console.log('API Key:', notionApiKey);
console.log('Sync Enabled:', store.get('syncEnabled'));
console.log('Sync Interval:', store.get('syncIntervalMinutes'), 'minutes'); 