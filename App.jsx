import React, { useState, useCallback, useMemo } from 'react';
import Sidebar from './components/Sidebar.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Movies from './pages/Movies.jsx';
import TvShows from './pages/TvShows.jsx';
import Uncategorized from './pages/Uncategorized.jsx';
import Settings from './pages/Settings.jsx';
import { ToastProvider } from './hooks/useToast.jsx';

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
