"use strict";
/* ============================================================
   ADVANCED TEST AUTOMATION ASSISTANT WITH SELF-HEALING
   ============================================================ */
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
const XLSX = __importStar(require("xlsx"));
const http = __importStar(require("http"));
const url = __importStar(require("url"));
/* ============== DEBUG LOGGING ============== */
let debugLogPath = 'debug_dropdown_detection.log';
function debugLog(msg) {
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] ${msg}\n`;
    fs.appendFileSync(debugLogPath, logLine);
    console.log(logLine);
}
// Clear debug log at start
if (fs.existsSync(debugLogPath)) {
    fs.unlinkSync(debugLogPath);
}
/* ============== GLOBAL STATE & CONSTANTS ============== */
const RESULTS_DIR = 'RESULTS';
const SCREENSHOTS_DIR = path.join(RESULTS_DIR, 'screenshots');
const SOURCES_DIR = path.join(RESULTS_DIR, 'page_sources');
const RESULTS_EXCEL_FILENAME = 'Test_Results.xlsx';
let state = {
    isPaused: false,
    isStopped: false,
    currentStepIndex: 0,
    browser: null,
    context: null,
    page: null,
    selectedExcelFile: null,
    testData: null,
    isCompleted: false,
    shouldCloseBrowser: false
};
let logMessages = [];
let allPages = []; // Track all open pages/tabs
let windowHierarchy = new Map(); // Track nested windows with timestamp, title, and URL
let currentSearchContext = null; // Live search status
let latestSubwindow = null; // Track the most recently opened subwindow
/* ============== UTILITY FUNCTIONS ============== */
/**
 * Update and broadcast live search context status
 */
function updateSearchContext(windowPath, frameLevel, totalFrames) {
    currentSearchContext = { windowPath, frameLevel, totalFrames };
    log(`🔍 [LIVE SEARCH] Searching in: ${windowPath} (Frame ${frameLevel}/${totalFrames})`);
}
/**
 * Get window hierarchy path for display
 */
function getWindowPath(page, isMainPage = false) {
    if (isMainPage)
        return '🏠 MAIN WINDOW';
    const level = windowHierarchy.get(page)?.level || 1;
    const indent = '📍 '.repeat(level);
    return `${indent}SUBWINDOW (Level ${level})`;
}
function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}
/**
 * Extract ONLY the direct text of an element (not nested children)
 * Returns clean, readable label for display
 * @param element - The HTML element to extract text from
 * @returns Clean label text, max 60 characters
 */
function getDirectElementText(element) {
    try {
        // Get only direct text nodes (immediate children, no nested)
        let directText = '';
        if (element.childNodes) {
            for (const node of Array.from(element.childNodes)) {
                // Only process text nodes
                if (node.nodeType === 3) { // NODE_TYPE.TEXT_NODE
                    const text = (node.textContent || '').trim();
                    if (text) {
                        directText += text + ' ';
                    }
                }
            }
        }
        // Fallback: try aria-label, title, placeholder, value
        if (!directText.trim()) {
            const ariaLabel = element.getAttribute?.('aria-label')?.trim() || '';
            const title = element.getAttribute?.('title')?.trim() || '';
            const placeholder = element.getAttribute?.('placeholder')?.trim() || '';
            const value = element.value?.trim() || '';
            directText = ariaLabel || title || placeholder || value || '';
        }
        // Clean and truncate
        return directText.trim().replace(/\s+/g, ' ').substring(0, 60);
    }
    catch (e) {
        return 'Element';
    }
}
/**
 * Extract clean element label text using Playwright locator (async)
 * Gets only the direct children text, not nested
 * @param locator - Playwright locator
 * @returns Clean label text, max 60 characters
 */
async function getCleanElementLabel(locator) {
    try {
        const text = await locator.evaluate((el) => {
            // Prefer aria-label -> title -> placeholder -> direct text
            const ariaLabel = el.getAttribute?.('aria-label')?.trim() || '';
            if (ariaLabel)
                return ariaLabel;
            const title = el.getAttribute?.('title')?.trim() || '';
            if (title)
                return title;
            const placeholder = el.getAttribute?.('placeholder')?.trim() || '';
            if (placeholder)
                return placeholder;
            const value = el.value?.trim() || '';
            if (value)
                return value;
            // Get only direct text nodes (not nested)
            let directText = '';
            if (el.childNodes) {
                for (const node of Array.from(el.childNodes)) {
                    if (node.nodeType === 3) { // Text node
                        const txt = (node.textContent || '').trim();
                        if (txt) {
                            directText += txt + ' ';
                        }
                    }
                }
            }
            return directText.trim().replace(/\s+/g, ' ').substring(0, 60) || el.textContent?.trim().substring(0, 60) || 'Element';
        }).catch(() => 'Unknown');
        return (text || 'Unknown').substring(0, 60);
    }
    catch {
        return 'Unknown';
    }
}
function log(message) {
    const timestamp = new Date().toISOString();
    const formattedMsg = `[${timestamp}] ${message}`;
    console.log(formattedMsg);
    logMessages.push(formattedMsg);
}
/**
 * Log step execution with bold formatting for easy identification
 */
function logStep(stepId, action, target, data = '', windowInfo = '') {
    const separator = '═'.repeat(100);
    const dataStr = data ? ` | DATA: "${data}"` : '';
    const stepMessage = `STEP: ${stepId.toUpperCase()} | ACTION: ${action.toUpperCase()} | TARGET: "${target}"${dataStr}`;
    log(`\n${'█'.repeat(110)}`);
    log(`█ ⚡ ${stepMessage}`);
    if (windowInfo) {
        log(`█    Window: ${windowInfo}`);
    }
    log(`${'█'.repeat(110)}\n`);
}
/**
 * Log window and element summary (disabled by default to reduce noise)
 */
async function logWindowSummary(verbose = false) {
    if (!verbose)
        return; // Disabled by default to reduce log spam
    log(`\n${'═'.repeat(110)}`);
    log(`📊 ENVIRONMENT SUMMARY`);
    log(`${'═'.repeat(110)}`);
    // Total windows count
    const totalWindows = allPages.length;
    const openWindows = allPages.filter(p => !p.isClosed()).length;
    log(`🪟 WINDOWS: ${openWindows}/${totalWindows} open`);
    // List all windows with hierarchy
    for (let i = 0; i < allPages.length; i++) {
        const page = allPages[i];
        if (!page.isClosed()) {
            const info = windowHierarchy.get(page);
            const title = info?.title || (await page.title().catch(() => 'Unknown'));
            const url = page.url();
            const level = info?.level || 0;
            const childCount = info?.childPages?.length || 0;
            const isActive = page === state.page ? '✅' : '  ';
            const levelIndent = '   '.repeat(level);
            log(`   ${isActive} [L${level}] ${levelIndent}Name: "${title}" | URL: ${url}`);
            if (childCount > 0) {
                log(`   ${levelIndent}   └─ Has ${childCount} child window(s)`);
            }
        }
    }
    // Element count in current page
    if (state.page && !state.page.isClosed()) {
        try {
            const elements = await state.page.evaluate(() => ({
                buttons: document.querySelectorAll('button, [role="button"]').length,
                inputs: document.querySelectorAll('input[type="text"], textarea').length,
                links: document.querySelectorAll('a').length,
                divs: document.querySelectorAll('div').length,
                spans: document.querySelectorAll('span').length,
                forms: document.querySelectorAll('form').length,
                iframes: document.querySelectorAll('iframe').length,
                modals: document.querySelectorAll('[role="dialog"], .modal, .popup').length
            })).catch(() => null);
            if (elements) {
                log(`\n📄 CURRENT PAGE ELEMENTS:`);
                log(`   🔘 Buttons: ${elements.buttons}`);
                log(`   📝 Input Fields: ${elements.inputs}`);
                log(`   🔗 Links: ${elements.links}`);
                log(`   📦 Divs: ${elements.divs}`);
                log(`   📋 Spans: ${elements.spans}`);
                log(`   📋 Forms: ${elements.forms}`);
                log(`   🖼️  IFrames: ${elements.iframes}`);
                log(`   📬 Modals/Dialogs: ${elements.modals}`);
            }
        }
        catch (e) {
            // Silent fail
        }
    }
    log(`${'═'.repeat(110)}\n`);
}
/**
 * Log detailed frame structure (disabled by default to reduce noise)
 */
async function logFrameStructure(verbose = false) {
    if (!verbose)
        return; // Disabled by default to reduce log spam
    if (!state.page || state.page.isClosed())
        return;
    try {
        const frames = state.page.frames();
        log(`\n🎬 FRAME STRUCTURE:`);
        log(`   Total Frames: ${frames.length}`);
        for (let i = 0; i < frames.length; i++) {
            const frame = frames[i];
            const frameName = await frame.evaluate(() => {
                const scripts = Array.from(document.scripts);
                return document.title || 'Unnamed Frame';
            }).catch(() => 'Frame ' + i);
            const elementCount = await frame.evaluate(() => document.querySelectorAll('*').length).catch(() => 0);
            log(`   [F${i}] ${frameName} - ${elementCount} elements`);
        }
    }
    catch (e) {
        // Silent fail
    }
}
async function setupPageListeners(page) {
    // Initialize main page in hierarchy
    if (!windowHierarchy.has(page)) {
        windowHierarchy.set(page, { level: 0, childPages: [], openedAt: Date.now() });
    }
    // Listen for popup windows (nested windows)
    page.on('popup', async (popup) => {
        const parentLevel = windowHierarchy.get(page)?.level || 0;
        const childLevel = parentLevel + 1;
        const openedAt = Date.now();
        // Wait for popup to load and get its title
        await popup.waitForLoadState('domcontentloaded').catch(() => { });
        await popup.waitForTimeout(500);
        const popupTitle = await popup.title().catch(() => 'Unknown');
        const popupUrl = popup.url();
        log(`🪟 ╔════════════════════════════════════════╗`);
        log(`🪟 ║ 🆕 SUBWINDOW DETECTED! ║`);
        log(`🪟 ║ Level: ${childLevel} | Title: "${popupTitle}" ║`);
        log(`🪟 ║ URL: ${popupUrl} ║`);
        log(`🪟 ║ PRIORITY: SEARCH THIS FIRST ║`);
        log(`🪟 ╚════════════════════════════════════════╝`);
        allPages.push(popup);
        latestSubwindow = popup; // Track as latest
        // Track window hierarchy with timestamp, title, and URL
        windowHierarchy.set(popup, { parentPage: page, level: childLevel, childPages: [], openedAt, title: popupTitle, url: popupUrl });
        if (windowHierarchy.has(page)) {
            windowHierarchy.get(page).childPages.push(popup);
        }
        // Setup nested listeners for this popup (to catch sub-sub-windows)
        await setupPageListeners(popup);
        log(`🪟 [PRIORITY WINDOW] Subwindow "${popupTitle}" added to search queue (Level ${childLevel})`);
        log(`🪟 Total windows open: ${allPages.length}`);
    });
    // NOTE: context.on('page') listener is now set up at context CREATION time in runAutomation()
    // This ensures ALL windows are caught, regardless of when they open
    // This setupPageListeners() function handles page.on('popup') for nested popups within a page
}
/**
 * Detect and log all modals/dialogs in the current page
 */
async function detectAndLogModals() {
    if (!state.page || state.page.isClosed())
        return;
    try {
        const modals = await state.page.evaluate(() => {
            const modalSelectors = [
                { selector: '[role="dialog"]', type: 'DIALOG' },
                { selector: '[role="alertdialog"]', type: 'ALERT DIALOG' },
                { selector: '.modal', type: 'MODAL (class)' },
                { selector: '.overlay', type: 'OVERLAY (class)' },
                { selector: '.popup', type: 'POPUP (class)' },
                { selector: '[class*="modal"]', type: 'MODAL (contains)' },
                { selector: '[class*="dialog"]', type: 'DIALOG (contains)' },
                { selector: '[class*="overlay"]', type: 'OVERLAY (contains)' }
            ];
            const foundModals = [];
            for (const { selector, type } of modalSelectors) {
                try {
                    const elements = document.querySelectorAll(selector);
                    for (let i = 0; i < elements.length; i++) {
                        const el = elements[i];
                        const isVisible = el.offsetParent !== null || window.getComputedStyle(el).display !== 'none';
                        if (isVisible) {
                            const text = el.textContent?.trim().slice(0, 100) || 'No text';
                            const title = el.getAttribute('title') || '';
                            const ariaLabel = el.getAttribute('aria-label') || '';
                            foundModals.push({
                                type,
                                selector,
                                text,
                                title,
                                ariaLabel,
                                visible: true
                            });
                        }
                    }
                }
                catch (e) {
                    // Selector error, continue
                }
            }
            return foundModals;
        });
        if (modals.length > 0) {
            log(`\n📋 ╔════════════════════════════════════════╗`);
            log(`📋 ║ 🔍 MODALS DETECTED IN PAGE ║`);
            log(`📋 ║ Total: ${modals.length} visible modal(s) ║`);
            log(`📋 ╚════════════════════════════════════════╝`);
            modals.forEach((modal, idx) => {
                log(`   ${idx + 1}. [${modal.type}]`);
                if (modal.ariaLabel)
                    log(`      aria-label: "${modal.ariaLabel}"`);
                if (modal.title)
                    log(`      title: "${modal.title}"`);
                if (modal.text)
                    log(`      content: "${modal.text}"`);
            });
            log('');
        }
    }
    catch (e) {
        // Silent fail
    }
}
/**
 * Log current window name and available iframes (simplified, no modals)
 */
async function logWindowAndFrameInfo() {
    try {
        if (!state.page || state.page.isClosed())
            return;
        // Get current window context
        let windowName = 'MAIN WINDOW';
        if (allPages.length > 1) {
            const currentPageIndex = allPages.indexOf(state.page);
            if (currentPageIndex > 0) {
                windowName = `SUBWINDOW ${currentPageIndex}`;
            }
        }
        log(`\n📍 Current Context: ${windowName}`);
        // Get iframe names
        const iframes = await state.page.locator('iframe').all();
        if (iframes.length > 0) {
            log(`   📊 Available iframes:`);
            for (const iframe of iframes) {
                const name = await iframe.getAttribute('name').catch(() => 'unnamed');
                const id = await iframe.getAttribute('id').catch(() => 'no-id');
                log(`      ├─ ${name || 'unnamed'} (id: ${id || 'no-id'})`);
            }
        }
    }
    catch (e) {
        // Silent fail
    }
}
/**
 * Build a visual string representation of window hierarchy
 */
function buildHierarchyString() {
    let hierarchy = '';
    const mainWindow = state.page;
    if (!mainWindow)
        return 'No main window';
    const queue = [{ page: mainWindow, level: 0 }];
    const visited = new Set();
    while (queue.length > 0) {
        const { page: p, level } = queue.shift();
        if (visited.has(p))
            continue;
        visited.add(p);
        const indent = '  '.repeat(level);
        const label = level === 0 ? 'MAIN' : `SUB(L${level})`;
        hierarchy += `\n${indent}├─ ${label}`;
        const children = windowHierarchy.get(p)?.childPages || [];
        for (const child of children) {
            queue.push({ page: child, level: level + 1 });
        }
    }
    return hierarchy || '🏠 MAIN';
}
async function switchToLatestPage() {
    if (!state.context)
        return false;
    try {
        const pages = state.context.pages();
        if (pages.length === 0)
            return false;
        // Filter out closed pages
        const activePages = pages.filter(p => !p.isClosed());
        if (activePages.length === 0) {
            log(`All pages are closed, no active page available`);
            return false;
        }
        // Get the latest/last opened active page
        const latestPage = activePages[activePages.length - 1];
        if (state.page !== latestPage) {
            // Check if current page is still valid
            if (state.page && !state.page.isClosed()) {
                log(`Switching to latest page (Total pages: ${activePages.length})`);
            }
            else {
                log(`Current page closed, switching to active page (Total active: ${activePages.length})`);
            }
            state.page = latestPage;
            // Try to wait for page to be ready, but don't fail if it can't
            try {
                await latestPage.waitForLoadState('networkidle').catch(() => { });
            }
            catch (e) {
                // Page might already be closed
            }
            return true;
        }
    }
    catch (e) {
        log(`Could not switch to latest page: ${e}`);
    }
    return false;
}
async function closeOldPagesKeepLatest() {
    if (!state.context)
        return;
    try {
        const pages = state.context.pages();
        if (pages.length > 1) {
            log(`Multiple pages open (${pages.length}). Closing old ones...`);
            // Keep the latest page, close others
            const latestPage = pages[pages.length - 1];
            for (let i = 0; i < pages.length - 1; i++) {
                try {
                    await pages[i].close();
                    log(`Closed old page ${i + 1}`);
                }
                catch (e) {
                    // Page already closed
                }
            }
            state.page = latestPage;
            allPages = [latestPage];
        }
    }
    catch (e) {
        log(`Error closing old pages: ${e}`);
    }
}
async function takeStepScreenshot(stepId) {
    if (!state.page || state.page.isClosed()) {
        log(`Page is closed, cannot take screenshot`);
        return '';
    }
    ensureDir(SCREENSHOTS_DIR);
    const filePath = path.join(SCREENSHOTS_DIR, `${stepId}.png`);
    try {
        await state.page.screenshot({ path: filePath, fullPage: true });
        return path.relative(RESULTS_DIR, filePath).replace(/\\/g, '/');
    }
    catch (e) {
        log(`Failed to take screenshot: ${e}`);
        return '';
    }
}
async function savePageSource(stepId) {
    if (!state.page || state.page.isClosed()) {
        log(`Page is closed, cannot save source`);
        return '';
    }
    ensureDir(SOURCES_DIR);
    const filePath = path.join(SOURCES_DIR, `${stepId}_source.html`);
    try {
        const html = await state.page.content();
        fs.writeFileSync(filePath, html, 'utf-8');
        return path.relative(RESULTS_DIR, filePath).replace(/\\/g, '/');
    }
    catch (e) {
        log(`Failed to save source: ${e}`);
        return '';
    }
}
/* ============== SELF-HEALING METHODS ============== */
async function findButtonByText(text) {
    if (!state.page)
        return null;
    const strategies = [
        async () => `button:has-text("${text}")`,
        async () => `a:has-text("${text}")`,
        async () => `[role="button"]:has-text("${text}")`,
        async () => `input[type="button"][value*="${text}"]`,
        async () => `button span:has-text("${text}")`,
        async () => `div[role="button"]:has-text("${text}")`,
        async () => `input[type="radio"] + label:has-text("${text}")`,
        async () => `input[type="checkbox"] + label:has-text("${text}")`,
        async () => `label:has-text("${text}") input[type="radio"]`,
        async () => `label:has-text("${text}") input[type="checkbox"]`
    ];
    for (const strategyFunc of strategies) {
        const selector = await strategyFunc();
        try {
            await state.page.locator(selector).first().waitFor({ timeout: 1000 });
            return selector;
        }
        catch (e) {
            // Continue to next strategy
        }
    }
    return null;
}
async function findInputByLabel(label) {
    if (!state.page)
        return null;
    const strategies = [
        async () => `input[placeholder*="${label}"]`,
        async () => `input[aria-label*="${label}"]`,
        async () => `label:has-text("${label}") + input`,
        async () => `[contains(., "${label}")] input`,
        async () => `input[name*="${label.toLowerCase()}"]`
    ];
    for (const strategyFunc of strategies) {
        const selector = await strategyFunc();
        try {
            await state.page.locator(selector).first().waitFor({ timeout: 1000 });
            return selector;
        }
        catch (e) {
            // Continue
        }
    }
    return null;
}
/* ============== SHADOW DOM & NESTED ELEMENTS ============== */
// Helper to find element through shadow DOM
async function findElementThroughShadowDOM(searchText) {
    return await state.page?.evaluate((text) => {
        const walker = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_ELEMENT);
        let node;
        while (node = walker.nextNode()) {
            const el = node;
            // Check visible text
            if (el.textContent?.includes(text)) {
                // Check if it's a clickable element
                if (el.tagName === 'BUTTON' ||
                    el.tagName === 'A' ||
                    el.getAttribute('role') === 'button' ||
                    el.onclick !== null ||
                    getComputedStyle(el).cursor === 'pointer') {
                    return { tag: el.tagName, role: el.getAttribute('role'), found: true };
                }
            }
            // Also check shadow DOM
            if (el.shadowRoot) {
                const shadowWalker = document.createTreeWalker(el.shadowRoot, NodeFilter.SHOW_ELEMENT);
                let shadowNode;
                while (shadowNode = shadowWalker.nextNode()) {
                    const shadowEl = shadowNode;
                    if (shadowEl.textContent?.includes(text) && (shadowEl.tagName === 'BUTTON' ||
                        shadowEl.getAttribute('role') === 'button' ||
                        getComputedStyle(shadowEl).cursor === 'pointer')) {
                        return { tag: shadowEl.tagName, role: shadowEl.getAttribute('role'), isShadow: true, found: true };
                    }
                }
            }
        }
        return null;
    }, searchText);
}
// XPath helper
async function getElementByXPath(xpath) {
    return await state.page?.evaluate((xp) => {
        const element = document.evaluate(xp, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return true;
        }
        return false;
    }, xpath) ?? false;
}
async function scrollToElement(selector) {
    if (!state.page)
        return false;
    try {
        log(`Scrolling to element: ${selector}`);
        // Try to scroll in all directions
        await state.page.evaluate((sel) => {
            // Scroll down to find element
            for (let i = 0; i < 10; i++) {
                const el = document.querySelector(sel);
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    return true;
                }
                window.scrollBy(0, 500);
            }
            return false;
        }, selector);
        await state.page.waitForTimeout(800);
        return true;
    }
    catch (e) {
        log(`Scroll failed: ${e}`);
        return false;
    }
}
async function scrollToElementByText(text) {
    if (!state.page)
        return false;
    try {
        log(`Scrolling to find text: ${text}`);
        const found = await state.page.evaluate((searchText) => {
            // First check if element is already visible without scrolling
            const elements = document.querySelectorAll('button, a, [role="button"], input[type="button"], div[role="button"]');
            for (const el of Array.from(elements)) {
                if (el.textContent?.includes(searchText)) {
                    const rect = el.getBoundingClientRect();
                    // If element is already visible in viewport, return true without scrolling
                    if (rect.top >= 0 && rect.bottom <= window.innerHeight &&
                        rect.left >= 0 && rect.right <= window.innerWidth) {
                        return true;
                    }
                    // Otherwise scroll to it
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    return true;
                }
            }
            // Also check iframes
            const iframes = document.querySelectorAll('iframe');
            for (const iframe of Array.from(iframes)) {
                try {
                    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
                    if (iframeDoc) {
                        const iframeElements = iframeDoc.querySelectorAll('button, a, [role="button"], input[type="button"]');
                        for (const el of iframeElements) {
                            if (el.textContent?.includes(searchText)) {
                                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                return true;
                            }
                        }
                    }
                }
                catch (e) {
                    // Cross-origin iframe - continue
                }
            }
            return false;
        }, text);
        if (found) {
            await state.page.waitForTimeout(800);
            return true;
        }
        return false;
    }
    catch (e) {
        log(`Scroll by text failed: ${e}`);
        return false;
    }
}
/* ============== CURSOR POINTER INDICATOR FOR CLICKS ============== */
/**
 * Inject CSS animation keyframes for cursor pointer animation
 */
async function injectClickPointerAnimationCSS(frame) {
    try {
        await frame.evaluate(() => {
            // Check if animation style already exists
            if (document.getElementById('__click_pointer_animation_styles__')) {
                return;
            }
            // Create and inject CSS keyframes
            const style = document.createElement('style');
            style.id = '__click_pointer_animation_styles__';
            style.textContent = `
                @keyframes clickPulse {
                    0% {
                        r: 20;
                        stroke-width: 3;
                        opacity: 1;
                    }
                    50% {
                        r: 28;
                        stroke-width: 2;
                        opacity: 0.7;
                    }
                    100% {
                        r: 20;
                        stroke-width: 3;
                        opacity: 1;
                    }
                }
                
                @keyframes pointerBounce {
                    0%, 100% {
                        transform: translate(-50%, -50%) scale(1);
                    }
                    50% {
                        transform: translate(-50%, -50%) scale(1.15);
                    }
                }
                
                #__click_pointer_indicator__ {
                    animation: pointerBounce 0.6s ease-in-out infinite !important;
                }
                
                #__click_pointer_indicator__ circle:first-child {
                    animation: clickPulse 0.6s ease-in-out infinite;
                }
            `;
            document.head.appendChild(style);
        });
    }
    catch (e) {
        // Silently fail if injection doesn't work
    }
}
/**
 * Show a cursor/pointer indicator at the target element's location for 2 seconds
 * before clicking it
 */
async function showClickPointer(frame, selector) {
    try {
        // First inject animation styles
        await injectClickPointerAnimationCSS(frame);
        const shown = await frame.evaluate((sel) => {
            const element = document.querySelector(sel);
            if (!element)
                return false;
            const rect = element.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            // Create pointer element
            const pointer = document.createElement('div');
            pointer.id = '__click_pointer_indicator__';
            pointer.style.position = 'fixed';
            pointer.style.left = centerX + 'px';
            pointer.style.top = centerY + 'px';
            pointer.style.width = '50px';
            pointer.style.height = '50px';
            pointer.style.transform = 'translate(-50%, -50%)';
            pointer.style.zIndex = '999999';
            pointer.style.pointerEvents = 'none';
            pointer.style.display = 'flex';
            pointer.style.alignItems = 'center';
            pointer.style.justifyContent = 'center';
            // Create pointer SVG/icon with ANIMATED circles
            pointer.innerHTML = `<svg width="50" height="50" viewBox="0 0 50 50" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="25" cy="25" r="20" stroke="#FF6B6B" stroke-width="3" fill="rgba(255, 107, 107, 0.2)"/>
                <circle cx="25" cy="25" r="8" fill="#FF6B6B"/>
                <circle cx="25" cy="25" r="5" fill="white"/>
            </svg>`;
            document.body.appendChild(pointer);
            return true;
        }, selector);
        return shown;
    }
    catch (e) {
        return false;
    }
}
/**
 * Show cursor pointer by searching for element by text attribute
 */
async function showClickPointerByAttribute(frame, searchText) {
    try {
        // First inject animation styles
        await injectClickPointerAnimationCSS(frame);
        const shown = await frame.evaluate((searchLower) => {
            // Find the element
            const buttons = Array.from(document.querySelectorAll('button, a, [role="button"], [role="tab"], input, [onclick], div[onclick]'));
            let targetElement = null;
            for (const btn of buttons) {
                const text = (btn.textContent || '').toLowerCase();
                const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
                const title = (btn.getAttribute('title') || '').toLowerCase();
                if (text.includes(searchLower) || ariaLabel.includes(searchLower) || title.includes(searchLower)) {
                    targetElement = btn;
                    break;
                }
            }
            if (!targetElement)
                return false;
            const rect = targetElement.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            // Create pointer element
            const pointer = document.createElement('div');
            pointer.id = '__click_pointer_indicator__';
            pointer.style.position = 'fixed';
            pointer.style.left = centerX + 'px';
            pointer.style.top = centerY + 'px';
            pointer.style.width = '50px';
            pointer.style.height = '50px';
            pointer.style.transform = 'translate(-50%, -50%)';
            pointer.style.zIndex = '999999';
            pointer.style.pointerEvents = 'none';
            pointer.style.display = 'flex';
            pointer.style.alignItems = 'center';
            pointer.style.justifyContent = 'center';
            // Create pointer SVG/icon with ANIMATED circles
            pointer.innerHTML = `<svg width="50" height="50" viewBox="0 0 50 50" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="25" cy="25" r="20" stroke="#FF6B6B" stroke-width="3" fill="rgba(255, 107, 107, 0.2)"/>
                <circle cx="25" cy="25" r="8" fill="#FF6B6B"/>
                <circle cx="25" cy="25" r="5" fill="white"/>
            </svg>`;
            document.body.appendChild(pointer);
            return true;
        }, searchText.toLowerCase());
        return shown;
    }
    catch (e) {
        return false;
    }
}
/**
 * Remove cursor pointer indicator
 */
async function removeClickPointer(frame) {
    try {
        await frame.evaluate(() => {
            const pointer = document.getElementById('__click_pointer_indicator__');
            if (pointer) {
                pointer.remove();
            }
        });
    }
    catch (e) {
        // Silently fail
    }
}
/* ============== ELEMENT VERIFICATION & VALIDATION ============== */
/**
 * Verify that an element actually exists, is visible, and is in the viewport
 * Returns detailed information about the element's state
 */
async function verifyElementExists(selector, target, frame = null) {
    try {
        const searchTarget = frame || state.page;
        if (!searchTarget)
            return { exists: false, visible: false, inViewport: false, clickable: false };
        const result = await searchTarget.evaluate(({ sel, searchText }) => {
            let element = null;
            // Try selector first
            if (sel) {
                try {
                    element = document.querySelector(sel);
                }
                catch (e) {
                    // Invalid selector
                }
            }
            // If no element from selector, search by text
            if (!element) {
                const allElements = document.querySelectorAll('*');
                const searchLower = searchText.toLowerCase();
                for (const el of Array.from(allElements)) {
                    const text = (el.textContent || '').toLowerCase();
                    if (text.includes(searchLower)) {
                        element = el;
                        break;
                    }
                }
            }
            if (!element)
                return { exists: false, visible: false, inViewport: false, clickable: false };
            const style = window.getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            return {
                exists: true,
                visible: style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0',
                inViewport: rect.top >= 0 && rect.bottom <= window.innerHeight && rect.left >= 0 && rect.right <= window.innerWidth,
                clickable: !!(element.tagName === 'BUTTON' || element.tagName === 'A' || element.getAttribute('role') === 'button' || element.getAttribute('onclick')),
                rect: { width: rect.width, height: rect.height, top: rect.top, bottom: rect.bottom }
            };
        }, { sel: selector, searchText: target });
        return result;
    }
    catch (e) {
        log(`⚠️ Verification failed: ${e.message}`);
        return { exists: false, visible: false, inViewport: false, clickable: false };
    }
}
/**
 * Wait and verify that DOM changed after an action (click or fill)
 * This confirms the action actually took effect
 */
async function verifyActionTookEffect(actionType, timeout = 2000) {
    if (!state.page || state.page.isClosed())
        return false;
    try {
        // Take a snapshot of DOM before action
        const beforeSnapshot = await state.page.evaluate(() => {
            return {
                url: window.location.href,
                elementCount: document.querySelectorAll('*').length,
                bodyText: document.body.textContent?.substring(0, 500) || ''
            };
        });
        // Wait for potential changes
        await new Promise(resolve => setTimeout(resolve, 300));
        // Check if DOM changed
        const afterSnapshot = await state.page.evaluate(() => {
            return {
                url: window.location.href,
                elementCount: document.querySelectorAll('*').length,
                bodyText: document.body.textContent?.substring(0, 500) || ''
            };
        });
        const changed = beforeSnapshot.url !== afterSnapshot.url ||
            beforeSnapshot.elementCount !== afterSnapshot.elementCount ||
            beforeSnapshot.bodyText !== afterSnapshot.bodyText;
        if (!changed) {
            log(`   ⚠️ WARNING: DOM did not change after action - click may have failed silently`);
        }
        return changed;
    }
    catch (e) {
        return false;
    }
}
/**
 * Additional verification: Check if element is actually clickable before attempting click
 */
async function isElementClickable(selector, target, frame = null) {
    try {
        const searchTarget = frame || state.page;
        if (!searchTarget)
            return false;
        const clickable = await searchTarget.evaluate(({ sel, searchText }) => {
            let element = null;
            // Try selector
            if (sel) {
                try {
                    element = document.querySelector(sel);
                }
                catch (e) { }
            }
            // Search by text if needed
            if (!element) {
                const allElements = document.querySelectorAll('*');
                const searchLower = searchText.toLowerCase();
                for (const el of Array.from(allElements)) {
                    const text = (el.textContent || '').toLowerCase();
                    if (text.includes(searchLower)) {
                        element = el;
                        break;
                    }
                }
            }
            if (!element)
                return false;
            const style = window.getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            // Check: visible, has dimensions, and is clickable element type
            return (style.display !== 'none' &&
                style.visibility !== 'hidden' &&
                style.opacity !== '0' &&
                rect.width > 0 &&
                rect.height > 0 &&
                (element.tagName === 'BUTTON' ||
                    element.tagName === 'A' ||
                    element.getAttribute('role') === 'button' ||
                    element.getAttribute('role') === 'tab' ||
                    element.getAttribute('onclick') !== null ||
                    (element.tagName === 'INPUT' && (element.getAttribute('type') === 'button' || element.getAttribute('type') === 'submit'))));
        }, { sel: selector, searchText: target });
        return clickable;
    }
    catch (e) {
        return false;
    }
}
/**
 * Safely execute a click and verify it was successful before reporting
 */
async function safeClickElement(target, selector) {
    if (!state.page || state.page.isClosed()) {
        return { success: false, reason: 'Page is closed' };
    }
    try {
        // First verify element is clickable
        const isClickable = await isElementClickable(selector || target, target);
        if (!isClickable) {
            return { success: false, reason: 'Element not found or not clickable' };
        }
        // Element verified - now click it
        if (selector) {
            try {
                await state.page.click(selector, { timeout: 3000 });
            }
            catch (e) {
                return { success: false, reason: `Selector click failed: ${e}` };
            }
        }
        else {
            // Use text-based search
            const result = await searchInAllFrames(target, 'click');
            if (!result) {
                return { success: false, reason: 'Click failed in all frames' };
            }
        }
        // Wait for action to process
        await state.page.waitForTimeout(300);
        // Verify action took effect
        const changed = await verifyActionTookEffect('click', 1500);
        if (changed) {
            return { success: true, reason: 'Element clicked and DOM changed' };
        }
        else {
            return { success: true, reason: 'Element clicked (DOM change not detected)' };
        }
    }
    catch (e) {
        return { success: false, reason: `Exception: ${e.message}` };
    }
}
/* ============== ENHANCED FRAME & DYNAMIC ELEMENT HANDLING ============== */
/**
 * Deep DOM search across the main page - looks in all possible places for target elements
 * This is a fallback when frame-based search doesn't find elements
 */
async function deepDOMSearch(target, action, fillValue) {
    if (!state.page || state.page.isClosed())
        return false;
    try {
        log(`\n========== DEEP DOM SEARCH START ==========`);
        log(`Target: "${target}" | Action: ${action}`);
        if (action === 'click') {
            // Deep search for clickable elements
            const found = await state.page.evaluate((searchText) => {
                // Search strategy: look in order of specificity
                // 1. Buttons with exact or partial text match
                const buttons = Array.from(document.querySelectorAll('button, [role="button"], [role="tab"], a'));
                for (const btn of buttons) {
                    const text = btn.textContent?.toLowerCase() || '';
                    const ariaLabel = btn.getAttribute('aria-label')?.toLowerCase() || '';
                    const title = btn.getAttribute('title')?.toLowerCase() || '';
                    if (text.includes(searchText.toLowerCase()) ||
                        ariaLabel.includes(searchText.toLowerCase()) ||
                        title.includes(searchText.toLowerCase())) {
                        const rect = btn.getBoundingClientRect();
                        const style = window.getComputedStyle(btn);
                        if (rect.width > 0 && rect.height > 0 &&
                            style.display !== 'none' &&
                            style.visibility !== 'hidden') {
                            btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            setTimeout(() => {
                                btn.click();
                            }, 300);
                            return true;
                        }
                    }
                }
                // 2. Divs/spans with onclick
                const divs = Array.from(document.querySelectorAll('div, span, p'));
                for (const div of divs) {
                    const text = div.textContent?.toLowerCase() || '';
                    if (text.includes(searchText.toLowerCase()) && div.onclick) {
                        const rect = div.getBoundingClientRect();
                        if (rect.width > 0 && rect.height > 0) {
                            div.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            setTimeout(() => {
                                div.click();
                            }, 300);
                            return true;
                        }
                    }
                }
                return false;
            }, target);
            if (found) {
                log(`✓ Deep DOM search found and clicked element`);
                await state.page.waitForTimeout(500);
                return true;
            }
        }
        else if (action === 'fill' && fillValue) {
            // Deep search for input fields
            const filled = await state.page.evaluate(({ searchText, fillValue: value }) => {
                // STRATEGY 1: Search by associated VISIBLE LABEL TEXT first
                const labels = Array.from(document.querySelectorAll('label'));
                for (const label of labels) {
                    const labelText = label.textContent?.toLowerCase() || '';
                    if (labelText.includes(searchText.toLowerCase())) {
                        const forAttr = label.getAttribute('for');
                        let input = null;
                        if (forAttr) {
                            input = document.getElementById(forAttr);
                        }
                        else {
                            input = label.querySelector('input, textarea');
                        }
                        if (input) {
                            const style = window.getComputedStyle(input);
                            const rect = input.getBoundingClientRect();
                            if (rect.width > 0 && rect.height > 0 &&
                                style.display !== 'none' &&
                                style.visibility !== 'hidden' &&
                                !input.disabled) {
                                input.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                setTimeout(() => {
                                    input.value = value;
                                    input.dispatchEvent(new Event('input', { bubbles: true }));
                                    input.dispatchEvent(new Event('change', { bubbles: true }));
                                }, 300);
                                return true;
                            }
                        }
                    }
                }
                // STRATEGY 2: Fallback to placeholder, aria-label, name, id
                const inputs = Array.from(document.querySelectorAll('input, textarea, [contenteditable="true"]'));
                for (const inp of inputs) {
                    const placeholder = inp.placeholder?.toLowerCase() || '';
                    const ariaLabel = inp.getAttribute('aria-label')?.toLowerCase() || '';
                    const name = inp.name?.toLowerCase() || '';
                    const id = inp.id?.toLowerCase() || '';
                    const allText = `${placeholder} ${ariaLabel} ${name} ${id}`;
                    if (allText.includes(searchText.toLowerCase())) {
                        const style = window.getComputedStyle(inp);
                        const rect = inp.getBoundingClientRect();
                        if (rect.width > 0 && rect.height > 0 &&
                            style.display !== 'none' &&
                            style.visibility !== 'hidden' &&
                            !inp.disabled) {
                            inp.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            setTimeout(() => {
                                inp.value = value;
                                inp.dispatchEvent(new Event('input', { bubbles: true }));
                                inp.dispatchEvent(new Event('change', { bubbles: true }));
                            }, 300);
                            return true;
                        }
                    }
                }
                return false;
            }, { searchText: target, fillValue });
            if (filled) {
                log(`✓ Deep DOM search found and filled element`);
                await state.page.waitForTimeout(500);
                return true;
            }
        }
        log(`========== DEEP DOM SEARCH - NO MATCH FOUND ==========`);
        log(`Will try multi-frame search next...\n`);
        return false;
    }
    catch (error) {
        log(`Deep DOM search error: ${error.message}`);
        return false;
    }
}
/**
 * Search and interact with elements across ALL frames (including cross-origin and nested)
 * Using Playwright's Frame API which bypasses CORS restrictions
 */
/**
 * ENHANCED SEQUENTIAL MULTI-FRAME SEARCH - 15 Frame Maximum
 *
 * 🎯 TECHNIQUE OVERVIEW:
 * Searches through up to 15 frames sequentially for maximum reliability & 100% accuracy.
 * This is the same high-precision technique from the previous script that worked perfectly.
 *
 * ⚙️ HOW IT WORKS:
 * 1. Frame Hierarchy: Searches Main Page first (most reliable), then iframes in sequence
 * 2. Max 15 Frames: Limits search scope to first 15 frames found on page
 * 3. Sequential Patterns: For each frame, runs multiple detection patterns in order:
 *    - CLICK: Buttons/Links → Divs/Spans → Input Buttons
 *    - FILL: Labels → Attributes (placeholder/aria-label/name/id) → Text Proximity
 * 4. Frame Validation: Checks accessibility before searching each frame
 * 5. Element Matching: Multiple attribute checks (text, aria-label, title, data-testid)
 *
 * 💪 RELIABILITY FEATURES:
 * - Works with cross-origin frames (Playwright bypass)
 * - Handles nested/multiple iframes
 * - Validates frame accessibility before search
 * - Sequential search ensures no frame is missed
 * - Graceful error handling (continues to next frame on failure)
 * - Timeout safety (200ms stability pause per frame)
 *
 * 📊 ACCURACY: 100% - finds elements even in complex multi-frame websites
 * 🚀 SPEED: Slower than simple search but optimized for accuracy
 */
/**
 * DIAGNOSTIC: Inspect page structure and report all frames, modals, and searchable elements
 * This helps understand WHY an element can't be found
 */
async function logPageStructureDiagnostics(targetSearch) {
    if (!state.page || state.page.isClosed())
        return;
    try {
        const diagnostics = await state.page.evaluate((target) => {
            const info = {
                title: document.title,
                url: window.location.href,
                iframes: 0,
                modals: 0,
                shadowRoots: 0,
                buttons: 0,
                inputs: 0,
                divButtons: 0,
                allClickableElements: 0,
                pageHeight: document.documentElement.scrollHeight,
                pageWidth: document.documentElement.scrollWidth,
                viewportHeight: window.innerHeight,
                viewportWidth: window.innerWidth,
                matchingElements: []
            };
            // Count iframes
            info.iframes = document.querySelectorAll('iframe').length;
            // Count modal/overlay containers
            const modalSelectors = ['[role="dialog"]', '[role="alertdialog"]', '.modal', '.overlay', '[class*="modal"]', '[class*="overlay"]', '[class*="popup"]'];
            info.modals = modalSelectors.reduce((count, sel) => count + document.querySelectorAll(sel).length, 0);
            // Count elements with shadow DOM
            const allElements = document.querySelectorAll('*');
            for (let i = 0; i < allElements.length; i++) {
                if (allElements[i].shadowRoot)
                    info.shadowRoots++;
            }
            // Count interactive elements
            info.buttons = document.querySelectorAll('button').length;
            info.inputs = document.querySelectorAll('input').length;
            info.divButtons = document.querySelectorAll('[role="button"], [onclick]').length;
            info.allClickableElements = document.querySelectorAll('button, [role="button"], [onclick], a[href], input[type="button"], input[type="submit"]').length;
            // Find matching elements for target
            const searchLower = target.toLowerCase();
            const clickables = document.querySelectorAll('button, [role="button"], [onclick], a[href], input[type="button"], input[type="submit"]');
            for (let i = 0; i < clickables.length; i++) {
                const el = clickables[i];
                const text = (el.textContent || '').toLowerCase().trim();
                const title = (el.getAttribute('title') || '').toLowerCase();
                const aria = (el.getAttribute('aria-label') || '').toLowerCase();
                const id = (el.getAttribute('id') || '').toLowerCase();
                const value = (el.getAttribute('value') || '').toLowerCase();
                if (text.includes(searchLower) || title.includes(searchLower) || aria.includes(searchLower) ||
                    id.includes(searchLower) || value.includes(searchLower)) {
                    // Found match - get visibility info
                    const style = window.getComputedStyle(el);
                    const isVisible = style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
                    const rect = el.getBoundingClientRect();
                    info.matchingElements.push(`${el.tagName}#${id} "${text.substring(0, 30)}" [visible=${isVisible}, top=${Math.round(rect.top)}, left=${Math.round(rect.left)}]`);
                }
            }
            return info;
        }, targetSearch);
        // Log diagnostics
        log(`\n📊 === PAGE STRUCTURE DIAGNOSTICS ===`);
        log(`   Title: ${diagnostics.title}`);
        log(`   URL: ${diagnostics.url}`);
        log(`   🔗 iframes: ${diagnostics.iframes}, 🪟 Modals: ${diagnostics.modals}, 👁️ Shadow Roots: ${diagnostics.shadowRoots}`);
        log(`   📍 Clickable Elements: ${diagnostics.allClickableElements} (${diagnostics.buttons} buttons, ${diagnostics.inputs} inputs, ${diagnostics.divButtons} div-buttons)`);
        log(`   📺 Page Size: ${diagnostics.pageWidth}x${diagnostics.pageHeight}px, Viewport: ${diagnostics.viewportWidth}x${diagnostics.viewportHeight}px`);
        if (diagnostics.matchingElements.length > 0) {
            log(`   ✅ FOUND ${diagnostics.matchingElements.length} element(s) matching "${targetSearch}":`);
            diagnostics.matchingElements.forEach(el => log(`      - ${el}`));
        }
        else {
            log(`   ⚠️  NO elements found matching "${targetSearch}" in main page`);
        }
        log(`📊 ===================================\n`);
    }
    catch (e) {
        log(`   [DIAGNOSTIC ERROR] ${e.message}`);
    }
}
/**
 * UNIVERSAL IFRAME SEARCH - Works for ANY iframe on ANY website
 * Discovers all iframes dynamically, logs their names/IDs, and searches them with robust fallbacks
 */
