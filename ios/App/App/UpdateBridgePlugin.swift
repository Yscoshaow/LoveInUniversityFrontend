import Capacitor

@objc(UpdateBridgePlugin)
public class UpdateBridgePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "UpdateBridgePlugin"
    public let jsName = "UpdateBridge"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "checkForUpdate", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "downloadUpdate", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "installUpdate", returnType: CAPPluginReturnPromise),
    ]

    private let githubApiUrl = "https://api.github.com/repos/Yscoshaow/UniversityApp/releases/latest"

    @objc func checkForUpdate(_ call: CAPPluginCall) {
        guard let url = URL(string: githubApiUrl) else {
            call.reject("Invalid URL")
            return
        }

        var request = URLRequest(url: url)
        request.setValue("application/vnd.github.v3+json", forHTTPHeaderField: "Accept")

        URLSession.shared.dataTask(with: request) { data, _, error in
            if let error = error {
                call.reject("Failed to check: \(error.localizedDescription)")
                return
            }
            guard let data = data,
                  let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
                call.reject("Invalid response")
                return
            }

            let tagName = json["tag_name"] as? String ?? ""
            let latestVersion = tagName.hasPrefix("v") ? String(tagName.dropFirst()) : tagName
            let changelog = json["body"] as? String ?? ""
            let publishedAt = json["published_at"] as? String ?? ""
            let releaseUrl = json["html_url"] as? String ?? ""

            let currentVersion = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "0.0.0"

            call.resolve([
                "currentVersion": currentVersion,
                "latestVersion": latestVersion,
                "updateAvailable": self.isNewer(current: currentVersion, latest: latestVersion),
                "changelog": changelog,
                "apkUrl": "",
                "apkSize": 0,
                "publishedAt": publishedAt,
                "releaseUrl": releaseUrl,
            ])
        }.resume()
    }

    @objc func downloadUpdate(_ call: CAPPluginCall) {
        call.reject("Self-update is not supported on iOS. Please download the new version manually.")
    }

    @objc func installUpdate(_ call: CAPPluginCall) {
        call.reject("Self-update is not supported on iOS. Please download the new version manually.")
    }

    private func isNewer(current: String, latest: String) -> Bool {
        let c = current.split(separator: ".").compactMap { Int($0) }
        let l = latest.split(separator: ".").compactMap { Int($0) }
        for i in 0..<max(c.count, l.count) {
            let cv = i < c.count ? c[i] : 0
            let lv = i < l.count ? l[i] : 0
            if lv > cv { return true }
            if lv < cv { return false }
        }
        return false
    }
}
