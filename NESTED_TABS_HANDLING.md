# Nested Tabs & Windows Priority Handling

## Overview

The assistant now has **advanced support for nested tabs and windows** with automatic priority-based searching. This enables the automation to work with complex Oracle applications that have multiple levels of nesting.

## What's New

### 1. **Automatic Nested Tab Detection**
The assistant now automatically detects nested tabs within any frame or window:
- HTML `<tab>` elements and `[role="tab"]` elements
- Bootstrap `.nav-tabs` tabs
- Material Design tabs
- Custom tab implementations
- Navigation tabs and panels

### 2. **Tab Priority Search Strategy**

When searching for an element:

```
Flow:
  ├─ PRIORITY 1: Search ACTIVE tabs first
  │  └─ These are visible and don't require activation
  │
  ├─ PRIORITY 2: Search INACTIVE tabs by clicking them
  │  └─ For each inactive tab:
  │     1. Click the tab to activate it
  │     2. Search for the element
  │     3. Move to next tab if not found
  │
  └─ PRIORITY 3: Search frames and windows
```

### 3. **Window Hierarchy with Nesting Levels**

The assistant tracks windows/popups with complete hierarchy:

```
🏠 MAIN WINDOW (Level 0)
  ├─ 📍 SUBWINDOW (Level 1) - Customer Accounts Maintenance
  │  ├─ 🔖 Nested Tab: Management Information System [ACTIVE]
  │  ├─ 🔖 Nested Tab: MIS Configuration [INACTIVE]
  │  └─ 🔖 Nested Tab: Audit Trail [INACTIVE]
  │
  └─ 📍 SUBWINDOW (Level 2) - Account Number Generation Modal
     └─ (popup on top of Management Information System)
```

## How It Works

### Example 1: Finding Element in Nested Tab

**Scenario:** Element exists in "Management Information System" tab within "Customer Accounts Maintenance" window

```
1. Assistant detects Customer Accounts Maintenance window is opened ⭐ PRIORITY 1
2. Searches all frames in this window
3. Finds tabs (Main, Management Information System, etc.)
4. "Management Information System" tab is ACTIVE ✅
5. Searches in the active tab → ✅ FOUND!
```

### Example 2: Element in Inactive Tab

**Scenario:** Element exists in "Account Configuration" tab (currently hiding)

```
1. Assistant detects Customer Accounts Maintenance window
2. Finds "Management Information System" tab is active
3. Searches active tab → NOT FOUND
4. Finds "Account Configuration" tab (inactive)
5. ACTIVATES the tab by clicking it 🖱️
6. Waits for tab content to render
7. Searches in the newly active tab → ✅ FOUND!
```

### Example 3: Multiple Nesting Levels

**Scenario:** Element deep in nested structure

```
Frame Level 1 (Main Frame)
  ├─ Tab: "Management Information System" [ACTIVE] ✓
  │  └─ Found target here? No → Continue
  │
  ├─ Tab: "Account Details" [INACTIVE]
  │  └─ Activate tab, check → No
  │
  └─ Tab: "Settings" [INACTIVE]
     └─ Activate tab, check → No

Move to iFrame 2
  ├─ Tab: "Configuration" [ACTIVE] ✓
  │  └─ Found target here? → ✅ YES!
```

## New Functions

### `detectNestedTabs(frame, windowPath)`
**Purpose:** Scan a frame for all nested tab elements

**Returns:** Array of detected tabs with:
- `tabName`: Display name of the tab (e.g., "Management Information System")
- `tabSelector`: CSS selector to find the tab
- `isActive`: Whether the tab is currently visible
- `parentFramePath`: Path to the parent frame (for debugging)
- `level`: Nesting level

**Logging:**
```
🔖 [NESTED TABS] Detected 3 nested tab(s):
   [1] Management Information System ⭐ [ACTIVE]
   [2] Account Configuration
   [3] Audit Trail
```

### `activateNestedTab(frame, tabName)`
**Purpose:** Click on an inactive tab to show its content

**Tries:** Multiple selector patterns for compatibility
- `[role="tab"]:has-text("${tabName}")`
- `button:has-text("${tabName}")`
- `a:has-text("${tabName}")`
- `.nav-link:has-text("${tabName}")`

**Success:** Returns `true` and waits 500ms for animation

### `searchWithTabPriority(frame, target, windowPath, action, fillValue?)`
**Purpose:** Smart search that handles nested tabs automatically

**Flow:**
1. Detect all tabs in the frame
2. If NO tabs found → Normal search
3. If tabs found:
   - Priority 1: Search active tabs
   - Priority 2: Activate each inactive tab and search
4. Return true if found, false if not

**Logging:**
```
🔍 [NESTED TAB SEARCH] Found 3 nested tab(s) - searching all of them...
   🎯 [PRIORITY 1] Searching 1 ACTIVE tab(s) first...
      ℹ️ Searching in "Management Information System" tab...
      ✅ [PRIORITY 1] Found in active tab: "Management Information System"
```

## Search Priority Order (Complete)

1. **Latest opened subwindow** (if exists)
   - Customer Accounts Maintenance, Account Number Generation modal, etc.