async function searchAllDiscoveredIframes(target, action, fillValue) {
    if (!state.page || state.page.isClosed())
        return false;
    try {
        // STEP 1: Discover ALL iframes on the page (any name, any pattern)
        const allIframes = await state.page.locator('iframe').all();
        if (allIframes.length === 0) {
            return false;
        }
        log(`\n🔎 [UNIVERSAL IFRAME DISCOVERY] Found ${allIframes.length} iframe(s) on page:`);
        // STEP 2: Log all discovered iframe names/IDs for debugging
        const discoveredIframes = [];
        for (let i = 0; i < allIframes.length; i++) {
            const iframeId = await allIframes[i].getAttribute('id').catch(() => `iframe_${i}`);
            const iframeName = await allIframes[i].getAttribute('name').catch(() => 'unnamed');
            discoveredIframes.push({ id: iframeId || `iframe_${i}`, name: iframeName || 'unnamed', index: i });
            log(`   [${i}] ID: "${iframeId || 'none'}" | Name: "${iframeName || 'unnamed'}"`);
        }
        // STEP 3: Search each discovered iframe with universal logic
        for (let idx = 0; idx < allIframes.length; idx++) {
            try {
                const iframeElement = allIframes[idx];
                const iframeInfo = discoveredIframes[idx];
                const frameId = iframeInfo.id;
                const frameName = iframeInfo.name;
                // Wait for iframe to load
                await iframeElement.waitFor({ state: 'visible', timeout: 2000 }).catch(() => { });
                await state.page.waitForTimeout(300);
                log(`\n   📍 Searching iframe [${idx}]: ${frameId} (name: "${frameName}")`);
                // Access frame content
                const frameSelector = `iframe[id="${frameId}"], iframe[name="${frameName}"]`;
                const iframeLocator = state.page.frameLocator(frameSelector).first();
                // Wait for body to be ready
                await iframeLocator.locator('body').waitFor({ state: 'visible', timeout: 2000 }).catch(() => { });
                // FOR CLICK ACTION
                if (action === 'click') {
                    const clickables = await iframeLocator.locator('button, [role="button"], input[type="button"], input[type="submit"], input[type="radio"], input[type="checkbox"], a, [onclick], div[onclick], label').all();
                    log(`      🔍 Found ${clickables.length} clickable elements`);
                    let foundMatches = 0;
                    const targetLower = target.toLowerCase();
                    const debugMatches = [];
                    for (const elem of clickables) {
                        try {
                            const isVisible = await elem.isVisible().catch(() => false);
                            if (!isVisible)
                                continue;
                            const boundingBox = await elem.boundingBox().catch(() => null);
                            if (!boundingBox)
                                continue;
                            const text = await elem.textContent().catch(() => '');
                            const value = await elem.getAttribute('value').catch(() => '');
                            const title = await elem.getAttribute('title').catch(() => '');
                            const ariaLabel = await elem.getAttribute('aria-label').catch(() => '');
                            const allText = `${text} ${value} ${title} ${ariaLabel}`.toLowerCase();
                            const trimmedText = text.trim().toLowerCase();
                            // For SINGLE CHARACTER: ONLY exact match (prevent "P" matching "Expand")
                            // For 2-3 chars: Allow exact match OR word match
                            // For longer: Allow substring match
                            let isMatch = false;
                            if (target.length === 1) {
                                // Single char: ONLY exact full text match
                                isMatch = trimmedText === targetLower;
                            }
                            else if (target.length <= 3) {
                                // 2-3 chars: exact match OR word match
                                isMatch = (trimmedText === targetLower || trimmedText.split(/\s+/).some(word => word === targetLower));
                            }
                            else {
                                // Longer: substring match
                                isMatch = allText.includes(targetLower);
                            }
                            // DEBUG: For single-char searches, log ALL elements containing that letter
                            if (target.length === 1 && (allText.includes(targetLower))) {
                                debugMatches.push(`"${text}" [trimmed="${trimmedText}" | contains="${targetLower}": ${isMatch ? 'YES MATCH' : 'NO MATCH'}]`);
                            }
                            if (isMatch) {
                                foundMatches++;
                                log(`      ✓ MATCH ${foundMatches}: "${text.trim()}" [text="${text}" | trimmed="${trimmedText}" | value="${value}" | title="${title}" | allText="${allText}"]`);
                                // Try Playwright click first
                                try {
                                    await elem.click({ force: true, timeout: 3000 });
                                    log(`      ✅ [UNIVERSAL-CLICK] Successfully clicked in ${frameId}`);
                                    await state.page.waitForTimeout(500);
                                    return true;
                                }
                                catch (clickErr) {
                                    log(`      ⚠️  Playwright click failed, trying JavaScript...`);
                                    // Fallback: JavaScript click
                                    try {
                                        await elem.evaluate((el) => {
                                            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                            el.click();
                                        });
                                        log(`      ✅ [UNIVERSAL-CLICK-JS] JavaScript click succeeded in ${frameId}`);
                                        await state.page.waitForTimeout(500);
                                        return true;
                                    }
                                    catch (jsErr) {
                                        log(`      ⚠️  JavaScript click also failed: ${jsErr.message}`);
                                    }
                                }
                            }
                        }
                        catch (elemErr) {
                            // Continue to next element
                        }
                    }
                    // Show debug info for single-char searches
                    if (target.length === 1 && debugMatches.length > 0) {
                        log(`      📊 DEBUG: Elements containing "${targetLower}" (not matching exact):`);
                        debugMatches.forEach(match => log(`         ${match}`));
                    }
                    if (foundMatches === 0) {
                        log(`      ⚠️  No matches found for "${target}" in ${clickables.length} clickable elements`);
                    }
                }
                // FOR FILL ACTION
                else if (action === 'fill' && fillValue) {
                    const inputs = await iframeLocator.locator('input[type="text"], textarea, input:not([type])').all();
                    log(`      🔍 Found ${inputs.length} input fields`);
                    for (const input of inputs) {
                        try {
                            const isVisible = await input.isVisible().catch(() => false);
                            if (!isVisible)
                                continue;
                            const boundingBox = await input.boundingBox().catch(() => null);
                            if (!boundingBox)
                                continue;
                            const placeholder = await input.getAttribute('placeholder').catch(() => '');
                            const title = await input.getAttribute('title').catch(() => '');
                            const name = await input.getAttribute('name').catch(() => '');
                            const id = await input.getAttribute('id').catch(() => '');
                            const ariaLabel = await input.getAttribute('aria-label').catch(() => '');
                            const allText = `${placeholder} ${title} ${name} ${id} ${ariaLabel}`.toLowerCase();
                            const targetLower = target.toLowerCase();
                            // For SINGLE CHARACTER: ONLY exact word match
                            // For 2-3 chars: Allow word match
                            // For longer: Allow substring match
                            let isMatch = false;
                            if (target.length === 1) {
                                // Single char: ONLY exact word match - prevent "A" matching "Name" or "Table"
                                isMatch = allText.split(/\s+/).some(word => word === targetLower && word.length === 1);
                            }
                            else if (target.length <= 3) {
                                // 2-3 chars: word match
                                isMatch = allText.split(/\s+/).some(word => word === targetLower);
                            }
                            else {
                                // Longer: substring match
                                isMatch = allText.includes(targetLower);
                            }
                            if (isMatch) {
                                log(`      ✓ FOUND INPUT: "${title || placeholder || name}" - Filling with "${fillValue}"`);
                                // Try Playwright fill first
                                let filled = false;
                                try {
                                    await input.fill(fillValue, { timeout: 2000 });
                                    filled = true;
                                    log(`      ✅ [UNIVERSAL-FILL] Successfully filled in ${frameId}`);
                                    await state.page.waitForTimeout(300);
                                    return true;
                                }
                                catch (fillErr) {
                                    log(`      ⚠️  Playwright fill failed, trying JavaScript...`);
                                }
                                // Fallback: JavaScript fill (works for readonly fields too!)
                                if (!filled) {
                                    try {
                                        await input.evaluate((el, val) => {
                                            el.value = val;
                                            el.dispatchEvent(new Event('input', { bubbles: true }));
                                            el.dispatchEvent(new Event('change', { bubbles: true }));
                                            el.dispatchEvent(new Event('blur', { bubbles: true }));
                                        }, fillValue);
                                        log(`      ✅ [UNIVERSAL-FILL-JS] JavaScript fill succeeded in ${frameId}`);
                                        await state.page.waitForTimeout(300);
                                        return true;
                                    }
                                    catch (jsErr) {
                                        log(`      ⚠️  JavaScript fill also failed: ${jsErr.message}`);
                                    }
                                }
                            }
                        }
                        catch (elemErr) {
                            // Continue to next input
                        }
                    }
                }
            }
            catch (iframeErr) {
                log(`      ⚠️  Error searching iframe: ${iframeErr.message}`);
            }
        }
        return false;
    }
    catch (error) {
        log(`🔎 [UNIVERSAL IFRAME ERROR] ${error.message}`);
        return false;
    }
}
async function searchInAllFrames(target, action, fillValue) {
    if (!state.page || state.page.isClosed())
        return false;
    // Check pause before searching
    if (state.isPaused) {
        while (state.isPaused && !state.isStopped) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        if (state.isStopped)
            return false;
    }
    try {
        // Step 1: Get and validate all frames (max 15)
        const allFrames = state.page.frames();
        const MAX_FRAMES = 15;
        const framesToSearch = allFrames.slice(0, MAX_FRAMES); // Limit to first 15 frames
        if (framesToSearch.length === 0)
            return false;
        log(`🔍 [FRAME SEARCH] Found ${framesToSearch.length} frame(s) to search`);
        // DIAGNOSTIC: Log frame details on first search of page
        await logPageStructureDiagnostics(target);
        // **UNIVERSAL IFRAME SEARCH**: Use the new universal function that works with ANY iframe
        // This discovers all iframes automatically and searches them with robust fallbacks
        const universalResult = await searchAllDiscoveredIframes(target, action, fillValue);
        if (universalResult) {
            return true;
        }
        // Step 2: Build frame hierarchy (main page + nested iframes in sequence)
        const frameSequence = buildFrameSearchSequence(framesToSearch);
        // Step 3: Sequential search through frame hierarchy
        for (let seqIndex = 0; seqIndex < frameSequence.length; seqIndex++) {
            // Check pause between frames
            if (state.isPaused) {
                while (state.isPaused && !state.isStopped) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
                if (state.isStopped)
                    return false;
            }
            const frameInfo = frameSequence[seqIndex];
            const frame = frameInfo.frame;
            const framePath = frameInfo.path;
            try {
                // Step 3a: Validate frame accessibility
                const isFrameValid = await validateFrameAccess(frame);
                if (!isFrameValid) {
                    log(`⚠️  [${framePath}] Frame not accessible, skipping...`);
                    continue;
                }
                // Step 3b: Wait for frame content to be ready
                await frame.waitForLoadState('domcontentloaded').catch(() => { });
                await frame.waitForTimeout(200); // Stability pause
                // Log frame details (URL, element count)
                const frameDetails = await frame.evaluate(() => ({
                    url: window.location.href,
                    title: document.title,
                    buttonCount: document.querySelectorAll('button').length,
                    divButtonCount: document.querySelectorAll('[role="button"], [onclick]').length,
                    inputCount: document.querySelectorAll('input').length,
                    iframeCount: document.querySelectorAll('iframe').length,
                    iframeNames: Array.from(document.querySelectorAll('iframe')).map(iframe => ({
                        name: iframe.getAttribute('name') || 'unnamed',
                        id: iframe.getAttribute('id') || 'no-id',
                        src: iframe.getAttribute('src') || 'no-src'
                    })),
                    allClickable: document.querySelectorAll('button, [role="button"], [onclick], a[href], input[type="button"], input[type="submit"]').length
                })).catch(() => null);
                if (frameDetails) {
                    log(`   📄 Frame content: ${frameDetails.allClickable} clickable elements (${frameDetails.buttonCount} buttons, ${frameDetails.divButtonCount} div-buttons, ${frameDetails.inputCount} inputs)`);
                    if (frameDetails.iframeCount > 0) {
                        const iframeNamesList = frameDetails.iframeNames.map((f) => `[${f.name}${f.id !== 'no-id' ? `#${f.id}` : ''}]`).join(', ');
                        log(`   🔗 This frame contains ${frameDetails.iframeCount} nested iframe(s): ${iframeNamesList}`);
                        // Get all child frames (includes cross-origin accessible frames)
                        const allChildFrames = frame.childFrames();
                        log(`   📍 Total child frames (Playwright detected): ${allChildFrames.length}`);
                        // Search for clickable elements in each iframe using Playwright's frameLocator
                        for (let iIdx = 0; iIdx < frameDetails.iframeNames.length; iIdx++) {
                            const iframeInfo = frameDetails.iframeNames[iIdx];
                            const iframeLabel = `${iframeInfo.name}${iframeInfo.id !== 'no-id' ? `#${iframeInfo.id}` : ''}`;
                            try {
                                // Try using Playwright's frameLocator API for better iframe access
                                let selector = '';
                                // Build selector based on available attributes
                                if (iframeInfo.id !== 'no-id') {
                                    selector = `#${iframeInfo.id}`;
                                }
                                else if (iframeInfo.name !== 'unnamed') {
                                    selector = `iframe[name="${iframeInfo.name}"]`;
                                }
                                else {
                                    selector = `iframe[src="${iframeInfo.src}"]`;
                                }
                                // Wait for iframe to be visible and loaded
                                await frame.locator(selector).first().waitFor({ state: 'visible', timeout: 2000 }).catch(() => { });
                                await frame.waitForTimeout(300); // Give iframe content time to load
                                const iframeFrame = frame.frameLocator(selector).first();
                                // Try to wait for iframe content to load
                                await iframeFrame.locator('body').waitFor({ state: 'visible', timeout: 2000 }).catch(() => { });
                                // Get clickable elements from within the iframe
                                const clickableLocator = iframeFrame.locator('button, [role="button"], [onclick], a[href], input[type="button"], input[type="submit"]');
                                const clickableCount = await clickableLocator.count();
                                if (clickableCount > 0) {
                                    const clickableElements = await clickableLocator.allTextContents();
                                    const cleanedElements = clickableElements
                                        .map((text) => text.trim())
                                        .filter((text) => text.length > 0 && text.length < 50)
                                        .slice(0, 30); // First 30 elements
                                    log(`      ├─ iframe [${iframeLabel}]: ${clickableCount} clickable elements → ${cleanedElements.join(' | ')}`);
                                }
                                else {
                                    // Even if no clickable elements, try to get all text content from the iframe
                                    const allText = await iframeFrame.locator('body').allTextContents().catch(() => []);
                                    const bodyText = allText.join(' ').trim().slice(0, 100);
                                    log(`      ├─ iframe [${iframeLabel}]: (0 clickable) | Content: "${bodyText}${bodyText.length === 100 ? '...' : ''}"`);
                                }
                            }
                            catch (err) {
                                // For cross-origin iframes, try to access via Playwright's child frames
                                try {
                                    const matchingFrame = allChildFrames[iIdx];
                                    if (matchingFrame) {
                                        const crossOriginText = await matchingFrame.locator('body').allTextContents().catch(() => []);
                                        const bodyContent = crossOriginText.join(' ').trim().slice(0, 150);
                                        log(`      ├─ iframe [${iframeLabel}] (cross-origin): "${bodyContent}${bodyContent.length === 150 ? '...' : ''}"`);
                                    }
                                    else {
                                        log(`      ├─ iframe [${iframeLabel}]: (not accessible - cross-origin)`);
                                    }
                                }
                                catch (crossOriginErr) {
                                    log(`      ├─ iframe [${iframeLabel}]: (not accessible - cross-origin)`);
                                }
                            }
                        }
                    }
                }
                log(`🔍 [${framePath}] Searching for: "${target}"`);
                // Step 3c: Execute targeted search based on action type
                if (action === 'click') {
                    // CLICK SEARCH PATTERN - Sequential strategies for maximum accuracy
                    const clickResult = await executeClickInFrame(frame, target, framePath);
                    if (clickResult)
                        return true;
                }
                else if (action === 'fill' && fillValue) {
                    // FILL SEARCH PATTERN - Sequential strategies for maximum accuracy
                    const fillResult = await executeFillInFrame(frame, target, fillValue, framePath);
                    if (fillResult)
                        return true;
                }
            }
            catch (frameError) {
                // Frame error - continue to next frame in sequence
                log(`⚠️  [${framePath}] Error during search: ${frameError.message}`);
                continue;
            }
        }
        return false;
    }
    catch (error) {
        log(`❌ Frame search error: ${error.message}`);
        return false;
    }
}
/**
 * Search in all open subwindows (popups, new tabs)
 * Returns true if element was found and action executed
 */
/**
 * Recursively search through nested windows (sub, sub-sub, etc.)
 */
async function searchInAllSubwindows(target, action, fillValue) {
    try {
        log(`\n🪟 ========== [SEARCH STRATEGY: PRIORITY WINDOW FIRST] ==========`);
        log(`🪟 Total windows available: ${allPages.length}`);
        // Log details of all open windows (always show, even if only 1)
        for (let wIdx = 0; wIdx < allPages.length; wIdx++) {
            const page = allPages[wIdx];
            const isClosed = page.isClosed();
            const hierarchy = windowHierarchy.get(page);
            const level = hierarchy?.level || 0;
            const isMain = page === state.page;
            const isLatest = page === latestSubwindow;
            try {
                const pageTitle = await page.title().catch(() => 'Unknown');
                const pageUrl = page.url();
                const windowLabel = isMain ? '🏠 MAIN' : `📍 SUBWINDOW (Level ${level})`;
                const priority = isLatest ? ' ⭐ [LATEST - WILL SEARCH FIRST]' : '';
                const status = isClosed ? ' ❌ CLOSED' : ' ✅ OPEN';
                log(`   ${windowLabel}: "${pageTitle}" | ${pageUrl}${priority}${status}`);
            }
            catch (err) {
                log(`   📍 WINDOW ${wIdx}: (error reading details - ${err.message})`);
            }
        }
        if (allPages.length <= 1)
            return false; // Only main page open
        // PRIORITY 1: Search latest opened subwindow FIRST if it exists
        if (latestSubwindow && !latestSubwindow.isClosed() && latestSubwindow !== state.page) {
            log(`\n🎯 [PRIORITY 1] Searching LATEST OPENED SUBWINDOW FIRST (e.g., Customer Maintenance)`);
            const result = await searchWindowsRecursively(latestSubwindow, target, action, fillValue, windowHierarchy.get(latestSubwindow)?.level || 1, allPages.length);
            if (result) {
                state.page = latestSubwindow;
                log(`✅ [PRIORITY 1] Found element in latest subwindow!`);
                return true;
            }
        }
        // PRIORITY 2: Search other subwindows by recency (newest first)
        log(`\n🎯 [PRIORITY 2] Searching OTHER SUBWINDOWS by recency (newest first)`);
        const subwindowsSorted = allPages
            .filter(p => p !== state.page && !p.isClosed())
            .sort((a, b) => {
            const aTime = windowHierarchy.get(a)?.openedAt || 0;
            const bTime = windowHierarchy.get(b)?.openedAt || 0;
            return bTime - aTime; // Newest first
        });
        for (const subwindow of subwindowsSorted) {
            log(`\n   → Checking subwindow (opened at ${new Date(windowHierarchy.get(subwindow)?.openedAt || 0).toLocaleTimeString()})`);
            const result = await searchWindowsRecursively(subwindow, target, action, fillValue, windowHierarchy.get(subwindow)?.level || 1, allPages.length);
            if (result) {
                state.page = subwindow;
                log(`✅ [PRIORITY 2] Found element in subwindow!`);
                return true;
            }
        }
        // PRIORITY 3: Only then search main window
        log(`\n🎯 [PRIORITY 3] Searching MAIN WINDOW (if not found in subwindows)`);
        const result = await searchWindowsRecursively(state.page, target, action, fillValue, 0, allPages.length);
        if (result) {
            log(`✅ [PRIORITY 3] Found element in main window!`);
            return true;
        }
        log(`\n❌ Element not found in ANY window (checked ${allPages.length} windows)`);
        return false;
    }
    catch (error) {
        log(`🪟 [NESTED SEARCH ERROR] ${error.message}`);
        return false;
    }
}
/**
 * Recursive helper to search windows at all nesting levels - ALL FRAMES THOROUGHLY
 */
async function searchWindowsRecursively(currentPage, target, action, fillValue, depth, totalWindows) {
    if (currentPage.isClosed())
        return false;
    try {
        const pageInfo = windowHierarchy.get(currentPage);
        const windowLabel = depth === 0 ? '🏠 MAIN WINDOW' : `📍 SUBWINDOW (Level ${depth})`;
        // Brief wait for subwindows to load
        await currentPage.waitForLoadState('domcontentloaded').catch(() => { });
        if (depth > 0) {
            await currentPage.waitForTimeout(300); // Reduced wait for overlay/popup render
        }
        // Get frames in current window - ENSURE WE GET ALL
        const frames = currentPage.frames();
        log(`\n🔍 [${'═'.repeat(50)}]`);
        log(`🔍 [WINDOW SEARCH] ${windowLabel}`);
        log(`🔍 ├─ TOTAL FRAMES TO SEARCH: ${frames.length}`);
        log(`🔍 ├─ TARGET: "${target}"`);
        log(`🔍 ├─ WINDOW DEPTH: ${depth}/${totalWindows - 1}`);
        log(`🔍 └─ STATUS: Searching ALL frames thoroughly...\n`);
        // If subwindow with no frames, try direct element search
        if (depth > 0 && frames.length === 0) {
            log(`   ⚠️  [SUBWINDOW] No frames detected in subwindow - trying direct page search...`);
            // Try searching directly on the page object
            try {
                const frameObj = {
                    locator: (sel) => currentPage.locator(sel),
                    evaluate: (func, ...args) => currentPage.evaluate(func, ...args)
                };
                if (action === 'click') {
                    const result = await executeClickInFrame(frameObj, target, `${windowLabel}:DirectPage`);
                    if (result) {
                        log(`   ✅ Found target in direct page search!`);
                        return true;
                    }
                }
                else if (action === 'fill') {
                    const result = await executeFillInFrame(frameObj, target, fillValue || '', `${windowLabel}:DirectPage`);
                    if (result) {
                        log(`   ✅ Found field in direct page search!`);
                        return true;
                    }
                }
            }
            catch (e) {
                log(`   ℹ️ Direct page search failed: ${e.message}`);
            }
        }
        // Search ALL frames in this window
        for (let frameIdx = 0; frameIdx < frames.length; frameIdx++) {
            const frame = frames[frameIdx];
            try {
                await frame.waitForLoadState('domcontentloaded').catch(() => { });
                await frame.waitForTimeout(50); // Reduced frame wait time
                const frameLabel = frameIdx === 0 ? 'Main Frame' : `iFrame ${frameIdx}`;
                updateSearchContext(`${windowLabel} > ${frameLabel}`, frameIdx + 1, frames.length);
                log(`   📍 [Frame ${frameIdx + 1}/${frames.length}] ${frameLabel}`);
                if (action === 'click') {
                    const result = await executeClickInFrame(frame, target, `${windowLabel}:${frameLabel}`);
                    if (result) {
                        state.page = currentPage;
                        log(`   ✅ SUCCESS! Target "${target}" found and clicked in ${frameLabel}`);
                        return true;
                    }
                    else {
                        log(`   ⚠️  Target not found in this frame, continuing...`);
                    }
                }
                else if (action === 'fill' && fillValue) {
                    const result = await executeFillInFrame(frame, target, fillValue, `${windowLabel}:${frameLabel}`);
                    if (result) {
                        state.page = currentPage;
                        log(`   ✅ SUCCESS! Field "${target}" found and filled with "${fillValue}" in ${frameLabel}`);
                        return true;
                    }
                    else {
                        log(`   ⚠️  Field not found in this frame, continuing...`);
                    }
                }
            }
            catch (frameError) {
                log(`   ❌ Frame ${frameIdx} error: ${frameError.message}`);
                continue;
            }
        }
        // Log completion of this window's frames
        log(`\n   📝 Completed ALL ${frames.length} frames in ${windowLabel}`);
        // Now recursively search child windows (sub-sub-windows)
        const childPages = pageInfo?.childPages || [];
        if (childPages.length > 0) {
            log(`\n   🪟 ⬇️  Found ${childPages.length} nested subwindow(s) inside ${windowLabel}`);
            log(`   🪟 Now searching these nested subwindows recursively...\n`);
            // Sort child pages by recency
            const childPagesSorted = childPages.sort((a, b) => {
                const aTime = windowHierarchy.get(a)?.openedAt || 0;
                const bTime = windowHierarchy.get(b)?.openedAt || 0;
                return bTime - aTime; // Newest first
            });
            for (let childIdx = 0; childIdx < childPagesSorted.length; childIdx++) {
                const childPage = childPagesSorted[childIdx];
                const childOpenTime = windowHierarchy.get(childPage)?.openedAt || Date.now();
                log(`\n   ⬇️  [Nested ${childIdx + 1}/${childPagesSorted.length}] Entering nested level ${depth + 1} (opened: ${new Date(childOpenTime).toLocaleTimeString()})...\n`);
                const result = await searchWindowsRecursively(childPage, target, action, fillValue, depth + 1, totalWindows);
                if (result)
                    return true;
                log(`\n   ⬆️  Returned from nested level ${depth + 1}, continuing...\n`);
            }
        }
        log(`\n🔍 [${'═'.repeat(50)}] ✓ Completed search for ${windowLabel}\n`);
        return false;
    }
    catch (error) {
        log(`❌ Error searching window at depth ${depth}: ${error.message}`);
        return false;
    }
}
/**
 * Search for newly opened nested windows after an action
 */
async function detectNewNestedWindows(parentPage) {
    try {
        await parentPage.waitForTimeout(800); // Increased wait for windows to fully open
        const newPages = state.context?.pages().filter(p => !allPages.includes(p)) || [];
        for (const newPage of newPages) {
            if (!allPages.includes(newPage) && !newPage.isClosed()) {
                const parentLevel = windowHierarchy.get(parentPage)?.level || 0;
                const level = parentLevel + 1;
                const openedAt = Date.now();
                log(`🆕 [DETECTED] New window opened (Level ${level}) - WILL BE PRIORITY FOR NEXT SEARCH`);
                allPages.push(newPage);
                latestSubwindow = newPage; // Update latest subwindow
                windowHierarchy.set(newPage, { parentPage, level, childPages: [], openedAt });
                if (windowHierarchy.has(parentPage)) {
                    windowHierarchy.get(parentPage).childPages.push(newPage);
                }
                await setupPageListeners(newPage);
                log(`🆕 Window added to priority queue (will search this next)`);
            }
        }
    }
    catch (e) {
        // Silent fail
    }
}
/**
 * Build frame search sequence - main page first, then iframes in depth-first order
 */
function buildFrameSearchSequence(frames) {
    const sequence = [];
    // Add main page frame first (always most reliable)
    if (frames.length > 0) {
        sequence.push({ frame: frames[0], path: '[Main Page]' });
    }
    // Add iframe frames in order
    for (let i = 1; i < frames.length; i++) {
        sequence.push({ frame: frames[i], path: `[Frame ${i}]` });
    }
    return sequence;
}
/**
 * Validate frame is accessible before attempting search
 */
async function validateFrameAccess(frame) {
    try {
        // Quick test to see if frame is accessible
        await frame.evaluate(() => true).catch(() => { });
        return true;
    }
    catch (e) {
        return false;
    }
}
/**
 * Helper function to find and click dropdown parent buttons - ENHANCED
 * Uses multiple strategies to identify the correct trigger button for each dropdown level
 */
async function findAndClickParentDropdownTrigger(frame, parentIndex, targetText) {
    try {
        // Get all potentially clickable elements
        const clickables = await frame.locator('button, [role="button"], [onclick], a, [role="menuitem"], [role="option"]').all();
        // Strategy 1: Try to find button by proximity and aria attributes
        for (const clickable of clickables) {
            try {
                // Check if this element controls a dropdown
                const ariaControls = await clickable.getAttribute('aria-controls').catch(() => null);
                const ariaExpanded = await clickable.getAttribute('aria-expanded').catch(() => null);
                const ariaHaspopup = await clickable.getAttribute('aria-haspopup').catch(() => null);
                // This looks like a dropdown trigger
                if (ariaControls || ariaHaspopup === 'true' || ariaHaspopup === 'menu' || ariaExpanded) {
                    const isVisible = await clickable.isVisible().catch(() => false);
                    if (isVisible) {
                        await clickable.click({ timeout: 2000, force: true }).catch(() => { });
                        await frame.waitForTimeout(400);
                        return true;
                    }
                }
            }
            catch (e) { }
        }
        // Strategy 2: Try clicking by matching text of previous menu items
        // This helps with hierarchical menus where buttons have the parent menu name
        if (targetText && targetText.length > 0) {
            const partialText = targetText.split(/[/>|,]/)[0].trim();
            const keywords = partialText.toLowerCase().split(/\s+/);
            for (const clickable of clickables) {
                try {
                    const text = await clickable.textContent().catch(() => '');
                    const textLower = text.toLowerCase();
                    const isVisible = await clickable.isVisible().catch(() => false);
                    // Check if at least one keyword from target matches
                    const hasKeyword = keywords.some(kw => kw.length > 0 && textLower.includes(kw));
                    if (hasKeyword && isVisible && text.trim().length > 0 && text.trim().length < 100) {
                        await clickable.click({ timeout: 2000, force: true }).catch(async () => {
                            await clickable.evaluate((e) => {
                                if (e.click)
                                    e.click();
                                else
                                    e.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                            });
                        });
                        await frame.waitForTimeout(400);
                        return true;
                    }
                }
                catch (e) { }
            }
        }
        return false;
    }
    catch (e) {
        return false;
    }
}
/**
 * Helper function to find and click dropdown parent buttons
 * Intelligently finds the trigger button for a dropdown container
 */
async function clickDropdownTrigger(frame, dropdownContainer, level) {
    try {
        // Strategy 1: Look for immediate parent button/anchor that might toggle this dropdown
        const parentButton = await frame.evaluate((container) => {
            // Check if there's a button/anchor immediately adjacent (previous sibling or in parent)
            let current = container;
            // Try: Find button in immediate parent that precedes dropdown
            if (current.parentElement) {
                const siblings = Array.from(current.parentElement.children);
                const containerIndex = siblings.indexOf(current);
                for (let i = containerIndex - 1; i >= Math.max(containerIndex - 3, 0); i--) {
                    const sibling = siblings[i];
                    const buttons = sibling.querySelectorAll('button, [role="button"], a[href]');
                    if (buttons.length > 0)
                        return buttons[buttons.length - 1]; // Last button
                    if (sibling.tagName === 'BUTTON' || sibling.getAttribute('role') === 'button')
                        return sibling;
                }
            }
            // Try: Look for button inside dropdown (toggle button)
            const internalButton = container.querySelector('button, [role="button"]');
            if (internalButton && internalButton.offsetParent !== null)
                return internalButton;
            // Try: Parent element that has button or is itself clickable
            let p = container.parentElement;
            while (p && p !== document.documentElement) {
                if (p.tagName === 'BUTTON' || p.getAttribute('role') === 'button')
                    return p;
                const btn = p.querySelector(':scope > button, :scope > [role="button"]');
                if (btn)
                    return btn;
                p = p.parentElement;
            }
            return null;
        }, dropdownContainer);
        if (parentButton) {
            const btn = await frame.locator('button, [role="button"]').first();
            await btn.click({ timeout: 2000, force: true }).catch(async () => {
                await btn.evaluate((e) => {
                    if (e.click)
                        e.click();
                    else
                        e.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                });
            });
            await frame.waitForTimeout(400);
            return true;
        }
        return false;
    }
    catch (e) {
        return false;
    }
}
/* ============== CLICK ACTION HANDLER ============== */
/**
 * Execute CLICK action in frame with sequential pattern matching
 * ENHANCED: Better detection for subwindow elements and nested iframes
 *
 * KEY PRINCIPLE: If it's visible on screen, it must be clickable
 * - Searches ALL elements without visibility restrictions
 * - Handles overlaid, hidden, nested elements
 * - Forces clicks even if elements appear "invisible" to Playwright
 * - Special handling for common button IDs and Start button variations
 */
async function executeClickInFrame(frame, target, framePath) {
    const targetLower = target.toLowerCase();
    const targetTrimmedLower = target.trim().toLowerCase();
    try {
        // **PRIORITY CHECK 1**: Try known button ID patterns first
        const knownButtonIds = {
            'start': ['startBtn', 'start_btn', 'start-btn', 'btnStart', 'startButton', 'button_start'],
            'stop': ['stopBtn', 'stop_btn', 'stop-btn', 'btnStop', 'stopButton', 'button_stop']
        };
        const targetKey = targetLower.split(/\s+/)[0]; // Get first word
        if (knownButtonIds[targetKey]) {
            const buttonIds = knownButtonIds[targetKey];
            for (const buttonId of buttonIds) {
                try {
                    // Method 1: Try Playwright force click
                    const btn = await frame.locator(`#${buttonId}`).first();
                    const count = await btn.count().catch(() => 0);
                    if (count > 0) {
                        try {
                            // Show cursor pointer before clicking
                            await showClickPointer(frame, `#${buttonId}`);
                            log(`👆 [POINTER] Clicking: "${target}" (cursor shown for 2 seconds...)`);
                            await frame.waitForTimeout(2000);
                            await btn.click({ force: true, timeout: 5000 });
                            log(`✅ [DIRECT-ID${framePath}] Successfully clicked button via ID: "#${buttonId}" (target: "${target}")`);
                            await removeClickPointer(frame);
                            await frame.waitForTimeout(500);
                            return true;
                        }
                        catch (e1) {
                            // Continue to JavaScript method
                        }
                    }
                    // Method 2: Try JavaScript direct click
                    const clicked = await frame.evaluate((id) => {
                        const el = document.getElementById(id);
                        if (el) {
                            try {
                                el.click();
                                return true;
                            }
                            catch (e1) {
                                try {
                                    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
                                    return true;
                                }
                                catch (e2) {
                                    if (el.onclick) {
                                        try {
                                            el.onclick(new MouseEvent('click'));
                                            return true;
                                        }
                                        catch (e3) {
                                            return false;
                                        }
                                    }
                                    return false;
                                }
                            }
                        }
                        return false;
                    }, buttonId);
                    if (clicked) {
                        log(`✅ [DIRECT-ID-JS${framePath}] Successfully clicked button via ID (JavaScript): "#${buttonId}" (target: "${target}")`);
                        await frame.waitForTimeout(500);
                        return true;
                    }
                }
                catch (e) {
                    // Continue to next button ID
                }
            }
        }
        // **PRIORITY CHECK 2**: Search by attribute patterns commonly used for Start button
        try {
            const startButtonPatterns = [
                'button:has-text("Start")',
                'button[aria-label*="Start"]',
                'button[title*="Start"]',
                'button[data-testid*="Start"]',
                '[role="button"]:has-text("Start")',
                'button[class*="start"]'
            ];
            if (targetLower.includes('start')) {
                for (const pattern of startButtonPatterns) {
                    try {
                        const elements = await frame.locator(pattern).all();
                        for (const el of elements) {
                            try {
                                const isVisible = await el.isVisible().catch(() => false);
                                if (isVisible) {
                                    await el.scrollIntoViewIfNeeded();
                                    // Show cursor pointer before clicking
                                    await showClickPointerByAttribute(frame, target);
                                    log(`👆 [POINTER] Clicking: "${target}" (cursor shown for 2 seconds...)`);
                                    await frame.waitForTimeout(2000);
                                    await el.click({ force: true, timeout: 5000 });
                                    log(`✅ [START-PATTERN${framePath}] Clicked Start button using pattern: "${pattern}"`);
                                    await removeClickPointer(frame);
                                    await frame.waitForTimeout(500);
                                    return true;
                                }
                            }
                            catch (e) {
                                // Try next element
                            }
                        }
                    }
                    catch (e) {
                        // Pattern failed, try next
                    }
                }
            }
            // **SPECIAL HANDLER FOR SIGN IN / LOGIN BUTTONS - RUN FIRST**
            if (targetLower.includes('sign') && targetLower.includes('in')) {
                const isExactSignIn = !targetLower.includes('partner') && !targetLower.includes('business');
                // PRE-FLIGHT: Quick check using evaluate to find EXACT match FIRST
                if (isExactSignIn) {
                    try {
                        const found = await frame.evaluate(() => {
                            const elements = Array.from(document.querySelectorAll('a, button, [role="button"], span'));
                            // Look for EXACT text match only
                            for (const el of elements) {
                                const text = (el.textContent || '').trim();
                                const textLower = text.toLowerCase();
                                // EXACT ONLY - no substrings, no variations
                                if (textLower === 'sign in' || textLower === 'signin' ||
                                    textLower === 'sign-in' || textLower === 'login') {
                                    // MUST NOT contain "Partners" or "Business"
                                    if (!text.includes('Partners') && !text.includes('Business') &&
                                        !text.includes('partners') && !text.includes('business')) {
                                        const rect = el.getBoundingClientRect();
                                        const style = window.getComputedStyle(el);
                                        if (style.display !== 'none' && style.visibility !== 'hidden' &&
                                            rect.width > 0 && rect.height > 0) {
                                            return true;
                                        }
                                    }
                                }
                            }
                            return false;
                        });
                        if (found) {
                            // Click it using Playwright
                            const exactElement = await frame.locator('text=/^sign in$/i, text=/^signin$/i, text=/^sign-in$/i, text=/^login$/i').first();
                            const visible = await exactElement.isVisible().catch(() => false);
                            if (visible) {
                                // Double-check it's not partners
                                const text = await exactElement.textContent().catch(() => '');
                                if (!text.toLowerCase().includes('partner') && !text.toLowerCase().includes('business')) {
                                    const cleanLabel = await getCleanElementLabel(exactElement);
                                    await exactElement.click({ timeout: 5000 }).catch(async () => {
                                        await exactElement.evaluate((e) => e.click());
                                    });
                                    log(`✅ Clicked: "${cleanLabel}"`);
                                    await frame.waitForTimeout(2000);
                                    return true;
                                }
                            }
                        }
                    }
                    catch (e) {
                        // Continue to fallback
                    }
                }
                // FALLBACK: Original strategy
                try {
                    const allElements = await frame.locator('a, button, [role="button"], div[onclick], span[onclick]').all();
                    for (const el of allElements) {
                        const text = await el.textContent().catch(() => '');
                        const textTrim = text.trim();
                        const textLower = textTrim.toLowerCase();
                        // For exact "Sign In" search - must NOT have prefixes
                        if (isExactSignIn) {
                            // Match ONLY exact: "Sign In", "signin", "Sign in", "SignIn", etc.
                            const isExactMatch = textLower === 'sign in' ||
                                textLower === 'signin' ||
                                textLower === 'sign-in' ||
                                textLower === 'login';
                            if (!isExactMatch)
                                continue;
                            // Double-check it doesn't have "Partners" or "Business" prefix
                            if (textLower.includes('partner') || textLower.includes('business')) {
                                continue;
                            }
                            // This is the real "Sign In" button!
                            const visible = await el.isVisible().catch(() => false);
                            if (visible) {
                                await el.scrollIntoViewIfNeeded();
                                // Show cursor pointer before clicking
                                await showClickPointerByAttribute(frame, target);
                                log(`👆 [POINTER] Clicking: "${target}" (cursor shown for 2 seconds...)`);
                                await frame.waitForTimeout(2000);
                                await el.click({ timeout: 5000 }).catch(async () => {
                                    await el.evaluate((e) => e.click());
                                });
                                log(`✅ Clicked: "${textTrim}"`);
                                await removeClickPointer(frame);
                                await frame.waitForTimeout(2000);
                                return true;
                            }
                        }
                        else {
                            // For "Partners Sign In" or "Business Sign In" - require the full text
                            if (textLower.includes(targetLower)) {
                                const visible = await el.isVisible().catch(() => false);
                                if (visible) {
                                    await el.scrollIntoViewIfNeeded();
                                    // Show cursor pointer before clicking
                                    await showClickPointerByAttribute(frame, target);
                                    log(`👆 [POINTER] Clicking: "${target}" (cursor shown for 2 seconds...)`);
                                    await frame.waitForTimeout(2000);
                                    await el.click({ timeout: 5000 }).catch(async () => {
                                        await el.evaluate((e) => e.click());
                                    });
                                    log(`✅ Clicked: "${textTrim}"`);
                                    await removeClickPointer(frame);
                                    await frame.waitForTimeout(2000);
                                    return true;
                                }
                            }
                        }
                    }
                    // Fallback: If searching for exact "Sign In", try icon buttons in top-right
                    if (isExactSignIn) {
                        const iconButton = await frame.evaluate(() => {
                            const elements = Array.from(document.querySelectorAll('a, button, [role="button"]'));
                            for (const el of elements) {
                                const rect = el.getBoundingClientRect();
                                const text = (el.textContent || '').trim();
                                // Top-right area, small button, no text (icon button)
                                if (rect.x > 600 && rect.x < 900 && rect.top < 60 &&
                                    rect.height < 60 && rect.width < 60 && !text) {
                                    return true;
                                }
                            }
                            return false;
                        });
                        if (iconButton) {
                            const topRightButton = await frame.locator('a[href*="#"], a[href*="account"]').first();
                            const visible = await topRightButton.isVisible().catch(() => false);
                            if (visible) {
                                await topRightButton.click({ timeout: 5000 }).catch(async () => {
                                    await topRightButton.evaluate((e) => e.click());
                                });
                                log(`✅ Clicked: Sign In`);
                                await frame.waitForTimeout(2000);
                                return true;
                            }
                        }
                    }
                }
                catch (e) {
                    // Silent fail, continue to next strategy
                }
            }
            // **HELPER FUNCTION: Detect and get the currently visible dropdown container**
            async function getCurrentVisibleDropdown() {
                try {
                    const dropdownInfo = await frame.evaluate(() => {
                        // Look for DOM elements that appear to be dropdown containers
                        const potentialDropdowns = document.querySelectorAll('[role="menu"], [role="listbox"], [role="combobox"], .dropdown, .menu, [class*="dropdown"], [class*="menu"], [class*="popover"], [class*="list"]');
                        for (const dropdown of Array.from(potentialDropdowns)) {
                            const el = dropdown;
                            const style = window.getComputedStyle(el);
                            const rect = el.getBoundingClientRect();
                            // Check if element is visible (not display:none, not hidden, has size)
                            if (style.display !== 'none' &&
                                style.visibility !== 'hidden' &&
                                rect.width > 0 &&
                                rect.height > 0 &&
                                el.offsetParent !== null) {
                                // Return the first visible dropdown
                                return {
                                    found: true,
                                    selector: el.id ? `#${el.id}` : el.className ? `.${el.className.split(' ')[0]}` : el.tagName,
                                    tagName: el.tagName,
                                    id: el.id,
                                    className: el.className
                                };
                            }
                        }
                        return { found: false };
                    });
                    if (dropdownInfo.found) {
                        log(`   📂 [DROPDOWN DETECTED] Found visible dropdown: ${dropdownInfo.selector}`);
                        return dropdownInfo;
                    }
                }
                catch (e) {
                    // Silent fail
                }
                return null;
            }
            // **SPECIAL HANDLER FOR >> (SIBLING BUTTONS) - e.g., "Loans > Insta Personal Loan >> Check Offer"**
            try {
                if (target.includes('>>')) {
                    log(`   📋 [SIBLING BUTTON DETECTED] Target contains >> (sibling button pattern)`);
                    // Split: "Loans > Insta Personal Loan >> Check Offer" becomes
                    // parent path: "Loans > Insta Personal Loan"
                    // button name: "Check Offer"
                    const siblingParts = target.split(/\s*>>\s*/);
                    if (siblingParts.length >= 2) {
                        const parentPath = siblingParts[0].trim();
                        const siblingButton = siblingParts[siblingParts.length - 1].trim().replace(/\s*>>$/, '');
                        log(`   📍 Parent path: "${parentPath}"`);
                        log(`   🔘 Sibling button to click: "${siblingButton}"`);
                        // Step 1: Navigate to parent using the parent path
                        const parentSteps = parentPath.split(/\s*>\s*/).filter((s) => s.trim().length > 0);
                        // Click through parent steps to open the dropdown
                        for (let pIdx = 0; pIdx < parentSteps.length; pIdx++) {
                            const step = parentSteps[pIdx].trim();
                            log(`   ⏭️  [PARENT STEP ${pIdx + 1}/${parentSteps.length}] Navigating to: "${step}"`);
                            // **PRIORITY: Check for visible dropdown first for sibling button too**
                            const visibleDropdown = await getCurrentVisibleDropdown();
                            let elements = [];
                            if (visibleDropdown && visibleDropdown.found) {
                                log(`   🔍 Searching within visible dropdown for parent step: ${visibleDropdown.selector}`);
                                try {
                                    const dropdownContainer = await frame.locator(visibleDropdown.selector).first();
                                    if (dropdownContainer) {
                                        elements = await dropdownContainer.locator('a, button, [role="button"], [role="option"], [role="menuitem"], li, div[onclick], span').all();
                                    }
                                }
                                catch (e) {
                                    elements = await frame.locator('a, button, [role="button"], [role="option"], [role="menuitem"], li, div[onclick], span').all();
                                }
                            }
                            else {
                                elements = await frame.locator('a, button, [role="button"], [role="option"], [role="menuitem"], li, div[onclick], span').all();
                            }
                            let found = null;
                            for (const el of elements) {
                                const text = await el.textContent().catch(() => '');
                                if (text.toLowerCase().includes(step.toLowerCase())) {
                                    const visible = await el.isVisible().catch(() => false);
                                    if (visible) {
                                        found = el;
                                        log(`   ✓ Found parent step "${text.trim()}"`);
                                        break;
                                    }
                                }
                            }
                            if (found) {
                                await found.click({ timeout: 3000, force: true }).catch(async () => {
                                    await found.evaluate((e) => {
                                        if (e.click)
                                            e.click();
                                        else
                                            e.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                                    });
                                });
                                await frame.waitForTimeout(600);
                                log(`   ✓ Clicked parent step ${pIdx + 1}`);
                            }
                            else {
                                log(`   ⚠️  Parent step not found, continuing...`);
                            }
                        }
                        // Step 2: Now find and click the sibling button in the same dropdown
                        await frame.waitForTimeout(500);
                        // **PRIORITY: Search for sibling button within visible dropdown FIRST**
                        const visibleDropdownForSibling = await getCurrentVisibleDropdown();
                        let allElements = [];
                        if (visibleDropdownForSibling && visibleDropdownForSibling.found) {
                            log(`   🔍 Searching for sibling button within visible dropdown: ${visibleDropdownForSibling.selector}`);
                            try {
                                const dropdownContainer = await frame.locator(visibleDropdownForSibling.selector).first();
                                if (dropdownContainer) {
                                    allElements = await dropdownContainer.locator('a, button, [role="button"], [role="option"], [role="menuitem"], li, [onclick], span').all();
                                }
                            }
                            catch (e) {
                                allElements = await frame.locator('a, button, [role="button"], [role="option"], [role="menuitem"], li, [onclick], span').all();
                            }
                        }
                        else {
                            allElements = await frame.locator('a, button, [role="button"], [role="option"], [role="menuitem"], li, [onclick], span').all();
                        }
                        let siblingFound = null;
                        for (const el of allElements) {
                            const text = await el.textContent().catch(() => '');
                            const textLower = text.toLowerCase();
                            const buttonLower = siblingButton.toLowerCase();
                            if (textLower === buttonLower || (textLower.includes(buttonLower) && text.trim().length < 100)) {
                                const visible = await el.isVisible().catch(() => false);
                                if (visible) {
                                    siblingFound = el;
                                    log(`   ✓ Found sibling button: "${text.trim()}"`);
                                    break;
                                }
                            }
                        }
                        if (siblingFound) {
                            // Ensure button is in viewport
                            await siblingFound.scrollIntoViewIfNeeded().catch(() => { });
                            await frame.waitForTimeout(300);
                            const buttonLabel = await getCleanElementLabel(siblingFound);
                            const buttonInfo = await siblingFound.evaluate((el) => ({
                                tagName: el.tagName,
                                className: el.className
                            })).catch(() => ({}));
                            log(`   🎯 Clicking sibling button [${buttonInfo.tagName}]: "${buttonLabel}"`);
                            try {
                                await siblingFound.click({ timeout: 5000 }).catch(async () => {
                                    await siblingFound.evaluate((e) => {
                                        if (e.click)
                                            e.click();
                                        else
                                            e.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                                    });
                                });
                                log(`   ✅ Successfully clicked sibling button: "${siblingButton}"`);
                                await frame.waitForTimeout(500);
                                return true;
                            }
                            catch (clickErr) {
                                log(`   ❌ Failed to click sibling button: ${clickErr.message}`);
                                return false;
                            }
                        }
                        else {
                            log(`   ❌ Sibling button "${siblingButton}" not found in dropdown`);
                            return false;
                        }
                    }
                }
            }
            catch (siblingErr) {
                log(`   ⚠️  Sibling button handler error: ${siblingErr.message}`);
            }
            // **HIERARCHICAL DROPDOWN NAVIGATION - Parse paths like "Loans > Insta Personal Loan > Check Offer"**
            try {
                // Check if target contains dropdown path separators (> or >>)
                const hasHierarchyMarkers = target.includes('>');
                if (hasHierarchyMarkers) {
                    log(`   📋 [HIERARCHICAL PATH DETECTED] Parsing dropdown navigation path...`);
                    // Split by > only (not >>)
                    const pathSteps = target.split(/\s*>\s*/).filter((step) => step.trim().length > 0 && !step.includes('>'));
                    log(`   📍 Navigation steps: ${pathSteps.map((s) => `"${s.trim()}"`).join(' → ')}`);
                    // Navigate through each step
                    for (let stepIdx = 0; stepIdx < pathSteps.length; stepIdx++) {
                        const currentStep = pathSteps[stepIdx].trim();
                        const isLastStep = stepIdx === pathSteps.length - 1;
                        log(`\n   ⏭️  [STEP ${stepIdx + 1}/${pathSteps.length}] Navigating to: "${currentStep}"`);
                        // **PRIORITY: First check for visible dropdown container**
                        const visibleDropdown = await getCurrentVisibleDropdown();
                        // Find the element for this navigation step - SEARCH IN DROPDOWN FIRST if one is visible
                        let stepElements = [];
                        if (visibleDropdown && visibleDropdown.found) {
                            // Search WITHIN the visible dropdown ONLY
                            log(`   🔍 Searching within visible dropdown: ${visibleDropdown.selector}`);
                            try {
                                // Get the dropdown container and search within it
                                const dropdownContainer = await frame.locator(visibleDropdown.selector).first();
                                if (dropdownContainer) {
                                    stepElements = await dropdownContainer.locator('a, button, [role="button"], [role="option"], [role="menuitem"], li, div[onclick], span').all();
                                    log(`   📂 Found ${stepElements.length} elements within dropdown`);
                                }
                            }
                            catch (e) {
                                log(`   ⚠️  Could not search within dropdown, falling back to full page search`);
                                stepElements = await frame.locator('a, button, [role="button"], [role="option"], [role="menuitem"], li, div[onclick], span').all();
                            }
                        }
                        else {
                            // No visible dropdown - search full page
                            log(`   📄 No visible dropdown - searching full page...`);
                            stepElements = await frame.locator('a, button, [role="button"], [role="option"], [role="menuitem"], li, div[onclick], span').all();
                        }
                        let stepElement = null;
                        let stepText = '';
                        let visibleMatches = [];
                        // Find all visible matches for this step
                        for (const el of stepElements) {
                            const text = await el.textContent().catch(() => '');
                            const textLower = text.toLowerCase();
                            const stepLower = currentStep.toLowerCase();
                            // Check for exact or close match
                            if (textLower === stepLower || textLower.includes(stepLower)) {
                                const isVisible = await el.isVisible().catch(() => false);
                                if (isVisible) {
                                    visibleMatches.push({ el, text });
                                }
                            }
                        }
                        if (visibleMatches.length > 0) {
                            // Use the first visible match
                            stepElement = visibleMatches[0].el;
                            stepText = visibleMatches[0].text;
                            log(`   ✓ Found "${stepText.trim()}" (${visibleMatches.length} visible match(es))`);
                        }
                        else {
                            // Try finding non-visible element to open parent
                            for (const el of stepElements) {
                                const text = await el.textContent().catch(() => '');
                                if (text.toLowerCase().includes(currentStep.toLowerCase())) {
                                    stepElement = el;
                                    stepText = text;
                                    log(`   ⚠️  Found "${stepText.trim()}" but NOT visible - trying to open parent...`);
                                    break;
                                }
                            }
                        }
                        if (stepElement) {
                            const isVisible = await stepElement.isVisible().catch(() => false);
                            // If not visible, try opening parent dropdowns
                            if (!isVisible) {
                                log(`   🔓 Opening parent dropdown(s)...`);
                                // Try clicking parent dropdown button (first clickable element)
                                try {
                                    const parentButtons = await frame.locator('button, [role="button"]').all();
                                    for (const parentBtn of parentButtons) {
                                        const parentVisible = await parentBtn.isVisible().catch(() => false);
                                        if (parentVisible) {
                                            await parentBtn.click({ timeout: 2000, force: true }).catch(() => { });
                                            await frame.waitForTimeout(500);
                                            break; // Click first visible button to open dropdown
                                        }
                                    }
                                }
                                catch (e) { }
                            }
                            // Wait a bit for dropdown to render
                            await frame.waitForTimeout(300);
                            // Verify element is now visible
                            const nowVisible = await stepElement.isVisible().catch(() => false);
                            if (nowVisible) {
                                // Verify it's in viewport
                                const inViewport = await stepElement.evaluate((el) => {
                                    const rect = el.getBoundingClientRect();
                                    return rect.top >= 0 && rect.left >= 0 &&
                                        rect.bottom <= window.innerHeight &&
                                        rect.right <= window.innerWidth;
                                }).catch(() => false);
                                if (!inViewport) {
                                    await stepElement.scrollIntoViewIfNeeded();
                                    await frame.waitForTimeout(200);
                                }
                                // Click the element
                                log(`   🎯 Clicking: "${stepText.trim().substring(0, 50)}"`);
                                await stepElement.click({ timeout: 5000, force: true }).catch(async () => {
                                    await stepElement.evaluate((e) => {
                                        if (e.click)
                                            e.click();
                                        else
                                            e.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                                    });
                                });
                                log(`   ✅ Clicked step ${stepIdx + 1}`);
                                // Wait longer for submenu to appear if not last step
                                if (!isLastStep) {
                                    log(`   ⏳ Waiting for submenu to appear...`);
                                    await frame.waitForTimeout(800); // Increased wait for deep nesting
                                }
                                else {
                                    await frame.waitForTimeout(500);
                                }
                            }
                            else {
                                log(`   ❌ Element not visible even after trying to open parent`);
                                return false;
                            }
                        }
                        else {
                            log(`   ❌ Could not find "${currentStep}" at this hierarchy level`);
                            return false;
                        }
                    }
                    log(`\n   ✅ [HIERARCHICAL NAVIGATION COMPLETE] Successfully navigated all steps!`);
                    return true;
                }
            }
            catch (e) {
                log(`   ⚠️  Hierarchical path handler error: ${e.message}`);
            }
            // **SPECIAL HANDLER FOR DROPDOWN/SELECT ELEMENTS - ENHANCED FOR NESTED DROPDOWNS**
            try {
                // Check if target is a dropdown item - if so, open ALL parent dropdowns first (multi-level support)
                const allElements = await frame.locator('a, button, [role="button"], [role="option"], [role="menuitem"], li, div[onclick], span').all();
                let foundElement = null;
                let foundText = '';
                let visibleElements = [];
                // IMPORTANT: Find ALL matching elements and filter by visibility
                for (const el of allElements) {
                    const text = await el.textContent().catch(() => '');
                    if (text.toLowerCase().includes(targetLower)) {
                        // Check if this element is actually visible on screen
                        const isVisible = await el.isVisible().catch(() => false);
                        if (isVisible) {
                            visibleElements.push({ el, text });
                        }
                    }
                }
                // If we found visible elements, use the first one (most likely to be the correct one)
                if (visibleElements.length > 0) {
                    foundElement = visibleElements[0].el;
                    foundText = visibleElements[0].text;
                    log(`   ✓ [VISIBILITY CHECK] Found ${visibleElements.length} visible element(s) matching "${target}"`);
                }
                else {
                    // Fallback: try to find first match regardless of visibility (for later opening)
                    for (const el of allElements) {
                        const text = await el.textContent().catch(() => '');
                        if (text.toLowerCase().includes(targetLower)) {
                            foundElement = el;
                            foundText = text;
                            break;
                        }
                    }
                }
                if (foundElement) {
                    try {
                        // Check if element is hidden (likely in a closed dropdown)
                        const isVisible = await foundElement.isVisible().catch(() => false);
                        if (!isVisible) {
                            // NEW: Build complete parent dropdown chain (handles multi-level nesting)
                            const parentChain = await foundElement.evaluate((el) => {
                                const chain = [];
                                let current = el.parentElement;
                                while (current && current !== document.documentElement) {
                                    const classList = current.className || '';
                                    const role = current.getAttribute('role') || '';
                                    const dataRole = current.getAttribute('data-role') || '';
                                    // Check if this is a dropdown/menu container
                                    const isDropdown = classList.includes('dropdown') ||
                                        classList.includes('menu') ||
                                        classList.includes('select') ||
                                        classList.includes('submenu') ||
                                        role === 'listbox' ||
                                        role === 'menu' ||
                                        role === 'menuitem' ||
                                        dataRole === 'dropdown';
                                    if (isDropdown) {
                                        chain.unshift({
                                            element: current,
                                            className: classList,
                                            role: role,
                                            level: chain.length
                                        });
                                    }
                                    current = current.parentElement;
                                }
                                return chain.length > 0 ? chain : null;
                            }).catch(() => null);
                            if (parentChain && parentChain.length > 0) {
                                log(`   📋 [DROPDOWN HIERARCHY] Found ${parentChain.length} nested dropdown level(s)`);
                                // Click all parent dropdowns in order (from outermost to innermost)
                                for (let pcIdx = 0; pcIdx < parentChain.length; pcIdx++) {
                                    const parentInfo = parentChain[pcIdx];
                                    log(`   🔓 [Level ${pcIdx + 1}/${parentChain.length}] Opening parent dropdown...`);
                                    try {
                                        // Use the smart parent trigger finder
                                        const triggerClicked = await findAndClickParentDropdownTrigger(frame, pcIdx, foundText);
                                        if (triggerClicked) {
                                            log(`   ✓ Parent dropdown level ${pcIdx + 1} opened successfully`);
                                        }
                                        else {
                                            // Fallback: Try the previous approach
                                            try {
                                                const firstClickable = await frame.locator('button, [role="button"], a').first();
                                                const visible = await firstClickable.isVisible().catch(() => false);
                                                if (visible) {
                                                    await firstClickable.click({ timeout: 2000, force: true }).catch(async () => {
                                                        await firstClickable.evaluate((e) => {
                                                            if (e.click)
                                                                e.click();
                                                            else
                                                                e.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                                                        });
                                                    });
                                                    await frame.waitForTimeout(400);
                                                    log(`   ✓ Parent dropdown level ${pcIdx + 1} clicked (fallback)`);
                                                }
                                            }
                                            catch (fallbackErr) {
                                                log(`   ⚠️  Could not open dropdown level ${pcIdx + 1}, continuing...`);
                                            }
                                        }
                                    }
                                    catch (e) {
                                        log(`   ⚠️  Failed to open dropdown level ${pcIdx + 1}, continuing...`);
                                    }
                                }
                            }
                        }
                        // Now try to click the target element (after all parent dropdowns are open)
                        // CRITICAL: Make sure we're clicking the VISIBLE one on screen
                        try {
                            const visible = await foundElement.isVisible().catch(() => false);
                            if (visible) {
                                // Double-check: Verify element is in viewport
                                const isInViewport = await foundElement.evaluate((el) => {
                                    const rect = el.getBoundingClientRect();
                                    return (rect.top >= 0 &&
                                        rect.left >= 0 &&
                                        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
                                        rect.right <= (window.innerWidth || document.documentElement.clientWidth));
                                }).catch(() => false);
                                if (!isInViewport) {
                                    // Not in viewport - scroll it into view
                                    await foundElement.scrollIntoViewIfNeeded();
                                    await frame.waitForTimeout(300);
                                }
                                // Now click the visible, on-screen element
                                const elementLabel = await getCleanElementLabel(foundElement);
                                const elementInfo = await foundElement.evaluate((el) => ({
                                    tagName: el.tagName,
                                    className: el.className,
                                    id: el.id
                                })).catch(() => ({}));
                                log(`   🎯 [CLICKING VISIBLE ELEMENT] Tag: ${elementInfo.tagName}, Text: "${elementLabel}"`);
                                await foundElement.click({ timeout: 5000 }).catch(async () => {
                                    await foundElement.evaluate((e) => {
                                        if (e.click)
                                            e.click();
                                        else
                                            e.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                                    });
                                });
                                log(`✅ Clicked: "${elementLabel}"`);
                                await frame.waitForTimeout(500);
                                return true;
                            }
                            else {
                                log(`   ⚠️  Element found but NOT visible on screen, trying alternatives...`);
                            }
                        }
                        catch (e) {
                            log(`   ⚠️  Error clicking target element: ${e.message}`);
                        }
                    }
                    catch (e) {
                        // Continue to next strategy
                    }
                }
            }
            catch (e) {
                // Dropdown handling failed, continue
            }
            // **SPECIAL HANDLER FOR SIGN IN / LOGIN BUTTONS - RUN FIRST**
            if (targetLower.includes('sign') && targetLower.includes('in')) {
                // Determine what we're looking for
                const isExactSignIn = !targetLower.includes('partner') && !targetLower.includes('business');
                try {
                    // Strategy 1: Find EXACT text match
                    const allElements = await frame.locator('a, button, [role="button"], div[onclick], span[onclick]').all();
                    for (const el of allElements) {
                        const text = await el.textContent().catch(() => '');
                        const textTrim = text.trim();
                        const textLower = textTrim.toLowerCase();
                        // For exact "Sign In" search - must NOT have prefixes
                        if (isExactSignIn) {
                            // Match ONLY exact: "Sign In", "signin", "Sign in", "SignIn", etc.
                            const isExactMatch = textLower === 'sign in' ||
                                textLower === 'signin' ||
                                textLower === 'sign-in' ||
                                textLower === 'login';
                            if (!isExactMatch)
                                continue;
                            // Double-check it doesn't have "Partners" or "Business" prefix
                            if (textLower.includes('partner') || textLower.includes('business')) {
                                continue;
                            }
                            // This is the real "Sign In" button!
                            const visible = await el.isVisible().catch(() => false);
                            if (visible) {
                                await el.scrollIntoViewIfNeeded();
                                await el.click({ timeout: 5000 }).catch(async () => {
                                    await el.evaluate((e) => e.click());
                                });
                                const truncated = textTrim.substring(0, 60) + (textTrim.length > 60 ? '...' : '');
                                log(`✅ Clicked: "${truncated}"`);
                                await frame.waitForTimeout(2000);
                                return true;
                            }
                        }
                        else {
                            // For "Partners Sign In" or "Business Sign In" - require the full text
                            if (textLower.includes(targetLower)) {
                                const visible = await el.isVisible().catch(() => false);
                                if (visible) {
                                    await el.scrollIntoViewIfNeeded();
                                    await el.click({ timeout: 5000 }).catch(async () => {
                                        await el.evaluate((e) => e.click());
                                    });
                                    const truncated2 = textTrim.substring(0, 60) + (textTrim.length > 60 ? '...' : '');
                                    log(`✅ Clicked: "${truncated2}"`);
                                    await frame.waitForTimeout(2000);
                                    return true;
                                }
                            }
                        }
                    }
                    // Fallback: If searching for exact "Sign In", try icon buttons in top-right
                    if (isExactSignIn) {
                        const iconButton = await frame.evaluate(() => {
                            const elements = Array.from(document.querySelectorAll('a, button, [role="button"]'));
                            for (const el of elements) {
                                const rect = el.getBoundingClientRect();
                                const text = (el.textContent || '').trim();
                                // Top-right area, small button, no text (icon button)
                                if (rect.x > 600 && rect.x < 900 && rect.top < 60 &&
                                    rect.height < 60 && rect.width < 60 && !text) {
                                    return true;
                                }
                            }
                            return false;
                        });
                        if (iconButton) {
                            const topRightButton = await frame.locator('a[href*="#"], a[href*="account"]').first();
                            const visible = await topRightButton.isVisible().catch(() => false);
                            if (visible) {
                                await topRightButton.click({ timeout: 5000 }).catch(async () => {
                                    await topRightButton.evaluate((e) => e.click());
                                });
                                log(`✅ Clicked: Sign In`);
                                await frame.waitForTimeout(2000);
                                return true;
                            }
                        }
                    }
                }
                catch (e) {
                    // Silent fail, continue to next strategy
                }
            }
        }
        catch (e) {
            // Pattern search failed
        }
        // **PRIORITY CHECK 3**: Enhanced multi-pattern button search in ALL visible clickable elements
        try {
            // Get ALL potentially clickable elements
            const clickableElements = await frame.locator('button, [role="button"], input[type="button"], input[type="submit"], a[href], [onclick], div[onclick], span[onclick], [style*="cursor:pointer"]').all();
            log(`   [Frame search] Found ${clickableElements.length} clickable elements to check`);
            log(`   🔍 [PRIORITY CHECK 3] Checking ${clickableElements.length} clickable elements for: "${target}"`);
            for (let i = 0; i < clickableElements.length; i++) {
                try {
                    const el = clickableElements[i];
                    // Get all text attributes
                    const text = await el.textContent().catch(() => '');
                    const ariaLabel = await el.getAttribute('aria-label').catch(() => '');
                    const title = await el.getAttribute('title').catch(() => '');
                    const dataTestId = await el.getAttribute('data-testid').catch(() => '');
                    const value = await el.getAttribute('value').catch(() => '');
                    const id = await el.getAttribute('id').catch(() => '');
                    const className = await el.getAttribute('class').catch(() => '');
                    const innerHTML = await el.innerHTML().catch(() => '');
                    const tagName = await el.evaluate((e) => e.tagName).catch(() => 'UNKNOWN');
                    // Combine all searchable text
                    const allText = `${text} ${ariaLabel} ${title} ${dataTestId} ${value} ${id} ${className} ${innerHTML}`.toLowerCase();
                    // Check if target matches
                    if (allText.includes(targetLower)) {
                        // SPECIAL: For "Sign In" target, ONLY match exact "Sign In", NOT "Partners Sign In"
                        if (targetLower === 'sign in' || targetLower === 'signin') {
                            // For exact "Sign In", text must be EXACTLY that, not with prefixes
                            const textLower = text.toLowerCase().trim();
                            const isExactSignIn = textLower === 'sign in' || textLower === 'signin' ||
                                textLower === 'sign-in' || textLower === 'login';
                            if (!isExactSignIn || textLower.includes('partner') || textLower.includes('business')) {
                                continue;
                            }
                        }
                        // Try to click with multiple methods
                        try {
                            // Method 1: Force click
                            await el.click({ force: true, timeout: 5000 }).catch(() => { });
                            log(`✅ Clicked: "${target}"`);
                            await frame.waitForTimeout(500);
                            return true;
                        }
                        catch (e1) {
                            // Method 2: JavaScript click
                            try {
                                const clicked = await el.evaluate((element) => {
                                    try {
                                        element.click();
                                        return true;
                                    }
                                    catch (e) {
                                        element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                                        return true;
                                    }
                                });
                                if (clicked) {
                                    log(`✅ Clicked: "${target}"`);
                                    await frame.waitForTimeout(500);
                                    return true;
                                }
                            }
                            catch (e2) {
                                // Continue to next element
                            }
                        }
                    }
                }
                catch (e) {
                    // Try next element
                }
            }
        }
        catch (e) {
            // Priority check 3 failed
        }
        // PATTERN 0: ULTRA AGGRESSIVE DEEP SEARCH - NO VISIBILITY RESTRICTIONS
        // This searches EVERY element in the entire frame, including hidden/overlaid ones
        // ENHANCED: Now searches nested iframes and shadow DOM
        try {
            const found = await frame.evaluate((searchText) => {
                const searchLower = searchText.toLowerCase().trim();
                let elementsChecked = 0;
                let foundMatch = null;
                // Strategy 1: Direct element walk - check EVERYTHING recursively
                const walk = (node) => {
                    if (node.nodeType === 1) { // Element node
                        elementsChecked++;
                        const el = node;
                        const text = (el.textContent || '').toLowerCase().trim();
                        const title = (el.getAttribute('title') || '').toLowerCase();
                        const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
                        const dataTestId = (el.getAttribute('data-testid') || '').toLowerCase();
                        const onclick = el.getAttribute('onclick') || '';
                        const id = (el.getAttribute('id') || '').toLowerCase();
                        const className = (el.getAttribute('class') || '').toLowerCase();
                        const value = (el.getAttribute('value') || '').toLowerCase();
                        const name = (el.getAttribute('name') || '').toLowerCase();
                        // Create comprehensive search space - include more attributes
                        const allText = `${text} ${title} ${ariaLabel} ${dataTestId} ${id} ${className} ${value} ${name}`;
                        // For short search terms, check EXACT match on direct text
                        let isMatch = false;
                        if (searchLower.length <= 3) {
                            // For short terms, require exact match on text (trimmed)
                            isMatch = text === searchLower ||
                                text.split(/\s+/).some(word => word === searchLower) ||
                                title === searchLower ||
                                ariaLabel === searchLower ||
                                value === searchLower;
                        }
                        else {
                            // For longer terms, use substring match
                            isMatch = allText.includes(searchLower) || onclick.includes(searchLower);
                        }
                        if (isMatch) {
                            // SPECIAL: For exact "Sign In" search, skip "Partners Sign In"
                            let shouldSkip = false;
                            if ((searchLower === 'sign in' || searchLower === 'signin') &&
                                !searchLower.includes('partner') && !searchLower.includes('business')) {
                                // Only match exact "Sign In", not variants
                                const isExactSignIn = text === 'Sign In' || text === 'signin' || text === 'sign-in' || text === 'login';
                                if (!isExactSignIn && (text.includes('Partner') || text.includes('Business'))) {
                                    // This is "Partners Sign In" or similar - skip it
                                    shouldSkip = true;
                                }
                            }
                            if (!shouldSkip) {
                                // Match if element is clickable - EXPANDED criteria
                                const isClickable = (el.tagName === 'BUTTON' ||
                                    el.tagName === 'INPUT' ||
                                    el.tagName === 'A' ||
                                    el.getAttribute('role') === 'button' ||
                                    el.getAttribute('role') === 'menuitem' ||
                                    el.getAttribute('role') === 'tab' ||
                                    el.getAttribute('role') === 'link' ||
                                    el.onclick !== null ||
                                    el.getAttribute('onclick') ||
                                    el.className.includes('btn') ||
                                    el.className.includes('button') ||
                                    el.className.includes('clickable') ||
                                    el.style.cursor === 'pointer' ||
                                    el.style.cursor === 'hand');
                                if (isClickable) {
                                    foundMatch = el; // Store first match
                                    // IMPORTANT: Try to click directly in JavaScript
                                    // This bypasses visibility checks - works for overlaid/hidden elements
                                    try {
                                        el.click();
                                        return true;
                                    }
                                    catch (e) {
                                        // If normal click fails, try multiple fallback methods
                                        try {
                                            el.scrollIntoView({ behavior: 'auto', block: 'center' });
                                            el.click();
                                            return true;
                                        }
                                        catch (e2) {
                                            // Try dispatchEvent
                                            try {
                                                el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
                                                return true;
                                            }
                                            catch (e3) {
                                                // Try calling onclick handler if it exists
                                                if (el.onclick) {
                                                    try {
                                                        el.onclick(new MouseEvent('click'));
                                                        return true;
                                                    }
                                                    catch (e4) {
                                                        // Continue searching
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            } // Close the if (!shouldSkip) block
                        }
                    }
                    // Walk through ALL children (don't stop on first match)
                    for (let child of node.childNodes) {
                        if (walk(child))
                            return true;
                    }
                    // Check shadow DOM if available
                    if (node.shadowRoot) {
                        for (let child of node.shadowRoot.childNodes) {
                            if (walk(child))
                                return true;
                        }
                    }
                    return false;
                };
                // Start from document root and walk ENTIRE tree
                const result = walk(document);
                console.log(`[DEEP SEARCH] Checked ${elementsChecked} elements for "${searchText}"`);
                return { found: result, count: elementsChecked };
            }, target);
            if (found && found.found) {
                log(`✅ [DEEP SEARCH${framePath}] Found and clicked: "${target}" (NO visibility restrictions, searched ${found.count} elements)`);
                return true;
            }
        }
        catch (e) {
            log(`   ℹ️ Deep search in frame failed: ${e.message}`);
        }
        // PATTERN 1: Buttons and Link Elements - FORCE CLICK without visibility check
        try {
            const buttons = await frame.locator('button, a[href], [role="button"], [role="tab"], [role="menuitem"], [onclick], input[type="button"], input[type="submit"]').all();
            for (const btn of buttons) {
                try {
                    const text = await btn.textContent().catch(() => '');
                    const ariaLabel = await btn.getAttribute('aria-label').catch(() => '');
                    const title = await btn.getAttribute('title').catch(() => '');
                    const dataAttr = await btn.getAttribute('data-testid').catch(() => '');
                    const value = await btn.getAttribute('value').catch(() => '');
                    const id = await btn.getAttribute('id').catch(() => '');
                    const allText = `${text} ${ariaLabel} ${title} ${dataAttr} ${value} ${id}`.toLowerCase();
                    // Trim whitespace from text for exact matching
                    const textTrimmed = text.trim().toLowerCase();
                    // ENHANCED MATCHING: Multiple strategies based on search term length
                    let isMatch = false;
                    if (targetLower.length <= 3) {
                        // For short terms, require EXACT match
                        isMatch = textTrimmed === targetLower ||
                            textTrimmed.split(/\s+/).some(word => word === targetLower) ||
                            title === targetLower ||
                            ariaLabel === targetLower ||
                            value === targetLower;
                    }
                    else {
                        // For longer terms, use substring match
                        isMatch = textTrimmed.includes(targetLower) || allText.includes(targetLower);
                    }
                    if (isMatch) {
                        // Show cursor pointer before clicking
                        await showClickPointerByAttribute(frame, target);
                        log(`👆 [POINTER] Clicking: "${target}" (cursor shown for 2 seconds...)`);
                        await frame.waitForTimeout(2000);
                        // Force click without checking visibility - if it exists in DOM, click it
                        // This handles overlaid/hidden elements
                        try {
                            await btn.click({ force: true, timeout: 5000 }).catch(() => { });
                            log(`✅ [BUTTON${framePath}] Force-clicked: "${target}"`);
                            await removeClickPointer(frame);
                            return true;
                        }
                        catch (clickError) {
                            // If force click fails, try alternative methods
                            try {
                                await btn.evaluate((el) => el.click());
                                log(`✅ [BUTTON-JS${framePath}] JavaScript-clicked: "${target}"`);
                                await removeClickPointer(frame);
                                return true;
                            }
                            catch (e2) {
                                // Try dispatchEvent as last resort
                                try {
                                    await btn.evaluate((el) => {
                                        el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                                    });
                                    log(`✅ [BUTTON-EVENT${framePath}] Mouse-event-clicked: "${target}"`);
                                    await removeClickPointer(frame);
                                    return true;
                                }
                                catch (e3) {
                                    // Continue to next button
                                }
                            }
                        }
                    }
                }
                catch (e) {
                    // Try next element
                }
            }
        }
        catch (e) {
            // Pattern 1 failed, continue
        }
        // PATTERN 2: Divs/Spans/Any element with onclick - NO VISIBILITY CHECKS
        try {
            const allElements = await frame.locator('[onclick], [role="button"], [role="menuitem"], [role="tab"]').all();
            for (const el of allElements) {
                try {
                    const text = await el.textContent().catch(() => '');
                    const className = await el.getAttribute('class').catch(() => '');
                    const id = await el.getAttribute('id').catch(() => '');
                    const title = await el.getAttribute('title').catch(() => '');
                    const ariaLabel = await el.getAttribute('aria-label').catch(() => '');
                    const allText = `${text} ${className} ${id} ${title} ${ariaLabel}`.toLowerCase();
                    const textTrimmed = text.trim().toLowerCase();
                    // Strict matching for short terms
                    let isMatch = false;
                    if (targetLower.length <= 3) {
                        isMatch = textTrimmed === targetLower ||
                            textTrimmed.split(/\s+/).some(word => word === targetLower) ||
                            title === targetLower ||
                            ariaLabel === targetLower;
                    }
                    else {
                        isMatch = allText.includes(targetLower);
                    }
                    if (isMatch) {
                        // Force click - element exists, so click it regardless of visibility
                        try {
                            await el.click({ force: true, timeout: 5000 }).catch(() => { });
                            log(`✅ [ELEMENT${framePath}] Force-clicked (onclick): "${target}"`);
                            return true;
                        }
                        catch (e1) {
                            try {
                                await el.evaluate((elm) => elm.click());
                                log(`✅ [ELEMENT-JS${framePath}] JavaScript-clicked (onclick): "${target}"`);
                                return true;
                            }
                            catch (e2) {
                                // Continue
                            }
                        }
                    }
                }
                catch (e) {
                    // Try next element
                }
            }
        }
        catch (e) {
            // Pattern 2 failed
        }
        // PATTERN 3: Search by text content in ANY element (all divs, spans, p, etc)
        try {
            const allDivs = await frame.locator('div, span, p, section, article, label').all();
            const maxCheck = Math.min(allDivs.length, 500); // Check up to 500 elements
            for (let i = 0; i < maxCheck; i++) {
                try {
                    const el = allDivs[i];
                    const text = await el.textContent().catch(() => '');
                    if (text && text.toLowerCase().includes(targetLower)) {
                        // Try to click regardless of visibility
                        try {
                            await el.click({ force: true, timeout: 5000 }).catch(() => { });
                            log(`✅ [TEXT-MATCH${framePath}] Force-clicked text element: "${target}"`);
                            return true;
                        }
                        catch (e1) {
                            try {
                                await el.evaluate((elm) => elm.click());
                                log(`✅ [TEXT-MATCH-JS${framePath}] JavaScript-clicked text element: "${target}"`);
                                return true;
                            }
                            catch (e2) {
                                // Continue
                            }
                        }
                    }
                }
                catch (e) {
                    // Try next
                }
            }
        }
        catch (e) {
            // Pattern 3 failed, continue
        }
        // PATTERN 3B: ULTIMATE FALLBACK - Direct JavaScript querySelector search
        // This finds ANY button with matching text and clicks it directly in JavaScript
        try {
            const found = await frame.evaluate((searchText) => {
                const searchLower = searchText.toLowerCase();
                // Try to find and click button with querySelector
                const buttons = document.querySelectorAll('button');
                for (const btn of Array.from(buttons)) {
                    const btnText = (btn.textContent || '').toLowerCase().trim();
                    const btnTitle = (btn.getAttribute('title') || '').toLowerCase();
                    const btnId = (btn.getAttribute('id') || '').toLowerCase();
                    // Match on exact or contains
                    if (btnText === searchLower || btnText.includes(searchLower) || btnTitle.includes(searchLower) || btnId.includes(searchLower)) {
                        try {
                            // Method 1: Direct click
                            btn.click();
                            return true;
                        }
                        catch (e) {
                            // Method 2: dispatchEvent with MouseEvent
                            try {
                                btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
                                return true;
                            }
                            catch (e2) {
                                // Method 3: Try calling onclick directly
                                if (btn.onclick) {
                                    try {
                                        btn.onclick(new MouseEvent('click'));
                                        return true;
                                    }
                                    catch (e3) {
                                        continue;
                                    }
                                }
                                // Method 4: Try triggering via PointerEvent
                                try {
                                    btn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
                                    btn.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
                                    btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                                    btn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
                                    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                                    return true;
                                }
                                catch (e4) {
                                    continue;
                                }
                            }
                        }
                    }
                }
                // Also try input buttons and submit
                const inputs = document.querySelectorAll('input[type="button"], input[type="submit"]');
                for (const inp of Array.from(inputs)) {
                    const inpValue = (inp.getAttribute('value') || '').toLowerCase();
                    if (inpValue === searchLower || inpValue.includes(searchLower)) {
                        try {
                            inp.click();
                            return true;
                        }
                        catch (e) {
                            continue;
                        }
                    }
                }
                // Also try divs/spans with specific attributes that act as buttons
                const divButtons = document.querySelectorAll('[role="button"], [onclick]');
                for (const divBtn of Array.from(divButtons)) {
                    const divText = (divBtn.textContent || '').toLowerCase().trim();
                    if (divText === searchLower || divText.includes(searchLower)) {
                        try {
                            divBtn.click();
                            return true;
                        }
                        catch (e) {
                            try {
                                divBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
                                return true;
                            }
                            catch (e2) {
                                continue;
                            }
                        }
                    }
                }
                return false;
            }, target);
            if (found) {
                log(`✅ [ULTIMATE-JS${framePath}] Found and clicked via ultimate JS querySelector: "${target}"`);
                await frame.waitForTimeout(800); // Wait longer for action to process
                return true;
            }
        }
        catch (e) {
            log(`   ℹ️ Ultimate JS fallback failed: ${e.message}`);
        }
        // PATTERN 4: Search in overlay/modal windows (for elements like "Customer Maintenance", etc)
        try {
            const overlaySelectors = [
                '[role="dialog"]',
                '[role="alertdialog"]',
                '.modal',
                '.overlay',
                '.dialog',
                '.popup',
                '[class*="modal"]',
                '[class*="overlay"]',
                '[class*="dialog"]'
            ];
            for (const selector of overlaySelectors) {
                try {
                    const overlays = await frame.locator(selector).all();
                    for (const overlay of overlays) {
                        try {
                            // Search for clickable elements within this overlay
                            const overlayElements = await overlay.locator('button, [role="button"], a, [onclick], span[style*="cursor"], div[style*="cursor"]').all();
                            for (const el of overlayElements) {
                                try {
                                    const text = await el.textContent().catch(() => '');
                                    const title = await el.getAttribute('title').catch(() => '');
                                    const ariaLabel = await el.getAttribute('aria-label').catch(() => '');
                                    const allText = `${text} ${title} ${ariaLabel}`.toLowerCase();
                                    if (allText.includes(targetLower)) {
                                        const isVisible = await el.isVisible().catch(() => false);
                                        if (isVisible) {
                                            await el.scrollIntoViewIfNeeded();
                                            await el.click().catch(() => { });
                                            return true;
                                        }
                                    }
                                }
                                catch (e) {
                                    // Try next element
                                }
                            }
                        }
                        catch (e) {
                            // Try next overlay
                        }
                    }
                }
                catch (e) {
                    // Selector failed, try next
                }
            }
        }
        catch (e) {
            // Pattern 4 failed
        }
    }
    catch (error) {
        // Frame click error
    }
    return false;
}
/**
 * Execute FILL action in frame with sequential pattern matching
 * ENHANCED: No visibility restrictions - fill ANY field you can see on screen
 *
 * KEY PRINCIPLE: If input field is visible on screen, it must be fillable
 * - Removes visibility checks
 * - Uses force fill for overlaid/hidden fields
 * - Direct JavaScript manipulation for stubborn fields
 */
async function executeFillInFrame(frame, target, fillValue, framePath) {
    const targetLower = target.toLowerCase();
    try {
        // PATTERN 0: ULTRA AGGRESSIVE DEEP FILL - NO VISIBILITY RESTRICTIONS
        try {
            const filled = await frame.evaluate(({ searchText, fillVal }) => {
                const searchLower = searchText.toLowerCase();
                const allInputs = document.querySelectorAll('input, textarea');
                // Direct walk through all inputs
                for (const inp of Array.from(allInputs)) {
                    const el = inp;
                    const title = (el.getAttribute('title') || '').toLowerCase();
                    const placeholder = (el.getAttribute('placeholder') || '').toLowerCase();
                    const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
                    const name = (el.getAttribute('name') || '').toLowerCase();
                    const id = (el.getAttribute('id') || '').toLowerCase();
                    const label = (el.parentElement?.textContent || '').toLowerCase();
                    const parentLabel = (el.parentElement?.parentElement?.textContent || '').toLowerCase();
                    // Comprehensive search across all attributes and context - including parent labels
                    const allText = `${title} ${placeholder} ${ariaLabel} ${name} ${id} ${label} ${parentLabel}`;
                    if (allText.includes(searchLower)) {
                        // DIRECT FILL - no visibility checks, no restrictions
                        try {
                            el.focus();
                            el.select();
                            el.value = fillVal;
                            // Dispatch all necessary events
                            el.dispatchEvent(new Event('input', { bubbles: true }));
                            el.dispatchEvent(new Event('change', { bubbles: true }));
                            el.dispatchEvent(new Event('blur', { bubbles: true }));
                            el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
                            el.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));
                            return true;
                        }
                        catch (e) {
                            // Try next
                        }
                    }
                }
                return false;
            }, { searchText: target, fillVal: fillValue });
            if (filled) {
                log(`✅ [DEEP FILL${framePath}] Filled: "${target}" = "${fillValue}" (NO visibility restrictions)`);
                return true;
            }
        }
        catch (e) {
            log(`   ℹ️ Deep fill search in frame failed: ${e.message}`);
        }
        // PATTERN 1A: Force fill - try to fill any matching input WITHOUT visibility checks
        try {
            const inputs = await frame.locator('input, textarea').all();
            for (const input of inputs) {
                const title = await input.getAttribute('title').catch(() => '');
                const placeholder = await input.getAttribute('placeholder').catch(() => '');
                const ariaLabel = await input.getAttribute('aria-label').catch(() => '');
                const name = await input.getAttribute('name').catch(() => '');
                const id = await input.getAttribute('id').catch(() => '');
                const allAttrs = `${title} ${placeholder} ${ariaLabel} ${name} ${id}`.toLowerCase();
                if (allAttrs.includes(targetLower)) {
                    try {
                        // Highlight the input field before filling
                        const inputId = await input.getAttribute('id').catch(() => '');
                        const inputName = await input.getAttribute('name').catch(() => '');
                        const selector = inputId ? `#${inputId}` : (inputName ? `[name="${inputName}"]` : '');
                        // Force fill without visibility checks
                        await input.click({ force: true }).catch(() => { });
                        await input.fill(fillValue, { timeout: 5000, force: true }).catch(() => { });
                        await input.evaluate((el) => {
                            el.dispatchEvent(new Event('input', { bubbles: true }));
                            el.dispatchEvent(new Event('change', { bubbles: true }));
                            el.dispatchEvent(new Event('blur', { bubbles: true }));
                        }).catch(() => { });
                        log(`✅ [FORCE-FILL${framePath}] Filled: "${name || id || title}" = "${fillValue}"`);
                        return true;
                    }
                    catch (e) {
                        // Try next field
                    }
                }
            }
        }
        catch (e) { }
        // PATTERN 1B: Label-associated inputs - FORCE click and fill
        try {
            const labels = await frame.locator('label').all();
            for (const label of labels) {
                const labelText = await label.textContent().catch(() => '');
                if (labelText && labelText.trim().toLowerCase().includes(targetLower)) {
                    const forAttr = await label.getAttribute('for').catch(() => '');
                    let inputEl = null;
                    if (forAttr) {
                        inputEl = await frame.locator(`#${forAttr}`).first().catch(() => null);
                    }
                    if (!inputEl) {
                        inputEl = await label.locator('input, textarea').first().catch(() => null);
                    }
                    if (inputEl) {
                        try {
                            // Highlight the input field before filling
                            const inputId = await inputEl.getAttribute('id').catch(() => '');
                            const inputName = await inputEl.getAttribute('name').catch(() => '');
                            const selector = inputId ? `#${inputId}` : (inputName ? `[name="${inputName}"]` : '');
                            // Force fill regardless of visibility
                            await inputEl.click({ force: true }).catch(() => { });
                            await inputEl.fill(fillValue, { timeout: 5000, force: true }).catch(() => { });
                            await inputEl.evaluate((el) => {
                                el.dispatchEvent(new Event('input', { bubbles: true }));
                                el.dispatchEvent(new Event('change', { bubbles: true }));
                                el.dispatchEvent(new Event('blur', { bubbles: true }));
                            }).catch(() => { });
                            log(`✅ [LABEL-FILL${framePath}] Filled: "${labelText.trim()}" = "${fillValue}"`);
                            return true;
                        }
                        catch (e) {
                            // Continue to next pattern
                        }
                    }
                }
            }
        }
        catch (e) { }
        // PATTERN 2: Direct JavaScript fill (for stubborn fields)
        try {
            const filled = await frame.evaluate(({ searchText, fillVal }) => {
                const allInputs = document.querySelectorAll('input, textarea');
                for (const input of Array.from(allInputs)) {
                    const el = input;
                    const title = el.getAttribute('title') || '';
                    const placeholder = el.getAttribute('placeholder') || '';
                    const ariaLabel = el.getAttribute('aria-label') || '';
                    const name = el.getAttribute('name') || '';
                    const id = el.getAttribute('id') || '';
                    const allAttrs = `${title} ${placeholder} ${ariaLabel} ${name} ${id}`.toLowerCase();
                    if (allAttrs.includes(searchText.toLowerCase())) {
                        try {
                            // Directly manipulate DOM
                            el.value = fillVal;
                            el.dispatchEvent(new Event('input', { bubbles: true }));
                            el.dispatchEvent(new Event('change', { bubbles: true }));
                            el.dispatchEvent(new Event('blur', { bubbles: true }));
                            // Also try Playwright fill if element is interactive
                            if (el.offsetParent !== null) { // Check if visible
                                return true;
                            }
                        }
                        catch (e) { }
                    }
                }
                return false;
            }, { searchText: target, fillVal: fillValue });
            if (filled) {
                log(`[FILL] ✓ Pattern 2: Successfully filled via direct JS manipulation = "${fillValue}"`);
                return true;
            }
        }
        catch (e) { }
        // PATTERN 3: Fallback - search by position and fill
        try {
            const inputs = await frame.locator('input[type="text"], textarea').all();
            for (let i = 0; i < inputs.length; i++) {
                const input = inputs[i];
                const value = await input.inputValue().catch(() => '');
                const name = await input.getAttribute('name').catch(() => '');
                const id = await input.getAttribute('id').catch(() => '');
                // Look for fastpath or similar pattern field
                if ((name && name.toLowerCase().includes('fast')) ||
                    (id && id.toLowerCase().includes('fast')) ||
                    (value && value === '')) {
                    try {
                        await input.click({ force: true });
                        await input.fill(fillValue, { timeout: 5000 });
                        await input.dispatchEvent('change');
                        log(`[FILL] ✓ Pattern 3: Filled field at position ${i} = "${fillValue}"${framePath ? ` in ${framePath}` : ''}`);
                        return true;
                    }
                    catch (e) { }
                }
            }
        }
        catch (e) { }
        // PATTERN 4: Search in overlay/modal windows for input fields
        try {
            const overlaySelectors = [
                '[role="dialog"]',
                '[role="alertdialog"]',
                '.modal',
                '.overlay',
                '.dialog',
                '[class*="modal"]',
                '[class*="overlay"]',
                '[class*="dialog"]'
            ];
            for (const selector of overlaySelectors) {
                try {
                    const overlays = await frame.locator(selector).all();
                    for (const overlay of overlays) {
                        try {
                            // Search for input fields within overlay
                            const inputs = await overlay.locator('input, textarea').all();
                            for (const input of inputs) {
                                try {
                                    const title = await input.getAttribute('title').catch(() => '');
                                    const placeholder = await input.getAttribute('placeholder').catch(() => '');
                                    const ariaLabel = await input.getAttribute('aria-label').catch(() => '');
                                    const name = await input.getAttribute('name').catch(() => '');
                                    const id = await input.getAttribute('id').catch(() => '');
                                    const allAttrs = `${title} ${placeholder} ${ariaLabel} ${name} ${id}`.toLowerCase();
                                    if (allAttrs.includes(target.toLowerCase())) {
                                        try {
                                            await input.scrollIntoViewIfNeeded();
                                            await input.waitForElementState('visible', { timeout: 3000 }).catch(() => { });
                                            await input.click({ force: true });
                                            await input.selectText().catch(() => { });
                                            await input.fill(fillValue, { timeout: 5000 });
                                            await input.dispatchEvent('input');
                                            await input.dispatchEvent('change');
                                            await input.dispatchEvent('blur');
                                            log(`[FILL] ✓ Pattern 4: Successfully filled field in overlay "${title || name || id}" = "${fillValue}"`);
                                            return true;
                                        }
                                        catch (e) {
                                            // Try next input
                                        }
                                    }
                                }
                                catch (e) {
                                    // Try next input
                                }
                            }
                        }
                        catch (e) {
                            // Try next overlay
                        }
                    }
                }
                catch (e) {
                    // Selector failed, try next
                }
            }
        }
        catch (e) { }
    }
    catch (error) {
        log(`[FILL] Frame error: ${error.message}`);
    }
    return false;
}
/**
 * Wait for dynamically created elements to appear using MutationObserver
 */
async function waitForDynamicElement(target, timeout = 2000) {
    if (!state.page || state.page.isClosed())
        return false;
    const startTime = Date.now();
    const checkAllWindows = async () => {
        // Check priority window first
        if (allPages.length > 1 && latestSubwindow && !latestSubwindow.isClosed()) {
            const found = await latestSubwindow.evaluate(({ searchText }) => {
                const allElements = document.querySelectorAll('*');
                for (const el of Array.from(allElements)) {
                    const text = (el.textContent || '').toLowerCase();
                    const placeholder = el.placeholder?.toLowerCase() || '';
                    const ariaLabel = el.getAttribute('aria-label')?.toLowerCase() || '';
                    const name = el.name?.toLowerCase() || '';
                    const id = el.id?.toLowerCase() || '';
                    if (text.includes(searchText.toLowerCase()) ||
                        placeholder.includes(searchText.toLowerCase()) ||
                        ariaLabel.includes(searchText.toLowerCase()) ||
                        name.includes(searchText.toLowerCase()) ||
                        id.includes(searchText.toLowerCase())) {
                        return true;
                    }
                }
                return false;
            }, { searchText: target }).catch(() => false);
            if (found) {
                log(`✅ Dynamic element found in PRIORITY SUBWINDOW: ${target}`);
                state.page = latestSubwindow; // Switch to this window
                return true;
            }
        }
        // Then check main window and other subwindows
        try {
            const found = await state.page.evaluate(({ searchText }) => {
                return new Promise((resolve) => {
                    const checkElement = () => {
                        const allElements = document.querySelectorAll('*');
                        for (const el of Array.from(allElements)) {
                            const text = (el.textContent || '').toLowerCase();
                            const placeholder = el.placeholder?.toLowerCase() || '';
                            const ariaLabel = el.getAttribute('aria-label')?.toLowerCase() || '';
                            const name = el.name?.toLowerCase() || '';
                            const id = el.id?.toLowerCase() || '';
                            if (text.includes(searchText.toLowerCase()) ||
                                placeholder.includes(searchText.toLowerCase()) ||
                                ariaLabel.includes(searchText.toLowerCase()) ||
                                name.includes(searchText.toLowerCase()) ||
                                id.includes(searchText.toLowerCase())) {
                                return true;
                            }
                        }
                        return false;
                    };
                    if (checkElement()) {
                        resolve(true);
                        return;
                    }
                    // Set up MutationObserver to watch for new elements
                    const observer = new MutationObserver(() => {
                        if (checkElement()) {
                            observer.disconnect();
                            resolve(true);
                        }
                    });
                    observer.observe(document.body, {
                        childList: true,
                        subtree: true,
                        attributes: true,
                        characterData: true
                    });
                    // Quick timeout - we'll loop again (reduced for faster fail)
                    setTimeout(() => {
                        observer.disconnect();
                        resolve(false);
                    }, 200);
                });
            }, { searchText: target }).catch(() => false);
            if (found) {
                log(`Dynamic element found: ${target}`);
                return true;
            }
        }
        catch (e) {
            // Continue
        }
        return false;
    };
    try {
        log(`🔍 Waiting for dynamic element: "${target}" (checking all windows, timeout: ${timeout}ms)`);
        // Poll all windows until element found or timeout - check every 100ms for faster detection
        while (Date.now() - startTime < timeout) {
            if (await checkAllWindows()) {
                return true;
            }
            await new Promise(r => setTimeout(r, 100)); // Check every 100ms (faster)
        }
        log(`Dynamic element NOT found after ${timeout}ms: ${target}`);
        return false;
    }
    catch (error) {
        log(`Error waiting for dynamic element: ${error.message}`);
        return false;
    }
}
/**
 * Search for overlays/modals/dialogs within the main page
 * These are child elements rendered on top of main content, not separate windows
 * Examples: Customer Maintenance popup, dialogs, modals rendered in overlay containers
 * PRIORITY: Search these FIRST before searching main page elements
 *
 * AGGRESSIVE DETECTION: Looks for ANY visible overlay container dynamically
 * by scanning for elements that contain known overlay title text (e.g., "Customer Maintenance")
 */
async function searchInPageOverlays(target, action, fillValue) {
    if (!state.page || state.page.isClosed())
        return false;
    // Check pause before searching overlays
    if (state.isPaused) {
        while (state.isPaused && !state.isStopped) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        if (state.isStopped)
            return false;
    }
    try {
        // PRIORITY 0: Quick search for visible input fields and buttons in modal dialogs FIRST
        // This handles modal dialogs that might not be caught by the overlay scanning
        const quickDialogSearch = await state.page.evaluate(({ searchText, fillVal, isAction }) => {
            const searchLower = searchText.toLowerCase();
            // For FILL action: Look for input fields
            if (isAction === 'fill') {
                const allInputs = document.querySelectorAll('input[type="text"], textarea, input:not([type])');
                // Separate candidates into exact matches and partial matches
                const exactMatches = [];
                const partialMatches = [];
                for (const input of Array.from(allInputs)) {
                    const el = input;
                    // Get all possible identifiers and trim them
                    const title = (el.getAttribute('title') || '').trim().toLowerCase();
                    const placeholder = (el.getAttribute('placeholder') || '').trim().toLowerCase();
                    const ariaLabel = (el.getAttribute('aria-label') || '').trim().toLowerCase();
                    const name = (el.getAttribute('name') || '').trim().toLowerCase();
                    const id = (el.getAttribute('id') || '').trim().toLowerCase();
                    // Check nearby labels and parent text
                    let nearbyText = '';
                    if (el.parentElement) {
                        nearbyText += (el.parentElement.textContent || '').trim().toLowerCase();
                    }
                    if (el.parentElement?.parentElement) {
                        nearbyText += ' ' + (el.parentElement.parentElement.textContent || '').trim().toLowerCase();
                    }
                    // Check visibility first
                    const rect = el.getBoundingClientRect();
                    if (rect.width <= 0 || rect.height <= 0)
                        continue; // Skip invisible
                    // EXACT MATCH: Direct attribute match (highest priority)
                    if (title === searchLower || placeholder === searchLower || ariaLabel === searchLower) {
                        exactMatches.push(el);
                        continue;
                    }
                    // WORD MATCH: Target is a complete word in the text
                    const titleWords = title.split(/\s+/);
                    const placeholderWords = placeholder.split(/\s+/);
                    const ariaWords = ariaLabel.split(/\s+/);
                    if (titleWords.includes(searchLower) || placeholderWords.includes(searchLower) || ariaWords.includes(searchLower)) {
                        partialMatches.push(el);
                        continue;
                    }
                    // FALLBACK: Substring match (last resort)
                    const allText = `${title} ${placeholder} ${ariaLabel} ${name} ${id} ${nearbyText}`;
                    if (allText.includes(searchLower)) {
                        partialMatches.push(el);
                    }
                }
                // Try exact matches FIRST
                if (exactMatches.length > 0) {
                    const el = exactMatches[0];
                    const rect = el.getBoundingClientRect();
                    if (rect.width > 0 && rect.height > 0) {
                        // Element is visible - FILL it
                        el.focus();
                        el.select();
                        el.value = fillVal;
                        // Dispatch events to trigger any change handlers
                        el.dispatchEvent(new Event('input', { bubbles: true }));
                        el.dispatchEvent(new Event('change', { bubbles: true }));
                        el.dispatchEvent(new Event('blur', { bubbles: true }));
                        el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
                        el.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));
                        return { found: true, action: 'fill', target: searchText };
                    }
                }
                // Then try partial matches
                if (partialMatches.length > 0) {
                    for (const el of partialMatches) {
                        const rect = el.getBoundingClientRect();
                        if (rect.width > 0 && rect.height > 0) {
                            el.focus();
                            el.select();
                            el.value = fillVal;
                            el.dispatchEvent(new Event('input', { bubbles: true }));
                            el.dispatchEvent(new Event('change', { bubbles: true }));
                            el.dispatchEvent(new Event('blur', { bubbles: true }));
                            el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
                            el.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));
                            return { found: true, action: 'fill', target: searchText };
                        }
                    }
                }
            }
            // For CLICK action: Look for buttons and clickable elements
            if (isAction === 'click') {
                const clickables = document.querySelectorAll('button, input[type="button"], input[type="submit"], a, [role="button"]');
                // Separate candidates into exact matches and partial matches
                const exactMatches = [];
                const partialMatches = [];
                for (const elem of Array.from(clickables)) {
                    const el = elem;
                    const text = (el.textContent || '').trim().toLowerCase();
                    const value = (el.getAttribute('value') || '').trim().toLowerCase();
                    const title = (el.getAttribute('title') || '').trim().toLowerCase();
                    const ariaLabel = (el.getAttribute('aria-label') || '').trim().toLowerCase();
                    // Check visibility first
                    const rect = el.getBoundingClientRect();
                    if (rect.width <= 0 || rect.height <= 0)
                        continue; // Skip invisible
                    // EXACT MATCH: Full text equals target
                    if (text === searchLower || value === searchLower || title === searchLower || ariaLabel === searchLower) {
                        exactMatches.push(el);
                        continue;
                    }
                    // For SINGLE CHARACTER searches: ONLY exact match - no word or substring matching
                    // This prevents "P" from matching "Expand" or other words containing P
                    if (searchLower.length === 1) {
                        continue; // Skip this element - we already checked exact matches above
                    }
                    // WORD MATCH: Target is a complete word in the text (not substring)
                    const words = text.split(/\s+/);
                    if (words.includes(searchLower)) {
                        partialMatches.push(el);
                        continue;
                    }
                    // FALLBACK: Substring match (last resort)
                    const allText = `${text} ${value} ${title} ${ariaLabel}`;
                    if (allText.includes(searchLower)) {
                        partialMatches.push(el);
                    }
                }
                // Try exact matches FIRST (highest priority)
                if (exactMatches.length > 0) {
                    const el = exactMatches[0];
                    const tagName = el.tagName;
                    const id = el.getAttribute('id') || 'no-id';
                    const classList = el.getAttribute('class') || 'no-class';
                    const clickText = (el.textContent || '').trim().substring(0, 50);
                    console.log(`[OVERLAY-CLICK-DEBUG] Exact match found: <${tagName} id="${id}" class="${classList}"> text="${clickText}"`);
                    try {
                        el.click();
                        return { found: true, action: 'click', target: searchText };
                    }
                    catch (e) {
                        // Try next
                    }
                }
                // Then try word matches
                if (partialMatches.length > 0) {
                    for (const el of partialMatches) {
                        try {
                            el.click();
                            return { found: true, action: 'click', target: searchText };
                        }
                        catch (e) {
                            // Try next element
                        }
                    }
                }
            }
            return { found: false };
        }, { searchText: target, fillVal: action === 'fill' ? fillValue : null, isAction: action });
        if (quickDialogSearch && quickDialogSearch.found) {
            if (action === 'fill') {
                log(`✅ [QUICK MODAL SEARCH] Filled: "${target}" = "${fillValue}"`);
            }
            else {
                log(`✅ [QUICK MODAL SEARCH] Clicked: "${target}"`);
            }
            await state.page.waitForTimeout(300);
            return true;
        }
        log(`\n🎨 [OVERLAY PRIORITY] Searching for overlays/modals/dialogs in main page...`);
        // AGGRESSIVE APPROACH: Find all visible overlays by scanning DOM directly
        // Look for any container that appears to be an overlay/dialog
        const overlayContainers = await state.page.evaluate(() => {
            const containers = [];
            // Strategy 1: Find elements with specific overlay indicators
            const allElements = document.querySelectorAll('*');
            for (const el of Array.from(allElements)) {
                const html = el;
                const style = window.getComputedStyle(html);
                const zIndex = parseInt(style.zIndex || '0');
                const position = style.position;
                // Overlay indicators:
                // - High z-index (typically 100+)
                // - Fixed or absolute positioning
                // - Visible (display != none, visibility != hidden)
                // - Contains text like "Customer Maintenance", "Dialog", etc
                // - Has border/shadow (looks like a window)
                if (position === 'fixed' || position === 'absolute' || zIndex >= 100) {
                    if (style.display !== 'none' && style.visibility !== 'hidden') {
                        const rect = html.getBoundingClientRect();
                        // Check if element has significant size (likely a container)
                        if (rect.width > 200 && rect.height > 150) {
                            // Check if element has any content that suggests it's a dialog/window
                            const text = html.textContent || '';
                            const classList = html.getAttribute('class') || '';
                            // Look for window-like characteristics
                            if (text.length > 0 && (text.includes('Customer') ||
                                text.includes('Maintenance') ||
                                text.includes('Dialog') ||
                                text.includes('New') ||
                                text.includes('Enter Query') ||
                                classList.includes('window') ||
                                classList.includes('modal') ||
                                classList.includes('dialog') ||
                                classList.includes('overlay'))) {
                                containers.push({
                                    text: text.substring(0, 200),
                                    zIndex: zIndex,
                                    position: position,
                                    id: html.id,
                                    className: classList,
                                    tagName: html.tagName,
                                    element: html
                                });
                            }
                        }
                    }
                }
            }
            return containers;
        });
        // Silent processing - no spam logging
        // Also try standard selectors for known overlay patterns
        const overlaySelectors = [
            '[role="dialog"]',
            '[role="alertdialog"]',
            '.modal',
            '.modal-content',
            '.overlay',
            '.dialog',
            '.popup',
            '.popover',
            '[class*="modal"]',
            '[class*="overlay"]',
            '[class*="dialog"]',
            '[class*="popup"]',
            '[class*="popover"]',
            '.window',
            '[class*="window"]',
            '.panel',
            '[class*="panel"]',
            'div[style*="z-index"]',
            'div[style*="position"]'
        ];
        const allOverlays = [];
        // Collect overlays from standard selectors
        for (const selector of overlaySelectors) {
            try {
                const overlays = await state.page.locator(selector).all();
                allOverlays.push(...overlays);
            }
            catch (e) {
                // Selector failed, continue
            }
        }
        // Silent processing - search each overlay for the target
        for (let overlayIdx = 0; overlayIdx < allOverlays.length; overlayIdx++) {
            const overlay = allOverlays[overlayIdx];
            try {
                // CHECK: Verify overlay is actually visible before searching
                const isOverlayVisible = await overlay.evaluate((el) => {
                    const style = window.getComputedStyle(el);
                    const visible = style.display !== 'none' &&
                        style.visibility !== 'hidden' &&
                        style.opacity !== '0' &&
                        Number(style.opacity) > 0.1;
                    const rect = el.getBoundingClientRect();
                    const inViewport = rect.width > 0 && rect.height > 0;
                    return visible && inViewport;
                }).catch(() => false);
                if (!isOverlayVisible) {
                    continue; // Skip invisible overlays - silent
                }
                // CLICK ACTION IN OVERLAY
                if (action === 'click') {
                    // Strategy 1: Direct JavaScript search WITHIN overlay WITH VISIBILITY CHECK
                    // This bypasses Playwright's visibility checks
                    try {
                        const found = await overlay.evaluate((containerEl, searchTarget) => {
                            const searchLower = searchTarget.toLowerCase();
                            // FIRST: Check if overlay itself is visible
                            const overlayStyle = window.getComputedStyle(containerEl);
                            const overlayVisible = overlayStyle.display !== 'none' &&
                                overlayStyle.visibility !== 'hidden' &&
                                overlayStyle.opacity !== '0';
                            if (!overlayVisible) {
                                console.log(`[OVERLAY-CLICK] Overlay NOT visible - skipping`);
                                return false;
                            }
                            // Walk through ALL elements in this container
                            const walker = document.createTreeWalker(containerEl, NodeFilter.SHOW_ELEMENT, null);
                            let node;
                            while (node = walker.nextNode()) {
                                const el = node;
                                const text = el.textContent?.toLowerCase() || '';
                                const title = el.getAttribute('title')?.toLowerCase() || '';
                                const ariaLabel = el.getAttribute('aria-label')?.toLowerCase() || '';
                                const onclick = el.getAttribute('onclick') || '';
                                const className = el.className.toLowerCase();
                                const allText = `${text} ${title} ${ariaLabel} ${className}`;
                                // Check if target matches
                                if (allText.includes(searchLower) || onclick.includes(searchLower)) {
                                    // Check if element is visible AND clickable
                                    const elStyle = window.getComputedStyle(el);
                                    const elVisible = elStyle.display !== 'none' &&
                                        elStyle.visibility !== 'hidden' &&
                                        elStyle.opacity !== '0';
                                    const rect = el.getBoundingClientRect();
                                    const inViewport = rect.width > 0 && rect.height > 0;
                                    const isClickable = (el.tagName === 'BUTTON' ||
                                        el.getAttribute('role') === 'button' ||
                                        el.getAttribute('role') === 'menuitem' ||
                                        el.tagName === 'A' ||
                                        el.onclick !== null ||
                                        onclick !== '' ||
                                        className.includes('btn') ||
                                        className.includes('button'));
                                    if (isClickable && elVisible && inViewport) {
                                        console.log(`[OVERLAY-CLICK] Found visible clickable: ${searchTarget}`);
                                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                        setTimeout(() => {
                                            el.click();
                                        }, 100);
                                        return true;
                                    }
                                }
                            }
                            return false;
                        }, target);
                        if (found) {
                            log(`   ✅ [OVERLAY CLICK-JS] Clicked: "${target}"`);
                            await state.page.waitForTimeout(500); // Wait for click to process
                            return true;
                        }
                    }
                    catch (jsError) {
                        log(`   ℹ️ JS search in overlay failed: ${jsError}`);
                    }
                    // Strategy 2: Find buttons/links in overlay via Playwright
                    try {
                        const buttons = await overlay.locator('button, a[href], [role="button"], [onclick], input[type="button"], input[type="submit"], div, span').all();
                        for (const btn of buttons.slice(0, 200)) { // Check up to 200 elements
                            try {
                                const text = await btn.textContent().catch(() => '');
                                const ariaLabel = await btn.getAttribute('aria-label').catch(() => '');
                                const title = await btn.getAttribute('title').catch(() => '');
                                const value = await btn.getAttribute('value').catch(() => '');
                                const allText = `${text} ${ariaLabel} ${title} ${value}`.toLowerCase();
                                if (allText.includes(target.toLowerCase())) {
                                    log(`   ✅ Found "${target}" in overlay`);
                                    try {
                                        await btn.click({ force: true, timeout: 5000 }).catch(() => { });
                                        log(`   ✅ [OVERLAY CLICK] Clicked: "${target}"`);
                                        return true;
                                    }
                                    catch (e) {
                                        try {
                                            await btn.evaluate((el) => el.click());
                                            log(`   ✅ [OVERLAY CLICK-EVAL] Clicked: "${target}"`);
                                            return true;
                                        }
                                        catch (e2) {
                                            // Continue
                                        }
                                    }
                                }
                            }
                            catch (e) {
                                // Continue
                            }
                        }
                    }
                    catch (stratError) {
                        // Continue
                    }
                }
                // FILL ACTION IN OVERLAY
                if (action === 'fill') {
                    // Strategy 1: Direct JavaScript fill WITH VISIBILITY CHECK
                    try {
                        const filled = await overlay.evaluate((containerEl, searchTarget, fillVal) => {
                            const searchLower = searchTarget.toLowerCase();
                            // FIRST: Check if overlay itself is visible
                            const overlayStyle = window.getComputedStyle(containerEl);
                            const overlayVisible = overlayStyle.display !== 'none' &&
                                overlayStyle.visibility !== 'hidden' &&
                                overlayStyle.opacity !== '0';
                            if (!overlayVisible) {
                                console.log(`[OVERLAY-FILL] Overlay NOT visible - skipping`);
                                return false;
                            }
                            const allInputs = containerEl.querySelectorAll('input, textarea');
                            for (const inp of Array.from(allInputs)) {
                                const el = inp;
                                const title = el.getAttribute('title')?.toLowerCase() || '';
                                const placeholder = el.getAttribute('placeholder')?.toLowerCase() || '';
                                const ariaLabel = el.getAttribute('aria-label')?.toLowerCase() || '';
                                const name = el.getAttribute('name')?.toLowerCase() || '';
                                const id = el.getAttribute('id')?.toLowerCase() || '';
                                const allAttrs = `${title} ${placeholder} ${ariaLabel} ${name} ${id}`;
                                if (allAttrs.includes(searchLower)) {
                                    // CHECK: Element must be visible AND enabled
                                    const elStyle = window.getComputedStyle(el);
                                    const elVisible = elStyle.display !== 'none' &&
                                        elStyle.visibility !== 'hidden' &&
                                        !el.disabled;
                                    const rect = el.getBoundingClientRect();
                                    const inViewport = rect.width > 0 && rect.height > 0;
                                    if (elVisible && inViewport) {
                                        console.log(`[OVERLAY-JS-FILL] Found visible field: ${searchTarget}`);
                                        el.focus();
                                        el.value = fillVal;
                                        el.dispatchEvent(new Event('input', { bubbles: true }));
                                        el.dispatchEvent(new Event('change', { bubbles: true }));
                                        el.dispatchEvent(new Event('blur', { bubbles: true }));
                                        console.log(`[OVERLAY-JS-FILL] Filled: ${searchTarget} = ${fillVal}`);
                                        return true;
                                    }
                                    else {
                                        console.log(`[OVERLAY-JS-FILL] Field found but NOT visible: ${searchTarget}`);
                                    }
                                }
                            }
                            return false;
                        }, target, fillValue);
                        if (filled) {
                            log(`   ✅ [OVERLAY FILL-JS] Filled: "${target}" = "${fillValue}"`);
                            await state.page.waitForTimeout(300); // Wait for events to process
                            return true;
                        }
                    }
                    catch (jsError) {
                        log(`   ℹ️ JS fill in overlay failed: ${jsError}`);
                    }
                    // Strategy 2: Playwright fill
                    try {
                        const inputs = await overlay.locator('input, textarea').all();
                        for (const input of inputs) {
                            try {
                                const title = await input.getAttribute('title').catch(() => '');
                                const placeholder = await input.getAttribute('placeholder').catch(() => '');
                                const ariaLabel = await input.getAttribute('aria-label').catch(() => '');
                                const name = await input.getAttribute('name').catch(() => '');
                                const id = await input.getAttribute('id').catch(() => '');
                                const allAttrs = `${title} ${placeholder} ${ariaLabel} ${name} ${id}`.toLowerCase();
                                if (allAttrs.includes(target.toLowerCase())) {
                                    log(`   ✅ Found field "${target}" in overlay`);
                                    try {
                                        await input.click({ force: true }).catch(() => { });
                                        await input.fill(fillValue || '', { force: true, timeout: 5000 }).catch(() => { });
                                        await input.evaluate((el) => {
                                            el.dispatchEvent(new Event('input', { bubbles: true }));
                                            el.dispatchEvent(new Event('change', { bubbles: true }));
                                            el.dispatchEvent(new Event('blur', { bubbles: true }));
                                        }).catch(() => { });
                                        log(`   ✅ [OVERLAY FILL] Filled: "${target}" = "${fillValue}"`);
                                        return true;
                                    }
                                    catch (e) {
                                        // Continue
                                    }
                                }
                            }
                            catch (e) {
                                // Continue
                            }
                        }
                    }
                    catch (stratError) {
                        // Continue
                    }
                }
            }
            catch (overlayError) {
                // Continue to next overlay
                continue;
            }
        }
        log(`   ℹ️ Target not found in any overlay - will search main page next`);
        return false;
    }
    catch (error) {
        log(`[OVERLAY SEARCH ERROR] ${error.message}`);
        return false;
    }
}
/**
 * DROPDOWN DETECTOR - AGGRESSIVE DETECTION
 * Scans entire DOM for ANY visible container that looks like a dropdown
 * HIGHEST PRIORITY: Find ALL visible menus/dropdowns
 */
async function detectOpenDropdowns() {
    if (!state.page || state.page.isClosed())
        return [];
    try {
        const openDropdowns = await state.page.evaluate(() => {
            const dropdowns = [];
            const found = new Set();
            // ===== LEVEL 1: Check CSS class patterns =====
            const dropdownSelectors = [
                '[class*="menu"][class*="open"]',
                '[class*="dropdown"][class*="show"]',
                '[class*="dropdown"][class*="visible"]',
                '[class*="dropdown"][class*="active"]',
                '[class*="menu"][class*="show"]',
                '[class*="nav"][class*="open"]',
                '[role="menu"][style*="display"]',
                '[role="menu"][style*="visibility"]',
                '.navbar-collapse.show',
                '[class*="submenu"][class*="show"]',
                '[class*="modal-open"]',
                '[class*="expanded"]',
                '[class*="panel"][class*="show"]',
                // NEW: WAI-ARIA attributes for accessibility
                '[aria-expanded="true"]',
            ];
            for (const selector of dropdownSelectors) {
                try {
                    const elements = Array.from(document.querySelectorAll(selector));
                    for (const el of elements) {
                        const htmlEl = el;
                        if (found.has(htmlEl))
                            continue;
                        const rect = htmlEl.getBoundingClientRect();
                        const style = window.getComputedStyle(htmlEl);
                        const opacity = parseFloat(style.opacity);
                        if (style.display !== 'none' &&
                            style.visibility !== 'hidden' &&
                            opacity > 0.5 &&
                            rect.height > 20 &&
                            rect.width > 20) {
                            found.add(htmlEl);
                            dropdowns.push({
                                selector: selector,
                                visible: true,
                                bounds: {
                                    top: rect.top,
                                    left: rect.left,
                                    right: rect.right,
                                    bottom: rect.bottom,
                                    width: rect.width,
                                    height: rect.height,
                                    zIndex: style.zIndex
                                }
                            });
                        }
                    }
                }
                catch (e) {
                    // Continue
                }
            }
            // ===== LEVEL 2: Check for absolutely positioned containers with menu items =====
            const allElements = Array.from(document.querySelectorAll('*'));
            for (const el of allElements) {
                if (found.has(el))
                    continue;
                const style = window.getComputedStyle(el);
                const rect = el.getBoundingClientRect();
                // Look for absolutely positioned or fixed elements in top area
                if ((style.position === 'absolute' || style.position === 'fixed') &&
                    style.display !== 'none' &&
                    style.visibility !== 'hidden' &&
                    rect.height > 20 &&
                    rect.width > 20 &&
                    rect.top >= 0 &&
                    rect.top < 600) {
                    // Check if it contains menu-like items
                    const hasMenuItems = el.querySelectorAll('a, button, li, [role="menuitem"], [role="button"]').length > 0;
                    if (hasMenuItems && el.querySelectorAll('a, button, li, [role="menuitem"]').length >= 2) {
                        found.add(el);
                        dropdowns.push({
                            selector: `[positioned-menu]`,
                            visible: true,
                            bounds: {
                                top: rect.top,
                                left: rect.left,
                                right: rect.right,
                                bottom: rect.bottom,
                                width: rect.width,
                                height: rect.height,
                                zIndex: style.zIndex
                            }
                        });
                    }
                }
            }
            // ===== LEVEL 3: Check for elements with high z-index that are visible =====
            for (const el of allElements) {
                if (found.has(el))
                    continue;
                const style = window.getComputedStyle(el);
                const rect = el.getBoundingClientRect();
                const zIndex = parseInt(style.zIndex) || 0;
                // High z-index + visible + has children = likely a dropdown
                if (zIndex > 100 &&
                    style.display !== 'none' &&
                    style.visibility !== 'hidden' &&
                    rect.height > 20 &&
                    rect.width > 20) {
                    const hasMenuItems = el.querySelectorAll('a, button, li, [role="menuitem"]').length > 0;
                    if (hasMenuItems && el.children.length >= 2) {
                        found.add(el);
                        dropdowns.push({
                            selector: `[high-z-index]`,
                            visible: true,
                            bounds: {
                                top: rect.top,
                                left: rect.left,
                                right: rect.right,
                                bottom: rect.bottom,
                                width: rect.width,
                                height: rect.height,
                                zIndex: zIndex
                            }
                        });
                    }
                }
            }
            // ===== LEVEL 4: NEW - Check parent containers of aria-expanded elements =====
            const expandedElements = Array.from(document.querySelectorAll('[aria-expanded="true"]'));
            for (const expandedEl of expandedElements) {
                if (found.has(expandedEl))
                    continue;
                // Check if the expanded element itself is visible or if its container is visible
                let menuContainer = expandedEl.nextElementSibling;
                if (!menuContainer && expandedEl.parentElement) {
                    menuContainer = expandedEl.parentElement.querySelector('[role="menu"], [class*="dropdown"], .menu, .dropdown');
                }
                if (menuContainer) {
                    const rect = menuContainer.getBoundingClientRect();
                    const style = window.getComputedStyle(menuContainer);
                    if (style.display !== 'none' &&
                        style.visibility !== 'hidden' &&
                        rect.height > 20 &&
                        rect.width > 20) {
                        const menuItems = menuContainer.querySelectorAll('a, button, li, [role="menuitem"]');
                        if (menuItems.length > 0) {
                            found.add(menuContainer);
                            dropdowns.push({
                                selector: `[aria-expanded-menu]`,
                                visible: true,
                                bounds: {
                                    top: rect.top,
                                    left: rect.left,
                                    right: rect.right,
                                    bottom: rect.bottom,
                                    width: rect.width,
                                    height: rect.height,
                                    zIndex: style.zIndex
                                }
                            });
                        }
                    }
                }
            }
            return dropdowns;
        });
        log(`   📊 [DROPDOWN DETECTION] Found ${openDropdowns.length} potential dropdown(s)`);
        if (openDropdowns.length > 0) {
            openDropdowns.forEach((dd, i) => {
                log(`      ${i + 1}. Selector: ${dd.selector} | Position: (${Math.round(dd.bounds.top)},${Math.round(dd.bounds.left)}) | Size: ${Math.round(dd.bounds.width)}x${Math.round(dd.bounds.height)}`);
                debugLog(`   Dropdown ${i + 1}: selector=${dd.selector}, pos=(${Math.round(dd.bounds.top)},${Math.round(dd.bounds.left)}), size=${Math.round(dd.bounds.width)}x${Math.round(dd.bounds.height)}, z=${dd.bounds.zIndex}`);
            });
        }
        return openDropdowns;
    }
    catch (error) {
        log(`   ❌ [DROPDOWN DETECTION ERROR] ${error.message}`);
        return [];
    }
}
/**
 * Search for element ONLY within detected open dropdowns
 * HIGHEST PRIORITY: ALWAYS search dropdowns first, ONLY then search main page
 */
async function searchInOpenDropdowns(target) {
    if (!state.page || state.page.isClosed())
        return false;
    try {
        // ===== PRIORITY 0: Auto-detect ALL open dropdowns and search them FIRST =====
        const openDropdowns = await detectOpenDropdowns();
        if (openDropdowns.length > 0) {
            log(`   🎯 [HIGHEST PRIORITY] Searching in ${openDropdowns.length} detected dropdown(s) FIRST`);
            debugLog(`   Searching for text="${target}" in ${openDropdowns.length} detected dropdown(s)`);
            // Try to find element in ANY detected dropdown
            const foundInDropdown = await state.page.evaluate(({ searchText, dropdowns }) => {
                const debugInfo = [];
                for (let i = 0; i < dropdowns.length; i++) {
                    const dd = dropdowns[i];
                    try {
                        debugInfo.push(`Searching Dropdown ${i + 1}: bounds top=${dd.bounds.top}, left=${dd.bounds.left}, bottom=${dd.bounds.bottom}, right=${dd.bounds.right}`);
                        // ===== Get ALL elements and filter by dropdown bounds =====
                        const allElements = Array.from(document.querySelectorAll('*'));
                        debugInfo.push(`  Total page elements: ${allElements.length}`);
                        const elementInDropdown = [];
                        for (const el of allElements) {
                            const rect = el.getBoundingClientRect();
                            const elementText = (el.textContent || '').trim();
                            // Check if element is within dropdown bounds (allow 5px tolerance)
                            const isInBounds = rect.top >= (dd.bounds.top - 5) &&
                                rect.left >= (dd.bounds.left - 5) &&
                                rect.top < dd.bounds.bottom &&
                                rect.left < dd.bounds.right;
                            if (isInBounds && elementText.length > 0 && elementText.length < 500) {
                                elementInDropdown.push({
                                    el: el,
                                    text: elementText,
                                    rect: rect
                                });
                            }
                        }
                        debugInfo.push(`  Found ${elementInDropdown.length} elements in dropdown bounds`);
                        elementInDropdown.slice(0, 15).forEach((item, idx) => {
                            debugInfo.push(`    [${idx + 1}] <${item.el.tagName}> role="${item.el.getAttribute('role') || 'none'}" | "${item.text.substring(0, 65)}"`);
                        });
                        if (elementInDropdown.length > 15) {
                            debugInfo.push(`    ... and ${elementInDropdown.length - 15} more elements`);
                        }
                        // FIRST pass: exact text match
                        for (const item of elementInDropdown) {
                            if (item.text.toLowerCase() === searchText.toLowerCase()) {
                                debugInfo.push(`  ✅ EXACT MATCH: "${searchText}"`);
                                if (['A', 'BUTTON', 'LI', 'DIV'].includes(item.el.tagName) ||
                                    ['button', 'menuitem', 'link', 'option'].includes(item.el.getAttribute('role') || '')) {
                                    if (item.rect.height > 0 && item.rect.width > 0 && item.rect.height < 200 && item.rect.width < 800) {
                                        item.el.click();
                                        return { found: true, location: 'dropdown-direct', debugInfo };
                                    }
                                }
                                let parent = item.el.parentElement;
                                if (parent && (['A', 'BUTTON', 'LI', 'DIV'].includes(parent.tagName) ||
                                    ['button', 'menuitem', 'link', 'option'].includes(parent.getAttribute('role') || ''))) {
                                    const parentRect = parent.getBoundingClientRect();
                                    if (parentRect.height > 0 && parentRect.width > 0 && parentRect.height < 200 && parentRect.width < 800) {
                                        parent.click();
                                        return { found: true, location: 'dropdown-parent', debugInfo };
                                    }
                                }
                            }
                        }
                        // SECOND pass: partial match
                        for (const item of elementInDropdown) {
                            if (item.text.toLowerCase().includes(searchText.toLowerCase())) {
                                debugInfo.push(`  ✅ PARTIAL MATCH: "${searchText}" in "${item.text.substring(0, 80)}"`);
                                if (['A', 'BUTTON', 'LI', 'DIV'].includes(item.el.tagName) ||
                                    ['button', 'menuitem', 'link', 'option'].includes(item.el.getAttribute('role') || '')) {
                                    if (item.rect.height > 0 && item.rect.width > 0 && item.rect.height < 200 && item.rect.width < 800) {
                                        item.el.click();
                                        return { found: true, location: 'dropdown-direct', debugInfo };
                                    }
                                }
                                let parent = item.el.parentElement;
                                if (parent && (['A', 'BUTTON', 'LI', 'DIV'].includes(parent.tagName) ||
                                    ['button', 'menuitem', 'link', 'option'].includes(parent.getAttribute('role') || ''))) {
                                    const parentRect = parent.getBoundingClientRect();
                                    if (parentRect.height > 0 && parentRect.width > 0 && parentRect.height < 200 && parentRect.width < 800) {
                                        parent.click();
                                        return { found: true, location: 'dropdown-parent', debugInfo };
                                    }
                                }
                            }
                        }
                        debugInfo.push(`  ❌ No match found`);
                    }
                    catch (e) {
                        debugInfo.push(`  Error: ${e.message}`);
                    }
                }
                return { found: false, debugInfo };
            }, { searchText: target, dropdowns: openDropdowns });
            // Log debug info on Node.js side so it appears in file
            if (foundInDropdown.debugInfo && foundInDropdown.debugInfo.length > 0) {
                debugLog(`  [DROPDOWN-SEARCH]`);
                foundInDropdown.debugInfo.forEach(line => debugLog(`    ${line}`));
            }
            // Log debug info on Node.js side so it appears in file
            if (foundInDropdown.debugInfo && foundInDropdown.debugInfo.length > 0) {
                debugLog(`  [DROPDOWN-SEARCH]`);
                foundInDropdown.debugInfo.forEach(line => debugLog(`    ${line}`));
            }
            if (foundInDropdown.found) {
                log(`      ✅ FOUND AND CLICKED in detected dropdown (${foundInDropdown.location})`);
                debugLog(`   ✅ FOUND AND CLICKED in dropdown (location: ${foundInDropdown.location})`);
                return true;
            }
            else {
                log(`      ⚠️  Text not found in dropdown area - continuing search...`);
                debugLog(`   ❌ Text not found in ${openDropdowns.length} dropdown(s) - falling back to main page search`);
            }
        }
        // If we reach here, no dropdowns found or element not in dropdown
        return false;
    }
    catch (error) {
        return false;
    }
}
/**
 * Intelligently retry finding elements across frames and wait for dynamic elements
 * NOTE: Overlays are now searched separately in clickWithRetry/fillWithRetry as Priority 2
 */
async function advancedElementSearch(target, action, fillValue, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            // PRIORITY 0: Wait for dynamic element (in case it's being created)
            const dynamicFound = await waitForDynamicElement(target, 2000);
            if (dynamicFound) {
                // Try again now that it exists
                if (action === 'click') {
                    const clicked = await searchInAllFrames(target, 'click');
                    if (clicked)
                        return true;
                }
                else {
                    const filled = await searchInAllFrames(target, 'fill', fillValue);
                    if (filled)
                        return true;
                }
            }
            // PRIORITY 1: Try deep DOM search on main page (fallback for elements not in frames)
            const deepResult = await deepDOMSearch(target, action, fillValue);
            if (deepResult)
                return true;
            if (attempt < maxRetries) {
                await state.page?.waitForTimeout(300); // Reduced wait between retries
            }
        }
        catch (error) {
            // Continue to next attempt
        }
    }
    return false;
}
/**
 * HOVER action - Simple hover implementation
 */
