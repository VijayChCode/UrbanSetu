const fs = require('fs');

function transformFile(path, isApi) {
    let content = fs.readFileSync(path, 'utf8');

    if (isApi) {
        content = content.replace(
            'export const getSeasonalTheme = (dateInput = new Date()) => {',
            'export function* getActiveThemes(dateInput = new Date()) {'
        );
        content = content.replace('    return null;', '    return null;'); // keep as return null or yield null? Actually yield null doesn't matter if we filter

        // Remove the return null at the end because generator just finishes.
        content = content.replace('    return null;', '');

        content += `
export const getSeasonalTheme = (dateInput = new Date()) => {
    // Array.from(getActiveThemes) evaluates the generator to get all matches
    const themes = Array.from(getActiveThemes(dateInput)).filter(Boolean);
    if (themes.length === 0) return null;
    
    // Priority 1: Exact day match where email sending is designated
    const exact = themes.find(t => t.shouldSendEmail);
    if (exact) return exact;
    
    // Fallback: Just return the first active theme found
    return themes[0];
};
`;
    } else {
        content = content.replace(
            'export const useSeasonalTheme = () => {\\n    const theme = useMemo(() => {',
            'export function* getActiveThemes() {\\n        const today = new Date();'
        );
        // Remove the closing of useMemo
        content = content.replace('    }, []);\\n\\n    return theme;\\n};', '');
        content = content.replace('        return null; // No active theme', '');

        content += `
export const useSeasonalTheme = () => {
    const theme = useMemo(() => {
        const themes = Array.from(getActiveThemes()).filter(Boolean);
        if (themes.length === 0) return null;
        
        // Let's deduce an "exact day" for the UI prioritization if possible.
        // It's mostly guesswork since frontend lacks shouldSendEmail, 
        // but we can look for festivals ending today or just take themes[0].
        // The first exact matching theme returned from fixed dates or f.day
        const today = new Date();
        const d = today.getDate();
        
        // We simulate finding the exact date. Since we don't have shouldSendEmail here,
        // we'll just prioritize the LAST festival in the activeThemes (usually variable overrides fixed? No, just the simplest: pick first)
        // Wait, for Frontend, the variable festivals actually represent the most important daily changing ones.
        // To be perfectly aligned with backend, we should use backend's priority. But here we just return the first.
        // But wait! If we just yield all, they are in order. The issue was variable festival wasn't overwriting Sankranti.
        // Sankranti is window 3. Lohri is window 0. 
        // Window 0 means exact day!
        // We can prioritize window=0! Or we can prioritize themes that were yielded by variable array where f.day === today.day
        // We'll just define a simple rule: if a theme id has window 0, it's highly specific.
        return themes[themes.length - 1]; // Reverse order priority gives variable festivals (defined lower down) priority over fixed ones like Sankranti!
    }, []);

    return theme;
};
`;
    }

    // Replace all "return {" with "yield {"
    content = content.replace(/return \{/g, 'yield {');

    fs.writeFileSync(path, content);
}

try {
    transformFile('api/utils/seasonalEvents.js', true);
    console.log('API transformed');
    transformFile('web/src/hooks/useSeasonalTheme.jsx', false);
    console.log('Web transformed');
} catch (e) {
    console.error(e);
}
