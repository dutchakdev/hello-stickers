import React, { useState } from 'react';
import { Sticker } from '../database/db';
import { Card, CardContent, CardFooter } from './ui/card';
import { Button } from './ui/button';
import { Loader2, FileText, Printer } from 'lucide-react';
import { useToast } from './ui/use-toast';

export interface StickerCardProps {
  sticker: Sticker;
  onPrint?: () => Promise<{ success: boolean; message?: string }>;
}

const StickerCard: React.FC<StickerCardProps> = ({ sticker, onPrint }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [imageError, setImageError] = useState(false);
  const { toast } = useToast();

  const handlePrintClick = async () => {
    if (onPrint) {
      setIsLoading(true);
      try {
        const result = await onPrint();
        toast({
          title: result.success ? 'Success' : 'Error',
          description: result.message,
          variant: result.success ? 'default' : 'destructive',
        });
      } catch (error) {
        toast({
          title: 'Error',
          description: error instanceof Error ? error.message : 'Failed to print sticker',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
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
    <Card className="h-full overflow-hidden flex flex-col transition-all hover:shadow-md">
      <CardContent className="p-4 flex-grow">
        <h4 className="font-medium mb-1 truncate text-gray-900 dark:text-gray-100" title={sticker.name}>
          {sticker.name}
        </h4>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Size: {sticker.size}</p>
        
        <div className="h-36 flex items-center justify-center border rounded bg-gray-50 dark:bg-gray-800 dark:border-gray-700 mb-3">
          {hasPreview ? (
            <img 
              src={sticker.previewUrl} 
              alt={`Preview for ${sticker.name}`}
              onError={() => setImageError(true)}
              className="max-w-full max-h-full object-contain"
            />
          ) : sticker.pdfUrl ? (
            <Button 
              variant="outline"
              size="sm"
              onClick={openPdf}
              className="text-sm gap-2"
            >
              <FileText className="h-4 w-4" />
              View PDF
            </Button>
          ) : (
            <span className="text-sm text-gray-400 dark:text-gray-500 flex flex-col items-center">
              <FileText className="h-5 w-5 mb-1" />
              No preview available
            </span>
          )}
        </div>
      </CardContent>
      
      <CardFooter className="px-3 pb-3 pt-0">
        <Button 
          className="w-full gap-2"
          onClick={handlePrintClick}
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Printing...
            </>
          ) : (
            <>
              <Printer className="h-4 w-4" /> Print
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default StickerCard; 