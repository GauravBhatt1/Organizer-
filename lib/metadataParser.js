export const parseMediaMetaFromFilename = (filename) => {
    if (!filename) return {};
    const lower = filename.toLowerCase();

    // Resolution / Quality (Priority: 2160p > 1080p > 720p > 576p > 480p)
    let quality = null;
    if (/\b(2160p|4k|uhd)\b/.test(lower)) quality = '2160p';
    else if (/\b1080p\b/.test(lower)) quality = '1080p';
    else if (/\b720p\b/.test(lower)) quality = '720p';
    else if (/\b576p\b/.test(lower)) quality = '576p';
    else if (/\b480p\b/.test(lower)) quality = '480p';

    // Year (1900-2099)
    let year = null;
    const yearMatch = lower.match(/\b(19|20)\d{2}\b/);
    if (yearMatch) year = parseInt(yearMatch[0], 10);

    // Source (e.g. WEB-DL, Bluray)
    let source = null;
    const sourceMatch = lower.match(/\b(web-?dl|web-?rip|bluray|bdrip|brrip|dvdrip|hdrip|hdts|cam)\b/);
    if (sourceMatch) {
        source = sourceMatch[1].replace(/-/g, '').toUpperCase();
        if (source === 'WEBDL') source = 'WEB-DL';
        if (source === 'WEBRIP') source = 'WEBRip';
    }

    // Codec (e.g. x265, h264)
    let codec = null;
    const codecMatch = lower.match(/\b(x264|x265|hevc|h264|h265|av1)\b/);
    if (codecMatch) {
        codec = codecMatch[1].toUpperCase();
    }

    return { quality, year, source, codec };
};