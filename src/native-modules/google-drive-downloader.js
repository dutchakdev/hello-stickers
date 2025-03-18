/**
 * Google Drive Downloader
 * This script is designed to be run as a separate process to download files from Google Drive
 * It uses the googleapis library directly, avoiding webpack issues
 * 
 * Usage: node google-drive-downloader.js [credentials-path] [file-id] [output-path]
 */

const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const https = require('https');
const axios = require('axios').default;

// Main function to download a file
async function downloadFile(credentialsPath, fileId, outputPath) {
    console.log(`Starting download of file ${fileId} to ${outputPath}`);

    // Create output directory if it doesn't exist
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    try {
        // Load credentials
        console.log(`Reading credentials from ${credentialsPath}`);
        const serviceAccountJson = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));

        // Create auth client
        const auth = new google.auth.GoogleAuth({
            credentials: serviceAccountJson,
            scopes: ['https://www.googleapis.com/auth/drive.readonly']
        });

        // Create drive client
        const drive = google.drive({ version: 'v3', auth });

        // Maximum retry count
        const maxRetries = 3;
        let retries = 0;
        let success = false;

        while (retries <= maxRetries && !success) {
            try {
                // Try to get file metadata first to check if we have access
                console.log(`Getting metadata for file ${fileId}`);
                try {
                    const metadata = await drive.files.get({
                        fileId: fileId,
                        fields: 'name, mimeType, size, webContentLink, exportLinks'
                    });

                    console.log(`Found file: ${metadata.data.name} (${metadata.data.mimeType})`);

                    // If we have a webContentLink, we could potentially use it
                    if (metadata.data.webContentLink) {
                        console.log(`File has a web content link: ${metadata.data.webContentLink}`);
                    }

                    // For Google Docs format files, we might need to export them
                    if (metadata.data.exportLinks) {
                        console.log(`File has export links:`, metadata.data.exportLinks);
                    }
                } catch (metadataError) {
                    console.error(`Error getting file metadata: ${metadataError.message}`);
                    console.log('Will attempt direct download anyway');
                }

                // Create a write stream for the output file
                const dest = fs.createWriteStream(outputPath);

                // Get the file content
                console.log(`Downloading file content (attempt ${retries + 1})`);
                try {
                    const res = await drive.files.get(
                        { fileId, alt: 'media' },
                        { responseType: 'stream' }
                    );

                    // Track progress and pipe to file
                    let progress = 0;

                    // Create a promise to wait for the download to complete
                    await new Promise((resolve, reject) => {
                        res.data
                            .on('data', (chunk) => {
                                progress += chunk.length;
                                if (progress % 1000000 === 0) { // Log progress every ~1MB
                                    console.log(`Download progress: ${Math.round(progress / 1000000)}MB`);
                                }
                            })
                            .on('error', (err) => {
                                dest.close();
                                if (fs.existsSync(outputPath)) {
                                    fs.unlinkSync(outputPath);
                                }
                                reject(err);
                            })
                            .pipe(dest)
                            .on('finish', () => {
                                console.log(`Download completed successfully`);
                                resolve();
                            })
                            .on('error', (err) => {
                                dest.close();
                                if (fs.existsSync(outputPath)) {
                                    fs.unlinkSync(outputPath);
                                }
                                reject(err);
                            });
                    });

                    // Verify file was downloaded successfully
                    if (fs.existsSync(outputPath)) {
                        const stats = fs.statSync(outputPath);
                        if (stats.size > 0) {
                            console.log(`File downloaded successfully: ${outputPath} (${stats.size} bytes)`);
                            success = true;
                        } else {
                            throw new Error('Downloaded file is empty');
                        }
                    } else {
                        throw new Error('File was not created');
                    }
                } catch (downloadError) {
                    console.error(`API download failed: ${downloadError.message}`);
                    dest.close();

                    // If API download fails, try direct download methods
                    console.log('Trying alternative direct download method...');
                    await tryDirectDownload(fileId, outputPath);

                    // Verify file was downloaded successfully
                    if (fs.existsSync(outputPath)) {
                        const stats = fs.statSync(outputPath);
                        if (stats.size > 0) {
                            console.log(`File downloaded successfully via direct method: ${outputPath} (${stats.size} bytes)`);
                            success = true;
                        } else {
                            throw new Error('Downloaded file is empty');
                        }
                    } else {
                        throw new Error('Direct download failed - file was not created');
                    }
                }
            } catch (error) {
                retries++;

                console.error(`Download attempt ${retries} failed: ${error.message}`);

                if (retries <= maxRetries) {
                    // Wait before retrying (exponential backoff)
                    const waitTime = Math.pow(2, retries) * 1000;
                    console.log(`Retrying in ${waitTime / 1000} seconds...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                } else {
                    // Max retries reached, rethrow the error
                    console.error('Maximum retries reached, giving up');
                    throw error;
                }
            }
        }

        return outputPath;
    } catch (error) {
        console.error(`Error downloading file: ${error.message}`);
        if (error.stack) {
            console.error(error.stack);
        }

        // Try one last direct download method if all else failed
        try {
            console.log('Trying final direct download method...');
            await tryDirectDownload(fileId, outputPath, true);

            // Verify file was downloaded successfully
            if (fs.existsSync(outputPath)) {
                const stats = fs.statSync(outputPath);
                if (stats.size > 0) {
                    console.log(`File downloaded successfully with final method: ${outputPath} (${stats.size} bytes)`);
                    return outputPath;
                }
            }
        } catch (directError) {
            console.error(`Final direct download attempt failed: ${directError.message}`);
        }

        // Create an empty file to indicate the download was attempted
        if (!fs.existsSync(outputPath)) {
            fs.writeFileSync(outputPath, '');
            console.log(`Created empty placeholder file at ${outputPath}`);
        }

        throw error;
    }
}

// Function to try direct download methods
async function tryDirectDownload(fileId, outputPath, isLastAttempt = false) {
    const methods = [
        // Method 1: Direct download link
        async () => {
            const url = `https://drive.google.com/uc?export=download&id=${fileId}`;
            console.log(`Trying direct download: ${url}`);

            const response = await axios({
                method: 'GET',
                url,
                responseType: 'arraybuffer',
                maxRedirects: 5,
                timeout: 60000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
                    'Accept': '*/*'
                }
            });

            // Check if we got HTML rather than file data
            const data = response.data;
            const firstBytes = Buffer.from(data).slice(0, 100).toString().toLowerCase();
            if (firstBytes.includes('<!doctype html>') || firstBytes.includes('<html')) {
                throw new Error('Received HTML response instead of file data');
            }

            await fs.promises.writeFile(outputPath, Buffer.from(data));
        },

        // Method 2: With confirm parameter
        async () => {
            const url = `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`;
            console.log(`Trying direct download with confirm: ${url}`);

            const response = await axios({
                method: 'GET',
                url,
                responseType: 'arraybuffer',
                maxRedirects: 5,
                timeout: 60000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
                    'Accept': '*/*'
                }
            });

            // Check if we got HTML rather than file data
            const data = response.data;
            const firstBytes = Buffer.from(data).slice(0, 100).toString().toLowerCase();
            if (firstBytes.includes('<!doctype html>') || firstBytes.includes('<html')) {
                throw new Error('Received HTML response instead of file data');
            }

            await fs.promises.writeFile(outputPath, Buffer.from(data));
        },

        // Method 3: With cookies to bypass virus scan warning
        async () => {
            // First get cookies from the file view page
            console.log(`Getting cookies for file ${fileId}`);
            const cookieResponse = await axios.get(`https://drive.google.com/file/d/${fileId}/view`, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36'
                }
            });

            // Extract cookies
            let cookies = '';
            if (cookieResponse.headers['set-cookie']) {
                const cookieArray = Array.isArray(cookieResponse.headers['set-cookie'])
                    ? cookieResponse.headers['set-cookie']
                    : [cookieResponse.headers['set-cookie']];

                cookies = cookieArray.join('; ');
            }

            // Get the download token from the page if available
            let confirmToken = '';
            if (typeof cookieResponse.data === 'string' && cookieResponse.data.includes('export=download')) {
                const match = cookieResponse.data.match(/confirm=([0-9A-Za-z]+)/);
                if (match) {
                    confirmToken = match[1];
                }
            }

            const url = confirmToken
                ? `https://drive.google.com/uc?export=download&id=${fileId}&confirm=${confirmToken}`
                : `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`;

            console.log(`Trying direct download with cookies: ${url}`);

            const response = await axios({
                method: 'GET',
                url,
                responseType: 'arraybuffer',
                maxRedirects: 5,
                timeout: 60000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
                    'Cookie': cookies,
                    'Accept': '*/*'
                }
            });

            await fs.promises.writeFile(outputPath, Buffer.from(response.data));
        }
    ];

    if (isLastAttempt) {
        // Add last-resort method
        methods.push(async () => {
            // Try an alternative API endpoint approach
            const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
            console.log(`Trying final API method: ${url}`);

            const response = await axios({
                method: 'GET',
                url,
                responseType: 'arraybuffer',
                timeout: 60000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
                    'Accept': '*/*'
                }
            });

            await fs.promises.writeFile(outputPath, Buffer.from(response.data));
        });
    }

    // Try each method until one works
    let lastError = null;
    for (let i = 0; i < methods.length; i++) {
        try {
            await methods[i]();

            // Check if file exists and has content
            if (fs.existsSync(outputPath)) {
                const stats = fs.statSync(outputPath);
                if (stats.size > 0) {
                    console.log(`Direct download method ${i + 1} succeeded: ${outputPath} (${stats.size} bytes)`);
                    return true;
                } else {
                    throw new Error('Downloaded file is empty');
                }
            }
        } catch (error) {
            console.error(`Direct download method ${i + 1} failed: ${error.message}`);
            lastError = error;
        }
    }

    throw new Error(`All direct download methods failed: ${lastError?.message || 'Unknown error'}`);
}

// Entry point when run from command line
async function main() {
    // Check arguments
    if (process.argv.length < 5) {
        console.error('Usage: node google-drive-downloader.js [credentials-path] [file-id] [output-path]');
        process.exit(1);
    }

    const credentialsPath = process.argv[2];
    const fileId = process.argv[3];
    const outputPath = process.argv[4];

    try {
        await downloadFile(credentialsPath, fileId, outputPath);
        console.log('Download completed successfully');
        process.exit(0);
    } catch (error) {
        console.error('Download failed:', error.message);
        process.exit(1);
    }
}

// Run the main function if this is the main module
if (require.main === module) {
    main().catch(error => {
        console.error('Unhandled error:', error);
        process.exit(1);
    });
}

// Export the download function for potential direct use
module.exports = { downloadFile }; 