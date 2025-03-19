import React, { useState } from 'react';
import { Sticker } from '../database/db';
import { Loader } from './ui/loader';

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

  // Function to open PDF in a new window
  const openPdf = (e: React.MouseEvent) => {
    e.preventDefault();
    if (sticker.pdfUrl) {
      window.open(sticker.pdfUrl, '_blank');
    }
  };

  // Check if we have a preview URL for the PDF
  const hasPreview = sticker.previewUrl && !imageError;

  return (
    <div className="border rounded-lg overflow-hidden bg-white shadow-sm flex flex-col">
      <div className="p-4 flex-grow">
        <h4 className="font-medium mb-1 truncate" title={sticker.name}>{sticker.name}</h4>
        <p className="text-sm text-gray-500 mb-3">Size: {sticker.size}</p>
        
        <div className="h-36 flex items-center justify-center border rounded bg-gray-50 mb-3">
          {hasPreview ? (
            <img 
              src={sticker.previewUrl} 
              alt={`Preview for ${sticker.name}`}
              onError={() => setImageError(true)}
              className="max-w-full max-h-full object-contain"
            />
          ) : sticker.pdfUrl ? (
            <a 
              href="#" 
              onClick={openPdf}
              className="text-sm text-blue-500 hover:text-blue-700 border border-blue-500 hover:bg-blue-50 rounded px-3 py-2 transition-colors"
            >
              Open PDF in new window
            </a>
          ) : (
            <span className="text-sm text-gray-400">
              No preview available
            </span>
          )}
        </div>
      </div>
      
      <button 
        className="w-full py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium transition-colors flex items-center justify-center"
        onClick={handlePrintClick}
        disabled={isLoading}
      >
        {isLoading ? (
          <>
            <Loader size="sm" className="mr-2" /> Printing...
          </>
        ) : (
          'Print'
        )}
      </button>
    </div>
  );
};

export default StickerCard; 