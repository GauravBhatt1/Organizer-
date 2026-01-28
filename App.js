import React, { useState, useCallback, useMemo, useEffect } from 'react';
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
  const [uncategorizedCount, setUncategorizedCount] = useState(0);

  // Poll for counts to update Sidebar badge
  useEffect(() => {
    const fetchCounts = async () => {
        try {
            const res = await fetch('/api/dashboard');
            if (res.ok) {
                const data = await res.json();
                setUncategorizedCount(data.uncategorized || 0);
            }
        } catch (e) {
            console.error("Failed to fetch counts", e);
        }
    };

    fetchCounts();
    const interval = setInterval(fetchCounts, 15000); // Poll every 15s
    return () => clearInterval(interval);
  }, []);

  const handleSetCurrentPage = (page) => {
    setCurrentPage(page);
    setIsSidebarOpen(false);
  };

  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen(isOpen => !isOpen);
  }, []);

  // New handler to update stats immediately from any child component
  const handleStatsUpdate = useCallback((newStats) => {
    if (newStats && typeof newStats.uncategorized === 'number') {
        setUncategorizedCount(newStats.uncategorized);
    }
  }, []);

  const pageComponent = useMemo(() => {
    const pageProps = { 
        onMenuClick: toggleSidebar,
        onSettingsClick: () => handleSetCurrentPage('Settings'),
        onStatsUpdate: handleStatsUpdate // Pass down to pages
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
  }, [currentPage, toggleSidebar, handleStatsUpdate]);

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