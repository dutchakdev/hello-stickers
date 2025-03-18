/**
 * Google Drive API Module
 * Handles downloading files from Google Drive
 */
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import db from '../database/db';
import { preparePdfWithPreview } from './pdf-utils';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

/**
 * Extract the Google Drive file ID from various URL formats
 * @param url Google Drive URL
 * @returns File ID or null if not a valid Google Drive URL
 */
export function extractFileId(url: string): string | null {
  if (!url) return null;
  
  console.log(`Extracting file ID from URL: ${url}`);
  
  // Try to extract directly from URL parameter
  try {
    const urlObj = new URL(url);
    if (urlObj.searchParams.has('id')) {
      const id = urlObj.searchParams.get('id');
      if (id && id.length > 20) {  // Google Drive IDs are usually long
        console.log(`Extracted file ID from URL parameter: ${id}`);
        return id;
      }
    }
    
    // Handle special case for Google Drive "open" URLs
    if (urlObj.hostname === 'drive.google.com' && urlObj.pathname === '/open') {
      const id = urlObj.searchParams.get('id');
      if (id) {
        console.log(`Extracted file ID from /open URL: ${id}`);
        return id;
      }
    }
    
    // Extract from path segments for file URLs
    if (urlObj.hostname === 'drive.google.com' && urlObj.pathname.includes('/file/d/')) {
      const pathParts = urlObj.pathname.split('/');
      const fileIdIndex = pathParts.indexOf('d') + 1;
      if (fileIdIndex < pathParts.length) {
        const id = pathParts[fileIdIndex];
        console.log(`Extracted file ID from path segments: ${id}`);
        return id;
      }
    }
  } catch (e) {
    // URL parsing failed, continue with regex approaches
    console.log(`URL parsing failed, trying regex patterns`);
  }
  
  // Regular expressions for different Google Drive URL formats
  const patterns = [
    // Format: https://drive.google.com/file/d/{fileId}/view
    /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/,
    // Format: https://drive.google.com/open?id={fileId}
    /drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/,
    // Format: https://docs.google.com/document/d/{fileId}/edit
    /docs\.google\.com\/(document|spreadsheets|presentation)\/d\/([a-zA-Z0-9_-]+)/,
    // Format: https://drive.google.com/uc?export=view&id={fileId}
    /drive\.google\.com\/uc\?.*id=([a-zA-Z0-9_-]+)/,
    // Format: https://drive.google.com/drive/folders/{fileId}
    /drive\.google\.com\/drive\/folders\/([a-zA-Z0-9_-]+)/,
    // Format: id={fileId} (any URL with id parameter)
    /[?&]id=([a-zA-Z0-9_-]+)/,
    // Format: /d/{fileId}/ (common pattern in various Drive URLs)
    /\/d\/([a-zA-Z0-9_-]{25,})\/?/,
    // Format: /file/d/{fileId}?
    /\/file\/d\/([a-zA-Z0-9_-]{25,})\??/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      // For document/spreadsheet/presentation URLs, the file ID is in group 2
      const fileId = pattern.toString().includes('docs\\.google\\.com') ? match[2] : match[1];
      console.log(`Extracted file ID: ${fileId} using pattern: ${pattern}`);
      return fileId;
    }
  }

  // Last resort - try to find anything that looks like a Drive file ID (typically 33+ chars)
  const lastResortMatch = url.match(/([a-zA-Z0-9_-]{28,})/);
  if (lastResortMatch) {
    console.log(`Extracted potential file ID using last resort pattern: ${lastResortMatch[1]}`);
    return lastResortMatch[1];
  }

  console.log(`Could not extract file ID from URL: ${url}`);
  return null;
}

/**
 * Download a file from a URL to a local path
 * With special handling for Google Drive URLs
 * @param url The URL to download from
 * @param filePath The local path to save the file
 * @returns Promise that resolves to the file path
 */
