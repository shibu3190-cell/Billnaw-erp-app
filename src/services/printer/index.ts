/* ==========================================================================
   BILLNAW — PRINTER HARDWARE ENGINE (typed extraction, partial)

   Ported from printerEngine.js. Only buildEscPosPayload() is extracted
   here — the ESC/POS byte-protocol logic, which is pure given its inputs.
   connectThermalPrinter(), writeChunks(), setStatus(), openCashDrawer(),
   dispatchPrint(), and runPrinterDiagnosticTest() are deliberately NOT
   ported: they drive Web Bluetooth GATT connections and the DOM status
   line, neither of which exists in a Node test environment, so there is
   no way to verify a port of them against the deployed code the way
   tests/printer-parity.js verifies buildEscPosPayload byte-for-byte.
   Per ARCHITECTURE_TARGET.md, the printer service also needs a real
   platform-adapter boundary for Capacitor/Tauri (Phase 9/10) — porting
   the hardware methods now, ahead of that design, would likely need
   redoing anyway. They move here once that adapter design happens.

   One real (behavior-preserving) signature change from the legacy file:
   buildEscPosPayload(inv, width) implicitly read APP_STATE.tenantProfile
   and the global esc() function. This version takes both as explicit
   parameters — the same module-boundary fix applied to the alerts
   extraction, proven identical by tests/printer-parity.js.

   printerEngine.js remains UNCHANGED and is still what index.html loads.
   ========================================================================== */

import { esc as defaultEsc } from '../../core/security/escape';

export interface PrinterTenantProfile {
  shopName?: string;
  address?: string;
  gstin?: string;
  upiId?: string;
  autoCut?: boolean;
  cutType?: string;
  cashDrawer?: boolean;
  drawerPin?: string;
}

export interface InvoiceItem {
  name: string;
  assignedIdentifier?: string;
  qty: number;
  price: number;
  totalAmount: number;
}

export interface InvoiceForPrint {
  invoiceNo: string;
  date: string;
  customer: { name: string; phone: string };
  items: InvoiceItem[];
  total: number;
  tender: string;
}

export function buildEscPosPayload(
  inv: InvoiceForPrint,
  tenantProfile: PrinterTenantProfile,
  width: number = 80,
  escFn: (v: unknown) => string = defaultEsc
): Uint8Array {
  const cols = width === 58 ? 32 : 48;
  const enc = new TextEncoder();
  const bytes: number[] = [];
  const p = tenantProfile;

  const append = (arr: number[]) => bytes.push(...arr);
  const text = (str: string) => append(Array.from(enc.encode(str.replace(/₹/g, 'Rs.'))));

  append([0x1b, 0x40]);
  append([0x1b, 0x61, 0x01]);
  append([0x1b, 0x45, 0x01]);
  text(`${p.shopName}\n`);
  append([0x1b, 0x45, 0x00]);
  text(`${p.address}\n`);
  text(`GSTIN: ${p.gstin || 'Unregistered'}\n`);
  text('-'.repeat(cols) + '\n');

  append([0x1b, 0x61, 0x00]);
  text(`Bill: ${inv.invoiceNo} | Date: ${inv.date}\n`);
  text(`Cust: ${inv.customer.name} (${inv.customer.phone})\n`);
  text('-'.repeat(cols) + '\n');

  inv.items.forEach((it) => {
    text(`${escFn(it.name)}\n`);
    const tag = it.assignedIdentifier ? `[${escFn(it.assignedIdentifier)}]` : '';
    const qp = `${it.qty} x ${it.price.toFixed(2)}`;
    const tot = `Rs.${it.totalAmount.toFixed(2)}`;
    const pad = Math.max(1, cols - qp.length - tot.length);
    text(`${qp}${' '.repeat(pad)}${tot}\n`);
    if (tag) text(`  ${tag}\n`);
  });

  text('-'.repeat(cols) + '\n');
  append([0x1b, 0x45, 0x01]);
  text(`GRAND TOTAL: Rs.${inv.total.toFixed(2)}\n`);
  append([0x1b, 0x45, 0x00]);
  text(`Mode: ${inv.tender.toUpperCase()}\n`);
  text('='.repeat(cols) + '\n');
  append([0x1b, 0x61, 0x01]);
  text('Thank you! Visit Again\n');

  // NOTE ON LOGO: rendering a raster logo on ESC/POS needs the image
  // dithered to 1-bit and emitted as GS v 0 raster data. That is a
  // meaningful chunk of work and many cheap printers reject it, so the
  // thermal receipt prints the shop name in double-strike instead of a
  // logo. The A4 invoice shows the real logo. Flagged rather than faked.

  // UPI payment line — a thermal printer can't render the QR bitmap
  // reliably across models, but the ID itself is scannable/typeable.
  if (p.upiId) {
    text('-'.repeat(cols) + '\n');
    text(`Pay via UPI: ${p.upiId}\n`);
  }
  text('\n\n\n');

  // Paper cut. GS V 66 0 = partial cut (leaves a small tab so the receipt
  // doesn't drop on the floor); GS V 65 0 = full cut. Some cheap printers
  // ignore cut commands entirely and just feed — harmless either way.
  if (p.autoCut !== false) {
    append(p.cutType === 'full' ? [0x1d, 0x56, 0x41, 0x00] : [0x1d, 0x56, 0x42, 0x00]);
  }

  // Cash drawer kick: ESC p m t1 t2. Pin 2 (m=0) is the near-universal
  // default; a few drawers wire to pin 5 (m=1). Only fires for cash sales
  // — popping the till on a UPI or card payment is how tills get skimmed,
  // and it startles the cashier.
  if (p.cashDrawer && inv.tender === 'Cash') {
    append([0x1b, 0x70, p.drawerPin === '5' ? 0x01 : 0x00, 0x19, 0xfa]);
  }

  return new Uint8Array(bytes);
}
