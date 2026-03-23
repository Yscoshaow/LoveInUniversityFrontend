import type { BleAdapter, BleDevice, BleConnection } from './types';

// Standard BLE UUIDs for Device Information Service
const DEVICE_INFO_SERVICE = 0x180a;
const SYSTEM_ID_CHAR = 0x2a23;
const SERIAL_NUMBER_CHAR = 0x2a25;

class WebBleConnection implements BleConnection {
  device: BleDevice;
  private server: BluetoothRemoteGATTServer;
  private serviceCache = new Map<string, BluetoothRemoteGATTService>();
  private charCache = new Map<string, BluetoothRemoteGATTCharacteristic>();
  private notifyListeners = new Map<string, (event: Event) => void>();

  constructor(device: BleDevice, server: BluetoothRemoteGATTServer) {
    this.device = device;
    this.server = server;
  }

  /**
   * Check if GATT server is still connected, reconnect if not.
   * Clears service/characteristic caches on reconnection since old references are stale.
   */
  private async ensureServerConnected(): Promise<void> {
    if (this.server.connected) return;

    console.log('[BLE-Web] GATT server disconnected, attempting reconnect...');
    this.serviceCache.clear();
    this.charCache.clear();

    const btDevice = this.server.device;
    if (!btDevice.gatt) {
      throw new Error('设备不支持 GATT，无法重连');
    }
    this.server = await btDevice.gatt.connect();
    console.log('[BLE-Web] GATT server reconnected successfully');
  }

  private async getCharacteristic(
    serviceUuid: string,
    charUuid: string,
  ): Promise<BluetoothRemoteGATTCharacteristic> {
    await this.ensureServerConnected();

    const key = `${serviceUuid}:${charUuid}`;
    const cached = this.charCache.get(key);
    if (cached) return cached;

    let service = this.serviceCache.get(serviceUuid);
    if (!service) {
      service = await this.server.getPrimaryService(serviceUuid);
      this.serviceCache.set(serviceUuid, service);
    }

    const char = await service.getCharacteristic(charUuid);
    this.charCache.set(key, char);
    return char;
  }

  async write(serviceUuid: string, charUuid: string, data: ArrayBuffer): Promise<void> {
    const char = await this.getCharacteristic(serviceUuid, charUuid);
    await char.writeValue(data);
  }

  async writeWithoutResponse(serviceUuid: string, charUuid: string, data: ArrayBuffer): Promise<void> {
    const char = await this.getCharacteristic(serviceUuid, charUuid);
    await char.writeValueWithoutResponse(data);
  }

  async startNotifications(
    serviceUuid: string,
    charUuid: string,
    callback: (data: DataView) => void,
  ): Promise<void> {
    const char = await this.getCharacteristic(serviceUuid, charUuid);
    await char.startNotifications();

    const handler = (event: Event) => {
      const value = (event.target as BluetoothRemoteGATTCharacteristic).value;
      if (value) callback(value);
    };

    const key = `${serviceUuid}:${charUuid}`;
    this.notifyListeners.set(key, handler);
    char.addEventListener('characteristicvaluechanged', handler);
  }

  async stopNotifications(serviceUuid: string, charUuid: string): Promise<void> {
    const key = `${serviceUuid}:${charUuid}`;
    const handler = this.notifyListeners.get(key);
    if (handler) {
      const char = await this.getCharacteristic(serviceUuid, charUuid);
      char.removeEventListener('characteristicvaluechanged', handler);
      await char.stopNotifications();
      this.notifyListeners.delete(key);
    }
  }

  async disconnect(): Promise<void> {
    // Clean up all notification listeners
    for (const [key, handler] of this.notifyListeners) {
      const [serviceUuid, charUuid] = key.split(':');
      try {
        const char = this.charCache.get(key);
        if (char) {
          char.removeEventListener('characteristicvaluechanged', handler);
        }
      } catch { /* ignore */ }
    }
    this.notifyListeners.clear();
    this.charCache.clear();
    this.serviceCache.clear();
    this.server.disconnect();
  }
}

export class WebBleAdapter implements BleAdapter {
  private webDevices = new Map<string, BluetoothDevice>();

  isAvailable(): boolean {
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  }

  async requestDevice(options: {
    namePrefix?: string;
    namePrefixes?: string[];
    services?: string[];
    optionalServices?: string[];
  }): Promise<BleDevice> {
    const filters: BluetoothLEScanFilter[] = [];
    // Support multiple name prefixes (each as a separate filter — Web BLE OR-matches them)
    const prefixes = options.namePrefixes ?? (options.namePrefix ? [options.namePrefix] : []);
    for (const prefix of prefixes) {
      filters.push({ namePrefix: prefix });
    }
    if (options.services) {
      filters.push({ services: options.services });
    }
    if (filters.length === 0) {
      filters.push({ namePrefix: '' }); // fallback: accept all named devices
    }

    // Always include Device Information Service for MAC address reading
    const optionalServices: (string | number)[] = [
      ...(options.optionalServices || []),
      DEVICE_INFO_SERVICE,
    ];

    const device = await navigator.bluetooth.requestDevice({
      filters,
      optionalServices,
    });

    this.webDevices.set(device.id, device);

    return {
      id: device.id,
      name: device.name || null,
      macAddress: null, // Web Bluetooth does not expose MAC address
    };
  }

