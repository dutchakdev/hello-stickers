import React, { useState, useEffect } from 'react';
import { Product, Sticker } from '../database/db';
import ProductCard from './ProductCard';
import StickerCard from './StickerCard';
import SearchBar from './SearchBar';

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<'products' | 'settings'>('products');
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [productTypes, setProductTypes] = useState<string[]>([]);
  const [selectedType, setSelectedType] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
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
        
        setIsLoading(false);
      } catch (error) {
        console.error('Error loading products:', error);
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
        const stickersData = await window.electron.ipcRenderer.invoke('db-get-stickers', selectedProduct.id);
        setStickers(stickersData);
      } catch (error) {
        console.error('Error loading stickers:', error);
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

  const handleProductSelect = (product: Product) => {
    setSelectedProduct(product);
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
      console.log('Saving Notion settings:', notionSettings);
      const updatedSettings = await window.electron.ipcRenderer.invoke('db-save-notion-settings', notionSettings);
      setNotionSettings(updatedSettings);
      alert('Notion settings saved successfully');
    } catch (error) {
      console.error('Error saving Notion settings:', error);
      alert('Failed to save Notion settings');
    }
  };

  const handleSaveGoogleDriveSettings = async () => {
    try {
      console.log('Saving Google Drive settings:', googleDriveSettings);
      // Validate JSON format
      try {
        JSON.parse(googleDriveSettings.serviceAccountJson);
      } catch (e) {
        alert('Invalid JSON format. Please check the service account file.');
        return;
      }
      
      const updatedSettings = await window.electron.ipcRenderer.invoke('db-save-google-drive-settings', googleDriveSettings);
      setGoogleDriveSettings(updatedSettings);
      alert('Google Drive settings saved successfully');
    } catch (error) {
      console.error('Error saving Google Drive settings:', error);
      alert('Failed to save Google Drive settings');
    }
  };

  const handleAddPrinterSetting = async () => {
    try {
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
    <div className="products-page">
      <div className="products-header">
        <h2>Products</h2>
        <button className="sync-button" onClick={handleRefresh}>
          {isLoading ? 'Syncing...' : 'Sync'}
        </button>
      </div>
      
      <SearchBar onSearch={handleSearch} />
      
      <div className="filter-buttons">
        <button 
          className={selectedType === 'all' ? 'active' : ''} 
          onClick={() => setSelectedType('all')}
        >
          All
        </button>
        {productTypes.map(type => (
          <button 
            key={type} 
            className={selectedType === type ? 'active' : ''}
            onClick={() => setSelectedType(type)}
          >
            {type}
          </button>
        ))}
      </div>
      
      <div className="products-container">
        {filteredProducts.length === 0 ? (
          <p className="no-products">No products found</p>
        ) : (
          <div className="products-grid">
            {filteredProducts.map(product => (
              <ProductCard 
                key={product.id} 
                product={product} 
                onSelect={() => handleProductSelect(product)}
                isSelected={selectedProduct?.id === product.id}
              />
            ))}
          </div>
        )}
      </div>
      
      {selectedProduct && (
        <div className="stickers-panel">
          <h3>Stickers for {selectedProduct.name}</h3>
          <div className="stickers-grid">
            {stickers.length === 0 ? (
              <p>No stickers available for this product</p>
            ) : (
              stickers.map(sticker => (
                <StickerCard 
                  key={sticker.id} 
                  sticker={sticker} 
                  onPrint={() => handlePrint(sticker)}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );

  const renderSettingsPage = () => (
    <div className="settings-page">
      <h2>Settings</h2>
      
      <div className="settings-section">
        <h3>Notion</h3>
        <div className="setting-field">
          <label>API Key</label>
          <input 
            type="password" 
            value={notionSettings.apiKey || ''} 
            onChange={(e) => setNotionSettings({...notionSettings, apiKey: e.target.value})}
          />
        </div>
        <div className="setting-field">
          <label>Database ID</label>
          <input 
            type="text" 
            value={notionSettings.databaseId || ''} 
            onChange={(e) => setNotionSettings({...notionSettings, databaseId: e.target.value})}
          />
        </div>
        <button onClick={handleSaveNotionSettings}>Save</button>
        <p className="last-synced">
          Last synced: {notionSettings.lastSyncedAt ? new Date(notionSettings.lastSyncedAt).toLocaleString() : 'Never'}
        </p>
      </div>
      
      <div className="settings-section">
        <h3>Google Drive</h3>
        <div className="setting-field">
          <label>Сервісний акаунт JSON</label>
          <textarea
            value={googleDriveSettings.serviceAccountJson || ''}
            onChange={(e) => setGoogleDriveSettings({...googleDriveSettings, serviceAccountJson: e.target.value})}
            placeholder="Вставте JSON файл сервісного акаунта Google тут..."
            rows={10}
            className="service-account-json"
          />
        </div>
        <button onClick={handleSaveGoogleDriveSettings}>Зберегти</button>
      </div>
      
      <div className="settings-section">
        <h3>Printer</h3>
        <div className="setting-field">
          <label>Printer Name</label>
          <select 
            value={printerSettings.printerName || ''} 
            onChange={(e) => setPrinterSettings({...printerSettings, printerName: e.target.value})}
          >
            <option value="">Select a printer</option>
            {availablePrinters.map(printer => (
              <option key={printer} value={printer}>{printer}</option>
            ))}
          </select>
        </div>
        <button onClick={handleAddPrinterSetting}>Add Printer Setting</button>
        <button onClick={handleDeletePrinterSetting}>Delete Printer Setting</button>
      </div>
    </div>
  );

  return (
    <div className="app">
      <header className="header">
        <h1>Label Printer</h1>
        <nav>
          <button 
            className={currentPage === 'products' ? 'active' : ''} 
            onClick={() => setCurrentPage('products')}
          >
            Products
          </button>
          <button 
            className={currentPage === 'settings' ? 'active' : ''} 
            onClick={() => setCurrentPage('settings')}
          >
            Settings
          </button>
        </nav>
      </header>

      <main className="content">
        {currentPage === 'products' && renderProductsPage()}
        
        {currentPage === 'settings' && renderSettingsPage()}
      </main>
      
      <style dangerouslySetInnerHTML={{ __html: `
        .app {
          display: flex;
          flex-direction: column;
          height: 100vh;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
        }
        
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem;
          background-color: #f5f5f7;
          border-bottom: 1px solid #e0e0e0;
        }
        
        .header h1 {
          margin: 0;
          font-size: 1.5rem;
        }
        
        .header nav {
          display: flex;
        }
        
        .header nav button {
          padding: 0.5rem 1rem;
          margin-left: 0.5rem;
          background: none;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }
        
        .header nav button.active {
          background-color: #007aff;
          color: white;
        }
        
        .content {
          flex: 1;
          padding: 1rem;
          overflow-y: auto;
        }
        
        .products-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
        }
        
        .sync-button {
          padding: 0.5rem 1rem;
          background-color: #007aff;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }
        
        .filter-buttons {
          display: flex;
          margin-bottom: 1rem;
          overflow-x: auto;
          padding-bottom: 0.5rem;
        }
        
        .filter-buttons button {
          padding: 0.5rem 1rem;
          margin-right: 0.5rem;
          background: none;
          border: 1px solid #e0e0e0;
          border-radius: 4px;
          cursor: pointer;
          white-space: nowrap;
        }
        
        .filter-buttons button.active {
          background-color: #007aff;
          color: white;
          border-color: #007aff;
        }
        
        .products-container {
          margin-bottom: 1rem;
          max-height: 50vh;
          overflow-y: auto;
        }
        
        .products-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 1rem;
        }
        
        .no-products {
          text-align: center;
          padding: 2rem;
          color: #888;
        }
        
        .stickers-panel {
          border-top: 1px solid #e0e0e0;
          padding-top: 1rem;
          max-height: 30vh;
          overflow-y: auto;
        }
        
        .stickers-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
          gap: 1rem;
        }
        
        .settings-page h2 {
          margin-bottom: 1.5rem;
        }
        
        .settings-section {
          margin-bottom: 2rem;
          padding: 1rem;
          border: 1px solid #e0e0e0;
          border-radius: 4px;
        }
        
        .settings-section h3 {
          margin-top: 0;
          margin-bottom: 1rem;
        }
        
        .setting-field {
          margin-bottom: 1rem;
        }
        
        .setting-field label {
          display: block;
          margin-bottom: 0.5rem;
          font-weight: 500;
        }
        
        .setting-field input,
        .setting-field select {
          width: 100%;
          padding: 0.5rem;
          border: 1px solid #e0e0e0;
          border-radius: 4px;
        }
        
        .settings-section button {
          padding: 0.5rem 1rem;
          background-color: #007aff;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }
        
        .last-synced {
          margin-top: 0.5rem;
          font-size: 0.8rem;
          color: #888;
        }
        
        .service-account-json {
          font-family: monospace;
          font-size: 0.8rem;
          white-space: pre;
          overflow-x: auto;
        }
      ` }} />
    </div>
  );
};

export default App; 