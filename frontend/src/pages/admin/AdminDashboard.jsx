import React, { useState, useEffect, useRef } from "react";
import api from "../../services/api";
import { RefreshCw, Pause, Play } from "lucide-react";
import OverallTrendChart from "../../components/admin/OverallTrendChart";
import PatientTrendChart from "../../components/admin/PatientTrendChart";

const SkeletonCard = () => (
  <div className="bg-card p-4 rounded-xl border border-line space-y-2 animate-pulse">
    <div className="h-3 w-28 bg-muted rounded" />
    <div className="h-7 w-20 bg-muted rounded" />
    <div className="h-2.5 w-36 bg-muted/70 rounded" />
  </div>
);

const SkeletonRow = () => (
  <tr className="animate-pulse">
    <td className="p-3.5"><div className="h-3.5 w-28 bg-muted rounded" /></td>
    <td className="p-3.5 text-center"><div className="h-3.5 w-12 bg-muted rounded mx-auto" /></td>
    <td className="p-3.5 text-center"><div className="h-4 w-8 bg-muted rounded mx-auto" /></td>
    <td className="p-3.5 text-center"><div className="h-4 w-8 bg-muted rounded mx-auto" /></td>
    <td className="p-3.5 text-center"><div className="h-4 w-8 bg-muted rounded mx-auto" /></td>
    <td className="p-3.5 text-center"><div className="h-5 w-16 bg-muted rounded-full mx-auto" /></td>
  </tr>
);

