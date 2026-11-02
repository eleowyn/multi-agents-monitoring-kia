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
  Star,
  ClipboardList,
  Utensils,
  Droplets,
  Baby,
  ChevronRight,
  ChevronDown,
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

const formatIndicator = (ind) => {
  if (!ind) return "";
  const map = {
    PB_U: "Panjang/Tinggi Badan (PB/U)",
    BB_U: "Berat Badan menurut Umur (BB/U)",
    BB_PB: "Status Gizi Akut (BB/PB)",
    LONGITUDINAL_MATERNAL_KEK: "Faktor Risiko Transmisi Maternal (1.000 HPK)",
    LONGITUDINAL_MATERNAL_ANEMIA: "Faktor Risiko Transmisi Maternal (1.000 HPK)",
    LONGITUDINAL_MATERNAL_KSPR: "Faktor Risiko Transmisi Maternal (1.000 HPK)",
    LONGITUDINAL_BBLR: "Riwayat Kelahiran (BBLR)",
    LONGITUDINAL_WEIGHT_TREND: "Tren Kenaikan Berat Badan (KMS)",
    POLA_MAKAN_MPASI: "Pola Makan / Asupan MP-ASI",
    LILA: "Lingkar Lengan Atas (LiLA)",
    LILA_KEK: "Lingkar Lengan Atas (LiLA)",
    HB: "Kadar Hemoglobin (Hb)",
    TEKANAN_DARAH: "Tekanan Darah",
    IMD: "Inisiasi Menyusu Dini (IMD)",
    LINGKAR_KEPALA: "Lingkar Kepala",
    BERAT_LAHIR: "Berat Bayi Lahir (BBLR)",
    USIA_GESTASI: "Usia Gestasi Kelahiran",
    USIA_KEHAMILAN_LAHIR: "Usia Gestasi Kelahiran",
  };
  return map[ind] || ind.replace(/_/g, " ");
};

