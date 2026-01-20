import React, { useState, useEffect, useCallback } from 'react';
import { html } from 'htm/react';
import Header from '../components/Header.js';
import Button from '../components/Button.js';
import { PlayIcon, CheckCircleIcon, ExclamationIcon } from '../lib/icons.js';
import { useToast } from '../hooks/useToast.js';

const MOCK_STATS = {
    movies: 124,
    tvShows: 38,
    uncategorized: 7,
};

const MOCK_JOB_HISTORY = [
    { id: 'job-1', startTime: new Date(Date.now() - 3600000), status: 'completed', totalFiles: 500, processedFiles: 500, errors: [] },
    { id: 'job-2', startTime: new Date(Date.now() - 86400000), status: 'completed', totalFiles: 498, processedFiles: 498, errors: [] },
    { id: 'job-3', startTime: new Date(Date.now() - 172800000), status: 'failed', totalFiles: 600, processedFiles: 150, errors: ["Permission denied on /mnt/cloud/movies2"] },
];

const StatCard = React.memo(({ title, value }) => html`
    <div className="bg-gray-800 p-6 rounded-lg">
        <h3 className="text-gray-400 text-sm font-medium uppercase">${title}</h3>
        <p className="text-3xl font-bold text-white mt-1">${value}</p>
    </div>
`);
StatCard.displayName = 'StatCard';

const JobStatusIcon = ({ status }) => {
    if (status === 'completed') return html`<${CheckCircleIcon} className="w-5 h-5 text-green-400" />`;
    if (status === 'failed') return html`<${ExclamationIcon} className="w-5 h-5 text-red-400" />`;
    return null;
};
JobStatusIcon.displayName = 'JobStatusIcon';


const Dashboard = ({ onMenuClick }) => {
    const [currentJob, setCurrentJob] = useState(null);
    const { addToast } = useToast();

    const startScan = useCallback(() => {
        if (currentJob) {
            addToast('A scan is already in progress.', 'info');
            return;
        }
        addToast('Starting library scan...', 'success');
        const newJob = {
            id: `job-${Date.now()}`,
            startTime: new Date(),
            status: 'running',
            totalFiles: 550, // Mock total
            processedFiles: 0,
            errors: []
        };
        setCurrentJob(newJob);
    }, [currentJob, addToast]);

    useEffect(() => {
        let interval;
        if (currentJob && currentJob.status === 'running') {
            interval = setInterval(() => {
                setCurrentJob(prev => {
                    if (!prev) return null;
                    const newProcessed = prev.processedFiles + Math.floor(Math.random() * 20) + 10;
                    if (newProcessed >= prev.totalFiles) {
                        clearInterval(interval);
                        addToast('Library scan completed!', 'success');
                        return { ...prev, processedFiles: prev.totalFiles, status: 'completed' };
                    }
                    return { ...prev, processedFiles: newProcessed };
                });
            }, 500);
        }
        return () => clearInterval(interval);
    }, [currentJob, addToast]);

    return html`
        <div className="h-full flex flex-col">
            <${Header} title="Dashboard" onMenuClick=${onMenuClick} actionButton=${html`<${Button} onClick=${startScan} icon=${html`<${PlayIcon} />`} disabled=${!!currentJob}>Start New Scan</${Button}>`} />
            <div className="p-6 space-y-8 overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <${StatCard} title="Organized Movies" value=${MOCK_STATS.movies} />
                    <${StatCard} title="Organized TV Shows" value=${MOCK_STATS.tvShows} />
                    <${StatCard} title="Uncategorized Items" value=${MOCK_STATS.uncategorized} />
                </div>

                ${currentJob && html`
                    <div className="bg-gray-800 p-6 rounded-lg">
                        <h2 className="text-xl font-bold mb-4">Current Scan Job</h2>
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <span className="font-medium">Status: <span className="capitalize font-bold text-brand-purple">${currentJob.status}</span></span>
                                <span className="text-gray-400">${currentJob.processedFiles} / ${currentJob.totalFiles} Files</span>
                            </div>
                            <div className="w-full bg-gray-700 rounded-full h-4">
                                <div className="bg-brand-purple h-4 rounded-full transition-all duration-500" style=${{ width: `${(currentJob.processedFiles / currentJob.totalFiles) * 100}%` }}></div>
                            </div>
                        </div>
                    </div>
                `}
                
                <div className="bg-gray-800 p-6 rounded-lg">
                    <h2 className="text-xl font-bold mb-4">Job History</h2>
                    <ul className="space-y-3">
                        ${MOCK_JOB_HISTORY.map(job => html`
                            <li key=${job.id} className="bg-gray-700 p-4 rounded-lg flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                   <${JobStatusIcon} status=${job.status} />
                                   <div>
                                     <p className="font-semibold text-white">${job.startTime.toLocaleString()}</p>
                                     <p className="text-sm text-gray-400">${job.processedFiles} files processed</p>
                                   </div>
                                </div>
                                <span className="px-3 py-1 text-sm font-bold rounded-full ${job.status === 'completed' ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}">${job.status}</span>
                            </li>
                        `)}
                    </ul>
                </div>
            </div>
        </div>
    `;
};

export default Dashboard;