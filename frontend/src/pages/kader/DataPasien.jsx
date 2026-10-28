import React, { useState, useEffect, useRef, useMemo } from "react";
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
  ReferenceLine,
} from "recharts";
import {
  Users,
  Search,
  GitFork,
  AlertTriangle,
  X,
  RefreshCw,
  FileSearch,
  FileEdit,
  ExternalLink,
  HeartPulse,
  Baby,
  TrendingUp,
  CheckCircle2,
  Clock,
} from "lucide-react";
import RevisionRequestModal from "../../components/kader/RevisionRequestModal";

const SkeletonRow = () => (
  <tr>
    <td className="p-4"><div className="skeleton skeleton-text w-36" /><div className="skeleton skeleton-text short w-28 mt-1.5" /></td>
    <td className="p-4"><div className="skeleton w-20 h-5 rounded-full" /></td>
    <td className="p-4"><div className="skeleton skeleton-text w-28" /></td>
    <td className="p-4"><div className="skeleton skeleton-text w-28" /></td>
    <td className="p-4 text-center"><div className="skeleton w-32 h-8 rounded-xl mx-auto" /></td>
  </tr>
);

const SkeletonCard = () => (
  <div className="p-4 bg-card rounded-xl border border-line space-y-3">
    <div className="flex justify-between items-start">
      <div><div className="skeleton skeleton-text w-36" /><div className="skeleton skeleton-text short w-28 mt-1" /></div>
      <div className="skeleton w-16 h-5 rounded-full" />
    </div>
    <div className="flex gap-4"><div className="skeleton skeleton-text w-24" /><div className="skeleton skeleton-text w-28" /></div>
    <div className="skeleton w-full h-9 rounded-xl" />
  </div>
);

const PHASE_BADGE = {
  IBU_HAMIL: { label: "Fase 1: Ibu Hamil", cls: "bg-accent-pink text-pink-700 dark:text-pink-300 border-pink-200 dark:border-pink-800/50" },
  BAYI_BARU_LAHIR: { label: "Fase 2: Bayi Baru Lahir (0-28 Hr)", cls: "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800/50" },
  BADUTA: { label: "Fase 3: Baduta (1-24 Bln)", cls: "bg-accent-sky text-sky-800 dark:text-sky-300 border-sky-200 dark:border-sky-800/50" },
};

const METRIC_OPTIONS = {
  CHILD: [
    {
      key: "weight",
      label: "Berat Badan (kg)",
      unit: "kg",
      pick: (v) => v.child_weight_kg ?? (v.birth_weight_gram ? +(v.birth_weight_gram / 1000).toFixed(2) : null),
    },
    {
      key: "length",
      label: "Panjang/Tinggi (cm)",
      unit: "cm",
      pick: (v) => v.child_length_cm ?? v.birth_length_cm ?? null,
    },
    {
      key: "z_pbu",
      label: "Z-Score PB/U (Stunting)",
      unit: "SD",
      pick: (v) => v.z_score_pbu ?? null,
      threshold: -2.0,
      thresholdLabel: "Batas Stunting (-2 SD)",
    },
  ],
  MOTHER: [
    {
      key: "lila",
      label: "LiLA (cm)",
      unit: "cm",
      pick: (v) => v.lila_cm ?? null,
      threshold: 23.5,
      thresholdLabel: "Batas KEK (23,5 cm)",
    },
    {
      key: "hb",
      label: "Hemoglobin (g/dL)",
      unit: "g/dL",
      pick: (v) => v.hb_level ?? null,
      threshold: 11.0,
      thresholdLabel: "Batas Anemia (11 g/dL)",
    },
    {
      key: "maternal_weight",
      label: "Berat Badan Ibu (kg)",
      unit: "kg",
      pick: (v) => v.maternal_weight_kg ?? null,
    },
  ],
};

