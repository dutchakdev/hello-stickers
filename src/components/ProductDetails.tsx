import React, { useEffect, useState } from 'react';
import { Product, Sticker } from '../database/db';
import StickerCard from './StickerCard';

interface ProductDetailsProps {
  product: Product;
}

const ProductDetails: React.FC<ProductDetailsProps> = ({ product }) => {
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  
  useEffect(() => {
    const fetchStickers = async () => {
      setIsLoading(true);
      try {
        const fetchedStickers = await window.electron.ipcRenderer.invoke('db-get-stickers', product.id);
        console.log(`Found ${fetchedStickers.length} stickers for product ${product.sku}`);
        
        if (fetchedStickers.length === 0) {
          // Якщо наліпок немає, створюємо наліпку за замовчуванням
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
    
    if (product?.id) {
      fetchStickers();
    } else {
      setIsLoading(false);
    }
  }, [product?.id]);

  const handlePrint = (sticker: Sticker) => {
    console.log(`Printing sticker: ${sticker.name}`);
    window.electron.ipcRenderer.invoke('print-sticker', sticker.id);
  };

  return (
    <div className="product-details">
      <h2>Stickers for {product.name}, {product.sku}</h2>
      
      {isLoading ? (
        <div className="loading">Loading stickers...</div>
      ) : stickers.length === 0 ? (
        <div className="no-stickers">
          <p>No stickers available for this product</p>
        </div>
      ) : (
        <div className="stickers-grid">
          {stickers.map(sticker => (
            <StickerCard 
              key={sticker.id} 
              sticker={sticker}
              onPrint={() => handlePrint(sticker)}
            />
          ))}
        </div>
      )}
      
      <style dangerouslySetInnerHTML={{ __html: `
        .product-details {
          padding: 1rem;
        }
        
        .stickers-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
          grid-gap: 1rem;
          margin-top: 1rem;
        }
        
        .loading, .no-stickers {
          text-align: center;
          padding: 2rem;
          color: #888;
        }
      `}} />
    </div>
  );
};

export default ProductDetails;