import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";
import PatientTrendChart from "../../components/admin/PatientTrendChart";
import {
  Users,
  AlertTriangle,
  Clock,
  CheckCircle2,
  ClipboardList,
  PlusCircle,
  FileText,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Baby,
  Heart,
  ShieldAlert,
  Pause,
  Play,
} from "lucide-react";

const SkeletonCard = () => (
  <div className="bg-card p-5 rounded-2xl border border-line shadow-card flex items-center justify-between animate-pulse">
    <div className="space-y-2.5 flex-1">
      <div className="h-3.5 w-28 bg-muted rounded" />
      <div className="h-8 w-16 bg-muted rounded" />
      <div className="h-3 w-36 bg-muted/70 rounded" />
    </div>
    <div className="w-12 h-12 rounded-xl bg-muted" />
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
  const [newDataBadge, setNewDataBadge] = useState(false);
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

      if (previousPendingCount.current !== null && res.data?.pending_validation > previousPendingCount.current) {
        setNewDataBadge(true);
        setTimeout(() => setNewDataBadge(false), 8000);
      }
      previousPendingCount.current = res.data?.pending_validation ?? null;

      setSummary(res.data);
      const now = new Date();
      setLastUpdated(now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    } catch (e) {
      console.error(e);
      if (!isSilent) {
        setError("Gagal memuat ringkasan data posyandu. Silakan periksa koneksi backend.");
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

  const getRiskBadge = (risk) => {
    if (risk === "RISIKO_TINGGI") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800/40">
          <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
          Risiko Tinggi
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
        Perlu Perhatian
      </span>
    );
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* ═══ Header Posyandu ═══ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-line-light">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold text-heading tracking-tight">
              Dashboard Posyandu
            </h1>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50">
              <span className={`w-2 h-2 rounded-full ${autoRefresh ? "bg-emerald-500 animate-pulse" : "bg-zinc-400"}`} />
              <span>{autoRefresh ? `Live Sync (${countdown}s)` : "Sync Dijeda"}</span>
            </div>
            {newDataBadge && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700 animate-bounce">
                ✨ Laporan Baru Menunggu Validasi
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-caption mt-1 flex items-center gap-1.5 flex-wrap">
            <span>Wilayah Kerja {summary?.posyandu_name || "Posyandu"} &bull; {summary?.village_name || "Kec. Airmadidi"}</span>
            {lastUpdated && (
              <>
                <span>&bull;</span>
                <span className="text-dim">Sinkronisasi: {lastUpdated} WITA</span>
              </>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            title={autoRefresh ? "Jeda auto-sync" : "Aktifkan auto-sync"}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-card border border-line text-caption hover:text-body hover:bg-muted/60 transition-colors cursor-pointer"
          >
            {autoRefresh ? (
              <>
                <Pause className="w-3.5 h-3.5 text-dim" />
                <span className="hidden md:inline">Jeda Sync</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 text-emerald-600" />
                <span className="hidden md:inline">Lanjutkan Sync</span>
              </>
            )}
          </button>

          <button
            onClick={() => fetchDashboardSummary(true)}
            disabled={loading || refreshing}
            className="btn-interactive flex items-center gap-1.5 px-3.5 py-2 bg-card border border-line hover:bg-muted text-label hover:text-heading rounded-xl text-xs font-semibold transition-colors duration-200 cursor-pointer"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 text-sky-600 dark:text-sky-400 ${
                refreshing ? "animate-spin" : ""
              }`}
            />
            <span>{refreshing ? "Menyegarkan..." : "Segarkan Sekarang"}</span>
          </button>
        </div>
      </div>

      {/* ═══ Error Alert ═══ */}
      {error && (
        <div className="p-4 bg-accent-red border border-red-300 dark:border-red-800/50 rounded-xl text-sm text-red-700 dark:text-red-300 flex items-center justify-between gap-3 animate-slide-up">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => fetchDashboardSummary()}
            className="px-3 py-1 bg-red-100 dark:bg-red-900/40 hover:bg-red-200 text-red-700 dark:text-red-300 rounded-lg text-xs font-semibold"
          >
            Coba Lagi
          </button>
        </div>
      )}

      {/* ═══ 4 Metric Cards ═══ */}
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
            {/* Kartu 1: Total Sasaran Pasien */}
            <div
              onClick={() => navigate("/kader/data-pasien")}
              className="group bg-card p-5 rounded-2xl border border-line hover:border-sky-300 dark:hover:border-sky-800/60 shadow-card flex items-center justify-between cursor-pointer transition-all duration-200"
            >
              <div className="space-y-1">
                <p className="text-xs font-semibold text-caption uppercase tracking-wider">
                  Total Sasaran Pasien
                </p>
                <p className="text-2xl sm:text-3xl font-bold text-heading transition-colors">
                  {summary?.total_patients || 0}
                </p>
                <p className="text-xs text-caption">
                  {summary?.total_mothers || 0} Ibu Hamil &bull; {summary?.total_children || 0} Anak
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-sky-50 dark:bg-sky-950/30 text-sky-600 dark:text-sky-400 flex items-center justify-center border border-sky-100 dark:border-sky-900/30 shrink-0">
                <Users className="w-6 h-6" />
              </div>
            </div>

            {/* Kartu 2: Pemeriksaan Bulan Ini */}
            <div
              onClick={() => navigate("/kader/laporan-kia")}
              className="group bg-card p-5 rounded-2xl border border-line hover:border-emerald-300 dark:hover:border-emerald-800/60 shadow-card flex items-center justify-between cursor-pointer transition-all duration-200"
            >
              <div className="space-y-1">
                <p className="text-xs font-semibold text-caption uppercase tracking-wider">
                  Pemeriksaan Bulan Ini
                </p>
                <p className="text-2xl sm:text-3xl font-bold text-heading transition-colors">
                  {summary?.monthly_visits || 0}
                </p>
                <p className="text-xs text-caption">Kunjungan posyandu tercatat</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-100 dark:border-emerald-900/30 shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
            </div>

            {/* Kartu 3: Menunggu Validasi */}
            <div
              onClick={() => navigate("/kader/laporan-kia")}
              className="group bg-card p-5 rounded-2xl border border-line hover:border-amber-300 dark:hover:border-amber-800/60 shadow-card flex items-center justify-between cursor-pointer transition-all duration-200"
            >
              <div className="space-y-1">
                <p className="text-xs font-semibold text-caption uppercase tracking-wider">
                  Menunggu Validasi
                </p>
                <p className={`text-2xl sm:text-3xl font-bold ${(summary?.pending_validation || 0) > 0 ? "text-amber-600 dark:text-amber-400" : "text-heading"} transition-colors`}>
                  {summary?.pending_validation || 0}
                </p>
                <p className="text-xs text-caption">Laporan draft perlu pengesahan</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-100 dark:border-amber-900/30 shrink-0">
                <Clock className="w-6 h-6" />
              </div>
            </div>

            {/* Kartu 4: Pantauan Berisiko Tinggi */}
            <div
              onClick={() => navigate("/kader/laporan-kia")}
              className="group bg-card p-5 rounded-2xl border border-line hover:border-rose-300 dark:hover:border-rose-800/60 shadow-card flex items-center justify-between cursor-pointer transition-all duration-200"
            >
              <div className="space-y-1">
                <p className="text-xs font-semibold text-caption uppercase tracking-wider">
                  Pantauan Berisiko
                </p>
                <p className={`text-2xl sm:text-3xl font-bold ${(summary?.high_risk_count || 0) > 0 ? "text-rose-600 dark:text-rose-400" : "text-heading"} transition-colors`}>
                  {summary?.high_risk_count || 0}
                </p>
                <p className="text-xs text-caption">Butuh tindak lanjut / kunjungan</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-100 dark:border-rose-900/30 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
            </div>
          </>
        )}
      </div>

      {/* ═══ Grafik Tren Longitudinal 1.000 HPK Per Pasien ═══ */}
      <PatientTrendChart />

      {/* ═══ Radar Pasien Prioritas Berisiko Tinggi ═══ */}
      <div className="bg-card rounded-2xl border border-line shadow-card overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-line flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 rounded-xl border border-rose-100 dark:border-rose-900/30">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-heading">
                Radar Pasien Berisiko (Prioritas Tindak Lanjut)
              </h2>
              <p className="text-xs text-caption mt-0.5">
                Balita dan ibu hamil di wilayah kerja posyandu Anda yang membutuhkan perhatian atau kunjungan rumah
              </p>
            </div>
          </div>

          <button
            onClick={() => navigate("/kader/laporan-kia")}
            className="inline-flex items-center gap-1 text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline cursor-pointer self-start sm:self-auto"
          >
            <span>Semua Laporan</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-caption text-sm">
            Memuat radar pasien berisiko...
          </div>
        ) : !summary?.priority_patients || summary.priority_patients.length === 0 ? (
          <div className="py-12 text-center space-y-2">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto opacity-70" />
            <h3 className="text-sm font-bold text-heading">Kondisi Baik & Terkendali</h3>
            <p className="text-xs text-caption max-w-sm mx-auto">
              Tidak ada temuan pasien berisiko tinggi saat ini di wilayah posyandu Anda.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs sm:text-sm text-left">
              <thead className="bg-muted text-caption border-b border-line text-xs font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3.5">Nama & NIK Pasien</th>
                  <th className="px-4 py-3.5">Fase & Tgl Kunjungan</th>
                  <th className="px-4 py-3.5">Status Risiko AI</th>
                  <th className="px-4 py-3.5">Indikator Temuan Klinis</th>
                  <th className="px-4 py-3.5 text-right pr-6">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-light">
                {summary.priority_patients.map((p) => (
                  <tr
                    key={p.report_id}
                    onClick={() => navigate(`/kader/validasi-laporan/${p.visit_id}`)}
                    className="group cursor-pointer hover:bg-muted/50 transition-colors duration-150"
                    title="Klik baris untuk membuka lembar laporan"
                  >
                    <td className="px-4 py-3.5">
                      <p className="font-semibold text-sm text-heading group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                        {p.patient_name}
                      </p>
                      <p className="text-xs text-caption font-mono mt-0.5">
                        NIK: {p.patient_nik} &bull;{" "}
                        <span className="font-sans font-medium">
                          {p.patient_type === "MOTHER" ? "Ibu Hamil" : "Anak"}
                        </span>
                      </p>
                    </td>

                    <td className="px-4 py-3.5">
                      <p className="font-medium text-xs text-heading uppercase tracking-wider">
                        {p.phase ? p.phase.replace("_", " ") : "-"}
                      </p>
                      <p className="text-xs text-caption mt-0.5">{p.visit_date}</p>
                    </td>

                    <td className="px-4 py-3.5">{getRiskBadge(p.overall_status)}</td>

                    <td className="px-4 py-3.5 max-w-xs">
                      {p.risk_summary && p.risk_summary.length > 0 ? (
                        <div className="space-y-1">
                          {p.risk_summary.map((finding, idx) => (
                            <p key={idx} className="text-xs text-body leading-tight">
                              &bull; {finding}
                            </p>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-dim">Perlu pemantauan berkala</span>
                      )}
                    </td>

                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => navigate(`/kader/validasi-laporan/${p.visit_id}`)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-muted hover:bg-card text-heading rounded-lg text-xs font-semibold border border-line transition-colors cursor-pointer"
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-dim" />
                          <span>Laporan</span>
                        </button>
                      </div>
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