const DataPasien = () => {
  const [patients, setPatients] = useState([]);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [selectedLongitudinal, setSelectedLongitudinal] = useState(null);
  const [selectedRevisionVisit, setSelectedRevisionVisit] = useState(null);
  const [chartMetricKey, setChartMetricKey] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const modalRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => { fetchPatients(); }, [filterType]);

  const fetchPatients = async () => {
    try {
      setLoading(true); setError("");
      const params = {};
      if (filterType) params.patient_type = filterType;
      const res = await api.get("/patients/", { params });
      setPatients(res.data);
    } catch (e) {
      setError("Gagal memuat data pasien. Silakan coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  const handleViewLongitudinal = async (patientId) => {
    try {
      const res = await api.get(`/patients/${patientId}/longitudinal`);
      setSelectedLongitudinal(res.data);
      setChartMetricKey(null);
    } catch (e) {
      setError("Gagal mengambil data riwayat longitudinal.");
    }
  };

  useEffect(() => {
    const handleEscape = (e) => { if (e.key === "Escape" && selectedLongitudinal) setSelectedLongitudinal(null); };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [selectedLongitudinal]);

  useEffect(() => {
    if (selectedLongitudinal && modalRef.current) modalRef.current.focus();
  }, [selectedLongitudinal]);

  const filtered = patients.filter(
    (p) => p.name.toLowerCase().includes(search.toLowerCase()) || p.nik.includes(search),
  );

  const filterButtons = [
    { value: "", label: "Semua", activeClass: "bg-sky-600 text-white border-sky-600" },
    { value: "MOTHER", label: "Ibu Hamil", activeClass: "bg-pink-600 text-white border-pink-600" },
    { value: "CHILD", label: "Anak / Baduta (1-24 Bln)", activeClass: "bg-blue-600 text-white border-blue-600" },
  ];

  // Data untuk grafik di dalam modal longitudinal
  const modalPatientType = selectedLongitudinal?.patient?.patient_type || "CHILD";
  const modalVisits = selectedLongitudinal?.visits || selectedLongitudinal?.child_visits || [];
  const metricList = METRIC_OPTIONS[modalPatientType] || METRIC_OPTIONS.CHILD;
  const activeMetric = metricList.find((m) => m.key === chartMetricKey) || metricList[0];

  const modalChartData = useMemo(() => {
    return modalVisits
      .map((v) => ({
        date: v.visit_date,
        hpk: v.hpk_day ? `Hr ${v.hpk_day}` : v.visit_date,
        value: activeMetric.pick(v),
      }))
      .filter((d) => d.value !== null && d.value !== undefined);
  }, [modalVisits, activeMetric]);

  const renderVisitMetrics = (cv) => {
    if (cv.phase === "IBU_HAMIL") {
      return (
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-body mt-1">
          {cv.trimester && <span>Trimester <strong>{cv.trimester}</strong></span>}
          {cv.gestational_age_weeks && <span>Usia Hamil: <strong>{cv.gestational_age_weeks} mg</strong></span>}
          {cv.lila_cm !== null && cv.lila_cm !== undefined && (
            <span className={cv.lila_cm < 23.5 ? "text-rose-600 dark:text-rose-400 font-bold" : ""}>
              LiLA: <strong>{cv.lila_cm} cm</strong> {cv.lila_cm < 23.5 ? "(KEK)" : ""}
            </span>
          )}
          {cv.hb_level !== null && cv.hb_level !== undefined && (
            <span className={cv.hb_level < 11.0 ? "text-amber-600 dark:text-amber-400 font-bold" : ""}>
              Hb: <strong>{cv.hb_level} g/dL</strong>
            </span>
          )}
          {cv.maternal_weight_kg && <span>BB Ibu: <strong>{cv.maternal_weight_kg} kg</strong></span>}
          {cv.systolic_bp && cv.diastolic_bp && <span>TD: <strong>{cv.systolic_bp}/{cv.diastolic_bp}</strong></span>}
        </div>
      );
    }
    if (cv.phase === "BAYI_BARU_LAHIR") {
      return (
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-body mt-1">
          {cv.birth_weight_gram !== null && cv.birth_weight_gram !== undefined && (
            <span className={cv.birth_weight_gram < 2500 ? "text-rose-600 dark:text-rose-400 font-bold" : ""}>
              BB Lahir: <strong>{cv.birth_weight_gram} g</strong> {cv.birth_weight_gram < 2500 ? "(BBLR)" : ""}
            </span>
          )}
          {cv.birth_length_cm && <span>PB Lahir: <strong>{cv.birth_length_cm} cm</strong></span>}
          {cv.gestational_age_at_birth_weeks && <span>Gestasi: <strong>{cv.gestational_age_at_birth_weeks} mg</strong></span>}
          {cv.early_initiation_breastfeeding && <span>IMD: <strong>{cv.early_initiation_breastfeeding}</strong></span>}
        </div>
      );
    }
    return (
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-body mt-1">
        {cv.age_in_months !== null && cv.age_in_months !== undefined && <span>Usia: <strong>{cv.age_in_months} bln</strong></span>}
        {cv.child_weight_kg && <span>BB: <strong>{cv.child_weight_kg} kg</strong></span>}
        {cv.child_length_cm && <span>PB/TB: <strong>{cv.child_length_cm} cm</strong></span>}
        {cv.z_score_pbu !== null && cv.z_score_pbu !== undefined && (
          <span className={cv.z_score_pbu < -2.0 ? "text-rose-600 dark:text-rose-400 font-bold" : "text-emerald-700 dark:text-emerald-400"}>
            Z PB/U: <strong>{cv.z_score_pbu} SD</strong> ({cv.pbu_category || "-"})
          </span>
        )}
        {cv.weight_trend_kms && <span>KMS: <strong>{cv.weight_trend_kms}</strong></span>}
      </div>
    );
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-5 animate-fade-in">
      <div className="pb-3 border-b border-line-light">
        <h1 className="text-xl sm:text-2xl font-bold text-heading tracking-tight">Direktori & Monitoring Longitudinal 1.000 HPK</h1>
        <p className="text-xs sm:text-sm text-caption mt-1">Pelacakan rekam medis berkelanjutan ibu hamil, bayi baru lahir, dan baduta (1-24 bulan) di Posyandu</p>
      </div>

      {error && (
        <div role="alert" aria-live="polite" className="p-4 bg-accent-red border border-red-300 dark:border-red-800/50 rounded-xl text-sm text-red-700 dark:text-red-300 flex items-center justify-between gap-3 animate-slide-up">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-500 dark:text-red-400" aria-hidden="true" />
            <span>{error}</span>
          </div>
          <button onClick={fetchPatients} aria-label="Coba muat ulang data" className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 dark:bg-red-900/40 hover:bg-red-200 dark:hover:bg-red-900/60 text-red-700 dark:text-red-300 rounded-lg text-xs font-semibold transition-colors duration-200 flex-shrink-0">
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />Coba Lagi
          </button>
        </div>
      )}

      {/* Filter & Search */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1" role="search">
          <Search className="w-4 h-4 text-dim absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
          <input
            type="text"
            placeholder="Cari berdasarkan nama atau 16 digit NIK..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Cari pasien berdasarkan nama atau NIK"
            className="w-full pl-10 pr-4 h-10 bg-card border border-line rounded-xl text-sm text-heading placeholder:text-dim focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500 transition-all"
          />
        </div>
        <div className="flex gap-2 flex-wrap" role="group" aria-label="Filter tipe pasien">
          {filterButtons.map((btn) => (
            <button
              key={btn.value}
              onClick={() => setFilterType(btn.value)}
              aria-pressed={filterType === btn.value}
              className={`btn-interactive px-4 h-10 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 border cursor-pointer ${filterType === btn.value
                ? btn.activeClass
                : "bg-card border-line text-label hover:bg-muted hover:border-line"
                }`}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {!loading && (
        <p className="text-xs text-caption font-medium" aria-live="polite">
          Menampilkan {filtered.length} dari {patients.length} pasien
        </p>
      )}

      {/* Desktop Table */}
      <div className="hidden md:block bg-card rounded-2xl border border-line shadow-card overflow-hidden">
        {loading ? (
          <table className="w-full text-xs sm:text-sm text-left">
            <thead className="bg-muted text-caption border-b border-line text-xs font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3.5">Nama & NIK Pasien</th>
                <th className="px-4 py-3.5">Fase & Relasi Keluarga</th>
                <th className="px-4 py-3.5">Progres 1.000 HPK</th>
                <th className="px-4 py-3.5">Desa / Posyandu</th>
                <th className="px-4 py-3.5 text-center">Monitoring</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-light">{[...Array(5)].map((_, i) => <SkeletonRow key={i} />)}</tbody>
          </table>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <FileSearch className="w-12 h-12 text-dim mx-auto mb-3" aria-hidden="true" />
            <p className="text-sm font-semibold text-caption">{search ? "Tidak ada pasien yang cocok" : "Belum ada data pasien"}</p>
            <p className="text-xs text-dim mt-1">{search ? "Coba ubah kata kunci pencarian atau filter" : "Data pasien akan muncul setelah didaftarkan oleh kader"}</p>
          </div>
        ) : (
          <table className="w-full text-xs sm:text-sm text-left">
            <thead className="bg-muted text-caption border-b border-line text-xs font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3.5">Nama & NIK Pasien</th>
                <th className="px-4 py-3.5">Tipe & Relasi 1.000 HPK</th>
                <th className="px-4 py-3.5">Status Periode 1.000 HPK</th>
                <th className="px-4 py-3.5">Desa / Posyandu</th>
                <th className="px-4 py-3.5 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-light">
              {filtered.map((p) => {
                const hpk = p.hpk_status;
                return (
                  <tr key={p.id} className="table-row-interactive hover:bg-muted/50 transition-colors duration-150">
                    <td className="px-4 py-3.5">
                      <p className="font-semibold text-sm text-heading">{p.name}</p>
                      <p className="text-xs text-caption font-mono mt-0.5">NIK: {p.nik}</p>
                      <p className="text-xs text-dim mt-0.5">Tgl Lahir: {p.birth_date}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${p.patient_type === "MOTHER"
                        ? "bg-accent-pink text-pink-700 dark:text-pink-300 border-pink-200 dark:border-pink-800/50"
                        : "bg-accent-blue text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/50"
                        }`}>
                        {p.patient_type === "MOTHER" ? "Ibu Hamil" : `Anak (${p.gender || "-"})`}
                      </span>
                      {p.mother_name && (
                        <p className="text-xs text-pink-700 dark:text-pink-300 font-medium mt-1">
                          Ibu: {p.mother_name}
                        </p>
                      )}
                      {p.patient_type === "MOTHER" && p.children_count > 0 && (
                        <p className="text-xs text-sky-700 dark:text-sky-300 font-medium mt-1">
                          {p.children_count} Anak Terhubung
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      {hpk ? (
                        <div className="space-y-1 max-w-[220px]">
                          <div className="flex justify-between text-xs font-bold text-heading">
                            <span>Hari ke-{hpk.hpk_day} / 1.000</span>
                            <span className="text-sky-600 dark:text-sky-400">{hpk.progress_percent}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-sky-600 rounded-full"
                              style={{ width: `${Math.min(100, hpk.progress_percent || 0)}%` }}
                            />
                          </div>
                          <p className="text-xs text-caption">
                            {p.visits_count || 0}x kunjungan tercatat
                          </p>
                        </div>
                      ) : (
                        <span className="text-xs text-dim">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-body">
                      <p className="font-medium text-heading text-sm">{p.village_name || "Airmadidi"}</p>
                      {p.posyandu_name && <p className="text-xs text-caption mt-0.5">{p.posyandu_name}</p>}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <button
                        onClick={() => handleViewLongitudinal(p.id)}
                        aria-label={`Lihat riwayat longitudinal ${p.name}`}
                        className="btn-interactive inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-semibold text-xs transition-colors shadow-xs cursor-pointer"
                      >
                        <GitFork className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Monitoring 1.000 HPK</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {loading ? (
          [...Array(4)].map((_, i) => <SkeletonCard key={i} />)
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center bg-card rounded-2xl border border-line">
            <FileSearch className="w-10 h-10 text-dim mx-auto mb-3" aria-hidden="true" />
            <p className="text-sm font-semibold text-caption">{search ? "Tidak ada pasien yang cocok" : "Belum ada data pasien"}</p>
            <p className="text-xs text-dim mt-1 px-4">{search ? "Coba ubah kata kunci pencarian" : "Data pasien akan muncul setelah didaftarkan"}</p>
          </div>
        ) : (
          filtered.map((p) => (
            <div key={p.id} className="card-interactive p-4 bg-card rounded-xl border border-line shadow-card space-y-3 hover:border-sky-300 dark:hover:border-sky-700 transition-colors duration-200">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-bold text-heading text-base">{p.name}</p>
                  <p className="text-xs text-caption font-mono mt-0.5">NIK: {p.nik}</p>
                </div>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${p.patient_type === "MOTHER"
                  ? "bg-accent-pink text-pink-700 dark:text-pink-300 border-pink-200 dark:border-pink-800/50"
                  : "bg-accent-blue text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/50"
                  }`}>
                  {p.patient_type === "MOTHER" ? "Ibu Hamil" : `Anak (${p.gender || "-"})`}
                </span>
              </div>
              {p.hpk_status && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-bold text-heading">
                    <span>Hari ke-{p.hpk_status.hpk_day} / 1.000 HPK</span>
                    <span className="text-sky-600">{p.hpk_status.progress_percent}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-sky-600 rounded-full" style={{ width: `${Math.min(100, p.hpk_status.progress_percent || 0)}%` }} />
                  </div>
                </div>
              )}
              <div className="flex flex-wrap gap-3 text-xs text-caption">
                <span>Lahir: {p.birth_date}</span>
                <span>Desa: {p.village_name || "Airmadidi"}</span>
                {p.mother_name && <span className="text-pink-700 dark:text-pink-300 font-semibold">Ibu: {p.mother_name}</span>}
              </div>
              <button
                onClick={() => handleViewLongitudinal(p.id)}
                aria-label={`Lihat riwayat longitudinal ${p.name}`}
                className="btn-interactive w-full flex items-center justify-center gap-1.5 px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl font-semibold text-xs sm:text-sm transition-colors cursor-pointer"
              >
                <GitFork className="w-4 h-4" aria-hidden="true" />
                <span>Monitoring Longitudinal 1.000 HPK</span>
              </button>
            </div>
          ))
        )}
      </div>

      {/* ═══ MODAL MONITORING LONGITUDINAL 1.000 HPK ═══ */}
      {selectedLongitudinal && (
        <div
          className="fixed inset-0 flex items-center justify-center p-4 z-50 animate-fade-in"
          style={{ backgroundColor: "var(--c-overlay)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedLongitudinal(null); }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-longitudinal-title"
        >
          <div
            ref={modalRef}
            tabIndex={-1}
            className="bg-card rounded-2xl max-w-4xl w-full p-5 sm:p-6 shadow-prominent space-y-5 max-h-[90vh] overflow-y-auto animate-scale-in border border-line"
          >
            {/* Header Modal */}
            <div className="flex justify-between items-start border-b border-line-light pb-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 id="modal-longitudinal-title" className="text-lg font-bold text-heading">
                    Monitoring Longitudinal 1.000 HPK: {selectedLongitudinal.patient.name}
                  </h3>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${selectedLongitudinal.patient.patient_type === "MOTHER"
                    ? "bg-accent-pink text-pink-700 dark:text-pink-300 border-pink-200"
                    : "bg-accent-blue text-blue-700 dark:text-blue-300 border-blue-200"
                    }`}>
                    {selectedLongitudinal.patient.patient_type === "MOTHER" ? "Ibu Hamil" : `Anak (${selectedLongitudinal.patient.gender || "-"})`}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-caption font-mono mt-1">
                  NIK: {selectedLongitudinal.patient.nik} &bull; Tgl Lahir: {selectedLongitudinal.patient.birth_date} &bull; Desa: {selectedLongitudinal.patient.village_name || "Airmadidi"}
                </p>
              </div>
              <button
                onClick={() => setSelectedLongitudinal(null)}
                aria-label="Tutup modal riwayat longitudinal"
                className="p-1.5 text-dim hover:text-label hover:bg-muted rounded-xl transition-colors duration-200 cursor-pointer"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            {/* 1. Garis Waktu & Progress Bar 1.000 HPK */}
            {selectedLongitudinal.hpk_status && (
              <div className="p-4 bg-subtle rounded-xl border border-line space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <p className="text-xs sm:text-sm font-bold text-heading">
                      {selectedLongitudinal.hpk_status.summary_label}
                    </p>
                    <p className="text-xs text-sky-700 dark:text-sky-300 font-semibold mt-0.5">
                      {selectedLongitudinal.hpk_status.phase_label}
                    </p>
                  </div>
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-sky-600 text-white self-start sm:self-auto">
                    Hari ke-{selectedLongitudinal.hpk_status.hpk_day} / 1.000 HPK ({selectedLongitudinal.hpk_status.progress_percent}%)
                  </span>
                </div>
                <div className="w-full h-3 bg-muted rounded-full overflow-hidden border border-line">
                  <div
                    className="h-full bg-gradient-to-r from-pink-500 via-amber-500 to-sky-600 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, selectedLongitudinal.hpk_status.progress_percent || 0)}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-dim font-semibold">
                  <span>Fase 1: Kehamilan (Hari 1-270)</span>
                  <span>Fase 2: BBL 0-28 Hr (Hari 271-298)</span>
                  <span>Fase 3: Baduta 1-24 Bln (Hari 299-1.000)</span>
                </div>
                {selectedLongitudinal.hpk_status.target_milestone && (
                  <p className="text-xs text-body bg-card p-2.5 rounded-lg border border-line-light">
                    <strong className="text-heading">Standar Pemantauan Fase Ini:</strong> {selectedLongitudinal.hpk_status.target_milestone}
                  </p>
                )}
              </div>
            )}

            {/* 2. Kartu Rantai Lintas Fase (Ibu <-> Anak) */}
            {selectedLongitudinal.patient.patient_type === "CHILD" && (
              <div className="p-4 bg-accent-pink/60 border border-pink-200 dark:border-pink-800/50 rounded-xl space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <p className="font-bold text-xs sm:text-sm text-pink-900 dark:text-pink-200 flex items-center gap-1.5">
                    <HeartPulse className="w-4 h-4 text-pink-600" />
                    <span>Rantai Kontinuitas Lintas Fase (Riwayat Kehamilan Ibu & Kelahiran)</span>
                  </p>
                  {selectedLongitudinal.mother && (
                    <button
                      onClick={() => handleViewLongitudinal(selectedLongitudinal.mother.id)}
                      className="text-xs font-bold text-pink-700 dark:text-pink-300 hover:underline cursor-pointer self-start sm:self-auto"
                    >
                      Lihat Rekam ANC Ibu ({selectedLongitudinal.maternal_visits?.length || 0} Kunjungan) &rarr;
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                  <div className="p-2.5 bg-card rounded-lg border border-line">
                    <span className="text-xs text-caption block">Ibu Kandung</span>
                    <span className="font-bold text-heading">
                      {selectedLongitudinal.mother ? selectedLongitudinal.mother.name : "Belum ditautkan"}
                    </span>
                    {selectedLongitudinal.mother && (
                      <span className="block text-xs text-dim font-mono">NIK: {selectedLongitudinal.mother.nik}</span>
                    )}
                  </div>
                  <div className="p-2.5 bg-card rounded-lg border border-line">
                    <span className="text-xs text-caption block">Status KEK Saat Hamil</span>
                    <span className={`font-bold ${selectedLongitudinal.maternal_summary?.is_kek ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                      {selectedLongitudinal.maternal_summary?.is_kek
                        ? `Riwayat KEK (LiLA ${selectedLongitudinal.maternal_summary.min_maternal_lila_cm} cm)`
                        : "Normal (Bebas KEK)"}
                    </span>
                  </div>
                  <div className="p-2.5 bg-card rounded-lg border border-line">
                    <span className="text-xs text-caption block">Status Anemia & KSPR Ibu</span>
                    <span className={`font-bold ${selectedLongitudinal.maternal_summary?.is_anemia || selectedLongitudinal.maternal_summary?.is_high_risk_kspr ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                      {selectedLongitudinal.maternal_summary?.is_anemia
                        ? `Anemia (Hb ${selectedLongitudinal.maternal_summary.min_maternal_hb})`
                        : "Hb Normal"}{" "}
                      &bull; {selectedLongitudinal.maternal_summary?.kspr_category || "KRR"} ({selectedLongitudinal.maternal_summary?.max_kspr_score || 2})
                    </span>
                  </div>
                  <div className="p-2.5 bg-card rounded-lg border border-line">
                    <span className="text-xs text-caption block">Kelahiran (Fase 2 BBL)</span>
                    <span className={`font-bold ${selectedLongitudinal.maternal_summary?.birth_weight_gram && selectedLongitudinal.maternal_summary.birth_weight_gram < 2500 ? "text-rose-600 dark:text-rose-400" : "text-heading"}`}>
                      {selectedLongitudinal.maternal_summary?.birth_weight_gram
                        ? `${selectedLongitudinal.maternal_summary.birth_weight_gram} g ${selectedLongitudinal.maternal_summary.birth_weight_gram < 2500 ? "(BBLR)" : "(Normal)"}`
                        : "Belum tercatat"}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Jika pasien adalah Ibu Hamil dan memiliki Anak terhubung */}
            {selectedLongitudinal.patient.patient_type === "MOTHER" && selectedLongitudinal.children && selectedLongitudinal.children.length > 0 && (
              <div className="p-4 bg-accent-sky border border-sky-200 dark:border-sky-800/50 rounded-xl space-y-2">
                <p className="font-bold text-xs sm:text-sm text-sky-900 dark:text-sky-200 flex items-center gap-1.5">
                  <Baby className="w-4 h-4 text-sky-600" />
                  <span>Rantai Kelanjutan 1.000 HPK — Anak Kandung Terhubung ({selectedLongitudinal.children.length})</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {selectedLongitudinal.children.map((ch) => (
                    <button
                      key={ch.id}
                      onClick={() => handleViewLongitudinal(ch.id)}
                      className="inline-flex items-center gap-2 px-3 py-1.5 bg-card hover:bg-muted border border-line rounded-lg text-xs font-semibold text-heading transition-colors cursor-pointer"
                    >
                      <span>{ch.name} ({ch.gender || "-"})</span>
                      {ch.hpk_status && (
                        <span className="px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-900/50 text-sky-700 dark:text-sky-300 text-xs font-bold">
                          Hari ke-{ch.hpk_status.hpk_day} HPK
                        </span>
                      )}
                      <span className="text-sky-600">&rarr;</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 3. Grafik Tren Pertumbuhan / Klinis Antar Kunjungan */}
            <div className="p-4 bg-subtle rounded-xl border border-line space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-sky-600" />
                  <h4 className="text-xs sm:text-sm font-bold text-heading">
                    Kurva Pemantauan Perkembangan Pasien
                  </h4>
                </div>
                <div className="inline-flex rounded-lg border border-line bg-card p-0.5 flex-wrap" role="tablist">
                  {metricList.map((m) => (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => setChartMetricKey(m.key)}
                      className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${activeMetric.key === m.key ? "bg-sky-600 text-white" : "text-caption hover:text-heading"
                        }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="h-52 w-full bg-card rounded-xl border border-line p-3">
                {modalChartData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-caption text-center">
                    Belum ada data pengukuran {activeMetric.label} pada riwayat kunjungan pasien ini.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={modalChartData} margin={{ top: 8, right: 16, left: -12, bottom: 0 }}>
                      <CartesianGrid stroke="currentColor" strokeOpacity={0.1} vertical={false} />
                      <XAxis dataKey="date" tick={{ fill: "currentColor", fontSize: 11 }} tickLine={false} axisLine={false} />
                      <YAxis domain={["auto", "auto"]} tick={{ fill: "currentColor", fontSize: 11 }} tickLine={false} axisLine={false} />
                      <Tooltip
                        formatter={(v) => [`${v} ${activeMetric.unit}`, activeMetric.label]}
                        contentStyle={{ fontSize: 11, borderRadius: 8 }}
                      />
                      {activeMetric.threshold !== undefined && (
                        <ReferenceLine
                          y={activeMetric.threshold}
                          stroke="#e11d48"
                          strokeDasharray="4 4"
                          label={{ value: activeMetric.thresholdLabel, fill: "#e11d48", fontSize: 10, position: "insideTopRight" }}
                        />
                      )}
                      <Line
                        type="monotone"
                        dataKey="value"
                        name={activeMetric.label}
                        stroke="#0284c7"
                        strokeWidth={2.5}
                        dot={{ r: 4, fill: "#0284c7" }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* 4. Daftar Kronologis Kunjungan Pasien */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-heading">
                  Rekam Kunjungan Kronologis ({modalVisits.length} Kunjungan)
                </h4>
              </div>

              {modalVisits.length === 0 ? (
                <div className="text-center py-8 bg-subtle rounded-xl border border-line">
                  <FileSearch className="w-8 h-8 text-dim mx-auto mb-2" aria-hidden="true" />
                  <p className="text-sm text-caption">Belum ada catatan kunjungan.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {modalVisits.map((cv, i) => {
                    const phaseInfo = PHASE_BADGE[cv.phase] || { label: cv.phase, cls: "bg-muted text-heading border-line" };
                    return (
                      <div
                        key={cv.id || i}
                        className="p-3.5 bg-subtle border border-line rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/70 transition-colors duration-150"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${phaseInfo.cls}`}>
                              {phaseInfo.label}
                            </span>
                            <span className="font-bold text-sm text-heading">{cv.visit_date}</span>
                            {cv.hpk_day && (
                              <span className="px-2 py-0.5 rounded-md bg-card border border-line text-xs font-semibold text-sky-700 dark:text-sky-300">
                                Hari ke-{cv.hpk_day} HPK
                              </span>
                            )}
                            {cv.overall_status && (
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${cv.overall_status === "RISIKO_TINGGI"
                                ? "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                                : cv.overall_status === "PERLU_PERHATIAN"
                                  ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                                  : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                                }`}>
                                {cv.overall_status.replace(/_/g, " ")}
                              </span>
                            )}
                          </div>
                          {renderVisitMetrics(cv)}
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                          <button
                            onClick={() => {
                              setSelectedLongitudinal(null);
                              navigate(`/kader/validasi-laporan/${cv.id}`);
                            }}
                            className="btn-interactive inline-flex items-center gap-1.5 px-3 py-1.5 bg-card hover:bg-muted text-sky-700 dark:text-sky-300 rounded-lg text-xs font-semibold border border-line transition-colors cursor-pointer"
                            title="Buka lembar laporan KIA kunjungan ini"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>Laporan</span>
                          </button>
                          <button
                            onClick={() =>
                              setSelectedRevisionVisit({
                                visitId: cv.id,
                                name: selectedLongitudinal.patient.name,
                                nik: selectedLongitudinal.patient.nik,
                                phase: cv.phase,
                              })
                            }
                            className="btn-interactive inline-flex items-center gap-1.5 px-3 py-1.5 bg-muted hover:bg-card text-heading rounded-lg text-xs font-semibold border border-line transition-colors cursor-pointer"
                            title="Ajukan perbaikan data kunjungan ini"
                          >
                            <FileEdit className="w-3.5 h-3.5 text-caption" />
                            <span>Revisi</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Revision Request Modal */}
      {selectedRevisionVisit && (
        <RevisionRequestModal
          isOpen={Boolean(selectedRevisionVisit)}
          visitId={selectedRevisionVisit.visitId}
          patientInfo={selectedRevisionVisit}
          onClose={() => setSelectedRevisionVisit(null)}
          onSuccess={() => {
            if (selectedLongitudinal) {
              handleViewLongitudinal(selectedLongitudinal.patient.id);
            }
          }}
        />
      )}
    </div>
  );
};

export default DataPasien;
