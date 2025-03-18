const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

class GoogleDriveAPI {
    constructor() {
        this.drive = null;
    }

    /**
     * Initialize the Google Drive API client with service account credentials
     * @param {Object} serviceAccountJson - The parsed service account JSON
     */
    initialize(serviceAccountJson) {
        try {
            const auth = new google.auth.GoogleAuth({
                credentials: serviceAccountJson,
                scopes: ['https://www.googleapis.com/auth/drive.readonly']
            });

            this.drive = google.drive({ version: 'v3', auth });
            console.log('Google Drive API initialized successfully');
            return true;
        } catch (error) {
            console.error('Error initializing Google Drive API:', error);
            return false;
        }
    }

    /**
     * Download a file from Google Drive by its ID
     * @param {string} fileId - The Google Drive file ID
     * @param {string} downloadPath - Path where to save the downloaded file
     */
    async downloadFile(fileId, downloadPath) {
        if (!this.drive) {
            throw new Error('Google Drive API not initialized');
        }

        console.log(`Downloading file ${fileId} to ${downloadPath}`);

        try {
            // Create destination directory if it doesn't exist
            const dir = path.dirname(downloadPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            const dest = fs.createWriteStream(downloadPath);

            const res = await this.drive.files.get(
                { fileId, alt: 'media' },
                { responseType: 'stream' }
            );

            return new Promise((resolve, reject) => {
                res.data
                    .on('error', err => {
                        dest.close();
                        fs.unlinkSync(downloadPath);
                        reject(err);
                    })
                    .pipe(dest)
                    .on('finish', () => {
                        console.log(`File downloaded successfully to ${downloadPath}`);
                        resolve(downloadPath);
                    })
                    .on('error', err => {
                        dest.close();
                        fs.unlinkSync(downloadPath);
                        reject(err);
                    });
            });
        } catch (error) {
            console.error(`Error downloading file ${fileId}:`, error);
            throw error;
        }
    }

    /**
     * Get file metadata from Google Drive
     * @param {string} fileId - The Google Drive file ID
     */
    async getFileMetadata(fileId) {
        if (!this.drive) {
            throw new Error('Google Drive API not initialized');
        }

        try {
            const response = await this.drive.files.get({
                fileId,
                fields: 'id, name, mimeType, webContentLink, webViewLink'
            });

            return response.data;
        } catch (error) {
            console.error(`Error getting file metadata for ${fileId}:`, error);
            throw error;
        }
    }

    /**
     * Extract file ID from Google Drive URL
     * @param {string} url - Google Drive URL
     * @returns {string|null} - The file ID or null if not found
     */
    extractFileId(url) {
        if (!url) return null;

        // Handle different formats of Google Drive URLs
        const patterns = [
            /\/file\/d\/([^\/\?]+)/,                 // .../file/d/FILE_ID/...
            /id=([^&]+)/,                           // ...?id=FILE_ID&...
            /\/open\?id=([^&]+)/,                   // .../open?id=FILE_ID...
            /drive\.google\.com\/([^\/\?&]+)/       // ...drive.google.com/FILE_ID...
        ];

        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match && match[1]) {
                return match[1];
            }
        }

        return null;
    }
}

module.exports = new GoogleDriveAPI(); 