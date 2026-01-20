

import React, { useState, useCallback, useMemo } from 'react';
import Sidebar from './components/Sidebar.tsx';
import Dashboard from './pages/Dashboard.tsx';
import Movies from './pages/Movies.tsx';
import TvShows from './pages/TvShows.tsx';
import Uncategorized from './pages/Uncategorized.tsx';
import Settings from './pages/Settings.tsx';
import type { Page } from './types.ts';
import { ToastProvider } from './hooks/useToast.tsx';

// FIX: Removed React.FC type which can cause subtle type inference issues.
const App = () => {
  const [currentPage, setCurrentPage] = useState<Page>('Settings');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleSetCurrentPage = (page: Page) => {
    setCurrentPage(page);
    setIsSidebarOpen(false); // Automatically hide sidebar on navigation
  };

  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen(isOpen => !isOpen);
  }, []);

  const pageComponent = useMemo(() => {
    const pageProps = { onMenuClick: toggleSidebar };
    switch (currentPage) {
      case 'Dashboard':
        return <Dashboard {...pageProps} />;
      case 'Movies':
        return <Movies {...pageProps} />;
      case 'TV Shows':
        return <TvShows {...pageProps} />;
      case 'Uncategorized':
        return <Uncategorized {...pageProps} />;
      case 'Settings':
        return <Settings {...pageProps} />;
      default:
        return <Dashboard {...pageProps} />;
    }
  }, [currentPage, toggleSidebar]);

  return (
    <ToastProvider>
      <div className="flex h-screen bg-gray-900 text-gray-200 font-sans overflow-hidden">
        <Sidebar 
          currentPage={currentPage} 
          setCurrentPage={handleSetCurrentPage}
          isOpen={isSidebarOpen}
          setIsOpen={setIsSidebarOpen}
        />
        <main className="flex-1 flex flex-col overflow-y-auto">
          {pageComponent}
        </main>
      </div>
    </ToastProvider>
  );
};

export default App;