import React, { useState, useEffect } from 'react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerBody } from './ui/drawer';
import { Button } from './ui/button';
import { X, Loader2 } from 'lucide-react';
import { Product, Sticker } from '../database/db';
import { Skeleton } from './ui/skeleton';

interface ProductDetailsDrawerProps {
  product: Product;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const ProductDetailsDrawer: React.FC<ProductDetailsDrawerProps> = ({ 
  product, 
  isOpen, 
  onOpenChange 
}) => {
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [printingStickers, setPrintingStickers] = useState<Record<string, boolean>>({});
  
  useEffect(() => {
    const fetchStickers = async () => {
      if (!product?.id) return;
      
      setIsLoading(true);
      try {
        const fetchedStickers = await window.electron.ipcRenderer.invoke('db-get-stickers', product.id);
        console.log(`Found ${fetchedStickers.length} stickers for product ${product.sku}`);
        setStickers(fetchedStickers);
      } catch (error) {
        console.error('Error fetching stickers:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    if (isOpen && product?.id) {
      fetchStickers();
    }
  }, [product?.id, isOpen]);

  const handlePrint = async (sticker: Sticker) => {
    console.log(`Printing sticker: ${sticker.name}`);
    
    // Set loading state for this specific sticker
    setPrintingStickers(prev => ({ ...prev, [sticker.id]: true }));
    
    try {
      const result = await window.electron.ipcRenderer.invoke('print-sticker', sticker.id);
      console.log('Print result:', result);
      
      if (!result.success) {
        console.error('Print failed:', result.message, result.details);
      }
    } catch (error) {
      console.error('Error printing sticker:', error);
    } finally {
      // Reset loading state
      setPrintingStickers(prev => ({ ...prev, [sticker.id]: false }));
    }
  };

  return (
    <Drawer open={isOpen} onOpenChange={onOpenChange}>
      <DrawerContent position="right" size="lg">
        <Button 
          variant="ghost" 
          size="icon" 
          className="absolute right-4 top-4"
          onClick={() => onOpenChange(false)}
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </Button>
        
        <DrawerHeader>
          <DrawerTitle className="text-xl">Product Details</DrawerTitle>
        </DrawerHeader>
        
        <DrawerBody>
          <div className="product-info mb-6">
            <h2 className="text-2xl font-semibold">{product.name}</h2>
            <div className="grid grid-cols-2 gap-4 mt-2">
              <div className="meta-item">
                <span className="font-medium text-gray-500 dark:text-gray-400">SKU:</span>
                <span className="ml-2">{product.sku}</span>
              </div>
              <div className="meta-item">
                <span className="font-medium text-gray-500 dark:text-gray-400">Type:</span>
                <span className="ml-2">{product.type}</span>
              </div>
              {product.barcode && (
                <div className="meta-item">
                  <span className="font-medium text-gray-500 dark:text-gray-400">Barcode:</span>
                  <span className="ml-2">{product.barcode}</span>
                </div>
              )}
            </div>
          </div>
          
          <div className="divider h-px bg-gray-200 dark:bg-gray-700 my-4"></div>
          
          <h3 className="text-xl font-medium mb-4">Stickers</h3>
          
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array(2).fill(0).map((_, index) => (
                <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-sm dark:bg-[#1f2128]">
                  <Skeleton className="h-40 w-full mb-4" />
                  <Skeleton className="h-6 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ))}
            </div>
          ) : stickers.length === 0 ? (
            <div className="text-center p-8 text-gray-500 dark:text-gray-400">
              Stickers not found
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {stickers.map(sticker => (
                <div 
                  key={sticker.id} 
                  className="sticker-card border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => !printingStickers[sticker.id] && handlePrint(sticker)}
                >
                  <div className="p-4">
                    <h4 className="font-medium">{sticker.name}</h4>
                    <p className="text-sm text-gray-500">Size: {sticker.size}</p>
                  </div>
                  
                  <div className="sticker-preview bg-gray-50 bg-white p-6 flex justify-center items-center border-t border-gray-200 dark:border-gray-700">
                    {sticker.previewUrl ? (
                      <img 
                        src={sticker.previewUrl} 
                        alt={sticker.name} 
                        className="max-w-full max-h-40"
                      />
                    ) : (
                      <div className="text-center">
                        <div className="mb-2 text-sm">
                          <div>{product.name}</div>
                          <div>{product.sku}</div>
                        </div>
                        {product.barcode && (
                          <div className="barcode-img p-4 inline-block">
                            <img 
                              src={`https://bwipjs-api.metafloor.com/?bcid=ean13&text=${product.barcode}&scale=3&includetext&textxalign=center`} 
                              alt="Barcode" 
                              className="h-16"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <div className="p-4 border-t">
                    <Button 
                      className={`w-full ${printingStickers[sticker.id] ? 'bg-gray-500' : 'bg-blue-500 hover:bg-blue-600'} text-white`}
                      disabled={printingStickers[sticker.id]}
                    >
                      {printingStickers[sticker.id] ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" /> 
                          Printing...
                        </>
                      ) : (
                        'Print'
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
};

export default ProductDetailsDrawer; 