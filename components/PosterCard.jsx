import React from 'react';
import { EditIcon } from '../lib/icons.jsx';

const PosterCard = ({ item, onClick }) => {
  const imageUrl = item.posterPath ? `https://image.tmdb.org/t/p/w500${item.posterPath}` : 'https://picsum.photos/500/750';

  return (
    <div 
      className="bg-gray-800 rounded-lg overflow-hidden cursor-pointer group relative transition-transform duration-300 ease-in-out hover:scale-105"
      onClick={onClick}
    >
      <img src={imageUrl} alt={item.title} className="w-full h-auto aspect-[2/3] object-cover" />
      <div className="absolute inset-0 bg-black bg-opacity-70 flex flex-col justify-end p-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <h3 className="text-white font-bold text-lg">{item.title}</h3>
        <p className="text-gray-300 text-sm">{item.year}</p>
        <div className="absolute top-2 right-2 p-2 bg-gray-900 bg-opacity-50 rounded-full">
            <EditIcon className="w-5 h-5"/>
        </div>
      </div>
       <div className="p-3 bg-gray-800 group-hover:hidden">
        <h3 className="text-white font-semibold truncate">{item.title}</h3>
        <p className="text-gray-400 text-sm">{item.year}</p>
      </div>
    </div>
  );
};

export default PosterCard;
