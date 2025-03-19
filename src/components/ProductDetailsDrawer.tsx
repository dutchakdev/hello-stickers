import React, { useState, useEffect } from 'react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerBody } from './ui/drawer';
import { Button } from './ui/button';
import { X } from 'lucide-react';
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
  
  useEffect(() => {
    const fetchStickers = async () => {
      if (!product?.id) return;
      
      setIsLoading(true);
      try {
        const fetchedStickers = await window.electron.ipcRenderer.invoke('db-get-stickers', product.id);
        console.log(`Found ${fetchedStickers.length} stickers for product ${product.sku}`);
        
        if (fetchedStickers.length === 0) {
          console.log(`No stickers found for product ${product.sku}, creating default sticker`);
          const defaultSticker = {
            productId: product.id,
            name: `Price Tag for ${product.name}`,
            size: 'Default',
            pdfUrl: null,
            previewUrl: null
          };
          
          const createdSticker = await window.electron.ipcRenderer.invoke('create-sticker', defaultSticker);
          console.log('Created default sticker:', createdSticker);
          setStickers([createdSticker]);
        } else {
          setStickers(fetchedStickers);
        }
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

  const handlePrint = (sticker: Sticker) => {
    console.log(`Printing sticker: ${sticker.name}`);
    window.electron.ipcRenderer.invoke('print-sticker', sticker.id);
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
                <span className="font-medium text-gray-500">SKU:</span>
                <span className="ml-2">{product.sku}</span>
              </div>
              <div className="meta-item">
                <span className="font-medium text-gray-500">Type:</span>
                <span className="ml-2">{product.type}</span>
              </div>
              {product.barcode && (
                <div className="meta-item">
                  <span className="font-medium text-gray-500">Barcode:</span>
                  <span className="ml-2">{product.barcode}</span>
                </div>
              )}
            </div>
          </div>
          
          <div className="divider h-px bg-gray-200 my-4"></div>
          
          <h3 className="text-xl font-medium mb-4">Stickers</h3>
          
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array(2).fill(0).map((_, index) => (
                <div key={index} className="border rounded-lg p-4 shadow-sm">
                  <Skeleton className="h-40 w-full mb-4" />
                  <Skeleton className="h-6 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ))}
            </div>
          ) : stickers.length === 0 ? (
            <div className="text-center p-8 text-gray-500">
              No stickers available for this product
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {stickers.map(sticker => (
                <div key={sticker.id} className="sticker-card border rounded-lg overflow-hidden">
                  <div className="p-4">
                    <h4 className="font-medium">{sticker.name}</h4>
                    <p className="text-sm text-gray-500">Size: {sticker.size}</p>
                  </div>
                  
                  <div className="sticker-preview bg-gray-50 p-6 flex justify-center items-center border-t">
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
                          <div className="barcode-img bg-white p-4 inline-block">
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
                  
                  <div className="p-4 border-t bg-gray-50">
                    <Button 
                      className="w-full bg-blue-500 hover:bg-blue-600 text-white"
                      onClick={() => handlePrint(sticker)}
                    >
                      Print
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