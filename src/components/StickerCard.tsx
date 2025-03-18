import React, { useState } from 'react';
import { Sticker } from '../database/db';

export interface StickerCardProps {
  sticker: Sticker;
  onPrint?: () => void;
}

const StickerCard: React.FC<StickerCardProps> = ({ sticker, onPrint }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [imageError, setImageError] = useState(false);

  const handlePrintClick = () => {
    if (onPrint) {
      setIsLoading(true);
      setTimeout(() => {
        onPrint();
        setIsLoading(false);
      }, 1000);
    }
  };

  // Функція для відкриття PDF в новому вікні
  const openPdf = (e: React.MouseEvent) => {
    e.preventDefault();
    if (sticker.pdfUrl) {
      window.open(sticker.pdfUrl, '_blank');
    }
  };

  // Перевіряємо наявність превью URL для PDF
  const hasPreview = sticker.previewUrl && !imageError;

  return (
    <div className="sticker-card">
      <h4>{sticker.name}</h4>
      <p>Size: {sticker.size}</p>
      
      <div className="pdf-preview">
        {hasPreview ? (
          // Відображаємо зображення превью, якщо воно є
          <img 
            src={sticker.previewUrl} 
            alt={`Preview for ${sticker.name}`}
            onError={() => setImageError(true)}
            className="preview-image"
          />
        ) : sticker.pdfUrl ? (
          // Якщо превью немає, але є PDF - показуємо посилання
          <div className="pdf-placeholder">
            <a href="#" onClick={openPdf}>
              Open PDF in new window
            </a>
          </div>
        ) : (
          // Якщо взагалі нічого немає
          <div className="pdf-placeholder">
            No preview available
          </div>
        )}
      </div>
      
      <button 
        className="print-button"
        onClick={handlePrintClick}
        disabled={isLoading}
      >
        {isLoading ? 'Printing...' : 'Print'}
      </button>
      
      <style dangerouslySetInnerHTML={{ __html: `
        .sticker-card {
          border: 1px solid #e0e0e0;
          border-radius: 4px;
          padding: 1rem;
          background-color: white;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
          display: flex;
          flex-direction: column;
        }
        
        .sticker-card h4 {
          margin-top: 0;
          margin-bottom: 0.5rem;
          font-size: 1rem;
        }
        
        .sticker-card p {
          margin-top: 0;
          margin-bottom: 1rem;
          font-size: 0.8rem;
          color: #888;
        }
        
        .pdf-preview {
          margin-bottom: 1rem;
          display: flex;
          justify-content: center;
          align-items: center;
          height: 150px;
          border: 1px solid #e0e0e0;
          border-radius: 4px;
          overflow: hidden;
          background-color: #f5f5f5;
        }
        
        .preview-image {
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
        }
        
        .pdf-placeholder {
          color: #888;
          font-size: 14px;
          text-align: center;
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .pdf-placeholder a {
          color: #007aff;
          text-decoration: none;
          padding: 8px 12px;
          border: 1px solid #007aff;
          border-radius: 4px;
        }
        
        .pdf-placeholder a:hover {
          background-color: #007aff;
          color: white;
        }
        
        .print-button {
          padding: 0.5rem;
          background-color: #007aff;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          margin-top: auto;
        }
        
        .print-button:disabled {
          background-color: #cccccc;
          cursor: not-allowed;
        }
      ` }} />
    </div>
  );
};

export default StickerCard; 