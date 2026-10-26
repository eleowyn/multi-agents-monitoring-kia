import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api, { getErrorMessage, downloadReportPdf } from "../../services/api";
import {
  CheckCircle2,
  XCircle,
  Download,
  AlertTriangle,
  BookOpen,
  ArrowLeft,
  FileText,
  ShieldCheck,
  Info,
  X,
  FileSearch,
  Activity,
  Heart,
  User,
  Calendar,
  MapPin,
  Printer,
  Sparkles,
  ClipboardList,
} from "lucide-react";

/* ─── Skeleton Loaders ─── */
const SkeletonBlock = ({ className = "" }) => (
  <div className={`skeleton ${className}`} />
);

const ReportSkeleton = () => (
  <div className="bg-card rounded-2xl border border-line shadow-card overflow-hidden animate-fade-in">
    <div className="p-6 border-b border-line bg-subtle">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="space-y-2">
          <SkeletonBlock className="w-64 h-6 rounded-lg" />
          <SkeletonBlock className="w-48 h-4 rounded-lg" />
        </div>
        <div className="flex gap-2">
          <SkeletonBlock className="w-36 h-8 rounded-xl" />
          <SkeletonBlock className="w-32 h-8 rounded-xl" />
        </div>
      </div>
    </div>
    <div className="p-6 space-y-6">
      <SkeletonBlock className="w-full h-24 rounded-xl" />
      <div className="space-y-3">
        <SkeletonBlock className="w-56 h-5 rounded-lg" />
        <SkeletonBlock className="w-full h-16 rounded-xl" />
      </div>
      <div className="space-y-3">
        <SkeletonBlock className="w-56 h-5 rounded-lg" />
        <SkeletonBlock className="w-full h-32 rounded-xl" />
        <SkeletonBlock className="w-full h-32 rounded-xl" />
      </div>
    </div>
  </div>
);

const humanPhase = (phase) => {
  const map = {
    IBU_HAMIL: "Ibu Hamil",
    BAYI_BARU_LAHIR: "Bayi Baru Lahir (0 - 28 Hari)",
    BADUTA: "Baduta (6 - 24 Bulan)",
  };
  return map[phase] || (phase ? phase.replace(/_/g, " ") : "KIA");
};

const humanRisk = (flag) => {
  const map = {
    RISIKO_KEHAMILAN_SANGAT_TINGGI_KRST: "Kehamilan Risiko Sangat Tinggi (KRST)",
    RISIKO_KEHAMILAN_TINGGI_KRT: "Kehamilan Risiko Tinggi (KRT)",
    KEHAMILAN_RISIKO_RENDAH_KRR: "Kehamilan Risiko Rendah (KRR)",
    STUNTING_SEVERELY_STUNTED: "Sangat Pendek / Severely Stunted",
    STUNTING_STUNTED: "Pendek / Stunted",
    GIZI_BURUK_SEVERELY_UNDERWEIGHT: "BB Sangat Kurang",
    GIZI_KURANG_UNDERWEIGHT: "BB Kurang / Underweight",
    WASTING_SEVERELY_WASTED: "Gizi Buruk / Severely Wasted",
    WASTING_WASTED: "Gizi Kurang / Wasted",
    ANEMIA_BERAT: "Anemia Berat (Hb < 8.0 g/dL)",
    ANEMIA_SEDANG: "Anemia Sedang (Hb 8.0 - 9.9 g/dL)",
    ANEMIA_RINGAN: "Anemia Ringan (Hb 10.0 - 10.9 g/dL)",
    RISIKO_KEK: "Kurang Energi Kronis / KEK (LiLA < 23.5 cm)",
    BBLR: "Berat Bayi Lahir Rendah (< 2.500 g)",
    BBLSR: "Berat Bayi Lahir Sangat Rendah (< 1.500 g)",
    PREMATUR: "Kelahiran Prematur (< 37 Minggu)",
    BB_TIDAK_NAIK_KMS: "Berat Badan Tidak Naik (KMS)",
    MIKROSEFALI: "Mikrosefali (< -2 SD Lingkar Kepala)",
    MAKROSEFALI: "Makrosefali (> +2 SD Lingkar Kepala)",
  };
  return map[flag] || (flag ? flag.replace(/_/g, " ") : "-");
};

