# IFRAME Detection and Prioritization Fixes

## Problem Identified
When a new iframe (like "Account Number Generation") opens within the current page, the assistant was:
1. **NOT detecting** it had opened
2. **NOT showing in logs** which iframe was detected
3. **Still searching in the old iframe** (Customer Accounts Maintenance) instead of the new one
4. **Not switching** to work on the latest iframe

## Root Cause
The assistant was only listening for new **popup windows** (`page.on('popup')` and `context.on('page')`), but NOT for new **iframes** that are dynamically added to the DOM of the current page.

When an iframe opens as an overlay/modal within the same page, no event fires, so the code never knows a new iframe exists.

## Solution Implemented

### 1. **NEW Global Tracking Variables** (Lines 91-92)
```typescript
let lastDetectedFrameInfo: Map<string, any> = new Map();
let latestDetectedNewFrame: { name: string; id: string; title: string; detectedAt: number } | null = null;
```
- Tracks previously seen iframes to detect which are NEW
- Tracks the most recently detected new iframe with its details and timestamp

### 2. **NEW Function: `detectAndLogAllIframes()`** (Lines 994-1080)
This is the **CRITICAL** addition that:
- ✅ Runs BEFORE each step's action
- ✅ Queries the DOM to find ALL current iframes
- ✅ Gets details: name, id, title, src, size, visibility
- ✅ Creates unique key for each iframe to track changes
- ✅ Compares with previously known iframes to **detect NEW ones**
- ✅ **LOGS CLEARLY** which iframes are on the page:
  ```
  🖼️ 📦 IFRAME DETECTION REPORT
  🖼️ Total iframes: 2
  🎯 [NEW IFRAME] Name: "Account Number Generation", ID: "...account-frame...", Title: "..."
  📋 ALL IFRAMES ON PAGE:
    [1] Name: "Customer Accounts Maintenance"
        ├─ ID: "..." 
        ├─ Visible: ✅ YES
        ...
    [2] Name: "Account Number Generation" 🆕 [NEW]
        ├─ ID: "..."
        ├─ Visible: ✅ YES
        ...
  ```
- ✅ Sets `latestDetectedNewFrame` for search prioritization

### 3. **INTEGRATION into executeStep()** (Line 9564)
Before any action (CLICK, FILL, etc.) is executed:
```typescript
// 🎯 CRITICAL: Detect and log ALL iframes BEFORE searching for elements
await detectAndLogAllIframes();
```

### 4. **PRIORITY 0 in searchInAllSubwindows()** (Lines 3067-3117)
New highest priority search strategy:
- **PRIORITY 0**: If a new iframe was detected in the last 30 seconds ⭐
- **PRIORITY 1**: Latest opened subwindow/popup
- **PRIORITY 2**: Other subwindows by recency
- **PRIORITY 3**: Main window

When searching for an element, the code now:
1. Checks if a new iframe was recently detected
2. **Searches in that new iframe FIRST** before trying other windows
3. **Logs which iframe it's searching in**: `[NEW IFRAME]:iFrame 1`
4. Returns immediately if found

## What You'll See Now

### In the Logs:
```
🖼️ ╔════════════════════════════════════════════════════╗
🖼️ ║ 📦 IFRAME DETECTION REPORT                        ║
🖼️ ║ Total iframes: 2                                   ║
🖼️ ╚════════════════════════════════════════════════════╝

🎯 [NEW IFRAME] Name: "Account Number Generation", ID: "accFrame123", Title: "Account Dialog"

📋 ALL IFRAMES ON PAGE:
   [1] Name: "Customer Accounts Maintenance" 
       ├─ ID: "custFrame456"
       ├─ Title: "Customer Maintenance"
       ├─ Visible: ✅ YES
       └─ Size: 912x634px

   [2] Name: "Account Number Generation" 🆕 [NEW]
       ├─ ID: "accFrame123"
       ├─ Title: "Account Dialog"
       ├─ Visible: ✅ YES
       └─ Size: 600x500px

⭐ ATTENTION: 1 NEW iframe(s) detected!
🎯 [SEARCH PRIORITY] Will search NEW iframes FIRST in next action
🎯 [TARGET IFRAME] Latest new frame: "Account Number Generation"
```

### When Searching:
```
⭐ [PRIORITY 0 - NEW IFRAME] Detected new iframe: "Account Number Generation"
⭐ [PRIORITY 0] Will search in NEW iframe FIRST before other windows
   🔍 Current page has 2 frame(s) - searching for target in NEW iframes first...
   ✅ [PRIORITY 0] Found in NEW iframe!
```

## Benefits

| Aspect | Before | After |
|--------|--------|-------|
| **iframe Detection** | ❌ No logging | ✅ Clear iframe names & IDs shown |
| **New iframe Awareness** | ❌ Misses new iframes | ✅ Automatically detects |
| **Search Priority** | ❌ Searches old first | ✅ Searches new iframe FIRST |
| **User Visibility** | ❌ Confused why it fails | ✅ Exact iframe shown in log |
| **Troubleshooting** | ❌ Hard to debug | ✅ Easy to see which iframe being used |

## You Can Now:

1. **See exactly which iframes are on the page** - with names, IDs, titles
2. **Know when a new iframe opens** - marked with 🆕 [NEW]
3. **Verify the assistant switches to new iframe** - shown in logs with ⭐ [PRIORITY 0]
4. **Debug failures** - you'll see which iframe the assistant is searching in

## Testing

To verify the fix works:
1. Run a test where "Account Number Generation" iframe opens
2. **Look at the logs** - you should see:
   - The IFRAME DETECTION REPORT after each step
   - New iframe clearly marked with 🆕 [NEW]
   - [PRIORITY 0 - NEW IFRAME] when searching in it
3. You should see **✅ Found in NEW iframe!** when element is clicked

---

**Status**: ✅ IMPLEMENTED  
**Files Modified**: `assistant.ts`  
**Key Functions Added**: `detectAndLogAllIframes()`  
**Key Functions Modified**: `searchInAllSubwindows()`, `executeStep()`
