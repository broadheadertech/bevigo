// ESC/POS Thermal Receipt Printer Service
// Uses Web Serial API for USB thermal printers

export type ReceiptItemData = {
  name: string;
  quantity: number;
  subtotal: number;
  modifiers: Array<{ name: string; priceAdj: number }>;
};

export type ReceiptData = {
  shopName: string;
  address?: string;
  orderNumber: string;
  date: string;
  cashierName: string;
  items: ReceiptItemData[];
  subtotal: number;
  taxLabel: string;
  taxRate: number;
  taxAmount: number;
  total: number;
  paymentType: string;
};

// ESC/POS command constants
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
  OPEN_DRAWER: `${ESC}\x70\x00\x19\x19`,
} as const;

const RECEIPT_WIDTH = 32; // characters for 58mm paper

function formatPrice(cents: number): string {
  return `\u20B1${(cents / 100).toFixed(2)}`;
}

function padLine(left: string, right: string, width: number = RECEIPT_WIDTH): string {
  const gap = width - left.length - right.length;
  if (gap <= 0) return left + " " + right;
  return left + " ".repeat(gap) + right;
}

function divider(width: number = RECEIPT_WIDTH): string {
  return "\u2500".repeat(width);
}

class ReceiptPrinter {
  private port: SerialPort | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private connected = false;

  async connect(): Promise<boolean> {
    try {
      if (typeof navigator === "undefined" || !("serial" in navigator)) {
        throw new Error("Web Serial API is not supported in this browser");
      }
      this.port = await navigator.serial.requestPort();
      await this.port.open({ baudRate: 9600 });
      if (this.port.writable) {
        this.writer = this.port.writable.getWriter();
        this.connected = true;
      }
      return true;
    } catch (err) {
      console.error("Failed to connect to printer:", err);
      this.connected = false;
      return false;
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.writer) {
        this.writer.releaseLock();
        this.writer = null;
      }
      if (this.port) {
        await this.port.close();
        this.port = null;
      }
    } catch (err) {
      console.error("Error disconnecting printer:", err);
    } finally {
      this.connected = false;
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  private async write(data: string): Promise<void> {
    if (!this.writer) throw new Error("Printer not connected");
    const encoder = new TextEncoder();
    await this.writer.write(encoder.encode(data));
  }

  async printReceipt(data: ReceiptData, openDrawer = false): Promise<void> {
    if (!this.connected || !this.writer) {
      throw new Error("Printer not connected");
    }

    try {
      let receipt = CMD.INIT;

      // Shop name (centered, double height)
      receipt += CMD.ALIGN_CENTER;
      receipt += CMD.DOUBLE_HEIGHT;
      receipt += data.shopName + CMD.LF;
      receipt += CMD.NORMAL;

      // Address
      if (data.address) {
        receipt += data.address + CMD.LF;
      }

      receipt += divider() + CMD.LF;

      // Order info (left aligned)
      receipt += CMD.ALIGN_LEFT;
      receipt += `Order #${data.orderNumber}` + CMD.LF;
      receipt += `Date: ${data.date}` + CMD.LF;
      receipt += `Cashier: ${data.cashierName}` + CMD.LF;
      receipt += divider() + CMD.LF;

      // Items
      for (const item of data.items) {
        const itemLabel = `${item.quantity}x ${item.name}`;
        const itemPrice = formatPrice(item.subtotal);
        receipt += padLine(itemLabel, itemPrice) + CMD.LF;

        for (const mod of item.modifiers) {
          if (mod.priceAdj > 0) {
            const modLabel = `  + ${mod.name}`;
            const modPrice = formatPrice(mod.priceAdj);
            receipt += padLine(modLabel, modPrice) + CMD.LF;
          } else {
            receipt += `  + ${mod.name}` + CMD.LF;
          }
        }
      }

      receipt += divider() + CMD.LF;

      // Totals
      receipt += padLine("Subtotal", formatPrice(data.subtotal)) + CMD.LF;
      receipt +=
        padLine(
          `${data.taxLabel} (${(data.taxRate * 100).toFixed(0)}%)`,
          formatPrice(data.taxAmount)
        ) + CMD.LF;

      receipt += CMD.BOLD_ON;
      receipt += padLine("TOTAL", formatPrice(data.total)) + CMD.LF;
      receipt += CMD.BOLD_OFF;

      receipt += `Payment: ${data.paymentType}` + CMD.LF;
      receipt += divider() + CMD.LF;

      // Footer
      receipt += CMD.ALIGN_CENTER;
      receipt += "Thank you!" + CMD.LF;
      receipt += "Powered by bevi&go" + CMD.LF;
      receipt += CMD.LF + CMD.LF + CMD.LF;

      // Cut paper
      receipt += CMD.CUT;

      await this.write(receipt);

      // Open cash drawer if requested (typically for cash payments)
      if (openDrawer) {
        await this.openCashDrawer();
      }
    } catch (err) {
      console.error("Failed to print receipt:", err);
      // If write fails, the connection is likely lost
      this.connected = false;
      throw err;
    }
  }

  async openCashDrawer(): Promise<void> {
    if (!this.connected || !this.writer) {
      throw new Error("Printer not connected");
    }
    try {
      await this.write(CMD.OPEN_DRAWER);
    } catch (err) {
      console.error("Failed to open cash drawer:", err);
      this.connected = false;
      throw err;
    }
  }

  async printTest(): Promise<void> {
    const testData: ReceiptData = {
      shopName: "bevi&go",
      address: "Test Print",
      orderNumber: "TEST-001",
      date: new Date().toLocaleString(),
      cashierName: "System",
      items: [
        {
          name: "Test Item",
          quantity: 1,
          subtotal: 10000,
          modifiers: [{ name: "Test Mod", priceAdj: 2500 }],
        },
      ],
      subtotal: 12500,
      taxLabel: "VAT",
      taxRate: 0.12,
      taxAmount: 1500,
      total: 14000,
      paymentType: "Cash",
    };
    await this.printReceipt(testData);
  }
}

// Singleton
export const receiptPrinter = new ReceiptPrinter();
