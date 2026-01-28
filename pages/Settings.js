
import React, { useState, useCallback, useEffect } from 'react';
import { html } from 'htm/react';
import Header from '../components/Header.js';
import Input from '../components/Input.js';
import Button from '../components/Button.js';
import Toggle from '../components/Toggle.js';
import FolderPicker from '../components/FolderPicker.js';
import { CheckCircleIcon, ExclamationIcon, FileIcon } from '../lib/icons.js';
import { useToast } from '../hooks/useToast.js';

const Settings = ({ onMenuClick }) => {
    const { addToast } = useToast();
    const [mongoUri, setMongoUri] = useState('');
    const [dbName, setDbName] = useState('');
    const [tmdbApiKey, setTmdbApiKey] = useState('');
    const [tmdbLanguage, setTmdbLanguage] = useState('en-US');
    
    // Single Root Configuration
    const [libraryRoot, setLibraryRoot] = useState('');
    
    const [isCopyMode, setIsCopyMode] = useState(false);
    const [pickerOpen, setPickerOpen] = useState(false);
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
                    if (data.libraryRoot) setLibraryRoot(data.libraryRoot);
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
                    libraryRoot, isCopyMode 
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
        if (!confirm("Are you sure? This will clear all scanned data. Files on disk will NOT be touched.")) return;
        
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

    const onPick = (path) => {
        setLibraryRoot(path);
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
                    <h2 className="text-xl font-bold mb-4 text-white">Library Root</h2>
                    <p className="text-sm text-gray-400 mb-4">
                        Select the <strong>Single Root Folder</strong> where your media is stored. 
                        The organizer will scan this folder and create "Movies" and "TV Shows" subfolders inside it.
                    </p>
                    <div className="flex gap-2 items-end">
                        <${Input} label="Root Path" value=${libraryRoot} onChange=${e=>setLibraryRoot(e.target.value)} placeholder="/path/to/media" />
                        <${Button} onClick=${()=>setPickerOpen(true)} variant="secondary" className="mb-[1px]">Select</${Button}>
                    </div>
                    ${!libraryRoot && html`<div className="text-red-400 text-sm mt-2 font-bold">Please select a root folder to enable scanning.</div>`}
                </div>

                <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
                    <h2 className="text-xl font-bold mb-4 text-white">Options</h2>
                    <${Toggle} label="Copy files instead of Move (Safer)" enabled=${isCopyMode} setEnabled=${setIsCopyMode} />
                </div>

                <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
                     <h2 className="text-xl font-bold mb-4 text-white">Danger Zone</h2>
                     <p className="text-sm text-gray-400 mb-4">
                        Resetting the library will remove all scanned data from the database. It will <strong>NOT</strong> delete files from your disk.
                     </p>
                     <${Button} onClick=${handleResetLibrary} isLoading=${isResetting} variant="danger">Reset Library Data</${Button}>
                </div>
            </div>
            <${FolderPicker} isOpen=${pickerOpen} onClose=${()=>setPickerOpen(false)} onSelect=${onPick} title="Select Library Root" />
        </div>
    `;
};

export default Settings;
