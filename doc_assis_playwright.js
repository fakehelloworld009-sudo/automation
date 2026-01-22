"use strict";
/* ============================================================
   Excel Driven Test Assistant — Playwright TypeScript Version
   ENGINE CONVERSION: Selenium Python ➜ Playwright TypeScript
   ⚠️ LOGIC, FLOW, STRUCTURE PRESERVED — NO REDESIGN
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
/* ----------------- GLOBAL CONSTANTS ----------------- */
const RESULTS_DIR = 'RESULTS';
const SCREENSHOTS_DIR = path.join(RESULTS_DIR, 'screenshots');
const SOURCES_DIR = path.join(RESULTS_DIR, 'page_sources');
const RESULTS_EXCEL_FILENAME = 'Test_Results.xlsx';
const MAX_POPUP_ATTEMPTS = 3;
/* ----------------- GLOBAL RUNTIME STATE ----------------- */
let browser;
let context;
let page;
let storedPassword = null;
/* ----------------- BROWSER CREATION ----------------- */
async function createBrowser() {
    browser = await playwright_1.chromium.launch({
        headless: false,
        args: [
            '--start-maximized',
            '--ignore-certificate-errors',
            '--allow-insecure-localhost'
        ]
    });
    context = await browser.newContext({
        viewport: null,
        ignoreHTTPSErrors: true
    });
    page = await context.newPage();
    return page;
}
/* ----------------- SAFE FILE HELPERS ----------------- */
function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}
async function takeStepScreenshot(stepId) {
    ensureDir(SCREENSHOTS_DIR);
    const filePath = path.join(SCREENSHOTS_DIR, `${stepId}.png`);
    try {
        await page.screenshot({ path: filePath, fullPage: true });
    }
    catch { }
    return path.relative(RESULTS_DIR, filePath).replace(/\\/g, '/');
}
async function savePageSource(stepId) {
    ensureDir(SOURCES_DIR);
    const filePath = path.join(SOURCES_DIR, `${stepId}_source.html`);
    try {
        const html = await page.content();
        fs.writeFileSync(filePath, html, 'utf-8');
    }
    catch { }
    return path.relative(RESULTS_DIR, filePath).replace(/\\/g, '/');
}
/* ----------------- DIALOG (ALERT) HANDLING ----------------- */
async function attachDialogHandler(logFunc) {
    page.on('dialog', async (dialog) => {
        const text = dialog.message().toUpperCase();
        if (logFunc)
            logFunc(`[POPUP] JS Dialog detected: ${text}`);
        try {
            await dialog.accept();
        }
        catch {
            try {
                await dialog.dismiss();
            }
            catch { }
        }
        // CLEAR USER logic preserved
        if (text.includes('CLEAR USER') && storedPassword) {
            if (logFunc)
                logFunc('[POPUP] CLEAR USER detected. Triggering password re-entry.');
            await handlePasswordReentry(storedPassword, logFunc);
        }
    });
}
/* ----------------- FORCE INTERACTION (JS INJECTION) ----------------- */
async function ensureInteractableAndSetValue(element, value, logFunc) {
    if (logFunc)
        logFunc('[DEBUG] Executing forced JS visibility + injection');
    try {
        await element.scrollIntoViewIfNeeded();
        await element.evaluate((el) => {
            el.style.display = 'block';
            el.style.visibility = 'visible';
            el.style.opacity = '1';
            el.style.pointerEvents = 'auto';
            el.disabled = false;
            el.readOnly = false;
            if (el.parentNode) {
                el.parentNode.style.pointerEvents = 'auto';
            }
        });
        await element.click({ clickCount: 2, force: true });
        await element.evaluate((el, val) => {
            el.value = val;
            el.setAttribute('value', val);
            el.dispatchEvent(new Event('focus', { bubbles: true }));
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            el.blur();
        }, value);
        const currentVal = await element.evaluate((el) => el.value);
        return currentVal === value;
    }
    catch (e) {
        if (logFunc)
            logFunc(`[FATAL] JS injection failed: ${e}`);
        return false;
    }
}
/* ----------------- IFRAME RECURSIVE SEARCH ----------------- */
async function searchAllFramesRecursive(frame, locatorFunc, depth = 0, maxDepth = 10) {
    if (depth > maxDepth)
        return { element: null, frameChain: [] };
    try {
        const found = await locatorFunc(frame);
        if (found)
            return { element: found, frameChain: [] };
    }
    catch { }
    const childFrames = frame.childFrames();
    for (const child of childFrames) {
        const result = await searchAllFramesRecursive(child, locatorFunc, depth + 1, maxDepth);
        if (result.element) {
            return { element: result.element, frameChain: [child, ...result.frameChain] };
        }
    }
    return { element: null, frameChain: [] };
}
/* ----------------- PASSWORD RE-ENTRY (LOGIC PRESERVED) ----------------- */
async function handlePasswordReentry(password, logFunc) {
    if (!password)
        return false;
    const locator = async (ctx) => {
        const inputs = await ctx.$$('input');
        for (const inp of inputs) {
            try {
                const type = await inp.getAttribute('type');
                if (type && type.toLowerCase() === 'password') {
                    return inp;
                }
            }
            catch { }
        }
        return null;
    };
    let result = await locator(page);
    if (!result) {
        const frameSearch = await searchAllFramesRecursive(page.mainFrame(), locator);
        result = frameSearch.element;
    }
    if (!result) {
        if (logFunc)
            logFunc('[RE-ENTRY] Password field NOT found.');
        return false;
    }
    if (logFunc)
        logFunc('[RE-ENTRY] Password field found. Filling...');
    const ok = await ensureInteractableAndSetValue(result, password, logFunc);
    if (!ok)
        return false;
    try {
        await result.press('Enter');
        await page.waitForTimeout(2000);
        return true;
    }
    catch {
        return false;
    }
}
/* ============================================================
   PART 2 — KNOWLEDGE INHERITANCE & CONTEXT MATCHING
   ============================================================ */
