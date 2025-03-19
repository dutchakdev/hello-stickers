import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import axios from 'axios';
import { app } from 'electron';
import db from '../database/db';
import { downloadFile, extractFileId, downloadDriveFile, downloadDriveImage, directDownload } from './google-drive';
import { preparePdfPath, getAppUrl, preparePdfWithPreview, createPdfPreview } from './pdf-utils';
import { Product, Sticker } from '../database/db';
import { v4 as uuidv4 } from 'uuid';

// Simple function to make HTTP requests
function makeRequest(options, data = null): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let responseData = '';
      
      // Check for non-2xx status code
      if (res.statusCode < 200 || res.statusCode >= 300) {
        console.error(`HTTP error: ${res.statusCode} ${res.statusMessage}`);
        return reject(new Error(`HTTP error: ${res.statusCode} ${res.statusMessage}`));
      }
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          // Check if response data is empty
          if (!responseData || responseData.trim() === '') {
            console.error('Empty response from server');
            return resolve({}); // Return empty object instead of failing
          }
          
          const parsedData = JSON.parse(responseData);
          resolve(parsedData);
        } catch (error) {
          console.error('Failed to parse JSON response:', error.message);
          console.error('Raw response:', responseData);
          reject(new Error(`Failed to parse response: ${error.message}`));
        }
      });
    });
    
    req.on('error', (error) => {
      console.error('Request error:', error.message);
      reject(error);
    });
    
    // Set a timeout to prevent hanging requests
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('Request timeout after 30 seconds'));
    });
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

// Function to query Notion database
async function queryNotionDatabase(apiKey: string, databaseId: string): Promise<any[]> {
  try {
    const options = {
      hostname: 'api.notion.com',
      port: 443,
      path: `/v1/databases/${databaseId}/query`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28'
      }
    };
    
    const response = await makeRequest(options, {});
    
    // Check for API errors or missing results
    if (!response) {
      console.error('Empty response from Notion API');
      return [];
    }
    
    if (response.error) {
      console.error('Error from Notion API:', response.error);
      throw new Error(response.error.message || 'Unknown API error');
    }
    
    // Ensure results is an array
    if (!response.results) {
      console.error('Missing results in Notion API response:', response);
      return [];
    }
    
    return response.results;
  } catch (error) {
    console.error('Error querying Notion database:', error);
    return [];
  }
}

// Function to get a page from Notion
async function getNotionPage(apiKey: string, pageId: string): Promise<any> {
  const options = {
    hostname: 'api.notion.com',
    port: 443,
    path: `/v1/pages/${pageId}`,
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Notion-Version': '2022-06-28'
    }
  };
  
  return await makeRequest(options);
}

