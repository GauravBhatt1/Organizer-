import path from 'path';

export const DATA_ROOT = '/data';

export const normalizePath = (p) => {
    if (!p) return '';
    return path.normalize(p).replace(/[\r\n]+/g, '').trim();
};

export const isValidDataPath = (p) => {
    const normalized = normalizePath(p);
    return normalized.startsWith(DATA_ROOT);
};

/**
 * Identity function now, as Host Path == Container Path == DB Path
 */
export const toContainerPath = (pathStr) => {
    return normalizePath(pathStr);
};

export const toHostPath = (pathStr) => {
    return normalizePath(pathStr);
};