/* ----------------- DISCOVER ACTIVE CONTEXT ----------------- */
async function discoverActiveContext(logFunc) {
    const context = {};
    const xpath = `
        //button | //a | //input[not(@type='hidden')] |
        //textarea | //select |
        //div | //span | //li
    `;
    let elements = [];
    try {
        elements = await page.$$(xpath);
    }
    catch {
        return context;
    }
    for (const el of elements) {
        try {
            const box = await el.boundingBox();
            if (!box || box.width < 5 || box.height < 5)
                continue;
            const pe = await el.evaluate((e) => {
                return globalThis
                    .getComputedStyle(e)
                    .pointerEvents;
            });
            if (pe === 'none')
                continue;
            const text = ((await el.textContent()) ||
                (await el.getAttribute('value')) ||
                (await el.getAttribute('aria-label')) ||
                (await el.getAttribute('title')) ||
                '').trim();
            if (!text)
                continue;
            context[text.toUpperCase()] = el;
        }
        catch {
            continue;
        }
    }
    if (logFunc)
        logFunc(`[CONTEXT] Active elements found: ${Object.keys(context).length}`);
    return context;
}
/* ----------------- MATCH TARGET TO CONTEXT ----------------- */
function matchTargetToContext(target, context) {
    const targetU = target.trim().toUpperCase();
    if (context[targetU])
        return context[targetU];
    for (const key of Object.keys(context)) {
        if (key.includes(targetU) || targetU.includes(key)) {
            return context[key];
        }
    }
    const synonyms = {
        LOGIN: ['SIGN IN', 'LOG IN'],
        CONTINUE: ['NEXT', 'PROCEED'],
        SUBMIT: ['OK', 'DONE'],
        'ADD TO CART': ['ADD', 'CART'],
        BUY: ['BUY NOW', 'PURCHASE']
    };
    if (synonyms[targetU]) {
        for (const alt of synonyms[targetU]) {
            if (context[alt])
                return context[alt];
        }
    }
    return null;
}
/* ----------------- INHERIT PAGE KNOWLEDGE ----------------- */
async function inheritPageKnowledge(logFunc) {
    const knowledge = {};
    const xpath = `
        //button | //a[@href] | //input[not(@type='hidden')] |
        //textarea | //select |
        //*[self::div or self::span][normalize-space()!='']
    `;
    let elements = [];
    try {
        elements = await page.$$(xpath);
    }
    catch {
        return knowledge;
    }
    if (logFunc)
        logFunc(`[KNOWLEDGE] Scanning ${elements.length} elements`);
    for (const el of elements) {
        try {
            const box = await el.boundingBox();
            if (!box)
                continue;
            let text = (await el.textContent())?.trim() ||
                (await el.getAttribute('value')) ||
                (await el.getAttribute('aria-label')) ||
                (await el.getAttribute('title')) ||
                '';
            if (text) {
                knowledge[text.toUpperCase()] = el;
            }
            const id = await el.getAttribute('id');
            if (id)
                knowledge[`ID=${id.toUpperCase()}`] = el;
            const name = await el.getAttribute('name');
            if (name)
                knowledge[`NAME=${name.toUpperCase()}`] = el;
        }
        catch {
            continue;
        }
    }
    if (logFunc) {
        logFunc(`[KNOWLEDGE] Inherited ${Object.keys(knowledge).length} elements`);
    }
    return knowledge;
}
/* ----------------- ACTIVE MODAL DETECTION ----------------- */
async function findActiveModal(ctx) {
    const modalXPath = `
        //div[
            @role='dialog' or @role='alertdialog' or
            contains(@class,'modal') or contains(@class,'dialog') or
            contains(@class,'popup') or
            contains(@id,'modal') or contains(@id,'dialog') or
            contains(@id,'popup')
        ]
    `;
    let modals = [];
    try {
        modals = await ctx.$$(modalXPath);
    }
    catch {
        return null;
    }
    for (const modal of modals) {
        try {
            const visible = await modal.evaluate((m) => m.offsetWidth > 0 && m.offsetHeight > 0);
            if (visible)
                return modal;
        }
        catch {
            continue;
        }
    }
    return null;
}
/* ----------------- RELATIVE SEARCH ----------------- */
async function searchRelative(root, relativeXPath) {
    let xp = relativeXPath;
    if (!xp.startsWith('.//')) {
        xp = `.//${relativeXPath.replace(/^\/+/, '')}`;
    }
    try {
        const el = await root.$(xp);
        if (el) {
            const box = await el.boundingBox();
            if (box)
                return el;
        }
    }
    catch { }
    return null;
}
/* ============================================================
   PART 3 — CORE ELEMENT RESOLUTION ENGINE
   (find_element_for_target equivalent)
   ============================================================ */
