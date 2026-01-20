import React, { useState } from 'react';
import Header from '../components/Header.jsx';
import Modal from '../components/Modal.jsx';
import Button from '../components/Button.jsx';
import Input from '../components/Input.jsx';
import Spinner from '../components/Spinner.jsx';
import { SearchIcon, FileIcon } from '../lib/icons.jsx';
import { useToast } from '../hooks/useToast.jsx';

const MOCK_UNCATEGORIZED = [
  { id: '1', filePath: '/mnt/cloud/movies2/random/movie_2023.mkv', fileName: 'movie_2023.mkv' },
  { id: '2', filePath: '/mnt/cloud/tvshows/dl/series.s01e01/ep1.mp4', fileName: 'ep1.mp4' },
  { id: '3', filePath: '/mnt/cloud/movies1/temp/final_cut.avi', fileName: 'final_cut.avi' },
];

const MOCK_SEARCH_RESULTS = [
    { id: 1, title: 'The Super Mario Bros. Movie', year: 2023, posterPath: '/qNBAXBIQlnOThrVvA6mA2B5ggV6.jpg' },
    { id: 2, title: 'Super Mario Bros.', year: 1993, posterPath: '/3r1i8oKsb3aFFbN3e2p2sQdJz7w.jpg' },
];

const Uncategorized = ({ onMenuClick }) => {
    const [uncategorizedItems, setUncategorizedItems] = useState(MOCK_UNCATEGORIZED);
    const [selectedItem, setSelectedItem] = useState(null);
    const [isSearching, setIsSearching] = useState(false);
    const [searchResults, setSearchResults] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const { addToast } = useToast();

    const openSearchModal = (item) => {
        setSelectedItem(item);
        setSearchQuery(item.fileName.replace(/\.(mkv|mp4|avi)$/i, '').replace(/[\._]/g, ' '));
        setSearchResults([]);
    };
    
    const handleSearch = async () => {
        if (!searchQuery.trim()) return;
        setIsSearching(true);
        // Simulate TMDB API call
        await new Promise(resolve => setTimeout(resolve, 1000));
        setSearchResults(MOCK_SEARCH_RESULTS);
        setIsSearching(false);
    };

    const handleSelectResult = (result) => {
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

    const modalTitle = selectedItem ? `Identify: ${selectedItem.fileName}` : 'Identify';
    
    return (
        <div className="flex flex-col h-full">
            <Header title="Uncategorized Items" onMenuClick={onMenuClick} />
            <div className="p-6 overflow-y-auto">
                <ul className="space-y-3">
                    {uncategorizedItems.map(item => (
                        <li key={item.id} className="bg-gray-800 p-4 rounded-lg flex items-center justify-between">
                            <div className="flex items-center gap-4 overflow-hidden">
                                <FileIcon className="w-6 h-6 text-gray-400 flex-shrink-0" />
                                <div className="truncate">
                                    <p className="font-mono text-white truncate">{item.fileName}</p>
                                    <p className="text-sm text-gray-500 font-mono truncate">{item.filePath}</p>
                                </div>
                            </div>
                            <Button onClick={() => openSearchModal(item)} icon={<SearchIcon />} className="flex-shrink-0">
                                Identify
                            </Button>
                        </li>
                    ))}
                    {uncategorizedItems.length === 0 && (
                      <div className="text-center py-10 text-gray-500">
                        <p className="text-lg">No uncategorized items found.</p>
                        <p>Your library is perfectly organized!</p>
                      </div>
                    )}
                </ul>
            </div>

            <Modal isOpen={!!selectedItem} onClose={closeSearchModal} title={modalTitle}>
                <div className="space-y-4">
                    <div className="flex gap-2">
                        <Input 
                            label="Search TMDB" 
                            id="tmdb-search" 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        />
                        <Button onClick={handleSearch} isLoading={isSearching} className="self-end">Search</Button>
                    </div>

                    <div className="max-h-96 overflow-y-auto space-y-2 pr-2">
                        {isSearching && <div className="flex justify-center p-8"><Spinner /></div>}
                        {searchResults.map(result => (
                            <div key={result.id} className="flex items-center gap-4 bg-gray-700 p-3 rounded-lg">
                                <img src={`https://image.tmdb.org/t/p/w92${result.posterPath}`} alt={result.title} className="w-12 h-auto rounded"/>
                                <div className="flex-1">
                                    <p className="font-bold text-white">{result.title}</p>
                                    <p className="text-sm text-gray-400">{result.year}</p>
                                </div>
                                <Button variant="secondary" onClick={() => handleSelectResult(result)}>Select</Button>
                            </div>
                        ))}
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default Uncategorized;