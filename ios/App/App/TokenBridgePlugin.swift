import Capacitor
import WidgetKit

@objc(TokenBridgePlugin)
public class TokenBridgePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "TokenBridgePlugin"
    public let jsName = "TokenBridge"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setToken", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clearToken", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getToken", returnType: CAPPluginReturnPromise),
    ]

    @objc func setToken(_ call: CAPPluginCall) {
        guard let token = call.getString("token") else {
            call.reject("Token is required")
            return
        }
        SharedDataManager.setToken(token)
        WidgetCenter.shared.reloadAllTimelines()
        call.resolve()
    }

    @objc func clearToken(_ call: CAPPluginCall) {
        SharedDataManager.clearToken()
        WidgetCenter.shared.reloadAllTimelines()
        call.resolve()
    }

    @objc func getToken(_ call: CAPPluginCall) {
        let token = SharedDataManager.getToken()
        call.resolve(["token": token as Any])
    }
}