async function findElementForTarget(targetText, knownElements, testStepText, action, logFunc, timeoutMs = 20000) {
    const tRaw = (targetText || '').trim();
    const t = tRaw.toLowerCase();
    const stepText = (testStepText || '').toLowerCase();
    const actionL = (action || '').toLowerCase();
    if (logFunc) {
        logFunc(`[DEBUG] Looking for TARGET: ${tRaw} (Action: ${actionL})`);
    }
    /* ---------- PRIORITY 1: INHERITED KNOWLEDGE ---------- */
    const tUpper = tRaw.toUpperCase();
    if (knownElements[tUpper]) {
        if (logFunc)
            logFunc(`[DEBUG] TARGET '${tRaw}' found in knowledge (TEXT).`);
        return { element: knownElements[tUpper], frameChain: null };
    }
    if (knownElements[`ID=${tUpper}`]) {
        if (logFunc)
            logFunc(`[DEBUG] TARGET '${tRaw}' found in knowledge (ID).`);
        return { element: knownElements[`ID=${tUpper}`], frameChain: null };
    }
    if (knownElements[`NAME=${tUpper}`]) {
        if (logFunc)
            logFunc(`[DEBUG] TARGET '${tRaw}' found in knowledge (NAME).`);
        return { element: knownElements[`NAME=${tUpper}`], frameChain: null };
    }
    /* ---------- PRIORITY 1b: Explicit locators ---------- */
    if (tRaw.toLowerCase().startsWith('id=')) {
        const id = tRaw.split('=', 2)[1];
        const el = await page.$(`#${id}`);
        if (el)
            return { element: el, frameChain: null };
    }
    if (tRaw.toLowerCase().startsWith('xpath=')) {
        const xp = tRaw.split('=', 2)[1];
        const el = await page.$(xp);
        if (el)
            return { element: el, frameChain: null };
    }
    /* ---------- LOCATOR CORE (modal-aware) ---------- */
    const locatorTryAll = async (ctx) => {
        /* ----- PRIORITY 2: ACTIVE MODAL ----- */
        const activeModal = await findActiveModal(ctx);
        if (activeModal) {
            if (logFunc)
                logFunc('[DEBUG] Active HTML modal detected. Restricting search.');
            // PASSWORD inside modal
            if (t.includes('password') || t.includes('pwd') || t.includes('re-enter')) {
                const pwd = await searchRelative(activeModal, ".//input[@type='password' or contains(@id,'password') or contains(@name,'password')]");
                if (pwd)
                    return pwd;
            }
            // USER inside modal
            if (t.includes('user') || t.includes('email') || t === 'firstinput') {
                const usr = await searchRelative(activeModal, ".//input[contains(@id,'user') or contains(@name,'user') or contains(@placeholder,'user')]");
                if (usr)
                    return usr;
            }
            // TEXT / BUTTON inside modal
            if (tRaw) {
                const txt = await searchRelative(activeModal, `.//*[self::a or self::button or self::span or self::div]
                      [contains(translate(normalize-space(.),
                      'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'${t}')]`);
                if (txt)
                    return txt;
            }
            if (logFunc) {
                logFunc(`[DEBUG] Modal present but TARGET '${tRaw}' not inside. Aborting.`);
            }
            return null;
        }
        /* ----- PRIORITY 3: HEURISTICS (NO MODAL) ----- */
        // RE-ENTER PASSWORD
        if (t.includes('re-enter') || t.includes('confirm')) {
            const rePwd = await ctx.$("//input[@type='password' and (contains(@id,'confirm') or contains(@name,'confirm'))]");
            if (rePwd)
                return rePwd;
        }
        // PASSWORD
        if (t.includes('password') || t.includes('pwd') || stepText.includes('password')) {
            const pwd = await ctx.$("//input[@type='password' or contains(@id,'password') or contains(@name,'password')]");
            if (pwd)
                return pwd;
            const inputs = await ctx.$$('input');
            const visibles = [];
            for (const i of inputs) {
                const box = await i.boundingBox();
                if (box)
                    visibles.push(i);
            }
            if (visibles.length >= 2)
                return visibles[1];
        }
        // USER ID
        if (t.includes('user') ||
            t.includes('username') ||
            t.includes('userid') ||
            t.includes('email') ||
            t === 'firstinput') {
            const usr = await ctx.$("//input[contains(@id,'user') or contains(@name,'user') or contains(@placeholder,'user')]");
            if (usr)
                return usr;
            const inputs = await ctx.$$('input');
            for (const i of inputs) {
                const type = await i.getAttribute('type');
                const box = await i.boundingBox();
                if (box && type !== 'password')
                    return i;
            }
        }
        /* ----- PRIORITY 4: AGGRESSIVE TEXT SEARCH ----- */
        if (tRaw) {
            const broad = await ctx.$(`//*[self::a or self::button or self::span or self::div]
                 [contains(translate(normalize-space(.),
                 'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'${t}')]`);
            if (broad)
                return broad;
        }
        return null;
    };
    /* ---------- MAIN DOCUMENT ---------- */
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        const el = await locatorTryAll(page);
        if (el)
            return { element: el, frameChain: null };
        await page.waitForTimeout(200);
    }
    /* ---------- IFRAMES (RECURSIVE) ---------- */
    const frameResult = await searchAllFramesRecursive(page.mainFrame(), async (ctx) => locatorTryAll(ctx));
    if (frameResult.element) {
        return {
            element: frameResult.element,
            frameChain: frameResult.frameChain
        };
    }
    throw new Error(`Could not find element for TARGET: ${targetText}`);
}
/* ============================================================
   PART 4 — POPUP HANDLER & ROBUST STEP EXECUTION
   ============================================================ */
