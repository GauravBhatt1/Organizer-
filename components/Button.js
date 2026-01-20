import React from 'react';
import { html } from 'htm/react';

const Button = ({ children, variant = 'primary', icon, isLoading = false, className, ...props }) => {
  const baseClasses = "px-4 py-2 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variantClasses = {
    primary: 'bg-brand-purple text-white hover:bg-brand-purple-light focus:ring-brand-purple',
    secondary: 'bg-gray-700 text-white hover:bg-gray-600 focus:ring-gray-500',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
    success: 'bg-green-600 text-white focus:ring-green-500',
  };

  return html`
    <button
      className="${baseClasses} ${variantClasses[variant]} ${className || ''}"
      disabled=${isLoading || props.disabled}
      ...${props}
    >
      ${isLoading && html`
        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      `}
      ${!isLoading && icon}
      ${children}
    </button>
  `;
};

export default Button;