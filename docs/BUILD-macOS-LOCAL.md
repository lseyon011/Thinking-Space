# Local macOS Build & Install (Self-Signed)

How to build the Electron app from source and install it as a real, runnable
macOS app **without an Apple Developer account** — the fast "edit → build →
sign → install → relaunch" loop used for personal builds of this fork.

> This is for **local/personal** builds. It is **not** how official signed/
> notarized releases are produced. See `BUILD-iOS.md` for iOS.

---

## TL;DR — the repeatable loop

After the one-time setup below, every change ships with:

```bash
cd ~/Documents/Thinking-Space
export PATH="/opt/homebrew/bin:$PATH"          # Node >= 22 (Capacitor needs it)

APP="frontend/electron/dist/mac-arm64/Thinking Space.app"
DST="$HOME/Applications/Thinking Space.app"

./build.sh mac                                 # 1. build (vite + electron + package)
codesign --deep --force --sign "Thinking Space Local Signing" "$APP"   # 2. sign
pkill -f "Thinking Space.app/Contents/MacOS"   # 3. quit running copy
rm -rf "$DST" && cp -R "$APP" "$DST"           # 4. install to ~/Applications
open "$DST"                                     # 5. relaunch
```

The build takes ~1.5–3 min. The artifact path is `arm64` on Apple Silicon.

---

## Why each step exists (the gotchas)

These are the non-obvious things that will bite you otherwise.

### 1. Node must be ≥ 22
`./build.sh mac` runs `npx cap sync @capacitor-community/electron`, and the
Capacitor CLI requires **Node ≥ 22**. The system Node at `/usr/local/bin/node`
may be older (e.g. v20), which makes the cap-sync step fail. Prefixing
`PATH="/opt/homebrew/bin:$PATH"` puts Homebrew's newer Node first.

### 2. `build.sh` does not stop on a failed step
`build.sh` swallows individual step failures and **still produces a `.dmg`,
printing a success line even if a step (e.g. cap sync) failed.** Never trust
the exit code alone. After building, check:

```bash
grep -c "✗" /tmp/your-build.log     # must be 0
```

### 3. The app must be code-signed — ad-hoc is not enough
macOS only grants **Keychain** access (used by `safeStorage` for Webull
credentials, etc.) to apps with a **stable code-signing identity**. A default
local build is *ad-hoc* signed, which macOS treats as unstable → the app
reports **"secure storage is unavailable."**

The fix is a one-time **self-signed certificate** (setup below) plus signing
the app with it on every build:

```bash
codesign --deep --force --sign "Thinking Space Local Signing" "$APP"
# verify: flags should read 0x0(none) with no "adhoc", Authority = your cert
codesign -dvv "$APP" 2>&1 | grep -iE "Authority|flags"
```

`electron-builder.config.json` also sets `mac.hardenedRuntime: false`, because
Hardened Runtime blocks Keychain access unless the app is signed with a real
Apple Developer ID (which local builds don't have).

### 4. Install to `~/Applications`, not `/Applications`
macOS **App Management** protection blocks writing app bundles into
`/Applications` from the terminal (`Operation not permitted`). Use
`~/Applications` (your home Applications folder) — it runs identically and has
no such restriction. (Finder drag-installs to `/Applications` still work; only
scripted copies are blocked.)

### 5. First launch: Gatekeeper
A self-signed app isn't notarized, so the first open may warn about an
"unidentified developer." Right-click the app → **Open → Open** once.

### 6. Changing the signing identity invalidates saved secrets
`safeStorage` ties its encryption key to the app's signature. If the signing
identity changes, previously-saved encrypted data can no longer be decrypted
and the app may show a decryption error. Clear the stale store and re-enter:

```bash
rm -f "$HOME/Library/Application Support/long-term-memory/secure-storage/webull.v1.json"
```

(Re-signing with the **same** certificate each time avoids this — credentials
then carry across rebuilds.)

---

## One-time setup

### A. Homebrew Node (≥ 22)
```bash
brew install node      # provides /opt/homebrew/bin/node
node -v                # confirm >= 22 with /opt/homebrew/bin first on PATH
```

### B. Self-signed code-signing certificate
Creates the stable identity macOS needs for Keychain access. The OpenSSL
`-legacy` flag is required so Apple's keychain can import the `.p12`.

```bash
cd /tmp
openssl req -x509 -newkey rsa:2048 -keyout cs.key -out cs.crt -days 3650 -nodes \
  -subj "/CN=Thinking Space Local Signing" \
  -addext "basicConstraints=critical,CA:false" \
  -addext "keyUsage=critical,digitalSignature" \
  -addext "extendedKeyUsage=critical,codeSigning"
openssl pkcs12 -export -legacy -inkey cs.key -in cs.crt -out cs.p12 -passout pass:tspass
security import cs.p12 -k "$HOME/Library/Keychains/login.keychain-db" -P tspass -T /usr/bin/codesign -A
rm -f cs.key cs.crt cs.p12
```

The first `codesign` run will pop a Keychain dialog — click **Always Allow**.
The cert shows as `CSSMERR_TP_NOT_TRUSTED`, which is fine: trust is only needed
to *verify* a signature, not to *sign* with it or to get Keychain access.

To remove it later: Keychain Access → login → delete "Thinking Space Local Signing".

---

## Quick reference

| What | Where |
|------|-------|
| Source repo | `~/Documents/Thinking-Space` |
| Build command | `./build.sh mac` (Node ≥ 22) |
| Built app | `frontend/electron/dist/mac-arm64/Thinking Space.app` |
| Installed app | `~/Applications/Thinking Space.app` |
| Signing identity | `Thinking Space Local Signing` (self-signed) |
| App data (userData) | `~/Library/Application Support/long-term-memory` |
| Typecheck only | `./build.sh typecheck` |
