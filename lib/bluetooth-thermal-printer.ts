/**
 * Generic Bluetooth ESC/POS thermal printer driver (Web Bluetooth).
 * Works with most BLE-capable thermal printers (Vozy, generic POS-58/POS-80, etc).
 *
 * Notes:
 * - Web Bluetooth is supported on Android Chrome, desktop Chrome/Edge. NOT iOS Safari.
 * - The printer must support Bluetooth Low Energy (BLE), not classic Bluetooth SPP.
 * - Different printer brands use different GATT service/characteristic UUIDs.
 *   The connect flow tries the most common ones.
 */

// Common BLE service/characteristic UUIDs found on cheap thermal printers
const KNOWN_SERVICES: Array<{ service: string; writeChar: string }> = [
  // POS-58/80 style (most common)
  { service: "000018f0-0000-1000-8000-00805f9b34fb", writeChar: "00002af1-0000-1000-8000-00805f9b34fb" },
  // HM-10 module style (used by some brands)
  { service: "0000ff00-0000-1000-8000-00805f9b34fb", writeChar: "0000ff02-0000-1000-8000-00805f9b34fb" },
  // Nordic UART service (some Vozy variants)
  { service: "6e400001-b5a3-f393-e0a9-e50e24dcca9e", writeChar: "6e400002-b5a3-f393-e0a9-e50e24dcca9e" },
];

const ESC = "\x1B";
const GS = "\x1D";
const CMD = {
  INIT: `${ESC}\x40`,
  BOLD_ON: `${ESC}\x45\x01`,
  BOLD_OFF: `${ESC}\x45\x00`,
  ALIGN_CENTER: `${ESC}\x61\x01`,
  ALIGN_LEFT: `${ESC}\x61\x00`,
  DOUBLE_HEIGHT: `${ESC}\x21\x10`,
  NORMAL: `${ESC}\x21\x00`,
  CUT: `${GS}\x56\x00`,
  LF: "\x0A",
};

const RECEIPT_WIDTH = 32; // characters per line for 58mm paper

function padLine(left: string, right: string, width = RECEIPT_WIDTH): string {
  const gap = width - left.length - right.length;
  if (gap <= 0) return left + " " + right;
  return left + " ".repeat(gap) + right;
}

function divider(width = RECEIPT_WIDTH): string {
  return "-".repeat(width);
}

function formatPrice(cents: number): string {
  return `\u20B1${(cents / 100).toFixed(2)}`;
}

export type BluetoothReceiptData = {
  shopName: string;
  address?: string;
  orderNumber: string;
  date: string;
  cashierName: string;
  items: Array<{
    name: string;
    quantity: number;
    subtotal: number;
    modifiers: Array<{ name: string; priceAdj: number }>;
  }>;
  subtotal: number;
  taxLabel: string;
  taxRate: number;
  taxAmount: number;
  total: number;
  paymentType: string;
  cashTendered?: number;
  cashChange?: number;
};

export type BluetoothStickerData = {
  orderNumber: string;
  name: string;
  indexLabel: string;
  time: string;
  modifiers: Array<{ name: string }>;
  customerName?: string;
  tableName?: string;
};

class BluetoothThermalPrinter {
  private device: BluetoothDevice | null = null;
  private characteristic: BluetoothRemoteGATTCharacteristic | null = null;
  private deviceName: string | null = null;

  isConnected(): boolean {
    return this.device?.gatt?.connected === true && this.characteristic !== null;
  }

  getDeviceName(): string | null {
    return this.deviceName;
  }