const AdminDashboard = () => {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [countdown, setCountdown] = useState(30);
  const previousVisitCount = useRef(null);

  useEffect(() => {
    fetchSummary();
  }, []);

  const fetchSummary = async (isManual = false, isSilent = false) => {
    try {
      if (isManual) {
        setRefreshing(true);
      } else if (!isSilent) {
        setLoading(true);
      }
      setError(null);
      const res = await api.get("/admin/dashboard-summary");
      previousVisitCount.current = res.data?.total_visits ?? null;
      setSummary(res.data);
      setLastUpdated(
        new Date().toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
        })
      );
    } catch (e) {
      console.error(e);
      if (!isSilent) {
        setError("Gagal memuat ringkasan data dashboard.");
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
          fetchSummary(false, true);
          return 30;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const villageTotals = summary?.village_breakdown?.reduce(
    (acc, v) => ({
      total_patients: acc.total_patients + (v.total_patients || 0),
      stunting_count: acc.stunting_count + (v.stunting_count || 0),
      kek_count: acc.kek_count + (v.kek_count || 0),
      anemia_count: acc.anemia_count + (v.anemia_count || 0),
      high_risk_count: acc.high_risk_count + (v.high_risk_count || 0),
    }),
    { total_patients: 0, stunting_count: 0, kek_count: 0, anemia_count: 0, high_risk_count: 0 }
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header Halaman */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-line">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-heading tracking-tight">
            Dashboard Monitoring KIA & Stunting
          </h1>
          <p className="text-sm text-caption mt-1">
            Puskesmas Kecamatan Airmadidi &bull; Rekapitulasi agregat pemantauan 1.000 HPK lintas 9 Desa
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
            onClick={() => fetchSummary(true)}
            disabled={loading || refreshing}
            className="text-xs font-medium px-3 py-1.5 rounded-lg border border-line bg-card text-heading hover:bg-muted transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            <span>Segarkan</span>
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 rounded-lg text-xs text-red-700 dark:text-red-300 flex items-center justify-between">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => fetchSummary(true)}
            className="underline font-semibold cursor-pointer"
          >
            Coba Lagi
          </button>
        </div>
      )}

      {/* 4 Kartu Metrik KPI (Type-Focused, Clean) */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Pasien Terdaftar */}
          <div className="bg-card p-4 rounded-xl border border-line hover:border-sky-300 dark:hover:border-sky-800 transition-colors">
            <p className="text-xs font-medium text-caption uppercase tracking-wide">
              Total Pasien Terdaftar
            </p>
            <p className="text-2xl sm:text-3xl font-semibold text-heading mt-1 tabular-nums">
              {summary?.total_patients || 0}
            </p>
            <p className="text-xs text-caption mt-1">
              Wilayah Kerja Puskesmas Airmadidi
            </p>
          </div>

          {/* Card 2: Kasus Stunting Terdeteksi */}
          <div className="bg-card p-4 rounded-xl border border-line hover:border-sky-300 dark:hover:border-sky-800 transition-colors">
            <p className="text-xs font-medium text-caption uppercase tracking-wide">
              Kasus Stunting Terdeteksi
            </p>
            <p
              className={`text-2xl sm:text-3xl font-semibold mt-1 tabular-nums ${
                (summary?.total_stunting || 0) > 0
                  ? "text-rose-600 dark:text-rose-400"
                  : "text-heading"
              }`}
            >
              {summary?.total_stunting || 0}
            </p>
            <p className="text-xs text-caption mt-1">
              Status antropometri balita
            </p>
          </div>

          {/* Card 3: Ibu Hamil KEK / Anemia */}
          <div className="bg-card p-4 rounded-xl border border-line hover:border-sky-300 dark:hover:border-sky-800 transition-colors">
            <p className="text-xs font-medium text-caption uppercase tracking-wide">
              Ibu Hamil KEK / Anemia
            </p>
            <p
              className={`text-2xl sm:text-3xl font-semibold mt-1 tabular-nums ${
                ((summary?.total_kek || 0) + (summary?.total_anemia || 0)) > 0
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-heading"
              }`}
            >
              {(summary?.total_kek || 0) + (summary?.total_anemia || 0)}
            </p>
            <p className="text-xs text-caption mt-1">
              KEK: {summary?.total_kek || 0} &bull; Anemia: {summary?.total_anemia || 0}
            </p>
          </div>

          {/* Card 4: Laporan Tervalidasi */}
          <div className="bg-card p-4 rounded-xl border border-line hover:border-sky-300 dark:hover:border-sky-800 transition-colors">
            <p className="text-xs font-medium text-caption uppercase tracking-wide">
              Laporan Tervalidasi Kader
            </p>
            <p className="text-2xl sm:text-3xl font-semibold text-heading mt-1 tabular-nums">
              {summary?.total_reports_approved || 0}
            </p>
            <p className="text-xs text-caption mt-1">
              Dokumen rekam medis siap cetak
            </p>
          </div>
        </div>
      )}

      {/* Grafik Tren */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <OverallTrendChart data={summary?.monthly_trend || []} loading={loading} />
        <PatientTrendChart />
      </div>

      {/* Tabel Distribusi Risiko per Desa */}
      <div className="bg-card rounded-xl border border-line overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-line flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-heading">
              Distribusi Kasus Risiko 1.000 HPK per Desa/Kelurahan
            </h2>
            <p className="text-sm text-caption mt-0.5">
              Monitoring wilayah kerja Puskesmas Kecamatan Airmadidi
            </p>
          </div>
          <button
            type="button"
            onClick={() => fetchSummary(true)}
            disabled={loading || refreshing}
            className="text-xs font-medium text-sky-600 dark:text-sky-400 hover:underline cursor-pointer self-start sm:self-auto"
          >
            Muat Ulang Data
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-muted text-caption border-b border-line font-medium">
              <tr>
                <th className="p-3.5">Desa / Kelurahan</th>
                <th className="p-3.5 text-center">Total Pasien</th>
                <th className="p-3.5 text-center text-rose-600 dark:text-rose-400">
                  Kasus Stunting
                </th>
                <th className="p-3.5 text-center text-amber-600 dark:text-amber-400">
                  Ibu KEK
                </th>
                <th className="p-3.5 text-center text-amber-600 dark:text-amber-400">
                  Ibu Anemia
                </th>
                <th className="p-3.5 text-center text-heading">
                  Risiko Tinggi
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {loading ? (
                <>
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                </>
              ) : summary?.village_breakdown && summary.village_breakdown.length > 0 ? (
                summary.village_breakdown.map((v, i) => {
                  const hasStunting = (v.stunting_count || 0) > 0;
                  const hasKek = (v.kek_count || 0) > 0;
                  const hasAnemia = (v.anemia_count || 0) > 0;
                  const hasHighRisk = (v.high_risk_count || 0) > 0;

                  return (
                    <tr
                      key={v.village_name || i}
                      className="hover:bg-muted/50 transition-colors"
                    >
                      <td className="p-3.5 font-medium text-heading">
                        {v.village_name}
                      </td>
                      <td className="p-3.5 text-center text-body tabular-nums font-medium">
                        {v.total_patients}
                      </td>
                      <td className="p-3.5 text-center tabular-nums">
                        {hasStunting ? (
                          <span className="font-semibold text-rose-600 dark:text-rose-400">
                            {v.stunting_count}
                          </span>
                        ) : (
                          <span className="text-dim">0</span>
                        )}
                      </td>
                      <td className="p-3.5 text-center tabular-nums">
                        {hasKek ? (
                          <span className="font-semibold text-amber-600 dark:text-amber-400">
                            {v.kek_count}
                          </span>
                        ) : (
                          <span className="text-dim">0</span>
                        )}
                      </td>
                      <td className="p-3.5 text-center tabular-nums">
                        {hasAnemia ? (
                          <span className="font-semibold text-amber-600 dark:text-amber-400">
                            {v.anemia_count}
                          </span>
                        ) : (
                          <span className="text-dim">0</span>
                        )}
                      </td>
                      <td className="p-3.5 text-center tabular-nums">
                        {hasHighRisk ? (
                          <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold text-rose-700 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40">
                            {v.high_risk_count} Kasus
                          </span>
                        ) : (
                          <span className="text-dim">Aman</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-caption">
                    Tidak ada data desa tersedia.
                  </td>
                </tr>
              )}
            </tbody>

            {!loading && summary?.village_breakdown && summary.village_breakdown.length > 0 && (
              <tfoot className="bg-muted/50 border-t-2 border-line text-xs font-semibold">
                <tr>
                  <td className="p-3.5 text-heading">
                    Total Wilayah Kerja (9 Desa)
                  </td>
                  <td className="p-3.5 text-center text-heading tabular-nums">
                    {villageTotals?.total_patients || 0}
                  </td>
                  <td className="p-3.5 text-center text-rose-600 dark:text-rose-400 tabular-nums">
                    {villageTotals?.stunting_count || 0}
                  </td>
                  <td className="p-3.5 text-center text-amber-600 dark:text-amber-400 tabular-nums">
                    {villageTotals?.kek_count || 0}
                  </td>
                  <td className="p-3.5 text-center text-amber-600 dark:text-amber-400 tabular-nums">
                    {villageTotals?.anemia_count || 0}
                  </td>
                  <td className="p-3.5 text-center text-rose-700 dark:text-rose-300 tabular-nums">
                    {villageTotals?.high_risk_count || 0} Kasus
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
