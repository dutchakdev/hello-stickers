import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { app } from 'electron';
import { promisify } from 'util';
import { platform } from 'os';
import { PDFDocument } from 'pdf-lib';

// Promisify exec
const execPromise = promisify(exec);

/**
 * Generate a PNG preview from a PDF file
 * @param pdfPath Path to the PDF file
 * @returns Path to the generated PNG preview
 */
export async function createPdfPreview(pdfPath: string): Promise<string | null> {
  try {
    // Check if file exists
    if (!fs.existsSync(pdfPath)) {
      console.error(`PDF file does not exist: ${pdfPath}`);
      return null;
    }

    // Create previews directory if it doesn't exist
    const previewsDir = path.join(app.getPath('userData'), 'previews');
    if (!fs.existsSync(previewsDir)) {
      fs.mkdirSync(previewsDir, { recursive: true });
    }

    // Generate output path for the preview
    const pdfBasename = path.basename(pdfPath, '.pdf');
    const previewPath = path.join(previewsDir, `${pdfBasename}_preview.png`);
    
    // Check if preview already exists
    if (fs.existsSync(previewPath)) {
      console.log(`Using existing preview: ${previewPath}`);
      return getAppUrl(previewPath);
    }
    
    // Try different commands to convert PDF to PNG
    const commands = [
      // Mac sips command for macOS
      `sips -s format png "${pdfPath}" --out "${previewPath}"`,
      // ImageMagick's convert command (standard)
      `convert -density 150 "${pdfPath}"[0] -quality 90 "${previewPath}"`,
      // ImageMagick's magick command (newer versions)
      `magick convert -density 150 "${pdfPath}"[0] -quality 90 "${previewPath}"`,
      // GraphicsMagick alternative
      `gm convert -density 150 "${pdfPath}"[0] -quality 90 "${previewPath}"`,
      // Windows-specific: PowerShell with .NET GhostScript (if available)
      `powershell -Command "Add-Type -AssemblyName System.Drawing; $img = New-Object System.Drawing.Bitmap('${pdfPath.replace(/\\/g, '\\\\')}'); $img.Save('${previewPath.replace(/\\/g, '\\\\')}', [System.Drawing.Imaging.ImageFormat]::Png); $img.Dispose()"`,
      // Windows-specific: MuPDF (if installed)
      `mutool draw -o "${previewPath}" -F png "${pdfPath}" 1`,
      // Windows-specific: GhostScript (if installed)
      `gswin64c -sDEVICE=pngalpha -dFirstPage=1 -dLastPage=1 -dNOPAUSE -dBATCH -r150 -dJPEGQ=90 -sOutputFile="${previewPath}" "${pdfPath}"`
    ];
    
    // Try each command until one works
    let success = false;
    for (const command of commands) {
      try {
        console.log(`Attempting to convert PDF using command: ${command}`);
        await execPromise(command);
        
        // Check if preview was created
        if (fs.existsSync(previewPath)) {
          console.log(`Successfully created preview: ${previewPath}`);
          return getAppUrl(previewPath);
        }
      } catch (error) {
        console.warn(`Command failed: ${command}`, error);
      }
    }
    
    // If all commands fail, create a simple placeholder preview
    // This is a fallback for when no conversion tools are available
    try {
      console.log('Creating placeholder preview image');
      // Create a basic placeholder image with PDF filename
      const placeholderPath = path.join(__dirname, '../../assets/pdf-placeholder.png');
      
      if (fs.existsSync(placeholderPath)) {
        // Copy the placeholder to the preview path
        fs.copyFileSync(placeholderPath, previewPath);
        console.log('Created placeholder preview from template');
        return getAppUrl(previewPath);
      } else {
        // If placeholder not found, log error
        console.error('Placeholder image not found:', placeholderPath);
      }
    } catch (error) {
      console.error('Failed to create placeholder preview:', error);
    }
    
    console.error('All PDF conversion methods failed');
    return null;
  } catch (error) {
    console.error('Error generating PDF preview:', error);
    return null;
  }
}

/**
 * Prepare a PDF file and generate its preview
 * @param pdfPath Path to the PDF file
 * @returns Object containing app:// URLs for both the PDF and its preview
 */
export async function preparePdfWithPreview(pdfPath: string): Promise<{ pdfUrl: string | null, previewUrl: string | null }> {
  try {
    // Check if PDF file exists
    if (!fs.existsSync(pdfPath)) {
      console.error(`PDF file not found: ${pdfPath}`);
      return { pdfUrl: null, previewUrl: null };
    }
    
    // Get app URL for the PDF
    const pdfUrl = getAppUrl(pdfPath);
    
    // Generate preview
    const previewUrl = await createPdfPreview(pdfPath);
    
    console.log(`PDF prepared: ${pdfPath} -> ${pdfUrl}, Preview: ${previewUrl}`);
    return { pdfUrl, previewUrl };
  } catch (error) {
    console.error('Error preparing PDF:', error);
    return { pdfUrl: null, previewUrl: null };
  }
}

/**
 * Prepare PDF path for display in the app
 * @param filePath Local path to the PDF file
 * @param id Unique identifier for the PDF
 * @returns Path that can be used with the app:// protocol
 */
export async function preparePdfPath(filePath: string, id: string): Promise<string | null> {
  try {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.error(`PDF file not found: ${filePath}`);
      return null;
    }

    // Get the filename
    const fileName = path.basename(filePath);
    
    // Create app:// URL
    const appUrl = `app://pdfs/${fileName}`;
    console.log(`PDF path prepared: ${filePath} -> ${appUrl}`);
    
    return appUrl;
  } catch (error) {
    console.error('Error preparing PDF path:', error);
    return null;
  }
}

/**
 * Convert a local file path to app:// URL
 * @param filePath Local file path
 * @param type File type (images, pdfs, previews)
 * @returns app:// URL for the file
 */
export function getAppUrl(filePath: string): string {
  const userDataPath = app.getPath('userData');
  
  if (filePath.includes('/images/')) {
    const imageName = path.basename(filePath);
    return `app://images/${imageName}`;
  } else if (filePath.includes('/pdfs/')) {
    const pdfName = path.basename(filePath);
    return `app://pdfs/${pdfName}`;
  } else if (filePath.includes('/previews/')) {
    const previewName = path.basename(filePath);
    return `app://previews/${previewName}`;
  }
  
  return filePath;
} 