// Function to sync with Notion
export async function syncWithNotion() {
  try {
    console.log('Starting Notion sync...');
    
    // Get Notion settings
    const notionSettings = db.getNotionSetting();
    if (!notionSettings || !notionSettings.apiKey || !notionSettings.databaseId) {
      console.log('Notion settings not configured');
      return { success: false, message: 'Notion settings not configured' };
    }
    
    // Query Notion database for all products
    const results = await queryNotionDatabase(notionSettings.apiKey, notionSettings.databaseId);
    
    // Check if results is defined and is an array
    if (!results || !Array.isArray(results)) {
      console.error('Invalid response from Notion API:', results);
      return { success: false, message: 'Invalid response from Notion API' };
    }
    
    console.log(`Found ${results.length} products in Notion`);
    
    // Collect all sticker IDs to fetch their data
    const stickerIds: Set<string> = new Set();
    for (const page of results) {
      if (page.properties && page.properties.Stickers && 
          page.properties.Stickers.relation && Array.isArray(page.properties.Stickers.relation)) {
        page.properties.Stickers.relation.forEach(rel => {
          if (rel.id) stickerIds.add(rel.id);
        });
      }
    }
    
    // Fetch sticker pages
    const stickerPages: Record<string, any> = {};
    for (const stickerId of Array.from(stickerIds)) {
      try {
        const stickerPage = await getNotionPage(notionSettings.apiKey, stickerId);
        stickerPages[stickerId] = stickerPage;
      } catch (error) {
        console.error(`Error fetching sticker page ${stickerId}:`, error);
      }
    }
    
    // Attach sticker pages to product pages
    const enhancedResults = results.map(page => {
      const enhancedPage = { ...page, stickerPages: [] };
      
      if (page.properties && page.properties.Stickers && 
          page.properties.Stickers.relation && Array.isArray(page.properties.Stickers.relation)) {
        enhancedPage.stickerPages = page.properties.Stickers.relation
          .map(rel => stickerPages[rel.id])
          .filter(Boolean);
      }
      
      return enhancedPage;
    });
    
    // Process each product
    const results_stats = {
      created: 0,
      updated: 0,
      skipped: 0,
      errors: 0
    };
    
    for (const page of enhancedResults) {
      try {
        // Skip if title is empty
        if (!page.properties?.Name?.title?.length) {
          console.log('Skipping product with empty title');
          results_stats.skipped++;
          continue;
        }
        
        // Get existing product to determine if we're creating or updating
        const existingProduct = page.id ? db.getProduct(page.id) : null;
        
        // Process the product
        const processed = await processProduct(page, db);
        
        if (processed) {
          // Update stats based on whether this was a new product or updated one
          if (existingProduct) {
            results_stats.updated++;
          } else {
            results_stats.created++;
          }
        } else {
          results_stats.skipped++;
        }
      } catch (error) {
        console.error('Error processing product:', error);
        results_stats.errors++;
      }
    }
    
    // Save the database after processing all products
    await db.saveDatabase();
    
    // Update last synced timestamp
    await db.createOrUpdateNotionSetting({
      ...notionSettings,
      lastSyncedAt: new Date().toISOString()
    });
    
    console.log('Notion sync completed:', results_stats);
    
    return {
      success: true,
      message: `Sync completed: ${results_stats.created} created, ${results_stats.updated} updated, ${results_stats.skipped} skipped, ${results_stats.errors} errors`
    };
  } catch (error) {
    console.error('Error syncing with Notion:', error);
    return { success: false, message: `Error: ${error.message}` };
  }
}

// Function to extract standalone stickers from product properties
function extractStandaloneStickers(properties: any): any[] {
  const stickers: any[] = [];

  // Look for properties that match pattern "Sticker: {Label Name} (Label Size)"
  for (const [key, value] of Object.entries(properties)) {
    if (key.startsWith('Sticker:')) {
      // Extract label name and size from property name
      const match = key.match(/Sticker: (.*?) \((.*?)\)/);
      if (match) {
        const name = match[1];
        const size = match[2];
        
        // Get the PDF URL from the property
        let pdfUrl = '';
        if ((value as any).url) {
          pdfUrl = (value as any).url;
        } else if ((value as any).files && (value as any).files.length > 0) {
          pdfUrl = (value as any).files[0].file?.url || (value as any).files[0].external?.url || '';
        }
        
        if (pdfUrl) {
          stickers.push({ name, size, pdfUrl });
        }
      }
    }
  }

  return stickers;
}

