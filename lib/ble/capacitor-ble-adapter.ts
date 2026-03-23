import { BleClient } from '@capacitor-community/bluetooth-le';
import { Capacitor } from '@capacitor/core';
import type { BleAdapter, BleDevice, BleConnection, OnDeviceFound } from './types';

let initialized = false;

// Standard BLE UUIDs for Device Information Service
const DEVICE_INFO_SERVICE = '0000180a-0000-1000-8000-00805f9b34fb';
const SYSTEM_ID_CHAR = '00002a23-0000-1000-8000-00805f9b34fb';
const SERIAL_NUMBER_CHAR = '00002a25-0000-1000-8000-00805f9b34fb';

class CapacitorBleConnection implements BleConnection {
  device: BleDevice;
  private deviceId: string;

  constructor(device: BleDevice, deviceId: string) {
    this.device = device;
    this.deviceId = deviceId;
  }

  async write(serviceUuid: string, charUuid: string, data: ArrayBuffer): Promise<void> {
    await BleClient.write(this.deviceId, serviceUuid, charUuid, new DataView(data));
  }

  async writeWithoutResponse(serviceUuid: string, charUuid: string, data: ArrayBuffer): Promise<void> {
    await BleClient.writeWithoutResponse(this.deviceId, serviceUuid, charUuid, new DataView(data));
  }

  async startNotifications(
    serviceUuid: string,
    charUuid: string,
    callback: (data: DataView) => void,
  ): Promise<void> {
    await BleClient.startNotifications(this.deviceId, serviceUuid, charUuid, callback);
  }

  async stopNotifications(serviceUuid: string, charUuid: string): Promise<void> {
    await BleClient.stopNotifications(this.deviceId, serviceUuid, charUuid);
  }

  async disconnect(): Promise<void> {
    await BleClient.disconnect(this.deviceId);
  }
}

export class CapacitorBleAdapter implements BleAdapter {
  isAvailable(): boolean {
    return true; // Capacitor native BLE is always available on Android
  }

  private async ensureInitialized(): Promise<void> {
    if (initialized) return;
    await BleClient.initialize({ androidNeverForLocation: true });
    initialized = true;
  }

  /** Check Android prerequisites (location + Bluetooth enabled) before scanning */
  private async ensureAndroidReady(): Promise<void> {
    if (Capacitor.getPlatform() !== 'android') return;

    const isBluetoothEnabled = await BleClient.isEnabled();
    if (!isBluetoothEnabled) {
      await BleClient.openBluetoothSettings();
      throw new Error('请开启蓝牙后重试');
    }

    const isLocationEnabled = await BleClient.isLocationEnabled();
    if (!isLocationEnabled) {
      await BleClient.openLocationSettings();
      // Re-check after user returns from settings
      const stillDisabled = !(await BleClient.isLocationEnabled());
      if (stillDisabled) {
        throw new Error('需要开启定位服务才能搜索蓝牙设备');
      }
    }
  }

  async requestDevice(options: {
    namePrefix?: string;
    namePrefixes?: string[];
    services?: string[];
    optionalServices?: string[];
  }): Promise<BleDevice> {
    await this.ensureInitialized();
    await this.ensureAndroidReady();

    // Merge services into optionalServices for post-connection access.
    // Only use namePrefix as scan filter — using both namePrefix + services
    // would require AND match, which is too restrictive for devices that
    // don't always advertise service UUIDs.
    const allOptional = [
      ...(options.services || []),
      ...(options.optionalServices || []),
    ];

    // Capacitor only supports a single namePrefix. When scanning for multiple
    // prefixes (e.g., YS0 and OKGSS), omit the prefix filter and show all
    // nearby devices — the user can identify their own device by name.
    const singlePrefix = options.namePrefix ?? (
      options.namePrefixes?.length === 1 ? options.namePrefixes[0] : undefined
    );

    const device = await BleClient.requestDevice({
      ...(singlePrefix && { namePrefix: singlePrefix }),
      ...(allOptional.length > 0 && { optionalServices: allOptional }),
    });

    // On Android, deviceId IS the MAC address (e.g. "AA:BB:CC:DD:EE:FF")
    // On iOS, deviceId is a random UUID — not the real MAC address
    const isAndroid = Capacitor.getPlatform() === 'android';
    const isMacFormat = /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/.test(device.deviceId);

    return {
      id: device.deviceId,
      name: device.name || null,
      macAddress: isAndroid && isMacFormat ? device.deviceId : null,
    };
  }

