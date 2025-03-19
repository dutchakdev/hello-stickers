import React, { useState } from 'react';
import { Product } from '../database/db';
import './ProductCard.css';

interface ProductCardProps {
  product: Product;
  isSelected: boolean;
  onClick: () => void;
}

const ProductCard: React.FC<ProductCardProps> = ({ product, isSelected, onClick }) => {
  const [imageError, setImageError] = useState(false);

  // Отримуємо URL зображення через допоміжну функцію
  const imageUrl = getImageUrl(product);
  
  // Дебаг шляху зображення
  console.log(`Product ${product.sku} image URL: ${imageUrl}, original: ${product.imageUrl}`);

  return (
    <div 
      className={`product-card ${isSelected ? 'selected' : ''}`}
      onClick={onClick}
    >
      <div className="product-image">
        {imageUrl && !imageError ? (
          <img 
            src={imageUrl} 
            alt={product.name} 
            onError={(e) => {
              console.error(`Error loading image: ${imageUrl}`);
              setImageError(true);
            }}
          />
        ) : (
          <div className="no-image">No Image</div>
        )}
      </div>
      <div className="product-info">
        <h3>{product.name}</h3>
        <p className="sku">SKU: {product.sku}</p>
        <p className="type">Type: {product.type}</p>
        {product.barcode && <p className="barcode">Barcode: {product.barcode}</p>}
      </div>
    </div>
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