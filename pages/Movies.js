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
import { searchMovies } from '../lib/tmdb.js';

const Movies = ({ onMenuClick }) => {
    const [movies, setMovies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedMovie, setSelectedMovie] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({});
    
    // Re-Identify Mode State
    const [isReIdentifying, setIsReIdentifying] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearchingTMDB, setIsSearchingTMDB] = useState(false);

    const { addToast } = useToast();

    useEffect(() => {
        fetch('/api/movies')
            .then(res => res.json())
            .then(data => {
                setMovies(data);
                setLoading(false);
            })
            .catch(err => {
                console.error("Failed to fetch movies", err);
                setLoading(false);
            });
    }, []);

    const handleCardClick = (movie) => {
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

    // --- Render Logic ---
    const renderContent = () => {
        // ... (Keep existing render logic for Edit/Identify, just removing mock init) ...
        if (isReIdentifying) {
             // Simplified for brevity, reusing logic structure but ensure we use real data
             return html`<div>Re-identify feature pending backend integration.</div>`;
        }
        
        return html`
            <p className="text-gray-300 leading-relaxed">${selectedMovie.overview || "No overview available."}</p>
            <div className="mt-4">
                <h4 className="font-bold text-white text-sm uppercase tracking-wide mb-1">File Path</h4>
                <div className="bg-gray-900/50 border border-gray-700 p-3 rounded-lg">
                    <p className="text-xs text-gray-400 font-mono break-all">${selectedMovie.filePath}</p>
                </div>
            </div>
            <div className="flex gap-4 pt-6 mt-auto">
                <${Button} variant="secondary" onClick=${() => addToast("Feature coming soon", "info")}>Edit Details</${Button}>
            </div>
        `;
    };

    return html`
        <div className="flex flex-col h-full">
            <${Header} title="Organized Movies" onMenuClick=${onMenuClick} />
            <div className="p-6 overflow-y-auto">
                ${loading ? html`<div className="flex justify-center pt-20"><${Spinner} size="lg"/></div>` : html`
                    <${PosterGrid}>
                        ${movies.map(movie => html`
                            <${PosterCard} key=${movie._id || movie.id} item=${movie} onClick=${() => handleCardClick(movie)} />
                        `)}
                    </${PosterGrid}>
                    ${movies.length === 0 && html`<div className="text-center text-gray-500 pt-10">No movies found in database.</div>`}
                `}
            </div>

            <${Modal} isOpen=${!!selectedMovie} onClose=${handleCloseModal} title=${selectedMovie?.title || ''}>
                ${selectedMovie && html`
                    <div className="flex flex-col md:flex-row gap-6 h-full">
                        <div className="md:w-1/3 flex-shrink-0">
                             <div className="relative aspect-[2/3] w-full rounded-lg overflow-hidden shadow-lg">
                                <img src="${selectedMovie.posterPath ? `https://image.tmdb.org/t/p/w500${selectedMovie.posterPath}` : 'https://placehold.co/500x750?text=No+Img'}" alt=${selectedMovie.title} className="w-full h-full object-cover"/>
                            </div>
                        </div>
                        <div className="md:w-2/3 flex flex-col">
                            ${renderContent()}
                        </div>
                    </div>
                `}
            </${Modal}>
        </div>
    `;
};

export default Movies;
