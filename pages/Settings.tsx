import React, { useState, useCallback } from 'react';
import Header from '../components/Header.tsx';
import Input from '../components/Input.tsx';
import Button from '../components/Button.tsx';
import Toggle from '../components/Toggle.tsx';
import { PlusIcon, TrashIcon, CheckCircleIcon, ExclamationIcon } from '../lib/icons.tsx';
import { useToast } from '../hooks/useToast.tsx';
import { testTmdbApiKey } from '../lib/tmdb.ts';
import type { TmdbTestResult } from '../types.ts';

type ConnectionStatus = 'idle' | 'testing' | 'success' | 'failed';

interface SettingsProps {
    onMenuClick: () => void;
}

const SettingsCard: React.FC<{title: string, children: React.ReactNode}> = ({title, children}) => (
    <div className="bg-gray-800 p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-bold mb-4 border-b border-gray-700 pb-2">{title}</h2>
        <div className="space-y-4">
            {children}
        </div>
    </div>
);

const AddPathInput: React.FC<{ label: string; id: string; onAdd: (path: string) => void; placeholder: string; }> = React.memo(({ label, id, onAdd, placeholder }) => {
    const [path, setPath] = useState('');
    const handleAdd = useCallback(() => {
        if (path.trim()) {
            onAdd(path.trim());
            setPath('');
        }
    }, [path, onAdd]);
    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAdd();
        }
    }, [handleAdd]);
    return (
        <div className="flex gap-2">
            <Input label={label} id={id} value={path} onChange={e => setPath(e.target.value)} onKeyDown={handleKeyDown} placeholder={placeholder} />
            <Button onClick={handleAdd} className="self-end" disabled={!path.trim()} aria-label={`Add ${label}`}><PlusIcon /></Button>
        </div>
    );
});

// FIX: Define props interface for MongoSettings to fix type errors.
interface MongoSettingsProps {
    uri: string;
    dbName: string;
    status: ConnectionStatus;
    onUriChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onDbNameChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onTest: () => void;
}

const MongoSettings = React.memo(({ uri, dbName, status, onUriChange, onDbNameChange, onTest }: MongoSettingsProps) => (
    <SettingsCard title="MongoDB Settings">
        <Input label="Mongo URI" id="mongo-uri" value={uri} onChange={onUriChange} disabled={status === 'testing'} />
        <Input label="Database Name" id="db-name" value={dbName} onChange={onDbNameChange} disabled={status === 'testing'} />
        <div className="flex items-center gap-4">
            {/* FIX: The `status === 'testing'` comparison is always false inside this block where `status` is 'idle', which caused a type error. The button should be enabled when visible, so the `disabled` prop is removed. */}
            {status === 'idle' && <Button variant="secondary" onClick={onTest}>Test Connection</Button>}
            {status === 'testing' && <Button variant="secondary" isLoading={true} disabled>Testing...</Button>}
            {status === 'success' && <Button variant="success" icon={<CheckCircleIcon />} disabled>Success</Button>}
            {status === 'failed' && <Button variant="danger" icon={<ExclamationIcon />} disabled>Failed</Button>}
        </div>
    </SettingsCard>
));

// FIX: Define props interface for TmdbSettings to fix type errors.
interface TmdbSettingsProps {
    apiKey: string;
    language: string;
    status: ConnectionStatus;
    onApiKeyChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onLanguageChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onTest: () => void;
}

