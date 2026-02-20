"use client";

import { useCallback, useRef } from "react";
import { CheckSquare, Square, MinusSquare, ChevronUp, ChevronDown } from "@/components/Icons";
import { SortField, SortDirection } from "./FileToolbar";

interface FileTableHeaderProps {
  sortBy: SortField;
  sortDir: SortDirection;
  onSortChange: (field: SortField) => void;
  allSelected: boolean;
  someSelected: boolean;
  onSelectAll: () => void;
  columnWidths: string;
  onColumnResize: (widths: string) => void;
}

// Min widths in pixels for resizable columns
const MIN_WIDTHS = { name: 100, size: 60, date: 80 };

export default function FileTableHeader({
  sortBy,
  sortDir,
  onSortChange,
  allSelected,
  someSelected,
  onSelectAll,
  columnWidths,
  onColumnResize,
}: FileTableHeaderProps) {
  const headerRef = useRef<HTMLDivElement>(null);

  const handleResize = useCallback(
    (handleIndex: number, startX: number) => {
      // Parse current widths
      const parts = columnWidths.split(/\s+/);
      // parts: [32px, 28px, <name>, <size>, <date>, 80px]
      // Resizable pairs: handleIndex 0 = between col 2(name) and col 3(size)
      //                   handleIndex 1 = between col 3(size) and col 4(date)
      //                   handleIndex 2 = between col 4(date) and col 5(actions)
      const leftIdx = handleIndex + 2; // index in parts array
      const rightIdx = handleIndex + 3;

      if (!headerRef.current) return;
      const headerEl = headerRef.current;

      // Get actual rendered widths of grid cells
      const cells = headerEl.children;
      const leftCell = cells[leftIdx] as HTMLElement;
      const rightCell = cells[rightIdx] as HTMLElement;
      if (!leftCell || !rightCell) return;

      const startLeftW = leftCell.getBoundingClientRect().width;
      const startRightW = rightCell.getBoundingClientRect().width;

      const minLefts = [MIN_WIDTHS.name, MIN_WIDTHS.size, MIN_WIDTHS.date];
      const minRights = [MIN_WIDTHS.size, MIN_WIDTHS.date, 80];
      const minLeft = minLefts[handleIndex] || 60;
      const minRight = minRights[handleIndex] || 60;

      const onMouseMove = (e: MouseEvent) => {
        const delta = e.clientX - startX;
        const newLeft = Math.max(minLeft, startLeftW + delta);
        const newRight = Math.max(minRight, startRightW - delta);

        const newParts = [...parts];
        newParts[leftIdx] = `${Math.round(newLeft)}px`;
        newParts[rightIdx] = `${Math.round(newRight)}px`;
        onColumnResize(newParts.join(" "));
      };

      const onMouseUp = () => {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [columnWidths, onColumnResize]
  );

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortBy !== field) return null;
    return sortDir === "asc" ? (
      <ChevronUp className="w-3 h-3" />
    ) : (
      <ChevronDown className="w-3 h-3" />
    );
  };

  const CheckboxIcon = allSelected
    ? CheckSquare
    : someSelected
    ? MinusSquare
    : Square;

  return (
    <div
      ref={headerRef}
      className="grid items-center border-b border-zinc-800/50 px-3 py-1.5 select-none"
      style={{ gridTemplateColumns: columnWidths }}
    >
      {/* Checkbox */}
      <div className="flex items-center justify-center">
        <button
          onClick={onSelectAll}
          className="text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
        >
          <CheckboxIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Icon placeholder */}
      <div />

      {/* Name */}
      <div className="relative flex items-center">
        <button
          onClick={() => onSortChange("name")}
          className={`flex items-center gap-1 text-xs uppercase tracking-wider transition-colors cursor-pointer ${
            sortBy === "name" ? "text-zinc-300" : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          <span>Имя</span>
          <SortIcon field="name" />
        </button>
        {/* Resize handle */}
        <div
          className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-violet-500/30 transition-colors"
          onMouseDown={(e) => {
            e.preventDefault();
            handleResize(0, e.clientX);
          }}
        />
      </div>

      {/* Size */}
      <div className="relative flex items-center justify-end">
        <button
          onClick={() => onSortChange("size")}
          className={`flex items-center gap-1 text-xs uppercase tracking-wider transition-colors cursor-pointer ${
            sortBy === "size" ? "text-zinc-300" : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          <span>Размер</span>
          <SortIcon field="size" />
        </button>
        {/* Resize handle */}
        <div
          className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-violet-500/30 transition-colors"
          onMouseDown={(e) => {
            e.preventDefault();
            handleResize(1, e.clientX);
          }}
        />
      </div>

      {/* Date */}
      <div className="relative flex items-center justify-end">
        <button
          onClick={() => onSortChange("modifiedAt")}
          className={`flex items-center gap-1 text-xs uppercase tracking-wider transition-colors cursor-pointer ${
            sortBy === "modifiedAt" ? "text-zinc-300" : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          <span>Дата</span>
          <SortIcon field="modifiedAt" />
        </button>
        {/* Resize handle */}
        <div
          className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-violet-500/30 transition-colors"
          onMouseDown={(e) => {
            e.preventDefault();
            handleResize(2, e.clientX);
          }}
        />
      </div>

      {/* Actions placeholder */}
      <div />
    </div>
  );
}