export async function downloadFile(url: string, filePath: string): Promise<string> {
  console.log(`Downloading file from URL: ${url} to ${filePath}`);
  
  // Create directory if it doesn't exist
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  // Check if it's a Google Drive URL
  const fileId = extractFileId(url);
  if (fileId && url.includes('google.com')) {
    console.log(`URL is a Google Drive URL, downloading with ID: ${fileId}`);
    
    // Check if this is an image file
    const isImage = filePath.match(/\.(jpe?g|png|gif|webp|bmp|svg)$/i) !== null;
    if (isImage) {
      console.log(`Detected image file, using image-specific download method`);
      return downloadDriveImage(fileId, filePath);
    } else {
      return downloadDriveFile(fileId, filePath);
    }
  }
  
  // For non-Google Drive URLs, use Axios to download
  try {
    const response = await axios({
      method: 'GET',
      url: url,
      responseType: 'arraybuffer',
      timeout: 30000,
      maxRedirects: 5,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': '*/*'
      }
    });
    
    // Write file to disk
    await fs.promises.writeFile(filePath, Buffer.from(response.data));
    
    // Verify file exists and has content
    const stats = fs.statSync(filePath);
    if (stats.size > 0) {
      console.log(`Successfully downloaded file (${stats.size} bytes) to ${filePath}`);
      return filePath;
    } else {
      throw new Error('Downloaded file is empty');
    }
  } catch (error) {
    console.error(`Error downloading file from ${url}:`, error.message);
    throw error;
  }
}

/**
 * Try to generate a preview for a PDF file
 * @param filePath Path to the PDF file
 */
async function generatePreview(filePath: string): Promise<void> {
  try {
    console.log(`Creating preview for PDF: ${filePath}`);
    const previewResult = await preparePdfWithPreview(filePath);
    if (previewResult) {
      console.log(`Successfully created preview at ${previewResult.previewUrl}`);
    }
  } catch (error) {
    console.error(`Failed to create preview:`, error.message);
  }
}

/**
 * Run the download helper script directly as a child process
 * This avoids webpack bundling issues with the googleapis library
 * @param fileId Google Drive file ID
 * @param filePath Output file path
 * @returns Promise that resolves to the file path
 */
async function downloadWithNativeHelper(fileId: string, filePath: string): Promise<string> {
  try {
    // Get Google Drive settings
    const googleDriveSettings = db.getGoogleDriveSetting();
    
    if (!googleDriveSettings || !googleDriveSettings.serviceAccountJson) {
      throw new Error('Google Drive service account not configured');
    }
    
    // Create temporary credentials file
    const tempDir = path.join(path.dirname(filePath), '.tmp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Use a timestamp to make the credentials file unique
    const timestamp = Date.now();
    const credentialsPath = path.join(tempDir, `credentials-${timestamp}.json`);
    
    // Write credentials to temporary file
    fs.writeFileSync(credentialsPath, googleDriveSettings.serviceAccountJson);
    console.log(`Wrote temporary credentials to ${credentialsPath}`);
    
    try {
      // Get path to the native-modules directory
      // First try electron app location
      const appDir = path.dirname(process.execPath);
      const nativeModulesDir = path.join(appDir, 'resources', 'app', 'src', 'native-modules');
      
      // If that doesn't exist, we're in dev mode, use current directory
      let scriptPath = path.join(nativeModulesDir, 'google-drive-downloader.js');
      
      if (!fs.existsSync(scriptPath)) {
        // For development, find the script relative to the current file
        const devModulesDir = path.join(__dirname, '..', 'native-modules');
        scriptPath = path.join(devModulesDir, 'google-drive-downloader.js');
        
        if (!fs.existsSync(scriptPath)) {
          throw new Error(`Could not find Google Drive downloader script at ${scriptPath}`);
        }
      }
      
      console.log(`Using download script at ${scriptPath}`);
      
      // Execute the downloader script as a separate process
      const cmd = `node "${scriptPath}" "${credentialsPath}" "${fileId}" "${filePath}"`;
      console.log(`Executing command: ${cmd}`);
      
      const { stdout, stderr } = await execPromise(cmd);
      
      if (stderr) {
        console.error(`Script stderr: ${stderr}`);
      }
      
      console.log(`Script stdout: ${stdout}`);
      
      // Check if the file was downloaded successfully
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        if (stats.size > 0) {
          console.log(`File downloaded successfully via helper script: ${filePath} (${stats.size} bytes)`);
          return filePath;
        }
      }
      
      throw new Error('File download completed but file is empty or missing');
    } finally {
      // Clean up the temporary credentials file
      try {
        if (fs.existsSync(credentialsPath)) {
          fs.unlinkSync(credentialsPath);
          console.log(`Removed temporary credentials file: ${credentialsPath}`);
        }
      } catch (cleanupError) {
        console.error(`Failed to remove temporary credentials: ${cleanupError.message}`);
      }
    }
  } catch (error) {
    console.error(`Error using native helper for download: ${error.message}`);
    throw error;
  }
}

/**
 * Download a file from Google Drive using the native module
 * @param fileId Google Drive file ID
 * @param filePath Local path to save the file
 * @returns Promise that resolves to the file path
 */
export async function downloadDriveFile(fileId: string, filePath: string): Promise<string> {
  console.log(`Downloading file from Google Drive with ID: ${fileId} to ${filePath}`);
  
  // Create directory if it doesn't exist
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  const isPdf = filePath.toLowerCase().endsWith('.pdf');
  
  try {
    // First approach: Try to use the native-modules/google-drive-api.js directly
    try {
      console.log('Attempting to use native Google Drive API module');
      
      // Load the native module dynamically to avoid webpack issues
      const apiModulePath = path.join(__dirname, '..', 'native-modules', 'google-drive-api.js');
      console.log(`Loading Google Drive API module from: ${apiModulePath}`);
      
      // Use require with the full path to avoid webpack processing
      const nativeModule = require(apiModulePath);
      
      if (nativeModule && typeof nativeModule.initialize === 'function') {
        // Get Google Drive settings
        const googleDriveSettings = db.getGoogleDriveSetting();
        
        if (googleDriveSettings && googleDriveSettings.serviceAccountJson) {
          console.log('Found Google Drive service account settings');
          
          // Initialize with service account
          const serviceAccountJson = JSON.parse(googleDriveSettings.serviceAccountJson);
          const initialized = nativeModule.initialize(serviceAccountJson);
          
          if (initialized) {
            console.log('Successfully initialized native Google Drive API module');
            
            // Download the file
            await nativeModule.downloadFile(fileId, filePath);
            
            // Check if file was downloaded successfully
            if (fs.existsSync(filePath)) {
              const stats = fs.statSync(filePath);
              if (stats.size > 0) {
                console.log(`File downloaded successfully: ${filePath} (${stats.size} bytes)`);
                
                // Generate preview for PDFs
                if (isPdf) {
                  await generatePreview(filePath);
                }
                
                return filePath;
              }
            }
          }
        }
      }
    } catch (nativeError) {
      console.error('Error using native Google Drive API module:', nativeError.message);
    }
    
    // Second approach: Use the helper script outside of webpack
    try {
      console.log('Attempting to use helper script for download');
      const result = await downloadWithNativeHelper(fileId, filePath);
      
      // Generate preview for PDFs
      if (isPdf) {
        await generatePreview(filePath);
      }
      
      return result;
    } catch (helperError) {
      console.error('Error using helper script:', helperError.message);
    }
    
    // Third approach: Fall back to direct download methods
    console.log('Falling back to direct download methods');
    const result = await downloadWithDirectMethods(fileId, filePath, isPdf);
    return result;
  } catch (error) {
    console.error(`Error downloading from Google Drive:`, error.message);
    
    // Try direct download methods as a fallback
    try {
      console.log('Trying direct download methods as fallback');
      const result = await downloadWithDirectMethods(fileId, filePath, isPdf);
      return result;
    } catch (directError) {
      console.error(`Direct download methods also failed:`, directError.message);
      
      // Create an empty file to prevent further download attempts
      fs.writeFileSync(filePath, '');
      console.log(`Created empty placeholder file at ${filePath}`);
      
      throw new Error(`Failed to download file from Google Drive: ${error.message}`);
    }
  }
}

/**
 * Download a file from Google Drive using direct methods
 * @param fileId Google Drive file ID
 * @param filePath Local path to save the file
 * @param isPdf Whether the file is a PDF
 * @returns Promise that resolves to the file path
 */
async function downloadWithDirectMethods(fileId: string, filePath: string, isPdf: boolean): Promise<string> {
    // Create directory if it doesn't exist
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
  // Try multiple direct download methods
  const errors: Error[] = [];
  
  // Method 1: Direct export download
  try {
    console.log(`Method 1: Direct export download for file ${fileId}`);
    const url = `https://drive.google.com/uc?export=download&id=${fileId}`;
    
    const response = await axios({
      method: 'GET',
      url,
      responseType: 'arraybuffer',
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
        'Accept': '*/*'
      }
    });
    
    // Check if we got an HTML response (means download warning)
    const responseData = response.data;
    const isHtml = Buffer.isBuffer(responseData) && 
                   responseData.slice(0, 100).toString().toLowerCase().includes('<!doctype html>');
    
    if (isHtml) {
      console.log('Received HTML response (likely download warning), trying other methods');
      throw new Error('Received HTML warning page instead of file content');
    }
    
    await fs.promises.writeFile(filePath, Buffer.from(responseData));
    
    // Verify file exists and has content
    const stats = fs.statSync(filePath);
    if (stats.size > 0) {
      console.log(`Method 1 succeeded: Downloaded file (${stats.size} bytes) to ${filePath}`);
      
      // Generate preview for PDFs
      if (isPdf) {
        await generatePreview(filePath);
      }
      
      return filePath;
    } else {
      throw new Error('Downloaded file is empty');
    }
  } catch (error) {
    console.error(`Method 1 failed:`, error.message);
    errors.push(error);
  }
  
  // Method 2: With cookies to bypass virus scan warning
  try {
    console.log(`Method 2: Using cookies bypass for file ${fileId}`);
    // First get cookies from the file view page
    const cookieResponse = await axios.get(`https://drive.google.com/file/d/${fileId}/view`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36'
      }
    });
    
    // Extract NID cookie
    let nidCookie = '';
    const cookies = cookieResponse.headers['set-cookie'];
    if (cookies) {
      const cookieArray = Array.isArray(cookies) ? cookies : [cookies];
      for (const cookie of cookieArray) {
        if (cookie.includes('NID=')) {
          nidCookie = cookie.split(';')[0];
          break;
        }
      }
    }
    
    // Get the download token from the page
    let confirmToken = '';
    if (typeof cookieResponse.data === 'string' && cookieResponse.data.includes('export=download')) {
      const match = cookieResponse.data.match(/confirm=([0-9A-Za-z]+)/);
      if (match) {
        confirmToken = match[1];
      }
    }
    
    // Use cookies with confirm parameter
    const downloadUrl = confirmToken 
      ? `https://drive.google.com/uc?export=download&id=${fileId}&confirm=${confirmToken}`
      : `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`;
    
    console.log(`Using download URL: ${downloadUrl} with cookies: ${nidCookie}`);
    
    const response = await axios({
      method: 'GET',
      url: downloadUrl,
      responseType: 'arraybuffer',
      timeout: 60000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
        'Cookie': nidCookie,
        'Accept': '*/*'
      }
    });
    
    await fs.promises.writeFile(filePath, Buffer.from(response.data));
    
    // Verify file exists and has content
    const stats = fs.statSync(filePath);
    if (stats.size > 0) {
      console.log(`Method 2 succeeded: Downloaded file (${stats.size} bytes) to ${filePath}`);
      
      // Generate preview for PDFs
      if (isPdf) {
        await generatePreview(filePath);
      }
      
      return filePath;
    } else {
      throw new Error('Downloaded file is empty');
    }
  } catch (error) {
    console.error(`Method 2 failed:`, error.message);
    errors.push(error);
  }
  
  // Method 3: Using alternate APIs
  try {
    console.log(`Method 3: Using alternate download URL for file ${fileId}`);
    const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
    
    const response = await axios({
      method: 'GET',
      url: downloadUrl,
      responseType: 'arraybuffer',
      timeout: 60000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
        'Accept': '*/*'
      }
    });
    
    await fs.promises.writeFile(filePath, Buffer.from(response.data));
    
    // Verify file exists and has content
    const stats = fs.statSync(filePath);
    if (stats.size > 0) {
      console.log(`Method 3 succeeded: Downloaded file (${stats.size} bytes) to ${filePath}`);
      
      // Generate preview for PDFs
      if (isPdf) {
        await generatePreview(filePath);
      }
      
      return filePath;
    } else {
      throw new Error('Downloaded file is empty');
    }
  } catch (error) {
    console.error(`Method 3 failed:`, error.message);
    errors.push(error);
  }
  
  // If we get here, all methods failed
  // Create an empty file to prevent repeated download attempts
  fs.writeFileSync(filePath, '');
  console.error(`All download methods failed for file ID ${fileId}. Created empty placeholder.`);
  
  throw new Error(`All download methods failed: ${errors.map(e => e.message).join(', ')}`);
}

