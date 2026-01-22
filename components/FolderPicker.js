
import React, { useState, useEffect } from 'react';
import { html } from 'htm/react';
import Modal from './Modal.js';
import Button from './Button.js';
import Spinner from './Spinner.js';
import { FileIcon, CloseIcon } from '../lib/icons.js';

const FolderPicker = ({ isOpen, onClose, onSelect, title = "Select Folder" }) => {
  const [currentPath, setCurrentPath] = useState('/host');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchFolders = async (path) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/fs/list?path=${encodeURIComponent(path)}`);
      if (!res.ok) throw new Error('Failed to load directory');
      const data = await res.json();
      setItems(data.items);
      setCurrentPath(data.currentPath);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchFolders(currentPath);
    }
  }, [isOpen]);

  const navigateTo = (path) => fetchFolders(path);

  const goUp = () => {
    if (currentPath === '/host') return;
    const parent = currentPath.split('/').slice(0, -1).join('/') || '/host';
    navigateTo(parent);
  };

  const breadcrumbs = currentPath.replace('/host', 'Host').split('/').filter(Boolean);

  return html`
    <${Modal} isOpen=${isOpen} onClose=${onClose} title=${title}>
      <div className="flex flex-col h-[500px]">
        <!-- Breadcrumbs -->
        <div className="flex items-center gap-1 text-xs font-mono text-gray-400 mb-4 bg-gray-900/50 p-2 rounded overflow-x-auto whitespace-nowrap">
          ${breadcrumbs.map((crumb, i) => html`
            <span key=${i} className="flex items-center">
              ${i > 0 && html`<span className="mx-1">/</span>`}
              <button 
                onClick=${() => {
                  const target = '/host' + currentPath.split('/host')[1].split('/').slice(0, i + 1).join('/');
                  navigateTo(target);
                }}
                className="hover:text-brand-purple"
              >
                ${crumb}
              </button>
            </span>
          `)}
        </div>

        <!-- Folder List -->
        <div className="flex-1 overflow-y-auto border border-gray-700 rounded-lg bg-gray-900/30 custom-scrollbar">
          ${loading && html`<div className="flex justify-center p-12"><${Spinner} /></div>`}
          
          ${!loading && html`
            <div className="divide-y divide-gray-800">
              ${currentPath !== '/host' && html`
                <button 
                  onClick=${goUp}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 text-gray-400 transition-colors text-left"
                >
                  <span className="text-xl">..</span>
                  <span className="text-sm font-medium">Parent Directory</span>
                </button>
              `}
              
              ${items.length === 0 && html`
                <div className="p-8 text-center text-gray-500 italic text-sm">
                  This folder is empty
                </div>
              `}

              ${items.map(item => html`
                <button 
                  key=${item.path}
                  onClick=${() => navigateTo(item.path)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-brand-purple/10 text-gray-300 hover:text-white transition-colors group text-left"
                >
                  <${FileIcon} className="w-5 h-5 text-gray-500 group-hover:text-brand-purple" />
                  <span className="text-sm font-medium truncate">${item.name}</span>
                </button>
              `)}
            </div>
          `}
          
          ${error && html`<div className="p-4 text-red-400 text-sm text-center">${error}</div>`}
        </div>

        <!-- Footer -->
        <div className="flex justify-between items-center mt-6 pt-4 border-t border-gray-700">
          <div className="text-xs text-gray-500 truncate max-w-[60%]">
            Selected: <span className="text-gray-300 font-mono">${currentPath}</span>
          </div>
          <div className="flex gap-3">
            <${Button} variant="secondary" onClick=${onClose}>Cancel</${Button}>
            <${Button} variant="primary" onClick=${() => onSelect(currentPath)}>Select This Folder</${Button}>
          </div>
        </div>
      </div>
    </${Modal}>
  `;
};

export default FolderPicker;
