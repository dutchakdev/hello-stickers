# Label Printer Application

A desktop application for printing product labels from Notion database. Built with Electron, React, TypeScript, and Tailwind CSS.

## Features

- Sync products from Notion database
- Download product images and sticker PDFs from Google Drive
- Print labels directly to configured printers
- Search products by name, SKU, or barcode
- Filter products by type
- Touch-friendly UI optimized for tablets

## Requirements

- Node.js 14+
- npm or yarn
- macOS or Windows

## Setup

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Start the development server:
   ```
   npm start
   ```

## Configuration

### Notion API

1. Create a Notion integration at https://www.notion.so/my-integrations
2. Share your database with the integration
3. Enter your Notion API key and database ID in the Settings page

### Google Drive

1. Create a Google Cloud project
2. Enable the Google Drive API
3. Create a service account
4. Generate a JSON key for the service account
5. Enter the service account JSON in the Settings page

### Printers

1. Configure printers for different label sizes in the Settings page
2. For each label size, select the appropriate printer and configure options

## Building for Production

```
npm run make
```

This will create platform-specific distributables in the `out` directory.

## License

MIT 