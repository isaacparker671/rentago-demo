export const cx = (...classes: (string | false | null | undefined)[]) =>
  classes.filter(Boolean).join(" ");

export const rCard =
  "rounded-3xl border border-slate-200 bg-white/85 shadow-sm backdrop-blur";

export const rCardPad = "p-5";

export const rH1 = "text-2xl font-extrabold tracking-tight text-slate-900";
export const rH2 = "text-base font-extrabold text-slate-900";
export const rSub = "text-sm text-slate-600";

export const rLabel = "mb-2 text-sm font-semibold text-slate-900";
export const rHelp = "mt-2 text-xs font-semibold text-slate-500";

export const rInput =
  "w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-900 outline-none placeholder:text-slate-400";

export const rInputError = "border-rose-300 bg-rose-50";

export const rBtnPrimary =
  "rounded-2xl bg-slate-900 px-4 py-4 text-sm font-bold text-white shadow-lg shadow-slate-900/20 transition hover:translate-y-[-1px]";

export const rBtnSecondary =
  "rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-bold text-slate-900";

export const rPill =
  "rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700";

export const rPillActive =
  "border-slate-900 bg-slate-900 text-white shadow-lg shadow-slate-900/15";
