import React, { useState, useEffect, lazy, Suspense } from 'react';
import { Product, Sticker } from '../database/db';
import ProductCard from './ProductCard';
import StickerCard from './StickerCard';
import SearchBar from './SearchBar';
import { Skeleton } from './ui/skeleton';
import { Loader } from './ui/loader';
import Layout from './Layout';
import { RefreshCw } from 'lucide-react';

// Lazy load the ProductDetailsDrawer to improve initial load time
const ProductDetailsDrawer = lazy(() => import('./ProductDetailsDrawer'));

const App: React.FC = () => {
  // Initialize app with dark theme and zinc color scheme immediately
  useEffect(() => {
    // Apply dark theme with zinc colors immediately for better UX
    document.documentElement.classList.add('dark');
    document.documentElement.classList.add('theme-zinc');
    
    // Store in localStorage
    localStorage.setItem('theme', 'dark');
    localStorage.setItem('themeColor', 'zinc');
  }, []);

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

  // Load products on mount - with optimized loading strategy
  useEffect(() => {
    // Set up app title immediately for better UX
    document.title = 'Label Printer';
    
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
      } catch (error) {
        console.error('Error loading products:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    // Load general settings in a separate effect to avoid blocking product loading
    const loadGeneralSettings = async () => {
      try {
        const generalSettings = await window.electron.ipcRenderer.invoke('db-get-general-settings');
        if (generalSettings?.appName) {
          document.title = generalSettings.appName;
        }
      } catch (error) {
        console.error('Error loading general settings:', error);
      }
    };
    
    // Load products immediately
    loadProducts();
    
    // Load settings immediately
    loadGeneralSettings();
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

  // Load settings on mount - with deferred loading
  useEffect(() => {
    const loadSettings = async () => {
      try {
        // Load Notion settings
        const notionData = await window.electron.ipcRenderer.invoke('db-get-notion-settings');
        if (notionData) {
          setNotionSettings(notionData);
        }
        
        // Load Google Drive settings
        const googleDriveData = await window.electron.ipcRenderer.invoke('db-get-google-drive-settings');
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
    
    // Load settings immediately
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
      return await window.electron.ipcRenderer.invoke('print-sticker', sticker.id);
    } catch (error) {
      console.error('Error printing sticker:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to print sticker'
      };
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
            <div className="bg-white dark:bg-[#1f2128] border border-gray-200 dark:border-gray-700 rounded-lg p-8 shadow-sm max-w-md mx-auto">
              <svg className="w-16 h-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Data not found</h3>
              <p className="text-gray-500 dark:text-gray-400 mb-6">Do you want to try sync data?</p>
              <button 
                onClick={handleRefresh} 
                className="w-48 mx-auto px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors flex items-center justify-center"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin mr-2" /> Syncing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" /> Sync
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <Layout onSyncFromNotion={handleRefresh} isSyncing={isLoading}>
      <div className="flex flex-col">
        {currentPage === 'products' && renderProductsPage()}
      </div>
      
      {/* Product details drawer */}
      {selectedProduct && (
        <Suspense fallback={<div>Loading...</div>}>
          <ProductDetailsDrawer 
            product={selectedProduct}
            isOpen={isProductDetailsOpen}
            onOpenChange={setIsProductDetailsOpen}
          />
        </Suspense>
      )}
    </Layout>
  );
};

export default App; 