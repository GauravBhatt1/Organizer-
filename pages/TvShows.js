import React, { useState, useEffect } from 'react';
import { html } from 'htm/react';
import Header from '../components/Header.js';
import PosterGrid from '../components/PosterGrid.js';
import PosterCard from '../components/PosterCard.js';
import Modal from '../components/Modal.js';
import Spinner from '../components/Spinner.js';
import Button from '../components/Button.js';
import Input from '../components/Input.js';
import { SearchIcon } from '../lib/icons.js';
import { useToast } from '../hooks/useToast.js';
import { searchTvShows } from '../lib/tmdb.js';

const TvShows = ({ onMenuClick }) => {
    const [shows, setShows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedShow, setSelectedShow] = useState(null);
    
    // Re-Identify State
    const [isReIdentifying, setIsReIdentifying] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearchingTMDB, setIsSearchingTMDB] = useState(false);

    const { addToast } = useToast();

    useEffect(() => {
        fetch('/api/tvshows')
            .then(res => res.json())
            .then(data => {
                setShows(data);
                setLoading(false);
            })
            .catch(err => {
                console.error("Failed to fetch TV shows", err);
                setLoading(false);
            });
    }, []);

    const handleCardClick = (show) => {
        setSelectedShow(show);
        setIsReIdentifying(false);
        setSearchResults([]);
    };

    const handleCloseModal = () => {
        setSelectedShow(null);
        setIsReIdentifying(false);
        setSearchResults([]);
    };

    // --- Re-Identify Handlers ---
    const handleReIdentifyClick = () => {
        setIsReIdentifying(true);
        setSearchQuery(selectedShow.title);
        setSearchResults([]);
    };

    const handleSearch = async () => {
        if (!searchQuery.trim()) return;
        setIsSearchingTMDB(true);
        
        try {
            const apiKey = localStorage.getItem('tmdb_api_key');
            if (!apiKey) {
                addToast('Please set TMDB API Key in Settings', 'error');
                setIsSearchingTMDB(false);
                return;
            }

            const results = await searchTvShows(searchQuery, apiKey);
            setSearchResults(results);
        } catch (error) {
            console.error(error);
            addToast('Failed to search TMDB', 'error');
            setSearchResults([]);
        } finally {
            setIsSearchingTMDB(false);
        }
    };

    const handleSelectResult = (result) => {
        const updatedDetails = {
            title: result.title,
            year: result.year,
            posterPath: result.posterPath,
            overview: result.overview
        };
        setShows(prev => prev.map(s => s.id === selectedShow.id ? { ...s, ...updatedDetails } : s));
        setSelectedShow(prev => ({ ...prev, ...updatedDetails }));
        setIsReIdentifying(false);
        addToast('TV Show re-identified successfully', 'success');
    };

    const handleCancelReIdentify = () => {
        setIsReIdentifying(false);
        setSearchResults([]);
    };

    const renderContent = () => {
        if (isReIdentifying) {
            return html`
                <div className="space-y-4 h-full flex flex-col">
                    <div className="flex gap-2">
                        <${Input} 
                            label="Search TMDB" 
                            id="tmdb-search-input-tv" 
                            value=${searchQuery}
                            onChange=${(e) => setSearchQuery(e.target.value)}
                            onKeyDown=${(e) => e.key === 'Enter' && handleSearch()}
                            placeholder="Enter TV show title..."
                            autoFocus
                        />
                        <${Button} onClick=${handleSearch} isLoading=${isSearchingTMDB} className="self-end" icon=${html`<${SearchIcon} />`}>Search</${Button}>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto space-y-2 min-h-[200px] bg-gray-900/50 p-2 rounded-lg border border-gray-700">
                        ${searchResults.length === 0 && !isSearchingTMDB && html`
                            <div className="flex h-full items-center justify-center text-gray-500 text-sm">
                                ${searchResults.length === 0 ? 'Enter a title to search TMDB' : ''}
                            </div>
                        `}
                        ${searchResults.map(result => html`
                            <div key=${result.id} className="flex items-center gap-3 bg-gray-700 p-2 rounded-lg hover:bg-gray-600 transition-colors">
                                <img src="${result.posterPath ? `https://image.tmdb.org/t/p/w92${result.posterPath}` : 'https://placehold.co/92x138?text=No+Img'}" alt=${result.title} className="w-10 h-auto rounded shadow-sm object-cover"/>
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-white text-sm truncate">${result.title}</p>
                                    <p className="text-xs text-gray-400">${result.year}</p>
                                </div>
                                <${Button} variant="primary" className="text-xs py-1 px-3" onClick=${() => handleSelectResult(result)}>Select</${Button}>
                            </div>
                        `)}
                         ${isSearchingTMDB && html`<div className="flex justify-center p-4"><${Spinner} size="md"/></div>`}
                    </div>

                    <div className="flex justify-end pt-2">
                         <${Button} variant="secondary" onClick=${handleCancelReIdentify}>Cancel</${Button}>
                    </div>
                </div>
            `;
        }

        return html`
            <p className="text-gray-300 leading-relaxed">${selectedShow.overview}</p>
            <div className="mt-4">
               <h4 className="font-bold text-white text-sm uppercase tracking-wide mb-1">Root Folder</h4>
               <div className="bg-gray-900/50 border border-gray-700 p-3 rounded-lg">
                    <p className="text-xs text-gray-400 font-mono break-all">${selectedShow.filePath}</p>
               </div>
            </div>
            <div className="flex gap-4 pt-6 mt-auto">
               <${Button} variant="primary" onClick=${handleReIdentifyClick} icon=${html`<${SearchIcon} />`}>Re-Identify</${Button}>
               <${Button} variant="secondary">View Seasons</${Button}>
            </div>
        `;
    };
    
    return html`
        <div className="flex flex-col h-full">
            <${Header} title="Organized TV Shows" onMenuClick=${onMenuClick} />
            <div className="p-6 overflow-y-auto">
                <${PosterGrid}>
                    ${shows.map(show => html`
                        <${PosterCard} key=${show.id} item=${show} onClick=${() => handleCardClick(show)} />
                    `)}
                </${PosterGrid}>
                 ${shows.length === 0 && !loading && html`<div className="text-center text-gray-500 pt-10">No organized TV shows found.</div>`}
                 ${loading && html`<div className="flex justify-center pt-20"><${Spinner} size="lg"/></div>`}
            </div>

            <${Modal} isOpen=${!!selectedShow} onClose=${handleCloseModal} title=${isReIdentifying ? `Identify: ${selectedShow?.title}` : (selectedShow?.title || '')}>
                ${selectedShow ? html`
                    <div className="flex flex-col md:flex-row gap-6 h-full">
                        <div className="md:w-1/3 flex-shrink-0">
                            <div className="relative aspect-[2/3] w-full rounded-lg overflow-hidden shadow-lg">
                                <img src="https://image.tmdb.org/t/p/w500${selectedShow.posterPath}" alt=${selectedShow.title} className="w-full h-full object-cover"/>
                            </div>
                        </div>
                        <div className="md:w-2/3 flex flex-col">
                            ${renderContent()}
                        </div>
                    </div>
                ` : html`
                    <div className="flex justify-center items-center h-64">
                        <${Spinner} size="lg" />
                    </div>
                `}
            </${Modal}>
        </div>
    `;
};

export default TvShows;
