import { ipcRenderer } from 'electron';
import db from '../database/db';
import { Sticker } from '../database/schema';

export async function printSticker(sticker: Sticker): Promise<{ success: boolean; message?: string }> {
  try {
    // Get printer settings for this sticker size
    const printerSetting = db.getPrinterSetting(sticker.size);
    if (!printerSetting) {
      return { 
        success: false, 
        message: `No printer configured for size: ${sticker.size}. Please configure a printer in settings.` 
      };
    }

    // Check if we have a PDF to print
    if (!sticker.localPdfPath && (!sticker.pdfUrl || !sticker.pdfUrl.startsWith('app://pdfs/'))) {
      return { 
        success: false, 
        message: 'No PDF available for this sticker. Please make sure the PDF is downloaded.' 
      };
    }

    // Print the PDF
    const result = await ipcRenderer.invoke('print-sticker', sticker.id);

    if (!result.success) {
      return {
        success: false,
        message: result.message || 'Failed to print sticker'
      };
    }

    return {
      success: true,
      message: 'Sticker sent to printer successfully'
    };
  } catch (error) {
    console.error('Error printing sticker:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error occurred while printing'
    };
  }
} 