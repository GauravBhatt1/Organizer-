import React from 'react';
import { html } from 'htm/react';

const Input = React.memo(({ label, id, ...props }) => {
  return html`
    <div className="w-full">
      <label htmlFor=${id} className="block text-sm font-medium text-gray-300 mb-1">
        ${label}
      </label>
      <input
        id=${id}
        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-purple focus:border-transparent"
        ...${props}
      />
    </div>
  `;
});

export default Input;