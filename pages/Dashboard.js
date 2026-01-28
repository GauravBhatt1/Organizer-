
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
    const [stats, setStats] = useState({ movies: 0, tvShows: 0, uncategorized: 0 });
    const [currentJob, setCurrentJob] = useState(null);
    const { addToast } = useToast();
    const pollInterval = useRef(null);

    const fetchStats = async () => {
        try {
            const res = await fetch('/api/dashboard');
            const data = await res.json();
            setStats(data);
        } catch (e) { console.error(e); }
    };

    const fetchCurrentJob = async () => {
        try {
            const res = await fetch('/api/scan/current');
            const job = await res.json();
            
            if (job) {
                setCurrentJob(job);
                if (job.status === 'running') {
                    if (!pollInterval.current) startPolling();
                } else {
                    stopPolling();
                }
            } else {
                setCurrentJob(null);
                stopPolling();
            }
        } catch (e) { console.error(e); }
    };

    const startPolling = () => {
        if (pollInterval.current) return;
        pollInterval.current = setInterval(fetchCurrentJob, 2000);
    };

    const stopPolling = () => {
        if (pollInterval.current) {
            clearInterval(pollInterval.current);
            pollInterval.current = null;
        }
        fetchStats(); 
    };

    useEffect(() => {
        fetchStats();
        fetchCurrentJob();
        return () => stopPolling();
    }, []);

    const startScan = useCallback(async () => {
        if (currentJob && currentJob.status === 'running') {
            return addToast('Scan already running', 'info');
        }

        try {
            addToast(`Starting Library Scan...`, 'info');
            const res = await fetch('/api/scan/start', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({}) // No params needed, always read-only
            });
            const data = await res.json();
            
            if (res.ok) {
                addToast('Scan started!', 'success');
                fetchCurrentJob(); 
            } else {
                addToast(`Failed: ${data.message}`, 'error');
            }
        } catch (e) {
            addToast(`Error: ${e.message}`, 'error');
        }
    }, [currentJob, addToast]);

    const progress = currentJob && currentJob.totalFiles > 0 
        ? Math.round((currentJob.processedFiles / currentJob.totalFiles) * 100) 
        : 0;

    return html`
        <div className="h-full flex flex-col">
            <${Header} title="Dashboard" onMenuClick=${onMenuClick} 
                actionButton=${html`
                    <${Button} onClick=${startScan} icon=${html`<${PlayIcon} />`} disabled=${currentJob?.status === 'running'}>
                        ${currentJob?.status === 'running' ? 'Scanning...' : 'Scan Library'}
                    </${Button}>
                `} 
            />
            
            <div className="p-6 space-y-8 overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <${StatCard} title="Organized Movies" value=${stats.movies} />
                    <${StatCard} title="Organized TV Shows" value=${stats.tvShows} />
                    <${StatCard} title="Uncategorized Items" value=${stats.uncategorized} />
                </div>

                ${currentJob && html`
                    <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold text-white">
                                ${currentJob.status === 'running' ? 'Scan in Progress' : 'Last Scan Result'}
                            </h2>
                            <span className="text-xs font-mono text-gray-500">${new Date(currentJob.startedAt).toLocaleString()}</span>
                        </div>

                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <span className="font-medium text-gray-300">Status:</span> 
                                    <span className=${`capitalize font-bold px-2 py-0.5 rounded text-sm ${
                                        currentJob.status === 'running' ? 'bg-blue-500/20 text-blue-400' :
                                        currentJob.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                                        'bg-red-500/20 text-red-400'
                                    }`}>${currentJob.status}</span>
                                </div>
                                <span className="text-gray-400 text-sm font-mono">${currentJob.processedFiles} / ${currentJob.totalFiles} Files</span>
                            </div>
                            
                            <div className="w-full bg-gray-700 rounded-full h-4 overflow-hidden">
                                <div 
                                    className="bg-brand-purple h-4 transition-all duration-500 ease-out relative" 
                                    style=${{ width: `${progress}%` }}
                                >
                                    ${currentJob.status === 'running' && html`
                                        <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                                    `}
                                </div>
                            </div>

                            <div className="grid grid-cols-4 gap-4 pt-2 text-center text-sm">
                                <div className="bg-gray-900/50 p-2 rounded">
                                    <div className="text-gray-500 text-xs uppercase">Movies</div>
                                    <div className="font-bold text-green-400">${currentJob.stats?.movies || 0}</div>
                                </div>
                                <div className="bg-gray-900/50 p-2 rounded">
                                    <div className="text-gray-500 text-xs uppercase">TV Shows</div>
                                    <div className="font-bold text-blue-400">${currentJob.stats?.tv || 0}</div>
                                </div>
                                <div className="bg-gray-900/50 p-2 rounded">
                                    <div className="text-gray-500 text-xs uppercase">Uncategorized</div>
                                    <div className="font-bold text-yellow-400">${currentJob.stats?.uncategorized || 0}</div>
                                </div>
                                <div className="bg-gray-900/50 p-2 rounded">
                                    <div className="text-gray-500 text-xs uppercase">Errors</div>
                                    <div className="font-bold text-red-400">${currentJob.stats?.errors || 0}</div>
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