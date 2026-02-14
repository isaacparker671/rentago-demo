"use client";

export function StarsDisplay({ value }: { value: number }) {
  const v = Math.round(value);
  return (
    <div className="flex items-center gap-1" aria-label={`${v} out of 5`}>
      {[1,2,3,4,5].map((i) => (
        <span key={i} className={i <= v ? "text-slate-900" : "text-slate-300"}>★</span>
      ))}
    </div>
  );
}

export function StarsInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      {[1,2,3,4,5].map((i) => (
        <button
          key={i}
          type="button"
          onClick={() => onChange(i)}
          className={`text-xl ${i <= value ? "text-slate-900" : "text-slate-300"}`}
          aria-label={`${i} star`}
        >
          ★
        </button>
      ))}
    </div>
  );
}
