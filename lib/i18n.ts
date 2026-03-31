/**
 * Internationalization (i18n) support for bevi&go POS.
 *
 * Supported locales: English, Filipino, Bahasa Indonesia.
 *
 * RTL Support Note:
 * To add RTL language support (e.g., Arabic), you would need to:
 * 1. Add `dir="rtl"` to the <html> element when an RTL locale is active.
 * 2. Replace directional CSS utilities (ml-*, mr-*, pl-*, pr-*) with
 *    logical equivalents (ms-*, me-*, ps-*, pe-*).
 * 3. Use Tailwind's `rtl:` variant for any layout-specific overrides.
 * 4. Add the RTL locale to the Locale type and translations map below.
 */

type Locale = "en" | "fil" | "id";

const translations: Record<Locale, Record<string, string>> = {
  en: {
    "nav.dashboard": "Dashboard",
    "nav.register": "Register",
    "nav.staff": "Staff",
    "nav.menu": "Menu",
    "nav.inventory": "Inventory",
    "nav.reports": "Reports",
    "nav.settings": "Settings",
    "dashboard.greeting.morning": "Good morning",
    "dashboard.greeting.afternoon": "Good afternoon",
    "dashboard.greeting.evening": "Good evening",
    "common.save": "Save",
    "common.cancel": "Cancel",
    "common.delete": "Delete",
    "common.edit": "Edit",
    "common.add": "Add",
    "common.search": "Search",
    "common.loading": "Loading...",
    "common.export_csv": "Export CSV",
    "common.export_pdf": "Export PDF",
    "order.complete": "Complete Order",
    "order.void": "Void Order",
    "order.total": "Total",
    "order.subtotal": "Subtotal",
    "receipt.thank_you": "Thank you!",
    "receipt.powered_by": "Powered by bevi&go",
  },
  fil: {
    "nav.dashboard": "Dashboard",
    "nav.register": "Kahera",
    "nav.staff": "Kawani",
    "nav.menu": "Menu",
    "nav.inventory": "Imbentaryo",
    "nav.reports": "Ulat",
    "nav.settings": "Mga Setting",
    "dashboard.greeting.morning": "Magandang umaga",
    "dashboard.greeting.afternoon": "Magandang hapon",
    "dashboard.greeting.evening": "Magandang gabi",
    "common.save": "I-save",
    "common.cancel": "Kanselahin",
    "common.delete": "Burahin",
    "common.edit": "I-edit",
    "common.add": "Idagdag",
    "common.search": "Maghanap",
    "common.loading": "Naglo-load...",
    "common.export_csv": "I-export CSV",
    "common.export_pdf": "I-export PDF",
    "order.complete": "Kumpletuhin ang Order",
    "order.void": "I-void ang Order",
    "order.total": "Kabuuan",
    "order.subtotal": "Subtotal",
    "receipt.thank_you": "Salamat!",
    "receipt.powered_by": "Pinapagana ng bevi&go",
  },
  id: {
    "nav.dashboard": "Dasbor",
    "nav.register": "Kasir",
    "nav.staff": "Staf",
    "nav.menu": "Menu",
    "nav.inventory": "Inventaris",
    "nav.reports": "Laporan",
    "nav.settings": "Pengaturan",
    "dashboard.greeting.morning": "Selamat pagi",
    "dashboard.greeting.afternoon": "Selamat siang",
    "dashboard.greeting.evening": "Selamat malam",
    "common.save": "Simpan",
    "common.cancel": "Batal",
    "common.delete": "Hapus",
    "common.edit": "Edit",
    "common.add": "Tambah",
    "common.search": "Cari",
    "common.loading": "Memuat...",
    "common.export_csv": "Ekspor CSV",
    "common.export_pdf": "Ekspor PDF",
    "order.complete": "Selesaikan Pesanan",
    "order.void": "Batalkan Pesanan",
    "order.total": "Total",
    "order.subtotal": "Subtotal",
    "receipt.thank_you": "Terima kasih!",
    "receipt.powered_by": "Didukung oleh bevi&go",
  },
};

export function t(key: string, locale: Locale = "en"): string {
  return translations[locale]?.[key] ?? translations.en[key] ?? key;
}

export function getLocales(): { code: Locale; name: string }[] {
  return [
    { code: "en", name: "English" },
    { code: "fil", name: "Filipino" },
    { code: "id", name: "Bahasa Indonesia" },
  ];
}

export type { Locale };
