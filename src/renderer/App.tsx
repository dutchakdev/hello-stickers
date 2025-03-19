import React, { useEffect, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { ipcRenderer } from 'electron';
import ProductsPage from '../pages/ProductsPage';
import SettingsPage from '../pages/SettingsPage';
import Layout from '../components/Layout';

const App: React.FC = () => {
  const [appPaths, setAppPaths] = useState<{
    appSupportPath: string;
    stickersPath: string;
    imagesPath: string;
    previewsPath: string;
  } | null>(null);

  useEffect(() => {
    const getAppPaths = async () => {
      const paths = await ipcRenderer.invoke('get-app-path');
      setAppPaths(paths);
    };

    getAppPaths();
  }, []);

  if (!appPaths) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<ProductsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </Layout>
  );
};

export default App; 