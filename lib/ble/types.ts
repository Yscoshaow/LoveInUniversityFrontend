/** Represents a discovered BLE device */
export interface BleDevice {
  /** Device identifier — opaque on Web, MAC address on Android Capacitor */
  id: string;
  /** Advertised device name */
  name: string | null;
  /** MAC address — null on Web Bluetooth, directly available on Android Capacitor */
  macAddress: string | null;
}

/** Represents an active BLE connection with read/write/notify capabilities */
export interface BleConnection {
  device: BleDevice;
  write(serviceUuid: string, charUuid: string, data: ArrayBuffer): Promise<void>;
  writeWithoutResponse(serviceUuid: string, charUuid: string, data: ArrayBuffer): Promise<void>;
  startNotifications(
    serviceUuid: string,
    charUuid: string,
    callback: (data: DataView) => void,
  ): Promise<void>;
  stopNotifications(serviceUuid: string, charUuid: string): Promise<void>;
  disconnect(): Promise<void>;
}

/** Callback invoked each time a new device is discovered during scanning */
export type OnDeviceFound = (device: BleDevice) => void;

/** Platform-agnostic BLE adapter interface */
export interface BleAdapter {
  isAvailable(): boolean;
  requestDevice(options: {
    namePrefix?: string;
    namePrefixes?: string[];  // Scan for multiple device name prefixes simultaneously
    services?: string[];
    optionalServices?: string[];
  }): Promise<BleDevice>;
  /** Start scanning for devices matching the given name prefixes. Calls onFound for each match.
   *  Returns a stop function to end the scan. */
  scanDevices?(options: {
    namePrefixes: string[];
    services?: string[];
    onFound: OnDeviceFound;
    timeoutMs?: number;
  }): Promise<() => void>;
  connect(deviceId: string, optionalServices?: string[], onDisconnect?: () => void): Promise<BleConnection>;
}
