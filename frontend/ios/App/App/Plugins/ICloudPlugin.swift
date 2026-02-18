import Foundation
import Capacitor

@objc(ICloudPlugin)
public class ICloudPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ICloudPlugin"
    public let jsName = "ICloud"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getContainerURL", returnType: CAPPluginReturnPromise)
    ]

    @objc func getContainerURL(_ call: CAPPluginCall) {
        DispatchQueue.global(qos: .userInitiated).async {
            guard let containerURL = FileManager.default.url(forUbiquityContainerIdentifier: nil) else {
                call.reject("iCloud is not available. Please sign in to iCloud in Settings.")
                return
            }

            // Use the Documents subdirectory within the iCloud container
            let documentsURL = containerURL.appendingPathComponent("Documents")

            // Create the Documents directory if it doesn't exist
            try? FileManager.default.createDirectory(at: documentsURL, withIntermediateDirectories: true)

            call.resolve([
                "url": documentsURL.path,
                "containerUrl": containerURL.path,
            ])
        }
    }
}
