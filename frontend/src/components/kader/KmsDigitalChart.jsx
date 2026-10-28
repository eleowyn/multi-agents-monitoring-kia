import React, { useState, useMemo } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ReferenceArea,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle2,
  AlertTriangle,
  Info,
  Layers,
} from "lucide-react";

/**
 * KmsDigitalChart: Grafik Pertumbuhan Pita Warna Standar KMS Kemenkes RI
 * Mendukung 3 zona pita warna:
 * - Hijau (Normal / Gizi Baik): Z-Score >= -2 SD
 * - Kuning (Garis Waspada / Gizi Kurang / Pendek): -3 SD s.d. -2 SD
 * - Merah (Bawah Garis Merah / BGM / Stunting Berat): < -3 SD
 */
const KmsDigitalChart = ({
  patient,
  visits = [],
  loading = false,
}) => {
  const isChild = patient?.patient_type === "CHILD";

  // Tab pilihan metrik
  const [metricTab, setMetricTab] = useState(isChild ? "z_pbu" : "lila");

  // Format tanggal singkat
  const formatDate = (iso) => {
    if (!iso) return "-";
    const d = new Date(iso);
    return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "2-digit" });
  };

  // Persiapan data grafik berdasarkan metrik yang aktif
  const chartData = useMemo(() => {
    if (!visits || visits.length === 0) return [];

    return visits.map((v, idx) => {
      const ageLabel = v.age_in_months !== null && v.age_in_months !== undefined ? `${v.age_in_months} Bln` : formatDate(v.visit_date);
      const prevVisit = idx > 0 ? visits[idx - 1] : null;

      // Hitung delta berat badan
      let weightDiff = null;
      let kmsCode = v.weight_trend_kms || null;
      if (v.child_weight_kg && prevVisit?.child_weight_kg) {
        weightDiff = +(v.child_weight_kg - prevVisit.child_weight_kg).toFixed(2);
        if (!kmsCode) {
          kmsCode = weightDiff > 0.2 ? "N" : "T";
        }
      }

      return {
        date: formatDate(v.visit_date),
        label: ageLabel,
        raw_date: v.visit_date,
        age_in_months: v.age_in_months,
        // Balita
        weight: v.child_weight_kg ?? (v.birth_weight_gram ? +(v.birth_weight_gram / 1000).toFixed(2) : null),
        length: v.child_length_cm ?? v.birth_length_cm ?? null,
        z_pbu: v.z_score_pbu !== null && v.z_score_pbu !== undefined ? +Number(v.z_score_pbu).toFixed(2) : null,
        z_bbu: v.z_score_bbu !== null && v.z_score_bbu !== undefined ? +Number(v.z_score_bbu).toFixed(2) : null,
        z_bbpb: v.z_score_bbpb !== null && v.z_score_bbpb !== undefined ? +Number(v.z_score_bbpb).toFixed(2) : null,
        kms_code: kmsCode,
        weight_diff: weightDiff,
        // Ibu Hamil
        lila: v.lila_cm ?? null,
        hb: v.hb_level ?? null,
        maternal_weight: v.maternal_weight_kg ?? null,
        trimester: v.trimester ?? null,
      };
    });
  }, [visits]);

  // Konfigurasi visual berdasarkan metrik
  const metricConfig = useMemo(() => {
    if (metricTab === "z_pbu") {
      return {
        key: "z_pbu",
        title: "Kurva Z-Score Panjang Badan / Umur (PB/U — Deteksi Stunting)",
        unit: "SD",
        yDomain: [-4, 3],
        zones: [
          { y1: -2, y2: 3, fill: "#22c55e", opacity: 0.14, label: "Pita Hijau: Normal (Bebas Stunting)" },
          { y1: -3, y2: -2, fill: "#eab308", opacity: 0.18, label: "Pita Kuning: Waspada / Pendek (Stunting Ringan/Sedang)" },
          { y1: -4, y2: -3, fill: "#ef4444", opacity: 0.22, label: "Pita Merah BGM: Sangat Pendek (Stunting Berat)" },
        ],
        thresholds: [
          { y: -2.0, color: "#eab308", label: "Batas Stunting (-2 SD)" },
          { y: -3.0, color: "#ef4444", label: "Batas Stunting Berat (-3 SD)" },
        ],
      };
    }
    if (metricTab === "weight") {
      return {
        key: "weight",
        title: "Kurva Penimbangan Berat Badan Balita (KMS Bulanan)",
        unit: "kg",
        yDomain: ["auto", "auto"],
        zones: [],
        thresholds: [],
      };
    }
    if (metricTab === "length") {
      return {
        key: "length",
        title: "Kurva Pertumbuhan Panjang / Tinggi Badan Balita (cm)",
        unit: "cm",
        yDomain: ["auto", "auto"],
        zones: [],
        thresholds: [],
      };
    }
    if (metricTab === "lila") {
      return {
        key: "lila",
        title: "Kurva Lingkar Lengan Atas (LiLA Ibu Hamil — Deteksi KEK)",
        unit: "cm",
        yDomain: [18, 32],
        zones: [
          { y1: 23.5, y2: 32, fill: "#22c55e", opacity: 0.14, label: "Zona Normal (Bebas KEK)" },
          { y1: 18, y2: 23.5, fill: "#ef4444", opacity: 0.20, label: "Zona Merah KEK (< 23,5 cm)" },
        ],
        thresholds: [{ y: 23.5, color: "#ef4444", label: "Batas Ambang KEK (23,5 cm)" }],
      };
    }
    if (metricTab === "hb") {
      return {
        key: "hb",
        title: "Kurva Kadar Hemoglobin (Hb Ibu Hamil — Deteksi Anemia)",
        unit: "g/dL",
        yDomain: [7, 16],
        zones: [
          { y1: 11.0, y2: 16, fill: "#22c55e", opacity: 0.14, label: "Zona Normal (Bebas Anemia)" },
          { y1: 7, y2: 11.0, fill: "#f97316", opacity: 0.20, label: "Zona Anemia (< 11,0 g/dL)" },
        ],
        thresholds: [{ y: 11.0, color: "#ea580c", label: "Batas Ambang Anemia (11,0 g/dL)" }],
      };
    }
    return {
      key: "maternal_weight",
      title: "Kurva Kenaikan Berat Badan Ibu Hamil (kg)",
      unit: "kg",
      yDomain: ["auto", "auto"],
      zones: [],
      thresholds: [],
    };
  }, [metricTab]);

  const activePoints = chartData.filter((d) => d[metricConfig.key] !== null && d[metricConfig.key] !== undefined);
  const firstVal = activePoints[0]?.[metricConfig.key];
  const lastVal = activePoints[activePoints.length - 1]?.[metricConfig.key];
  const totalDelta = activePoints.length > 1 && lastVal !== undefined && firstVal !== undefined ? +(lastVal - firstVal).toFixed(2) : 0;

  return (
    <div className="bg-card rounded-2xl border border-line shadow-card p-5 sm:p-6 space-y-5">
      {/* ─── Header & Pilihan Metrik ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-line-light">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40">
              <Layers className="w-4 h-4" />
            </span>
            <h3 className="text-sm sm:text-base font-bold text-heading">
              Grafik Pertumbuhan Pita Warna KMS Digital
            </h3>
          </div>
          <p className="text-xs text-caption">
            Standar Kurva Pertumbuhan WHO Anthro & Pedoman Buku KIA Kemenkes RI
          </p>
        </div>

        {/* Tab Pilihan Metrik */}
        <div className="inline-flex rounded-xl border border-line p-1 bg-subtle self-start sm:self-auto flex-wrap gap-1" role="tablist">
          {isChild ? (
            <>
              <button
                role="tab"
                aria-selected={metricTab === "z_pbu"}
                onClick={() => setMetricTab("z_pbu")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  metricTab === "z_pbu" ? "bg-sky-600 text-white shadow-xs" : "text-caption hover:text-heading"
                }`}
              >
                Pita Z-Score PB/U (Stunting)
              </button>
              <button
                role="tab"
                aria-selected={metricTab === "weight"}
                onClick={() => setMetricTab("weight")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  metricTab === "weight" ? "bg-sky-600 text-white shadow-xs" : "text-caption hover:text-heading"
                }`}
              >
                KMS Berat Badan (N/T)
              </button>
              <button
                role="tab"
                aria-selected={metricTab === "length"}
                onClick={() => setMetricTab("length")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  metricTab === "length" ? "bg-sky-600 text-white shadow-xs" : "text-caption hover:text-heading"
                }`}
              >
                Panjang Badan (cm)
              </button>
            </>
          ) : (
            <>
              <button
                role="tab"
                aria-selected={metricTab === "lila"}
                onClick={() => setMetricTab("lila")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  metricTab === "lila" ? "bg-pink-600 text-white shadow-xs" : "text-caption hover:text-heading"
                }`}
              >
                LiLA Ibu (Batas KEK)
              </button>
              <button
                role="tab"
                aria-selected={metricTab === "hb"}
                onClick={() => setMetricTab("hb")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  metricTab === "hb" ? "bg-pink-600 text-white shadow-xs" : "text-caption hover:text-heading"
                }`}
              >
                Hemoglobin (Anemia)
              </button>
              <button
                role="tab"
                aria-selected={metricTab === "maternal_weight"}
                onClick={() => setMetricTab("maternal_weight")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  metricTab === "maternal_weight" ? "bg-pink-600 text-white shadow-xs" : "text-caption hover:text-heading"
                }`}
              >
                Kenaikan BB Ibu (kg)
              </button>
            </>
          )}
        </div>
      </div>

      {/* ─── Baris Ringkasan Nilai Terakhir & Legenda Pita KMS ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs bg-subtle p-3 rounded-xl border border-line">
        <div className="flex items-center gap-3">
          <span className="text-caption">Nilai Terakhir:</span>
          <span className="text-base font-bold text-heading tabular-nums">
            {lastVal !== undefined ? `${lastVal} ${metricConfig.unit}` : "-"}
          </span>
          {activePoints.length > 1 && (
            <span
              className={`inline-flex items-center gap-0.5 font-bold tabular-nums ${
                totalDelta > 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : totalDelta < 0
                  ? "text-rose-600 dark:text-rose-400"
                  : "text-dim"
              }`}
            >
              {totalDelta > 0 ? (
                <>
                  <TrendingUp className="w-3.5 h-3.5" />
                  +{totalDelta} {metricConfig.unit}
                </>
              ) : totalDelta < 0 ? (
                <>
                  <TrendingDown className="w-3.5 h-3.5" />
                  {totalDelta} {metricConfig.unit}
                </>
              ) : (
                <>
                  <Minus className="w-3.5 h-3.5" />
                  Tetap
                </>
              )}
            </span>
          )}
        </div>

        {/* Legenda Pita Warna Resmi */}
        {metricConfig.zones.length > 0 && (
          <div className="flex items-center gap-3 text-xs flex-wrap">
            <span className="text-caption font-semibold">Legenda Pita:</span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-emerald-500/30 border border-emerald-500 inline-block" />
              Hijau (Normal)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-yellow-400/40 border border-yellow-500 inline-block" />
              Kuning (Waspada)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-red-500/40 border border-red-500 inline-block" />
              Merah (BGM / Risiko)
            </span>
          </div>
        )}
      </div>

      {/* ─── Area Render Grafik Recharts ─── */}
      <div className="h-72 w-full text-caption">
        {loading ? (
          <div className="h-full w-full bg-muted/40 rounded-xl animate-pulse" />
        ) : activePoints.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-xs text-caption text-center px-4 space-y-1">
            <Info className="w-6 h-6 text-caption opacity-50" />
            <p>Belum ada data riwayat pengukuran untuk metrik {metricConfig.title}.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 12, right: 20, left: -10, bottom: 0 }}>
              <CartesianGrid stroke="currentColor" strokeOpacity={0.12} vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: "currentColor", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                domain={metricConfig.yDomain}
                tick={{ fill: "currentColor", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                unit={metricConfig.unit === "SD" ? " SD" : ""}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const data = payload[0].payload;
                  const val = data[metricConfig.key];
                  return (
                    <div className="bg-card border border-line rounded-xl shadow-elevated p-3 text-xs space-y-1.5">
                      <p className="font-bold text-heading border-b border-line pb-1">
                        Kunjungan: {data.label} ({data.date})
                      </p>
                      <p className="text-body flex items-center justify-between gap-4">
                        <span className="text-caption">Hasil Ukur:</span>
                        <strong className="text-sky-600 dark:text-sky-400 tabular-nums">
                          {val} {metricConfig.unit}
                        </strong>
                      </p>
                      {data.kms_code && (
                        <p className="text-body flex items-center justify-between gap-4">
                          <span className="text-caption">Status KMS:</span>
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${data.kms_code === "N" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
                            {data.kms_code === "N" ? "Naik (N)" : "Tidak Naik (T)"}
                          </span>
                        </p>
                      )}
                      {data.weight_diff !== null && (
                        <p className="text-body flex items-center justify-between gap-4">
                          <span className="text-caption">Kenaikan BB:</span>
                          <span className={`font-semibold tabular-nums ${data.weight_diff > 0 ? "text-emerald-600" : "text-rose-600"}`}>
                            {data.weight_diff > 0 ? `+${data.weight_diff}` : data.weight_diff} kg
                          </span>
                        </p>
                      )}
                    </div>
                  );
                }}
              />

              {/* Render Pita Warna KMS Standar Kemenkes RI */}
              {metricConfig.zones.map((z, zIdx) => (
                <ReferenceArea
                  key={`zone-${zIdx}`}
                  y1={z.y1}
                  y2={z.y2}
                  fill={z.fill}
                  fillOpacity={z.opacity}
                  stroke={z.fill}
                  strokeOpacity={0.4}
                />
              ))}

              {/* Garis Batas Ambang Rujukan (ReferenceLine) */}
              {metricConfig.thresholds.map((t, tIdx) => (
                <ReferenceLine
                  key={`thresh-${tIdx}`}
                  y={t.y}
                  stroke={t.color}
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  label={{
                    value: t.label,
                    fill: t.color,
                    fontSize: 10,
                    position: "insideTopRight",
                  }}
                />
              ))}

              {/* Garis Kurva Pertumbuhan Pasien */}
              <Line
                type="monotone"
                dataKey={metricConfig.key}
                name={metricConfig.title}
                stroke="#0284c7"
                strokeWidth={2.5}
                dot={{ r: 4, strokeWidth: 2, fill: "#ffffff", stroke: "#0284c7" }}
                activeDot={{ r: 6, fill: "#0284c7" }}
                animationDuration={600}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ─── Tabel Kohort Riwayat Penimbangan Bulanan ─── */}
      <div className="pt-2">
        <h4 className="text-xs font-bold text-heading uppercase tracking-wide mb-2 flex items-center gap-1.5">
          <span>Rekapitulasi Kohort Penimbangan Posyandu</span>
        </h4>
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-xs text-left">
            <thead className="bg-subtle text-caption border-b border-line text-xs">
              <tr>
                <th className="p-2.5">Tanggal</th>
                <th className="p-2.5">{isChild ? "Usia" : "Trimester"}</th>
                <th className="p-2.5">Berat</th>
                <th className="p-2.5">{isChild ? "Panjang" : "LiLA"}</th>
                {isChild && <th className="p-2.5">Z-Score PB/U</th>}
                <th className="p-2.5 text-center">Status KMS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-light">
              {chartData.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-muted/30 transition-colors">
                  <td className="p-2.5 font-medium text-heading">{row.date}</td>
                  <td className="p-2.5 text-body">{isChild ? `${row.age_in_months ?? "-"} Bulan` : `Trimester ${row.trimester ?? "-"}`}</td>
                  <td className="p-2.5 text-body font-semibold">{row.weight ? `${row.weight} kg` : "-"}</td>
                  <td className="p-2.5 text-body">{isChild ? (row.length ? `${row.length} cm` : "-") : (row.lila ? `${row.lila} cm` : "-")}</td>
                  {isChild && (
                    <td className="p-2.5 font-semibold">
                      {row.z_pbu !== null ? (
                        <span className={row.z_pbu < -2.0 ? "text-rose-600 font-bold" : "text-emerald-600"}>
                          {row.z_pbu} SD {row.z_pbu < -2.0 ? "(Stunting)" : "(Normal)"}
                        </span>
                      ) : "-"}
                    </td>
                  )}
                  <td className="p-2.5 text-center">
                    {row.kms_code ? (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${row.kms_code === "N" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300" : "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"}`}>
                        {row.kms_code === "N" ? "N (Naik)" : "T (Tidak Naik)"}
                      </span>
                    ) : (
                      <span className="text-caption text-xs">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default KmsDigitalChart;

