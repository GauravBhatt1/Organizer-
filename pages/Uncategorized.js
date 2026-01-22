
import React, { useState, useEffect } from 'react';
import { html } from 'htm/react';
import Header from '../components/Header.js';
import Modal from '../components/Modal.js';
import Button from '../components/Button.js';
import Input from '../components/Input.js';
import Spinner from '../components/Spinner.js';
import { SearchIcon, FileIcon, CheckCircleIcon } from '../lib/icons.js';
import { useToast } from '../hooks/useToast.js';
import { searchMovies } from '../lib/tmdb.js';

const Uncategorized = ({ onMenuClick }) => {
    const [uncategorizedItems, setUncategorizedItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedItem, setSelectedItem] = useState(null);
    const [isSearching, setIsSearching] = useState(false);
    const [isOrganizing, setIsOrganizing] = useState(false);
    const [searchResults, setSearchResults] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
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
        setSearchQuery(item.fileName.replace(/\.(mkv|mp4|avi)$/i, '').replace(/[\._]/g, ' '));
        setSearchResults([]);
    };
    
    const handleSearch = async () => {
        if (!searchQuery.trim()) return;
        setIsSearching(true);
        
        try {
            const apiKey = localStorage.getItem('tmdb_api_key');
            if (!apiKey) {
                addToast('Please set TMDB API Key in Settings', 'error');
                setIsSearching(false);
                return;
            }

            const results = await searchMovies(searchQuery, apiKey);
            setSearchResults(results);
        } catch (error) {
            console.error(error);
            addToast('Failed to search TMDB', 'error');
            setSearchResults([]);
        } finally {
            setIsSearching(false);
        }
    };

    const handleSelectResult = async (result) => {
        if (!selectedItem) return;
        
        setIsOrganizing(true);
        addToast(`Organizing '${result.title}'...`, 'info');

        try {
            const res = await fetch('/api/organize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sourcePath: selectedItem.filePath,
                    type: 'movie', // Default to movie for this view
                    tmdbData: result
                })
            });

            const data = await res.json();
            
            if (res.ok) {
                addToast(`Successfully moved to: ${data.newPath}`, 'success');
                setUncategorizedItems(prev => prev.filter(item => item.id !== selectedItem.id));
                closeSearchModal();
            } else {
                throw new Error(data.message || 'Unknown error');
            }
        } catch (e) {
            addToast(`Organization Failed: ${e.message}`, 'error');
        } finally {
            setIsOrganizing(false);
        }
    };

    const closeSearchModal = () => {
        setSelectedItem(null);
        setSearchQuery('');
        setSearchResults([]);
        setIsOrganizing(false);
    };

    const modalTitle = selectedItem ? `Identify: ${selectedItem.fileName}` : 'Identify';
    
    return html`
        <div className="flex flex-col h-full">
            <${Header} title="Uncategorized Items" onMenuClick=${onMenuClick} />
            <div className="p-6 overflow-y-auto">
                ${loading ? html`<div className="flex justify-center pt-20"><${Spinner} size="lg"/></div>` : html`
                    <ul className="space-y-3">
                        ${uncategorizedItems.map(item => html`
                            <li key=${item._id || item.id} className="bg-gray-800 p-4 rounded-lg flex items-center justify-between">
                                <div className="flex items-center gap-4 overflow-hidden">
                                    <${FileIcon} className="w-6 h-6 text-gray-400 flex-shrink-0" />
                                    <div className="truncate">
                                        <p className="font-mono text-white truncate">${item.fileName}</p>
                                        <p className="text-sm text-gray-500 font-mono truncate">${item.filePath}</p>
                                    </div>
                                </div>
                                <${Button} onClick=${() => openSearchModal(item)} icon=${html`<${SearchIcon} />`} className="flex-shrink-0">
                                    Identify
                                </${Button}>
                            </li>
                        `)}
                        ${uncategorizedItems.length === 0 && html`
                          <div className="text-center py-10 text-gray-500">
                            <p className="text-lg">No uncategorized items found.</p>
                            <p>Your library is perfectly organized!</p>
                          </div>
                        `}
                    </ul>
                `}
            </div>

            <${Modal} isOpen=${!!selectedItem} onClose=${closeSearchModal} title=${modalTitle}>
                <div className="space-y-4">
                    <div className="flex gap-2">
                        <${Input} 
                            label="Search TMDB" 
                            id="tmdb-search" 
                            value=${searchQuery}
                            onChange=${(e) => setSearchQuery(e.target.value)}
                            onKeyDown=${(e) => e.key === 'Enter' && handleSearch()}
                            autoFocus
                        />
                        <${Button} onClick=${handleSearch} isLoading=${isSearching} className="self-end" disabled=${isOrganizing}>Search</${Button}>
                    </div>

                    <div className="max-h-96 overflow-y-auto space-y-2 pr-2">
                        ${isSearching && html`<div className="flex justify-center p-8"><${Spinner} /></div>`}
                        
                        ${isOrganizing && html`
                            <div className="flex flex-col items-center justify-center p-8 text-brand-purple">
                                <${Spinner} />
                                <span className="mt-2 text-sm font-semibold">Moving File...</span>
                            </div>
                        `}

                        ${!isSearching && !isOrganizing && searchResults.length === 0 && searchQuery && html`
                            <div className="text-center text-gray-500 py-4">No results found</div>
                        `}

                        ${!isOrganizing && searchResults.map(result => html`
                            <div key=${result.id} className="flex items-center gap-4 bg-gray-700 p-3 rounded-lg hover:bg-gray-600 transition-colors">
                                <img src="${result.posterPath ? `https://image.tmdb.org/t/p/w92${result.posterPath}` : 'https://placehold.co/92x138?text=No+Img'}" alt=${result.title} className="w-12 h-auto rounded shadow-sm object-cover"/>
                                <div className="flex-1">
                                    <p className="font-bold text-white">${result.title}</p>
                                    <p className="text-sm text-gray-400">${result.year}</p>
                                </div>
                                <${Button} variant="secondary" onClick=${() => handleSelectResult(result)}>Select</${Button}>
                            </div>
                        `)}
                    </div>
                </div>
            </${Modal}>
        </div>
    `;
};

export default Uncategorized;
