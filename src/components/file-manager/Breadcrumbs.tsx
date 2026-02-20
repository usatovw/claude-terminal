"use client";

import { ChevronRight } from "@/components/Icons";

interface BreadcrumbsProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export default function Breadcrumbs({ currentPath, onNavigate }: BreadcrumbsProps) {
  const segments = currentPath === "." ? [] : currentPath.split("/").filter(Boolean);

  return (
    <div className="flex items-center gap-1 text-sm overflow-x-auto">
      <button
        onClick={() => onNavigate(".")}
        className={`px-1.5 py-0.5 rounded transition-colors flex-shrink-0 cursor-pointer ${
          segments.length === 0
            ? "text-zinc-200"
            : "text-violet-400 hover:text-violet-300"
        }`}
      >
        ~
      </button>
      {segments.map((seg, i) => {
        const isLast = i === segments.length - 1;
        const segPath = segments.slice(0, i + 1).join("/");

        return (
          <div key={segPath} className="flex items-center gap-1 flex-shrink-0">
            <ChevronRight className="w-3 h-3 text-zinc-600" />
            {isLast ? (
              <span className="px-1.5 py-0.5 text-zinc-200">{seg}</span>
            ) : (
              <button
                onClick={() => onNavigate(segPath)}
                className="px-1.5 py-0.5 rounded text-violet-400 hover:text-violet-300 transition-colors cursor-pointer"
              >
                {seg}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
