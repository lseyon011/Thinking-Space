# 🧪 TEST BUILD - Auto Collapse/Expand

## I've Added an Automatic Test

The app will now automatically test the chrome animation when you launch it.

---

## What Will Happen

1. **Launch app on iPhone simulator**
2. **Wait 3 seconds** → Chrome should automatically COLLAPSE
3. **Wait 3 more seconds** (6 total) → Chrome should automatically EXPAND

---

## What to Watch For

### Console Output:
```
[TEST] 🔽 Collapsing chrome in 3 seconds...
(chrome should shrink)

[TEST] 🔼 Expanding chrome in 6 seconds...
(chrome should expand)
```

### Visual Changes:
- **At 3 seconds:**
  - Top chrome shrinks from ~58pt to ~34pt
  - Bottom chrome collapses to centered pill
  - Sidebar button stays visible (left side)
  
- **At 6 seconds:**
  - Top chrome expands back to ~58pt
  - Bottom chrome expands to full bar
  - All controls visible

---

## Possible Outcomes

### ✅ Outcome 1: Chrome Collapses and Expands Automatically
**This means:**
- Animation system WORKS
- State management WORKS
- Layout constraints WORK
- **The only issue is scroll detection**

**Next step:** We need to hook up scroll events in your web app code (not native)

---

### ❌ Outcome 2: Nothing Happens
**This means:**
- Animation system might be broken
- State changes not being observed
- Constraint updates not working

**Next step:** Debug the RootShellViewController observers

---

### ⚠️ Outcome 3: Partial Animation
**This means:**
- Top works but bottom doesn't (or vice versa)
- Some constraints work, others don't

**Next step:** Fix the specific constraint that's broken

---

## After Testing

Once you see what happens, report back:

1. **Did it collapse at 3 seconds?** YES / NO
2. **Did it expand at 6 seconds?** YES / NO
3. **Did sidebar button stay visible when collapsed?** YES / NO
4. **Did animations look smooth?** YES / NO
5. **Take a screen recording if possible!**

---

## Removing the Test

Once we confirm it works, I'll remove the test code. It's wrapped in `#if DEBUG` so it only runs in development builds.

To remove it yourself, just delete the `viewDidAppear` override from `RootShellViewController.swift`.

---

## Summary

**Build → Run → Wait 3 seconds → Watch chrome collapse → Wait 3 more → Watch expand**

This will tell us if the animation system works at all, independent of scroll detection!
