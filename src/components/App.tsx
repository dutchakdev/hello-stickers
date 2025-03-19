import React, { useState, useEffect } from 'react';
import { Product, Sticker } from '../database/db';
import ProductCard from './ProductCard';
import StickerCard from './StickerCard';
import SearchBar from './SearchBar';
import { Skeleton } from './ui/skeleton';
import { Loader } from './ui/loader';
import ProductDetailsDrawer from './ProductDetailsDrawer';
import Layout from './Layout';

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<'products' | 'settings'>('products');
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [productTypes, setProductTypes] = useState<string[]>([]);
  const [selectedType, setSelectedType] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingStickers, setIsLoadingStickers] = useState(false);
  const [isSavingNotionSettings, setIsSavingNotionSettings] = useState(false);
  const [isSavingGoogleSettings, setIsSavingGoogleSettings] = useState(false);
  const [isSavingPrinterSettings, setIsSavingPrinterSettings] = useState(false);
  const [notionSettings, setNotionSettings] = useState<{
    apiKey: string;
    databaseId: string;
    lastSyncedAt?: string;
  }>({
    apiKey: '',
    databaseId: ''
  });
  const [googleDriveSettings, setGoogleDriveSettings] = useState<{
    serviceAccountJson: string;
  }>({
    serviceAccountJson: ''
  });
  const [printerSettings, setPrinterSettings] = useState<{
    printerName: string;
  }>({
    printerName: ''
  });
  const [availablePrinters, setAvailablePrinters] = useState<string[]>([]);
  const [newPrinterSize, setNewPrinterSize] = useState('');
  const [newPrinterName, setNewPrinterName] = useState('');
  const [isLoadingProductDetails, setIsLoadingProductDetails] = useState(false);
  const [isProductDetailsOpen, setIsProductDetailsOpen] = useState(false);

  // Load products on mount
  useEffect(() => {
    const loadProducts = async () => {
      try {
        setIsLoading(true);
        
        // Use the exposed electron API
        const productsData = await window.electron.ipcRenderer.invoke('db-get-products');
        
        setProducts(productsData);
        setFilteredProducts(productsData);
        
        // Extract unique product types
        const types = Array.from(new Set(productsData.map((p: Product) => p.type))) as string[];
        setProductTypes(types);
        
        // Load theme and other settings
        try {
          const generalSettings = await window.electron.ipcRenderer.invoke('db-get-general-settings');
          if (generalSettings) {
            document.title = generalSettings.appName || 'Label Printer';
          }
        } catch (error) {
          console.error('Error loading settings:', error);
        }
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadProducts();
  }, []);

  // Load stickers when a product is selected
  useEffect(() => {
    const loadStickers = async () => {
      if (!selectedProduct) return;
      
      try {
        setIsLoadingStickers(true);
        const stickersData = await window.electron.ipcRenderer.invoke('db-get-stickers', selectedProduct.id);
        setStickers(stickersData);
      } catch (error) {
        console.error('Error loading stickers:', error);
      } finally {
        setIsLoadingStickers(false);
      }
    };
    
    loadStickers();
  }, [selectedProduct]);

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        // Load Notion settings
        const notionData = await window.electron.ipcRenderer.invoke('db-get-notion-settings');
        console.log('Loaded Notion settings:', notionData);
        if (notionData) {
          setNotionSettings(notionData);
        }
        
        // Load Google Drive settings
        const googleDriveData = await window.electron.ipcRenderer.invoke('db-get-google-drive-settings');
        console.log('Loaded Google Drive settings:', googleDriveData);
        if (googleDriveData) {
          setGoogleDriveSettings(googleDriveData);
        }
        
        // Load printer settings
        const printerData = await window.electron.ipcRenderer.invoke('db-get-printer-settings');
        setPrinterSettings(printerData);
        
        // Get available printers
        const printers = await window.electron.ipcRenderer.invoke('get-available-printers');
        setAvailablePrinters(printers);
      } catch (error) {
        console.error('Error loading settings:', error);
      }
    };
    
    loadSettings();
  }, []);

  // Filter products by type
  useEffect(() => {
    if (selectedType === 'all') {
      setFilteredProducts(products);
    } else {
      setFilteredProducts(products.filter(p => p.type === selectedType));
    }
  }, [selectedType, products]);

  const handleSearch = (query: string) => {
    if (!query.trim()) {
      if (selectedType === 'all') {
        setFilteredProducts(products);
      } else {
        setFilteredProducts(products.filter(p => p.type === selectedType));
      }
      return;
    }
    
    const lowerQuery = query.toLowerCase();
    const filtered = products.filter(product => {
      const matchesType = selectedType === 'all' || product.type === selectedType;
      const matchesSearch = 
        product.name.toLowerCase().includes(lowerQuery) || 
        product.sku.toLowerCase().includes(lowerQuery) || 
        (product.barcode && product.barcode.toLowerCase().includes(lowerQuery));
      
      return matchesType && matchesSearch;
    });
    
    setFilteredProducts(filtered);
  };

  const handleFilterByType = (type: string) => {
    setSelectedType(type);
    if (type === 'all') {
      setFilteredProducts(products);
    } else {
      setFilteredProducts(products.filter(p => p.type === type));
    }
  };

  const handleProductSelect = (product: Product) => {
    setIsLoadingProductDetails(true);
    setSelectedProduct(product);
    setIsProductDetailsOpen(true);
    setTimeout(() => {
      setIsLoadingProductDetails(false);
    }, 300);
  };

  const handleRefresh = async () => {
    setIsLoading(true);
    try {
      // Clear existing products before syncing to ensure we get fresh data
      await window.electron.ipcRenderer.invoke('db-clear-products');
      
      // Sync with Notion
      const result = await window.electron.ipcRenderer.invoke('sync-notion');
      
      if (result.success) {
        // Reload products
        const productsData = await window.electron.ipcRenderer.invoke('db-get-products');
        setProducts(productsData);
        
        if (selectedType === 'all') {
          setFilteredProducts(productsData);
        } else {
          setFilteredProducts(productsData.filter((p: Product) => p.type === selectedType));
        }
        
        // Extract unique product types
        const types = Array.from(new Set(productsData.map((p: Product) => p.type).filter(Boolean))) as string[];
        setProductTypes(types);
        
        // If there's a selected product, refresh its stickers
        if (selectedProduct) {
          const updatedProduct = productsData.find(p => p.id === selectedProduct.id);
          if (updatedProduct) {
            setSelectedProduct(updatedProduct);
            const stickerData = await window.electron.ipcRenderer.invoke('db-get-stickers', updatedProduct.id);
            setStickers(stickerData);
          }
        }
        
        alert(`Синхронізовано успішно! ${result.message}`);
      } else {
        alert(`Помилка синхронізації: ${result.message}`);
      }
    } catch (error) {
      console.error('Error syncing products:', error);
      alert('Не вдалося синхронізувати продукти. Перевірте налаштування Notion API.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrint = async (sticker: Sticker) => {
    try {
      console.log(`Printing sticker: ${sticker.name}`);
      
      // Call the main process to print the sticker
      const result = await window.electron.ipcRenderer.invoke('print-sticker', sticker.id);
      
      if (result.success) {
        alert('Sticker sent to printer');
      } else {
        alert(`Failed to print: ${result.error}`);
      }
    } catch (error) {
      console.error('Error printing sticker:', error);
      alert('Failed to print sticker');
    }
  };

  const handleSaveNotionSettings = async () => {
    try {
      setIsSavingNotionSettings(true);
      console.log('Saving Notion settings:', notionSettings);
      const updatedSettings = await window.electron.ipcRenderer.invoke('db-save-notion-settings', notionSettings);
      setNotionSettings(updatedSettings);
      alert('Notion settings saved successfully');
    } catch (error) {
      console.error('Error saving Notion settings:', error);
      alert('Failed to save Notion settings');
    } finally {
      setIsSavingNotionSettings(false);
    }
  };

  const handleSaveGoogleDriveSettings = async () => {
    try {
      setIsSavingGoogleSettings(true);
      console.log('Saving Google Drive settings:', googleDriveSettings);
      // Validate JSON format
      try {
        JSON.parse(googleDriveSettings.serviceAccountJson);
      } catch (e) {
        alert('Invalid JSON format. Please check the service account file.');
        setIsSavingGoogleSettings(false);
        return;
      }
      
      const updatedSettings = await window.electron.ipcRenderer.invoke('db-save-google-drive-settings', googleDriveSettings);
      setGoogleDriveSettings(updatedSettings);
      alert('Google Drive settings saved successfully');
    } catch (error) {
      console.error('Error saving Google Drive settings:', error);
      alert('Failed to save Google Drive settings');
    } finally {
      setIsSavingGoogleSettings(false);
    }
  };

  const handleAddPrinterSetting = async () => {
    try {
      setIsSavingPrinterSettings(true);
      if (!newPrinterSize || !newPrinterName) {
        alert('Please enter both size and printer name');
        return;
      }
      
      // Check if size already exists
      if (printerSettings.printerName === newPrinterName) {
        alert(`Printer name ${newPrinterName} already exists`);
        return;
      }
      
      setPrinterSettings({
        ...printerSettings,
        printerName: newPrinterName
      });
      
      // Clear form
      setNewPrinterSize('');
      setNewPrinterName('');
      
      alert('Printer setting added');
    } catch (error) {
      console.error('Error adding printer setting:', error);
      alert('Failed to add printer setting');
    } finally {
      setIsSavingPrinterSettings(false);
    }
  };

  const handleDeletePrinterSetting = async () => {
    try {
      await window.electron.ipcRenderer.invoke('db-delete-printer-setting');
      
      // Reload printer settings
      const printerData = await window.electron.ipcRenderer.invoke('db-get-printer-settings');
      setPrinterSettings(printerData);
      
      alert('Printer setting deleted');
    } catch (error) {
      console.error('Error deleting printer setting:', error);
      alert('Failed to delete printer setting');
    }
  };

  const renderProductsPage = () => (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Products</h1>
        <div className="flex space-x-2">
          <button 
            onClick={handleRefresh} 
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader size="sm" className="mr-2" /> Syncing...
              </>
            ) : (
              'Sync from Notion'
            )}
          </button>
          <button 
            onClick={() => setCurrentPage('settings')} 
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Settings
          </button>
        </div>
      </div>
      
      <SearchBar 
        onSearch={handleSearch} 
        selectedType={selectedType}
        productTypes={productTypes}
        onFilterByType={handleFilterByType}
      />
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {isLoading ? (
          // Loading skeleton cards
          Array(8).fill(0).map((_, index) => (
            <div key={index} className="border rounded-lg p-4 shadow-sm">
              <Skeleton className="h-40 w-full mb-4" />
              <Skeleton className="h-6 w-3/4 mb-2" />
              <Skeleton className="h-4 w-1/2 mb-2" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ))
        ) : filteredProducts.length > 0 ? (
          filteredProducts.map(product => (
            <ProductCard
              key={product.id}
              product={product}
              isSelected={selectedProduct?.id === product.id}
              onClick={() => handleProductSelect(product)}
            />
          ))
        ) : (
          <div className="col-span-full text-center py-12 px-4">
            <div className="bg-white border border-gray-200 rounded-lg p-8 shadow-sm max-w-md mx-auto">
              <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Data not found</h3>
              <p className="text-gray-500 mb-6">Do you want to try sync data?</p>
              <button 
                onClick={handleRefresh} 
                className="w-full px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors flex items-center justify-center"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader size="sm" className="mr-2" /> Syncing...
                  </>
                ) : (
                  'Sync from Notion'
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderSettingsPage = () => (
    <div className="p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Settings</h1>
        <button 
          onClick={() => setCurrentPage('products')} 
          className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
        >
          Back to Products
        </button>
      </div>
      
      <div className="space-y-8">
        {/* Notion Settings */}
        <div className="bg-card rounded-lg border shadow-sm p-6">
          <h2 className="text-xl font-semibold mb-4">Notion Integration</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">API Key</label>
              <input 
                type="password" 
                value={notionSettings.apiKey || ''} 
                onChange={(e) => setNotionSettings({...notionSettings, apiKey: e.target.value})}
                className="w-full p-2 rounded border focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Database ID</label>
              <input 
                type="text" 
                value={notionSettings.databaseId || ''} 
                onChange={(e) => setNotionSettings({...notionSettings, databaseId: e.target.value})}
                className="w-full p-2 rounded border focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            <div>
              <button 
                onClick={handleSaveNotionSettings}
                disabled={isSavingNotionSettings}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center"
              >
                {isSavingNotionSettings ? (
                  <>
                    <Loader size="sm" className="mr-2" /> Saving...
                  </>
                ) : (
                  'Save Notion Settings'
                )}
              </button>
              
              <p className="text-sm text-muted-foreground mt-2">
                Last synced: {notionSettings.lastSyncedAt ? new Date(notionSettings.lastSyncedAt).toLocaleString() : 'Never'}
              </p>
            </div>
          </div>
        </div>
        
        {/* Google Drive Settings */}
        <div className="bg-card rounded-lg border shadow-sm p-6">
          <h2 className="text-xl font-semibold mb-4">Google Drive Integration</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Service Account JSON</label>
              <textarea
                value={googleDriveSettings.serviceAccountJson || ''}
                onChange={(e) => setGoogleDriveSettings({...googleDriveSettings, serviceAccountJson: e.target.value})}
                placeholder="Paste your Google service account JSON here..."
                rows={6}
                className="w-full p-2 rounded border font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            <div>
              <button 
                onClick={handleSaveGoogleDriveSettings}
                disabled={isSavingGoogleSettings}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center"
              >
                {isSavingGoogleSettings ? (
                  <>
                    <Loader size="sm" className="mr-2" /> Saving...
                  </>
                ) : (
                  'Save Google Drive Settings'
                )}
              </button>
            </div>
          </div>
        </div>
        
        {/* Printer Settings */}
        <div className="bg-card rounded-lg border shadow-sm p-6">
          <h2 className="text-xl font-semibold mb-4">Printer Configuration</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Printer Name</label>
              <select 
                value={printerSettings.printerName || ''} 
                onChange={(e) => setPrinterSettings({...printerSettings, printerName: e.target.value})}
                className="w-full p-2 rounded border focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select a printer</option>
                {availablePrinters.map(printer => (
                  <option key={printer} value={printer}>{printer}</option>
                ))}
              </select>
            </div>
            
            <div className="flex space-x-4">
              <button 
                onClick={handleAddPrinterSetting}
                disabled={isSavingPrinterSettings}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center"
              >
                {isSavingPrinterSettings ? (
                  <>
                    <Loader size="sm" className="mr-2" /> Saving...
                  </>
                ) : (
                  'Save Printer Settings'
                )}
              </button>
              
              <button 
                onClick={handleDeletePrinterSetting}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
              >
                Delete Printer Setting
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <Layout>
      <div className="flex flex-col">
        {currentPage === 'products' && renderProductsPage()}
        {currentPage === 'settings' && renderSettingsPage()}
      </div>
      
      {/* Product details drawer */}
      {selectedProduct && (
        <ProductDetailsDrawer 
          product={selectedProduct}
          isOpen={isProductDetailsOpen}
          onOpenChange={setIsProductDetailsOpen}
        />
      )}
    </Layout>
  );
};

export default App; 