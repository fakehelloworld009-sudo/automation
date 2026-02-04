// Quick script to find the exact Sign In button selector
const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();
    await page.goto('https://www.bajajfinserv.in/', { waitUntil: 'networkidle' });

    // Find all elements with "sign in" text
    const results = await page.evaluate(() => {
        const allElements = Array.from(document.querySelectorAll('*'));
        const matches = [];
        
        allElements.forEach(el => {
            const text = (el.textContent || '').toLowerCase();
            if (text.includes('sign') && text.includes('in')) {
                const rect = el.getBoundingClientRect();
                const style = window.getComputedStyle(el);
                
                if (style.display !== 'none' && rect.width > 0 && rect.height > 0) {
                    const classes = el.getAttribute('class') || '';
                    const id = el.getAttribute('id') || '';
                    const tag = el.tagName.toLowerCase();
                    const href = el.getAttribute('href') || '';
                    
                    matches.push({
                        tag,
                        id,
                        classes,
                        text: el.textContent?.trim().slice(0, 50),
                        href,
                        x: Math.round(rect.x),
                        y: Math.round(rect.y),
                        width: Math.round(rect.width),
                        height: Math.round(rect.height)
                    });
                }
            }
        });
        
        return matches;
    });

    console.log('\n=== SIGN IN BUTTON CANDIDATES ===');
    results.forEach((r, i) => {
        console.log(`\n[${i}] <${r.tag}> at (${r.x},${r.y}) size=${r.width}x${r.height}`);
        console.log(`    ID: ${r.id || 'none'}`);
        console.log(`    Classes: ${r.classes || 'none'}`);
        console.log(`    Text: "${r.text}"`);
        console.log(`    Href: "${r.href}"`);
    });

    await browser.close();
})();
