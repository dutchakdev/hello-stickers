# Label Printer Application

A powerful desktop application for syncing product data from Notion databases, downloading images and PDF files from Google Drive and other sources, and printing product labels. Built with Electron, React, TypeScript, and Tailwind CSS.

## Core Functionality

The application allows users to:

1. **Sync Products from Notion**: Connect to a Notion database to retrieve product information including titles, SKUs, prices, and images.
2. **Download Assets**: Automatically download product images and sticker PDFs from various sources including Google Drive, Notion, and direct URLs.
3. **Preview and Print Labels**: View and print product labels with different sizes and formats to configured printers.
4. **Manage Products**: Search, filter, and organize products by type or category.

## Technical Architecture

### Key Components

- **Main Process (Electron)**: Handles database operations, file system access, and print functionality.
- **Renderer Process (React)**: Provides the user interface and handles user interactions.
- **IPC Communication**: Connects the two processes securely.
- **Database**: Uses a JSON file-based database with LowDB for storing products, stickers, and settings.

### Core Modules

#### Google Drive Integration (`src/lib/google-drive.ts`)

Handles downloading files from Google Drive URLs with robust error handling and multiple fallback mechanisms:

- **File Detection**: Extracts file IDs from various Google Drive URL formats
- **Download Methods**:
  - Direct API access using a service account
  - Native module helper to avoid webpack issues
  - Multiple direct URL methods with authentication handling
  - Special handling for images vs PDF files

```javascript
// Example: Extracting file ID from Google Drive URL
const fileId = extractFileId(url);
if (fileId) {
  if (isImage) {
    return downloadDriveImage(fileId, localPath);
  } else {
    return downloadDriveFile(fileId, filePath);
  }
}
```

#### Notion Integration (`src/lib/notion.ts`)

Connects to the Notion API to sync product data and download files:

- **Database Query**: Retrieves products from specified Notion database
- **Property Extraction**: Parses various Notion property types (title, text, select, etc.)
- **Image Handling**: Identifies and downloads product images from multiple field types
- **PDF Processing**: Extracts and downloads sticker PDFs, generating previews

```javascript
// Example: Multi-field image detection
const possibleImageFields = ['Image Link', 'Preview Image', 'Image', 'Product Image', 'Preview'];
for (const fieldName of possibleImageFields) {
  if (properties[fieldName]) {
    // Extract URL from different property formats
    // ...
  }
}
```

#### Asset Downloading System

Implements a robust downloading system with multiple fallback methods:

- **Direct Download**: Fast download for simple URLs
- **Notion-specific**: Special handling for Notion-hosted files
- **Google Drive**: Multiple methods to handle authentication, cookies, and format issues
- **Error Handling**: Extensive logging and fallbacks for corrupt or missing files

```javascript
// Example: Robust download with fallbacks
async function downloadAsset(url, type, customName) {
  // Try direct download
  // If fails, check if Google Drive URL
  // If fails, try alternative methods
  // If all fail, log detailed errors
}
```

#### PDF Utilities

Handles PDF processing for sticker templates:

- **Preview Generation**: Creates PNG previews from PDF files
- **Path Management**: Organizes files in appropriate directories
- **App URL Generation**: Creates protocol URLs for electron's file access

## Implementation Highlights

### Robust Error Handling

The application implements extensive error handling to deal with:

- Network failures during downloads
- Invalid or expired download links
- HTML responses instead of binary files
- Authentication issues with Google Drive
- Missing or corrupt files

### Multiple Fallback Strategies

For each core function, the application implements multiple fallback strategies:

1. **Primary Method**: Fast and direct whenever possible
2. **Secondary Methods**: Alternative approaches when primary fails
3. **Last Resort Methods**: More resource-intensive but reliable methods

### Optimized File Management

Files are stored in organized directories with consistent naming:

- Downloaded images: `{userData}/downloads/images/`
- PDF files: `{userData}/downloads/pdfs/`
- Generated previews: `{userData}/previews/`

### Notion Data Extraction

The application handles various Notion property types:

- Title and rich text fields
- Select and multi-select options
- Files and media (images, PDFs)
- URL fields
- Relation fields (for connected stickers)

## Setup and Development

### Requirements

- Node.js 14+
- npm or yarn
- macOS or Windows

### Installation

```bash
# Clone the repository
git clone [repository-url]

# Install dependencies
npm install

# Start the development server
npm start
```

### Configuration

1. **Notion API**:
   - Create a Notion integration at https://www.notion.so/my-integrations
   - Share your database with the integration
   - Enter your API key and database ID in the Settings page

2. **Google Drive**:
   - Create a Google Cloud project
   - Enable the Google Drive API
   - Create a service account
   - Generate a JSON key for the service account
   - Enter the service account JSON in the Settings page

3. **Printers**:
   - Configure printers for different label sizes in the Settings page
   - For each label size, select the appropriate printer and options

## License

MIT 