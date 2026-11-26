import type ExcelJS from "exceljs";

export const DEFAULT_WATERMARK_COMPANY = "METAPHARSIC LIFESCIENCES";
export const DEFAULT_WATERMARK_PLATFORM = "TREND MR PHARMA OS";
export const DEFAULT_WATERMARK_NOTICE = "CONFIDENTIAL · OFFICIAL RECORD";

export interface WatermarkOptions {
  companyName?: string;
  platform?: string;
  notice?: string;
  documentTitle?: string;
  preserveExistingFooter?: boolean;
}

const FONT_5X7: Record<string, string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01111", "10000", "10000", "10111", "10001", "10001", "01110"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  J: ["00111", "00010", "00010", "00010", "10010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
};

const CRC_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c = (c >>> 8) ^ CRC_TABLE[(c ^ bytes[i]) & 0xff];
  }
  return (c ^ 0xffffffff) >>> 0;
}

function adler32(bytes: Uint8Array): number {
  let a = 1;
  let b = 0;
  for (let i = 0; i < bytes.length; i++) {
    a = (a + bytes[i]) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

function writeU32BE(target: Uint8Array, offset: number, val: number): void {
  target[offset] = (val >>> 24) & 0xff;
  target[offset + 1] = (val >>> 16) & 0xff;
  target[offset + 2] = (val >>> 8) & 0xff;
  target[offset + 3] = val & 0xff;
}

function makePngChunk(type: string, data: Uint8Array): Uint8Array {
  const chunk = new Uint8Array(12 + data.length);
  writeU32BE(chunk, 0, data.length);
  for (let i = 0; i < 4; i++) {
    chunk[4 + i] = type.charCodeAt(i);
  }
  chunk.set(data, 8);
  const checksum = crc32(chunk.subarray(4, 8 + data.length));
  writeU32BE(chunk, 8 + data.length, checksum);
  return chunk;
}

function wrapZlibStored(raw: Uint8Array): Uint8Array {
  const maxBlock = 65535;
  const blockCount = Math.max(1, Math.ceil(raw.length / maxBlock));
  const out = new Uint8Array(2 + raw.length + blockCount * 5 + 4);
  let pos = 0;
  out[pos++] = 0x78;
  out[pos++] = 0x01;
  for (let offset = 0; offset < raw.length; offset += maxBlock) {
    const end = Math.min(raw.length, offset + maxBlock);
    const len = end - offset;
    const isFinal = end >= raw.length ? 1 : 0;
    const nlen = (~len) & 0xffff;
    out[pos++] = isFinal;
    out[pos++] = len & 0xff;
    out[pos++] = (len >>> 8) & 0xff;
    out[pos++] = nlen & 0xff;
    out[pos++] = (nlen >>> 8) & 0xff;
    out.set(raw.subarray(offset, end), pos);
    pos += len;
  }
  writeU32BE(out, pos, adler32(raw));
  return out;
}

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

let cachedWatermarkDataUrl: string | null = null;

/**
 * Generates a transparent 240x140 PNG watermark tile with diagonal
 * "METAPHARSIC" / "TREND MR - CONFIDENTIAL" markings without browser canvas or Node native APIs.
 */
export function getWatermarkPngDataUrl(): string {
  if (cachedWatermarkDataUrl) return cachedWatermarkDataUrl;

  const width = 240;
  const height = 140;
  const pixels = new Uint8Array(width * height); // 0=transparent, 1=slate text, 2=indigo title, 3=border dot

  const angleRad = (-25 * Math.PI) / 180;
  const cosA = Math.cos(angleRad);
  const sinA = Math.sin(angleRad);

  const paintPixel = (px: number, py: number, colorIdx: number) => {
    const x = ((Math.round(px) % width) + width) % width;
    const y = ((Math.round(py) % height) + height) % height;
    pixels[y * width + x] = colorIdx;
  };

  const drawRotatedText = (text: string, originX: number, originY: number, scale: number, colorIdx: number) => {
    const upper = text.toUpperCase();
    for (let i = 0; i < upper.length; i++) {
      const glyph = FONT_5X7[upper[i]] ?? FONT_5X7[" "];
      const charX = i * 6 * scale;
      for (let row = 0; row < 7; row++) {
        for (let col = 0; col < 5; col++) {
          if (glyph[row][col] !== "1") continue;
          for (let sy = 0; sy < scale; sy++) {
            for (let sx = 0; sx < scale; sx++) {
              const lx = charX + col * scale + sx;
              const ly = row * scale + sy;
              const rx = originX + lx * cosA - ly * sinA;
              const ry = originY + lx * sinA + ly * cosA;
              paintPixel(rx, ry, colorIdx);
            }
          }
        }
      }
    }
  };

  drawRotatedText("METAPHARSIC", 36, 76, 2, 2);
  drawRotatedText("TREND MR - CONFIDENTIAL", 52, 98, 1, 1);

  // Pack into 2-bit indexed PNG scanlines (4 pixels/byte)
  const stride = 1 + Math.ceil(width / 4);
  const rawScanlines = new Uint8Array(height * stride);
  for (let y = 0; y < height; y++) {
    const rowStart = y * stride;
    rawScanlines[rowStart] = 0; // Filter type 0 (None)
    for (let x = 0; x < width; x++) {
      const idx = pixels[y * width + x] & 0x03;
      const bytePos = rowStart + 1 + (x >> 2);
      const shift = 6 - (x & 3) * 2;
      rawScanlines[bytePos] |= idx << shift;
    }
  }

  const ihdr = new Uint8Array(13);
  writeU32BE(ihdr, 0, width);
  writeU32BE(ihdr, 4, height);
  ihdr[8] = 2; // Bit depth 2
  ihdr[9] = 3; // Indexed-color
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  // Palette: 0=White (transparent), 1=Slate-600, 2=Indigo-900, 3=Slate-400
  const plte = new Uint8Array([
    255, 255, 255,
    71, 85, 105,
    49, 46, 129,
    148, 163, 184,
  ]);
  const trns = new Uint8Array([0, 28, 36, 18]);

  const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const chunks = [
    sig,
    makePngChunk("IHDR", ihdr),
    makePngChunk("PLTE", plte),
    makePngChunk("tRNS", trns),
    makePngChunk("IDAT", wrapZlibStored(rawScanlines)),
    makePngChunk("IEND", new Uint8Array(0)),
  ];

  const totalLen = chunks.reduce((s, c) => s + c.length, 0);
  const pngBytes = new Uint8Array(totalLen);
  let cursor = 0;
  for (const c of chunks) {
    pngBytes.set(c, cursor);
    cursor += c.length;
  }

  cachedWatermarkDataUrl = `data:image/png;base64,${bytesToBase64(pngBytes)}`;
  return cachedWatermarkDataUrl;
}

const workbookImageCache = new WeakMap<ExcelJS.Workbook, number>();

/**
 * Applies a tiled diagonal background watermark + print header/footer watermark
 * across every worksheet in an ExcelJS Workbook.
 */
export function applyWorkbookWatermark(wb: ExcelJS.Workbook, options: WatermarkOptions = {}): void {
  const companyName = options.companyName || DEFAULT_WATERMARK_COMPANY;
  const platform = options.platform || DEFAULT_WATERMARK_PLATFORM;
  const notice = options.notice || DEFAULT_WATERMARK_NOTICE;

  wb.company = companyName;
  if (!wb.creator) {
    wb.creator = `${companyName} — ${platform}`;
  }
  wb.subject = options.documentTitle
    ? `${options.documentTitle} | Watermarked by ${companyName}`
    : `Watermarked Official Export by ${companyName}`;

  let imgId = workbookImageCache.get(wb);
  if (imgId === undefined && typeof wb.addImage === "function") {
    imgId = wb.addImage({
      base64: getWatermarkPngDataUrl(),
      extension: "png",
    });
    workbookImageCache.set(wb, imgId);
  }

  for (const ws of wb.worksheets) {
    if (imgId !== undefined && typeof ws.addBackgroundImage === "function") {
      ws.addBackgroundImage(imgId);
    }

    const existingHf = ws.headerFooter || {};
    const headerStamp = `&C&8&K94A3B8${companyName} — ${platform} · ${notice}`;
    const footerStamp = `&L&8&K64748BWatermark: ${companyName} (${notice})&R&8&K64748BPage &P of &N`;

    ws.headerFooter = {
      ...existingHf,
      oddHeader: existingHf.oddHeader || headerStamp,
      oddFooter:
        options.preserveExistingFooter && existingHf.oddFooter
          ? existingHf.oddFooter
          : existingHf.oddFooter || footerStamp,
    };
  }
}

export function buildSvgWatermarkDataUri(options: WatermarkOptions = {}): string {
  const company = (options.companyName || DEFAULT_WATERMARK_COMPANY).replace(/[&<>'"]/g, "");
  const platform = (options.platform || DEFAULT_WATERMARK_PLATFORM).replace(/[&<>'"]/g, "");
  const notice = (options.notice || DEFAULT_WATERMARK_NOTICE).replace(/[&<>'"]/g, "");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="220" viewBox="0 0 360 220"><g transform="rotate(-24 180 110)"><text x="180" y="96" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="800" fill="#1e293b" letter-spacing="2">${company}</text><text x="180" y="116" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="10" font-weight="700" fill="#475569" letter-spacing="1.5">${platform} · ${notice}</text></g></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * Injects a fixed repeating diagonal SVG watermark layer and exact print color adjustment
 * into standalone HTML documents and Print-to-PDF windows.
 */
export function injectHtmlWatermark(html: string, options: WatermarkOptions = {}): string {
  if (html.includes("tmr-watermark-layer")) return html;
  const company = (options.companyName || DEFAULT_WATERMARK_COMPANY).replace(/"/g, "&quot;");
  const svgUri = buildSvgWatermarkDataUri(options);
  const styleTag = `<style>
  @media print { * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } }
  .tmr-watermark-layer {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 9999;
    opacity: 0.085;
    background-image: url("${svgUri}");
    background-repeat: repeat;
    background-size: 360px 220px;
  }
</style>`;
  const overlayDiv = `<div class="tmr-watermark-layer" aria-hidden="true" data-watermark="true" data-watermark-company="${company}"></div>`;

  let out = html.includes("</head>") ? html.replace("</head>", `${styleTag}\n</head>`) : `${styleTag}\n${html}`;
  if (/<body[^>]*>/i.test(out)) {
    out = out.replace(/<body([^>]*)>/i, `<body$1>\n  ${overlayDiv}`);
  } else {
    out = `${overlayDiv}\n${out}`;
  }
  return out;
}

/**
 * Appends a structured watermark footer stamp to CSV downloads without disturbing Row 1 headers.
 */
export function appendCsvWatermark(csv: string, options: WatermarkOptions = {}): string {
  const company = options.companyName || DEFAULT_WATERMARK_COMPANY;
  const platform = options.platform || DEFAULT_WATERMARK_PLATFORM;
  const notice = options.notice || DEFAULT_WATERMARK_NOTICE;
  const titlePart = options.documentTitle ? ` | ${options.documentTitle}` : "";
  const safeVal = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const stamp = `${safeVal("WATERMARK")},${safeVal(`${company} — ${platform} | ${notice}${titlePart} | Exported ${new Date().toISOString()}`)}`;
  return `${csv}\r\n${stamp}`;
}

export function buildWatermarkMetadata(options: WatermarkOptions = {}) {
  return {
    company: options.companyName || DEFAULT_WATERMARK_COMPANY,
    platform: options.platform || DEFAULT_WATERMARK_PLATFORM,
    notice: options.notice || DEFAULT_WATERMARK_NOTICE,
    ...(options.documentTitle ? { documentTitle: options.documentTitle } : {}),
    exportedAt: new Date().toISOString(),
  };
}
