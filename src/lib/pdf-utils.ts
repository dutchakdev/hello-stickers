import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { app } from 'electron';
import { promisify } from 'util';

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
      `gm convert -density 150 "${pdfPath}"[0] -quality 90 "${previewPath}"`
    ];
    
    // Try each command until one works
    let success = false;
    for (const command of commands) {
      try {
        console.log(`Trying command: ${command}`);
        await execPromise(command);
        
        // Check if file was created
        if (fs.existsSync(previewPath) && fs.statSync(previewPath).size > 0) {
          console.log(`Successfully created preview with command: ${command}`);
          success = true;
          break;
        }
      } catch (err) {
        console.log(`Command failed: ${command}`, err);
        // Continue to next command
      }
    }
    
    // If all commands failed, create a basic placeholder image
    if (!success) {
      console.warn(`All PDF conversion commands failed for: ${pdfPath}, creating a placeholder`);
      try {
        // Create a colored rectangle with the PDF filename as text
        // Here we use a simple base64 encoded PNG as fallback
        const placeholderData = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAMgAAABkCAYAAADDhn8LAAAACXBIWXMAAAsTAAALEwEAmpwYAAAITWlUWHRYTUw6Y29tLmFkb2JlLnhtcAAAAAAAPD94cGFja2V0IGJlZ2luPSLvu78iIGlkPSJXNU0wTXBDZWhpSHpyZVN6TlRjemtjOWQiPz4gPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iQWRvYmUgWE1QIENvcmUgNS42LWMxNDUgNzkuMTYzNDk5LCAyMDE4LzA4LzEzLTE2OjQwOjIyICAgICAgICAiPiA8cmRmOlJERiB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiPiA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0iIiB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iIHhtbG5zOmRjPSJodHRwOi8vcHVybC5vcmcvZGMvZWxlbWVudHMvMS4xLyIgeG1sbnM6cGhvdG9zaG9wPSJodHRwOi8vbnMuYWRvYmUuY29tL3Bob3Rvc2hvcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RFdnQ9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZUV2ZW50IyIgeG1wOkNyZWF0b3JUb29sPSJBZG9iZSBQaG90b3Nob3AgQ0MgMjAxOSAoTWFjaW50b3NoKSIgeG1wOkNyZWF0ZURhdGU9IjIwMjMtMDMtMTlUMTA6MDA6MzgrMDI6MDAiIHhtcDpNb2RpZnlEYXRlPSIyMDIzLTAzLTE5VDEwOjAxOjA3KzAyOjAwIiB4bXA6TWV0YWRhdGFEYXRlPSIyMDIzLTAzLTE5VDEwOjAxOjA3KzAyOjAwIiBkYzpmb3JtYXQ9ImltYWdlL3BuZyIgcGhvdG9zaG9wOkNvbG9yTW9kZT0iMyIgcGhvdG9zaG9wOklDQ1Byb2ZpbGU9InNSR0IgSUVDNjE5NjYtMi4xIiB4bXBNTTpJbnN0YW5jZUlEPSJ4bXAuaWlkOmZkYjQxYzAzLTI0MWUtNDA5Ny1iMTk4LTMwYTJlZmU5NmIyYyIgeG1wTU06RG9jdW1lbnRJRD0ieG1wLmRpZDpmZGI0MWMwMy0yNDFlLTQwOTctYjE5OC0zMGEyZWZlOTZiMmMiIHhtcE1NOk9yaWdpbmFsRG9jdW1lbnRJRD0ieG1wLmRpZDpmZGI0MWMwMy0yNDFlLTQwOTctYjE5OC0zMGEyZWZlOTZiMmMiPiA8eG1wTU06SGlzdG9yeT4gPHJkZjpTZXE+IDxyZGY6bGkgc3RFdnQ6YWN0aW9uPSJjcmVhdGVkIiBzdEV2dDppbnN0YW5jZUlEPSJ4bXAuaWlkOmZkYjQxYzAzLTI0MWUtNDA5Ny1iMTk4LTMwYTJlZmU5NmIyYyIgc3RFdnQ6d2hlbj0iMjAyMy0wMy0xOVQxMDowMDozOCswMjowMCIgc3RFdnQ6c29mdHdhcmVBZ2VudD0iQWRvYmUgUGhvdG9zaG9wIENDIDIwMTkgKE1hY2ludG9zaCkiLz4gPC9yZGY6U2VxPiA8L3htcE1NOkhpc3Rvcnk+IDwvcmRmOkRlc2NyaXB0aW9uPiA8L3JkZjpSREY+IDwveDp4bXBtZXRhPiA8P3hwYWNrZXQgZW5kPSJyIj8+Ug7nrwAAA6JJREFUeNrt3LFqFEEYwPH/7BouEi0iRMFOQbCwshUFLazEQvACPoGFYC0+gJV9qlhY+A62KQViI0iChYTkNnc7szOzM2ckm0vFhMv8fjBcsjue/eDs3d3s3SwYY0yk+PoCiIgBEREB8fP0Ybc2H3fO9n8K5z6dj4j1/yzePTvbGrv24B7Q7DmOGrj+a7K/HmUBXOrdp2PYmV85uAn8uqB7vwccAyeCTBCQHADJDZDcAMkNkNwAyQ2Q3AAQ3fEORAjIAJIGJA1IGpA0IGlA0oCkAUkDkgYkDQDRHe9AhIB0APJuZ3+twdNxs/u2qf+Xy0/mVw6eNVhE6z5+3a/I99u8OdN+Zc7VWssvl8slM6NlFkJYRshShMcIWY2IqyHEtRDiegi7V0JY7n2OJe/M9j2DxG4KTc/vt6F2JeRbhnlnhzqFENYzrK8Zm+tZ3pllbKwXrK9lrK1mbKwWbKwVrK0UPV+e+j41qSCjQXb91dnfJe4vx7MfIVJ3mOLcbxz93+RrfYkZBaMIRZZRZqELSZZRliFbgpCFLigLMy0uY2t1j63r+2ytHWBzNWdrfZ+t1YLN1cJ7Uj+DJDsefXlRl6GImQikTnlTM0gWqpbkWcZylrE0FZIsM8qQU5SRUkRKlZlj1VRg3VTU50xCqSb5/lKklCnKSFVGqjPKlFiaCvHyzmNer8yz82yZd8/OORxPQCZzF6sqIpSh7Q9FGbqzRjVV5KHtL1PFdFYJ47NGaPtNSRkopcwpp/tSJZbKRFll1E1iuUqsHFfXnzxkfn5OQM65xHdvcZlQhYyDuuSwrhg0iXGd2B8nDurD94NxxeFhzV5d0dSJuk5M6kRqEmkqPzPvWEWCkOH97ikhz6maRN0khs30gW2axPA4MVGJ+X6QP89iJZqaJgzZ3XvEi8+vGBxVbI8Tt+vEnaZNlTpxq07cbhrWR4md44adw8Td44Y7o5rvw8TmXf9PZgnIBL7F6p4J3H23yqAbCjOMRx3KuKtPjB6w0X9hM/UYHt4nSvdpTM0mQ/a/3fOfmTWD3OOvpWcV/k18IRl0g3/fGPXf8PcfS9MzQlnmjA+/8/HDG95s7/Li2Q0BmWEGaT+AcdahTL15lOlN49Tjo71vPLnv/YggM/sdpOtFJYfTRf1HIOvk/7GPAZGAOA/GAEhABEQCIgERAAnILOk3Q1B8R9NmTYcAAAAASUVORK5CYII=', 'base64');
        fs.writeFileSync(previewPath, placeholderData);
        console.log(`Created placeholder image at ${previewPath}`);
      } catch (err) {
        console.error(`Failed to create placeholder: ${err.message}`);
        return null;
      }
    }
    
    // Return the app URL
    return getAppUrl(previewPath);
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