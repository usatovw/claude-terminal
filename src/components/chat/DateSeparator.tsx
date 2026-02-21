"use client";

const MONTHS_RU = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

function formatDateLabel(date: Date): string {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  if (isSameDay(date, now)) return "Сегодня";
  if (isSameDay(date, yesterday)) return "Вчера";

  const day = date.getDate();
  const month = MONTHS_RU[date.getMonth()];

  if (date.getFullYear() === now.getFullYear()) {
    return `${day} ${month}`;
  }
  return `${day} ${month} ${date.getFullYear()}`;
}

interface DateSeparatorProps {
  date: string; // ISO datetime string
}

export default function DateSeparator({ date }: DateSeparatorProps) {
  const d = new Date(date + "Z"); // Treat as UTC, display as local
  const label = formatDateLabel(d);

  return (
    <div className="flex items-center gap-3 my-3">
      <div className="flex-1 h-px bg-border" />
      <span className="text-[10px] text-muted uppercase tracking-wider font-medium">
        {label}
      </span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

/**
 * Check if two message timestamps are on different days (to decide whether to show separator).
 */
export function shouldShowDateSeparator(
  prevDate: string | null,
  currDate: string
): boolean {
  if (!prevDate) return true;
  const prev = new Date(prevDate + "Z");
  const curr = new Date(currDate + "Z");
  return !isSameDay(prev, curr);
}
