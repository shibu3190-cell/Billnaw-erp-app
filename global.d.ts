// global.d.ts
// Ambient declarations for this project's plain-<script>-tag module pattern
// (no bundler, no ES modules — every file attaches its public surface to
// `window` and every other file relies on it being there) plus a couple of
// browser APIs this app uses that aren't in TypeScript's default lib.dom.d.ts.
//
// This file is type-only: it is never loaded at runtime and changes nothing
// about how the app behaves. It exists so `tsc --checkJs` can see across
// file boundaries the same way the browser does at runtime.

export {};

declare global {
  interface Window {
    // dom.js
    $id: (id: string) => any;

    // database.js
    LocalDB: any;

    // gstConfig.js
    GST_STATE_CODES: any;
    GstConfig: any;
    TaxEngine: any;

    // supabaseClient.js
    supabase: any; // the @supabase/supabase-js CDN global
    SB: any;

    // printerEngine.js
    PrinterEngine: any;

    // alertEngine.js
    getAlertThresholds: (...args: any[]) => any;
    parseBatchExpiry: (...args: any[]) => any;
    daysUntil: (...args: any[]) => any;
    getLowStockItems: (...args: any[]) => any;
    getExpiryAlerts: (...args: any[]) => any;
    normaliseComposition: (...args: any[]) => any;
    compositionTokens: (...args: any[]) => any;
    findAlternatives: (...args: any[]) => any;

    // exportEngine.js
    escXml: (...args: any[]) => any;
    exportToExcel: (...args: any[]) => any;
    downloadCSV: (...args: any[]) => any;
    exportCurrentViewToExcel: (...args: any[]) => any;

    // app.js — the ~130 handlers app.js attaches to window so inline
    // onclick="..." HTML attributes in index.html can reach them. Declared
    // as a catch-all index signature rather than one entry per handler:
    // that list changes often and isn't the point of this exercise.
    [key: string]: any;
  }

  interface Navigator {
    // Web Bluetooth — supported in Chromium-based browsers, not in
    // TypeScript's default DOM lib. Minimal shape; extend if printerEngine.js
    // starts using more of the API surface.
    bluetooth?: {
      requestDevice(options?: any): Promise<any>;
      getAvailability?(): Promise<boolean>;
    };
  }

  // Chromium-only Shape Detection API (barcode scanning via the camera).
  // Not in TypeScript's default DOM lib; app.js feature-detects it at
  // runtime before use, this just lets the reference type-check.
  class BarcodeDetector {
    constructor(options?: { formats?: string[] });
    static getSupportedFormats(): Promise<string[]>;
    detect(source: any): Promise<any[]>;
  }

  // vendor/qrcode.js (third-party, vendored, deliberately left out of the
  // checkJs include list) attaches this global. Declared here rather than
  // adding the vendor file to `include`, since we don't want checkJs
  // opinions on code we didn't write and don't maintain.
  function qrcode(typeNumber: number, errorCorrectionLevel: string): any;
}
