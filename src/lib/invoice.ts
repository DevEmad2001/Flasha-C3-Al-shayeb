import cairoFontUrl from "@/assets/Cairo-Regular.ttf";
import { formatMoney, formatDate } from "./format";

export type InvoiceData = {
  type: "customer" | "expense";
  number: string;
  date: string;
  amount: number;
  paymentMethod: string;
  partyLabel: string;
  partyName: string;
  partyPhone?: string | null;
  projectName?: string | null;
  recipient?: string | null;
  enteredBy?: string | null;
  notes?: string | null;
  totalAmount?: number | null;
  paidToDate?: number | null;
  remaining?: number | null;
};

const INVOICE_THEME = {
  brand: [201, 162, 76] as const,        /* gold */
  brandDark: [20, 33, 77] as const,      /* navy */
  brandMid: [36, 54, 110] as const,      /* mid navy */
  brandSoft: [252, 247, 235] as const,   /* cream */
  ink: [20, 33, 77] as const,
  muted: [100, 116, 139] as const,
  line: [226, 232, 240] as const,
  panel: [248, 250, 252] as const,
  success: [22, 163, 74] as const,
  danger: [220, 38, 38] as const,
};

let cairoFontPromise: Promise<void> | null = null;
let logoImagePromise: Promise<HTMLImageElement | null> | null = null;

function cleanText(value: string | number | null | undefined) {
  const text = String(value ?? "—").trim();
  return text || "—";
}

async function ensureCairoCanvasFont() {
  if (typeof document === "undefined" || typeof FontFace === "undefined") return;
  cairoFontPromise ??= (async () => {
    if (document.fonts.check("14px CairoInvoice")) return;
    const font = new FontFace("CairoInvoice", `url(${cairoFontUrl})`, { weight: "400 800" });
    document.fonts.add(await font.load());
    await document.fonts.ready;
  })();
  await cairoFontPromise;
}

async function ensureLogoImage(): Promise<HTMLImageElement | null> {
  if (typeof Image === "undefined") return null;
  logoImagePromise ??= new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = "/logo.png";
  });
  return logoImagePromise;
}

function drawUnifiedInvoice(ctx: CanvasRenderingContext2D, d: InvoiceData, logo: HTMLImageElement | null) {
  const pageW = 595.28;
  const pageH = 841.89;
  const title = d.type === "customer" ? "سند قبض" : "سند صرف";
  const actorLabel = d.type === "customer" ? "الواصل" : "أدخلها";
  const actorName = d.type === "customer" ? d.recipient : d.enteredBy;
  const paid = Number(d.paidToDate ?? d.amount);
  const remaining = Number(d.remaining ?? 0);

  // Header band — navy with gold accents
  fill(ctx, INVOICE_THEME.brandDark);
  ctx.fillRect(0, 0, pageW, 166);
  fill(ctx, INVOICE_THEME.brand);
  circle(ctx, pageW - 72, 118, 86);
  fill(ctx, INVOICE_THEME.brandMid);
  circle(ctx, 72, 12, 86);

  // Logo badge (white square) on the right of the header
  if (logo) {
    fill(ctx, [255, 255, 255]);
    roundedRect(ctx, pageW - 122, 24, 74, 74, 12, true, false);
    ctx.drawImage(logo, pageW - 118, 28, 66, 66);
  }

  fill(ctx, [255, 255, 255]);
  text(ctx, "شركة الشايب للإسكان", pageW - 138, 62, 22, "bold", "right");
  fill(ctx, [230, 215, 175]);
  text(ctx, "نظام إدارة الإسكانات والعطاءات", pageW - 138, 84, 11, "normal", "right");

  // Title badge — gold on navy
  fill(ctx, INVOICE_THEME.brand);
  stroke(ctx, [240, 215, 140]);
  roundedRect(ctx, 48, 24, 142, 82, 10, true, true);
  fill(ctx, INVOICE_THEME.brandDark);
  text(ctx, title, 166, 52, 11, "bold", "right");
  text(ctx, `#${d.number}`, 166, 80, 20, "bold", "right");
  text(ctx, formatDate(d.date), 166, 98, 10, "normal", "right");

  const panelX = 48;
  const panelY = 132;
  const panelW = pageW - 96;
  const panelH = d.notes ? 560 : 510;
  fill(ctx, [255, 255, 255]);
  stroke(ctx, INVOICE_THEME.line);
  roundedRect(ctx, panelX, panelY, panelW, panelH, 14, true, true);

  const inner = 24;
  const gap = 14;
  const colW = (panelW - inner * 2 - gap) / 2;
  const rightX = panelX + inner + colW + gap;
  const leftX = panelX + inner;
  let y = panelY + 30;
  drawMetaBox(ctx, rightX, y, colW, d.partyLabel, d.partyName, d.partyPhone);
  drawMetaBox(ctx, leftX, y, colW, "الإسكان / المشروع", d.projectName || "—");
  y += 72;
  drawMetaBox(ctx, rightX, y, colW, "طريقة الدفع", d.paymentMethod);
  drawMetaBox(ctx, leftX, y, colW, actorLabel, actorName || "—");

  y += 88;
  fill(ctx, INVOICE_THEME.brandSoft);
  stroke(ctx, [220, 190, 120]);
  roundedRect(ctx, panelX + inner, y, panelW - inner * 2, 72, 10, true, true);
  fill(ctx, INVOICE_THEME.brandDark);
  text(ctx, d.type === "customer" ? "المبلغ المستلم" : "المبلغ المدفوع", panelX + panelW - inner - 18, y + 43, 13, "bold", "right");
  fill(ctx, INVOICE_THEME.ink);
  text(ctx, formatMoney(d.amount), panelX + inner + 18, y + 45, 26, "bold", "left");

  y += 96;
  if (d.totalAmount != null) {
    drawTotalRow(ctx, panelX + inner, y, panelW - inner * 2, "المبلغ الكلي", formatMoney(d.totalAmount), INVOICE_THEME.ink);
    drawTotalRow(ctx, panelX + inner, y + 34, panelW - inner * 2, "المدفوع حتى تاريخه", formatMoney(paid), INVOICE_THEME.success);
    drawTotalRow(ctx, panelX + inner, y + 68, panelW - inner * 2, "المتبقي", formatMoney(remaining), remaining > 0 ? INVOICE_THEME.danger : INVOICE_THEME.muted, true);
    y += 118;
  }

  if (d.notes) {
    drawNotes(ctx, panelX + inner, y, panelW - inner * 2, cleanText(d.notes));
    y += 70;
  }

  drawSignatures(ctx, panelX + inner, Math.max(y + 16, panelY + panelH - 104), panelW - inner * 2);
  fill(ctx, [148, 163, 184]);
  text(ctx, `تم إصدار هذا السند إلكترونياً · ${new Date().toLocaleString("ar-EG")}`, pageW / 2, pageH - 32, 9, "normal", "center");
}

