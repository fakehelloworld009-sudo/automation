"use strict";
/**
 * DEBUG SCRIPT - Customer Maintenance Screen Element Detection
 *
 * This script will help identify why elements on the customer maintenance
 * screen can't be found and what approach to use instead
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const playwright_1 = require("playwright");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const RESULTS_DIR = 'RESULTS_DEBUG';
const SCREENSHOTS_DIR = path.join(RESULTS_DIR, 'screenshots');
const HTML_DUMP_DIR = path.join(RESULTS_DIR, 'html_dumps');
function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}
function log(message) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`);
}
async function debugCustomerMaintenanceScreen() {
    const browser = await playwright_1.chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
        // Navigate to your app
        log('🌐 Navigating to application...');
        await page.goto('https://your-app-url', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(3000);
        // Login (adjust steps as needed)
        log('🔐 Logging in...');
        // ... your login steps here ...
        // Navigate to customer maintenance screen
        log('📋 Opening customer maintenance screen...');
        // ... steps to open customer maintenance ...
        // Wait for the screen to load
        await page.waitForTimeout(2000);
        // === DEBUG PHASE 1: Check if there are any frames ===
        log('\n========== PHASE 1: CHECKING FOR FRAMES ==========');
        const frames = page.frames();
        log(`📍 Total frames found: ${frames.length}`);
        for (let i = 0; i < frames.length; i++) {
            const frame = frames[i];
            const name = frame.name() || '(unnamed)';
            const url = frame.url() || '(no-url)';
            log(`   Frame ${i}: Name="${name}", URL="${url}"`);
        }
        if (frames.length === 1) {
            log(`⚠️  Only main frame detected - customer maintenance might be using MODALS/OVERLAYS, not iframes`);
        }
        // === DEBUG PHASE 2: Take a screenshot of the current state ===
        log('\n========== PHASE 2: TAKING SCREENSHOT ==========');
        ensureDir(SCREENSHOTS_DIR);
        const screenshotPath = path.join(SCREENSHOTS_DIR, 'customer_maintenance.png');
        await page.screenshot({ path: screenshotPath, fullPage: true });
        log(`📸 Screenshot saved: ${screenshotPath}`);
        // === DEBUG PHASE 3: Dump HTML of the page ===
        log('\n========== PHASE 3: DUMPING PAGE HTML ==========');
        ensureDir(HTML_DUMP_DIR);
        const html = await page.content();
        const htmlPath = path.join(HTML_DUMP_DIR, 'page_content.html');
        fs.writeFileSync(htmlPath, html, 'utf-8');
        log(`📄 HTML dumped: ${htmlPath}`);
        log(`   File size: ${(html.length / 1024).toFixed(2)} KB`);
        // === DEBUG PHASE 4: List all visible elements on the page ===
        log('\n========== PHASE 4: LISTING ALL VISIBLE ELEMENTS ==========');
        const elements = await page.evaluate(() => {
            const result = [];
            const allElements = document.querySelectorAll('input, button, a, select, textarea, [role="button"], [onclick], label');
            allElements.forEach((el, idx) => {
                const rect = el.getBoundingClientRect();
                result.push({
                    index: idx,
                    tag: el.tagName,
                    type: el.type || '',
                    id: el.id || '',
                    name: el.getAttribute('name') || '',
                    class: el.getAttribute('class') || '',
                    placeholder: el.placeholder || '',
                    value: el.value || '',
                    text: el.textContent?.substring(0, 100) || '',
                    ariaLabel: el.getAttribute('aria-label') || '',
                    title: el.getAttribute('title') || '',
                    visible: rect.width > 0 && rect.height > 0,
                    location: {
                        x: Math.round(rect.x),
                        y: Math.round(rect.y),
                        width: Math.round(rect.width),
                        height: Math.round(rect.height)
                    }
                });
            });
            return result;
        });
        log(`Found ${elements.length} interactive elements:`);
        // Save element list to JSON for analysis
        const jsonPath = path.join(HTML_DUMP_DIR, 'elements_list.json');
        fs.writeFileSync(jsonPath, JSON.stringify(elements, null, 2), 'utf-8');
        log(`📊 Elements saved to: ${jsonPath}`);
        // Show first 20 elements
        elements.slice(0, 20).forEach((el, idx) => {
            const label = el.text || el.placeholder || el.ariaLabel || el.title || `${el.tag}[${el.id}]`;
            log(`   ${idx + 1}. [${el.tag}] ${label.substring(0, 60)}`);
        });
        if (elements.length > 20) {
            log(`   ... and ${elements.length - 20} more elements`);
        }
        // === DEBUG PHASE 5: Search for specific element names ===
        log('\n========== PHASE 5: SEARCHING FOR SPECIFIC ELEMENTS ==========');
        const searchTerms = [
            'Customer',
            'Maintenance',
            'Save',
            'Submit',
            'Customer ID',
            'Name',
            'Address',
            'Close',
            'Cancel'
        ];
        for (const term of searchTerms) {
            log(`\n🔍 Searching for "${term}":`);
            // Search by text
            const byText = elements.filter(el => el.text.toLowerCase().includes(term.toLowerCase()) ||
                el.placeholder.toLowerCase().includes(term.toLowerCase()) ||
                el.ariaLabel.toLowerCase().includes(term.toLowerCase()) ||
                el.title.toLowerCase().includes(term.toLowerCase()));
            if (byText.length > 0) {
                log(`   ✅ Found ${byText.length} matching element(s):`);
                byText.slice(0, 3).forEach(el => {
                    const label = el.text || el.placeholder || el.ariaLabel || el.title;
                    log(`      • [${el.tag}] ${label.substring(0, 50)} (id="${el.id}", name="${el.name}")`);
                });
            }
            else {
                log(`   ❌ No elements found containing "${term}"`);
            }
        }
        // === DEBUG PHASE 6: Check for modals/overlays ===
        log('\n========== PHASE 6: DETECTING MODALS/OVERLAYS ==========');
        const modals = await page.evaluate(() => {
            const modalSelectors = [
                '[role="dialog"]',
                '[role="alertdialog"]',
                '.modal',
                '.overlay',
                '.dialog',
                '[class*="modal"]',
                '[class*="overlay"]',
                '[style*="position: fixed"]'
            ];
            const found = [];
            for (const selector of modalSelectors) {
                try {
                    const elements = document.querySelectorAll(selector);
                    elements.forEach((el) => {
                        const rect = el.getBoundingClientRect();
                        if (rect.width > 0 && rect.height > 0) {
                            found.push({
                                selector,
                                id: el.id,
                                className: el.className,
                                role: el.getAttribute('role'),
                                visible: true,
                                content: el.textContent?.substring(0, 100) || ''
                            });
                        }
                    });
                }
                catch (e) { }
            }
            return found;
        });
        if (modals.length > 0) {
            log(`✅ Found ${modals.length} modal/overlay element(s):`);
            modals.forEach((modal, idx) => {
                log(`   ${idx + 1}. [${modal.selector}] ${modal.id || modal.className} - "${modal.content.substring(0, 40)}..."`);
            });
            log(`\n💡 TIP: Customer maintenance is likely using MODALS/OVERLAYS, not iframes!`);
            log(`   Use 'searchInAllFrames()' or 'searchInAllSubwindows()' instead of frame API`);
        }
        else {
            log(`⚠️  No modals/overlays detected - elements might be in main page or iframes`);
        }
        // === PHASE 7: Test the frame API ===
        log('\n========== PHASE 7: TESTING FRAME API ==========');
        const mainFrame = page.mainFrame();
        const testElement = 'Save'; // Change this to any element you see
        log(`\nTesting smartFind API for element: "${testElement}"`);
        try {
            // Try each Playwright API
            const labelLocator = mainFrame.getByLabel(testElement, { exact: false });
            const labelCount = await labelLocator.count();
            log(`   getByLabel: ${labelCount} found`);
            const placeholderLocator = mainFrame.getByPlaceholder(testElement, { exact: false });
            const placeholderCount = await placeholderLocator.count();
            log(`   getByPlaceholder: ${placeholderCount} found`);
            const roleLocator = mainFrame.getByRole('button', { name: new RegExp(testElement, 'i') });
            const roleCount = await roleLocator.count();
            log(`   getByRole('button'): ${roleCount} found`);
            const textLocator = mainFrame.getByText(testElement, { exact: false });
            const textCount = await textLocator.count();
            log(`   getByText: ${textCount} found`);
            const totalFound = labelCount + placeholderCount + roleCount + textCount;
            if (totalFound === 0) {
                log(`\n⚠️  Element NOT found by frame API methods!`);
                log(`\n💡 RECOMMENDATION:`);
                log(`   The frame-based approach might not work for this application.`);
                log(`   Instead, use the deepDOMSearch() or searchInAllFrames() functions`);
                log(`   which directly search the DOM using evaluate().`);
            }
        }
        catch (e) {
            log(`❌ Frame API error: ${e.message}`);
        }
        // === FINAL RECOMMENDATION ===
        log('\n========== FINAL DIAGNOSIS ==========');
        log('\nBased on the debug output above:');
        if (frames.length === 1 && modals.length > 0) {
            log('✅ DIAGNOSIS: Customer maintenance uses MODALS/OVERLAYS (not iframes)');
            log('\n📌 SOLUTION:');
            log('   Use: await deepDOMSearch(target, "click") or await deepDOMSearch(target, "fill", value)');
            log('   Or:  await searchInAllFrames(target, "click")');
            log('\n❌ DO NOT USE: smartIframeAction() - won\'t work for modals!');
        }
        else if (frames.length > 1) {
            log('✅ DIAGNOSIS: Multiple frames detected');
            log('\n📌 SOLUTION:');
            log('   Use: await smartIframeAction(page, [/frameNamePattern/], elementName, "click")');
            log(`   Note: First frame might match pattern like: ${frames[1].name() || 'unknown'}`);
        }
        else {
            log('✅ DIAGNOSIS: Single-frame application with main page elements');
            log('\n📌 SOLUTION:');
            log('   Use: await deepDOMSearch(target, "click") or await clickWithRetry(target)');
        }
    }
    catch (error) {
        log(`❌ ERROR: ${error.message}`);
        log(error.stack);
    }
    finally {
        log('\n✅ Debug session complete');
        log(`📁 Results saved to: ${RESULTS_DIR}/`);
        log('\n⏰ Keeping browser open for manual inspection (close manually or modify script)');
        // await browser.close();
    }
}
// Run the debug script
debugCustomerMaintenanceScreen().catch(console.error);
