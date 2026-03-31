"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";

type SearchResult = {
  type: "menu_item" | "ingredient" | "staff";
  id: string;
  name: string;
  subtitle: string;
  href: string;
};

const TYPE_ICONS: Record<string, string> = {
  menu_item:
    "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253",
  ingredient:
    "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4",
  staff:
    "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z",
};

const TYPE_LABELS: Record<string, string> = {
  menu_item: "Menu Items",
  ingredient: "Ingredients",
  staff: "Staff",
};

export function SearchCommand() {
  const { token, session } = useAuth();
  const router = useRouter();
  const [searchInput, setSearchInput] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Only managers and owners can search
  const canSearch =
    session?.role === "manager" || session?.role === "owner";

  const results = useQuery(
    api.search.queries.globalSearch,
    token && debouncedQuery && canSearch
      ? { token, query: debouncedQuery }
      : "skip"
  ) as SearchResult[] | undefined;

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setSearchInput(value);

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        setDebouncedQuery(value);
      }, 300);
    },
    []
  );

  const handleResultClick = useCallback(
    (result: SearchResult) => {
      setIsOpen(false);
      setSearchInput("");
      setDebouncedQuery("");
      router.push(result.href);
    },
    [router]
  );

  // Keyboard shortcut: Cmd+K or /
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.key === "k" && (e.metaKey || e.ctrlKey)) ||
        (e.key === "/" && !["INPUT", "TEXTAREA"].includes(
          (e.target as HTMLElement)?.tagName ?? ""
        ))
      ) {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
      if (e.key === "Escape") {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!canSearch) return null;

  // Group results by type
  const grouped: Record<string, SearchResult[]> = {};
  if (results) {
    for (const result of results) {
      if (!grouped[result.type]) {
        grouped[result.type] = [];
      }
      grouped[result.type].push(result);
    }
  }

  return (
    <div ref={containerRef} className="relative px-3 pb-3">
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={searchInput}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          placeholder="Search... (⌘K)"
          className="w-full pl-9 pr-3 py-2 rounded-xl border border-stone-200 focus:ring-amber-500/20 focus:border-amber-500 text-sm outline-none bg-stone-50 placeholder:text-stone-400"
        />
      </div>

      {isOpen && debouncedQuery && (
        <div className="absolute left-3 right-3 top-full mt-1 bg-white rounded-xl border border-stone-200/60 shadow-lg max-h-80 overflow-y-auto z-50">
          {results === undefined ? (
            <div className="p-3 text-sm text-stone-400 text-center">
              Searching...
            </div>
          ) : results.length === 0 ? (
            <div className="p-3 text-sm text-stone-400 text-center">
              No results found
            </div>
          ) : (
            Object.entries(grouped).map(
              ([type, items]: [string, SearchResult[]]) => (
                <div key={type}>
                  <div className="px-3 py-1.5 text-xs font-medium text-stone-400 uppercase tracking-wider bg-stone-50">
                    {TYPE_LABELS[type] ?? type}
                  </div>
                  {items.map((result: SearchResult) => (
                    <button
                      key={result.id}
                      onClick={() => handleResultClick(result)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-stone-50 transition-colors"
                    >
                      <svg
                        className="w-4 h-4 text-stone-400 shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d={TYPE_ICONS[result.type]}
                        />
                      </svg>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-stone-900 truncate">
                          {result.name}
                        </p>
                        <p className="text-xs text-stone-400 truncate">
                          {result.subtitle}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )
            )
          )}
        </div>
      )}
    </div>
  );
}