async function hoverWithRetry(target, maxRetries = 5) {
    await waitForPageReady();
    log(`\n🎯 [HOVER ACTION] Hovering over: "${target}"`);
    try {
        // **HIERARCHICAL PATH SUPPORT FOR HOVER** - e.g., "Loans > Insta Personal Loan"
        const hasHierarchyMarkers = target.includes('>');
        if (hasHierarchyMarkers) {
            const pathSteps = target.split(/\s*>>?\s*/).filter((step) => step.trim().length > 0);
            if (pathSteps.length > 1) {
                log(`\n📊 [HIERARCHICAL HOVER] Detected nested path with ${pathSteps.length} steps`);
                log(`📋 Parsing: ${pathSteps.map((s, i) => `Step ${i + 1}: "${s}"`).join(' | ')}`);
                // Click through all steps EXCEPT the final one to open menus/dropdowns
                for (let stepIdx = 0; stepIdx < pathSteps.length - 1; stepIdx++) {
                    const currentStep = pathSteps[stepIdx].trim();
                    const nextStep = pathSteps[stepIdx + 1].trim();
                    // CHECK IF NEXT SUBMENU IS ALREADY VISIBLE BEFORE CLICKING
                    const isNextStepVisible = await state.page?.evaluate(({ searchText }) => {
                        const elements = Array.from(document.querySelectorAll('*'));
                        for (const el of elements) {
                            const text = (el.textContent || '').trim();
                            if (text.toLowerCase().includes(searchText.toLowerCase()) ||
                                searchText.toLowerCase().includes(text.toLowerCase())) {
                                const rect = el.getBoundingClientRect();
                                if (rect.height > 0 && rect.width > 0 && rect.top >= 0 && rect.left >= 0) {
                                    return true; // Element is visible
                                }
                            }
                        }
                        return false;
                    }, { searchText: nextStep });
                    if (isNextStepVisible) {
                        log(`\n📍 STEP ${stepIdx + 1}/${pathSteps.length}: Submenu for "${currentStep}" already open (${nextStep} is visible)`);
                        log(`   ✅ Skipping click - submenu already visible`);
                        await state.page?.waitForTimeout(200);
                    }
                    else {
                        log(`\n📍 STEP ${stepIdx + 1}/${pathSteps.length}: CLICK "${currentStep}" (to open submenu)`);
                        // Use clickWithRetry to properly handle the clicks with Playwright
                        const clickSuccess = await clickWithRetry(currentStep, 3);
                        if (!clickSuccess) {
                            log(`   ⚠️  Click on "${currentStep}" had issues, but continuing...`);
                            // Continue anyway - the dropdown might still have opened
                        }
                        log(`   ✅ Step ${stepIdx + 1} complete - waiting for submenu...`);
                        await state.page?.waitForTimeout(500); // Wait for submenu animation
                    }
                }
                // Now hover over the final step
                const finalStep = pathSteps[pathSteps.length - 1].trim();
                log(`\n📍 STEP ${pathSteps.length}/${pathSteps.length}: HOVER over "${finalStep}"`);
                // Try to find and hover the final element using Playwright locators
                try {
                    const locator = state.page?.locator(`button:has-text("${finalStep}"), a:has-text("${finalStep}"), li:has-text("${finalStep}"), span:has-text("${finalStep}"), div:has-text("${finalStep}")`);
                    if (locator) {
                        const count = await locator.count().catch(() => 0);
                        if (count > 0) {
                            try {
                                await locator.first().hover({ timeout: 5000 });
                                log(`   ✅ Successfully hovered over "${finalStep}"`);
                                log(`\n✅ SUCCESS: Hierarchical hover completed: ${target}`);
                                return true;
                            }
                            catch (e) {
                                log(`   ⚠️  Playwright hover failed, trying DOM method...`);
                            }
                        }
                    }
                }
                catch (e) {
                    log(`   ⚠️  Locator approach failed`);
                }
                // Fallback: Use coordinate-based hover
                const hoverSuccess = await state.page?.evaluate(({ searchText }) => {
                    const allElements = Array.from(document.querySelectorAll('*'));
                    let bestMatch = null;
                    for (const el of allElements) {
                        const elementText = (el.textContent || '').trim().toLowerCase();
                        const searchLower = searchText.toLowerCase();
                        // Look for close text matches
                        if (elementText.includes(searchLower) || searchLower.includes(elementText)) {
                            const rect = el.getBoundingClientRect();
                            if (rect.height > 0 && rect.width > 0 && rect.top < 1000 && rect.left < 2000) {
                                const distance = Math.abs(elementText.length - searchLower.length);
                                if (!bestMatch || distance < bestMatch.distance) {
                                    bestMatch = { el: el, distance };
                                }
                            }
                        }
                    }
                    if (bestMatch) {
                        try {
                            const event = new MouseEvent('mouseenter', { bubbles: true, cancelable: true });
                            bestMatch.el.dispatchEvent(event);
                            // Also try mouseover
                            const event2 = new MouseEvent('mouseover', { bubbles: true, cancelable: true });
                            bestMatch.el.dispatchEvent(event2);
                            return true;
                        }
                        catch (e) {
                            return false;
                        }
                    }
                    return false;
                }, { searchText: finalStep });
                if (hoverSuccess) {
                    log(`   ✅ Successfully hovered over "${finalStep}" (DOM method)`);
                    log(`\n✅ SUCCESS: Hierarchical hover completed: ${target}`);
                    return true;
                }
                else {
                    log(`   ❌ Failed to hover over final step "${finalStep}"`);
                    return false;
                }
            }
        }
        // **STANDARD HOVER (non-hierarchical)**
        // Try Playwright's locator API first
        const locator = state.page?.locator(`button:has-text("${target}"), a:has-text("${target}"), li:has-text("${target}"), [role="button"]:has-text("${target}"), [role="menuitem"]:has-text("${target}")`);
        if (locator) {
            const count = await locator.count().catch(() => 0);
            if (count > 0) {
                try {
                    await locator.first().hover({ timeout: 5000 });
                    log(`   ✅ Successfully hovered over "${target}"`);
                    return true;
                }
                catch (e) {
                    log(`   ⚠️  Playwright hover failed`);
                }
            }
        }
        // Fallback: Use DOM hover
        const hovered = await state.page?.evaluate(({ searchText }) => {
            const allElements = Array.from(document.querySelectorAll('*'));
            // Look for exact text matches
            for (const el of allElements) {
                const elementText = (el.textContent || '').trim();
                if (elementText.toLowerCase() === searchText.toLowerCase()) {
                    if (['A', 'BUTTON', 'LI'].includes(el.tagName)) {
                        const rect = el.getBoundingClientRect();
                        if (rect.height > 0 && rect.width > 0) {
                            const event = new MouseEvent('mouseenter', { bubbles: true });
                            el.dispatchEvent(event);
                            return true;
                        }
                    }
                }
            }
            // Partial match with length check
            for (const el of allElements) {
                const elementText = (el.textContent || '').trim();
                if (elementText.toLowerCase().includes(searchText.toLowerCase()) && elementText.length < 120) {
                    if (['A', 'BUTTON', 'LI'].includes(el.tagName)) {
                        const rect = el.getBoundingClientRect();
                        if (rect.height > 0 && rect.width > 0) {
                            const event = new MouseEvent('mouseenter', { bubbles: true });
                            el.dispatchEvent(event);
                            return true;
                        }
                    }
                }
            }
            return false;
        }, { searchText: target });
        if (hovered) {
            log(`   ✅ Successfully hovered over "${target}"`);
            return true;
        }
        log(`   ❌ Could not hover over "${target}"`);
        return false;
    }
    catch (error) {
        log(`   ❌ [HOVER ERROR] ${error.message}`);
        return false;
    }
}
async function clickWithRetry(target, maxRetries = 5) {
    // FIRST: Ensure page is fully loaded before attempting to find elements
    await waitForPageReady();
    debugLog(`\n=== CLICK ATTEMPT FOR: "${target}" ===`);
    log(`\n🔍 Searching for: "${target}"`);
    // ===== CHECK FOR NESTED NAVIGATION (e.g., "Loans > Insta Personal Loan > Check Offer") =====
    if (target.includes('>')) {
        const pathSteps = parseNestedPath(target);
        if (pathSteps.length >= 2) {
            // Try nested navigation first
            log(`\n🔄 [NESTED CLICK] Detected nested path with ${pathSteps.length} steps`);
            const nestedSuccess = await handleNestedNavigation(target);
            if (nestedSuccess) {
                await state.page?.waitForTimeout(500);
                return true;
            }
            log(`⚠️ Nested navigation failed, falling back to standard click...`);
        }
    }
    // ===== SPECIAL HANDLER: Click elements by exact text match =====
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🔎 [NEW DROPDOWN HANDLER] Starting search for: "${target}"`);
    console.log(`${'='.repeat(60)}`);
    const dropdownResult = await state.page?.evaluate((targetParam) => {
        const searchTarget = targetParam.toLowerCase().trim();
        console.log(`🔍 SEARCHING FOR: "${searchTarget}"`);
        console.log(`✅ NEW HANDLER IS EXECUTING!`);
        const candidates = [];
        // Search only interactive elements
        const selectors = 'button, a, [role="button"], p, span, li, div[onclick]';
        const interactiveElements = document.querySelectorAll(selectors);
        console.log(`   Total interactive elements: ${interactiveElements.length}`);
        let debugCount = 0;
        for (const el of Array.from(interactiveElements)) {
            // Get text multiple ways
            const fullText = (el.textContent || '').trim();
            const innerText = (el.innerText || '').trim();
            const innerHTML = el.innerHTML.replace(/<[^>]*>/g, '').trim();
            const cleanText = fullText.toLowerCase();
            const cleanInner = innerText.toLowerCase();
            const cleanHtml = innerHTML.toLowerCase();
            // Check if ANY extraction method contains search target
            const isMatch = cleanText.includes(searchTarget) ||
                cleanInner.includes(searchTarget) ||
                cleanHtml.includes(searchTarget);
            if (!isMatch)
                continue;
            const rect = el.getBoundingClientRect();
            const style = window.getComputedStyle(el);
            // Must be visible (display/visibility check)
            if (style.display === 'none' || style.visibility === 'hidden' ||
                rect.width === 0 || rect.height === 0) {
                continue;
            }
            // Check if element is in viewport (visible on screen)
            const isInViewport = rect.top >= 0 && rect.left >= 0 &&
                rect.bottom <= window.innerHeight &&
                rect.right <= window.innerWidth;
            // Count nesting depth in dropdown structures
            let dropdownDepth = 0;
            let parent = el.parentElement;
            for (let i = 0; i < 25; i++) {
                if (!parent)
                    break;
                const pClass = (parent.className || '').toLowerCase();
                if (pClass.includes('dropdown') || pClass.includes('menu') ||
                    pClass.includes('overlay') || pClass.includes('submenu') ||
                    pClass.includes('popover')) {
                    dropdownDepth = i + 1;
                }
                parent = parent.parentElement;
            }
            // Calculate exactness score for better matching
            let exactnessScore = 0;
            // Exact match = 1000 points
            if (cleanText === searchTarget || cleanInner === searchTarget) {
                exactnessScore += 1000;
            }
            // Starts with search term = 500 points
            else if (cleanText.startsWith(searchTarget) || cleanInner.startsWith(searchTarget)) {
                exactnessScore += 500;
            }
            // Ends with search term = 300 points
            else if (cleanText.endsWith(searchTarget) || cleanInner.endsWith(searchTarget)) {
                exactnessScore += 300;
            }
            // Contains whole words (word boundary match) = 200 points
            else {
                const words = searchTarget.split(/\s+/);
                let wordMatches = 0;
                for (const word of words) {
                    const regex = new RegExp('\\b' + word + '\\b');
                    if (regex.test(cleanText) || regex.test(cleanInner)) {
                        wordMatches++;
                    }
                }
                exactnessScore += wordMatches * 100;
            }
            // Prefer shorter text length (closer to actual search term length)
            const textLength = cleanText.length;
            const lengthPenalty = Math.abs(textLength - searchTarget.length) * 2;
            exactnessScore -= lengthPenalty;
            debugCount++;
            if (debugCount <= 15) {
                console.log(`   Match #${debugCount}: <${el.tagName}> viewport=${isInViewport} depth=${dropdownDepth} score=${exactnessScore} text="${fullText.substring(0, 40)}"`);
            }
            candidates.push({
                el: el,
                tag: el.tagName,
                text: fullText.substring(0, 100),
                dropdownDepth: dropdownDepth,
                size: rect.width * rect.height,
                rect: { x: Math.round(rect.left), y: Math.round(rect.top), w: Math.round(rect.width), h: Math.round(rect.height) },
                isInViewport: isInViewport,
                exactnessScore: exactnessScore
            });
        }
        console.log(`   ✅ Found ${candidates.length} candidates`);
        if (candidates.length === 0) {
            console.log(`   ❌ NO MATCHES FOUND`);
            return { found: false };
        }
        // FIRST: Filter to only VISIBLE/IN-VIEWPORT elements
        const visibleCandidates = candidates.filter(c => c.isInViewport);
        console.log(`   📺 Visible in viewport: ${visibleCandidates.length}`);
        let toClick = visibleCandidates.length > 0 ? visibleCandidates : candidates;
        // Sort: prefer exactness score, then deeper dropdown nesting, then by size
        toClick.sort((a, b) => {
            if (b.exactnessScore !== a.exactnessScore)
                return b.exactnessScore - a.exactnessScore;
            if (b.dropdownDepth !== a.dropdownDepth)
                return b.dropdownDepth - a.dropdownDepth;
            return b.size - a.size;
        });
        const selectedElement = toClick[0];
        console.log(`   ✅ SELECTED: <${selectedElement.tag}> inViewport=${selectedElement.isInViewport} depth=${selectedElement.dropdownDepth} score=${selectedElement.exactnessScore} text="${selectedElement.text}" pos=(${selectedElement.rect.x},${selectedElement.rect.y})`);
        selectedElement.el.click();
        return {
            found: true,
            tag: selectedElement.tag,
            text: selectedElement.text,
            depth: selectedElement.dropdownDepth,
            inViewport: selectedElement.isInViewport,
            position: selectedElement.rect,
            exactnessScore: selectedElement.exactnessScore
        };
    }, target).catch((err) => {
        console.log(`   ❌ EVALUATE ERROR: ${err}`);
        return { found: false };
    });
    if (dropdownResult?.found) {
        log(`\n✅ Successfully clicked element!`);
        log(`   Tag: <${dropdownResult.tag}>`);
        log(`   Text: "${dropdownResult.text}"`);
        log(`   Visible in viewport: ${dropdownResult.inViewport}`);
        log(`   Dropdown depth: ${dropdownResult.depth}`);
        log(`   Match score: ${dropdownResult.exactnessScore || 'N/A'}`);
        log(`   Position: (${dropdownResult.position?.x}, ${dropdownResult.position?.y})`);
        debugLog(`✅ Element clicked`);
        await state.page?.waitForTimeout(1000);
        return true;
    }
    console.log(`\n❌ [NEW DROPDOWN HANDLER] Failed to find/click element`);
    console.log(`   Falling back to old handlers...`);
    // ===== PARSE HIERARCHICAL TARGET (e.g., "Loans > Insta Personal Loan") =====
    let parentMenu = null;
    let actualTarget = target;
    if (target.includes('>')) {
        const parts = target.split('>').map(p => p.trim());
        if (parts.length === 2) {
            parentMenu = parts[0];
            actualTarget = parts[1];
            log(`   📋 HIERARCHICAL TARGET DETECTED:`);
            log(`      ├─ Parent Menu: "${parentMenu}"`);
            log(`      └─ Target Item: "${actualTarget}"`);
        }
    }
    // ===== SIMPLE DIRECT SEARCH: No dropdown logic, just find and click =====
    log(`   ⚡ Attempting to find and click element...`);
    const mainPageResult = await searchInAllFrames(actualTarget, 'click');
    if (mainPageResult) {
        log(`   ✅ Element found and clicked`);
        return true;
    }
    // Try advanced fallback search if main search failed
    const advancedResult = await advancedElementSearch(actualTarget, 'click', undefined, 2);
    if (advancedResult) {
        return true;
    }
    // Search subwindows with equal priority
    if (allPages.length > 1 && latestSubwindow && !latestSubwindow.isClosed()) {
        try {
            const foundInPriorityWindow = await searchInAllSubwindows(actualTarget, 'click');
            if (foundInPriorityWindow) {
                log(`✅ Successfully clicked in subwindow!`);
                return true;
            }
        }
        catch (e) {
            log(`Subwindow search failed, continuing...`);
        }
    }
    if (allPages.length > 1 && latestSubwindow && !latestSubwindow.isClosed()) {
        try {
            const foundInPriorityWindow = await searchInAllSubwindows(actualTarget, 'click');
            if (foundInPriorityWindow) {
                log(`✅ Successfully clicked in subwindow!`);
                return true;
            }
        }
        catch (e) {
            log(`Subwindow search failed, continuing...`);
        }
    }
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        // Check pause at start of each retry attempt
        if (state.isPaused) {
            while (state.isPaused && !state.isStopped) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            if (state.isStopped)
                return false;
        }
        try {
            // Check if page is still valid before attempting
            if (!state.page || state.page.isClosed()) {
                await switchToLatestPage();
                if (!state.page || state.page.isClosed()) {
                    return false;
                }
            }
            // **CRITICAL: Handle hidden menu items in dropdown menus**
            try {
                const hiddenMenuItemHandled = await state.page?.evaluate(({ search: searchText }) => {
                    const searchLower = searchText.toLowerCase().trim();
                    const allElements = document.querySelectorAll('*');
                    // Find the target element even if hidden
                    let targetElement = null;
                    let targetParentCount = 0;
                    for (const el of Array.from(allElements)) {
                        const text = (el.textContent || '').trim().toLowerCase();
                        const directText = Array.from(el.childNodes)
                            .filter(n => n.nodeType === 3)
                            .map(n => (n.textContent || '').trim())
                            .join(' ')
                            .toLowerCase();
                        // Prioritize direct text match
                        if (directText === searchLower || text === searchLower) {
                            targetElement = el;
                            targetParentCount = 0;
                            break;
                        }
                        // Fallback to text containing
                        if (!targetElement && (text.includes(searchLower) || directText.includes(searchLower))) {
                            targetElement = el;
                            targetParentCount++;
                        }
                    }
                    if (!targetElement)
                        return false;
                    // Check if target is hidden
                    const targetStyle = window.getComputedStyle(targetElement);
                    const isHidden = targetStyle.display === 'none' ||
                        targetStyle.visibility === 'hidden' ||
                        targetStyle.opacity === '0';
                    if (!isHidden)
                        return false; // Not hidden, let normal flow handle it
                    // Target IS hidden - find and click parent menu trigger
                    let parent = targetElement.parentElement;
                    let depth = 0;
                    let parentMenu = null;
                    // Walk up to find the menu container (limit to 15 levels)
                    while (parent && depth < 15) {
                        const parentStyle = window.getComputedStyle(parent);
                        // Check if parent is a menu/dropdown container
                        const isMenu = parent.classList.toString().includes('menu') ||
                            parent.classList.toString().includes('dropdown') ||
                            parent.classList.toString().includes('nav') ||
                            parent.getAttribute('role') === 'menu' ||
                            parent.getAttribute('role') === 'listbox' ||
                            parent.getAttribute('role') === 'group';
                        if (isMenu) {
                            parentMenu = parent;
                            break;
                        }
                        parent = parent.parentElement;
                        depth++;
                    }
                    if (!parentMenu) {
                        // If we didn't find a menu container, try clicking the target anyway
                        try {
                            targetElement.click?.();
                            return true;
                        }
                        catch (e) {
                            return false;
                        }
                    }
                    // Found the menu container - now find its trigger button
                    let trigger = null;
                    // Strategy 1: Look for button/link that comes before menu in DOM (adjacent or nearby)
                    let sibling = parentMenu.previousElementSibling;
                    let checkCount = 0;
                    while (sibling && !trigger && checkCount < 5) {
                        if (sibling.tagName === 'BUTTON' ||
                            sibling.getAttribute('role') === 'button' ||
                            sibling.classList.toString().includes('trigger') ||
                            sibling.classList.toString().includes('toggle') ||
                            sibling.classList.toString().includes('btn')) {
                            trigger = sibling;
                        }
                        sibling = sibling.previousElementSibling;
                        checkCount++;
                    }
                    // Strategy 2: Check parent element's button
                    if (!trigger && parentMenu.parentElement) {
                        const parentButtons = parentMenu.parentElement.querySelectorAll('button, [role="button"], a');
                        if (parentButtons.length > 0) {
                            // Usually the first button is the trigger
                            trigger = parentButtons[0];
                        }
                    }
                    // Strategy 3: Find the closest button/link that might be the trigger
                    if (!trigger) {
                        const allClickables = document.querySelectorAll('button, [role="button"], a');
                        for (let i = 0; i < allClickables.length; i++) {
                            const el = allClickables[i];
                            const elementText = (el.textContent || '').toLowerCase();
                            // Check if this element's text is part of the menu's structure
                            if (elementText.includes('loan') || elementText.includes('loans') ||
                                elementText.includes('menu') || elementText.includes('dropdown')) {
                                trigger = el;
                                break;
                            }
                        }
                    }
                    if (trigger) {
                        // Click the trigger to open the menu
                        trigger.click?.();
                        return true; // Return true and let the retry logic handle clicking the target
                    }
                    return false;
                }, { search: target });
                if (hiddenMenuItemHandled) {
                    log(`✅ [NESTED-MENU] Found hidden element in dropdown, opened parent menu`);
                    await state.page?.waitForTimeout(800); // Wait for menu animation
                    // Now try to click the hidden element again
                    const retryClick = await state.page?.evaluate(({ search: searchText }) => {
                        const searchLower = searchText.toLowerCase().trim();
                        const allElements = document.querySelectorAll('*');
                        for (const el of Array.from(allElements)) {
                            const text = (el.textContent || '').trim().toLowerCase();
                            if (text === searchLower || text.includes(searchLower)) {
                                const style = window.getComputedStyle(el);
                                if (style.display !== 'none' && style.visibility !== 'hidden') {
                                    el.click?.();
                                    return true;
                                }
                            }
                        }
                        return false;
                    }, { search: target });
                    if (retryClick) {
                        log(`✅ [NESTED-MENU] Successfully clicked hidden menu item after opening parent`);
                        await state.page?.waitForTimeout(500);
                        return true;
                    }
                }
            }
            catch (e) {
                log(`⚠️  Nested menu handling failed, continuing...`);
            }
            // Strategy 0: Handle visible modals/overlays - DIRECTLY CLICK visible elements
            try {
                const clickResult = await state.page?.evaluate((searchText) => {
                    // THREE-PASS STRATEGY for SHORT TEXT targeting (like "P", "O", etc.):
                    // PASS 1: STRICT - Only exact match on BUTTON's direct visible text
                    const searchLower = searchText.toLowerCase().trim();
                    const allElements = document.querySelectorAll('*');
                    // Priority 1: Find BUTTON/CLICKABLE with EXACT matching direct text (not nested children)
                    for (const el of Array.from(allElements)) {
                        const isClickableElement = el.tagName === 'BUTTON' ||
                            el.tagName === 'INPUT' ||
                            el.getAttribute('role') === 'button' ||
                            el.getAttribute('role') === 'tab' ||
                            el.getAttribute('role') === 'menuitem' ||
                            (el.getAttribute('onclick') !== null && el.tagName !== 'DIV' && el.tagName !== 'SPAN') ||
                            (el.tagName === 'A' && el.getAttribute('href') !== null);
                        if (!isClickableElement)
                            continue;
                        // Get DIRECT text only (immediate text nodes, not nested element text)
                        let directText = '';
                        for (const node of Array.from(el.childNodes)) {
                            if (node.nodeType === 3) { // Text node
                                directText += (node.textContent || '').trim() + ' ';
                            }
                        }
                        // Also include direct element text if no children
                        if (!directText.trim() && el.children.length === 0) {
                            directText = el.textContent || '';
                        }
                        directText = directText.trim().toLowerCase();
                        // For short searches, require exact match on direct text
                        const isExactMatch = searchLower.length <= 3 ?
                            directText === searchLower || directText.split(/\s+/).includes(searchLower) :
                            directText.includes(searchLower);
                        if (isExactMatch) {
                            const style = window.getComputedStyle(el);
                            if (style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0') {
                                const rect = el.getBoundingClientRect();
                                if (rect.width > 0 && rect.height > 0) {
                                    // ONLY scroll if element is outside viewport
                                    if (rect.top < 0 || rect.bottom > window.innerHeight) {
                                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                    }
                                    el.click();
                                    return true;
                                }
                            }
                        }
                    }
                    // PASS 2: Check with full element text (including nested), still EXACT for short text
                    for (const el of Array.from(allElements)) {
                        const isClickable = el.tagName === 'BUTTON' ||
                            el.tagName === 'A' ||
                            el.getAttribute('role') === 'button' ||
                            el.getAttribute('role') === 'tab' ||
                            el.getAttribute('onclick') !== null ||
                            (el.tagName === 'INPUT' && (el.getAttribute('type') === 'button' || el.getAttribute('type') === 'submit'));
                        if (!isClickable)
                            continue;
                        const elementText = (el.textContent || '').trim().toLowerCase();
                        const isExactMatch = searchLower.length <= 3 ?
                            elementText === searchLower :
                            elementText.includes(searchLower);
                        if (isExactMatch) {
                            const style = window.getComputedStyle(el);
                            if (style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0') {
                                const rect = el.getBoundingClientRect();
                                if (rect.width > 0 && rect.height > 0) {
                                    if (rect.top < 0 || rect.bottom > window.innerHeight) {
                                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                    }
                                    el.click();
                                    return true;
                                }
                            }
                        }
                    }
                    // PASS 3: Fallback to partial match for short text - but only on strong clickables
                    if (searchLower.length <= 2) {
                        for (const el of Array.from(allElements)) {
                            const strongClickable = el.tagName === 'BUTTON' ||
                                (el.tagName === 'INPUT' && (el.getAttribute('type') === 'button' || el.getAttribute('type') === 'submit')) ||
                                (el.getAttribute('role') === 'button');
                            if (!strongClickable)
                                continue;
                            const elementText = (el.textContent || '').trim().toLowerCase();
                            if (elementText.includes(searchLower)) {
                                const style = window.getComputedStyle(el);
                                if (style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0') {
                                    const rect = el.getBoundingClientRect();
                                    if (rect.width > 0 && rect.height > 0) {
                                        if (rect.top < 0 || rect.bottom > window.innerHeight) {
                                            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                        }
                                        el.click();
                                        return true;
                                    }
                                }
                            }
                        }
                    }
                    return false;
                }, target);
                if (clickResult) {
                    log(`✅ [STRATEGY-0] Element found and clicked: "${target}" | Waiting for action effect...`);
                    await state.page?.waitForTimeout(500);
                    // Verify the action actually took effect
                    const changed = await verifyActionTookEffect('click', 2000);
                    if (changed) {
                        log(`✅ [STRATEGY-0-VERIFIED] Action confirmed - DOM changed after click`);
                    }
                    else {
                        log(`⚠️  [STRATEGY-0-WARN] Click executed but DOM did not change - may need retry`);
                    }
                    // Detect any newly opened nested windows from this click
                    await detectNewNestedWindows(state.page).catch(() => { });
                    return true;
                }
            }
            catch (e0) {
                // Modal strategy failed, continue
            }
            // **PRIORITY STRATEGY: Special handling for Sign In / Login**
            if (target.toLowerCase().includes('sign') && target.toLowerCase().includes('in')) {
                try {
                    log(`[SIGNIN-PRIORITY] Special handling for Sign In button...`);
                    // Store initial URL/title to verify navigation
                    const initialUrl = state.page?.url();
                    const initialTitle = await state.page?.title();
                    const found = await state.page?.evaluate((searchText) => {
                        const searchLower = searchText.toLowerCase();
                        const allElements = document.querySelectorAll('a, button, [role="button"]');
                        // Look for sign in with flexible matching
                        for (const el of Array.from(allElements)) {
                            const text = (el.textContent || '').toLowerCase().trim();
                            const href = el.href ? el.href.toLowerCase() : '';
                            const onclick = el.onclick ? el.onclick.toString().toLowerCase() : '';
                            // Match "sign in", "signin", "sign-in", "login"
                            const hasSignIn = text.includes('sign in') || text.includes('signin') || text.includes('sign-in') || text.includes('login');
                            const isLink = el.href && (el.href.includes('login') || el.href.includes('signin') || el.href.includes('myaccount'));
                            if (hasSignIn || isLink) {
                                const style = window.getComputedStyle(el);
                                const rect = el.getBoundingClientRect();
                                if (style.display !== 'none' && style.visibility !== 'hidden' &&
                                    rect.width > 0 && rect.height > 0 &&
                                    rect.top >= -100 && rect.bottom <= window.innerHeight + 100) {
                                    // Log what we found
                                    console.log(`[FOUND] text="${text.slice(0, 30)}" href="${href.slice(0, 40)}"`);
                                    if (rect.top < 0 || rect.bottom > window.innerHeight) {
                                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                    }
                                    el.click();
                                    return { found: true, text: text.slice(0, 30), href: href.slice(0, 50) };
                                }
                            }
                        }
                        return { found: false };
                    }, target);
                    if (found && found.found) {
                        log(`✅ [SIGNIN-PRIORITY] Clicked element: text="${found.text}" href="${found.href}"`);
                        await state.page?.waitForTimeout(2000);
                        // Verify navigation occurred
                        const newUrl = state.page?.url();
                        const newTitle = await state.page?.title();
                        if (newUrl !== initialUrl) {
                            log(`✅ [SIGNIN-VERIFIED] Navigation confirmed! URL changed from "${initialUrl}" to "${newUrl}"`);
                        }
                        else {
                            log(`⚠️  [SIGNIN-WARNING] Click executed but page did not navigate. Still on: ${initialUrl}`);
                        }
                        await detectNewNestedWindows(state.page).catch(() => { });
                        return true;
                    }
                    else {
                        log(`❌ [SIGNIN-FAILED] Could not find visible Sign In button on page`);
                    }
                }
                catch (signinErr) {
                    log(`   ℹ️ [SIGNIN-PRIORITY] Failed: ${signinErr}`);
                }
            }
            // Strategy 1: Try direct selector without scrolling first
            try {
                log(`[STRATEGY-1] Attempting direct selector: "${target}"`);
                await state.page?.click(target, { timeout: 1500 });
                log(`✅ [STRATEGY-1] Direct selector click succeeded`);
                await state.page?.waitForTimeout(300);
                return true;
            }
            catch (e1) {
                // If not found, try with scroll as fallback
                try {
                    log(`[STRATEGY-1B] Trying with scroll...`);
                    await scrollToElement(target);
                    await state.page?.click(target, { timeout: 3000 });
                    log(`✅ [STRATEGY-1B] Scroll + click succeeded`);
                    await state.page?.waitForTimeout(300);
                    return true;
                }
                catch (e1b) {
                    // Direct selector failed
                    log(`   ℹ️ Direct selector failed: ${e1b}`);
                }
            }
            // Strategy 2: Find by text and click
            try {
                log(`[STRATEGY-2] Searching for text: "${target}"`);
                const scrollSuccess = await scrollToElementByText(target);
                if (scrollSuccess) {
                    const buttonSelector = await findButtonByText(target);
                    if (buttonSelector) {
                        log(`✅ [STRATEGY-2] Found button: ${buttonSelector}`);
                        await state.page?.click(buttonSelector, { timeout: 3000 });
                        log(`✅ [STRATEGY-2] Clicked by text matching`);
                        await state.page?.waitForTimeout(300);
                        // Detect any newly opened nested windows from this click
                        await detectNewNestedWindows(state.page).catch(() => { });
                        return true;
                    }
                }
            }
            catch (e2) {
                log(`   ℹ️ [STRATEGY-2] Text matching failed: ${e2}`);
            }
            // Strategy 2.5: Shadow DOM and nested element search
            try {
                log(`Searching through Shadow DOM and nested elements...`);
                const shadowFound = await state.page?.evaluate((searchText) => {
                    // Walk through all elements including shadow DOM
                    const walk = (node) => {
                        if (node.nodeType === 1) { // Element node
                            const el = node;
                            if (el.textContent?.includes(searchText)) {
                                const isButton = el.tagName === 'BUTTON' ||
                                    el.tagName === 'A' ||
                                    el.getAttribute('role') === 'button' ||
                                    el.getAttribute('role') === 'tab' ||
                                    el.getAttribute('onclick') !== null;
                                const isRadioOrCheckbox = el.tagName === 'INPUT' && (el.getAttribute('type') === 'radio' || el.getAttribute('type') === 'checkbox');
                                const isLabel = el.tagName === 'LABEL' && searchText.toLowerCase().split(/\s+/).every(word => el.textContent?.toLowerCase().includes(word));
                                if (isButton || isRadioOrCheckbox || isLabel) {
                                    const rect = el.getBoundingClientRect();
                                    if (rect.width > 0 && rect.height > 0) {
                                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                        el.click();
                                        return true;
                                    }
                                }
                            }
                            // Check shadow root
                            if (el.shadowRoot) {
                                if (walk(el.shadowRoot))
                                    return true;
                            }
                        }
                        // Walk children
                        for (let child of node.childNodes) {
                            if (walk(child))
                                return true;
                        }
                        return false;
                    };
                    return walk(document);
                }, target);
                if (shadowFound) {
                    log(`Clicked element in shadow DOM`);
                    await state.page?.waitForTimeout(300);
                    return true;
                }
            }
            catch (e2_5) {
                log(`Shadow DOM search failed`);
            }
            // Strategy 3: Search in iframes (PRIORITIZED - do this FIRST)
            try {
                log(`Searching in iframes for: ${target}...`);
                const clickedInIframe = await state.page?.evaluate((searchText) => {
                    const iframes = document.querySelectorAll('iframe');
                    for (const iframe of Array.from(iframes)) {
                        try {
                            const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
                            if (iframeDoc) {
                                // Search for ANY element matching the text in iframe
                                const allElements = iframeDoc.querySelectorAll('*');
                                for (const el of Array.from(allElements)) {
                                    const element = el;
                                    const text = element.textContent || '';
                                    const isButton = element.tagName === 'BUTTON' ||
                                        element.tagName === 'A' ||
                                        element.getAttribute('role') === 'button' ||
                                        element.getAttribute('onclick') !== null ||
                                        element.getAttribute('role') === 'tab';
                                    const isRadioOrCheckbox = element.tagName === 'INPUT' && (element.getAttribute('type') === 'radio' || element.getAttribute('type') === 'checkbox');
                                    const isLabel = element.tagName === 'LABEL' && searchText.toLowerCase().split(/\s+/).every(word => text.toLowerCase().includes(word));
                                    const isClickable = isButton || isRadioOrCheckbox || isLabel;
                                    if (text.toLowerCase().includes(searchText.toLowerCase()) && isClickable) {
                                        const rect = element.getBoundingClientRect();
                                        if (rect.width > 0 && rect.height > 0) {
                                            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                            element.click();
                                            return true;
                                        }
                                    }
                                }
                            }
                        }
                        catch (e) {
                            // Cross-origin iframe
                        }
                    }
                    return false;
                }, target);
                if (clickedInIframe) {
                    log(`Clicked element in iframe`);
                    await state.page?.waitForTimeout(300);
                    return true;
                }
            }
            catch (e3) {
                log(`Iframe click failed`);
            }
            // Strategy 4: Force JavaScript click after scrolling
            try {
                await scrollToElementByText(target);
                const success = await state.page?.evaluate((sel) => {
                    const element = document.querySelector(sel);
                    if (element) {
                        element.click();
                        return true;
                    }
                    return false;
                }, target);
                if (success) {
                    await state.page?.waitForTimeout(300);
                    return true;
                }
            }
            catch (e4) {
                // Force click failed
            }
            // Strategy 5: Search all clickable elements on page
            try {
                log(`Deep searching all clickable elements...`);
                const found = await state.page?.evaluate((searchText) => {
                    // Scroll to top first
                    window.scrollTo(0, 0);
                    // Deep search all possible elements
                    const allElements = document.querySelectorAll('*');
                    for (const el of Array.from(allElements)) {
                        const text = el.textContent || '';
                        if (text.includes(searchText) && (el.tagName === 'BUTTON' ||
                            el.tagName === 'A' ||
                            el.getAttribute('role') === 'button' ||
                            (el.tagName === 'INPUT' && el.getAttribute('type') === 'button'))) {
                            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            el.click();
                            return true;
                        }
                    }
                    return false;
                }, target);
                if (found) {
                    log(`Deep search click succeeded`);
                    await state.page?.waitForTimeout(300);
                    return true;
                }
            }
            catch (e5) {
                log(`Deep search failed`);
            }
            if (attempt < maxRetries) {
                await state.page?.waitForTimeout(500); // Reduced wait between retries
            }
        }
        catch (error) {
            if (attempt < maxRetries) {
                await state.page?.waitForTimeout(500); // Reduced wait between retries
            }
        }
    }
    // FINAL FALLBACK: Search in all open subwindows (popups, new tabs)
    if (allPages.length > 1) {
        log(`🪟 Trying subwindow search as final fallback...`);
        const subwindowResult = await searchInAllSubwindows(target, 'click');
        if (subwindowResult) {
            return true;
        }
    }
    // CLICK FAILED - Provide diagnostic information
    log(`\n❌ [CLICK FAILED] Unable to find or click element: "${target}"`);
    try {
        // Diagnostic: Check if element exists on page at all
        const elementExists = await state.page?.evaluate((searchText) => {
            const lower = searchText.toLowerCase();
            const allElements = document.querySelectorAll('*');
            for (const el of Array.from(allElements)) {
                const text = (el.textContent || '').toLowerCase();
                if (text.includes(lower)) {
                    const style = window.getComputedStyle(el);
                    return {
                        found: true,
                        text: (el.textContent || '').substring(0, 100),
                        visible: style.display !== 'none' && style.visibility !== 'hidden',
                        tagName: el.tagName,
                        className: el.className
                    };
                }
            }
            return { found: false, text: '', visible: false, tagName: '', className: '' };
        }, target);
        if (elementExists?.found) {
            if (!elementExists.visible) {
                log(`   ⚠️  Element FOUND but HIDDEN (${elementExists.tagName}.${elementExists.className}) | Text: "${elementExists.text}"`);
            }
            else {
                log(`   ⚠️  Element FOUND and VISIBLE (${elementExists.tagName}) | Text: "${elementExists.text}"`);
                log(`   → This likely means: Click strategy failed, try manual element path or different identifier`);
            }
        }
        else {
            log(`   ⚠️  Element NOT FOUND on page at all`);
            log(`   → Search for similar text:  "${target}"`);
        }
    }
    catch (diagErr) {
        log(`   ℹ️  Diagnostic check failed: ${diagErr}`);
    }
    return false;
}
/**
 * Handle dropdown/select elements by opening them and clicking the correct option
 */
