# Debugging Chrome Scroll Detection

## Changes Made

### 1. Fixed Timing Issue
**Problem**: Scroll observer was being set up too early (before webView was ready)
**Fix**: Moved setup to `viewDidAppear` instead of `capacitorDidLoad`

### 2. Enabled Scrolling
**Problem**: WebView scroll was disabled (`bounces = false`)
**Fix**: Changed to `bounces = true` and `alwaysBounceVertical = true`

### 3. Added Debug Logging
Added console logs to track:
- When scroll detection is set up
- Scroll position changes
- When chrome state changes
- Any errors

---

## How to Debug

### Step 1: Build and Run
Build the app in Xcode on iPhone simulator

### Step 2: Check Console
Open Xcode console and look for these messages:

```
[Chrome] 📱 Configured webView scrollView - scroll enabled: true
[Chrome] ✅ Setting up scroll detection on webView scrollView
```

If you don't see these, the setup isn't running.

### Step 3: Scroll and Watch Console
When you scroll, you should see:

```
[Chrome] Scroll: 25pt, direction: down
[Chrome] Scroll: 55pt, direction: down
[Chrome] 🔄 Top chrome: COLLAPSED
[Chrome] Scroll: 160pt, direction: down
[Chrome] 🔄 Bottom chrome: COLLAPSED
```

### Step 4: Scroll Up
When scrolling up, you should see:

```
[Chrome] Scroll: 140pt, direction: up
[Chrome] 🔄 Bottom chrome: EXPANDED
[Chrome] Scroll: 5pt, direction: up
[Chrome] 🔄 Top chrome: EXPANDED
```

---

## If Nothing Happens

### Check 1: Is the webView scrolling?
Try scrolling the content. If the page doesn't scroll at all, the issue is with the web content, not the chrome.

### Check 2: Are there console errors?
Look for any warnings like:
```
[Chrome] ⚠️ WebView not available for scroll detection
[Chrome] ⚠️ Parent is not RootShellViewController
```

### Check 3: Is it on iPhone?
The scroll detection only runs on iPhone (not iPad). Make sure simulator is set to iPhone.

### Check 4: Is there scrollable content?
The page needs to be long enough to scroll. Try a Wikipedia page or a long note.

---

## Expected Behavior

1. **Scroll down 50pts** → Console shows "Top chrome: COLLAPSED" → Top chrome shrinks
2. **Scroll down 150pts** → Console shows "Bottom chrome: COLLAPSED" → Bottom pill appears
3. **Scroll up** → Console shows "EXPANDED" messages → Chrome expands back

---

## If Still Not Working

### Possibility 1: Web Content Handling Scroll
The web app might be preventing native scroll. Check if:
- Web content has `overflow: hidden` or `position: fixed`
- Web app is using custom scroll containers
- JavaScript is capturing scroll events

### Possibility 2: Parent Relationship Issue
The `LTMBridgeViewController` might not have `RootShellViewController` as parent.

Add this debug line in `updateChromeForScroll`:
```swift
print("[Chrome] Parent type: \(type(of: parent))")
```

Should print: `RootShellViewController`

### Possibility 3: Delay Needed
Try adding a longer delay:

```swift
override open func viewDidAppear(_ animated: Bool) {
    super.viewDidAppear(animated)
    
    if UIDevice.current.userInterfaceIdiom == .phone && scrollObserver == nil {
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            self.setupScrollDetection()
        }
    }
}
```

---

## Remove Debug Logging Later

Once it works, remove these print statements for production:
- All `print("[Chrome] ...")` lines
- Especially the scroll position logging (fires very frequently)

---

## What Changed

| File | Change | Why |
|------|--------|-----|
| AppDelegate.swift | Moved setupScrollDetection to viewDidAppear | webView wasn't ready earlier |
| AppDelegate.swift | Enabled bounces = true | Was preventing scroll |
| AppDelegate.swift | Added debug logging | To diagnose issues |

---

## Next Steps

1. Build and run
2. Check console for setup messages
3. Scroll and watch for state changes
4. Report back what you see in the console
