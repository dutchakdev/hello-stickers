import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import axios from 'axios';
import { app } from 'electron';
import db from '../database/db';
import { downloadFile, extractFileId, downloadDriveFile } from './google-drive';
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
        const processed = await processProduct(page, db);
        if (processed) {
          const action = processed.action || (processed.id ? 'updated' : 'created');
          if (action === 'created') results_stats.created++;
          else if (action === 'updated') results_stats.updated++;
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
async function processProduct(productPage: any, db: any) {
  try {
    const productData = extractProductData(productPage);
    
    // Skip products without SKU
    if (!productData.sku) {
      console.log(`Skipping product without SKU: ${productData.name || 'Unnamed'}`);
      return null;
    }
    
    // Debugging for category property
    console.log(`Processing product: SKU ${productData.sku}`);
    console.log(`Category property:`, productPage.properties.Category);
    
    // Ensure type is set properly (fallback to category or 'Unknown')
    if (!productData.type && productData.category) {
      productData.type = productData.category;
      console.log(`Using category "${productData.category}" as type for product ${productData.sku}`);
    } else if (!productData.type) {
      productData.type = 'Unknown';
      console.log(`Using default "Unknown" type for product ${productData.sku}`);
    }
    
    // Download image if available
    if (productData.imageUrl) {
      try {
        const downloadResult = await downloadAsset(productData.imageUrl, 'image', productData.sku);
        if (downloadResult) {
          // Store both the app:// URL and the local path
          productData.imageUrl = downloadResult.appUrl;
          productData.localImagePath = downloadResult.localPath;
          console.log(`Updated image URL to ${productData.imageUrl}`);
        }
      } catch (error) {
        console.error(`Error downloading image for product ${productData.sku}:`, error);
      }
    }
    
    // Check for existing product
    const existingProduct = db.getProduct(productData.id);
    
    let product;
    let action: 'created' | 'updated';
    
    if (existingProduct) {
      // Update existing product
      console.log(`Updating existing product: ${productData.sku}`);
      // Increment version
      productData.version = (existingProduct.version || 0) + 1;
      product = await db.updateProduct(existingProduct.id, productData);
      action = 'updated';
    } else {
      // Create new product
      console.log(`Creating new product: ${productData.sku}`);
      productData.version = 1;
      productData.createdAt = new Date().toISOString();
      productData.updatedAt = new Date().toISOString();
      product = await db.createProduct(productData);
      action = 'created';
    }
    
    if (product) {
      // Process stickers from relations
      await processStickers(product.id, productPage.stickerPages || [], db);
      
      // Process standalone stickers from product properties
      const standaloneStickers = extractStandaloneStickers(productPage.properties);
      if (standaloneStickers.length > 0) {
        console.log(`Found ${standaloneStickers.length} standalone stickers for ${product.sku}`);
        await processStandaloneStickers(product.id, standaloneStickers, db);
      }
    }
    
    return { ...product, action };
  } catch (error) {
    console.error('Error processing product:', error);
    return null;
  }
}

// Function to extract product data from a Notion page
function extractProductData(productPage: any) {
  const properties = productPage.properties;
  
  return {
    id: productPage.id,
    notionId: productPage.id,
    name: properties.Name?.title[0]?.plain_text || 'Unnamed Product',
    sku: properties.SKU?.rich_text[0]?.plain_text || '',
    barcode: properties.Barcode?.rich_text[0]?.plain_text || '',
    price: properties.Price?.number || 0,
    imageUrl: properties['Image Link']?.url || '',
    partNumber: properties['Part Number']?.rich_text[0]?.plain_text || '',
    description: properties.Description?.rich_text[0]?.plain_text || '',
    etsyLink: properties['Etsy Link']?.url || '',
    amazonLink: properties['Amazon Link']?.url || '',
    category: properties.Category?.select?.name || '',
    type: properties.Type?.select?.name || '',
    tags: properties.Tags?.multi_select?.map(tag => tag.name) || []
  };
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
            console.log(`Downloading PDF from ${pdfUrl}`);
            const pdfDir = path.join(app.getPath('userData'), 'downloads', 'pdfs');
            
            if (!fs.existsSync(pdfDir)) {
              fs.mkdirSync(pdfDir, { recursive: true });
            }
            
            const fileName = `${productId}_${stickerName.replace(/\s+/g, '_')}.pdf`;
            const pdfPath = path.join(pdfDir, fileName);
            
            // Download and save the PDF file
            await downloadFile(pdfUrl, pdfPath);
            console.log(`PDF downloaded to: ${pdfPath}`);
            
            // Generate app:// URLs for PDF and its preview
            appPdfUrl = `app://pdfs/${fileName}`;
            
            // Create preview image from PDF
            appPreviewUrl = await createPdfPreview(pdfPath);
            console.log(`PDF preview URL: ${appPreviewUrl}`);
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

    for (const stickerPage of stickers) {
      const properties = stickerPage.properties;
      
      const name = properties.Name.title[0]?.plain_text || 'Unnamed sticker';
      const size = properties.Size?.rich_text[0]?.plain_text || '';
      const pdfUrl = properties['PDF Link']?.url || null;
            
      // Generate a unique identifier for the sticker
      const stickerId = uuidv4();
      let localPdfPath = null;
      let previewUrl = null;
      
      // Download the PDF if URL is provided
      if (pdfUrl) {
        try {
          const downloadResult = await downloadAsset(pdfUrl, 'pdf');
          
          if (downloadResult) {
            localPdfPath = downloadResult.localPath;
            
            // Generate preview
            const result = await preparePdfWithPreview(localPdfPath);
            if (result) {
              previewUrl = result.previewUrl;
            }
          }
        } catch (error) {
          console.error(`Error downloading PDF for sticker ${name}:`, error);
        }
      }

      // Check if sticker already exists
      const existingSticker = db.getStickers(productId).find(s => s.name === name && s.size === size);
      
      if (existingSticker) {
        // Update existing sticker
        const updatedSticker = db.updateSticker(existingSticker.id, {
          name,
          size,
          pdfUrl,
          localPdfPath,
          previewUrl,
          updatedAt: new Date().toISOString(),
        });
        result.push(updatedSticker);
      } else {
        // Create new sticker
        const newSticker = db.createSticker({
          productId,
          name,
          size,
          pdfUrl,
          localPdfPath,
          previewUrl,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        result.push(newSticker);
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

// Download a file based on type
async function downloadAsset(url: string, type: 'image' | 'pdf', customName?: string): Promise<{ appUrl: string, localPath: string } | null> {
  try {
    if (!url) return null;
    
    console.log(`Downloading ${type} from ${url}`);
    
    // Determine file extension
    let ext = path.extname(url);
    if (!ext) {
      ext = type === 'image' ? '.jpg' : '.pdf';
    }
    
    // Generate filename
    const timestamp = Date.now();
    const filename = customName 
      ? `${customName}${ext}`
      : `${timestamp}_${Math.floor(Math.random() * 1000)}${ext}`;
    
    // Get download directory
    const downloadDir = getDownloadDir(type === 'image' ? 'images' : 'pdfs');
    const localPath = path.join(downloadDir, filename);
    
    // Download the file
    await downloadFile(url, localPath);
    
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
      // Use Drive API to download
      return await downloadDriveFile(fileId, localPath);
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

export async function processProduct(
  productPage: any,
  db: any
): Promise<Product | null> {
  try {
    const properties = productPage.properties;

    const sku = properties.SKU?.rich_text[0]?.plain_text || '';
    
    // Debugging for category property
    console.log(`Processing product: SKU ${sku}`);
    console.log(`Category property:`, properties.Category);
    
    const productData = {
      id: productPage.id,
      name:
        properties.Name?.title[0]?.plain_text || 'Unnamed product',
      imageUrl: properties['Image Link']?.url || '',
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

    // Create product in database
    const product = db.getProduct(productData.id);
    
    if (product) {
      const updatedProduct = db.updateProduct(productData.id, {
        ...productData,
        version: product.version + 1,
      });
      console.log(
        `Product updated: ${updatedProduct.name} (${updatedProduct.sku})`
      );
      return updatedProduct;
    } else {
      const newProduct = db.createProduct(productData);
      // Download the image if URL is provided
      if (productData.imageUrl) {
        await downloadAsset(productData.imageUrl, 'image', productData.sku);
      }
      console.log(`Product created: ${newProduct.name} (${newProduct.sku})`);
      return newProduct;
    }
  } catch (error) {
    console.error('Error processing product:', error);
    return null;
  }
} 