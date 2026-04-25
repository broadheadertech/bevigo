/**
 * NIIMBOT B1 sticker printer driver — Web Bluetooth via @mmote/niimbluelib.
 *
 * Notes:
 * - Web Bluetooth required (Android Chrome / desktop Chrome). NOT iOS Safari.
 * - Niimbot uses a proprietary BLE protocol (no ESC/POS).
 * - Each sticker = one rasterized canvas. We render text + modifiers to a canvas
 *   sized to the user-configured label, then send via the B1 print task.
 *
 * Default label size: 30mm × 15mm at 8 dots/mm = 240 × 120 px.
 * If your stickers are a different size, change LABEL_WIDTH_MM / LABEL_HEIGHT_MM.
 */

"use client";

import type {
  NiimbotAbstractClient,
  EncodedImage,
  PrintTaskName,
  LabelType as LabelTypeEnum,
} from "@mmote/niimbluelib";

const DOTS_PER_MM = 8; // ~203 dpi
const DEFAULT_LABEL_WIDTH_MM = 30;
const DEFAULT_LABEL_HEIGHT_MM = 15;
const DEFAULT_DENSITY = 3; // 1-5; B1 typically uses 2-3
const DEFAULT_TEXT_SCALE = 1.0; // 0.7-2.0; bumps every font in renderSticker

// Lazy-loaded niimbluelib (browser-only — keeps it out of SSR bundles)
let cachedLib: typeof import("@mmote/niimbluelib") | null = null;
async function getLib(): Promise<typeof import("@mmote/niimbluelib")> {
  if (cachedLib) return cachedLib;
  cachedLib = await import("@mmote/niimbluelib");
  return cachedLib;
}

export type NiimbotStickerData = {
  orderNumber: string;
  itemName: string;
  indexLabel: string; // e.g. "1/3"
  modifiers: string[];
  customerOrTable: string;
  /** The linked customer name. Printed as "Ordered by …" if it differs from customerOrTable. */
  orderedBy?: string;
  time: string;
};

export type NiimbotConfig = {
  labelWidthMm?: number;
  labelHeightMm?: number;
  density?: number;
  /** Multiplier applied to every text size in the sticker. 1.0 = default. */
  textScale?: number;
  /** Print task name. B1 → "B1". Other models if you ever switch printers. */
  printTask?: PrintTaskName;
};

class NiimbotPrinter {
  private client: NiimbotAbstractClient | null = null;
  private deviceName: string | null = null;
  /**
   * Serializes BLE work. Web Bluetooth allows only one GATT op per device at
   * a time, so back-to-back calls into printStickers() must queue up here.
   */
  private inFlight: Promise<unknown> = Promise.resolve();

  private async run<T>(fn: () => Promise<T>): Promise<T> {
    const prev = this.inFlight;
    let resolve!: (v: unknown) => void;
    this.inFlight = new Promise((r) => {
      resolve = r;
    });
    try {
      await prev.catch(() => undefined);
      return await fn();
    } finally {
      resolve(undefined);
    }
  }

  isConnected(): boolean {
    return this.client?.isConnected() ?? false;
  }

  getDeviceName(): string | null {
    return this.deviceName;
  }

  async connect(): Promise<{ name: string }> {
    if (typeof navigator === "undefined" || !("bluetooth" in navigator)) {
      throw new Error("Web Bluetooth is not supported in this browser");
    }
    const lib = await getLib();
    this.client = lib.instantiateClient("bluetooth");
    const info = await this.client.connect();
    this.deviceName = info.deviceName ?? "Niimbot B1";
    return { name: this.deviceName };
  }

  async disconnect(): Promise<void> {
    if (this.client?.isConnected()) await this.client.disconnect();
    this.client = null;
    this.deviceName = null;
  }

  /**
   * Render a single sticker to a canvas (browser only).
   * Layout: name-dominant (Starbucks-style). Name biggest at top when present.
   *
   * All font sizes scale with the label height so a 30mm label gets ~2x the
   * text of a 15mm label. textScale (default 1.0) is a final multiplier for
   * the operator to bump everything up/down without re-tuning ratios.
   */
  private renderSticker(
    sticker: NiimbotStickerData,
    widthPx: number,
    heightPx: number,
    textScale: number = DEFAULT_TEXT_SCALE
  ): HTMLCanvasElement {
    const canvas = document.createElement("canvas");
    canvas.width = widthPx;
    canvas.height = heightPx;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not get 2D canvas context");

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, widthPx, heightPx);
    ctx.fillStyle = "#000000";
    ctx.textBaseline = "top";

    const scale = Math.max(0.5, Math.min(3, textScale));
    const padding = Math.max(4, Math.floor(heightPx * 0.04));
    const innerWidth = widthPx - padding * 2;

    // Proportional font sizes (px), all multiplied by textScale at the end.
    const px = (ratio: number, min: number) =>
      Math.max(min, Math.floor(heightPx * ratio)) * scale | 0;

    // Base font sizes (will be uniformly shrunk below if content overflows).
    let itemSize = px(0.30, 26);
    let modSize = px(0.16, 18);
    let footSize = px(0.11, 14);

    const cupName = (sticker.customerOrTable ?? "").trim();
    const orderedBy = (sticker.orderedBy ?? "").trim();
    // Only show "Ordered by …" when the linked-customer is set AND differs
    // from the cup name, to avoid printing the same name twice.
    const showOrderedBy = orderedBy && orderedBy !== cupName;
    const footerText = `${sticker.orderNumber} · ${sticker.indexLabel}`;

