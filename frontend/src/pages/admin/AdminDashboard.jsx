import React, { useState, useEffect } from "react";
import api from "../../services/api";
import {
  Users,
  AlertTriangle,
  HeartPulse,
  Baby,
  CheckCircle,
  MapPin,
  RefreshCw,
} from "lucide-react";
import OverallTrendChart from "../../components/admin/OverallTrendChart";
import PatientTrendChart from "../../components/admin/PatientTrendChart";

const SkeletonCard = () => (
  <div className="bg-card p-5 rounded-2xl border border-line shadow-card flex items-center justify-between animate-pulse">
    <div className="space-y-2.5 flex-1">
      <div className="h-3 w-28 bg-muted rounded" />
      <div className="h-7 w-20 bg-muted rounded" />
      <div className="h-2.5 w-36 bg-muted/70 rounded" />
    </div>
    <div className="w-12 h-12 rounded-xl bg-muted" />
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

  useEffect(() => {
    fetchSummary();
  }, []);

  const fetchSummary = async (isManual = false) => {
    try {
      if (isManual) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      const res = await api.get("/admin/dashboard-summary");
      setSummary(res.data);
      setLastUpdated(new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }));
    } catch (e) {
      console.error(e);
      setError("Gagal memuat ringkasan data dashboard. Silakan periksa koneksi backend.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Aggregated totals for table footer
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
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Top Header & Context */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-line-light">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-heading tracking-tight">
              Dashboard Monitoring KIA & Stunting
            </h1>
            <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-accent-sky text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800/50">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse" />
              Live Monitoring
            </span>
          </div>
          <p className="text-xs sm:text-sm text-caption mt-1 flex items-center gap-1.5 flex-wrap">
            <span className="font-semibold text-body">Puskesmas Kecamatan Airmadidi</span>
            <span>&bull;</span>
            <span>Rekapitulasi agregat pemantauan 1.000 HPK lintas 9 Desa/Kelurahan</span>
            {lastUpdated && (
              <>
                <span>&bull;</span>
                <span className="text-dim">Pembaruan: {lastUpdated} WITA</span>
              </>
            )}
          </p>
        </div>

        <button
          onClick={() => fetchSummary(true)}
          disabled={loading || refreshing}
          aria-label="Segarkan data dashboard"
          className="btn-interactive inline-flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl bg-card border border-line text-body hover:text-heading hover:bg-muted/80 shadow-xs active:scale-[0.98] transition-all duration-150 disabled:opacity-50 self-start sm:self-auto cursor-pointer focus-visible:ring-2 focus-visible:ring-sky-500"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-sky-600 dark:text-sky-400 ${refreshing ? "animate-spin" : ""}`} />
          <span>{refreshing ? "Menyegarkan..." : "Segarkan Data"}</span>
        </button>
      </div>

      {/* Error Alert if any */}
      {error && (
        <div
          role="alert"
          className="p-4 bg-accent-red border border-red-300 dark:border-red-800/50 rounded-2xl flex items-center justify-between gap-3 text-xs text-red-700 dark:text-red-300 animate-slide-up"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => fetchSummary(true)}
            className="font-bold underline hover:no-underline text-red-800 dark:text-red-200 cursor-pointer"
          >
            Coba Lagi
          </button>
        </div>
      )}


      {/* Top 4 Stat Cards */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" aria-busy="true" aria-label="Memuat kartu statistik">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Pasien Terdaftar */}
          <div
            className="group relative bg-card p-5 rounded-2xl border border-line border-t-2 border-t-sky-500 shadow-card hover:shadow-elevated hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between animate-fade-in"
            style={{ animationDelay: "0ms" }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-caption group-hover:text-body transition-colors">
                  Total Pasien Terdaftar
                </p>
                <p className="text-2xl sm:text-3xl font-extrabold text-heading mt-1 tracking-tight tabular-nums">
                  {summary?.total_patients || 0}
                </p>
              </div>
              <div className="p-3 bg-accent-sky text-sky-600 dark:text-sky-400 rounded-xl border border-sky-200/80 dark:border-sky-800/50 group-hover:scale-105 transition-transform duration-200 shrink-0 shadow-xs">
                <Users className="w-5 h-5" aria-hidden="true" />
              </div>
            </div>
            <div className="mt-3 pt-2.5 border-t border-line-light flex items-center justify-between text-[11px] text-caption">
              <span>Kohort 1.000 HPK</span>
              <span className="font-semibold text-sky-600 dark:text-sky-400">9 Desa Aktif</span>
            </div>
          </div>

          {/* Card 2: Kasus Stunting Terdeteksi */}
          <div
            className="group relative bg-card p-5 rounded-2xl border border-line border-t-2 border-t-rose-500 shadow-card hover:shadow-elevated hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between animate-fade-in"
            style={{ animationDelay: "60ms" }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-caption group-hover:text-body transition-colors">
                  Kasus Stunting Terdeteksi
                </p>
                <p className="text-2xl sm:text-3xl font-extrabold text-rose-600 dark:text-rose-400 mt-1 tracking-tight tabular-nums">
                  {summary?.total_stunting || 0}
                </p>
              </div>
              <div className="p-3 bg-accent-rose text-rose-600 dark:text-rose-400 rounded-xl border border-rose-200/80 dark:border-rose-800/50 group-hover:scale-105 transition-transform duration-200 shrink-0 shadow-xs">
                <Baby className="w-5 h-5" aria-hidden="true" />
              </div>
            </div>
            <div className="mt-3 pt-2.5 border-t border-line-light flex items-center justify-between text-[11px]">
              <span className="text-caption">Status Gizi Balita</span>
              <span
                className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${
                  (summary?.total_stunting || 0) > 0
                    ? "text-rose-700 bg-rose-50 dark:bg-rose-950/60 dark:text-rose-300"
                    : "text-emerald-700 bg-emerald-50 dark:bg-emerald-950/60 dark:text-emerald-300"
                }`}
              >
                {(summary?.total_stunting || 0) > 0 ? "Perlu Intervensi" : "Nol Kasus"}
              </span>
            </div>
          </div>

          {/* Card 3: Ibu Hamil KEK / Anemia */}
          <div
            className="group relative bg-card p-5 rounded-2xl border border-line border-t-2 border-t-amber-500 shadow-card hover:shadow-elevated hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between animate-fade-in"
            style={{ animationDelay: "120ms" }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-caption group-hover:text-body transition-colors">
                  Ibu Hamil KEK / Anemia
                </p>
                <p className="text-2xl sm:text-3xl font-extrabold text-amber-600 dark:text-amber-400 mt-1 tracking-tight tabular-nums">
                  {(summary?.total_kek || 0) + (summary?.total_anemia || 0)}
                </p>
              </div>
              <div className="p-3 bg-accent-amber text-amber-600 dark:text-amber-400 rounded-xl border border-amber-200/80 dark:border-amber-800/50 group-hover:scale-105 transition-transform duration-200 shrink-0 shadow-xs">
                <HeartPulse className="w-5 h-5" aria-hidden="true" />
              </div>
            </div>
            <div className="mt-3 pt-2.5 border-t border-line-light flex items-center justify-between text-[11px] text-caption tabular-nums">
              <span>KEK: <strong className="text-heading font-bold">{summary?.total_kek || 0}</strong></span>
              <span>&bull;</span>
              <span>Anemia: <strong className="text-heading font-bold">{summary?.total_anemia || 0}</strong></span>
            </div>
          </div>

          {/* Card 4: Laporan Tervalidasi Kader */}
          <div
            className="group relative bg-card p-5 rounded-2xl border border-line border-t-2 border-t-emerald-500 shadow-card hover:shadow-elevated hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between animate-fade-in"
            style={{ animationDelay: "180ms" }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-caption group-hover:text-body transition-colors">
                  Laporan Tervalidasi Kader
                </p>
                <p className="text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1 tracking-tight tabular-nums">
                  {summary?.total_reports_approved || 0}
                </p>
              </div>
              <div className="p-3 bg-accent-emerald text-emerald-600 dark:text-emerald-400 rounded-xl border border-emerald-200/80 dark:border-emerald-800/50 group-hover:scale-105 transition-transform duration-200 shrink-0 shadow-xs">
                <CheckCircle className="w-5 h-5" aria-hidden="true" />
              </div>
            </div>
            <div className="mt-3 pt-2.5 border-t border-line-light flex items-center justify-between text-[11px]">
              <span className="text-caption">Human-in-the-Loop</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                Valid Siap Cetak
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Grafik tren: keseluruhan | per pasien */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <OverallTrendChart data={summary?.monthly_trend || []} loading={loading} />
        <PatientTrendChart />
      </div>

      {/* Tabel distribusi risiko per desa */}
      <div>
        <div className="bg-card rounded-2xl border border-line shadow-card overflow-hidden transition-shadow duration-200">
          <div className="p-4 sm:p-5 border-b border-line flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-gradient-to-r from-card to-muted/30">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-accent-sky text-sky-600 dark:text-sky-400 rounded-lg">
                <MapPin className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-heading">
                  Distribusi Kasus Risiko 1.000 HPK per Desa/Kelurahan
                </h2>
                <p className="text-[11px] text-caption">
                  Monitoring wilayah kerja Puskesmas Kecamatan Airmadidi
                </p>
              </div>
            </div>
            <button
              onClick={() => fetchSummary(true)}
              disabled={loading || refreshing}
              className="btn-interactive text-xs text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 font-semibold cursor-pointer flex items-center gap-1 self-start sm:self-auto py-1 px-2 rounded-lg hover:bg-accent-sky/50 transition-colors"
            >
              <RefreshCw className={`w-3 h-3 ${refreshing ? "animate-spin" : ""}`} />
              <span>Muat Ulang</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/70 text-label border-b border-line">
                <tr>
                  <th className="p-3.5 font-bold">Desa / Kelurahan</th>
                  <th className="p-3.5 text-center font-bold">Total Pasien</th>
                  <th className="p-3.5 text-center font-bold text-rose-600 dark:text-rose-400">
                    Kasus Stunting
                  </th>
                  <th className="p-3.5 text-center font-bold text-amber-600 dark:text-amber-400">
                    Ibu KEK
                  </th>
                  <th className="p-3.5 text-center font-bold text-amber-600 dark:text-amber-400">
                    Ibu Anemia
                  </th>
                  <th className="p-3.5 text-center font-bold text-heading">
                    Risiko Tinggi
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-light">
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
                        className="table-row-interactive hover:bg-accent-sky/50 dark:hover:bg-sky-950/20 transition-colors duration-150 group"
                      >
                        <td className="p-3.5 font-bold text-heading flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-sky-400 group-hover:scale-125 transition-transform" />
                          <span>{v.village_name}</span>
                        </td>
                        <td className="p-3.5 text-center text-body tabular-nums font-medium">
                          {v.total_patients}
                        </td>
                        <td className="p-3.5 text-center tabular-nums">
                          {hasStunting ? (
                            <span className="inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded-md text-xs font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800/50 shadow-xs">
                              {v.stunting_count}
                            </span>
                          ) : (
                            <span className="text-dim font-normal">0</span>
                          )}
                        </td>
                        <td className="p-3.5 text-center tabular-nums">
                          {hasKek ? (
                            <span className="inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded-md text-xs font-semibold bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50 shadow-xs">
                              {v.kek_count}
                            </span>
                          ) : (
                            <span className="text-dim font-normal">0</span>
                          )}
                        </td>
                        <td className="p-3.5 text-center tabular-nums">
                          {hasAnemia ? (
                            <span className="inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded-md text-xs font-semibold bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50 shadow-xs">
                              {v.anemia_count}
                            </span>
                          ) : (
                            <span className="text-dim font-normal">0</span>
                          )}
                        </td>
                        <td className="p-3.5 text-center tabular-nums">
                          {hasHighRisk ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-accent-rose text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60 shadow-xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                              <span>{v.high_risk_count} Kasus</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-dim border border-line">
                              Aman
                            </span>
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
                <tfoot className="bg-muted/60 dark:bg-slate-800/70 border-t-2 border-line text-xs font-bold">
                  <tr>
                    <td className="p-3.5 text-heading font-extrabold">
                      Total Wilayah Kerja (9 Desa)
                    </td>
                    <td className="p-3.5 text-center text-heading font-extrabold tabular-nums">
                      {villageTotals?.total_patients || 0}
                    </td>
                    <td className="p-3.5 text-center text-rose-600 dark:text-rose-400 font-extrabold tabular-nums">
                      {villageTotals?.stunting_count || 0}
                    </td>
                    <td className="p-3.5 text-center text-amber-600 dark:text-amber-400 font-extrabold tabular-nums">
                      {villageTotals?.kek_count || 0}
                    </td>
                    <td className="p-3.5 text-center text-amber-600 dark:text-amber-400 font-extrabold tabular-nums">
                      {villageTotals?.anemia_count || 0}
                    </td>
                    <td className="p-3.5 text-center text-rose-700 dark:text-rose-300 font-extrabold tabular-nums">
                      {villageTotals?.high_risk_count || 0} Kasus
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;


