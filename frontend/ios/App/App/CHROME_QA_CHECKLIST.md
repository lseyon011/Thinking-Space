# QA Testing Checklist - iPhone Chrome Fixes

Use this checklist when manually testing the iPhone chrome behavior.

---

## Pre-Test Setup

- [ ] Build project in Xcode
- [ ] Select iPhone simulator (recommend iPhone 15 Pro or similar)
- [ ] Launch app
- [ ] Navigate to a content-heavy screen (Wikipedia or Thinking Space with long content)

---

## Test 1: Top Chrome Collapse/Expand

### Scroll Down Slowly
- [ ] Top chrome container visibly shrinks in height
- [ ] Title text stays at same font size (doesn't shrink)
- [ ] Menu icon stays at same size (doesn't shrink)
- [ ] Search/Tools icons stay at same size (don't shrink)
- [ ] Animation is smooth (no bouncing)
- [ ] Background material stays consistent
- [ ] Content panel grows upward as chrome shrinks

### Metrics to Verify:
- [ ] Top chrome expanded height: ~58pt + safe area top
- [ ] Top chrome collapsed height: ~34pt + safe area top
- [ ] Height reduction: ~24pt
- [ ] Animation duration: feels like 0.28 seconds

---

## Test 2: Bottom Chrome Collapse/Expand

### Scroll Down More
- [ ] Bottom chrome container visibly shrinks
- [ ] Centered "Tabs" pill appears
- [ ] **⭐ CRITICAL: Sidebar button (≡) stays visible on the left**
- [ ] Tab count badge shows in pill
- [ ] Animation synchronized with top chrome
- [ ] No visual jank or bouncing

### Tap Collapsed Pill
- [ ] Bottom chrome expands back to full size
- [ ] Sidebar button remains visible
- [ ] Tab switcher and + button reappear
- [ ] Animation is smooth
- [ ] Duration matches collapse animation

### Metrics to Verify:
- [ ] Bottom chrome expanded height: ~64pt + safe area bottom
- [ ] Bottom chrome collapsed height: ~42pt + safe area bottom
- [ ] Height reduction: ~22pt
- [ ] Sidebar button visible in BOTH states

---

## Test 3: Scroll Up Restoration

### Scroll Upward
- [ ] Top chrome expands back
- [ ] Bottom chrome expands back (if was collapsed)
- [ ] Title stays consistent size throughout
- [ ] Icons stay consistent size throughout
- [ ] Both animations synchronized
- [ ] No flashing or background color changes

---

## Test 4: Content Panel Verification

### Visual Inspection:
- [ ] Content panel has NO rounded corners
- [ ] Content is perfectly rectangular
- [ ] Content fills edge-to-edge (left and right)
- [ ] No white gaps or spacing issues
- [ ] Background color consistent

### During Scroll:
- [ ] Content panel visibly reclaims space when chrome collapses
- [ ] More content becomes visible when chrome shrinks
- [ ] Content doesn't jump or shift unexpectedly
- [ ] Scrolling feels smooth and responsive

---

## Test 5: Multiple Content Types

### Test on Wikipedia Page:
- [ ] Repeat all scroll tests above
- [ ] Web content renders correctly
- [ ] No clipping at edges
- [ ] Chrome behavior consistent

### Test on Thinking Space Screen:
- [ ] Repeat all scroll tests above
- [ ] Native content renders correctly
- [ ] Chrome behavior consistent
- [ ] Title updates correctly for different notes

---

## Test 6: Edge Cases

### Rapid Scrolling:
- [ ] Scroll down quickly - chrome collapses smoothly
- [ ] Scroll up quickly - chrome expands smoothly
- [ ] No animation glitches
- [ ] No stuck states

### Interrupted Animations:
- [ ] Start scrolling down, then immediately scroll up
- [ ] Chrome animations reverse smoothly
- [ ] No visual artifacts
- [ ] Controls don't get stuck mid-transition

### Tab Switcher:
- [ ] Tap tab switcher button
- [ ] Sheet presents correctly
- [ ] Dismiss sheet - chrome state preserved
- [ ] Create new tab - chrome updates correctly

---

## Test 7: Specific Fixes Verification

### Fix 1: Sidebar Button Always Visible ⭐
- [ ] Scroll down to collapse bottom chrome
- [ ] **Sidebar button (≡) is visible on the left**
- [ ] Tap sidebar button - works correctly
- [ ] Centered pill also visible and functional
- [ ] Both controls have proper spacing

### Fix 2: Consistent Animation Timing
- [ ] Watch top and bottom chrome collapse together
- [ ] No one finishes before the other
- [ ] No bouncing effect
- [ ] Feels smooth and synchronized

### Fix 3: Title Font Consistent
- [ ] Read title in expanded state
- [ ] Scroll to collapse top chrome
- [ ] **Title font size looks the same**
- [ ] No opacity change or fading
- [ ] Title stays crisp and readable

### Fix 4: Icon Sizes Consistent
- [ ] Look at menu icon (≡) in expanded state
- [ ] Scroll to collapse
- [ ] **Icon size looks the same**
- [ ] Look at search/tools icons
- [ ] **Icons size looks the same**
- [ ] Only button containers shrink

### Fix 5: Content Rectangular
- [ ] Look at content panel edges
- [ ] **No rounded corners visible**
- [ ] Content meets chrome at sharp edge
- [ ] Perfectly rectangular shape

---

## Visual Issues to Watch For

### ❌ Problems That Should NOT Occur:
- [ ] NO sidebar button disappearing when collapsed
- [ ] NO bouncy or springy animations
- [ ] NO text shrinking as you scroll
- [ ] NO icon shrinking as you scroll
- [ ] NO rounded corners on content
- [ ] NO animation jank or stuttering
- [ ] NO controls finishing animation before container
- [ ] NO white flashes or background changes
- [ ] NO content jumping or shifting
- [ ] NO stuck chrome states

### ✅ Things That SHOULD Happen:
- [ ] Smooth height changes on chrome containers
- [ ] Content reclaims space immediately
- [ ] All animations synchronized
- [ ] Controls stay crisp and readable
- [ ] Sidebar always accessible
- [ ] Material backgrounds stay consistent

---

## Comparison to Safari

Open Safari on the same iPhone simulator and compare:

### Safari Behavior Reference:
- [ ] Safari: Title doesn't shrink - **Our app: Same** ✅
- [ ] Safari: Icons don't shrink - **Our app: Same** ✅
- [ ] Safari: Only containers shrink - **Our app: Same** ✅
- [ ] Safari: Smooth synchronized animations - **Our app: Same** ✅
- [ ] Safari: Bottom controls accessible - **Our app: Same** ✅

---

## Performance Check

- [ ] Animations run at 60fps (smooth, no stuttering)
- [ ] No frame drops during scroll
- [ ] No memory warnings
- [ ] No console errors related to chrome
- [ ] App feels responsive throughout

---

## Sign-Off

### All Tests Passed:
- [ ] Top chrome collapse/expand works correctly
- [ ] Bottom chrome collapse/expand works correctly
- [ ] Sidebar button always visible ⭐
- [ ] Animations smooth and synchronized
- [ ] Content panel rectangular
- [ ] All 5 fixes verified working

### Issues Found:
(Document any issues below)

```
Issue 1:
Description:
Expected:
Actual:
Severity:

Issue 2:
Description:
Expected:
Actual:
Severity:
```

---

## Success Criteria

✅ All checkboxes above should be checked
✅ Behavior matches Safari's native iPhone chrome
✅ No visual glitches or animation issues
✅ Sidebar button remains accessible in all states
✅ Chrome feels smooth, native, and polished

---

## If Issues Are Found

1. Note the specific test case that failed
2. Document expected vs actual behavior
3. Check the relevant file from the fixes:
   - Sidebar issues → `TopChromeView.swift` lines 197-243
   - Animation issues → `TopChromeView.swift` lines 64, 241
   - Title/icon issues → `TopChromeView.swift` lines 52-56, 155-195
   - Content issues → `RootShellViewController.swift` lines 127-130
4. Take screenshot if helpful
5. Report back with details

---

**Tester Name**: _______________  
**Date**: _______________  
**Simulator**: iPhone _____ (iOS _____)  
**Result**: ⭐ PASS / ❌ FAIL  
