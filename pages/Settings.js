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

const SettingsCard = ({title, children, className = ''}) => html`
    <div className=${`bg-gray-800 p-6 rounded-lg shadow-md border border-gray-700/50 ${className}`}>
        <h2 className="text-xl font-bold mb-6 border-b border-gray-700 pb-3 text-white">${title}</h2>
        <div className="space-y-6">
            ${children}
        </div>
    </div>
`;

const MongoSettings = React.memo(({ uri, dbName, status, onUriChange, onDbNameChange, onTest }) => html`
    <${SettingsCard} title="MongoDB Settings">
        <${Input} label="Mongo URI (In Container)" id="mongo-uri" value=${uri} onChange=${onUriChange} disabled=${status === 'testing'} />
        <${Input} label="Database Name" id="db-name" value=${dbName} onChange=${onDbNameChange} disabled=${status === 'testing'} />
        <div className="flex items-center gap-4 pt-2">
            ${status === 'idle' && html`<${Button} variant="secondary" onClick=${onTest}>Test Connection</${Button}>`}
            ${status === 'testing' && html`<${Button} variant="secondary" isLoading=${true} disabled>Testing...</${Button}>`}
            ${status === 'success' && html`<${Button} variant="success" icon=${html`<${CheckCircleIcon} />`} disabled>Success</${Button}>`}
            ${status === 'failed' && html`<${Button} variant="danger" icon=${html`<${ExclamationIcon} />`} disabled>Failed</${Button}>`}
        </div>
    </${SettingsCard}>
`);

const TmdbSettings = React.memo(({ apiKey, language, status, onApiKeyChange, onLanguageChange, onTest }) => html`
    <${SettingsCard} title="TMDB Settings" className="border-brand-purple/30 shadow-[0_0_15px_rgba(138,77,255,0.05)]">
        <${Input} label="TMDB API Key" id="tmdb-key" type="password" value=${apiKey} onChange=${onApiKeyChange} disabled=${status === 'testing'} />
        <${Input} label="Language" id="tmdb-lang" value=${language} onChange=${onLanguageChange} disabled=${status === 'testing'} />
        <div className="flex items-center gap-4 pt-2">
            ${status === 'idle' && html`<${Button} variant="secondary" onClick=${onTest} disabled=${!apiKey}>Test TMDB Key</${Button}>`}
            ${status === 'testing' && html`<${Button} variant="secondary" isLoading=${true} disabled>Testing...</${Button}>`}
            ${status === 'success' && html`<${Button} variant="success" icon=${html`<${CheckCircleIcon} />`} disabled>Valid</${Button}>`}
            ${status === 'failed' && html`<${Button} variant="danger" icon=${html`<${ExclamationIcon} />`} disabled>Invalid</${Button}>`}
        </div>
    </${SettingsCard}>
`);

