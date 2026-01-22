import React, { useState } from 'react';
import Header from '../components/Header.tsx';
import PosterGrid from '../components/PosterGrid.tsx';
import PosterCard from '../components/PosterCard.tsx';
import Modal from '../components/Modal.tsx';
import Spinner from '../components/Spinner.tsx';
import Button from '../components/Button.tsx';
import Input from '../components/Input.tsx';
import { SearchIcon } from '../lib/icons.tsx';
import { useToast } from '../hooks/useToast.tsx';
import { searchMovies } from '../lib/tmdb.ts';
import type { MediaItem, TmdbSearchResult } from '../types.ts';

const INITIAL_MOVIES: MediaItem[] = [
  { id: 1, title: 'Pokémon Detective Pikachu', year: 2019, posterPath: '/4A2nK0lJw37a4Wyf0A8d2etp3T2.jpg', overview: 'In a world where people collect Pokémon to do battle, a boy comes across an intelligent talking Pikachu who seeks to be a detective.', filePath: '/mnt/cloud/movies1/Pokémon Detective Pikachu (2019)/Pokémon Detective Pikachu (2019).mkv' },
  { id: 2, title: 'Inception', year: 2010, posterPath: '/oYuLEt3zVCKq27gApcjBvA8wzft.jpg', overview: 'A thief who steals corporate secrets through the use of dream-sharing technology is given the inverse task of planting an idea into the mind of a C.E.O.', filePath: '/mnt/cloud/movies1/Inception (2010)/Inception (2010).mp4' },
  { id: 3, title: 'The Matrix', year: 1999, posterPath: '/f89U3ADr1oiB1s9Gz0gSbn0QZb0.jpg', overview: 'A computer hacker learns from mysterious rebels about the true nature of his reality and his role in the war against its controllers.', filePath: '/mnt/cloud/movies2/The Matrix (1999)/The Matrix.mkv' },
  { id: 4, title: 'Dune', year: 2021, posterPath: '/d5NXSklXo0qyIY2VvchkovscDXQ.jpg', overview: 'Paul Atreides, a brilliant and gifted young man born into a great destiny beyond his understanding, must travel to the most dangerous planet in the universe to ensure the future of his family and his people.', filePath: '/mnt/cloud/movies1/Dune (2021)/Dune Part One.mkv' },
];

interface MoviesProps {
    onMenuClick: () => void;
}

interface EditFormState {
    title: string;
    year: number;
    overview: string;
}

