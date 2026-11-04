import Capacitor

class DockedBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(DockedAppleBillingPlugin())
    }
}
