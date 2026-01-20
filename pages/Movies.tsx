import React, { useState } from 'react';
import Header from '../components/Header.tsx';
import PosterGrid from '../components/PosterGrid.tsx';
import PosterCard from '../components/PosterCard.tsx';
import Modal from '../components/Modal.tsx';
import Spinner from '../components/Spinner.tsx';
import type { MediaItem } from '../types.ts';
import Button from '../components/Button.tsx';

const MOCK_MOVIES: MediaItem[] = [
  { id: 1, title: 'Pokémon Detective Pikachu', year: 2019, posterPath: '/4A2nK0lJw37a4Wyf0A8d2etp3T2.jpg', overview: 'In a world where people collect Pokémon to do battle, a boy comes across an intelligent talking Pikachu who seeks to be a detective.', filePath: '/mnt/cloud/movies1/Pokémon Detective Pikachu (2019)/Pokémon Detective Pikachu (2019).mkv' },
  { id: 2, title: 'Inception', year: 2010, posterPath: '/oYuLEt3zVCKq27gApcjBvA8wzft.jpg', overview: 'A thief who steals corporate secrets through the use of dream-sharing technology is given the inverse task of planting an idea into the mind of a C.E.O.', filePath: '/mnt/cloud/movies1/Inception (2010)/Inception (2010).mp4' },
  { id: 3, title: 'The Matrix', year: 1999, posterPath: '/f89U3ADr1oiB1s9Gz0gSbn0QZb0.jpg', overview: 'A computer hacker learns from mysterious rebels about the true nature of his reality and his role in the war against its controllers.', filePath: '/mnt/cloud/movies2/The Matrix (1999)/The Matrix.mkv' },
  { id: 4, title: 'Dune', year: 2021, posterPath: '/d5NXSklXo0qyIY2VvchkovscDXQ.jpg', overview: 'Paul Atreides, a brilliant and gifted young man born into a great destiny beyond his understanding, must travel to the most dangerous planet in the universe to ensure the future of his family and his people.', filePath: '/mnt/cloud/movies1/Dune (2021)/Dune Part One.mkv' },
];

interface MoviesProps {
    onMenuClick: () => void;
}

const Movies: React.FC<MoviesProps> = ({ onMenuClick }) => {
    const [selectedMovie, setSelectedMovie] = useState<MediaItem | null>(null);

    const handleCardClick = (movie: MediaItem) => {
        setSelectedMovie(movie);
    };

    const handleCloseModal = () => {
        setSelectedMovie(null);
    };
    
    return (
        <div className="flex flex-col h-full">
            <Header title="Organized Movies" onMenuClick={onMenuClick} />
            <div className="p-6 overflow-y-auto">
                <PosterGrid>
                    {MOCK_MOVIES.map(movie => (
                        <PosterCard key={movie.id} item={movie} onClick={() => handleCardClick(movie)} />
                    ))}
                </PosterGrid>
            </div>

            <Modal isOpen={!!selectedMovie} onClose={handleCloseModal} title={selectedMovie?.title || ''}>
                {selectedMovie ? (
                    <div className="flex flex-col md:flex-row gap-6">
                        <div className="md:w-1/3 flex-shrink-0">
                            <img src={`https://image.tmdb.org/t/p/w500${selectedMovie.posterPath}`} alt={selectedMovie.title} className="rounded-lg w-full"/>
                        </div>
                        <div className="md:w-2/3 space-y-4">
                            <p className="text-gray-300">{selectedMovie.overview}</p>
                            <div>
                               <h4 className="font-bold text-white">File Path</h4>
                               <p className="text-sm text-gray-400 bg-gray-700 p-2 rounded-md font-mono break-all">{selectedMovie.filePath}</p>
                            </div>
                            <div className="flex gap-4 pt-4">
                               <Button variant="primary">Re-Identify</Button>
                               <Button variant="secondary">Edit Details</Button>
                            </div>
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