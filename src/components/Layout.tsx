import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Moon, Sun, Settings as SettingsIcon, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';
import { SettingsModal } from './SettingsModal';
import { Toaster } from './ui/toaster';

interface LayoutProps {
  children: React.ReactNode;
  onSyncFromNotion?: () => Promise<void>;
  isSyncing?: boolean;
}

const Layout: React.FC<LayoutProps> = ({ children, onSyncFromNotion, isSyncing = false }) => {
  const location = useLocation();
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [appName, setAppName] = useState('HEY ❤️');
  
  // Apply dark theme immediately for consistent UX
  useEffect(() => {
    // Apply dark theme immediately
    document.documentElement.classList.add('dark');
    document.documentElement.classList.add('theme-zinc');
    setTheme('dark');
    
    // Load additional settings without blocking UI display
    const loadFullSettings = async () => {
      try {
        // Try to load general settings from the database
        const generalSettings = await window.electron.ipcRenderer.invoke('db-get-general-settings');
        
        if (generalSettings) {
          // Set app name if available (not critical for initial rendering)
          if (generalSettings.appName) {
            // setAppName(generalSettings.appName);
          }
        }
      } catch (error) {
        console.error('Error loading general settings:', error);
      }
    };
    
    // Defer loading full settings to optimize initial render
    setTimeout(loadFullSettings, 500);
  }, []);
  
  // Optimized theme toggle function
  const toggleTheme = async () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    
    // Apply theme changes immediately
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    
    // Always ensure the zinc theme is applied
    document.documentElement.classList.add('theme-zinc');
    
    // Save to local storage (fast operation)
    localStorage.setItem('theme', newTheme);
    localStorage.setItem('themeColor', 'zinc');
    
    // Save to database asynchronously (don't await, let it happen in background)
    try {
      window.electron.ipcRenderer.invoke('db-save-general-settings', {
        theme: newTheme
      });
    } catch (error) {
      console.error('Error saving theme preference:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#1a1c23] transition-colors duration-200">
      <nav className="bg-white dark:bg-[#1f2128] shadow-sm transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <h1 className="text-xl font-bold text-gray-900 dark:text-white transition-colors duration-200">{appName}</h1>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              {onSyncFromNotion && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={onSyncFromNotion}
                  disabled={isSyncing}
                  className="text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-gray-200"
                >
                  <RefreshCw className={`h-5 w-5 ${isSyncing ? 'animate-spin' : ''}`} />
                </Button>
              )}
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={toggleTheme} 
                className="text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-gray-200"
              >
                {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
              </Button>
              <SettingsModal>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-gray-200"
                >
                  <SettingsIcon className="h-5 w-5" />
                </Button>
              </SettingsModal>
            </div>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>
      <Toaster />
    </div>
  );
};

export default Layout; 