
import React, { useState, useCallback, useMemo } from 'react';
import Sidebar from './components/Sidebar.tsx';
import Dashboard from './pages/Dashboard.tsx';
import Movies from './pages/Movies.tsx';
import TvShows from './pages/TvShows.tsx';
import Uncategorized from './pages/Uncategorized.tsx';
import Settings from './pages/Settings.tsx';
import type { Page } from './types.ts';
import { ToastProvider } from './hooks/useToast.tsx';

const App = () => {
  const [currentPage, setCurrentPage] = useState<Page>('Settings');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // Mock count for demonstration
  const uncategorizedCount = 3; 

  const handleSetCurrentPage = (page: Page) => {
    setCurrentPage(page);
    setIsSidebarOpen(false);
  };

  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen(isOpen => !isOpen);
  }, []);

  const pageComponent = useMemo(() => {
    // Pass onMenuClick to pages so they can pass it to Header if needed (though we handle header internally now inside Layout often, 
    // the current architecture has Header inside pages. We will keep passing it, but also pass a Quick Settings handler).
    const pageProps = { 
        onMenuClick: toggleSidebar,
        // If we want a quick link to settings from the header on any page
        onSettingsClick: () => handleSetCurrentPage('Settings')
    };

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
      <div className="h-full bg-[#0b0f14] text-gray-200 font-sans">
        <Sidebar 
          currentPage={currentPage} 
          setCurrentPage={handleSetCurrentPage}
          isOpen={isSidebarOpen}
          setIsOpen={setIsSidebarOpen}
          uncategorizedCount={uncategorizedCount}
        />
        
        {/* Main Content Wrapper - Pushed right on desktop */}
        <div className="lg:pl-72 flex flex-col h-full transition-all duration-300">
          <main className="flex-1 overflow-y-auto">
            {pageComponent}
          </main>
        </div>
      </div>
    </ToastProvider>
  );
};

export default App;
