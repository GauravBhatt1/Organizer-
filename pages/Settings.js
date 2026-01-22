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
        <div className="space-y-1">
            <${Input} 
                label="Mongo URI" 
                id="mongo-uri" 
                value=${uri} 
                onChange=${onUriChange} 
                disabled=${status === 'testing'} 
                placeholder="mongodb://username:password@host:port"
            />
            <p className="text-[10px] text-gray-500 italic px-1">
                Tip: For internal Docker networking, use: <span className="text-gray-400 font-mono">mongodb://mongodb:27017</span>
            </p>
        </div>
        <${Input} 
            label="Database Name" 
            id="db-name" 
            value=${dbName} 
            onChange=${onDbNameChange} 
            disabled=${status === 'testing'} 
            placeholder="jellyfin-organizer"
        />
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
        <${Input} label="TMDB API Key" id="tmdb-key" type="password" value=${apiKey} onChange=${onApiKeyChange} disabled=${status === 'testing'} placeholder="Your TMDB v3 API Key" />
        <${Input} label="Language" id="tmdb-lang" value=${language} onChange=${onLanguageChange} disabled=${status === 'testing'} placeholder="en-US" />
        <div className="flex items-center gap-4 pt-2">
            ${status === 'idle' && html`<${Button} variant="secondary" onClick=${onTest} disabled=${!apiKey}>Test TMDB Key</${Button}>`}
            ${status === 'testing' && html`<${Button} variant="secondary" isLoading=${true} disabled>Testing...</${Button}>`}
            ${status === 'success' && html`<${Button} variant="success" icon=${html`<CheckCircleIcon />`} disabled>Valid</${Button}>`}
            ${status === 'failed' && html`<${Button} variant="danger" icon=${html`<ExclamationIcon />`} disabled>Invalid</${Button}>`}
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

    // State for settings - initialized to empty strings, NOT defaults
    const [mongoUri, setMongoUri] = useState('');
    const [dbName, setDbName] = useState('');
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
        const loadSettings = async () => {
            try {
                const res = await fetch('/api/settings');
                
                if (!res.ok) {
                    if (res.status === 503) {
                         throw new Error("Database is still connecting. Please wait...");
                    }
                    let errorMsg = "Server error fetching settings";
                    try {
                        const errData = await res.json();
                        if (errData.message) errorMsg = errData.message;
                    } catch(e) {}
                    throw new Error(errorMsg);
                }
                
                const contentType = res.headers.get("content-type");
                if (!contentType || !contentType.includes("application/json")) {
                    throw new Error("Received invalid response from server");
                }

                const data = await res.json();
                // ONLY set if value exists in DB, otherwise remain as initialized (empty)
                if (data.mongoUri) setMongoUri(data.mongoUri);
                if (data.dbName) setDbName(data.dbName);
                if (data.tmdbApiKey) setTmdbApiKey(data.tmdbApiKey);
                if (data.tmdbLanguage) setTmdbLanguage(data.tmdbLanguage);
                if (data.movieRoots) setMovieRoots(data.movieRoots);
                if (data.tvRoots) setTvRoots(data.tvRoots);
                if (data.mountSafety !== undefined) setMountSafety(data.mountSafety);
                if (data.isCopyMode !== undefined) setIsCopyMode(data.isCopyMode);
            } catch (err) {
                console.error("Failed to fetch settings:", err);
                addToast(err.message, 'error');
            }
        };
        loadSettings();
    }, [addToast]);
    
    const handleMongoUriChange = useCallback((e) => {
        setMongoUri(e.target.value);
        setMongoStatus('idle');
    }, []);
    const handleDbNameChange = useCallback((e) => setDbName(e.target.value), []);
    const handleTmdbApiKeyChange = useCallback((e) => {
        setTmdbApiKey(e.target.value);
        setTmdbStatus('idle');
    }, []);
    const handleTmdbLanguageChange = useCallback((e) => setTmdbLanguage(e.target.value), []);

    const handleTestMongo = useCallback(async () => {
        if (!mongoUri.trim()) {
            return addToast("Mongo URI required to test connection.", "error");
        }
        setMongoStatus('testing');
        try {
            const res = await fetch('/api/settings');
            if (res.status === 503) {
                addToast('Backend is up, but MongoDB is still connecting...', 'info');
                setMongoStatus('idle');
            } else if (res.ok) {
                setMongoStatus('success');
                addToast('Connected to container MongoDB!', 'success');
            } else {
                throw new Error();
            }
        } catch (e) {
            setMongoStatus('failed');
            addToast('Could not verify MongoDB connection.', 'error');
        }
    }, [addToast, mongoUri]);

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
        if (!mongoUri.trim()) {
            return addToast("Mongo URI required to save settings.", "error");
        }
        
        setIsSaving(true);
        const settings = { mongoUri, dbName, tmdbApiKey, tmdbLanguage, movieRoots, tvRoots, mountSafety, isCopyMode };
        
        try {
            const res = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings)
            });
            if (res.ok) {
                localStorage.setItem('tmdb_api_key', tmdbApiKey);
                addToast('Settings saved to MongoDB!', 'success');
            } else {
                const errData = await res.json();
                throw new Error(errData.message || 'Save failed');
            }
        } catch (e) {
            addToast(`Failed: ${e.message}`, 'error');
        } finally {
            setIsSaving(false);
        }
    }, [addToast, mongoUri, dbName, tmdbApiKey, tmdbLanguage, movieRoots, tvRoots, mountSafety, isCopyMode]);
    
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
