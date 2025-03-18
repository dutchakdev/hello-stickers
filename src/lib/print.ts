import { ipcRenderer } from 'electron';
import db from '../database/db';
import { Sticker } from '../database/schema';

export async function printSticker(sticker: Sticker): Promise<boolean> {
  try {
    if (!sticker.localPdfPath) {
      throw new Error('Sticker PDF not downloaded');
    }

    // Get printer settings for this sticker size
    const printerSetting = db.getPrinterSetting(sticker.size);
    if (!printerSetting) {
      throw new Error(`No printer configured for size: ${sticker.size}`);
    }

    // Print the PDF
    const result = await ipcRenderer.invoke('print-pdf', {
      filePath: sticker.localPdfPath,
      printerName: printerSetting.printerName,
      copies: 1,
      options: printerSetting.options
    });

    return result.success;
  } catch (error) {
    console.error('Error printing sticker:', error);
    return false;
  }
} 