    // Two-pass layout: measure required height at base sizes, then shrink
    // every font by a uniform factor so the whole sticker fits the label.
    const measure = (
      iSize: number,
      mSize: number,
      fSize: number
    ): {
      total: number;
      itemL: string[];
      cupL: string[];
      orderedL: string[];
      modL: string[][];
    } => {
      ctx.font = `bold ${iSize}px sans-serif`;
      const itemL = wrapText(ctx, sticker.itemName, innerWidth);
      ctx.font = `bold ${mSize}px sans-serif`;
      const cupL = cupName ? wrapText(ctx, cupName, innerWidth) : [];
      const orderedL = showOrderedBy
        ? wrapText(ctx, `Ordered by ${orderedBy}`, innerWidth)
        : [];
      ctx.font = `${mSize}px sans-serif`;
      const modL: string[][] = sticker.modifiers.map((m) =>
        wrapText(ctx, `+ ${m}`, innerWidth)
      );
      const lineHeight = (size: number) => size + 2;
      const total =
        padding +
        itemL.length * lineHeight(iSize) +
        cupL.length * lineHeight(mSize) +
        orderedL.length * lineHeight(mSize) +
        Math.floor(mSize * 0.15) +
        modL.reduce((sum, lines) => sum + lines.length * lineHeight(mSize), 0) +
        4 + // gap before footer
        fSize +
        padding;
      return { total, itemL, cupL, orderedL, modL };
    };

    let m = measure(itemSize, modSize, footSize);
    if (m.total > heightPx) {
      const shrink = Math.max(0.55, heightPx / m.total);
      itemSize = Math.max(14, Math.floor(itemSize * shrink));
      modSize = Math.max(10, Math.floor(modSize * shrink));
      footSize = Math.max(9, Math.floor(footSize * shrink));
      m = measure(itemSize, modSize, footSize);
    }

    let y = padding;

    // Item name — always the heading
    ctx.font = `bold ${itemSize}px sans-serif`;
    for (const line of m.itemL) {
      ctx.fillText(line, padding, y);
      y += itemSize + 2;
    }

    // Cup name — printed right after the item name when present
    if (m.cupL.length > 0) {
      ctx.font = `bold ${modSize}px sans-serif`;
      for (const line of m.cupL) {
        ctx.fillText(line, padding, y);
        y += modSize + 2;
      }
    }

    // "Ordered by {linkedCustomerName}" — only when distinct from cup name
    if (m.orderedL.length > 0) {
      ctx.font = `bold ${modSize}px sans-serif`;
      for (const line of m.orderedL) {
        ctx.fillText(line, padding, y);
        y += modSize + 2;
      }
    }

    y += Math.floor(modSize * 0.15);

    // Modifiers
    ctx.font = `${modSize}px sans-serif`;
    for (const lines of m.modL) {
      for (const line of lines) {
        ctx.fillText(line, padding, y);
        y += modSize + 2;
      }
    }

    // Bottom row: order # · index (date intentionally omitted)
    ctx.font = `${footSize}px sans-serif`;
    const bottomY = heightPx - padding - footSize;
    ctx.fillText(footerText, padding, bottomY);

    return canvas;
  }

  async printStickers(
    stickers: NiimbotStickerData[],
    config: NiimbotConfig = {}
  ): Promise<void> {
    return this.run(() => this.printStickersInner(stickers, config));
  }

  private async printStickersInner(
    stickers: NiimbotStickerData[],
    config: NiimbotConfig
  ): Promise<void> {
    if (!this.client?.isConnected()) {
      throw new Error("Niimbot printer not connected");
    }
    const lib = await getLib();
    const labelW = (config.labelWidthMm ?? DEFAULT_LABEL_WIDTH_MM) * DOTS_PER_MM;
    const labelH = (config.labelHeightMm ?? DEFAULT_LABEL_HEIGHT_MM) * DOTS_PER_MM;
    const density = config.density ?? DEFAULT_DENSITY;
    const textScale = config.textScale ?? DEFAULT_TEXT_SCALE;
    const taskName: PrintTaskName = (config.printTask ?? "B1") as PrintTaskName;
    const labelType = lib.LabelType.WithGaps as LabelTypeEnum;

    for (let i = 0; i < stickers.length; i++) {
      const sticker = stickers[i];
      const canvas = this.renderSticker(sticker, labelW, labelH, textScale);
      const encoded: EncodedImage = lib.ImageEncoder.encodeCanvas(canvas, "top");

      const task = this.client.abstraction.newPrintTask(taskName, {
        totalPages: 1,
        labelType,
        density,
      });

      try {
        await task.printInit();
        await task.printPage(encoded, 1);
        await task.waitForPageFinished();
        await task.waitForFinished();
      } finally {
        try {
          await task.printEnd();
        } catch {
          // Ignore — some print tasks call printEnd internally
        }
      }

      // Let the BLE stack settle before the next label so we don't trip
      // "GATT operation already in progress" on rapid back-to-back prints.
      if (i < stickers.length - 1) await sleep(400);
    }

    // Final settle so the *next* user-triggered call starts on a clean GATT.
    await sleep(250);
  }

  async printTest(config: NiimbotConfig = {}): Promise<void> {
    await this.printStickers(
      [
        {
          orderNumber: "TEST-001",
          itemName: "Test Sticker",
          indexLabel: "1/1",
          modifiers: ["bevi&go connection check"],
          customerOrTable: "—",
          time: new Date().toLocaleTimeString(),
        },
      ],
      config
    );
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    const test = current ? `${current} ${w}` : w;
    if (ctx.measureText(test).width <= maxWidth) {
      current = test;
    } else {
      if (current) lines.push(current);
      current = w;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [text];
}

export const niimbotPrinter = new NiimbotPrinter();
