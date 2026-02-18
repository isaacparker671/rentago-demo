"use client";

import { useEffect, useMemo, useState } from "react";

type Mode = "owner" | "renter";

type Props = {
  open: boolean;
  onClose: () => void;

  // Selected dates currently on the page (YYYY-MM-DD)
  initialDates?: string[];

  // Availability days for renter view (owner-chosen). If empty/undefined => available anytime.
  availabilityDays?: string[] | null;
  bookedDays?: string[];
  lockedDays?: string[];
  selectedDays?: string[];

  mode: Mode;
  title?: string;
  subtitle?: string;
  primaryLabel?: string;

  // ✅ Support BOTH names so we don't break pages:
  onConfirm?: (days: string[]) => void;
  onSave?: (days: string[]) => void;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}
function toYMD(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function addMonths(d: Date, months: number) {
  return new Date(d.getFullYear(), d.getMonth() + months, 1);
}
function daysInMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}
function dayOfWeek0Sun(d: Date) {
  return d.getDay(); // 0=Sun ... 6=Sat
}

export default function AvailabilityEditor({
  open,
  onClose,
  initialDates,
  availabilityDays,
  mode,
  title,
  subtitle,
  onConfirm,
  onSave,
}: Props) {
  const [month, setMonth] = useState<Date>(() => startOfMonth(new Date()));
  const [local, setLocal] = useState<string[]>(() => (initialDates ? [...initialDates] : []));

  // Only sync when opening (prevents update-depth loops)
  useEffect(() => {
    if (!open) return;
    setLocal(initialDates ? [...initialDates] : []);
  }, [open]); // intentionally NOT depending on initialDates

  const availabilityAnytime = !availabilityDays || availabilityDays.length === 0;
  const availabilitySet = useMemo(() => new Set((availabilityDays ?? []).filter(Boolean)), [availabilityDays]);

  const localSet = useMemo(() => new Set(local), [local]);

  const grid = useMemo(() => {
    const mStart = startOfMonth(month);
    const dim = daysInMonth(mStart);
    const firstDow = dayOfWeek0Sun(mStart);
    const cells: Array<{ ymd: string | null; date?: Date }> = [];

    for (let i = 0; i < firstDow; i++) cells.push({ ymd: null });

    for (let day = 1; day <= dim; day++) {
      const d = new Date(mStart.getFullYear(), mStart.getMonth(), day);
      cells.push({ ymd: toYMD(d), date: d });
    }
    while (cells.length % 7 !== 0) cells.push({ ymd: null });

    return cells;
  }, [month]);

  function toggle(ymd: string) {
    setLocal((prev) => {
      const s = new Set(prev);
      if (s.has(ymd)) s.delete(ymd);
      else s.add(ymd);
      return Array.from(s).sort();
    });
  }

  function confirm() {
    const cb =
      typeof onConfirm === "function"
        ? onConfirm
        : typeof onSave === "function"
        ? onSave
        : null;

    if (cb) cb(Array.from(new Set(local)).sort());
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999]">
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* modal */}
      <div className="absolute left-1/2 top-1/2 w-[min(520px,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-extrabold text-slate-900">
              {mode === "owner" ? "Set available dates" : "Pick rental dates"}
            </div>
            {subtitle ? (
              <div className="mt-1 text-xs font-semibold text-slate-600">{subtitle}</div>
            ) : null}
            <div className="mt-1 text-xs font-semibold text-slate-600">
              {title ? <span className="font-extrabold text-slate-900">{title}</span> : null}
              {title ? " — " : null}
              {mode === "owner"
                ? "Tap days you want available. Leave blank = available anytime."
                : availabilityAnytime
                ? "Owner set no limits (available anytime). Pick any days you want."
                : "Owner set specific available days (green). Pick only green days."}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-extrabold text-slate-700 hover:bg-slate-100"
          >
            Close
          </button>
        </div>

        {/* month nav */}
        <div className="mt-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setMonth((m) => startOfMonth(addMonths(m, -1)))}
            className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-extrabold text-slate-700 hover:bg-slate-100"
          >
            ←
          </button>

          <div className="text-sm font-extrabold text-slate-900">
            {month.toLocaleString(undefined, { month: "long", year: "numeric" })}
          </div>

          <button
            type="button"
            onClick={() => setMonth((m) => startOfMonth(addMonths(m, 1)))}
            className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-extrabold text-slate-700 hover:bg-slate-100"
          >
            →
          </button>
        </div>

        {/* weekdays */}
        <div className="mt-4 grid grid-cols-7 gap-2 text-center text-xs font-extrabold text-slate-500">
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
            <div key={`${d}-${i}`}>{d}</div>
          ))}
        </div>

        {/* day grid */}
        <div className="mt-2 grid grid-cols-7 gap-2">
          {grid.map((cell, idx) => {
            if (!cell.ymd) return <div key={`empty-${idx}`} className="h-10" />;

            const ymd = cell.ymd;
            const isSelected = localSet.has(ymd);

            // availability logic for renter mode
            const isAvailable =
              mode === "owner"
                ? true
                : availabilityAnytime
                ? true
                : availabilitySet.has(ymd);

            const disabled = mode === "renter" && !isAvailable;

            const base =
              "h-10 rounded-2xl text-xs font-extrabold transition flex items-center justify-center";
            const cls = disabled
              ? "bg-rose-50 text-rose-500 border border-rose-200 cursor-not-allowed"
              : isSelected
              ? "bg-emerald-600 text-white shadow-sm"
              : isAvailable
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
              : "bg-rose-50 text-rose-500 border border-rose-200";

            return (
              <button
                key={ymd}
                type="button"
                disabled={disabled}
                onClick={() => toggle(ymd)}
                className={`${base} ${cls}`}
                aria-label={ymd}
              >
                {Number(ymd.slice(-2))}
              </button>
            );
          })}
        </div>

        {/* summary */}
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-700">
          {local.length ? (
            <>
              Selected ({local.length}): <span className="font-extrabold">{local.join(", ")}</span>
            </>
          ) : (
            <>No dates selected — {mode === "owner" ? "available anytime" : "you can request any days."}</>
          )}
        </div>

        {/* confirm */}
        <div className="mt-4">
          <button
            type="button"
            onClick={confirm}
            className="w-full rounded-2xl bg-slate-900 px-5 py-3 text-xs font-extrabold text-white hover:bg-slate-800"
          >
            Confirm dates
          </button>
        </div>
      </div>
    </div>
  );
}
