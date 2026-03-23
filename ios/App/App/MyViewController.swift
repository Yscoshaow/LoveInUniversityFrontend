import UIKit
import Capacitor

class MyViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(TokenBridgePlugin())
        bridge?.registerPluginInstance(MusicBridgePlugin())
        bridge?.registerPluginInstance(UpdateBridgePlugin())
    }
}
