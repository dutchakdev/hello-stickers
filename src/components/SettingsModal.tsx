import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Settings, Save, Loader2, Trash2, Upload, FileText } from 'lucide-react';
import { useToast } from './ui/use-toast';
import TextareaAutosize from 'react-textarea-autosize';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Switch } from './ui/switch';

type SettingsProps = {
  defaultOpen?: boolean;
  children?: React.ReactNode;
  onOpenChange?: (open: boolean) => void;
};

type NotionSettings = {
  id: string;
  apiKey: string;
  databaseId: string;
  lastSyncedAt?: string;
};

type GoogleDriveSettings = {
  id: string;
  serviceAccountJson: string;
};

type PrinterSetting = {
  id: string;
  size: string;
  printerName: string;
  options: {
    media?: string;
    orientation?: 'portrait' | 'landscape';
    margins?: {
      top: number;
      right: number;
      bottom: number;
      left: number;
      units: 'mm' | 'in' | 'pt';
    };
    scale?: number;
    fitToPage?: boolean;
    printScaling?: 'none' | 'fit' | 'fill';
  };
  createdAt: string;
  updatedAt: string;
};

export function SettingsModal({ defaultOpen = false, children, onOpenChange }: SettingsProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingNotion, setIsSavingNotion] = useState(false);
  const [isSavingGoogleDrive, setIsSavingGoogleDrive] = useState(false);
  const [isSavingPrinter, setIsSavingPrinter] = useState(false);
  const [availablePrinters, setAvailablePrinters] = useState<string[]>([]);
  
  // State for settings
  const [notionSettings, setNotionSettings] = useState<NotionSettings>({
    id: '1',
    apiKey: '',
    databaseId: ''
  });
  
  const [googleDriveSettings, setGoogleDriveSettings] = useState<GoogleDriveSettings>({
    id: '1',
    serviceAccountJson: ''
  });
  
  const [printerSettings, setPrinterSettings] = useState<PrinterSetting[]>([]);
  const [selectedSize, setSelectedSize] = useState<string>('40x50mm');

  // Load settings from database on component mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        setIsLoading(true);
        
        // Load Notion settings
        const notionData = await window.electron.ipcRenderer.invoke('db-get-notion-settings');
        console.log('Loaded Notion settings:', notionData);
        if (notionData) {
          setNotionSettings(notionData);
        }
        
        // Load Google Drive settings
        const googleDriveData = await window.electron.ipcRenderer.invoke('db-get-google-drive-settings');
        console.log('Loaded Google Drive settings:', googleDriveData);
        if (googleDriveData) {
          setGoogleDriveSettings(googleDriveData);
        }
        
        // Load printer settings
        const printerData = await window.electron.ipcRenderer.invoke('db-get-printer-settings');
        if (printerData) {
          setPrinterSettings(printerData);
          // Set the first size as selected if available
          if (printerData.length > 0) {
            setSelectedSize(printerData[0].size);
          }
        }
        
        // Get available printers
        const printers = await window.electron.ipcRenderer.invoke('get-available-printers');
        setAvailablePrinters(printers || []);
      } catch (error) {
        console.error('Failed to load settings:', error);
        toast({
          title: 'Error loading settings',
          description: 'Your settings could not be loaded. Using defaults instead.',
          variant: 'destructive'
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    loadSettings();
  }, [toast]);

  // Save notion settings
  const saveNotionSettings = async () => {
    try {
      setIsSavingNotion(true);
      const updatedSettings = await window.electron.ipcRenderer.invoke('db-save-notion-settings', notionSettings);
      setNotionSettings(updatedSettings);
      toast({
        title: 'Notion settings saved',
        description: 'Your Notion integration settings have been updated successfully.'
      });
    } catch (error) {
      console.error('Failed to save Notion settings:', error);
      toast({
        title: 'Error saving settings',
        description: 'Your Notion settings could not be saved. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsSavingNotion(false);
    }
  };

  // Save Google Drive settings
  const saveGoogleDriveSettings = async () => {
    try {
      setIsSavingGoogleDrive(true);
      // Validate JSON format
      try {
        JSON.parse(googleDriveSettings.serviceAccountJson);
      } catch (e) {
        toast({
          title: 'Invalid JSON format',
          description: 'Please check the service account file format.',
          variant: 'destructive'
        });
        setIsSavingGoogleDrive(false);
        return;
      }
      
      const updatedSettings = await window.electron.ipcRenderer.invoke('db-save-google-drive-settings', googleDriveSettings);
      setGoogleDriveSettings(updatedSettings);
      toast({
        title: 'Google Drive settings saved',
        description: 'Your Google Drive integration settings have been updated successfully.'
      });
    } catch (error) {
      console.error('Failed to save Google Drive settings:', error);
      toast({
        title: 'Error saving settings',
        description: 'Your Google Drive settings could not be saved. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsSavingGoogleDrive(false);
    }
  };

  // Save printer settings
  const savePrinterSettings = async () => {
    try {
      setIsSavingPrinter(true);
      const currentSetting = printerSettings.find(s => s.size === selectedSize);
      if (!currentSetting) {
        throw new Error('No printer setting selected');
      }
      
      await window.electron.ipcRenderer.invoke('db-update-printer-settings', currentSetting);
      toast({
        title: 'Printer settings saved',
        description: 'Your printer settings have been updated successfully.'
      });
    } catch (error) {
      console.error('Failed to save printer settings:', error);
      toast({
        title: 'Error saving settings',
        description: 'Your printer settings could not be saved. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsSavingPrinter(false);
    }
  };

  // Handle input changes
  const handleNotionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setNotionSettings(prev => ({ ...prev, [id]: value }));
  };

  // Handle file upload for Google Drive JSON
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        // Try to parse to validate it's valid JSON
        JSON.parse(content);
        setGoogleDriveSettings(prev => ({ ...prev, serviceAccountJson: content }));
        toast({
          title: "File loaded successfully",
          description: "Service account JSON has been loaded."
        });
      } catch (error) {
        toast({
          title: "Invalid JSON file",
          description: "The selected file doesn't contain valid JSON.",
          variant: "destructive"
        });
      }
    };
    
    reader.onerror = () => {
      toast({
        title: "Error reading file",
        description: "Failed to read the selected file.",
        variant: "destructive"
      });
    };
    
    reader.readAsText(file);
  };
  
  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleGoogleDriveChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setGoogleDriveSettings(prev => ({ ...prev, serviceAccountJson: e.target.value }));
  };

  // Handle printer setting changes
  const handlePrinterChange = (size: string, printerName: string) => {
    const updatedSettings = printerSettings.map(setting => 
      setting.size === size 
        ? { ...setting, printerName }
        : setting
    );
    setPrinterSettings(updatedSettings);
  };

  const handleOptionChange = (size: string, key: keyof PrinterSetting['options'], value: any) => {
    const updatedSettings = printerSettings.map(setting => 
      setting.size === size 
        ? { ...setting, options: { ...setting.options, [key]: value } }
        : setting
    );
    setPrinterSettings(updatedSettings);
  };

  const handleMarginChange = (size: string, key: keyof PrinterSetting['options']['margins'], value: number) => {
    const updatedSettings = printerSettings.map(setting => 
      setting.size === size 
        ? {
            ...setting,
            options: {
              ...setting.options,
              margins: {
                ...setting.options.margins,
                [key]: value
              }
            }
          }
        : setting
    );
    setPrinterSettings(updatedSettings);
  };

  const handleMarginUnitsChange = (value: 'mm' | 'in' | 'pt') => {
    setPrinterSettings(prev => prev.map(setting => ({
      ...setting,
      options: {
        ...setting.options,
        margins: {
          ...setting.options?.margins,
          units: value
        }
      }
    })));
  };

  if (isLoading) {
    return (
      <Dialog defaultOpen={defaultOpen} onOpenChange={onOpenChange}>
        <DialogTrigger asChild>
          {children || <Button variant="outline" size="icon"><Settings className="h-4 w-4" /></Button>}
        </DialogTrigger>
        <DialogContent className="sm:max-w-[625px]">
          <DialogHeader>
            <DialogTitle>Settings</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center items-center h-40">
            <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
            <span className="ml-2 text-gray-500">Loading settings...</span>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog defaultOpen={defaultOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        {children || <Button variant="outline" size="icon"><Settings className="h-4 w-4" /></Button>}
      </DialogTrigger>
      <DialogContent className="w-full max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="integrations" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="integrations">Integrations</TabsTrigger>
            <TabsTrigger value="printer">Printer</TabsTrigger>
          </TabsList>
          <TabsContent value="integrations" className="space-y-4 pt-4">
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Notion Integration</h3>
              <div className="space-y-2">
                <Label htmlFor="apiKey">Notion API Key</Label>
                <Input 
                  id="apiKey" 
                  type="password" 
                  value={notionSettings.apiKey}
                  onChange={handleNotionChange}
                  placeholder="Enter Notion API key" 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="databaseId">Notion Database ID</Label>
                <Input 
                  id="databaseId" 
                  value={notionSettings.databaseId}
                  onChange={handleNotionChange}
                  placeholder="Enter Notion database ID" 
                />
              </div>
              {notionSettings.lastSyncedAt && (
                <div className="text-sm text-gray-500">
                  Last synced: {new Date(notionSettings.lastSyncedAt).toLocaleString()}
                </div>
              )}
              <div className="flex justify-end">
                <Button 
                  onClick={saveNotionSettings} 
                  disabled={isSavingNotion}
                  className="flex items-center gap-2"
                >
                  {isSavingNotion ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Save Notion Settings
                    </>
                  )}
                </Button>
              </div>
            </div>
            
            <div className="space-y-4 pt-4 border-t mt-4">
              <h3 className="text-lg font-medium">Google Drive Integration</h3>
              <div className="space-y-2">
                <Label htmlFor="googleDriveFile">Service Account JSON</Label>
                <div className="flex flex-col space-y-2">
                  <input 
                    type="file" 
                    id="googleDriveFile"
                    ref={fileInputRef}
                    onChange={handleFileUpload} 
                    accept=".json"
                    className="hidden" 
                  />
                  <div className="flex flex-col space-y-3">
                    <Button 
                      type="button" 
                      onClick={triggerFileInput}
                      variant="outline"
                      className="flex items-center gap-2 w-full justify-center py-8"
                    >
                      <Upload className="h-6 w-6" />
                      <span>
                        {googleDriveSettings.serviceAccountJson
                          ? "Change service account file"
                          : "Upload service account JSON file"}
                      </span>
                    </Button>
                    {googleDriveSettings.serviceAccountJson && (
                      <div className="flex items-center gap-2 px-4 py-3 bg-muted rounded-md">
                        <FileText className="h-5 w-5 text-green-600" />
                        <span className="font-medium">Service account credentials loaded</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex justify-end">
                <Button 
                  onClick={saveGoogleDriveSettings} 
                  disabled={isSavingGoogleDrive || !googleDriveSettings.serviceAccountJson}
                  className="flex items-center gap-2"
                >
                  {isSavingGoogleDrive ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Save Google Drive Settings
                    </>
                  )}
                </Button>
              </div>
            </div>
          </TabsContent>
          <TabsContent value="printer" className="space-y-4 pt-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Sticker Size</Label>
                <Select value={selectedSize} onValueChange={setSelectedSize}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select size" />
                  </SelectTrigger>
                  <SelectContent>
                    {printerSettings.map(setting => (
                      <SelectItem key={setting.size} value={setting.size}>
                        {setting.size}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedSize && (
                <>
                  <div className="space-y-2">
                    <Label>Printer</Label>
                    <Select 
                      value={printerSettings.find(s => s.size === selectedSize)?.printerName} 
                      onValueChange={(value) => handlePrinterChange(selectedSize, value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select printer" />
                      </SelectTrigger>
                      <SelectContent>
                        {availablePrinters.map(printer => (
                          <SelectItem key={printer} value={printer}>
                            {printer}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Orientation</Label>
                    <Select 
                      value={printerSettings.find(s => s.size === selectedSize)?.options.orientation} 
                      onValueChange={(value) => handleOptionChange(selectedSize, 'orientation', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select orientation" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="portrait">Portrait</SelectItem>
                        <SelectItem value="landscape">Landscape</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Scale (%)</Label>
                    <Input 
                      type="number" 
                      value={printerSettings.find(s => s.size === selectedSize)?.options.scale || 100}
                      onChange={(e) => handleOptionChange(selectedSize, 'scale', parseInt(e.target.value))}
                      min={1}
                      max={200}
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch 
                      checked={printerSettings.find(s => s.size === selectedSize)?.options.fitToPage || false}
                      onCheckedChange={(checked) => handleOptionChange(selectedSize, 'fitToPage', checked)}
                    />
                    <Label>Fit to page</Label>
                  </div>

                  <div className="space-y-2">
                    <Label>Print Scaling</Label>
                    <Select 
                      value={printerSettings.find(s => s.size === selectedSize)?.options.printScaling} 
                      onValueChange={(value) => handleOptionChange(selectedSize, 'printScaling', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select scaling" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="fit">Fit</SelectItem>
                        <SelectItem value="fill">Fill</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end">
              <Button
                onClick={savePrinterSettings}
                disabled={isSavingPrinter}
              >
                {isSavingPrinter && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Printer Settings
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
} 