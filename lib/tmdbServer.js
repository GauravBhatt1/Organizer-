
import { similarityScore } from './stringUtils.js';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

export const autoIdentifyCandidate = async (meta, apiKey) => {
    if (!apiKey) return { ok: false, reason: "No API Key" };
    if (!meta.cleanTitle) return { ok: false, reason: "No Title Parsed" };

    const type = meta.isTv ? 'tv' : 'movie';
    const query = encodeURIComponent(meta.cleanTitle);
    
    // 1. Search TMDB (Top 5)
    let url = `${TMDB_BASE_URL}/search/${type}?api_key=${apiKey}&query=${query}&page=1&include_adult=false`;
    if (type === 'movie' && meta.year) url += `&year=${meta.year}`;
    if (type === 'tv' && meta.year) url += `&first_air_date_year=${meta.year}`;

    try {
        const res = await fetch(url);
        if (!res.ok) return { ok: false, reason: `TMDB Error ${res.status}` };
        
        const data = await res.json();
        const results = data.results || [];

        if (results.length === 0) return { ok: false, reason: "No Results" };

        const top1 = results[0];
        const top2 = results[1];

        // 2. Strict Scoring Rules

        // (A) Clear Winner (Popularity/Votes)
        if (top2) {
            const popRatio = top1.popularity / (top2.popularity || 0.1);
            const voteRatio = top1.vote_count / (top2.vote_count || 0.1);
            
            // If the second result is too close in popularity AND votes, it's ambiguous
            if (popRatio < 1.35 && voteRatio < 1.50) {
                return { ok: false, reason: "Ambiguous Match (Top 2 too similar)" };
            }
        }

        // (B) Title Similarity >= 0.82
        const tmdbTitle = type === 'movie' ? top1.title : top1.name;
        // Also check original title as fallback
        const tmdbOrigTitle = type === 'movie' ? top1.original_title : top1.original_name;
        
        const score1 = similarityScore(meta.cleanTitle, tmdbTitle);
        const score2 = similarityScore(meta.cleanTitle, tmdbOrigTitle);
        const bestScore = Math.max(score1, score2);

        if (bestScore < 0.82) {
            return { ok: false, reason: `Low Similarity (${bestScore.toFixed(2)})` };
        }

        // (C) Year Match (Tolerance <= 1 year)
        if (meta.year) {
            const tmdbDate = type === 'movie' ? top1.release_date : top1.first_air_date;
            if (tmdbDate) {
                const tmdbYear = parseInt(tmdbDate.split('-')[0], 10);
                if (Math.abs(meta.year - tmdbYear) > 1) {
                    return { ok: false, reason: "Year Mismatch" };
                }
            }
        }

        // (D) TV Requirements
        if (type === 'tv') {
            if (meta.season === null || meta.episode === null) {
                return { ok: false, reason: "Missing S/E Numbers" };
            }
        }

        // Confident Match!
        return { 
            ok: true, 
            type,
            tmdbData: {
                id: top1.id,
                title: type === 'movie' ? top1.title : top1.name,
                year: type === 'movie' ? (top1.release_date?.split('-')[0]) : (top1.first_air_date?.split('-')[0]),
                posterPath: top1.poster_path,
                overview: top1.overview,
                // Pass identified season/ep for organizer
                season: meta.season,
                episode: meta.episode
            }
        };

    } catch (e) {
        return { ok: false, reason: `System Error: ${e.message}` };
    }
};