/* ----------------- AGGRESSIVE POPUP HANDLER ----------------- */
async function handlePopups(logFunc) {
    for (let attempt = 1; attempt <= MAX_POPUP_ATTEMPTS; attempt++) {
        if (logFunc)
            logFunc(`[POPUP] Scan attempt ${attempt}`);
        // HTML MODALS
        const modal = await findActiveModal(page);
        if (modal) {
            if (logFunc)
                logFunc('[POPUP] Active HTML modal detected.');
            const okBtn = await searchRelative(modal, ".//*[self::button or self::a][normalize-space()='OK' or normalize-space()='Ok' or normalize-space()='YES' or normalize-space()='Yes']");
            if (okBtn) {
                try {
                    await okBtn.click({ force: true });
                    await page.waitForTimeout(1000);
                    return true;
                }
                catch { }
            }
            const closeBtn = await searchRelative(modal, ".//*[self::button or self::span][contains(@class,'close') or contains(text(),'×')]");
            if (closeBtn) {
                try {
                    await closeBtn.click({ force: true });
                    await page.waitForTimeout(1000);
                    return true;
                }
                catch { }
            }
        }
        // JS DIALOGS ARE HANDLED BY page.on('dialog')
        await page.waitForTimeout(800);
    }
    return false;
}
/* ----------------- ROBUST STEP EXECUTION ----------------- */
async function robustStepExecution(stepNo, action, target, data, knownElements, logFunc) {
    let element = null;
    let frameChain = null;
    try {
        /* ---- POPUP PRE-CHECK ---- */
        await handlePopups(logFunc);
        /* ---- FIND ELEMENT ---- */
        const result = await findElementForTarget(target, knownElements, `${action} ${target}`, action, logFunc);
        element = result.element;
        frameChain = result.frameChain;
        /* ---- FRAME SWITCH ---- */
        if (frameChain && frameChain.length > 0) {
            if (logFunc)
                logFunc(`[FRAME] Switching through ${frameChain.length} frames`);
        }
        /* ---- EXECUTE ACTION ---- */
        switch (action.toUpperCase()) {
            case 'CLICK':
                await element.click({ force: true });
                break;
            case 'TYPE':
            case 'INPUT':
            case 'SET':
                if (target.toLowerCase().includes('password')) {
                    storedPassword = data;
                }
                const success = await ensureInteractableAndSetValue(element, data, logFunc);
                if (!success) {
                    throw new Error('Value verification failed');
                }
                break;
            case 'PRESS':
                await element.press(data);
                break;
            case 'WAIT':
                await page.waitForTimeout(parseInt(data) || 1000);
                break;
            case 'NAVIGATE':
            case 'OPEN':
                await page.goto(data, { waitUntil: 'domcontentloaded' });
                break;
            case 'REFRESH':
                await page.reload();
                break;
            case 'CLEAR':
                await element.fill('');
                break;
            default:
                logFunc(`[WARN] Unknown ACTION: ${action}`);
        }
        await page.waitForTimeout(800);
        /* ---- POPUP POST-CHECK ---- */
        await handlePopups(logFunc);
        const screenshot = await takeStepScreenshot(stepNo);
        const source = await savePageSource(stepNo);
        return {
            status: 'PASS',
            screenshot,
            source
        };
    }
    catch (e) {
        logFunc(`[ERROR] Step failed: ${e}`);
        const screenshot = await takeStepScreenshot(`${stepNo}_FAIL`);
        const source = await savePageSource(`${stepNo}_FAIL`);
        return {
            status: 'FAIL',
            screenshot,
            source
        };
    }
}
/* ============================================================
   PART 5 — EXCEL EXECUTION + MAIN RUNNER
   ============================================================ */