  async connect(): Promise<{ name: string }> {
    if (typeof navigator === "undefined" || !("bluetooth" in navigator)) {
      throw new Error("Web Bluetooth is not supported in this browser");
    }

    // Ask user to pick a device. We list all the known services so the device
    // picker shows nearby printers.
    const device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: KNOWN_SERVICES.map((s) => s.service),
    });

    if (!device.gatt) throw new Error("Selected device has no GATT server");

    const server = await device.gatt.connect();

    let writeChar: BluetoothRemoteGATTCharacteristic | null = null;
    let lastErr: unknown = null;
    for (const { service, writeChar: writeCharUuid } of KNOWN_SERVICES) {
      try {
        const svc = await server.getPrimaryService(service);
        writeChar = await svc.getCharacteristic(writeCharUuid);
        break;
      } catch (err) {
        lastErr = err;
      }
    }

    if (!writeChar) {
      device.gatt.disconnect();
      throw new Error(
        `Could not find a known printer service on this device. Last error: ${
          lastErr instanceof Error ? lastErr.message : String(lastErr)
        }`
      );
    }

    this.device = device;
    this.characteristic = writeChar;
    this.deviceName = device.name ?? "Unknown printer";

    device.addEventListener("gattserverdisconnected", () => {
      this.characteristic = null;
    });

    return { name: this.deviceName };
  }

  async disconnect(): Promise<void> {
    if (this.device?.gatt?.connected) this.device.gatt.disconnect();
    this.characteristic = null;
    this.device = null;
    this.deviceName = null;
  }

  private async writeRaw(bytes: Uint8Array): Promise<void> {
    if (!this.characteristic) throw new Error("Printer not connected");
    // BLE has a limited MTU; chunk into 180-byte writes (safe across devices)
    const CHUNK = 180;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      const slice = bytes.subarray(i, Math.min(i + CHUNK, bytes.length));
      await this.characteristic.writeValueWithoutResponse(slice);
      // Small delay to let the printer's buffer drain
      await new Promise((r) => setTimeout(r, 20));
    }
  }

  private async writeText(text: string): Promise<void> {
    const encoder = new TextEncoder();
    await this.writeRaw(encoder.encode(text));
  }

  async printReceipt(data: BluetoothReceiptData): Promise<void> {
    let r = CMD.INIT;
    r += CMD.ALIGN_CENTER + CMD.DOUBLE_HEIGHT + data.shopName + CMD.LF + CMD.NORMAL;
    if (data.address) r += data.address + CMD.LF;
    r += divider() + CMD.LF;
    r += CMD.ALIGN_LEFT;
    r += `Order #${data.orderNumber}` + CMD.LF;
    r += `Date: ${data.date}` + CMD.LF;
    r += `Cashier: ${data.cashierName}` + CMD.LF;
    r += divider() + CMD.LF;
    for (const it of data.items) {
      r += padLine(`${it.quantity}x ${it.name}`, formatPrice(it.subtotal)) + CMD.LF;
      for (const m of it.modifiers) {
        r += `  + ${m.name}` + (m.priceAdj > 0 ? ` ${formatPrice(m.priceAdj)}` : "") + CMD.LF;
      }
    }
    r += divider() + CMD.LF;
    r += padLine("Subtotal", formatPrice(data.subtotal)) + CMD.LF;
    r += padLine(`${data.taxLabel} (${(data.taxRate * 100).toFixed(0)}%)`, formatPrice(data.taxAmount)) + CMD.LF;
    r += CMD.BOLD_ON + padLine("TOTAL", formatPrice(data.total)) + CMD.LF + CMD.BOLD_OFF;
    r += `Payment: ${data.paymentType}` + CMD.LF;
    if (data.cashTendered !== undefined) {
      r += padLine("Cash tendered", formatPrice(data.cashTendered)) + CMD.LF;
      r += padLine("Change", formatPrice(data.cashChange ?? 0)) + CMD.LF;
    }
    r += divider() + CMD.LF;
    r += CMD.ALIGN_CENTER + "Thank you!" + CMD.LF;
    r += "Powered by bevi&go" + CMD.LF;
    r += CMD.LF + CMD.LF + CMD.LF;
    r += CMD.CUT;
    await this.writeText(r);
  }

  async printStickers(stickers: BluetoothStickerData[]): Promise<void> {
    let payload = "";
    for (const s of stickers) {
      payload += CMD.INIT;
      payload += CMD.ALIGN_LEFT;
      const tag = (s.customerName ?? s.tableName ?? "").trim();
      if (tag.length > 0) {
        // Name dominant: BIG NAME on top, then item, then modifiers
        payload += CMD.DOUBLE_HEIGHT + tag.toUpperCase() + CMD.LF + CMD.NORMAL;
        payload += s.name + CMD.LF;
      } else {
        payload += CMD.DOUBLE_HEIGHT + s.name + CMD.LF + CMD.NORMAL;
      }
      for (const m of s.modifiers) payload += `+ ${m.name}` + CMD.LF;
      payload += padLine(`${s.orderNumber} ${s.indexLabel}`, s.time) + CMD.LF;
      payload += CMD.LF + CMD.LF;
      payload += CMD.CUT;
    }
    await this.writeText(payload);
  }

  async printTest(): Promise<void> {
    let r = CMD.INIT;
    r += CMD.ALIGN_CENTER + CMD.DOUBLE_HEIGHT + "TEST PRINT" + CMD.LF + CMD.NORMAL;
    r += divider() + CMD.LF;
    r += CMD.ALIGN_LEFT + "If you can read this," + CMD.LF;
    r += "your Bluetooth printer is" + CMD.LF;
    r += "connected and working." + CMD.LF;
    r += CMD.LF + CMD.LF + CMD.CUT;
    await this.writeText(r);
  }
}

export const bluetoothPrinter = new BluetoothThermalPrinter();
