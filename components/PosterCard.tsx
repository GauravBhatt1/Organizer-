
import React from 'react';
import type { MediaItem } from '../types.ts';
import { EditIcon } from '../lib/icons.tsx';

interface PosterCardProps {
  item: MediaItem;
  onClick: () => void;
}

const PosterCard: React.FC<PosterCardProps> = ({ item, onClick }) => {
  const imageUrl = item.posterPath ? `https://image.tmdb.org/t/p/w500${item.posterPath}` : 'https://picsum.photos/500/750';

  return (
    <div 
      className="flex flex-col gap-2 cursor-pointer group"
      onClick={onClick}
    >
      <div className="relative rounded-xl overflow-hidden shadow-lg bg-gray-800 aspect-[2/3] transition-transform duration-300 ease-in-out group-hover:scale-[1.02] group-hover:shadow-brand-purple/20">
        <img src={imageUrl} alt={item.title} className="w-full h-full object-cover" />
        
        {/* Hover Overlay */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center backdrop-blur-[2px]">
            <div className="bg-white/10 p-3 rounded-full backdrop-blur-md border border-white/20 transform scale-90 group-hover:scale-100 transition-transform duration-300">
                <EditIcon className="w-6 h-6 text-white"/>
            </div>
        </div>
      </div>
      
      <div className="px-1">
        <h3 className="text-white font-semibold truncate text-base group-hover:text-brand-purple transition-colors">{item.title}</h3>
        <p className="text-gray-500 text-sm font-medium">{item.year}</p>
      </div>
    </div>
  );
};

export default PosterCard;