// Function to process a product page
export async function processProduct(
  productPage: any,
  db: any
): Promise<Product | null> {
  try {
    const properties = productPage.properties;

    // Skip if there's no title
    if (!properties.Name?.title.length) {
      console.log(`Skipping product with empty title`);
      return null;
    }

    const sku = properties.SKU?.rich_text[0]?.plain_text || '';
    
    // Debugging for category property
    console.log(`Processing product: SKU ${sku}`);
    console.log(`Category property:`, properties.Category);
    
    // Try to find image URL from multiple potential field names
    let imageUrl = '';
    const possibleImageFields = ['Image Link', 'Preview Image', 'Image', 'Product Image', 'Preview'];
    for (const fieldName of possibleImageFields) {
      if (properties[fieldName]?.url) {
        imageUrl = properties[fieldName].url;
        console.log(`Found image URL in field "${fieldName}": ${imageUrl}`);
        break;
      } else if (properties[fieldName]?.files && properties[fieldName].files.length > 0) {
        // Check for files array (Notion images can be in files array)
        const fileUrl = properties[fieldName].files[0].file?.url || properties[fieldName].files[0].external?.url;
        if (fileUrl) {
          imageUrl = fileUrl;
          console.log(`Found image URL in field "${fieldName}" files array: ${imageUrl}`);
          break;
        }
      }
    }
    
    // Debug output all properties to find image fields
    console.log('All available properties:');
    for (const [key, value] of Object.entries(properties)) {
      console.log(`  Property: ${key}, Type: ${(value as any).type}`);
    }
    
    const productData = {
      id: productPage.id,
      name:
        properties.Name?.title[0]?.plain_text || 'Unnamed product',
      imageUrl: imageUrl, // Use our found image URL
      partNumber: properties['Part Number']?.rich_text[0]?.plain_text || '',
      sku: sku,
      description:
        properties.Description?.rich_text[0]?.plain_text || '',
      etsyLink: properties['Etsy Link']?.url || '',
      amazonLink: properties['Amazon Link']?.url || '',
      category: properties.Category?.select?.name || '',
      type: properties.Type?.select?.name || '',
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Set type to category if type is not defined, fallback to 'Unknown'
    if (!productData.type) {
      console.log(`Type not defined for ${productData.sku}, using category: ${productData.category || 'Unknown'}`);
      productData.type = productData.category || 'Unknown';
    }

    // Get existing product or create new one
    const existingProduct = db.getProduct(productData.id);
    let product;
    
    if (existingProduct) {
      product = await db.updateProduct(productData.id, {
        ...productData,
        version: existingProduct.version + 1,
        // Keep existing localImagePath if it exists and file exists
        localImagePath: existingProduct.localImagePath && fs.existsSync(existingProduct.localImagePath) 
          ? existingProduct.localImagePath 
          : null,
      });
      console.log(`Product updated: ${product.name} (${product.sku})`);
    } else {
      product = await db.createProduct(productData);
      console.log(`Product created: ${product.name} (${product.sku})`);
    }
    
    // Download image if URL is provided and either:
    // 1. We don't have a local path, or
    // 2. The local file doesn't exist
    if (productData.imageUrl && (!product.localImagePath || !fs.existsSync(product.localImagePath))) {
      console.log(`Downloading image for product ${product.sku} from ${productData.imageUrl}`);
      try {
        // Use the downloadAsset function which has better error handling
        const downloadResult = await downloadAsset(productData.imageUrl, 'image', product.sku || product.id);
        
        if (downloadResult) {
          // Update product with local image information
          await db.updateProduct(product.id, {
            localImagePath: downloadResult.localPath, 
            imageUrl: downloadResult.appUrl
          });
          console.log(`Updated product ${product.sku} with local image path: ${downloadResult.localPath}`);
        }
      } catch (error) {
        console.error(`Error downloading image for product ${product.sku}:`, error);
      }
    } else if (product.localImagePath && fs.existsSync(product.localImagePath)) {
      console.log(`Using existing image for product ${product.sku} at ${product.localImagePath}`);
    }
    
    // Process stickers (labels) for this product
    await processStickersForProduct(product.id, productPage, db);
    
    return product;
  } catch (error) {
    console.error('Error processing product:', error);
    return null;
  }
}

// Function to process all stickers for a product
async function processStickersForProduct(productId: string, productPage: any, db: any): Promise<void> {
  try {
    // First process any stickers from relation fields
    if (productPage.stickerPages && productPage.stickerPages.length > 0) {
      await processStickers(productId, productPage.stickerPages, db);
    }
    
    // Then process any standalone stickers from columns
    const properties = productPage.properties;
    const standaloneStickers: any[] = [];
    
    // Look for properties that match pattern "Sticker: {Label Name} (Label Size)"
    for (const [key, value] of Object.entries(properties)) {
      if (key.startsWith('Sticker:')) {
        // Extract label name and size from property name
        const match = key.match(/Sticker: (.*?) \((.*?)\)/);
        if (match) {
          const name = match[1];
          const size = match[2];
          
          // Get the PDF URL from the property
          let pdfUrl = '';
          if ((value as any).url) {
            pdfUrl = (value as any).url;
          } else if ((value as any).files && (value as any).files.length > 0) {
            pdfUrl = (value as any).files[0].file?.url || (value as any).files[0].external?.url || '';
          }
          
          if (pdfUrl) {
            console.log(`Found standalone sticker "${name}" (${size}) with PDF URL: ${pdfUrl}`);
            standaloneStickers.push({ name, size, pdfUrl });
          }
        }
      }
    }
    
    if (standaloneStickers.length > 0) {
      console.log(`Processing ${standaloneStickers.length} standalone stickers for product ${productId}`);
      await processStandaloneStickers(productId, standaloneStickers, db);
    } else if (!productPage.stickerPages || productPage.stickerPages.length === 0) {
      // If no stickers at all, create a default one with the product name
      const product = db.getProduct(productId);
      if (product) {
        const existingStickers = db.getStickers(productId);
        if (existingStickers.length === 0) {
          console.log(`Creating default sticker for product ${product.sku || productId}`);
          await db.createSticker({
            productId,
            name: product.name,
            size: '50x30mm',
            pdfUrl: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        }
      }
    }
  } catch (error) {
    console.error(`Error processing stickers for product ${productId}:`, error);
  }
}

// Function to process stickers from related pages
async function processStickers(productId: string, stickerPages: any[], db: any): Promise<Sticker[]> {
  try {
    if (!Array.isArray(stickerPages) || stickerPages.length === 0) {
      console.log(`No sticker pages provided for product ${productId}, creating default price tag`);
      
      // Create default price tag if no stickers provided
      const existingStickers = db.getStickers(productId);
      if (existingStickers.length === 0) {
        const defaultSticker: Sticker = {
          id: Date.now().toString(),
          productId,
          name: 'Price Tag',
          size: 'Default',
          pdfUrl: null,
          previewUrl: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        await db.createSticker(defaultSticker);
        console.log('Created default price tag sticker');
        return [defaultSticker];
      }
      
      return existingStickers;
    }
    
    const processedStickers: Sticker[] = [];
    
    // Process each sticker page
    for (const stickerPage of stickerPages) {
      try {
        // Extract sticker data
        const stickerName = getPropertyValue(stickerPage.properties, 'Name', 'title');
        const stickerSize = getPropertyValue(stickerPage.properties, 'Size', 'rich_text');
        const pdfUrl = getPropertyValue(stickerPage.properties, 'PDF URL', 'url');
        
        // Skip if no name
        if (!stickerName) {
          console.log(`Skipping sticker without name for product ${productId}`);
          continue;
        }
        
        console.log(`Processing sticker "${stickerName}" (${stickerSize || 'No size'}) for product ${productId}`);
        
        // Download PDF if URL provided
        let appPdfUrl: string | null = null;
        let appPreviewUrl: string | null = null;
        
        if (pdfUrl) {
          try {
            console.log(`Processing PDF from ${pdfUrl}`);
            const pdfDir = path.join(app.getPath('userData'), 'downloads', 'pdfs');
            
            if (!fs.existsSync(pdfDir)) {
              fs.mkdirSync(pdfDir, { recursive: true });
            }
            
            const fileName = `${productId}_${stickerName.replace(/\s+/g, '_')}.pdf`;
            const pdfPath = path.join(pdfDir, fileName);
            
            // Check if PDF already exists and is valid
            let pdfExists = false;
            if (fs.existsSync(pdfPath)) {
              const stats = fs.statSync(pdfPath);
              if (stats.size > 0) {
                console.log(`PDF already exists at ${pdfPath} with size ${stats.size} bytes, reusing it`);
                pdfExists = true;
              } else {
                console.log(`Existing PDF is empty, will re-download`);
                fs.unlinkSync(pdfPath);
              }
            }
            
            if (!pdfExists) {
              // Download and save the PDF file
              await downloadFile(pdfUrl, pdfPath);
              console.log(`PDF downloaded to: ${pdfPath}`);
            }
            
            // Generate app:// URLs for PDF and its preview
            appPdfUrl = `app://pdfs/${fileName}`;
            
            // Check if preview already exists
            const previewsDir = path.join(app.getPath('userData'), 'downloads', 'previews');
            const previewName = `${path.basename(fileName, '.pdf')}_preview.png`;
            const previewPath = path.join(previewsDir, previewName);
            
            if (fs.existsSync(previewPath)) {
              const stats = fs.statSync(previewPath);
              if (stats.size > 0) {
                console.log(`Preview already exists at ${previewPath}, reusing it`);
                appPreviewUrl = `app://previews/${previewName}`;
              } else {
                console.log(`Existing preview is empty, will regenerate`);
                fs.unlinkSync(previewPath);
              }
            }
            
            // Create preview image from PDF if it doesn't exist
            if (!appPreviewUrl) {
              appPreviewUrl = await createPdfPreview(pdfPath);
              console.log(`Generated new PDF preview: ${appPreviewUrl}`);
            }
          } catch (error) {
            console.error(`Error processing PDF for sticker "${stickerName}":`, error);
          }
        } else {
          console.log(`No PDF URL for sticker "${stickerName}"`);
        }
        
        // Create or update sticker
        const stickerId = stickerPage.id;
        const existingSticker = db.getStickers(productId).find(s => s.name === stickerName && s.size === stickerSize);
        
        const stickerData: Sticker = {
          id: stickerId,
          productId,
          name: stickerName,
          size: stickerSize || 'Standard',
          pdfUrl: appPdfUrl,
          previewUrl: appPreviewUrl,
          createdAt: existingSticker ? existingSticker.createdAt : new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        if (existingSticker) {
          await db.updateSticker(stickerId, stickerData);
          console.log(`Updated sticker: ${stickerName}`);
        } else {
          await db.createSticker(stickerData);
          console.log(`Created new sticker: ${stickerName}`);
        }
        
        processedStickers.push(stickerData);
      } catch (error) {
        console.error(`Error processing sticker page:`, error);
      }
    }
    
    return processedStickers;
  } catch (error) {
    console.error(`Error processing stickers for product ${productId}:`, error);
    return [];
  }
}

// Function to process standalone stickers
export async function processStandaloneStickers(productId: string, stickers: any[], db: any): Promise<Sticker[]> {
  try {
    if (!stickers || stickers.length === 0) return [];

    const result: Sticker[] = [];

    for (const stickerData of stickers) {
      try {
        const name = stickerData.name;
        const size = stickerData.size;
        const pdfUrl = stickerData.pdfUrl;
        
        console.log(`Processing standalone sticker "${name}" (${size}) with PDF: ${pdfUrl}`);
        
        // Generate a unique identifier for the sticker
        const stickerId = uuidv4();
        let localPdfPath = null;
        let previewUrl = null;
        
        // Download the PDF if URL is provided
        if (pdfUrl) {
          try {
            console.log(`Processing PDF from ${pdfUrl}`);
            
            // Generate a safe filename
            const safeProductId = productId.replace(/[^a-zA-Z0-9-_]/g, '_');
            const safeName = name.replace(/[^a-zA-Z0-9-_]/g, '_');
            const basename = `${safeProductId}_${safeName}`;
            
            // Check if we have an existing sticker with this PDF
            const existingSticker = db.getStickers(productId).find(s => s.name === name && s.size === size);
            if (existingSticker && existingSticker.localPdfPath && fs.existsSync(existingSticker.localPdfPath)) {
              const stats = fs.statSync(existingSticker.localPdfPath);
              if (stats.size > 0) {
                console.log(`Using existing PDF at ${existingSticker.localPdfPath}`);
                localPdfPath = existingSticker.localPdfPath;
                previewUrl = existingSticker.previewUrl;
                
                // If we have the PDF but no preview, regenerate the preview
                if (!previewUrl || !previewUrl.startsWith('app://previews/')) {
                  console.log(`Regenerating preview for existing PDF: ${localPdfPath}`);
                  const previewResult = await preparePdfWithPreview(localPdfPath);
                  if (previewResult) {
                    previewUrl = previewResult.previewUrl;
                    console.log(`Created preview at ${previewUrl}`);
                  }
                }
                
                // Skip the rest of PDF processing
                continue;
              }
            }
            
            // Use downloadAsset which now properly handles Google Drive files
            const downloadResult = await downloadAsset(pdfUrl, 'pdf', basename);
            
            if (downloadResult) {
              localPdfPath = downloadResult.localPath;
              
              // Generate preview from PDF if needed
              if (!previewUrl) {
                console.log(`Generating preview for PDF: ${localPdfPath}`);
                const previewResult = await preparePdfWithPreview(localPdfPath);
                if (previewResult) {
                  previewUrl = previewResult.previewUrl;
                  console.log(`Created preview at ${previewUrl}`);
                } else {
                  console.error(`Failed to create preview for ${localPdfPath}`);
                }
              }
            }
          } catch (error) {
            console.error(`Error processing PDF for sticker ${name}:`, error);
          }
        }

        // Get existing sticker or create new one
        const existingSticker = db.getStickers(productId).find(s => s.name === name && s.size === size);
        
        if (existingSticker) {
          // Update existing sticker
          const updatedSticker = await db.updateSticker(existingSticker.id, {
            name,
            size,
            pdfUrl: localPdfPath ? `app://pdfs/${path.basename(localPdfPath)}` : null,
            localPdfPath,
            previewUrl,
            updatedAt: new Date().toISOString(),
          });
          console.log(`Updated sticker: ${name}`);
          result.push(updatedSticker);
        } else {
          // Create new sticker
          const newSticker = await db.createSticker({
            productId,
            name,
            size,
            pdfUrl: localPdfPath ? `app://pdfs/${path.basename(localPdfPath)}` : null,
            localPdfPath,
            previewUrl,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          console.log(`Created new sticker: ${name}`);
          result.push(newSticker);
        }
      } catch (error) {
        console.error(`Error processing sticker:`, error);
      }
    }

    return result;
  } catch (error) {
    console.error('Error processing standalone stickers:', error);
    return [];
  }
}

// Get download directory for a specific file type
function getDownloadDir(type: 'images' | 'pdfs'): string {
  const downloadsPath = path.join(app.getPath('userData'), 'downloads');
  const typePath = path.join(downloadsPath, type);
  
  if (!fs.existsSync(typePath)) {
    fs.mkdirSync(typePath, { recursive: true });
  }
  
  return typePath;
}

// Function to retrieve a file directly from Notion
async function retrieveNotionFile(fileUrl: string, apiKey: string): Promise<Buffer | null> {
  if (!fileUrl || !fileUrl.includes('secure.notion-static.com')) {
    return null;
  }
  
  console.log(`Retrieving file directly from Notion: ${fileUrl}`);
  
  try {
    // Use axios to fetch with proper headers
    const response = await axios({
      method: 'GET',
      url: fileUrl,
      responseType: 'arraybuffer',
      timeout: 30000,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
        'Accept': '*/*'
      }
    });
    
    return Buffer.from(response.data);
  } catch (error) {
    console.error(`Error retrieving file from Notion:`, error.message);
    return null;
  }
}

// Download a file based on type
async function downloadAsset(url: string, type: 'image' | 'pdf', customName?: string): Promise<{ appUrl: string, localPath: string } | null> {
  try {
    if (!url) {
      console.log('No URL provided, skipping download');
      return null;
    }
    
    console.log(`Processing ${type} from ${url}`);
    
    // Determine file extension
    let ext = path.extname(url);
    if (!ext || ext === '.com' || ext.length > 5) {
      ext = type === 'image' ? '.png' : '.pdf';
    }
    
    // Generate filename
    const timestamp = Date.now();
    const filename = customName 
      ? `${customName}${ext}`
      : `${timestamp}_${Math.floor(Math.random() * 1000)}${ext}`;
    
    // Get download directory
    const downloadDir = getDownloadDir(type === 'image' ? 'images' : 'pdfs');
    const localPath = path.join(downloadDir, filename);
    
    // Check if file already exists with this name
    if (fs.existsSync(localPath)) {
      const stats = fs.statSync(localPath);
      if (stats.size > 0) {
        console.log(`File already exists at ${localPath} with size ${stats.size} bytes, reusing it`);
        return {
          appUrl: `app://${type === 'image' ? 'images' : 'pdfs'}/${filename}`,
          localPath
        };
      } else {
        console.log(`Existing file is empty, will re-download`);
        fs.unlinkSync(localPath); // Remove empty file
      }
    }
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(downloadDir)) {
      fs.mkdirSync(downloadDir, { recursive: true });
    }
    
    // Use different methods based on file type
    console.log(`Downloading ${type} to ${localPath}`);
    let success = false;
    
    try {
      if (type === 'image') {
        // Use ultra-direct method for images
        await directDownload(url, localPath);
        
        // Verify file is valid
        if (fs.existsSync(localPath)) {
          const stats = fs.statSync(localPath);
          if (stats.size > 0) {
            console.log(`Successfully downloaded image (${stats.size} bytes) to ${localPath}`);
            success = true;
          } else {
            console.log(`Downloaded image file is empty, will try alternative methods`);
          }
        }
        
        // If direct download failed for images, try alternative methods
        if (!success) {
          console.log(`Trying alternative image download methods for ${url}`);
          
          // Try Notion direct retrieval if it's a Notion URL
          if (url.includes('notion-static.com')) {
            try {
              console.log(`URL appears to be from Notion, trying direct retrieval`);
              const notionSettings = db.getNotionSetting();
              if (notionSettings && notionSettings.apiKey) {
                const fileData = await retrieveNotionFile(url, notionSettings.apiKey);
                if (fileData && fileData.length > 0) {
                  fs.writeFileSync(localPath, fileData);
                  console.log(`Successfully retrieved file from Notion (${fileData.length} bytes)`);
                  success = true;
                }
              }
            } catch (notionError) {
              console.error(`Notion direct retrieval failed: ${notionError.message}`);
            }
          }
          
          // Is this a Google Drive URL?
          if (!success) {
            const fileId = extractFileId(url);
            if (fileId) {
              try {
                console.log(`Detected Google Drive URL, using Drive-specific image download for ID: ${fileId}`);
                await downloadDriveImage(fileId, localPath);
                success = true;
              } catch (driveError) {
                console.error(`Google Drive image download failed: ${driveError.message}`);
              }
            }
          }
          
          // Try direct axios download as last resort
          if (!success) {
            try {
              console.log(`Trying direct axios download as last resort`);
              const response = await axios({
                method: 'GET',
                url,
                responseType: 'arraybuffer',
                timeout: 30000,
                maxRedirects: 5,
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                  'Accept': 'image/*,*/*;q=0.8'
                }
              });
              
              // Check for HTML response
              const firstBytes = Buffer.from(response.data).slice(0, 100).toString().toLowerCase();
              if (!firstBytes.includes('<!doctype html>') && !firstBytes.includes('<html')) {
                fs.writeFileSync(localPath, Buffer.from(response.data));
                const stats = fs.statSync(localPath);
                if (stats.size > 0) {
                  console.log(`Successfully downloaded image with direct axios (${stats.size} bytes)`);
                  success = true;
                }
              } else {
                console.log(`Received HTML instead of image data`);
              }
            } catch (axiosError) {
              console.error(`Direct axios download failed: ${axiosError.message}`);
            }
          }
        }
      } else {
        // Use standard method for PDFs
        await downloadFile(url, localPath);
        success = true;
      }
    } catch (downloadError) {
      console.error(`Error during download: ${downloadError.message}`);
    }
    
    // Check if download was successful
    if (!success) {
      console.error(`All download methods failed for ${url}`);
      return null;
    }
    
    // Generate app URL
    const appUrl = `app://${type === 'image' ? 'images' : 'pdfs'}/${filename}`;
    
    console.log(`Downloaded ${type} to ${localPath}, app URL: ${appUrl}`);
    
    return {
      appUrl,
      localPath
    };
  } catch (error) {
    console.error(`Error downloading ${type}:`, error);
    return null;
  }
}

// Function to download file from URL to local path
export async function downloadFileFromUrl(url: string, localPath: string): Promise<string> {
  try {
    console.log(`Downloading file from ${url} to ${localPath}`);
    
    // Check if this is a Google Drive URL
    const fileId = extractFileId(url);
    if (fileId) {
      console.log(`Detected Google Drive URL, extracted file ID: ${fileId}`);
      
      // Check if this is an image file
      const isImage = localPath.match(/\.(jpe?g|png|gif|webp|bmp|svg)$/i) !== null;
      if (isImage) {
        console.log(`Detected image file, using image-specific download method`);
        return await downloadDriveImage(fileId, localPath);
      } else {
        // Use Drive API to download
        return await downloadDriveFile(fileId, localPath);
      }
    } else {
      // Regular download for non-Drive URLs
      return await downloadFile(url, localPath);
    }
  } catch (error) {
    console.error('Error downloading file:', error);
    throw error;
  }
}

// Helper function to get property value from Notion properties
function getPropertyValue(properties: any, property: string, type: string): any {
  if (!properties || !properties[property]) {
    return null;
  }

  const prop = properties[property];

  switch (type) {
    case 'title':
      return prop.title && prop.title.length > 0 ? prop.title[0].plain_text : null;
    case 'rich_text':
      return prop.rich_text && prop.rich_text.length > 0 ? prop.rich_text[0].plain_text : null;
    case 'select':
      return prop.select ? prop.select.name : null;
    case 'multi_select':
      return prop.multi_select ? prop.multi_select.map((item: any) => item.name) : [];
    case 'url':
      return prop.url || null;
    case 'number':
      return prop.number !== undefined ? prop.number : null;
    default:
      return null;
  }
}

export async function processProducts(page: any[], db: any): Promise<void> {
  try {
    if (!page) {
      console.log('No products provided');
      return;
    }

    console.log(`Processing ${page.length} products`);

    for (const productPage of page) {
      await processProduct(productPage, db);
    }
  } catch (error) {
    console.error('Error processing products:', error);
  }
} 