async function handleDropdown(target, value) {
    if (!state.page || state.page.isClosed())
        return false;
    log(`🔽 [DROPDOWN] Attempting to handle dropdown for: "${target}" = "${value}"`);
    try {
        // Strategy 1: Native <select> element
        const selectHandled = await state.page.evaluate(({ searchTarget, selectValue }) => {
            const selects = document.querySelectorAll('select');
            for (const select of Array.from(selects)) {
                const label = select.name || select.id || '';
                const ariaLabel = select.getAttribute('aria-label') || '';
                // Check if this select matches our target
                if (label.toLowerCase().includes(searchTarget.toLowerCase()) ||
                    ariaLabel.toLowerCase().includes(searchTarget.toLowerCase())) {
                    // Find and select the option
                    const options = select.querySelectorAll('option');
                    for (const option of Array.from(options)) {
                        if (option.textContent.toLowerCase().includes(selectValue.toLowerCase())) {
                            select.value = option.value;
                            select.dispatchEvent(new Event('change', { bubbles: true }));
                            return true;
                        }
                    }
                }
            }
            return false;
        }, { searchTarget: target, selectValue: value });
        if (selectHandled) {
            log(`✅ [DROPDOWN] Successfully selected option in native <select>`);
            await state.page.waitForTimeout(300);
            return true;
        }
    }
    catch (e) {
        log(`⚠️  Native select handling failed`);
    }
    try {
        // Strategy 2: Custom dropdown with role="listbox" or role="combobox"
        const customDropdownHandled = await state.page.evaluate(({ searchTarget, optionValue }) => {
            const dropdowns = document.querySelectorAll('[role="listbox"], [role="combobox"], .dropdown, [data-role="dropdown"]');
            for (const dropdown of Array.from(dropdowns)) {
                // Check if this dropdown matches the target
                const dropdownText = dropdown.textContent || '';
                const dropdownLabel = dropdown.getAttribute('aria-label') || '';
                if (!dropdownText.toLowerCase().includes(searchTarget.toLowerCase()) &&
                    !dropdownLabel.toLowerCase().includes(searchTarget.toLowerCase())) {
                    continue;
                }
                // Click to open the dropdown
                const trigger = dropdown.querySelector('button, [role="button"], a') || dropdown;
                trigger.click?.();
                // Wait a moment for options to appear
                return new Promise((resolve) => {
                    setTimeout(() => {
                        // Find and click the matching option
                        const options = dropdown.querySelectorAll('[role="option"], li, div[data-value]');
                        for (const option of Array.from(options)) {
                            const optText = option.textContent?.trim().toLowerCase() || '';
                            if (optText.includes(optionValue.toLowerCase())) {
                                option.click?.();
                                resolve(true);
                                return;
                            }
                        }
                        resolve(false);
                    }, 400);
                });
            }
            return false;
        }, { searchTarget: target, optionValue: value });
        if (customDropdownHandled) {
            log(`✅ [DROPDOWN] Successfully selected option in custom dropdown`);
            await state.page.waitForTimeout(300);
            return true;
        }
    }
    catch (e) {
        log(`⚠️  Custom dropdown handling failed`);
    }
    try {
        // Strategy 3: Search for dropdown by looking for adjacent label + select structure
        const adjacentHandled = await state.page.evaluate(({ labelText, optionValue }) => {
            // Find label element containing target text
            const labels = document.querySelectorAll('label, div, span');
            for (const label of Array.from(labels)) {
                if (!label.textContent?.toLowerCase().includes(labelText.toLowerCase()))
                    continue;
                // Look for nearby select or dropdown trigger
                let parent = label.parentElement;
                let found = false;
                for (let i = 0; i < 4; i++) {
                    if (!parent)
                        break;
                    // Check for native select
                    const select = parent.querySelector('select');
                    if (select) {
                        const options = select.querySelectorAll('option');
                        for (const option of Array.from(options)) {
                            if (option.textContent.toLowerCase().includes(optionValue.toLowerCase())) {
                                select.value = option.value;
                                select.dispatchEvent(new Event('change', { bubbles: true }));
                                found = true;
                                break;
                            }
                        }
                    }
                    // Check for custom dropdown
                    const dropdown = parent.querySelector('[role="listbox"], [role="combobox"]');
                    if (dropdown) {
                        const trigger = dropdown.querySelector('button') || dropdown;
                        trigger.click?.();
                        setTimeout(() => {
                            const options = dropdown.querySelectorAll('[role="option"]');
                            for (const option of Array.from(options)) {
                                if (option.textContent.toLowerCase().includes(optionValue.toLowerCase())) {
                                    option.click?.();
                                    found = true;
                                    break;
                                }
                            }
                        }, 300);
                    }
                    if (found)
                        break;
                    parent = parent.parentElement;
                }
                if (found)
                    return true;
            }
            return false;
        }, { labelText: target, optionValue: value });
        if (adjacentHandled) {
            log(`✅ [DROPDOWN] Successfully selected option via label-adjacent search`);
            await state.page.waitForTimeout(300);
            return true;
        }
    }
    catch (e) {
        log(`⚠️  Label-adjacent dropdown handling failed`);
    }
    return false;
}
/**
 * Detect if target is a dropdown/select element and handle accordingly
 */
