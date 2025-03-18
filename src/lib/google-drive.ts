/**
 * Google Drive API Module
 * Handles downloading files from Google Drive
 */
import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';
import { URL } from 'url';
import db from '../database/db';

/**
 * Extract the Google Drive file ID from various URL formats
 * @param url Google Drive URL
 * @returns File ID or null if not a valid Google Drive URL
 */
export function extractFileId(url: string): string | null {
  if (!url) return null;
  
  // Regular expressions for different Google Drive URL formats
  const patterns = [
    // Format: https://drive.google.com/file/d/{fileId}/view
    /drive\.google\.com\/file\/d\/([^/]+)/,
    // Format: https://drive.google.com/open?id={fileId}
    /drive\.google\.com\/open\?id=([^&]+)/,
    // Format: https://docs.google.com/document/d/{fileId}/edit
    /docs\.google\.com\/(document|spreadsheets|presentation)\/d\/([^/]+)/,
    // Format: /uc?export=view&id={fileId}
    /\/uc\?export=view&id=([^&]+)/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      // For document/spreadsheet/presentation URLs, the file ID is in group 2
      return pattern.toString().includes('docs\\.google\\.com') ? match[2] : match[1];
    }
  }

  return null;
}

/**
 * Download a file from a URL to a local path
 * @param url The URL to download from
 * @param filePath The local path to save the file
 * @returns Promise that resolves to the file path
 */
export function downloadFile(url: string, filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // Handle direct file URLs
    if (url.startsWith('file://')) {
      const srcPath = url.replace('file://', '');
      try {
        fs.copyFileSync(srcPath, filePath);
        resolve(filePath);
      } catch (error) {
        reject(error);
      }
      return;
    }

    // Create the directory if it doesn't exist
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Parse URL
    const parsedUrl = new URL(url);
    const protocol = parsedUrl.protocol === 'https:' ? https : require('http');

    // Set request options with a user agent
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    };

    // Handle redirects ourselves
    const request = protocol.get(options, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302 || response.statusCode === 303) {
        const redirectUrl = response.headers.location;
        if (!redirectUrl) {
          reject(new Error('Redirect with no location header'));
          return;
        }
        
        console.log(`Following redirect from ${url} to ${redirectUrl}`);
        
        // Recursively follow redirects
        downloadFile(redirectUrl, filePath)
          .then(resolve)
          .catch(reject);
        return;
      }

      // Check for successful response
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download file: HTTP ${response.statusCode}`));
        return;
      }

      // Create write stream and pipe response to it
      const fileStream = fs.createWriteStream(filePath);
      response.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close();
        resolve(filePath);
      });

      fileStream.on('error', (error) => {
        fs.unlink(filePath, () => {}); // Delete the file if there was an error
        reject(error);
      });
    });

    request.on('error', (error) => {
      fs.unlink(filePath, () => {}); // Delete the file if there was an error
      reject(error);
    });

    request.end();
  });
}

/**
 * Get direct download URL for Google Drive using advanced technique
 * This works better than the simple URL with export=download
 */
function getDriveAdvancedDownloadUrl(fileId: string): string {
  // This is a more reliable approach for bypassing Google's download protections
  // Uses the "export" feature with cookies that bypass the virus scan warning
  return `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t&uuid=${Date.now()}`;
}

/**
 * Download a file from Google Drive using its file ID
 * @param fileId Google Drive file ID
 * @param filePath Local path to save the file
 * @returns Promise that resolves to the file path
 */
export async function downloadDriveFile(fileId: string, filePath: string): Promise<string> {
  console.log(`Downloading file from Google Drive: ${fileId}`);
  
  try {
    // Create directory if it doesn't exist
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Use direct download with parameters to bypass virus scan
    const directUrl = getDriveAdvancedDownloadUrl(fileId);
    
    // Download the file
    console.log(`Downloading from direct URL: ${directUrl}`);
    return await downloadFile(directUrl, filePath);
  } catch (error) {
    console.error('Error downloading file from Google Drive:', error);
    throw error;
  }
} 