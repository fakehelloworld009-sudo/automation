// Debug script to find all clickable elements in header area
const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();
    await page.goto('https://www.bajajfinserv.in/', { waitUntil: 'networkidle' });
    
    // Wait a bit for page to fully load
    await page.waitForTimeout(3000);

    const results = await page.evaluate(() => {
        // Find all clickable elements in top area (y < 150px)
        const elements = Array.from(document.querySelectorAll('a, button, [role="button"], div[onclick], span[onclick]'));
        const topElements = [];
        
        elements.forEach(el => {
            const rect = el.getBoundingClientRect();
            if (rect.top < 150 && rect.height > 10) {  // Top area only
                const text = (el.textContent || '').trim();
                const href = el.href || '';
                const ariaLabel = el.getAttribute('aria-label') || '';
                const id = el.getAttribute('id') || '';
                const className = el.getAttribute('class') || '';
                
                topElements.push({
                    text: text.slice(0, 50),
                    href: href.slice(0, 60),
                    ariaLabel,
                    id,
                    className: className.slice(0, 80),
                    x: Math.round(rect.x),
                    y: Math.round(rect.y),
                    w: Math.round(rect.width),
                    h: Math.round(rect.height),
                    tag: el.tagName.toLowerCase()
                });
            }
        });
        
        return topElements;
    });

    console.log('\n===== CLICKABLE ELEMENTS IN TOP AREA (y < 150px) =====');
    results.forEach((r, i) => {
        console.log(`\n[${i}] <${r.tag}> at (${r.x},${r.y}) size=${r.w}x${r.h}`);
        if (r.text) console.log(`    Text: "${r.text}"`);
        if (r.ariaLabel) console.log(`    Aria-Label: "${r.ariaLabel}"`);
        if (r.href) console.log(`    Href: "${r.href}"`);
        if (r.id) console.log(`    ID: ${r.id}`);
    });

    await browser.close();
})();
