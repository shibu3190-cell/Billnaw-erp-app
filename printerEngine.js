/* ==========================================================================
   BILLNAW — PRINTER HARDWARE ENGINE
   Extracted from app.js. Web Bluetooth / ESC-POS transport plus the A4
   dispatch decision. Self-contained: the object owns its own device and
   characteristic handles, and the only globals it reaches for are
   APP_STATE.tenantProfile (printer preferences) and the DOM status line.

   Load order matters (no bundler): this must load BEFORE app.js.
   ========================================================================== */

/* ==========================================================================
   PRINTER HARDWARE ENGINE (BLUETOOTH ESC/POS + THERMAL)
   ========================================================================== */
const PrinterEngine = {
  device: null,
  characteristic: null,
  isBusy: false,

  SERVICES: [
    '000018f0-0000-1000-8000-00805f9b34fb',
    '0000ff00-0000-1000-8000-00805f9b34fb',
    '0000ffe0-0000-1000-8000-00805f9b34fb',
    '49535343-fe7d-4ae5-8fa9-9fafd205e455',
    'e7810a71-73ae-499d-8c15-faa9aef0c3f2'
  ],

  async connectThermalPrinter() {
    if (!navigator.bluetooth) {
      alert("Web Bluetooth is not supported. Use Chrome on Android or Desktop.");
      return false;
    }
    try {
      this.device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: this.SERVICES
      });

      // A printer going out of range, running out of battery, or being
      // switched off mid-shift is normal, everyday behaviour on a shop
      // counter — without this listener, `this.characteristic` stays set
      // to a dead reference and every future sale hangs on a doomed write
      // before falling back to A4 print, making checkout feel slow/broken.
      this.device.addEventListener('gattserverdisconnected', () => {
        this.characteristic = null;
        this.setStatus('⚠️ Printer disconnected. Reconnect from Settings, or sales will fall back to A4/PDF.', true);
      });

      const server = await this.device.gatt.connect();
      const services = await server.getPrimaryServices();

      for (const service of services) {
        const chars = await service.getCharacteristics();
        for (const c of chars) {
          if (c.properties.writeWithoutResponse || c.properties.write) {
            this.characteristic = c;
            break;
          }
        }
        if (this.characteristic) break;
      }

      if (!this.characteristic) {
        this.setStatus('⚠️ Connected, but no writable print service found on this device.', true);
        return false;
      }

      this.setStatus(`✅ Connected: ${this.device.name || 'Thermal Printer'}`, false);
      return true;
    } catch (err) {
      // User cancelling the Bluetooth picker throws too — that's not a
      // real error, just don't scare them with an alert for it.
      if (err.name !== 'NotFoundError') alert("Pairing Error: " + err.message);
      return false;
    }
  },

  setStatus(msg, isWarning) {
    const el = document.getElementById('printerStatusLine');
    if (el) {
      el.innerText = msg;
      el.style.color = isWarning ? 'var(--danger)' : 'var(--success)';
    }
  },

  // Wraps a printer write with a hard timeout — a dead-but-not-yet-noticed
  // GATT link can otherwise hang the browser's operation for many seconds,
  // during which the cashier is stuck staring at a frozen checkout screen.
  async writeChunks(bytes) {
    if (!this.characteristic) throw new Error("Printer not connected.");
    const CHUNK = 120;
    const withTimeout = (promise, ms) => Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Printer write timed out')), ms)),
    ]);

    for (let i = 0; i < bytes.length; i += CHUNK) {
      const slice = bytes.slice(i, i + CHUNK);
      if (this.characteristic.properties.writeWithoutResponse) {
        await withTimeout(this.characteristic.writeValueWithoutResponse(slice), 4000);
      } else {
        await withTimeout(this.characteristic.writeValue(slice), 4000);
      }
      await new Promise(r => setTimeout(r, 20));
    }
  },

  buildEscPosPayload(inv, width = 80) {
    const cols = width === 58 ? 32 : 48;
    const enc = new TextEncoder();
    const bytes = [];
    const p = APP_STATE.tenantProfile;

    const append = arr => bytes.push(...arr);
    const text = str => append(enc.encode(str.replace(/₹/g, 'Rs.')));

    append([0x1B, 0x40]);
    append([0x1B, 0x61, 0x01]);
    append([0x1B, 0x45, 0x01]);
    text(`${p.shopName}\n`);
    append([0x1B, 0x45, 0x00]);
    text(`${p.address}\n`);
    text(`GSTIN: ${p.gstin || 'Unregistered'}\n`);
    text("-".repeat(cols) + "\n");

    append([0x1B, 0x61, 0x00]);
    text(`Bill: ${inv.invoiceNo} | Date: ${inv.date}\n`);
    text(`Cust: ${inv.customer.name} (${inv.customer.phone})\n`);
    text("-".repeat(cols) + "\n");

    inv.items.forEach(it => {
      text(`${esc(it.name)}\n`);
      const tag = it.assignedIdentifier ? `[${esc(it.assignedIdentifier)}]` : '';
      const qp = `${it.qty} x ${it.price.toFixed(2)}`;
      const tot = `Rs.${it.totalAmount.toFixed(2)}`;
      const pad = Math.max(1, cols - qp.length - tot.length);
      text(`${qp}${' '.repeat(pad)}${tot}\n`);
      if (tag) text(`  ${tag}\n`);
    });

    text("-".repeat(cols) + "\n");
    append([0x1B, 0x45, 0x01]);
    text(`GRAND TOTAL: Rs.${inv.total.toFixed(2)}\n`);
    append([0x1B, 0x45, 0x00]);
    text(`Mode: ${inv.tender.toUpperCase()}\n`);
    text("=".repeat(cols) + "\n");
    append([0x1B, 0x61, 0x01]);
    text("Thank you! Visit Again\n");

    // NOTE ON LOGO: rendering a raster logo on ESC/POS needs the image
    // dithered to 1-bit and emitted as GS v 0 raster data. That is a
    // meaningful chunk of work and many cheap printers reject it, so the
    // thermal receipt prints the shop name in double-strike instead of a
    // logo. The A4 invoice shows the real logo. Flagged rather than faked.

    // UPI payment line — a thermal printer can't render the QR bitmap
    // reliably across models, but the ID itself is scannable/typeable.
    if (p.upiId) {
      text("-".repeat(cols) + "\n");
      text(`Pay via UPI: ${p.upiId}\n`);
    }
    text("\n\n\n");

    // Paper cut. GS V 66 0 = partial cut (leaves a small tab so the receipt
    // doesn't drop on the floor); GS V 65 0 = full cut. Some cheap printers
    // ignore cut commands entirely and just feed — harmless either way.
    if (p.autoCut !== false) {
      append(p.cutType === 'full' ? [0x1D, 0x56, 0x41, 0x00] : [0x1D, 0x56, 0x42, 0x00]);
    }

    // Cash drawer kick: ESC p m t1 t2. Pin 2 (m=0) is the near-universal
    // default; a few drawers wire to pin 5 (m=1). Only fires for cash sales
    // — popping the till on a UPI or card payment is how tills get skimmed,
    // and it startles the cashier.
    if (p.cashDrawer && inv.tender === 'Cash') {
      append([0x1B, 0x70, p.drawerPin === '5' ? 0x01 : 0x00, 0x19, 0xFA]);
    }

    return new Uint8Array(bytes);
  },

  // Fired from Settings so a shop can confirm the drawer is wired correctly
  // without having to ring up a real sale to test it.
  async openCashDrawer() {
    if (!this.characteristic) {
      const ok = await this.connectThermalPrinter();
      if (!ok) return;
    }
    const pin = APP_STATE.tenantProfile.drawerPin === '5' ? 0x01 : 0x00;
    try {
      await this.writeChunks(new Uint8Array([0x1B, 0x70, pin, 0x19, 0xFA]));
      this.setStatus('Drawer pulse sent.', false);
    } catch (err) {
      this.setStatus(`Drawer pulse failed: ${err.message}`, true);
    }
  },

  async dispatchPrint(inv) {
    if (APP_STATE.tenantProfile.printerFormat === 'thermal') {
      if (!this.characteristic) {
        const ok = await this.connectThermalPrinter();
        if (!ok) { window.print(); return; }
      }
      try {
        const payload = this.buildEscPosPayload(inv, APP_STATE.tenantProfile.thermalWidth);
        await this.writeChunks(payload);
      } catch (err) {
        this.characteristic = null; // stale/dead — force re-pair next attempt, don't keep retrying a dead link
        this.setStatus(`⚠️ Thermal print failed (${err.message}). Printed via A4 instead.`, true);
        window.print();
      }
    } else {
      window.print();
    }
  },

  async runPrinterDiagnosticTest() {
    const demo = {
      invoiceNo: "TEST-1001",
      date: new Date().toLocaleDateString('en-IN'),
      customer: { name: "Abhijit Roy", phone: "9876543210" },
      tender: "Cash",
      total: 19298.00,
      items: [
        { name: "Motorola G84 5G", qty: 1, price: 18999.00, totalAmount: 18999.00, assignedIdentifier: "864592039481920" }
      ]
    };
    await this.dispatchPrint(demo);
  }
};

window.PrinterEngine = PrinterEngine;
