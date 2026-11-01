import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { RefreshCw, ExternalLink, ShieldAlert, ArrowRight } from "lucide-react";

const SkeletonCard = () => (
  <div className="bg-card p-4 rounded-xl border border-line space-y-2 animate-pulse">
    <div className="h-3 w-24 bg-muted rounded" />
    <div className="h-7 w-16 bg-muted rounded" />
    <div className="h-3 w-32 bg-muted/70 rounded" />
  </div>
);

const KaderDashboard = () => {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [countdown, setCountdown] = useState(30);
  const previousPendingCount = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchDashboardSummary();
  }, []);

  const fetchDashboardSummary = async (isManual = false, isSilent = false) => {
    try {
      if (isManual) {
        setRefreshing(true);
      } else if (!isSilent) {
        setLoading(true);
      }
      setError("");
      const res = await api.get("/kader/dashboard-summary");
      previousPendingCount.current = res.data?.pending_validation ?? null;
      setSummary(res.data);
      const now = new Date();
      setLastUpdated(
        now.toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
        })
      );
    } catch (e) {
      console.error(e);
      if (!isSilent) {
        setError("Gagal memuat ringkasan data posyandu.");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
      setCountdown(30);
    }
  };

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          fetchDashboardSummary(false, true);
          return 30;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  // Statistik 3 Fase 1.000 HPK
  const totalSasaran = summary?.total_patients || 0;
  const mothersCount = summary?.phase_breakdown?.mothers ?? summary?.total_mothers ?? 0;
  const newbornsCount = summary?.phase_breakdown?.newborns ?? 0;
  const toddlersCount =
    summary?.phase_breakdown?.toddlers ??
    (summary?.total_children ? Math.max(0, summary.total_children - newbornsCount) : 0);

  // Tren bulan berjalan & Metrik Stunting (tersinkronisasi akurat dengan data riil)
  const trendPoints = summary?.monthly_trend || [];
  const lastPoint = trendPoints[trendPoints.length - 1] || { visits: 0, stunting: 0, kek: 0, anemia: 0 };
  const stuntingCount = summary?.total_stunting !== undefined ? summary.total_stunting : (lastPoint?.stunting || 0);
  const stuntingRate = toddlersCount > 0 ? ((stuntingCount / toddlersCount) * 100).toFixed(1) : "0.0";

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* ═══ Header Posyandu ═══ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-line">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-heading tracking-tight">
            Dashboard Posyandu
          </h1>
          <p className="text-sm text-caption mt-1">
            Wilayah Kerja {summary?.posyandu_name || "Posyandu"} &bull; {summary?.village_name || "Airmadidi"}
            {lastUpdated && ` • Sinkronisasi: ${lastUpdated} WITA`}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-line bg-card text-caption hover:text-heading transition-colors cursor-pointer"
          >
            {autoRefresh ? `Auto-sync (${countdown}s)` : "Sync Dijeda"}
          </button>

          <button
            type="button"
            onClick={() => fetchDashboardSummary(true)}
            disabled={loading || refreshing}
            className="text-xs font-medium px-3 py-1.5 rounded-lg border border-line bg-card text-heading hover:bg-muted transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            <span>Segarkan</span>
          </button>
        </div>
      </div>

      {/* ═══ Error Alert ═══ */}
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 rounded-lg text-xs text-red-700 dark:text-red-300 flex items-center justify-between">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => fetchDashboardSummary()}
            className="underline font-semibold cursor-pointer"
          >
            Coba Lagi
          </button>
        </div>
      )}

      {/* ═══ 4 Metric Cards (Type-Focused, No Decorative Icons) ═══ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          <>
            {/* Kartu 1: Total Sasaran */}
            <div
              onClick={() => navigate("/kader/data-pasien")}
              className="bg-card p-4 rounded-xl border border-line hover:border-sky-300 dark:hover:border-sky-800 transition-colors cursor-pointer"
            >
              <p className="text-xs text-caption font-medium uppercase tracking-wide">
                Total Sasaran Pasien
              </p>
              <p className="text-2xl font-semibold text-heading mt-1 tabular-nums">
                {summary?.total_patients || 0}
              </p>
              <p className="text-xs text-caption mt-1">
                {summary?.total_mothers || 0} Ibu Hamil &bull; {summary?.total_children || 0} Anak
              </p>
            </div>

            {/* Kartu 2: Pemeriksaan Bulan Ini */}
            <div
              onClick={() => navigate("/kader/laporan-kia")}
              className="bg-card p-4 rounded-xl border border-line hover:border-sky-300 dark:hover:border-sky-800 transition-colors cursor-pointer"
            >
              <p className="text-xs text-caption font-medium uppercase tracking-wide">
                Pemeriksaan Bulan Ini
              </p>
              <p className="text-2xl font-semibold text-heading mt-1 tabular-nums">
                {summary?.monthly_visits || 0}
              </p>
              <p className="text-xs text-caption mt-1">
                Kunjungan tercatat bulan berjalan
              </p>
            </div>

            {/* Kartu 3: Menunggu Validasi */}
            <div
              onClick={() => navigate("/kader/laporan-kia")}
              className="bg-card p-4 rounded-xl border border-line hover:border-sky-300 dark:hover:border-sky-800 transition-colors cursor-pointer"
            >
              <p className="text-xs text-caption font-medium uppercase tracking-wide">
                Menunggu Validasi
              </p>
              <p
                className={`text-2xl font-semibold mt-1 tabular-nums ${
                  (summary?.pending_validation || 0) > 0
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-heading"
                }`}
              >
                {summary?.pending_validation || 0}
              </p>
              <p className="text-xs text-caption mt-1">
                Laporan draft perlu pengesahan
              </p>
            </div>

            {/* Kartu 4: Pantauan Berisiko */}
            <div
              onClick={() => navigate("/kader/laporan-kia")}
              className="bg-card p-4 rounded-xl border border-line hover:border-sky-300 dark:hover:border-sky-800 transition-colors cursor-pointer"
            >
              <p className="text-xs text-caption font-medium uppercase tracking-wide">
                Pantauan Berisiko
              </p>
              <p
                className={`text-2xl font-semibold mt-1 tabular-nums ${
                  (summary?.high_risk_count || 0) > 0
                    ? "text-rose-600 dark:text-rose-400"
                    : "text-heading"
                }`}
              >
                {summary?.high_risk_count || 0}
              </p>
              <p className="text-xs text-caption mt-1">
                Sasaran butuh tindak lanjut
              </p>
            </div>
          </>
        )}
      </div>

      {/* ═══ Split Grid: Tren Posyandu (Kiri) + Aksi Layanan & 3 Fase HPK (Kanan) ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Kolom Kiri: Tren Kunjungan & Kasus Risiko (lg:col-span-7) */}
        <section className="lg:col-span-7 bg-card rounded-xl border border-line p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <header className="flex items-center justify-between gap-2 mb-3">
              <div>
                <h2 className="text-base font-semibold text-heading">
                  Tren Kunjungan & Kasus Risiko Posyandu
                </h2>
                <p className="text-sm text-caption mt-0.5">
                  Capaian hasil ukur 6 bulan terakhir
                </p>
              </div>
              <span className="text-xs text-caption font-mono">
                {summary?.posyandu_name || "Posyandu"}
              </span>
            </header>

            {/* Ringkasan Angka Bulan Berjalan */}
            <div className="flex flex-wrap items-center gap-5 py-2.5 border-b border-line text-xs">
              <div>
                <span className="text-caption">Kunjungan: </span>
                <span className="font-semibold text-heading tabular-nums">
                  {lastPoint?.visits || 0}
                </span>
              </div>
              <div>
                <span className="text-caption">Stunting: </span>
                <span
                  className={`font-semibold tabular-nums ${
                    (lastPoint?.stunting || 0) > 0
                      ? "text-rose-600 dark:text-rose-400"
                      : "text-heading"
                  }`}
                >
                  {lastPoint?.stunting || 0}
                </span>
              </div>
              <div>
                <span className="text-caption">Ibu KEK: </span>
                <span
                  className={`font-semibold tabular-nums ${
                    (lastPoint?.kek || 0) > 0
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-heading"
                  }`}
                >
                  {lastPoint?.kek || 0}
                </span>
              </div>
              <div>
                <span className="text-caption">Ibu Anemia: </span>
                <span
                  className={`font-semibold tabular-nums ${
                    (lastPoint?.anemia || 0) > 0
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-heading"
                  }`}
                >
                  {lastPoint?.anemia || 0}
                </span>
              </div>
              <span className="text-caption text-xs ml-auto hidden sm:inline">
                Bulan berjalan
              </span>
            </div>

            {/* Recharts Area (Quiet, 3 Lines Max) */}
            <div className="h-60 mt-3 text-caption">
              {loading ? (
                <div className="h-full w-full bg-muted/40 rounded-lg animate-pulse" />
              ) : !summary?.monthly_trend || summary.monthly_trend.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-caption">
                  Belum ada rekaman riwayat kunjungan bulanan.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={summary.monthly_trend}
                    margin={{ top: 8, right: 8, left: -22, bottom: 0 }}
                  >
                    <CartesianGrid
                      stroke="currentColor"
                      strokeOpacity={0.08}
                      vertical={false}
                    />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: "currentColor", fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      domain={[0, "auto"]}
                      allowDecimals={false}
                      tick={{ fill: "currentColor", fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        return (
                          <div className="bg-card border border-line rounded-lg p-2 text-xs space-y-1 shadow-sm">
                            <p className="font-semibold text-heading pb-1 border-b border-line">
                              {label}
                            </p>
                            {payload.map((entry) => (
                              <div
                                key={entry.dataKey}
                                className="flex items-center justify-between gap-4"
                              >
                                <span className="text-caption">
                                  {entry.name}:
                                </span>
                                <strong
                                  className="tabular-nums"
                                  style={{ color: entry.color }}
                                >
                                  {entry.value}
                                </strong>
                              </div>
                            ))}
                          </div>
                        );
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="visits"
                      name="Kunjungan"
                      stroke="#0284c7"
                      strokeWidth={2}
                      dot={{ r: 3, fill: "#0284c7" }}
                      activeDot={{ r: 4 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="stunting"
                      name="Stunting"
                      stroke="#e11d48"
                      strokeWidth={1.5}
                      dot={{ r: 2.5, fill: "#e11d48" }}
                      activeDot={{ r: 4 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="kek"
                      name="Ibu KEK"
                      stroke="#d97706"
                      strokeWidth={1.5}
                      dot={{ r: 2.5, fill: "#d97706" }}
                      activeDot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </section>

        {/* Kolom Kanan: Monitoring Stunting Sederhana (lg:col-span-5) */}
        <div className="lg:col-span-5 flex flex-col">
          <div className="bg-card rounded-xl border border-line p-5 sm:p-6 flex-1 flex flex-col justify-between space-y-5">
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-line">
                <h3 className="text-base font-bold text-heading flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                  <span>Kasus Stunting (PB/U &lt; -2 SD)</span>
                </h3>
                <span className={`text-xs font-semibold ${
                  stuntingCount > 0
                    ? "text-rose-600 dark:text-rose-400"
                    : "text-emerald-600 dark:text-emerald-400"
                }`}>
                  {stuntingCount > 0 ? `${stuntingCount} Kasus Aktif` : "0 Kasus (Aman)"}
                </span>
              </div>

              {/* Angka & Prevalensi Sederhana */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 bg-subtle rounded-xl border border-line space-y-1">
                  <span className="text-xs text-caption block">Jumlah Balita Stunting</span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-bold text-heading tabular-nums">
                      {stuntingCount}
                    </span>
                    <span className="text-xs text-caption">anak</span>
                  </div>
                  <span className="text-xs text-dim block">Bulan berjalan</span>
                </div>

                <div className="p-3.5 bg-subtle rounded-xl border border-line space-y-1">
                  <span className="text-xs text-caption block">Prevalensi Posyandu</span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-bold text-heading tabular-nums">
                      {stuntingRate}%
                    </span>
                    <span className="text-xs text-caption">dari {toddlersCount || summary?.total_children || 0} anak</span>
                  </div>
                  <span className="text-xs text-dim block">Target nasional &lt; 14%</span>
                </div>
              </div>

              {/* Status Ringkas */}
              <p className="text-xs text-caption leading-relaxed">
                Deteksi berdasarkan standar antropometri Panjang/Tinggi Badan menurut Umur (PB/U). Balita terindikasi stunting jika Z-score berada di bawah -2 SD.
              </p>
            </div>

            <div className="pt-3 border-t border-line flex items-center justify-between text-xs">
              <span className="text-caption">Posyandu {summary?.posyandu_name || "Airmadidi"}</span>
              <button
                type="button"
                onClick={() => navigate("/kader/monitoring-kia?tab=personal")}
                className="font-semibold text-sky-600 dark:text-sky-400 hover:underline cursor-pointer inline-flex items-center gap-1"
              >
                <span>Lihat Data di Monitoring</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ Radar Pasien Prioritas Berisiko Tinggi ═══ */}
      <div className="bg-card rounded-xl border border-line overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-line flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-heading">
              Radar Pasien Berisiko
            </h2>
            <p className="text-sm text-caption mt-0.5">
              Sasaran di wilayah posyandu yang membutuhkan kunjungan rumah atau perhatian klinis
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate("/kader/laporan-kia")}
            className="text-xs font-medium text-sky-600 dark:text-sky-400 hover:underline cursor-pointer self-start sm:self-auto"
          >
            Semua Laporan &rarr;
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-caption text-xs">
            Memuat radar pasien berisiko...
          </div>
        ) : !summary?.priority_patients || summary.priority_patients.length === 0 ? (
          <div className="py-10 text-center space-y-1">
            <p className="text-xs font-semibold text-heading">Kondisi Baik & Terkendali</p>
            <p className="text-xs text-caption max-w-sm mx-auto">
              Tidak ada temuan pasien berisiko tinggi saat ini di wilayah posyandu Anda.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted text-caption border-b border-line font-medium">
                <tr>
                  <th className="px-4 py-3">Nama & NIK</th>
                  <th className="px-4 py-3">Fase & Tanggal</th>
                  <th className="px-4 py-3">Status Risiko</th>
                  <th className="px-4 py-3">Indikator Temuan Klinis</th>
                  <th className="px-4 py-3 text-right pr-6">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {summary.priority_patients.map((p) => (
                  <tr
                    key={p.report_id}
                    onClick={() => navigate(`/kader/validasi-laporan/${p.visit_id}`)}
                    className="group cursor-pointer hover:bg-muted/50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <p className="font-semibold text-heading group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                        {p.patient_name}
                      </p>
                      <p className="text-caption font-mono mt-0.5">
                        NIK: {p.patient_nik} &bull;{" "}
                        <span className="font-sans">
                          {p.patient_type === "MOTHER" ? "Ibu Hamil" : "Anak"}
                        </span>
                      </p>
                    </td>

                    <td className="px-4 py-3">
                      <p className="font-medium text-heading">
                        {p.phase ? p.phase.replace("_", " ") : "-"}
                      </p>
                      <p className="text-caption mt-0.5">{p.visit_date}</p>
                    </td>

                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold ${
                        p.overall_status === "RISIKO_TINGGI"
                          ? "text-rose-600 dark:text-rose-400"
                          : "text-amber-600 dark:text-amber-400"
                      }`}>
                        {p.overall_status === "RISIKO_TINGGI" ? "Risiko Tinggi" : "Perlu Perhatian"}
                      </span>
                    </td>

                    <td className="px-4 py-3 max-w-xs">
                      {p.risk_summary && p.risk_summary.length > 0 ? (
                        <div className="space-y-0.5">
                          {p.risk_summary.map((finding, idx) => (
                            <p key={idx} className="text-body leading-normal">
                              &bull; {finding}
                            </p>
                          ))}
                        </div>
                      ) : (
                        <span className="text-caption">Perlu pemantauan berkala</span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/kader/validasi-laporan/${p.visit_id}`);
                        }}
                        className="inline-flex items-center gap-1 text-xs font-medium text-sky-600 dark:text-sky-400 hover:underline cursor-pointer"
                      >
                        <ExternalLink className="w-3 h-3 text-caption" />
                        <span>Laporan</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default KaderDashboard;