/* ----------------- EXCEL HELPERS ----------------- */
function loadExcel(filePath) {
    return XLSX.readFile(filePath);
}
function getSheetRows(workbook, sheetName) {
    const sheet = workbook.Sheets[sheetName];
    return XLSX.utils.sheet_to_json(sheet, { defval: '' });
}
function writeResultsExcel(workbook, filePath) {
    XLSX.writeFile(workbook, filePath);
}
/* ----------------- LOGGER ----------------- */
function log(msg) {
    const ts = new Date().toISOString().replace('T', ' ').split('.')[0];
    console.log(`[${ts}] ${msg}`);
}
/* ----------------- MAIN EXECUTION ----------------- */
async function run() {
    ensureDir(RESULTS_DIR);
    // Find any .xlsx file in the current directory
    const files = fs.readdirSync('.');
    const excelFile = files.find(file => file.endsWith('.xlsx') && !file.startsWith('~'));
    if (!excelFile) {
        console.error('❌ No Excel file (.xlsx) found in the current directory');
        process.exit(1);
    }
    const INPUT_EXCEL = excelFile;
    const RESULT_EXCEL_PATH = path.join(RESULTS_DIR, RESULTS_EXCEL_FILENAME);
    fs.copyFileSync(INPUT_EXCEL, RESULT_EXCEL_PATH);
    log('=== Starting Test Execution ===');
    log(`Loaded Excel: ${INPUT_EXCEL}`);
    await createBrowser();
    await attachDialogHandler(log);
    const workbook = loadExcel(RESULT_EXCEL_PATH);
    const sheetName = workbook.SheetNames[0];
    const rows = getSheetRows(workbook, sheetName);
    log(`Found ${rows.length} rows to execute`);
    log(`--- Sheet: ${sheetName} ---`);
    let knownElements = {};
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const stepNo = row['STEP'] || `STEP_${i + 1}`;
        const action = (row['ACTION'] || '').toString().trim();
        const target = (row['TARGET'] || '').toString().trim();
        const data = (row['DATA'] || '').toString().trim();
        if (!action) {
            row['STATUS'] = 'SKIPPED';
            continue;
        }
        log(`[STEP ${stepNo}] Executing: ${action} ${target}`);
        if (i === 0 || action.toUpperCase() === 'OPEN') {
            knownElements = await inheritPageKnowledge(log);
        }
        const result = await robustStepExecution(stepNo, action, target, data, knownElements, log);
        row['STATUS'] = result.status;
        row['SCREENSHOT'] = result.screenshot;
        row['PAGE_SOURCE'] = result.source;
        knownElements = await inheritPageKnowledge(log);
    }
    workbook.Sheets[sheetName] = XLSX.utils.json_to_sheet(rows);
    writeResultsExcel(workbook, RESULT_EXCEL_PATH);
    log('=== Test Execution Completed ===');
    await browser.close();
}
/* ----------------- ENTRY POINT ----------------- */
run().catch(err => {
    console.error('[FATAL]', err);
});
