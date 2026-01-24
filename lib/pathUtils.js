import path from 'path';

// Single source of truth for the container's data root
export const DATA_ROOT = process.env.BROWSE_ROOT || '/data';

export const normalizePath = (p) => {
    if (!p) return '';
    return path.normalize(p).replace(/[\r\n]+/g, '').trim();
};

export const isValidDataPath = (p) => {
    const normalized = normalizePath(p);
    return normalized.startsWith(DATA_ROOT);
};