const Movies: React.FC<MoviesProps> = ({ onMenuClick }) => {
    const [movies, setMovies] = useState<MediaItem[]>(INITIAL_MOVIES);
    const [selectedMovie, setSelectedMovie] = useState<MediaItem | null>(null);
    
    // Edit Mode State
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState<EditFormState>({ title: '', year: 0, overview: '' });
    
    // Re-Identify Mode State
    const [isReIdentifying, setIsReIdentifying] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<TmdbSearchResult[]>([]);
    const [isSearchingTMDB, setIsSearchingTMDB] = useState(false);

    const { addToast } = useToast();

    const handleCardClick = (movie: MediaItem) => {
        setSelectedMovie(movie);
        setIsEditing(false);
        setIsReIdentifying(false);
        setSearchResults([]);
    };

    const handleCloseModal = () => {
        setSelectedMovie(null);
        setIsEditing(false);
        setIsReIdentifying(false);
        setSearchResults([]);
    };

    // --- Edit Handlers ---
    const handleEditClick = () => {
        if (!selectedMovie) return;
        setEditForm({
            title: selectedMovie.title,
            year: selectedMovie.year,
            overview: selectedMovie.overview
        });
        setIsEditing(true);
        setIsReIdentifying(false);
    };

    const handleSaveClick = () => {
        if (!selectedMovie) return;
        setMovies(prev => prev.map(m => m.id === selectedMovie.id ? { ...m, ...editForm } : m));
        setSelectedMovie(prev => prev ? { ...prev, ...editForm } : null);
        setIsEditing(false);
        addToast('Movie details updated successfully', 'success');
    };

    const handleCancelEdit = () => {
        setIsEditing(false);
    };

    // --- Re-Identify Handlers ---
    const handleReIdentifyClick = () => {
        if (!selectedMovie) return;
        setIsReIdentifying(true);
        setIsEditing(false);
        setSearchQuery(selectedMovie.title);
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

            const results = await searchMovies(searchQuery, apiKey);
            setSearchResults(results);
        } catch (error) {
            console.error(error);
            addToast('Failed to search TMDB. Check console for details.', 'error');
            setSearchResults([]);
        } finally {
            setIsSearchingTMDB(false);
        }
    };

    const handleSelectResult = (result: TmdbSearchResult) => {
        if (!selectedMovie) return;
        const updatedDetails = {
            title: result.title,
            year: result.year,
            posterPath: result.posterPath,
            overview: result.overview
        };
        setMovies(prev => prev.map(m => m.id === selectedMovie.id ? { ...m, ...updatedDetails } : m));
        setSelectedMovie(prev => prev ? { ...prev, ...updatedDetails } : null);
        setIsReIdentifying(false);
        addToast('Movie re-identified successfully', 'success');
    };

    const handleCancelReIdentify = () => {
        setIsReIdentifying(false);
        setSearchResults([]);
    };

    // --- Render Logic ---
    const renderContent = () => {
        if (!selectedMovie) return null;

        if (isEditing) {
            return (
                <div className="space-y-4">
                    <Input 
                        label="Title" 
                        id="edit-title"
                        value={editForm.title} 
                        onChange={e => setEditForm(prev => ({...prev, title: e.target.value}))} 
                    />
                    <Input 
                        label="Year" 
                        id="edit-year"
                        type="number" 
                        value={editForm.year} 
                        onChange={e => setEditForm(prev => ({...prev, year: parseInt(e.target.value)}))} 
                    />
                    <div className="w-full">
                        <label className="block text-sm font-medium text-gray-300 mb-1">Overview</label>
                        <textarea 
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-purple focus:border-transparent h-32"
                            value={editForm.overview}
                            onChange={e => setEditForm(prev => ({...prev, overview: e.target.value}))}
                        />
                    </div>
                    <div className="flex gap-4 pt-4">
                        <Button variant="success" onClick={handleSaveClick}>Save Changes</Button>
                        <Button variant="secondary" onClick={handleCancelEdit}>Cancel</Button>
                    </div>
                </div>
            );
        }

        if (isReIdentifying) {
            return (
                <div className="space-y-4 h-full flex flex-col">
                    <div className="flex gap-2">
                        <Input 
                            label="Search TMDB" 
                            id="tmdb-search-input" 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            placeholder="Enter movie title..."
                            autoFocus
                        />
                        <Button onClick={handleSearch} isLoading={isSearchingTMDB} className="self-end" icon={<SearchIcon />}>Search</Button>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto space-y-2 min-h-[200px] bg-gray-900/50 p-2 rounded-lg border border-gray-700">
                        {searchResults.length === 0 && !isSearchingTMDB && (
                            <div className="flex h-full items-center justify-center text-gray-500 text-sm">
                                Enter a title to search TMDB
                            </div>
                        )}
                        {searchResults.map(result => (
                            <div key={result.id} className="flex items-center gap-3 bg-gray-700 p-2 rounded-lg hover:bg-gray-600 transition-colors">
                                <img src={result.posterPath ? `https://image.tmdb.org/t/p/w92${result.posterPath}` : 'https://placehold.co/92x138?text=No+Img'} alt={result.title} className="w-10 h-auto rounded shadow-sm object-cover"/>
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-white text-sm truncate">{result.title}</p>
                                    <p className="text-xs text-gray-400">{result.year}</p>
                                </div>
                                <Button variant="primary" className="text-xs py-1 px-3" onClick={() => handleSelectResult(result)}>Select</Button>
                            </div>
                        ))}
                         {isSearchingTMDB && <div className="flex justify-center p-4"><Spinner size="md"/></div>}
                    </div>

                    <div className="flex justify-end pt-2">
                         <Button variant="secondary" onClick={handleCancelReIdentify}>Cancel</Button>
                    </div>
                </div>
            );
        }

        // Default View
        return (
            <>
                <p className="text-gray-300 leading-relaxed">{selectedMovie.overview}</p>
                <div className="mt-4">
                    <h4 className="font-bold text-white text-sm uppercase tracking-wide mb-1">File Path</h4>
                    <div className="bg-gray-900/50 border border-gray-700 p-3 rounded-lg">
                        <p className="text-xs text-gray-400 font-mono break-all">{selectedMovie.filePath}</p>
                    </div>
                </div>
                <div className="flex gap-4 pt-6 mt-auto">
                    <Button variant="primary" onClick={handleReIdentifyClick} icon={<SearchIcon />}>Re-Identify</Button>
                    <Button variant="secondary" onClick={handleEditClick}>Edit Details</Button>
                </div>
            </>
        );
    };

    return (
        <div className="flex flex-col h-full">
            <Header title="Organized Movies" onMenuClick={onMenuClick} />
            <div className="p-6 overflow-y-auto">
                <PosterGrid>
                    {movies.map(movie => (
                        <PosterCard key={movie.id} item={movie} onClick={() => handleCardClick(movie)} />
                    ))}
                </PosterGrid>
            </div>

            <Modal isOpen={!!selectedMovie} onClose={handleCloseModal} title={isReIdentifying ? `Identify: ${selectedMovie?.title}` : (selectedMovie?.title || '')}>
                {selectedMovie ? (
                    <div className="flex flex-col md:flex-row gap-6 h-full">
                        <div className="md:w-1/3 flex-shrink-0">
                             <div className="relative aspect-[2/3] w-full rounded-lg overflow-hidden shadow-lg">
                                <img src={`https://image.tmdb.org/t/p/w500${selectedMovie.posterPath}`} alt={selectedMovie.title} className="w-full h-full object-cover"/>
                            </div>
                        </div>
                        <div className="md:w-2/3 flex flex-col">
                            {renderContent()}
                        </div>
                    </div>
                ) : (
                    <div className="flex justify-center items-center h-64">
                        <Spinner size="lg"/>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default Movies;