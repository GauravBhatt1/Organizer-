
import React, { useState, useCallback, useMemo } from 'react';
import { html } from 'htm/react';
import Sidebar from './components/Sidebar.js';
import Dashboard from './pages/Dashboard.js';
import Movies from './pages/Movies.js';
import TvShows from './pages/TvShows.js';
import Uncategorized from './pages/Uncategorized.js';
import Settings from './pages/Settings.js';
import { ToastProvider } from './hooks/useToast.js';

const App = () => {
  const [currentPage, setCurrentPage] = useState('Settings');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  const uncategorizedCount = 3; 

  const handleSetCurrentPage = (page) => {
    setCurrentPage(page);
    setIsSidebarOpen(false);
  };

  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen(isOpen => !isOpen);
  }, []);

  const pageComponent = useMemo(() => {
    const pageProps = { 
        onMenuClick: toggleSidebar,
        onSettingsClick: () => handleSetCurrentPage('Settings')
    };

    switch (currentPage) {
      case 'Dashboard':
        return html`<${Dashboard} ...${pageProps} />`;
      case 'Movies':
        return html`<${Movies} ...${pageProps} />`;
      case 'TV Shows':
        return html`<${TvShows} ...${pageProps} />`;
      case 'Uncategorized':
        return html`<${Uncategorized} ...${pageProps} />`;
      case 'Settings':
        return html`<${Settings} ...${pageProps} />`;
      default:
        return html`<${Dashboard} ...${pageProps} />`;
    }
  }, [currentPage, toggleSidebar]);

  return html`
    <${ToastProvider}>
      <div className="h-full bg-[#0b0f14] text-gray-200 font-sans">
        <${Sidebar} 
          currentPage=${currentPage} 
          setCurrentPage=${handleSetCurrentPage}
          isOpen=${isSidebarOpen}
          setIsOpen=${setIsSidebarOpen}
          uncategorizedCount=${uncategorizedCount}
        />
        
        <div className="lg:pl-72 flex flex-col h-full transition-all duration-300">
          <main className="flex-1 overflow-y-auto">
            ${pageComponent}
          </main>
        </div>
      </div>
    </${ToastProvider}>
  `;
};

export default App;
