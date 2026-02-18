"use client";

import { useMemo, useState } from "react";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December"
];

function iso(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfMonth(year: number, month: number) {
  return new Date(year, month, 1);
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

export default function RentalDatePicker({
  open,
  onClose,
  onConfirm,
  availableDates,
  bookedDates,
  initialSelected = [],
  title = "Select rental dates",
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (dates: string[]) => void;
  availableDates: string[]; // YYYY-MM-DD
  bookedDates: string[];    // YYYY-MM-DD (finalized)
  initialSelected?: string[];
  title?: string;
}) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selected, setSelected] = useState<string[]>(initialSelected);

  const availableSet = useMemo(() => new Set(availableDates), [availableDates]);
  const bookedSet = useMemo(() => new Set(bookedDates), [bookedDates]);

  const monthGrid = useMemo(() => {
    const first = startOfMonth(year, month);
    const firstDow = first.getDay();
    const dim = daysInMonth(year, month);

    const cells: Array<{ kind: "blank" } | { kind: "day"; date: Date; iso: string }> = [];
    for (let i = 0; i < firstDow; i++) cells.push({ kind: "blank" });

    for (let day = 1; day <= dim; day++) {
      const d = new Date(year, month, day);
      cells.push({ kind: "day", date: d, iso: iso(d) });
    }

    // pad to full weeks
    while (cells.length % 7 !== 0) cells.push({ kind: "blank" });

    return cells;
  }, [year, month]);

  function prevMonth() {
    const d = new Date(year, month, 1);
    d.setMonth(d.getMonth() - 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  }

  function nextMonth() {
    const d = new Date(year, month, 1);
    d.setMonth(d.getMonth() + 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  }

  function toggleDay(dayIso: string) {
    // only selectable if available AND not booked
    if (!availableSet.has(dayIso)) return;
    if (bookedSet.has(dayIso)) return;

    setSelected((prev) =>
      prev.includes(dayIso) ? prev.filter((x) => x !== dayIso) : [...prev, dayIso].sort()
    );
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100]">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute left-1/2 top-1/2 w-[min(720px,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-lg font-extrabold text-slate-900">{title}</div>
            <div className="mt-1 text-sm font-semibold text-slate-600">
              Green = available • Red = booked • Gray = unavailable
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold text-slate-900 hover:bg-slate-50"
          >
            Close
          </button>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <button
            onClick={prevMonth}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold text-slate-900 hover:bg-slate-50"
          >
            ←
          </button>

          <div className="text-sm font-extrabold text-slate-900">
            {MONTHS[month]} {year}
          </div>

          <button
            onClick={nextMonth}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold text-slate-900 hover:bg-slate-50"
          >
            →
          </button>
        </div>

        <div className="mt-4 grid grid-cols-7 gap-2">
          {DAYS.map((d) => (
            <div key={d} className="text-center text-xs font-extrabold text-slate-500">
              {d}
            </div>
          ))}

          {monthGrid.map((c, i) => {
            if (c.kind === "blank") return <div key={i} />;

            const dayIso = c.iso;
            const isAvail = availableSet.has(dayIso);
            const isBooked = bookedSet.has(dayIso);
            const isSelected = selected.includes(dayIso);

            const base =
              "h-10 rounded-xl text-xs font-extrabold transition active:scale-[0.99]";

            let cls = "bg-slate-100 text-slate-400";
            if (isBooked) cls = "bg-rose-600/90 text-white";
            else if (isAvail) cls = "bg-emerald-600/90 text-white";
            if (isSelected && !isBooked) cls = "bg-slate-900 text-white";

            return (
              <button
                key={dayIso}
                type="button"
                onClick={() => toggleDay(dayIso)}
                className={`${base} ${cls}`}
                title={dayIso}
              >
                {c.date.getDate()}
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm font-semibold text-slate-700">
            Selected:{" "}
            <span className="font-extrabold text-slate-900">
              {selected.length ? selected.join(", ") : "none"}
            </span>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setSelected([])}
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-extrabold text-slate-900 hover:bg-slate-50"
            >
              Clear
            </button>
            <button
              onClick={() => onConfirm(selected)}
              className="rounded-xl bg-slate-900 px-4 py-3 text-xs font-extrabold text-white hover:bg-slate-800"
            >
              Confirm dates
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
