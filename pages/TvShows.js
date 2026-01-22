import React, { useState, useEffect } from 'react';
import { html } from 'htm/react';
import Header from '../components/Header.js';
import PosterGrid from '../components/PosterGrid.js';
import PosterCard from '../components/PosterCard.js';
import Modal from '../components/Modal.js';
import Spinner from '../components/Spinner.js';
import Button from '../components/Button.js';
import { useToast } from '../hooks/useToast.js';

const TvShows = ({ onMenuClick }) => {
    const [shows, setShows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedShow, setSelectedShow] = useState(null);
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
    };

    const handleCloseModal = () => {
        setSelectedShow(null);
    };

    return html`
        <div className="flex flex-col h-full">
            <${Header} title="Organized TV Shows" onMenuClick=${onMenuClick} />
            <div className="p-6 overflow-y-auto">
                 ${loading ? html`<div className="flex justify-center pt-20"><${Spinner} size="lg"/></div>` : html`
                    <${PosterGrid}>
                        ${shows.map(show => html`
                            <${PosterCard} key=${show._id || show.id} item=${show} onClick=${() => handleCardClick(show)} />
                        `)}
                    </${PosterGrid}>
                    ${shows.length === 0 && html`<div className="text-center text-gray-500 pt-10">No TV shows found in database.</div>`}
                `}
            </div>

            <${Modal} isOpen=${!!selectedShow} onClose=${handleCloseModal} title=${selectedShow?.title || ''}>
                ${selectedShow && html`
                    <div className="flex flex-col md:flex-row gap-6 h-full">
                        <div className="md:w-1/3 flex-shrink-0">
                            <div className="relative aspect-[2/3] w-full rounded-lg overflow-hidden shadow-lg">
                                <img src="${selectedShow.posterPath ? `https://image.tmdb.org/t/p/w500${selectedShow.posterPath}` : 'https://placehold.co/500x750?text=No+Img'}" alt=${selectedShow.title} className="w-full h-full object-cover"/>
                            </div>
                        </div>
                        <div className="md:w-2/3 flex flex-col">
                            <p className="text-gray-300 leading-relaxed">${selectedShow.overview}</p>
                             <div className="mt-4">
                               <h4 className="font-bold text-white text-sm uppercase tracking-wide mb-1">Root Folder</h4>
                               <div className="bg-gray-900/50 border border-gray-700 p-3 rounded-lg">
                                    <p className="text-xs text-gray-400 font-mono break-all">${selectedShow.filePath}</p>
                               </div>
                            </div>
                        </div>
                    </div>
                `}
            </${Modal}>
        </div>
    `;
};

export default TvShows;