  /**
   * Try to read MAC address from device characteristics after connecting.
   * Web Bluetooth doesn't expose MAC directly, but the device may expose it
   * via Device Information Service or other characteristics.
   */
  private async tryReadMacFromServer(server: BluetoothRemoteGATTServer): Promise<string | null> {
    const macRegex = /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/;

    // ── Approach 1: System ID characteristic (0x2A23) ──
    try {
      const service = await server.getPrimaryService(DEVICE_INFO_SERVICE);
      const char = await service.getCharacteristic(SYSTEM_ID_CHAR);
      const data = await char.readValue();
      const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
      console.log('[BLE-Web] System ID raw bytes:', Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(' '));

      if (data.byteLength === 8) {
        const mac = [bytes[0], bytes[1], bytes[2], bytes[5], bytes[6], bytes[7]]
          .map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(':');
        if (macRegex.test(mac)) {
          console.log('[BLE-Web] ✅ MAC from System ID:', mac);
          return mac;
        }
      }
      if (data.byteLength === 6) {
        const mac = Array.from(bytes).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(':');
        if (macRegex.test(mac)) {
          console.log('[BLE-Web] ✅ MAC from System ID (6-byte):', mac);
          return mac;
        }
      }
    } catch (e) {
      console.log('[BLE-Web] ❌ Approach 1 (System ID) failed:', e);
    }

    // ── Approach 2: Serial Number String (0x2A25) ──
    try {
      const service = await server.getPrimaryService(DEVICE_INFO_SERVICE);
      const char = await service.getCharacteristic(SERIAL_NUMBER_CHAR);
      const data = await char.readValue();
      const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
      const text = new TextDecoder().decode(bytes);
      console.log('[BLE-Web] Serial Number String:', text);

      const macMatch = text.match(/([0-9A-Fa-f]{2}[:\-]){5}[0-9A-Fa-f]{2}/);
      if (macMatch) {
        const mac = macMatch[0].replace(/-/g, ':').toUpperCase();
        console.log('[BLE-Web] ✅ MAC from Serial Number:', mac);
        return mac;
      }
    } catch (e) {
      console.log('[BLE-Web] ❌ Approach 2 (Serial Number) failed:', e);
    }

    // ── Approach 3: Enumerate accessible services for MAC-like data ──
    try {
      const services = await server.getPrimaryServices();
      console.log('[BLE-Web] Discovered services:', services.map(s => s.uuid));

      for (const service of services) {
        // Skip known protocol services
        if (service.uuid.startsWith('00009')) continue;

        try {
          const chars = await service.getCharacteristics();
          for (const char of chars) {
            if (!char.properties.read) continue;
            try {
              const data = await char.readValue();
              const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
              const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(' ');
              console.log(`[BLE-Web] Read ${service.uuid}/${char.uuid} (${data.byteLength}B): ${hex}`);

              if (data.byteLength === 6) {
                const mac = Array.from(bytes).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(':');
                if (macRegex.test(mac)) {
                  console.log(`[BLE-Web] ✅ MAC from ${char.uuid}:`, mac);
                  return mac;
                }
              }
              if (data.byteLength === 8) {
                const mac = [bytes[0], bytes[1], bytes[2], bytes[5], bytes[6], bytes[7]]
                  .map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(':');
                if (macRegex.test(mac)) {
                  console.log(`[BLE-Web] ✅ MAC from ${char.uuid} (System ID format):`, mac);
                  return mac;
                }
              }
              if (data.byteLength > 6) {
                try {
                  const text = new TextDecoder().decode(bytes);
                  const m = text.match(/([0-9A-Fa-f]{2}[:\-]){5}[0-9A-Fa-f]{2}/);
                  if (m) {
                    const mac = m[0].replace(/-/g, ':').toUpperCase();
                    console.log(`[BLE-Web] ✅ MAC from text in ${char.uuid}:`, mac);
                    return mac;
                  }
                } catch { /* not valid text */ }
              }
            } catch { /* skip unreadable */ }
          }
        } catch { /* skip service */ }
      }
    } catch (e) {
      console.log('[BLE-Web] ❌ Approach 3 (service discovery) failed:', e);
    }

    console.log('[BLE-Web] ⚠️ Could not read MAC address from device');
    return null;
  }

  async connect(deviceId: string, _optionalServices?: string[], onDisconnect?: () => void): Promise<BleConnection> {
    const device = this.webDevices.get(deviceId);
    if (!device) throw new Error('Device not found. Call requestDevice first.');

    if (onDisconnect) {
      device.addEventListener('gattserverdisconnected', () => onDisconnect(), { once: true });
    }

    const server = await device.gatt!.connect();

    // Try to read MAC address from device characteristics
    const macAddress = await this.tryReadMacFromServer(server);

    return new WebBleConnection(
      { id: device.id, name: device.name || null, macAddress },
      server,
    );
  }
}
