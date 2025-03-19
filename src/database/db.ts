// Persistent database module using lowdb
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { AppSetting } from './schema';

// Data types
export interface Product {
  id: string;
  name: string;
  sku: string;
  type: string;
  barcode?: string;
  price?: number;
  category?: string;
  description?: string;
  imageUrl?: string;
  localImagePath?: string;
  tags?: string[];
  notionId?: string;
}

export interface Sticker {
  id: string;
  productId: string;
  name: string;
  size: string;
  pdfUrl: string | null;
  localPdfPath?: string;
  localPreviewPath?: string;
  previewUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PrinterSetting {
  id: string;
  size: string;
  printerName: string;
  options: {
    media?: string;
    orientation?: number;
    fitToPage?: boolean;
    printScaling?: string;
  };
}

export interface NotionSetting {
  id: string;
  apiKey: string;
  databaseId: string;
  lastSyncedAt?: string;
}

export interface GoogleDriveSetting {
  id: string;
  serviceAccountJson: string;
}

// Database schema
interface DatabaseSchema {
  products: Product[];
  stickers: Sticker[];
  printerSettings: PrinterSetting[];
  notionSetting: NotionSetting | null;
  googleDriveSetting: GoogleDriveSetting | null;
  appSettings: AppSetting[];
}

// Default data
const defaultData: DatabaseSchema = {
  products: [],
  stickers: [],
  printerSettings: [
    {
      id: '1',
      size: '50x30mm',
      printerName: 'Default Printer',
      options: {
        media: 'Custom.50x30mm',
        orientation: 3,
        fitToPage: true,
        printScaling: 'auto'
      }
    }
  ],
  notionSetting: {
    id: '1',
    apiKey: '',
    databaseId: '',
    lastSyncedAt: null
  },
  googleDriveSetting: {
    id: '1',
    serviceAccountJson: ''
  },
  appSettings: []
};

// Database instance
let db: Low<DatabaseSchema>;
let isInitialized = false;

// Get the app data directory
const getDbPath = () => {
  const userDataPath = app?.getPath('userData') || path.join(process.cwd(), 'userData');
  const dbDir = path.join(userDataPath, 'db');
  
  // Create db directory if it doesn't exist
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  
  return path.join(dbDir, 'database.json');
};

// Helper to save the database
export const saveDatabase = async (): Promise<void> => {
  if (!db) {
    throw new Error('Database not initialized');
  }
  
  console.log('Saving database...');
  try {
    await db.write();
    console.log('Database saved successfully');
  } catch (error) {
    console.error('Error saving database:', error);
    throw error;
  }
};

// Database methods
const dbMethods = {
  initDatabase() {
    try {
      if (isInitialized) return true;
      
      const dbPath = getDbPath();
      const adapter = new JSONFile<DatabaseSchema>(dbPath);
      db = new Low<DatabaseSchema>(adapter, defaultData);
      
      // Load the database
      try {
        db.read();
      } catch (error) {
        console.error('Error reading database, creating new one:', error);
        db.data = defaultData;
        db.write();
      }
      
      // Initialize default settings if not present
      if (!db.data.notionSetting) {
        db.data.notionSetting = defaultData.notionSetting;
      }
      
      if (!db.data.googleDriveSetting) {
        db.data.googleDriveSetting = defaultData.googleDriveSetting;
      }
      
      // Ensure printerSettings is initialized
      if (!Array.isArray(db.data.printerSettings) || db.data.printerSettings.length === 0) {
        db.data.printerSettings = defaultData.printerSettings;
      }
      
      // Ensure appSettings is initialized
      if (!Array.isArray(db.data.appSettings)) {
        db.data.appSettings = [];
      }
      
      db.write();
      isInitialized = true;
      console.log('Database initialized at', dbPath);
      return true;
    } catch (error) {
      console.error('Failed to initialize database:', error);
      return false;
    }
  },

  // Products
  getProducts() {
    if (!isInitialized) this.initDatabase();
    console.log(`Fetching ${db.data.products.length} products`);
    return db.data.products;
  },

  getProductsByType(type: string) {
    if (!isInitialized) this.initDatabase();
    const filteredProducts = db.data.products.filter(p => p.type === type);
    console.log(`Fetching ${filteredProducts.length} products of type ${type}`);
    return filteredProducts;
  },

  searchProducts(query: string) {
    if (!isInitialized) this.initDatabase();
    const lowerQuery = query.toLowerCase();
    const results = db.data.products.filter(p => 
      p.name.toLowerCase().includes(lowerQuery) || 
      p.sku.toLowerCase().includes(lowerQuery) || 
      (p.barcode && p.barcode.toLowerCase().includes(lowerQuery))
    );
    console.log(`Search for "${query}" returned ${results.length} products`);
    return results;
  },

  getProduct(id: string) {
    if (!isInitialized) this.initDatabase();
    const product = db.data.products.find(p => p.id === id) || null;
    console.log(`Fetching product with ID ${id}: ${product ? 'found' : 'not found'}`);
    return product;
  },

  getProductBySku(sku: string) {
    if (!isInitialized) this.initDatabase();
    const product = db.data.products.find(p => p.sku === sku) || null;
    console.log(`Fetching product with SKU ${sku}: ${product ? 'found' : 'not found'}`);
    return product;
  },

  async createProduct(product: Omit<Product, 'id'>) {
    if (!isInitialized) this.initDatabase();
    const newProduct = {
      ...product,
      id: Date.now().toString()
    };
    db.data.products.push(newProduct);
    await saveDatabase();
    console.log(`Created new product with ID ${newProduct.id}`);
    return newProduct;
  },

  async updateProduct(id: string, data: Partial<Product>) {
    if (!isInitialized) this.initDatabase();
    const index = db.data.products.findIndex(p => p.id === id);
    if (index !== -1) {
      db.data.products[index] = { ...db.data.products[index], ...data };
      await saveDatabase();
      console.log(`Updated product with ID ${id}`);
      return db.data.products[index];
    }
    console.log(`Failed to update product: ID ${id} not found`);
    return null;
  },

  async deleteProduct(id: string) {
    if (!isInitialized) this.initDatabase();
    const index = db.data.products.findIndex(p => p.id === id);
    if (index !== -1) {
      db.data.products.splice(index, 1);
      await saveDatabase();
      console.log(`Deleted product with ID ${id}`);
      return true;
    }
    console.log(`Failed to delete product: ID ${id} not found`);
    return false;
  },

  // Stickers
  getStickers(productId: string) {
    if (!isInitialized) this.initDatabase();
    const stickers = db.data.stickers.filter(s => s.productId === productId);
    console.log(`Fetching ${stickers.length} stickers for product ${productId}`);
    return stickers;
  },

  getSticker(id: string) {
    if (!isInitialized) this.initDatabase();
    const sticker = db.data.stickers.find(s => s.id === id) || null;
    console.log(`Fetching sticker with ID ${id}: ${sticker ? 'found' : 'not found'}`);
    return sticker;
  },

  async createSticker(sticker: Omit<Sticker, 'id'>): Promise<Sticker> {
    if (!isInitialized) this.initDatabase();
    const id = Date.now().toString();
    const newSticker: Sticker = {
      id,
      ...sticker
    };
    
    db.data.stickers.push(newSticker);
    await saveDatabase();
    console.log(`Created new sticker with ID ${id}`);
    return newSticker;
  },

  async updateSticker(id: string, updates: Partial<Omit<Sticker, 'id' | 'productId'>>): Promise<Sticker | null> {
    if (!isInitialized) this.initDatabase();
    const index = db.data.stickers.findIndex(s => s.id === id);
    if (index === -1) return null;
    
    const updatedSticker = { ...db.data.stickers[index], ...updates };
    db.data.stickers[index] = updatedSticker;
    await saveDatabase();
    console.log(`Updated sticker with ID ${id}`);
    return updatedSticker;
  },

  async deleteSticker(id: string) {
    if (!isInitialized) this.initDatabase();
    const index = db.data.stickers.findIndex(s => s.id === id);
    if (index !== -1) {
      db.data.stickers.splice(index, 1);
      await saveDatabase();
      console.log(`Deleted sticker with ID ${id}`);
      return true;
    }
    console.log(`Failed to delete sticker: ID ${id} not found`);
    return false;
  },

  // Printer settings
  getPrinterSettings() {
    if (!isInitialized) this.initDatabase();
    console.log(`Fetching ${db.data.printerSettings.length} printer settings`);
    return db.data.printerSettings;
  },

  getPrinterSetting(size: string) {
    if (!isInitialized) this.initDatabase();
    const setting = db.data.printerSettings.find(p => p.size === size) || null;
    console.log(`Fetching printer setting for size ${size}: ${setting ? 'found' : 'not found'}`);
    return setting;
  },

  async createPrinterSetting(setting: Omit<PrinterSetting, 'id'>) {
    if (!isInitialized) this.initDatabase();
    const newSetting = { ...setting, id: Date.now().toString() } as PrinterSetting;
    db.data.printerSettings.push(newSetting);
    await saveDatabase();
    console.log(`Created new printer setting with size ${setting.size}`);
    return newSetting;
  },

  async deletePrinterSetting(size: string) {
    if (!isInitialized) this.initDatabase();
    const index = db.data.printerSettings.findIndex(p => p.size === size);
    if (index !== -1) {
      db.data.printerSettings.splice(index, 1);
      await saveDatabase();
      console.log(`Deleted printer setting with size ${size}`);
      return true;
    }
    console.log(`Failed to delete printer setting: size ${size} not found`);
    return false;
  },

  // Notion settings
  getNotionSetting() {
    if (!isInitialized) this.initDatabase();
    console.log(`Fetching Notion settings: ${db.data.notionSetting ? 'found' : 'not found'}`);
    return db.data.notionSetting;
  },

  async createOrUpdateNotionSetting(setting: Omit<NotionSetting, 'id'>) {
    if (!isInitialized) this.initDatabase();
    if (db.data.notionSetting) {
      db.data.notionSetting = { ...db.data.notionSetting, ...setting };
      console.log('Updated Notion settings');
    } else {
      db.data.notionSetting = { ...setting, id: Date.now().toString() } as NotionSetting;
      console.log('Created new Notion settings');
    }
    await saveDatabase();
    return db.data.notionSetting;
  },

  // Google Drive settings
  getGoogleDriveSetting() {
    if (!isInitialized) this.initDatabase();
    console.log(`Fetching Google Drive settings: ${db.data.googleDriveSetting ? 'found' : 'not found'}`);
    return db.data.googleDriveSetting;
  },

  async createOrUpdateGoogleDriveSetting(setting: Omit<GoogleDriveSetting, 'id'>) {
    if (!isInitialized) this.initDatabase();
    if (db.data.googleDriveSetting) {
      db.data.googleDriveSetting = { ...db.data.googleDriveSetting, ...setting };
      console.log('Updated Google Drive settings');
    } else {
      db.data.googleDriveSetting = { ...setting, id: Date.now().toString() } as GoogleDriveSetting;
      console.log('Created new Google Drive settings');
    }
    await saveDatabase();
    return db.data.googleDriveSetting;
  },
  
  // App Settings
  getAppSettings() {
    if (!isInitialized) this.initDatabase();
    console.log(`Fetching ${db.data.appSettings.length} app settings`);
    return db.data.appSettings;
  },

  getAppSetting(key: string) {
    if (!isInitialized) this.initDatabase();
    const setting = db.data.appSettings.find(s => s.key === key) || null;
    console.log(`Fetching app setting with key ${key}: ${setting ? 'found' : 'not found'}`);
    return setting;
  },

  async createOrUpdateAppSetting(key: string, value: any) {
    if (!isInitialized) this.initDatabase();
    const now = new Date().toISOString();
    const existingIndex = db.data.appSettings.findIndex(s => s.key === key);
    
    if (existingIndex !== -1) {
      // Update existing setting
      db.data.appSettings[existingIndex] = {
        ...db.data.appSettings[existingIndex],
        value,
        updatedAt: now
      };
      console.log(`Updated app setting with key ${key}`);
    } else {
      // Create new setting
      const newSetting: AppSetting = {
        id: Date.now().toString(),
        key,
        value,
        createdAt: now,
        updatedAt: now
      };
      db.data.appSettings.push(newSetting);
      console.log(`Created new app setting with key ${key}`);
    }
    
    await saveDatabase();
    return this.getAppSetting(key);
  },

  async deleteAppSetting(key: string) {
    if (!isInitialized) this.initDatabase();
    const index = db.data.appSettings.findIndex(s => s.key === key);
    if (index !== -1) {
      db.data.appSettings.splice(index, 1);
      await saveDatabase();
      console.log(`Deleted app setting with key ${key}`);
      return true;
    }
    console.log(`Failed to delete app setting: key ${key} not found`);
    return false;
  },

  getGeneralSettings() {
    if (!isInitialized) this.initDatabase();
    const settings = db.data.appSettings.reduce((acc, setting) => {
      acc[setting.key] = setting.value;
      return acc;
    }, {} as Record<string, any>);
    console.log('Fetching general settings');
    return settings;
  },
  
  // Clear database
  async clearProducts() {
    if (!isInitialized) this.initDatabase();
    db.data.products = [];
    db.data.stickers = [];
    await saveDatabase();
    console.log('Cleared all products and stickers from the database');
    return true;
  }
};

export default {
  initDatabase: dbMethods.initDatabase,
  getProducts: dbMethods.getProducts,
  getProductsByType: dbMethods.getProductsByType,
  searchProducts: dbMethods.searchProducts,
  getProduct: dbMethods.getProduct,
  getProductBySku: dbMethods.getProductBySku,
  createProduct: dbMethods.createProduct,
  updateProduct: dbMethods.updateProduct,
  deleteProduct: dbMethods.deleteProduct,
  getStickers: dbMethods.getStickers,
  getSticker: dbMethods.getSticker,
  createSticker: dbMethods.createSticker,
  updateSticker: dbMethods.updateSticker,
  deleteSticker: dbMethods.deleteSticker,
  getNotionSetting: dbMethods.getNotionSetting,
  createOrUpdateNotionSetting: dbMethods.createOrUpdateNotionSetting,
  getGoogleDriveSetting: dbMethods.getGoogleDriveSetting,
  createOrUpdateGoogleDriveSetting: dbMethods.createOrUpdateGoogleDriveSetting,
  getPrinterSettings: dbMethods.getPrinterSettings,
  createPrinterSetting: dbMethods.createPrinterSetting,
  clearProducts: dbMethods.clearProducts,
  saveDatabase,
  getAppSettings: dbMethods.getAppSettings,
  getAppSetting: dbMethods.getAppSetting,
  createOrUpdateAppSetting: dbMethods.createOrUpdateAppSetting,
  deleteAppSetting: dbMethods.deleteAppSetting,
  getGeneralSettings: dbMethods.getGeneralSettings
}; 