
import React from 'react';
import type { Page } from '../types.ts';
import { DashboardIcon, MoviesIcon, TvIcon, UncategorizedIcon, SettingsIcon, LogoIcon, CloseIcon } from '../lib/icons.tsx';

interface SidebarProps {
  currentPage: Page;
  setCurrentPage: (page: Page) => void;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  uncategorizedCount?: number;
}

const NavItem: React.FC<{
  page: Page;
  icon: React.ReactNode;
  isActive: boolean;
  onClick: () => void;
  count?: number;
}> = ({ page, icon, isActive, onClick, count }) => (
  <button
    onClick={onClick}
    className={`w-full group flex items-center px-4 py-3 text-sm font-medium transition-all duration-200 relative ${
      isActive
        ? 'bg-white/5 text-brand-purple'
        : 'text-gray-400 hover:bg-white/5 hover:text-white'
    }`}
  >
    {isActive && <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-brand-purple"></div>}
    <span className={`mr-3 transition-colors ${isActive ? 'text-brand-purple' : 'text-gray-500 group-hover:text-white'}`}>
      {icon}
    </span>
    <span className="flex-1 text-left">{page}</span>
    {count !== undefined && count > 0 && (
      <span className="ml-auto bg-brand-purple/20 text-brand-purple py-0.5 px-2 rounded-full text-xs font-semibold">
        {count}
      </span>
    )}
  </button>
);

const SidebarContent: React.FC<{
  currentPage: Page;
  setCurrentPage: (page: Page) => void;
  onCloseMobile?: () => void;
  uncategorizedCount?: number;
}> = ({ currentPage, setCurrentPage, onCloseMobile, uncategorizedCount }) => {
  const handleNav = (page: Page) => {
    setCurrentPage(page);
    if (onCloseMobile) onCloseMobile();
  };

  return (
    <div className="flex flex-col h-full bg-[#11161d] border-r border-white/5">
      {/* Brand */}
      <div className="flex items-center gap-3 px-6 h-16 border-b border-white/5 bg-[#11161d]">
        <div className="bg-brand-purple/10 p-1.5 rounded-lg">
          <LogoIcon className="h-6 w-6 text-brand-purple" />
        </div>
        <h1 className="text-lg font-bold text-white tracking-tight">Jellyfin Org</h1>
      </div>

      <div className="flex-1 overflow-y-auto py-6 flex flex-col gap-1">
        <NavItem 
          page="Dashboard" 
          icon={<DashboardIcon />} 
          isActive={currentPage === 'Dashboard'} 
          onClick={() => handleNav('Dashboard')} 
        />
        
        <div className="text-xs font-semibold leading-6 text-gray-500 uppercase tracking-wider mb-2 mt-6 px-4">
          Library
        </div>
        
        <NavItem 
          page="Movies" 
          icon={<MoviesIcon />} 
          isActive={currentPage === 'Movies'} 
          onClick={() => handleNav('Movies')} 
        />
        <NavItem 
          page="TV Shows" 
          icon={<TvIcon />} 
          isActive={currentPage === 'TV Shows'} 
          onClick={() => handleNav('TV Shows')} 
        />
        <NavItem 
          page="Uncategorized" 
          icon={<UncategorizedIcon />} 
          isActive={currentPage === 'Uncategorized'} 
          onClick={() => handleNav('Uncategorized')}
          count={uncategorizedCount}
        />

        <div className="mt-auto pt-4 border-t border-white/5">
           <NavItem 
            page="Settings" 
            icon={<SettingsIcon />} 
            isActive={currentPage === 'Settings'} 
            onClick={() => handleNav('Settings')} 
          />
        </div>
      </div>
      
      <div className="p-4 border-t border-white/5 text-center">
        <p className="text-xs text-gray-600 font-mono">v1.0.0 Beta</p>
      </div>
    </div>
  );
};

const Sidebar: React.FC<SidebarProps> = ({ currentPage, setCurrentPage, isOpen, setIsOpen, uncategorizedCount }) => {
  return (
    <>
      {/* Mobile Backdrop & Drawer */}
      <div className={`relative z-50 lg:hidden ${isOpen ? 'block' : 'hidden'}`} role="dialog" aria-modal="true">
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity opacity-100" 
          onClick={() => setIsOpen(false)}
        />
        <div className="fixed inset-0 flex">
          <div className="relative mr-16 flex w-full max-w-xs flex-1">
            <div className="absolute top-0 right-0 -mr-12 pt-4">
              <button 
                type="button" 
                className="ml-1 flex h-10 w-10 items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
                onClick={() => setIsOpen(false)}
              >
                <span className="sr-only">Close sidebar</span>
                <CloseIcon className="h-6 w-6 text-white" />
              </button>
            </div>
            
            {/* Drawer Content */}
            <div className="flex-1 bg-[#11161d]">
              <SidebarContent 
                currentPage={currentPage} 
                setCurrentPage={setCurrentPage} 
                onCloseMobile={() => setIsOpen(false)}
                uncategorizedCount={uncategorizedCount}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Desktop Fixed Sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-72 lg:flex-col">
        <SidebarContent 
          currentPage={currentPage} 
          setCurrentPage={setCurrentPage}
          uncategorizedCount={uncategorizedCount}
        />
      </div>
    </>
  );
};

export default Sidebar;
