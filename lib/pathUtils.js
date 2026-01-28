import path from 'path';

// We no longer enforce /data to allow flexibility (Jellyfin style)
export const DATA_ROOT = '/'; 

export const normalizePath = (p) => {
    if (!p) return '';
    return path.normalize(p).replace(/[\r\n]+/g, '').trim();
};

export const isValidDataPath = (p) => {
    // Allow any path that exists on the system (validation handled by fs check later)
    return !!p && p.trim().length > 0;
};

export const isPathInside = (child, parent) => {
    const relative = path.relative(parent, child);
    return relative && !relative.startsWith('..') && !path.isAbsolute(relative);
};