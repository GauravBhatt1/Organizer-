import React from 'react';
import { html } from 'htm/react';

const PosterGrid = ({ children }) => {
  return html`
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-6">
      ${children}
    </div>
  `;
};

export default PosterGrid;