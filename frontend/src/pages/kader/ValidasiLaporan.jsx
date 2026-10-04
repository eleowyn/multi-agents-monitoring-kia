import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api, { getErrorMessage } from "../../services/api";
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
} from "lucide-react";

/* ─── Skeleton Loaders ─── */
const SkeletonBlock = ({ className = "" }) => (
  <div className={`skeleton ${className}`} />
);

const ReportSkeleton = () => (
  <div className="bg-card rounded-2xl border border-line shadow-card overflow-hidden animate-fade-in">
    {/* Header skeleton */}
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
    {/* Content skeleton */}
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

const ValidasiLaporan = () => {
  const { reportId } = useParams();
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
      setError("Gagal memuat detail laporan hasil analisis AI.");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (
      !window.confirm(
        "Apakah Anda yakin ingin menyetujui dan mengesahkan laporan KIA ini?",
      )
    )
      return;
    setActionLoading(true);
    try {
      const res = await api.post(`/reports/${reportId}/validate`, {
        status: "APPROVED",
      });
      setReport(res.data);
      alert("Laporan berhasil disetujui! Dokumen PDF resmi telah dibuat.");
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
        "Sistem Multi-Agent telah merevisi laporan berdasarkan catatan Anda (Revisi 1x telah digunakan)!",
      );
    } catch (err) {
      alert(getErrorMessage(err, "Gagal memproses penolakan."));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDownloadPdf = () => {
    window.open(
      `http://127.0.0.1:8000/api/v1/reports/${reportId}/download-pdf`,
      "_blank",
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
      <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
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
        <div className="text-center py-20 animate-fade-in">
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
              onClick={() => navigate("/kader/input-kunjungan")}
              className="px-5 py-2.5 border border-line rounded-xl text-sm font-medium text-label hover:bg-muted transition-all duration-200"
            >
              <ArrowLeft className="w-4 h-4 inline mr-1.5" aria-hidden="true" />
              Kembali
            </button>
            <button
              onClick={fetchReport}
              className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-sm font-semibold shadow-sm transition-all duration-200"
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
        <div className="text-center py-20 animate-fade-in">
          <FileSearch
            className="w-16 h-16 text-dim mx-auto mb-4"
            aria-hidden="true"
          />
          <h2 className="text-lg font-bold text-heading mb-2">
            Laporan Tidak Ditemukan
          </h2>
          <p className="text-sm text-caption mb-6">
            Laporan dengan ID ini tidak tersedia atau telah dihapus.
          </p>
          <button
            onClick={() => navigate("/kader/input-kunjungan")}
            className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-sm font-semibold shadow-sm transition-all duration-200"
          >
            <ArrowLeft className="w-4 h-4 inline mr-1.5" aria-hidden="true" />
            Kembali ke Form Kunjungan
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

  const statusConfig = {
    KONDISI_BAIK: {
      label: "Kondisi Baik / Normal",
      className: "bg-accent-emerald text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800/50",
    },
    PERLU_PERHATIAN: {
      label: "Perlu Perhatian / Intervensi",
      className: "bg-accent-amber text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800/50",
    },
    RISIKO_TINGGI: {
      label: "Risiko Tinggi / Rujuk Segera",
      className: "bg-accent-rose text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800/50",
    },
  };

  const currentStatus = statusConfig[report.overall_status];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6 animate-fade-in">
      {/* Back Button & Title */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <button
          onClick={() => navigate("/kader/input-kunjungan")}
          aria-label="Kembali ke halaman input kunjungan"
          className="flex items-center gap-1.5 text-sm font-semibold text-caption hover:text-heading transition-colors duration-200"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          Kembali ke Form Kunjungan
        </button>

        {report.status === "APPROVED" && (
          <button
            onClick={handleDownloadPdf}
            aria-label="Unduh lembar laporan PDF"
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-sm font-bold shadow-sm hover:shadow-md transition-all duration-200"
          >
            <Download className="w-4 h-4" aria-hidden="true" />
            Unduh Lembar Laporan PDF
          </button>
        )}
      </div>

      {/* Main Report Card */}
      <div className="bg-card rounded-2xl border border-line shadow-card overflow-hidden">
        {/* Header Status Bar */}
        <div className="p-5 sm:p-6 border-b border-line bg-subtle">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-lg font-bold text-heading">
                Hasil Analisis: {meta.patient_name}
              </h2>
              <p className="text-sm text-caption mt-0.5">
                NIK: {meta.patient_nik}
              </p>
              <p className="text-xs text-dim mt-1">
                Fase: <strong className="text-label">{meta.phase}</strong> &bull; Desa:{" "}
                <span className="text-label">{meta.village_name}</span> &bull; Revisi:{" "}
                <strong className="text-label">{revisionCount}/1 kali</strong>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {currentStatus && (
                <span
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border ${currentStatus.className}`}
                >
                  {currentStatus.label}
                </span>
              )}
              <span
                className={`px-3 py-1.5 rounded-xl text-xs font-bold ${
                  report.status === "APPROVED"
                    ? "bg-emerald-600 text-white"
                    : "bg-muted text-label border border-line"
                }`}
                aria-label={`Status laporan: ${report.status === "APPROVED" ? "Tersahkan" : "Menunggu Validasi"}`}
              >
                {report.status === "APPROVED"
                  ? "✓ Tersahkan"
                  : "Menunggu Validasi Kader"}
              </span>
            </div>
          </div>
        </div>

        {/* Report Content */}
        <div className="p-5 sm:p-6 space-y-6">
          {/* Executive Summary */}
          <div className="p-4 bg-accent-sky border border-sky-200 dark:border-sky-800/50 rounded-xl text-sm text-sky-900 dark:text-sky-200 leading-relaxed">
            <p className="font-bold mb-1.5 flex items-center gap-2 text-sky-800 dark:text-sky-300">
              <FileText className="w-4 h-4 text-sky-600 dark:text-sky-400" aria-hidden="true" />
              Ringkasan Eksekutif Analisis Sistem
            </p>
            <p>{finalJson.executive_summary}</p>
          </div>

          {/* ─── Section I: Clinical Findings ─── */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-heading border-l-4 border-sky-500 pl-3">
              I. Temuan Pengukuran Deterministik (Agent 1)
            </h3>
            <p className="text-sm text-body bg-subtle p-4 rounded-xl border border-line leading-relaxed">
              {clinical.risk_narrative ||
                "Tidak ada catatan deviasi antropometri."}
            </p>

            {clinical.active_risk_flags &&
              clinical.active_risk_flags.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {clinical.active_risk_flags.map((flag, i) => (
                    <div
                      key={i}
                      className="p-4 bg-accent-amber border border-amber-300 dark:border-amber-800/50 rounded-xl text-sm space-y-1.5"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <span className="font-bold text-amber-900 dark:text-amber-200">
                          {flag.indicator}
                        </span>
                        <span className="text-[11px] bg-amber-200 dark:bg-amber-900/60 px-2.5 py-0.5 rounded-full text-amber-950 dark:text-amber-200 font-bold flex-shrink-0">
                          {flag.flag}
                        </span>
                      </div>
                      <p className="text-amber-800 dark:text-amber-300 text-xs leading-relaxed">
                        {flag.detail}
                      </p>
                    </div>
                  ))}
                </div>
              )}
          </div>

          {/* ─── Section II: Recommendations ─── */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-heading border-l-4 border-sky-500 pl-3">
              II. Rekomendasi Klinis & Tindakan Kader (Agent 2 — RAG ChromaDB)
            </h3>

            {recommendations.length === 0 ? (
              <div className="text-center py-8 bg-subtle rounded-xl border border-line">
                <CheckCircle2
                  className="w-8 h-8 text-emerald-500 dark:text-emerald-400 mx-auto mb-2"
                  aria-hidden="true"
                />
                <p className="text-sm text-caption">
                  Tidak ada intervensi khusus. Pasien dianjurkan tetap hadir
                  rutin pada jadwal Posyandu berikutnya.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {recommendations.map((rec, idx) => (
                  <div
                    key={idx}
                    className="p-4 bg-card border border-line rounded-xl space-y-2.5 shadow-card hover:border-sky-400 dark:hover:border-sky-600 transition-colors duration-150"
                  >
                    <div className="flex justify-between items-start gap-3">
                      <p className="font-bold text-sm text-sky-800 dark:text-sky-300">
                        {idx + 1}. {rec.title}
                      </p>
                      <span className="text-[11px] bg-accent-sky text-sky-800 dark:text-sky-300 px-2.5 py-0.5 rounded-full font-semibold border border-sky-200 dark:border-sky-800/50 flex-shrink-0">
                        {rec.category}
                      </span>
                    </div>
                    <p className="text-sm text-body leading-relaxed">
                      {rec.recommendation_text}
                    </p>

                    {rec.action_steps && (
                      <ul className="text-sm text-caption list-disc list-inside space-y-1 pl-1">
                        {rec.action_steps.map((step, sIdx) => (
                          <li key={sIdx}>{step}</li>
                        ))}
                      </ul>
                    )}

                    {rec.citation && (
                      <div className="pt-2.5 border-t border-line flex items-center gap-2 text-xs text-dim font-medium">
                        <BookOpen
                          className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 flex-shrink-0"
                          aria-hidden="true"
                        />
                        <span>
                          Rujukan: <strong className="text-caption">{rec.citation.source}</strong> (
                          {rec.citation.section} — Hal. {rec.citation.page})
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ─── Section III: Verification Table ─── */}
          {verifications.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-heading border-l-4 border-emerald-500 pl-3 flex items-center gap-2">
                <ShieldCheck
                  className="w-4 h-4 text-emerald-600 dark:text-emerald-400"
                  aria-hidden="true"
                />
                III. Verifikasi Grounding Sitasi (Agent 3 — ReAct 2-Langkah)
              </h3>

              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm text-left border border-line rounded-xl overflow-hidden">
                  <thead className="bg-muted text-label border-b border-line">
                    <tr>
                      <th className="p-3 border-b border-line font-semibold">No</th>
                      <th className="p-3 border-b border-line font-semibold">
                        Rekomendasi
                      </th>
                      <th className="p-3 border-b border-line font-semibold">
                        Sumber Sitasi
                      </th>
                      <th className="p-3 border-b border-line font-semibold">
                        Status Grounding
                      </th>
                      <th className="p-3 border-b border-line font-semibold">
                        Bukti / Catatan
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-light">
                    {verifications.map((v, i) => (
                      <tr
                        key={i}
                        className="hover:bg-accent-sky transition-colors duration-150"
                      >
                        <td className="p-3 font-bold text-dim">
                          {v.recommendation_index}
                        </td>
                        <td className="p-3 font-medium text-heading">
                          {v.title}
                        </td>
                        <td className="p-3 text-caption">
                          {v.citation_source} (Hal. {v.citation_page})
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                              v.verification_status === "VERIFIED"
                                ? "bg-accent-emerald text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50"
                                : "bg-accent-amber text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50"
                            }`}
                          >
                            {v.verification_status}
                          </span>
                        </td>
                        <td className="p-3 text-body max-w-xs">
                          {v.evidence && (
                            <p className="text-xs italic bg-subtle p-2 rounded-lg border border-line mb-1.5 text-body">
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

              {/* Mobile cards */}
              <div className="md:hidden space-y-3">
                {verifications.map((v, i) => (
                  <div
                    key={i}
                    className="p-4 bg-card border border-line rounded-xl space-y-2.5 shadow-card"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <p className="font-semibold text-sm text-heading">
                        {v.recommendation_index}. {v.title}
                      </p>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-bold flex-shrink-0 ${
                          v.verification_status === "VERIFIED"
                            ? "bg-accent-emerald text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50"
                            : "bg-accent-amber text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50"
                        }`}
                      >
                        {v.verification_status}
                      </span>
                    </div>
                    <p className="text-xs text-caption">
                      Sumber: {v.citation_source} (Hal. {v.citation_page})
                    </p>
                    {v.evidence && (
                      <p className="text-xs italic bg-subtle p-2.5 rounded-lg border border-line text-body">
                        "{v.evidence}"
                      </p>
                    )}
                    {v.notes && (
                      <p className="text-xs text-dim">{v.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ─── Footer Action Buttons ─── */}
        {report.status !== "APPROVED" && (
          <div className="p-5 sm:p-6 bg-subtle border-t border-line">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="text-sm text-caption flex items-start gap-2">
                <Info
                  className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5"
                  aria-hidden="true"
                />
                {revisionCount >= 1 ? (
                  <span className="text-amber-700 dark:text-amber-400 font-semibold">
                    Maksimal 1 kali revisi AI telah digunakan untuk laporan ini.
                    Silakan sahkan hasil atau rujuk ke Puskesmas.
                  </span>
                ) : (
                  <span>
                    Kader berwenang mengesahkan laporan atau meminta 1x revisi
                    otomatis kepada AI Agent.
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                {revisionCount < 1 && (
                  <button
                    onClick={() => setShowRejectModal(true)}
                    disabled={actionLoading}
                    aria-label="Tolak laporan dan minta revisi AI"
                    className="w-full sm:w-auto px-5 py-3 bg-accent-red hover:bg-red-100 dark:hover:bg-red-900/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/50 rounded-xl text-sm font-bold transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-55 disabled:cursor-not-allowed"
                  >
                    <XCircle className="w-4 h-4" aria-hidden="true" />
                    Tolak & Minta Revisi (1x)
                  </button>
                )}

                <button
                  onClick={handleApprove}
                  disabled={actionLoading}
                  aria-label={
                    actionLoading
                      ? "Sedang mengesahkan laporan"
                      : "Setujui dan buat dokumen PDF"
                  }
                  className="w-full sm:w-auto px-6 py-3 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-sm font-bold shadow-md hover:shadow-lg disabled:opacity-55 disabled:cursor-not-allowed disabled:hover:bg-emerald-600 transition-all duration-200 flex items-center justify-center gap-2"
                >
                  {actionLoading ? (
                    <>
                      <span className="spinner border-white/30 border-t-white" />
                      <span>Mengesahkan...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                      <span>Setujui & Buat Dokumen PDF</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ═══ Modal Rejection / Loopback ═══ */}
      {showRejectModal && (
        <div
          className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in"
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
              <h3
                id="modal-reject-title"
                className="text-sm font-bold text-heading"
              >
                Catatan Revisi untuk AI Agent (Maks 1x)
              </h3>
              <button
                onClick={() => setShowRejectModal(false)}
                aria-label="Tutup modal revisi"
                className="p-2 text-dim hover:text-heading hover:bg-muted rounded-xl transition-colors duration-200"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <p className="text-sm text-caption leading-relaxed">
              Sistem akan menjalankan 1 kali perulangan graf LangGraph dengan
              menyertakan konteks koreksi yang Anda masukkan.
            </p>

            <form onSubmit={handleReject} className="space-y-4">
              <div>
                <label
                  htmlFor="rejection-reason"
                  className="block text-sm font-semibold text-label mb-1.5"
                >
                  Catatan perbaikan
                </label>
                <textarea
                  id="rejection-reason"
                  required
                  rows="4"
                  placeholder="Contoh: Pasien memiliki alergi telur, ganti menu MP-ASI menjadi ikan gabus/hati ayam..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full p-3.5 bg-subtle border border-line rounded-xl text-sm text-heading placeholder:text-dim focus:outline-none focus:ring-2 focus:ring-rose-500/40 focus:border-rose-500 focus:bg-card transition-all duration-200"
                />
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowRejectModal(false)}
                  className="px-4 py-2.5 border border-line rounded-xl text-sm font-medium text-caption hover:bg-muted hover:text-heading transition-all duration-200"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  aria-label={
                    actionLoading
                      ? "Sedang mengeksekusi revisi"
                      : "Kirim koreksi ke AI"
                  }
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-xl text-sm font-bold shadow-sm hover:shadow-md disabled:opacity-55 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2"
                >
                  {actionLoading ? (
                    <>
                      <span className="spinner border-white/30 border-t-white" />
                      <span>Mengeksekusi Revisi...</span>
                    </>
                  ) : (
                    "Kirim Koreksi ke AI"
                  )}
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
