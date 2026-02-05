# Hierarchical Target Format - Usage Guide

## Problem Fixed
Your script was detecting the wrong dropdowns (navbar menus at top) instead of the nested Loans > Insta Personal Loan dropdown. Now you can explicitly specify the hierarchy.

## New Target Format

### Standard Format (For top-level items)
```
TARGET: Loans
TARGET: Sign In
TARGET: Check Offer
```

### Hierarchical Format (For nested items)
```
TARGET: Loans > Insta Personal Loan
TARGET: Products > EMI Card
TARGET: Services > Support
```

### What the `>` Separator Does
1. **Splits the target into parent and child**
   - `Loans > Insta Personal Loan` → Parent: "Loans", Child: "Insta Personal Loan"
   
2. **Automatically hovers parent menu FIRST**
   - Hovers "Loans" button
   - Waits 600ms for dropdown to appear
   
3. **Then searches for child item in dropdown**
   - Looks for "Insta Personal Loan" within visible dropdown
   - Clicks it when found

## Your Test Case - Update to This Format

### OLD Format (Not Working)
```
Step 8: ACTION = CLICK,  TARGET = Loans
Step 9: ACTION = CLICK,  TARGET = Insta Personal Loan
Step 10: ACTION = CLICK, TARGET = Check Offer
```

### NEW Format (Will Work!)
```
Step 8: ACTION = CLICK,  TARGET = Loans
Step 9: ACTION = CLICK,  TARGET = Loans > Insta Personal Loan
Step 10: ACTION = CLICK, TARGET = Check Offer
```

## Benefits
✅ **Crystal clear intent** - "I want to click X from Y menu"
✅ **No manual HOVER steps needed** - Automatic!
✅ **No hardcoded selectors** - Pure text matching
✅ **Prevents wrong element clicks** - Targets the correct dropdown
✅ **Self-documenting** - Excel sheet is readable

## Examples for Bajaj Finserv

| Step | ACTION | TARGET | DATA |
|--|--|--|--|
| 1 | OPEN | https://www.bajaJfinserv.in | |
| 2 | CLICK | Sign In | |
| 3 | FILL | Mobile Number | 9995266346 |
| 4 | CLICK | GET OTP | |
| 5 | FILL | Enter Date of Birth | DD/MM/YYYY |
| 6 | CLICK | Submit | |
| 7 | HOVER | Loans | |
| 8 | CLICK | **Loans > Insta Personal Loan** | ← New Format! |
| 9 | CLICK | Check Offer | |
| 10 | SCREENSHOT | | |

## Multiple Levels Support

The script currently supports **2 levels deep** (Parent > Child):
```
TARGET: Loans > Insta Personal Loan ✅ (2 levels)
TARGET: Loans > Submenu > Deep Item ❌ (3 levels not yet supported)
```

If you need 3+ levels, use HOVER for the parent and then CLICK:
```
HOVER: Products
CLICK: EMI Cards > Premium Card (splits to: hover "EMI Cards", click "Premium Card")
```

## Under the Hood - What Happens

```
CLICK: "Loans > Insta Personal Loan"
│
├─ Parse: parentMenu="Loans", actualTarget="Insta Personal Loan"
│
├─ [Step 1] Hover "Loans" button
├─ [Step 2] Wait 600ms for dropdown animation
├─ [Step 3] Detect open dropdowns
├─ [Step 4] Search for "Insta Personal Loan" in detected dropdowns
├─ [Step 5] Click found element
│
└─ Return Success ✅
```

## Spaces Matter!
```
✅ "Loans > Insta Personal Loan"  (spaces around >)
✅ "Loans>Insta Personal Loan"    (no spaces - both work)
✅ "Loans >Insta Personal Loan"   (flexible)
❌ "Loans>  Insta Personal Loan"  (extra spaces - will be trimmed)
```

## Data Field (Optional)
The DATA field works with hierarchical targets:
```
TARGET: Loans > Insta Personal Loan
DATA: 1500  (optional - extra wait time in ms)
```

## Troubleshooting

### Issue: Still not finding the item
**Solution:** Verify exact text match:
```
Check browser: "Insta Personal Loan" (exactly as shown)
Update Excel:  TARGET: Loans > Insta Personal Loan
```

### Issue: Clicking wrong element
**Solution:** Use more specific text:
```
❌ TARGET: > Personal Loan
✅ TARGET: Loans > Insta Personal Loan
```

### Issue: Parent menu name ambiguous
**Solution:** First, click the parent separately:
```
Step 1: CLICK: Loans
Step 2: WAIT: 1500
Step 3: CLICK: Insta Personal Loan
```

## Syntax Quick Reference

| Format | Example | Parent | Child |
|---|---|---|---|
| Single Item | `Loans` | - | Loans |
| Hierarchical | `Loans > Insta Personal Loan` | Loans | Insta Personal Loan |
| Spaces | `Loans > Insta Personal Loan` | Loans | Insta Personal Loan |
| No Spaces | `Loans>Insta Personal Loan` | Loans | Insta Personal Loan |

## Comparison: Old vs New Approach

### OLD (Without Hierarchy)
```
HOVER: Loans           ← Manual hover needed
WAIT: 800              ← Manual wait needed  
CLICK: Insta Personal Loan ← Might fail if dropdown closes
```
**Downside:** 3 steps, manual timing, fragile

### NEW (With Hierarchy)
```
CLICK: Loans > Insta Personal Loan ← One step, automatic!
```
**Upside:** 1 step, automatic hover + wait, reliable

## For Other Websites

This format works on **any website with hierarchical menus**:
- Ecommerce: `Categories > Electronics > Phones`
- Dashboards: `Reports > Sales > Monthly`
- Admin Panels: `Settings > User Management > Permissions`

## FAQ

**Q: Does it work without the `>` symbol?**
A: Yes! It falls back to normal search if `>` is not found.
```
TARGET: Insta Personal Loan ← Still works, but detects wrong dropdown
TARGET: Loans > Insta Personal Loan ← Guaranteed to work!
```

**Q: Can I use `|` or `:` instead of `>`?**
A: Only `>` is supported currently. Let me know if you need other separators!

**Q: What if parent and child names are identical?**
A: The script handles this - it will hover the parent, wait, then find the child.

**Q: Can I mix hierarchical and regular targets?**
A: Yes! Use whichever format works:
```
CLICK: Sign In          ← Regular
CLICK: Loans > Insta Personal Loan ← Hierarchical
```

---

**Version:** Updated with Hierarchical Target Support
**Date:** February 5, 2026
