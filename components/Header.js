
import React from 'react';
import { html } from 'htm/react';
import { MenuIcon, SettingsIcon } from '../lib/icons.js';

const Header = ({ title, actionButton, onMenuClick, onSettingsClick }) => {
  const isOnline = true; 

  return html`
    <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-white/5 bg-[#0b0f14]/90 backdrop-blur px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
      ${onMenuClick && html`
        <button 
          type="button" 
          className="-m-2.5 p-2.5 text-gray-400 lg:hidden hover:text-white"
          onClick=${onMenuClick}
        >
          <span className="sr-only">Open sidebar</span>
          <${MenuIcon} className="h-6 w-6" aria-hidden="true" />
        </button>
      `}

      <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
        <div className="flex flex-1 items-center gap-3">
            <h1 className="text-xl font-bold text-white tracking-tight truncate">${title}</h1>
            <div className="flex items-center gap-1.5 bg-gray-800/50 rounded-full px-2 py-0.5 border border-white/5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full ${isOnline ? 'bg-green-400' : 'bg-red-400'} opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 ${isOnline ? 'bg-green-500' : 'bg-red-500'}"></span>
                </span>
                <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider hidden sm:block">
                    ${isOnline ? 'Online' : 'Offline'}
                </span>
            </div>
        </div>
        
        <div className="flex items-center gap-x-4 lg:gap-x-6">
          <div className="flex items-center gap-2">
            ${actionButton}
            ${onSettingsClick && html`
              <button 
                className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                onClick=${onSettingsClick}
                aria-label="Quick Settings"
              >
                  <${SettingsIcon} className="w-5 h-5" />
              </button>
            `}
          </div>
          
          <div className="hidden lg:block lg:h-6 lg:w-px lg:bg-white/10" aria-hidden="true"></div>
        </div>
      </div>
    </div>
  `;
};

export default Header;