/**
 * Special method for downloading images from Google Drive
 * Uses direct image URLs that bypass authentication
 * @param fileId Google Drive file ID
 * @param filePath Path to save the image
 * @returns Promise that resolves to the file path
 */
export async function downloadDriveImage(fileId: string, filePath: string): Promise<string> {
  console.log(`Downloading image from Google Drive with ID: ${fileId} to ${filePath}`);
  
  // Create directory if it doesn't exist
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  // Various direct image URLs to try
  const imageUrls = [
    // Direct image and thumbnail URLs
    `https://drive.google.com/thumbnail?id=${fileId}&sz=w2000`,
    `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`,
    `https://lh3.googleusercontent.com/d/${fileId}=w2000`,
    `https://lh3.googleusercontent.com/d/${fileId}`,
    `https://drive.google.com/uc?export=view&id=${fileId}`,
    `https://drive.google.com/uc?export=download&id=${fileId}`,
    // Alternative format
    `https://drive.google.com/uc?id=${fileId}&export=download`,
    // With added timestamp to avoid cache
    `https://drive.google.com/uc?export=download&id=${fileId}&ts=${Date.now()}`,
  ];
  
  let lastError = null;
  
  // Try each URL until one works
  for (const url of imageUrls) {
    try {
      console.log(`Trying direct image URL: ${url}`);
      
      const response = await axios({
        method: 'GET',
        url,
        responseType: 'arraybuffer',
        timeout: 30000,
        maxRedirects: 5,
        headers: {
          // Using a browser-like User-Agent
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
          'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
          'Referer': 'https://drive.google.com/'
        }
      });
      
      // Check if we got an HTML response (Google redirect/login page)
      const firstBytes = Buffer.from(response.data).slice(0, 100).toString().toLowerCase();
      if (firstBytes.includes('<!doctype html>') || firstBytes.includes('<html')) {
        console.log(`Received HTML instead of image data, trying next URL`);
        continue;
      }
      
      // Write file to disk
      await fs.promises.writeFile(filePath, Buffer.from(response.data));
      
      // Verify file exists and has content
      const stats = fs.statSync(filePath);
      if (stats.size > 0) {
        // Check if the file looks like an image
        const validImage = !firstBytes.includes('<?xml') && !firstBytes.includes('<!doctype');
        if (validImage) {
          console.log(`Successfully downloaded image (${stats.size} bytes) to ${filePath}`);
          return filePath;
        } else {
          console.log(`Downloaded file doesn't appear to be an image, trying next URL`);
          continue;
        }
      }
      
      console.log(`Downloaded file was empty, trying next URL`);
    } catch (error) {
      console.error(`Error downloading image from ${url}:`, error.message);
      lastError = error;
    }
  }
  
  // Try with cookies approach
  try {
    console.log(`Trying cookie-based download for image ${fileId}`);
    
    // First get cookies from the file view page
    const cookieResponse = await axios.get(`https://drive.google.com/file/d/${fileId}/view`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36'
      }
    });
    
    // Extract cookies
    let cookieStr = '';
    const cookies = cookieResponse.headers['set-cookie'];
    if (cookies) {
      const cookieArray = Array.isArray(cookies) ? cookies : [cookies];
      cookieStr = cookieArray.join('; ');
    }
    
    // Use cookies with download URL
    const url = `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`;
    const response = await axios({
      method: 'GET',
      url,
      responseType: 'arraybuffer',
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
        'Cookie': cookieStr,
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8'
      }
    });
    
    // Check if we got an HTML response
    const firstBytes = Buffer.from(response.data).slice(0, 100).toString().toLowerCase();
    if (firstBytes.includes('<!doctype html>') || firstBytes.includes('<html')) {
      throw new Error('Received HTML response from cookie method');
    }
    
    // Write file to disk
    await fs.promises.writeFile(filePath, Buffer.from(response.data));
    
    // Verify file exists and has content
    const stats = fs.statSync(filePath);
    if (stats.size > 0) {
      console.log(`Successfully downloaded image with cookies (${stats.size} bytes) to ${filePath}`);
      return filePath;
    }
  } catch (error) {
    console.error(`Cookie-based download failed:`, error.message);
  }
  
  // If direct methods failed, try using an alternative extension
  for (const ext of ['.jpg', '.png', '.jpeg']) {
    try {
      const altPath = filePath.replace(/\.[^/.]+$/, "") + ext;
      console.log(`Trying with alternative extension: ${ext} to ${altPath}`);
      
      // Try a simple export URL
      const url = `https://drive.google.com/uc?export=download&id=${fileId}`;
      const response = await axios({
        method: 'GET',
        url,
        responseType: 'arraybuffer',
        timeout: 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
          'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8'
        }
      });
      
      // Write file to disk 
      await fs.promises.writeFile(altPath, Buffer.from(response.data));
      
      // Verify file exists and has content
      const stats = fs.statSync(altPath);
      if (stats.size > 0) {
        // Copy to original path if needed
        if (altPath !== filePath) {
          fs.copyFileSync(altPath, filePath);
        }
        console.log(`Successfully downloaded image with alt extension (${stats.size} bytes) to ${filePath}`);
        return filePath;
      }
    } catch (error) {
      console.error(`Alternative extension attempt failed:`, error.message);
    }
  }
  
  // If all direct methods failed, try the regular download method as fallback
  try {
    console.log(`Direct image URLs failed, trying regular download method`);
    return await downloadDriveFile(fileId, filePath);
  } catch (error) {
    console.error(`Regular download also failed:`, error.message);
    
    // Create placeholder image if all methods failed
    try {
      console.log(`Creating placeholder image for failed download`);
      // Create a simple 1x1 transparent PNG as placeholder
      const placeholder = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
      fs.writeFileSync(filePath, placeholder);
      console.log(`Created placeholder image at ${filePath}`);
      return filePath;
    } catch (placeholderError) {
      console.error(`Failed to create placeholder:`, placeholderError.message);
      
      // Create an empty file to prevent repeated download attempts
      fs.writeFileSync(filePath, '');
      console.log(`Created empty placeholder file at ${filePath}`);
    }
    
    throw new Error(`Failed to download image: ${lastError?.message || 'Unknown error'}`);
  }
}