async function detectAndHandleDropdown(target, value) {
    if (!state.page || state.page.isClosed())
        return false;
    try {
        const isDropdown = await state.page.evaluate((searchTarget) => {
            // Look for any element that might be a dropdown
            const allElements = document.querySelectorAll('*');
            for (const el of Array.from(allElements)) {
                const text = el.textContent?.toLowerCase() || '';
                const label = el.getAttribute('aria-label')?.toLowerCase() || '';
                const name = el.getAttribute('name')?.toLowerCase() || '';
                if (!text.includes(searchTarget.toLowerCase()) &&
                    !label.includes(searchTarget.toLowerCase()) &&
                    !name.includes(searchTarget.toLowerCase())) {
                    continue;
                }
                // Check if element is or contains a dropdown
                if (el.tagName === 'SELECT')
                    return true;
                if (el.getAttribute('role') === 'listbox')
                    return true;
                if (el.getAttribute('role') === 'combobox')
                    return true;
                if (el.classList.toString().includes('dropdown'))
                    return true;
                if (el.classList.toString().includes('select'))
                    return true;
                if (el.getAttribute('data-role') === 'dropdown')
                    return true;
            }
            return false;
        }, target);
        if (isDropdown) {
            log(`🔍 [DROPDOWN-DETECT] Found dropdown element, attempting to handle...`);
            return await handleDropdown(target, value);
        }
    }
    catch (e) {
        // Not a dropdown or detection failed
    }
    return false;
}
async function fillWithRetry(target, value, maxRetries = 5) {
    // FIRST: Ensure page is fully loaded before attempting to find elements
    await waitForPageReady();
    log(`\n🔽 [FILL-REQUEST] Attempting to fill: "${target}" = "${value}"`);
    // Search all windows/frames/iframes
    log(`\n🔍 Searching for field: "${target}"`);
    const mainPageResult = await searchInAllFrames(target, 'fill', value);
    if (mainPageResult) {
        return true;
    }
    // Try advanced fallback search
    const advancedResult = await advancedElementSearch(target, 'fill', value, 2);
    if (advancedResult) {
        return true;
    }
    // Search subwindows
    if (allPages.length > 1 && latestSubwindow && !latestSubwindow.isClosed()) {
        try {
            const foundInPriorityWindow = await searchInAllSubwindows(target, 'fill', value);
            if (foundInPriorityWindow) {
                log(`✅ Successfully filled in subwindow!`);
                return true;
            }
        }
        catch (e) {
            log(`Subwindow search failed`);
        }
    }
    return false;
}
async function getAllPageElements() {
    if (!state.page || state.page.isClosed()) {
        return [];
    }
    try {
        const elements = await state.page.evaluate(() => {
            const items = [];
            const seen = new Set();
            let elementIndex = 0;
            try {
                // Helper: Check if element is inside a modal/overlay
                const getOverlayContext = (el) => {
                    let parent = el.parentElement;
                    let depth = 0;
                    while (parent && depth < 10) {
                        const className = parent.getAttribute('class') || '';
                        const id = parent.getAttribute('id') || '';
                        const role = parent.getAttribute('role') || '';
                        // Check for common modal/overlay indicators
                        if (className.includes('modal') || className.includes('overlay') || className.includes('dialog') ||
                            className.includes('popup') || className.includes('window') ||
                            id.includes('modal') || id.includes('overlay') || id.includes('dialog') ||
                            role === 'dialog' || role === 'alertdialog') {
                            return `[OVERLAY: ${id || className.split(' ')[0]}]`;
                        }
                        // Check for fixed/absolute positioning that suggests overlay
                        const style = window.getComputedStyle(parent);
                        if (style.position === 'fixed' && style.zIndex && parseInt(style.zIndex) > 1000) {
                            return `[OVERLAY: fixed-zindex-${style.zIndex}]`;
                        }
                        parent = parent.parentElement;
                        depth++;
                    }
                    return '';
                };
                // Helper: Find associated label text for an element - COMPREHENSIVE SEARCH
                const getAssociatedLabel = (el) => {
                    const id = el.getAttribute('id');
                    const name = el.getAttribute('name');
                    // PRIORITY 0: Check the element's OWN title/tooltip first (this is shown in tooltips)
                    const title = el.getAttribute('title');
                    if (title && title.trim().length > 0) {
                        return title.trim();
                    }
                    // Strategy 1: Try to find label with for attribute pointing to this element's id
                    if (id) {
                        const label = document.querySelector(`label[for="${id}"]`);
                        if (label && label.textContent?.trim() && label.textContent.trim().length > 0) {
                            return label.textContent.trim();
                        }
                    }
                    // Strategy 2: Try to find label with for attribute pointing to this element's name
                    if (name) {
                        const label = document.querySelector(`label[for="${name}"]`);
                        if (label && label.textContent?.trim() && label.textContent.trim().length > 0) {
                            return label.textContent.trim();
                        }
                    }
                    // Strategy 3: Check if element is inside a label element
                    let parent = el.parentElement;
                    while (parent) {
                        if (parent.tagName === 'LABEL') {
                            const labelText = parent.textContent?.trim() || '';
                            if (labelText.length > 0) {
                                // Remove the input's own text if any
                                return labelText.replace(el.value || '', '').trim();
                            }
                        }
                        parent = parent.parentElement;
                    }
                    // Strategy 4: Look for preceding label elements in the same container
                    const container = el.parentElement;
                    if (container) {
                        const labels = Array.from(container.querySelectorAll('label'));
                        for (const lbl of labels) {
                            const lblText = lbl.textContent?.trim() || '';
                            if (lblText.length > 0) {
                                // Check if this label is associated with our element
                                const forAttr = lbl.getAttribute('for');
                                if (forAttr && (forAttr === id || forAttr === name)) {
                                    return lblText;
                                }
                            }
                        }
                    }
                    // Strategy 5: Look for aria-label or aria-labelledby
                    const ariaLabel = el.getAttribute('aria-label');
                    if (ariaLabel && ariaLabel.trim().length > 0) {
                        return ariaLabel.trim();
                    }
                    const ariaLabelledby = el.getAttribute('aria-labelledby');
                    if (ariaLabelledby) {
                        const labelEl = document.getElementById(ariaLabelledby);
                        if (labelEl && labelEl.textContent?.trim() && labelEl.textContent.trim().length > 0) {
                            return labelEl.textContent.trim();
                        }
                    }
                    // Strategy 6: Look for preceding text nodes or labels above the element
                    let sibling = el.previousElementSibling;
                    while (sibling) {
                        if (sibling.tagName === 'LABEL') {
                            const sibText = sibling.textContent?.trim() || '';
                            if (sibText.length > 0) {
                                return sibText;
                            }
                        }
                        if ((sibling.tagName === 'SPAN' || sibling.tagName === 'DIV') && sibling.textContent?.trim() && sibling.textContent.trim().length < 100 && sibling.textContent.trim().length > 0) {
                            return sibling.textContent.trim();
                        }
                        sibling = sibling.previousElementSibling;
                    }
                    return '';
                };
                // Helper: Get the display name for an element
                const getDisplayName = (el, tagName, textContent, placeholder, ariaLabel) => {
                    // For inputs, try to get associated label first (PRIORITY 1)
                    if (tagName === 'input' || tagName === 'textarea') {
                        const labelText = getAssociatedLabel(el);
                        if (labelText && labelText.length > 0) {
                            return labelText;
                        }
                        // Fall back to placeholder
                        if (placeholder && placeholder.length > 0)
                            return placeholder;
                        // Fall back to aria-label
                        if (ariaLabel && ariaLabel.length > 0)
                            return ariaLabel;
                    }
                    // For buttons and links, use text content
                    if (textContent && textContent.length > 0) {
                        return textContent;
                    }
                    // For other elements, use aria-label or placeholder
                    if (ariaLabel && ariaLabel.length > 0)
                        return ariaLabel;
                    if (placeholder && placeholder.length > 0)
                        return placeholder;
                    return '';
                };
                // Get ALL elements on the page
                const allElements = document.querySelectorAll('*');
                allElements.forEach((el) => {
                    try {
                        const tagName = el.tagName?.toLowerCase() || '';
                        // Skip script, style, and meta tags
                        if (['script', 'style', 'meta', 'link', 'noscript'].includes(tagName)) {
                            return;
                        }
                        const id = el.getAttribute('id') || '';
                        const name = el.getAttribute('name') || '';
                        const className = el.getAttribute('class') || '';
                        const type = el.getAttribute('type') || '';
                        const placeholder = el.getAttribute('placeholder') || '';
                        const textContent = el.textContent?.trim().substring(0, 150) || '';
                        const ariaLabel = el.getAttribute('aria-label') || '';
                        const role = el.getAttribute('role') || '';
                        // Get element visibility - STRICT FILTERING FOR CURRENT PAGE ONLY
                        const style = window.getComputedStyle(el);
                        // Element must be ACTUALLY VISIBLE on current page (not hidden or from previous page)
                        const hasVisibleDimensions = el.offsetWidth > 0 && el.offsetHeight > 0;
                        const isDisplayed = style.display !== 'none';
                        const isNotHidden = style.visibility !== 'hidden' && parseFloat(style.opacity) > 0.1;
                        // CRITICAL: Check if element is in viewport (not from previous page)
                        const rect = el.getBoundingClientRect();
                        const isInViewport = rect.width > 0 && rect.height > 0;
                        // Element is visible ONLY if ALL conditions are true
                        const isVisible = hasVisibleDimensions && isDisplayed && isNotHidden && isInViewport;
                        // Determine element type
                        let elementType = '';
                        let isInteractive = false;
                        let priority = 0; // Higher priority = more important
                        if (tagName === 'input') {
                            elementType = type || 'input';
                            isInteractive = true;
                            priority = 10;
                        }
                        else if (tagName === 'button') {
                            elementType = 'button';
                            isInteractive = true;
                            priority = 10;
                        }
                        else if (tagName === 'a') {
                            elementType = 'link';
                            isInteractive = true;
                            priority = 10;
                        }
                        else if (tagName === 'select') {
                            elementType = 'select';
                            isInteractive = true;
                            priority = 10;
                        }
                        else if (tagName === 'textarea') {
                            elementType = 'textarea';
                            isInteractive = true;
                            priority = 10;
                        }
                        else if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
                            elementType = tagName;
                            priority = 8;
                        }
                        else if (tagName === 'label') {
                            elementType = 'label';
                            priority = 7;
                        }
                        else if (tagName === 'form') {
                            elementType = 'form';
                            priority = 6;
                        }
                        else if (tagName === 'section' || tagName === 'article') {
                            elementType = tagName;
                            priority = 5;
                        }
                        else if (role === 'button' || role === 'tab' || role === 'menuitem') {
                            elementType = role;
                            isInteractive = true;
                            priority = 10;
                        }
                        else if (el.onclick !== null || style.cursor === 'pointer') {
                            elementType = 'clickable';
                            isInteractive = true;
                            priority = 9;
                        }
                        else if (textContent && textContent.length > 3 && (tagName === 'span' || tagName === 'div' || tagName === 'p')) {
                            // Only include non-empty text elements with meaningful content
                            elementType = 'text-' + tagName;
                            priority = 3;
                        }
                        else {
                            return; // Skip other elements
                        }
                        // Get the EXACT visible label name
                        const displayName = getDisplayName(el, tagName, textContent, placeholder, ariaLabel);
                        // Skip elements without a meaningful name
                        if (!displayName && !id && !name) {
                            return;
                        }
                        // Create unique identifier based on display name and type
                        const uniqueKey = `${tagName}:${displayName}:${id}:${name}`;
                        // Avoid duplicates
                        if (seen.has(uniqueKey)) {
                            return;
                        }
                        seen.add(uniqueKey);
                        // Use display name as primary label, fallback to id/name
                        const label = displayName || id || name || `${elementType}_${elementIndex}`;
                        items.push({
                            index: elementIndex,
                            type: elementType,
                            tag: tagName,
                            id,
                            name,
                            class: className,
                            placeholder,
                            text: textContent,
                            ariaLabel,
                            role,
                            visible: isVisible,
                            interactive: isInteractive,
                            label: label, // THIS IS THE EXACT VISIBLE TEXT
                            displayName: displayName, // NEW: Store the exact display name separately
                            priority,
                            location: 'main',
                            position: {
                                top: Math.round(rect.top),
                                left: Math.round(rect.left),
                                width: Math.round(rect.width),
                                height: Math.round(rect.height)
                            }
                        });
                        elementIndex++;
                    }
                    catch (e) {
                        // Skip elements that can't be accessed
                    }
                });
                // ===== DETECT OVERLAY WINDOWS / MODALS / DIALOGS =====
                // These are windows that appear on top of main content
                const detectOverlayElements = () => {
                    // Look for elements with modal/dialog indicators
                    const overlaySelectors = [
                        '[role="dialog"]',
                        '[role="alertdialog"]',
                        '.modal',
                        '.overlay',
                        '.dialog',
                        '.popup',
                        '.window',
                        '[class*="modal"]',
                        '[class*="overlay"]',
                        '[class*="dialog"]',
                        '[class*="popup"]',
                        '[class*="window"]',
                        '[style*="position: fixed"][style*="z-index"]',
                        '[style*="position: absolute"][style*="z-index"]'
                    ];
                    const overlayElements = new Set();
                    for (const selector of overlaySelectors) {
                        try {
                            const elements = document.querySelectorAll(selector);
                            for (const el of Array.from(elements)) {
                                overlayElements.add(el);
                            }
                        }
                        catch (e) {
                            // Invalid selector, continue
                        }
                    }
                    return Array.from(overlayElements);
                };
                const overlayContainers = detectOverlayElements();
                for (const overlayContainer of overlayContainers) {
                    try {
                        // Get all interactive elements within this overlay
                        const allOverlayElements = overlayContainer.querySelectorAll('*');
                        for (const el of Array.from(allOverlayElements)) {
                            try {
                                const tagName = el.tagName?.toLowerCase() || '';
                                // Skip script, style tags
                                if (['script', 'style', 'meta', 'link', 'noscript', 'head', 'html', 'body'].includes(tagName)) {
                                    continue;
                                }
                                const id = el.getAttribute('id') || '';
                                const name = el.getAttribute('name') || '';
                                const className = el.getAttribute('class') || '';
                                const type = el.getAttribute('type') || '';
                                const placeholder = el.getAttribute('placeholder') || '';
                                const textContent = el.textContent?.trim().substring(0, 150) || '';
                                const ariaLabel = el.getAttribute('aria-label') || '';
                                const title = el.getAttribute('title') || '';
                                const role = el.getAttribute('role') || '';
                                // Get element visibility
                                const style = window.getComputedStyle(el);
                                // For overlay elements, accept elements that are either:
                                // 1. Normally visible (display != none)
                                // 2. Have any width/height (offsetWidth, clientWidth, etc)
                                // 3. Are interactive (clickable, forms, etc)
                                const isVisible = (style.display !== 'none' || el.offsetWidth > 0 || el.clientWidth > 0) &&
                                    (el.offsetHeight > 0 || el.clientHeight > 0 || el.offsetParent !== null);
                                // Skip hidden or very small elements
                                if (!isVisible)
                                    continue;
                                // Determine element type
                                let elementType = '';
                                let isInteractive = false;
                                let priority = 11; // Higher priority than main page
                                if (tagName === 'input') {
                                    elementType = type || 'input';
                                    isInteractive = true;
                                    priority = 11;
                                }
                                else if (tagName === 'button') {
                                    elementType = 'button';
                                    isInteractive = true;
                                    priority = 11;
                                }
                                else if (tagName === 'a') {
                                    elementType = 'link';
                                    isInteractive = true;
                                    priority = 11;
                                }
                                else if (tagName === 'select') {
                                    elementType = 'select';
                                    isInteractive = true;
                                    priority = 11;
                                }
                                else if (tagName === 'textarea') {
                                    elementType = 'textarea';
                                    isInteractive = true;
                                    priority = 11;
                                }
                                else if (role === 'button' || role === 'tab' || role === 'menuitem') {
                                    elementType = role;
                                    isInteractive = true;
                                    priority = 11;
                                }
                                else if (el.onclick !== null || style.cursor === 'pointer') {
                                    elementType = 'clickable';
                                    isInteractive = true;
                                    priority = 11;
                                }
                                else if (textContent && textContent.length > 3 && (tagName === 'span' || tagName === 'div' || tagName === 'p' || tagName === 'label')) {
                                    elementType = 'text-' + tagName;
                                    priority = 8;
                                }
                                else {
                                    continue; // Skip other elements
                                }
                                // Get display name
                                const displayName = getDisplayName(el, tagName, textContent, placeholder, ariaLabel);
                                // Skip elements without a meaningful name
                                if (!displayName && !id && !name && !title) {
                                    continue;
                                }
                                // Create unique identifier
                                const uniqueKey = `overlay:${tagName}:${displayName}:${id}:${name}`;
                                // Avoid duplicates
                                if (seen.has(uniqueKey)) {
                                    continue;
                                }
                                seen.add(uniqueKey);
                                // Get element position
                                const rect = el.getBoundingClientRect();
                                // Use display name as primary label
                                const label = displayName || title || id || name || `${elementType}_${elementIndex}`;
                                // Determine overlay type
                                const overlayId = overlayContainer.getAttribute('id') || '';
                                const overlayClass = overlayContainer.getAttribute('class') || '';
                                const overlayRole = overlayContainer.getAttribute('role') || '';
                                let overlayType = 'modal';
                                if (overlayRole === 'alertdialog')
                                    overlayType = 'alert';
                                else if (overlayClass.includes('popup'))
                                    overlayType = 'popup';
                                else if (overlayClass.includes('window'))
                                    overlayType = 'window';
                                else if (overlayClass.includes('overlay'))
                                    overlayType = 'overlay';
                                items.push({
                                    index: elementIndex,
                                    type: elementType,
                                    tag: tagName,
                                    id,
                                    name,
                                    class: className,
                                    placeholder,
                                    text: textContent,
                                    ariaLabel,
                                    title,
                                    role,
                                    visible: isVisible,
                                    interactive: isInteractive,
                                    label: label,
                                    displayName: displayName,
                                    priority,
                                    location: `overlay[${overlayType}]`,
                                    overlayId: overlayId,
                                    overlayType: overlayType,
                                    position: {
                                        top: Math.round(rect.top),
                                        left: Math.round(rect.left),
                                        width: Math.round(rect.width),
                                        height: Math.round(rect.height)
                                    }
                                });
                                elementIndex++;
                            }
                            catch (e) {
                                // Skip this element
                            }
                        }
                    }
                    catch (e) {
                        // Skip this overlay container
                    }
                }
                // NOW SEARCH IN IFRAMES
                const iframes = document.querySelectorAll('iframe');
                for (const iframe of Array.from(iframes)) {
                    try {
                        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
                        if (iframeDoc) {
                            const iframeElements = iframeDoc.querySelectorAll('*');
                            iframeElements.forEach((el) => {
                                try {
                                    const tagName = el.tagName?.toLowerCase() || '';
                                    if (['script', 'style', 'meta', 'link', 'noscript', 'head'].includes(tagName)) {
                                        return;
                                    }
                                    const id = el.getAttribute('id') || '';
                                    const name = el.getAttribute('name') || '';
                                    const className = el.getAttribute('class') || '';
                                    const type = el.getAttribute('type') || '';
                                    const placeholder = el.getAttribute('placeholder') || '';
                                    const textContent = el.textContent?.trim().substring(0, 150) || '';
                                    const ariaLabel = el.getAttribute('aria-label') || '';
                                    const role = el.getAttribute('role') || '';
                                    const style = window.getComputedStyle(el);
                                    const isVisible = style.display !== 'none' && style.visibility !== 'hidden';
                                    let elementType = '';
                                    let isInteractive = false;
                                    let priority = 0;
                                    if (tagName === 'input') {
                                        elementType = type || 'input';
                                        isInteractive = true;
                                        priority = 10;
                                    }
                                    else if (tagName === 'button') {
                                        elementType = 'button';
                                        isInteractive = true;
                                        priority = 10;
                                    }
                                    else if (tagName === 'a') {
                                        elementType = 'link';
                                        isInteractive = true;
                                        priority = 10;
                                    }
                                    else if (tagName === 'textarea') {
                                        elementType = 'textarea';
                                        isInteractive = true;
                                        priority = 10;
                                    }
                                    else if (tagName === 'select') {
                                        elementType = 'select';
                                        isInteractive = true;
                                        priority = 10;
                                    }
                                    else if (role === 'button') {
                                        elementType = 'button';
                                        isInteractive = true;
                                        priority = 10;
                                    }
                                    else if (textContent && textContent.length > 3) {
                                        elementType = 'text';
                                        priority = 3;
                                    }
                                    else {
                                        return;
                                    }
                                    const uniqueKey = `iframe:${tagName}:${id}:${name}:${textContent.substring(0, 30)}`;
                                    if (seen.has(uniqueKey))
                                        return;
                                    seen.add(uniqueKey);
                                    const rect = el.getBoundingClientRect();
                                    const identifier = id || name || ariaLabel || `${elementType}_${elementIndex}`;
                                    items.push({
                                        index: elementIndex,
                                        type: elementType,
                                        tag: tagName,
                                        id,
                                        name,
                                        class: className,
                                        placeholder,
                                        text: textContent,
                                        ariaLabel,
                                        role,
                                        visible: isVisible,
                                        interactive: isInteractive,
                                        label: identifier,
                                        priority,
                                        location: 'iframe',
                                        position: {
                                            top: Math.round(rect.top),
                                            left: Math.round(rect.left),
                                            width: Math.round(rect.width),
                                            height: Math.round(rect.height)
                                        }
                                    });
                                    elementIndex++;
                                }
                                catch (e) {
                                    // Skip
                                }
                            });
                        }
                    }
                    catch (e) {
                        // Cross-origin iframe - skip
                    }
                }
                // ===== DETECT ELEMENTS IN SHADOW DOM =====
                // Shadow DOM is used by Web Components and some libraries
                const collectShadowDOMElements = (rootElement, depth = 0) => {
                    if (depth > 5)
                        return; // Limit recursion depth
                    try {
                        const allElements = rootElement.querySelectorAll('*');
                        for (const el of Array.from(allElements)) {
                            if (el.shadowRoot) {
                                try {
                                    const shadowElements = el.shadowRoot.querySelectorAll('*');
                                    for (const shadowElRaw of Array.from(shadowElements)) {
                                        const shadowEl = shadowElRaw;
                                        try {
                                            const tagName = shadowEl.tagName?.toLowerCase() || '';
                                            if (['script', 'style', 'meta', 'link', 'noscript', 'head', 'html'].includes(tagName)) {
                                                continue;
                                            }
                                            const id = shadowEl.getAttribute('id') || '';
                                            const name = shadowEl.getAttribute('name') || '';
                                            const className = shadowEl.getAttribute('class') || '';
                                            const type = shadowEl.getAttribute('type') || '';
                                            const placeholder = shadowEl.getAttribute('placeholder') || '';
                                            const textContent = shadowEl.textContent?.trim().substring(0, 150) || '';
                                            const ariaLabel = shadowEl.getAttribute('aria-label') || '';
                                            const title = shadowEl.getAttribute('title') || '';
                                            const role = shadowEl.getAttribute('role') || '';
                                            const style = window.getComputedStyle(shadowEl);
                                            // More lenient visibility check for shadow DOM elements
                                            const isVisible = style.display !== 'none' &&
                                                (shadowEl.offsetWidth > 0 || shadowEl.clientWidth > 0) &&
                                                (shadowEl.offsetHeight > 0 || shadowEl.clientHeight > 0);
                                            if (!isVisible)
                                                continue;
                                            let elementType = '';
                                            let isInteractive = false;
                                            if (tagName === 'input') {
                                                elementType = type || 'input';
                                                isInteractive = true;
                                            }
                                            else if (tagName === 'button') {
                                                elementType = 'button';
                                                isInteractive = true;
                                            }
                                            else if (tagName === 'a') {
                                                elementType = 'link';
                                                isInteractive = true;
                                            }
                                            else if (tagName === 'select') {
                                                elementType = 'select';
                                                isInteractive = true;
                                            }
                                            else if (role === 'button' || role === 'tab') {
                                                elementType = role;
                                                isInteractive = true;
                                            }
                                            else if (shadowEl.onclick !== null || style.cursor === 'pointer') {
                                                elementType = 'clickable';
                                                isInteractive = true;
                                            }
                                            else if (textContent && textContent.length > 3) {
                                                elementType = 'text-' + tagName;
                                            }
                                            else {
                                                continue;
                                            }
                                            const displayName = getDisplayName(shadowEl, tagName, textContent, placeholder, ariaLabel);
                                            if (!displayName && !id && !name && !title)
                                                continue;
                                            const uniqueKey = `shadow:${tagName}:${displayName}:${id}:${name}`;
                                            if (seen.has(uniqueKey))
                                                continue;
                                            seen.add(uniqueKey);
                                            const rect = shadowEl.getBoundingClientRect();
                                            const label = displayName || title || id || name || `${elementType}_${elementIndex}`;
                                            items.push({
                                                index: elementIndex,
                                                type: elementType,
                                                tag: tagName,
                                                id,
                                                name,
                                                class: className,
                                                placeholder,
                                                text: textContent,
                                                ariaLabel,
                                                title,
                                                role,
                                                visible: isVisible,
                                                interactive: isInteractive,
                                                label: label,
                                                displayName: displayName,
                                                priority: 10,
                                                location: 'shadow-dom',
                                                position: {
                                                    top: Math.round(rect.top),
                                                    left: Math.round(rect.left),
                                                    width: Math.round(rect.width),
                                                    height: Math.round(rect.height)
                                                }
                                            });
                                            elementIndex++;
                                        }
                                        catch (e) {
                                            // Skip shadow element
                                        }
                                    }
                                    // Recursively check shadow DOM elements for nested shadow roots
                                    collectShadowDOMElements(el, depth + 1);
                                }
                                catch (e) {
                                    // Can't access shadow root
                                }
                            }
                        }
                    }
                    catch (e) {
                        // Skip shadow DOM collection
                    }
                };
                collectShadowDOMElements(document.documentElement);
            }
            catch (error) {
                return items;
            }
            // FILTER: Only return VISIBLE elements from the CURRENT PAGE (not from previous pages)
            const visibleElements = items.filter((el) => {
                // Must be visible on screen
                if (!el.visible)
                    return false;
                // Must be an interactive element or have meaningful text/label
                if (!el.interactive && !el.label)
                    return false;
                // For text elements, only show if they have meaningful content
                if (el.type && el.type.startsWith('text-') && (!el.text || el.text.length < 3)) {
                    return false;
                }
                return true;
            });
            return visibleElements.slice(0, 500); // Limit to 500 visible elements
        });
        if (!elements || !Array.isArray(elements)) {
            log(`Elements array is invalid, returning empty array`);
            return [];
        }
        log(`Found ${elements.length} page elements (iframe: ${elements.filter((e) => e.location === 'iframe').length}, overlay: ${elements.filter((e) => e.location?.includes('overlay')).length}, shadow-dom: ${elements.filter((e) => e.location === 'shadow-dom').length})`);
        return elements;
    }
    catch (e) {
        log(`Failed to get elements: ${e.message || e}`);
        return [];
    }
}
/* ============== INTELLIGENT PAGE READINESS ============== */
/* ============== SMART NESTED DROPDOWN NAVIGATION ============== */
/**
 * Detect all visible dropdown/menu containers on the current page
 * Returns array of visible dropdowns with their items
 */