function fill(ctx: CanvasRenderingContext2D, color: readonly [number, number, number]) {
  ctx.fillStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
}

function stroke(ctx: CanvasRenderingContext2D, color: readonly [number, number, number]) {
  ctx.strokeStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
}

function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, doFill: boolean, doStroke = false) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  if (doFill) ctx.fill();
  if (doStroke) ctx.stroke();
}

function text(ctx: CanvasRenderingContext2D, value: string | number | null | undefined, x: number, y: number, size: number, weight: "normal" | "bold", align: CanvasTextAlign = "right") {
  ctx.direction = "rtl";
  ctx.textAlign = align;
  ctx.textBaseline = "alphabetic";
  ctx.font = `${weight === "bold" ? 700 : 400} ${size}px CairoInvoice, Cairo, Tahoma, Arial, sans-serif`;
  ctx.fillText(cleanText(value), x, y);
}

function drawMetaBox(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, label: string, value: string | null | undefined, sub?: string | null) {
  fill(ctx, INVOICE_THEME.panel);
  stroke(ctx, INVOICE_THEME.line);
  roundedRect(ctx, x, y, w, 58, 8, true, true);
  fill(ctx, INVOICE_THEME.muted);
  text(ctx, label, x + w - 12, y + 22, 10, "normal", "right");
  fill(ctx, INVOICE_THEME.ink);
  text(ctx, value, x + w - 12, y + 43, 14, "bold", "right");
  if (sub) {
    fill(ctx, INVOICE_THEME.muted);
    text(ctx, sub, x + 12, y + 43, 9, "normal", "left");
  }
}

function drawTotalRow(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, label: string, value: string, color: readonly [number, number, number], strong = false) {
  stroke(ctx, INVOICE_THEME.line);
  fill(ctx, strong ? [248, 250, 252] : [255, 255, 255]);
  ctx.fillRect(x, y, w, 34);
  ctx.strokeRect(x, y, w, 34);
  fill(ctx, [71, 85, 105]);
  text(ctx, label, x + w - 14, y + 22, 11, "normal", "right");
  fill(ctx, color);
  text(ctx, value, x + 14, y + 22, strong ? 13 : 12, "bold", "left");
}

function wrapText(ctx: CanvasRenderingContext2D, value: string, maxWidth: number, maxLines: number) {
  const words = cleanText(value).split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth || !current) {
      current = next;
    } else {
      lines.push(current);
      current = word;
      if (lines.length === maxLines) break;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);
  return lines;
}

function drawNotes(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, notes: string) {
  fill(ctx, [255, 251, 235]);
  stroke(ctx, [253, 230, 138]);
  roundedRect(ctx, x, y, w, 56, 8, true, true);
  fill(ctx, [120, 53, 15]);
  text(ctx, "ملاحظات", x + w - 14, y + 22, 10, "bold", "right");
  ctx.font = "400 10px CairoInvoice, Cairo, Tahoma, Arial, sans-serif";
  wrapText(ctx, notes, w - 110, 2).forEach((line, index) => text(ctx, line, x + w - 72, y + 22 + index * 16, 10, "normal", "right"));
}

function drawSignatures(ctx: CanvasRenderingContext2D, x: number, y: number, w: number) {
  const sigW = (w - 58) / 2;
  stroke(ctx, [148, 163, 184]);
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(x, y + 40);
  ctx.lineTo(x + sigW, y + 40);
  ctx.moveTo(x + sigW + 58, y + 40);
  ctx.lineTo(x + w, y + 40);
  ctx.stroke();
  ctx.setLineDash([]);
  fill(ctx, INVOICE_THEME.muted);
  text(ctx, "توقيع المسؤول", x + sigW / 2, y + 58, 10, "normal", "center");
  text(ctx, "توقيع المستلم", x + sigW + 58 + sigW / 2, y + 58, 10, "normal", "center");
}

export async function generateInvoice(d: InvoiceData) {
  if (typeof window === "undefined") return;
  await ensureCairoCanvasFont();
  const logo = await ensureLogoImage();
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait", compress: true }) as any;
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const scale = 3;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(pageW * scale);
  canvas.height = Math.round(pageH * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.scale(scale, scale);
  fill(ctx, [255, 255, 255]);
  ctx.fillRect(0, 0, pageW, pageH);
  drawUnifiedInvoice(ctx, d, logo);
  pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, pageW, pageH);
  const fileName = `${d.type === "customer" ? "سند_قبض" : "سند_صرف"}_${d.number}.pdf`;
  pdf.save(fileName);
}

export function shortId(id: string) {
  return id.slice(0, 8).toUpperCase();
}