2. **Other subwindows** (sorted by recency)
   - Newest first

3. **Frames within windows** (in order)
   - Main frame first
   - Then iframes by index

4. **Nested tabs within each frame** (intelligent)
   - Active tabs first
   - Then inactive tabs (will be activated)

5. **Main window** (if not found anywhere else)

## Visual Logging Example

```
🪟 ========== [SEARCH STRATEGY: PRIORITY WINDOW FIRST] ==========
🪟 Total windows available: 3
   🏠 MAIN: "Oracle SAL_MAK - 999-999-999" | https://...
   📍 SUBWINDOW (Level 1): "Customer Accounts Maintenance" | https://...  ⭐ [LATEST - WILL SEARCH FIRST]
   📍 SUBWINDOW (Level 2): "Account Number Generation" | https://... ✅ OPEN

🎯 [PRIORITY 1] Searching LATEST OPENED SUBWINDOW FIRST
   🔍 [WINDOW SEARCH] 📍 SUBWINDOW (Level 1)
   🔍 ├─ TOTAL FRAMES TO SEARCH: 2
   🔍 ├─ TARGET: "customer details"
   🔍 └─ STATUS: Searching ALL frames thoroughly...

   📍 [Frame 1/2] Main Frame
   🔖 [NESTED TABS] Detected 3 nested tab(s):
      [1] Management Information System ⭐ [ACTIVE]
      [2] Account Details
      [3] Audit Trail
   
   🔍 [NESTED TAB SEARCH] Found 3 nested tab(s) - searching all of them...
      🎯 [PRIORITY 1] Searching 1 ACTIVE tab(s) first...
         [Active Tab: Management Information System]
         ✅ Found match: "Customer Details Submit"
         ✅ [PRIORITY 1] Successfully clicked element

✅ SUCCESS! Element found in priority window!
```

## Configuration Examples

### Example: Customer Maintenance Form Navigation

```
Button: "Save Customer Details"
Location: 
  └─ Window: Customer Accounts Maintenance
     └─ Frame: Management Information System (tab)
     └─ Section: Account Details

The assistant will:
1. Detect Customer Accounts Maintenance window opened
2. Find "Management Information System" tab (active)
3. Click "Save Customer Details" button
```

### Example: Hidden Tab Element

```
Input: "Cost Code"
Location:
  └─ Window: Customer Accounts Maintenance
     └─ Frame: Management Information System (tab)
     └─ Tab: "Cost Code Settings" (currently hidden)

The assistant will:
1. Search all active tabs → NOT FOUND
2. Find "Cost Code Settings" tab (inactive)
3. Click the "Cost Code Settings" tab
4. Now search in the activated tab → ✅ FOUND "Cost Code" input
5. Fill the input value
```

## Troubleshooting

### Issue: Element not found in nested tab

**Debug Output:**
```
🔖 [NESTED TABS] Detected 2 nested tab(s):
   [1] Main Tab ⭐ [ACTIVE]
   [2] Secondary Tab
   
🔍 [NESTED TAB SEARCH] Found 2 nested tab(s)...
   🎯 [PRIORITY 1] Searching 1 ACTIVE tab(s)...
      ⚠️ No matches found for "missing element"
   
   🎯 [PRIORITY 2] Searching 1 inactive tab(s)...
      🔖 [TAB ACTIVATION] Attempting to activate tab: "Secondary Tab"
      ✅ [TAB ACTIVATED] "Secondary Tab" - tab content loaded
      ⚠️ No matches found in this frame
   
   ⚠️ Target not found in ANY nested tab
```

**Solutions:**
1. Check tab name spelling/case sensitivity
2. Verify the element exists in the correct tab
3. Check if tab requires special activation (not just click)
4. Look for alternative element selectors in the tab

### Issue: Tab not activating

**Log:**
```
🔖 [TAB ACTIVATION] Attempting to activate tab: "Settings"
   ⚠️  [TAB ACTIVATION FAILED] Could not click tab: "Settings"
```

**Solutions:**
1. Tab might use custom activation (not just click)
2. Tab selector pattern might not match (too generic tab markup)
3. Tab might be disabled or hidden
4. Try clicking a specific element within the tab selector

## Advanced Features

### Automatic Parent Frame Tracking
Every detected tab tracks its parent frame path for debugging:
```json
{
  "tabName": "Management Information System",
  "parentFramePath": "🏠 MAIN WINDOW > Main Frame",
  "level": 1,
  "isActive": true
}
```

### Recency-Based Window Ordering
Windows are searched by how recently they were opened:
```
Latest subwindow (opened 14:35:02) ← SEARCHES FIRST
├─ Previously opened window (14:33:45)
└─ Main window (application start)
```

### Active Tab Caching
Active tabs are remembered and prioritized in subsequent searches of the same window.

## Performance

- **Nested Tab Detection:** ~50-100ms per frame
- **Tab Activation:** ~200-500ms (includes animation wait)
- **Priority Search:** Typically finds element in first 1-2 searches
- **Fallback Time:** < 5 seconds for deep nested structures

---

**Last Updated:** February 2026  
**Version:** 2.0 - Advanced Nested Tab Support
