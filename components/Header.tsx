
import React from 'react';
import { MenuIcon } from '../lib/icons.tsx';

interface HeaderProps {
  title: string;
  actionButton?: React.ReactNode;
  onMenuClick?: () => void;
}

const Header: React.FC<HeaderProps> = ({ title, actionButton, onMenuClick }) => {
  return (
    <div className="flex justify-between items-center p-6 border-b border-gray-700">
      <div className="flex items-center gap-4">
        {onMenuClick && (
            <button 
                onClick={onMenuClick} 
                className="md:hidden p-1 -ml-2 text-gray-300 hover:text-white"
                aria-label="Open menu"
            >
                <MenuIcon />
            </button>
        )}
        <h1 className="text-3xl font-bold text-white">{title}</h1>
      </div>
      {actionButton && <div>{actionButton}</div>}
    </div>
  );
};

export default Header;