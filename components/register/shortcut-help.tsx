"use client";

import { useState } from "react";

const shortcuts: Array<{ key: string; description: string }> = [
  { key: "F1", description: "Focus search / filter" },
  { key: "F2", description: "Complete order (payment)" },
  { key: "F8", description: "Void current order" },
  { key: "Esc", description: "Cancel / close modal" },
  { key: "1-9", description: "Select category by index" },
  { key: "+", description: "Increase last item qty" },
  { key: "-", description: "Decrease / remove last item" },
];

export function ShortcutHelp() {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-4 right-4 z-40">
      {open && (
        <div className="absolute bottom-12 right-0 w-64 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl shadow-lg p-4 mb-2">
          <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100 mb-3">Keyboard Shortcuts</h3>
          <ul className="space-y-2">
            {shortcuts.map((s: { key: string; description: string }) => (
              <li key={s.key} className="flex items-center justify-between text-sm">
                <kbd className="px-2 py-0.5 bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 text-xs font-mono rounded border border-stone-200 dark:border-stone-700">
                  {s.key}
                </kbd>
                <span className="text-stone-600 dark:text-stone-400 text-xs">{s.description}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <button
        onClick={() => setOpen((prev: boolean) => !prev)}
        className="w-10 h-10 rounded-full bg-stone-900 text-white flex items-center justify-center shadow-lg hover:bg-stone-800 transition-colors text-sm font-bold"
        title="Keyboard shortcuts"
      >
        ?
      </button>
    </div>
  );
}
