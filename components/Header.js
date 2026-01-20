import React from 'react';
import { html } from 'htm/react';
import { MenuIcon } from '../lib/icons.js';

const Header = ({ title, actionButton, onMenuClick }) => {
  return html`
    <div className="flex justify-between items-center p-6 border-b border-gray-700">
      <div className="flex items-center gap-4">
        ${onMenuClick && html`
            <button 
                onClick=${onMenuClick} 
                className="md:hidden p-1 -ml-2 text-gray-300 hover:text-white"
                aria-label="Open menu"
            >
                <${MenuIcon} />
            </button>
        `}
        <h1 className="text-3xl font-bold text-white">${title}</h1>
      </div>
      ${actionButton && html`<div>${actionButton}</div>`}
    </div>
  `;
};

export default Header;