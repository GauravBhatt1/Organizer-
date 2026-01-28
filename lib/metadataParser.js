
export const parseMediaMetaFromFilename = (filename) => {
    if (!filename) return {};
    const lower = filename.toLowerCase();

    // 1. Resolution / Quality
    let quality = null;
    if (/\b(2160p|4k|uhd)\b/.test(lower)) quality = '2160p';
    else if (/\b1080p\b/.test(lower)) quality = '1080p';
    else if (/\b720p\b/.test(lower)) quality = '720p';
    else if (/\b576p\b/.test(lower)) quality = '576p';
    else if (/\b480p\b/.test(lower)) quality = '480p';

    // 2. Year (1900-2099)
    let year = null;
    const yearMatch = lower.match(/\b(19|20)\d{2}\b/);
    if (yearMatch) year = parseInt(yearMatch[0], 10);

    // 3. Source
    let source = null;
    const sourceMatch = lower.match(/\b(web-?dl|web-?rip|bluray|bdrip|brrip|dvdrip|hdrip|hdts|cam)\b/);
    if (sourceMatch) {
        source = sourceMatch[1].replace(/-/g, '').toUpperCase();
        if (source === 'WEBDL') source = 'WEB-DL';
        if (source === 'WEBRIP') source = 'WEBRip';
    }

    // 4. Codec
    let codec = null;
    const codecMatch = lower.match(/\b(x264|x265|hevc|h264|h265|av1)\b/);
    if (codecMatch) {
        codec = codecMatch[1].toUpperCase();
    }

    // 5. TV Detection (Season/Episode)
    const tvRegex = /\b(?:s|season)\s*(\d{1,4})[^0-9]*?(?:e|x|episode)\s*(\d{1,4})\b|\b(\d{1,4})x(\d{1,4})\b/i;
    const tvMatch = filename.match(tvRegex);
    let season = null;
    let episode = null;
    let isTv = false;

    if (tvMatch) {
        isTv = true;
        season = parseInt(tvMatch[1] || tvMatch[3] || 1, 10);
        episode = parseInt(tvMatch[2] || tvMatch[4] || 1, 10);
    }

    // 6. Clean Title Generation (Query)
    // Remove extension
    let cleanName = filename.substring(0, filename.lastIndexOf('.')) || filename;
    
    // Remove scene tags
    const tagsToRemove = [
        /\b(19|20)\d{2}\b/g, // Year
        /\b(2160p|1080p|720p|576p|480p|4k|uhd)\b/gi,
        /\b(web-?dl|web-?rip|bluray|bdrip|brrip|dvdrip|hdrip|hdts|cam)\b/gi,
        /\b(x264|x265|hevc|h264|h265|av1|aac|ac3|dts|dd5\.1)\b/gi,
        /\b(?:s|season)\s*(\d{1,4})[^0-9]*?(?:e|x|episode)\s*(\d{1,4})\b/gi,
        /\b(\d{1,4})x(\d{1,4})\b/gi,
        /\[.*?\]/g, // [Group]
        /\(.*?\)/g, // (Year) etc
        /[\.\-_]/g  // Separators
    ];

    tagsToRemove.forEach(regex => {
        cleanName = cleanName.replace(regex, ' ');
    });

    cleanName = cleanName.trim().replace(/\s+/g, ' ');

    return { 
        quality, 
        year, 
        source, 
        codec,
        isTv,
        season,
        episode,
        cleanTitle: cleanName
    };
};
