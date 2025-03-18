export interface Product {
  id: string;
  name: string;
  sku: string;
  imageUrl: string;
  localImagePath?: string;
  type: string;
  barcode?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Sticker {
  id: string;
  productId: string;
  name: string;
  size: string;
  pdfUrl: string;
  localPdfPath?: string;
  localPreviewPath?: string;
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
  createdAt: string;
  updatedAt: string;
}

export interface NotionSetting {
  id: string;
  apiKey: string;
  databaseId: string;
  lastSyncedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GoogleDriveSetting {
  id: string;
  serviceAccountJson: string;
  createdAt: string;
  updatedAt: string;
} 