const TmdbSettings = React.memo(({ apiKey, language, status, onApiKeyChange, onLanguageChange, onTest }: TmdbSettingsProps) => (
    <SettingsCard title="TMDB Settings">
        <Input label="TMDB API Key" id="tmdb-key" type="password" value={apiKey} onChange={onApiKeyChange} disabled={status === 'testing'} />
        <Input label="Language" id="tmdb-lang" value={language} onChange={onLanguageChange} disabled={status === 'testing'} />
        <div className="flex items-center gap-4">
            {/* FIX: The `status === 'testing'` comparison is always false inside this block where `status` is 'idle', which caused a type error. It was removed from the `disabled` logic. */}
            {status === 'idle' && <Button variant="secondary" onClick={onTest} disabled={!apiKey}>Test TMDB Key</Button>}
            {status === 'testing' && <Button variant="secondary" isLoading={true} disabled>Testing...</Button>}
            {status === 'success' && <Button variant="success" icon={<CheckCircleIcon />} disabled>Valid</Button>}
            {status === 'failed' && <Button variant="danger" icon={<ExclamationIcon />} disabled>Invalid</Button>}
        </div>
    </SettingsCard>
));

// FIX: Define props interface for LibrarySettings to fix type errors.
interface LibrarySettingsProps {
    movieRoots: string[];
    tvRoots: string[];
    mountSafety: boolean;
    isCopyMode: boolean;
    onAddMoviePath: (path: string) => void;
    onAddTvPath: (path: string) => void;
    onRemovePath: (type: 'movie' | 'tv', index: number) => void;
    onSetMountSafety: (enabled: boolean) => void;
    onSetIsCopyMode: (enabled: boolean) => void;
}

const LibrarySettings = React.memo(({ movieRoots, tvRoots, mountSafety, isCopyMode, onAddMoviePath, onAddTvPath, onRemovePath, onSetMountSafety, onSetIsCopyMode }: LibrarySettingsProps) => (
    <SettingsCard title="Library Settings">
        <div>
            <h3 className="font-semibold text-lg mb-2">Movie Root Folders</h3>
            <ul className="space-y-2 mb-2">
                {movieRoots.map((path, i) => (
                    <li key={`movie-${i}`} className="flex items-center gap-2 bg-gray-700 p-2 rounded">
                        <span className="flex-1 font-mono text-sm break-all">{path}</span>
                        <button onClick={() => onRemovePath('movie', i)} className="text-red-400 hover:text-red-300 p-1" aria-label={`Remove movie path ${path}`}><TrashIcon /></button>
                    </li>
                ))}
            </ul>
            <AddPathInput label="Add Movie Path" id="new-movie-path" onAdd={onAddMoviePath} placeholder="/path/to/movies" />
        </div>
        <div>
            <h3 className="font-semibold text-lg mb-2">TV Show Root Folders</h3>
            <ul className="space-y-2 mb-2">
                {tvRoots.map((path, i) => (
                    <li key={`tv-${i}`} className="flex items-center gap-2 bg-gray-700 p-2 rounded">
                        <span className="flex-1 font-mono text-sm break-all">{path}</span>
                        <button onClick={() => onRemovePath('tv', i)} className="text-red-400 hover:text-red-300 p-1" aria-label={`Remove TV show path ${path}`}><TrashIcon /></button>
                    </li>
                ))}
            </ul>
            <AddPathInput label="Add TV Show Path" id="new-tv-path" onAdd={onAddTvPath} placeholder="/path/to/tv-shows" />
        </div>
        <div className="border-t border-gray-700 pt-4 space-y-4">
            <Toggle label="Mount Safety Mode" enabled={mountSafety} setEnabled={onSetMountSafety} />
            <Toggle label="Use Copy instead of Move" enabled={isCopyMode} setEnabled={onSetIsCopyMode} />
            <Button variant="secondary">Test Mounts</Button>
        </div>
    </SettingsCard>
));


