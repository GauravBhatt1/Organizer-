import path from 'path';

export const normalizePath = (p) => {
    if (!p) return '';
    return path.normalize(p).replace(/[\r\n]+/g, '').trim();
};

/**
 * Converts a DB/Host path (e.g. /mnt/media) to a Container path (e.g. /host/mnt/media)
 * for filesystem operations.
 */
export const toContainerPath = (hostPath) => {
    if (!hostPath) return '';
    const normalized = normalizePath(hostPath);
    
    // If it already starts with /host, leave it (double mapping safety)
    if (normalized.startsWith('/host')) return normalized;
    
    // Ensure we don't double slash (e.g. /host//mnt)
    return path.join('/host', normalized);
};

/**
 * Converts a Container path (e.g. /host/mnt/media) back to a Host path (e.g. /mnt/media)
 * for DB storage and UI display.
 */
export const toHostPath = (containerPath) => {
    if (!containerPath) return '';
    const normalized = normalizePath(containerPath);
    
    // Strip /host prefix
    if (normalized.startsWith('/host')) {
        return normalized.substring(5) || '/';
    }
    return normalized;
};