  /**
   * On iOS, try to read the real MAC address from the BLE device after connecting.
   * Tries 3 approaches:
   * 1. Device Information Service (0x180A) → System ID (0x2A23)
   * 2. Device Information Service (0x180A) → Serial Number String (0x2A25)
   * 3. Enumerate all services/characteristics, log them, and try reading potential MAC sources
   */
  private async tryReadMacFromDevice(deviceId: string): Promise<string | null> {
    const macRegex = /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/;

    // ── Approach 1: System ID characteristic (0x2A23) ──
    try {
      const data = await BleClient.read(deviceId, DEVICE_INFO_SERVICE, SYSTEM_ID_CHAR);
      const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
      console.log('[BLE-iOS] System ID raw bytes:', Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(' '));

      if (data.byteLength === 8) {
        // IEEE 11073 System ID format: MAC[0..2] + FF FE + MAC[3..5]
        const mac = [bytes[0], bytes[1], bytes[2], bytes[5], bytes[6], bytes[7]]
          .map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(':');
        if (macRegex.test(mac)) {
          console.log('[BLE-iOS] ✅ MAC from System ID:', mac);
          return mac;
        }
      }
      // Some devices use 6 bytes directly
      if (data.byteLength === 6) {
        const mac = Array.from(bytes).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(':');
        if (macRegex.test(mac)) {
          console.log('[BLE-iOS] ✅ MAC from System ID (6-byte):', mac);
          return mac;
        }
      }
    } catch (e) {
      console.log('[BLE-iOS] ❌ Approach 1 (System ID) failed:', e);
    }

    // ── Approach 2: Serial Number String (0x2A25) ──
    try {
      const data = await BleClient.read(deviceId, DEVICE_INFO_SERVICE, SERIAL_NUMBER_CHAR);
      const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
      const text = new TextDecoder().decode(bytes);
      console.log('[BLE-iOS] Serial Number String:', text);

      // Check if the string contains a MAC address
      const macMatch = text.match(/([0-9A-Fa-f]{2}[:\-]){5}[0-9A-Fa-f]{2}/);
      if (macMatch) {
        const mac = macMatch[0].replace(/-/g, ':').toUpperCase();
        console.log('[BLE-iOS] ✅ MAC from Serial Number:', mac);
        return mac;
      }
    } catch (e) {
      console.log('[BLE-iOS] ❌ Approach 2 (Serial Number) failed:', e);
    }

    // ── Approach 3: Discover all services and scan for MAC ──
    try {
      const services = await BleClient.getServices(deviceId);
      console.log('[BLE-iOS] Discovered services:', JSON.stringify(
        services.map(s => ({
          uuid: s.uuid,
          characteristics: s.characteristics.map(c => ({
            uuid: c.uuid,
            properties: c.properties,
          })),
        })),
        null,
        2,
      ));

      for (const service of services) {
        for (const char of service.characteristics) {
          // Only try readable characteristics; skip known YS protocol chars
          if (!char.properties?.read) continue;
          if (service.uuid.startsWith('00009')) continue; // skip Yiciyuan service

          try {
            const data = await BleClient.read(deviceId, service.uuid, char.uuid);
            const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
            const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(' ');
            console.log(`[BLE-iOS] Read ${service.uuid}/${char.uuid} (${data.byteLength}B): ${hex}`);

            // 6-byte → direct MAC
            if (data.byteLength === 6) {
              const mac = Array.from(bytes).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(':');
              if (macRegex.test(mac)) {
                console.log(`[BLE-iOS] ✅ MAC from ${char.uuid}:`, mac);
                return mac;
              }
            }

            // 8-byte → System ID format
            if (data.byteLength === 8) {
              const mac = [bytes[0], bytes[1], bytes[2], bytes[5], bytes[6], bytes[7]]
                .map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(':');
              if (macRegex.test(mac)) {
                console.log(`[BLE-iOS] ✅ MAC from ${char.uuid} (System ID format):`, mac);
                return mac;
              }
            }

            // Text content → look for MAC pattern
            if (data.byteLength > 6) {
              try {
                const text = new TextDecoder().decode(bytes);
                const m = text.match(/([0-9A-Fa-f]{2}[:\-]){5}[0-9A-Fa-f]{2}/);
                if (m) {
                  const mac = m[0].replace(/-/g, ':').toUpperCase();
                  console.log(`[BLE-iOS] ✅ MAC from text in ${char.uuid}:`, mac);
                  return mac;
                }
              } catch { /* not valid text */ }
            }
          } catch { /* skip unreadable */ }
        }
      }
    } catch (e) {
      console.log('[BLE-iOS] ❌ Approach 3 (service discovery) failed:', e);
    }

    console.log('[BLE-iOS] ⚠️ Could not read MAC address from device');
    return null;
  }

  async scanDevices(options: {
    namePrefixes: string[];
    services?: string[];
    onFound: OnDeviceFound;
    timeoutMs?: number;
  }): Promise<() => void> {
    await this.ensureInitialized();
    await this.ensureAndroidReady();

    const seen = new Set<string>();
    const isAndroid = Capacitor.getPlatform() === 'android';
    const timeoutMs = options.timeoutMs ?? 10000;

    await BleClient.requestLEScan(
      {
        ...(options.services?.length ? { services: options.services } : {}),
      },
      (result) => {
        const name = result.localName || result.device.name;
        if (!name) return;
        // If prefixes provided, filter by them; otherwise accept all named devices
        if (options.namePrefixes.length > 0) {
          const matches = options.namePrefixes.some(p => name.startsWith(p));
          if (!matches) return;
        }
        if (seen.has(result.device.deviceId)) return;
        seen.add(result.device.deviceId);

        const isMacFormat = /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/.test(result.device.deviceId);
        options.onFound({
          id: result.device.deviceId,
          name,
          macAddress: isAndroid && isMacFormat ? result.device.deviceId : null,
        });
      },
    );

    const timer = setTimeout(() => {
      BleClient.stopLEScan().catch(() => {});
    }, timeoutMs);

    return () => {
      clearTimeout(timer);
      BleClient.stopLEScan().catch(() => {});
    };
  }

  async connect(deviceId: string, _optionalServices?: string[], onDisconnect?: () => void): Promise<BleConnection> {
    await this.ensureInitialized();

    await BleClient.connect(deviceId, onDisconnect);

    const isAndroid = Capacitor.getPlatform() === 'android';
    const isMacFormat = /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/.test(deviceId);

    let macAddress: string | null = isAndroid && isMacFormat ? deviceId : null;

    // On iOS, try to read MAC from device characteristics
    if (!isAndroid && !macAddress) {
      macAddress = await this.tryReadMacFromDevice(deviceId);
    }

    const device: BleDevice = {
      id: deviceId,
      name: null,
      macAddress,
    };

    return new CapacitorBleConnection(device, deviceId);
  }
}