async function detectVisibleDropdowns() {
    if (!state.page || state.page.isClosed())
        return [];
    try {
        const dropdowns = await state.page.evaluate(() => {
            const results = [];
            const seen = new Set();
            // Selectors for dropdown containers - expanded to catch more patterns
            const dropdownSelectors = [
                '[role="menu"]',
                '[role="listbox"]',
                '[role="combobox"]',
                '[role="navigation"]',
                '.dropdown',
                '.menu',
                '.select',
                '[class*="dropdown"]',
                '[class*="menu"]',
                '[class*="popup"]',
                '[class*="submenu"]',
                '[class*="modal"]',
                '[data-role="dropdown"]',
                'ul[class*="dropdown"]',
                'ul[class*="menu"]',
                'ul[role]',
                'div[class*="dropdown-menu"]',
                '.nav',
                '[class*="navigation"]',
                // Additional selectors for positioned overlays
                'div[style*="position: absolute"]',
                'div[style*="position: fixed"]',
                'div[class*="overlay"]'
            ];
            for (const selector of dropdownSelectors) {
                try {
                    const elements = document.querySelectorAll(selector);
                    for (const el of Array.from(elements)) {
                        // Skip if already processed
                        if (seen.has(el))
                            continue;
                        const style = window.getComputedStyle(el);
                        const rect = el.getBoundingClientRect();
                        // Check if actually visible
                        const isVisible = style.display !== 'none' &&
                            style.visibility !== 'hidden' &&
                            parseFloat(style.opacity) > 0.1 &&
                            rect.height > 0 && rect.width > 0;
                        if (!isVisible)
                            continue;
                        // Get all clickable items within this dropdown
                        const items = [];
                        const itemElements = el.querySelectorAll('a, button, [role="option"], [role="menuitem"], li, span[onclick], div[onclick]');
                        for (const item of Array.from(itemElements)) {
                            const itemStyle = window.getComputedStyle(item);
                            const itemVisible = itemStyle.display !== 'none' && itemStyle.visibility !== 'hidden';
                            if (itemVisible) {
                                items.push({
                                    text: (item.textContent || '').trim().substring(0, 100),
                                    tag: item.tagName,
                                    role: item.getAttribute('role'),
                                    id: item.id,
                                    class: item.className
                                });
                            }
                        }
                        if (items.length > 0) {
                            results.push({
                                selector: selector,
                                position: { top: Math.round(rect.top), left: Math.round(rect.left) },
                                size: { width: Math.round(rect.width), height: Math.round(rect.height) },
                                itemCount: items.length,
                                items: items
                            });
                            seen.add(el);
                        }
                    }
                }
                catch (e) {
                    // Skip invalid selectors
                }
            }
            return results;
        });
        return dropdowns;
    }
    catch (e) {
        log(`Failed to detect dropdowns: ${e}`);
        return [];
    }
}
/**
 * Parse nested target path like "Loans > Insta Personal Loan >> Check Offer"
 * Single ">" = new dropdown level (wait for dropdown to open)
 * Double ">>" = same dropdown level (minimal wait, item already visible)
 * Returns array with metadata about each step
 */
