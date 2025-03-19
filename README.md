# Print2 - Label Printer Application

A powerful desktop application for syncing product data from Notion databases, downloading images and PDF files from Google Drive and other sources, and printing product labels. Built with Electron, React, TypeScript, and Tailwind CSS.

## Features

- **Notion Integration**: Sync products directly from your Notion database
- **Asset Management**: Download and manage product images and PDFs from Google Drive and other sources
- **Label Printing**: Preview and print product labels in various sizes and formats
- **Product Management**: Search, filter, and organize your product catalog
- **Multi-Platform**: Works on both macOS and Windows

## Tech Stack

- **Frontend**: React, TypeScript, Tailwind CSS
- **Backend**: Electron
- **Database**: LowDB (JSON-based)
- **Integrations**: Notion API, Google Drive API

## Getting Started

### Prerequisites

- Node.js 18+
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

1. **Notion Setup**
   - Create a Notion integration at https://www.notion.so/my-integrations
   - Share your database with the integration
   - Add your API key in the app settings

2. **Google Drive Setup**
   - Create a Google Cloud project
   - Enable the Google Drive API
   - Create a service account and generate credentials
   - Add the service account JSON in the app settings

3. **Printer Configuration**
   - Configure your printers in the app settings
   - Set up label sizes and printing options

## Architecture

The application uses a two-process architecture:
- **Main Process**: Handles system operations (database, files, printing)
- **Renderer Process**: Manages the user interface
- **IPC Bridge**: Enables secure communication between processes

### Key Components

- **Notion Integration**: Syncs product data and downloads assets
- **Google Drive Handler**: Manages file downloads with multiple fallback methods
- **Asset Management**: Organizes downloaded files and generates previews
- **Print System**: Handles label formatting and printer communication

## Support

For issues and feature requests, please use the GitHub issue tracker.

## License

MIT License - see LICENSE file for details 

## Deployment and Releases

This project uses GitHub Actions to automate building and releasing the application for both macOS and Windows.

### Creating a New Release

1. Tag your commit with a version number:
   ```bash
   git tag v1.0.1
   git push origin v1.0.1
   ```

2. The GitHub Actions workflow will automatically:
   - Build the application for macOS and Windows
   - Package the builds into installers
   - Create a draft GitHub release with all artifacts

3. Review the draft release on GitHub, add release notes, and publish it.

### Manual Builds

You can also trigger builds manually by:
1. Going to the GitHub repository
2. Clicking on the "Actions" tab
3. Selecting the "Build and Release" workflow
4. Clicking "Run workflow" 