const cleanCitation = (source) => {
  if (!source) return "Buku KIA Kemenkes RI";
  const s = String(source);
  if (s.includes("Buku_KIA") || s.toLowerCase().includes("buku_kia")) {
    return "Buku KIA 2024 (Kemenkes RI)";
  }
  if (s.includes("Stunting") || s.toLowerCase().includes("stunting")) {
    return "Pedoman Tata Laksana Gizi Buruk & Stunting Kemenkes RI";
  }
  if (s.includes("Posyandu") || s.toLowerCase().includes("posyandu")) {
    return "Petunjuk Teknis Posyandu Integrasi Layanan Primer (ILP)";
  }
  return s.replace(/\.pdf$/i, "").replace(/[_\(\)]/g, " ").trim();
};

const ValidasiLaporan = () => {
  const { reportId } = useParams();
  const { user } = useAuth();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const rejectModalRef = useRef(null);

  useEffect(() => {
    fetchReport();
  }, [reportId]);

  const fetchReport = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await api.get(`/reports/${reportId}`);
      setReport(res.data);
    } catch (err) {
      console.error(err);
      setError("Gagal memuat detail laporan hasil analisis AI.");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (
      !window.confirm(
        "Apakah Anda yakin ingin menyetujui dan mengesahkan laporan KIA ini?\n\nDokumen resmi PDF/A4 dengan Kop Dinas Puskesmas Airmadidi akan diterbitkan.",
      )
    )
      return;

    setActionLoading(true);
    try {
      const res = await api.post(`/reports/${reportId}/validate`, {
        status: "APPROVED",
      });
      setReport(res.data);
      alert("Laporan berhasil disetujui! Dokumen resmi PDF telah diterbitkan dan tersimpan di server.");
    } catch (err) {
      alert(getErrorMessage(err, "Gagal menyetujui laporan."));
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (e) => {
    e.preventDefault();
    if (!rejectionReason.trim()) {
      alert("Tuliskan catatan perbaikan atau alasan penolakan.");
      return;
    }

    setActionLoading(true);
    try {
      const res = await api.post(`/reports/${reportId}/validate`, {
        status: "REJECTED",
        rejection_reason: rejectionReason,
      });
      setReport(res.data);
      setShowRejectModal(false);
      setRejectionReason("");
      alert(
        "Sistem Multi-Agent telah merevisi laporan berdasarkan catatan Anda (Batas revisi 1x telah digunakan)!",
      );
    } catch (err) {
      alert(getErrorMessage(err, "Gagal memproses penolakan revisi."));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!report) return;
    await downloadReportPdf(
      report.id || reportId,
      report.final_report_json?.metadata?.patient_name || report.patient?.name,
      report.visit_data?.visit_date || report.visit?.visit_date
    );
  };

  // Modal Escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape" && showRejectModal) {
        setShowRejectModal(false);
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [showRejectModal]);

  // Focus modal on open
  useEffect(() => {
    if (showRejectModal && rejectModalRef.current) {
      rejectModalRef.current.focus();
    }
  }, [showRejectModal]);

  /* ─── Loading State ─── */
  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-2">
          <SkeletonBlock className="w-48 h-5 rounded-lg" />
        </div>
        <ReportSkeleton />
      </div>
    );
  }

  /* ─── Error State ─── */
  if (error && !report) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
        <div className="text-center py-20 animate-fade-in bg-card border border-line rounded-2xl shadow-card p-6">
          <FileSearch
            className="w-16 h-16 text-dim mx-auto mb-4"
            aria-hidden="true"
          />
          <h2 className="text-lg font-bold text-heading mb-2">
            Laporan Tidak Dapat Dimuat
          </h2>
          <p className="text-sm text-caption mb-6">{error}</p>
          <div className="flex justify-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="px-5 py-2.5 border border-line rounded-xl text-sm font-medium text-label hover:bg-muted transition-all duration-200 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 inline mr-1.5" aria-hidden="true" />
              Kembali
            </button>
            <button
              onClick={fetchReport}
              className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-sm font-semibold shadow-sm transition-all duration-200 cursor-pointer"
            >
              Coba Lagi
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ─── Not Found State ─── */
  if (!report) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
        <div className="text-center py-20 animate-fade-in bg-card border border-line rounded-2xl shadow-card p-6">
          <FileSearch
            className="w-16 h-16 text-dim mx-auto mb-4"
            aria-hidden="true"
          />
          <h2 className="text-lg font-bold text-heading mb-2">
            Laporan Tidak Ditemukan
          </h2>
          <p className="text-sm text-caption mb-6">
            Laporan dengan ID #{reportId} tidak tersedia atau telah dihapus.
          </p>
          <button
            onClick={() => navigate(-1)}
            className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-sm font-semibold shadow-sm transition-all duration-200 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 inline mr-1.5" aria-hidden="true" />
            Kembali
          </button>
        </div>
      </div>
    );
  }

  const finalJson = report.final_report_json || {};
  const meta = finalJson.metadata || {};
  const clinical = finalJson.clinical_findings || {};
  const recommendations = finalJson.recommendations || [];
  const verifications = finalJson.verification_summary || [];
  const revisionCount = report.revision_count || 0;
  const visitData = report.visit_data || {};

  const statusConfig = {
    KONDISI_BAIK: {
      label: "Kondisi Baik / Normal",
      className: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800",
      dot: "bg-emerald-500",
    },
    PERLU_PERHATIAN: {
      label: "Perlu Perhatian / Intervensi",
      className: "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border-amber-300 dark:border-amber-800",
      dot: "bg-amber-500",
    },
    RISIKO_TINGGI: {
      label: "Risiko Tinggi / Rujuk Segera",
      className: "bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 border-rose-300 dark:border-rose-800",
      dot: "bg-rose-500",
    },
  };

  const currentStatus = statusConfig[report.overall_status] || statusConfig.KONDISI_BAIK;
  const isAdmin = user?.role === "ADMIN";

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6 animate-fade-in">
      {/* Top Navigation Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-line-light">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-heading tracking-tight">
              Rincian Lembar Pemantauan KIA
            </h1>
            {isAdmin && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300 border border-sky-300 dark:border-sky-800">
                Mode Tinjau Admin
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-caption mt-1">
            Laporan klinis komprehensif terintegrasi Multi-Agent AI &bull; Posyandu Puskesmas Airmadidi
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => navigate(-1)}
            aria-label="Kembali ke halaman sebelumnya"
            className="btn-interactive flex items-center gap-1.5 px-3.5 py-2 border border-line bg-card hover:bg-muted text-label hover:text-heading rounded-xl text-xs font-semibold transition-colors duration-200 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            Kembali
          </button>

          {report.status === "APPROVED" && (
            <button
              onClick={handleDownloadPdf}
              aria-label="Unduh Dokumen Cetak / PDF Resmi"
              className="btn-interactive flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Cetak / Unduh PDF</span>
            </button>
          )}
        </div>
      </div>

      {/* Patient Profile & Visit Meta Card */}
      <div className="bg-card rounded-2xl border border-line shadow-card overflow-hidden">
        <div className="p-5 sm:p-6 bg-subtle border-b border-line flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 flex items-center justify-center font-bold text-lg border border-sky-200 dark:border-sky-800/60 shadow-xs">
              <User className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-heading">
                  {meta.patient_name || "Pasien KIA"}
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-accent-sky text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-800/60">
                  {humanPhase(meta.phase || visitData.phase)}
                </span>
              </div>
              <p className="text-xs text-caption mt-0.5 flex items-center gap-2 font-mono">
                <span>NIK: {meta.patient_nik || "-"}</span>
                <span>&bull;</span>
                <span className="flex items-center gap-1 font-sans">
                  <MapPin className="w-3 h-3 text-dim" />
                  {meta.village_name || "Airmadidi"}
                </span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border shadow-xs ${currentStatus.className}`}
            >
              <span className={`w-2 h-2 rounded-full ${currentStatus.dot} animate-pulse`} />
              {currentStatus.label}
            </span>

            <span
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border ${
                report.status === "APPROVED"
                  ? "bg-emerald-600 text-white border-emerald-700"
                  : report.status === "REJECTED"
                  ? "bg-rose-600 text-white border-rose-700"
                  : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200 border-amber-300 dark:border-amber-800"
              }`}
            >
              {report.status === "APPROVED"
                ? "✓ Disahkan"
                : report.status === "REJECTED"
                ? "Ditolak / Perlu Revisi"
                : "⏳ Menunggu Validasi"}
            </span>
          </div>
        </div>

        {/* Visit Details Grid */}
        <div className="p-5 sm:p-6 grid grid-cols-2 sm:grid-cols-4 gap-4 border-b border-line bg-card">
          <div>
            <p className="text-[11px] text-caption uppercase tracking-wider font-semibold">Tanggal Kunjungan</p>
            <p className="text-sm font-bold text-heading mt-0.5 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-sky-600" />
              <span>{visitData.visit_date || "-"}</span>
            </p>
          </div>
          <div>
            <p className="text-[11px] text-caption uppercase tracking-wider font-semibold">ID Laporan / Kunjungan</p>
            <p className="text-sm font-bold text-heading mt-0.5 font-mono">
              #{report.id} <span className="text-xs text-caption font-normal">(Visit #{report.visit_id})</span>
            </p>
          </div>
          <div>
            <p className="text-[11px] text-caption uppercase tracking-wider font-semibold">Toleransi Revisi AI</p>
            <p className="text-sm font-bold text-heading mt-0.5">
              {revisionCount} / 1 kali revisi
            </p>
          </div>
          <div>
            <p className="text-[11px] text-caption uppercase tracking-wider font-semibold">Dokumen Cetak PDF</p>
            <p className="text-sm font-bold mt-0.5">
              {report.status === "APPROVED" ? (
                <button
                  onClick={handleDownloadPdf}
                  className="text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer font-bold"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Tersedia (Unduh)</span>
                </button>
              ) : (
                <span className="text-dim font-normal italic">Terbit setelah disahkan</span>
              )}
            </p>
          </div>
        </div>

        {/* ─── Parameter Pengukuran Antropometri & Fisik Kunjungan ─── */}
        {visitData.phase && (
          <div className="p-5 sm:p-6 border-b border-line bg-subtle/50 space-y-3">
            <h3 className="text-xs font-bold text-heading uppercase tracking-wider flex items-center gap-2 text-sky-800 dark:text-sky-300">
              <Activity className="w-4 h-4 text-sky-600" />
              Data Pengukuran Fisik & Antropometri Kunjungan
            </h3>

            {visitData.phase === "IBU_HAMIL" && (
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                <div className="p-3 bg-card border border-line rounded-xl">
                  <p className="text-[11px] text-caption font-medium">Usia Kehamilan</p>
                  <p className="text-base font-bold text-heading mt-0.5">
                    {visitData.gestational_age_weeks || "-"} <span className="text-xs font-normal">mg</span>
                  </p>
                  <p className="text-[10px] text-dim">Trimester {visitData.trimester || "-"}</p>
                </div>
                <div className="p-3 bg-card border border-line rounded-xl">
                  <p className="text-[11px] text-caption font-medium">Berat Badan Ibu</p>
                  <p className="text-base font-bold text-heading mt-0.5">
                    {visitData.maternal_weight_kg || "-"} <span className="text-xs font-normal">kg</span>
                  </p>
                  <p className="text-[10px] text-dim">TB: {visitData.maternal_height_cm || "-"} cm</p>
                </div>
                <div className="p-3 bg-card border border-line rounded-xl">
                  <p className="text-[11px] text-caption font-medium">Lingkar LiLA</p>
                  <p className={`text-base font-bold mt-0.5 ${visitData.lila_cm && visitData.lila_cm < 23.5 ? "text-rose-600" : "text-heading"}`}>
                    {visitData.lila_cm || "-"} <span className="text-xs font-normal">cm</span>
                  </p>
                  <p className="text-[10px] text-dim">Cutoff KEK: 23.5 cm</p>
                </div>
                <div className="p-3 bg-card border border-line rounded-xl">
                  <p className="text-[11px] text-caption font-medium">Kadar Hemoglobin</p>
                  <p className={`text-base font-bold mt-0.5 ${visitData.hb_level && visitData.hb_level < 11.0 ? "text-rose-600" : "text-heading"}`}>
                    {visitData.hb_level || "-"} <span className="text-xs font-normal">g/dL</span>
                  </p>
                  <p className="text-[10px] text-dim">Cutoff Anemia: 11.0</p>
                </div>
                <div className="p-3 bg-card border border-line rounded-xl">
                  <p className="text-[11px] text-caption font-medium">Tekanan Darah</p>
                  <p className="text-base font-bold text-heading mt-0.5">
                    {visitData.systolic_bp || "-"}/{visitData.diastolic_bp || "-"}
                  </p>
                  <p className="text-[10px] text-dim">mmHg</p>
                </div>
                <div className="p-3 bg-card border border-line rounded-xl">
                  <p className="text-[11px] text-caption font-medium">Tinggi Fundus (TFU)</p>
                  <p className="text-base font-bold text-heading mt-0.5">
                    {visitData.fundal_height_cm || "-"} <span className="text-xs font-normal">cm</span>
                  </p>
                  <p className="text-[10px] text-dim">Skor KSPR: {Array.isArray(visitData.kspr_answers) ? visitData.kspr_answers.length * 4 + 2 : "-"}</p>
                </div>
              </div>
            )}

            {visitData.phase === "BAYI_BARU_LAHIR" && (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="p-3 bg-card border border-line rounded-xl">
                  <p className="text-[11px] text-caption font-medium">Berat Lahir</p>
                  <p className={`text-base font-bold mt-0.5 ${visitData.birth_weight_gram && visitData.birth_weight_gram < 2500 ? "text-rose-600" : "text-heading"}`}>
                    {visitData.birth_weight_gram || "-"} <span className="text-xs font-normal">gram</span>
                  </p>
                  <p className="text-[10px] text-dim">Cutoff BBLR: 2500g</p>
                </div>
                <div className="p-3 bg-card border border-line rounded-xl">
                  <p className="text-[11px] text-caption font-medium">Panjang Lahir</p>
                  <p className="text-base font-bold text-heading mt-0.5">
                    {visitData.birth_length_cm || "-"} <span className="text-xs font-normal">cm</span>
                  </p>
                  <p className="text-[10px] text-dim">Standar normal</p>
                </div>
                <div className="p-3 bg-card border border-line rounded-xl">
                  <p className="text-[11px] text-caption font-medium">Lingkar Kepala</p>
                  <p className="text-base font-bold text-heading mt-0.5">
                    {visitData.head_circumference_cm || "-"} <span className="text-xs font-normal">cm</span>
                  </p>
                  <p className="text-[10px] text-dim">Rentang 33-35 cm</p>
                </div>
                <div className="p-3 bg-card border border-line rounded-xl">
                  <p className="text-[11px] text-caption font-medium">Usia Gestasi Lahir</p>
                  <p className="text-base font-bold text-heading mt-0.5">
                    {visitData.gestational_age_at_birth_weeks || "-"} <span className="text-xs font-normal">mg</span>
                  </p>
                  <p className="text-[10px] text-dim">{visitData.gestational_age_at_birth_weeks && visitData.gestational_age_at_birth_weeks < 37 ? "Prematur" : "Cukup Bulan"}</p>
                </div>
                <div className="p-3 bg-card border border-line rounded-xl">
                  <p className="text-[11px] text-caption font-medium">Inisiasi Menyusu (IMD)</p>
                  <p className="text-base font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {visitData.early_initiation_breastfeeding || "-"}
                  </p>
                  <p className="text-[10px] text-dim">Standar Kemenkes</p>
                </div>
              </div>
            )}

            {visitData.phase === "BADUTA" && (
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                <div className="p-3 bg-card border border-line rounded-xl">
                  <p className="text-[11px] text-caption font-medium">Usia Anak</p>
                  <p className="text-base font-bold text-heading mt-0.5">
                    {visitData.age_in_months || "-"} <span className="text-xs font-normal">bulan</span>
                  </p>
                  <p className="text-[10px] text-dim">Fase Baduta 1000 HPK</p>
                </div>
                <div className="p-3 bg-card border border-line rounded-xl">
                  <p className="text-[11px] text-caption font-medium">Berat Badan Anak</p>
                  <p className="text-base font-bold text-heading mt-0.5">
                    {visitData.child_weight_kg || "-"} <span className="text-xs font-normal">kg</span>
                  </p>
                  <p className="text-[10px] text-dim">WHO Anthro BB/U</p>
                </div>
                <div className="p-3 bg-card border border-line rounded-xl">
                  <p className="text-[11px] text-caption font-medium">Panjang/Tinggi</p>
                  <p className="text-base font-bold text-heading mt-0.5">
                    {visitData.child_length_cm || "-"} <span className="text-xs font-normal">cm</span>
                  </p>
                  <p className="text-[10px] text-dim">WHO Anthro PB/U</p>
                </div>
                <div className="p-3 bg-card border border-line rounded-xl">
                  <p className="text-[11px] text-caption font-medium">Lingkar Kepala</p>
                  <p className="text-base font-bold text-heading mt-0.5">
                    {visitData.child_head_circumference_cm || "-"} <span className="text-xs font-normal">cm</span>
                  </p>
                  <p className="text-[10px] text-dim">Nellhaus / WHO</p>
                </div>
                <div className="p-3 bg-card border border-line rounded-xl">
                  <p className="text-[11px] text-caption font-medium">Tren Berat (KMS)</p>
                  <p className={`text-base font-bold mt-0.5 ${visitData.weight_trend_kms === "TIDAK_NAIK" ? "text-rose-600" : "text-emerald-600"}`}>
                    {visitData.weight_trend_kms || "-"}
                  </p>
                  <p className="text-[10px] text-dim">Kartu Menuju Sehat</p>
                </div>
                <div className="p-3 bg-card border border-line rounded-xl">
                  <p className="text-[11px] text-caption font-medium">Kapsul Vitamin A</p>
                  <p className="text-base font-bold text-heading mt-0.5">
                    {visitData.vitamin_a || "-"}
                  </p>
                  <p className="text-[10px] text-dim">{visitData.immunization_status || "Imunisasi Terkini"}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── Body Sections: AI Multi-Agent Results ─── */}
        <div className="p-5 sm:p-6 space-y-6">
          {/* Executive Summary Callout */}
          <div className="p-4 bg-accent-sky border border-sky-200 dark:border-sky-800/50 rounded-xl space-y-2">
            <p className="font-bold text-sm text-sky-800 dark:text-sky-300 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-sky-600 dark:text-sky-400" aria-hidden="true" />
              Ringkasan Eksekutif Analisis Sistem
            </p>
            <p className="text-sm text-sky-950 dark:text-sky-100 leading-relaxed text-justify">
              {finalJson.executive_summary}
            </p>
          </div>

          {/* Section I: Clinical Findings & Risk Flags */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-heading border-l-4 border-sky-500 pl-3 flex items-center gap-2">
              <span>I. Temuan Pengukuran Deterministik (Agent 1)</span>
            </h3>

            <p className="text-sm text-body bg-subtle p-4 rounded-xl border border-line leading-relaxed text-justify">
              {clinical.risk_narrative || "Tidak ada catatan deviasi antropometri."}
            </p>

            {clinical.active_risk_flags && clinical.active_risk_flags.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {clinical.active_risk_flags.map((flag, i) => (
                  <div
                    key={i}
                    className="p-4 bg-accent-amber border border-amber-300 dark:border-amber-800/50 rounded-xl space-y-2"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <span className="font-bold text-sm text-amber-950 dark:text-amber-100">
                        {flag.indicator}
                      </span>
                      <span className="text-[11px] bg-amber-200 dark:bg-amber-900/60 px-2.5 py-0.5 rounded-full text-amber-950 dark:text-amber-200 font-bold shrink-0">
                        {humanRisk(flag.flag)}
                      </span>
                    </div>
                    <p className="text-xs text-amber-900 dark:text-amber-300 leading-relaxed text-justify">
                      {flag.detail}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 rounded-xl flex items-center gap-2.5 text-xs text-emerald-800 dark:text-emerald-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Seluruh parameter fisik berada dalam rentang normal / standar rujukan nasional.</span>
              </div>
            )}
          </div>

          {/* Section II: Recommendations (Agent 2) */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-heading border-l-4 border-sky-500 pl-3 flex items-center gap-2">
              <span>II. Rekomendasi Klinis & Tindakan Kader (Agent 2 — RAG ChromaDB)</span>
            </h3>

            {recommendations.length === 0 ? (
              <div className="text-center py-8 bg-subtle rounded-xl border border-line">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <p className="text-sm text-caption">
                  Tidak ada intervensi khusus. Pasien dianjurkan tetap hadir rutin pada jadwal Posyandu berikutnya.
                </p>
              </div>
            ) : (
              <div className="space-y-3.5">
                {recommendations.map((rec, idx) => (
                  <div
                    key={idx}
                    className="p-4 sm:p-5 bg-card border border-line rounded-xl space-y-3 shadow-card hover:border-sky-400 dark:hover:border-sky-600 transition-colors"
                  >
                    <div className="flex justify-between items-start gap-3">
                      <p className="font-bold text-sm text-sky-800 dark:text-sky-300 flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-sky-100 dark:bg-sky-900/60 text-sky-700 dark:text-sky-300 flex items-center justify-center text-xs font-bold shrink-0">
                          {idx + 1}
                        </span>
                        <span>{rec.title}</span>
                      </p>
                      <span className="text-[11px] bg-accent-sky text-sky-800 dark:text-sky-300 px-2.5 py-0.5 rounded-full font-bold border border-sky-200 dark:border-sky-800/50 shrink-0 uppercase">
                        {rec.category}
                      </span>
                    </div>

                    <p className="text-xs sm:text-sm text-body leading-relaxed text-justify">
                      {rec.recommendation_text}
                    </p>

                    {rec.action_steps && rec.action_steps.length > 0 && (
                      <div className="pt-2 border-t border-line-light space-y-1.5">
                        <p className="text-xs font-semibold text-label">Langkah Tindakan Kader Posyandu:</p>
                        <ul className="text-xs text-caption space-y-1 pl-4 list-disc">
                          {rec.action_steps.map((step, sIdx) => (
                            <li key={sIdx} className="leading-relaxed">{step}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {rec.citation && (
                      <div className="pt-2 border-t border-line flex items-center gap-2 text-xs text-dim">
                        <BookOpen className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                        <span>
                          Rujukan: <strong className="text-caption">{cleanCitation(rec.citation.source)}</strong> &bull; {rec.citation.section} (Hal. {rec.citation.page})
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section III: Verifications (Agent 3) */}
          {verifications.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-heading border-l-4 border-emerald-500 pl-3 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>III. Verifikasi Grounding Sitasi (Agent 3 — ReAct)</span>
              </h3>

              <div className="border border-line rounded-xl overflow-hidden shadow-card">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted text-caption font-bold border-b border-line uppercase tracking-wider">
                    <tr>
                      <th className="p-3 w-10 text-center">No</th>
                      <th className="p-3 w-1/3">Poin Rekomendasi</th>
                      <th className="p-3 w-1/4">Dokumen Sitasi</th>
                      <th className="p-3 text-center">Status Grounding</th>
                      <th className="p-3">Bukti Kutipan Ilmiah</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-light">
                    {verifications.map((v, i) => (
                      <tr key={i} className="hover:bg-subtle transition-colors">
                        <td className="p-3 text-center font-bold text-dim">
                          {v.recommendation_index || i + 1}
                        </td>
                        <td className="p-3 font-semibold text-heading">
                          {v.title}
                        </td>
                        <td className="p-3 text-caption">
                          {cleanCitation(v.citation_source)} <br />
                          <span className="text-[11px] text-dim font-mono">Halaman {v.citation_page}</span>
                        </td>
                        <td className="p-3 text-center">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-accent-emerald text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            {v.verification_status}
                          </span>
                        </td>
                        <td className="p-3 text-body max-w-xs">
                          {v.evidence && (
                            <p className="italic bg-subtle p-2 rounded-lg border border-line-light mb-1 text-[11px] text-body">
                              "{v.evidence}"
                            </p>
                          )}
                          <p className="text-[11px] text-dim">{v.notes}</p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Validation Notice / Rejection Reason Display */}
          {report.status === "REJECTED" && report.rejection_reason && (
            <div className="p-4 bg-accent-rose border border-rose-300 dark:border-rose-800/50 rounded-xl space-y-1">
              <p className="text-xs font-bold text-rose-800 dark:text-rose-200 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                Catatan Penolakan / Permohonan Revisi Sebelumnya:
              </p>
              <p className="text-xs text-rose-700 dark:text-rose-300 pl-5 leading-relaxed">
                "{report.rejection_reason}"
              </p>
            </div>
          )}
        </div>

        {/* Action Bar (Footer) */}
        <div className="p-5 border-t border-line bg-subtle flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-caption text-center sm:text-left">
            {report.status === "APPROVED" ? (
              <span className="text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                Laporan resmi telah disahkan pada {report.validated_at ? new Date(report.validated_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "-"}
              </span>
            ) : (
              <span>
                Human-in-the-loop: Kader berwenang mengesahkan atau meminta 1x revisi graf AI
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            {report.status === "APPROVED" ? (
              <button
                onClick={handleDownloadPdf}
                className="btn-interactive flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-xs hover:shadow-md transition-all cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Cetak / Unduh Dokumen PDF</span>
              </button>
            ) : (
              <>
                <button
                  onClick={() => setShowRejectModal(true)}
                  disabled={actionLoading || revisionCount >= 1}
                  title={revisionCount >= 1 ? "Batas maksimal 1x revisi telah digunakan" : "Minta koreksi ke sistem AI"}
                  className="btn-interactive flex items-center justify-center gap-1.5 px-4 py-2.5 border border-rose-300 hover:bg-rose-50 text-rose-700 dark:border-rose-800 dark:text-rose-300 dark:hover:bg-rose-950/40 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <XCircle className="w-4 h-4" />
                  <span>{revisionCount >= 1 ? "Batas Revisi Habis" : "Tolak & Minta Revisi AI (1x)"}</span>
                </button>

                <button
                  onClick={handleApprove}
                  disabled={actionLoading}
                  className="btn-interactive flex items-center justify-center gap-2 px-5 py-2.5 bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white rounded-xl text-xs font-bold shadow-xs hover:shadow-md transition-all cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{actionLoading ? "Mengesahkan..." : "Sahkan & Terbitkan PDF Resmi"}</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ═══ Modal Rejection / Loopback ═══ */}
      {showRejectModal && (
        <div
          className="fixed inset-0 bg-overlay flex items-center justify-center p-4 z-50 animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowRejectModal(false);
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-reject-title"
        >
          <div
            ref={rejectModalRef}
            tabIndex={-1}
            className="bg-card rounded-2xl max-w-md w-full p-6 border border-line shadow-prominent space-y-4 animate-slide-up"
          >
            <div className="flex justify-between items-center">
              <h3 id="modal-reject-title" className="text-sm font-bold text-heading">
                Catatan Revisi untuk AI Agent (Maks 1x)
              </h3>
              <button
                onClick={() => setShowRejectModal(false)}
                aria-label="Tutup modal revisi"
                className="p-1.5 text-dim hover:text-heading hover:bg-muted rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <p className="text-xs text-caption leading-relaxed">
              Sistem akan menjalankan 1 kali perulangan graf LangGraph dengan menyertakan konteks koreksi yang Anda masukkan.
            </p>

            <form onSubmit={handleReject} className="space-y-4">
              <div>
                <label htmlFor="rejection-reason" className="block text-xs font-bold text-label mb-1.5">
                  Catatan Perbaikan Kader <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="rejection-reason"
                  required
                  rows="4"
                  placeholder="Contoh: Pasien memiliki alergi telur, ganti menu MP-ASI menjadi ikan gabus/hati ayam..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full p-3 bg-subtle border border-line rounded-xl text-xs text-heading placeholder:text-dim focus:outline-none focus:ring-2 focus:ring-rose-500/40 focus:border-rose-500 transition-all"
                />
              </div>

              <div className="flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowRejectModal(false)}
                  className="px-4 py-2 border border-line rounded-xl text-xs font-semibold text-label hover:bg-muted transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="btn-interactive px-4 py-2 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  {actionLoading ? "Mengeksekusi Revisi..." : "Kirim Koreksi ke AI"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ValidasiLaporan;
