# Quick Test - Does Chrome Animation Even Work?

## First, Let's Test If The Animation Works At All

Before debugging scroll detection, let's verify the chrome can actually collapse/expand.

### Test 1: Manual Collapse via Code

Add this temporary code to `RootShellViewController.swift` in `viewDidAppear`:

```swift
override func viewDidAppear(_ animated: Bool) {
    super.viewDidAppear(animated)
    
    // TEST: Auto-collapse after 3 seconds
    DispatchQueue.main.asyncAfter(deadline: .now() + 3.0) {
        print("[TEST] Collapsing chrome...")
        self.chromeState.isTopBarCollapsed = true
        self.chromeState.isBottomBarCollapsed = true
    }
    
    // TEST: Expand after 6 seconds
    DispatchQueue.main.asyncAfter(deadline: .now() + 6.0) {
        print("[TEST] Expanding chrome...")
        self.chromeState.isTopBarCollapsed = false
        self.chromeState.isBottomBarCollapsed = false
    }
}
```

**Expected Result:**
- App loads
- After 3 seconds → Chrome shrinks
- After 6 seconds → Chrome expands back

**If this doesn't work** → The animation system itself is broken
**If this works** → We know animations work, just need to hook up scroll

---

### Test 2: Manual Collapse via Safari Console

1. Build and run app
2. Open Safari Web Inspector (Develop → Simulator → Your App)
3. In console, type:

```javascript
// Check if plugin exists
window.Capacitor.Plugins.TopChrome

// Try to collapse
window.Capacitor.Plugins.TopChrome.setState({
  topBarCollapsed: true,
  bottomBarCollapsed: true
});

// Wait a few seconds, then expand
window.Capacitor.Plugins.TopChrome.setState({
  topBarCollapsed: false,
  bottomBarCollapsed: false
});
```

**Expected Result:**
- Chrome shrinks when you run the first command
- Chrome expands when you run the second command

**If this doesn't work** → Plugin communication is broken
**If this works** → Plugin works, just need to call it on scroll

---

## If Test 1 Works But Test 2 Doesn't

The issue is with the Capacitor plugin bridge. Check:

1. Is `TopChromePlugin` registered? Check console for:
   ```
   [Capacitor] Plugin registered: TopChrome
   ```

2. Try the older API:
   ```javascript
   window.TopChrome.setState({
     topBarCollapsed: true,
     bottomBarCollapsed: true
   });
   ```

---

## If Both Tests Work

Then we just need to add scroll detection in the **web app source code**, not native side.

You would add to your React/TypeScript code:

```typescript
import { Capacitor } from '@capacitor/core';
const { TopChrome } = Capacitor.Plugins;

useEffect(() => {
  let lastScrollY = 0;
  
  const handleScroll = () => {
    const scrollY = window.scrollY || document.documentElement.scrollTop;
    const direction = scrollY > lastScrollY ? 'down' : 'up';
    
    const shouldCollapseTop = direction === 'down' && scrollY > 50;
    const shouldCollapseBottom = direction === 'down' && scrollY > 150;
    
    TopChrome.setState({
      topBarCollapsed: shouldCollapseTop,
      bottomBarCollapsed: shouldCollapseBottom
    });
    
    lastScrollY = scrollY;
  };
  
  window.addEventListener('scroll', handleScroll, { passive: true });
  
  return () => window.removeEventListener('scroll', handleScroll);
}, []);
```

---

## Summary

1. **Run Test 1** (native code auto-collapse) → Does animation work?
2. **Run Test 2** (Safari console manual call) → Does plugin work?
3. **If both work** → We know the system works, just need to wire up scroll in web app
4. **Report back** which tests pass/fail

This will tell us exactly where the issue is!
