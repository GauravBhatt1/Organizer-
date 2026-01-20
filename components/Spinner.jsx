import React from 'react';

const Spinner = ({ size = 'md' }) => {
    const sizeClasses = {
        sm: 'h-6 w-6',
        md: 'h-8 w-8',
        lg: 'h-12 w-12',
    };
    return (
        <div className={`animate-spin rounded-full border-4 border-t-brand-purple border-gray-600 ${sizeClasses[size]}`}></div>
    );
};

export default Spinner;
