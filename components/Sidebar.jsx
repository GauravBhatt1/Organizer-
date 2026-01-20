import React from 'react';
import { DashboardIcon, MoviesIcon, TvIcon, UncategorizedIcon, SettingsIcon, LogoIcon } from '../lib/icons.jsx';

const Sidebar = ({ currentPage, setCurrentPage, isOpen, setIsOpen }) => {
  const navItems = [
    { page: 'Dashboard', icon: <DashboardIcon /> },
    { page: 'Movies', icon: <MoviesIcon /> },
    { page: 'TV Shows', icon: <TvIcon /> },
    { page: 'Uncategorized', icon: <UncategorizedIcon /> },
    { page: 'Settings', icon: <SettingsIcon /> },
  ];

  const sidebarClasses = `
    w-64 bg-gray-800 flex flex-col p-4 border-r border-gray-700
    transform transition-transform duration-300 ease-in-out
    fixed inset-y-0 left-0 z-30 md:static md:translate-x-0
    ${isOpen ? 'translate-x-0' : '-translate-x-full'}
  `;

  return (
    <>
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-20 md:hidden"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        ></div>
      )}
      <aside className={sidebarClasses}>
        <div className="flex items-center gap-3 mb-10 px-2">
          <LogoIcon className="h-10 w-10 text-brand-purple" />
          <h1 className="text-xl font-bold text-white">Jellyfin Organizer</h1>
        </div>
        <nav className="flex flex-col gap-2">
          {navItems.map(({ page, icon }) => (
            <button
              key={page}
              onClick={() => setCurrentPage(page)}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-left text-lg font-medium transition-colors duration-200 ${
                currentPage === page
                  ? 'bg-brand-purple text-white'
                  : 'text-gray-300 hover:bg-gray-700 hover:text-white'
              }`}
            >
              {icon}
              {page}
            </button>
          ))}
        </nav>
      </aside>
    </>
  );
};

export default Sidebar;
