import React, { useState, useEffect, useCallback } from 'react';
import { html } from 'htm/react';
import Header from '../components/Header.js';
import Button from '../components/Button.js';
import { PlayIcon, CheckCircleIcon, ExclamationIcon } from '../lib/icons.js';
import { useToast } from '../hooks/useToast.js';

const StatCard = React.memo(({ title, value }) => html`
    <div className="bg-gray-800 p-6 rounded-lg">
        <h3 className="text-gray-400 text-sm font-medium uppercase">${title}</h3>
        <p className="text-3xl font-bold text-white mt-1">${value}</p>
    </div>
`);

const Dashboard = ({ onMenuClick }) => {
    const [stats, setStats] = useState({ movies: 0, tvShows: 0, uncategorized: 0 });
    const { addToast } = useToast();

    // Fetch real stats
    useEffect(() => {
        fetch('/api/dashboard')
            .then(res => res.json())
            .then(data => setStats(data))
            .catch(err => console.error("Failed to fetch dashboard stats", err));
    }, []);

    const startScan = useCallback(() => {
        addToast('Scan functionality pending backend implementation', 'info');
    }, [addToast]);

    return html`
        <div className="h-full flex flex-col">
            <${Header} title="Dashboard" onMenuClick=${onMenuClick} actionButton=${html`<${Button} onClick=${startScan} icon=${html`<${PlayIcon} />`}>Start New Scan</${Button}>`} />
            <div className="p-6 space-y-8 overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <${StatCard} title="Organized Movies" value=${stats.movies} />
                    <${StatCard} title="Organized TV Shows" value=${stats.tvShows} />
                    <${StatCard} title="Uncategorized Items" value=${stats.uncategorized} />
                </div>
                
                <div className="bg-gray-800 p-6 rounded-lg text-center text-gray-400">
                    <p>Recent job history will appear here once scans are performed.</p>
                </div>
            </div>
        </div>
    `;
};

export default Dashboard;