const humanRisk = (flag) => {
  const map = {
    RISIKO_KEHAMILAN_SANGAT_TINGGI_KRST: "Kehamilan Risiko Sangat Tinggi (KRST)",
    RISIKO_KEHAMILAN_TINGGI_KRT: "Kehamilan Risiko Tinggi (KRT)",
    KEHAMILAN_RISIKO_RENDAH_KRR: "Kehamilan Risiko Rendah (KRR)",
    STUNTING_SEVERELY_STUNTED: "Sangat Pendek / Severely Stunted",
    STUNTING_STUNTED: "Pendek / Stunted",
    RISIKO_STUNTING_BERAT: "Sangat Pendek (PB/U < -3 SD)",
    RISIKO_STUNTING: "Pendek (PB/U < -2 SD)",
    SANGAT_PENDEK: "Sangat Pendek (PB/U < -3 SD)",
    PENDEK: "Pendek (PB/U < -2 SD)",
    GIZI_BURUK_SEVERELY_UNDERWEIGHT: "BB Sangat Kurang",
    GIZI_KURANG_UNDERWEIGHT: "BB Kurang / Underweight",
    RISIKO_UNDERWEIGHT: "Risiko BB Kurang / Underweight",
    BB_KURANG: "Berat Badan Kurang / Underweight",
    BB_SANGAT_KURANG: "Berat Badan Sangat Kurang",
    RISIKO_GIZI_BURUK: "Gizi Buruk / Severely Wasted",
    RISIKO_GIZI_KURANG: "Gizi Kurang / Wasted",
    WASTING_SEVERELY_WASTED: "Gizi Buruk / Severely Wasted",
    WASTING_WASTED: "Gizi Kurang / Wasted",
    GIZI_BURUK: "Gizi Buruk / Severely Wasted",
    GIZI_KURANG: "Gizi Kurang / Wasted",
    ANEMIA_BERAT: "Anemia Berat (Hb < 8.0 g/dL)",
    ANEMIA_SEDANG: "Anemia Sedang (Hb 8.0 - 9.9 g/dL)",
    ANEMIA_RINGAN: "Anemia Ringan (Hb 10.0 - 10.9 g/dL)",
    RISIKO_ANEMIA_BERAT: "Anemia Berat Maternal",
    RISIKO_ANEMIA_SEDANG: "Anemia Sedang Maternal",
    RISIKO_ANEMIA_RINGAN: "Anemia Ringan Maternal",
    RISIKO_KEK: "Kurang Energi Kronis (LiLA < 23.5 cm)",
    RISIKO_KEK_MATERNAL: "Kurang Energi Kronis (LiLA < 23.5 cm)",
    BBLR: "Berat Bayi Lahir Rendah (< 2.500 g)",
    RISIKO_BBLR: "Berat Bayi Lahir Rendah (< 2.500 g)",
    BBLSR: "Berat Bayi Lahir Sangat Rendah (< 1.500 g)",
    PREMATUR: "Kelahiran Prematur (< 37 Minggu)",
    RISIKO_PREMATUR: "Kelahiran Prematur (< 37 Minggu)",
    BB_TIDAK_NAIK_KMS: "Berat Badan Tidak Naik (KMS)",
    BB_TIDAK_NAIK_2T: "Berat Badan Tidak Naik 2x Berturut-turut (2T)",
    BB_IBU_HAMIL_TURUN: "Penurunan Berat Badan Ibu Hamil",
    RIWAYAT_IBU_KEK: "Riwayat Ibu KEK Saat Hamil",
    RIWAYAT_IBU_ANEMIA: "Riwayat Ibu Anemia Saat Hamil",
    RIWAYAT_KEHAMILAN_RISIKO_TINGGI: "Riwayat Risiko Obstetri KRT (KSPR)",
    RIWAYAT_BBLR_ANAK: "Riwayat Lahir BBLR (< 2.500 g)",
    MIKROSEFALI: "Mikrosefali (< 33 cm Lingkar Kepala)",
    MAKROSEFALI: "Makrosefali (> 37 cm Lingkar Kepala)",
    MPASI_KURANG_ADEKUAT: "MP-ASI Kurang Adekuat / Defisit Protein Hewani",
    IMD_TIDAK_DILAKUKAN: "IMD Tidak Dilakukan Saat Lahir",
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
  const [checkedSteps, setCheckedSteps] = useState({});
  const [expandedReferences, setExpandedReferences] = useState({});

  const toggleStep = (recIdx, stepIdx) => {
    setCheckedSteps(prev => ({
      ...prev,
      [`${recIdx}-${stepIdx}`]: !prev[`${recIdx}-${stepIdx}`]
    }));
  };

  const toggleEducationChecked = (recIdx) => {
    setCheckedSteps(prev => ({
      ...prev,
      [`rec-${recIdx}`]: !prev[`rec-${recIdx}`]
    }));
  };

  const toggleReference = (recIdx) => {
    setExpandedReferences(prev => ({
      ...prev,
      [recIdx]: !prev[recIdx]
    }));
  };
  const [openThoughts, setOpenThoughts] = useState({});
  const toggleThought = (recIdx) => {
    setOpenThoughts(prev => ({
      ...prev,
      [recIdx]: !prev[recIdx]
    }));
  };
  const [ratingScore, setRatingScore] = useState(0);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [ratingLoading, setRatingLoading] = useState(false);

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
      if (res.data?.kader_rating) {
        setRatingScore(res.data.kader_rating);
        setRatingSubmitted(true);
      }
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
  const confidence = finalJson.confidence || null;

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
    <div className="p-3 sm:p-5 lg:p-6 max-w-6xl mx-auto space-y-4 animate-fade-in print:p-0 print:max-w-full">
      {/* ─── Stylesheet Khusus Cetak A4 (@media print) ─── */}
      <style>{`
        @media print {
          nav, header, aside, .no-print, button, input[type="checkbox"], [role="dialog"] {
            display: none !important;
          }
          body, html {
            background: #ffffff !important;
            color: #0f172a !important;
            font-size: 9.5pt !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .a4-print-sheet {
            max-width: 100% !important;
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .break-inside-avoid {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
        }
      `}</style>

      {/* Top Navigation Bar */}
      <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-line">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-bold text-heading tracking-tight">
              Rincian Lembar Pemantauan KIA
            </h1>
            {isAdmin && (
              <span className="px-2.5 py-0.5 rounded-md text-xs font-medium bg-subtle text-label border border-line">
                Mode Tinjau Admin
              </span>
            )}
          </div>
          <p className="text-sm text-caption mt-1">
            Lembar Hasil Pemantauan Pertumbuhan & Asuhan KIA (1.000 HPK) &bull; Posyandu Puskesmas Airmadidi
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
      <div className="a4-print-sheet bg-card rounded-2xl border border-line shadow-card overflow-hidden">
        {/* ─── Kop Surat Kedinasan Puskesmas (Format Resmi A4) ─── */}
        <div className="hidden print:block p-6 sm:p-8 border-b-2 border-slate-800 dark:border-slate-300 bg-card text-center space-y-2">
          <div className="flex items-center justify-between gap-4">
            <div className="w-14 h-14 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 flex items-center justify-center shrink-0">
              <Activity className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="flex-1 space-y-1 text-center">
              <h4 className="text-xs sm:text-sm font-semibold tracking-wider uppercase text-caption">
                Pemerintah Kabupaten Minahasa Utara &bull; Dinas Kesehatan
              </h4>
              <h2 className="text-base sm:text-xl font-bold uppercase tracking-wide text-heading">
                Puskesmas Airmadidi &bull; Posyandu KIA
              </h2>
              <p className="text-xs text-caption">
                Kecamatan Airmadidi, Kabupaten Minahasa Utara, Sulawesi Utara &bull; Layanan Terpadu 1.000 HPK
              </p>
            </div>
            <div className="w-14 h-14 rounded-full bg-sky-50 dark:bg-sky-950/40 border border-sky-300 dark:border-sky-800 hidden sm:flex items-center justify-center shrink-0">
              <BookOpen className="w-7 h-7 text-sky-600 dark:text-sky-400" />
            </div>
          </div>
          <div className="pt-3 border-t border-line-light mt-3">
            <span className="text-xs sm:text-sm font-bold uppercase tracking-widest text-heading block">
              Lembar Rekam Pemantauan Tumbuh Kembang KIA (1.000 HPK)
            </span>
          </div>
        </div>

        {/* Patient Header */}
        <div className="p-4 sm:p-5 bg-subtle border-b border-line flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
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
        <div className="p-4 sm:p-5 grid grid-cols-2 sm:grid-cols-4 gap-3 border-b border-line bg-card text-xs sm:text-sm">
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
            <p className="text-xs text-caption font-medium">Batas Permohonan Revisi</p>
            <p className="text-sm sm:text-base font-semibold text-heading mt-1">
              {revisionCount} / 1 kali revisi
            </p>
          </div>
          {confidence && (
            <div>
              <p className="text-xs text-caption font-medium">Tingkat Kesesuaian Klinis</p>
              <div className="flex items-center gap-1.5 mt-1">
                <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${
                  confidence.confidence_label === "TINGGI"
                    ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
                    : confidence.confidence_label === "SEDANG"
                    ? "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800"
                    : "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800"
                }`}>
                  {confidence.confidence_score}% &bull; {confidence.confidence_label}
                </span>
              </div>
            </div>
          )}
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

        {/* ─── Parameter Pengukuran Antropometri & Fisik Kunjungan (Grid Rapi & Konsisten) ─── */}
        {visitData.phase && (
          <div className="p-4 sm:p-5 border-b border-line bg-subtle/30 space-y-3.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2 text-heading">
                <Activity className="w-4 h-4 text-sky-600" />
                <span>Hasil Pengukuran Fisik Kunjungan</span>
              </h3>
              <span className="text-xs text-caption font-medium">
                {humanPhase(visitData.phase)} &bull; {visitData.visit_date || "-"}
              </span>
            </div>

            {visitData.phase === "IBU_HAMIL" && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 bg-card border border-line rounded-xl flex flex-col justify-between h-24">
                  <span className="text-xs font-medium text-caption uppercase tracking-wide">Usia Kehamilan</span>
                  <p className="text-lg font-bold text-heading tabular-nums">
                    {visitData.gestational_age_weeks ? `${visitData.gestational_age_weeks} mg` : "-"}
                  </p>
                  <span className="text-xs text-dim">Trimester {visitData.trimester || "-"}</span>
                </div>
                <div className="p-3.5 bg-card border border-line rounded-xl flex flex-col justify-between h-24">
                  <span className="text-xs font-medium text-caption uppercase tracking-wide">Berat Badan Ibu</span>
                  <p className="text-lg font-bold text-heading tabular-nums">
                    {visitData.maternal_weight_kg ? `${visitData.maternal_weight_kg} kg` : "-"}
                  </p>
                  <span className="text-xs text-dim">TB: {visitData.maternal_height_cm || "-"} cm</span>
                </div>
                <div className="p-3.5 bg-card border border-line rounded-xl flex flex-col justify-between h-24">
                  <span className="text-xs font-medium text-caption uppercase tracking-wide">Lingkar LiLA</span>
                  <p className="text-lg font-bold text-heading tabular-nums">
                    {visitData.lila_cm ? `${visitData.lila_cm} cm` : "-"}
                  </p>
                  <span className="text-xs text-dim">Batas normal ≥ 23.5 cm</span>
                </div>
                <div className="p-3.5 bg-card border border-line rounded-xl flex flex-col justify-between h-24">
                  <span className="text-xs font-medium text-caption uppercase tracking-wide">Hemoglobin (Hb)</span>
                  <p className="text-lg font-bold text-heading tabular-nums">
                    {visitData.hb_level ? `${visitData.hb_level} g/dL` : "-"}
                  </p>
                  <span className="text-xs text-dim">Batas normal ≥ 11.0 g/dL</span>
                </div>
                <div className="p-3.5 bg-card border border-line rounded-xl flex flex-col justify-between h-24">
                  <span className="text-xs font-medium text-caption uppercase tracking-wide">Tekanan Darah</span>
                  <p className="text-lg font-bold text-heading tabular-nums">
                    {visitData.systolic_bp || "-"}/{visitData.diastolic_bp || "-"} <span className="text-xs font-normal text-dim">mmHg</span>
                  </p>
                  <span className="text-xs text-dim">Normal &lt; 140/90</span>
                </div>
                <div className="p-3.5 bg-card border border-line rounded-xl flex flex-col justify-between h-24">
                  <span className="text-xs font-medium text-caption uppercase tracking-wide">Tinggi Fundus</span>
                  <p className="text-lg font-bold text-heading tabular-nums">
                    {visitData.fundal_height_cm ? `${visitData.fundal_height_cm} cm` : "-"}
                  </p>
                  <span className="text-xs text-dim">Fundus Uteri (TFU)</span>
                </div>
                <div className="p-3.5 bg-card border border-line rounded-xl flex flex-col justify-between h-24">
                  <span className="text-xs font-medium text-caption uppercase tracking-wide">Kepatuhan TTD</span>
                  <p className="text-lg font-bold text-heading">
                    {visitData.ttd_consumption === "RUTIN" ? "Rutin (≥30)" : visitData.ttd_consumption === "TIDAK_RUTIN" ? "Tidak Rutin" : (visitData.ttd_consumption || "Rutin")}
                  </p>
                  <span className="text-xs text-dim">Tablet Tambah Darah</span>
                </div>
                <div className="p-3.5 bg-card border border-line rounded-xl flex flex-col justify-between h-24">
                  <span className="text-xs font-medium text-caption uppercase tracking-wide">Status Imunisasi</span>
                  <p className="text-base font-bold text-heading truncate">
                    {visitData.immunization_status || "Tetanus Lengkap"}
                  </p>
                  <span className="text-xs text-dim">Skrining TT Ibu</span>
                </div>
              </div>
            )}

            {visitData.phase === "BAYI_BARU_LAHIR" && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 bg-card border border-line rounded-xl flex flex-col justify-between h-24">
                  <span className="text-xs font-medium text-caption uppercase tracking-wide">Berat Lahir</span>
                  <p className="text-lg font-bold text-heading tabular-nums">
                    {visitData.birth_weight_gram ? `${visitData.birth_weight_gram} gram` : "-"}
                  </p>
                  <span className="text-xs text-dim">Batas normal ≥ 2500g</span>
                </div>
                <div className="p-3.5 bg-card border border-line rounded-xl flex flex-col justify-between h-24">
                  <span className="text-xs font-medium text-caption uppercase tracking-wide">Panjang Lahir</span>
                  <p className="text-lg font-bold text-heading tabular-nums">
                    {visitData.birth_length_cm ? `${visitData.birth_length_cm} cm` : "-"}
                  </p>
                  <span className="text-xs text-dim">Panjang Badan Neonatus</span>
                </div>
                <div className="p-3.5 bg-card border border-line rounded-xl flex flex-col justify-between h-24">
                  <span className="text-xs font-medium text-caption uppercase tracking-wide">Lingkar Kepala</span>
                  <p className="text-lg font-bold text-heading tabular-nums">
                    {visitData.head_circumference_cm ? `${visitData.head_circumference_cm} cm` : "-"}
                  </p>
                  <span className="text-xs text-dim">Rentang 33 - 35 cm</span>
                </div>
                <div className="p-3.5 bg-card border border-line rounded-xl flex flex-col justify-between h-24">
                  <span className="text-xs font-medium text-caption uppercase tracking-wide">Inisiasi Menyusu (IMD)</span>
                  <p className="text-base font-bold text-heading">
                    {visitData.early_initiation_breastfeeding || "-"}
                  </p>
                  <span className="text-xs text-dim">Dalam 1 jam pertama</span>
                </div>
              </div>
            )}

            {visitData.phase === "BADUTA" && (
              <div className="space-y-3">
                {/* 4 Kartu Pengukuran Utama */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3.5 bg-card border border-line rounded-xl flex flex-col justify-between h-24">
                    <span className="text-xs font-medium text-caption uppercase tracking-wide">Usia Anak</span>
                    <p className="text-lg font-bold text-heading tabular-nums">
                      {visitData.age_in_months !== undefined && visitData.age_in_months !== null ? `${visitData.age_in_months} Bulan` : "-"}
                    </p>
                    <span className="text-xs text-dim">Fase Baduta 1.000 HPK</span>
                  </div>
                  <div className="p-3.5 bg-card border border-line rounded-xl flex flex-col justify-between h-24">
                    <span className="text-xs font-medium text-caption uppercase tracking-wide">Berat Badan (BB)</span>
                    <p className="text-lg font-bold text-heading tabular-nums">
                      {visitData.child_weight_kg ? `${visitData.child_weight_kg} kg` : "-"}
                    </p>
                    <span className="text-xs text-dim">Timbangan Meja 2 Posyandu</span>
                  </div>
                  <div className="p-3.5 bg-card border border-line rounded-xl flex flex-col justify-between h-24">
                    <span className="text-xs font-medium text-caption uppercase tracking-wide">Panjang Badan (PB/TB)</span>
                    <p className="text-lg font-bold text-heading tabular-nums">
                      {visitData.child_length_cm ? `${visitData.child_length_cm} cm` : "-"}
                    </p>
                    <span className="text-xs text-dim">Pengukuran Alat Stadiometer</span>
                  </div>
                  <div className="p-3.5 bg-card border border-line rounded-xl flex flex-col justify-between h-24">
                    <span className="text-xs font-medium text-caption uppercase tracking-wide">Lingkar Kepala</span>
                    <p className="text-lg font-bold text-heading tabular-nums">
                      {visitData.child_head_circumference_cm ? `${visitData.child_head_circumference_cm} cm` : "-"}
                    </p>
                    <span className="text-xs text-dim">Pita Ukur Nellhaus</span>
                  </div>
                </div>

                {/* 4 Kartu Parameter Klinis & KMS Tambahan */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3.5 bg-card border border-line rounded-xl flex flex-col justify-between h-24">
                    <span className="text-xs font-medium text-caption uppercase tracking-wide">Tren Kenaikan (KMS)</span>
                    <p className="text-base font-bold text-heading">
                      {visitData.weight_trend_kms || "Normal (N)"}
                    </p>
                    <span className="text-xs text-dim">Evaluasi Kartu Menuju Sehat</span>
                  </div>
                  <div className="p-3.5 bg-card border border-line rounded-xl flex flex-col justify-between h-24">
                    <span className="text-xs font-medium text-caption uppercase tracking-wide">Pemberian ASI</span>
                    <p className="text-base font-bold text-heading truncate">
                      {visitData.breastfeeding_type || visitData.feeding_status || "ASI Lanjutan"}
                    </p>
                    <span className="text-xs text-dim">Status Nutrisi Susu</span>
                  </div>
                  <div className="p-3.5 bg-card border border-line rounded-xl flex flex-col justify-between h-24">
                    <span className="text-xs font-medium text-caption uppercase tracking-wide">Kapsul Vitamin A</span>
                    <p className="text-base font-bold text-heading">
                      {visitData.vitamin_a || "Sesuai Jadwal"}
                    </p>
                    <span className="text-xs text-dim">Periode Feb / Agu</span>
                  </div>
                  <div className="p-3.5 bg-card border border-line rounded-xl flex flex-col justify-between h-24">
                    <span className="text-xs font-medium text-caption uppercase tracking-wide">Imunisasi Terkini</span>
                    <p className="text-base font-bold text-heading truncate">
                      {visitData.immunization_status || "Lengkap Sesuai Usia"}
                    </p>
                    <span className="text-xs text-dim">Buku KIA Standar</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── Rekam Jejak Longitudinal 1.000 HPK ─── */}
        {(hpkStatus || maternalHistory || comparisonItems.length > 0) && (
          <div className="p-4 sm:p-5 border-b border-line bg-card space-y-3">
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
                      <span className="text-xs font-bold uppercase tracking-wider text-caption">Milestone Hari ke-1.000</span>
                      <h4 className="text-sm sm:text-base font-bold text-heading">
                        Kelulusan Periode Emas 1.000 HPK (Usia 24 Bulan)
                      </h4>
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${carePlan?.graduation_package?.status_type === "ALERT" ? "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-900/60 dark:text-rose-200" : "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/60 dark:text-emerald-200"}`}>
                    {carePlan?.graduation_package?.status_badge || "Lulus Periode Emas 1.000 HPK"}
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
                      <p className="text-xs text-caption leading-relaxed">
                        Prinsip <em>Weaning with Love</em> bertahap tanpa zat pahit/paksaan, beralih ke cangkir/gelas.
                      </p>
                    </div>
                    <div className="p-3 bg-card border border-line rounded-xl space-y-1">
                      <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                        🍽️ Nutrisi Balita 2–5 Tahun
                      </p>
                      <p className="text-xs text-caption leading-relaxed">
                        3x makan keluarga (Isi Piringku Balita) + 2x selingan protein hewani lokal (ikan tude/telur).
                      </p>
                    </div>
                    <div className="p-3 bg-card border border-line rounded-xl space-y-1">
                      <p className="text-xs font-bold text-indigo-700 dark:text-indigo-400">
                        🧩 Skrining KPSP 24 Bulan
                      </p>
                      <p className="text-xs text-caption leading-relaxed">
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

        {/* ─── Body Sections: Rekam Medis & Asuhan KIA Puskesmas (Format A4) ─── */}
        <div className="p-4 sm:p-5 space-y-5 bg-subtle/20 border-t border-line">
          {/* Ringkasan Evaluasi Medis */}
          <div className="p-5 bg-card border-2 border-line rounded-2xl space-y-2 shadow-xs break-inside-avoid">
            <div className="flex items-center justify-between border-b border-line pb-2.5">
              <span className="font-bold text-xs uppercase tracking-wider text-caption">
                Ringkasan Evaluasi Klinis & Pertumbuhan
              </span>
              <span className="text-xs text-caption font-medium">Sintesis Rekam Medis Posyandu</span>
            </div>
            <p className="text-sm sm:text-base text-body leading-relaxed pt-1">
              {finalJson.executive_summary}
            </p>
          </div>

          {/* ═══ BAGIAN I: HASIL PENGUKURAN & DETEKSI DEVIASI FISIK (KMS) ═══ */}
          <section className="bg-card border border-line rounded-xl p-4 sm:p-5 space-y-4 shadow-xs break-inside-avoid">
            <div className="border-b border-line pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="border-l-4 border-sky-600 pl-3.5 py-0.5">
                <h3 className="text-base sm:text-lg font-bold text-heading">
                  1. Hasil Pengukuran Fisik & Deteksi Deviasi (KMS)
                </h3>
                <p className="text-xs text-caption mt-0.5">
                  Standar Deviasi WHO Z-Score & Deteksi Dini Tumbuh Kembang Kemenkes RI
                </p>
              </div>
            </div>

            <p className="text-sm sm:text-base text-body bg-subtle p-4 rounded-xl border border-line leading-relaxed">
              {clinical.risk_narrative || "Tidak ada catatan deviasi antropometri."}
            </p>

            {clinical.active_risk_flags && clinical.active_risk_flags.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {clinical.active_risk_flags.map((flag, i) => (
                  <div
                    key={i}
                    className="p-4 bg-card border border-line rounded-xl space-y-2.5 overflow-hidden shadow-2xs"
                  >
                    <div className="border-b border-line/60 pb-2.5 space-y-1">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-xs sm:text-sm text-heading leading-tight break-words">
                            {formatIndicator(flag.indicator)}
                          </p>
                          <p className="text-[11px] sm:text-xs font-semibold text-amber-700 dark:text-amber-400 mt-0.5 leading-snug break-words">
                            {humanRisk(flag.flag)}
                          </p>
                        </div>
                      </div>
                    </div>
                    <p className="text-xs sm:text-sm text-caption leading-relaxed pl-6 break-words">
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
          </section>

          {/* ═══ BAGIAN II: RENCANA ASUHAN & INTERVENSI GIZI KLINIS (1.000 HPK) ═══ */}
          <section className="bg-card border border-line rounded-xl p-4 sm:p-5 space-y-4 shadow-xs break-inside-avoid">
            <div className="border-b border-line pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="border-l-4 border-emerald-600 pl-3.5 py-0.5">
                <h3 className="text-base sm:text-lg font-bold text-heading">
                  2. Rencana Asuhan & Intervensi Gizi Klinis (1.000 HPK)
                </h3>
                <p className="text-xs text-caption mt-0.5">
                  Protokol edukasi Meja 4 Posyandu berbasis Buku KIA 2024 & Pedoman Kemenkes RI
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {(finalJson.recommender_mode === "LLM_REACT" || (recommendations[0] && recommendations[0].reasoning_mode === "LLM_REACT")) ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border border-sky-300 dark:border-sky-800">
                    <Sparkles className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                    Penalaran ReAct AI (Gemini + ChromaDB RAG)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    Mode Darurat Deterministik (Safety Net Standar PNPK)
                  </span>
                )}
              </div>
            </div>

            {recommendations.length === 0 ? (
              <div className="text-center py-8 bg-subtle rounded-2xl border border-line px-4">
                <CheckCircle2 className="w-7 h-7 text-emerald-500 mx-auto mb-2" />
                <p className="text-base font-bold text-heading">
                  Pertumbuhan Pasien Sesuai Standar Optimal
                </p>
                <p className="text-sm text-caption mt-1 max-w-2xl mx-auto">
                  Gunakan panduan 4 pilar di bawah untuk pendampingan edukasi gizi dan stimulasi rutin keluarga.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {recommendations.map((rec, idx) => {
                  const isChecked = !!checkedSteps[`rec-${idx}`];
                  return (
                    <div
                      key={idx}
                      className="bg-card border border-line rounded-xl p-5 space-y-3.5 shadow-2xs hover:border-slate-400 transition-colors break-inside-avoid"
                    >
                      {/* Baris Judul & Kategori (Rapi & Minimalis) */}
                      <div className="flex items-center justify-between gap-2 border-b border-line-light pb-2">
                        <div className="flex items-center gap-2.5">
                          <span className="w-6 h-6 rounded-md bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-bold text-xs flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <h4 className="text-sm sm:text-base font-bold text-heading">
                            {rec.title}
                          </h4>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-subtle text-caption border border-line">
                            {rec.category || "Gizi KIA"}
                          </span>
                          {(rec.reasoning_mode === "FALLBACK_DETERMINISTIC" || finalJson.recommender_mode === "MODE_FALLBACK") ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                              Safety Net PNPK
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border border-sky-300 dark:border-sky-800">
                              ReAct AI
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Inti Instruksi Tindakan */}
                      <p className="text-sm text-heading leading-relaxed">
                        {rec.recommendation_text}
                      </p>

                      {/* Dua Lapis: 1. Dasar Dokumen Rujukan RAG (Buku KIA / PNPK) */}
                      {rec.citation && (
                        <div className="p-3 bg-sky-50/60 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800/60 rounded-lg text-xs space-y-1">
                          <div className="flex items-center gap-1.5 text-sky-800 dark:text-sky-300 font-bold">
                            <BookOpen className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
                            <span>Dasar Pedoman Resmi: {cleanCitation(rec.citation.source)} (Hal. {rec.citation.page || "-"})</span>
                          </div>
                          {rec.evidence_quote && (
                            <p className="text-caption italic pl-5 leading-relaxed">
                              "{rec.evidence_quote}"
                            </p>
                          )}
                        </div>
                      )}

                      {/* Dua Lapis: 2. Arahan Edukasi & Porsi Pangan Lokal (Sintesis AI) */}
                      {rec.food_guide && (
                        <div className="p-3 bg-subtle rounded-lg border border-line text-xs space-y-1">
                          <div className="flex items-center gap-1.5 font-bold text-heading">
                            <Utensils className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            <span>Arahan Edukasi & Porsi Pangan Lokal (Penalaran Kontekstual AI):</span>
                          </div>
                          <p className="text-body pl-5 leading-relaxed">{rec.food_guide}</p>
                        </div>
                      )}

                      {/* Accordion Jejak Penalaran ReAct & Token Audit */}
                      {((rec.thought_process && rec.thought_process.length > 0) || agentTelemetry?.agent_2?.thought_process) && (
                        <div className="no-print pt-1">
                          <button
                            type="button"
                            onClick={() => toggleThought(idx)}
                            className="btn-interactive inline-flex items-center gap-1.5 text-xs text-caption hover:text-heading font-medium transition-colors cursor-pointer py-1"
                          >
                            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${openThoughts[idx] ? "rotate-180" : ""}`} />
                            <span>{openThoughts[idx] ? "Tutup Jejak Penalaran ReAct & Audit AI" : "Lihat Jejak Penalaran ReAct & Audit AI"}</span>
                          </button>
                          {openThoughts[idx] && (
                            <div className="mt-2 p-3 bg-subtle border border-line rounded-lg text-xs space-y-2 animate-fade-in font-mono">
                              <div className="flex items-center justify-between text-[11px] text-caption border-b border-line pb-1.5">
                                <span className="font-semibold text-heading">
                                  Mode: {rec.reasoning_mode || agentTelemetry?.agent_2?.mode || "LLM_REACT"}
                                </span>
                                {agentTelemetry?.agent_2?.token_usage && (
                                  <span>
                                    Token: {agentTelemetry.agent_2.token_usage.total_tokens || 0} ({agentTelemetry.agent_2.token_usage.input_tokens || 0} in / {agentTelemetry.agent_2.token_usage.output_tokens || 0} out)
                                  </span>
                                )}
                              </div>
                              <div className="space-y-1 text-caption text-[11px] font-mono leading-relaxed">
                                {(rec.thought_process || agentTelemetry?.agent_2?.thought_process || []).map((step, sIdx) => (
                                  <p key={sIdx} className="flex items-start gap-1.5">
                                    <span className="text-sky-600 dark:text-sky-400 font-bold shrink-0">&bull;</span>
                                    <span>{step}</span>
                                  </p>
                                ))}
                              </div>
                              {agentTelemetry?.agent_2?.tools_invoked && (
                                <p className="text-[10px] text-dim pt-1 border-t border-line-light">
                                  Tools yang dipanggil: {agentTelemetry.agent_2.tools_invoked.join(", ")}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Tombol Interaktif Nyata & Caption Jelas */}
                      <div className="no-print pt-2 border-t border-line-light flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        <button
                          type="button"
                          onClick={() => toggleEducationChecked(idx)}
                          className={`btn-interactive flex items-center gap-2 px-3.5 py-1.5 rounded-lg border transition-all cursor-pointer text-xs font-semibold ${
                            checkedSteps[`rec-${idx}`]
                              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
                              : "bg-card border-line hover:bg-subtle text-heading"
                          }`}
                        >
                          <span className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                            checkedSteps[`rec-${idx}`]
                              ? "bg-emerald-600 border-emerald-600 text-white"
                              : "border-slate-300 dark:border-slate-600 bg-card"
                          }`}>
                            {checkedSteps[`rec-${idx}`] && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                          </span>
                          <span>{checkedSteps[`rec-${idx}`] ? "Sudah Diedukasikan ke Ibu" : "Tandai Telah Diedukasikan"}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setDetailModal({
                              type: "recommendation",
                              title: rec.title,
                              rec: rec,
                            })
                          }
                          className="btn-interactive px-3.5 py-2 bg-sky-50 dark:bg-sky-950/50 hover:bg-sky-100 dark:hover:bg-sky-900/60 active:bg-sky-200 text-sky-700 dark:text-sky-300 border border-sky-300 dark:border-sky-800 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs group"
                        >
                          <BookOpen className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
                          <span>Klik untuk Buka Rujukan Buku KIA & Detail Tindakan</span>
                          <ChevronRight className="w-3.5 h-3.5 text-sky-500 group-hover:translate-x-0.5 transition-transform" />
                        </button>
                      </div>

                      {/* Tampilan Otomatis Lengkap Saat Dicetak (@media print) */}
                      <div className="hidden print:block space-y-2 mt-2 pt-2 border-t border-slate-300 text-xs">
                        {rec.action_steps && rec.action_steps.length > 0 && (
                          <div>
                            <strong className="block text-slate-800 mb-1">Langkah Pelaksanaan Tindakan:</strong>
                            <ol className="list-decimal pl-4 space-y-0.5 text-slate-700">
                              {rec.action_steps.map((st, sIdx) => (
                                <li key={sIdx}>{st}</li>
                              ))}
                            </ol>
                          </div>
                        )}
                        {rec.evidence_quote && (
                          <div className="italic text-slate-700 bg-slate-50 p-2 border-l-2 border-slate-500">
                            <strong>Dasar Rujukan Resmi:</strong> "{rec.evidence_quote}" ({cleanCitation(rec.citation?.source)}, Halaman {rec.citation?.page || "-"})
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Sub-Bab: 4 Pilar Tumbuh Kembang (Harian) */}
            {carePlan && carePlan.food_and_nutrition && (
              <div className="border-t-2 border-line pt-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-line-light pb-2">
                  <h4 className="text-sm font-bold uppercase tracking-wider text-heading">
                    Panduan Pola Asuh 4 Pilar (1.000 HPK)
                  </h4>
                  <span className="text-xs text-caption">
                    Disesuaikan untuk: <strong>{carePlan.age_or_trimester_label}</strong>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* Pilar 1: Gizi & Makanan */}
                  <div
                    onClick={() =>
                      setDetailModal({
                        type: "care_food",
                        badge: "Panduan Gizi & Menu Harian",
                        title: carePlan.food_and_nutrition.headline || carePlan.food_and_nutrition.title,
                        data: carePlan.food_and_nutrition,
                      })
                    }
                    className="group cursor-pointer p-4 bg-card border border-line rounded-xl flex flex-col justify-between gap-2.5 hover:border-slate-400 transition-colors"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <Utensils className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-xs font-bold text-heading">1. Gizi & Porsi MP-ASI</span>
                      </div>
                      <p className="text-xs text-body leading-relaxed">
                        Tekstur: <strong>{carePlan.food_and_nutrition.texture_and_consistency || carePlan.food_and_nutrition.stage_and_texture || "Padat Bergizi"}</strong> &bull; {carePlan.food_and_nutrition.frequency_and_portion}
                      </p>
                    </div>
                    <span className="no-print text-[11px] font-semibold text-sky-600 dark:text-sky-400 flex items-center justify-between pt-1 border-t border-line-light">
                      <span>Lihat 5 jadwal makan & resep</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </div>

                  {/* Pilar 2: ASI & Nutrisi Medis */}
                  {carePlan.milk_and_supplements && (
                    <div
                      onClick={() =>
                        setDetailModal({
                          type: "care_milk",
                          badge: "Pemberian Susu & Nutrisi Medis",
                          title: carePlan.milk_and_supplements.title,
                          data: carePlan.milk_and_supplements,
                        })
                      }
                      className="group cursor-pointer p-4 bg-card border border-line rounded-xl flex flex-col justify-between gap-2.5 hover:border-slate-400 transition-colors"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <Baby className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                          <span className="text-xs font-bold text-heading">2. ASI & Nutrisi Medis</span>
                        </div>
                        <p className="text-xs text-body leading-relaxed">
                          {carePlan.milk_and_supplements.primary_source || carePlan.milk_and_supplements.recommended_type || "ASI Eksklusif / Lanjutan"}
                        </p>
                      </div>
                      <span className="no-print text-[11px] font-semibold text-sky-600 dark:text-sky-400 flex items-center justify-between pt-1 border-t border-line-light">
                        <span>Lihat aturan suplementasi</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  )}

                  {/* Pilar 3: Stimulasi Motorik */}
                  {carePlan.activity_and_stimulation && (
                    <div
                      onClick={() =>
                        setDetailModal({
                          type: "care_activity",
                          badge: "Stimulasi Perkembangan",
                          title: carePlan.activity_and_stimulation.title,
                          data: carePlan.activity_and_stimulation,
                        })
                      }
                      className="group cursor-pointer p-4 bg-card border border-line rounded-xl flex flex-col justify-between gap-2.5 hover:border-slate-400 transition-colors"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <Activity className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                          <span className="text-xs font-bold text-heading">3. Stimulasi & Motorik</span>
                        </div>
                        <p className="text-xs text-body leading-relaxed">
                          Target: <strong>{carePlan.activity_and_stimulation.milestones_target || carePlan.activity_and_stimulation.focus_area || "Perkembangan Usia"}</strong>
                        </p>
                      </div>
                      <span className="no-print text-[11px] font-semibold text-sky-600 dark:text-sky-400 flex items-center justify-between pt-1 border-t border-line-light">
                        <span>Lihat panduan stimulasi</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  )}

                  {/* Pilar 4: Tanda Bahaya Rujukan */}
                  {Array.isArray(carePlan.danger_signs) && carePlan.danger_signs.length > 0 && (
                    <div
                      onClick={() =>
                        setDetailModal({
                          type: "care_danger",
                          badge: "Protokol Rujukan Puskesmas",
                          title: "Tanda Bahaya Klinis & Syarat Rujukan Puskesmas Segera",
                          data: carePlan.danger_signs,
                        })
                      }
                      className="group cursor-pointer p-4 bg-card border-2 border-rose-200 dark:border-rose-900/60 rounded-xl flex flex-col justify-between gap-2.5 hover:border-rose-400 transition-colors"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                          <span className="text-xs font-bold text-rose-700 dark:text-rose-300">4. Segera Rujuk Jika:</span>
                        </div>
                        <p className="text-xs text-rose-700 dark:text-rose-300 font-medium line-clamp-2">
                          {carePlan.danger_signs.slice(0, 2).join(" • ")}
                        </p>
                      </div>
                      <span className="no-print text-[11px] font-bold text-rose-600 dark:text-rose-400 flex items-center justify-between pt-1 border-t border-rose-100 dark:border-rose-900/40">
                        <span>Lihat ({carePlan.danger_signs.length}) tanda bahaya</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>

          {/* ═══ BAGIAN III: BUKTI RUJUKAN RESMI STANDAR KEMENKES RI ═══ */}
          {verifications.length > 0 && (
            <section className="bg-card border border-line rounded-xl p-4 sm:p-5 space-y-4 shadow-xs break-inside-avoid">
              <div className="border-b border-line pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="border-l-4 border-indigo-600 pl-3.5 py-0.5">
                  <h3 className="text-base sm:text-lg font-bold text-heading">
                    3. Bukti Rujukan Resmi Standar Kemenkes RI
                  </h3>
                  <p className="text-xs text-caption mt-0.5">
                    Verifikasi kesesuaian tindakan terhadap rujukan Buku KIA 2024 & PNPK Kemenkes RI
                  </p>
                </div>
              </div>

              <div className="border border-line rounded-xl overflow-hidden">
                <table className="w-full text-sm text-left">
                  <thead className="bg-subtle text-caption text-xs font-semibold border-b border-line uppercase tracking-wider">
                    <tr>
                      <th className="p-3 w-12 text-center">No</th>
                      <th className="p-3 w-1/3">Poin Rekomendasi</th>
                      <th className="p-3 w-1/4">Dokumen Sitasi</th>
                      <th className="p-3 text-center">Status Kesesuaian</th>
                      <th className="p-3">Bukti Kutipan Resmi</th>
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
                          <span className="text-xs text-dim">Halaman {v.citation_page}</span>
                        </td>
                        <td className="p-3 text-center">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-medium bg-subtle text-heading border border-line">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                            {v.verification_status}
                          </span>
                        </td>
                        <td className="p-3 text-body max-w-md">
                          {v.evidence && (
                            <p className="italic bg-subtle p-2 rounded-lg border border-line mb-1 text-xs text-body">
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
            </section>
          )}

          {/* Kolom Tanda Tangan Resmi (Tampil Khusus Saat Dicetak A4) */}
          <div className="hidden print:grid grid-cols-2 gap-8 pt-8 border-t-2 border-slate-400 mt-8 break-inside-avoid text-xs text-center">
            <div className="space-y-16">
              <p className="text-slate-700">Petugas / Kader Posyandu Pemeriksa,</p>
              <div>
                <p className="font-bold underline text-sm text-slate-900">{meta.kader_name || "(..............................................)"}</p>
                <p className="text-slate-600">Kader Posyandu Desa {meta.village_name || "Airmadidi"}</p>
              </div>
            </div>
            <div className="space-y-16">
              <p className="text-slate-700">Mengetahui / Memvalidasi:<br />Bidan Desa / Nakes Puskesmas,</p>
              <div>
                <p className="font-bold underline text-sm text-slate-900">{report.validated_by || "(..............................................)"}</p>
                <p className="text-slate-600">Puskesmas Airmadidi</p>
              </div>
            </div>
          </div>

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
        <div className="no-print p-5 sm:p-6 border-t border-line bg-subtle flex flex-col sm:flex-row items-center justify-between gap-4">
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
                Pemeriksaan Petugas: Kader berwenang mengesahkan laporan atau mengajukan 1x permohonan revisi asuhan
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
                  <span>{revisionCount >= 1 ? "Batas Revisi Habis" : "Minta Revisi Asuhan (1x)"}</span>
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

            {/* ─── Kader Rating Widget (1 - 5 Bintang) ─── */}
      {report.status === "APPROVED" && (
        <div className="no-print p-5 bg-card border border-line rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-heading flex items-center gap-2">
              <Star className="w-4 h-4 text-amber-500" />
              <span>Evaluasi Rekomendasi Klinis oleh Petugas</span>
            </h4>
            <p className="text-xs text-caption">
              Berikan penilaian 1 - 5 bintang terhadap ketepatan saran klinis. Penilaian &ge; 4 disimpan sebagai contoh pembelajaran acuan, sedangkan &le; 2 ditandai untuk evaluasi supervisi dokter.
            </p>
          </div>
          <div className="flex items-center gap-3 self-start sm:self-auto">
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  disabled={ratingLoading || ratingSubmitted}
                  onClick={async () => {
                    try {
                      setRatingLoading(true);
                      await api.post(`/reports/${report.id}/rate`, {
                        score: star,
                        feedback: `Rating ${star} dari Kader Posyandu`,
                      });
                      setRatingScore(star);
                      setRatingSubmitted(true);
                    } catch (err) {
                      console.error("Gagal mengirim rating:", err);
                      alert(getErrorMessage(err, "Gagal menyimpan rating"));
                    } finally {
                      setRatingLoading(false);
                    }
                  }}
                  className={`p-1.5 rounded-lg transition-transform ${
                    star <= ratingScore
                      ? "text-amber-500 scale-110"
                      : "text-gray-300 dark:text-gray-600 hover:text-amber-400"
                  } cursor-pointer disabled:cursor-default`}
                  title={`Beri rating ${star} dari 5`}
                >
                  <Star className="w-6 h-6 fill-current" />
                </button>
              ))}
            </div>
            {ratingSubmitted && (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                Tersimpan ({ratingScore}/5)
              </span>
            )}
          </div>
        </div>
      )}

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
                {detailModal.badge && (
                  <span className="inline-block px-2.5 py-0.5 rounded-md text-xs font-medium bg-subtle text-caption border border-line">
                    {detailModal.badge}
                  </span>
                )}
                <h3 id="detail-modal-title" className="text-lg font-bold text-heading">
                  {detailModal.title}
                </h3>
                {detailModal.subtitle && (
                  <p className="text-xs text-caption">
                    {detailModal.subtitle}
                  </p>
                )}
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
                            {detailModal.type === "chunk_full" && detailModal.chunk && (
                <div className="space-y-4">
                  {/* Info Dokumen */}
                  <div className="p-4 bg-sky-50/70 dark:bg-sky-950/30 rounded-xl border border-sky-200 dark:border-sky-800 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-sky-900 dark:text-sky-200 flex items-center gap-1.5">
                        <BookOpen className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
                        <span>Rujukan: {detailModal.chunk.source}</span>
                      </span>
                      <span className="font-medium text-sky-800 dark:text-sky-300">
                        Halaman {detailModal.chunk.page || "-"}
                      </span>
                    </div>
                    <p className="text-xs text-caption pl-5.5">
                      Bab / Topik: <strong className="text-heading font-medium">{detailModal.chunk.section || "Pedoman Resmi Kemenkes RI"}</strong>
                    </p>
                  </div>

                  {/* Teks Asli Dokumen Tanpa Font-Mono (Clean Reading View) */}
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-caption uppercase tracking-wider">
                      Teks Asli Dokumen Rujukan (Buku Pedoman):
                    </p>
                    <div className="p-4 sm:p-5 bg-card rounded-xl border border-line text-sm text-heading leading-relaxed border-l-4 border-sky-500 font-normal">
                      "{detailModal.chunk.evidence || "Pencegahan stunting pada fase baduta (6-24 bulan) berfokus pada pemberian ASI Eksklusif hingga 6 bulan dilanjutkan MP-ASI yang adekuat secara kualitas dan kuantitas serta kaya protein hewani (Buku KIA Hal. 32)."}"
                    </div>
                  </div>

                  {/* Tindakan Posyandu */}
                  <div className="p-4 bg-subtle rounded-xl border border-line space-y-1.5 text-xs">
                    <span className="font-semibold text-heading block">
                      Instruksi Tindakan Berdasarkan Rujukan Ini:
                    </span>
                    <p className="text-body leading-relaxed text-sm">
                      <strong className="text-heading">{detailModal.chunk.rec_title}:</strong> {detailModal.chunk.rec_text}
                    </p>
                  </div>
                </div>
              )}

              {detailModal.type === "recommendation" && detailModal.rec && (
                <>
                  <div className="p-4 bg-subtle rounded-xl border border-line">
                    <p className="text-sm sm:text-base text-body leading-relaxed">
                      {detailModal.rec.recommendation_text}
                    </p>
                  </div>

                  {detailModal.rec.longitudinal_progress && (
                    <div className="p-3.5 bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800 rounded-xl space-y-1">
                      <span className="text-xs font-bold text-sky-800 dark:text-sky-300 uppercase tracking-wide">
                        Tren Kunjungan Sebelumnya (Longitudinal):
                      </span>
                      <p className="text-sm text-body">{detailModal.rec.longitudinal_progress}</p>
                    </div>
                  )}

                  {detailModal.rec.evidence_quote && (
                    <div className="p-4 bg-sky-50/50 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-800 rounded-xl space-y-1.5">
                      <p className="text-xs font-bold text-sky-800 dark:text-sky-300 uppercase tracking-wide flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                        <span>Kutipan Teks Dokumen Resmi Rujukan ({cleanCitation(detailModal.rec.citation?.source)}, Hal. {detailModal.rec.citation?.page || "-"}):</span>
                      </p>
                      <p className="text-xs sm:text-sm text-body italic leading-relaxed pl-3 border-l-2 border-sky-500">
                        "{detailModal.rec.evidence_quote}"
                      </p>
                    </div>
                  )}

                  {detailModal.rec.ai_insight && (
                    <div className="p-4 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl space-y-1.5">
                      <p className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wide flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                        <span>Wawasan Tambahan AI (Perlu Konfirmasi Petugas / Evaluasi Kontekstual):</span>
                      </p>
                      <p className="text-xs sm:text-sm text-body leading-relaxed">
                        {detailModal.rec.ai_insight}
                      </p>
                    </div>
                  )}

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

              {detailModal.type === "care_danger" && (
                <div className="p-4 bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/60 rounded-xl space-y-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
                    <span className="text-sm font-bold text-rose-800 dark:text-rose-300">
                      Segera Rujuk ke Puskesmas Airmadidi Apabila Ditemukan Tanda Bahaya Berikut:
                    </span>
                  </div>
                  <ul className="text-sm text-body space-y-2 pl-6 list-disc">
                    {(Array.isArray(detailModal.data)
                      ? detailModal.data
                      : Array.isArray(detailModal.dangerSigns)
                      ? detailModal.dangerSigns
                      : (carePlan?.danger_signs || [])
                    ).map((ds, dIdx) => (
                      <li key={dIdx} className="leading-relaxed">
                        {ds}
                      </li>
                    ))}
                  </ul>
                  <div className="p-3 bg-card border border-rose-200 dark:border-rose-900/40 rounded-lg text-xs text-rose-700 dark:text-rose-300">
                    💡 <strong>Prosedur Kader:</strong> Segera dampingi keluarga balita ke Puskesmas Airmadidi dengan membawa Buku KIA dan KTP/KK.
                  </div>
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
                Catatan Koreksi / Permohonan Revisi Laporan (Maks. 1x)
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
