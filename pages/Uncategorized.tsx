
import React, { useState } from 'react';
import Header from '../components/Header.tsx';
import Modal from '../components/Modal.tsx';
import Button from '../components/Button.tsx';
import Input from '../components/Input.tsx';
import Spinner from '../components/Spinner.tsx';
import { SearchIcon, FileIcon } from '../lib/icons.tsx';
import type { UncategorizedItem, TmdbSearchResult } from '../types.ts';
import { useToast } from '../hooks/useToast.tsx';
import { searchMovies } from '../lib/tmdb.ts';

const MOCK_UNCATEGORIZED: UncategorizedItem[] = [
  { id: '1', filePath: '/mnt/cloud/movies2/random/movie_2023.mkv', fileName: 'movie_2023.mkv' },
  { id: '2', filePath: '/mnt/cloud/tvshows/dl/series.s01e01/ep1.mp4', fileName: 'ep1.mp4' },
  { id: '3', filePath: '/mnt/cloud/movies1/temp/final_cut.avi', fileName: 'final_cut.avi' },
];

interface UncategorizedProps {
    onMenuClick: () => void;
}

const Uncategorized: React.FC<UncategorizedProps> = ({ onMenuClick }) => {
    const [uncategorizedItems, setUncategorizedItems] = useState(MOCK_UNCATEGORIZED);
    const [selectedItem, setSelectedItem] = useState<UncategorizedItem | null>(null);
    const [isSearching, setIsSearching] = useState(false);
    const [searchResults, setSearchResults] = useState<TmdbSearchResult[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const { addToast } = useToast();

    const openSearchModal = (item: UncategorizedItem) => {
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

    const handleSelectResult = (result: TmdbSearchResult) => {
        console.log(`Matching ${selectedItem?.fileName} to ${result.title}`);
        addToast(`Organized '${result.title}' successfully!`, 'success');
        
        // Remove from list and close modal
        if (selectedItem) {
            setUncategorizedItems(prev => prev.filter(item => item.id !== selectedItem.id));
        }
        closeSearchModal();
    };

    const closeSearchModal = () => {
        setSelectedItem(null);
        setSearchQuery('');
        setSearchResults([]);
    };

    const modalTitle = selectedItem ? `Identify: ${selectedItem.fileName}` : 'Identify Media';
    
    return (
        <div className="flex flex-col h-full bg-gray-900">
            <Header title="Uncategorized Items" onMenuClick={onMenuClick} />
            <div className="p-8 overflow-y-auto">
                <ul className="space-y-4 max-w-5xl mx-auto">
                    {uncategorizedItems.map(item => (
                        <li key={item.id} className="bg-gray-800/40 border border-gray-700/50 hover:border-brand-purple/50 p-5 rounded-xl flex items-center justify-between transition-all duration-200 hover:bg-gray-800/70 group">
                            <div className="flex items-center gap-5 overflow-hidden">
                                <div className="p-3 bg-gray-700/50 rounded-lg text-gray-400 group-hover:text-brand-purple transition-colors">
                                    <FileIcon className="w-8 h-8" />
                                </div>
                                <div className="truncate">
                                    <p className="font-semibold text-lg text-gray-200 truncate group-hover:text-white">{item.fileName}</p>
                                    <p className="text-sm text-gray-500 font-mono truncate mt-0.5">{item.filePath}</p>
                                </div>
                            </div>
                            <Button onClick={() => openSearchModal(item)} icon={<SearchIcon />} className="flex-shrink-0 ml-4">
                                Identify
                            </Button>
                        </li>
                    ))}
                    {uncategorizedItems.length === 0 && (
                      <div className="text-center py-20 text-gray-500 bg-gray-800/20 rounded-2xl border border-gray-800 border-dashed">
                        <CheckCircleIcon className="w-16 h-16 mx-auto mb-4 text-green-500/20" />
                        <p className="text-xl font-medium text-gray-400">All caught up!</p>
                        <p className="text-sm mt-2">Your library is perfectly organized.</p>
                      </div>
                    )}
                </ul>
            </div>

            <Modal isOpen={!!selectedItem} onClose={closeSearchModal} title={modalTitle}>
                <div className="space-y-6">
                    <div className="flex gap-3">
                        <Input 
                            label="Search TMDB" 
                            id="tmdb-search" 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            placeholder="Type movie name..."
                            autoFocus
                        />
                        <Button onClick={handleSearch} isLoading={isSearching} className="self-end h-[42px]" icon={<SearchIcon />}>Search</Button>
                    </div>

                    <div className="max-h-[500px] overflow-y-auto space-y-3 pr-1 custom-scrollbar">
                        {isSearching && (
                            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                                <Spinner size="lg" />
                                <span className="mt-3 text-sm animate-pulse">Searching Database...</span>
                            </div>
                        )}
                        
                        {!isSearching && searchResults.length === 0 && searchQuery && (
                            <div className="text-center text-gray-500 py-12 bg-gray-900/50 rounded-xl border border-gray-800">
                                <p>No results found for "{searchQuery}"</p>
                            </div>
                        )}

                        {searchResults.map(result => (
                            <div key={result.id} className="flex gap-4 p-4 rounded-xl bg-gray-900/40 border border-gray-700/50 hover:bg-gray-800 hover:border-brand-purple/50 transition-all duration-200 group">
                                <img 
                                    src={result.posterPath ? `https://image.tmdb.org/t/p/w200${result.posterPath}` : 'https://placehold.co/200x300?text=No+Img'} 
                                    alt={result.title} 
                                    className="w-20 rounded-lg shadow-md aspect-[2/3] object-cover bg-gray-800"
                                />
                                <div className="flex-1 flex flex-col min-w-0">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="font-bold text-lg text-gray-100 group-hover:text-brand-purple-light transition-colors line-clamp-1">{result.title}</p>
                                            <p className="text-sm text-gray-400 font-medium">{result.year}</p>
                                        </div>
                                        <Button 
                                            variant="secondary" 
                                            onClick={() => handleSelectResult(result)}
                                            className="text-xs px-3 py-1 ml-2 bg-gray-700 hover:bg-brand-purple hover:text-white border border-gray-600 hover:border-brand-purple transition-all"
                                        >
                                            Select
                                        </Button>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-2 line-clamp-2 leading-relaxed">{result.overview}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </Modal>
        </div>
    );
};
function CheckCircleIcon(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

export default Uncategorized;
