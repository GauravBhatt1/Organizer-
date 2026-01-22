import React, { useState, useEffect } from 'react';
import { html } from 'htm/react';
import Header from '../components/Header.js';
import Modal from '../components/Modal.js';
import Button from '../components/Button.js';
import Input from '../components/Input.js';
import Spinner from '../components/Spinner.js';
import { SearchIcon, FileIcon, CheckCircleIcon } from '../lib/icons.js';
import { useToast } from '../hooks/useToast.js';

const Uncategorized = ({ onMenuClick }) => {
    const [uncategorizedItems, setUncategorizedItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedItem, setSelectedItem] = useState(null);
    const { addToast } = useToast();

    useEffect(() => {
        fetch('/api/uncategorized')
            .then(res => res.json())
            .then(data => {
                setUncategorizedItems(data);
                setLoading(false);
            })
            .catch(err => {
                console.error("Failed to fetch uncategorized items", err);
                setLoading(false);
            });
    }, []);

    const openSearchModal = (item) => {
        setSelectedItem(item);
    };

    const closeSearchModal = () => {
        setSelectedItem(null);
    };
    
    return html`
        <div className="flex flex-col h-full bg-gray-900">
            <${Header} title="Uncategorized Items" onMenuClick=${onMenuClick} />
            <div className="p-8 overflow-y-auto">
                ${loading ? html`<div className="flex justify-center pt-20"><${Spinner} size="lg"/></div>` : html`
                    <ul className="space-y-4 max-w-5xl mx-auto">
                        ${uncategorizedItems.map(item => html`
                            <li key=${item._id || item.id} className="bg-gray-800/40 border border-gray-700/50 hover:border-brand-purple/50 p-5 rounded-xl flex items-center justify-between transition-all duration-200 hover:bg-gray-800/70 group">
                                <div className="flex items-center gap-5 overflow-hidden">
                                    <div className="p-3 bg-gray-700/50 rounded-lg text-gray-400 group-hover:text-brand-purple transition-colors">
                                        <${FileIcon} className="w-8 h-8" />
                                    </div>
                                    <div className="truncate">
                                        <p className="font-semibold text-lg text-gray-200 truncate group-hover:text-white">${item.fileName}</p>
                                        <p className="text-sm text-gray-500 font-mono truncate mt-0.5">${item.filePath}</p>
                                    </div>
                                </div>
                                <${Button} onClick=${() => openSearchModal(item)} icon=${html`<${SearchIcon} />`} className="flex-shrink-0 ml-4">
                                    Identify
                                </${Button}>
                            </li>
                        `)}
                        ${uncategorizedItems.length === 0 && html`
                        <div className="text-center py-20 text-gray-500 bg-gray-800/20 rounded-2xl border border-gray-800 border-dashed">
                            <${CheckCircleIcon} className="w-16 h-16 mx-auto mb-4 text-green-500/20" />
                            <p className="text-xl font-medium text-gray-400">All caught up!</p>
                            <p className="text-sm mt-2">No uncategorized files found.</p>
                        </div>
                        `}
                    </ul>
                `}
            </div>

            <${Modal} isOpen=${!!selectedItem} onClose=${closeSearchModal} title="Identify Media">
                <div className="p-4 text-center">
                    <p className="mb-4">Manual identification feature coming soon.</p>
                    <p className="text-sm text-gray-400">Selected: ${selectedItem?.fileName}</p>
                </div>
            </${Modal}>
        </div>
    `;
};

export default Uncategorized;
