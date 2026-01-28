import path from 'path';

// Strictly enforce /data as the root for consistency with Jellyfin and Docker
export const DATA_ROOT = '/data';

export const normalizePath = (p) => {
    if (!p) return '';
    return path.normalize(p).replace(/[\r\n]+/g, '').trim();
};

export const isValidDataPath = (p) => {
    const normalized = normalizePath(p);
    return normalized.startsWith(DATA_ROOT);
};

export const isPathInside = (child, parent) => {
    const relative = path.relative(parent, child);
    return relative && !relative.startsWith('..') && !path.isAbsolute(relative);
};