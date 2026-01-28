
export const levenshteinDistance = (a, b) => {
    if (!a || !b) return (a || b).length;
    const m = [];
    for (let i = 0; i <= b.length; i++) {
        m[i] = [i];
        if (i === 0) continue;
        for (let j = 1; j <= a.length; j++) {
            m[i][j] =
                b.charAt(i - 1) === a.charAt(j - 1)
                    ? m[i - 1][j - 1]
                    : Math.min(
                        m[i - 1][j - 1] + 1,
                        m[i][j - 1] + 1,
                        m[i - 1][j] + 1
                    );
        }
    }
    return m[b.length][a.length];
};

export const similarityScore = (s1, s2) => {
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;
    const longerLength = longer.length;
    if (longerLength === 0) return 1.0;
    
    // Normalized comparison
    const norm1 = s1.toLowerCase().replace(/[^a-z0-9]/g, '');
    const norm2 = s2.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    const dist = levenshteinDistance(norm1, norm2);
    return (Math.max(norm1.length, norm2.length) - dist) / Math.max(norm1.length, norm2.length);
};
