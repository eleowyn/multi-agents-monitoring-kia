import React from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

// Palet konsisten dengan kartu metrik (rose = stunting, amber = KEK, orange = anemia)
const SERIES = [
  { key: "stunting", label: "Stunting", color: "#e11d48" },
  { key: "kek", label: "KEK", color: "#d97706" },
  { key: "anemia", label: "Anemia", color: "#ea580c" },
];

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-line rounded-lg shadow-elevated px-3 py-2 text-[11px]">
      <p className="font-bold text-heading mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="flex items-center gap-1.5 text-body tabular-nums">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          {p.name}: <strong className="text-heading">{p.value}</strong>
        </p>
      ))}
    </div>
  );
};

// Naik = memburuk (merah), turun = membaik (hijau)
const DeltaBadge = ({ label, color, current, previous }) => {
  const diff = current - previous;
  const Icon = diff > 0 ? TrendingUp : diff < 0 ? TrendingDown : Minus;
  const tone =
    diff > 0
      ? "text-rose-600 dark:text-rose-400"
      : diff < 0
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-dim";
  return (
    <div className="flex items-center gap-2">
      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
      <span className="text-caption">{label}</span>
      <span className="font-bold text-heading tabular-nums">{current}</span>
      <span className={`inline-flex items-center gap-0.5 font-semibold tabular-nums ${tone}`}>
        <Icon className="w-3 h-3" aria-hidden="true" />
        {diff > 0 ? `+${diff}` : diff}
      </span>
    </div>
  );
};

const OverallTrendChart = ({ data = [], loading }) => {
  const last = data[data.length - 1] || { stunting: 0, kek: 0, anemia: 0 };
  const prev = data[data.length - 2] || { stunting: 0, kek: 0, anemia: 0 };
  const isEmpty = data.every((d) => d.stunting + d.kek + d.anemia === 0);

  return (
    <section className="card-interactive bg-card rounded-2xl border border-line shadow-card p-4 sm:p-5 flex flex-col">
      <header className="mb-3">
        <h2 className="text-sm font-bold text-heading">Tren Kasus Risiko Keseluruhan</h2>
        <p className="text-[11px] text-caption">Jumlah pasien berisiko per bulan &bull; 6 bulan terakhir</p>
      </header>

      {/* Ringkasan bulan ini vs bulan lalu */}
      <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-[11px] pb-3 mb-2 border-b border-line-light">
        {SERIES.map((s) => (
          <DeltaBadge
            key={s.key}
            label={s.label}
            color={s.color}
            current={last[s.key]}
            previous={prev[s.key]}
          />
        ))}
        <span className="text-dim ml-auto">vs bulan lalu</span>
      </div>

      <div className="h-64 text-caption">
        {loading ? (
          <div className="h-full w-full bg-muted/50 rounded-xl animate-pulse" />
        ) : isEmpty ? (
          <div className="h-full flex items-center justify-center text-xs text-caption">
            Belum ada kasus risiko dalam 6 bulan terakhir.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid stroke="currentColor" strokeOpacity={0.12} vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: "currentColor", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: "currentColor", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: "currentColor", strokeOpacity: 0.2 }} />
              {SERIES.map((s) => (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.label}
                  stroke={s.color}
                  strokeWidth={2}
                  dot={{ r: 3, strokeWidth: 0, fill: s.color }}
                  activeDot={{ r: 5 }}
                  animationDuration={500}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
};

export default OverallTrendChart;