const Settings: React.FC<SettingsProps> = ({ onMenuClick }) => {
    const { addToast } = useToast();

    // State for settings
    const [mongoUri, setMongoUri] = useState('mongodb://localhost:27017');
    const [dbName, setDbName] = useState('jellyfin-organizer');
    const [tmdbApiKey, setTmdbApiKey] = useState('');
    const [tmdbLanguage, setTmdbLanguage] = useState('en-US');
    const [movieRoots, setMovieRoots] = useState<string[]>(['/mnt/cloud/movies1']);
    const [tvRoots, setTvRoots] = useState<string[]>(['/mnt/cloud/tvshows']);
    const [mountSafety, setMountSafety] = useState(true);
    const [isCopyMode, setIsCopyMode] = useState(false);

    // State for connection tests and saving
    const [mongoStatus, setMongoStatus] = useState<ConnectionStatus>('idle');
    const [tmdbStatus, setTmdbStatus] = useState<ConnectionStatus>('idle');
    const [isSaving, setIsSaving] = useState(false);
    
    // Memoized handlers for inputs
    const handleMongoUriChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => { setMongoUri(e.target.value); setMongoStatus('idle'); }, []);
    const handleDbNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => { setDbName(e.target.value); setMongoStatus('idle'); }, []);
    const handleTmdbApiKeyChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => { setTmdbApiKey(e.target.value); setTmdbStatus('idle'); }, []);
    const handleTmdbLanguageChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => { setTmdbLanguage(e.target.value); }, []);

    // Memoized handlers for actions
    const handleTestMongo = useCallback(async () => {
        setMongoStatus('testing');
        await new Promise(res => setTimeout(res, 1500));
        const success = Math.random() > 0.3; // Simulate success/failure
        setMongoStatus(success ? 'success' : 'failed');
        addToast(success ? 'MongoDB connection successful!' : 'MongoDB connection failed.', success ? 'success' : 'error');
    }, [addToast]);

    const handleTestTmdb = useCallback(async () => {
        setTmdbStatus('testing');
        const result = await testTmdbApiKey(tmdbApiKey);
        
        // The result object tells us everything we need.
        setTmdbStatus(result.ok ? 'success' : 'failed');
        addToast(result.message, result.ok ? 'success' : 'error');

    }, [addToast, tmdbApiKey]);

    const handleSaveAll = useCallback(async () => {
        setIsSaving(true);
        addToast('Saving all settings...', 'info');
        await new Promise(res => setTimeout(res, 1500));
        setIsSaving(false);
        addToast('All settings saved successfully!', 'success');
        setMongoStatus('idle');
        setTmdbStatus('idle');
    }, [addToast]);
    
    // Memoized handlers for library paths
    const addMoviePath = useCallback((path: string) => { setMovieRoots(roots => [...roots, path]); }, []);
    const addTvPath = useCallback((path: string) => { setTvRoots(roots => [...roots, path]); }, []);
    const removePath = useCallback((type: 'movie' | 'tv', index: number) => {
        if (type === 'movie') {
            setMovieRoots(roots => roots.filter((_, i) => i !== index));
        } else {
            setTvRoots(roots => roots.filter((_, i) => i !== index));
        }
    }, []);
    
    return (
        <div className="flex flex-col h-full">
            <Header title="Settings" onMenuClick={onMenuClick} actionButton={<Button onClick={handleSaveAll} isLoading={isSaving}>Save Changes</Button>} />
            <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6 overflow-y-auto">
                <div className="space-y-6">
                    <MongoSettings 
                        uri={mongoUri} 
                        dbName={dbName} 
                        status={mongoStatus} 
                        onUriChange={handleMongoUriChange} 
                        onDbNameChange={handleDbNameChange} 
                        onTest={handleTestMongo} 
                    />
                    <TmdbSettings
                        apiKey={tmdbApiKey}
                        language={tmdbLanguage}
                        status={tmdbStatus}
                        onApiKeyChange={handleTmdbApiKeyChange}
                        onLanguageChange={handleTmdbLanguageChange}
                        onTest={handleTestTmdb}
                    />
                </div>
                <LibrarySettings
                    movieRoots={movieRoots}
                    tvRoots={tvRoots}
                    mountSafety={mountSafety}
                    isCopyMode={isCopyMode}
                    onAddMoviePath={addMoviePath}
                    onAddTvPath={addTvPath}
                    onRemovePath={removePath}
                    onSetMountSafety={setMountSafety}
                    onSetIsCopyMode={setIsCopyMode}
                />
            </div>
        </div>
    );
};

export default Settings;