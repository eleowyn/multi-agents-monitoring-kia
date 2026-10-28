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
  ShieldCheck,
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
  Utensils,
  Droplets,
  Baby,
  ChevronRight,
  GraduationCap,
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
    BADUTA: "Baduta (1 - 24 Bulan)",
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
    RISIKO_STUNTING_BERAT: "Sangat Pendek / Severely Stunted (PB/U < -3 SD)",
    RISIKO_STUNTING: "Pendek / Stunted (PB/U < -2 SD)",
    GIZI_BURUK_SEVERELY_UNDERWEIGHT: "BB Sangat Kurang",
    GIZI_KURANG_UNDERWEIGHT: "BB Kurang / Underweight",
    RISIKO_GIZI_BURUK: "Gizi Buruk / Severely Wasted",
    RISIKO_GIZI_KURANG: "Gizi Kurang / Wasted",
    WASTING_SEVERELY_WASTED: "Gizi Buruk / Severely Wasted",
    WASTING_WASTED: "Gizi Kurang / Wasted",
    ANEMIA_BERAT: "Anemia Berat (Hb < 8.0 g/dL)",
    ANEMIA_SEDANG: "Anemia Sedang (Hb 8.0 - 9.9 g/dL)",
    ANEMIA_RINGAN: "Anemia Ringan (Hb 10.0 - 10.9 g/dL)",
    RISIKO_ANEMIA_BERAT: "Anemia Berat Maternal",
    RISIKO_ANEMIA_SEDANG: "Anemia Sedang Maternal",
    RISIKO_ANEMIA_RINGAN: "Anemia Ringan Maternal",
    RISIKO_KEK: "Kurang Energi Kronis / KEK (LiLA < 23.5 cm)",
    RISIKO_KEK_MATERNAL: "Kurang Energi Kronis / KEK (LiLA < 23.5 cm)",
    BBLR: "Berat Bayi Lahir Rendah (< 2.500 g)",
    RISIKO_BBLR: "Berat Bayi Lahir Rendah (< 2.500 g)",
    BBLSR: "Berat Bayi Lahir Sangat Rendah (< 1.500 g)",
    PREMATUR: "Kelahiran Prematur (< 37 Minggu)",
    RISIKO_PREMATUR: "Kelahiran Prematur (< 37 Minggu)",
    BB_TIDAK_NAIK_KMS: "Berat Badan Tidak Naik (KMS)",
    BB_TIDAK_NAIK_2T: "Berat Badan Tidak Naik 2x Berturut-turut (2T)",
    BB_IBU_HAMIL_TURUN: "Penurunan Berat Badan Ibu Hamil Antar Kunjungan",
    RIWAYAT_IBU_KEK: "Riwayat Maternal Ibu KEK Saat Hamil",
    RIWAYAT_IBU_ANEMIA: "Riwayat Maternal Ibu Anemia Saat Hamil",
    RIWAYAT_KEHAMILAN_RISIKO_TINGGI: "Riwayat Obstetri Kehamilan Risiko Tinggi (KSPR)",
    RIWAYAT_BBLR_ANAK: "Riwayat Kelahiran Anak BBLR (< 2.500 g)",
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
  const [detailModal, setDetailModal] = useState(null);
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

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape") {
        if (showRejectModal) setShowRejectModal(false);
        if (detailModal) setDetailModal(null);
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [showRejectModal, detailModal]);

  useEffect(() => {
    if (showRejectModal && rejectModalRef.current) {
      rejectModalRef.current.focus();
    }
  }, [showRejectModal]);

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1440px] mx-auto space-y-6">
        <div className="flex items-center gap-2">
          <SkeletonBlock className="w-48 h-5 rounded-lg" />
        </div>
        <ReportSkeleton />
      </div>
    );
  }

  if (error && !report) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
        <div className="text-center py-20 animate-fade-in bg-card border border-line rounded-2xl shadow-card p-6">
          <FileSearch className="w-16 h-16 text-dim mx-auto mb-4" aria-hidden="true" />
          <h2 className="text-lg font-bold text-heading mb-2">Laporan Tidak Dapat Dimuat</h2>
          <p className="text-sm text-caption mb-6">{error}</p>
          <div className="flex justify-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="px-5 py-2.5 border border-line rounded-xl text-sm font-medium text-label hover:bg-muted transition-all cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 inline mr-1.5" aria-hidden="true" />
              Kembali
            </button>
            <button
              onClick={fetchReport}
              className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-sm font-semibold shadow-sm transition-all cursor-pointer"
            >
              Coba Lagi
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
        <div className="text-center py-20 animate-fade-in bg-card border border-line rounded-2xl shadow-card p-6">
          <FileSearch className="w-16 h-16 text-dim mx-auto mb-4" aria-hidden="true" />
          <h2 className="text-lg font-bold text-heading mb-2">Laporan Tidak Ditemukan</h2>
          <p className="text-sm text-caption mb-6">
            Laporan dengan ID #{reportId} tidak tersedia atau telah dihapus.
          </p>
          <button
            onClick={() => navigate(-1)}
            className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-sm font-semibold shadow-sm transition-all cursor-pointer"
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
  const detSummary = clinical.deterministic_summary || {};
  const recommendations = finalJson.recommendations || [];
  const verifications = finalJson.verification_summary || [];
  const revisionCount = report.revision_count || 0;
  const visitData = report.visit_data || {};
  const hpkStatus = visitData.hpk_status || finalJson.hpk_status || detSummary.hpk_status || null;
  const longitudinalSummary = visitData.longitudinal_summary || finalJson.longitudinal_summary || detSummary.longitudinal_summary || null;
  const maternalHistory = longitudinalSummary?.maternal_history || null;
  const comparisonItems = longitudinalSummary?.comparison_items || [];
  const carePlan = finalJson.care_plan || visitData.care_plan || null;
  const agentTelemetry = finalJson.agent_telemetry || null;

  const statusConfig = {
    KONDISI_BAIK: {
      label: "Kondisi Baik / Normal",
      dot: "bg-emerald-500",
    },
    PERLU_PERHATIAN: {
      label: "Perlu Perhatian / Intervensi",
      dot: "bg-amber-500",
    },
    RISIKO_TINGGI: {
      label: "Risiko Tinggi / Rujuk Segera",
      dot: "bg-rose-500",
    },
  };

  const currentStatus = statusConfig[report.overall_status] || statusConfig.KONDISI_BAIK;
  const isAdmin = user?.role === "ADMIN";

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1440px] mx-auto space-y-6 animate-fade-in">
      {/* Top Navigation Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-line">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold text-heading tracking-tight">
              Rincian Lembar Pemantauan KIA
            </h1>
            {isAdmin && (
              <span className="px-2.5 py-0.5 rounded-md text-xs font-medium bg-subtle text-label border border-line">
                Mode Tinjau Admin
              </span>
            )}
          </div>
          <p className="text-sm text-caption mt-1">
            Laporan klinis terintegrasi Multi-Agent AI &bull; Posyandu Puskesmas Airmadidi
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => navigate(-1)}
            aria-label="Kembali ke halaman sebelumnya"
            className="btn-interactive flex items-center gap-1.5 px-4 py-2 border border-line bg-card hover:bg-subtle text-label hover:text-heading rounded-xl text-sm font-semibold transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            Kembali
          </button>

          {report.status === "APPROVED" && (
            <button
              onClick={handleDownloadPdf}
              aria-label="Unduh Dokumen Cetak / PDF Resmi"
              className="btn-interactive flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-sm font-semibold shadow-xs transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" aria-hidden="true" />
              <span>Cetak / Unduh PDF</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Report Container */}
      <div className="bg-card rounded-2xl border border-line shadow-card overflow-hidden">
        {/* Patient Header */}
        <div className="p-5 sm:p-6 bg-subtle border-b border-line flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-card border border-line flex items-center justify-center shrink-0">
              <User className="w-5 h-5 text-sky-500" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-lg sm:text-xl font-bold text-heading">
                  {meta.patient_name || "Pasien KIA"}
                </h2>
                <span className="px-2.5 py-0.5 rounded-md text-xs font-medium bg-card text-label border border-line">
                  {humanPhase(meta.phase || visitData.phase)}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-caption mt-1 flex items-center gap-2 font-mono">
                <span>NIK: {meta.patient_nik || "-"}</span>
                <span>&bull;</span>
                <span className="flex items-center gap-1 font-sans">
                  <MapPin className="w-3.5 h-3.5 text-emerald-500" />
                  {meta.village_name || "Airmadidi"}
                </span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-card text-heading border border-line">
              <span className={`w-2 h-2 rounded-full ${currentStatus.dot}`} />
              {currentStatus.label}
            </span>

            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-card text-label border border-line">
              {report.status === "APPROVED" ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Disahkan</span>
                </>
              ) : report.status === "REJECTED" ? (
                <>
                  <XCircle className="w-3.5 h-3.5 text-rose-500" />
                  <span>Perlu Revisi</span>
                </>
              ) : (
                <>
                  <Activity className="w-3.5 h-3.5 text-amber-500" />
                  <span>Menunggu Validasi</span>
                </>
              )}
            </span>
          </div>
        </div>

        {/* Visit Details Grid */}
        <div className="p-5 sm:p-6 grid grid-cols-2 sm:grid-cols-4 gap-4 border-b border-line bg-card">
          <div>
            <p className="text-xs text-caption font-medium">Tanggal Kunjungan</p>
            <p className="text-sm sm:text-base font-semibold text-heading mt-1 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-sky-500" />
              <span>{visitData.visit_date || "-"}</span>
            </p>
          </div>
          <div>
            <p className="text-xs text-caption font-medium">ID Laporan / Kunjungan</p>
            <p className="text-sm sm:text-base font-semibold text-heading mt-1 font-mono">
              #{report.id} <span className="text-xs text-caption font-normal">(Visit #{report.visit_id})</span>
            </p>
          </div>
          <div>
            <p className="text-xs text-caption font-medium">Toleransi Revisi AI</p>
            <p className="text-sm sm:text-base font-semibold text-heading mt-1">
              {revisionCount} / 1 kali revisi
            </p>
          </div>
          <div>
            <p className="text-xs text-caption font-medium">Dokumen Cetak PDF</p>
            <p className="text-sm sm:text-base font-semibold mt-1">
              {report.status === "APPROVED" ? (
                <button
                  onClick={handleDownloadPdf}
                  className="text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1.5 cursor-pointer font-semibold"
                >
                  <Download className="w-4 h-4" />
                  <span>Tersedia (Unduh)</span>
                </button>
              ) : (
                <span className="text-dim font-normal text-sm">Terbit setelah disahkan</span>
              )}
            </p>
          </div>
        </div>

        {/* ─── Parameter Pengukuran Antropometri & Fisik Kunjungan ─── */}
        {visitData.phase && (
          <div className="p-5 sm:p-6 border-b border-line bg-subtle/40 space-y-3.5">
            <h3 className="text-xs font-semibold uppercase tracking-wider flex items-center gap-2 text-caption">
              <Activity className="w-4 h-4 text-sky-500" />
              Data Pengukuran Fisik & Antropometri Kunjungan
            </h3>

            {visitData.phase === "IBU_HAMIL" && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
                <div className="p-3.5 bg-card border border-line rounded-xl">
                  <p className="text-xs text-caption">Usia Kehamilan</p>
                  <p className="text-base font-bold text-heading mt-0.5">
                    {visitData.gestational_age_weeks || "-"} <span className="text-xs font-normal">mg</span>
                  </p>
                  <p className="text-xs text-dim">Trimester {visitData.trimester || "-"}</p>
                </div>
                <div className="p-3.5 bg-card border border-line rounded-xl">
                  <p className="text-xs text-caption">Berat Badan Ibu</p>
                  <p className="text-base font-bold text-heading mt-0.5">
                    {visitData.maternal_weight_kg || "-"} <span className="text-xs font-normal">kg</span>
                  </p>
                  <p className="text-xs text-dim">TB: {visitData.maternal_height_cm || "-"} cm</p>
                </div>
                <div className="p-3.5 bg-card border border-line rounded-xl">
                  <p className="text-xs text-caption">Lingkar LiLA</p>
                  <p className="text-base font-bold text-heading mt-0.5">
                    {visitData.lila_cm || "-"} <span className="text-xs font-normal">cm</span>
                  </p>
                  <p className="text-xs text-dim">Batas normal ≥ 23.5</p>
                </div>
                <div className="p-3.5 bg-card border border-line rounded-xl">
                  <p className="text-xs text-caption">Kadar Hemoglobin</p>
                  <p className="text-base font-bold text-heading mt-0.5">
                    {visitData.hb_level || "-"} <span className="text-xs font-normal">g/dL</span>
                  </p>
                  <p className="text-xs text-dim">Batas normal ≥ 11.0</p>
                </div>
                <div className="p-3.5 bg-card border border-line rounded-xl">
                  <p className="text-xs text-caption">Tekanan Darah</p>
                  <p className="text-base font-bold text-heading mt-0.5">
                    {visitData.systolic_bp || "-"}/{visitData.diastolic_bp || "-"}
                  </p>
                  <p className="text-xs text-dim">mmHg</p>
                </div>
                <div className="p-3.5 bg-card border border-line rounded-xl">
                  <p className="text-xs text-caption">Tinggi Fundus (TFU)</p>
                  <p className="text-base font-bold text-heading mt-0.5">
                    {visitData.fundal_height_cm || "-"} <span className="text-xs font-normal">cm</span>
                  </p>
                  <p className="text-xs text-dim">Skor KSPR: {Array.isArray(visitData.kspr_answers) ? visitData.kspr_answers.length * 4 + 2 : "-"}</p>
                </div>
              </div>
            )}

            {visitData.phase === "BAYI_BARU_LAHIR" && (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
                <div className="p-3.5 bg-card border border-line rounded-xl">
                  <p className="text-xs text-caption">Berat Lahir</p>
                  <p className="text-base font-bold text-heading mt-0.5">
                    {visitData.birth_weight_gram || "-"} <span className="text-xs font-normal">gram</span>
                  </p>
                  <p className="text-xs text-dim">Normal ≥ 2500g</p>
                </div>
                <div className="p-3.5 bg-card border border-line rounded-xl">
                  <p className="text-xs text-caption">Panjang Lahir</p>
                  <p className="text-base font-bold text-heading mt-0.5">
                    {visitData.birth_length_cm || "-"} <span className="text-xs font-normal">cm</span>
                  </p>
                  <p className="text-xs text-dim">Standar normal</p>
                </div>
                <div className="p-3.5 bg-card border border-line rounded-xl">
                  <p className="text-xs text-caption">Lingkar Kepala</p>
                  <p className="text-base font-bold text-heading mt-0.5">
                    {visitData.head_circumference_cm || "-"} <span className="text-xs font-normal">cm</span>
                  </p>
                  <p className="text-xs text-dim">Rentang 33-35 cm</p>
                </div>
                <div className="p-3.5 bg-card border border-line rounded-xl">
                  <p className="text-xs text-caption">Usia Gestasi Lahir</p>
                  <p className="text-base font-bold text-heading mt-0.5">
                    {visitData.gestational_age_at_birth_weeks || "-"} <span className="text-xs font-normal">mg</span>
                  </p>
                  <p className="text-xs text-dim">{visitData.gestational_age_at_birth_weeks && visitData.gestational_age_at_birth_weeks < 37 ? "Prematur" : "Cukup Bulan"}</p>
                </div>
                <div className="p-3.5 bg-card border border-line rounded-xl">
                  <p className="text-xs text-caption">Inisiasi Menyusu (IMD)</p>
                  <p className="text-base font-bold text-heading mt-0.5">
                    {visitData.early_initiation_breastfeeding || "-"}
                  </p>
                  <p className="text-xs text-dim">Standar Kemenkes</p>
                </div>
              </div>
            )}

            {visitData.phase === "BADUTA" && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
                <div className="p-3.5 bg-card border border-line rounded-xl">
                  <p className="text-xs text-caption">Usia Anak</p>
                  <p className="text-base font-bold text-heading mt-0.5">
                    {visitData.age_in_months || "-"} <span className="text-xs font-normal">bulan</span>
                  </p>
                  <p className="text-xs text-dim">Fase Baduta 1000 HPK</p>
                </div>
                <div className="p-3.5 bg-card border border-line rounded-xl">
                  <p className="text-xs text-caption">Berat Badan Anak</p>
                  <p className="text-base font-bold text-heading mt-0.5">
                    {visitData.child_weight_kg || "-"} <span className="text-xs font-normal">kg</span>
                  </p>
                  <p className="text-xs text-dim">WHO Anthro BB/U</p>
                </div>
                <div className="p-3.5 bg-card border border-line rounded-xl">
                  <p className="text-xs text-caption">Panjang/Tinggi</p>
                  <p className="text-base font-bold text-heading mt-0.5">
                    {visitData.child_length_cm || "-"} <span className="text-xs font-normal">cm</span>
                  </p>
                  <p className="text-xs text-dim">WHO Anthro PB/U</p>
                </div>
                <div className="p-3.5 bg-card border border-line rounded-xl">
                  <p className="text-xs text-caption">Lingkar Kepala</p>
                  <p className="text-base font-bold text-heading mt-0.5">
                    {visitData.child_head_circumference_cm || "-"} <span className="text-xs font-normal">cm</span>
                  </p>
                  <p className="text-xs text-dim">Nellhaus / WHO</p>
                </div>
                <div className="p-3.5 bg-card border border-line rounded-xl">
                  <p className="text-xs text-caption">Tren Berat (KMS)</p>
                  <p className="text-base font-bold text-heading mt-0.5">
                    {visitData.weight_trend_kms || "-"}
                  </p>
                  <p className="text-xs text-dim">Kartu Menuju Sehat</p>
                </div>
                <div className="p-3.5 bg-card border border-line rounded-xl">
                  <p className="text-xs text-caption">Kapsul Vitamin A</p>
                  <p className="text-base font-bold text-heading mt-0.5">
                    {visitData.vitamin_a || "-"}
                  </p>
                  <p className="text-xs text-dim">{visitData.immunization_status || "Imunisasi Terkini"}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── Rekam Jejak Longitudinal 1.000 HPK ─── */}
        {(hpkStatus || maternalHistory || comparisonItems.length > 0) && (
          <div className="p-5 sm:p-6 border-b border-line bg-card space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider flex items-center gap-2 text-caption">
              <ClipboardList className="w-4 h-4 text-sky-500" />
              Rekam Jejak & Progres Monitoring 1.000 HPK
            </h3>

            {hpkStatus && hpkStatus.hpk_day && (
              <div className="p-4 bg-subtle rounded-xl border border-line space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-heading">{hpkStatus.summary_label}</p>
                    <p className="text-xs text-caption mt-0.5">{hpkStatus.phase_label}</p>
                  </div>
                  <span className="inline-flex items-center px-3 py-1 rounded-md text-xs font-semibold bg-card text-heading border border-line self-start sm:self-auto">
                    Hari ke-{hpkStatus.hpk_day} / 1.000 HPK ({hpkStatus.progress_percent}%)
                  </span>
                </div>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-sky-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, hpkStatus.progress_percent || 0)}%` }}
                  />
                </div>
              </div>
            )}

            {/* 🎓 Banner Kelulusan Periode Emas 1.000 HPK (Usia 24 Bulan / Hari ke-1.000) */}
            {(hpkStatus?.is_graduation_milestone || carePlan?.graduation_package || (visitData?.age_in_months >= 24)) && (
              <div className={`p-4 sm:p-5 rounded-2xl border ${carePlan?.graduation_package?.status_type === "ALERT" ? "bg-rose-50/60 dark:bg-rose-950/20 border-rose-300 dark:border-rose-800" : "bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800"} space-y-3`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${carePlan?.graduation_package?.status_type === "ALERT" ? "bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300" : "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300"}`}>
                      <GraduationCap className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-caption">Milestone Hari ke-1.000</span>
                      <h4 className="text-sm sm:text-base font-bold text-heading">
                        Kelulusan Periode Emas 1.000 HPK (Usia 24 Bulan)
                      </h4>
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${carePlan?.graduation_package?.status_type === "ALERT" ? "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-900/60 dark:text-rose-200" : "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/60 dark:text-emerald-200"}`}>
                    {carePlan?.graduation_package?.status_badge || "🎓 Lulus Periode Emas 1.000 HPK"}
                  </span>
                </div>

                <p className="text-xs sm:text-sm text-body leading-relaxed">
                  {carePlan?.graduation_package?.exit_assessment || "Anak telah menuntaskan seluruh 1.000 Hari Pertama Kehidupan (270 hari masa kandungan + 730 hari masa baduta). Pemantauan bertransisi ke kelompok Balita 2–5 tahun."}
                </p>

                {carePlan?.graduation_package && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                    <div className="p-3 bg-card border border-line rounded-xl space-y-1">
                      <p className="text-xs font-bold text-sky-700 dark:text-sky-400">
                        🍼 Menyapih Penuh Kasih
                      </p>
                      <p className="text-[11px] text-caption leading-relaxed">
                        Prinsip <em>Weaning with Love</em> bertahap tanpa zat pahit/paksaan, beralih ke cangkir/gelas.
                      </p>
                    </div>
                    <div className="p-3 bg-card border border-line rounded-xl space-y-1">
                      <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                        🍽️ Nutrisi Balita 2–5 Tahun
                      </p>
                      <p className="text-[11px] text-caption leading-relaxed">
                        3x makan keluarga (Isi Piringku Balita) + 2x selingan protein hewani lokal (ikan tude/telur).
                      </p>
                    </div>
                    <div className="p-3 bg-card border border-line rounded-xl space-y-1">
                      <p className="text-xs font-bold text-indigo-700 dark:text-indigo-400">
                        🧩 Skrining KPSP 24 Bulan
                      </p>
                      <p className="text-[11px] text-caption leading-relaxed">
                        Melompat, naik tangga, bicara kalimat 2 kata, menyusun 4-6 balok, dan toilet training.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {maternalHistory && (maternalHistory.mother_name || maternalHistory.birth_weight_gram) && (
              <div className="p-4 bg-subtle border border-line rounded-xl space-y-2.5">
                <p className="text-xs font-semibold text-label flex items-center gap-2">
                  <Heart className="w-4 h-4 text-rose-500" />
                  <span>Rantai Kontinuitas Lintas Fase (Riwayat Ibu Hamil & Kelahiran):</span>
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  <div className="p-3 bg-card rounded-xl border border-line">
                    <span className="text-xs text-caption block">Ibu Kandung</span>
                    <span className="font-semibold text-heading">
                      {maternalHistory.mother_name || "Tidak terhubung"}
                    </span>
                  </div>
                  <div className="p-3 bg-card rounded-xl border border-line">
                    <span className="text-xs text-caption block">Status KEK Ibu</span>
                    <span className="font-semibold text-heading">
                      {maternalHistory.is_kek ? `Riwayat KEK (LiLA ${maternalHistory.min_maternal_lila_cm} cm)` : "Normal (Tidak KEK)"}
                    </span>
                  </div>
                  <div className="p-3 bg-card rounded-xl border border-line">
                    <span className="text-xs text-caption block">Status Anemia & KSPR</span>
                    <span className="font-semibold text-heading">
                      {maternalHistory.is_anemia ? `Anemia (Hb ${maternalHistory.min_maternal_hb})` : "Hb Normal"} &bull; {maternalHistory.kspr_category || "KRR"}
                    </span>
                  </div>
                  <div className="p-3 bg-card rounded-xl border border-line">
                    <span className="text-xs text-caption block">Berat Lahir (Fase 2)</span>
                    <span className="font-semibold text-heading">
                      {maternalHistory.birth_weight_gram ? `${maternalHistory.birth_weight_gram} g` : "Belum tercatat"}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {comparisonItems.length > 0 && (
              <div className="border border-line rounded-xl overflow-hidden">
                <table className="w-full text-sm text-left">
                  <thead className="bg-subtle text-caption text-xs font-semibold border-b border-line uppercase tracking-wider">
                    <tr>
                      <th className="p-3">Parameter Pemantauan</th>
                      <th className="p-3 text-center">Kunjungan Lalu ({longitudinalSummary?.previous_visit_date || "-"})</th>
                      <th className="p-3 text-center">Kunjungan Ini ({visitData.visit_date || "-"})</th>
                      <th className="p-3 text-center">Perubahan</th>
                      <th className="p-3 text-center">Status Tren</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-light">
                    {comparisonItems.map((item, idx) => (
                      <tr key={idx} className="hover:bg-subtle/60">
                        <td className="p-3 font-medium text-heading">{item.metric}</td>
                        <td className="p-3 text-center text-body tabular-nums">
                          {item.previous !== null && item.previous !== undefined ? `${item.previous} ${item.unit}` : "-"}
                        </td>
                        <td className="p-3 text-center font-semibold text-heading tabular-nums">
                          {item.current !== null && item.current !== undefined ? `${item.current} ${item.unit}` : "-"}
                        </td>
                        <td className="p-3 text-center font-semibold text-body tabular-nums">
                          {item.delta}
                        </td>
                        <td className="p-3 text-center">
                          <span className="inline-flex px-2.5 py-0.5 rounded-md text-xs font-medium bg-subtle text-heading border border-line">
                            {item.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ─── Body Sections: AI Multi-Agent Results (Clean Minimalist) ─── */}
        <div className="p-5 sm:p-6 space-y-8">
          {/* Executive Summary */}
          <div className="p-5 bg-subtle border border-line rounded-2xl space-y-2">
            <p className="font-bold text-base text-heading flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-sky-500" aria-hidden="true" />
              Ringkasan Eksekutif Analisis Sistem
            </p>
            <p className="text-sm sm:text-base text-body leading-relaxed">
              {finalJson.executive_summary}
            </p>
          </div>

          {/* Section I: Clinical Findings & Risk Flags */}
          <div className="space-y-3.5">
            <h3 className="text-base font-bold text-heading flex items-center gap-2">
              <Activity className="w-4 h-4 text-sky-500" />
              <span>I. Temuan Pengukuran Deterministik (Agent 1)</span>
            </h3>

            <p className="text-sm sm:text-base text-body bg-subtle p-4 rounded-xl border border-line leading-relaxed">
              {clinical.risk_narrative || "Tidak ada catatan deviasi antropometri."}
            </p>

            {clinical.active_risk_flags && clinical.active_risk_flags.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {clinical.active_risk_flags.map((flag, i) => (
                  <div
                    key={i}
                    className="p-4 bg-card border border-line rounded-xl space-y-1.5"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <span className="font-bold text-sm text-heading flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                        <span>{flag.indicator}</span>
                      </span>
                      <span className="text-xs bg-subtle px-2.5 py-0.5 rounded-md text-label font-medium border border-line shrink-0">
                        {humanRisk(flag.flag)}
                      </span>
                    </div>
                    <p className="text-sm text-caption leading-relaxed pl-6">
                      {flag.detail}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 bg-subtle border border-line rounded-xl flex items-center gap-2.5 text-sm text-body">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Seluruh parameter fisik berada dalam rentang normal / standar rujukan nasional.</span>
              </div>
            )}
          </div>

          {/* Section II: Recommendations (Agent 2) — Clean Minimalist Cards */}
          <div className="space-y-4">
            <div>
              <h3 className="text-base font-bold text-heading flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-sky-500" />
                <span>II. Rekomendasi Klinis, Gizi & Tindakan Kader (Agent 2 — RAG ChromaDB)</span>
              </h3>
              <p className="text-xs sm:text-sm text-caption mt-0.5">
                Klik pada kartu rekomendasi untuk membaca rincian makanan, ASI/susu, stimulasi, dan langkah tindakan kader.
              </p>
            </div>

            {recommendations.length === 0 ? (
              <div className="text-center py-8 bg-subtle rounded-2xl border border-line px-4">
                <CheckCircle2 className="w-7 h-7 text-emerald-500 mx-auto mb-2" />
                <p className="text-base font-bold text-heading">
                  Tidak Ditemukan Indikasi Risiko Medis Aktif
                </p>
                <p className="text-sm text-caption mt-1 max-w-2xl mx-auto">
                  Pasien berada dalam kondisi pertumbuhan optimal. Gunakan panduan harian pada Bagian II.B di bawah ini untuk edukasi keluarga di Meja 4 Posyandu.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {recommendations.map((rec, idx) => (
                  <div
                    key={idx}
                    onClick={() =>
                      setDetailModal({
                        type: "recommendation",
                        badge: `Rekomendasi #${idx + 1} • ${rec.category}`,
                        title: rec.title,
                        rec,
                      })
                    }
                    className="group card-interactive cursor-pointer p-5 bg-card border border-line rounded-2xl flex flex-col justify-between gap-4"
                  >
                    <div className="space-y-2.5">
                      <div className="flex justify-between items-start gap-3">
                        <p className="font-bold text-base text-heading flex items-center gap-2.5">
                          <span className="w-6 h-6 rounded-md bg-subtle border border-line text-label flex items-center justify-center text-xs font-bold shrink-0">
                            {idx + 1}
                          </span>
                          <span>{rec.title}</span>
                        </p>
                        <span className="text-xs bg-subtle text-caption px-2.5 py-0.5 rounded-md font-medium border border-line shrink-0 uppercase">
                          {rec.category}
                        </span>
                      </div>

                      <p className="text-sm text-caption leading-relaxed line-clamp-2">
                        {rec.recommendation_text}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-line-light flex items-center justify-between gap-2 text-xs">
                      {rec.citation ? (
                        <span className="text-caption flex items-center gap-1.5 truncate">
                          <BookOpen className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                          <span className="truncate">
                            {cleanCitation(rec.citation.source)} (Hal. {rec.citation.page})
                          </span>
                        </span>
                      ) : (
                        <span />
                      )}

                      <span className="inline-flex items-center gap-1 font-semibold text-label group-hover:text-sky-600 dark:group-hover:text-sky-400 shrink-0 transition-colors">
                        <span>Lihat detail</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section II.B: Comprehensive Care Plan (4 Minimalist Neutral Cards) */}
          {carePlan && carePlan.food_and_nutrition && (
            <div className="space-y-4 pt-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-bold text-heading flex items-center gap-2">
                    <Utensils className="w-4 h-4 text-emerald-500" />
                    <span>II.B Panduan Harian Makanan/MP-ASI, ASI/Susu & Aktivitas Stimulasi 1.000 HPK</span>
                  </h3>
                  <p className="text-xs sm:text-sm text-caption mt-0.5">
                    Panduan edukasi keluarga di Meja 4 Posyandu &bull; Disesuaikan untuk{" "}
                    <strong>{carePlan.age_or_trimester_label}</strong>
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Card 1: Makanan & Menu Sehari */}
                <div
                  onClick={() =>
                    setDetailModal({
                      type: "care_food",
                      badge: "Panduan Gizi & Menu Harian",
                      title: carePlan.food_and_nutrition.headline || carePlan.food_and_nutrition.title,
                      data: carePlan.food_and_nutrition,
                    })
                  }
                  className="group card-interactive cursor-pointer p-5 bg-card border border-line rounded-2xl flex flex-col justify-between gap-4"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-subtle border border-line flex items-center justify-center shrink-0">
                        <Utensils className="w-4 h-4 text-emerald-500" />
                      </div>
                      <div>
                        <span className="text-xs font-medium text-caption">1. Makanan & Menu Sehari</span>
                        <h4 className="text-base font-bold text-heading leading-snug">
                          {carePlan.food_and_nutrition.headline || carePlan.food_and_nutrition.title}
                        </h4>
                      </div>
                    </div>

                    <p className="text-sm text-caption leading-relaxed line-clamp-2">
                      {carePlan.food_and_nutrition.texture_and_consistency ||
                        carePlan.food_and_nutrition.stage_and_texture}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-line-light flex items-center justify-between text-xs font-semibold text-label group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                    <span>Lihat jadwal menu 5 waktu makan & porsi</span>
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>

                {/* Card 2: ASI, Susu & Suplementasi */}
                {carePlan.milk_and_supplements && (
                  <div
                    onClick={() =>
                      setDetailModal({
                        type: "care_milk",
                        badge: "Panduan ASI, Susu & Suplementasi",
                        title: carePlan.milk_and_supplements.headline || carePlan.milk_and_supplements.title,
                        data: carePlan.milk_and_supplements,
                      })
                    }
                    className="group card-interactive cursor-pointer p-5 bg-card border border-line rounded-2xl flex flex-col justify-between gap-4"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-subtle border border-line flex items-center justify-center shrink-0">
                          <Droplets className="w-4 h-4 text-sky-500" />
                        </div>
                        <div>
                          <span className="text-xs font-medium text-caption">2. ASI, Susu & Suplementasi</span>
                          <h4 className="text-base font-bold text-heading leading-snug">
                            {carePlan.milk_and_supplements.headline || carePlan.milk_and_supplements.title}
                          </h4>
                        </div>
                      </div>

                      {carePlan.milk_and_supplements.compliance_badge && (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>ASI Standar Emas Mutlak • PKMK Khusus Resep Dokter</span>
                        </div>
                      )}

                      <p className="text-sm text-caption leading-relaxed line-clamp-2">
                        {carePlan.milk_and_supplements.primary_source ||
                          carePlan.milk_and_supplements.recommended_type}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-line-light flex items-center justify-between text-xs font-semibold text-label group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                      <span>Lihat aturan pemberian & keamanan medis</span>
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </div>
                )}

                {/* Card 3: Aktivitas Fisik, Stimulasi & Tidur */}
                {carePlan.activity_and_stimulation && (
                  <div
                    onClick={() =>
                      setDetailModal({
                        type: "care_activity",
                        badge: "Aktivitas Fisik & Stimulasi Harian",
                        title: carePlan.activity_and_stimulation.headline || carePlan.activity_and_stimulation.title,
                        data: carePlan.activity_and_stimulation,
                      })
                    }
                    className="group card-interactive cursor-pointer p-5 bg-card border border-line rounded-2xl flex flex-col justify-between gap-4"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-subtle border border-line flex items-center justify-center shrink-0">
                          <Baby className="w-4 h-4 text-amber-500" />
                        </div>
                        <div>
                          <span className="text-xs font-medium text-caption">3. Aktivitas & Stimulasi</span>
                          <h4 className="text-base font-bold text-heading leading-snug">
                            {carePlan.activity_and_stimulation.headline || carePlan.activity_and_stimulation.title}
                          </h4>
                        </div>
                      </div>

                      <p className="text-sm text-caption leading-relaxed line-clamp-2">
                        {(carePlan.activity_and_stimulation.daily_activities ||
                          carePlan.activity_and_stimulation.recommended_activities ||
                          [])[0] || "Panduan stimulasi tumbuh kembang harian sesuai usia."}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-line-light flex items-center justify-between text-xs font-semibold text-label group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                      <span>Lihat daftar stimulasi & pola tidur</span>
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </div>
                )}

                {/* Card 4: Kewaspadaan Tanda Bahaya */}
                {Array.isArray(carePlan.danger_signs) && carePlan.danger_signs.length > 0 && (
                  <div
                    onClick={() =>
                      setDetailModal({
                        type: "care_danger",
                        badge: "Indikasi Rujukan Cepat Puskesmas",
                        title: "Kewaspadaan Tanda Bahaya Klinis",
                        dangerSigns: carePlan.danger_signs,
                      })
                    }
                    className="group card-interactive cursor-pointer p-5 bg-card border border-line rounded-2xl flex flex-col justify-between gap-4"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-subtle border border-line flex items-center justify-center shrink-0">
                          <AlertTriangle className="w-4 h-4 text-rose-500" />
                        </div>
                        <div>
                          <span className="text-xs font-medium text-caption">4. Kewaspadaan Medis</span>
                          <h4 className="text-base font-bold text-heading leading-snug">
                            Tanda Bahaya & Indikasi Rujukan Puskesmas
                          </h4>
                        </div>
                      </div>

                      <p className="text-sm text-caption leading-relaxed line-clamp-2">
                        {carePlan.danger_signs[0]}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-line-light flex items-center justify-between text-xs font-semibold text-label group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                      <span>Lihat semua ({carePlan.danger_signs.length}) tanda bahaya</span>
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Section III: Verifications (Agent 3) */}
          {verifications.length > 0 && (
            <div className="space-y-3.5">
              <h3 className="text-base font-bold text-heading flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span>III. Verifikasi Grounding Sitasi (Agent 3 — ReAct)</span>
              </h3>

              <div className="border border-line rounded-xl overflow-hidden">
                <table className="w-full text-sm text-left">
                  <thead className="bg-subtle text-caption text-xs font-semibold border-b border-line uppercase tracking-wider">
                    <tr>
                      <th className="p-3.5 w-12 text-center">No</th>
                      <th className="p-3.5 w-1/3">Poin Rekomendasi</th>
                      <th className="p-3.5 w-1/4">Dokumen Sitasi</th>
                      <th className="p-3.5 text-center">Status Grounding</th>
                      <th className="p-3.5">Bukti Kutipan Ilmiah</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-light">
                    {verifications.map((v, i) => (
                      <tr key={i} className="hover:bg-subtle transition-colors">
                        <td className="p-3.5 text-center font-bold text-dim">
                          {v.recommendation_index || i + 1}
                        </td>
                        <td className="p-3.5 font-semibold text-heading">
                          {v.title}
                        </td>
                        <td className="p-3.5 text-caption">
                          {cleanCitation(v.citation_source)} <br />
                          <span className="text-xs text-dim font-mono">Halaman {v.citation_page}</span>
                        </td>
                        <td className="p-3.5 text-center">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-medium bg-subtle text-heading border border-line">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                            {v.verification_status}
                          </span>
                        </td>
                        <td className="p-3.5 text-body max-w-md">
                          {v.evidence && (
                            <p className="italic bg-subtle p-2.5 rounded-lg border border-line mb-1 text-xs text-body">
                              "{v.evidence}"
                            </p>
                          )}
                          <p className="text-xs text-dim">{v.notes}</p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ═══ Bukti Kerja, Lifetime, Sequential vs Parallel & Konsumsi Token 3 Agent ═══ */}
          {agentTelemetry && agentTelemetry.agents && (
            <div className="space-y-4 pt-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-sky-500" />
                  <h3 className="text-sm font-bold text-heading uppercase tracking-wider">
                    Bukti Kerja, Lifetime & Konsumsi Token Multi-Agent AI
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setDetailModal({
                      type: "pipeline_telemetry",
                      badge: "Telemetri Arsitektur Multi-Agent",
                      title: "Bukti Sequential Pipeline vs Parallel Evaluator & Lifetime Agent",
                      telemetry: agentTelemetry,
                    })
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-subtle hover:bg-muted text-heading border border-line transition-colors cursor-pointer self-start sm:self-auto"
                >
                  <span>Lihat Bukti Sequential vs Parallel</span>
                  <ChevronRight className="w-3.5 h-3.5 text-sky-500" />
                </button>
              </div>

              {/* 4-Metric Summary Strip */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                <div className="p-3.5 bg-subtle rounded-xl border border-line space-y-1">
                  <p className="text-xs text-caption font-medium">Alur Pipeline Utama</p>
                  <p className="text-sm font-bold text-heading">Sequential (Step 1 → 2 → 3)</p>
                  <p className="text-xs text-dim">
                    Total Durasi: {agentTelemetry.summary_metrics?.total_pipeline_lifetime_ms ?? 0} ms
                  </p>
                </div>

                <div className="p-3.5 bg-subtle rounded-xl border border-line space-y-1">
                  <p className="text-xs text-caption font-medium">Alur Evaluator Audit</p>
                  <p className="text-sm font-bold text-heading">Parallel (3 Worker Threads)</p>
                  <p className="text-xs text-dim">
                    {Array.isArray(agentTelemetry.parallel_evaluator_logs)
                      ? `${agentTelemetry.parallel_evaluator_logs.length} Thread Evaluator Konkuren`
                      : "ThreadPoolExecutor Aktif"}
                  </p>
                </div>

                <div className="p-3.5 bg-subtle rounded-xl border border-line space-y-1">
                  <p className="text-xs text-caption font-medium">Siklus Hidup (Agent Lifetime)</p>
                  <p className="text-sm font-bold text-heading">Ephemeral (TERMINATED)</p>
                  <p className="text-xs text-dim truncate" title={agentTelemetry.architecture_pattern?.thread_checkpoint_status}>
                    {report.status === "APPROVED"
                      ? "Thread Selesai Permanen (CLOSED)"
                      : "Selesai Tugas = Selesai Hidup"}
                  </p>
                </div>

                <div className="p-3.5 bg-subtle rounded-xl border border-line space-y-1">
                  <p className="text-xs text-caption font-medium">Total Konsumsi Token (3 Agent)</p>
                  <p className="text-sm font-bold text-heading font-mono">
                    {agentTelemetry.summary_metrics?.total_tokens ?? 0} <span className="font-sans font-normal text-xs text-caption">token</span>
                  </p>
                  <p className="text-xs text-dim font-mono">
                    In: {agentTelemetry.summary_metrics?.total_input_tokens ?? 0} &bull; Out:{" "}
                    {agentTelemetry.summary_metrics?.total_output_tokens ?? 0}
                  </p>
                </div>
              </div>

              {/* 3 Agent Telemetry Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {["agent_1", "agent_2", "agent_3"].map((aKey, idx) => {
                  const ag = agentTelemetry.agents[aKey];
                  if (!ag) return null;
                  const tok = ag.token_usage || {};
                  const iconColors = ["text-rose-500", "text-amber-500", "text-emerald-500"];
                  const rankShort =
                    idx === 0
                      ? "Paling Penting (Keselamatan Jiwa)"
                      : idx === 1
                        ? "Paling Sulit (Multi-Hop ReAct & RAG)"
                        : "Paling Mudah (Grounding Judge)";
                  return (
                    <div
                      key={aKey}
                      onClick={() =>
                        setDetailModal({
                          type: "agent_telemetry",
                          badge: `Sequential Step #${ag.execution_order || idx + 1} • ${ag.mode || "ACTIVE"}`,
                          title: ag.agent_name,
                          agent: ag,
                        })
                      }
                      className="group card-interactive cursor-pointer p-4 bg-subtle rounded-xl border border-line flex flex-col justify-between gap-4"
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="w-9 h-9 rounded-lg bg-card border border-line flex items-center justify-center shrink-0">
                            <Activity className={`w-4 h-4 ${iconColors[idx]}`} />
                          </div>
                          <span className="px-2.5 py-0.5 rounded-md text-xs font-medium bg-card text-caption border border-line">
                            Step #{ag.execution_order || idx + 1} &bull; {ag.lifetime_ms ?? 0} ms
                          </span>
                        </div>

                        <div className="space-y-1">
                          <h4 className="text-sm font-bold text-heading leading-snug">{ag.agent_name}</h4>
                          <p className="text-xs font-semibold text-label">{rankShort}</p>
                        </div>

                        <div className="p-2.5 bg-card rounded-lg border border-line space-y-1 text-xs font-mono">
                          <div className="flex items-center justify-between text-caption">
                            <span>Lifetime:</span>
                            <span className="text-heading font-semibold">TERMINATED ({ag.lifetime_ms ?? 0} ms)</span>
                          </div>
                          <div className="flex items-center justify-between text-caption">
                            <span>Token:</span>
                            <span className="text-heading font-semibold">
                              {tok.total_tokens ?? 0} (In:{tok.input_tokens ?? 0} / Out:{tok.output_tokens ?? 0})
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-2.5 border-t border-line flex items-center justify-between text-xs font-semibold text-label group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                        <span>Lihat bukti kerja & log</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Validation Notice / Rejection Reason Display */}
          {report.status === "REJECTED" && report.rejection_reason && (
            <div className="p-4 bg-subtle border border-line rounded-xl space-y-1">
              <p className="text-sm font-bold text-heading flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-500" />
                Catatan Penolakan / Permohonan Revisi Sebelumnya:
              </p>
              <p className="text-sm text-body pl-6 leading-relaxed">
                "{report.rejection_reason}"
              </p>
            </div>
          )}
        </div>

        {/* Action Bar (Footer) */}
        <div className="p-5 sm:p-6 border-t border-line bg-subtle flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs sm:text-sm text-caption text-center sm:text-left">
            {report.status === "APPROVED" ? (
              <span className="text-heading font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                Laporan resmi telah disahkan pada{" "}
                {report.validated_at
                  ? new Date(report.validated_at).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })
                  : "-"}
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
                className="btn-interactive flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-sm font-semibold shadow-xs transition-all cursor-pointer"
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
                  className="btn-interactive flex items-center justify-center gap-1.5 px-4 py-2.5 border border-line bg-card hover:bg-muted text-heading rounded-xl text-sm font-semibold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <XCircle className="w-4 h-4 text-rose-500" />
                  <span>{revisionCount >= 1 ? "Batas Revisi Habis" : "Tolak & Minta Revisi AI (1x)"}</span>
                </button>

                <button
                  onClick={handleApprove}
                  disabled={actionLoading}
                  className="btn-interactive flex items-center justify-center gap-2 px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-sm font-semibold shadow-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{actionLoading ? "Mengesahkan..." : "Sahkan & Terbitkan PDF Resmi"}</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ═══ Clean Minimalist Detail Modal Pop-up ═══ */}
      {detailModal && (
        <div
          className="fixed inset-0 bg-overlay backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 z-50 animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDetailModal(null);
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="detail-modal-title"
        >
          <div className="bg-card rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col border border-line shadow-prominent overflow-hidden animate-scale-in">
            {/* Header */}
            <div className="p-5 sm:p-6 border-b border-line flex items-start justify-between gap-4">
              <div className="space-y-1">
                <span className="inline-block px-2.5 py-0.5 rounded-md text-xs font-medium bg-subtle text-caption border border-line">
                  {detailModal.badge}
                </span>
                <h3 id="detail-modal-title" className="text-lg sm:text-xl font-bold text-heading">
                  {detailModal.title}
                </h3>
              </div>
              <button
                onClick={() => setDetailModal(null)}
                aria-label="Tutup modal detail"
                className="p-2 text-dim hover:text-heading hover:bg-subtle rounded-xl transition-colors cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-4">
              {detailModal.type === "recommendation" && detailModal.rec && (
                <>
                  <div className="p-4 bg-subtle rounded-xl border border-line">
                    <p className="text-sm sm:text-base text-body leading-relaxed">
                      {detailModal.rec.recommendation_text}
                    </p>
                  </div>

                  <div className="space-y-3">
                    {detailModal.rec.food_guide && (
                      <div className="p-4 bg-subtle border border-line rounded-xl space-y-1.5">
                        <p className="text-xs font-bold text-heading flex items-center gap-2 uppercase tracking-wide">
                          <Utensils className="w-4 h-4 text-emerald-500 shrink-0" />
                          <span>Panduan Makanan, Tekstur & Porsi Lokal</span>
                        </p>
                        <p className="text-sm text-body leading-relaxed pl-6">{detailModal.rec.food_guide}</p>
                      </div>
                    )}

                    {detailModal.rec.milk_and_supplements && (
                      <div className="p-4 bg-subtle border border-line rounded-xl space-y-1.5">
                        <p className="text-xs font-bold text-heading flex items-center gap-2 uppercase tracking-wide">
                          <Droplets className="w-4 h-4 text-sky-500 shrink-0" />
                          <span>Panduan ASI, Susu & Suplementasi Medis</span>
                        </p>
                        <p className="text-sm text-body leading-relaxed pl-6">{detailModal.rec.milk_and_supplements}</p>
                      </div>
                    )}

                    {detailModal.rec.activity_and_stimulation && (
                      <div className="p-4 bg-subtle border border-line rounded-xl space-y-1.5">
                        <p className="text-xs font-bold text-heading flex items-center gap-2 uppercase tracking-wide">
                          <Baby className="w-4 h-4 text-amber-500 shrink-0" />
                          <span>Aktivitas Fisik & Stimulasi Harian</span>
                        </p>
                        <p className="text-sm text-body leading-relaxed pl-6">{detailModal.rec.activity_and_stimulation}</p>
                      </div>
                    )}
                  </div>

                  {detailModal.rec.action_steps && detailModal.rec.action_steps.length > 0 && (
                    <div className="p-4 bg-subtle border border-line rounded-xl space-y-2">
                      <p className="text-sm font-bold text-heading">Langkah Tindakan Kader Posyandu:</p>
                      <ul className="text-sm text-body space-y-1.5 pl-5 list-disc">
                        {detailModal.rec.action_steps.map((step, sIdx) => (
                          <li key={sIdx} className="leading-relaxed">
                            {step}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {detailModal.rec.citation && (
                    <div className="p-3.5 bg-subtle rounded-xl border border-line flex items-center gap-2 text-xs sm:text-sm text-caption">
                      <BookOpen className="w-4 h-4 text-sky-500 shrink-0" />
                      <span>
                        Rujukan Resmi: <strong>{cleanCitation(detailModal.rec.citation.source)}</strong> &bull;{" "}
                        {detailModal.rec.citation.section} (Hal. {detailModal.rec.citation.page})
                      </span>
                    </div>
                  )}
                </>
              )}

              {detailModal.type === "care_food" && detailModal.data && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div className="p-3.5 bg-subtle rounded-xl border border-line space-y-1">
                      <span className="font-bold text-heading block">Tekstur & Konsistensi:</span>
                      <p className="text-body leading-relaxed">
                        {detailModal.data.texture_and_consistency || detailModal.data.stage_and_texture}
                      </p>
                    </div>
                    <div className="p-3.5 bg-subtle rounded-xl border border-line space-y-1">
                      <span className="font-bold text-heading block">Frekuensi & Takaran Porsi:</span>
                      <p className="text-body leading-relaxed">{detailModal.data.frequency_and_portion}</p>
                    </div>
                  </div>

                  {Array.isArray(detailModal.data.local_ingredients) && (
                    <div className="space-y-2">
                      <p className="text-sm font-bold text-heading">
                        Bahan Pangan Lokal Bergizi (Minahasa Utara):
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {detailModal.data.local_ingredients.map((item, idx) => (
                          <span
                            key={idx}
                            className="px-3 py-1 rounded-md text-xs font-medium bg-subtle text-heading border border-line"
                          >
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {Array.isArray(detailModal.data.sample_daily_menu) && (
                    <div className="space-y-2">
                      <p className="text-sm font-bold text-heading">Contoh Jadwal Menu Harian Lengkap:</p>
                      <div className="border border-line rounded-xl overflow-hidden">
                        <table className="w-full text-sm text-left">
                          <thead className="bg-subtle text-caption text-xs font-semibold border-b border-line uppercase tracking-wider">
                            <tr>
                              <th className="p-3 w-44">Waktu Pemberian</th>
                              <th className="p-3">Menu Makanan & Takaran Rumah Tangga</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-line-light">
                            {detailModal.data.sample_daily_menu.map((row, rIdx) => (
                              <tr key={rIdx} className="hover:bg-subtle/60">
                                <td className="p-3 font-semibold text-heading">
                                  {row.time || row.waktu}
                                </td>
                                <td className="p-3 text-body leading-relaxed">{row.menu}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}

              {detailModal.type === "care_milk" && detailModal.data && (
                <>
                  {detailModal.data.compliance_badge && (
                    <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-semibold text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{detailModal.data.compliance_badge}</span>
                    </div>
                  )}

                  <div className="p-4 bg-subtle rounded-xl border border-line space-y-1">
                    <span className="text-xs font-medium text-caption">
                      Sumber Utama ASI / Susu & Suplementasi
                    </span>
                    <p className="text-sm sm:text-base font-semibold text-heading leading-relaxed">
                      {detailModal.data.primary_source || detailModal.data.recommended_type}
                    </p>
                  </div>

                  {Array.isArray(detailModal.data.guidelines || detailModal.data.safety_notes) && (
                    <div className="space-y-2">
                      <p className="text-sm font-bold text-heading">Panduan Pemberian & Aturan Medis:</p>
                      <ul className="text-sm text-body space-y-2 pl-5 list-disc">
                        {(detailModal.data.guidelines || detailModal.data.safety_notes).map((g, gIdx) => (
                          <li key={gIdx} className="leading-relaxed">
                            {g}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {(detailModal.data.medical_warning || detailModal.data.clinical_rationale) && (
                    <div className="p-4 bg-subtle border border-line rounded-xl text-sm text-body">
                      <strong className="text-heading block mb-1">Rasional Klinis & Keamanan Medis:</strong>
                      {detailModal.data.medical_warning || detailModal.data.clinical_rationale}
                    </div>
                  )}
                </>
              )}

              {detailModal.type === "care_activity" && detailModal.data && (
                <>
                  <div className="space-y-2">
                    <p className="text-sm font-bold text-heading">
                      Rekomendasi Aktivitas Fisik & Stimulasi Tumbuh Kembang Harian:
                    </p>
                    <ul className="text-sm text-body space-y-2 pl-5 list-disc">
                      {(
                        detailModal.data.daily_activities ||
                        detailModal.data.recommended_activities ||
                        []
                      ).map((act, aIdx) => (
                        <li key={aIdx} className="leading-relaxed">
                          {act}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {detailModal.data.rest_and_sleep && (
                    <div className="p-4 bg-subtle border border-line rounded-xl text-sm text-body">
                      <strong className="text-heading block mb-1">Kebutuhan Tidur & Istirahat Harian:</strong>
                      {detailModal.data.rest_and_sleep}
                    </div>
                  )}
                </>
              )}

              {detailModal.type === "care_danger" && Array.isArray(detailModal.dangerSigns) && (
                <div className="p-4 bg-subtle border border-line rounded-xl space-y-2.5">
                  <p className="text-sm font-bold text-heading flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                    <span>Segera Rujuk ke Puskesmas Airmadidi Apabila Ditemukan Tanda Berikut:</span>
                  </p>
                  <ul className="text-sm text-body space-y-2 pl-6 list-disc">
                    {detailModal.dangerSigns.map((ds, dIdx) => (
                      <li key={dIdx} className="leading-relaxed">
                        {ds}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {detailModal.type === "agent_telemetry" && detailModal.agent && (
                <div className="space-y-4">
                  {/* Klasifikasi Peran & Kompleksitas */}
                  <div className="p-4 bg-subtle rounded-xl border border-line space-y-1.5">
                    <p className="text-xs font-bold uppercase tracking-wider text-caption">
                      Klasifikasi Peran & Tingkat Kompleksitas
                    </p>
                    <p className="text-sm font-bold text-heading">{detailModal.agent.complexity_rank}</p>
                    <p className="text-sm text-body leading-relaxed">{detailModal.agent.complexity_reason}</p>
                  </div>

                  {/* Bukti Siklus Hidup (Agent Lifetime) */}
                  <div className="p-4 bg-subtle rounded-xl border border-line space-y-2.5">
                    <p className="text-xs font-bold uppercase tracking-wider text-caption">
                      Bukti Siklus Hidup Agent (Lifetime: Selesai Tugas = Selesai Hidup)
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs font-mono">
                      <div className="p-2.5 bg-card rounded-lg border border-line">
                        <span className="text-caption block font-sans">Waktu Spawn (Mulai):</span>
                        <span className="font-semibold text-heading">{detailModal.agent.spawned_at || "-"}</span>
                      </div>
                      <div className="p-2.5 bg-card rounded-lg border border-line">
                        <span className="text-caption block font-sans">Waktu Terminasi (Selesai):</span>
                        <span className="font-semibold text-heading">{detailModal.agent.terminated_at || "-"}</span>
                      </div>
                      <div className="p-2.5 bg-card rounded-lg border border-line">
                        <span className="text-caption block font-sans">Durasi Hidup (Lifetime):</span>
                        <span className="font-semibold text-heading">{detailModal.agent.lifetime_ms ?? 0} ms</span>
                      </div>
                    </div>
                    <p className="text-xs text-caption">
                      Status Akhir: <strong className="text-heading">{detailModal.agent.lifecycle_state}</strong>
                    </p>
                  </div>

                  {/* Bukti Konsumsi Token */}
                  <div className="p-4 bg-subtle rounded-xl border border-line space-y-2.5">
                    <p className="text-xs font-bold uppercase tracking-wider text-caption">
                      Rincian Konsumsi Token Agent
                    </p>
                    <div className="grid grid-cols-3 gap-2.5 text-xs font-mono">
                      <div className="p-2.5 bg-card rounded-lg border border-line">
                        <span className="text-caption block font-sans">Input (Prompt):</span>
                        <span className="text-sm font-bold text-heading">
                          {detailModal.agent.token_usage?.input_tokens ?? 0} tok
                        </span>
                      </div>
                      <div className="p-2.5 bg-card rounded-lg border border-line">
                        <span className="text-caption block font-sans">Output (Completion):</span>
                        <span className="text-sm font-bold text-heading">
                          {detailModal.agent.token_usage?.output_tokens ?? 0} tok
                        </span>
                      </div>
                      <div className="p-2.5 bg-card rounded-lg border border-line">
                        <span className="text-caption block font-sans">Total Token:</span>
                        <span className="text-sm font-bold text-heading">
                          {detailModal.agent.token_usage?.total_tokens ?? 0} tok
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-caption">
                      Sumber Pencatatan: <strong className="text-heading">{detailModal.agent.token_usage?.source || "-"}</strong>
                      {detailModal.agent.token_usage?.estimated_saved_tokens > 0 && (
                        <span>
                          {" "}&bull; Penghematan Mode Deterministik/Single-Pass:{" "}
                          <strong className="text-heading">
                            ~{detailModal.agent.token_usage.estimated_saved_tokens} token dihemat
                          </strong>
                        </span>
                      )}
                    </p>
                  </div>

                  {/* Bukti Kerja Sesuai Tugas (Tools & Input/Output) */}
                  <div className="p-4 bg-subtle rounded-xl border border-line space-y-2.5">
                    <p className="text-xs font-bold uppercase tracking-wider text-caption">
                      Bukti Agent Bekerja Sesuai Tugas (Tools & Jejak Eksekusi)
                    </p>
                    <div className="space-y-1.5 text-sm">
                      <p className="text-body">
                        <strong className="text-heading">Input Diterima:</strong>{" "}
                        {detailModal.agent.task_proof?.input_summary || "-"}
                      </p>
                      <p className="text-body">
                        <strong className="text-heading">Output Dihasilkan:</strong>{" "}
                        {detailModal.agent.task_proof?.output_summary || "-"}
                      </p>
                    </div>

                    {Array.isArray(detailModal.agent.tools_invoked) && detailModal.agent.tools_invoked.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        <p className="text-xs font-bold text-heading">Fungsi / Tools yang Dipanggil:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {detailModal.agent.tools_invoked.map((tl, tIdx) => (
                            <span
                              key={tIdx}
                              className="px-2.5 py-1 rounded-md text-xs font-mono bg-card text-heading border border-line"
                            >
                              {tl}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {Array.isArray(detailModal.agent.thought_process) && detailModal.agent.thought_process.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        <p className="text-xs font-bold text-heading">Jejak Penalaran (ReAct Thought Process):</p>
                        <ul className="text-xs text-body space-y-1 pl-4 list-disc">
                          {detailModal.agent.thought_process.map((tp, tpIdx) => (
                            <li key={tpIdx}>{tp}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {detailModal.type === "pipeline_telemetry" && detailModal.telemetry && (
                <div className="space-y-4">
                  {/* Bukti 1: Alur Utama Sequential */}
                  <div className="p-4 bg-subtle rounded-xl border border-line space-y-2.5">
                    <p className="text-xs font-bold uppercase tracking-wider text-caption">
                      1. Bukti Eksekusi Sequential (Pipeline Utama LangGraph)
                    </p>
                    <p className="text-sm text-body leading-relaxed">
                      {detailModal.telemetry.architecture_pattern?.sequential_proof}
                    </p>
                    <div className="space-y-2 pt-1">
                      {["agent_1", "agent_2", "agent_3"].map((k, idx) => {
                        const a = detailModal.telemetry.agents?.[k];
                        if (!a) return null;
                        return (
                          <div
                            key={k}
                            className="p-3 bg-card rounded-lg border border-line flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                          >
                            <div>
                              <span className="font-bold text-heading">
                                Step #{idx + 1}: {a.agent_name}
                              </span>
                              <p className="text-caption">{a.complexity_rank}</p>
                            </div>
                            <div className="font-mono text-right shrink-0">
                              <span className="text-heading font-semibold block">
                                {a.spawned_at} → {a.terminated_at}
                              </span>
                              <span className="text-caption">
                                Lifetime: {a.lifetime_ms} ms &bull; Token: {a.token_usage?.total_tokens ?? 0}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Bukti 2: Alur Evaluator Parallel */}
                  <div className="p-4 bg-subtle rounded-xl border border-line space-y-2.5">
                    <p className="text-xs font-bold uppercase tracking-wider text-caption">
                      2. Bukti Eksekusi Parallel (Independent Audit Evaluator Threads)
                    </p>
                    <p className="text-xs text-caption leading-relaxed">
                      Setelah laporan selesai di Agent 3, sistem menjalankan 3 worker thread secara paralel (konkuren) menggunakan{" "}
                      <code className="font-mono text-heading">ThreadPoolExecutor(max_workers=3)</code> untuk mengaudit kepatuhan Agent 1, 2, dan 3:
                    </p>
                    <div className="space-y-2">
                      {(detailModal.telemetry.parallel_evaluator_logs || []).map((pl, pIdx) => (
                        <div key={pIdx} className="p-3 bg-card rounded-lg border border-line space-y-1 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-heading">
                              [{pl.worker_thread || `ParallelEval_${pIdx}`}] {pl.agent_name}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-subtle text-heading border border-line font-semibold">
                              {pl.is_compliant ? "PATUH (VALID)" : "DEVIASI"}
                            </span>
                          </div>
                          <p className="text-body leading-relaxed">{pl.evaluation_notes}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Bukti 3: Kebijakan Lifetime & Memori */}
                  <div className="p-4 bg-subtle rounded-xl border border-line space-y-1.5">
                    <p className="text-xs font-bold uppercase tracking-wider text-caption">
                      3. Kebijakan Lifetime Agent & Checkpointer State
                    </p>
                    <p className="text-sm text-body leading-relaxed">
                      {detailModal.telemetry.architecture_pattern?.agent_lifetime_policy}
                    </p>
                    <p className="text-xs text-caption pt-1">
                      Status Thread Saat Ini:{" "}
                      <strong className="text-heading">
                        {detailModal.telemetry.architecture_pattern?.thread_checkpoint_status}
                      </strong>
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 sm:p-5 border-t border-line bg-subtle flex justify-end">
              <button
                type="button"
                onClick={() => setDetailModal(null)}
                className="px-4 py-2 bg-card hover:bg-muted text-heading border border-line rounded-xl text-sm font-semibold cursor-pointer transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

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
            className="bg-card rounded-2xl max-w-md w-full p-6 border border-line shadow-prominent space-y-4 animate-scale-in"
          >
            <div className="flex justify-between items-center">
              <h3 id="modal-reject-title" className="text-base font-bold text-heading">
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

            <p className="text-sm text-caption leading-relaxed">
              Sistem akan menjalankan 1 kali perulangan graf LangGraph dengan menyertakan konteks koreksi yang Anda masukkan.
            </p>

            <form onSubmit={handleReject} className="space-y-4">
              <div>
                <label htmlFor="rejection-reason" className="block text-sm font-bold text-label mb-1.5">
                  Catatan Perbaikan Kader <span className="text-rose-500">*</span>
                </label>
                <textarea
                  id="rejection-reason"
                  required
                  rows="4"
                  placeholder="Contoh: Pasien memiliki alergi telur, ganti menu MP-ASI menjadi ikan gabus/hati ayam..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full p-3 bg-subtle border border-line rounded-xl text-sm text-heading placeholder:text-dim focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500 transition-all"
                />
              </div>

              <div className="flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowRejectModal(false)}
                  className="px-4 py-2 border border-line rounded-xl text-sm font-semibold text-label hover:bg-muted transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="btn-interactive px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-sm font-semibold shadow-xs transition-all cursor-pointer disabled:opacity-50"
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
