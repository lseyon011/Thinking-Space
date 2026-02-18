import Foundation
import Capacitor
import UIKit
import UniformTypeIdentifiers

@objc(FolderPickerPlugin)
public class FolderPickerPlugin: CAPPlugin, CAPBridgedPlugin, UIDocumentPickerDelegate {
    public let identifier = "FolderPickerPlugin"
    public let jsName = "FolderPicker"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "pickFolder", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restoreBookmark", returnType: CAPPluginReturnPromise),
    ]

    private var pendingCall: CAPPluginCall?

    @objc func pickFolder(_ call: CAPPluginCall) {
        self.pendingCall = call

        DispatchQueue.main.async {
            let picker = UIDocumentPickerViewController(forOpeningContentTypes: [UTType.folder])
            picker.delegate = self
            picker.allowsMultipleSelection = false
            self.bridge?.viewController?.present(picker, animated: true)
        }
    }

    /// Restore a previously bookmarked folder so the app can access it across launches.
    @objc func restoreBookmark(_ call: CAPPluginCall) {
        guard let bookmarkData = UserDefaults.standard.data(forKey: "vault-folder-bookmark") else {
            call.reject("No bookmark saved")
            return
        }

        do {
            var isStale = false
            let url = try URL(
                resolvingBookmarkData: bookmarkData,
                options: [],
                relativeTo: nil,
                bookmarkDataIsStale: &isStale
            )

            let accessing = url.startAccessingSecurityScopedResource()

            // Re-save bookmark if stale
            if isStale {
                if let newData = try? url.bookmarkData(
                    options: .minimalBookmark,
                    includingResourceValuesForKeys: nil,
                    relativeTo: nil
                ) {
                    UserDefaults.standard.set(newData, forKey: "vault-folder-bookmark")
                }
            }

            call.resolve([
                "url": url.path,
                "accessing": accessing,
            ])
        } catch {
            call.reject("Failed to restore bookmark: \(error.localizedDescription)")
        }
    }

    // MARK: - UIDocumentPickerDelegate

    public func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        guard let url = urls.first else {
            pendingCall?.reject("No folder selected")
            pendingCall = nil
            return
        }

        // Start accessing the security-scoped resource
        let accessing = url.startAccessingSecurityScopedResource()

        // Bookmark the URL so we can access it across app launches
        do {
            let bookmarkData = try url.bookmarkData(
                options: .minimalBookmark,
                includingResourceValuesForKeys: nil,
                relativeTo: nil
            )
            UserDefaults.standard.set(bookmarkData, forKey: "vault-folder-bookmark")
        } catch {
            print("Failed to create bookmark: \(error)")
        }

        pendingCall?.resolve([
            "url": url.path,
            "accessing": accessing,
        ])
        pendingCall = nil
    }

    public func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
        pendingCall?.reject("User cancelled folder selection")
        pendingCall = nil
    }
}