/**
 * Ultra simple direct file download for any URL
 * No Google Drive special handling, just direct download
 * @param url URL to download from
 * @param filePath Path to save the file to
 * @returns Promise resolving to the file path
 */
export async function directDownload(url: string, filePath: string): Promise<string> {
  console.log(`Direct downloading file from ${url} to ${filePath}`);
  
  // Create directory if it doesn't exist
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  try {
    // Simple axios download with no special handling
    const response = await axios({
      method: 'GET',
      url: url,
      responseType: 'arraybuffer',
      timeout: 30000,
      maxRedirects: 5,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'image/*,application/pdf,*/*;q=0.8',
      }
    });
    
    // Check if we got an HTML response instead of an image or PDF
    const firstBytes = Buffer.from(response.data).slice(0, 100).toString().toLowerCase();
    if (firstBytes.includes('<!doctype html>') || firstBytes.includes('<html')) {
      console.log('Received HTML response instead of expected file format');
      
      // This is likely a redirect page or error
      if (url.includes('drive.google.com') || url.includes('docs.google.com')) {
        // If this is a Google Drive URL, use the proper Drive-specific method instead
        const fileId = extractFileId(url);
        if (fileId) {
          console.log(`Detected Google Drive URL, switching to dedicated download method with file ID: ${fileId}`);
          
          // Check if this is an image file
          const isImage = filePath.match(/\.(jpe?g|png|gif|webp|bmp|svg)$/i) !== null;
          if (isImage) {
            return downloadDriveImage(fileId, filePath);
          } else {
            return downloadDriveFile(fileId, filePath);
          }
        }
      }
      
      throw new Error('Received HTML response instead of expected file content');
    }
    
    // Write file to disk
    fs.writeFileSync(filePath, Buffer.from(response.data));
    
    // Verify file exists and has content
    const stats = fs.statSync(filePath);
    if (stats.size > 0) {
      console.log(`Successfully downloaded file (${stats.size} bytes) to ${filePath}`);
      return filePath;
    } else {
      throw new Error('Downloaded file is empty');
    }
  } catch (error) {
    console.error(`Error in direct download from ${url}:`, error.message);
    
    // Try using the Google Drive specific method if this appears to be a Google URL
    if ((url.includes('drive.google.com') || url.includes('docs.google.com')) && !error.message.includes('tried Google Drive method')) {
      try {
        const fileId = extractFileId(url);
        if (fileId) {
          console.log(`Trying Google Drive specific download for ID: ${fileId}`);
          
          // Check if this is an image file
          const isImage = filePath.match(/\.(jpe?g|png|gif|webp|bmp|svg)$/i) !== null;
          if (isImage) {
            return downloadDriveImage(fileId, filePath);
          } else {
            return downloadDriveFile(fileId, filePath);
          }
        }
      } catch (driveError) {
        console.error(`Google Drive download also failed: ${driveError.message}`);
        error.message += ' and tried Google Drive method';
      }
    }
    
    throw error;
  }
} 