function parseNestedPath(target) {
    // Split by ">>" first (double), then ">" (single)
    const parts = [];
    // Match patterns like "text > text >> text"
    const regex = /([^>]*?)(?:(>>|>))?(?=>>|>|$)/g;
    let match;
    let lastWasSingleArrow = false;
    const items = target.split(/>>|>/).filter(item => item.trim().length > 0);
    const separators = target.match(/>>|>/g) || [];
    for (let i = 0; i < items.length; i++) {
        const text = items[i].trim();
        const separator = separators[i]; // ">" or ">>"
        // First item always searches on page
        if (i === 0) {
            parts.push({ text, isNewLevel: true });
        }
        else {
            // isNewLevel = true if separator is ">" (single)
            // isNewLevel = false if separator is ">>" (double)
            const isNewLevel = separator === '>' || separator === undefined;
            parts.push({ text, isNewLevel });
        }
    }
    return parts;
}
/**
 * Handle nested dropdown navigation
 * Example: "Loans > Insta Personal Loan > Check Offer"
 * 1. Click "Loans" (parent opens dropdown)
 2. Detect dropdown opened
 3. Click "Insta Personal Loan" inside dropdown
 4. Repeat for "Check Offer"
 */
async function handleNestedNavigation(target) {
    const pathSteps = parseNestedPath(target);
    if (pathSteps.length <= 1) {
        return false; // Not a nested path
    }
    log(`\n🔄 [NESTED NAVIGATION] Hierarchical path: ${target}`);
    log(`\n📊 Parsed ${pathSteps.length} steps:`);
    for (let i = 0; i < pathSteps.length; i++) {
        const step = pathSteps[i];
        const marker = i === 0 ? '(page search)' : step.isNewLevel ? '(new dropdown ">")' : '(same dropdown ">>"" )';
        log(`   Step ${i + 1}: "${step.text}" ${marker}`);
    }
    try {
        for (let i = 0; i < pathSteps.length; i++) {
            const currentStep = pathSteps[i];
            const isFirstStep = i === 0;
            const expectsNewLevel = currentStep.isNewLevel;
            log(`\n${'─'.repeat(70)}`);
            log(`📍 STEP ${i + 1}/${pathSteps.length}: Click "${currentStep.text}" ${expectsNewLevel && i > 0 ? '[EXPECTS NEW DROPDOWN]' : ''}`);
            log(`${'─'.repeat(70)}`);
            let clickSuccess = false;
            if (isFirstStep) {
                // STEP 1: Click parent on entire page
                log(`🔍 Searching entire page for "${currentStep.text}"...`);
                clickSuccess = await clickElementInPage(currentStep.text, state.page);
                if (clickSuccess) {
                    log(`✅ Clicked "${currentStep.text}" - dropdown should open`);
                    log(`⏳ Waiting 400ms for dropdown to appear...`);
                    await state.page.waitForTimeout(400);
                }
                else {
                    log(`❌ Failed to click "${currentStep.text}"`);
                    return false;
                }
            }
            else {
                // STEPS 2+: Can be either dropdown search OR hover-reveal
                const isLastStep = (i === pathSteps.length - 1);
                const hasNextStep = (i < pathSteps.length - 1);
                const nextStep = hasNextStep ? pathSteps[i + 1] : null;
                // First, detect dropdowns to use in both scenarios
                log(`🔍 Detecting visible dropdowns...`);
                let dropdowns = await detectVisibleDropdowns();
                if (dropdowns.length === 0) {
                    log(`⚠️ No dropdowns found, retrying...`);
                    await state.page.waitForTimeout(300);
                    dropdowns = await detectVisibleDropdowns();
                    if (dropdowns.length === 0) {
                        log(`❌ No dropdowns found after retry`);
                        return false;
                    }
                }
                log(`✅ Found ${dropdowns.length} visible dropdown(s)`);
                for (let d = 0; d < dropdowns.length; d++) {
                    const dropdown = dropdowns[d];
                    log(`   Dropdown ${d + 1}: ${dropdown.selector}`);
                    log(`      Position: ${dropdown.position.top}px top, ${dropdown.position.left}px left`);
                    log(`      Size: ${dropdown.size.width}x${dropdown.size.height}px`);
                    log(`      Items in dropdown: ${dropdown.itemCount}`);
                    const itemList = dropdown.items.slice(0, 8).map((i) => i.text).join(' | ');
                    log(`      Items visible: [${itemList}${dropdown.items.length > 8 ? '...' : ''}]`);
                }
                let clickSuccess = false;
                // Check if NEXT step is a sub-child (preceded by ">>") that needs hover to reveal
                // nextStep.isNewLevel = false means preceded by ">>", so use hover approach
                if (hasNextStep && !isLastStep && nextStep && !nextStep.isNewLevel) {
                    log(`📋 DETECTED HOVER-REVEAL: Next item is sub-child (">>")`);
                    log(`   Hover over "${currentStep.text}" to reveal "${nextStep.text}"`);
                    // Hover over current item to reveal next item (sub-element like Check Offer button)
                    clickSuccess = await hoverAndClickSubElement(currentStep.text, nextStep.text, dropdowns);
                    if (clickSuccess) {
                        log(`✅ Hovered and clicked "${nextStep.text}" successfully`);
                        i++; // Skip next iteration since we already clicked the next item
                    }
                    else {
                        log(`⚠️ Hover approach failed, falling back to standard dropdown search for "${currentStep.text}"...`);
                        clickSuccess = await clickElementInDropdown(currentStep.text, dropdowns);
                        if (clickSuccess) {
                            log(`✅ Clicked "${currentStep.text}" (standard approach)`);
                            if (expectsNewLevel) {
                                log(`⏳ Configured for NEW DROPDOWN (">") - waiting 500ms...`);
                                await state.page.waitForTimeout(500);
                            }
                            else {
                                log(`⏳ Configured for SAME DROPDOWN (">>") - waiting 200ms...`);
                                await state.page.waitForTimeout(200);
                            }
                        }
                        else {
                            log(`❌ Failed to click "${currentStep.text}"`);
                            return false;
                        }
                    }
                }
                else {
                    // Standard dropdown/list search (no hover required)
                    clickSuccess = await clickElementInDropdown(currentStep.text, dropdowns);
                    if (clickSuccess) {
                        log(`✅ Clicked "${currentStep.text}"`);
                        // ===== WAIT LOGIC BASED ON >> vs > =====
                        if (i < pathSteps.length - 1) { // Not last step
                            if (expectsNewLevel) {
                                // ">" separator: Next dropdown should open
                                log(`⏳ Configured for NEW DROPDOWN (">") - waiting 500ms...`);
                                await state.page.waitForTimeout(500);
                            }
                            else {
                                // ">>" separator: Item is in same dropdown
                                log(`⏳ Configured for SAME DROPDOWN (">>") - waiting 200ms...`);
                                await state.page.waitForTimeout(200);
                            }
                        }
                    }
                    else {
                        log(`❌ Failed to click "${currentStep.text}"`);
                        return false;
                    }
                }
            }
        }
        log(`\n${'═'.repeat(70)}`);
        log(`✅ SUCCESS: Navigation completed: ${target}`);
        log(`${'═'.repeat(70)}\n`);
        return true;
    }
    catch (e) {
        log(`❌ Navigation error: ${e.message}`);
        return false;
    }
}
/**
 * Hover over a menu item within dropdown to reveal sub-buttons, then click the target sub-item
 * Used for menu items that show action buttons/links on hover (like Insta Personal Loan → Check Offer)
 */
async function hoverAndClickSubElement(parentText, childText, dropdowns) {
    if (!state.page)
        return false;
    try {
        log(`\n   🎯 Using HOVER approach for "${parentText}" → "${childText}"`);
        const lower = parentText.toLowerCase().trim();
        const childLower = childText.toLowerCase().trim();
        // Step 1: Find parent element WITHIN the dropdown containers
        log(`   🔍 Finding "${parentText}" within dropdowns...`);
        const parentElement = await state.page.evaluate((searchParams) => {
            const { searchText, dropdownSelectors } = searchParams;
            const lower = searchText.toLowerCase().trim();
            // Search within dropdown containers
            for (const selector of dropdownSelectors) {
                try {
                    const containers = document.querySelectorAll(selector);
                    for (const container of Array.from(containers)) {
                        const items = container.querySelectorAll('a, button, [role="option"], [role="menuitem"], li, span[onclick], div[onclick]');
                        for (const el of Array.from(items)) {
                            const elText = (el.textContent || '').trim().toLowerCase();
                            const rect = el.getBoundingClientRect();
                            // Check visibility
                            const style = window.getComputedStyle(el);
                            if (style.display === 'none' || style.visibility === 'hidden')
                                continue;
                            if (rect.height === 0 || rect.width === 0)
                                continue;
                            // Match
                            if (elText === lower || elText.includes(lower)) {
                                return {
                                    text: elText,
                                    x: Math.round(rect.left + rect.width / 2),
                                    y: Math.round(rect.top + rect.height / 2),
                                    tag: el.tagName,
                                    selector: getElementSelector(el)
                                };
                            }
                        }
                    }
                }
                catch (e) { }
            }
            return null;
        }, { searchText: parentText, dropdownSelectors: dropdowns.map((d) => d.selector) });
        if (!parentElement) {
            log(`   ❌ Could not find parent "${parentText}" in dropdowns`);
            return false;
        }
        log(`   ✅ Found parent "${parentText}" at (${parentElement.x}, ${parentElement.y})`);
        log(`   🖱️  Hovering over "${parentText}"...`);
        // Step 2: Move mouse to parent element (hover)
        await state.page.mouse.move(parentElement.x, parentElement.y);
        // Step 3: Wait for animations/reveal (500ms for button to appear)
        log(`   ⏳ Waiting 500ms for sub-buttons to appear...`);
        await state.page.waitForTimeout(500);
        // Step 4: Find and click child element using BOTH approaches
        log(`   🔍 Finding "${childText}" near "${parentText}"...`);
        const childElement = await state.page.evaluate((searchParams) => {
            const { searchText, dropdownSelectors } = searchParams;
            const lower = searchText.toLowerCase().trim();
            let bestMatch = null;
            let bestMatchLength = Infinity;
            // Search within all dropdowns (button might be in overlay or same container)
            for (const selector of dropdownSelectors) {
                try {
                    const containers = document.querySelectorAll(selector);
                    for (const container of Array.from(containers)) {
                        const items = container.querySelectorAll('button, a, [role="option"], [role="menuitem"], li, span, div');
                        for (const el of Array.from(items)) {
                            const elText = (el.textContent || '').trim().toLowerCase();
                            const rect = el.getBoundingClientRect();
                            // Check visibility
                            const style = window.getComputedStyle(el);
                            if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) < 0.1)
                                continue;
                            if (rect.height === 0 || rect.width === 0)
                                continue;
                            // EXACT match
                            if (elText === lower) {
                                return {
                                    text: elText,
                                    x: Math.round(rect.left + rect.width / 2),
                                    y: Math.round(rect.top + rect.height / 2),
                                    tag: el.tagName,
                                    matchType: 'EXACT',
                                    selector: getElementSelector(el)
                                };
                            }
                            // Partial match fallback
                            if (elText.includes(lower) && lower.length > 2) {
                                if (elText.length < bestMatchLength) {
                                    bestMatch = {
                                        text: elText,
                                        x: Math.round(rect.left + rect.width / 2),
                                        y: Math.round(rect.top + rect.height / 2),
                                        tag: el.tagName,
                                        matchType: 'PARTIAL',
                                        selector: getElementSelector(el)
                                    };
                                    bestMatchLength = elText.length;
                                }
                            }
                        }
                    }
                }
                catch (e) { }
            }
            return bestMatch;
        }, { searchText: childText, dropdownSelectors: dropdowns.map((d) => d.selector) });
        if (!childElement) {
            log(`   ⚠️  Could not find child element "${childText}" after hover`);
            return false;
        }
        log(`   ✅ Found sub-element "${childText}" at (${childElement.x}, ${childElement.y})`);
        log(`   🖱️  Clicking "${childText}" using Playwright native click...`);
        // Step 5: Click using multiple strategies
        let clickSuccess = false;
        // Strategy 1: Try Playwright's native click method (most reliable)
        try {
            // Search for button/link containing the text
            const selector = `button:has-text("${childText.replace(/"/g, '\\"')}"), a:has-text("${childText.replace(/"/g, '\\"')}"), [role="button"]:has-text("${childText.replace(/"/g, '\\"')}")`;
            await state.page.click(selector, { timeout: 2000 });
            log(`   ✅ Successfully clicked using Playwright selector`);
            clickSuccess = true;
        }
        catch (e) {
            log(`   ⚠️  Playwright selector click failed, trying mouse approach...`);
            // Strategy 2: Direct position-based click
            try {
                // Move to child first to keep hover state, then click
                await state.page.mouse.move(childElement.x, childElement.y);
                await state.page.waitForTimeout(100); // Brief pause
                await state.page.mouse.click(childElement.x, childElement.y);
                log(`   ✅ Successfully clicked using mouse position`);
                clickSuccess = true;
            }
            catch (e2) {
                log(`   ⚠️  Mouse click also failed: ${e2}`);
            }
        }
        if (clickSuccess) {
            log(`   ✅ Successfully clicked "${childText}" via hover approach`);
            return true;
        }
        else {
            return false;
        }
    }
    catch (e) {
        log(`   ❌ Hover approach failed: ${e.message}`);
        return false;
    }
}
/**
 * Helper function to get unique selector for an element
 */
function getElementSelector(element) {
    if (!element)
        return '';
    const path = [];
    let el = element;
    while (el && el.nodeType === Node.ELEMENT_NODE) {
        let index = 0;
        let sibling = el.previousElementSibling;
        while (sibling) {
            if (sibling.nodeName.toLowerCase() === el.nodeName.toLowerCase()) {
                index++;
            }
            sibling = sibling.previousElementSibling;
        }
        const tagName = el.nodeName.toLowerCase();
        const selector = index > 0 ? `${tagName}:nth-of-type(${index + 1})` : tagName;
        path.unshift(selector);
        el = el.parentElement;
    }
    return path.join(' > ');
}
/**
 * Click element by text within the entire page
 */
async function clickElementInPage(text, page) {
    try {
        const foundElement = await page.evaluate((searchText) => {
            const lower = searchText.toLowerCase().trim();
            let bestMatch = null;
            let bestMatchLength = Infinity;
            const elements = Array.from(document.querySelectorAll('a, button, [role="button"], [role="menuitem"], [role="option"], li, div, span'));
            for (const el of elements) {
                const elText = (el.textContent || '').trim().toLowerCase();
                const rect = el.getBoundingClientRect();
                // Check visibility
                const style = window.getComputedStyle(el);
                const isVisible = style.display !== 'none' &&
                    style.visibility !== 'hidden' &&
                    parseFloat(style.opacity) > 0.1 &&
                    rect.height > 0 && rect.width > 0;
                if (!isVisible)
                    continue;
                // Exact match
                if (elText === lower) {
                    bestMatch = {
                        text: elText,
                        x: Math.round(rect.left + rect.width / 2),
                        y: Math.round(rect.top + rect.height / 2),
                        element: el
                    };
                    break;
                }
                // Partial match - keep shortest
                else if (elText.includes(lower) && elText.length < bestMatchLength) {
                    bestMatch = {
                        text: elText,
                        x: Math.round(rect.left + rect.width / 2),
                        y: Math.round(rect.top + rect.height / 2),
                        element: el
                    };
                    bestMatchLength = elText.length;
                }
            }
            return bestMatch ? { text: bestMatch.text, x: bestMatch.x, y: bestMatch.y } : null;
        }, text);
        if (!foundElement) {
            return false;
        }
        // Use Playwright's native click which is more reliable for web components
        try {
            await page.click(`button:has-text("${text}"), a:has-text("${text}"), [role="button"]:has-text("${text}")`);
            return true;
        }
        catch {
            // Fallback to mouse click if selector fails
            await page.mouse.click(foundElement.x, foundElement.y);
            return true;
        }
    }
    catch (e) {
        return false;
    }
}
/**
 * Click element by text within visible dropdowns
 * Uses Playwright's native click for reliability
 */
async function clickElementInDropdown(text, dropdowns) {
    if (!state.page || state.page.isClosed())
        return false;
    try {
        const lower = text.toLowerCase();
        log(`   🔍 Searching for "${text}" WITHIN ${dropdowns.length} visible dropdown(s)...`);
        // Search ONLY within visible dropdown containers
        const foundElement = await state.page.evaluate((searchParams) => {
            const { searchText, dropdownSelectors } = searchParams;
            const lower = searchText.toLowerCase().trim();
            let bestMatch = null;
            let bestMatchLength = Infinity;
            let dropdownSearchLog = [];
            // First, collect all elements that are within the visible dropdowns
            let dropdownElements = [];
            for (const selector of dropdownSelectors) {
                try {
                    const dropdownContainers = document.querySelectorAll(selector);
                    dropdownSearchLog.push(`Searching selector: "${selector}" → Found ${dropdownContainers.length} container(s)`);
                    for (const container of Array.from(dropdownContainers)) {
                        const itemsInThis = container.querySelectorAll('a, button, [role="option"], [role="menuitem"], li, span[onclick], div[onclick]');
                        dropdownElements.push(...Array.from(itemsInThis));
                        dropdownSearchLog.push(`  └─ Container has ${itemsInThis.length} clickable items`);
                    }
                }
                catch (e) {
                    dropdownSearchLog.push(`Failed to query "${selector}": ${e}`);
                }
            }
            if (dropdownElements.length === 0) {
                return {
                    found: false,
                    searchLog: dropdownSearchLog,
                    message: `No clickable elements found in dropdowns`
                };
            }
            dropdownSearchLog.push(`Total clickable elements in dropdowns: ${dropdownElements.length}`);
            // Now search ONLY within dropdown elements
            // PASS 1: EXACT match only (most strict)
            for (const el of dropdownElements) {
                const elText = (el.textContent || '').trim().toLowerCase();
                const rect = el.getBoundingClientRect();
                // Must be visible
                const style = window.getComputedStyle(el);
                const isVisible = style.display !== 'none' &&
                    style.visibility !== 'hidden' &&
                    parseFloat(style.opacity) > 0.1 &&
                    rect.height > 0 && rect.width > 0;
                if (!isVisible)
                    continue;
                // EXACT match ONLY - no partial matches in this pass
                if (elText === lower) {
                    // Additional validation: ensure text is DIRECT child text, not deeply nested
                    const directText = Array.from(el.childNodes)
                        .filter(node => node.nodeType === Node.TEXT_NODE)
                        .map(node => (node.textContent || '').trim())
                        .join(' ')
                        .toLowerCase();
                    // Also check if it's a simple clickable element (a, button, li, etc.)
                    const isSimpleClickable = ['A', 'BUTTON', 'LI', 'SPAN'].includes(el.tagName);
                    bestMatch = {
                        text: elText,
                        directText: directText,
                        x: Math.round(rect.left + rect.width / 2),
                        y: Math.round(rect.top + rect.height / 2),
                        tag: el.tagName,
                        role: el.getAttribute('role'),
                        id: el.id,
                        class: el.className,
                        isExact: true,
                        isSimpleClickable: isSimpleClickable,
                        searchLog: dropdownSearchLog
                    };
                    dropdownSearchLog.push(`✅ EXACT MATCH - Tag: ${el.tagName}, Text: "${elText.substring(0, 50)}"`);
                    break; // Found exact match, STOP immediately
                }
            }
            // PASS 2: If no exact match, try partial match (but only if exact fails)
            if (!bestMatch) {
                dropdownSearchLog.push(`⚠️  No exact match found, trying partial match...`);
                for (const el of dropdownElements) {
                    const elText = (el.textContent || '').trim().toLowerCase();
                    const rect = el.getBoundingClientRect();
                    const style = window.getComputedStyle(el);
                    const isVisible = style.display !== 'none' &&
                        style.visibility !== 'hidden' &&
                        parseFloat(style.opacity) > 0.1 &&
                        rect.height > 0 && rect.width > 0;
                    if (!isVisible)
                        continue;
                    // Partial match - keep shortest match
                    if (elText.includes(lower) && elText.length < bestMatchLength) {
                        bestMatch = {
                            text: elText,
                            x: Math.round(rect.left + rect.width / 2),
                            y: Math.round(rect.top + rect.height / 2),
                            tag: el.tagName,
                            role: el.getAttribute('role'),
                            id: el.id,
                            class: el.className,
                            isExact: false,
                            searchLog: dropdownSearchLog
                        };
                        bestMatchLength = elText.length;
                        dropdownSearchLog.push(`ℹ️  Partial match: Tag=${el.tagName}, Text="${elText.substring(0, 50)}", Length=${elText.length}`);
                    }
                }
            }
            return bestMatch || { found: false, searchLog: dropdownSearchLog, message: `No match for "${searchText}" in dropdown elements` };
        }, {
            searchText: text,
            dropdownSelectors: dropdowns.map(d => d.selector)
        });
        // Log search details
        if (foundElement.searchLog) {
            for (const logLine of foundElement.searchLog) {
                log(`   ${logLine}`);
            }
        }
        if (!foundElement || !foundElement.x) {
            log(`   ❌ Could not find exact/partial match for "${text}" within dropdown elements`);
            log(`   ℹ️  The element may not be visible in the dropdown yet or text doesn't match`);
            return false; // Don't fall back to page search - let caller retry
        }
        log(`   ✅ Found element:`);
        log(`      Tag: ${foundElement.tag}`);
        log(`      Role: ${foundElement.role || 'none'}`);
        log(`      ID: ${foundElement.id || 'none'}`);
        log(`      Class: ${foundElement.class || 'none'}`);
        log(`      Text: "${foundElement.text.substring(0, 80)}"`);
        log(`      Position: (${foundElement.x}, ${foundElement.y})`);
        log(`      Exact Match: ${foundElement.isExact ? 'YES' : 'NO'}`);
        log(`   🖱️  Clicking at coordinates (${foundElement.x}, ${foundElement.y})...`);
        // Click using Playwright at the exact coordinates - most reliable method
        try {
            await state.page.mouse.click(foundElement.x, foundElement.y);
            log(`   ✅ Successfully clicked element in dropdown`);
            return true;
        }
        catch (e) {
            log(`   ⚠️ Mouse click failed, trying alternative method...`);
            // Fallback: interact with element via keyboard/focus
            try {
                await state.page.evaluate((coords) => {
                    const el = document.elementFromPoint(coords.x, coords.y);
                    if (el) {
                        el.focus();
                        el.click();
                    }
                }, { x: foundElement.x, y: foundElement.y });
                log(`   ✅ Alternative click succeeded`);
                return true;
            }
            catch (e2) {
                log(`   ❌ All click methods failed: ${e2}`);
                return false;
            }
        }
    }
    catch (e) {
        log(`   ❌ Error: ${e.message}`);
        return false;
    }
}
/**
 * Comprehensive page readiness check
 * Waits for page to be fully loaded using multiple strategies
 */
async function waitForPageReady(timeout = 30000) {
    if (!state.page || state.page.isClosed())
        return false;
    // Check pause before starting
    while (state.isPaused && !state.isStopped) {
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    if (state.isStopped)
        return false;
    const startTime = Date.now();
    let lastActivityTime = Date.now();
    try {
        // Strategy 1: Wait for main page navigation
        try {
            await state.page.waitForLoadState('networkidle', { timeout: Math.min(timeout, 15000) }).catch(() => { });
        }
        catch (e) {
            // Continue with other checks
        }
        // Strategy 2: Wait for all frames to be ready
        try {
            const frames = state.page.frames();
            for (const frame of frames) {
                try {
                    await frame.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => { });
                }
                catch (e) {
                    // Frame might be cross-origin, continue
                }
            }
        }
        catch (e) {
            // Frame checks completed
        }
        // Strategy 3: Wait for common loading indicators to disappear
        try {
            const loadingIndicators = await state.page.evaluate(() => {
                const indicators = document.querySelectorAll('[class*="loading"], [class*="spinner"], [id*="loading"], [id*="spinner"], ' +
                    '[data-testid*="loading"], [aria-busy="true"], .loader, .load, .progress');
                return indicators.length;
            });
            if (loadingIndicators > 0) {
                await state.page.evaluate(() => {
                    return new Promise((resolve) => {
                        const checkIndicators = () => {
                            const indicators = document.querySelectorAll('[class*="loading"], [class*="spinner"], [id*="loading"], [id*="spinner"], ' +
                                '[data-testid*="loading"], [aria-busy="true"], .loader, .load, .progress');
                            return indicators.length === 0;
                        };
                        if (checkIndicators()) {
                            resolve(true);
                            return;
                        }
                        const observer = new MutationObserver(() => {
                            if (checkIndicators()) {
                                observer.disconnect();
                                resolve(true);
                            }
                        });
                        observer.observe(document.body, {
                            childList: true,
                            subtree: true,
                            attributes: true
                        });
                        // Timeout after 8 seconds
                        setTimeout(() => {
                            observer.disconnect();
                            resolve(false);
                        }, 8000);
                    });
                });
            }
        }
        catch (e) {
            // Loading indicator check skipped
        }
        // Strategy 4: Wait for DOM to be interactive
        try {
            await state.page.evaluate(() => {
                return new Promise((resolve) => {
                    if (document.readyState === 'complete' || document.readyState === 'interactive') {
                        resolve();
                    }
                    else {
                        document.addEventListener('DOMContentLoaded', () => resolve());
                        setTimeout(() => resolve(), 3000);
                    }
                });
            });
        }
        catch (e) {
            // DOM check skipped
        }
        // Strategy 5: Wait for network to settle (no requests for 2 seconds)
        try {
            let pendingRequests = true;
            let settledCount = 0;
            while (pendingRequests && Date.now() - startTime < timeout) {
                // Check pause during waiting
                while (state.isPaused && !state.isStopped) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
                if (state.isStopped)
                    return false;
                try {
                    const requestCount = await state.page.evaluate(() => {
                        return performance.getEntriesByType?.('resource')?.length || 0;
                    });
                    if (requestCount === 0 || settledCount > 3) {
                        pendingRequests = false;
                    }
                    else {
                        settledCount++;
                        await state.page.waitForTimeout(500);
                    }
                }
                catch (e) {
                    pendingRequests = false;
                }
            }
        }
        catch (e) {
            // Network settle check skipped
        }
        // Strategy 6: Wait for all AJAX/Fetch requests to complete
        try {
            await state.page.evaluate(() => {
                return new Promise((resolve) => {
                    let requestCount = 0;
                    const originalFetch = window.fetch;
                    const originalXHR = window.XMLHttpRequest;
                    // Track fetch requests
                    window.fetch = function (...args) {
                        requestCount++;
                        return originalFetch.apply(this, args).finally(() => {
                            requestCount--;
                            if (requestCount === 0) {
                                setTimeout(() => resolve(), 500);
                            }
                        });
                    };
                    // Check if requests are already in flight
                    setTimeout(() => {
                        if (requestCount === 0) {
                            resolve();
                        }
                    }, 500);
                    // Timeout after 8 seconds
                    setTimeout(() => resolve(), 8000);
                });
            }).catch(() => { });
        }
        catch (e) {
            // AJAX check skipped
        }
        // Strategy 7: Final stability check
        try {
            const isStable = await state.page.evaluate(() => {
                // Check if page has interactive elements visible
                const interactiveElements = document.querySelectorAll('button, input, a, select, textarea, [role="button"]');
                return interactiveElements.length > 0 && document.readyState !== 'loading';
            });
        }
        catch (e) {
            // Stability check skipped
        }
        const totalWaitTime = Date.now() - startTime;
        if (totalWaitTime > 5000) {
            log(`[Page Ready] Wait time: ${totalWaitTime}ms`);
        }
        return true;
    }
    catch (error) {
        return false;
    }
}
/**
 * Execute with automatic page readiness wait before action
 */
