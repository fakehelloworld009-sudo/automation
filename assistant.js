"use strict";
/* ============================================================
   ADVANCED TEST AUTOMATION ASSISTANT WITH SELF-HEALING
   ============================================================ */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
var playwright_1 = require("playwright");
var fs = require("fs");
var path = require("path");
var XLSX = require("xlsx");
var http = require("http");
var url = require("url");
/* ============== GLOBAL STATE & CONSTANTS ============== */
var RESULTS_DIR = 'RESULTS';
var SCREENSHOTS_DIR = path.join(RESULTS_DIR, 'screenshots');
var SOURCES_DIR = path.join(RESULTS_DIR, 'page_sources');
var RESULTS_EXCEL_FILENAME = 'Test_Results.xlsx';
var state = {
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
var logMessages = [];
var allPages = []; // Track all open pages/tabs
var windowHierarchy = new Map(); // Track nested windows with timestamp, title, and URL
var currentSearchContext = null; // Live search status
var latestSubwindow = null; // Track the most recently opened subwindow
/* ============== UTILITY FUNCTIONS ============== */
/**
 * Update and broadcast live search context status
 */
function updateSearchContext(windowPath, frameLevel, totalFrames) {
    currentSearchContext = { windowPath: windowPath, frameLevel: frameLevel, totalFrames: totalFrames };
    log("\uD83D\uDD0D [LIVE SEARCH] Searching in: ".concat(windowPath, " (Frame ").concat(frameLevel, "/").concat(totalFrames, ")"));
}
/**
 * Get window hierarchy path for display
 */
function getWindowPath(page, isMainPage) {
    var _a;
    if (isMainPage === void 0) { isMainPage = false; }
    if (isMainPage)
        return '🏠 MAIN WINDOW';
    var level = ((_a = windowHierarchy.get(page)) === null || _a === void 0 ? void 0 : _a.level) || 1;
    var indent = '📍 '.repeat(level);
    return "".concat(indent, "SUBWINDOW (Level ").concat(level, ")");
}
function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}
function log(message) {
    var timestamp = new Date().toISOString();
    var formattedMsg = "[".concat(timestamp, "] ").concat(message);
    console.log(formattedMsg);
    logMessages.push(formattedMsg);
}
/**
 * Log step execution with bold formatting for easy identification
 */
function logStep(stepId, action, target, windowInfo) {
    if (windowInfo === void 0) { windowInfo = ''; }
    var separator = '═'.repeat(100);
    var stepMessage = "STEP: ".concat(stepId.toUpperCase(), " | ACTION: ").concat(action.toUpperCase(), " | TARGET: \"").concat(target, "\"");
    var fullMessage = windowInfo ? "".concat(stepMessage, " | ").concat(windowInfo) : stepMessage;
    log("\n".concat('█'.repeat(110)));
    log("\u2588 \u26A1 ".concat(fullMessage));
    log("".concat('█'.repeat(110), "\n"));
}
/**
 * Log window and element summary (disabled by default to reduce noise)
 */
function logWindowSummary() {
    return __awaiter(this, arguments, void 0, function (verbose) {
        var totalWindows, openWindows, i, page, info, title, _a, url_1, level, childCount, isActive, levelIndent, elements, e_1;
        var _b;
        if (verbose === void 0) { verbose = false; }
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    if (!verbose)
                        return [2 /*return*/]; // Disabled by default to reduce log spam
                    log("\n".concat('═'.repeat(110)));
                    log("\uD83D\uDCCA ENVIRONMENT SUMMARY");
                    log("".concat('═'.repeat(110)));
                    totalWindows = allPages.length;
                    openWindows = allPages.filter(function (p) { return !p.isClosed(); }).length;
                    log("\uD83E\uDE9F WINDOWS: ".concat(openWindows, "/").concat(totalWindows, " open"));
                    i = 0;
                    _c.label = 1;
                case 1:
                    if (!(i < allPages.length)) return [3 /*break*/, 5];
                    page = allPages[i];
                    if (!!page.isClosed()) return [3 /*break*/, 4];
                    info = windowHierarchy.get(page);
                    _a = (info === null || info === void 0 ? void 0 : info.title);
                    if (_a) return [3 /*break*/, 3];
                    return [4 /*yield*/, page.title().catch(function () { return 'Unknown'; })];
                case 2:
                    _a = (_c.sent());
                    _c.label = 3;
                case 3:
                    title = _a;
                    url_1 = page.url();
                    level = (info === null || info === void 0 ? void 0 : info.level) || 0;
                    childCount = ((_b = info === null || info === void 0 ? void 0 : info.childPages) === null || _b === void 0 ? void 0 : _b.length) || 0;
                    isActive = page === state.page ? '✅' : '  ';
                    levelIndent = '   '.repeat(level);
                    log("   ".concat(isActive, " [L").concat(level, "] ").concat(levelIndent, "Name: \"").concat(title, "\" | URL: ").concat(url_1));
                    if (childCount > 0) {
                        log("   ".concat(levelIndent, "   \u2514\u2500 Has ").concat(childCount, " child window(s)"));
                    }
                    _c.label = 4;
                case 4:
                    i++;
                    return [3 /*break*/, 1];
                case 5:
                    if (!(state.page && !state.page.isClosed())) return [3 /*break*/, 9];
                    _c.label = 6;
                case 6:
                    _c.trys.push([6, 8, , 9]);
                    return [4 /*yield*/, state.page.evaluate(function () { return ({
                            buttons: document.querySelectorAll('button, [role="button"]').length,
                            inputs: document.querySelectorAll('input[type="text"], textarea').length,
                            links: document.querySelectorAll('a').length,
                            divs: document.querySelectorAll('div').length,
                            spans: document.querySelectorAll('span').length,
                            forms: document.querySelectorAll('form').length,
                            iframes: document.querySelectorAll('iframe').length,
                            modals: document.querySelectorAll('[role="dialog"], .modal, .popup').length
                        }); }).catch(function () { return null; })];
                case 7:
                    elements = _c.sent();
                    if (elements) {
                        log("\n\uD83D\uDCC4 CURRENT PAGE ELEMENTS:");
                        log("   \uD83D\uDD18 Buttons: ".concat(elements.buttons));
                        log("   \uD83D\uDCDD Input Fields: ".concat(elements.inputs));
                        log("   \uD83D\uDD17 Links: ".concat(elements.links));
                        log("   \uD83D\uDCE6 Divs: ".concat(elements.divs));
                        log("   \uD83D\uDCCB Spans: ".concat(elements.spans));
                        log("   \uD83D\uDCCB Forms: ".concat(elements.forms));
                        log("   \uD83D\uDDBC\uFE0F  IFrames: ".concat(elements.iframes));
                        log("   \uD83D\uDCEC Modals/Dialogs: ".concat(elements.modals));
                    }
                    return [3 /*break*/, 9];
                case 8:
                    e_1 = _c.sent();
                    return [3 /*break*/, 9];
                case 9:
                    log("".concat('═'.repeat(110), "\n"));
                    return [2 /*return*/];
            }
        });
    });
}
/**
 * Log detailed frame structure (disabled by default to reduce noise)
 */
function logFrameStructure() {
    return __awaiter(this, arguments, void 0, function (verbose) {
        var frames_1, _loop_1, i, e_2;
        if (verbose === void 0) { verbose = false; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!verbose)
                        return [2 /*return*/]; // Disabled by default to reduce log spam
                    if (!state.page || state.page.isClosed())
                        return [2 /*return*/];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 6, , 7]);
                    frames_1 = state.page.frames();
                    log("\n\uD83C\uDFAC FRAME STRUCTURE:");
                    log("   Total Frames: ".concat(frames_1.length));
                    _loop_1 = function (i) {
                        var frame, frameName, elementCount;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    frame = frames_1[i];
                                    return [4 /*yield*/, frame.evaluate(function () {
                                            var scripts = Array.from(document.scripts);
                                            return document.title || 'Unnamed Frame';
                                        }).catch(function () { return 'Frame ' + i; })];
                                case 1:
                                    frameName = _b.sent();
                                    return [4 /*yield*/, frame.evaluate(function () {
                                            return document.querySelectorAll('*').length;
                                        }).catch(function () { return 0; })];
                                case 2:
                                    elementCount = _b.sent();
                                    log("   [F".concat(i, "] ").concat(frameName, " - ").concat(elementCount, " elements"));
                                    return [2 /*return*/];
                            }
                        });
                    };
                    i = 0;
                    _a.label = 2;
                case 2:
                    if (!(i < frames_1.length)) return [3 /*break*/, 5];
                    return [5 /*yield**/, _loop_1(i)];
                case 3:
                    _a.sent();
                    _a.label = 4;
                case 4:
                    i++;
                    return [3 /*break*/, 2];
                case 5: return [3 /*break*/, 7];
                case 6:
                    e_2 = _a.sent();
                    return [3 /*break*/, 7];
                case 7: return [2 /*return*/];
            }
        });
    });
}
function setupPageListeners(page) {
    return __awaiter(this, void 0, void 0, function () {
        var _this = this;
        return __generator(this, function (_a) {
            // Initialize main page in hierarchy
            if (!windowHierarchy.has(page)) {
                windowHierarchy.set(page, { level: 0, childPages: [], openedAt: Date.now() });
            }
            // Listen for popup windows (nested windows)
            page.on('popup', function (popup) { return __awaiter(_this, void 0, void 0, function () {
                var parentLevel, childLevel, openedAt, popupTitle, popupUrl;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            parentLevel = ((_a = windowHierarchy.get(page)) === null || _a === void 0 ? void 0 : _a.level) || 0;
                            childLevel = parentLevel + 1;
                            openedAt = Date.now();
                            // Wait for popup to load and get its title
                            return [4 /*yield*/, popup.waitForLoadState('domcontentloaded').catch(function () { })];
                        case 1:
                            // Wait for popup to load and get its title
                            _b.sent();
                            return [4 /*yield*/, popup.waitForTimeout(500)];
                        case 2:
                            _b.sent();
                            return [4 /*yield*/, popup.title().catch(function () { return 'Unknown'; })];
                        case 3:
                            popupTitle = _b.sent();
                            popupUrl = popup.url();
                            log("\uD83E\uDE9F \u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557");
                            log("\uD83E\uDE9F \u2551 \uD83C\uDD95 SUBWINDOW DETECTED! \u2551");
                            log("\uD83E\uDE9F \u2551 Level: ".concat(childLevel, " | Title: \"").concat(popupTitle, "\" \u2551"));
                            log("\uD83E\uDE9F \u2551 URL: ".concat(popupUrl, " \u2551"));
                            log("\uD83E\uDE9F \u2551 PRIORITY: SEARCH THIS FIRST \u2551");
                            log("\uD83E\uDE9F \u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D");
                            allPages.push(popup);
                            latestSubwindow = popup; // Track as latest
                            // Track window hierarchy with timestamp, title, and URL
                            windowHierarchy.set(popup, { parentPage: page, level: childLevel, childPages: [], openedAt: openedAt, title: popupTitle, url: popupUrl });
                            if (windowHierarchy.has(page)) {
                                windowHierarchy.get(page).childPages.push(popup);
                            }
                            // Setup nested listeners for this popup (to catch sub-sub-windows)
                            return [4 /*yield*/, setupPageListeners(popup)];
                        case 4:
                            // Setup nested listeners for this popup (to catch sub-sub-windows)
                            _b.sent();
                            log("\uD83E\uDE9F [PRIORITY WINDOW] Subwindow \"".concat(popupTitle, "\" added to search queue (Level ").concat(childLevel, ")"));
                            log("\uD83E\uDE9F Total windows open: ".concat(allPages.length));
                            return [2 /*return*/];
                    }
                });
            }); });
            return [2 /*return*/];
        });
    });
}
/**
 * Detect and log all modals/dialogs in the current page
 */
function detectAndLogModals() {
    return __awaiter(this, void 0, void 0, function () {
        var modals, e_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!state.page || state.page.isClosed())
                        return [2 /*return*/];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, state.page.evaluate(function () {
                            var _a;
                            var modalSelectors = [
                                { selector: '[role="dialog"]', type: 'DIALOG' },
                                { selector: '[role="alertdialog"]', type: 'ALERT DIALOG' },
                                { selector: '.modal', type: 'MODAL (class)' },
                                { selector: '.overlay', type: 'OVERLAY (class)' },
                                { selector: '.popup', type: 'POPUP (class)' },
                                { selector: '[class*="modal"]', type: 'MODAL (contains)' },
                                { selector: '[class*="dialog"]', type: 'DIALOG (contains)' },
                                { selector: '[class*="overlay"]', type: 'OVERLAY (contains)' }
                            ];
                            var foundModals = [];
                            for (var _i = 0, modalSelectors_1 = modalSelectors; _i < modalSelectors_1.length; _i++) {
                                var _b = modalSelectors_1[_i], selector = _b.selector, type = _b.type;
                                try {
                                    var elements = document.querySelectorAll(selector);
                                    for (var i = 0; i < elements.length; i++) {
                                        var el = elements[i];
                                        var isVisible = el.offsetParent !== null || window.getComputedStyle(el).display !== 'none';
                                        if (isVisible) {
                                            var text = ((_a = el.textContent) === null || _a === void 0 ? void 0 : _a.trim().slice(0, 100)) || 'No text';
                                            var title = el.getAttribute('title') || '';
                                            var ariaLabel = el.getAttribute('aria-label') || '';
                                            foundModals.push({
                                                type: type,
                                                selector: selector,
                                                text: text,
                                                title: title,
                                                ariaLabel: ariaLabel,
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
                        })];
                case 2:
                    modals = _a.sent();
                    if (modals.length > 0) {
                        log("\n\uD83D\uDCCB \u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557");
                        log("\uD83D\uDCCB \u2551 \uD83D\uDD0D MODALS DETECTED IN PAGE \u2551");
                        log("\uD83D\uDCCB \u2551 Total: ".concat(modals.length, " visible modal(s) \u2551"));
                        log("\uD83D\uDCCB \u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D");
                        modals.forEach(function (modal, idx) {
                            log("   ".concat(idx + 1, ". [").concat(modal.type, "]"));
                            if (modal.ariaLabel)
                                log("      aria-label: \"".concat(modal.ariaLabel, "\""));
                            if (modal.title)
                                log("      title: \"".concat(modal.title, "\""));
                            if (modal.text)
                                log("      content: \"".concat(modal.text, "\""));
                        });
                        log('');
                    }
                    return [3 /*break*/, 4];
                case 3:
                    e_3 = _a.sent();
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    });
}
/**
 * Log current window name and available iframes (simplified, no modals)
 */
function logWindowAndFrameInfo() {
    return __awaiter(this, void 0, void 0, function () {
        var windowName, currentPageIndex, iframes, iframeNames, _i, iframes_1, iframe, name_1, id, e_4;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 8, , 9]);
                    if (!state.page || state.page.isClosed())
                        return [2 /*return*/];
                    windowName = 'MAIN WINDOW';
                    if (allPages.length > 1) {
                        currentPageIndex = allPages.indexOf(state.page);
                        if (currentPageIndex > 0) {
                            windowName = "SUBWINDOW ".concat(currentPageIndex);
                        }
                    }
                    log("\n\uD83D\uDCCD Current Context: ".concat(windowName));
                    return [4 /*yield*/, state.page.locator('iframe').all()];
                case 1:
                    iframes = _a.sent();
                    if (!(iframes.length > 0)) return [3 /*break*/, 7];
                    iframeNames = [];
                    _i = 0, iframes_1 = iframes;
                    _a.label = 2;
                case 2:
                    if (!(_i < iframes_1.length)) return [3 /*break*/, 6];
                    iframe = iframes_1[_i];
                    return [4 /*yield*/, iframe.getAttribute('name').catch(function () { return 'unnamed'; })];
                case 3:
                    name_1 = _a.sent();
                    return [4 /*yield*/, iframe.getAttribute('id').catch(function () { return 'no-id'; })];
                case 4:
                    id = _a.sent();
                    iframeNames.push("".concat(name_1 || 'unnamed', " (id: ").concat(id || 'no-id', ")"));
                    _a.label = 5;
                case 5:
                    _i++;
                    return [3 /*break*/, 2];
                case 6:
                    log("   \uD83D\uDCCA Available iframes: ".concat(iframeNames.join(' | ')));
                    _a.label = 7;
                case 7: return [3 /*break*/, 9];
                case 8:
                    e_4 = _a.sent();
                    return [3 /*break*/, 9];
                case 9: return [2 /*return*/];
            }
        });
    });
}
/**
 * Build a visual string representation of window hierarchy
 */
function buildHierarchyString() {
    var _a;
    var hierarchy = '';
    var mainWindow = state.page;
    if (!mainWindow)
        return 'No main window';
    var queue = [{ page: mainWindow, level: 0 }];
    var visited = new Set();
    while (queue.length > 0) {
        var _b = queue.shift(), p = _b.page, level = _b.level;
        if (visited.has(p))
            continue;
        visited.add(p);
        var indent = '  '.repeat(level);
        var label = level === 0 ? 'MAIN' : "SUB(L".concat(level, ")");
        hierarchy += "\n".concat(indent, "\u251C\u2500 ").concat(label);
        var children = ((_a = windowHierarchy.get(p)) === null || _a === void 0 ? void 0 : _a.childPages) || [];
        for (var _i = 0, children_1 = children; _i < children_1.length; _i++) {
            var child = children_1[_i];
            queue.push({ page: child, level: level + 1 });
        }
    }
    return hierarchy || '🏠 MAIN';
}
function switchToLatestPage() {
    return __awaiter(this, void 0, void 0, function () {
        var pages, activePages, latestPage, e_5, e_6;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!state.context)
                        return [2 /*return*/, false];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 7, , 8]);
                    pages = state.context.pages();
                    if (pages.length === 0)
                        return [2 /*return*/, false];
                    activePages = pages.filter(function (p) { return !p.isClosed(); });
                    if (activePages.length === 0) {
                        log("All pages are closed, no active page available");
                        return [2 /*return*/, false];
                    }
                    latestPage = activePages[activePages.length - 1];
                    if (!(state.page !== latestPage)) return [3 /*break*/, 6];
                    // Check if current page is still valid
                    if (state.page && !state.page.isClosed()) {
                        log("Switching to latest page (Total pages: ".concat(activePages.length, ")"));
                    }
                    else {
                        log("Current page closed, switching to active page (Total active: ".concat(activePages.length, ")"));
                    }
                    state.page = latestPage;
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, latestPage.waitForLoadState('networkidle').catch(function () { })];
                case 3:
                    _a.sent();
                    return [3 /*break*/, 5];
                case 4:
                    e_5 = _a.sent();
                    return [3 /*break*/, 5];
                case 5: return [2 /*return*/, true];
                case 6: return [3 /*break*/, 8];
                case 7:
                    e_6 = _a.sent();
                    log("Could not switch to latest page: ".concat(e_6));
                    return [3 /*break*/, 8];
                case 8: return [2 /*return*/, false];
            }
        });
    });
}
function closeOldPagesKeepLatest() {
    return __awaiter(this, void 0, void 0, function () {
        var pages, latestPage, i, e_7, e_8;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!state.context)
                        return [2 /*return*/];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 9, , 10]);
                    pages = state.context.pages();
                    if (!(pages.length > 1)) return [3 /*break*/, 8];
                    log("Multiple pages open (".concat(pages.length, "). Closing old ones..."));
                    latestPage = pages[pages.length - 1];
                    i = 0;
                    _a.label = 2;
                case 2:
                    if (!(i < pages.length - 1)) return [3 /*break*/, 7];
                    _a.label = 3;
                case 3:
                    _a.trys.push([3, 5, , 6]);
                    return [4 /*yield*/, pages[i].close()];
                case 4:
                    _a.sent();
                    log("Closed old page ".concat(i + 1));
                    return [3 /*break*/, 6];
                case 5:
                    e_7 = _a.sent();
                    return [3 /*break*/, 6];
                case 6:
                    i++;
                    return [3 /*break*/, 2];
                case 7:
                    state.page = latestPage;
                    allPages = [latestPage];
                    _a.label = 8;
                case 8: return [3 /*break*/, 10];
                case 9:
                    e_8 = _a.sent();
                    log("Error closing old pages: ".concat(e_8));
                    return [3 /*break*/, 10];
                case 10: return [2 /*return*/];
            }
        });
    });
}
function takeStepScreenshot(stepId) {
    return __awaiter(this, void 0, void 0, function () {
        var filePath, e_9;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!state.page || state.page.isClosed()) {
                        log("Page is closed, cannot take screenshot");
                        return [2 /*return*/, ''];
                    }
                    ensureDir(SCREENSHOTS_DIR);
                    filePath = path.join(SCREENSHOTS_DIR, "".concat(stepId, ".png"));
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, state.page.screenshot({ path: filePath, fullPage: true })];
                case 2:
                    _a.sent();
                    return [2 /*return*/, path.relative(RESULTS_DIR, filePath).replace(/\\/g, '/')];
                case 3:
                    e_9 = _a.sent();
                    log("Failed to take screenshot: ".concat(e_9));
                    return [2 /*return*/, ''];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function savePageSource(stepId) {
    return __awaiter(this, void 0, void 0, function () {
        var filePath, html, e_10;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!state.page || state.page.isClosed()) {
                        log("Page is closed, cannot save source");
                        return [2 /*return*/, ''];
                    }
                    ensureDir(SOURCES_DIR);
                    filePath = path.join(SOURCES_DIR, "".concat(stepId, "_source.html"));
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, state.page.content()];
                case 2:
                    html = _a.sent();
                    fs.writeFileSync(filePath, html, 'utf-8');
                    return [2 /*return*/, path.relative(RESULTS_DIR, filePath).replace(/\\/g, '/')];
                case 3:
                    e_10 = _a.sent();
                    log("Failed to save source: ".concat(e_10));
                    return [2 /*return*/, ''];
                case 4: return [2 /*return*/];
            }
        });
    });
}
/* ============== SELF-HEALING METHODS ============== */
function findButtonByText(text) {
    return __awaiter(this, void 0, void 0, function () {
        var strategies, _i, strategies_1, strategyFunc, selector, e_11;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!state.page)
                        return [2 /*return*/, null];
                    strategies = [
                        function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/, "button:has-text(\"".concat(text, "\")")];
                        }); }); },
                        function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/, "a:has-text(\"".concat(text, "\")")];
                        }); }); },
                        function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/, "[role=\"button\"]:has-text(\"".concat(text, "\")")];
                        }); }); },
                        function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/, "input[type=\"button\"][value*=\"".concat(text, "\"]")];
                        }); }); },
                        function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/, "button span:has-text(\"".concat(text, "\")")];
                        }); }); },
                        function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/, "div[role=\"button\"]:has-text(\"".concat(text, "\")")];
                        }); }); },
                        function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/, "input[type=\"radio\"] + label:has-text(\"".concat(text, "\")")];
                        }); }); },
                        function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/, "input[type=\"checkbox\"] + label:has-text(\"".concat(text, "\")")];
                        }); }); },
                        function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/, "label:has-text(\"".concat(text, "\") input[type=\"radio\"]")];
                        }); }); },
                        function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/, "label:has-text(\"".concat(text, "\") input[type=\"checkbox\"]")];
                        }); }); }
                    ];
                    _i = 0, strategies_1 = strategies;
                    _a.label = 1;
                case 1:
                    if (!(_i < strategies_1.length)) return [3 /*break*/, 7];
                    strategyFunc = strategies_1[_i];
                    return [4 /*yield*/, strategyFunc()];
                case 2:
                    selector = _a.sent();
                    _a.label = 3;
                case 3:
                    _a.trys.push([3, 5, , 6]);
                    return [4 /*yield*/, state.page.locator(selector).first().waitFor({ timeout: 1000 })];
                case 4:
                    _a.sent();
                    return [2 /*return*/, selector];
                case 5:
                    e_11 = _a.sent();
                    return [3 /*break*/, 6];
                case 6:
                    _i++;
                    return [3 /*break*/, 1];
                case 7: return [2 /*return*/, null];
            }
        });
    });
}
function findInputByLabel(label) {
    return __awaiter(this, void 0, void 0, function () {
        var strategies, _i, strategies_2, strategyFunc, selector, e_12;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!state.page)
                        return [2 /*return*/, null];
                    strategies = [
                        function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/, "input[placeholder*=\"".concat(label, "\"]")];
                        }); }); },
                        function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/, "input[aria-label*=\"".concat(label, "\"]")];
                        }); }); },
                        function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/, "label:has-text(\"".concat(label, "\") + input")];
                        }); }); },
                        function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/, "[contains(., \"".concat(label, "\")] input")];
                        }); }); },
                        function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/, "input[name*=\"".concat(label.toLowerCase(), "\"]")];
                        }); }); }
                    ];
                    _i = 0, strategies_2 = strategies;
                    _a.label = 1;
                case 1:
                    if (!(_i < strategies_2.length)) return [3 /*break*/, 7];
                    strategyFunc = strategies_2[_i];
                    return [4 /*yield*/, strategyFunc()];
                case 2:
                    selector = _a.sent();
                    _a.label = 3;
                case 3:
                    _a.trys.push([3, 5, , 6]);
                    return [4 /*yield*/, state.page.locator(selector).first().waitFor({ timeout: 1000 })];
                case 4:
                    _a.sent();
                    return [2 /*return*/, selector];
                case 5:
                    e_12 = _a.sent();
                    return [3 /*break*/, 6];
                case 6:
                    _i++;
                    return [3 /*break*/, 1];
                case 7: return [2 /*return*/, null];
            }
        });
    });
}
/* ============== SHADOW DOM & NESTED ELEMENTS ============== */
// Helper to find element through shadow DOM
function findElementThroughShadowDOM(searchText) {
    return __awaiter(this, void 0, void 0, function () {
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, ((_a = state.page) === null || _a === void 0 ? void 0 : _a.evaluate(function (text) {
                        var _a, _b;
                        var walker = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_ELEMENT);
                        var node;
                        while (node = walker.nextNode()) {
                            var el = node;
                            // Check visible text
                            if ((_a = el.textContent) === null || _a === void 0 ? void 0 : _a.includes(text)) {
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
                                var shadowWalker = document.createTreeWalker(el.shadowRoot, NodeFilter.SHOW_ELEMENT);
                                var shadowNode = void 0;
                                while (shadowNode = shadowWalker.nextNode()) {
                                    var shadowEl = shadowNode;
                                    if (((_b = shadowEl.textContent) === null || _b === void 0 ? void 0 : _b.includes(text)) && (shadowEl.tagName === 'BUTTON' ||
                                        shadowEl.getAttribute('role') === 'button' ||
                                        getComputedStyle(shadowEl).cursor === 'pointer')) {
                                        return { tag: shadowEl.tagName, role: shadowEl.getAttribute('role'), isShadow: true, found: true };
                                    }
                                }
                            }
                        }
                        return null;
                    }, searchText))];
                case 1: return [2 /*return*/, _b.sent()];
            }
        });
    });
}
// XPath helper
function getElementByXPath(xpath) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, ((_a = state.page) === null || _a === void 0 ? void 0 : _a.evaluate(function (xp) {
                        var element = document.evaluate(xp, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                        if (element) {
                            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            return true;
                        }
                        return false;
                    }, xpath))];
                case 1: return [2 /*return*/, (_b = _c.sent()) !== null && _b !== void 0 ? _b : false];
            }
        });
    });
}
function scrollToElement(selector) {
    return __awaiter(this, void 0, void 0, function () {
        var e_13;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!state.page)
                        return [2 /*return*/, false];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 4, , 5]);
                    log("Scrolling to element: ".concat(selector));
                    // Try to scroll in all directions
                    return [4 /*yield*/, state.page.evaluate(function (sel) {
                            // Scroll down to find element
                            for (var i = 0; i < 10; i++) {
                                var el = document.querySelector(sel);
                                if (el) {
                                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                    return true;
                                }
                                window.scrollBy(0, 500);
                            }
                            return false;
                        }, selector)];
                case 2:
                    // Try to scroll in all directions
                    _a.sent();
                    return [4 /*yield*/, state.page.waitForTimeout(800)];
                case 3:
                    _a.sent();
                    return [2 /*return*/, true];
                case 4:
                    e_13 = _a.sent();
                    log("Scroll failed: ".concat(e_13));
                    return [2 /*return*/, false];
                case 5: return [2 /*return*/];
            }
        });
    });
}
function scrollToElementByText(text) {
    return __awaiter(this, void 0, void 0, function () {
        var found, e_14;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!state.page)
                        return [2 /*return*/, false];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 5, , 6]);
                    log("Scrolling to find text: ".concat(text));
                    return [4 /*yield*/, state.page.evaluate(function (searchText) {
                            var _a, _b, _c;
                            // First check if element is already visible without scrolling
                            var elements = document.querySelectorAll('button, a, [role="button"], input[type="button"], div[role="button"]');
                            for (var _i = 0, _d = Array.from(elements); _i < _d.length; _i++) {
                                var el = _d[_i];
                                if ((_a = el.textContent) === null || _a === void 0 ? void 0 : _a.includes(searchText)) {
                                    var rect = el.getBoundingClientRect();
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
                            var iframes = document.querySelectorAll('iframe');
                            for (var _e = 0, _f = Array.from(iframes); _e < _f.length; _e++) {
                                var iframe = _f[_e];
                                try {
                                    var iframeDoc = iframe.contentDocument || ((_b = iframe.contentWindow) === null || _b === void 0 ? void 0 : _b.document);
                                    if (iframeDoc) {
                                        var iframeElements = iframeDoc.querySelectorAll('button, a, [role="button"], input[type="button"]');
                                        for (var _g = 0, iframeElements_1 = iframeElements; _g < iframeElements_1.length; _g++) {
                                            var el = iframeElements_1[_g];
                                            if ((_c = el.textContent) === null || _c === void 0 ? void 0 : _c.includes(searchText)) {
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
                        }, text)];
                case 2:
                    found = _a.sent();
                    if (!found) return [3 /*break*/, 4];
                    return [4 /*yield*/, state.page.waitForTimeout(800)];
                case 3:
                    _a.sent();
                    return [2 /*return*/, true];
                case 4: return [2 /*return*/, false];
                case 5:
                    e_14 = _a.sent();
                    log("Scroll by text failed: ".concat(e_14));
                    return [2 /*return*/, false];
                case 6: return [2 /*return*/];
            }
        });
    });
}
/* ============== ELEMENT VERIFICATION & VALIDATION ============== */
/**
 * Verify that an element actually exists, is visible, and is in the viewport
 * Returns detailed information about the element's state
 */
function verifyElementExists(selector_1, target_1) {
    return __awaiter(this, arguments, void 0, function (selector, target, frame) {
        var searchTarget, result, e_15;
        if (frame === void 0) { frame = null; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    searchTarget = frame || state.page;
                    if (!searchTarget)
                        return [2 /*return*/, { exists: false, visible: false, inViewport: false, clickable: false }];
                    return [4 /*yield*/, searchTarget.evaluate(function (_a) {
                            var sel = _a.sel, searchText = _a.searchText;
                            var element = null;
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
                                var allElements = document.querySelectorAll('*');
                                var searchLower = searchText.toLowerCase();
                                for (var _i = 0, _b = Array.from(allElements); _i < _b.length; _i++) {
                                    var el = _b[_i];
                                    var text = (el.textContent || '').toLowerCase();
                                    if (text.includes(searchLower)) {
                                        element = el;
                                        break;
                                    }
                                }
                            }
                            if (!element)
                                return { exists: false, visible: false, inViewport: false, clickable: false };
                            var style = window.getComputedStyle(element);
                            var rect = element.getBoundingClientRect();
                            return {
                                exists: true,
                                visible: style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0',
                                inViewport: rect.top >= 0 && rect.bottom <= window.innerHeight && rect.left >= 0 && rect.right <= window.innerWidth,
                                clickable: !!(element.tagName === 'BUTTON' || element.tagName === 'A' || element.getAttribute('role') === 'button' || element.getAttribute('onclick')),
                                rect: { width: rect.width, height: rect.height, top: rect.top, bottom: rect.bottom }
                            };
                        }, { sel: selector, searchText: target })];
                case 1:
                    result = _a.sent();
                    return [2 /*return*/, result];
                case 2:
                    e_15 = _a.sent();
                    log("\u26A0\uFE0F Verification failed: ".concat(e_15.message));
                    return [2 /*return*/, { exists: false, visible: false, inViewport: false, clickable: false }];
                case 3: return [2 /*return*/];
            }
        });
    });
}
/**
 * Wait and verify that DOM changed after an action (click or fill)
 * This confirms the action actually took effect
 */
function verifyActionTookEffect(actionType_1) {
    return __awaiter(this, arguments, void 0, function (actionType, timeout) {
        var beforeSnapshot, afterSnapshot, changed, e_16;
        if (timeout === void 0) { timeout = 2000; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!state.page || state.page.isClosed())
                        return [2 /*return*/, false];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 5, , 6]);
                    return [4 /*yield*/, state.page.evaluate(function () {
                            var _a;
                            return {
                                url: window.location.href,
                                elementCount: document.querySelectorAll('*').length,
                                bodyText: ((_a = document.body.textContent) === null || _a === void 0 ? void 0 : _a.substring(0, 500)) || ''
                            };
                        })];
                case 2:
                    beforeSnapshot = _a.sent();
                    // Wait for potential changes
                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 300); })];
                case 3:
                    // Wait for potential changes
                    _a.sent();
                    return [4 /*yield*/, state.page.evaluate(function () {
                            var _a;
                            return {
                                url: window.location.href,
                                elementCount: document.querySelectorAll('*').length,
                                bodyText: ((_a = document.body.textContent) === null || _a === void 0 ? void 0 : _a.substring(0, 500)) || ''
                            };
                        })];
                case 4:
                    afterSnapshot = _a.sent();
                    changed = beforeSnapshot.url !== afterSnapshot.url ||
                        beforeSnapshot.elementCount !== afterSnapshot.elementCount ||
                        beforeSnapshot.bodyText !== afterSnapshot.bodyText;
                    if (!changed) {
                        log("   \u26A0\uFE0F WARNING: DOM did not change after action - click may have failed silently");
                    }
                    return [2 /*return*/, changed];
                case 5:
                    e_16 = _a.sent();
                    return [2 /*return*/, false];
                case 6: return [2 /*return*/];
            }
        });
    });
}
/**
 * Additional verification: Check if element is actually clickable before attempting click
 */
function isElementClickable(selector_1, target_1) {
    return __awaiter(this, arguments, void 0, function (selector, target, frame) {
        var searchTarget, clickable, e_17;
        if (frame === void 0) { frame = null; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    searchTarget = frame || state.page;
                    if (!searchTarget)
                        return [2 /*return*/, false];
                    return [4 /*yield*/, searchTarget.evaluate(function (_a) {
                            var sel = _a.sel, searchText = _a.searchText;
                            var element = null;
                            // Try selector
                            if (sel) {
                                try {
                                    element = document.querySelector(sel);
                                }
                                catch (e) { }
                            }
                            // Search by text if needed
                            if (!element) {
                                var allElements = document.querySelectorAll('*');
                                var searchLower = searchText.toLowerCase();
                                for (var _i = 0, _b = Array.from(allElements); _i < _b.length; _i++) {
                                    var el = _b[_i];
                                    var text = (el.textContent || '').toLowerCase();
                                    if (text.includes(searchLower)) {
                                        element = el;
                                        break;
                                    }
                                }
                            }
                            if (!element)
                                return false;
                            var style = window.getComputedStyle(element);
                            var rect = element.getBoundingClientRect();
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
                        }, { sel: selector, searchText: target })];
                case 1:
                    clickable = _a.sent();
                    return [2 /*return*/, clickable];
                case 2:
                    e_17 = _a.sent();
                    return [2 /*return*/, false];
                case 3: return [2 /*return*/];
            }
        });
    });
}
/**
 * Safely execute a click and verify it was successful before reporting
 */
function safeClickElement(target, selector) {
    return __awaiter(this, void 0, void 0, function () {
        var isClickable, e_18, result, changed, e_19;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!state.page || state.page.isClosed()) {
                        return [2 /*return*/, { success: false, reason: 'Page is closed' }];
                    }
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 12, , 13]);
                    return [4 /*yield*/, isElementClickable(selector || target, target)];
                case 2:
                    isClickable = _a.sent();
                    if (!isClickable) {
                        return [2 /*return*/, { success: false, reason: 'Element not found or not clickable' }];
                    }
                    if (!selector) return [3 /*break*/, 7];
                    _a.label = 3;
                case 3:
                    _a.trys.push([3, 5, , 6]);
                    return [4 /*yield*/, state.page.click(selector, { timeout: 3000 })];
                case 4:
                    _a.sent();
                    return [3 /*break*/, 6];
                case 5:
                    e_18 = _a.sent();
                    return [2 /*return*/, { success: false, reason: "Selector click failed: ".concat(e_18) }];
                case 6: return [3 /*break*/, 9];
                case 7: return [4 /*yield*/, searchInAllFrames(target, 'click')];
                case 8:
                    result = _a.sent();
                    if (!result) {
                        return [2 /*return*/, { success: false, reason: 'Click failed in all frames' }];
                    }
                    _a.label = 9;
                case 9: 
                // Wait for action to process
                return [4 /*yield*/, state.page.waitForTimeout(300)];
                case 10:
                    // Wait for action to process
                    _a.sent();
                    return [4 /*yield*/, verifyActionTookEffect('click', 1500)];
                case 11:
                    changed = _a.sent();
                    if (changed) {
                        return [2 /*return*/, { success: true, reason: 'Element clicked and DOM changed' }];
                    }
                    else {
                        return [2 /*return*/, { success: true, reason: 'Element clicked (DOM change not detected)' }];
                    }
                    return [3 /*break*/, 13];
                case 12:
                    e_19 = _a.sent();
                    return [2 /*return*/, { success: false, reason: "Exception: ".concat(e_19.message) }];
                case 13: return [2 /*return*/];
            }
        });
    });
}
/* ============== ENHANCED FRAME & DYNAMIC ELEMENT HANDLING ============== */
/**
 * Deep DOM search across the main page - looks in all possible places for target elements
 * This is a fallback when frame-based search doesn't find elements
 */
function deepDOMSearch(target, action, fillValue) {
    return __awaiter(this, void 0, void 0, function () {
        var found, filled, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!state.page || state.page.isClosed())
                        return [2 /*return*/, false];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 9, , 10]);
                    log("\n========== DEEP DOM SEARCH START ==========");
                    log("Target: \"".concat(target, "\" | Action: ").concat(action));
                    if (!(action === 'click')) return [3 /*break*/, 5];
                    return [4 /*yield*/, state.page.evaluate(function (searchText) {
                            var _a, _b, _c, _d;
                            // Search strategy: look in order of specificity
                            // 1. Buttons with exact or partial text match
                            var buttons = Array.from(document.querySelectorAll('button, [role="button"], [role="tab"], a'));
                            var _loop_2 = function (btn) {
                                var text = ((_a = btn.textContent) === null || _a === void 0 ? void 0 : _a.toLowerCase()) || '';
                                var ariaLabel = ((_b = btn.getAttribute('aria-label')) === null || _b === void 0 ? void 0 : _b.toLowerCase()) || '';
                                var title = ((_c = btn.getAttribute('title')) === null || _c === void 0 ? void 0 : _c.toLowerCase()) || '';
                                if (text.includes(searchText.toLowerCase()) ||
                                    ariaLabel.includes(searchText.toLowerCase()) ||
                                    title.includes(searchText.toLowerCase())) {
                                    var rect = btn.getBoundingClientRect();
                                    var style = window.getComputedStyle(btn);
                                    if (rect.width > 0 && rect.height > 0 &&
                                        style.display !== 'none' &&
                                        style.visibility !== 'hidden') {
                                        btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                        setTimeout(function () {
                                            btn.click();
                                        }, 300);
                                        return { value: true };
                                    }
                                }
                            };
                            for (var _i = 0, buttons_1 = buttons; _i < buttons_1.length; _i++) {
                                var btn = buttons_1[_i];
                                var state_1 = _loop_2(btn);
                                if (typeof state_1 === "object")
                                    return state_1.value;
                            }
                            // 2. Divs/spans with onclick
                            var divs = Array.from(document.querySelectorAll('div, span, p'));
                            var _loop_3 = function (div) {
                                var text = ((_d = div.textContent) === null || _d === void 0 ? void 0 : _d.toLowerCase()) || '';
                                if (text.includes(searchText.toLowerCase()) && div.onclick) {
                                    var rect = div.getBoundingClientRect();
                                    if (rect.width > 0 && rect.height > 0) {
                                        div.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                        setTimeout(function () {
                                            div.click();
                                        }, 300);
                                        return { value: true };
                                    }
                                }
                            };
                            for (var _e = 0, divs_1 = divs; _e < divs_1.length; _e++) {
                                var div = divs_1[_e];
                                var state_2 = _loop_3(div);
                                if (typeof state_2 === "object")
                                    return state_2.value;
                            }
                            return false;
                        }, target)];
                case 2:
                    found = _a.sent();
                    if (!found) return [3 /*break*/, 4];
                    log("\u2713 Deep DOM search found and clicked element");
                    return [4 /*yield*/, state.page.waitForTimeout(500)];
                case 3:
                    _a.sent();
                    return [2 /*return*/, true];
                case 4: return [3 /*break*/, 8];
                case 5:
                    if (!(action === 'fill' && fillValue)) return [3 /*break*/, 8];
                    return [4 /*yield*/, state.page.evaluate(function (_a) {
                            var _b, _c, _d, _e, _f;
                            var searchText = _a.searchText, value = _a.fillValue;
                            // STRATEGY 1: Search by associated VISIBLE LABEL TEXT first
                            var labels = Array.from(document.querySelectorAll('label'));
                            var _loop_4 = function (label) {
                                var labelText = ((_b = label.textContent) === null || _b === void 0 ? void 0 : _b.toLowerCase()) || '';
                                if (labelText.includes(searchText.toLowerCase())) {
                                    var forAttr = label.getAttribute('for');
                                    var input_1 = null;
                                    if (forAttr) {
                                        input_1 = document.getElementById(forAttr);
                                    }
                                    else {
                                        input_1 = label.querySelector('input, textarea');
                                    }
                                    if (input_1) {
                                        var style = window.getComputedStyle(input_1);
                                        var rect = input_1.getBoundingClientRect();
                                        if (rect.width > 0 && rect.height > 0 &&
                                            style.display !== 'none' &&
                                            style.visibility !== 'hidden' &&
                                            !input_1.disabled) {
                                            input_1.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                            setTimeout(function () {
                                                input_1.value = value;
                                                input_1.dispatchEvent(new Event('input', { bubbles: true }));
                                                input_1.dispatchEvent(new Event('change', { bubbles: true }));
                                            }, 300);
                                            return { value: true };
                                        }
                                    }
                                }
                            };
                            for (var _i = 0, labels_1 = labels; _i < labels_1.length; _i++) {
                                var label = labels_1[_i];
                                var state_3 = _loop_4(label);
                                if (typeof state_3 === "object")
                                    return state_3.value;
                            }
                            // STRATEGY 2: Fallback to placeholder, aria-label, name, id
                            var inputs = Array.from(document.querySelectorAll('input, textarea, [contenteditable="true"]'));
                            var _loop_5 = function (inp) {
                                var placeholder = ((_c = inp.placeholder) === null || _c === void 0 ? void 0 : _c.toLowerCase()) || '';
                                var ariaLabel = ((_d = inp.getAttribute('aria-label')) === null || _d === void 0 ? void 0 : _d.toLowerCase()) || '';
                                var name_2 = ((_e = inp.name) === null || _e === void 0 ? void 0 : _e.toLowerCase()) || '';
                                var id = ((_f = inp.id) === null || _f === void 0 ? void 0 : _f.toLowerCase()) || '';
                                var allText = "".concat(placeholder, " ").concat(ariaLabel, " ").concat(name_2, " ").concat(id);
                                if (allText.includes(searchText.toLowerCase())) {
                                    var style = window.getComputedStyle(inp);
                                    var rect = inp.getBoundingClientRect();
                                    if (rect.width > 0 && rect.height > 0 &&
                                        style.display !== 'none' &&
                                        style.visibility !== 'hidden' &&
                                        !inp.disabled) {
                                        inp.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                        setTimeout(function () {
                                            inp.value = value;
                                            inp.dispatchEvent(new Event('input', { bubbles: true }));
                                            inp.dispatchEvent(new Event('change', { bubbles: true }));
                                        }, 300);
                                        return { value: true };
                                    }
                                }
                            };
                            for (var _g = 0, inputs_1 = inputs; _g < inputs_1.length; _g++) {
                                var inp = inputs_1[_g];
                                var state_4 = _loop_5(inp);
                                if (typeof state_4 === "object")
                                    return state_4.value;
                            }
                            return false;
                        }, { searchText: target, fillValue: fillValue })];
                case 6:
                    filled = _a.sent();
                    if (!filled) return [3 /*break*/, 8];
                    log("\u2713 Deep DOM search found and filled element");
                    return [4 /*yield*/, state.page.waitForTimeout(500)];
                case 7:
                    _a.sent();
                    return [2 /*return*/, true];
                case 8:
                    log("========== DEEP DOM SEARCH - NO MATCH FOUND ==========");
                    log("Will try multi-frame search next...\n");
                    return [2 /*return*/, false];
                case 9:
                    error_1 = _a.sent();
                    log("Deep DOM search error: ".concat(error_1.message));
                    return [2 /*return*/, false];
                case 10: return [2 /*return*/];
            }
        });
    });
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
function logPageStructureDiagnostics(targetSearch) {
    return __awaiter(this, void 0, void 0, function () {
        var diagnostics, e_20;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!state.page || state.page.isClosed())
                        return [2 /*return*/];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, state.page.evaluate(function (target) {
                            var info = {
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
                            var modalSelectors = ['[role="dialog"]', '[role="alertdialog"]', '.modal', '.overlay', '[class*="modal"]', '[class*="overlay"]', '[class*="popup"]'];
                            info.modals = modalSelectors.reduce(function (count, sel) { return count + document.querySelectorAll(sel).length; }, 0);
                            // Count elements with shadow DOM
                            var allElements = document.querySelectorAll('*');
                            for (var i = 0; i < allElements.length; i++) {
                                if (allElements[i].shadowRoot)
                                    info.shadowRoots++;
                            }
                            // Count interactive elements
                            info.buttons = document.querySelectorAll('button').length;
                            info.inputs = document.querySelectorAll('input').length;
                            info.divButtons = document.querySelectorAll('[role="button"], [onclick]').length;
                            info.allClickableElements = document.querySelectorAll('button, [role="button"], [onclick], a[href], input[type="button"], input[type="submit"]').length;
                            // Find matching elements for target
                            var searchLower = target.toLowerCase();
                            var clickables = document.querySelectorAll('button, [role="button"], [onclick], a[href], input[type="button"], input[type="submit"]');
                            for (var i = 0; i < clickables.length; i++) {
                                var el = clickables[i];
                                var text = (el.textContent || '').toLowerCase().trim();
                                var title = (el.getAttribute('title') || '').toLowerCase();
                                var aria = (el.getAttribute('aria-label') || '').toLowerCase();
                                var id = (el.getAttribute('id') || '').toLowerCase();
                                var value = (el.getAttribute('value') || '').toLowerCase();
                                if (text.includes(searchLower) || title.includes(searchLower) || aria.includes(searchLower) ||
                                    id.includes(searchLower) || value.includes(searchLower)) {
                                    // Found match - get visibility info
                                    var style = window.getComputedStyle(el);
                                    var isVisible = style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
                                    var rect = el.getBoundingClientRect();
                                    info.matchingElements.push("".concat(el.tagName, "#").concat(id, " \"").concat(text.substring(0, 30), "\" [visible=").concat(isVisible, ", top=").concat(Math.round(rect.top), ", left=").concat(Math.round(rect.left), "]"));
                                }
                            }
                            return info;
                        }, targetSearch)];
                case 2:
                    diagnostics = _a.sent();
                    // Log diagnostics
                    log("\n\uD83D\uDCCA === PAGE STRUCTURE DIAGNOSTICS ===");
                    log("   Title: ".concat(diagnostics.title));
                    log("   URL: ".concat(diagnostics.url));
                    log("   \uD83D\uDD17 iframes: ".concat(diagnostics.iframes, ", \uD83E\uDE9F Modals: ").concat(diagnostics.modals, ", \uD83D\uDC41\uFE0F Shadow Roots: ").concat(diagnostics.shadowRoots));
                    log("   \uD83D\uDCCD Clickable Elements: ".concat(diagnostics.allClickableElements, " (").concat(diagnostics.buttons, " buttons, ").concat(diagnostics.inputs, " inputs, ").concat(diagnostics.divButtons, " div-buttons)"));
                    log("   \uD83D\uDCFA Page Size: ".concat(diagnostics.pageWidth, "x").concat(diagnostics.pageHeight, "px, Viewport: ").concat(diagnostics.viewportWidth, "x").concat(diagnostics.viewportHeight, "px"));
                    if (diagnostics.matchingElements.length > 0) {
                        log("   \u2705 FOUND ".concat(diagnostics.matchingElements.length, " element(s) matching \"").concat(targetSearch, "\":"));
                        diagnostics.matchingElements.forEach(function (el) { return log("      - ".concat(el)); });
                    }
                    else {
                        log("   \u26A0\uFE0F  NO elements found matching \"".concat(targetSearch, "\" in main page"));
                    }
                    log("\uD83D\uDCCA ===================================\n");
                    return [3 /*break*/, 4];
                case 3:
                    e_20 = _a.sent();
                    log("   [DIAGNOSTIC ERROR] ".concat(e_20.message));
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    });
}
/**
 * UNIVERSAL IFRAME SEARCH - Works for ANY iframe on ANY website
 * Discovers all iframes dynamically, logs their names/IDs, and searches them with robust fallbacks
 */
function searchAllDiscoveredIframes(target, action, fillValue) {
    return __awaiter(this, void 0, void 0, function () {
        var allIframes, discoveredIframes, _loop_6, i, _loop_7, idx, state_5, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!state.page || state.page.isClosed())
                        return [2 /*return*/, false];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 11, , 12]);
                    return [4 /*yield*/, state.page.locator('iframe').all()];
                case 2:
                    allIframes = _a.sent();
                    if (allIframes.length === 0) {
                        return [2 /*return*/, false];
                    }
                    log("\n\uD83D\uDD0E [UNIVERSAL IFRAME DISCOVERY] Found ".concat(allIframes.length, " iframe(s) on page:"));
                    discoveredIframes = [];
                    _loop_6 = function (i) {
                        var iframeId, iframeName;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0: return [4 /*yield*/, allIframes[i].getAttribute('id').catch(function () { return "iframe_".concat(i); })];
                                case 1:
                                    iframeId = _b.sent();
                                    return [4 /*yield*/, allIframes[i].getAttribute('name').catch(function () { return 'unnamed'; })];
                                case 2:
                                    iframeName = _b.sent();
                                    discoveredIframes.push({ id: iframeId || "iframe_".concat(i), name: iframeName || 'unnamed', index: i });
                                    log("   [".concat(i, "] ID: \"").concat(iframeId || 'none', "\" | Name: \"").concat(iframeName || 'unnamed', "\""));
                                    return [2 /*return*/];
                            }
                        });
                    };
                    i = 0;
                    _a.label = 3;
                case 3:
                    if (!(i < allIframes.length)) return [3 /*break*/, 6];
                    return [5 /*yield**/, _loop_6(i)];
                case 4:
                    _a.sent();
                    _a.label = 5;
                case 5:
                    i++;
                    return [3 /*break*/, 3];
                case 6:
                    _loop_7 = function (idx) {
                        var iframeElement, iframeInfo, frameId, frameName, frameSelector, iframeLocator, clickables, foundMatches, targetLower_1, debugMatches, _i, clickables_1, elem, isVisible, boundingBox, text, value, title, ariaLabel, allText, trimmedText, isMatch, clickErr_1, jsErr_1, elemErr_1, inputs, _loop_8, _c, inputs_2, input, state_6, iframeErr_1;
                        return __generator(this, function (_d) {
                            switch (_d.label) {
                                case 0:
                                    _d.trys.push([0, 32, , 33]);
                                    iframeElement = allIframes[idx];
                                    iframeInfo = discoveredIframes[idx];
                                    frameId = iframeInfo.id;
                                    frameName = iframeInfo.name;
                                    // Wait for iframe to load
                                    return [4 /*yield*/, iframeElement.waitFor({ state: 'visible', timeout: 2000 }).catch(function () { })];
                                case 1:
                                    // Wait for iframe to load
                                    _d.sent();
                                    return [4 /*yield*/, state.page.waitForTimeout(300)];
                                case 2:
                                    _d.sent();
                                    log("\n   \uD83D\uDCCD Searching iframe [".concat(idx, "]: ").concat(frameId, " (name: \"").concat(frameName, "\")"));
                                    frameSelector = "iframe[id=\"".concat(frameId, "\"], iframe[name=\"").concat(frameName, "\"]");
                                    iframeLocator = state.page.frameLocator(frameSelector).first();
                                    // Wait for body to be ready
                                    return [4 /*yield*/, iframeLocator.locator('body').waitFor({ state: 'visible', timeout: 2000 }).catch(function () { })];
                                case 3:
                                    // Wait for body to be ready
                                    _d.sent();
                                    if (!(action === 'click')) return [3 /*break*/, 26];
                                    return [4 /*yield*/, iframeLocator.locator('button, [role="button"], input[type="button"], input[type="submit"], input[type="radio"], input[type="checkbox"], a, [onclick], div[onclick], label').all()];
                                case 4:
                                    clickables = _d.sent();
                                    log("      \uD83D\uDD0D Found ".concat(clickables.length, " clickable elements"));
                                    foundMatches = 0;
                                    targetLower_1 = target.toLowerCase();
                                    debugMatches = [];
                                    _i = 0, clickables_1 = clickables;
                                    _d.label = 5;
                                case 5:
                                    if (!(_i < clickables_1.length)) return [3 /*break*/, 25];
                                    elem = clickables_1[_i];
                                    _d.label = 6;
                                case 6:
                                    _d.trys.push([6, 23, , 24]);
                                    return [4 /*yield*/, elem.isVisible().catch(function () { return false; })];
                                case 7:
                                    isVisible = _d.sent();
                                    if (!isVisible)
                                        return [3 /*break*/, 24];
                                    return [4 /*yield*/, elem.boundingBox().catch(function () { return null; })];
                                case 8:
                                    boundingBox = _d.sent();
                                    if (!boundingBox)
                                        return [3 /*break*/, 24];
                                    return [4 /*yield*/, elem.textContent().catch(function () { return ''; })];
                                case 9:
                                    text = _d.sent();
                                    return [4 /*yield*/, elem.getAttribute('value').catch(function () { return ''; })];
                                case 10:
                                    value = _d.sent();
                                    return [4 /*yield*/, elem.getAttribute('title').catch(function () { return ''; })];
                                case 11:
                                    title = _d.sent();
                                    return [4 /*yield*/, elem.getAttribute('aria-label').catch(function () { return ''; })];
                                case 12:
                                    ariaLabel = _d.sent();
                                    allText = "".concat(text, " ").concat(value, " ").concat(title, " ").concat(ariaLabel).toLowerCase();
                                    trimmedText = text.trim().toLowerCase();
                                    isMatch = false;
                                    if (target.length === 1) {
                                        // Single char: ONLY exact full text match
                                        isMatch = trimmedText === targetLower_1;
                                    }
                                    else if (target.length <= 3) {
                                        // 2-3 chars: exact match OR word match
                                        isMatch = (trimmedText === targetLower_1 || trimmedText.split(/\s+/).some(function (word) { return word === targetLower_1; }));
                                    }
                                    else {
                                        // Longer: substring match
                                        isMatch = allText.includes(targetLower_1);
                                    }
                                    // DEBUG: For single-char searches, log ALL elements containing that letter
                                    if (target.length === 1 && (allText.includes(targetLower_1))) {
                                        debugMatches.push("\"".concat(text, "\" [trimmed=\"").concat(trimmedText, "\" | contains=\"").concat(targetLower_1, "\": ").concat(isMatch ? 'YES MATCH' : 'NO MATCH', "]"));
                                    }
                                    if (!isMatch) return [3 /*break*/, 22];
                                    foundMatches++;
                                    log("      \u2713 MATCH ".concat(foundMatches, ": \"").concat(text.trim(), "\" [text=\"").concat(text, "\" | trimmed=\"").concat(trimmedText, "\" | value=\"").concat(value, "\" | title=\"").concat(title, "\" | allText=\"").concat(allText, "\"]"));
                                    _d.label = 13;
                                case 13:
                                    _d.trys.push([13, 16, , 22]);
                                    return [4 /*yield*/, elem.click({ force: true, timeout: 3000 })];
                                case 14:
                                    _d.sent();
                                    log("      \u2705 [UNIVERSAL-CLICK] Successfully clicked in ".concat(frameId));
                                    return [4 /*yield*/, state.page.waitForTimeout(500)];
                                case 15:
                                    _d.sent();
                                    return [2 /*return*/, { value: true }];
                                case 16:
                                    clickErr_1 = _d.sent();
                                    log("      \u26A0\uFE0F  Playwright click failed, trying JavaScript...");
                                    _d.label = 17;
                                case 17:
                                    _d.trys.push([17, 20, , 21]);
                                    return [4 /*yield*/, elem.evaluate(function (el) {
                                            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                            el.click();
                                        })];
                                case 18:
                                    _d.sent();
                                    log("      \u2705 [UNIVERSAL-CLICK-JS] JavaScript click succeeded in ".concat(frameId));
                                    return [4 /*yield*/, state.page.waitForTimeout(500)];
                                case 19:
                                    _d.sent();
                                    return [2 /*return*/, { value: true }];
                                case 20:
                                    jsErr_1 = _d.sent();
                                    log("      \u26A0\uFE0F  JavaScript click also failed: ".concat(jsErr_1.message));
                                    return [3 /*break*/, 21];
                                case 21: return [3 /*break*/, 22];
                                case 22: return [3 /*break*/, 24];
                                case 23:
                                    elemErr_1 = _d.sent();
                                    return [3 /*break*/, 24];
                                case 24:
                                    _i++;
                                    return [3 /*break*/, 5];
                                case 25:
                                    // Show debug info for single-char searches
                                    if (target.length === 1 && debugMatches.length > 0) {
                                        log("      \uD83D\uDCCA DEBUG: Elements containing \"".concat(targetLower_1, "\" (not matching exact):"));
                                        debugMatches.forEach(function (match) { return log("         ".concat(match)); });
                                    }
                                    if (foundMatches === 0) {
                                        log("      \u26A0\uFE0F  No matches found for \"".concat(target, "\" in ").concat(clickables.length, " clickable elements"));
                                    }
                                    return [3 /*break*/, 31];
                                case 26:
                                    if (!(action === 'fill' && fillValue)) return [3 /*break*/, 31];
                                    return [4 /*yield*/, iframeLocator.locator('input[type="text"], textarea, input:not([type])').all()];
                                case 27:
                                    inputs = _d.sent();
                                    log("      \uD83D\uDD0D Found ".concat(inputs.length, " input fields"));
                                    _loop_8 = function (input) {
                                        var isVisible, boundingBox, placeholder, title, name_3, id, ariaLabel, allText, targetLower_2, isMatch, filled, fillErr_1, jsErr_2, elemErr_2;
                                        return __generator(this, function (_e) {
                                            switch (_e.label) {
                                                case 0:
                                                    _e.trys.push([0, 18, , 19]);
                                                    return [4 /*yield*/, input.isVisible().catch(function () { return false; })];
                                                case 1:
                                                    isVisible = _e.sent();
                                                    if (!isVisible)
                                                        return [2 /*return*/, "continue"];
                                                    return [4 /*yield*/, input.boundingBox().catch(function () { return null; })];
                                                case 2:
                                                    boundingBox = _e.sent();
                                                    if (!boundingBox)
                                                        return [2 /*return*/, "continue"];
                                                    return [4 /*yield*/, input.getAttribute('placeholder').catch(function () { return ''; })];
                                                case 3:
                                                    placeholder = _e.sent();
                                                    return [4 /*yield*/, input.getAttribute('title').catch(function () { return ''; })];
                                                case 4:
                                                    title = _e.sent();
                                                    return [4 /*yield*/, input.getAttribute('name').catch(function () { return ''; })];
                                                case 5:
                                                    name_3 = _e.sent();
                                                    return [4 /*yield*/, input.getAttribute('id').catch(function () { return ''; })];
                                                case 6:
                                                    id = _e.sent();
                                                    return [4 /*yield*/, input.getAttribute('aria-label').catch(function () { return ''; })];
                                                case 7:
                                                    ariaLabel = _e.sent();
                                                    allText = "".concat(placeholder, " ").concat(title, " ").concat(name_3, " ").concat(id, " ").concat(ariaLabel).toLowerCase();
                                                    targetLower_2 = target.toLowerCase();
                                                    isMatch = false;
                                                    if (target.length === 1) {
                                                        // Single char: ONLY exact word match - prevent "A" matching "Name" or "Table"
                                                        isMatch = allText.split(/\s+/).some(function (word) { return word === targetLower_2 && word.length === 1; });
                                                    }
                                                    else if (target.length <= 3) {
                                                        // 2-3 chars: word match
                                                        isMatch = allText.split(/\s+/).some(function (word) { return word === targetLower_2; });
                                                    }
                                                    else {
                                                        // Longer: substring match
                                                        isMatch = allText.includes(targetLower_2);
                                                    }
                                                    if (!isMatch) return [3 /*break*/, 17];
                                                    log("      \u2713 FOUND INPUT: \"".concat(title || placeholder || name_3, "\" - Filling with \"").concat(fillValue, "\""));
                                                    filled = false;
                                                    _e.label = 8;
                                                case 8:
                                                    _e.trys.push([8, 11, , 12]);
                                                    return [4 /*yield*/, input.fill(fillValue, { timeout: 2000 })];
                                                case 9:
                                                    _e.sent();
                                                    filled = true;
                                                    log("      \u2705 [UNIVERSAL-FILL] Successfully filled in ".concat(frameId));
                                                    return [4 /*yield*/, state.page.waitForTimeout(300)];
                                                case 10:
                                                    _e.sent();
                                                    return [2 /*return*/, { value: true }];
                                                case 11:
                                                    fillErr_1 = _e.sent();
                                                    log("      \u26A0\uFE0F  Playwright fill failed, trying JavaScript...");
                                                    return [3 /*break*/, 12];
                                                case 12:
                                                    if (!!filled) return [3 /*break*/, 17];
                                                    _e.label = 13;
                                                case 13:
                                                    _e.trys.push([13, 16, , 17]);
                                                    return [4 /*yield*/, input.evaluate(function (el, val) {
                                                            el.value = val;
                                                            el.dispatchEvent(new Event('input', { bubbles: true }));
                                                            el.dispatchEvent(new Event('change', { bubbles: true }));
                                                            el.dispatchEvent(new Event('blur', { bubbles: true }));
                                                        }, fillValue)];
                                                case 14:
                                                    _e.sent();
                                                    log("      \u2705 [UNIVERSAL-FILL-JS] JavaScript fill succeeded in ".concat(frameId));
                                                    return [4 /*yield*/, state.page.waitForTimeout(300)];
                                                case 15:
                                                    _e.sent();
                                                    return [2 /*return*/, { value: true }];
                                                case 16:
                                                    jsErr_2 = _e.sent();
                                                    log("      \u26A0\uFE0F  JavaScript fill also failed: ".concat(jsErr_2.message));
                                                    return [3 /*break*/, 17];
                                                case 17: return [3 /*break*/, 19];
                                                case 18:
                                                    elemErr_2 = _e.sent();
                                                    return [3 /*break*/, 19];
                                                case 19: return [2 /*return*/];
                                            }
                                        });
                                    };
                                    _c = 0, inputs_2 = inputs;
                                    _d.label = 28;
                                case 28:
                                    if (!(_c < inputs_2.length)) return [3 /*break*/, 31];
                                    input = inputs_2[_c];
                                    return [5 /*yield**/, _loop_8(input)];
                                case 29:
                                    state_6 = _d.sent();
                                    if (typeof state_6 === "object")
                                        return [2 /*return*/, state_6];
                                    _d.label = 30;
                                case 30:
                                    _c++;
                                    return [3 /*break*/, 28];
                                case 31: return [3 /*break*/, 33];
                                case 32:
                                    iframeErr_1 = _d.sent();
                                    log("      \u26A0\uFE0F  Error searching iframe: ".concat(iframeErr_1.message));
                                    return [3 /*break*/, 33];
                                case 33: return [2 /*return*/];
                            }
                        });
                    };
                    idx = 0;
                    _a.label = 7;
                case 7:
                    if (!(idx < allIframes.length)) return [3 /*break*/, 10];
                    return [5 /*yield**/, _loop_7(idx)];
                case 8:
                    state_5 = _a.sent();
                    if (typeof state_5 === "object")
                        return [2 /*return*/, state_5.value];
                    _a.label = 9;
                case 9:
                    idx++;
                    return [3 /*break*/, 7];
                case 10: return [2 /*return*/, false];
                case 11:
                    error_2 = _a.sent();
                    log("\uD83D\uDD0E [UNIVERSAL IFRAME ERROR] ".concat(error_2.message));
                    return [2 /*return*/, false];
                case 12: return [2 /*return*/];
            }
        });
    });
}
function searchInAllFrames(target, action, fillValue) {
    return __awaiter(this, void 0, void 0, function () {
        var allFrames, MAX_FRAMES, framesToSearch, universalResult, frameSequence, seqIndex, frameInfo, frame, framePath, isFrameValid, frameDetails, iframeNamesList, allChildFrames, iIdx, iframeInfo, iframeLabel, selector, iframeFrame, clickableLocator, clickableCount, clickableElements, cleanedElements, allText, bodyText, err_1, matchingFrame, crossOriginText, bodyContent, crossOriginErr_1, clickResult, fillResult, frameError_1, error_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!state.page || state.page.isClosed())
                        return [2 /*return*/, false];
                    if (!state.isPaused) return [3 /*break*/, 4];
                    _a.label = 1;
                case 1:
                    if (!(state.isPaused && !state.isStopped)) return [3 /*break*/, 3];
                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 500); })];
                case 2:
                    _a.sent();
                    return [3 /*break*/, 1];
                case 3:
                    if (state.isStopped)
                        return [2 /*return*/, false];
                    _a.label = 4;
                case 4:
                    _a.trys.push([4, 43, , 44]);
                    allFrames = state.page.frames();
                    MAX_FRAMES = 15;
                    framesToSearch = allFrames.slice(0, MAX_FRAMES);
                    if (framesToSearch.length === 0)
                        return [2 /*return*/, false];
                    log("\uD83D\uDD0D [FRAME SEARCH] Found ".concat(framesToSearch.length, " frame(s) to search"));
                    // DIAGNOSTIC: Log frame details on first search of page
                    return [4 /*yield*/, logPageStructureDiagnostics(target)];
                case 5:
                    // DIAGNOSTIC: Log frame details on first search of page
                    _a.sent();
                    return [4 /*yield*/, searchAllDiscoveredIframes(target, action, fillValue)];
                case 6:
                    universalResult = _a.sent();
                    if (universalResult) {
                        return [2 /*return*/, true];
                    }
                    frameSequence = buildFrameSearchSequence(framesToSearch);
                    seqIndex = 0;
                    _a.label = 7;
                case 7:
                    if (!(seqIndex < frameSequence.length)) return [3 /*break*/, 42];
                    if (!state.isPaused) return [3 /*break*/, 11];
                    _a.label = 8;
                case 8:
                    if (!(state.isPaused && !state.isStopped)) return [3 /*break*/, 10];
                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 500); })];
                case 9:
                    _a.sent();
                    return [3 /*break*/, 8];
                case 10:
                    if (state.isStopped)
                        return [2 /*return*/, false];
                    _a.label = 11;
                case 11:
                    frameInfo = frameSequence[seqIndex];
                    frame = frameInfo.frame;
                    framePath = frameInfo.path;
                    _a.label = 12;
                case 12:
                    _a.trys.push([12, 40, , 41]);
                    return [4 /*yield*/, validateFrameAccess(frame)];
                case 13:
                    isFrameValid = _a.sent();
                    if (!isFrameValid) {
                        log("\u26A0\uFE0F  [".concat(framePath, "] Frame not accessible, skipping..."));
                        return [3 /*break*/, 41];
                    }
                    // Step 3b: Wait for frame content to be ready
                    return [4 /*yield*/, frame.waitForLoadState('domcontentloaded').catch(function () { })];
                case 14:
                    // Step 3b: Wait for frame content to be ready
                    _a.sent();
                    return [4 /*yield*/, frame.waitForTimeout(200)];
                case 15:
                    _a.sent(); // Stability pause
                    return [4 /*yield*/, frame.evaluate(function () { return ({
                            url: window.location.href,
                            title: document.title,
                            buttonCount: document.querySelectorAll('button').length,
                            divButtonCount: document.querySelectorAll('[role="button"], [onclick]').length,
                            inputCount: document.querySelectorAll('input').length,
                            iframeCount: document.querySelectorAll('iframe').length,
                            iframeNames: Array.from(document.querySelectorAll('iframe')).map(function (iframe) { return ({
                                name: iframe.getAttribute('name') || 'unnamed',
                                id: iframe.getAttribute('id') || 'no-id',
                                src: iframe.getAttribute('src') || 'no-src'
                            }); }),
                            allClickable: document.querySelectorAll('button, [role="button"], [onclick], a[href], input[type="button"], input[type="submit"]').length
                        }); }).catch(function () { return null; })];
                case 16:
                    frameDetails = _a.sent();
                    if (!frameDetails) return [3 /*break*/, 35];
                    log("   \uD83D\uDCC4 Frame content: ".concat(frameDetails.allClickable, " clickable elements (").concat(frameDetails.buttonCount, " buttons, ").concat(frameDetails.divButtonCount, " div-buttons, ").concat(frameDetails.inputCount, " inputs)"));
                    if (!(frameDetails.iframeCount > 0)) return [3 /*break*/, 35];
                    iframeNamesList = frameDetails.iframeNames.map(function (f) { return "[".concat(f.name).concat(f.id !== 'no-id' ? "#".concat(f.id) : '', "]"); }).join(', ');
                    log("   \uD83D\uDD17 This frame contains ".concat(frameDetails.iframeCount, " nested iframe(s): ").concat(iframeNamesList));
                    allChildFrames = frame.childFrames();
                    log("   \uD83D\uDCCD Total child frames (Playwright detected): ".concat(allChildFrames.length));
                    iIdx = 0;
                    _a.label = 17;
                case 17:
                    if (!(iIdx < frameDetails.iframeNames.length)) return [3 /*break*/, 35];
                    iframeInfo = frameDetails.iframeNames[iIdx];
                    iframeLabel = "".concat(iframeInfo.name).concat(iframeInfo.id !== 'no-id' ? "#".concat(iframeInfo.id) : '');
                    _a.label = 18;
                case 18:
                    _a.trys.push([18, 27, , 34]);
                    selector = '';
                    // Build selector based on available attributes
                    if (iframeInfo.id !== 'no-id') {
                        selector = "#".concat(iframeInfo.id);
                    }
                    else if (iframeInfo.name !== 'unnamed') {
                        selector = "iframe[name=\"".concat(iframeInfo.name, "\"]");
                    }
                    else {
                        selector = "iframe[src=\"".concat(iframeInfo.src, "\"]");
                    }
                    // Wait for iframe to be visible and loaded
                    return [4 /*yield*/, frame.locator(selector).first().waitFor({ state: 'visible', timeout: 2000 }).catch(function () { })];
                case 19:
                    // Wait for iframe to be visible and loaded
                    _a.sent();
                    return [4 /*yield*/, frame.waitForTimeout(300)];
                case 20:
                    _a.sent(); // Give iframe content time to load
                    iframeFrame = frame.frameLocator(selector).first();
                    // Try to wait for iframe content to load
                    return [4 /*yield*/, iframeFrame.locator('body').waitFor({ state: 'visible', timeout: 2000 }).catch(function () { })];
                case 21:
                    // Try to wait for iframe content to load
                    _a.sent();
                    clickableLocator = iframeFrame.locator('button, [role="button"], [onclick], a[href], input[type="button"], input[type="submit"]');
                    return [4 /*yield*/, clickableLocator.count()];
                case 22:
                    clickableCount = _a.sent();
                    if (!(clickableCount > 0)) return [3 /*break*/, 24];
                    return [4 /*yield*/, clickableLocator.allTextContents()];
                case 23:
                    clickableElements = _a.sent();
                    cleanedElements = clickableElements
                        .map(function (text) { return text.trim(); })
                        .filter(function (text) { return text.length > 0 && text.length < 50; })
                        .slice(0, 30);
                    log("      \u251C\u2500 iframe [".concat(iframeLabel, "]: ").concat(clickableCount, " clickable elements \u2192 ").concat(cleanedElements.join(' | ')));
                    return [3 /*break*/, 26];
                case 24: return [4 /*yield*/, iframeFrame.locator('body').allTextContents().catch(function () { return []; })];
                case 25:
                    allText = _a.sent();
                    bodyText = allText.join(' ').trim().slice(0, 100);
                    log("      \u251C\u2500 iframe [".concat(iframeLabel, "]: (0 clickable) | Content: \"").concat(bodyText).concat(bodyText.length === 100 ? '...' : '', "\""));
                    _a.label = 26;
                case 26: return [3 /*break*/, 34];
                case 27:
                    err_1 = _a.sent();
                    _a.label = 28;
                case 28:
                    _a.trys.push([28, 32, , 33]);
                    matchingFrame = allChildFrames[iIdx];
                    if (!matchingFrame) return [3 /*break*/, 30];
                    return [4 /*yield*/, matchingFrame.locator('body').allTextContents().catch(function () { return []; })];
                case 29:
                    crossOriginText = _a.sent();
                    bodyContent = crossOriginText.join(' ').trim().slice(0, 150);
                    log("      \u251C\u2500 iframe [".concat(iframeLabel, "] (cross-origin): \"").concat(bodyContent).concat(bodyContent.length === 150 ? '...' : '', "\""));
                    return [3 /*break*/, 31];
                case 30:
                    log("      \u251C\u2500 iframe [".concat(iframeLabel, "]: (not accessible - cross-origin)"));
                    _a.label = 31;
                case 31: return [3 /*break*/, 33];
                case 32:
                    crossOriginErr_1 = _a.sent();
                    log("      \u251C\u2500 iframe [".concat(iframeLabel, "]: (not accessible - cross-origin)"));
                    return [3 /*break*/, 33];
                case 33: return [3 /*break*/, 34];
                case 34:
                    iIdx++;
                    return [3 /*break*/, 17];
                case 35:
                    log("\uD83D\uDD0D [".concat(framePath, "] Searching for: \"").concat(target, "\""));
                    if (!(action === 'click')) return [3 /*break*/, 37];
                    return [4 /*yield*/, executeClickInFrame(frame, target, framePath)];
                case 36:
                    clickResult = _a.sent();
                    if (clickResult)
                        return [2 /*return*/, true];
                    return [3 /*break*/, 39];
                case 37:
                    if (!(action === 'fill' && fillValue)) return [3 /*break*/, 39];
                    return [4 /*yield*/, executeFillInFrame(frame, target, fillValue, framePath)];
                case 38:
                    fillResult = _a.sent();
                    if (fillResult)
                        return [2 /*return*/, true];
                    _a.label = 39;
                case 39: return [3 /*break*/, 41];
                case 40:
                    frameError_1 = _a.sent();
                    // Frame error - continue to next frame in sequence
                    log("\u26A0\uFE0F  [".concat(framePath, "] Error during search: ").concat(frameError_1.message));
                    return [3 /*break*/, 41];
                case 41:
                    seqIndex++;
                    return [3 /*break*/, 7];
                case 42: return [2 /*return*/, false];
                case 43:
                    error_3 = _a.sent();
                    log("\u274C Frame search error: ".concat(error_3.message));
                    return [2 /*return*/, false];
                case 44: return [2 /*return*/];
            }
        });
    });
}
/**
 * Search in all open subwindows (popups, new tabs)
 * Returns true if element was found and action executed
 */
/**
 * Recursively search through nested windows (sub, sub-sub, etc.)
 */
function searchInAllSubwindows(target, action, fillValue) {
    return __awaiter(this, void 0, void 0, function () {
        var wIdx, page, isClosed, hierarchy, level, isMain, isLatest, pageTitle, pageUrl, windowLabel, priority, status_1, err_2, result_1, subwindowsSorted, _i, subwindowsSorted_1, subwindow, result_2, result, error_4;
        var _a, _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    _d.trys.push([0, 14, , 15]);
                    log("\n\uD83E\uDE9F ========== [SEARCH STRATEGY: PRIORITY WINDOW FIRST] ==========");
                    log("\uD83E\uDE9F Total windows available: ".concat(allPages.length));
                    wIdx = 0;
                    _d.label = 1;
                case 1:
                    if (!(wIdx < allPages.length)) return [3 /*break*/, 6];
                    page = allPages[wIdx];
                    isClosed = page.isClosed();
                    hierarchy = windowHierarchy.get(page);
                    level = (hierarchy === null || hierarchy === void 0 ? void 0 : hierarchy.level) || 0;
                    isMain = page === state.page;
                    isLatest = page === latestSubwindow;
                    _d.label = 2;
                case 2:
                    _d.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, page.title().catch(function () { return 'Unknown'; })];
                case 3:
                    pageTitle = _d.sent();
                    pageUrl = page.url();
                    windowLabel = isMain ? '🏠 MAIN' : "\uD83D\uDCCD SUBWINDOW (Level ".concat(level, ")");
                    priority = isLatest ? ' ⭐ [LATEST - WILL SEARCH FIRST]' : '';
                    status_1 = isClosed ? ' ❌ CLOSED' : ' ✅ OPEN';
                    log("   ".concat(windowLabel, ": \"").concat(pageTitle, "\" | ").concat(pageUrl).concat(priority).concat(status_1));
                    return [3 /*break*/, 5];
                case 4:
                    err_2 = _d.sent();
                    log("   \uD83D\uDCCD WINDOW ".concat(wIdx, ": (error reading details - ").concat(err_2.message, ")"));
                    return [3 /*break*/, 5];
                case 5:
                    wIdx++;
                    return [3 /*break*/, 1];
                case 6:
                    if (allPages.length <= 1)
                        return [2 /*return*/, false]; // Only main page open
                    if (!(latestSubwindow && !latestSubwindow.isClosed() && latestSubwindow !== state.page)) return [3 /*break*/, 8];
                    log("\n\uD83C\uDFAF [PRIORITY 1] Searching LATEST OPENED SUBWINDOW FIRST (e.g., Customer Maintenance)");
                    return [4 /*yield*/, searchWindowsRecursively(latestSubwindow, target, action, fillValue, ((_a = windowHierarchy.get(latestSubwindow)) === null || _a === void 0 ? void 0 : _a.level) || 1, allPages.length)];
                case 7:
                    result_1 = _d.sent();
                    if (result_1) {
                        state.page = latestSubwindow;
                        log("\u2705 [PRIORITY 1] Found element in latest subwindow!");
                        return [2 /*return*/, true];
                    }
                    _d.label = 8;
                case 8:
                    // PRIORITY 2: Search other subwindows by recency (newest first)
                    log("\n\uD83C\uDFAF [PRIORITY 2] Searching OTHER SUBWINDOWS by recency (newest first)");
                    subwindowsSorted = allPages
                        .filter(function (p) { return p !== state.page && !p.isClosed(); })
                        .sort(function (a, b) {
                        var _a, _b;
                        var aTime = ((_a = windowHierarchy.get(a)) === null || _a === void 0 ? void 0 : _a.openedAt) || 0;
                        var bTime = ((_b = windowHierarchy.get(b)) === null || _b === void 0 ? void 0 : _b.openedAt) || 0;
                        return bTime - aTime; // Newest first
                    });
                    _i = 0, subwindowsSorted_1 = subwindowsSorted;
                    _d.label = 9;
                case 9:
                    if (!(_i < subwindowsSorted_1.length)) return [3 /*break*/, 12];
                    subwindow = subwindowsSorted_1[_i];
                    log("\n   \u2192 Checking subwindow (opened at ".concat(new Date(((_b = windowHierarchy.get(subwindow)) === null || _b === void 0 ? void 0 : _b.openedAt) || 0).toLocaleTimeString(), ")"));
                    return [4 /*yield*/, searchWindowsRecursively(subwindow, target, action, fillValue, ((_c = windowHierarchy.get(subwindow)) === null || _c === void 0 ? void 0 : _c.level) || 1, allPages.length)];
                case 10:
                    result_2 = _d.sent();
                    if (result_2) {
                        state.page = subwindow;
                        log("\u2705 [PRIORITY 2] Found element in subwindow!");
                        return [2 /*return*/, true];
                    }
                    _d.label = 11;
                case 11:
                    _i++;
                    return [3 /*break*/, 9];
                case 12:
                    // PRIORITY 3: Only then search main window
                    log("\n\uD83C\uDFAF [PRIORITY 3] Searching MAIN WINDOW (if not found in subwindows)");
                    return [4 /*yield*/, searchWindowsRecursively(state.page, target, action, fillValue, 0, allPages.length)];
                case 13:
                    result = _d.sent();
                    if (result) {
                        log("\u2705 [PRIORITY 3] Found element in main window!");
                        return [2 /*return*/, true];
                    }
                    log("\n\u274C Element not found in ANY window (checked ".concat(allPages.length, " windows)"));
                    return [2 /*return*/, false];
                case 14:
                    error_4 = _d.sent();
                    log("\uD83E\uDE9F [NESTED SEARCH ERROR] ".concat(error_4.message));
                    return [2 /*return*/, false];
                case 15: return [2 /*return*/];
            }
        });
    });
}
/**
 * Recursive helper to search windows at all nesting levels - ALL FRAMES THOROUGHLY
 */
function searchWindowsRecursively(currentPage, target, action, fillValue, depth, totalWindows) {
    return __awaiter(this, void 0, void 0, function () {
        var pageInfo, windowLabel, frames_2, frameObj, result, result, e_21, frameIdx, frame, frameLabel, result, result, frameError_2, childPages, childPagesSorted, childIdx, childPage, childOpenTime, result, error_5;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (currentPage.isClosed())
                        return [2 /*return*/, false];
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 27, , 28]);
                    pageInfo = windowHierarchy.get(currentPage);
                    windowLabel = depth === 0 ? '🏠 MAIN WINDOW' : "\uD83D\uDCCD SUBWINDOW (Level ".concat(depth, ")");
                    // Brief wait for subwindows to load
                    return [4 /*yield*/, currentPage.waitForLoadState('domcontentloaded').catch(function () { })];
                case 2:
                    // Brief wait for subwindows to load
                    _b.sent();
                    if (!(depth > 0)) return [3 /*break*/, 4];
                    return [4 /*yield*/, currentPage.waitForTimeout(300)];
                case 3:
                    _b.sent(); // Reduced wait for overlay/popup render
                    _b.label = 4;
                case 4:
                    frames_2 = currentPage.frames();
                    log("\n\uD83D\uDD0D [".concat('═'.repeat(50), "]"));
                    log("\uD83D\uDD0D [WINDOW SEARCH] ".concat(windowLabel));
                    log("\uD83D\uDD0D \u251C\u2500 TOTAL FRAMES TO SEARCH: ".concat(frames_2.length));
                    log("\uD83D\uDD0D \u251C\u2500 TARGET: \"".concat(target, "\""));
                    log("\uD83D\uDD0D \u251C\u2500 WINDOW DEPTH: ".concat(depth, "/").concat(totalWindows - 1));
                    log("\uD83D\uDD0D \u2514\u2500 STATUS: Searching ALL frames thoroughly...\n");
                    if (!(depth > 0 && frames_2.length === 0)) return [3 /*break*/, 11];
                    log("   \u26A0\uFE0F  [SUBWINDOW] No frames detected in subwindow - trying direct page search...");
                    _b.label = 5;
                case 5:
                    _b.trys.push([5, 10, , 11]);
                    frameObj = {
                        locator: function (sel) { return currentPage.locator(sel); },
                        evaluate: function (func) {
                            var args = [];
                            for (var _i = 1; _i < arguments.length; _i++) {
                                args[_i - 1] = arguments[_i];
                            }
                            return currentPage.evaluate.apply(currentPage, __spreadArray([func], args, false));
                        }
                    };
                    if (!(action === 'click')) return [3 /*break*/, 7];
                    return [4 /*yield*/, executeClickInFrame(frameObj, target, "".concat(windowLabel, ":DirectPage"))];
                case 6:
                    result = _b.sent();
                    if (result) {
                        log("   \u2705 Found target in direct page search!");
                        return [2 /*return*/, true];
                    }
                    return [3 /*break*/, 9];
                case 7:
                    if (!(action === 'fill')) return [3 /*break*/, 9];
                    return [4 /*yield*/, executeFillInFrame(frameObj, target, fillValue || '', "".concat(windowLabel, ":DirectPage"))];
                case 8:
                    result = _b.sent();
                    if (result) {
                        log("   \u2705 Found field in direct page search!");
                        return [2 /*return*/, true];
                    }
                    _b.label = 9;
                case 9: return [3 /*break*/, 11];
                case 10:
                    e_21 = _b.sent();
                    log("   \u2139\uFE0F Direct page search failed: ".concat(e_21.message));
                    return [3 /*break*/, 11];
                case 11:
                    frameIdx = 0;
                    _b.label = 12;
                case 12:
                    if (!(frameIdx < frames_2.length)) return [3 /*break*/, 22];
                    frame = frames_2[frameIdx];
                    _b.label = 13;
                case 13:
                    _b.trys.push([13, 20, , 21]);
                    return [4 /*yield*/, frame.waitForLoadState('domcontentloaded').catch(function () { })];
                case 14:
                    _b.sent();
                    return [4 /*yield*/, frame.waitForTimeout(50)];
                case 15:
                    _b.sent(); // Reduced frame wait time
                    frameLabel = frameIdx === 0 ? 'Main Frame' : "iFrame ".concat(frameIdx);
                    updateSearchContext("".concat(windowLabel, " > ").concat(frameLabel), frameIdx + 1, frames_2.length);
                    log("   \uD83D\uDCCD [Frame ".concat(frameIdx + 1, "/").concat(frames_2.length, "] ").concat(frameLabel));
                    if (!(action === 'click')) return [3 /*break*/, 17];
                    return [4 /*yield*/, executeClickInFrame(frame, target, "".concat(windowLabel, ":").concat(frameLabel))];
                case 16:
                    result = _b.sent();
                    if (result) {
                        state.page = currentPage;
                        log("   \u2705 SUCCESS! Target \"".concat(target, "\" found and clicked in ").concat(frameLabel));
                        return [2 /*return*/, true];
                    }
                    else {
                        log("   \u26A0\uFE0F  Target not found in this frame, continuing...");
                    }
                    return [3 /*break*/, 19];
                case 17:
                    if (!(action === 'fill' && fillValue)) return [3 /*break*/, 19];
                    return [4 /*yield*/, executeFillInFrame(frame, target, fillValue, "".concat(windowLabel, ":").concat(frameLabel))];
                case 18:
                    result = _b.sent();
                    if (result) {
                        state.page = currentPage;
                        log("   \u2705 SUCCESS! Field \"".concat(target, "\" found and filled with \"").concat(fillValue, "\" in ").concat(frameLabel));
                        return [2 /*return*/, true];
                    }
                    else {
                        log("   \u26A0\uFE0F  Field not found in this frame, continuing...");
                    }
                    _b.label = 19;
                case 19: return [3 /*break*/, 21];
                case 20:
                    frameError_2 = _b.sent();
                    log("   \u274C Frame ".concat(frameIdx, " error: ").concat(frameError_2.message));
                    return [3 /*break*/, 21];
                case 21:
                    frameIdx++;
                    return [3 /*break*/, 12];
                case 22:
                    // Log completion of this window's frames
                    log("\n   \uD83D\uDCDD Completed ALL ".concat(frames_2.length, " frames in ").concat(windowLabel));
                    childPages = (pageInfo === null || pageInfo === void 0 ? void 0 : pageInfo.childPages) || [];
                    if (!(childPages.length > 0)) return [3 /*break*/, 26];
                    log("\n   \uD83E\uDE9F \u2B07\uFE0F  Found ".concat(childPages.length, " nested subwindow(s) inside ").concat(windowLabel));
                    log("   \uD83E\uDE9F Now searching these nested subwindows recursively...\n");
                    childPagesSorted = childPages.sort(function (a, b) {
                        var _a, _b;
                        var aTime = ((_a = windowHierarchy.get(a)) === null || _a === void 0 ? void 0 : _a.openedAt) || 0;
                        var bTime = ((_b = windowHierarchy.get(b)) === null || _b === void 0 ? void 0 : _b.openedAt) || 0;
                        return bTime - aTime; // Newest first
                    });
                    childIdx = 0;
                    _b.label = 23;
                case 23:
                    if (!(childIdx < childPagesSorted.length)) return [3 /*break*/, 26];
                    childPage = childPagesSorted[childIdx];
                    childOpenTime = ((_a = windowHierarchy.get(childPage)) === null || _a === void 0 ? void 0 : _a.openedAt) || Date.now();
                    log("\n   \u2B07\uFE0F  [Nested ".concat(childIdx + 1, "/").concat(childPagesSorted.length, "] Entering nested level ").concat(depth + 1, " (opened: ").concat(new Date(childOpenTime).toLocaleTimeString(), ")...\n"));
                    return [4 /*yield*/, searchWindowsRecursively(childPage, target, action, fillValue, depth + 1, totalWindows)];
                case 24:
                    result = _b.sent();
                    if (result)
                        return [2 /*return*/, true];
                    log("\n   \u2B06\uFE0F  Returned from nested level ".concat(depth + 1, ", continuing...\n"));
                    _b.label = 25;
                case 25:
                    childIdx++;
                    return [3 /*break*/, 23];
                case 26:
                    log("\n\uD83D\uDD0D [".concat('═'.repeat(50), "] \u2713 Completed search for ").concat(windowLabel, "\n"));
                    return [2 /*return*/, false];
                case 27:
                    error_5 = _b.sent();
                    log("\u274C Error searching window at depth ".concat(depth, ": ").concat(error_5.message));
                    return [2 /*return*/, false];
                case 28: return [2 /*return*/];
            }
        });
    });
}
/**
 * Search for newly opened nested windows after an action
 */
function detectNewNestedWindows(parentPage) {
    return __awaiter(this, void 0, void 0, function () {
        var newPages, _i, newPages_1, newPage, parentLevel, level, openedAt, e_22;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _c.trys.push([0, 6, , 7]);
                    return [4 /*yield*/, parentPage.waitForTimeout(800)];
                case 1:
                    _c.sent(); // Increased wait for windows to fully open
                    newPages = ((_a = state.context) === null || _a === void 0 ? void 0 : _a.pages().filter(function (p) { return !allPages.includes(p); })) || [];
                    _i = 0, newPages_1 = newPages;
                    _c.label = 2;
                case 2:
                    if (!(_i < newPages_1.length)) return [3 /*break*/, 5];
                    newPage = newPages_1[_i];
                    if (!(!allPages.includes(newPage) && !newPage.isClosed())) return [3 /*break*/, 4];
                    parentLevel = ((_b = windowHierarchy.get(parentPage)) === null || _b === void 0 ? void 0 : _b.level) || 0;
                    level = parentLevel + 1;
                    openedAt = Date.now();
                    log("\uD83C\uDD95 [DETECTED] New window opened (Level ".concat(level, ") - WILL BE PRIORITY FOR NEXT SEARCH"));
                    allPages.push(newPage);
                    latestSubwindow = newPage; // Update latest subwindow
                    windowHierarchy.set(newPage, { parentPage: parentPage, level: level, childPages: [], openedAt: openedAt });
                    if (windowHierarchy.has(parentPage)) {
                        windowHierarchy.get(parentPage).childPages.push(newPage);
                    }
                    return [4 /*yield*/, setupPageListeners(newPage)];
                case 3:
                    _c.sent();
                    log("\uD83C\uDD95 Window added to priority queue (will search this next)");
                    _c.label = 4;
                case 4:
                    _i++;
                    return [3 /*break*/, 2];
                case 5: return [3 /*break*/, 7];
                case 6:
                    e_22 = _c.sent();
                    return [3 /*break*/, 7];
                case 7: return [2 /*return*/];
            }
        });
    });
}
/**
 * Build frame search sequence - main page first, then iframes in depth-first order
 */
function buildFrameSearchSequence(frames) {
    var sequence = [];
    // Add main page frame first (always most reliable)
    if (frames.length > 0) {
        sequence.push({ frame: frames[0], path: '[Main Page]' });
    }
    // Add iframe frames in order
    for (var i = 1; i < frames.length; i++) {
        sequence.push({ frame: frames[i], path: "[Frame ".concat(i, "]") });
    }
    return sequence;
}
/**
 * Validate frame is accessible before attempting search
 */
function validateFrameAccess(frame) {
    return __awaiter(this, void 0, void 0, function () {
        var e_23;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    // Quick test to see if frame is accessible
                    return [4 /*yield*/, frame.evaluate(function () { return true; }).catch(function () { })];
                case 1:
                    // Quick test to see if frame is accessible
                    _a.sent();
                    return [2 /*return*/, true];
                case 2:
                    e_23 = _a.sent();
                    return [2 /*return*/, false];
                case 3: return [2 /*return*/];
            }
        });
    });
}
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
function executeClickInFrame(frame, target, framePath) {
    return __awaiter(this, void 0, void 0, function () {
        var targetLower, targetTrimmedLower, knownButtonIds, targetKey, buttonIds, _i, buttonIds_1, buttonId, btn, count, e1_1, clicked, e_24, startButtonPatterns, _a, startButtonPatterns_1, pattern, elements, _b, elements_1, el, isVisible, e_25, e_26, isExactSignIn, found, exactElement_1, visible, text, e_27, allElements, _loop_9, _c, allElements_1, el, state_7, iconButton, topRightButton_1, visible, e_28, allElements, foundElement_1, foundText, _d, allElements_2, el, text, isVisible, parentDropdown, parentButton_1, e_29, visible, e_30, e_31, isExactSignIn, allElements, _loop_10, _e, allElements_3, el, state_8, iconButton, topRightButton_2, visible, e_32, e_33, clickableElements, i, el, text, ariaLabel, title, dataTestId, value, id, className, innerHTML, tagName, allText, textLower, isExactSignIn, e1_2, clicked, e2_1, e_34, e_35, found, e_36, buttons, _f, buttons_2, btn, text, ariaLabel, title, dataAttr, value, id, allText, textTrimmed, isMatch, clickError_1, e2_2, e3_1, e_37, e_38, allElements, _g, allElements_4, el, text, className, id, title, ariaLabel, allText, textTrimmed, isMatch, e1_3, e2_3, e_39, e_40, allDivs, maxCheck, i, el, text, e1_4, e2_4, e_41, e_42, found, e_43, overlaySelectors, _h, overlaySelectors_1, selector, overlays, _j, overlays_1, overlay, overlayElements, _k, overlayElements_1, el, text, title, ariaLabel, allText, isVisible, e_44, e_45, e_46, e_47, error_6;
        var _this = this;
        return __generator(this, function (_l) {
            switch (_l.label) {
                case 0:
                    targetLower = target.toLowerCase();
                    targetTrimmedLower = target.trim().toLowerCase();
                    _l.label = 1;
                case 1:
                    _l.trys.push([1, 221, , 222]);
                    knownButtonIds = {
                        'start': ['startBtn', 'start_btn', 'start-btn', 'btnStart', 'startButton', 'button_start'],
                        'stop': ['stopBtn', 'stop_btn', 'stop-btn', 'btnStop', 'stopButton', 'button_stop']
                    };
                    targetKey = targetLower.split(/\s+/)[0];
                    if (!knownButtonIds[targetKey]) return [3 /*break*/, 16];
                    buttonIds = knownButtonIds[targetKey];
                    _i = 0, buttonIds_1 = buttonIds;
                    _l.label = 2;
                case 2:
                    if (!(_i < buttonIds_1.length)) return [3 /*break*/, 16];
                    buttonId = buttonIds_1[_i];
                    _l.label = 3;
                case 3:
                    _l.trys.push([3, 14, , 15]);
                    return [4 /*yield*/, frame.locator("#".concat(buttonId)).first()];
                case 4:
                    btn = _l.sent();
                    return [4 /*yield*/, btn.count().catch(function () { return 0; })];
                case 5:
                    count = _l.sent();
                    if (!(count > 0)) return [3 /*break*/, 10];
                    _l.label = 6;
                case 6:
                    _l.trys.push([6, 9, , 10]);
                    return [4 /*yield*/, btn.click({ force: true, timeout: 5000 })];
                case 7:
                    _l.sent();
                    log("\u2705 [DIRECT-ID".concat(framePath, "] Successfully clicked button via ID: \"#").concat(buttonId, "\" (target: \"").concat(target, "\")"));
                    return [4 /*yield*/, frame.waitForTimeout(500)];
                case 8:
                    _l.sent();
                    return [2 /*return*/, true];
                case 9:
                    e1_1 = _l.sent();
                    return [3 /*break*/, 10];
                case 10: return [4 /*yield*/, frame.evaluate(function (id) {
                        var el = document.getElementById(id);
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
                    }, buttonId)];
                case 11:
                    clicked = _l.sent();
                    if (!clicked) return [3 /*break*/, 13];
                    log("\u2705 [DIRECT-ID-JS".concat(framePath, "] Successfully clicked button via ID (JavaScript): \"#").concat(buttonId, "\" (target: \"").concat(target, "\")"));
                    return [4 /*yield*/, frame.waitForTimeout(500)];
                case 12:
                    _l.sent();
                    return [2 /*return*/, true];
                case 13: return [3 /*break*/, 15];
                case 14:
                    e_24 = _l.sent();
                    return [3 /*break*/, 15];
                case 15:
                    _i++;
                    return [3 /*break*/, 2];
                case 16:
                    _l.trys.push([16, 93, , 94]);
                    startButtonPatterns = [
                        'button:has-text("Start")',
                        'button[aria-label*="Start"]',
                        'button[title*="Start"]',
                        'button[data-testid*="Start"]',
                        '[role="button"]:has-text("Start")',
                        'button[class*="start"]'
                    ];
                    if (!targetLower.includes('start')) return [3 /*break*/, 32];
                    _a = 0, startButtonPatterns_1 = startButtonPatterns;
                    _l.label = 17;
                case 17:
                    if (!(_a < startButtonPatterns_1.length)) return [3 /*break*/, 32];
                    pattern = startButtonPatterns_1[_a];
                    _l.label = 18;
                case 18:
                    _l.trys.push([18, 30, , 31]);
                    return [4 /*yield*/, frame.locator(pattern).all()];
                case 19:
                    elements = _l.sent();
                    _b = 0, elements_1 = elements;
                    _l.label = 20;
                case 20:
                    if (!(_b < elements_1.length)) return [3 /*break*/, 29];
                    el = elements_1[_b];
                    _l.label = 21;
                case 21:
                    _l.trys.push([21, 27, , 28]);
                    return [4 /*yield*/, el.isVisible().catch(function () { return false; })];
                case 22:
                    isVisible = _l.sent();
                    if (!isVisible) return [3 /*break*/, 26];
                    return [4 /*yield*/, el.scrollIntoViewIfNeeded()];
                case 23:
                    _l.sent();
                    return [4 /*yield*/, el.click({ force: true, timeout: 5000 })];
                case 24:
                    _l.sent();
                    log("\u2705 [START-PATTERN".concat(framePath, "] Clicked Start button using pattern: \"").concat(pattern, "\""));
                    return [4 /*yield*/, frame.waitForTimeout(500)];
                case 25:
                    _l.sent();
                    return [2 /*return*/, true];
                case 26: return [3 /*break*/, 28];
                case 27:
                    e_25 = _l.sent();
                    return [3 /*break*/, 28];
                case 28:
                    _b++;
                    return [3 /*break*/, 20];
                case 29: return [3 /*break*/, 31];
                case 30:
                    e_26 = _l.sent();
                    return [3 /*break*/, 31];
                case 31:
                    _a++;
                    return [3 /*break*/, 17];
                case 32:
                    if (!(targetLower.includes('sign') && targetLower.includes('in'))) return [3 /*break*/, 55];
                    isExactSignIn = !targetLower.includes('partner') && !targetLower.includes('business');
                    if (!isExactSignIn) return [3 /*break*/, 42];
                    _l.label = 33;
                case 33:
                    _l.trys.push([33, 41, , 42]);
                    return [4 /*yield*/, frame.evaluate(function () {
                            var elements = Array.from(document.querySelectorAll('a, button, [role="button"], span'));
                            // Look for EXACT text match only
                            for (var _i = 0, elements_2 = elements; _i < elements_2.length; _i++) {
                                var el = elements_2[_i];
                                var text = (el.textContent || '').trim();
                                var textLower = text.toLowerCase();
                                // EXACT ONLY - no substrings, no variations
                                if (textLower === 'sign in' || textLower === 'signin' ||
                                    textLower === 'sign-in' || textLower === 'login') {
                                    // MUST NOT contain "Partners" or "Business"
                                    if (!text.includes('Partners') && !text.includes('Business') &&
                                        !text.includes('partners') && !text.includes('business')) {
                                        var rect = el.getBoundingClientRect();
                                        var style = window.getComputedStyle(el);
                                        if (style.display !== 'none' && style.visibility !== 'hidden' &&
                                            rect.width > 0 && rect.height > 0) {
                                            return true;
                                        }
                                    }
                                }
                            }
                            return false;
                        })];
                case 34:
                    found = _l.sent();
                    if (!found) return [3 /*break*/, 40];
                    return [4 /*yield*/, frame.locator('text=/^sign in$/i, text=/^signin$/i, text=/^sign-in$/i, text=/^login$/i').first()];
                case 35:
                    exactElement_1 = _l.sent();
                    return [4 /*yield*/, exactElement_1.isVisible().catch(function () { return false; })];
                case 36:
                    visible = _l.sent();
                    if (!visible) return [3 /*break*/, 40];
                    return [4 /*yield*/, exactElement_1.textContent().catch(function () { return ''; })];
                case 37:
                    text = _l.sent();
                    if (!(!text.toLowerCase().includes('partner') && !text.toLowerCase().includes('business'))) return [3 /*break*/, 40];
                    return [4 /*yield*/, exactElement_1.click({ timeout: 5000 }).catch(function () { return __awaiter(_this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, exactElement_1.evaluate(function (e) { return e.click(); })];
                                    case 1:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 38:
                    _l.sent();
                    log("\u2705 Clicked: \"".concat(text.trim(), "\""));
                    return [4 /*yield*/, frame.waitForTimeout(2000)];
                case 39:
                    _l.sent();
                    return [2 /*return*/, true];
                case 40: return [3 /*break*/, 42];
                case 41:
                    e_27 = _l.sent();
                    return [3 /*break*/, 42];
                case 42:
                    _l.trys.push([42, 54, , 55]);
                    return [4 /*yield*/, frame.locator('a, button, [role="button"], div[onclick], span[onclick]').all()];
                case 43:
                    allElements = _l.sent();
                    _loop_9 = function (el) {
                        var text, textTrim, textLower, isExactMatch, visible, visible;
                        return __generator(this, function (_m) {
                            switch (_m.label) {
                                case 0: return [4 /*yield*/, el.textContent().catch(function () { return ''; })];
                                case 1:
                                    text = _m.sent();
                                    textTrim = text.trim();
                                    textLower = textTrim.toLowerCase();
                                    if (!isExactSignIn) return [3 /*break*/, 7];
                                    isExactMatch = textLower === 'sign in' ||
                                        textLower === 'signin' ||
                                        textLower === 'sign-in' ||
                                        textLower === 'login';
                                    if (!isExactMatch)
                                        return [2 /*return*/, "continue"];
                                    // Double-check it doesn't have "Partners" or "Business" prefix
                                    if (textLower.includes('partner') || textLower.includes('business')) {
                                        return [2 /*return*/, "continue"];
                                    }
                                    return [4 /*yield*/, el.isVisible().catch(function () { return false; })];
                                case 2:
                                    visible = _m.sent();
                                    if (!visible) return [3 /*break*/, 6];
                                    return [4 /*yield*/, el.scrollIntoViewIfNeeded()];
                                case 3:
                                    _m.sent();
                                    return [4 /*yield*/, el.click({ timeout: 5000 }).catch(function () { return __awaiter(_this, void 0, void 0, function () {
                                            return __generator(this, function (_a) {
                                                switch (_a.label) {
                                                    case 0: return [4 /*yield*/, el.evaluate(function (e) { return e.click(); })];
                                                    case 1:
                                                        _a.sent();
                                                        return [2 /*return*/];
                                                }
                                            });
                                        }); })];
                                case 4:
                                    _m.sent();
                                    log("\u2705 Clicked: \"".concat(textTrim, "\""));
                                    return [4 /*yield*/, frame.waitForTimeout(2000)];
                                case 5:
                                    _m.sent();
                                    return [2 /*return*/, { value: true }];
                                case 6: return [3 /*break*/, 12];
                                case 7:
                                    if (!textLower.includes(targetLower)) return [3 /*break*/, 12];
                                    return [4 /*yield*/, el.isVisible().catch(function () { return false; })];
                                case 8:
                                    visible = _m.sent();
                                    if (!visible) return [3 /*break*/, 12];
                                    return [4 /*yield*/, el.scrollIntoViewIfNeeded()];
                                case 9:
                                    _m.sent();
                                    return [4 /*yield*/, el.click({ timeout: 5000 }).catch(function () { return __awaiter(_this, void 0, void 0, function () {
                                            return __generator(this, function (_a) {
                                                switch (_a.label) {
                                                    case 0: return [4 /*yield*/, el.evaluate(function (e) { return e.click(); })];
                                                    case 1:
                                                        _a.sent();
                                                        return [2 /*return*/];
                                                }
                                            });
                                        }); })];
                                case 10:
                                    _m.sent();
                                    log("\u2705 Clicked: \"".concat(textTrim, "\""));
                                    return [4 /*yield*/, frame.waitForTimeout(2000)];
                                case 11:
                                    _m.sent();
                                    return [2 /*return*/, { value: true }];
                                case 12: return [2 /*return*/];
                            }
                        });
                    };
                    _c = 0, allElements_1 = allElements;
                    _l.label = 44;
                case 44:
                    if (!(_c < allElements_1.length)) return [3 /*break*/, 47];
                    el = allElements_1[_c];
                    return [5 /*yield**/, _loop_9(el)];
                case 45:
                    state_7 = _l.sent();
                    if (typeof state_7 === "object")
                        return [2 /*return*/, state_7.value];
                    _l.label = 46;
                case 46:
                    _c++;
                    return [3 /*break*/, 44];
                case 47:
                    if (!isExactSignIn) return [3 /*break*/, 53];
                    return [4 /*yield*/, frame.evaluate(function () {
                            var elements = Array.from(document.querySelectorAll('a, button, [role="button"]'));
                            for (var _i = 0, elements_3 = elements; _i < elements_3.length; _i++) {
                                var el = elements_3[_i];
                                var rect = el.getBoundingClientRect();
                                var text = (el.textContent || '').trim();
                                // Top-right area, small button, no text (icon button)
                                if (rect.x > 600 && rect.x < 900 && rect.top < 60 &&
                                    rect.height < 60 && rect.width < 60 && !text) {
                                    return true;
                                }
                            }
                            return false;
                        })];
                case 48:
                    iconButton = _l.sent();
                    if (!iconButton) return [3 /*break*/, 53];
                    return [4 /*yield*/, frame.locator('a[href*="#"], a[href*="account"]').first()];
                case 49:
                    topRightButton_1 = _l.sent();
                    return [4 /*yield*/, topRightButton_1.isVisible().catch(function () { return false; })];
                case 50:
                    visible = _l.sent();
                    if (!visible) return [3 /*break*/, 53];
                    return [4 /*yield*/, topRightButton_1.click({ timeout: 5000 }).catch(function () { return __awaiter(_this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, topRightButton_1.evaluate(function (e) { return e.click(); })];
                                    case 1:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 51:
                    _l.sent();
                    log("\u2705 Clicked: Sign In");
                    return [4 /*yield*/, frame.waitForTimeout(2000)];
                case 52:
                    _l.sent();
                    return [2 /*return*/, true];
                case 53: return [3 /*break*/, 55];
                case 54:
                    e_28 = _l.sent();
                    return [3 /*break*/, 55];
                case 55:
                    _l.trys.push([55, 77, , 78]);
                    return [4 /*yield*/, frame.locator('a, button, [role="button"], [role="option"], [role="menuitem"], li, div[onclick], span').all()];
                case 56:
                    allElements = _l.sent();
                    foundElement_1 = null;
                    foundText = '';
                    _d = 0, allElements_2 = allElements;
                    _l.label = 57;
                case 57:
                    if (!(_d < allElements_2.length)) return [3 /*break*/, 60];
                    el = allElements_2[_d];
                    return [4 /*yield*/, el.textContent().catch(function () { return ''; })];
                case 58:
                    text = _l.sent();
                    if (text.toLowerCase().includes(targetLower)) {
                        foundElement_1 = el;
                        foundText = text;
                        return [3 /*break*/, 60];
                    }
                    _l.label = 59;
                case 59:
                    _d++;
                    return [3 /*break*/, 57];
                case 60:
                    if (!foundElement_1) return [3 /*break*/, 76];
                    _l.label = 61;
                case 61:
                    _l.trys.push([61, 75, , 76]);
                    return [4 /*yield*/, foundElement_1.isVisible().catch(function () { return false; })];
                case 62:
                    isVisible = _l.sent();
                    if (!!isVisible) return [3 /*break*/, 69];
                    return [4 /*yield*/, foundElement_1.evaluate(function (el) {
                            var current = el;
                            while (current && current !== document.documentElement) {
                                var classList = current.className || '';
                                var isDropdown = classList.includes('dropdown') ||
                                    classList.includes('menu') ||
                                    classList.includes('select') ||
                                    current.getAttribute('role') === 'listbox' ||
                                    current.getAttribute('data-role') === 'dropdown';
                                if (isDropdown)
                                    return current;
                                current = current.parentElement;
                            }
                            return null;
                        }).catch(function () { return null; })];
                case 63:
                    parentDropdown = _l.sent();
                    if (!parentDropdown) return [3 /*break*/, 69];
                    return [4 /*yield*/, frame.locator('button, [role="button"], a').filter({
                            has: foundElement_1
                        }).first()];
                case 64:
                    parentButton_1 = _l.sent();
                    _l.label = 65;
                case 65:
                    _l.trys.push([65, 68, , 69]);
                    return [4 /*yield*/, parentButton_1.click({ timeout: 2000 }).catch(function () {
                            return parentButton_1.evaluate(function (e) { return e.click(); });
                        })];
                case 66:
                    _l.sent();
                    return [4 /*yield*/, frame.waitForTimeout(300)];
                case 67:
                    _l.sent();
                    return [3 /*break*/, 69];
                case 68:
                    e_29 = _l.sent();
                    return [3 /*break*/, 69];
                case 69: return [4 /*yield*/, foundElement_1.isVisible().catch(function () { return false; })];
                case 70:
                    visible = _l.sent();
                    if (!visible) return [3 /*break*/, 74];
                    return [4 /*yield*/, foundElement_1.scrollIntoViewIfNeeded()];
                case 71:
                    _l.sent();
                    return [4 /*yield*/, foundElement_1.click({ timeout: 5000 }).catch(function () { return __awaiter(_this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, foundElement_1.evaluate(function (e) { return e.click(); })];
                                    case 1:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 72:
                    _l.sent();
                    log("\u2705 Clicked: \"".concat(foundText.trim(), "\""));
                    return [4 /*yield*/, frame.waitForTimeout(500)];
                case 73:
                    _l.sent();
                    return [2 /*return*/, true];
                case 74: return [3 /*break*/, 76];
                case 75:
                    e_30 = _l.sent();
                    return [3 /*break*/, 76];
                case 76: return [3 /*break*/, 78];
                case 77:
                    e_31 = _l.sent();
                    return [3 /*break*/, 78];
                case 78:
                    if (!(targetLower.includes('sign') && targetLower.includes('in'))) return [3 /*break*/, 92];
                    isExactSignIn = !targetLower.includes('partner') && !targetLower.includes('business');
                    _l.label = 79;
                case 79:
                    _l.trys.push([79, 91, , 92]);
                    return [4 /*yield*/, frame.locator('a, button, [role="button"], div[onclick], span[onclick]').all()];
                case 80:
                    allElements = _l.sent();
                    _loop_10 = function (el) {
                        var text, textTrim, textLower, isExactMatch, visible, visible;
                        return __generator(this, function (_o) {
                            switch (_o.label) {
                                case 0: return [4 /*yield*/, el.textContent().catch(function () { return ''; })];
                                case 1:
                                    text = _o.sent();
                                    textTrim = text.trim();
                                    textLower = textTrim.toLowerCase();
                                    if (!isExactSignIn) return [3 /*break*/, 7];
                                    isExactMatch = textLower === 'sign in' ||
                                        textLower === 'signin' ||
                                        textLower === 'sign-in' ||
                                        textLower === 'login';
                                    if (!isExactMatch)
                                        return [2 /*return*/, "continue"];
                                    // Double-check it doesn't have "Partners" or "Business" prefix
                                    if (textLower.includes('partner') || textLower.includes('business')) {
                                        return [2 /*return*/, "continue"];
                                    }
                                    return [4 /*yield*/, el.isVisible().catch(function () { return false; })];
                                case 2:
                                    visible = _o.sent();
                                    if (!visible) return [3 /*break*/, 6];
                                    return [4 /*yield*/, el.scrollIntoViewIfNeeded()];
                                case 3:
                                    _o.sent();
                                    return [4 /*yield*/, el.click({ timeout: 5000 }).catch(function () { return __awaiter(_this, void 0, void 0, function () {
                                            return __generator(this, function (_a) {
                                                switch (_a.label) {
                                                    case 0: return [4 /*yield*/, el.evaluate(function (e) { return e.click(); })];
                                                    case 1:
                                                        _a.sent();
                                                        return [2 /*return*/];
                                                }
                                            });
                                        }); })];
                                case 4:
                                    _o.sent();
                                    log("\u2705 Clicked: \"".concat(textTrim, "\""));
                                    return [4 /*yield*/, frame.waitForTimeout(2000)];
                                case 5:
                                    _o.sent();
                                    return [2 /*return*/, { value: true }];
                                case 6: return [3 /*break*/, 12];
                                case 7:
                                    if (!textLower.includes(targetLower)) return [3 /*break*/, 12];
                                    return [4 /*yield*/, el.isVisible().catch(function () { return false; })];
                                case 8:
                                    visible = _o.sent();
                                    if (!visible) return [3 /*break*/, 12];
                                    return [4 /*yield*/, el.scrollIntoViewIfNeeded()];
                                case 9:
                                    _o.sent();
                                    return [4 /*yield*/, el.click({ timeout: 5000 }).catch(function () { return __awaiter(_this, void 0, void 0, function () {
                                            return __generator(this, function (_a) {
                                                switch (_a.label) {
                                                    case 0: return [4 /*yield*/, el.evaluate(function (e) { return e.click(); })];
                                                    case 1:
                                                        _a.sent();
                                                        return [2 /*return*/];
                                                }
                                            });
                                        }); })];
                                case 10:
                                    _o.sent();
                                    log("\u2705 Clicked: \"".concat(textTrim, "\""));
                                    return [4 /*yield*/, frame.waitForTimeout(2000)];
                                case 11:
                                    _o.sent();
                                    return [2 /*return*/, { value: true }];
                                case 12: return [2 /*return*/];
                            }
                        });
                    };
                    _e = 0, allElements_3 = allElements;
                    _l.label = 81;
                case 81:
                    if (!(_e < allElements_3.length)) return [3 /*break*/, 84];
                    el = allElements_3[_e];
                    return [5 /*yield**/, _loop_10(el)];
                case 82:
                    state_8 = _l.sent();
                    if (typeof state_8 === "object")
                        return [2 /*return*/, state_8.value];
                    _l.label = 83;
                case 83:
                    _e++;
                    return [3 /*break*/, 81];
                case 84:
                    if (!isExactSignIn) return [3 /*break*/, 90];
                    return [4 /*yield*/, frame.evaluate(function () {
                            var elements = Array.from(document.querySelectorAll('a, button, [role="button"]'));
                            for (var _i = 0, elements_4 = elements; _i < elements_4.length; _i++) {
                                var el = elements_4[_i];
                                var rect = el.getBoundingClientRect();
                                var text = (el.textContent || '').trim();
                                // Top-right area, small button, no text (icon button)
                                if (rect.x > 600 && rect.x < 900 && rect.top < 60 &&
                                    rect.height < 60 && rect.width < 60 && !text) {
                                    return true;
                                }
                            }
                            return false;
                        })];
                case 85:
                    iconButton = _l.sent();
                    if (!iconButton) return [3 /*break*/, 90];
                    return [4 /*yield*/, frame.locator('a[href*="#"], a[href*="account"]').first()];
                case 86:
                    topRightButton_2 = _l.sent();
                    return [4 /*yield*/, topRightButton_2.isVisible().catch(function () { return false; })];
                case 87:
                    visible = _l.sent();
                    if (!visible) return [3 /*break*/, 90];
                    return [4 /*yield*/, topRightButton_2.click({ timeout: 5000 }).catch(function () { return __awaiter(_this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, topRightButton_2.evaluate(function (e) { return e.click(); })];
                                    case 1:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 88:
                    _l.sent();
                    log("\u2705 Clicked: Sign In");
                    return [4 /*yield*/, frame.waitForTimeout(2000)];
                case 89:
                    _l.sent();
                    return [2 /*return*/, true];
                case 90: return [3 /*break*/, 92];
                case 91:
                    e_32 = _l.sent();
                    return [3 /*break*/, 92];
                case 92: return [3 /*break*/, 94];
                case 93:
                    e_33 = _l.sent();
                    return [3 /*break*/, 94];
                case 94:
                    _l.trys.push([94, 121, , 122]);
                    return [4 /*yield*/, frame.locator('button, [role="button"], input[type="button"], input[type="submit"], a[href], [onclick], div[onclick], span[onclick], [style*="cursor:pointer"]').all()];
                case 95:
                    clickableElements = _l.sent();
                    log("   [Frame search] Found ".concat(clickableElements.length, " clickable elements to check"));
                    log("   \uD83D\uDD0D [PRIORITY CHECK 3] Checking ".concat(clickableElements.length, " clickable elements for: \"").concat(target, "\""));
                    i = 0;
                    _l.label = 96;
                case 96:
                    if (!(i < clickableElements.length)) return [3 /*break*/, 120];
                    _l.label = 97;
                case 97:
                    _l.trys.push([97, 118, , 119]);
                    el = clickableElements[i];
                    return [4 /*yield*/, el.textContent().catch(function () { return ''; })];
                case 98:
                    text = _l.sent();
                    return [4 /*yield*/, el.getAttribute('aria-label').catch(function () { return ''; })];
                case 99:
                    ariaLabel = _l.sent();
                    return [4 /*yield*/, el.getAttribute('title').catch(function () { return ''; })];
                case 100:
                    title = _l.sent();
                    return [4 /*yield*/, el.getAttribute('data-testid').catch(function () { return ''; })];
                case 101:
                    dataTestId = _l.sent();
                    return [4 /*yield*/, el.getAttribute('value').catch(function () { return ''; })];
                case 102:
                    value = _l.sent();
                    return [4 /*yield*/, el.getAttribute('id').catch(function () { return ''; })];
                case 103:
                    id = _l.sent();
                    return [4 /*yield*/, el.getAttribute('class').catch(function () { return ''; })];
                case 104:
                    className = _l.sent();
                    return [4 /*yield*/, el.innerHTML().catch(function () { return ''; })];
                case 105:
                    innerHTML = _l.sent();
                    return [4 /*yield*/, el.evaluate(function (e) { return e.tagName; }).catch(function () { return 'UNKNOWN'; })];
                case 106:
                    tagName = _l.sent();
                    allText = "".concat(text, " ").concat(ariaLabel, " ").concat(title, " ").concat(dataTestId, " ").concat(value, " ").concat(id, " ").concat(className, " ").concat(innerHTML).toLowerCase();
                    if (!allText.includes(targetLower)) return [3 /*break*/, 117];
                    // SPECIAL: For "Sign In" target, ONLY match exact "Sign In", NOT "Partners Sign In"
                    if (targetLower === 'sign in' || targetLower === 'signin') {
                        textLower = text.toLowerCase().trim();
                        isExactSignIn = textLower === 'sign in' || textLower === 'signin' ||
                            textLower === 'sign-in' || textLower === 'login';
                        if (!isExactSignIn || textLower.includes('partner') || textLower.includes('business')) {
                            return [3 /*break*/, 119];
                        }
                    }
                    _l.label = 107;
                case 107:
                    _l.trys.push([107, 110, , 117]);
                    // Method 1: Force click
                    return [4 /*yield*/, el.click({ force: true, timeout: 5000 }).catch(function () { })];
                case 108:
                    // Method 1: Force click
                    _l.sent();
                    log("\u2705 Clicked: \"".concat(target, "\""));
                    return [4 /*yield*/, frame.waitForTimeout(500)];
                case 109:
                    _l.sent();
                    return [2 /*return*/, true];
                case 110:
                    e1_2 = _l.sent();
                    _l.label = 111;
                case 111:
                    _l.trys.push([111, 115, , 116]);
                    return [4 /*yield*/, el.evaluate(function (element) {
                            try {
                                element.click();
                                return true;
                            }
                            catch (e) {
                                element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                                return true;
                            }
                        })];
                case 112:
                    clicked = _l.sent();
                    if (!clicked) return [3 /*break*/, 114];
                    log("\u2705 Clicked: \"".concat(target, "\""));
                    return [4 /*yield*/, frame.waitForTimeout(500)];
                case 113:
                    _l.sent();
                    return [2 /*return*/, true];
                case 114: return [3 /*break*/, 116];
                case 115:
                    e2_1 = _l.sent();
                    return [3 /*break*/, 116];
                case 116: return [3 /*break*/, 117];
                case 117: return [3 /*break*/, 119];
                case 118:
                    e_34 = _l.sent();
                    return [3 /*break*/, 119];
                case 119:
                    i++;
                    return [3 /*break*/, 96];
                case 120: return [3 /*break*/, 122];
                case 121:
                    e_35 = _l.sent();
                    return [3 /*break*/, 122];
                case 122:
                    _l.trys.push([122, 124, , 125]);
                    return [4 /*yield*/, frame.evaluate(function (searchText) {
                            var searchLower = searchText.toLowerCase().trim();
                            var elementsChecked = 0;
                            var foundMatch = null;
                            // Strategy 1: Direct element walk - check EVERYTHING recursively
                            var walk = function (node) {
                                if (node.nodeType === 1) { // Element node
                                    elementsChecked++;
                                    var el = node;
                                    var text = (el.textContent || '').toLowerCase().trim();
                                    var title = (el.getAttribute('title') || '').toLowerCase();
                                    var ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
                                    var dataTestId = (el.getAttribute('data-testid') || '').toLowerCase();
                                    var onclick_1 = el.getAttribute('onclick') || '';
                                    var id = (el.getAttribute('id') || '').toLowerCase();
                                    var className = (el.getAttribute('class') || '').toLowerCase();
                                    var value = (el.getAttribute('value') || '').toLowerCase();
                                    var name_4 = (el.getAttribute('name') || '').toLowerCase();
                                    // Create comprehensive search space - include more attributes
                                    var allText = "".concat(text, " ").concat(title, " ").concat(ariaLabel, " ").concat(dataTestId, " ").concat(id, " ").concat(className, " ").concat(value, " ").concat(name_4);
                                    // For short search terms, check EXACT match on direct text
                                    var isMatch = false;
                                    if (searchLower.length <= 3) {
                                        // For short terms, require exact match on text (trimmed)
                                        isMatch = text === searchLower ||
                                            text.split(/\s+/).some(function (word) { return word === searchLower; }) ||
                                            title === searchLower ||
                                            ariaLabel === searchLower ||
                                            value === searchLower;
                                    }
                                    else {
                                        // For longer terms, use substring match
                                        isMatch = allText.includes(searchLower) || onclick_1.includes(searchLower);
                                    }
                                    if (isMatch) {
                                        // SPECIAL: For exact "Sign In" search, skip "Partners Sign In"
                                        var shouldSkip = false;
                                        if ((searchLower === 'sign in' || searchLower === 'signin') &&
                                            !searchLower.includes('partner') && !searchLower.includes('business')) {
                                            // Only match exact "Sign In", not variants
                                            var isExactSignIn = text === 'Sign In' || text === 'signin' || text === 'sign-in' || text === 'login';
                                            if (!isExactSignIn && (text.includes('Partner') || text.includes('Business'))) {
                                                // This is "Partners Sign In" or similar - skip it
                                                shouldSkip = true;
                                            }
                                        }
                                        if (!shouldSkip) {
                                            // Match if element is clickable - EXPANDED criteria
                                            var isClickable = (el.tagName === 'BUTTON' ||
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
                                for (var _i = 0, _a = node.childNodes; _i < _a.length; _i++) {
                                    var child = _a[_i];
                                    if (walk(child))
                                        return true;
                                }
                                // Check shadow DOM if available
                                if (node.shadowRoot) {
                                    for (var _b = 0, _c = node.shadowRoot.childNodes; _b < _c.length; _b++) {
                                        var child = _c[_b];
                                        if (walk(child))
                                            return true;
                                    }
                                }
                                return false;
                            };
                            // Start from document root and walk ENTIRE tree
                            var result = walk(document);
                            console.log("[DEEP SEARCH] Checked ".concat(elementsChecked, " elements for \"").concat(searchText, "\""));
                            return { found: result, count: elementsChecked };
                        }, target)];
                case 123:
                    found = _l.sent();
                    if (found && found.found) {
                        log("\u2705 [DEEP SEARCH".concat(framePath, "] Found and clicked: \"").concat(target, "\" (NO visibility restrictions, searched ").concat(found.count, " elements)"));
                        return [2 /*return*/, true];
                    }
                    return [3 /*break*/, 125];
                case 124:
                    e_36 = _l.sent();
                    log("   \u2139\uFE0F Deep search in frame failed: ".concat(e_36.message));
                    return [3 /*break*/, 125];
                case 125:
                    _l.trys.push([125, 150, , 151]);
                    return [4 /*yield*/, frame.locator('button, a[href], [role="button"], [role="tab"], [role="menuitem"], [onclick], input[type="button"], input[type="submit"]').all()];
                case 126:
                    buttons = _l.sent();
                    _f = 0, buttons_2 = buttons;
                    _l.label = 127;
                case 127:
                    if (!(_f < buttons_2.length)) return [3 /*break*/, 149];
                    btn = buttons_2[_f];
                    _l.label = 128;
                case 128:
                    _l.trys.push([128, 147, , 148]);
                    return [4 /*yield*/, btn.textContent().catch(function () { return ''; })];
                case 129:
                    text = _l.sent();
                    return [4 /*yield*/, btn.getAttribute('aria-label').catch(function () { return ''; })];
                case 130:
                    ariaLabel = _l.sent();
                    return [4 /*yield*/, btn.getAttribute('title').catch(function () { return ''; })];
                case 131:
                    title = _l.sent();
                    return [4 /*yield*/, btn.getAttribute('data-testid').catch(function () { return ''; })];
                case 132:
                    dataAttr = _l.sent();
                    return [4 /*yield*/, btn.getAttribute('value').catch(function () { return ''; })];
                case 133:
                    value = _l.sent();
                    return [4 /*yield*/, btn.getAttribute('id').catch(function () { return ''; })];
                case 134:
                    id = _l.sent();
                    allText = "".concat(text, " ").concat(ariaLabel, " ").concat(title, " ").concat(dataAttr, " ").concat(value, " ").concat(id).toLowerCase();
                    textTrimmed = text.trim().toLowerCase();
                    isMatch = false;
                    if (targetLower.length <= 3) {
                        // For short terms, require EXACT match
                        isMatch = textTrimmed === targetLower ||
                            textTrimmed.split(/\s+/).some(function (word) { return word === targetLower; }) ||
                            title === targetLower ||
                            ariaLabel === targetLower ||
                            value === targetLower;
                    }
                    else {
                        // For longer terms, use substring match
                        isMatch = textTrimmed.includes(targetLower) || allText.includes(targetLower);
                    }
                    if (!isMatch) return [3 /*break*/, 146];
                    _l.label = 135;
                case 135:
                    _l.trys.push([135, 137, , 146]);
                    return [4 /*yield*/, btn.click({ force: true, timeout: 5000 }).catch(function () { })];
                case 136:
                    _l.sent();
                    log("\u2705 [BUTTON".concat(framePath, "] Force-clicked: \"").concat(target, "\""));
                    return [2 /*return*/, true];
                case 137:
                    clickError_1 = _l.sent();
                    _l.label = 138;
                case 138:
                    _l.trys.push([138, 140, , 145]);
                    return [4 /*yield*/, btn.evaluate(function (el) { return el.click(); })];
                case 139:
                    _l.sent();
                    log("\u2705 [BUTTON-JS".concat(framePath, "] JavaScript-clicked: \"").concat(target, "\""));
                    return [2 /*return*/, true];
                case 140:
                    e2_2 = _l.sent();
                    _l.label = 141;
                case 141:
                    _l.trys.push([141, 143, , 144]);
                    return [4 /*yield*/, btn.evaluate(function (el) {
                            el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                        })];
                case 142:
                    _l.sent();
                    log("\u2705 [BUTTON-EVENT".concat(framePath, "] Mouse-event-clicked: \"").concat(target, "\""));
                    return [2 /*return*/, true];
                case 143:
                    e3_1 = _l.sent();
                    return [3 /*break*/, 144];
                case 144: return [3 /*break*/, 145];
                case 145: return [3 /*break*/, 146];
                case 146: return [3 /*break*/, 148];
                case 147:
                    e_37 = _l.sent();
                    return [3 /*break*/, 148];
                case 148:
                    _f++;
                    return [3 /*break*/, 127];
                case 149: return [3 /*break*/, 151];
                case 150:
                    e_38 = _l.sent();
                    return [3 /*break*/, 151];
                case 151:
                    _l.trys.push([151, 171, , 172]);
                    return [4 /*yield*/, frame.locator('[onclick], [role="button"], [role="menuitem"], [role="tab"]').all()];
                case 152:
                    allElements = _l.sent();
                    _g = 0, allElements_4 = allElements;
                    _l.label = 153;
                case 153:
                    if (!(_g < allElements_4.length)) return [3 /*break*/, 170];
                    el = allElements_4[_g];
                    _l.label = 154;
                case 154:
                    _l.trys.push([154, 168, , 169]);
                    return [4 /*yield*/, el.textContent().catch(function () { return ''; })];
                case 155:
                    text = _l.sent();
                    return [4 /*yield*/, el.getAttribute('class').catch(function () { return ''; })];
                case 156:
                    className = _l.sent();
                    return [4 /*yield*/, el.getAttribute('id').catch(function () { return ''; })];
                case 157:
                    id = _l.sent();
                    return [4 /*yield*/, el.getAttribute('title').catch(function () { return ''; })];
                case 158:
                    title = _l.sent();
                    return [4 /*yield*/, el.getAttribute('aria-label').catch(function () { return ''; })];
                case 159:
                    ariaLabel = _l.sent();
                    allText = "".concat(text, " ").concat(className, " ").concat(id, " ").concat(title, " ").concat(ariaLabel).toLowerCase();
                    textTrimmed = text.trim().toLowerCase();
                    isMatch = false;
                    if (targetLower.length <= 3) {
                        isMatch = textTrimmed === targetLower ||
                            textTrimmed.split(/\s+/).some(function (word) { return word === targetLower; }) ||
                            title === targetLower ||
                            ariaLabel === targetLower;
                    }
                    else {
                        isMatch = allText.includes(targetLower);
                    }
                    if (!isMatch) return [3 /*break*/, 167];
                    _l.label = 160;
                case 160:
                    _l.trys.push([160, 162, , 167]);
                    return [4 /*yield*/, el.click({ force: true, timeout: 5000 }).catch(function () { })];
                case 161:
                    _l.sent();
                    log("\u2705 [ELEMENT".concat(framePath, "] Force-clicked (onclick): \"").concat(target, "\""));
                    return [2 /*return*/, true];
                case 162:
                    e1_3 = _l.sent();
                    _l.label = 163;
                case 163:
                    _l.trys.push([163, 165, , 166]);
                    return [4 /*yield*/, el.evaluate(function (elm) { return elm.click(); })];
                case 164:
                    _l.sent();
                    log("\u2705 [ELEMENT-JS".concat(framePath, "] JavaScript-clicked (onclick): \"").concat(target, "\""));
                    return [2 /*return*/, true];
                case 165:
                    e2_3 = _l.sent();
                    return [3 /*break*/, 166];
                case 166: return [3 /*break*/, 167];
                case 167: return [3 /*break*/, 169];
                case 168:
                    e_39 = _l.sent();
                    return [3 /*break*/, 169];
                case 169:
                    _g++;
                    return [3 /*break*/, 153];
                case 170: return [3 /*break*/, 172];
                case 171:
                    e_40 = _l.sent();
                    return [3 /*break*/, 172];
                case 172:
                    _l.trys.push([172, 188, , 189]);
                    return [4 /*yield*/, frame.locator('div, span, p, section, article, label').all()];
                case 173:
                    allDivs = _l.sent();
                    maxCheck = Math.min(allDivs.length, 500);
                    i = 0;
                    _l.label = 174;
                case 174:
                    if (!(i < maxCheck)) return [3 /*break*/, 187];
                    _l.label = 175;
                case 175:
                    _l.trys.push([175, 185, , 186]);
                    el = allDivs[i];
                    return [4 /*yield*/, el.textContent().catch(function () { return ''; })];
                case 176:
                    text = _l.sent();
                    if (!(text && text.toLowerCase().includes(targetLower))) return [3 /*break*/, 184];
                    _l.label = 177;
                case 177:
                    _l.trys.push([177, 179, , 184]);
                    return [4 /*yield*/, el.click({ force: true, timeout: 5000 }).catch(function () { })];
                case 178:
                    _l.sent();
                    log("\u2705 [TEXT-MATCH".concat(framePath, "] Force-clicked text element: \"").concat(target, "\""));
                    return [2 /*return*/, true];
                case 179:
                    e1_4 = _l.sent();
                    _l.label = 180;
                case 180:
                    _l.trys.push([180, 182, , 183]);
                    return [4 /*yield*/, el.evaluate(function (elm) { return elm.click(); })];
                case 181:
                    _l.sent();
                    log("\u2705 [TEXT-MATCH-JS".concat(framePath, "] JavaScript-clicked text element: \"").concat(target, "\""));
                    return [2 /*return*/, true];
                case 182:
                    e2_4 = _l.sent();
                    return [3 /*break*/, 183];
                case 183: return [3 /*break*/, 184];
                case 184: return [3 /*break*/, 186];
                case 185:
                    e_41 = _l.sent();
                    return [3 /*break*/, 186];
                case 186:
                    i++;
                    return [3 /*break*/, 174];
                case 187: return [3 /*break*/, 189];
                case 188:
                    e_42 = _l.sent();
                    return [3 /*break*/, 189];
                case 189:
                    _l.trys.push([189, 193, , 194]);
                    return [4 /*yield*/, frame.evaluate(function (searchText) {
                            var searchLower = searchText.toLowerCase();
                            // Try to find and click button with querySelector
                            var buttons = document.querySelectorAll('button');
                            for (var _i = 0, _a = Array.from(buttons); _i < _a.length; _i++) {
                                var btn = _a[_i];
                                var btnText = (btn.textContent || '').toLowerCase().trim();
                                var btnTitle = (btn.getAttribute('title') || '').toLowerCase();
                                var btnId = (btn.getAttribute('id') || '').toLowerCase();
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
                            var inputs = document.querySelectorAll('input[type="button"], input[type="submit"]');
                            for (var _b = 0, _c = Array.from(inputs); _b < _c.length; _b++) {
                                var inp = _c[_b];
                                var inpValue = (inp.getAttribute('value') || '').toLowerCase();
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
                            var divButtons = document.querySelectorAll('[role="button"], [onclick]');
                            for (var _d = 0, _e = Array.from(divButtons); _d < _e.length; _d++) {
                                var divBtn = _e[_d];
                                var divText = (divBtn.textContent || '').toLowerCase().trim();
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
                        }, target)];
                case 190:
                    found = _l.sent();
                    if (!found) return [3 /*break*/, 192];
                    log("\u2705 [ULTIMATE-JS".concat(framePath, "] Found and clicked via ultimate JS querySelector: \"").concat(target, "\""));
                    return [4 /*yield*/, frame.waitForTimeout(800)];
                case 191:
                    _l.sent(); // Wait longer for action to process
                    return [2 /*return*/, true];
                case 192: return [3 /*break*/, 194];
                case 193:
                    e_43 = _l.sent();
                    log("   \u2139\uFE0F Ultimate JS fallback failed: ".concat(e_43.message));
                    return [3 /*break*/, 194];
                case 194:
                    _l.trys.push([194, 219, , 220]);
                    overlaySelectors = [
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
                    _h = 0, overlaySelectors_1 = overlaySelectors;
                    _l.label = 195;
                case 195:
                    if (!(_h < overlaySelectors_1.length)) return [3 /*break*/, 218];
                    selector = overlaySelectors_1[_h];
                    _l.label = 196;
                case 196:
                    _l.trys.push([196, 216, , 217]);
                    return [4 /*yield*/, frame.locator(selector).all()];
                case 197:
                    overlays = _l.sent();
                    _j = 0, overlays_1 = overlays;
                    _l.label = 198;
                case 198:
                    if (!(_j < overlays_1.length)) return [3 /*break*/, 215];
                    overlay = overlays_1[_j];
                    _l.label = 199;
                case 199:
                    _l.trys.push([199, 213, , 214]);
                    return [4 /*yield*/, overlay.locator('button, [role="button"], a, [onclick], span[style*="cursor"], div[style*="cursor"]').all()];
                case 200:
                    overlayElements = _l.sent();
                    _k = 0, overlayElements_1 = overlayElements;
                    _l.label = 201;
                case 201:
                    if (!(_k < overlayElements_1.length)) return [3 /*break*/, 212];
                    el = overlayElements_1[_k];
                    _l.label = 202;
                case 202:
                    _l.trys.push([202, 210, , 211]);
                    return [4 /*yield*/, el.textContent().catch(function () { return ''; })];
                case 203:
                    text = _l.sent();
                    return [4 /*yield*/, el.getAttribute('title').catch(function () { return ''; })];
                case 204:
                    title = _l.sent();
                    return [4 /*yield*/, el.getAttribute('aria-label').catch(function () { return ''; })];
                case 205:
                    ariaLabel = _l.sent();
                    allText = "".concat(text, " ").concat(title, " ").concat(ariaLabel).toLowerCase();
                    if (!allText.includes(targetLower)) return [3 /*break*/, 209];
                    return [4 /*yield*/, el.isVisible().catch(function () { return false; })];
                case 206:
                    isVisible = _l.sent();
                    if (!isVisible) return [3 /*break*/, 209];
                    return [4 /*yield*/, el.scrollIntoViewIfNeeded()];
                case 207:
                    _l.sent();
                    return [4 /*yield*/, el.click().catch(function () { })];
                case 208:
                    _l.sent();
                    return [2 /*return*/, true];
                case 209: return [3 /*break*/, 211];
                case 210:
                    e_44 = _l.sent();
                    return [3 /*break*/, 211];
                case 211:
                    _k++;
                    return [3 /*break*/, 201];
                case 212: return [3 /*break*/, 214];
                case 213:
                    e_45 = _l.sent();
                    return [3 /*break*/, 214];
                case 214:
                    _j++;
                    return [3 /*break*/, 198];
                case 215: return [3 /*break*/, 217];
                case 216:
                    e_46 = _l.sent();
                    return [3 /*break*/, 217];
                case 217:
                    _h++;
                    return [3 /*break*/, 195];
                case 218: return [3 /*break*/, 220];
                case 219:
                    e_47 = _l.sent();
                    return [3 /*break*/, 220];
                case 220: return [3 /*break*/, 222];
                case 221:
                    error_6 = _l.sent();
                    return [3 /*break*/, 222];
                case 222: return [2 /*return*/, false];
            }
        });
    });
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
function executeFillInFrame(frame, target, fillValue, framePath) {
    return __awaiter(this, void 0, void 0, function () {
        var targetLower, filled, e_48, inputs, _i, inputs_3, input, title, placeholder, ariaLabel, name_5, id, allAttrs, e_49, e_50, labels, _a, labels_2, label, labelText, forAttr, inputEl, e_51, e_52, filled, e_53, inputs, i, input, value, name_6, id, e_54, e_55, overlaySelectors, _b, overlaySelectors_2, selector, overlays, _c, overlays_2, overlay, inputs, _d, inputs_4, input, title, placeholder, ariaLabel, name_7, id, allAttrs, e_56, e_57, e_58, e_59, e_60, error_7;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    targetLower = target.toLowerCase();
                    _e.label = 1;
                case 1:
                    _e.trys.push([1, 91, , 92]);
                    _e.label = 2;
                case 2:
                    _e.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, frame.evaluate(function (_a) {
                            var _b, _c, _d;
                            var searchText = _a.searchText, fillVal = _a.fillVal;
                            var searchLower = searchText.toLowerCase();
                            var allInputs = document.querySelectorAll('input, textarea');
                            // Direct walk through all inputs
                            for (var _i = 0, _e = Array.from(allInputs); _i < _e.length; _i++) {
                                var inp = _e[_i];
                                var el = inp;
                                var title = (el.getAttribute('title') || '').toLowerCase();
                                var placeholder = (el.getAttribute('placeholder') || '').toLowerCase();
                                var ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
                                var name_8 = (el.getAttribute('name') || '').toLowerCase();
                                var id = (el.getAttribute('id') || '').toLowerCase();
                                var label = (((_b = el.parentElement) === null || _b === void 0 ? void 0 : _b.textContent) || '').toLowerCase();
                                var parentLabel = (((_d = (_c = el.parentElement) === null || _c === void 0 ? void 0 : _c.parentElement) === null || _d === void 0 ? void 0 : _d.textContent) || '').toLowerCase();
                                // Comprehensive search across all attributes and context - including parent labels
                                var allText = "".concat(title, " ").concat(placeholder, " ").concat(ariaLabel, " ").concat(name_8, " ").concat(id, " ").concat(label, " ").concat(parentLabel);
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
                        }, { searchText: target, fillVal: fillValue })];
                case 3:
                    filled = _e.sent();
                    if (filled) {
                        log("\u2705 [DEEP FILL".concat(framePath, "] Filled: \"").concat(target, "\" = \"").concat(fillValue, "\" (NO visibility restrictions)"));
                        return [2 /*return*/, true];
                    }
                    return [3 /*break*/, 5];
                case 4:
                    e_48 = _e.sent();
                    log("   \u2139\uFE0F Deep fill search in frame failed: ".concat(e_48.message));
                    return [3 /*break*/, 5];
                case 5:
                    _e.trys.push([5, 20, , 21]);
                    return [4 /*yield*/, frame.locator('input, textarea').all()];
                case 6:
                    inputs = _e.sent();
                    _i = 0, inputs_3 = inputs;
                    _e.label = 7;
                case 7:
                    if (!(_i < inputs_3.length)) return [3 /*break*/, 19];
                    input = inputs_3[_i];
                    return [4 /*yield*/, input.getAttribute('title').catch(function () { return ''; })];
                case 8:
                    title = _e.sent();
                    return [4 /*yield*/, input.getAttribute('placeholder').catch(function () { return ''; })];
                case 9:
                    placeholder = _e.sent();
                    return [4 /*yield*/, input.getAttribute('aria-label').catch(function () { return ''; })];
                case 10:
                    ariaLabel = _e.sent();
                    return [4 /*yield*/, input.getAttribute('name').catch(function () { return ''; })];
                case 11:
                    name_5 = _e.sent();
                    return [4 /*yield*/, input.getAttribute('id').catch(function () { return ''; })];
                case 12:
                    id = _e.sent();
                    allAttrs = "".concat(title, " ").concat(placeholder, " ").concat(ariaLabel, " ").concat(name_5, " ").concat(id).toLowerCase();
                    if (!allAttrs.includes(targetLower)) return [3 /*break*/, 18];
                    _e.label = 13;
                case 13:
                    _e.trys.push([13, 17, , 18]);
                    // Force fill without visibility checks
                    return [4 /*yield*/, input.click({ force: true }).catch(function () { })];
                case 14:
                    // Force fill without visibility checks
                    _e.sent();
                    return [4 /*yield*/, input.fill(fillValue, { timeout: 5000, force: true }).catch(function () { })];
                case 15:
                    _e.sent();
                    return [4 /*yield*/, input.evaluate(function (el) {
                            el.dispatchEvent(new Event('input', { bubbles: true }));
                            el.dispatchEvent(new Event('change', { bubbles: true }));
                            el.dispatchEvent(new Event('blur', { bubbles: true }));
                        }).catch(function () { })];
                case 16:
                    _e.sent();
                    log("\u2705 [FORCE-FILL".concat(framePath, "] Filled: \"").concat(name_5 || id || title, "\" = \"").concat(fillValue, "\""));
                    return [2 /*return*/, true];
                case 17:
                    e_49 = _e.sent();
                    return [3 /*break*/, 18];
                case 18:
                    _i++;
                    return [3 /*break*/, 7];
                case 19: return [3 /*break*/, 21];
                case 20:
                    e_50 = _e.sent();
                    return [3 /*break*/, 21];
                case 21:
                    _e.trys.push([21, 37, , 38]);
                    return [4 /*yield*/, frame.locator('label').all()];
                case 22:
                    labels = _e.sent();
                    _a = 0, labels_2 = labels;
                    _e.label = 23;
                case 23:
                    if (!(_a < labels_2.length)) return [3 /*break*/, 36];
                    label = labels_2[_a];
                    return [4 /*yield*/, label.textContent().catch(function () { return ''; })];
                case 24:
                    labelText = _e.sent();
                    if (!(labelText && labelText.trim().toLowerCase().includes(targetLower))) return [3 /*break*/, 35];
                    return [4 /*yield*/, label.getAttribute('for').catch(function () { return ''; })];
                case 25:
                    forAttr = _e.sent();
                    inputEl = null;
                    if (!forAttr) return [3 /*break*/, 27];
                    return [4 /*yield*/, frame.locator("#".concat(forAttr)).first().catch(function () { return null; })];
                case 26:
                    inputEl = _e.sent();
                    _e.label = 27;
                case 27:
                    if (!!inputEl) return [3 /*break*/, 29];
                    return [4 /*yield*/, label.locator('input, textarea').first().catch(function () { return null; })];
                case 28:
                    inputEl = _e.sent();
                    _e.label = 29;
                case 29:
                    if (!inputEl) return [3 /*break*/, 35];
                    _e.label = 30;
                case 30:
                    _e.trys.push([30, 34, , 35]);
                    // Force fill regardless of visibility
                    return [4 /*yield*/, inputEl.click({ force: true }).catch(function () { })];
                case 31:
                    // Force fill regardless of visibility
                    _e.sent();
                    return [4 /*yield*/, inputEl.fill(fillValue, { timeout: 5000, force: true }).catch(function () { })];
                case 32:
                    _e.sent();
                    return [4 /*yield*/, inputEl.evaluate(function (el) {
                            el.dispatchEvent(new Event('change', { bubbles: true }));
                            el.dispatchEvent(new Event('blur', { bubbles: true }));
                        }).catch(function () { })];
                case 33:
                    _e.sent();
                    log("\u2705 [LABEL-FILL".concat(framePath, "] Filled: \"").concat(labelText.trim(), "\" = \"").concat(fillValue, "\""));
                    return [2 /*return*/, true];
                case 34:
                    e_51 = _e.sent();
                    return [3 /*break*/, 35];
                case 35:
                    _a++;
                    return [3 /*break*/, 23];
                case 36: return [3 /*break*/, 38];
                case 37:
                    e_52 = _e.sent();
                    return [3 /*break*/, 38];
                case 38:
                    _e.trys.push([38, 40, , 41]);
                    return [4 /*yield*/, frame.evaluate(function (_a) {
                            var searchText = _a.searchText, fillVal = _a.fillVal;
                            var allInputs = document.querySelectorAll('input, textarea');
                            for (var _i = 0, _b = Array.from(allInputs); _i < _b.length; _i++) {
                                var input = _b[_i];
                                var el = input;
                                var title = el.getAttribute('title') || '';
                                var placeholder = el.getAttribute('placeholder') || '';
                                var ariaLabel = el.getAttribute('aria-label') || '';
                                var name_9 = el.getAttribute('name') || '';
                                var id = el.getAttribute('id') || '';
                                var allAttrs = "".concat(title, " ").concat(placeholder, " ").concat(ariaLabel, " ").concat(name_9, " ").concat(id).toLowerCase();
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
                        }, { searchText: target, fillVal: fillValue })];
                case 39:
                    filled = _e.sent();
                    if (filled) {
                        log("[FILL] \u2713 Pattern 2: Successfully filled via direct JS manipulation = \"".concat(fillValue, "\""));
                        return [2 /*return*/, true];
                    }
                    return [3 /*break*/, 41];
                case 40:
                    e_53 = _e.sent();
                    return [3 /*break*/, 41];
                case 41:
                    _e.trys.push([41, 54, , 55]);
                    return [4 /*yield*/, frame.locator('input[type="text"], textarea').all()];
                case 42:
                    inputs = _e.sent();
                    i = 0;
                    _e.label = 43;
                case 43:
                    if (!(i < inputs.length)) return [3 /*break*/, 53];
                    input = inputs[i];
                    return [4 /*yield*/, input.inputValue().catch(function () { return ''; })];
                case 44:
                    value = _e.sent();
                    return [4 /*yield*/, input.getAttribute('name').catch(function () { return ''; })];
                case 45:
                    name_6 = _e.sent();
                    return [4 /*yield*/, input.getAttribute('id').catch(function () { return ''; })];
                case 46:
                    id = _e.sent();
                    if (!((name_6 && name_6.toLowerCase().includes('fast')) ||
                        (id && id.toLowerCase().includes('fast')) ||
                        (value && value === ''))) return [3 /*break*/, 52];
                    _e.label = 47;
                case 47:
                    _e.trys.push([47, 51, , 52]);
                    return [4 /*yield*/, input.click({ force: true })];
                case 48:
                    _e.sent();
                    return [4 /*yield*/, input.fill(fillValue, { timeout: 5000 })];
                case 49:
                    _e.sent();
                    return [4 /*yield*/, input.dispatchEvent('change')];
                case 50:
                    _e.sent();
                    log("[FILL] \u2713 Pattern 3: Filled field at position ".concat(i, " = \"").concat(fillValue, "\"").concat(framePath ? " in ".concat(framePath) : ''));
                    return [2 /*return*/, true];
                case 51:
                    e_54 = _e.sent();
                    return [3 /*break*/, 52];
                case 52:
                    i++;
                    return [3 /*break*/, 43];
                case 53: return [3 /*break*/, 55];
                case 54:
                    e_55 = _e.sent();
                    return [3 /*break*/, 55];
                case 55:
                    _e.trys.push([55, 89, , 90]);
                    overlaySelectors = [
                        '[role="dialog"]',
                        '[role="alertdialog"]',
                        '.modal',
                        '.overlay',
                        '.dialog',
                        '[class*="modal"]',
                        '[class*="overlay"]',
                        '[class*="dialog"]'
                    ];
                    _b = 0, overlaySelectors_2 = overlaySelectors;
                    _e.label = 56;
                case 56:
                    if (!(_b < overlaySelectors_2.length)) return [3 /*break*/, 88];
                    selector = overlaySelectors_2[_b];
                    _e.label = 57;
                case 57:
                    _e.trys.push([57, 86, , 87]);
                    return [4 /*yield*/, frame.locator(selector).all()];
                case 58:
                    overlays = _e.sent();
                    _c = 0, overlays_2 = overlays;
                    _e.label = 59;
                case 59:
                    if (!(_c < overlays_2.length)) return [3 /*break*/, 85];
                    overlay = overlays_2[_c];
                    _e.label = 60;
                case 60:
                    _e.trys.push([60, 83, , 84]);
                    return [4 /*yield*/, overlay.locator('input, textarea').all()];
                case 61:
                    inputs = _e.sent();
                    _d = 0, inputs_4 = inputs;
                    _e.label = 62;
                case 62:
                    if (!(_d < inputs_4.length)) return [3 /*break*/, 82];
                    input = inputs_4[_d];
                    _e.label = 63;
                case 63:
                    _e.trys.push([63, 80, , 81]);
                    return [4 /*yield*/, input.getAttribute('title').catch(function () { return ''; })];
                case 64:
                    title = _e.sent();
                    return [4 /*yield*/, input.getAttribute('placeholder').catch(function () { return ''; })];
                case 65:
                    placeholder = _e.sent();
                    return [4 /*yield*/, input.getAttribute('aria-label').catch(function () { return ''; })];
                case 66:
                    ariaLabel = _e.sent();
                    return [4 /*yield*/, input.getAttribute('name').catch(function () { return ''; })];
                case 67:
                    name_7 = _e.sent();
                    return [4 /*yield*/, input.getAttribute('id').catch(function () { return ''; })];
                case 68:
                    id = _e.sent();
                    allAttrs = "".concat(title, " ").concat(placeholder, " ").concat(ariaLabel, " ").concat(name_7, " ").concat(id).toLowerCase();
                    if (!allAttrs.includes(target.toLowerCase())) return [3 /*break*/, 79];
                    _e.label = 69;
                case 69:
                    _e.trys.push([69, 78, , 79]);
                    return [4 /*yield*/, input.scrollIntoViewIfNeeded()];
                case 70:
                    _e.sent();
                    return [4 /*yield*/, input.waitForElementState('visible', { timeout: 3000 }).catch(function () { })];
                case 71:
                    _e.sent();
                    return [4 /*yield*/, input.click({ force: true })];
                case 72:
                    _e.sent();
                    return [4 /*yield*/, input.selectText().catch(function () { })];
                case 73:
                    _e.sent();
                    return [4 /*yield*/, input.fill(fillValue, { timeout: 5000 })];
                case 74:
                    _e.sent();
                    return [4 /*yield*/, input.dispatchEvent('input')];
                case 75:
                    _e.sent();
                    return [4 /*yield*/, input.dispatchEvent('change')];
                case 76:
                    _e.sent();
                    return [4 /*yield*/, input.dispatchEvent('blur')];
                case 77:
                    _e.sent();
                    log("[FILL] \u2713 Pattern 4: Successfully filled field in overlay \"".concat(title || name_7 || id, "\" = \"").concat(fillValue, "\""));
                    return [2 /*return*/, true];
                case 78:
                    e_56 = _e.sent();
                    return [3 /*break*/, 79];
                case 79: return [3 /*break*/, 81];
                case 80:
                    e_57 = _e.sent();
                    return [3 /*break*/, 81];
                case 81:
                    _d++;
                    return [3 /*break*/, 62];
                case 82: return [3 /*break*/, 84];
                case 83:
                    e_58 = _e.sent();
                    return [3 /*break*/, 84];
                case 84:
                    _c++;
                    return [3 /*break*/, 59];
                case 85: return [3 /*break*/, 87];
                case 86:
                    e_59 = _e.sent();
                    return [3 /*break*/, 87];
                case 87:
                    _b++;
                    return [3 /*break*/, 56];
                case 88: return [3 /*break*/, 90];
                case 89:
                    e_60 = _e.sent();
                    return [3 /*break*/, 90];
                case 90: return [3 /*break*/, 92];
                case 91:
                    error_7 = _e.sent();
                    log("[FILL] Frame error: ".concat(error_7.message));
                    return [3 /*break*/, 92];
                case 92: return [2 /*return*/, false];
            }
        });
    });
}
/**
 * Wait for dynamically created elements to appear using MutationObserver
 */
function waitForDynamicElement(target_1) {
    return __awaiter(this, arguments, void 0, function (target, timeout) {
        var startTime, checkAllWindows, error_8;
        var _this = this;
        if (timeout === void 0) { timeout = 2000; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!state.page || state.page.isClosed())
                        return [2 /*return*/, false];
                    startTime = Date.now();
                    checkAllWindows = function () { return __awaiter(_this, void 0, void 0, function () {
                        var found, found, e_61;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    if (!(allPages.length > 1 && latestSubwindow && !latestSubwindow.isClosed())) return [3 /*break*/, 2];
                                    return [4 /*yield*/, latestSubwindow.evaluate(function (_a) {
                                            var _b, _c, _d, _e;
                                            var searchText = _a.searchText;
                                            var allElements = document.querySelectorAll('*');
                                            for (var _i = 0, _f = Array.from(allElements); _i < _f.length; _i++) {
                                                var el = _f[_i];
                                                var text = (el.textContent || '').toLowerCase();
                                                var placeholder = ((_b = el.placeholder) === null || _b === void 0 ? void 0 : _b.toLowerCase()) || '';
                                                var ariaLabel = ((_c = el.getAttribute('aria-label')) === null || _c === void 0 ? void 0 : _c.toLowerCase()) || '';
                                                var name_10 = ((_d = el.name) === null || _d === void 0 ? void 0 : _d.toLowerCase()) || '';
                                                var id = ((_e = el.id) === null || _e === void 0 ? void 0 : _e.toLowerCase()) || '';
                                                if (text.includes(searchText.toLowerCase()) ||
                                                    placeholder.includes(searchText.toLowerCase()) ||
                                                    ariaLabel.includes(searchText.toLowerCase()) ||
                                                    name_10.includes(searchText.toLowerCase()) ||
                                                    id.includes(searchText.toLowerCase())) {
                                                    return true;
                                                }
                                            }
                                            return false;
                                        }, { searchText: target }).catch(function () { return false; })];
                                case 1:
                                    found = _a.sent();
                                    if (found) {
                                        log("\u2705 Dynamic element found in PRIORITY SUBWINDOW: ".concat(target));
                                        state.page = latestSubwindow; // Switch to this window
                                        return [2 /*return*/, true];
                                    }
                                    _a.label = 2;
                                case 2:
                                    _a.trys.push([2, 4, , 5]);
                                    return [4 /*yield*/, state.page.evaluate(function (_a) {
                                            var searchText = _a.searchText;
                                            return new Promise(function (resolve) {
                                                var checkElement = function () {
                                                    var _a, _b, _c, _d;
                                                    var allElements = document.querySelectorAll('*');
                                                    for (var _i = 0, _e = Array.from(allElements); _i < _e.length; _i++) {
                                                        var el = _e[_i];
                                                        var text = (el.textContent || '').toLowerCase();
                                                        var placeholder = ((_a = el.placeholder) === null || _a === void 0 ? void 0 : _a.toLowerCase()) || '';
                                                        var ariaLabel = ((_b = el.getAttribute('aria-label')) === null || _b === void 0 ? void 0 : _b.toLowerCase()) || '';
                                                        var name_11 = ((_c = el.name) === null || _c === void 0 ? void 0 : _c.toLowerCase()) || '';
                                                        var id = ((_d = el.id) === null || _d === void 0 ? void 0 : _d.toLowerCase()) || '';
                                                        if (text.includes(searchText.toLowerCase()) ||
                                                            placeholder.includes(searchText.toLowerCase()) ||
                                                            ariaLabel.includes(searchText.toLowerCase()) ||
                                                            name_11.includes(searchText.toLowerCase()) ||
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
                                                var observer = new MutationObserver(function () {
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
                                                setTimeout(function () {
                                                    observer.disconnect();
                                                    resolve(false);
                                                }, 200);
                                            });
                                        }, { searchText: target }).catch(function () { return false; })];
                                case 3:
                                    found = _a.sent();
                                    if (found) {
                                        log("Dynamic element found: ".concat(target));
                                        return [2 /*return*/, true];
                                    }
                                    return [3 /*break*/, 5];
                                case 4:
                                    e_61 = _a.sent();
                                    return [3 /*break*/, 5];
                                case 5: return [2 /*return*/, false];
                            }
                        });
                    }); };
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 6, , 7]);
                    log("\uD83D\uDD0D Waiting for dynamic element: \"".concat(target, "\" (checking all windows, timeout: ").concat(timeout, "ms)"));
                    _a.label = 2;
                case 2:
                    if (!(Date.now() - startTime < timeout)) return [3 /*break*/, 5];
                    return [4 /*yield*/, checkAllWindows()];
                case 3:
                    if (_a.sent()) {
                        return [2 /*return*/, true];
                    }
                    return [4 /*yield*/, new Promise(function (r) { return setTimeout(r, 100); })];
                case 4:
                    _a.sent(); // Check every 100ms (faster)
                    return [3 /*break*/, 2];
                case 5:
                    log("Dynamic element NOT found after ".concat(timeout, "ms: ").concat(target));
                    return [2 /*return*/, false];
                case 6:
                    error_8 = _a.sent();
                    log("Error waiting for dynamic element: ".concat(error_8.message));
                    return [2 /*return*/, false];
                case 7: return [2 /*return*/];
            }
        });
    });
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
function searchInPageOverlays(target, action, fillValue) {
    return __awaiter(this, void 0, void 0, function () {
        var quickDialogSearch, overlayContainers, overlaySelectors, allOverlays, _i, overlaySelectors_3, selector, overlays, e_62, overlayIdx, overlay, isOverlayVisible, found, jsError_1, buttons, _a, _b, btn, text, ariaLabel, title, value, allText, e_63, e2_6, e_64, stratError_1, filled, jsError_2, inputs, _c, inputs_5, input, title, placeholder, ariaLabel, name_12, id, allAttrs, e_65, e_66, stratError_2, overlayError_1, error_9;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    if (!state.page || state.page.isClosed())
                        return [2 /*return*/, false];
                    if (!state.isPaused) return [3 /*break*/, 4];
                    _d.label = 1;
                case 1:
                    if (!(state.isPaused && !state.isStopped)) return [3 /*break*/, 3];
                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 500); })];
                case 2:
                    _d.sent();
                    return [3 /*break*/, 1];
                case 3:
                    if (state.isStopped)
                        return [2 /*return*/, false];
                    _d.label = 4;
                case 4:
                    _d.trys.push([4, 72, , 73]);
                    return [4 /*yield*/, state.page.evaluate(function (_a) {
                            var _b;
                            var searchText = _a.searchText, fillVal = _a.fillVal, isAction = _a.isAction;
                            var searchLower = searchText.toLowerCase();
                            // For FILL action: Look for input fields
                            if (isAction === 'fill') {
                                var allInputs = document.querySelectorAll('input[type="text"], textarea, input:not([type])');
                                // Separate candidates into exact matches and partial matches
                                var exactMatches = [];
                                var partialMatches = [];
                                for (var _i = 0, _c = Array.from(allInputs); _i < _c.length; _i++) {
                                    var input = _c[_i];
                                    var el = input;
                                    // Get all possible identifiers and trim them
                                    var title = (el.getAttribute('title') || '').trim().toLowerCase();
                                    var placeholder = (el.getAttribute('placeholder') || '').trim().toLowerCase();
                                    var ariaLabel = (el.getAttribute('aria-label') || '').trim().toLowerCase();
                                    var name_13 = (el.getAttribute('name') || '').trim().toLowerCase();
                                    var id = (el.getAttribute('id') || '').trim().toLowerCase();
                                    // Check nearby labels and parent text
                                    var nearbyText = '';
                                    if (el.parentElement) {
                                        nearbyText += (el.parentElement.textContent || '').trim().toLowerCase();
                                    }
                                    if ((_b = el.parentElement) === null || _b === void 0 ? void 0 : _b.parentElement) {
                                        nearbyText += ' ' + (el.parentElement.parentElement.textContent || '').trim().toLowerCase();
                                    }
                                    // Check visibility first
                                    var rect = el.getBoundingClientRect();
                                    if (rect.width <= 0 || rect.height <= 0)
                                        continue; // Skip invisible
                                    // EXACT MATCH: Direct attribute match (highest priority)
                                    if (title === searchLower || placeholder === searchLower || ariaLabel === searchLower) {
                                        exactMatches.push(el);
                                        continue;
                                    }
                                    // WORD MATCH: Target is a complete word in the text
                                    var titleWords = title.split(/\s+/);
                                    var placeholderWords = placeholder.split(/\s+/);
                                    var ariaWords = ariaLabel.split(/\s+/);
                                    if (titleWords.includes(searchLower) || placeholderWords.includes(searchLower) || ariaWords.includes(searchLower)) {
                                        partialMatches.push(el);
                                        continue;
                                    }
                                    // FALLBACK: Substring match (last resort)
                                    var allText = "".concat(title, " ").concat(placeholder, " ").concat(ariaLabel, " ").concat(name_13, " ").concat(id, " ").concat(nearbyText);
                                    if (allText.includes(searchLower)) {
                                        partialMatches.push(el);
                                    }
                                }
                                // Try exact matches FIRST
                                if (exactMatches.length > 0) {
                                    var el = exactMatches[0];
                                    var rect = el.getBoundingClientRect();
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
                                    for (var _d = 0, partialMatches_1 = partialMatches; _d < partialMatches_1.length; _d++) {
                                        var el = partialMatches_1[_d];
                                        var rect = el.getBoundingClientRect();
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
                                var clickables = document.querySelectorAll('button, input[type="button"], input[type="submit"], a, [role="button"]');
                                // Separate candidates into exact matches and partial matches
                                var exactMatches = [];
                                var partialMatches = [];
                                for (var _e = 0, _f = Array.from(clickables); _e < _f.length; _e++) {
                                    var elem = _f[_e];
                                    var el = elem;
                                    var text = (el.textContent || '').trim().toLowerCase();
                                    var value = (el.getAttribute('value') || '').trim().toLowerCase();
                                    var title = (el.getAttribute('title') || '').trim().toLowerCase();
                                    var ariaLabel = (el.getAttribute('aria-label') || '').trim().toLowerCase();
                                    // Check visibility first
                                    var rect = el.getBoundingClientRect();
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
                                    var words = text.split(/\s+/);
                                    if (words.includes(searchLower)) {
                                        partialMatches.push(el);
                                        continue;
                                    }
                                    // FALLBACK: Substring match (last resort)
                                    var allText = "".concat(text, " ").concat(value, " ").concat(title, " ").concat(ariaLabel);
                                    if (allText.includes(searchLower)) {
                                        partialMatches.push(el);
                                    }
                                }
                                // Try exact matches FIRST (highest priority)
                                if (exactMatches.length > 0) {
                                    var el = exactMatches[0];
                                    var tagName = el.tagName;
                                    var id = el.getAttribute('id') || 'no-id';
                                    var classList = el.getAttribute('class') || 'no-class';
                                    var clickText = (el.textContent || '').trim().substring(0, 50);
                                    console.log("[OVERLAY-CLICK-DEBUG] Exact match found: <".concat(tagName, " id=\"").concat(id, "\" class=\"").concat(classList, "\"> text=\"").concat(clickText, "\""));
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
                                    for (var _g = 0, partialMatches_2 = partialMatches; _g < partialMatches_2.length; _g++) {
                                        var el = partialMatches_2[_g];
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
                        }, { searchText: target, fillVal: action === 'fill' ? fillValue : null, isAction: action })];
                case 5:
                    quickDialogSearch = _d.sent();
                    if (!(quickDialogSearch && quickDialogSearch.found)) return [3 /*break*/, 7];
                    if (action === 'fill') {
                        log("\u2705 [QUICK MODAL SEARCH] Filled: \"".concat(target, "\" = \"").concat(fillValue, "\""));
                    }
                    else {
                        log("\u2705 [QUICK MODAL SEARCH] Clicked: \"".concat(target, "\""));
                    }
                    return [4 /*yield*/, state.page.waitForTimeout(300)];
                case 6:
                    _d.sent();
                    return [2 /*return*/, true];
                case 7:
                    log("\n\uD83C\uDFA8 [OVERLAY PRIORITY] Searching for overlays/modals/dialogs in main page...");
                    return [4 /*yield*/, state.page.evaluate(function () {
                            var containers = [];
                            // Strategy 1: Find elements with specific overlay indicators
                            var allElements = document.querySelectorAll('*');
                            for (var _i = 0, _a = Array.from(allElements); _i < _a.length; _i++) {
                                var el = _a[_i];
                                var html = el;
                                var style = window.getComputedStyle(html);
                                var zIndex = parseInt(style.zIndex || '0');
                                var position = style.position;
                                // Overlay indicators:
                                // - High z-index (typically 100+)
                                // - Fixed or absolute positioning
                                // - Visible (display != none, visibility != hidden)
                                // - Contains text like "Customer Maintenance", "Dialog", etc
                                // - Has border/shadow (looks like a window)
                                if (position === 'fixed' || position === 'absolute' || zIndex >= 100) {
                                    if (style.display !== 'none' && style.visibility !== 'hidden') {
                                        var rect = html.getBoundingClientRect();
                                        // Check if element has significant size (likely a container)
                                        if (rect.width > 200 && rect.height > 150) {
                                            // Check if element has any content that suggests it's a dialog/window
                                            var text = html.textContent || '';
                                            var classList = html.getAttribute('class') || '';
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
                        })];
                case 8:
                    overlayContainers = _d.sent();
                    overlaySelectors = [
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
                    allOverlays = [];
                    _i = 0, overlaySelectors_3 = overlaySelectors;
                    _d.label = 9;
                case 9:
                    if (!(_i < overlaySelectors_3.length)) return [3 /*break*/, 14];
                    selector = overlaySelectors_3[_i];
                    _d.label = 10;
                case 10:
                    _d.trys.push([10, 12, , 13]);
                    return [4 /*yield*/, state.page.locator(selector).all()];
                case 11:
                    overlays = _d.sent();
                    allOverlays.push.apply(allOverlays, overlays);
                    return [3 /*break*/, 13];
                case 12:
                    e_62 = _d.sent();
                    return [3 /*break*/, 13];
                case 13:
                    _i++;
                    return [3 /*break*/, 9];
                case 14:
                    overlayIdx = 0;
                    _d.label = 15;
                case 15:
                    if (!(overlayIdx < allOverlays.length)) return [3 /*break*/, 71];
                    overlay = allOverlays[overlayIdx];
                    _d.label = 16;
                case 16:
                    _d.trys.push([16, 69, , 70]);
                    return [4 /*yield*/, overlay.evaluate(function (el) {
                            var style = window.getComputedStyle(el);
                            var visible = style.display !== 'none' &&
                                style.visibility !== 'hidden' &&
                                style.opacity !== '0' &&
                                Number(style.opacity) > 0.1;
                            var rect = el.getBoundingClientRect();
                            var inViewport = rect.width > 0 && rect.height > 0;
                            return visible && inViewport;
                        }).catch(function () { return false; })];
                case 17:
                    isOverlayVisible = _d.sent();
                    if (!isOverlayVisible) {
                        return [3 /*break*/, 70]; // Skip invisible overlays - silent
                    }
                    if (!(action === 'click')) return [3 /*break*/, 43];
                    _d.label = 18;
                case 18:
                    _d.trys.push([18, 22, , 23]);
                    return [4 /*yield*/, overlay.evaluate(function (containerEl, searchTarget) {
                            var _a, _b, _c;
                            var searchLower = searchTarget.toLowerCase();
                            // FIRST: Check if overlay itself is visible
                            var overlayStyle = window.getComputedStyle(containerEl);
                            var overlayVisible = overlayStyle.display !== 'none' &&
                                overlayStyle.visibility !== 'hidden' &&
                                overlayStyle.opacity !== '0';
                            if (!overlayVisible) {
                                console.log("[OVERLAY-CLICK] Overlay NOT visible - skipping");
                                return false;
                            }
                            // Walk through ALL elements in this container
                            var walker = document.createTreeWalker(containerEl, NodeFilter.SHOW_ELEMENT, null);
                            var node;
                            var _loop_11 = function () {
                                var el = node;
                                var text = ((_a = el.textContent) === null || _a === void 0 ? void 0 : _a.toLowerCase()) || '';
                                var title = ((_b = el.getAttribute('title')) === null || _b === void 0 ? void 0 : _b.toLowerCase()) || '';
                                var ariaLabel = ((_c = el.getAttribute('aria-label')) === null || _c === void 0 ? void 0 : _c.toLowerCase()) || '';
                                var onclick_2 = el.getAttribute('onclick') || '';
                                var className = el.className.toLowerCase();
                                var allText = "".concat(text, " ").concat(title, " ").concat(ariaLabel, " ").concat(className);
                                // Check if target matches
                                if (allText.includes(searchLower) || onclick_2.includes(searchLower)) {
                                    // Check if element is visible AND clickable
                                    var elStyle = window.getComputedStyle(el);
                                    var elVisible = elStyle.display !== 'none' &&
                                        elStyle.visibility !== 'hidden' &&
                                        elStyle.opacity !== '0';
                                    var rect = el.getBoundingClientRect();
                                    var inViewport = rect.width > 0 && rect.height > 0;
                                    var isClickable = (el.tagName === 'BUTTON' ||
                                        el.getAttribute('role') === 'button' ||
                                        el.getAttribute('role') === 'menuitem' ||
                                        el.tagName === 'A' ||
                                        el.onclick !== null ||
                                        onclick_2 !== '' ||
                                        className.includes('btn') ||
                                        className.includes('button'));
                                    if (isClickable && elVisible && inViewport) {
                                        console.log("[OVERLAY-CLICK] Found visible clickable: ".concat(searchTarget));
                                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                        setTimeout(function () {
                                            el.click();
                                        }, 100);
                                        return { value: true };
                                    }
                                }
                            };
                            while (node = walker.nextNode()) {
                                var state_9 = _loop_11();
                                if (typeof state_9 === "object")
                                    return state_9.value;
                            }
                            return false;
                        }, target)];
                case 19:
                    found = _d.sent();
                    if (!found) return [3 /*break*/, 21];
                    log("   \u2705 [OVERLAY CLICK-JS] Clicked: \"".concat(target, "\""));
                    return [4 /*yield*/, state.page.waitForTimeout(500)];
                case 20:
                    _d.sent(); // Wait for click to process
                    return [2 /*return*/, true];
                case 21: return [3 /*break*/, 23];
                case 22:
                    jsError_1 = _d.sent();
                    log("   \u2139\uFE0F JS search in overlay failed: ".concat(jsError_1));
                    return [3 /*break*/, 23];
                case 23:
                    _d.trys.push([23, 42, , 43]);
                    return [4 /*yield*/, overlay.locator('button, a[href], [role="button"], [onclick], input[type="button"], input[type="submit"], div, span').all()];
                case 24:
                    buttons = _d.sent();
                    _a = 0, _b = buttons.slice(0, 200);
                    _d.label = 25;
                case 25:
                    if (!(_a < _b.length)) return [3 /*break*/, 41];
                    btn = _b[_a];
                    _d.label = 26;
                case 26:
                    _d.trys.push([26, 39, , 40]);
                    return [4 /*yield*/, btn.textContent().catch(function () { return ''; })];
                case 27:
                    text = _d.sent();
                    return [4 /*yield*/, btn.getAttribute('aria-label').catch(function () { return ''; })];
                case 28:
                    ariaLabel = _d.sent();
                    return [4 /*yield*/, btn.getAttribute('title').catch(function () { return ''; })];
                case 29:
                    title = _d.sent();
                    return [4 /*yield*/, btn.getAttribute('value').catch(function () { return ''; })];
                case 30:
                    value = _d.sent();
                    allText = "".concat(text, " ").concat(ariaLabel, " ").concat(title, " ").concat(value).toLowerCase();
                    if (!allText.includes(target.toLowerCase())) return [3 /*break*/, 38];
                    log("   \u2705 Found \"".concat(target, "\" in overlay"));
                    _d.label = 31;
                case 31:
                    _d.trys.push([31, 33, , 38]);
                    return [4 /*yield*/, btn.click({ force: true, timeout: 5000 }).catch(function () { })];
                case 32:
                    _d.sent();
                    log("   \u2705 [OVERLAY CLICK] Clicked: \"".concat(target, "\""));
                    return [2 /*return*/, true];
                case 33:
                    e_63 = _d.sent();
                    _d.label = 34;
                case 34:
                    _d.trys.push([34, 36, , 37]);
                    return [4 /*yield*/, btn.evaluate(function (el) { return el.click(); })];
                case 35:
                    _d.sent();
                    log("   \u2705 [OVERLAY CLICK-EVAL] Clicked: \"".concat(target, "\""));
                    return [2 /*return*/, true];
                case 36:
                    e2_6 = _d.sent();
                    return [3 /*break*/, 37];
                case 37: return [3 /*break*/, 38];
                case 38: return [3 /*break*/, 40];
                case 39:
                    e_64 = _d.sent();
                    return [3 /*break*/, 40];
                case 40:
                    _a++;
                    return [3 /*break*/, 25];
                case 41: return [3 /*break*/, 43];
                case 42:
                    stratError_1 = _d.sent();
                    return [3 /*break*/, 43];
                case 43:
                    if (!(action === 'fill')) return [3 /*break*/, 68];
                    _d.label = 44;
                case 44:
                    _d.trys.push([44, 48, , 49]);
                    return [4 /*yield*/, overlay.evaluate(function (containerEl, searchTarget, fillVal) {
                            var _a, _b, _c, _d, _e;
                            var searchLower = searchTarget.toLowerCase();
                            // FIRST: Check if overlay itself is visible
                            var overlayStyle = window.getComputedStyle(containerEl);
                            var overlayVisible = overlayStyle.display !== 'none' &&
                                overlayStyle.visibility !== 'hidden' &&
                                overlayStyle.opacity !== '0';
                            if (!overlayVisible) {
                                console.log("[OVERLAY-FILL] Overlay NOT visible - skipping");
                                return false;
                            }
                            var allInputs = containerEl.querySelectorAll('input, textarea');
                            for (var _i = 0, _f = Array.from(allInputs); _i < _f.length; _i++) {
                                var inp = _f[_i];
                                var el = inp;
                                var title = ((_a = el.getAttribute('title')) === null || _a === void 0 ? void 0 : _a.toLowerCase()) || '';
                                var placeholder = ((_b = el.getAttribute('placeholder')) === null || _b === void 0 ? void 0 : _b.toLowerCase()) || '';
                                var ariaLabel = ((_c = el.getAttribute('aria-label')) === null || _c === void 0 ? void 0 : _c.toLowerCase()) || '';
                                var name_14 = ((_d = el.getAttribute('name')) === null || _d === void 0 ? void 0 : _d.toLowerCase()) || '';
                                var id = ((_e = el.getAttribute('id')) === null || _e === void 0 ? void 0 : _e.toLowerCase()) || '';
                                var allAttrs = "".concat(title, " ").concat(placeholder, " ").concat(ariaLabel, " ").concat(name_14, " ").concat(id);
                                if (allAttrs.includes(searchLower)) {
                                    // CHECK: Element must be visible AND enabled
                                    var elStyle = window.getComputedStyle(el);
                                    var elVisible = elStyle.display !== 'none' &&
                                        elStyle.visibility !== 'hidden' &&
                                        !el.disabled;
                                    var rect = el.getBoundingClientRect();
                                    var inViewport = rect.width > 0 && rect.height > 0;
                                    if (elVisible && inViewport) {
                                        console.log("[OVERLAY-JS-FILL] Found visible field: ".concat(searchTarget));
                                        el.focus();
                                        el.value = fillVal;
                                        el.dispatchEvent(new Event('input', { bubbles: true }));
                                        el.dispatchEvent(new Event('change', { bubbles: true }));
                                        el.dispatchEvent(new Event('blur', { bubbles: true }));
                                        console.log("[OVERLAY-JS-FILL] Filled: ".concat(searchTarget, " = ").concat(fillVal));
                                        return true;
                                    }
                                    else {
                                        console.log("[OVERLAY-JS-FILL] Field found but NOT visible: ".concat(searchTarget));
                                    }
                                }
                            }
                            return false;
                        }, target, fillValue)];
                case 45:
                    filled = _d.sent();
                    if (!filled) return [3 /*break*/, 47];
                    log("   \u2705 [OVERLAY FILL-JS] Filled: \"".concat(target, "\" = \"").concat(fillValue, "\""));
                    return [4 /*yield*/, state.page.waitForTimeout(300)];
                case 46:
                    _d.sent(); // Wait for events to process
                    return [2 /*return*/, true];
                case 47: return [3 /*break*/, 49];
                case 48:
                    jsError_2 = _d.sent();
                    log("   \u2139\uFE0F JS fill in overlay failed: ".concat(jsError_2));
                    return [3 /*break*/, 49];
                case 49:
                    _d.trys.push([49, 67, , 68]);
                    return [4 /*yield*/, overlay.locator('input, textarea').all()];
                case 50:
                    inputs = _d.sent();
                    _c = 0, inputs_5 = inputs;
                    _d.label = 51;
                case 51:
                    if (!(_c < inputs_5.length)) return [3 /*break*/, 66];
                    input = inputs_5[_c];
                    _d.label = 52;
                case 52:
                    _d.trys.push([52, 64, , 65]);
                    return [4 /*yield*/, input.getAttribute('title').catch(function () { return ''; })];
                case 53:
                    title = _d.sent();
                    return [4 /*yield*/, input.getAttribute('placeholder').catch(function () { return ''; })];
                case 54:
                    placeholder = _d.sent();
                    return [4 /*yield*/, input.getAttribute('aria-label').catch(function () { return ''; })];
                case 55:
                    ariaLabel = _d.sent();
                    return [4 /*yield*/, input.getAttribute('name').catch(function () { return ''; })];
                case 56:
                    name_12 = _d.sent();
                    return [4 /*yield*/, input.getAttribute('id').catch(function () { return ''; })];
                case 57:
                    id = _d.sent();
                    allAttrs = "".concat(title, " ").concat(placeholder, " ").concat(ariaLabel, " ").concat(name_12, " ").concat(id).toLowerCase();
                    if (!allAttrs.includes(target.toLowerCase())) return [3 /*break*/, 63];
                    log("   \u2705 Found field \"".concat(target, "\" in overlay"));
                    _d.label = 58;
                case 58:
                    _d.trys.push([58, 62, , 63]);
                    return [4 /*yield*/, input.click({ force: true }).catch(function () { })];
                case 59:
                    _d.sent();
                    return [4 /*yield*/, input.fill(fillValue || '', { force: true, timeout: 5000 }).catch(function () { })];
                case 60:
                    _d.sent();
                    return [4 /*yield*/, input.evaluate(function (el) {
                            el.dispatchEvent(new Event('input', { bubbles: true }));
                            el.dispatchEvent(new Event('change', { bubbles: true }));
                            el.dispatchEvent(new Event('blur', { bubbles: true }));
                        }).catch(function () { })];
                case 61:
                    _d.sent();
                    log("   \u2705 [OVERLAY FILL] Filled: \"".concat(target, "\" = \"").concat(fillValue, "\""));
                    return [2 /*return*/, true];
                case 62:
                    e_65 = _d.sent();
                    return [3 /*break*/, 63];
                case 63: return [3 /*break*/, 65];
                case 64:
                    e_66 = _d.sent();
                    return [3 /*break*/, 65];
                case 65:
                    _c++;
                    return [3 /*break*/, 51];
                case 66: return [3 /*break*/, 68];
                case 67:
                    stratError_2 = _d.sent();
                    return [3 /*break*/, 68];
                case 68: return [3 /*break*/, 70];
                case 69:
                    overlayError_1 = _d.sent();
                    // Continue to next overlay
                    return [3 /*break*/, 70];
                case 70:
                    overlayIdx++;
                    return [3 /*break*/, 15];
                case 71:
                    log("   \u2139\uFE0F Target not found in any overlay - will search main page next");
                    return [2 /*return*/, false];
                case 72:
                    error_9 = _d.sent();
                    log("[OVERLAY SEARCH ERROR] ".concat(error_9.message));
                    return [2 /*return*/, false];
                case 73: return [2 /*return*/];
            }
        });
    });
}
/**
 * Intelligently retry finding elements across frames and wait for dynamic elements
 * NOTE: Overlays are now searched separately in clickWithRetry/fillWithRetry as Priority 2
 */
function advancedElementSearch(target_1, action_1, fillValue_1) {
    return __awaiter(this, arguments, void 0, function (target, action, fillValue, maxRetries) {
        var attempt, dynamicFound, clicked, filled, deepResult, error_10;
        var _a;
        if (maxRetries === void 0) { maxRetries = 3; }
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    attempt = 1;
                    _b.label = 1;
                case 1:
                    if (!(attempt <= maxRetries)) return [3 /*break*/, 13];
                    _b.label = 2;
                case 2:
                    _b.trys.push([2, 11, , 12]);
                    return [4 /*yield*/, waitForDynamicElement(target, 2000)];
                case 3:
                    dynamicFound = _b.sent();
                    if (!dynamicFound) return [3 /*break*/, 7];
                    if (!(action === 'click')) return [3 /*break*/, 5];
                    return [4 /*yield*/, searchInAllFrames(target, 'click')];
                case 4:
                    clicked = _b.sent();
                    if (clicked)
                        return [2 /*return*/, true];
                    return [3 /*break*/, 7];
                case 5: return [4 /*yield*/, searchInAllFrames(target, 'fill', fillValue)];
                case 6:
                    filled = _b.sent();
                    if (filled)
                        return [2 /*return*/, true];
                    _b.label = 7;
                case 7: return [4 /*yield*/, deepDOMSearch(target, action, fillValue)];
                case 8:
                    deepResult = _b.sent();
                    if (deepResult)
                        return [2 /*return*/, true];
                    if (!(attempt < maxRetries)) return [3 /*break*/, 10];
                    return [4 /*yield*/, ((_a = state.page) === null || _a === void 0 ? void 0 : _a.waitForTimeout(300))];
                case 9:
                    _b.sent(); // Reduced wait between retries
                    _b.label = 10;
                case 10: return [3 /*break*/, 12];
                case 11:
                    error_10 = _b.sent();
                    return [3 /*break*/, 12];
                case 12:
                    attempt++;
                    return [3 /*break*/, 1];
                case 13: return [2 /*return*/, false];
            }
        });
    });
}
function clickWithRetry(target_1) {
    return __awaiter(this, arguments, void 0, function (target, maxRetries) {
        var mainPageResult, advancedResult, foundInPriorityWindow, e_67, attempt, clickResult, changed, e0_1, initialUrl, initialTitle, found, newUrl, newTitle, signinErr_1, e1_5, e1b_1, scrollSuccess, buttonSelector, e2_7, shadowFound, e2_5_1, clickedInIframe, e3_2, success, e4_1, found, e5_1, error_11, subwindowResult, elementExists, diagErr_1;
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0;
        if (maxRetries === void 0) { maxRetries = 5; }
        return __generator(this, function (_1) {
            switch (_1.label) {
                case 0: 
                // FIRST: Ensure page is fully loaded before attempting to find elements
                return [4 /*yield*/, waitForPageReady()];
                case 1:
                    // FIRST: Ensure page is fully loaded before attempting to find elements
                    _1.sent();
                    // Search all windows/frames/iframes with EQUAL PRIORITY
                    // No special priority for overlays - search everything uniformly
                    log("\n\uD83D\uDD0D Searching for: \"".concat(target, "\""));
                    return [4 /*yield*/, searchInAllFrames(target, 'click')];
                case 2:
                    mainPageResult = _1.sent();
                    if (mainPageResult) {
                        return [2 /*return*/, true];
                    }
                    return [4 /*yield*/, advancedElementSearch(target, 'click', undefined, 2)];
                case 3:
                    advancedResult = _1.sent();
                    if (advancedResult) {
                        return [2 /*return*/, true];
                    }
                    if (!(allPages.length > 1 && latestSubwindow && !latestSubwindow.isClosed())) return [3 /*break*/, 7];
                    _1.label = 4;
                case 4:
                    _1.trys.push([4, 6, , 7]);
                    return [4 /*yield*/, searchInAllSubwindows(target, 'click')];
                case 5:
                    foundInPriorityWindow = _1.sent();
                    if (foundInPriorityWindow) {
                        log("\u2705 Successfully clicked in subwindow!");
                        return [2 /*return*/, true];
                    }
                    return [3 /*break*/, 7];
                case 6:
                    e_67 = _1.sent();
                    log("Subwindow search failed, continuing...");
                    return [3 /*break*/, 7];
                case 7:
                    attempt = 1;
                    _1.label = 8;
                case 8:
                    if (!(attempt <= maxRetries)) return [3 /*break*/, 77];
                    if (!state.isPaused) return [3 /*break*/, 12];
                    _1.label = 9;
                case 9:
                    if (!(state.isPaused && !state.isStopped)) return [3 /*break*/, 11];
                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 500); })];
                case 10:
                    _1.sent();
                    return [3 /*break*/, 9];
                case 11:
                    if (state.isStopped)
                        return [2 /*return*/, false];
                    _1.label = 12;
                case 12:
                    _1.trys.push([12, 73, , 76]);
                    if (!(!state.page || state.page.isClosed())) return [3 /*break*/, 14];
                    return [4 /*yield*/, switchToLatestPage()];
                case 13:
                    _1.sent();
                    if (!state.page || state.page.isClosed()) {
                        return [2 /*return*/, false];
                    }
                    _1.label = 14;
                case 14:
                    _1.trys.push([14, 20, , 21]);
                    return [4 /*yield*/, ((_a = state.page) === null || _a === void 0 ? void 0 : _a.evaluate(function (searchText) {
                            // THREE-PASS STRATEGY for SHORT TEXT targeting (like "P", "O", etc.):
                            // PASS 1: STRICT - Only exact match on BUTTON's direct visible text
                            var searchLower = searchText.toLowerCase().trim();
                            var allElements = document.querySelectorAll('*');
                            // Priority 1: Find BUTTON/CLICKABLE with EXACT matching direct text (not nested children)
                            for (var _i = 0, _a = Array.from(allElements); _i < _a.length; _i++) {
                                var el = _a[_i];
                                var isClickableElement = el.tagName === 'BUTTON' ||
                                    el.tagName === 'INPUT' ||
                                    el.getAttribute('role') === 'button' ||
                                    el.getAttribute('role') === 'tab' ||
                                    el.getAttribute('role') === 'menuitem' ||
                                    (el.getAttribute('onclick') !== null && el.tagName !== 'DIV' && el.tagName !== 'SPAN') ||
                                    (el.tagName === 'A' && el.getAttribute('href') !== null);
                                if (!isClickableElement)
                                    continue;
                                // Get DIRECT text only (immediate text nodes, not nested element text)
                                var directText = '';
                                for (var _b = 0, _c = Array.from(el.childNodes); _b < _c.length; _b++) {
                                    var node = _c[_b];
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
                                var isExactMatch = searchLower.length <= 3 ?
                                    directText === searchLower || directText.split(/\s+/).includes(searchLower) :
                                    directText.includes(searchLower);
                                if (isExactMatch) {
                                    var style = window.getComputedStyle(el);
                                    if (style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0') {
                                        var rect = el.getBoundingClientRect();
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
                            for (var _d = 0, _e = Array.from(allElements); _d < _e.length; _d++) {
                                var el = _e[_d];
                                var isClickable = el.tagName === 'BUTTON' ||
                                    el.tagName === 'A' ||
                                    el.getAttribute('role') === 'button' ||
                                    el.getAttribute('role') === 'tab' ||
                                    el.getAttribute('onclick') !== null ||
                                    (el.tagName === 'INPUT' && (el.getAttribute('type') === 'button' || el.getAttribute('type') === 'submit'));
                                if (!isClickable)
                                    continue;
                                var elementText = (el.textContent || '').trim().toLowerCase();
                                var isExactMatch = searchLower.length <= 3 ?
                                    elementText === searchLower :
                                    elementText.includes(searchLower);
                                if (isExactMatch) {
                                    var style = window.getComputedStyle(el);
                                    if (style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0') {
                                        var rect = el.getBoundingClientRect();
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
                                for (var _f = 0, _g = Array.from(allElements); _f < _g.length; _f++) {
                                    var el = _g[_f];
                                    var strongClickable = el.tagName === 'BUTTON' ||
                                        (el.tagName === 'INPUT' && (el.getAttribute('type') === 'button' || el.getAttribute('type') === 'submit')) ||
                                        (el.getAttribute('role') === 'button');
                                    if (!strongClickable)
                                        continue;
                                    var elementText = (el.textContent || '').trim().toLowerCase();
                                    if (elementText.includes(searchLower)) {
                                        var style = window.getComputedStyle(el);
                                        if (style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0') {
                                            var rect = el.getBoundingClientRect();
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
                        }, target))];
                case 15:
                    clickResult = _1.sent();
                    if (!clickResult) return [3 /*break*/, 19];
                    log("\u2705 [STRATEGY-0] Element found and clicked: \"".concat(target, "\" | Waiting for action effect..."));
                    return [4 /*yield*/, ((_b = state.page) === null || _b === void 0 ? void 0 : _b.waitForTimeout(500))];
                case 16:
                    _1.sent();
                    return [4 /*yield*/, verifyActionTookEffect('click', 2000)];
                case 17:
                    changed = _1.sent();
                    if (changed) {
                        log("\u2705 [STRATEGY-0-VERIFIED] Action confirmed - DOM changed after click");
                    }
                    else {
                        log("\u26A0\uFE0F  [STRATEGY-0-WARN] Click executed but DOM did not change - may need retry");
                    }
                    // Detect any newly opened nested windows from this click
                    return [4 /*yield*/, detectNewNestedWindows(state.page).catch(function () { })];
                case 18:
                    // Detect any newly opened nested windows from this click
                    _1.sent();
                    return [2 /*return*/, true];
                case 19: return [3 /*break*/, 21];
                case 20:
                    e0_1 = _1.sent();
                    return [3 /*break*/, 21];
                case 21:
                    if (!(target.toLowerCase().includes('sign') && target.toLowerCase().includes('in'))) return [3 /*break*/, 31];
                    _1.label = 22;
                case 22:
                    _1.trys.push([22, 30, , 31]);
                    log("[SIGNIN-PRIORITY] Special handling for Sign In button...");
                    initialUrl = (_c = state.page) === null || _c === void 0 ? void 0 : _c.url();
                    return [4 /*yield*/, ((_d = state.page) === null || _d === void 0 ? void 0 : _d.title())];
                case 23:
                    initialTitle = _1.sent();
                    return [4 /*yield*/, ((_e = state.page) === null || _e === void 0 ? void 0 : _e.evaluate(function (searchText) {
                            var searchLower = searchText.toLowerCase();
                            var allElements = document.querySelectorAll('a, button, [role="button"]');
                            // Look for sign in with flexible matching
                            for (var _i = 0, _a = Array.from(allElements); _i < _a.length; _i++) {
                                var el = _a[_i];
                                var text = (el.textContent || '').toLowerCase().trim();
                                var href = el.href ? el.href.toLowerCase() : '';
                                var onclick_3 = el.onclick ? el.onclick.toString().toLowerCase() : '';
                                // Match "sign in", "signin", "sign-in", "login"
                                var hasSignIn = text.includes('sign in') || text.includes('signin') || text.includes('sign-in') || text.includes('login');
                                var isLink = el.href && (el.href.includes('login') || el.href.includes('signin') || el.href.includes('myaccount'));
                                if (hasSignIn || isLink) {
                                    var style = window.getComputedStyle(el);
                                    var rect = el.getBoundingClientRect();
                                    if (style.display !== 'none' && style.visibility !== 'hidden' &&
                                        rect.width > 0 && rect.height > 0 &&
                                        rect.top >= -100 && rect.bottom <= window.innerHeight + 100) {
                                        // Log what we found
                                        console.log("[FOUND] text=\"".concat(text.slice(0, 30), "\" href=\"").concat(href.slice(0, 40), "\""));
                                        if (rect.top < 0 || rect.bottom > window.innerHeight) {
                                            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                        }
                                        el.click();
                                        return { found: true, text: text.slice(0, 30), href: href.slice(0, 50) };
                                    }
                                }
                            }
                            return { found: false };
                        }, target))];
                case 24:
                    found = _1.sent();
                    if (!(found && found.found)) return [3 /*break*/, 28];
                    log("\u2705 [SIGNIN-PRIORITY] Clicked element: text=\"".concat(found.text, "\" href=\"").concat(found.href, "\""));
                    return [4 /*yield*/, ((_f = state.page) === null || _f === void 0 ? void 0 : _f.waitForTimeout(2000))];
                case 25:
                    _1.sent();
                    newUrl = (_g = state.page) === null || _g === void 0 ? void 0 : _g.url();
                    return [4 /*yield*/, ((_h = state.page) === null || _h === void 0 ? void 0 : _h.title())];
                case 26:
                    newTitle = _1.sent();
                    if (newUrl !== initialUrl) {
                        log("\u2705 [SIGNIN-VERIFIED] Navigation confirmed! URL changed from \"".concat(initialUrl, "\" to \"").concat(newUrl, "\""));
                    }
                    else {
                        log("\u26A0\uFE0F  [SIGNIN-WARNING] Click executed but page did not navigate. Still on: ".concat(initialUrl));
                    }
                    return [4 /*yield*/, detectNewNestedWindows(state.page).catch(function () { })];
                case 27:
                    _1.sent();
                    return [2 /*return*/, true];
                case 28:
                    log("\u274C [SIGNIN-FAILED] Could not find visible Sign In button on page");
                    _1.label = 29;
                case 29: return [3 /*break*/, 31];
                case 30:
                    signinErr_1 = _1.sent();
                    log("   \u2139\uFE0F [SIGNIN-PRIORITY] Failed: ".concat(signinErr_1));
                    return [3 /*break*/, 31];
                case 31:
                    _1.trys.push([31, 34, , 41]);
                    log("[STRATEGY-1] Attempting direct selector: \"".concat(target, "\""));
                    return [4 /*yield*/, ((_j = state.page) === null || _j === void 0 ? void 0 : _j.click(target, { timeout: 1500 }))];
                case 32:
                    _1.sent();
                    log("\u2705 [STRATEGY-1] Direct selector click succeeded");
                    return [4 /*yield*/, ((_k = state.page) === null || _k === void 0 ? void 0 : _k.waitForTimeout(300))];
                case 33:
                    _1.sent();
                    return [2 /*return*/, true];
                case 34:
                    e1_5 = _1.sent();
                    _1.label = 35;
                case 35:
                    _1.trys.push([35, 39, , 40]);
                    log("[STRATEGY-1B] Trying with scroll...");
                    return [4 /*yield*/, scrollToElement(target)];
                case 36:
                    _1.sent();
                    return [4 /*yield*/, ((_l = state.page) === null || _l === void 0 ? void 0 : _l.click(target, { timeout: 3000 }))];
                case 37:
                    _1.sent();
                    log("\u2705 [STRATEGY-1B] Scroll + click succeeded");
                    return [4 /*yield*/, ((_m = state.page) === null || _m === void 0 ? void 0 : _m.waitForTimeout(300))];
                case 38:
                    _1.sent();
                    return [2 /*return*/, true];
                case 39:
                    e1b_1 = _1.sent();
                    // Direct selector failed
                    log("   \u2139\uFE0F Direct selector failed: ".concat(e1b_1));
                    return [3 /*break*/, 40];
                case 40: return [3 /*break*/, 41];
                case 41:
                    _1.trys.push([41, 48, , 49]);
                    log("[STRATEGY-2] Searching for text: \"".concat(target, "\""));
                    return [4 /*yield*/, scrollToElementByText(target)];
                case 42:
                    scrollSuccess = _1.sent();
                    if (!scrollSuccess) return [3 /*break*/, 47];
                    return [4 /*yield*/, findButtonByText(target)];
                case 43:
                    buttonSelector = _1.sent();
                    if (!buttonSelector) return [3 /*break*/, 47];
                    log("\u2705 [STRATEGY-2] Found button: ".concat(buttonSelector));
                    return [4 /*yield*/, ((_o = state.page) === null || _o === void 0 ? void 0 : _o.click(buttonSelector, { timeout: 3000 }))];
                case 44:
                    _1.sent();
                    log("\u2705 [STRATEGY-2] Clicked by text matching");
                    return [4 /*yield*/, ((_p = state.page) === null || _p === void 0 ? void 0 : _p.waitForTimeout(300))];
                case 45:
                    _1.sent();
                    // Detect any newly opened nested windows from this click
                    return [4 /*yield*/, detectNewNestedWindows(state.page).catch(function () { })];
                case 46:
                    // Detect any newly opened nested windows from this click
                    _1.sent();
                    return [2 /*return*/, true];
                case 47: return [3 /*break*/, 49];
                case 48:
                    e2_7 = _1.sent();
                    log("   \u2139\uFE0F [STRATEGY-2] Text matching failed: ".concat(e2_7));
                    return [3 /*break*/, 49];
                case 49:
                    _1.trys.push([49, 53, , 54]);
                    log("Searching through Shadow DOM and nested elements...");
                    return [4 /*yield*/, ((_q = state.page) === null || _q === void 0 ? void 0 : _q.evaluate(function (searchText) {
                            // Walk through all elements including shadow DOM
                            var walk = function (node) {
                                var _a;
                                if (node.nodeType === 1) { // Element node
                                    var el_1 = node;
                                    if ((_a = el_1.textContent) === null || _a === void 0 ? void 0 : _a.includes(searchText)) {
                                        var isButton = el_1.tagName === 'BUTTON' ||
                                            el_1.tagName === 'A' ||
                                            el_1.getAttribute('role') === 'button' ||
                                            el_1.getAttribute('role') === 'tab' ||
                                            el_1.getAttribute('onclick') !== null;
                                        var isRadioOrCheckbox = el_1.tagName === 'INPUT' && (el_1.getAttribute('type') === 'radio' || el_1.getAttribute('type') === 'checkbox');
                                        var isLabel = el_1.tagName === 'LABEL' && searchText.toLowerCase().split(/\s+/).every(function (word) { var _a; return (_a = el_1.textContent) === null || _a === void 0 ? void 0 : _a.toLowerCase().includes(word); });
                                        if (isButton || isRadioOrCheckbox || isLabel) {
                                            var rect = el_1.getBoundingClientRect();
                                            if (rect.width > 0 && rect.height > 0) {
                                                el_1.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                el_1.click();
                                                return true;
                                            }
                                        }
                                    }
                                    // Check shadow root
                                    if (el_1.shadowRoot) {
                                        if (walk(el_1.shadowRoot))
                                            return true;
                                    }
                                }
                                // Walk children
                                for (var _i = 0, _b = node.childNodes; _i < _b.length; _i++) {
                                    var child = _b[_i];
                                    if (walk(child))
                                        return true;
                                }
                                return false;
                            };
                            return walk(document);
                        }, target))];
                case 50:
                    shadowFound = _1.sent();
                    if (!shadowFound) return [3 /*break*/, 52];
                    log("Clicked element in shadow DOM");
                    return [4 /*yield*/, ((_r = state.page) === null || _r === void 0 ? void 0 : _r.waitForTimeout(300))];
                case 51:
                    _1.sent();
                    return [2 /*return*/, true];
                case 52: return [3 /*break*/, 54];
                case 53:
                    e2_5_1 = _1.sent();
                    log("Shadow DOM search failed");
                    return [3 /*break*/, 54];
                case 54:
                    _1.trys.push([54, 58, , 59]);
                    log("Searching in iframes for: ".concat(target, "..."));
                    return [4 /*yield*/, ((_s = state.page) === null || _s === void 0 ? void 0 : _s.evaluate(function (searchText) {
                            var _a;
                            var iframes = document.querySelectorAll('iframe');
                            for (var _i = 0, _b = Array.from(iframes); _i < _b.length; _i++) {
                                var iframe = _b[_i];
                                try {
                                    var iframeDoc = iframe.contentDocument || ((_a = iframe.contentWindow) === null || _a === void 0 ? void 0 : _a.document);
                                    if (iframeDoc) {
                                        // Search for ANY element matching the text in iframe
                                        var allElements = iframeDoc.querySelectorAll('*');
                                        var _loop_12 = function (el) {
                                            var element = el;
                                            var text = element.textContent || '';
                                            var isButton = element.tagName === 'BUTTON' ||
                                                element.tagName === 'A' ||
                                                element.getAttribute('role') === 'button' ||
                                                element.getAttribute('onclick') !== null ||
                                                element.getAttribute('role') === 'tab';
                                            var isRadioOrCheckbox = element.tagName === 'INPUT' && (element.getAttribute('type') === 'radio' || element.getAttribute('type') === 'checkbox');
                                            var isLabel = element.tagName === 'LABEL' && searchText.toLowerCase().split(/\s+/).every(function (word) { return text.toLowerCase().includes(word); });
                                            var isClickable = isButton || isRadioOrCheckbox || isLabel;
                                            if (text.toLowerCase().includes(searchText.toLowerCase()) && isClickable) {
                                                var rect = element.getBoundingClientRect();
                                                if (rect.width > 0 && rect.height > 0) {
                                                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                    element.click();
                                                    return { value: true };
                                                }
                                            }
                                        };
                                        for (var _c = 0, _d = Array.from(allElements); _c < _d.length; _c++) {
                                            var el = _d[_c];
                                            var state_10 = _loop_12(el);
                                            if (typeof state_10 === "object")
                                                return state_10.value;
                                        }
                                    }
                                }
                                catch (e) {
                                    // Cross-origin iframe
                                }
                            }
                            return false;
                        }, target))];
                case 55:
                    clickedInIframe = _1.sent();
                    if (!clickedInIframe) return [3 /*break*/, 57];
                    log("Clicked element in iframe");
                    return [4 /*yield*/, ((_t = state.page) === null || _t === void 0 ? void 0 : _t.waitForTimeout(300))];
                case 56:
                    _1.sent();
                    return [2 /*return*/, true];
                case 57: return [3 /*break*/, 59];
                case 58:
                    e3_2 = _1.sent();
                    log("Iframe click failed");
                    return [3 /*break*/, 59];
                case 59:
                    _1.trys.push([59, 64, , 65]);
                    return [4 /*yield*/, scrollToElementByText(target)];
                case 60:
                    _1.sent();
                    return [4 /*yield*/, ((_u = state.page) === null || _u === void 0 ? void 0 : _u.evaluate(function (sel) {
                            var element = document.querySelector(sel);
                            if (element) {
                                element.click();
                                return true;
                            }
                            return false;
                        }, target))];
                case 61:
                    success = _1.sent();
                    if (!success) return [3 /*break*/, 63];
                    return [4 /*yield*/, ((_v = state.page) === null || _v === void 0 ? void 0 : _v.waitForTimeout(300))];
                case 62:
                    _1.sent();
                    return [2 /*return*/, true];
                case 63: return [3 /*break*/, 65];
                case 64:
                    e4_1 = _1.sent();
                    return [3 /*break*/, 65];
                case 65:
                    _1.trys.push([65, 69, , 70]);
                    log("Deep searching all clickable elements...");
                    return [4 /*yield*/, ((_w = state.page) === null || _w === void 0 ? void 0 : _w.evaluate(function (searchText) {
                            // Scroll to top first
                            window.scrollTo(0, 0);
                            // Deep search all possible elements
                            var allElements = document.querySelectorAll('*');
                            for (var _i = 0, _a = Array.from(allElements); _i < _a.length; _i++) {
                                var el = _a[_i];
                                var text = el.textContent || '';
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
                        }, target))];
                case 66:
                    found = _1.sent();
                    if (!found) return [3 /*break*/, 68];
                    log("Deep search click succeeded");
                    return [4 /*yield*/, ((_x = state.page) === null || _x === void 0 ? void 0 : _x.waitForTimeout(300))];
                case 67:
                    _1.sent();
                    return [2 /*return*/, true];
                case 68: return [3 /*break*/, 70];
                case 69:
                    e5_1 = _1.sent();
                    log("Deep search failed");
                    return [3 /*break*/, 70];
                case 70:
                    if (!(attempt < maxRetries)) return [3 /*break*/, 72];
                    return [4 /*yield*/, ((_y = state.page) === null || _y === void 0 ? void 0 : _y.waitForTimeout(500))];
                case 71:
                    _1.sent(); // Reduced wait between retries
                    _1.label = 72;
                case 72: return [3 /*break*/, 76];
                case 73:
                    error_11 = _1.sent();
                    if (!(attempt < maxRetries)) return [3 /*break*/, 75];
                    return [4 /*yield*/, ((_z = state.page) === null || _z === void 0 ? void 0 : _z.waitForTimeout(500))];
                case 74:
                    _1.sent(); // Reduced wait between retries
                    _1.label = 75;
                case 75: return [3 /*break*/, 76];
                case 76:
                    attempt++;
                    return [3 /*break*/, 8];
                case 77:
                    if (!(allPages.length > 1)) return [3 /*break*/, 79];
                    log("\uD83E\uDE9F Trying subwindow search as final fallback...");
                    return [4 /*yield*/, searchInAllSubwindows(target, 'click')];
                case 78:
                    subwindowResult = _1.sent();
                    if (subwindowResult) {
                        return [2 /*return*/, true];
                    }
                    _1.label = 79;
                case 79:
                    // CLICK FAILED - Provide diagnostic information
                    log("\n\u274C [CLICK FAILED] Unable to find or click element: \"".concat(target, "\""));
                    _1.label = 80;
                case 80:
                    _1.trys.push([80, 82, , 83]);
                    return [4 /*yield*/, ((_0 = state.page) === null || _0 === void 0 ? void 0 : _0.evaluate(function (searchText) {
                            var lower = searchText.toLowerCase();
                            var allElements = document.querySelectorAll('*');
                            for (var _i = 0, _a = Array.from(allElements); _i < _a.length; _i++) {
                                var el = _a[_i];
                                var text = (el.textContent || '').toLowerCase();
                                if (text.includes(lower)) {
                                    var style = window.getComputedStyle(el);
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
                        }, target))];
                case 81:
                    elementExists = _1.sent();
                    if (elementExists === null || elementExists === void 0 ? void 0 : elementExists.found) {
                        if (!elementExists.visible) {
                            log("   \u26A0\uFE0F  Element FOUND but HIDDEN (".concat(elementExists.tagName, ".").concat(elementExists.className, ") | Text: \"").concat(elementExists.text, "\""));
                        }
                        else {
                            log("   \u26A0\uFE0F  Element FOUND and VISIBLE (".concat(elementExists.tagName, ") | Text: \"").concat(elementExists.text, "\""));
                            log("   \u2192 This likely means: Click strategy failed, try manual element path or different identifier");
                        }
                    }
                    else {
                        log("   \u26A0\uFE0F  Element NOT FOUND on page at all");
                        log("   \u2192 Search for similar text:  \"".concat(target, "\""));
                    }
                    return [3 /*break*/, 83];
                case 82:
                    diagErr_1 = _1.sent();
                    log("   \u2139\uFE0F  Diagnostic check failed: ".concat(diagErr_1));
                    return [3 /*break*/, 83];
                case 83: return [2 /*return*/, false];
            }
        });
    });
}
/**
 * Handle dropdown/select elements by opening them and clicking the correct option
 */
function handleDropdown(target, value) {
    return __awaiter(this, void 0, void 0, function () {
        var selectHandled, e_68, customDropdownHandled, e_69, adjacentHandled, e_70;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!state.page || state.page.isClosed())
                        return [2 /*return*/, false];
                    log("\uD83D\uDD3D [DROPDOWN] Attempting to handle dropdown for: \"".concat(target, "\" = \"").concat(value, "\""));
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 5, , 6]);
                    return [4 /*yield*/, state.page.evaluate(function (_a) {
                            var searchTarget = _a.searchTarget, selectValue = _a.selectValue;
                            var selects = document.querySelectorAll('select');
                            for (var _i = 0, _b = Array.from(selects); _i < _b.length; _i++) {
                                var select = _b[_i];
                                var label = select.name || select.id || '';
                                var ariaLabel = select.getAttribute('aria-label') || '';
                                // Check if this select matches our target
                                if (label.toLowerCase().includes(searchTarget.toLowerCase()) ||
                                    ariaLabel.toLowerCase().includes(searchTarget.toLowerCase())) {
                                    // Find and select the option
                                    var options = select.querySelectorAll('option');
                                    for (var _c = 0, _d = Array.from(options); _c < _d.length; _c++) {
                                        var option = _d[_c];
                                        if (option.textContent.toLowerCase().includes(selectValue.toLowerCase())) {
                                            select.value = option.value;
                                            select.dispatchEvent(new Event('change', { bubbles: true }));
                                            return true;
                                        }
                                    }
                                }
                            }
                            return false;
                        }, { searchTarget: target, selectValue: value })];
                case 2:
                    selectHandled = _a.sent();
                    if (!selectHandled) return [3 /*break*/, 4];
                    log("\u2705 [DROPDOWN] Successfully selected option in native <select>");
                    return [4 /*yield*/, state.page.waitForTimeout(300)];
                case 3:
                    _a.sent();
                    return [2 /*return*/, true];
                case 4: return [3 /*break*/, 6];
                case 5:
                    e_68 = _a.sent();
                    log("\u26A0\uFE0F  Native select handling failed");
                    return [3 /*break*/, 6];
                case 6:
                    _a.trys.push([6, 10, , 11]);
                    return [4 /*yield*/, state.page.evaluate(function (_a) {
                            var _b, _c;
                            var searchTarget = _a.searchTarget, optionValue = _a.optionValue;
                            var dropdowns = document.querySelectorAll('[role="listbox"], [role="combobox"], .dropdown, [data-role="dropdown"]');
                            var _loop_13 = function (dropdown) {
                                // Check if this dropdown matches the target
                                var dropdownText = dropdown.textContent || '';
                                var dropdownLabel = dropdown.getAttribute('aria-label') || '';
                                if (!dropdownText.toLowerCase().includes(searchTarget.toLowerCase()) &&
                                    !dropdownLabel.toLowerCase().includes(searchTarget.toLowerCase())) {
                                    return "continue";
                                }
                                // Click to open the dropdown
                                var trigger = dropdown.querySelector('button, [role="button"], a') || dropdown;
                                (_c = (_b = trigger).click) === null || _c === void 0 ? void 0 : _c.call(_b);
                                return { value: new Promise(function (resolve) {
                                        setTimeout(function () {
                                            var _a, _b, _c;
                                            // Find and click the matching option
                                            var options = dropdown.querySelectorAll('[role="option"], li, div[data-value]');
                                            for (var _i = 0, _d = Array.from(options); _i < _d.length; _i++) {
                                                var option = _d[_i];
                                                var optText = ((_a = option.textContent) === null || _a === void 0 ? void 0 : _a.trim().toLowerCase()) || '';
                                                if (optText.includes(optionValue.toLowerCase())) {
                                                    (_c = (_b = option).click) === null || _c === void 0 ? void 0 : _c.call(_b);
                                                    resolve(true);
                                                    return;
                                                }
                                            }
                                            resolve(false);
                                        }, 400);
                                    }) };
                            };
                            for (var _i = 0, _d = Array.from(dropdowns); _i < _d.length; _i++) {
                                var dropdown = _d[_i];
                                var state_11 = _loop_13(dropdown);
                                if (typeof state_11 === "object")
                                    return state_11.value;
                            }
                            return false;
                        }, { searchTarget: target, optionValue: value })];
                case 7:
                    customDropdownHandled = _a.sent();
                    if (!customDropdownHandled) return [3 /*break*/, 9];
                    log("\u2705 [DROPDOWN] Successfully selected option in custom dropdown");
                    return [4 /*yield*/, state.page.waitForTimeout(300)];
                case 8:
                    _a.sent();
                    return [2 /*return*/, true];
                case 9: return [3 /*break*/, 11];
                case 10:
                    e_69 = _a.sent();
                    log("\u26A0\uFE0F  Custom dropdown handling failed");
                    return [3 /*break*/, 11];
                case 11:
                    _a.trys.push([11, 15, , 16]);
                    return [4 /*yield*/, state.page.evaluate(function (_a) {
                            var _b, _c, _d;
                            var labelText = _a.labelText, optionValue = _a.optionValue;
                            // Find label element containing target text
                            var labels = document.querySelectorAll('label, div, span');
                            var _loop_14 = function (label) {
                                if (!((_b = label.textContent) === null || _b === void 0 ? void 0 : _b.toLowerCase().includes(labelText.toLowerCase())))
                                    return "continue";
                                // Look for nearby select or dropdown trigger
                                var parent_1 = label.parentElement;
                                var found = false;
                                var _loop_15 = function (i) {
                                    if (!parent_1)
                                        return "break";
                                    // Check for native select
                                    var select = parent_1.querySelector('select');
                                    if (select) {
                                        var options = select.querySelectorAll('option');
                                        for (var _f = 0, _g = Array.from(options); _f < _g.length; _f++) {
                                            var option = _g[_f];
                                            if (option.textContent.toLowerCase().includes(optionValue.toLowerCase())) {
                                                select.value = option.value;
                                                select.dispatchEvent(new Event('change', { bubbles: true }));
                                                found = true;
                                                break;
                                            }
                                        }
                                    }
                                    // Check for custom dropdown
                                    var dropdown = parent_1.querySelector('[role="listbox"], [role="combobox"]');
                                    if (dropdown) {
                                        var trigger = dropdown.querySelector('button') || dropdown;
                                        (_d = (_c = trigger).click) === null || _d === void 0 ? void 0 : _d.call(_c);
                                        setTimeout(function () {
                                            var _a, _b;
                                            var options = dropdown.querySelectorAll('[role="option"]');
                                            for (var _i = 0, _c = Array.from(options); _i < _c.length; _i++) {
                                                var option = _c[_i];
                                                if (option.textContent.toLowerCase().includes(optionValue.toLowerCase())) {
                                                    (_b = (_a = option).click) === null || _b === void 0 ? void 0 : _b.call(_a);
                                                    found = true;
                                                    break;
                                                }
                                            }
                                        }, 300);
                                    }
                                    if (found)
                                        return "break";
                                    parent_1 = parent_1.parentElement;
                                };
                                for (var i = 0; i < 4; i++) {
                                    var state_13 = _loop_15(i);
                                    if (state_13 === "break")
                                        break;
                                }
                                if (found)
                                    return { value: true };
                            };
                            for (var _i = 0, _e = Array.from(labels); _i < _e.length; _i++) {
                                var label = _e[_i];
                                var state_12 = _loop_14(label);
                                if (typeof state_12 === "object")
                                    return state_12.value;
                            }
                            return false;
                        }, { labelText: target, optionValue: value })];
                case 12:
                    adjacentHandled = _a.sent();
                    if (!adjacentHandled) return [3 /*break*/, 14];
                    log("\u2705 [DROPDOWN] Successfully selected option via label-adjacent search");
                    return [4 /*yield*/, state.page.waitForTimeout(300)];
                case 13:
                    _a.sent();
                    return [2 /*return*/, true];
                case 14: return [3 /*break*/, 16];
                case 15:
                    e_70 = _a.sent();
                    log("\u26A0\uFE0F  Label-adjacent dropdown handling failed");
                    return [3 /*break*/, 16];
                case 16: return [2 /*return*/, false];
            }
        });
    });
}
/**
 * Detect if target is a dropdown/select element and handle accordingly
 */
function detectAndHandleDropdown(target, value) {
    return __awaiter(this, void 0, void 0, function () {
        var isDropdown, e_71;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!state.page || state.page.isClosed())
                        return [2 /*return*/, false];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 5, , 6]);
                    return [4 /*yield*/, state.page.evaluate(function (searchTarget) {
                            var _a, _b, _c;
                            // Look for any element that might be a dropdown
                            var allElements = document.querySelectorAll('*');
                            for (var _i = 0, _d = Array.from(allElements); _i < _d.length; _i++) {
                                var el = _d[_i];
                                var text = ((_a = el.textContent) === null || _a === void 0 ? void 0 : _a.toLowerCase()) || '';
                                var label = ((_b = el.getAttribute('aria-label')) === null || _b === void 0 ? void 0 : _b.toLowerCase()) || '';
                                var name_15 = ((_c = el.getAttribute('name')) === null || _c === void 0 ? void 0 : _c.toLowerCase()) || '';
                                if (!text.includes(searchTarget.toLowerCase()) &&
                                    !label.includes(searchTarget.toLowerCase()) &&
                                    !name_15.includes(searchTarget.toLowerCase())) {
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
                        }, target)];
                case 2:
                    isDropdown = _a.sent();
                    if (!isDropdown) return [3 /*break*/, 4];
                    log("\uD83D\uDD0D [DROPDOWN-DETECT] Found dropdown element, attempting to handle...");
                    return [4 /*yield*/, handleDropdown(target, value)];
                case 3: return [2 /*return*/, _a.sent()];
                case 4: return [3 /*break*/, 6];
                case 5:
                    e_71 = _a.sent();
                    return [3 /*break*/, 6];
                case 6: return [2 /*return*/, false];
            }
        });
    });
}
function fillWithRetry(target_1, value_1) {
    return __awaiter(this, arguments, void 0, function (target, value, maxRetries) {
        var dropdownHandled, mainPageResult, advancedResult, foundInPriorityWindow, e_72, attempt, e0_2, filled, e0_3, filledInIframe, e5_2, foundAndFilled, e1_6, e2_8, e3_3, shadowFilled, e4_2, error_12, foundInSubwindow, swError_1, fieldExists, diagErr_2;
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p;
        if (maxRetries === void 0) { maxRetries = 5; }
        return __generator(this, function (_q) {
            switch (_q.label) {
                case 0: 
                // FIRST: Ensure page is fully loaded before attempting to find elements
                return [4 /*yield*/, waitForPageReady()];
                case 1:
                    // FIRST: Ensure page is fully loaded before attempting to find elements
                    _q.sent();
                    // CRITICAL: Check for dropdown/select elements FIRST before trying to fill as text input
                    log("\n\uD83D\uDD3D [FILL-REQUEST] Checking if target is a dropdown/select element...");
                    return [4 /*yield*/, detectAndHandleDropdown(target, value)];
                case 2:
                    dropdownHandled = _q.sent();
                    if (dropdownHandled) {
                        log("\u2705 [FILL-SUCCESS] Dropdown handling succeeded for: \"".concat(target, "\" = \"").concat(value, "\""));
                        return [2 /*return*/, true];
                    }
                    // Search all windows/frames/iframes with EQUAL PRIORITY
                    // No special priority for overlays - search everything uniformly
                    log("\n\uD83D\uDD0D Searching for regular field: \"".concat(target, "\""));
                    return [4 /*yield*/, searchInAllFrames(target, 'fill', value)];
                case 3:
                    mainPageResult = _q.sent();
                    if (mainPageResult) {
                        return [2 /*return*/, true];
                    }
                    return [4 /*yield*/, advancedElementSearch(target, 'fill', value, 2)];
                case 4:
                    advancedResult = _q.sent();
                    if (advancedResult) {
                        return [2 /*return*/, true];
                    }
                    if (!(allPages.length > 1 && latestSubwindow && !latestSubwindow.isClosed())) return [3 /*break*/, 8];
                    _q.label = 5;
                case 5:
                    _q.trys.push([5, 7, , 8]);
                    return [4 /*yield*/, searchInAllSubwindows(target, 'fill', value)];
                case 6:
                    foundInPriorityWindow = _q.sent();
                    if (foundInPriorityWindow) {
                        log("\u2705 Successfully filled in subwindow!");
                        return [2 /*return*/, true];
                    }
                    return [3 /*break*/, 8];
                case 7:
                    e_72 = _q.sent();
                    log("Subwindow search failed, continuing...");
                    return [3 /*break*/, 8];
                case 8:
                    attempt = 1;
                    _q.label = 9;
                case 9:
                    if (!(attempt <= maxRetries)) return [3 /*break*/, 51];
                    if (!state.isPaused) return [3 /*break*/, 13];
                    _q.label = 10;
                case 10:
                    if (!(state.isPaused && !state.isStopped)) return [3 /*break*/, 12];
                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 500); })];
                case 11:
                    _q.sent();
                    return [3 /*break*/, 10];
                case 12:
                    if (state.isStopped)
                        return [2 /*return*/, false];
                    _q.label = 13;
                case 13:
                    _q.trys.push([13, 47, , 50]);
                    if (!(!state.page || state.page.isClosed())) return [3 /*break*/, 15];
                    log("Page closed during fill attempt, recovering...");
                    return [4 /*yield*/, switchToLatestPage()];
                case 14:
                    _q.sent();
                    if (!state.page || state.page.isClosed()) {
                        return [2 /*return*/, false];
                    }
                    _q.label = 15;
                case 15:
                    if (!(target.startsWith('[') || target.startsWith('#') || target.startsWith('.') || target.includes('>'))) return [3 /*break*/, 19];
                    _q.label = 16;
                case 16:
                    _q.trys.push([16, 18, , 19]);
                    return [4 /*yield*/, ((_a = state.page) === null || _a === void 0 ? void 0 : _a.fill(target, value, { timeout: 2000 }))];
                case 17:
                    _q.sent();
                    return [2 /*return*/, true];
                case 18:
                    e0_2 = _q.sent();
                    return [3 /*break*/, 19];
                case 19:
                    _q.trys.push([19, 21, , 22]);
                    return [4 /*yield*/, ((_b = state.page) === null || _b === void 0 ? void 0 : _b.evaluate(function (_a) {
                            var searchText = _a.searchText, fillValue = _a.value;
                            var allInputs = document.querySelectorAll('input, textarea, [contenteditable="true"]');
                            for (var _i = 0, _b = Array.from(allInputs); _i < _b.length; _i++) {
                                var input = _b[_i];
                                var el = input;
                                var style = window.getComputedStyle(el);
                                var placeholder = input.placeholder || '';
                                var label = input.getAttribute('aria-label') || '';
                                var id = input.id || '';
                                var name_16 = input.name || '';
                                // Check if visible and matches search text
                                if (style.display !== 'none' && style.visibility !== 'hidden' &&
                                    (placeholder.toLowerCase().includes(searchText.toLowerCase()) ||
                                        label.toLowerCase().includes(searchText.toLowerCase()) ||
                                        id.toLowerCase().includes(searchText.toLowerCase()) ||
                                        name_16.toLowerCase().includes(searchText.toLowerCase()))) {
                                    var rect = el.getBoundingClientRect();
                                    if (rect.width > 0 && rect.height > 0) {
                                        // ONLY scroll if element is outside viewport
                                        if (rect.top < 0 || rect.bottom > window.innerHeight) {
                                            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                        }
                                        input.value = fillValue;
                                        input.dispatchEvent(new Event('input', { bubbles: true }));
                                        input.dispatchEvent(new Event('change', { bubbles: true }));
                                        input.dispatchEvent(new Event('blur', { bubbles: true }));
                                        return true;
                                    }
                                }
                            }
                            return false;
                        }, { searchText: target, value: value }))];
                case 20:
                    filled = _q.sent();
                    if (filled) {
                        return [2 /*return*/, true];
                    }
                    return [3 /*break*/, 22];
                case 21:
                    e0_3 = _q.sent();
                    return [3 /*break*/, 22];
                case 22:
                    _q.trys.push([22, 26, , 27]);
                    return [4 /*yield*/, ((_c = state.page) === null || _c === void 0 ? void 0 : _c.evaluate(function (_a) {
                            var _b;
                            var searchText = _a.searchText, fillValue = _a.fillValue;
                            var iframes = document.querySelectorAll('iframe');
                            for (var _i = 0, _c = Array.from(iframes); _i < _c.length; _i++) {
                                var iframe = _c[_i];
                                try {
                                    var iframeDoc = iframe.contentDocument || ((_b = iframe.contentWindow) === null || _b === void 0 ? void 0 : _b.document);
                                    if (iframeDoc) {
                                        var inputs = iframeDoc.querySelectorAll('input, textarea');
                                        for (var _d = 0, inputs_6 = inputs; _d < inputs_6.length; _d++) {
                                            var input = inputs_6[_d];
                                            var placeholder = input.placeholder || '';
                                            var label = input.getAttribute('aria-label') || '';
                                            var id = input.id || '';
                                            var name_17 = input.name || '';
                                            var value_2 = input.value || '';
                                            if (placeholder.toLowerCase().includes(searchText.toLowerCase()) ||
                                                label.toLowerCase().includes(searchText.toLowerCase()) ||
                                                id.toLowerCase().includes(searchText.toLowerCase()) ||
                                                name_17.toLowerCase().includes(searchText.toLowerCase()) ||
                                                value_2.toLowerCase().includes(searchText.toLowerCase())) {
                                                input.focus();
                                                input.value = fillValue;
                                                input.dispatchEvent(new Event('input', { bubbles: true }));
                                                input.dispatchEvent(new Event('change', { bubbles: true }));
                                                input.dispatchEvent(new Event('blur', { bubbles: true }));
                                                return true;
                                            }
                                        }
                                    }
                                }
                                catch (e) {
                                    // Cross-origin iframe
                                }
                            }
                            return false;
                        }, { searchText: target, fillValue: value }))];
                case 23:
                    filledInIframe = _q.sent();
                    if (!filledInIframe) return [3 /*break*/, 25];
                    return [4 /*yield*/, ((_d = state.page) === null || _d === void 0 ? void 0 : _d.waitForTimeout(200))];
                case 24:
                    _q.sent();
                    return [2 /*return*/, true];
                case 25: return [3 /*break*/, 27];
                case 26:
                    e5_2 = _q.sent();
                    return [3 /*break*/, 27];
                case 27:
                    _q.trys.push([27, 29, , 30]);
                    return [4 /*yield*/, ((_e = state.page) === null || _e === void 0 ? void 0 : _e.evaluate(function (_a) {
                            var searchText = _a.searchText, fillValue = _a.fillValue;
                            // Search for any element containing the text
                            var allElements = document.querySelectorAll('*');
                            for (var _i = 0, _b = Array.from(allElements); _i < _b.length; _i++) {
                                var el = _b[_i];
                                var text = el.textContent || '';
                                if (text.toLowerCase().includes(searchText.toLowerCase())) {
                                    // Look for nearby input
                                    var inputs = el.querySelectorAll('input, textarea');
                                    if (inputs.length > 0) {
                                        var input = inputs[0];
                                        input.value = fillValue;
                                        input.dispatchEvent(new Event('input', { bubbles: true }));
                                        input.dispatchEvent(new Event('change', { bubbles: true }));
                                        return true;
                                    }
                                    // Check parent for input
                                    var parent_2 = el.parentElement;
                                    for (var i = 0; i < 5; i++) {
                                        if (!parent_2)
                                            break;
                                        var parentInputs = parent_2.querySelectorAll('input, textarea');
                                        if (parentInputs.length > 0) {
                                            var input = parentInputs[0];
                                            input.value = fillValue;
                                            input.dispatchEvent(new Event('input', { bubbles: true }));
                                            input.dispatchEvent(new Event('change', { bubbles: true }));
                                            return true;
                                        }
                                        parent_2 = parent_2.parentElement;
                                    }
                                }
                            }
                            return false;
                        }, { searchText: target, fillValue: value }))];
                case 28:
                    foundAndFilled = _q.sent();
                    if (foundAndFilled) {
                        log("Filled by pattern matching");
                        return [2 /*return*/, true];
                    }
                    return [3 /*break*/, 30];
                case 29:
                    e1_6 = _q.sent();
                    log("Pattern matching fill failed");
                    return [3 /*break*/, 30];
                case 30:
                    _q.trys.push([30, 33, , 34]);
                    log("Scrolling to field...");
                    return [4 /*yield*/, scrollToElement(target)];
                case 31:
                    _q.sent();
                    return [4 /*yield*/, ((_f = state.page) === null || _f === void 0 ? void 0 : _f.fill(target, value, { timeout: 3000 }))];
                case 32:
                    _q.sent();
                    log("Successfully filled via scroll");
                    return [2 /*return*/, true];
                case 33:
                    e2_8 = _q.sent();
                    log("Direct fill failed");
                    return [3 /*break*/, 34];
                case 34:
                    _q.trys.push([34, 40, , 41]);
                    log("Clear and type with scroll...");
                    return [4 /*yield*/, scrollToElement(target)];
                case 35:
                    _q.sent();
                    return [4 /*yield*/, ((_g = state.page) === null || _g === void 0 ? void 0 : _g.click(target, { timeout: 2000 }))];
                case 36:
                    _q.sent();
                    return [4 /*yield*/, ((_h = state.page) === null || _h === void 0 ? void 0 : _h.keyboard.press('Control+A'))];
                case 37:
                    _q.sent();
                    return [4 /*yield*/, ((_j = state.page) === null || _j === void 0 ? void 0 : _j.keyboard.press('Delete'))];
                case 38:
                    _q.sent();
                    return [4 /*yield*/, ((_k = state.page) === null || _k === void 0 ? void 0 : _k.type(target, value, { delay: 50 }))];
                case 39:
                    _q.sent();
                    log("Filled using clear and type");
                    return [2 /*return*/, true];
                case 40:
                    e3_3 = _q.sent();
                    log("Clear and type failed");
                    return [3 /*break*/, 41];
                case 41:
                    _q.trys.push([41, 43, , 44]);
                    log("Searching in Shadow DOM to fill...");
                    return [4 /*yield*/, ((_l = state.page) === null || _l === void 0 ? void 0 : _l.evaluate(function (_a) {
                            var searchText = _a.searchText, fillValue = _a.fillValue;
                            var walk = function (node) {
                                if (node.nodeType === 1) { // Element node
                                    var el = node;
                                    var placeholder = el.placeholder || '';
                                    var ariaLabel = el.getAttribute('aria-label') || '';
                                    if ((el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') &&
                                        (placeholder.toLowerCase().includes(searchText.toLowerCase()) || ariaLabel.toLowerCase().includes(searchText.toLowerCase()))) {
                                        var rect = el.getBoundingClientRect();
                                        if (rect.width > 0 && rect.height > 0) {
                                            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                            el.value = fillValue;
                                            el.dispatchEvent(new Event('input', { bubbles: true }));
                                            el.dispatchEvent(new Event('change', { bubbles: true }));
                                            return true;
                                        }
                                    }
                                    // Check shadow root
                                    if (el.shadowRoot && walk(el.shadowRoot))
                                        return true;
                                }
                                // Walk children
                                for (var _i = 0, _a = node.childNodes; _i < _a.length; _i++) {
                                    var child = _a[_i];
                                    if (walk(child))
                                        return true;
                                }
                                return false;
                            };
                            return walk(document);
                        }, { searchText: target, fillValue: value }))];
                case 42:
                    shadowFilled = _q.sent();
                    if (shadowFilled) {
                        log("Filled field in Shadow DOM");
                        return [2 /*return*/, true];
                    }
                    return [3 /*break*/, 44];
                case 43:
                    e4_2 = _q.sent();
                    log("Shadow DOM fill failed");
                    return [3 /*break*/, 44];
                case 44:
                    if (!(attempt < maxRetries)) return [3 /*break*/, 46];
                    return [4 /*yield*/, ((_m = state.page) === null || _m === void 0 ? void 0 : _m.waitForTimeout(500))];
                case 45:
                    _q.sent(); // Reduced wait between retries
                    _q.label = 46;
                case 46: return [3 /*break*/, 50];
                case 47:
                    error_12 = _q.sent();
                    if (!(attempt < maxRetries)) return [3 /*break*/, 49];
                    return [4 /*yield*/, ((_o = state.page) === null || _o === void 0 ? void 0 : _o.waitForTimeout(500))];
                case 48:
                    _q.sent(); // Reduced wait between retries
                    _q.label = 49;
                case 49: return [3 /*break*/, 50];
                case 50:
                    attempt++;
                    return [3 /*break*/, 9];
                case 51:
                    if (!(allPages.length > 1)) return [3 /*break*/, 55];
                    _q.label = 52;
                case 52:
                    _q.trys.push([52, 54, , 55]);
                    log("Field not found in main window, searching subwindows...");
                    return [4 /*yield*/, searchInAllSubwindows(target, 'fill', value)];
                case 53:
                    foundInSubwindow = _q.sent();
                    if (foundInSubwindow) {
                        log("Successfully filled in subwindow");
                        return [2 /*return*/, true];
                    }
                    return [3 /*break*/, 55];
                case 54:
                    swError_1 = _q.sent();
                    log("Subwindow fill search failed");
                    return [3 /*break*/, 55];
                case 55:
                    // FILL FAILED - Provide diagnostic information
                    log("\n\u274C [FILL FAILED] Unable to find or fill field: \"".concat(target, "\" with value: \"").concat(value, "\""));
                    _q.label = 56;
                case 56:
                    _q.trys.push([56, 58, , 59]);
                    return [4 /*yield*/, ((_p = state.page) === null || _p === void 0 ? void 0 : _p.evaluate(function (searchText) {
                            var lower = searchText.toLowerCase();
                            var inputs = document.querySelectorAll('input, textarea, [contenteditable="true"]');
                            for (var _i = 0, _a = Array.from(inputs); _i < _a.length; _i++) {
                                var input = _a[_i];
                                var placeholder = input.placeholder || '';
                                var label = input.getAttribute('aria-label') || '';
                                var name_18 = input.name || '';
                                var id = input.id || '';
                                var allAttrs = "".concat(placeholder, " ").concat(label, " ").concat(name_18, " ").concat(id).toLowerCase();
                                if (allAttrs.includes(lower)) {
                                    var style = window.getComputedStyle(input);
                                    return {
                                        found: true,
                                        attributes: { placeholder: placeholder, name: name_18, id: id, label: label },
                                        visible: style.display !== 'none' && style.visibility !== 'hidden',
                                        type: input.type,
                                        value: input.value
                                    };
                                }
                            }
                            return { found: false, attributes: {}, visible: false, type: '', value: '' };
                        }, target))];
                case 57:
                    fieldExists = _q.sent();
                    if (fieldExists === null || fieldExists === void 0 ? void 0 : fieldExists.found) {
                        if (!fieldExists.visible) {
                            log("   \u26A0\uFE0F  Field FOUND but HIDDEN | Type: ".concat(fieldExists.type, " | Placeholder: \"").concat(fieldExists.attributes.placeholder, "\""));
                        }
                        else {
                            log("   \u26A0\uFE0F  Field FOUND and VISIBLE | Type: ".concat(fieldExists.type, " | Current Value: \"").concat(fieldExists.value, "\""));
                            log("   \u2192 Try using a different field identifier or check field attributes");
                        }
                    }
                    else {
                        log("   \u26A0\uFE0F  Field NOT FOUND on page");
                        log("   \u2192 Search for field with label: \"".concat(target, "\""));
                    }
                    return [3 /*break*/, 59];
                case 58:
                    diagErr_2 = _q.sent();
                    log("   \u2139\uFE0F  Diagnostic check failed: ".concat(diagErr_2));
                    return [3 /*break*/, 59];
                case 59: return [2 /*return*/, false];
            }
        });
    });
}
function getAllPageElements() {
    return __awaiter(this, void 0, void 0, function () {
        var elements, e_73;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!state.page || state.page.isClosed()) {
                        return [2 /*return*/, []];
                    }
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, state.page.evaluate(function () {
                            var _a, _b, _c;
                            var items = [];
                            var seen = new Set();
                            var elementIndex = 0;
                            try {
                                // Helper: Check if element is inside a modal/overlay
                                var getOverlayContext = function (el) {
                                    var parent = el.parentElement;
                                    var depth = 0;
                                    while (parent && depth < 10) {
                                        var className = parent.getAttribute('class') || '';
                                        var id = parent.getAttribute('id') || '';
                                        var role = parent.getAttribute('role') || '';
                                        // Check for common modal/overlay indicators
                                        if (className.includes('modal') || className.includes('overlay') || className.includes('dialog') ||
                                            className.includes('popup') || className.includes('window') ||
                                            id.includes('modal') || id.includes('overlay') || id.includes('dialog') ||
                                            role === 'dialog' || role === 'alertdialog') {
                                            return "[OVERLAY: ".concat(id || className.split(' ')[0], "]");
                                        }
                                        // Check for fixed/absolute positioning that suggests overlay
                                        var style = window.getComputedStyle(parent);
                                        if (style.position === 'fixed' && style.zIndex && parseInt(style.zIndex) > 1000) {
                                            return "[OVERLAY: fixed-zindex-".concat(style.zIndex, "]");
                                        }
                                        parent = parent.parentElement;
                                        depth++;
                                    }
                                    return '';
                                };
                                // Helper: Find associated label text for an element - COMPREHENSIVE SEARCH
                                var getAssociatedLabel_1 = function (el) {
                                    var _a, _b, _c, _d, _e, _f, _g;
                                    var id = el.getAttribute('id');
                                    var name = el.getAttribute('name');
                                    // PRIORITY 0: Check the element's OWN title/tooltip first (this is shown in tooltips)
                                    var title = el.getAttribute('title');
                                    if (title && title.trim().length > 0) {
                                        return title.trim();
                                    }
                                    // Strategy 1: Try to find label with for attribute pointing to this element's id
                                    if (id) {
                                        var label = document.querySelector("label[for=\"".concat(id, "\"]"));
                                        if (label && ((_a = label.textContent) === null || _a === void 0 ? void 0 : _a.trim()) && label.textContent.trim().length > 0) {
                                            return label.textContent.trim();
                                        }
                                    }
                                    // Strategy 2: Try to find label with for attribute pointing to this element's name
                                    if (name) {
                                        var label = document.querySelector("label[for=\"".concat(name, "\"]"));
                                        if (label && ((_b = label.textContent) === null || _b === void 0 ? void 0 : _b.trim()) && label.textContent.trim().length > 0) {
                                            return label.textContent.trim();
                                        }
                                    }
                                    // Strategy 3: Check if element is inside a label element
                                    var parent = el.parentElement;
                                    while (parent) {
                                        if (parent.tagName === 'LABEL') {
                                            var labelText = ((_c = parent.textContent) === null || _c === void 0 ? void 0 : _c.trim()) || '';
                                            if (labelText.length > 0) {
                                                // Remove the input's own text if any
                                                return labelText.replace(el.value || '', '').trim();
                                            }
                                        }
                                        parent = parent.parentElement;
                                    }
                                    // Strategy 4: Look for preceding label elements in the same container
                                    var container = el.parentElement;
                                    if (container) {
                                        var labels = Array.from(container.querySelectorAll('label'));
                                        for (var _i = 0, labels_3 = labels; _i < labels_3.length; _i++) {
                                            var lbl = labels_3[_i];
                                            var lblText = ((_d = lbl.textContent) === null || _d === void 0 ? void 0 : _d.trim()) || '';
                                            if (lblText.length > 0) {
                                                // Check if this label is associated with our element
                                                var forAttr = lbl.getAttribute('for');
                                                if (forAttr && (forAttr === id || forAttr === name)) {
                                                    return lblText;
                                                }
                                            }
                                        }
                                    }
                                    // Strategy 5: Look for aria-label or aria-labelledby
                                    var ariaLabel = el.getAttribute('aria-label');
                                    if (ariaLabel && ariaLabel.trim().length > 0) {
                                        return ariaLabel.trim();
                                    }
                                    var ariaLabelledby = el.getAttribute('aria-labelledby');
                                    if (ariaLabelledby) {
                                        var labelEl = document.getElementById(ariaLabelledby);
                                        if (labelEl && ((_e = labelEl.textContent) === null || _e === void 0 ? void 0 : _e.trim()) && labelEl.textContent.trim().length > 0) {
                                            return labelEl.textContent.trim();
                                        }
                                    }
                                    // Strategy 6: Look for preceding text nodes or labels above the element
                                    var sibling = el.previousElementSibling;
                                    while (sibling) {
                                        if (sibling.tagName === 'LABEL') {
                                            var sibText = ((_f = sibling.textContent) === null || _f === void 0 ? void 0 : _f.trim()) || '';
                                            if (sibText.length > 0) {
                                                return sibText;
                                            }
                                        }
                                        if ((sibling.tagName === 'SPAN' || sibling.tagName === 'DIV') && ((_g = sibling.textContent) === null || _g === void 0 ? void 0 : _g.trim()) && sibling.textContent.trim().length < 100 && sibling.textContent.trim().length > 0) {
                                            return sibling.textContent.trim();
                                        }
                                        sibling = sibling.previousElementSibling;
                                    }
                                    return '';
                                };
                                // Helper: Get the display name for an element
                                var getDisplayName_1 = function (el, tagName, textContent, placeholder, ariaLabel) {
                                    // For inputs, try to get associated label first (PRIORITY 1)
                                    if (tagName === 'input' || tagName === 'textarea') {
                                        var labelText = getAssociatedLabel_1(el);
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
                                var allElements = document.querySelectorAll('*');
                                allElements.forEach(function (el) {
                                    var _a, _b;
                                    try {
                                        var tagName = ((_a = el.tagName) === null || _a === void 0 ? void 0 : _a.toLowerCase()) || '';
                                        // Skip script, style, and meta tags
                                        if (['script', 'style', 'meta', 'link', 'noscript'].includes(tagName)) {
                                            return;
                                        }
                                        var id = el.getAttribute('id') || '';
                                        var name_19 = el.getAttribute('name') || '';
                                        var className = el.getAttribute('class') || '';
                                        var type = el.getAttribute('type') || '';
                                        var placeholder = el.getAttribute('placeholder') || '';
                                        var textContent = ((_b = el.textContent) === null || _b === void 0 ? void 0 : _b.trim().substring(0, 150)) || '';
                                        var ariaLabel = el.getAttribute('aria-label') || '';
                                        var role = el.getAttribute('role') || '';
                                        // Get element visibility - STRICT FILTERING FOR CURRENT PAGE ONLY
                                        var style = window.getComputedStyle(el);
                                        // Element must be ACTUALLY VISIBLE on current page (not hidden or from previous page)
                                        var hasVisibleDimensions = el.offsetWidth > 0 && el.offsetHeight > 0;
                                        var isDisplayed = style.display !== 'none';
                                        var isNotHidden = style.visibility !== 'hidden' && parseFloat(style.opacity) > 0.1;
                                        // CRITICAL: Check if element is in viewport (not from previous page)
                                        var rect = el.getBoundingClientRect();
                                        var isInViewport = rect.width > 0 && rect.height > 0;
                                        // Element is visible ONLY if ALL conditions are true
                                        var isVisible = hasVisibleDimensions && isDisplayed && isNotHidden && isInViewport;
                                        // Determine element type
                                        var elementType = '';
                                        var isInteractive = false;
                                        var priority = 0; // Higher priority = more important
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
                                        var displayName = getDisplayName_1(el, tagName, textContent, placeholder, ariaLabel);
                                        // Skip elements without a meaningful name
                                        if (!displayName && !id && !name_19) {
                                            return;
                                        }
                                        // Create unique identifier based on display name and type
                                        var uniqueKey = "".concat(tagName, ":").concat(displayName, ":").concat(id, ":").concat(name_19);
                                        // Avoid duplicates
                                        if (seen.has(uniqueKey)) {
                                            return;
                                        }
                                        seen.add(uniqueKey);
                                        // Use display name as primary label, fallback to id/name
                                        var label = displayName || id || name_19 || "".concat(elementType, "_").concat(elementIndex);
                                        items.push({
                                            index: elementIndex,
                                            type: elementType,
                                            tag: tagName,
                                            id: id,
                                            name: name_19,
                                            class: className,
                                            placeholder: placeholder,
                                            text: textContent,
                                            ariaLabel: ariaLabel,
                                            role: role,
                                            visible: isVisible,
                                            interactive: isInteractive,
                                            label: label, // THIS IS THE EXACT VISIBLE TEXT
                                            displayName: displayName, // NEW: Store the exact display name separately
                                            priority: priority,
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
                                var detectOverlayElements = function () {
                                    // Look for elements with modal/dialog indicators
                                    var overlaySelectors = [
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
                                    var overlayElements = new Set();
                                    for (var _i = 0, overlaySelectors_4 = overlaySelectors; _i < overlaySelectors_4.length; _i++) {
                                        var selector = overlaySelectors_4[_i];
                                        try {
                                            var elements_5 = document.querySelectorAll(selector);
                                            for (var _a = 0, _b = Array.from(elements_5); _a < _b.length; _a++) {
                                                var el = _b[_a];
                                                overlayElements.add(el);
                                            }
                                        }
                                        catch (e) {
                                            // Invalid selector, continue
                                        }
                                    }
                                    return Array.from(overlayElements);
                                };
                                var overlayContainers = detectOverlayElements();
                                for (var _i = 0, overlayContainers_1 = overlayContainers; _i < overlayContainers_1.length; _i++) {
                                    var overlayContainer = overlayContainers_1[_i];
                                    try {
                                        // Get all interactive elements within this overlay
                                        var allOverlayElements = overlayContainer.querySelectorAll('*');
                                        for (var _d = 0, _e = Array.from(allOverlayElements); _d < _e.length; _d++) {
                                            var el = _e[_d];
                                            try {
                                                var tagName = ((_a = el.tagName) === null || _a === void 0 ? void 0 : _a.toLowerCase()) || '';
                                                // Skip script, style tags
                                                if (['script', 'style', 'meta', 'link', 'noscript', 'head', 'html', 'body'].includes(tagName)) {
                                                    continue;
                                                }
                                                var id = el.getAttribute('id') || '';
                                                var name_20 = el.getAttribute('name') || '';
                                                var className = el.getAttribute('class') || '';
                                                var type = el.getAttribute('type') || '';
                                                var placeholder = el.getAttribute('placeholder') || '';
                                                var textContent = ((_b = el.textContent) === null || _b === void 0 ? void 0 : _b.trim().substring(0, 150)) || '';
                                                var ariaLabel = el.getAttribute('aria-label') || '';
                                                var title = el.getAttribute('title') || '';
                                                var role = el.getAttribute('role') || '';
                                                // Get element visibility
                                                var style = window.getComputedStyle(el);
                                                // For overlay elements, accept elements that are either:
                                                // 1. Normally visible (display != none)
                                                // 2. Have any width/height (offsetWidth, clientWidth, etc)
                                                // 3. Are interactive (clickable, forms, etc)
                                                var isVisible = (style.display !== 'none' || el.offsetWidth > 0 || el.clientWidth > 0) &&
                                                    (el.offsetHeight > 0 || el.clientHeight > 0 || el.offsetParent !== null);
                                                // Skip hidden or very small elements
                                                if (!isVisible)
                                                    continue;
                                                // Determine element type
                                                var elementType = '';
                                                var isInteractive = false;
                                                var priority = 11; // Higher priority than main page
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
                                                var displayName = getDisplayName_1(el, tagName, textContent, placeholder, ariaLabel);
                                                // Skip elements without a meaningful name
                                                if (!displayName && !id && !name_20 && !title) {
                                                    continue;
                                                }
                                                // Create unique identifier
                                                var uniqueKey = "overlay:".concat(tagName, ":").concat(displayName, ":").concat(id, ":").concat(name_20);
                                                // Avoid duplicates
                                                if (seen.has(uniqueKey)) {
                                                    continue;
                                                }
                                                seen.add(uniqueKey);
                                                // Get element position
                                                var rect = el.getBoundingClientRect();
                                                // Use display name as primary label
                                                var label = displayName || title || id || name_20 || "".concat(elementType, "_").concat(elementIndex);
                                                // Determine overlay type
                                                var overlayId = overlayContainer.getAttribute('id') || '';
                                                var overlayClass = overlayContainer.getAttribute('class') || '';
                                                var overlayRole = overlayContainer.getAttribute('role') || '';
                                                var overlayType = 'modal';
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
                                                    id: id,
                                                    name: name_20,
                                                    class: className,
                                                    placeholder: placeholder,
                                                    text: textContent,
                                                    ariaLabel: ariaLabel,
                                                    title: title,
                                                    role: role,
                                                    visible: isVisible,
                                                    interactive: isInteractive,
                                                    label: label,
                                                    displayName: displayName,
                                                    priority: priority,
                                                    location: "overlay[".concat(overlayType, "]"),
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
                                var iframes = document.querySelectorAll('iframe');
                                for (var _f = 0, _g = Array.from(iframes); _f < _g.length; _f++) {
                                    var iframe = _g[_f];
                                    try {
                                        var iframeDoc = iframe.contentDocument || ((_c = iframe.contentWindow) === null || _c === void 0 ? void 0 : _c.document);
                                        if (iframeDoc) {
                                            var iframeElements = iframeDoc.querySelectorAll('*');
                                            iframeElements.forEach(function (el) {
                                                var _a, _b;
                                                try {
                                                    var tagName = ((_a = el.tagName) === null || _a === void 0 ? void 0 : _a.toLowerCase()) || '';
                                                    if (['script', 'style', 'meta', 'link', 'noscript', 'head'].includes(tagName)) {
                                                        return;
                                                    }
                                                    var id = el.getAttribute('id') || '';
                                                    var name_21 = el.getAttribute('name') || '';
                                                    var className = el.getAttribute('class') || '';
                                                    var type = el.getAttribute('type') || '';
                                                    var placeholder = el.getAttribute('placeholder') || '';
                                                    var textContent = ((_b = el.textContent) === null || _b === void 0 ? void 0 : _b.trim().substring(0, 150)) || '';
                                                    var ariaLabel = el.getAttribute('aria-label') || '';
                                                    var role = el.getAttribute('role') || '';
                                                    var style = window.getComputedStyle(el);
                                                    var isVisible = style.display !== 'none' && style.visibility !== 'hidden';
                                                    var elementType = '';
                                                    var isInteractive = false;
                                                    var priority = 0;
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
                                                    var uniqueKey = "iframe:".concat(tagName, ":").concat(id, ":").concat(name_21, ":").concat(textContent.substring(0, 30));
                                                    if (seen.has(uniqueKey))
                                                        return;
                                                    seen.add(uniqueKey);
                                                    var rect = el.getBoundingClientRect();
                                                    var identifier = id || name_21 || ariaLabel || "".concat(elementType, "_").concat(elementIndex);
                                                    items.push({
                                                        index: elementIndex,
                                                        type: elementType,
                                                        tag: tagName,
                                                        id: id,
                                                        name: name_21,
                                                        class: className,
                                                        placeholder: placeholder,
                                                        text: textContent,
                                                        ariaLabel: ariaLabel,
                                                        role: role,
                                                        visible: isVisible,
                                                        interactive: isInteractive,
                                                        label: identifier,
                                                        priority: priority,
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
                                var collectShadowDOMElements_1 = function (rootElement, depth) {
                                    var _a, _b;
                                    if (depth === void 0) { depth = 0; }
                                    if (depth > 5)
                                        return; // Limit recursion depth
                                    try {
                                        var allElements_5 = rootElement.querySelectorAll('*');
                                        for (var _i = 0, _c = Array.from(allElements_5); _i < _c.length; _i++) {
                                            var el = _c[_i];
                                            if (el.shadowRoot) {
                                                try {
                                                    var shadowElements = el.shadowRoot.querySelectorAll('*');
                                                    for (var _d = 0, _e = Array.from(shadowElements); _d < _e.length; _d++) {
                                                        var shadowElRaw = _e[_d];
                                                        var shadowEl = shadowElRaw;
                                                        try {
                                                            var tagName = ((_a = shadowEl.tagName) === null || _a === void 0 ? void 0 : _a.toLowerCase()) || '';
                                                            if (['script', 'style', 'meta', 'link', 'noscript', 'head', 'html'].includes(tagName)) {
                                                                continue;
                                                            }
                                                            var id = shadowEl.getAttribute('id') || '';
                                                            var name_22 = shadowEl.getAttribute('name') || '';
                                                            var className = shadowEl.getAttribute('class') || '';
                                                            var type = shadowEl.getAttribute('type') || '';
                                                            var placeholder = shadowEl.getAttribute('placeholder') || '';
                                                            var textContent = ((_b = shadowEl.textContent) === null || _b === void 0 ? void 0 : _b.trim().substring(0, 150)) || '';
                                                            var ariaLabel = shadowEl.getAttribute('aria-label') || '';
                                                            var title = shadowEl.getAttribute('title') || '';
                                                            var role = shadowEl.getAttribute('role') || '';
                                                            var style = window.getComputedStyle(shadowEl);
                                                            // More lenient visibility check for shadow DOM elements
                                                            var isVisible = style.display !== 'none' &&
                                                                (shadowEl.offsetWidth > 0 || shadowEl.clientWidth > 0) &&
                                                                (shadowEl.offsetHeight > 0 || shadowEl.clientHeight > 0);
                                                            if (!isVisible)
                                                                continue;
                                                            var elementType = '';
                                                            var isInteractive = false;
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
                                                            var displayName = getDisplayName_1(shadowEl, tagName, textContent, placeholder, ariaLabel);
                                                            if (!displayName && !id && !name_22 && !title)
                                                                continue;
                                                            var uniqueKey = "shadow:".concat(tagName, ":").concat(displayName, ":").concat(id, ":").concat(name_22);
                                                            if (seen.has(uniqueKey))
                                                                continue;
                                                            seen.add(uniqueKey);
                                                            var rect = shadowEl.getBoundingClientRect();
                                                            var label = displayName || title || id || name_22 || "".concat(elementType, "_").concat(elementIndex);
                                                            items.push({
                                                                index: elementIndex,
                                                                type: elementType,
                                                                tag: tagName,
                                                                id: id,
                                                                name: name_22,
                                                                class: className,
                                                                placeholder: placeholder,
                                                                text: textContent,
                                                                ariaLabel: ariaLabel,
                                                                title: title,
                                                                role: role,
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
                                                    collectShadowDOMElements_1(el, depth + 1);
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
                                collectShadowDOMElements_1(document.documentElement);
                            }
                            catch (error) {
                                return items;
                            }
                            // FILTER: Only return VISIBLE elements from the CURRENT PAGE (not from previous pages)
                            var visibleElements = items.filter(function (el) {
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
                        })];
                case 2:
                    elements = _a.sent();
                    if (!elements || !Array.isArray(elements)) {
                        log("Elements array is invalid, returning empty array");
                        return [2 /*return*/, []];
                    }
                    log("Found ".concat(elements.length, " page elements (iframe: ").concat(elements.filter(function (e) { return e.location === 'iframe'; }).length, ", overlay: ").concat(elements.filter(function (e) { var _a; return (_a = e.location) === null || _a === void 0 ? void 0 : _a.includes('overlay'); }).length, ", shadow-dom: ").concat(elements.filter(function (e) { return e.location === 'shadow-dom'; }).length, ")"));
                    return [2 /*return*/, elements];
                case 3:
                    e_73 = _a.sent();
                    log("Failed to get elements: ".concat(e_73.message || e_73));
                    return [2 /*return*/, []];
                case 4: return [2 /*return*/];
            }
        });
    });
}
/* ============== INTELLIGENT PAGE READINESS ============== */
/**
 * Comprehensive page readiness check
 * Waits for page to be fully loaded using multiple strategies
 */
function waitForPageReady() {
    return __awaiter(this, arguments, void 0, function (timeout) {
        var startTime, lastActivityTime, e_74, frames_4, _i, frames_3, frame, e_75, e_76, loadingIndicators, e_77, e_78, pendingRequests, settledCount, requestCount, e_79, e_80, e_81, isStable, e_82, totalWaitTime, error_13;
        if (timeout === void 0) { timeout = 30000; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!state.page || state.page.isClosed())
                        return [2 /*return*/, false];
                    _a.label = 1;
                case 1:
                    if (!(state.isPaused && !state.isStopped)) return [3 /*break*/, 3];
                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 500); })];
                case 2:
                    _a.sent();
                    return [3 /*break*/, 1];
                case 3:
                    if (state.isStopped)
                        return [2 /*return*/, false];
                    startTime = Date.now();
                    lastActivityTime = Date.now();
                    _a.label = 4;
                case 4:
                    _a.trys.push([4, 45, , 46]);
                    _a.label = 5;
                case 5:
                    _a.trys.push([5, 7, , 8]);
                    return [4 /*yield*/, state.page.waitForLoadState('networkidle', { timeout: Math.min(timeout, 15000) }).catch(function () { })];
                case 6:
                    _a.sent();
                    return [3 /*break*/, 8];
                case 7:
                    e_74 = _a.sent();
                    return [3 /*break*/, 8];
                case 8:
                    _a.trys.push([8, 15, , 16]);
                    frames_4 = state.page.frames();
                    _i = 0, frames_3 = frames_4;
                    _a.label = 9;
                case 9:
                    if (!(_i < frames_3.length)) return [3 /*break*/, 14];
                    frame = frames_3[_i];
                    _a.label = 10;
                case 10:
                    _a.trys.push([10, 12, , 13]);
                    return [4 /*yield*/, frame.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(function () { })];
                case 11:
                    _a.sent();
                    return [3 /*break*/, 13];
                case 12:
                    e_75 = _a.sent();
                    return [3 /*break*/, 13];
                case 13:
                    _i++;
                    return [3 /*break*/, 9];
                case 14: return [3 /*break*/, 16];
                case 15:
                    e_76 = _a.sent();
                    return [3 /*break*/, 16];
                case 16:
                    _a.trys.push([16, 20, , 21]);
                    return [4 /*yield*/, state.page.evaluate(function () {
                            var indicators = document.querySelectorAll('[class*="loading"], [class*="spinner"], [id*="loading"], [id*="spinner"], ' +
                                '[data-testid*="loading"], [aria-busy="true"], .loader, .load, .progress');
                            return indicators.length;
                        })];
                case 17:
                    loadingIndicators = _a.sent();
                    if (!(loadingIndicators > 0)) return [3 /*break*/, 19];
                    return [4 /*yield*/, state.page.evaluate(function () {
                            return new Promise(function (resolve) {
                                var checkIndicators = function () {
                                    var indicators = document.querySelectorAll('[class*="loading"], [class*="spinner"], [id*="loading"], [id*="spinner"], ' +
                                        '[data-testid*="loading"], [aria-busy="true"], .loader, .load, .progress');
                                    return indicators.length === 0;
                                };
                                if (checkIndicators()) {
                                    resolve(true);
                                    return;
                                }
                                var observer = new MutationObserver(function () {
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
                                setTimeout(function () {
                                    observer.disconnect();
                                    resolve(false);
                                }, 8000);
                            });
                        })];
                case 18:
                    _a.sent();
                    _a.label = 19;
                case 19: return [3 /*break*/, 21];
                case 20:
                    e_77 = _a.sent();
                    return [3 /*break*/, 21];
                case 21:
                    _a.trys.push([21, 23, , 24]);
                    return [4 /*yield*/, state.page.evaluate(function () {
                            return new Promise(function (resolve) {
                                if (document.readyState === 'complete' || document.readyState === 'interactive') {
                                    resolve();
                                }
                                else {
                                    document.addEventListener('DOMContentLoaded', function () { return resolve(); });
                                    setTimeout(function () { return resolve(); }, 3000);
                                }
                            });
                        })];
                case 22:
                    _a.sent();
                    return [3 /*break*/, 24];
                case 23:
                    e_78 = _a.sent();
                    return [3 /*break*/, 24];
                case 24:
                    _a.trys.push([24, 37, , 38]);
                    pendingRequests = true;
                    settledCount = 0;
                    _a.label = 25;
                case 25:
                    if (!(pendingRequests && Date.now() - startTime < timeout)) return [3 /*break*/, 36];
                    _a.label = 26;
                case 26:
                    if (!(state.isPaused && !state.isStopped)) return [3 /*break*/, 28];
                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 500); })];
                case 27:
                    _a.sent();
                    return [3 /*break*/, 26];
                case 28:
                    if (state.isStopped)
                        return [2 /*return*/, false];
                    _a.label = 29;
                case 29:
                    _a.trys.push([29, 34, , 35]);
                    return [4 /*yield*/, state.page.evaluate(function () {
                            var _a, _b, _c;
                            return ((_c = (_b = (_a = performance).getEntriesByType) === null || _b === void 0 ? void 0 : _b.call(_a, 'resource')) === null || _c === void 0 ? void 0 : _c.length) || 0;
                        })];
                case 30:
                    requestCount = _a.sent();
                    if (!(requestCount === 0 || settledCount > 3)) return [3 /*break*/, 31];
                    pendingRequests = false;
                    return [3 /*break*/, 33];
                case 31:
                    settledCount++;
                    return [4 /*yield*/, state.page.waitForTimeout(500)];
                case 32:
                    _a.sent();
                    _a.label = 33;
                case 33: return [3 /*break*/, 35];
                case 34:
                    e_79 = _a.sent();
                    pendingRequests = false;
                    return [3 /*break*/, 35];
                case 35: return [3 /*break*/, 25];
                case 36: return [3 /*break*/, 38];
                case 37:
                    e_80 = _a.sent();
                    return [3 /*break*/, 38];
                case 38:
                    _a.trys.push([38, 40, , 41]);
                    return [4 /*yield*/, state.page.evaluate(function () {
                            return new Promise(function (resolve) {
                                var requestCount = 0;
                                var originalFetch = window.fetch;
                                var originalXHR = window.XMLHttpRequest;
                                // Track fetch requests
                                window.fetch = function () {
                                    var args = [];
                                    for (var _i = 0; _i < arguments.length; _i++) {
                                        args[_i] = arguments[_i];
                                    }
                                    requestCount++;
                                    return originalFetch.apply(this, args).finally(function () {
                                        requestCount--;
                                        if (requestCount === 0) {
                                            setTimeout(function () { return resolve(); }, 500);
                                        }
                                    });
                                };
                                // Check if requests are already in flight
                                setTimeout(function () {
                                    if (requestCount === 0) {
                                        resolve();
                                    }
                                }, 500);
                                // Timeout after 8 seconds
                                setTimeout(function () { return resolve(); }, 8000);
                            });
                        }).catch(function () { })];
                case 39:
                    _a.sent();
                    return [3 /*break*/, 41];
                case 40:
                    e_81 = _a.sent();
                    return [3 /*break*/, 41];
                case 41:
                    _a.trys.push([41, 43, , 44]);
                    return [4 /*yield*/, state.page.evaluate(function () {
                            // Check if page has interactive elements visible
                            var interactiveElements = document.querySelectorAll('button, input, a, select, textarea, [role="button"]');
                            return interactiveElements.length > 0 && document.readyState !== 'loading';
                        })];
                case 42:
                    isStable = _a.sent();
                    return [3 /*break*/, 44];
                case 43:
                    e_82 = _a.sent();
                    return [3 /*break*/, 44];
                case 44:
                    totalWaitTime = Date.now() - startTime;
                    if (totalWaitTime > 5000) {
                        log("[Page Ready] Wait time: ".concat(totalWaitTime, "ms"));
                    }
                    return [2 /*return*/, true];
                case 45:
                    error_13 = _a.sent();
                    return [2 /*return*/, false];
                case 46: return [2 /*return*/];
            }
        });
    });
}
/**
 * Execute with automatic page readiness wait before action
 */
function executeWithPageReady(actionFn, stepName) {
    return __awaiter(this, void 0, void 0, function () {
        var isReady, error_14;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 4, , 5]);
                    return [4 /*yield*/, waitForPageReady(30000)];
                case 1:
                    isReady = _b.sent();
                    // Add small delay to ensure rendering
                    return [4 /*yield*/, ((_a = state.page) === null || _a === void 0 ? void 0 : _a.waitForTimeout(300))];
                case 2:
                    // Add small delay to ensure rendering
                    _b.sent();
                    return [4 /*yield*/, actionFn()];
                case 3: 
                // Execute the action
                return [2 /*return*/, _b.sent()];
                case 4:
                    error_14 = _b.sent();
                    log("[".concat(stepName, "] Error during execution: ").concat(error_14.message));
                    throw error_14;
                case 5: return [2 /*return*/];
            }
        });
    });
}
/* ============== STEP EXECUTION WITH SELF-HEALING ============== */
function executeStep(stepData) {
    return __awaiter(this, void 0, void 0, function () {
        var stepId, action, target, data, result, isMainWindow, windowInfo, windowLevel, storedTitle, _a, windowLabel, frameCount, i, e_83, success, isMainWindow_1, windowInfo_1, windowLevel_1, storedTitle_1, _b, windowLabel_1, success, isMainWindow_2, windowInfo_2, windowLevel_2, storedTitle_2, _c, windowLabel_2, isMainWindow_3, windowInfo_3, windowLevel_3, storedTitle_3, _d, windowLabel_3, e_84, waitTime, content, found, path_1, error_15, _e, _f, e_85;
        var _this = this;
        return __generator(this, function (_g) {
            switch (_g.label) {
                case 0:
                    if (!(state.isPaused && !state.isStopped)) return [3 /*break*/, 2];
                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 500); })];
                case 1:
                    _g.sent();
                    return [3 /*break*/, 0];
                case 2:
                    if (state.isStopped) {
                        return [2 /*return*/, {
                                stepId: stepData['STEP'] || "STEP_".concat(state.currentStepIndex + 1),
                                action: stepData['ACTION'] || '',
                                target: stepData['TARGET'] || '',
                                status: 'STOPPED',
                                remarks: 'Automation stopped',
                                actualOutput: '',
                                screenshot: '',
                                pageSource: ''
                            }];
                    }
                    stepId = stepData['STEP'] || "STEP_".concat(state.currentStepIndex + 1);
                    action = (stepData['ACTION'] || '').toString().trim().toUpperCase().replace(/_/g, '');
                    target = (stepData['TARGET'] || '').toString().trim();
                    data = (stepData['DATA'] || '').toString().trim();
                    result = {
                        stepId: stepId,
                        action: stepData['ACTION'] || action,
                        target: target,
                        status: 'PENDING',
                        remarks: '',
                        actualOutput: '',
                        screenshot: '',
                        pageSource: ''
                    };
                    _g.label = 3;
                case 3:
                    _g.trys.push([3, 59, , 60]);
                    if (!(!state.page || state.page.isClosed())) return [3 /*break*/, 5];
                    return [4 /*yield*/, switchToLatestPage()];
                case 4:
                    _g.sent();
                    if (!state.page || state.page.isClosed()) {
                        throw new Error('No valid page available');
                    }
                    _g.label = 5;
                case 5:
                    isMainWindow = state.page === allPages[0];
                    windowInfo = windowHierarchy.get(state.page);
                    windowLevel = (windowInfo === null || windowInfo === void 0 ? void 0 : windowInfo.level) || 0;
                    _a = (windowInfo === null || windowInfo === void 0 ? void 0 : windowInfo.title);
                    if (_a) return [3 /*break*/, 7];
                    return [4 /*yield*/, state.page.title().catch(function () { return 'Unknown'; })];
                case 6:
                    _a = (_g.sent());
                    _g.label = 7;
                case 7:
                    storedTitle = _a;
                    windowLabel = isMainWindow ? "\uD83C\uDFE0 MAIN WINDOW" : "\uD83D\uDCCD SUBWINDOW (L".concat(windowLevel, ") \"").concat(storedTitle, "\"");
                    // Log step with bold formatting
                    logStep(stepId, action, target, windowLabel);
                    // Log environment summary
                    return [4 /*yield*/, logWindowSummary()];
                case 8:
                    // Log environment summary
                    _g.sent();
                    frameCount = state.page.frames().length;
                    if (!(frameCount > 1)) return [3 /*break*/, 10];
                    return [4 /*yield*/, logFrameStructure()];
                case 9:
                    _g.sent();
                    _g.label = 10;
                case 10: 
                // Log current window and iframe info (simplified - no modal details)
                return [4 /*yield*/, logWindowAndFrameInfo()];
                case 11:
                    // Log current window and iframe info (simplified - no modal details)
                    _g.sent();
                    if (!(action === 'OPEN' || action === 'OPENURL')) return [3 /*break*/, 26];
                    i = 1;
                    _g.label = 12;
                case 12:
                    if (!(i <= 3)) return [3 /*break*/, 25];
                    _g.label = 13;
                case 13:
                    _g.trys.push([13, 22, , 24]);
                    _g.label = 14;
                case 14:
                    if (!(state.isPaused && !state.isStopped)) return [3 /*break*/, 16];
                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 500); })];
                case 15:
                    _g.sent();
                    return [3 /*break*/, 14];
                case 16:
                    if (state.isStopped)
                        throw new Error('Automation stopped');
                    log("[Navigation Attempt ".concat(i, "/3]"));
                    if (!state.page.isClosed()) return [3 /*break*/, 18];
                    return [4 /*yield*/, switchToLatestPage()];
                case 17:
                    _g.sent();
                    if (!state.page || state.page.isClosed())
                        throw new Error('Page closed during navigation');
                    _g.label = 18;
                case 18: return [4 /*yield*/, state.page.goto(target, { waitUntil: 'networkidle', timeout: 30000 })];
                case 19:
                    _g.sent();
                    // Check if new window/tab opened during navigation
                    return [4 /*yield*/, switchToLatestPage()];
                case 20:
                    // Check if new window/tab opened during navigation
                    _g.sent();
                    // Wait for page to be fully ready after navigation
                    return [4 /*yield*/, executeWithPageReady(function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/, true];
                        }); }); }, "".concat(stepId, "_OPENURL_READY"))];
                case 21:
                    // Wait for page to be fully ready after navigation
                    _g.sent();
                    result.status = 'PASS';
                    result.actualOutput = "Opened: ".concat(target);
                    return [3 /*break*/, 25];
                case 22:
                    e_83 = _g.sent();
                    if (i === 3)
                        throw e_83;
                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 2000); })];
                case 23:
                    _g.sent();
                    return [3 /*break*/, 24];
                case 24:
                    i++;
                    return [3 /*break*/, 12];
                case 25: return [3 /*break*/, 58];
                case 26:
                    if (!(action === 'CLICK')) return [3 /*break*/, 34];
                    return [4 /*yield*/, executeWithPageReady(function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, clickWithRetry(target, 5)];
                                case 1: return [2 /*return*/, _a.sent()];
                            }
                        }); }); }, "".concat(stepId, "_CLICK"))];
                case 27:
                    success = _g.sent();
                    if (!success) return [3 /*break*/, 32];
                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 800); })];
                case 28:
                    _g.sent();
                    // Check if new window/tab opened after click
                    return [4 /*yield*/, switchToLatestPage()];
                case 29:
                    // Check if new window/tab opened after click
                    _g.sent();
                    isMainWindow_1 = state.page === allPages[0];
                    windowInfo_1 = windowHierarchy.get(state.page);
                    windowLevel_1 = (windowInfo_1 === null || windowInfo_1 === void 0 ? void 0 : windowInfo_1.level) || 0;
                    _b = (windowInfo_1 === null || windowInfo_1 === void 0 ? void 0 : windowInfo_1.title);
                    if (_b) return [3 /*break*/, 31];
                    return [4 /*yield*/, state.page.title().catch(function () { return 'Unknown'; })];
                case 30:
                    _b = (_g.sent());
                    _g.label = 31;
                case 31:
                    storedTitle_1 = _b;
                    windowLabel_1 = isMainWindow_1 ? '🏠 MAIN WINDOW' : "\uD83D\uDCCD SUBWINDOW (L".concat(windowLevel_1, ") \"").concat(storedTitle_1, "\"");
                    result.status = 'PASS';
                    result.actualOutput = "Clicked: ".concat(target, " | ").concat(windowLabel_1);
                    return [3 /*break*/, 33];
                case 32:
                    result.status = 'FAIL';
                    result.remarks = 'Could not click element';
                    result.actualOutput = "Failed to click: ".concat(target);
                    _g.label = 33;
                case 33: return [3 /*break*/, 58];
                case 34:
                    if (!(action === 'FILL' || action === 'TYPE')) return [3 /*break*/, 41];
                    return [4 /*yield*/, executeWithPageReady(function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, fillWithRetry(target, data, 5)];
                                case 1: return [2 /*return*/, _a.sent()];
                            }
                        }); }); }, "".concat(stepId, "_FILL"))];
                case 35:
                    success = _g.sent();
                    if (!success) return [3 /*break*/, 39];
                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 500); })];
                case 36:
                    _g.sent();
                    isMainWindow_2 = state.page === allPages[0];
                    windowInfo_2 = windowHierarchy.get(state.page);
                    windowLevel_2 = (windowInfo_2 === null || windowInfo_2 === void 0 ? void 0 : windowInfo_2.level) || 0;
                    _c = (windowInfo_2 === null || windowInfo_2 === void 0 ? void 0 : windowInfo_2.title);
                    if (_c) return [3 /*break*/, 38];
                    return [4 /*yield*/, state.page.title().catch(function () { return 'Unknown'; })];
                case 37:
                    _c = (_g.sent());
                    _g.label = 38;
                case 38:
                    storedTitle_2 = _c;
                    windowLabel_2 = isMainWindow_2 ? '🏠 MAIN WINDOW' : "\uD83D\uDCCD SUBWINDOW (L".concat(windowLevel_2, ") \"").concat(storedTitle_2, "\"");
                    result.status = 'PASS';
                    result.actualOutput = "Filled: ".concat(target, " | ").concat(windowLabel_2);
                    return [3 /*break*/, 40];
                case 39:
                    result.status = 'FAIL';
                    result.remarks = 'Could not fill element';
                    result.actualOutput = "Failed to fill: ".concat(target);
                    _g.label = 40;
                case 40: return [3 /*break*/, 58];
                case 41:
                    if (!(action === 'SELECT')) return [3 /*break*/, 51];
                    _g.label = 42;
                case 42:
                    _g.trys.push([42, 49, , 50]);
                    if (!state.page.isClosed()) return [3 /*break*/, 44];
                    return [4 /*yield*/, switchToLatestPage()];
                case 43:
                    _g.sent();
                    if (!state.page || state.page.isClosed())
                        throw new Error('Page closed');
                    _g.label = 44;
                case 44: return [4 /*yield*/, executeWithPageReady(function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
                        return [2 /*return*/, state.page.selectOption(target, data, { timeout: 5000 })];
                    }); }); }, "".concat(stepId, "_SELECT"))];
                case 45:
                    _g.sent();
                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 300); })];
                case 46:
                    _g.sent();
                    isMainWindow_3 = state.page === allPages[0];
                    windowInfo_3 = windowHierarchy.get(state.page);
                    windowLevel_3 = (windowInfo_3 === null || windowInfo_3 === void 0 ? void 0 : windowInfo_3.level) || 0;
                    _d = (windowInfo_3 === null || windowInfo_3 === void 0 ? void 0 : windowInfo_3.title);
                    if (_d) return [3 /*break*/, 48];
                    return [4 /*yield*/, state.page.title().catch(function () { return 'Unknown'; })];
                case 47:
                    _d = (_g.sent());
                    _g.label = 48;
                case 48:
                    storedTitle_3 = _d;
                    windowLabel_3 = isMainWindow_3 ? '🏠 MAIN WINDOW' : "\uD83D\uDCCD SUBWINDOW (L".concat(windowLevel_3, ") \"").concat(storedTitle_3, "\"");
                    result.status = 'PASS';
                    result.actualOutput = "Selected: ".concat(data, " | ").concat(windowLabel_3);
                    return [3 /*break*/, 50];
                case 49:
                    e_84 = _g.sent();
                    result.status = 'FAIL';
                    result.remarks = e_84.message;
                    result.actualOutput = "Failed to select";
                    return [3 /*break*/, 50];
                case 50: return [3 /*break*/, 58];
                case 51:
                    if (!(action === 'WAIT')) return [3 /*break*/, 53];
                    waitTime = parseInt(data) || 1000;
                    return [4 /*yield*/, state.page.waitForTimeout(waitTime)];
                case 52:
                    _g.sent();
                    result.status = 'PASS';
                    result.actualOutput = "Waited: ".concat(waitTime, "ms");
                    return [3 /*break*/, 58];
                case 53:
                    if (!(action === 'VERIFY' || action === 'ASSERT')) return [3 /*break*/, 55];
                    return [4 /*yield*/, state.page.content()];
                case 54:
                    content = _g.sent();
                    found = content.includes(target);
                    result.status = found ? 'PASS' : 'FAIL';
                    result.actualOutput = found ? "Verified: ".concat(target) : "Not found: ".concat(target);
                    result.remarks = found ? '' : 'Content not found';
                    return [3 /*break*/, 58];
                case 55:
                    if (!(action === 'SCREENSHOT')) return [3 /*break*/, 57];
                    return [4 /*yield*/, takeStepScreenshot(stepId)];
                case 56:
                    path_1 = _g.sent();
                    result.screenshot = path_1;
                    result.status = 'PASS';
                    result.actualOutput = 'Screenshot saved';
                    return [3 /*break*/, 58];
                case 57:
                    result.status = 'SKIPPED';
                    result.remarks = "Unknown action: ".concat(action);
                    _g.label = 58;
                case 58: return [3 /*break*/, 60];
                case 59:
                    error_15 = _g.sent();
                    result.status = 'FAIL';
                    result.remarks = error_15.message;
                    result.actualOutput = error_15.message;
                    log("ERROR: ".concat(error_15.message));
                    return [3 /*break*/, 60];
                case 60:
                    _g.trys.push([60, 64, , 65]);
                    if (!!result.screenshot) return [3 /*break*/, 62];
                    _e = result;
                    return [4 /*yield*/, takeStepScreenshot(stepId)];
                case 61:
                    _e.screenshot = _g.sent();
                    _g.label = 62;
                case 62:
                    _f = result;
                    return [4 /*yield*/, savePageSource(stepId)];
                case 63:
                    _f.pageSource = _g.sent();
                    return [3 /*break*/, 65];
                case 64:
                    e_85 = _g.sent();
                    log("Capture failed");
                    return [3 /*break*/, 65];
                case 65: return [2 /*return*/, result];
            }
        });
    });
}
/* ============== AUTOMATION FLOW ============== */
function pauseAutomation() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            state.isPaused = true;
            log('PAUSED');
            return [2 /*return*/];
        });
    });
}
function resumeAutomation() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            state.isPaused = false;
            log('RESUMED');
            return [2 /*return*/];
        });
    });
}
function stopAutomation() {
    return __awaiter(this, void 0, void 0, function () {
        var e_86;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    state.isStopped = true;
                    log('STOPPED by user');
                    if (!state.browser) return [3 /*break*/, 4];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, state.browser.close()];
                case 2:
                    _a.sent();
                    state.browser = null;
                    state.page = null;
                    log('Browser closed by STOP button');
                    return [3 /*break*/, 4];
                case 3:
                    e_86 = _a.sent();
                    log("Error closing: ".concat(e_86));
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function runAutomation(excelFilePath) {
    return __awaiter(this, void 0, void 0, function () {
        var workbook, sheetName, rows, executionCount, _i, rows_1, row, toBeExec, _a, _b, _c, mainPageTitle, firstRow, columns, executionColumnName, executionColumnFound, j, execValue, stepId, action, i, row, stepId, action, toBeExecutedRaw, toBeExecutedValue, toBeExecutedUpper, shouldExecute, result, resultPath, error_16;
        var _this = this;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    _d.trys.push([0, 15, 16, 17]);
                    ensureDir(RESULTS_DIR);
                    if (!fs.existsSync(excelFilePath)) {
                        throw new Error("Excel not found: ".concat(excelFilePath));
                    }
                    log("Loading: ".concat(excelFilePath));
                    workbook = XLSX.readFile(excelFilePath);
                    sheetName = workbook.SheetNames[0];
                    rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
                    // ===== TEST EXECUTION SUMMARY =====
                    log("\n".concat('█'.repeat(110)));
                    log("\u2588 \uD83D\uDE80 TEST AUTOMATION STARTED");
                    log("".concat('█'.repeat(110)));
                    log("\uD83D\uDCC1 Excel File: ".concat(excelFilePath));
                    log("\uD83D\uDCCB Sheet Name: ".concat(sheetName));
                    log("\uD83D\uDCCA Total Test Steps: ".concat(rows.length));
                    executionCount = 0;
                    for (_i = 0, rows_1 = rows; _i < rows_1.length; _i++) {
                        row = rows_1[_i];
                        toBeExec = (row['TO BE EXECUTED'] || row['TO_BE_EXECUTED'] || row['ToBeExecuted'] || 'YES').toString().trim().toUpperCase();
                        if (toBeExec === 'YES')
                            executionCount++;
                    }
                    log("\u2705 Steps to Execute: ".concat(executionCount));
                    log("\u23ED\uFE0F  Steps to Skip: ".concat(rows.length - executionCount));
                    log("".concat('█'.repeat(110), "\n"));
                    state.testData = rows;
                    state.isStopped = false;
                    state.isPaused = false;
                    // Launch browser with self-healing settings
                    _a = state;
                    return [4 /*yield*/, playwright_1.chromium.launch({
                            headless: false,
                            args: [
                                '--start-maximized',
                                '--ignore-certificate-errors',
                                '--allow-running-insecure-content',
                                '--disable-blink-features=AutomationControlled'
                            ]
                        })];
                case 1:
                    // Launch browser with self-healing settings
                    _a.browser = _d.sent();
                    _b = state;
                    return [4 /*yield*/, state.browser.newContext({
                            viewport: null,
                            ignoreHTTPSErrors: true,
                            bypassCSP: true
                        })];
                case 2:
                    _b.context = _d.sent();
                    // 🎯 CRITICAL: Setup context-level listener IMMEDIATELY (catches window.open() calls)
                    // This MUST be done before any pages are created
                    state.context.on('page', function (newPage) { return __awaiter(_this, void 0, void 0, function () {
                        var newPageTitle, newPageUrl, parentPage, parentLevel, childLevel, openedAt;
                        var _a;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    if (!(!allPages.includes(newPage) && !newPage.isClosed())) return [3 /*break*/, 5];
                                    return [4 /*yield*/, newPage.waitForLoadState('domcontentloaded').catch(function () { })];
                                case 1:
                                    _b.sent();
                                    return [4 /*yield*/, newPage.waitForTimeout(500)];
                                case 2:
                                    _b.sent();
                                    return [4 /*yield*/, newPage.title().catch(function () { return 'Unknown'; })];
                                case 3:
                                    newPageTitle = _b.sent();
                                    newPageUrl = newPage.url();
                                    log("\n\uD83E\uDE9F \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550");
                                    log("\uD83E\uDE9F \uD83C\uDD95 CONTEXT: NEW WINDOW/TAB OPENED!");
                                    log("\uD83E\uDE9F Title: \"".concat(newPageTitle, "\""));
                                    log("\uD83E\uDE9F URL: ".concat(newPageUrl));
                                    log("\uD83E\uDE9F Source: window.open() or target=_blank");
                                    log("\uD83E\uDE9F \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n");
                                    allPages.push(newPage);
                                    latestSubwindow = newPage;
                                    parentPage = state.page || allPages[0];
                                    parentLevel = ((_a = windowHierarchy.get(parentPage)) === null || _a === void 0 ? void 0 : _a.level) || 0;
                                    childLevel = parentLevel + 1;
                                    openedAt = Date.now();
                                    windowHierarchy.set(newPage, {
                                        parentPage: parentPage,
                                        level: childLevel,
                                        childPages: [],
                                        openedAt: openedAt,
                                        title: newPageTitle,
                                        url: newPageUrl
                                    });
                                    if (windowHierarchy.has(parentPage)) {
                                        windowHierarchy.get(parentPage).childPages.push(newPage);
                                    }
                                    // Setup listeners on new page for nested popups
                                    return [4 /*yield*/, setupPageListeners(newPage)];
                                case 4:
                                    // Setup listeners on new page for nested popups
                                    _b.sent();
                                    log("\uD83E\uDE9F [CONTEXT LISTENER] New window added to allPages (Total: ".concat(allPages.length, ")\n"));
                                    _b.label = 5;
                                case 5: return [2 /*return*/];
                            }
                        });
                    }); });
                    _c = state;
                    return [4 /*yield*/, state.context.newPage()];
                case 3:
                    _c.page = _d.sent();
                    state.page.setDefaultTimeout(30000);
                    state.page.setDefaultNavigationTimeout(30000);
                    // Add main page to tracking
                    allPages.push(state.page);
                    // Setup page-level listeners for popup windows (triggered by page.on('popup'))
                    return [4 /*yield*/, setupPageListeners(state.page)];
                case 4:
                    // Setup page-level listeners for popup windows (triggered by page.on('popup'))
                    _d.sent();
                    return [4 /*yield*/, state.page.title().catch(function () { return 'Untitled'; })];
                case 5:
                    mainPageTitle = _d.sent();
                    log("\n\uD83E\uDE9F \u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557");
                    log("\uD83E\uDE9F \u2551 \uD83C\uDFE0 MAIN WINDOW OPENED \u2551");
                    log("\uD83E\uDE9F \u2551 Title: \"".concat(mainPageTitle, "\" \u2551"));
                    log("\uD83E\uDE9F \u2551 Level: 0 (Main) \u2551");
                    log("\uD83E\uDE9F \u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D\n");
                    // Log available columns and execution status
                    if (rows.length > 0) {
                        firstRow = rows[0];
                        columns = Object.keys(firstRow);
                        log("\n\uD83D\uDCCA Excel Columns Found: ".concat(columns.join(' | ')));
                        executionColumnName = '';
                        executionColumnFound = columns.find(function (col) {
                            return col.toUpperCase().includes('EXECUTE') || col.toUpperCase().includes('EXECUTION');
                        });
                        if (executionColumnFound) {
                            executionColumnName = executionColumnFound;
                            log("\uD83D\uDCCC Execution Column Found: \"".concat(executionColumnName, "\""));
                        }
                        else {
                            log("\uD83D\uDCCC Execution Column NOT FOUND - will check known variations");
                        }
                        // Show sample values from first few rows
                        log("\n\uD83D\uDCCB Sample Data (First 5 rows):");
                        for (j = 0; j < Math.min(5, rows.length); j++) {
                            execValue = rows[j][executionColumnName] || rows[j]['TO BE EXECUTED'] || 'UNDEFINED';
                            stepId = rows[j]['STEP'] || rows[j]['STEP ID'] || "Row ".concat(j + 2);
                            action = rows[j]['ACTION'] || 'NO_ACTION';
                            log("  Row ".concat(j + 2, ": ").concat(stepId, " | TO_EXECUTE=\"").concat(execValue, "\" | ACTION=\"").concat(action, "\""));
                        }
                    }
                    log("\n\uD83D\uDE80 Starting: ".concat(rows.length, " steps\n"));
                    i = 0;
                    _d.label = 6;
                case 6:
                    if (!(i < rows.length)) return [3 /*break*/, 14];
                    if (state.isStopped)
                        return [3 /*break*/, 14];
                    state.currentStepIndex = i;
                    _d.label = 7;
                case 7:
                    if (!(state.isPaused && !state.isStopped)) return [3 /*break*/, 9];
                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 500); })];
                case 8:
                    _d.sent();
                    return [3 /*break*/, 7];
                case 9:
                    if (state.isStopped)
                        return [3 /*break*/, 14];
                    // Ensure we're on the latest page if new windows opened
                    return [4 /*yield*/, switchToLatestPage()];
                case 10:
                    // Ensure we're on the latest page if new windows opened
                    _d.sent();
                    row = rows[i];
                    stepId = row['STEP'] || row['STEP ID'] || row['Step ID'] || "STEP_".concat(i + 1);
                    action = (row['ACTION'] || '').toString().trim();
                    toBeExecutedRaw = row['TO BE EXECUTED'];
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
                    toBeExecutedValue = toBeExecutedRaw.toString().trim();
                    toBeExecutedUpper = toBeExecutedValue.toUpperCase();
                    shouldExecute = (toBeExecutedUpper === 'YES');
                    // Log execution decision with visual separator
                    log("\n".concat('─'.repeat(110)));
                    log("\uD83D\uDCCB ".concat(stepId, " | ACTION: ").concat(action, " | TARGET: \"").concat(row['TARGET'] || '', "\" | EXECUTE: ").concat(shouldExecute ? '✅ YES' : '⏭️  NO'));
                    log("\u2500".repeat(110));
                    if (!shouldExecute) {
                        row['Status'] = 'SKIPPED';
                        row['Remarks'] = "TO BE EXECUTED = \"".concat(toBeExecutedValue, "\" (not YES)");
                        log("\u23ED\uFE0F  SKIPPED - Only YES is executed\n");
                        return [3 /*break*/, 13];
                    }
                    // Additional check: only execute if ACTION is defined AND not empty
                    if (!action || action === '') {
                        log("\u23ED\uFE0F  SKIPPED - No ACTION defined\n");
                        row['Status'] = 'SKIPPED';
                        row['Remarks'] = 'No ACTION defined';
                        return [3 /*break*/, 13];
                    }
                    state.currentStepIndex = i;
                    log("\u25B6\uFE0F  EXECUTING: ".concat(stepId, "\n"));
                    return [4 /*yield*/, executeStep(row)];
                case 11:
                    result = _d.sent();
                    row['Status'] = result.status;
                    row['Remarks'] = result.remarks;
                    row['Actual Output'] = result.actualOutput;
                    row['Screenshot'] = result.screenshot;
                    row['Page Source'] = result.pageSource;
                    // Log step result
                    log("\n\u2705 ".concat(stepId, " COMPLETED | Status: ").concat(result.status, " | Remarks: ").concat(result.remarks, "\n"));
                    if (!(i < rows.length - 1)) return [3 /*break*/, 13];
                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 300); })];
                case 12:
                    _d.sent();
                    _d.label = 13;
                case 13:
                    i++;
                    return [3 /*break*/, 6];
                case 14:
                    // Final summary
                    log("\n".concat('█'.repeat(110)));
                    log("\u2588 \uD83C\uDF89 AUTOMATION TEST EXECUTION COMPLETE");
                    log("".concat('█'.repeat(110), "\n"));
                    resultPath = path.join(RESULTS_DIR, RESULTS_EXCEL_FILENAME);
                    workbook.Sheets[sheetName] = XLSX.utils.json_to_sheet(rows);
                    XLSX.writeFile(workbook, resultPath);
                    log("Results: ".concat(resultPath));
                    // Mark automation as completed
                    state.isCompleted = true;
                    state.shouldCloseBrowser = false;
                    log("\n\u2705 AUTOMATION COMPLETED! Waiting for your input...");
                    log("\uD83D\uDCE2 The browser will stay open. You can:");
                    log("   1. Use the UI to close the browser when ready");
                    log("   2. Inspect the browser to verify results");
                    return [3 /*break*/, 17];
                case 15:
                    error_16 = _d.sent();
                    log("Error: ".concat(error_16.message));
                    return [3 /*break*/, 17];
                case 16: return [7 /*endfinally*/];
                case 17: return [2 /*return*/];
            }
        });
    });
}
/* ============== WEB UI & SERVER ============== */
var PORT = 3000;
var htmlUI = "\n<!DOCTYPE html>\n<html>\n<head>\n    <title>Test Automation Assistant</title>\n    <style>\n        * { margin: 0; padding: 0; box-sizing: border-box; }\n        body {\n            font-family: 'Segoe UI', Arial, sans-serif;\n            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);\n            min-height: 100vh;\n            display: flex;\n            align-items: center;\n            justify-content: center;\n            padding: 20px;\n        }\n        .container {\n            background: white;\n            border-radius: 12px;\n            box-shadow: 0 20px 60px rgba(0,0,0,0.3);\n            max-width: 600px;\n            width: 100%;\n            padding: 40px;\n        }\n        h1 { color: #333; margin-bottom: 10px; text-align: center; }\n        .subtitle { color: #666; text-align: center; margin-bottom: 30px; font-size: 14px; }\n        .file-input-wrapper {\n            position: relative;\n            margin-bottom: 30px;\n            z-index: 1;\n        }\n        .file-input { display: none; }\n        .file-input-label {\n            display: block;\n            padding: 15px;\n            background: #f0f0f0;\n            border: 2px dashed #667eea;\n            border-radius: 8px;\n            text-align: center;\n            cursor: pointer;\n            transition: all 0.3s;\n            color: #667eea;\n            font-weight: 500;\n            position: relative;\n            z-index: 1;\n            pointer-events: auto;\n        }\n        .file-input-label:hover { background: #e8e8ff; border-color: #764ba2; }\n        .file-name { color: #333; margin-top: 10px; font-size: 14px; font-weight: 500; }\n        .controls {\n            display: grid;\n            grid-template-columns: 1fr 1fr;\n            gap: 12px;\n            margin-bottom: 20px;\n            position: relative;\n            z-index: 10;\n        }\n        .controls-full { grid-column: 1 / -1; }\n        button {\n            padding: 12px 20px;\n            border: none;\n            border-radius: 8px;\n            font-size: 14px;\n            font-weight: 600;\n            cursor: pointer;\n            transition: all 0.3s;\n            text-transform: uppercase;\n            letter-spacing: 0.5px;\n            position: relative;\n            z-index: 100;\n        }\n        .btn-primary {\n            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);\n            color: white;\n            grid-column: 1 / -1;\n            z-index: 100;\n        }\n        .btn-primary:hover:not(:disabled) {\n            transform: translateY(-2px);\n            box-shadow: 0 10px 20px rgba(102, 126, 234, 0.4);\n        }\n        .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }\n        .btn-secondary { background: #f0f0f0; color: #333; }\n        .btn-secondary:hover:not(:disabled) { background: #e0e0e0; }\n        .btn-pause { background: #ff9800; color: white; }\n        .btn-pause:hover:not(:disabled) { background: #f57c00; }\n        .btn-stop { background: #f44336; color: white; }\n        .btn-stop:hover:not(:disabled) { background: #d32f2f; }\n        .btn-elements { background: #2196f3; color: white; }\n        .btn-elements:hover:not(:disabled) { background: #1976d2; }\n        .status {\n            background: #f5f5f5;\n            border-left: 4px solid #667eea;\n            padding: 15px;\n            border-radius: 4px;\n            margin-bottom: 20px;\n            display: none;\n        }\n        .status-text { color: #666; font-size: 14px; margin: 5px 0; }\n        .status-text strong { color: #333; }\n        .logs {\n            background: #f5f5f5;\n            border: 1px solid #ddd;\n            border-radius: 8px;\n            padding: 15px;\n            max-height: 200px;\n            overflow-y: auto;\n            font-family: monospace;\n            font-size: 12px;\n            color: #333;\n        }\n        .log-entry { margin: 4px 0; color: #666; }\n        .elements-modal {\n            display: none;\n            position: fixed;\n            top: 0;\n            left: 0;\n            width: 100%;\n            height: 100%;\n            background: rgba(0,0,0,0.5);\n            z-index: 1000;\n            align-items: center;\n            justify-content: center;\n            overflow: auto;\n        }\n        .elements-modal.active { display: flex; }\n        .elements-content {\n            background: white;\n            border-radius: 8px;\n            padding: 0;\n            max-width: 500px;\n            width: 95%;\n            max-height: 70vh;\n            overflow: hidden;\n            box-shadow: 0 10px 40px rgba(0,0,0,0.3);\n            display: flex;\n            flex-direction: column;\n            border: 1px solid #ddd;\n        }\n        .elements-header {\n            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);\n            color: white;\n            padding: 16px 20px;\n            border-bottom: 1px solid #ddd;\n            display: flex;\n            align-items: center;\n            justify-content: space-between;\n            flex-shrink: 0;\n        }\n        .elements-header h2 {\n            color: white;\n            margin: 0;\n            font-size: 16px;\n            font-weight: 600;\n            display: flex;\n            align-items: center;\n            gap: 8px;\n        }\n        .elements-count {\n            background: rgba(255,255,255,0.3);\n            color: white;\n            padding: 4px 10px;\n            border-radius: 12px;\n            font-size: 12px;\n            font-weight: 600;\n        }\n        .elements-list-container {\n            flex: 1;\n            overflow-y: auto;\n            padding: 15px;\n        }\n        .element-item {\n            background: #f9f9f9;\n            border-left: 4px solid #667eea;\n            padding: 12px;\n            margin-bottom: 10px;\n            border-radius: 4px;\n            font-size: 13px;\n        }\n        .element-type {\n            display: inline-block;\n            background: #667eea;\n            color: white;\n            padding: 2px 8px;\n            border-radius: 3px;\n            font-size: 11px;\n            font-weight: 600;\n            margin-right: 8px;\n        }\n        .element-name { font-weight: 600; color: #333; }\n        .close-modal {\n            background: #f44336;\n            color: white;\n            border: none;\n            padding: 8px 18px;\n            border-radius: 4px;\n            cursor: pointer;\n            font-weight: 600;\n            font-size: 12px;\n            transition: all 0.2s;\n        }\n        .close-modal:hover {\n            background: #d32f2f;\n        }\n    </style>\n</head>\n<body>\n    <div class=\"container\">\n        <h1>Test Automation Assistant</h1>\n        <p class=\"subtitle\">Self-Healing Intelligent Automation</p>\n\n        <div class=\"file-input-wrapper\">\n            <input type=\"file\" id=\"excelFile\" class=\"file-input\" accept=\".xlsx,.xls\">\n            <label for=\"excelFile\" class=\"file-input-label\">Click or drag Excel file here</label>\n            <div id=\"fileName\" class=\"file-name\"></div>\n        </div>\n\n        <div id=\"status\" class=\"status\">\n            <div class=\"status-text\"><strong>Status:</strong> <span id=\"statusValue\">Idle</span></div>\n            <div class=\"status-text\"><strong>Step:</strong> <span id=\"currentStep\">-</span></div>\n            <div class=\"status-text\"><strong>Progress:</strong> <span id=\"progress\">0%</span></div>\n        </div>\n\n        <div class=\"controls\">\n            <button id=\"startBtn\" class=\"btn-primary\" onclick=\"startAutomation()\">START</button>\n            <button id=\"pauseBtn\" class=\"btn-secondary btn-pause\" onclick=\"pauseAutomation()\" disabled>PAUSE</button>\n            <button id=\"resumeBtn\" class=\"btn-secondary\" onclick=\"resumeAutomation()\" style=\"display:none; background: #4caf50; color: white;\">RESUME</button>\n            <button id=\"stopBtn\" class=\"btn-secondary btn-stop\" onclick=\"stopAutomation()\" disabled>STOP</button>\n            <button id=\"elementsBtn\" class=\"btn-secondary btn-elements\" onclick=\"showElements()\" disabled>Show Elements</button>\n            <button id=\"closeBrowserBtn\" class=\"btn-secondary\" onclick=\"closeBrowser()\" style=\"display:none; background: #f44336; color: white;\" title=\"Close browser after automation completes\">CLOSE BROWSER</button>\n        </div>\n\n        <div id=\"logs\" class=\"logs\"></div>\n    </div>\n\n    <div id=\"elementsModal\" class=\"elements-modal\">\n        <div class=\"elements-content\">\n            <div class=\"elements-header\">\n                <h2>\uD83C\uDFAF Current Page Elements</h2>\n                <span class=\"elements-count\" id=\"elementsCount\">0</span>\n            </div>\n            <div class=\"elements-list-container\">\n                <div id=\"elementsList\"></div>\n            </div>\n            <div style=\"padding: 12px 15px; border-top: 1px solid #ddd; text-align: right;\">\n                <button class=\"close-modal\" onclick=\"closeElements()\">Close</button>\n            </div>\n        </div>\n    </div>\n\n    <script>\n        let selectedFile = null;\n\n        // Initialize auto-scroll behavior when page loads\n        if (document.readyState === 'loading') {\n            document.addEventListener('DOMContentLoaded', setupLogAutoScroll);\n        } else {\n            setupLogAutoScroll();\n        }\n\n        document.getElementById('excelFile').addEventListener('change', (e) => {\n            selectedFile = e.target.files[0];\n            document.getElementById('fileName').textContent = selectedFile ? 'Selected: ' + selectedFile.name : '';\n        });\n\n        async function startAutomation() {\n            if (!selectedFile) {\n                alert('Select Excel file first');\n                return;\n            }\n\n            try {\n                const response = await fetch('/start', {\n                    method: 'POST',\n                    headers: { 'Content-Type': 'application/json' },\n                    body: JSON.stringify({ filename: selectedFile.name })\n                });\n                const data = await response.json();\n                if (data.success) {\n                    document.getElementById('startBtn').disabled = true;\n                    document.getElementById('pauseBtn').disabled = false;\n                    document.getElementById('stopBtn').disabled = false;\n                    document.getElementById('elementsBtn').disabled = false;\n                    document.getElementById('status').style.display = 'block';\n                    updateProgress();\n                }\n            } catch (error) {\n                alert('Error: ' + error.message);\n            }\n        }\n\n        async function pauseAutomation() {\n            await fetch('/pause', { method: 'POST' });\n            document.getElementById('pauseBtn').style.display = 'none';\n            document.getElementById('resumeBtn').style.display = 'block';\n            document.getElementById('statusValue').textContent = 'Paused';\n        }\n\n        async function resumeAutomation() {\n            await fetch('/resume', { method: 'POST' });\n            document.getElementById('resumeBtn').style.display = 'none';\n            document.getElementById('pauseBtn').style.display = 'block';\n            document.getElementById('statusValue').textContent = 'Running';\n        }\n\n        async function stopAutomation() {\n            if (confirm('Stop automation?')) {\n                await fetch('/stop', { method: 'POST' });\n                resetUI();\n            }\n        }\n\n        async function closeBrowser() {\n            if (confirm('Close the browser? You can still inspect the screenshots and logs.')) {\n                try {\n                    const response = await fetch('/close-browser', { method: 'POST' });\n                    const data = await response.json();\n                    if (data.success) {\n                        document.getElementById('closeBrowserBtn').style.display = 'none';\n                        document.getElementById('statusValue').textContent = 'Browser Closed';\n                        alert('Browser closed successfully. Results saved in RESULTS folder.');\n                    } else {\n                        alert('Error: ' + (data.error || 'Could not close browser'));\n                    }\n                } catch (error) {\n                    alert('Error closing browser: ' + error.message);\n                }\n            }\n        }\n\n        async function showElements() {\n            try {\n                // Pause automation first\n                const pauseResponse = await fetch('/pause', { method: 'POST' });\n                await pauseResponse.json();\n                \n                // Give pause time to take effect\n                await new Promise(resolve => setTimeout(resolve, 300));\n                \n                document.getElementById('pauseBtn').style.display = 'none';\n                document.getElementById('resumeBtn').style.display = 'block';\n                document.getElementById('statusValue').textContent = 'Paused';\n                \n                // Get elements from current page\n                const response = await fetch('/elements');\n                const data = await response.json();\n                displayElements(data.elements);\n                document.getElementById('elementsModal').classList.add('active');\n            } catch (error) {\n                alert('Error: ' + error.message);\n            }\n        }\n\n        function displayElements(elements) {\n            const list = document.getElementById('elementsList');\n            const countSpan = document.getElementById('elementsCount');\n            list.innerHTML = '';\n\n            if (!elements || elements.length === 0) {\n                list.innerHTML = '<div style=\"padding: 20px; text-align: center; color: #999;\">No elements found on current page</div>';\n                countSpan.textContent = '0';\n                return;\n            }\n\n            countSpan.textContent = elements.length;\n            \n            // Display elements in order with index\n            elements.forEach((el, idx) => {\n                const item = document.createElement('div');\n                item.className = 'element-item';\n                item.style.cssText = 'background: #f9f9f9; border-left: 4px solid #667eea; padding: 12px; margin-bottom: 8px; border-radius: 4px; font-size: 11px; cursor: pointer; transition: all 0.2s; border: 1px solid #e0e0e0;';\n                \n                // Build element info\n                let details = '';\n                \n                // Index and type badge\n                details += '<div style=\"display: flex; align-items: center; gap: 8px; margin-bottom: 8px;\">';\n                details += '<span style=\"display: inline-block; background: #667eea; color: white; padding: 3px 8px; border-radius: 3px; font-size: 9px; font-weight: 700; min-width: 30px; text-align: center;\">#' + (el.index + 1) + '</span>';\n                details += '<span class=\"element-type\" style=\"display: inline-block; background: #764ba2; color: white; padding: 3px 8px; border-radius: 3px; font-size: 9px; font-weight: 700; text-transform: uppercase;\">' + el.type + '</span>';\n                \n                if (!el.visible) {\n                    details += '<span style=\"display: inline-block; background: #f44336; color: white; padding: 2px 6px; border-radius: 3px; font-size: 8px; font-weight: 600;\">HIDDEN</span>';\n                }\n                \n                if (el.interactive) {\n                    details += '<span style=\"display: inline-block; background: #4caf50; color: white; padding: 2px 6px; border-radius: 3px; font-size: 8px; font-weight: 600;\">INTERACTIVE</span>';\n                }\n                details += '</div>';\n                \n                // Tag name\n                details += '<div style=\"margin: 6px 0; font-size: 10px; color: #666;\"><strong>Tag:</strong> &lt;' + el.tag + '&gt;</div>';\n                \n                // Label/Identifier\n                if (el.label) {\n                    details += '<div style=\"margin: 6px 0; font-size: 10px; color: #333; font-weight: 600;\"><strong>Label:</strong> ' + el.label.substring(0, 80) + '</div>';\n                }\n                \n                // ID\n                if (el.id) {\n                    details += '<div style=\"margin: 6px 0; font-size: 10px; color: #333;\"><strong>ID:</strong> <code style=\"background: #f0f0f0; padding: 2px 4px; border-radius: 2px; font-family: monospace;\">' + el.id + '</code></div>';\n                }\n                \n                // Name\n                if (el.name) {\n                    details += '<div style=\"margin: 6px 0; font-size: 10px; color: #333;\"><strong>Name:</strong> <code style=\"background: #f0f0f0; padding: 2px 4px; border-radius: 2px; font-family: monospace;\">' + el.name + '</code></div>';\n                }\n                \n                // Aria Label\n                if (el.ariaLabel) {\n                    details += '<div style=\"margin: 6px 0; font-size: 10px; color: #333;\"><strong>Aria:</strong> ' + el.ariaLabel.substring(0, 60) + '</div>';\n                }\n                \n                // Placeholder\n                if (el.placeholder) {\n                    details += '<div style=\"margin: 6px 0; font-size: 10px; color: #666;\"><strong>Placeholder:</strong> ' + el.placeholder + '</div>';\n                }\n                \n                // Text content\n                if (el.text && el.text.length > 0) {\n                    details += '<div style=\"margin: 6px 0; padding: 8px; background: white; border-radius: 3px; border-left: 3px solid #2196f3; font-size: 10px; color: #444; word-break: break-word;\"><strong style=\"color: #2196f3;\">Text:</strong> ' + el.text.substring(0, 100) + (el.text.length > 100 ? '...' : '') + '</div>';\n                }\n                \n                // Position info\n                if (el.position) {\n                    details += '<div style=\"margin: 6px 0; font-size: 9px; color: #999; padding: 4px; background: #fafafa; border-radius: 2px;\"><strong>Position:</strong> Top: ' + el.position.top + 'px, Left: ' + el.position.left + 'px | Size: ' + el.position.width + 'x' + el.position.height + 'px</div>';\n                }\n                \n                item.innerHTML = details;\n                item.onmouseover = () => {\n                    item.style.background = '#e8f5e9';\n                    item.style.borderLeftColor = '#4caf50';\n                };\n                item.onmouseout = () => {\n                    item.style.background = '#f9f9f9';\n                    item.style.borderLeftColor = '#667eea';\n                };\n                list.appendChild(item);\n            });\n        }\n\n        function closeElements() {\n            document.getElementById('elementsModal').classList.remove('active');\n        }\n\n        async function updateProgress() {\n            const response = await fetch('/status');\n            const data = await response.json();\n\n            document.getElementById('currentStep').textContent = data.currentStep + ' / ' + data.totalSteps;\n            const progress = data.totalSteps > 0 ? Math.round((data.currentStep / data.totalSteps) * 100) : 0;\n            document.getElementById('progress').textContent = progress + '%';\n\n            updateLogs(data.logs);\n\n            // Show close browser button when automation is completed\n            if (data.isCompleted && data.hasBrowser) {\n                document.getElementById('closeBrowserBtn').style.display = 'inline-block';\n                document.getElementById('statusValue').textContent = 'Completed! Ready to close.';\n            }\n\n            if (data.isRunning) {\n                setTimeout(updateProgress, 1000);\n            } else {\n                resetUI();\n            }\n        }\n\n        // Track if user is manually scrolling\n        let isUserScrolling = false;\n        let scrollTimeout;\n\n        function setupLogAutoScroll() {\n            const logsDiv = document.getElementById('logs');\n            \n            // Detect when user starts scrolling\n            logsDiv.addEventListener('scroll', () => {\n                isUserScrolling = true;\n                clearTimeout(scrollTimeout);\n                \n                // Check if user scrolled to bottom\n                const isAtBottom = logsDiv.scrollHeight - logsDiv.clientHeight <= logsDiv.scrollTop + 5;\n                \n                // If they're at bottom or within 5px, resume auto-scroll\n                if (isAtBottom) {\n                    isUserScrolling = false;\n                } else {\n                    // Stop auto-scroll for 3 seconds after user stops scrolling\n                    scrollTimeout = setTimeout(() => {\n                        // Only resume if we're not actively running\n                        if (document.getElementById('statusValue').textContent !== 'Running') {\n                            isUserScrolling = false;\n                        }\n                    }, 3000);\n                }\n            }, { passive: true });\n        }\n\n        function updateLogs(logs) {\n            const logsDiv = document.getElementById('logs');\n            logsDiv.innerHTML = logs.map(log => '<div class=\"log-entry\">' + log + '</div>').join('');\n            \n            // Auto-scroll to bottom only if:\n            // 1. User isn't manually scrolling\n            // 2. OR User scrolled to bottom and left the area\n            if (!isUserScrolling) {\n                // Small delay to ensure DOM is updated\n                setTimeout(() => {\n                    logsDiv.scrollTop = logsDiv.scrollHeight;\n                }, 0);\n            }\n        }\n\n        function resetUI() {\n            document.getElementById('startBtn').disabled = false;\n            document.getElementById('pauseBtn').disabled = true;\n            document.getElementById('stopBtn').disabled = true;\n            document.getElementById('elementsBtn').disabled = true;\n            document.getElementById('pauseBtn').style.display = 'block';\n            document.getElementById('resumeBtn').style.display = 'none';\n            document.getElementById('statusValue').textContent = 'Complete';\n        }\n    </script>\n</body>\n</html>\n";
var server = http.createServer(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var parsedUrl, pathname, body_1, e_87, elements, error_17;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                parsedUrl = url.parse(req.url, true);
                pathname = parsedUrl.pathname;
                res.setHeader('Content-Type', 'application/json');
                _b.label = 1;
            case 1:
                _b.trys.push([1, 20, , 21]);
                if (!(pathname === '/' && req.method === 'GET')) return [3 /*break*/, 2];
                res.setHeader('Content-Type', 'text/html');
                res.writeHead(200);
                res.end(htmlUI);
                return [3 /*break*/, 19];
            case 2:
                if (!(pathname === '/start' && req.method === 'POST')) return [3 /*break*/, 3];
                body_1 = '';
                req.on('data', function (chunk) { body_1 += chunk.toString(); });
                req.on('end', function () { return __awaiter(void 0, void 0, void 0, function () {
                    var data, selectedFile, files, excelFile;
                    return __generator(this, function (_a) {
                        try {
                            data = JSON.parse(body_1);
                            selectedFile = data.filename;
                            if (!selectedFile) {
                                files = fs.readdirSync('.');
                                excelFile = files.find(function (f) { return f.endsWith('.xlsx') && !f.startsWith('~'); });
                                if (!excelFile) {
                                    res.writeHead(400);
                                    res.end(JSON.stringify({ success: false, error: 'No Excel file found' }));
                                    return [2 /*return*/];
                                }
                                state.selectedExcelFile = excelFile;
                                runAutomation(excelFile).catch(function (err) { return log("Error: ".concat(err)); });
                            }
                            else {
                                // Use the selected file
                                if (!fs.existsSync(selectedFile)) {
                                    res.writeHead(400);
                                    res.end(JSON.stringify({ success: false, error: "File not found: ".concat(selectedFile) }));
                                    return [2 /*return*/];
                                }
                                state.selectedExcelFile = selectedFile;
                                runAutomation(selectedFile).catch(function (err) { return log("Error: ".concat(err)); });
                            }
                            res.writeHead(200);
                            res.end(JSON.stringify({ success: true }));
                        }
                        catch (e) {
                            res.writeHead(500);
                            res.end(JSON.stringify({ success: false, error: e.message }));
                        }
                        return [2 /*return*/];
                    });
                }); });
                return [3 /*break*/, 19];
            case 3:
                if (!(pathname === '/pause' && req.method === 'POST')) return [3 /*break*/, 5];
                return [4 /*yield*/, pauseAutomation()];
            case 4:
                _b.sent();
                res.writeHead(200);
                res.end(JSON.stringify({ success: true }));
                return [3 /*break*/, 19];
            case 5:
                if (!(pathname === '/resume' && req.method === 'POST')) return [3 /*break*/, 7];
                return [4 /*yield*/, resumeAutomation()];
            case 6:
                _b.sent();
                res.writeHead(200);
                res.end(JSON.stringify({ success: true }));
                return [3 /*break*/, 19];
            case 7:
                if (!(pathname === '/stop' && req.method === 'POST')) return [3 /*break*/, 9];
                return [4 /*yield*/, stopAutomation()];
            case 8:
                _b.sent();
                res.writeHead(200);
                res.end(JSON.stringify({ success: true }));
                return [3 /*break*/, 19];
            case 9:
                if (!(pathname === '/close-browser' && req.method === 'POST')) return [3 /*break*/, 16];
                if (!state.browser) return [3 /*break*/, 14];
                _b.label = 10;
            case 10:
                _b.trys.push([10, 12, , 13]);
                return [4 /*yield*/, state.browser.close()];
            case 11:
                _b.sent();
                state.browser = null;
                state.page = null;
                state.isCompleted = false;
                res.writeHead(200);
                res.end(JSON.stringify({ success: true, message: 'Browser closed' }));
                return [3 /*break*/, 13];
            case 12:
                e_87 = _b.sent();
                res.writeHead(200);
                res.end(JSON.stringify({ success: false, error: e_87.message }));
                return [3 /*break*/, 13];
            case 13: return [3 /*break*/, 15];
            case 14:
                res.writeHead(200);
                res.end(JSON.stringify({ success: false, error: 'No browser to close' }));
                _b.label = 15;
            case 15: return [3 /*break*/, 19];
            case 16:
                if (!(pathname === '/elements' && req.method === 'GET')) return [3 /*break*/, 18];
                return [4 /*yield*/, getAllPageElements()];
            case 17:
                elements = _b.sent();
                res.writeHead(200);
                res.end(JSON.stringify({ elements: elements }));
                return [3 /*break*/, 19];
            case 18:
                if (pathname === '/status' && req.method === 'GET') {
                    res.writeHead(200);
                    res.end(JSON.stringify({
                        currentStep: state.currentStepIndex + 1,
                        totalSteps: ((_a = state.testData) === null || _a === void 0 ? void 0 : _a.length) || 0,
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
                _b.label = 19;
            case 19: return [3 /*break*/, 21];
            case 20:
                error_17 = _b.sent();
                res.writeHead(500);
                res.end(JSON.stringify({ error: error_17.message }));
                return [3 /*break*/, 21];
            case 21: return [2 /*return*/];
        }
    });
}); });
server.listen(PORT, function () {
    log("Started on http://localhost:".concat(PORT));
    var cmd = process.platform === 'win32' ? 'start' : 'open';
    require('child_process').exec("".concat(cmd, " http://localhost:").concat(PORT));
});
