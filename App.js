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

  const handleSetCurrentPage = (page) => {
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
      <div className="flex h-screen bg-gray-900 text-gray-200 font-sans overflow-hidden">
        <${Sidebar} 
          currentPage=${currentPage} 
          setCurrentPage=${handleSetCurrentPage}
          isOpen=${isSidebarOpen}
          setIsOpen=${setIsSidebarOpen}
        />
        <main className="flex-1 flex flex-col overflow-y-auto">
          ${pageComponent}
        </main>
      </div>
    </${ToastProvider}>
  `;
};

export default App;