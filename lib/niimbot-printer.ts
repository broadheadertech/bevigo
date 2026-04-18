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
  time: string;
};

export type NiimbotConfig = {
  labelWidthMm?: number;
  labelHeightMm?: number;
  density?: number;
  /** Print task name. B1 → "B1". Other models if you ever switch printers. */
  printTask?: PrintTaskName;
};

class NiimbotPrinter {
  private client: NiimbotAbstractClient | null = null;
  private deviceName: string | null = null;

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
   */
  private renderSticker(
    sticker: NiimbotStickerData,
    widthPx: number,
    heightPx: number
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

    const padding = 6;
    const innerWidth = widthPx - padding * 2;
    let y = padding;

    const hasName = sticker.customerOrTable.trim().length > 0;

    if (hasName) {
      // BIG name at the top — uppercase for legibility on small label
      const nameSize = Math.max(28, Math.floor(heightPx * 0.32));
      ctx.font = `900 ${nameSize}px sans-serif`;
      const nameLines = wrapText(ctx, sticker.customerOrTable.toUpperCase(), innerWidth);
      for (const line of nameLines) {
        ctx.fillText(line, padding, y);
        y += nameSize + 2;
      }
      y += 2;

      // Item name — medium
      ctx.font = "600 18px sans-serif";
      const itemLines = wrapText(ctx, sticker.itemName, innerWidth);
      for (const line of itemLines) {
        ctx.fillText(line, padding, y);
        y += 20;
      }
    } else {
      // No name → item name dominant (fallback to original layout)
      ctx.font = "bold 22px sans-serif";
      const nameLines = wrapText(ctx, sticker.itemName, innerWidth);
      for (const line of nameLines) {
        ctx.fillText(line, padding, y);
        y += 24;
      }
    }

    y += 2;

    // Modifiers — small
    ctx.font = "14px sans-serif";
    for (const m of sticker.modifiers) {
      const lines = wrapText(ctx, `+ ${m}`, innerWidth);
      for (const line of lines) {
        ctx.fillText(line, padding, y);
        y += 16;
      }
      if (y > heightPx - 16) break;
    }

    // Bottom row: order # · index (left) | time (right) — small
    ctx.font = "10px sans-serif";
    const bottomY = heightPx - padding - 11;
    const left = `${sticker.orderNumber} · ${sticker.indexLabel}`;
    ctx.fillText(left, padding, bottomY);
    const tw = ctx.measureText(sticker.time).width;
    ctx.fillText(sticker.time, widthPx - padding - tw, bottomY);

    return canvas;
  }

  async printStickers(
    stickers: NiimbotStickerData[],
    config: NiimbotConfig = {}
  ): Promise<void> {
    if (!this.client?.isConnected()) {
      throw new Error("Niimbot printer not connected");
    }
    const lib = await getLib();
    const labelW = (config.labelWidthMm ?? DEFAULT_LABEL_WIDTH_MM) * DOTS_PER_MM;
    const labelH = (config.labelHeightMm ?? DEFAULT_LABEL_HEIGHT_MM) * DOTS_PER_MM;
    const density = config.density ?? DEFAULT_DENSITY;
    const taskName: PrintTaskName = (config.printTask ?? "B1") as PrintTaskName;
    const labelType = lib.LabelType.WithGaps as LabelTypeEnum;

    for (const sticker of stickers) {
      const canvas = this.renderSticker(sticker, labelW, labelH);
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
    }
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
