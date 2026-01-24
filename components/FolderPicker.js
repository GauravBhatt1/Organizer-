import React, { useState, useEffect } from 'react';
import { html } from 'htm/react';
import Modal from './Modal.js';
import Button from './Button.js';
import Spinner from './Spinner.js';
import { FileIcon } from '../lib/icons.js';

const FolderPicker = ({ isOpen, onClose, onSelect, title = "Select Folder" }) => {
  // Always start at strict /data root
  const [currentPath, setCurrentPath] = useState('/data');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchFolders = async (path) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/fs/list?path=${encodeURIComponent(path)}`);
      if (!res.ok) throw new Error((await res.json()).message);
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
    if (isOpen) fetchFolders('/data');
  }, [isOpen]);

  const goUp = () => {
    if (currentPath === '/data') return;
    const parts = currentPath.split('/');
    parts.pop();
    const parent = parts.join('/') || '/data';
    // Prevent traversing above /data
    if (parent.length < 5) fetchFolders('/data');
    else fetchFolders(parent);
  };

  return html`
    <${Modal} isOpen=${isOpen} onClose=${onClose} title=${title}>
      <div className="flex flex-col h-[500px]">
        <div className="bg-gray-900/50 p-2 rounded mb-4 text-xs font-mono text-gray-400">
            ${currentPath}
        </div>
        <div className="flex-1 overflow-y-auto border border-gray-700 rounded-lg bg-gray-900/30 custom-scrollbar">
          ${loading && html`<div className="flex justify-center p-12"><${Spinner} /></div>`}
          ${!loading && html`
            <div className="divide-y divide-gray-800">
              ${currentPath !== '/data' && html`
                <button onClick=${goUp} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 text-gray-400 text-left">
                  <span className="text-xl">..</span> <span className="text-sm">Up</span>
                </button>
              `}
              ${items.map(item => html`
                <button 
                  key=${item.path}
                  onClick=${() => fetchFolders(item.path)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-brand-purple/10 text-gray-300 text-left"
                >
                  <${FileIcon} className="w-5 h-5 text-gray-500" />
                  <span className="text-sm font-medium truncate">${item.name}</span>
                </button>
              `)}
            </div>
          `}
          ${error && html`<div className="p-4 text-red-400 text-sm text-center">${error}</div>`}
        </div>
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-700">
            <${Button} variant="secondary" onClick=${onClose}>Cancel</${Button}>
            <${Button} variant="primary" onClick=${() => onSelect(currentPath)}>Select This Folder</${Button}>
        </div>
      </div>
    </${Modal}>
  `;
};

export default FolderPicker;