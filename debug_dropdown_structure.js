/**
 * DEBUG SCRIPT - Run this in browser console to inspect dropdown structure
 * 
 * To use:
 * 1. Open the webpage (either Bajaj or Customer Onboarding)
 * 2. Open browser DevTools (F12)
 * 3. Go to Console tab
 * 4. Copy-paste this entire script and press Enter
 * 5. Follow the instructions
 */

console.log(`
╔════════════════════════════════════════════════════════════════╗
║        DROPDOWN STRUCTURE ANALYZER - Debug Script              ║
╚════════════════════════════════════════════════════════════════╝
`);

function analyzeDropdowns() {
    console.log(`\n🔍 ANALYZING ALL DROPDOWN ELEMENTS ON PAGE...\n`);
    
    // Find all potential dropdown elements
    const selects = document.querySelectorAll('select');
    const comboboxes = document.querySelectorAll('[role="combobox"]');
    const listboxes = document.querySelectorAll('[role="listbox"]');
    const buttons = document.querySelectorAll('button[aria-haspopup="listbox"], button[aria-expanded]');
    const dropdownLikes = document.querySelectorAll('[class*="dropdown"], [class*="select"], [class*="picker"]');
    
    console.log(`📊 ELEMENT COUNT:`);
    console.log(`   <select> elements: ${selects.length}`);
    console.log(`   [role="combobox"]: ${comboboxes.length}`);
    console.log(`   [role="listbox"]: ${listboxes.length}`);
    console.log(`   Buttons with popup: ${buttons.length}`);
    console.log(`   Dropdown-like elements: ${dropdownLikes.length}`);
    
    // Analyze SELECT elements
    if (selects.length > 0) {
        console.log(`\n📋 NATIVE <SELECT> ELEMENTS:`);
        selects.forEach((select, idx) => {
            const options = select.querySelectorAll('option');
            console.log(`\n   [${idx}] <select>`);
            console.log(`       ID: ${select.id || 'none'}`);
            console.log(`       Class: ${select.className || 'none'}`);
            console.log(`       Options count: ${options.length}`);
            if (options.length <= 10) {
                console.log(`       Options:`);
                options.forEach((opt, i) => {
                    console.log(`          ${i}: "${opt.textContent}"`);
                });
            }
        });
    }
    
    // Analyze COMBOBOX elements
    if (comboboxes.length > 0) {
        console.log(`\n🎛️  COMBOBOX ELEMENTS [role="combobox"]:`);
        comboboxes.forEach((combo, idx) => {
            console.log(`\n   [${idx}] Combobox`);
            console.log(`       Text: "${combo.textContent.substring(0, 100)}"`);
            console.log(`       ID: ${combo.id || 'none'}`);
            console.log(`       Class: ${combo.className || 'none'}`);
            console.log(`       aria-expanded: ${combo.getAttribute('aria-expanded')}`);
            console.log(`       aria-owns: ${combo.getAttribute('aria-owns')}`);
            
            // Look for associated listbox
            const listboxId = combo.getAttribute('aria-owns') || combo.getAttribute('aria-controls');
            if (listboxId) {
                const listbox = document.getElementById(listboxId);
                if (listbox) {
                    const options = listbox.querySelectorAll('[role="option"]');
                    console.log(`       Associated listbox options: ${options.length}`);
                    if (options.length <= 10) {
                        options.forEach((opt, i) => {
                            console.log(`          ${i}: "${opt.textContent}"`);
                        });
                    }
                }
            }
        });
    }
    
    // Analyze BUTTON elements with popup
    if (buttons.length > 0) {
        console.log(`\n🔘 BUTTONS WITH POPUPS:`);
        buttons.forEach((btn, idx) => {
            console.log(`\n   [${idx}] Button`);
            console.log(`       Text: "${btn.textContent}"`);
            console.log(`       ID: ${btn.id || 'none'}`);
            console.log(`       Class: ${btn.className || 'none'}`);
            console.log(`       aria-haspopup: ${btn.getAttribute('aria-haspopup')}`);
            console.log(`       aria-expanded: ${btn.getAttribute('aria-expanded')}`);
        });
    }
    
    // Find text containing " > " pattern (like "Loans > Medical")
    console.log(`\n🔎 SEARCHING FOR " > " PATTERN IN PAGE...\n`);
    const allText = document.body.textContent;
    const hasPattern = allText.includes(' > ');
    
    if (hasPattern) {
        console.log(`   ✅ Page contains " > " pattern`);
        
        // Find elements containing " > "
        const allElements = document.querySelectorAll('*');
        let foundCount = 0;
        
        for (const el of allElements) {
            const text = (el.textContent || '').trim();
            if (text.includes(' > ') && text.length < 200 && text.length > 5) {
                foundCount++;
                if (foundCount <= 5) {  // Show first 5
                    console.log(`\n   Element ${foundCount}: ${el.tagName}`);
                    console.log(`      Text: "${text.substring(0, 80)}${text.length > 80 ? '...' : ''}"`);
                    console.log(`      HTML: ${el.outerHTML.substring(0, 150)}...`);
                    
                    // Check if it's clickable
                    const isClickable = el.tagName === 'BUTTON' || 
                                       el.tagName === 'A' || 
                                       el.onclick || 
                                       el.getAttribute('role') === 'button';
                    console.log(`      Clickable: ${isClickable ? '✅ YES' : '❌ NO'}`);
                }
            }
        }
        console.log(`\n   Total elements with " > " pattern: ${foundCount}`);
    } else {
        console.log(`   ❌ No " > " pattern found on page`);
    }
}

// Run analysis
analyzeDropdowns();

console.log(`
\n╔════════════════════════════════════════════════════════════════╗
║                    ANALYSIS COMPLETE                            ║
║  Compare output between Bajaj Finance and Customer Onboarding   ║
╚════════════════════════════════════════════════════════════════╝
`);
