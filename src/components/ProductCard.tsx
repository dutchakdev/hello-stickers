import React, { useState } from 'react';
import { Product } from '../database/db';
import { Card, CardContent } from './ui/card';
import { cn } from '../utils/cn';
import { ImageOff } from 'lucide-react';

interface ProductCardProps {
  product: Product;
  isSelected: boolean;
  onClick: () => void;
}

const ProductCard: React.FC<ProductCardProps> = ({ product, isSelected, onClick }) => {
  const [imageError, setImageError] = useState(false);

  // Get image URL through helper function
  const imageUrl = getImageUrl(product);
  
  return (
    <Card 
      className={cn(
        "h-full cursor-pointer transition-all overflow-hidden",
        "hover:shadow-md hover:-translate-y-1",
        isSelected && "ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-[#1a1c23]"
      )}
      onClick={onClick}
    >
      <div className="relative h-44 overflow-hidden bg-gray-100 dark:bg-[#1f2128]">
        {imageUrl && !imageError ? (
          <img 
            src={imageUrl} 
            alt={product.name} 
            className="w-full h-full object-contain"
            onError={(e) => {
              console.error(`Error loading image: ${imageUrl}`);
              setImageError(true);
            }}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500">
            <div className="flex flex-col items-center">
              <ImageOff className="w-8 h-8 mb-2" />
              <span className="text-sm">No Image</span>
            </div>
          </div>
        )}
      </div>
      <CardContent className="p-4">
        <h3 className="text-base font-medium mb-2 text-gray-900 dark:text-gray-100 line-clamp-1">{product.name}</h3>
        <div className="space-y-1">
          <p className="text-sm font-mono text-gray-700 dark:text-gray-300">SKU: {product.sku}</p>
          <div className="flex flex-wrap gap-2">
            <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">
              {product.type}
            </span>
            {product.price && (
              <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                ${product.price.toFixed(2)}
              </span>
            )}
          </div>
          {product.barcode && (
            <p className="text-xs font-mono mt-2 text-gray-500 dark:text-gray-400">
              Barcode: {product.barcode}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// Helper function to get the appropriate image URL
function getImageUrl(product: Product): string {
  // If there's a local image path, use app:// protocol
  if (product.localImagePath) {
    // Extract filename from path
    const parts = product.localImagePath.split('/');
    const filename = parts[parts.length - 1];
    return `app://images/${filename}`;
  }
  
  // Otherwise fall back to remote URL if available
  if (product.imageUrl) {
    // If the URL already starts with app://, use it as is
    if (product.imageUrl.startsWith('app://')) {
      return product.imageUrl;
    }
    return product.imageUrl;
  }
  
  // No image available
  return '';
}

export default ProductCard; 