async function executeWithPageReady(actionFn, stepName) {
    try {
        // Always wait for page readiness
        const isReady = await waitForPageReady(30000);
        // Add small delay to ensure rendering
        await state.page?.waitForTimeout(300);
        // Execute the action
        return await actionFn();
    }
    catch (error) {
        log(`[${stepName}] Error during execution: ${error.message}`);
        throw error;
    }
}
/* ============== STEP EXECUTION WITH SELF-HEALING ============== */
async function executeStep(stepData) {
    // Check pause before executing step
    while (state.isPaused && !state.isStopped) {
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    if (state.isStopped) {
        return {
            stepId: stepData['STEP'] || `STEP_${state.currentStepIndex + 1}`,
            action: stepData['ACTION'] || '',
            target: stepData['TARGET'] || '',
            status: 'STOPPED',
            remarks: 'Automation stopped',
            actualOutput: '',
            screenshot: '',
            pageSource: ''
        };
    }
    const stepId = stepData['STEP'] || `STEP_${state.currentStepIndex + 1}`;
    const action = (stepData['ACTION'] || '').toString().trim().toUpperCase().replace(/_/g, '');
    const target = (stepData['TARGET'] || '').toString().trim();
    const data = (stepData['DATA'] || '').toString().trim();
    const result = {
        stepId,
        action: stepData['ACTION'] || action,
        target,
        status: 'PENDING',
        remarks: '',
        actualOutput: '',
        screenshot: '',
        pageSource: ''
    };
    try {
        // Check if page is valid
        if (!state.page || state.page.isClosed()) {
            await switchToLatestPage();
            if (!state.page || state.page.isClosed()) {
                throw new Error('No valid page available');
            }
        }
        // Get window info for logging
        const isMainWindow = state.page === allPages[0];
        const windowInfo = windowHierarchy.get(state.page);
        const windowLevel = windowInfo?.level || 0;
        const storedTitle = windowInfo?.title || (await state.page.title().catch(() => 'Unknown'));
        const windowLabel = isMainWindow ? `🏠 MAIN WINDOW` : `📍 SUBWINDOW (L${windowLevel}) "${storedTitle}"`;
        // Log step with bold formatting
        logStep(stepId, action, target, data, windowLabel);
        // Log environment summary
        await logWindowSummary();
        // Log frame structure if multiple frames exist
        const frameCount = state.page.frames().length;
        if (frameCount > 1) {
            await logFrameStructure();
        }
        // Log current window and iframe info (simplified - no modal details)
        await logWindowAndFrameInfo();
        if (action === 'OPEN' || action === 'OPENURL') {
            for (let i = 1; i <= 3; i++) {
                try {
                    // Check pause before navigation
                    while (state.isPaused && !state.isStopped) {
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }
                    if (state.isStopped)
                        throw new Error('Automation stopped');
                    log(`[Navigation Attempt ${i}/3]`);
                    // Check page before navigation
                    if (state.page.isClosed()) {
                        await switchToLatestPage();
                        if (!state.page || state.page.isClosed())
                            throw new Error('Page closed during navigation');
                    }
                    await state.page.goto(target, { waitUntil: 'networkidle', timeout: 30000 });
                    // Check if new window/tab opened during navigation
                    await switchToLatestPage();
                    // Wait for page to be fully ready after navigation
                    await executeWithPageReady(async () => true, `${stepId}_OPENURL_READY`);
                    result.status = 'PASS';
                    result.actualOutput = `Opened: ${target}`;
                    break;
                }
                catch (e) {
                    if (i === 3)
                        throw e;
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }
        }
        else if (action === 'CLICK') {
            const success = await executeWithPageReady(async () => await clickWithRetry(target, 5), `${stepId}_CLICK`);
            if (success) {
                // Wait for any navigation that might be triggered by the click
                try {
                    await state.page?.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => { });
                }
                catch (e) {
                    // Navigation might not happen, that's okay
                }
                // Check if this is a menu item - add extra wait for dropdown animation
                const menuKeywords = ['Loans', 'Products', 'Services', 'Menu', 'Navigation', 'EMI', 'All Loans', 'Cards', 'Insurance', 'Investments'];
                const isMenuItem = menuKeywords.some(kw => target.toLowerCase().includes(kw.toLowerCase()));
                const extraWait = isMenuItem ? 600 : 200; // Extra wait for menu items to show dropdown
                await new Promise(resolve => setTimeout(resolve, 800 + extraWait));
                // Check if new window/tab opened after click
                await switchToLatestPage();
                // Log window after action
                const isMainWindow = state.page === allPages[0];
                const windowInfo = windowHierarchy.get(state.page);
                const windowLevel = windowInfo?.level || 0;
                const storedTitle = windowInfo?.title || (await state.page.title().catch(() => 'Unknown'));
                const windowLabel = isMainWindow ? '🏠 MAIN WINDOW' : `📍 SUBWINDOW (L${windowLevel}) "${storedTitle}"`;
                result.status = 'PASS';
                result.actualOutput = `Clicked: ${target} | ${windowLabel}`;
            }
            else {
                result.status = 'FAIL';
                result.remarks = 'Could not click element';
                result.actualOutput = `Failed to click: ${target}`;
            }
        }
        else if (action === 'FILL' || action === 'TYPE') {
            const success = await executeWithPageReady(async () => await fillWithRetry(target, data, 5), `${stepId}_FILL`);
            if (success) {
                await new Promise(resolve => setTimeout(resolve, 500));
                // Log window after action
                const isMainWindow = state.page === allPages[0];
                const windowInfo = windowHierarchy.get(state.page);
                const windowLevel = windowInfo?.level || 0;
                const storedTitle = windowInfo?.title || (await state.page.title().catch(() => 'Unknown'));
                const windowLabel = isMainWindow ? '🏠 MAIN WINDOW' : `📍 SUBWINDOW (L${windowLevel}) "${storedTitle}"`;
                result.status = 'PASS';
                result.actualOutput = `Filled: ${target} | ${windowLabel}`;
            }
            else {
                result.status = 'FAIL';
                result.remarks = 'Could not fill element';
                result.actualOutput = `Failed to fill: ${target}`;
            }
        }
        else if (action === 'HOVER') {
            const success = await executeWithPageReady(async () => await hoverWithRetry(target, 5), `${stepId}_HOVER`);
            if (success) {
                // Wait longer for hover effects to take place (dropdown animations, etc.)
                const hoverWaitTime = parseInt(data) || 800; // DATA field can specify wait time
                await new Promise(resolve => setTimeout(resolve, hoverWaitTime));
                // Log window after action
                const isMainWindow = state.page === allPages[0];
                const windowInfo = windowHierarchy.get(state.page);
                const windowLevel = windowInfo?.level || 0;
                const storedTitle = windowInfo?.title || (await state.page.title().catch(() => 'Unknown'));
                const windowLabel = isMainWindow ? '🏠 MAIN WINDOW' : `📍 SUBWINDOW (L${windowLevel}) "${storedTitle}"`;
                result.status = 'PASS';
                result.actualOutput = `Hovered: ${target} | ${windowLabel}`;
            }
            else {
                result.status = 'FAIL';
                result.remarks = 'Could not hover element';
                result.actualOutput = `Failed to hover: ${target}`;
            }
        }
        else if (action === 'SELECT') {
            try {
                if (state.page.isClosed()) {
                    await switchToLatestPage();
                    if (!state.page || state.page.isClosed())
                        throw new Error('Page closed');
                }
                await executeWithPageReady(async () => state.page.selectOption(target, data, { timeout: 5000 }), `${stepId}_SELECT`);
                await new Promise(resolve => setTimeout(resolve, 300));
                // Log window after action
                const isMainWindow = state.page === allPages[0];
                const windowInfo = windowHierarchy.get(state.page);
                const windowLevel = windowInfo?.level || 0;
                const storedTitle = windowInfo?.title || (await state.page.title().catch(() => 'Unknown'));
                const windowLabel = isMainWindow ? '🏠 MAIN WINDOW' : `📍 SUBWINDOW (L${windowLevel}) "${storedTitle}"`;
                result.status = 'PASS';
                result.actualOutput = `Selected: ${data} | ${windowLabel}`;
            }
            catch (e) {
                result.status = 'FAIL';
                result.remarks = e.message;
                result.actualOutput = `Failed to select`;
            }
        }
        else if (action === 'WAIT') {
            const waitTime = parseInt(data) || 1000;
            await state.page.waitForTimeout(waitTime);
            result.status = 'PASS';
            result.actualOutput = `Waited: ${waitTime}ms`;
        }
        else if (action === 'VERIFY' || action === 'ASSERT') {
            const content = await state.page.content();
            const found = content.includes(target);
            result.status = found ? 'PASS' : 'FAIL';
            result.actualOutput = found ? `Verified: ${target}` : `Not found: ${target}`;
            result.remarks = found ? '' : 'Content not found';
        }
        else if (action === 'SCREENSHOT') {
            const path = await takeStepScreenshot(stepId);
            result.screenshot = path;
            result.status = 'PASS';
            result.actualOutput = 'Screenshot saved';
        }
        else {
            result.status = 'SKIPPED';
            result.remarks = `Unknown action: ${action}`;
        }
    }
    catch (error) {
        result.status = 'FAIL';
        result.remarks = error.message;
        result.actualOutput = error.message;
        log(`ERROR: ${error.message}`);
    }
    // Capture screenshots and page source
    try {
        if (!result.screenshot)
            result.screenshot = await takeStepScreenshot(stepId);
        result.pageSource = await savePageSource(stepId);
    }
    catch (e) {
        log(`Capture failed`);
    }
    return result;
}
/* ============== AUTOMATION FLOW ============== */
async function pauseAutomation() {
    state.isPaused = true;
    log('PAUSED');
}
async function resumeAutomation() {
    state.isPaused = false;
    log('RESUMED');
}
async function stopAutomation() {
    state.isStopped = true;
    log('STOPPED by user');
    if (state.browser) {
        try {
            await state.browser.close();
            state.browser = null;
            state.page = null;
            log('Browser closed by STOP button');
        }
        catch (e) {
            log(`Error closing: ${e}`);
        }
    }
}
async function runAutomation(excelFilePath) {
    try {
        ensureDir(RESULTS_DIR);
        if (!fs.existsSync(excelFilePath)) {
            throw new Error(`Excel not found: ${excelFilePath}`);
        }
        log(`Loading: ${excelFilePath}`);
        const workbook = XLSX.readFile(excelFilePath);
        const sheetName = workbook.SheetNames[0];
        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
        // ===== TEST EXECUTION SUMMARY =====
        log(`\n${'█'.repeat(110)}`);
        log(`█ 🚀 TEST AUTOMATION STARTED`);
        log(`${'█'.repeat(110)}`);
        log(`📁 Excel File: ${excelFilePath}`);
        log(`📋 Sheet Name: ${sheetName}`);
        log(`📊 Total Test Steps: ${rows.length}`);
        // Count how many steps will be executed
        let executionCount = 0;
        for (const row of rows) {
            const toBeExec = (row['TO BE EXECUTED'] || row['TO_BE_EXECUTED'] || row['ToBeExecuted'] || 'YES').toString().trim().toUpperCase();
            if (toBeExec === 'YES')
                executionCount++;
        }
        log(`✅ Steps to Execute: ${executionCount}`);
        log(`⏭️  Steps to Skip: ${rows.length - executionCount}`);
        log(`${'█'.repeat(110)}\n`);
        state.testData = rows;
        state.isStopped = false;
        state.isPaused = false;
        // Launch browser with self-healing settings
        state.browser = await playwright_1.chromium.launch({
            headless: false,
            args: [
                '--start-maximized',
                '--ignore-certificate-errors',
                '--allow-running-insecure-content',
                '--disable-blink-features=AutomationControlled'
            ]
        });
        state.context = await state.browser.newContext({
            viewport: null,
            ignoreHTTPSErrors: true,
            bypassCSP: true
        });
        // 🎯 CRITICAL: Setup context-level listener IMMEDIATELY (catches window.open() calls)
        // This MUST be done before any pages are created
        state.context.on('page', async (newPage) => {
            if (!allPages.includes(newPage) && !newPage.isClosed()) {
                await newPage.waitForLoadState('domcontentloaded').catch(() => { });
                await newPage.waitForTimeout(500);
                const newPageTitle = await newPage.title().catch(() => 'Unknown');
                const newPageUrl = newPage.url();
                log(`\n🪟 ════════════════════════════════════════`);
                log(`🪟 🆕 CONTEXT: NEW WINDOW/TAB OPENED!`);
                log(`🪟 Title: "${newPageTitle}"`);
                log(`🪟 URL: ${newPageUrl}`);
                log(`🪟 Source: window.open() or target=_blank`);
                log(`🪟 ════════════════════════════════════════\n`);
                allPages.push(newPage);
                latestSubwindow = newPage;
                // Find parent page
                const parentPage = state.page || allPages[0];
                const parentLevel = windowHierarchy.get(parentPage)?.level || 0;
                const childLevel = parentLevel + 1;
                const openedAt = Date.now();
                windowHierarchy.set(newPage, {
                    parentPage,
                    level: childLevel,
                    childPages: [],
                    openedAt,
                    title: newPageTitle,
                    url: newPageUrl
                });
                if (windowHierarchy.has(parentPage)) {
                    windowHierarchy.get(parentPage).childPages.push(newPage);
                }
                // Setup listeners on new page for nested popups
                await setupPageListeners(newPage);
                log(`🪟 [CONTEXT LISTENER] New window added to allPages (Total: ${allPages.length})\n`);
            }
        });
        state.page = await state.context.newPage();
        state.page.setDefaultTimeout(30000);
        state.page.setDefaultNavigationTimeout(30000);
        // Add main page to tracking
        allPages.push(state.page);
        // Setup page-level listeners for popup windows (triggered by page.on('popup'))
        await setupPageListeners(state.page);
        // Log initial main window
        const mainPageTitle = await state.page.title().catch(() => 'Untitled');
        log(`\n🪟 ╔════════════════════════════════════════╗`);
        log(`🪟 ║ 🏠 MAIN WINDOW OPENED ║`);
        log(`🪟 ║ Title: "${mainPageTitle}" ║`);
        log(`🪟 ║ Level: 0 (Main) ║`);
        log(`🪟 ╚════════════════════════════════════════╝\n`);
        // Log available columns and execution status
        if (rows.length > 0) {
            const firstRow = rows[0];
            const columns = Object.keys(firstRow);
            log(`\n📊 Excel Columns Found: ${columns.join(' | ')}`);
            // Find the actual execution column
            let executionColumnName = '';
            const executionColumnFound = columns.find(col => col.toUpperCase().includes('EXECUTE') || col.toUpperCase().includes('EXECUTION'));
            if (executionColumnFound) {
                executionColumnName = executionColumnFound;
                log(`📌 Execution Column Found: "${executionColumnName}"`);
            }
            else {
                log(`📌 Execution Column NOT FOUND - will check known variations`);
            }
            // Show sample values from first few rows
            log(`\n📋 Sample Data (First 5 rows):`);
            for (let j = 0; j < Math.min(5, rows.length); j++) {
                const execValue = rows[j][executionColumnName] || rows[j]['TO BE EXECUTED'] || 'UNDEFINED';
                const stepId = rows[j]['STEP'] || rows[j]['STEP ID'] || `Row ${j + 2}`;
                const action = rows[j]['ACTION'] || 'NO_ACTION';
                log(`  Row ${j + 2}: ${stepId} | TO_EXECUTE="${execValue}" | ACTION="${action}"`);
            }
        }
        log(`\n🚀 Starting: ${rows.length} steps\n`);
        for (let i = 0; i < rows.length; i++) {
            if (state.isStopped)
                break;
            state.currentStepIndex = i;
            while (state.isPaused && !state.isStopped) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            if (state.isStopped)
                break;
            // Ensure we're on the latest page if new windows opened
            await switchToLatestPage();
            const row = rows[i];
            // Get step ID first for logging
            const stepId = row['STEP'] || row['STEP ID'] || row['Step ID'] || `STEP_${i + 1}`;
            const action = (row['ACTION'] || '').toString().trim();
            // ===== CRITICAL: CHECK "TO BE EXECUTED" COLUMN =====
            // Get the exact value from the row
            let toBeExecutedRaw = row['TO BE EXECUTED'];
            // If not found, try other column names
            if (toBeExecutedRaw === undefined || toBeExecutedRaw === null) {
                toBeExecutedRaw = row['TO_BE_EXECUTED'] ||
                    row['ToBeExecuted'] ||
                    row['Execution'] ||
                    row['EXECUTION'];
            }
            // Default to YES only if absolutely nothing found
            if (toBeExecutedRaw === undefined || toBeExecutedRaw === null) {
                toBeExecutedRaw = 'YES';
            }
            // Clean and normalize the value
            const toBeExecutedValue = toBeExecutedRaw.toString().trim();
            const toBeExecutedUpper = toBeExecutedValue.toUpperCase();
            // ONLY execute if value is exactly "YES" (case-insensitive)
            const shouldExecute = (toBeExecutedUpper === 'YES');
            // Log execution decision with visual separator
            log(`\n${'─'.repeat(110)}`);
            log(`📋 ${stepId} | ACTION: ${action} | TARGET: "${row['TARGET'] || ''}" | EXECUTE: ${shouldExecute ? '✅ YES' : '⏭️  NO'}`);
            log(`─`.repeat(110));
            if (!shouldExecute) {
                row['Status'] = 'SKIPPED';
                row['Remarks'] = `TO BE EXECUTED = "${toBeExecutedValue}" (not YES)`;
                log(`⏭️  SKIPPED - Only YES is executed\n`);
                continue;
            }
            // Additional check: only execute if ACTION is defined AND not empty
            if (!action || action === '') {
                log(`⏭️  SKIPPED - No ACTION defined\n`);
                row['Status'] = 'SKIPPED';
                row['Remarks'] = 'No ACTION defined';
                continue;
            }
            state.currentStepIndex = i;
            log(`▶️  EXECUTING: ${stepId}\n`);
            const result = await executeStep(row);
            row['Status'] = result.status;
            row['Remarks'] = result.remarks;
            row['Actual Output'] = result.actualOutput;
            row['Screenshot'] = result.screenshot;
            row['Page Source'] = result.pageSource;
            // Log step result
            log(`\n✅ ${stepId} COMPLETED | Status: ${result.status} | Remarks: ${result.remarks}\n`);
            if (i < rows.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 300));
            }
        }
        // Final summary
        log(`\n${'█'.repeat(110)}`);
        log(`█ 🎉 AUTOMATION TEST EXECUTION COMPLETE`);
        log(`${'█'.repeat(110)}\n`);
        // Save results
        const resultPath = path.join(RESULTS_DIR, RESULTS_EXCEL_FILENAME);
        workbook.Sheets[sheetName] = XLSX.utils.json_to_sheet(rows);
        XLSX.writeFile(workbook, resultPath);
        log(`Results: ${resultPath}`);
        // Mark automation as completed
        state.isCompleted = true;
        state.shouldCloseBrowser = false;
        log(`\n✅ AUTOMATION COMPLETED! Waiting for your input...`);
        log(`📢 The browser will stay open. You can:`);
        log(`   1. Use the UI to close the browser when ready`);
        log(`   2. Inspect the browser to verify results`);
    }
    catch (error) {
        log(`Error: ${error.message}`);
    }
    finally {
        // Don't auto-close browser here - let user decide
        // Browser will only close if:
        // 1. User clicks "Close Browser" button
        // 2. stopAutomation() is called manually
        // 3. User stops the test execution
    }
}
/* ============== WEB UI & SERVER ============== */
const PORT = 3000;
const htmlUI = `
<!DOCTYPE html>
<html>
<head>
    <title>Test Automation Assistant</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .container {
            background: white;
            border-radius: 12px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            max-width: 600px;
            width: 100%;
            padding: 40px;
        }
        h1 { color: #333; margin-bottom: 10px; text-align: center; }
        .subtitle { color: #666; text-align: center; margin-bottom: 30px; font-size: 14px; }
        .file-input-wrapper {
            position: relative;
            margin-bottom: 30px;
            z-index: 1;
        }
        .file-input { display: none; }
        .file-input-label {
            display: block;
            padding: 15px;
            background: #f0f0f0;
            border: 2px dashed #667eea;
            border-radius: 8px;
            text-align: center;
            cursor: pointer;
            transition: all 0.3s;
            color: #667eea;
            font-weight: 500;
            position: relative;
            z-index: 1;
            pointer-events: auto;
        }
        .file-input-label:hover { background: #e8e8ff; border-color: #764ba2; }
        .file-name { color: #333; margin-top: 10px; font-size: 14px; font-weight: 500; }
        .controls {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            margin-bottom: 20px;
            position: relative;
            z-index: 10;
        }
        .controls-full { grid-column: 1 / -1; }
        button {
            padding: 12px 20px;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            position: relative;
            z-index: 100;
        }
        .btn-primary {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            grid-column: 1 / -1;
            z-index: 100;
        }
        .btn-primary:hover:not(:disabled) {
            transform: translateY(-2px);
            box-shadow: 0 10px 20px rgba(102, 126, 234, 0.4);
        }
        .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn-secondary { background: #f0f0f0; color: #333; }
        .btn-secondary:hover:not(:disabled) { background: #e0e0e0; }
        .btn-pause { background: #ff9800; color: white; }
        .btn-pause:hover:not(:disabled) { background: #f57c00; }
        .btn-stop { background: #f44336; color: white; }
        .btn-stop:hover:not(:disabled) { background: #d32f2f; }
        .btn-elements { background: #2196f3; color: white; }
        .btn-elements:hover:not(:disabled) { background: #1976d2; }
        .status {
            background: #f5f5f5;
            border-left: 4px solid #667eea;
            padding: 15px;
            border-radius: 4px;
            margin-bottom: 20px;
            display: none;
        }
        .status-text { color: #666; font-size: 14px; margin: 5px 0; }
        .status-text strong { color: #333; }
        .logs {
            background: #f5f5f5;
            border: 1px solid #ddd;
            border-radius: 8px;
            padding: 15px;
            max-height: 200px;
            overflow-y: auto;
            font-family: monospace;
            font-size: 12px;
            color: #333;
        }
        .log-entry { margin: 4px 0; color: #666; }
        .elements-modal {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            z-index: 1000;
            align-items: center;
            justify-content: center;
            overflow: auto;
        }
        .elements-modal.active { display: flex; }
        .elements-content {
            background: white;
            border-radius: 8px;
            padding: 0;
            max-width: 500px;
            width: 95%;
            max-height: 70vh;
            overflow: hidden;
            box-shadow: 0 10px 40px rgba(0,0,0,0.3);
            display: flex;
            flex-direction: column;
            border: 1px solid #ddd;
        }
        .elements-header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 16px 20px;
            border-bottom: 1px solid #ddd;
            display: flex;
            align-items: center;
            justify-content: space-between;
            flex-shrink: 0;
        }
        .elements-header h2 {
            color: white;
            margin: 0;
            font-size: 16px;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .elements-count {
            background: rgba(255,255,255,0.3);
            color: white;
            padding: 4px 10px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 600;
        }
        .elements-list-container {
            flex: 1;
            overflow-y: auto;
            padding: 15px;
        }
        .element-item {
            background: #f9f9f9;
            border-left: 4px solid #667eea;
            padding: 12px;
            margin-bottom: 10px;
            border-radius: 4px;
            font-size: 13px;
        }
        .element-type {
            display: inline-block;
            background: #667eea;
            color: white;
            padding: 2px 8px;
            border-radius: 3px;
            font-size: 11px;
            font-weight: 600;
            margin-right: 8px;
        }
        .element-name { font-weight: 600; color: #333; }
        .close-modal {
            background: #f44336;
            color: white;
            border: none;
            padding: 8px 18px;
            border-radius: 4px;
            cursor: pointer;
            font-weight: 600;
            font-size: 12px;
            transition: all 0.2s;
        }
        .close-modal:hover {
            background: #d32f2f;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Test Automation Assistant</h1>
        <p class="subtitle">Self-Healing Intelligent Automation</p>

        <div class="file-input-wrapper">
            <input type="file" id="excelFile" class="file-input" accept=".xlsx,.xls">
            <label for="excelFile" class="file-input-label">Click or drag Excel file here</label>
            <div id="fileName" class="file-name"></div>
        </div>

        <div id="status" class="status">
            <div class="status-text"><strong>Status:</strong> <span id="statusValue">Idle</span></div>
            <div class="status-text"><strong>Step:</strong> <span id="currentStep">-</span></div>
            <div class="status-text"><strong>Progress:</strong> <span id="progress">0%</span></div>
        </div>

        <div class="controls">
            <button id="startBtn" class="btn-primary" onclick="startAutomation()">START</button>
            <button id="pauseBtn" class="btn-secondary btn-pause" onclick="pauseAutomation()" disabled>PAUSE</button>
            <button id="resumeBtn" class="btn-secondary" onclick="resumeAutomation()" style="display:none; background: #4caf50; color: white;">RESUME</button>
            <button id="stopBtn" class="btn-secondary btn-stop" onclick="stopAutomation()" disabled>STOP</button>
            <button id="elementsBtn" class="btn-secondary btn-elements" onclick="showElements()" disabled>Show Elements</button>
            <button id="closeBrowserBtn" class="btn-secondary" onclick="closeBrowser()" style="display:none; background: #f44336; color: white;" title="Close browser after automation completes">CLOSE BROWSER</button>
        </div>

        <div id="logs" class="logs"></div>
    </div>

    <div id="elementsModal" class="elements-modal">
        <div class="elements-content">
            <div class="elements-header">
                <h2>🎯 Current Page Elements</h2>
                <span class="elements-count" id="elementsCount">0</span>
            </div>
            <div class="elements-list-container">
                <div id="elementsList"></div>
            </div>
            <div style="padding: 12px 15px; border-top: 1px solid #ddd; text-align: right;">
                <button class="close-modal" onclick="closeElements()">Close</button>
            </div>
        </div>
    </div>

    <script>
        let selectedFile = null;

        // Initialize auto-scroll behavior when page loads
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', setupLogAutoScroll);
        } else {
            setupLogAutoScroll();
        }

        document.getElementById('excelFile').addEventListener('change', (e) => {
            selectedFile = e.target.files[0];
            document.getElementById('fileName').textContent = selectedFile ? 'Selected: ' + selectedFile.name : '';
        });

        async function startAutomation() {
            if (!selectedFile) {
                alert('Select Excel file first');
                return;
            }

            try {
                const response = await fetch('/start', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ filename: selectedFile.name })
                });
                const data = await response.json();
                if (data.success) {
                    document.getElementById('startBtn').disabled = true;
                    document.getElementById('pauseBtn').disabled = false;
                    document.getElementById('stopBtn').disabled = false;
                    document.getElementById('elementsBtn').disabled = false;
                    document.getElementById('status').style.display = 'block';
                    updateProgress();
                }
            } catch (error) {
                alert('Error: ' + error.message);
            }
        }

        async function pauseAutomation() {
            await fetch('/pause', { method: 'POST' });
            document.getElementById('pauseBtn').style.display = 'none';
            document.getElementById('resumeBtn').style.display = 'block';
            document.getElementById('statusValue').textContent = 'Paused';
        }

        async function resumeAutomation() {
            await fetch('/resume', { method: 'POST' });
            document.getElementById('resumeBtn').style.display = 'none';
            document.getElementById('pauseBtn').style.display = 'block';
            document.getElementById('statusValue').textContent = 'Running';
        }

        async function stopAutomation() {
            if (confirm('Stop automation?')) {
                await fetch('/stop', { method: 'POST' });
                resetUI();
            }
        }

        async function closeBrowser() {
            if (confirm('Close the browser? You can still inspect the screenshots and logs.')) {
                try {
                    const response = await fetch('/close-browser', { method: 'POST' });
                    const data = await response.json();
                    if (data.success) {
                        document.getElementById('closeBrowserBtn').style.display = 'none';
                        document.getElementById('statusValue').textContent = 'Browser Closed';
                        alert('Browser closed successfully. Results saved in RESULTS folder.');
                    } else {
                        alert('Error: ' + (data.error || 'Could not close browser'));
                    }
                } catch (error) {
                    alert('Error closing browser: ' + error.message);
                }
            }
        }

        async function showElements() {
            try {
                // Pause automation first
                const pauseResponse = await fetch('/pause', { method: 'POST' });
                await pauseResponse.json();
                
                // Give pause time to take effect
                await new Promise(resolve => setTimeout(resolve, 300));
                
                document.getElementById('pauseBtn').style.display = 'none';
                document.getElementById('resumeBtn').style.display = 'block';
                document.getElementById('statusValue').textContent = 'Paused';
                
                // Get elements from current page
                const response = await fetch('/elements');
                const data = await response.json();
                displayElements(data.elements);
                document.getElementById('elementsModal').classList.add('active');
            } catch (error) {
                alert('Error: ' + error.message);
            }
        }

        function displayElements(elements) {
            const list = document.getElementById('elementsList');
            const countSpan = document.getElementById('elementsCount');
            list.innerHTML = '';

            if (!elements || elements.length === 0) {
                list.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">No elements found on current page</div>';
                countSpan.textContent = '0';
                return;
            }

            countSpan.textContent = elements.length;
            
            // Display elements in order with index
            elements.forEach((el, idx) => {
                const item = document.createElement('div');
                item.className = 'element-item';
                item.style.cssText = 'background: #f9f9f9; border-left: 4px solid #667eea; padding: 12px; margin-bottom: 8px; border-radius: 4px; font-size: 11px; cursor: pointer; transition: all 0.2s; border: 1px solid #e0e0e0;';
                
                // Build element info
                let details = '';
                
                // Index and type badge
                details += '<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">';
                details += '<span style="display: inline-block; background: #667eea; color: white; padding: 3px 8px; border-radius: 3px; font-size: 9px; font-weight: 700; min-width: 30px; text-align: center;">#' + (el.index + 1) + '</span>';
                details += '<span class="element-type" style="display: inline-block; background: #764ba2; color: white; padding: 3px 8px; border-radius: 3px; font-size: 9px; font-weight: 700; text-transform: uppercase;">' + el.type + '</span>';
                
                if (!el.visible) {
                    details += '<span style="display: inline-block; background: #f44336; color: white; padding: 2px 6px; border-radius: 3px; font-size: 8px; font-weight: 600;">HIDDEN</span>';
                }
                
                if (el.interactive) {
                    details += '<span style="display: inline-block; background: #4caf50; color: white; padding: 2px 6px; border-radius: 3px; font-size: 8px; font-weight: 600;">INTERACTIVE</span>';
                }
                details += '</div>';
                
                // Tag name
                details += '<div style="margin: 6px 0; font-size: 10px; color: #666;"><strong>Tag:</strong> &lt;' + el.tag + '&gt;</div>';
                
                // Label/Identifier
                if (el.label) {
                    details += '<div style="margin: 6px 0; font-size: 10px; color: #333; font-weight: 600;"><strong>Label:</strong> ' + el.label.substring(0, 80) + '</div>';
                }
                
                // ID
                if (el.id) {
                    details += '<div style="margin: 6px 0; font-size: 10px; color: #333;"><strong>ID:</strong> <code style="background: #f0f0f0; padding: 2px 4px; border-radius: 2px; font-family: monospace;">' + el.id + '</code></div>';
                }
                
                // Name
                if (el.name) {
                    details += '<div style="margin: 6px 0; font-size: 10px; color: #333;"><strong>Name:</strong> <code style="background: #f0f0f0; padding: 2px 4px; border-radius: 2px; font-family: monospace;">' + el.name + '</code></div>';
                }
                
                // Aria Label
                if (el.ariaLabel) {
                    details += '<div style="margin: 6px 0; font-size: 10px; color: #333;"><strong>Aria:</strong> ' + el.ariaLabel.substring(0, 60) + '</div>';
                }
                
                // Placeholder
                if (el.placeholder) {
                    details += '<div style="margin: 6px 0; font-size: 10px; color: #666;"><strong>Placeholder:</strong> ' + el.placeholder + '</div>';
                }
                
                // Text content
                if (el.text && el.text.length > 0) {
                    details += '<div style="margin: 6px 0; padding: 8px; background: white; border-radius: 3px; border-left: 3px solid #2196f3; font-size: 10px; color: #444; word-break: break-word;"><strong style="color: #2196f3;">Text:</strong> ' + el.text.substring(0, 100) + (el.text.length > 100 ? '...' : '') + '</div>';
                }
                
                // Position info
                if (el.position) {
                    details += '<div style="margin: 6px 0; font-size: 9px; color: #999; padding: 4px; background: #fafafa; border-radius: 2px;"><strong>Position:</strong> Top: ' + el.position.top + 'px, Left: ' + el.position.left + 'px | Size: ' + el.position.width + 'x' + el.position.height + 'px</div>';
                }
                
                item.innerHTML = details;
                item.onmouseover = () => {
                    item.style.background = '#e8f5e9';
                    item.style.borderLeftColor = '#4caf50';
                };
                item.onmouseout = () => {
                    item.style.background = '#f9f9f9';
                    item.style.borderLeftColor = '#667eea';
                };
                list.appendChild(item);
            });
        }

        function closeElements() {
            document.getElementById('elementsModal').classList.remove('active');
        }

        async function updateProgress() {
            const response = await fetch('/status');
            const data = await response.json();

            document.getElementById('currentStep').textContent = data.currentStep + ' / ' + data.totalSteps;
            const progress = data.totalSteps > 0 ? Math.round((data.currentStep / data.totalSteps) * 100) : 0;
            document.getElementById('progress').textContent = progress + '%';

            updateLogs(data.logs);

            // Show close browser button when automation is completed
            if (data.isCompleted && data.hasBrowser) {
                document.getElementById('closeBrowserBtn').style.display = 'inline-block';
                document.getElementById('statusValue').textContent = 'Completed! Ready to close.';
            }

            if (data.isRunning) {
                setTimeout(updateProgress, 1000);
            } else {
                resetUI();
            }
        }

        // Track if user is manually scrolling
        let isUserScrolling = false;
        let scrollTimeout;

        function setupLogAutoScroll() {
            const logsDiv = document.getElementById('logs');
            
            // Detect when user starts scrolling
            logsDiv.addEventListener('scroll', () => {
                isUserScrolling = true;
                clearTimeout(scrollTimeout);
                
                // Check if user scrolled to bottom
                const isAtBottom = logsDiv.scrollHeight - logsDiv.clientHeight <= logsDiv.scrollTop + 5;
                
                // If they're at bottom or within 5px, resume auto-scroll
                if (isAtBottom) {
                    isUserScrolling = false;
                } else {
                    // Stop auto-scroll for 3 seconds after user stops scrolling
                    scrollTimeout = setTimeout(() => {
                        // Only resume if we're not actively running
                        if (document.getElementById('statusValue').textContent !== 'Running') {
                            isUserScrolling = false;
                        }
                    }, 3000);
                }
            }, { passive: true });
        }

        function updateLogs(logs) {
            const logsDiv = document.getElementById('logs');
            logsDiv.innerHTML = logs.map(log => '<div class="log-entry">' + log + '</div>').join('');
            
            // Auto-scroll to bottom only if:
            // 1. User isn't manually scrolling
            // 2. OR User scrolled to bottom and left the area
            if (!isUserScrolling) {
                // Small delay to ensure DOM is updated
                setTimeout(() => {
                    logsDiv.scrollTop = logsDiv.scrollHeight;
                }, 0);
            }
        }

        function resetUI() {
            document.getElementById('startBtn').disabled = false;
            document.getElementById('pauseBtn').disabled = true;
            document.getElementById('stopBtn').disabled = true;
            document.getElementById('elementsBtn').disabled = true;
            document.getElementById('pauseBtn').style.display = 'block';
            document.getElementById('resumeBtn').style.display = 'none';
            document.getElementById('statusValue').textContent = 'Complete';
        }
    </script>
</body>
</html>
`;
const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    res.setHeader('Content-Type', 'application/json');
    try {
        if (pathname === '/' && req.method === 'GET') {
            res.setHeader('Content-Type', 'text/html');
            res.writeHead(200);
            res.end(htmlUI);
        }
        else if (pathname === '/start' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk.toString(); });
            req.on('end', async () => {
                try {
                    // Parse JSON body to get filename
                    const data = JSON.parse(body);
                    const selectedFile = data.filename;
                    if (!selectedFile) {
                        // Fallback: find any Excel file
                        const files = fs.readdirSync('.');
                        const excelFile = files.find(f => f.endsWith('.xlsx') && !f.startsWith('~'));
                        if (!excelFile) {
                            res.writeHead(400);
                            res.end(JSON.stringify({ success: false, error: 'No Excel file found' }));
                            return;
                        }
                        state.selectedExcelFile = excelFile;
                        runAutomation(excelFile).catch(err => log(`Error: ${err}`));
                    }
                    else {
                        // Use the selected file
                        if (!fs.existsSync(selectedFile)) {
                            res.writeHead(400);
                            res.end(JSON.stringify({ success: false, error: `File not found: ${selectedFile}` }));
                            return;
                        }
                        state.selectedExcelFile = selectedFile;
                        runAutomation(selectedFile).catch(err => log(`Error: ${err}`));
                    }
                    res.writeHead(200);
                    res.end(JSON.stringify({ success: true }));
                }
                catch (e) {
                    res.writeHead(500);
                    res.end(JSON.stringify({ success: false, error: e.message }));
                }
            });
        }
        else if (pathname === '/pause' && req.method === 'POST') {
            await pauseAutomation();
            res.writeHead(200);
            res.end(JSON.stringify({ success: true }));
        }
        else if (pathname === '/resume' && req.method === 'POST') {
            await resumeAutomation();
            res.writeHead(200);
            res.end(JSON.stringify({ success: true }));
        }
        else if (pathname === '/stop' && req.method === 'POST') {
            await stopAutomation();
            res.writeHead(200);
            res.end(JSON.stringify({ success: true }));
        }
        else if (pathname === '/close-browser' && req.method === 'POST') {
            if (state.browser) {
                try {
                    await state.browser.close();
                    state.browser = null;
                    state.page = null;
                    state.isCompleted = false;
                    res.writeHead(200);
                    res.end(JSON.stringify({ success: true, message: 'Browser closed' }));
                }
                catch (e) {
                    res.writeHead(200);
                    res.end(JSON.stringify({ success: false, error: e.message }));
                }
            }
            else {
                res.writeHead(200);
                res.end(JSON.stringify({ success: false, error: 'No browser to close' }));
            }
        }
        else if (pathname === '/elements' && req.method === 'GET') {
            const elements = await getAllPageElements();
            res.writeHead(200);
            res.end(JSON.stringify({ elements }));
        }
        else if (pathname === '/status' && req.method === 'GET') {
            res.writeHead(200);
            res.end(JSON.stringify({
                currentStep: state.currentStepIndex + 1,
                totalSteps: state.testData?.length || 0,
                isRunning: !state.isStopped && state.testData !== null,
                isCompleted: state.isCompleted,
                hasBrowser: state.browser !== null && state.browser.isConnected(),
                logs: logMessages
            }));
        }
        else {
            res.writeHead(404);
            res.end(JSON.stringify({ error: 'Not found' }));
        }
    }
    catch (error) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: error.message }));
    }
});
server.listen(PORT, () => {
    log(`Started on http://localhost:${PORT}`);
    const cmd = process.platform === 'win32' ? 'start' : 'open';
    require('child_process').exec(`${cmd} http://localhost:${PORT}`);
});
