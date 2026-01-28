import { parseMediaMetaFromFilename } from '../lib/metadataParser.js';
import assert from 'assert';

console.log("Running Metadata Parser Tests...");

const tests = [
    { file: 'Movie.Name.2024.1080p.WEBRip.x265.mkv', q: '1080p', y: 2024 },
    { file: 'My.Home.Video.4k.mp4', q: '2160p', y: null },
    { file: 'Another.Movie.720p.BrRip.avi', q: '720p', y: null },
    { file: 'Old.Film.1999.480p.mkv', q: '480p', y: 1999 },
    { file: 'Standard.Def.576p.x264.mp4', q: '576p', y: null },
    { file: 'Ultra.HD.Movie.2160p.HDR.HEVC.mkv', q: '2160p', y: null },
    { file: 'Just.A.Movie.mkv', q: null, y: null },
    { file: 'Series.S01E01.1080p.WEB-DL.mkv', q: '1080p', y: null }
];

let passed = 0;
tests.forEach(t => {
    try {
        const res = parseMediaMetaFromFilename(t.file);
        assert.strictEqual(res.quality, t.q, `Expected quality ${t.q} for ${t.file}, got ${res.quality}`);
        if (t.y) assert.strictEqual(res.year, t.y, `Expected year ${t.y} for ${t.file}, got ${res.year}`);
        passed++;
    } catch (e) {
        console.error(`❌ Test Failed: ${e.message}`);
    }
});

if (passed === tests.length) {
    console.log(`✅ All ${passed} tests passed!`);
} else {
    console.error(`⚠️ ${tests.length - passed} tests failed.`);
    process.exit(1);
}