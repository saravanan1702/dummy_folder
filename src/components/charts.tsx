"use client";

import clsx from "clsx";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { compactNumber, formatNumber } from "@/lib/format";

/**
 * Chart colours. Validated as a categorical pair on a white surface
 * (colour-blind separation, normal-vision separation and ≥3:1 contrast).
 */
export const SERIES = {
  primary: "#6246ea",
  secondary: "#1f9a67",
} as const;

const GRID = "#eceaf3";
const AXIS_TEXT = "#6b7280";

// ── Helpers ───────────────────────────────────────────────────────────

function niceMax(max: number): { top: number; step: number } {
  if (max <= 4) return { top: 4, step: 1 };
  const rough = max / 4;
  const pow = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= rough) ?? 10 * pow;
  return { top: Math.ceil(max / step) * step, step };
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

const shortDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const longDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

// ── Card with chart / table switch ────────────────────────────────────

export function ChartCard({
  title,
  subtitle,
  legend,
  children,
  table,
  className,
}: {
  title: string;
  subtitle?: ReactNode;
  legend?: ReactNode;
  children: ReactNode;
  /** Accessible table view of the same data. */
  table: { columns: string[]; rows: (string | number)[][] };
  className?: string;
}) {
  const [view, setView] = useState<"chart" | "table">("chart");
  return (
    <section className={clsx("card flex flex-col p-5", className)}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div>
          <h3 className="font-sans text-[15px] font-semibold tracking-normal text-ink">{title}</h3>
          {subtitle && <p className="mt-0.5 text-[13px] text-slate-500">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-4">
          {view === "chart" && legend}
          <div className="flex rounded-lg bg-slate-100 p-0.5 text-xs font-medium" role="group" aria-label="View">
            {(["chart", "table"] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => setView(v)}
                className={clsx("rounded-md px-2 py-1 capitalize transition-colors", view === v ? "bg-white text-ink shadow-xs" : "text-slate-500 hover:text-ink")}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-4 min-h-0 flex-1">
        {view === "chart" ? (
          children
        ) : (
          <div className="scroll-thin max-h-[260px] overflow-auto rounded-lg border border-slate-100">
            <table className="w-full text-left text-[13px]">
              <thead className="sticky top-0 bg-slate-50 text-xs text-slate-500">
                <tr>
                  {table.columns.map((c, i) => (
                    <th key={c} scope="col" className={clsx("px-3 py-2 font-medium", i > 0 && "text-right")}>
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {table.rows.map((row, r) => (
                  <tr key={r}>
                    {row.map((cell, i) => (
                      <td key={i} className={clsx("px-3 py-1.5", i > 0 ? "tabular text-right text-ink" : "text-slate-600")}>
                        {typeof cell === "number" ? formatNumber(cell) : cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

export function Legend({ items }: { items: { name: string; color: string }[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
      {items.map((s) => (
        <li key={s.name} className="flex items-center gap-1.5">
          <span aria-hidden className="h-0.5 w-3.5 rounded-full" style={{ background: s.color }} />
          {s.name}
        </li>
      ))}
    </ul>
  );
}

// ── Time-series line chart ────────────────────────────────────────────

export interface LineSeries {
  name: string;
  color: string;
  values: number[];
}

export function TimeSeriesChart({
  dates,
  series,
  height = 240,
  ariaLabel,
}: {
  /** ISO dates (YYYY-MM-DD), one per point. */
  dates: string[];
  series: LineSeries[];
  height?: number;
  ariaLabel: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);

  const n = dates.length;
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const { top, step } = niceMax(max);
  const single = series.length === 1;

  // Direct end labels only when the line ends are far enough apart to stay attached to their lines.
  const pad = { top: 12, bottom: 26, left: 40, right: single ? 16 : 76 };
  const plotW = Math.max(10, width - pad.left - pad.right);
  const plotH = height - pad.top - pad.bottom;
  const x = (i: number) => pad.left + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const y = (v: number) => pad.top + plotH - (v / top) * plotH;

  const ticks = useMemo(() => {
    const out: number[] = [];
    for (let v = 0; v <= top + 1e-9; v += step) out.push(Math.round(v * 100) / 100);
    return out;
  }, [top, step]);

  const xLabels = useMemo(() => {
    const count = Math.min(n, Math.max(2, Math.floor(plotW / 90)));
    const idx = new Set<number>();
    for (let k = 0; k < count; k++) idx.add(Math.round((k / Math.max(1, count - 1)) * (n - 1)));
    return [...idx];
  }, [n, plotW]);

  const ends = series.map((s) => y(s.values[n - 1] ?? 0));
  const showEndLabels = !single && series.length <= 4 && ends.every((e, i) => ends.every((o, j) => i === j || Math.abs(e - o) >= 16));

  function indexFromPointer(clientX: number, rect: DOMRect) {
    const rel = clientX - rect.left - pad.left;
    return Math.min(n - 1, Math.max(0, Math.round((rel / plotW) * (n - 1))));
  }

  const tipLeft = active === null ? 0 : x(active);
  const tipOnLeft = tipLeft > width * 0.6;

  return (
    <div ref={ref} className="relative select-none" style={{ height }}>
      {width > 0 && (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={ariaLabel}
          tabIndex={0}
          className="block rounded-lg outline-offset-4"
          onPointerMove={(e) => setActive(indexFromPointer(e.clientX, e.currentTarget.getBoundingClientRect()))}
          onPointerLeave={() => setActive(null)}
          onFocus={() => setActive((a) => a ?? n - 1)}
          onBlur={() => setActive(null)}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") setActive((a) => Math.max(0, (a ?? n - 1) - 1));
            if (e.key === "ArrowRight") setActive((a) => Math.min(n - 1, (a ?? 0) + 1));
          }}
        >
          {/* Gridlines + y ticks */}
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.left} x2={pad.left + plotW} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} />
              <text x={pad.left - 8} y={y(t)} textAnchor="end" dominantBaseline="middle" fontSize={11} fill={AXIS_TEXT} style={{ fontVariantNumeric: "tabular-nums" }}>
                {top >= 10_000 ? compactNumber(t) : formatNumber(t)}
              </text>
            </g>
          ))}
          {/* X labels */}
          {xLabels.map((i) => (
            <text
              key={i}
              x={x(i)}
              y={height - 6}
              textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}
              fontSize={11}
              fill={AXIS_TEXT}
            >
              {shortDate(dates[i])}
            </text>
          ))}

          {/* Area wash (single series only) */}
          {single && n > 1 && (
            <path
              d={`M${x(0)},${y(0)} ${series[0].values.map((v, i) => `L${x(i)},${y(v)}`).join(" ")} L${x(n - 1)},${y(0)} Z`}
              fill={series[0].color}
              opacity={0.1}
            />
          )}

          {/* Lines */}
          {series.map((s) => (
            <path
              key={s.name}
              d={s.values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(v)}`).join(" ")}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}

          {/* End markers + direct labels */}
          {series.map((s, si) => (
            <g key={s.name}>
              <circle cx={x(n - 1)} cy={ends[si]} r={4} fill={s.color} stroke="#fff" strokeWidth={2} />
              {showEndLabels && (
                <text x={x(n - 1) + 10} y={ends[si]} dominantBaseline="middle" fontSize={11.5} fontWeight={500} fill="#374151">
                  {s.name}
                </text>
              )}
            </g>
          ))}

          {/* Crosshair */}
          {active !== null && (
            <g pointerEvents="none">
              <line x1={x(active)} x2={x(active)} y1={pad.top} y2={pad.top + plotH} stroke="#9ca3af" strokeWidth={1} />
              {series.map((s) => (
                <circle key={s.name} cx={x(active)} cy={y(s.values[active] ?? 0)} r={4.5} fill={s.color} stroke="#fff" strokeWidth={2} />
              ))}
            </g>
          )}
        </svg>
      )}

      {active !== null && width > 0 && (
        <div
          role="status"
          className="pointer-events-none absolute top-2 z-10 min-w-[132px] rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-pop"
          style={tipOnLeft ? { right: width - tipLeft + 12 } : { left: tipLeft + 12 }}
        >
          <div className="text-[11px] text-slate-500">{longDate(dates[active])}</div>
          {series.map((s) => (
            <div key={s.name} className="mt-1 flex items-center gap-2 text-xs">
              <span aria-hidden className="h-0.5 w-3 rounded-full" style={{ background: s.color }} />
              <span className="tabular font-semibold text-ink">{formatNumber(s.values[active] ?? 0)}</span>
              <span className="text-slate-500">{s.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Ranked horizontal bars ────────────────────────────────────────────

export function BarList({
  items,
  color = SERIES.primary,
  unit,
}: {
  items: { key: string; label: ReactNode; name: string; value: number }[];
  color?: string;
  unit: string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.key} title={`${item.name}: ${formatNumber(item.value)} ${unit}`}>
          <div className="mb-1.5 flex items-center justify-between gap-3 text-[13px]">
            <span className="flex min-w-0 items-center gap-2 text-slate-700">{item.label}</span>
            <span className="tabular shrink-0 font-semibold text-ink">{formatNumber(item.value)}</span>
          </div>
          <div className="h-2 rounded-r bg-slate-100">
            {/* Square at the baseline, rounded at the data end. */}
            <div
              className="h-2 rounded-r transition-[width] duration-300"
              style={{ width: `${item.value === 0 ? 0 : Math.max(1.5, (item.value / max) * 100)}%`, background: color }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

// ── Stat tile ─────────────────────────────────────────────────────────

export function StatTile({
  label,
  value,
  delta,
  deltaLabel,
  icon,
}: {
  label: string;
  value: number;
  /** Percent change vs the previous period; null when there is no baseline. */
  delta?: number | null;
  deltaLabel?: string;
  icon?: ReactNode;
}) {
  const up = (delta ?? 0) >= 0;
  return (
    <div className="card p-4.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-medium text-slate-500">{label}</span>
        {icon && <span className="text-slate-400 [&>svg]:size-4.5">{icon}</span>}
      </div>
      <div className="mt-2 text-[28px] font-semibold leading-none text-ink">{value >= 100_000 ? compactNumber(value) : formatNumber(value)}</div>
      <div className="mt-2 flex h-5 items-center gap-1.5 text-xs">
        {delta !== undefined && delta !== null ? (
          <>
            <span className={clsx("inline-flex items-center gap-0.5 font-semibold", up ? "text-mint-700" : "text-rose-600")}>
              {up ? <ArrowUpRight className="size-3.5" aria-hidden /> : <ArrowDownRight className="size-3.5" aria-hidden />}
              {up ? "+" : "−"}
              {Math.abs(delta)}%
            </span>
            <span className="text-slate-500">{deltaLabel}</span>
          </>
        ) : (
          <span className="text-slate-400">{deltaLabel ?? ""}</span>
        )}
      </div>
    </div>
  );
}