const LibrarySettings = React.memo(({ 
    movieRoots, 
    tvRoots, 
    mountSafety, 
    isCopyMode, 
    onOpenPicker,
    onRemovePath, 
    onSetMountSafety, 
    onSetIsCopyMode,
    onTestMounts
}) => html`
    <${SettingsCard} title="Library Settings">
        <div>
            <div className="flex justify-between items-center mb-3">
                <h3 className="font-semibold text-sm uppercase tracking-wide text-gray-400">Movie Root Folders</h3>
                <${Button} variant="secondary" className="!py-1.5 !px-3 text-xs" onClick=${() => onOpenPicker('movie')} icon=${html`<${PlusIcon} className="w-3 h-3"/>`}>Add Folder</${Button}>
            </div>
            <ul className="space-y-2 mb-4">
                ${movieRoots.map((path, i) => html`
                    <li key=${`movie-${i}`} className="flex items-center gap-3 bg-gray-900/50 border border-gray-700 p-3 rounded-lg group transition-colors hover:border-gray-600">
                        <span className="flex-1 font-mono text-xs text-gray-300 break-all">${path}</span>
                        <button onClick=${() => onRemovePath('movie', i)} className="text-gray-500 hover:text-red-400 p-1.5 rounded-md hover:bg-red-500/10 transition-colors">
                            <${TrashIcon} className="w-4 h-4" />
                        </button>
                    </li>
                `)}
                 ${movieRoots.length === 0 && html`<li className="text-gray-500 text-xs italic p-2 border border-dashed border-gray-700 rounded text-center">No movie paths added yet.</li>`}
            </ul>
        </div>

        <div className="pt-2">
            <div className="flex justify-between items-center mb-3">
                <h3 className="font-semibold text-sm uppercase tracking-wide text-gray-400">TV Show Root Folders</h3>
                <${Button} variant="secondary" className="!py-1.5 !px-3 text-xs" onClick=${() => onOpenPicker('tv')} icon=${html`<${PlusIcon} className="w-3 h-3"/>`}>Add Folder</${Button}>
            </div>
            <ul className="space-y-2 mb-4">
                ${tvRoots.map((path, i) => html`
                    <li key=${`tv-${i}`} className="flex items-center gap-3 bg-gray-900/50 border border-gray-700 p-3 rounded-lg group transition-colors hover:border-gray-600">
                        <span className="flex-1 font-mono text-xs text-gray-300 break-all">${path}</span>
                        <button onClick=${() => onRemovePath('tv', i)} className="text-gray-500 hover:text-red-400 p-1.5 rounded-md hover:bg-red-500/10 transition-colors">
                            <${TrashIcon} className="w-4 h-4" />
                        </button>
                    </li>
                `)}
                ${tvRoots.length === 0 && html`<li className="text-gray-500 text-xs italic p-2 border border-dashed border-gray-700 rounded text-center">No TV show paths added yet.</li>`}
            </ul>
        </div>

        <div className="border-t border-gray-700 pt-6 space-y-6 mt-2">
            <${Toggle} label="Mount Safety Mode (Prevent accidental deletions)" enabled=${mountSafety} setEnabled=${onSetMountSafety} />
            <${Toggle} label="Use Copy instead of Move" enabled=${isCopyMode} setEnabled=${onSetIsCopyMode} />
            <div className="pt-2">
                 <${Button} variant="secondary" className="w-full sm:w-auto" onClick=${onTestMounts}>Test Storage Permissions</${Button}>
            </div>
        </div>
    </${SettingsCard}>
`);

