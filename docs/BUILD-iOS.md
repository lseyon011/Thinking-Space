# Building for iOS (iPad / iPhone)

## Prerequisites

- macOS with Xcode 15+ installed
- Apple Developer account (free works for simulator testing)
- Node.js 18+
- CocoaPods (`sudo gem install cocoapods`)

## Quick Start

```bash
cd frontend

# Build the web app and sync to iOS project
npm run build:ios

# Open in Xcode
npm run package:ios
```

This opens the Xcode project. From there you can run on a simulator or connected device.

## iCloud Setup (Required for iCloud Vault Storage)

The app supports storing the vault in iCloud Drive for cross-device sync. This requires additional Xcode configuration:

### 1. Enable iCloud Capability

1. Open `frontend/ios/App/App.xcworkspace` in Xcode
2. Select the **App** target in the project navigator
3. Go to **Signing & Capabilities** tab
4. Click **+ Capability** and add **iCloud**
5. Check **iCloud Documents**
6. Under Containers, click **+** and add: `iCloud.com.anurag.ltm`

### 2. Verify Entitlements

After enabling iCloud, Xcode creates `App.entitlements` with:

```xml
<key>com.apple.developer.icloud-container-identifiers</key>
<array>
    <string>iCloud.com.anurag.ltm</string>
</array>
<key>com.apple.developer.ubiquity-container-identifiers</key>
<array>
    <string>iCloud.com.anurag.ltm</string>
</array>
```

### 3. Native Plugin Registration

The `ICloudPlugin.swift` in `ios/App/App/Plugins/` is automatically detected by Capacitor. No manual bridge registration is needed.

## Building for Simulator

1. In Xcode, select an iPad or iPhone simulator from the device dropdown
2. Press **Cmd+R** to build and run
3. On first launch, the app will prompt for storage location (iCloud or Local)

## Building for Device

1. Connect your iOS device
2. In Xcode, select your device from the dropdown
3. Under Signing & Capabilities, select your development team
4. Press **Cmd+R** to build and run

## TestFlight Distribution

1. In Xcode, select **Product > Archive**
2. In the Organizer, click **Distribute App**
3. Choose **App Store Connect** > **Upload**
4. In App Store Connect, add the build to a TestFlight group

## Troubleshooting

### "iCloud is not available"
- Ensure the device is signed in to iCloud (Settings > Apple ID > iCloud)
- Ensure iCloud Drive is enabled
- The iCloud container may take a few minutes to provision on first use

### Web assets not updating
Run `npm run build:ios` again to rebuild and re-sync the web assets.

### Plugin not found
After modifying Swift plugins, you may need to run:
```bash
cd frontend/ios/App && pod install
```
