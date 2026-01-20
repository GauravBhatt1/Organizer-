import React, { useState } from 'react';
import Header from '../components/Header.tsx';
import PosterGrid from '../components/PosterGrid.tsx';
import PosterCard from '../components/PosterCard.tsx';
import Modal from '../components/Modal.tsx';
import Spinner from '../components/Spinner.tsx';
import type { MediaItem } from '../types.ts';
import Button from '../components/Button.tsx';


const MOCK_TV_SHOWS: MediaItem[] = [
  { id: 1, title: 'Game of Thrones', year: 2011, posterPath: '/u3bZgnGQ9T01sWNhyveQz0wz0IL.jpg', overview: 'Seven noble families fight for control of the mythical land of Westeros. Friction between the houses leads to full-scale war.', filePath: '/mnt/cloud/tvshows/Game of Thrones/' },
  { id: 2, title: 'Breaking Bad', year: 2008, posterPath: '/ggFHVNu6YYI5L9pCfOacjizRGt.jpg', overview: 'A high school chemistry teacher diagnosed with inoperable lung cancer turns to manufacturing and selling methamphetamine in order to secure his family\'s future.', filePath: '/mnt/cloud/tvshows/Breaking Bad/' },
  { id: 3, title: 'The Mandalorian', year: 2019, posterPath: '/eU1i6eLXPJ2a2iTfPumxDDnQCAk.jpg', overview: 'After the fall of the Galactic Empire, lawlessness has spread throughout the galaxy. A lone gunfighter makes his way through the outer reaches, earning his keep as a bounty hunter.', filePath: '/mnt/cloud/tvshows/The Mandalorian/' },
  { id: 4, title: 'Taskmaster', year: 2015, posterPath: '/stTEaMWOpxo3lnsQoQx1i7Zao47.jpg', overview: 'Greg Davies is the Taskmaster, and with the help of his ever-loyal assistant Alex Horne, he sets out to test the wiles, wit, wisdom and weirdness of five hyper-competitive comedians.', filePath: '/mnt/cloud/tvshows/Taskmaster/' },
];

interface TvShowsProps {
    onMenuClick: () => void;
}

const TvShows: React.FC<TvShowsProps> = ({ onMenuClick }) => {
    const [selectedShow, setSelectedShow] = useState<MediaItem | null>(null);

    const handleCardClick = (show: MediaItem) => {
        setSelectedShow(show);
    };

    const handleCloseModal = () => {
        setSelectedShow(null);
    };
    
    return (
        <div className="flex flex-col h-full">
            <Header title="Organized TV Shows" onMenuClick={onMenuClick} />
            <div className="p-6 overflow-y-auto">
                <PosterGrid>
                    {MOCK_TV_SHOWS.map(show => (
                        <PosterCard key={show.id} item={show} onClick={() => handleCardClick(show)} />
                    ))}
                </PosterGrid>
            </div>

            <Modal isOpen={!!selectedShow} onClose={handleCloseModal} title={selectedShow?.title || ''}>
                {selectedShow ? (
                    <div className="flex flex-col md:flex-row gap-6">
                        <div className="md:w-1/3 flex-shrink-0">
                            <img src={`https://image.tmdb.org/t/p/w500${selectedShow.posterPath}`} alt={selectedShow.title} className="rounded-lg w-full"/>
                        </div>
                        <div className="md:w-2/3 space-y-4">
                            <p className="text-gray-300">{selectedShow.overview}</p>
                            <div>
                               <h4 className="font-bold text-white">Root Folder</h4>
                               <p className="text-sm text-gray-400 bg-gray-700 p-2 rounded-md font-mono break-all">{selectedShow.filePath}</p>
                            </div>
                            <div className="flex gap-4 pt-4">
                               <Button variant="primary">Re-Identify</Button>
                               <Button variant="secondary">View Seasons</Button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex justify-center items-center h-64">
                        <Spinner size="lg" />
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default TvShows;