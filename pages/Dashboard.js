
import React, { useState, useEffect, useCallback, useRef } from 'react';
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
    const [dashboardData, setDashboardData] = useState({
        movies: 0,
        tvShows: 0,
        uncategorized: 0,
        lastScan: null
    });
    
    const { addToast } = useToast();
    const pollInterval = useRef(null);

    const fetchData = async () => {
        try {
            const res = await fetch('/api/dashboard');
            const data = await res.json();
            
            // Only update if data is valid
            if (data) {
                setDashboardData(data);
                
                // Control polling based on scan status
                if (data.lastScan && data.lastScan.status === 'running') {
                    if (!pollInterval.current) startPolling();
                } else {
                    stopPolling();
                }
            }
        } catch (e) { console.error(e); }
    };

    const startPolling = () => {
        if (pollInterval.current) return;
        pollInterval.current = setInterval(fetchData, 2000);
    };

    const stopPolling = () => {
        if (pollInterval.current) {
            clearInterval(pollInterval.current);
            pollInterval.current = null;
        }
    };

    useEffect(() => {
        fetchData();
        return () => stopPolling();
    }, []);

    const startScan = useCallback(async () => {
        if (dashboardData.lastScan && dashboardData.lastScan.status === 'running') {
            return addToast('Scan already running', 'info');
        }

        try {
            addToast(`Starting Library Scan...`, 'info');
            const res = await fetch('/api/scan/start', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({})
            });
            const data = await res.json();
            
            if (res.ok) {
                addToast('Scan started!', 'success');
                // Immediately fetch to show running state
                fetchData(); 
            } else {
                addToast(`Failed: ${data.message}`, 'error');
            }
        } catch (e) {
            addToast(`Error: ${e.message}`, 'error');
        }
    }, [dashboardData.lastScan, addToast]);

    const lastScan = dashboardData.lastScan;
    const progress = lastScan && lastScan.totalFiles > 0 
        ? Math.round((lastScan.processedFiles / lastScan.totalFiles) * 100) 
        : 0;

    return html`
        <div className="h-full flex flex-col">
            <${Header} title="Dashboard" onMenuClick=${onMenuClick} 
                actionButton=${html`
                    <${Button} onClick=${startScan} icon=${html`<${PlayIcon} />`} disabled=${lastScan?.status === 'running'}>
                        ${lastScan?.status === 'running' ? 'Scanning...' : 'Scan Library'}
                    </${Button}>
                `} 
            />
            
            <div className="p-6 space-y-8 overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <${StatCard} title="Organized Movies" value=${dashboardData.movies} />
                    <${StatCard} title="Organized TV Shows" value=${dashboardData.tvShows} />
                    <${StatCard} title="Uncategorized Items" value=${dashboardData.uncategorized} />
                </div>

                ${lastScan && html`
                    <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold text-white">
                                ${lastScan.status === 'running' ? 'Scan in Progress' : 'Last Scan Result'}
                            </h2>
                            <span className="text-xs font-mono text-gray-500">${new Date(lastScan.startedAt).toLocaleString()}</span>
                        </div>

                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <span className="font-medium text-gray-300">Status:</span> 
                                    <span className=${`capitalize font-bold px-2 py-0.5 rounded text-sm ${
                                        lastScan.status === 'running' ? 'bg-blue-500/20 text-blue-400' :
                                        lastScan.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                                        'bg-red-500/20 text-red-400'
                                    }`}>${lastScan.status}</span>
                                </div>
                                <span className="text-gray-400 text-sm font-mono">${lastScan.processedFiles} / ${lastScan.totalFiles} Files</span>
                            </div>
                            
                            <div className="w-full bg-gray-700 rounded-full h-4 overflow-hidden">
                                <div 
                                    className="bg-brand-purple h-4 transition-all duration-500 ease-out relative" 
                                    style=${{ width: `${progress}%` }}
                                >
                                    ${lastScan.status === 'running' && html`
                                        <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                                    `}
                                </div>
                            </div>

                            <div className="grid grid-cols-4 gap-4 pt-2 text-center text-sm">
                                <div className="bg-gray-900/50 p-2 rounded">
                                    <div className="text-gray-500 text-xs uppercase">Movies</div>
                                    <div className="font-bold text-green-400">${lastScan.stats?.movies || 0}</div>
                                </div>
                                <div className="bg-gray-900/50 p-2 rounded">
                                    <div className="text-gray-500 text-xs uppercase">TV Shows</div>
                                    <div className="font-bold text-blue-400">${lastScan.stats?.tv || 0}</div>
                                </div>
                                <div className="bg-gray-900/50 p-2 rounded">
                                    <div className="text-gray-500 text-xs uppercase">Uncategorized</div>
                                    <div className="font-bold text-yellow-400">${lastScan.stats?.uncategorized || 0}</div>
                                </div>
                                <div className="bg-gray-900/50 p-2 rounded">
                                    <div className="text-gray-500 text-xs uppercase">Errors</div>
                                    <div className="font-bold text-red-400">${lastScan.stats?.errors || 0}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                `}
                
                <div className="bg-gray-800 p-6 rounded-lg text-center text-gray-500 text-sm">
                    <p>Scanned files are matched against TMDB. Use the <strong>Uncategorized</strong> tab to manually organize files.</p>
                </div>
            </div>
        </div>
    `;
};

export default Dashboard;