const Settings = ({ onMenuClick }) => {
    const { addToast } = useToast();

    // State for settings
    const [mongoUri, setMongoUri] = useState('mongodb://mongodb:27017');
    const [dbName, setDbName] = useState('jellyfin-organizer');
    const [tmdbApiKey, setTmdbApiKey] = useState('');
    const [tmdbLanguage, setTmdbLanguage] = useState('en-US');
    const [movieRoots, setMovieRoots] = useState([]);
    const [tvRoots, setTvRoots] = useState([]);
    const [mountSafety, setMountSafety] = useState(true);
    const [isCopyMode, setIsCopyMode] = useState(false);

    const [pickerOpen, setPickerOpen] = useState(false);
    const [pickerType, setPickerType] = useState('movie'); 
    const [mongoStatus, setMongoStatus] = useState('idle');
    const [tmdbStatus, setTmdbStatus] = useState('idle');
    const [isSaving, setIsSaving] = useState(false);

    // Fetch settings on load
    useEffect(() => {
        fetch('/api/settings')
            .then(res => res.json())
            .then(data => {
                if (data.tmdbApiKey) setTmdbApiKey(data.tmdbApiKey);
                if (data.tmdbLanguage) setTmdbLanguage(data.tmdbLanguage);
                if (data.movieRoots) setMovieRoots(data.movieRoots);
                if (data.tvRoots) setTvRoots(data.tvRoots);
                if (data.mountSafety !== undefined) setMountSafety(data.mountSafety);
                if (data.isCopyMode !== undefined) setIsCopyMode(data.isCopyMode);
            })
            .catch(err => console.error("Failed to fetch settings", err));
    }, []);
    
    const handleMongoUriChange = useCallback((e) => setMongoUri(e.target.value), []);
    const handleDbNameChange = useCallback((e) => setDbName(e.target.value), []);
    const handleTmdbApiKeyChange = useCallback((e) => setTmdbApiKey(e.target.value), []);
    const handleTmdbLanguageChange = useCallback((e) => setTmdbLanguage(e.target.value), []);

    const handleTestMongo = useCallback(async () => {
        setMongoStatus('testing');
        await new Promise(res => setTimeout(res, 1000));
        setMongoStatus('success');
        addToast('Connected to container MongoDB!', 'success');
    }, [addToast]);

    const handleTestTmdb = useCallback(async () => {
        setTmdbStatus('testing');
        const result = await testTmdbApiKey(tmdbApiKey);
        setTmdbStatus(result.ok ? 'success' : 'failed');
        addToast(result.message, result.ok ? 'success' : 'error');
    }, [addToast, tmdbApiKey]);

    const handleTestMounts = useCallback(async () => {
        addToast('Verifying host storage access...', 'info');
        const allPaths = [...movieRoots, ...tvRoots];
        if (allPaths.length === 0) return addToast('No paths to test.', 'error');

        let successCount = 0;
        for (const p of allPaths) {
            try {
                const res = await fetch(`/api/fs/validate?path=${encodeURIComponent(p)}&mountSafety=${mountSafety}`);
                const data = await res.json();
                if (data.valid) successCount++;
            } catch (e) {}
        }

        if (successCount === allPaths.length) addToast(`All paths verified!`, 'success');
        else addToast(`${allPaths.length - successCount} paths failed.`, 'error');
    }, [movieRoots, tvRoots, mountSafety, addToast]);

    const handleSaveAll = useCallback(async () => {
        setIsSaving(true);
        const settings = { tmdbApiKey, tmdbLanguage, movieRoots, tvRoots, mountSafety, isCopyMode };
        
        try {
            const res = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings)
            });
            if (res.ok) {
                localStorage.setItem('tmdb_api_key', tmdbApiKey);
                addToast('Settings saved to MongoDB!', 'success');
            } else throw new Error();
        } catch (e) {
            addToast('Failed to save settings.', 'error');
        } finally {
            setIsSaving(false);
        }
    }, [addToast, tmdbApiKey, tmdbLanguage, movieRoots, tvRoots, mountSafety, isCopyMode]);
    
    const removePath = useCallback((type, index) => {
        if (type === 'movie') setMovieRoots(prev => prev.filter((_, i) => i !== index));
        else setTvRoots(prev => prev.filter((_, i) => i !== index));
    }, []);

    const handleOpenPicker = (type) => { setPickerType(type); setPickerOpen(true); };

    const handleFolderSelected = (path) => {
        if (pickerType === 'movie') { if (!movieRoots.includes(path)) setMovieRoots(prev => [...prev, path]); }
        else { if (!tvRoots.includes(path)) setTvRoots(prev => [...prev, path]); }
        setPickerOpen(false);
    };
    
    return html`
        <div className="flex flex-col h-full">
            <${Header} title="Settings" onMenuClick=${onMenuClick} actionButton=${html`<${Button} onClick=${handleSaveAll} isLoading=${isSaving}>Save Changes</${Button}>`} />
            <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6 overflow-y-auto max-w-[1920px] mx-auto w-full">
                <div className="space-y-6">
                    <${TmdbSettings} apiKey=${tmdbApiKey} language=${tmdbLanguage} status=${tmdbStatus} onApiKeyChange=${handleTmdbApiKeyChange} onLanguageChange=${handleTmdbLanguageChange} onTest=${handleTestTmdb} />
                    <${MongoSettings} uri=${mongoUri} dbName=${dbName} status=${mongoStatus} onUriChange=${handleMongoUriChange} onDbNameChange=${handleDbNameChange} onTest=${handleTestMongo} />
                </div>
                <${LibrarySettings} movieRoots=${movieRoots} tvRoots=${tvRoots} mountSafety=${mountSafety} isCopyMode=${isCopyMode} onOpenPicker=${handleOpenPicker} onRemovePath=${removePath} onSetMountSafety=${setMountSafety} onSetIsCopyMode=${setIsCopyMode} onTestMounts=${handleTestMounts} />
            </div>
            <${FolderPicker} isOpen=${pickerOpen} onClose=${() => setPickerOpen(false)} onSelect=${handleFolderSelected} title=${`Select ${pickerType === 'movie' ? 'Movie' : 'TV Show'} Root Folder`} />
        </div>
    `;
};

export default Settings;
