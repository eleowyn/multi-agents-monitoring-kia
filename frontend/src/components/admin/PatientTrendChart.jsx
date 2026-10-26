import React, { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import api from "../../services/api";

// Metrik per jenis pasien. Untuk semua metrik ini, nilai naik = membaik.
const METRICS = {
  CHILD: [
    {
      key: "weight",
      label: "Berat Badan",
      unit: "kg",
      pick: (p) => p.child_weight_kg ?? (p.birth_weight_gram ? p.birth_weight_gram / 1000 : null),
    },
    {
      key: "length",
      label: "Panjang Badan",
      unit: "cm",
      pick: (p) => p.child_length_cm ?? p.birth_length_cm ?? null,
    },
  ],
  MOTHER: [
    { key: "lila", label: "LiLA", unit: "cm", pick: (p) => p.lila_cm, threshold: 23.5, thresholdLabel: "Batas KEK 23,5" },
    { key: "hb", label: "Hemoglobin", unit: "g/dL", pick: (p) => p.hb_level, threshold: 11, thresholdLabel: "Batas Anemia 11" },
  ],
};

const formatDate = (iso) =>
  new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "2-digit" });

const PatientTrendChart = () => {
  const [patients, setPatients] = useState([]);
  const [patientId, setPatientId] = useState("");
  const [trend, setTrend] = useState(null);
  const [metricKey, setMetricKey] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api
      .get("/patients/", { params: { limit: 200 } })
      .then((res) => {
        setPatients(res.data || []);
        if (res.data?.length) setPatientId(String(res.data[0].id));
      })
      .catch((e) => console.error(e));
  }, []);

  useEffect(() => {
    if (!patientId) return;
    setLoading(true);
    api
      .get(`/admin/patient-trend/${patientId}`)
      .then((res) => {
        setTrend(res.data);
        setMetricKey(null); // reset ke metrik pertama sesuai jenis pasien
      })
      .catch((e) => {
        console.error(e);
        setTrend(null);
      })
      .finally(() => setLoading(false));
  }, [patientId]);

  const metrics = METRICS[trend?.patient_type] || METRICS.CHILD;
  const metric = metrics.find((m) => m.key === metricKey) || metrics[0];

  const chartData = useMemo(
    () =>
      (trend?.points || [])
        .map((p) => ({ label: formatDate(p.visit_date), value: metric.pick(p) }))
        .filter((d) => d.value != null),
    [trend, metric]
  );

  const first = chartData[0]?.value;
  const last = chartData[chartData.length - 1]?.value;
  const diff = chartData.length > 1 ? +(last - first).toFixed(1) : 0;
  const DeltaIcon = diff > 0 ? TrendingUp : diff < 0 ? TrendingDown : Minus;
  const deltaTone =
    diff > 0 ? "text-emerald-600 dark:text-emerald-400" : diff < 0 ? "text-rose-600 dark:text-rose-400" : "text-dim";

  return (
    <section className="card-interactive bg-card rounded-2xl border border-line shadow-card p-4 sm:p-5 flex flex-col">
      <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-3">
        <div>
          <h2 className="text-sm font-bold text-heading">Tren Per Pasien</h2>
          <p className="text-[11px] text-caption">Perkembangan hasil ukur per kunjungan</p>
        </div>
        <label htmlFor="patient-trend-select" className="sr-only">Pilih pasien</label>
        <select
          id="patient-trend-select"
          value={patientId}
          onChange={(e) => setPatientId(e.target.value)}
          className="text-xs bg-card border border-line rounded-lg px-2.5 py-1.5 text-body max-w-[220px] focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 cursor-pointer"
        >
          {patients.length === 0 && <option value="">Belum ada pasien</option>}
          {patients.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.patient_type === "MOTHER" ? "Ibu" : "Anak"})
            </option>
          ))}
        </select>
      </header>

      {/* Pilihan metrik + ringkasan perubahan */}
      <div className="flex flex-wrap items-center gap-3 text-[11px] pb-3 mb-2 border-b border-line-light">
        <div className="inline-flex rounded-lg border border-line p-0.5" role="tablist" aria-label="Pilih metrik">
          {metrics.map((m) => (
            <button
              key={m.key}
              role="tab"
              aria-selected={metric.key === m.key}
              onClick={() => setMetricKey(m.key)}
              className={`px-2.5 py-1 rounded-md font-semibold transition-colors duration-150 cursor-pointer ${
                metric.key === m.key ? "bg-sky-600 text-white" : "text-caption hover:text-heading"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        {chartData.length > 0 && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-caption">Terakhir</span>
            <span className="font-bold text-heading tabular-nums">
              {last} {metric.unit}
            </span>
            {chartData.length > 1 && (
              <span className={`inline-flex items-center gap-0.5 font-semibold tabular-nums ${deltaTone}`}>
                <DeltaIcon className="w-3 h-3" aria-hidden="true" />
                {diff > 0 ? `+${diff}` : diff}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="h-64 text-caption">
        {loading ? (
          <div className="h-full w-full bg-muted/50 rounded-xl animate-pulse" />
        ) : chartData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs text-caption text-center px-4">
            Belum ada data {metric.label.toLowerCase()} untuk pasien ini.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
              <CartesianGrid stroke="currentColor" strokeOpacity={0.12} vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "currentColor", fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis
                domain={["auto", "auto"]}
                tick={{ fill: "currentColor", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                formatter={(v) => [`${v} ${metric.unit}`, metric.label]}
                contentStyle={{ fontSize: 11, borderRadius: 8 }}
                cursor={{ stroke: "currentColor", strokeOpacity: 0.2 }}
              />
              {metric.threshold && (
                <ReferenceLine
                  y={metric.threshold}
                  stroke="#e11d48"
                  strokeDasharray="4 4"
                  strokeOpacity={0.6}
                  label={{ value: metric.thresholdLabel, fill: "#e11d48", fontSize: 10, position: "insideTopRight" }}
                />
              )}
              <Line
                type="monotone"
                dataKey="value"
                name={metric.label}
                stroke="#0284c7"
                strokeWidth={2}
                dot={{ r: 3, strokeWidth: 0, fill: "#0284c7" }}
                activeDot={{ r: 5 }}
                animationDuration={500}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
};

export default PatientTrendChart;
