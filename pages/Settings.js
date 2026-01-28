
import React, { useState, useCallback, useEffect } from 'react';
import { html } from 'htm/react';
import Header from '../components/Header.js';
import Input from '../components/Input.js';
import Button from '../components/Button.js';
import Toggle from '../components/Toggle.js';
import FolderPicker from '../components/FolderPicker.js';
import { PlusIcon, TrashIcon, CheckCircleIcon, ExclamationIcon } from '../lib/icons.js';
import { useToast } from '../hooks/useToast.js';
import { testTmdbApiKey } from '../lib/tmdb.js';

const Settings = ({ onMenuClick }) => {
    const { addToast } = useToast();
    const [mongoUri, setMongoUri] = useState('');
    const [dbName, setDbName] = useState('');
    const [tmdbApiKey, setTmdbApiKey] = useState('');
    const [tmdbLanguage, setTmdbLanguage] = useState('en-US');
    
    // Configurable paths
    const [sourceFolders, setSourceFolders] = useState([]);
    const [movieRoots, setMovieRoots] = useState([]);
    const [tvRoots, setTvRoots] = useState([]);
    
    const [isCopyMode, setIsCopyMode] = useState(false);
    const [pickerOpen, setPickerOpen] = useState(false);
    const [pickerType, setPickerType] = useState('source'); 
    const [isSaving, setIsSaving] = useState(false);
    const [isResetting, setIsResetting] = useState(false);

    useEffect(() => {
        const load = async () => {
            try {
                const res = await fetch('/api/settings');
                if (res.ok) {
                    const data = await res.json();
                    if (data.mongoUri) setMongoUri(data.mongoUri);
                    if (data.dbName) setDbName(data.dbName);
                    if (data.tmdbApiKey) setTmdbApiKey(data.tmdbApiKey);
                    if (data.sourceFolders) setSourceFolders(data.sourceFolders);
                    if (data.movieRoots) setMovieRoots(data.movieRoots);
                    if (data.tvRoots) setTvRoots(data.tvRoots);
                    if (data.isCopyMode !== undefined) setIsCopyMode(data.isCopyMode);
                }
            } catch (e) {}
        };
        load();
    }, []);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const res = await fetch('/api/settings', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ 
                    mongoUri, dbName, tmdbApiKey, tmdbLanguage, 
                    sourceFolders, movieRoots, tvRoots, isCopyMode 
                })
            });
            if (res.ok) {
                localStorage.setItem('tmdb_api_key', tmdbApiKey);
                addToast('Settings Saved', 'success');
            } else throw new Error((await res.json()).message);
        } catch (e) { addToast(e.message, 'error'); }
        setIsSaving(false);
    };

    const handleResetLibrary = async () => {
        if (!confirm("Are you sure? This will clear all scanned data for the current library configuration. Files on disk will NOT be touched.")) return;
        
        setIsResetting(true);
        try {
            const res = await fetch('/api/library/reset', { method: 'POST' });
            if (res.ok) {
                addToast('Library Data Reset', 'success');
            } else {
                throw new Error((await res.json()).message);
            }
        } catch (e) { addToast(e.message, 'error'); }
        setIsResetting(false);
    };

    const openPicker = (type) => { setPickerType(type); setPickerOpen(true); };
    const onPick = (path) => {
        if (pickerType === 'source' && !sourceFolders.includes(path)) setSourceFolders([...sourceFolders, path]);
        if (pickerType === 'movie' && !movieRoots.includes(path)) setMovieRoots([...movieRoots, path]);
        if (pickerType === 'tv' && !tvRoots.includes(path)) setTvRoots([...tvRoots, path]);
        setPickerOpen(false);
    };

    return html`
        <div className="flex flex-col h-full">
            <${Header} title="Settings" onMenuClick=${onMenuClick} actionButton=${html`<${Button} onClick=${handleSave} isLoading=${isSaving}>Save</${Button}>`} />
            <div className="p-6 overflow-y-auto space-y-6 max-w-4xl mx-auto w-full">
                <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
                    <h2 className="text-xl font-bold mb-4 text-white">Connections</h2>
                    <div className="space-y-4">
                        <${Input} label="Mongo URI" value=${mongoUri} onChange=${e=>setMongoUri(e.target.value)} />
                        <${Input} label="TMDB API Key" type="password" value=${tmdbApiKey} onChange=${e=>setTmdbApiKey(e.target.value)} />
                    </div>
                </div>

                <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
                    <h2 className="text-xl font-bold mb-4 text-white">Source Folders (Incoming)</h2>
                    <p className="text-sm text-gray-400 mb-4">
                        The scanner will <strong>ONLY</strong> look in these folders for new files. 
                        It will <strong>SKIP</strong> any files that are already inside your Destination folders.
                    </p>
                    <div className="space-y-2">
                        <div className="flex justify-between mb-2">
                            <span className="text-gray-400 uppercase text-xs font-bold">Watch Folders</span>
                            <${Button} onClick=${()=>openPicker('source')} variant="secondary" className="!py-1 !px-2 text-xs">Add</${Button}>
                        </div>
                        ${sourceFolders.map((p,i) => html`
                            <div key=${i} className="flex justify-between bg-gray-900/50 p-2 rounded mb-1 border border-gray-700/50">
                                <span className="font-mono text-sm">${p}</span>
                                <button onClick=${()=>setSourceFolders(sourceFolders.filter((_,x)=>x!==i))} class="text-red-400"><${TrashIcon}/></button>
                            </div>
                        `)}
                        ${sourceFolders.length === 0 && html`<div className="text-gray-500 text-sm italic p-2 bg-red-900/10 rounded border border-red-900/20">No source folders configured. Scanner will find nothing.</div>`}
                    </div>
                </div>

                <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
                    <h2 className="text-xl font-bold mb-4 text-white">Destination Roots (Library)</h2>
                    <p className="text-sm text-gray-400 mb-4">
                        Organized files will be moved here. These folders are excluded from scans.
                    </p>
                    <div className="space-y-6">
                        <div>
                            <div className="flex justify-between mb-2">
                                <span className="text-gray-400 uppercase text-xs font-bold">Movies Destination</span>
                                <${Button} onClick=${()=>openPicker('movie')} variant="secondary" className="!py-1 !px-2 text-xs">Add</${Button}>
                            </div>
                            ${movieRoots.map((p,i) => html`
                                <div key=${i} className="flex justify-between bg-gray-900/50 p-2 rounded mb-1">
                                    <span className="font-mono text-sm">${p}</span>
                                    <button onClick=${()=>setMovieRoots(movieRoots.filter((_,x)=>x!==i))} class="text-red-400"><${TrashIcon}/></button>
                                </div>
                            `)}
                            ${movieRoots.length === 0 && html`<div className="text-gray-500 text-sm italic p-2">No folders configured.</div>`}
                        </div>
                        <div>
                            <div className="flex justify-between mb-2">
                                <span className="text-gray-400 uppercase text-xs font-bold">TV Shows Destination</span>
                                <${Button} onClick=${()=>openPicker('tv')} variant="secondary" className="!py-1 !px-2 text-xs">Add</${Button}>
                            </div>
                            ${tvRoots.map((p,i) => html`
                                <div key=${i} className="flex justify-between bg-gray-900/50 p-2 rounded mb-1">
                                    <span className="font-mono text-sm">${p}</span>
                                    <button onClick=${()=>setTvRoots(tvRoots.filter((_,x)=>x!==i))} class="text-red-400"><${TrashIcon}/></button>
                                </div>
                            `)}
                            ${tvRoots.length === 0 && html`<div className="text-gray-500 text-sm italic p-2">No folders configured.</div>`}
                        </div>
                    </div>
                    <div className="pt-6 mt-6 border-t border-gray-700 space-y-4">
                        <${Toggle} label="Copy files instead of Move" enabled=${isCopyMode} setEnabled=${setIsCopyMode} />
                    </div>
                </div>

                <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
                     <h2 className="text-xl font-bold mb-4 text-white">Danger Zone</h2>
                     <p className="text-sm text-gray-400 mb-4">
                        Resetting the library will remove all scanned data from the database. It will <strong>NOT</strong> delete files from your disk.
                     </p>
                     <${Button} onClick=${handleResetLibrary} isLoading=${isResetting} variant="danger">Reset Library Data</${Button}>
                </div>
            </div>
            <${FolderPicker} isOpen=${pickerOpen} onClose=${()=>setPickerOpen(false)} onSelect=${onPick} />
        </div>
    `;
};

export default Settings;
