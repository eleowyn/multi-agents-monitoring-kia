import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api, { getErrorMessage } from "../../services/api";
import {
  FileText,
  Search,
  Download,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  RefreshCw,
  FileSearch,
  FileEdit,
  History,
  Send,
  MapPin,
  Calendar,
  ChevronDown,
} from "lucide-react";
import RevisionRequestModal from "../../components/kader/RevisionRequestModal";

const ArsipLaporan = () => {
  const [activeTab, setActiveTab] = useState("laporan"); // "laporan" | "revisi"
  const [reports, setReports] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [riskFilter, setRiskFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Revisions State
  const [revisions, setRevisions] = useState([]);
  const [revisionsLoading, setRevisionsLoading] = useState(false);
  const [revisionFilter, setRevisionFilter] = useState("");
  const [selectedVisitForRevision, setSelectedVisitForRevision] = useState(null);

  const navigate = useNavigate();

  useEffect(() => {
    if (activeTab === "laporan") {
      fetchReports();
    } else {
      fetchRevisions();
    }
  }, [activeTab, statusFilter, riskFilter, revisionFilter]);

  const fetchReports = async () => {
    try {
      setLoading(true);
      setError("");
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (riskFilter) params.overall_status = riskFilter;
      if (search) params.search = search;

      const res = await api.get("/reports/", { params });
      setReports(res.data || []);
    } catch (e) {
      console.error(e);
      setError("Gagal memuat arsip laporan KIA. Silakan periksa koneksi backend.");
    } finally {
      setLoading(false);
    }
  };

  const fetchRevisions = async () => {
    try {
      setRevisionsLoading(true);
      setError("");
      const params = {};
      if (revisionFilter) params.status = revisionFilter;
      const res = await api.get("/revisions/", { params });
      setRevisions(res.data || []);
    } catch (e) {
      console.error(e);
      setError("Gagal memuat riwayat pengajuan revisi.");
    } finally {
      setRevisionsLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (activeTab === "laporan") {
      fetchReports();
    }
  };

  const handleDownloadPdf = async (reportId, patientName, visitDate) => {
    try {
      const res = await api.get(`/reports/${reportId}/download-pdf`, {
        responseType: "blob",
      });
      const blob = new Blob([res.data], {
        type: res.headers["content-type"] || "application/pdf",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Laporan_KIA_${patientName || "Pasien"}_${visitDate || "Rekam"}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert("Gagal mengunduh dokumen PDF laporan. Pastikan laporan telah disahkan.");
    }
  };

  const filteredReports = reports.filter((r) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      (r.patient_name && r.patient_name.toLowerCase().includes(s)) ||
      (r.patient_nik && r.patient_nik.includes(s))
    );
  });

  const filteredRevisions = revisions.filter((rev) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      (rev.patient_name && rev.patient_name.toLowerCase().includes(s)) ||
      (rev.patient_nik && rev.patient_nik.includes(s)) ||
      (rev.reason && rev.reason.toLowerCase().includes(s))
    );
  });

  const getRiskBadge = (risk) => {
    switch (risk) {
      case "RISIKO_TINGGI":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800/40">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
            Risiko Tinggi
          </span>
        );
      case "PERLU_PERHATIAN":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            Perlu Perhatian
          </span>
        );
      case "KONDISI_BAIK":
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            Kondisi Baik
          </span>
        );
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "APPROVED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            Disahkan
          </span>
        );
      case "REJECTED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800/40">
            <XCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
            Ditolak
          </span>
        );
      case "DRAFT":
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40">
            <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            Draft (Review)
          </span>
        );
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-line-light">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-heading tracking-tight">Arsip Laporan KIA</h1>
          <p className="text-sm text-caption mt-1">
            Direktori rekapitulasi analisis multi-agent AI, status validasi kader, dan arsip rujukan resmi
          </p>
        </div>
        <button
          onClick={activeTab === "laporan" ? fetchReports : fetchRevisions}
          disabled={loading || revisionsLoading}
          className="btn-interactive flex items-center gap-1.5 px-3.5 py-2 bg-card border border-line hover:bg-muted text-label hover:text-heading rounded-xl text-xs font-semibold transition-colors duration-200 cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-sky-600 dark:text-sky-400 ${(loading || revisionsLoading) ? "animate-spin" : ""}`} />
          Segarkan
        </button>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-line pb-1">
        <button
          onClick={() => setActiveTab("laporan")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
            activeTab === "laporan"
              ? "bg-muted text-heading border border-line shadow-xs"
              : "text-caption hover:text-heading hover:bg-muted"
          }`}
        >
          <FileText className="w-4 h-4 text-sky-600 dark:text-sky-400" />
          <span>Daftar Laporan Pemeriksaan</span>
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-card text-caption border border-line">
            {reports.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("revisi")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
            activeTab === "revisi"
              ? "bg-muted text-heading border border-line shadow-xs"
              : "text-caption hover:text-heading hover:bg-muted"
          }`}
        >
          <History className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          <span>Riwayat Pengajuan Revisi</span>
          {revisions.some((r) => r.status === "PENDING") && (
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500 text-white animate-pulse">
              {revisions.filter((r) => r.status === "PENDING").length}
            </span>
          )}
        </button>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 bg-accent-red border border-red-300 dark:border-red-800/50 rounded-xl text-sm text-red-700 dark:text-red-300 flex items-center justify-between gap-3 animate-slide-up">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-500 dark:text-red-400" />
            <span>{error}</span>
          </div>
          <button
            onClick={activeTab === "laporan" ? fetchReports : fetchRevisions}
            className="px-3 py-1 bg-red-100 dark:bg-red-900/40 hover:bg-red-200 text-red-700 dark:text-red-300 rounded-lg text-xs font-semibold"
          >
            Coba Lagi
          </button>
        </div>
      )}

      {/* TAB 1: DAFTAR LAPORAN PEMERIKSAAN */}
      {activeTab === "laporan" && (
        <div className="space-y-4">
          {/* Filter & Search Bar */}
          <div className="flex flex-col sm:flex-row gap-2.5">
            <form onSubmit={handleSearchSubmit} className="relative flex-1" role="search">
              <Search className="w-4 h-4 text-dim absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Cari nama atau NIK pasien..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 h-10 bg-card border border-line rounded-xl text-sm placeholder:text-dim text-heading focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500 transition-all"
              />
            </form>

            <div className="relative min-w-[200px]">
              <select
                value={riskFilter}
                onChange={(e) => setRiskFilter(e.target.value)}
                className="w-full h-10 has-custom-chevron appearance-none pl-3.5 pr-11 bg-card border border-line rounded-xl text-xs sm:text-sm font-medium text-heading focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500 transition-all cursor-pointer"
              >
                <option value="">Semua Status Risiko</option>
                <option value="KONDISI_BAIK">Kondisi Baik</option>
                <option value="PERLU_PERHATIAN">Perlu Perhatian</option>
                <option value="RISIKO_TINGGI">Risiko Tinggi</option>
              </select>
              <ChevronDown className="w-4 h-4 text-dim absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            <div className="relative min-w-[200px]">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full h-10 has-custom-chevron appearance-none pl-3.5 pr-11 bg-card border border-line rounded-xl text-xs sm:text-sm font-medium text-heading focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500 transition-all cursor-pointer"
              >
                <option value="">Semua Status Validasi</option>
                <option value="DRAFT">Draft (Perlu Validasi)</option>
                <option value="APPROVED">Disahkan</option>
                <option value="REJECTED">Ditolak / Direvisi</option>
              </select>
              <ChevronDown className="w-4 h-4 text-dim absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {!loading && (
            <p className="text-xs text-caption font-medium">
              Menampilkan {filteredReports.length} laporan pemeriksaan
            </p>
          )}

          {/* Desktop Table */}
          <div className="hidden md:block bg-card rounded-2xl border border-line shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted text-caption border-b border-line">
                  <tr>
                    <th className="px-4 py-3.5 font-semibold text-xs">ID & Tanggal</th>
                    <th className="px-4 py-3.5 font-semibold text-xs">Nama & NIK Pasien</th>
                    <th className="px-4 py-3.5 font-semibold text-xs">Fase & Wilayah</th>
                    <th className="px-4 py-3.5 font-semibold text-xs">Status Risiko AI</th>
                    <th className="px-4 py-3.5 font-semibold text-xs">Status Validasi</th>
                    <th className="px-4 py-3.5 font-semibold text-xs">Status Revisi</th>
                    <th className="px-4 py-3.5 font-semibold text-xs text-right pr-6">Aksi Laporan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-light">
                  {loading ? (
                    <tr>
                      <td colSpan="7" className="p-8 text-center text-caption text-sm">
                        Memuat daftar arsip laporan...
                      </td>
                    </tr>
                  ) : filteredReports.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="p-12 text-center text-caption italic text-sm">
                        <FileSearch className="w-10 h-10 text-dim mx-auto mb-2 opacity-50" />
                        Belum ada arsip laporan yang sesuai kriteria pencarian.
                      </td>
                    </tr>
                  ) : (
                    filteredReports.map((r) => {
                      const isPendingRev = r.latest_revision_status === "PENDING";
                      return (
                        <tr
                          key={r.id}
                          onClick={() => navigate(`/kader/validasi-laporan/${r.visit_id}`)}
                          className="group cursor-pointer hover:bg-muted/50 transition-colors duration-150"
                          title="Klik baris untuk membuka lembar laporan"
                        >
                          <td className="px-4 py-3.5">
                            <p className="font-semibold text-sm text-heading group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                              #{r.id}
                            </p>
                            <p className="text-xs text-caption mt-0.5">{r.visit_date || "-"}</p>
                          </td>
                          <td className="px-4 py-3.5">
                            <p className="font-semibold text-sm text-heading">{r.patient_name || "Pasien"}</p>
                            <p className="text-xs text-caption mt-0.5">NIK: {r.patient_nik || "-"}</p>
                          </td>
                          <td className="px-4 py-3.5">
                            <p className="font-medium text-xs text-heading uppercase tracking-wider">{r.phase ? r.phase.replace("_", " ") : "-"}</p>
                            <p className="text-xs text-caption mt-0.5">{r.village_name || "Airmadidi"}</p>
                          </td>
                          <td className="px-4 py-3.5">
                            {getRiskBadge(r.overall_status)}
                            {r.risk_count > 0 && (
                              <p className="text-xs text-caption mt-1">{r.risk_count} indikator risiko</p>
                            )}
                          </td>
                          <td className="px-4 py-3.5">
                            {getStatusBadge(r.status)}
                            {r.revision_count > 0 && (
                              <p className="text-xs text-caption mt-1">Revisi ke-{r.revision_count}</p>
                            )}
                          </td>
                          <td className="px-4 py-3.5">
                            {isPendingRev ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40">
                                <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                                Validasi Admin
                              </span>
                            ) : r.latest_revision_status === "APPROVED" ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                Pernah Direvisi
                              </span>
                            ) : (
                              <span className="text-dim text-xs font-medium">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                              {r.has_pdf && (
                                <button
                                  onClick={() => handleDownloadPdf(r.id, r.patient_name, r.visit_date)}
                                  className="p-1.5 text-caption hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-subtle rounded-lg transition-colors border border-transparent hover:border-line"
                                  title="Unduh Dokumen PDF Resmi"
                                >
                                  <Download className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                onClick={() =>
                                  setSelectedVisitForRevision({
                                    visitId: r.visit_id,
                                    name: r.patient_name,
                                    nik: r.patient_nik,
                                    phase: r.phase,
                                  })
                                }
                                disabled={isPendingRev}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-caption hover:text-heading hover:bg-subtle rounded-lg border border-line-light hover:border-line transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                title={isPendingRev ? "Pengajuan revisi sedang menunggu validasi admin" : "Ajukan revisi data kunjungan"}
                              >
                                <FileEdit className="w-3.5 h-3.5" />
                                <span>Revisi</span>
                              </button>
                              <ExternalLink className="w-4 h-4 text-dim group-hover:text-sky-600 dark:group-hover:text-sky-400 group-hover:translate-x-0.5 transition-all ml-1" />
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {loading ? (
              <div className="p-6 text-center text-caption bg-card rounded-xl border border-line text-sm">
                Memuat arsip laporan...
              </div>
            ) : filteredReports.length === 0 ? (
              <div className="p-8 text-center text-caption bg-card rounded-xl border border-line italic text-sm">
                Belum ada arsip laporan yang ditemukan.
              </div>
            ) : (
              filteredReports.map((r) => {
                const isPendingRev = r.latest_revision_status === "PENDING";
                return (
                  <div
                    key={r.id}
                    onClick={() => navigate(`/kader/validasi-laporan/${r.visit_id}`)}
                    className="card-interactive p-4 bg-card rounded-xl border border-line shadow-card space-y-3 cursor-pointer hover:border-sky-500/50 transition-all"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-bold text-heading text-base">{r.patient_name || "Pasien"}</p>
                        <p className="text-xs text-caption mt-0.5">NIK: {r.patient_nik || "-"} • {r.phase ? r.phase.replace("_", " ") : "-"}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-caption font-semibold">#{r.id}</span>
                        <p className="text-xs text-dim mt-0.5">{r.visit_date}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {getRiskBadge(r.overall_status)}
                      {getStatusBadge(r.status)}
                      {isPendingRev && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40">
                          <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" /> Revisi Menunggu Admin
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-line-light" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => navigate(`/kader/validasi-laporan/${r.visit_id}`)}
                        className="flex-1 py-2 bg-muted text-heading hover:bg-card rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 border border-line transition-colors cursor-pointer"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-dim" />
                        <span>Lihat Laporan</span>
                      </button>
                      {r.has_pdf && (
                        <button
                          onClick={() => handleDownloadPdf(r.id, r.patient_name, r.visit_date)}
                          className="py-2 px-3 bg-muted text-caption hover:text-emerald-600 hover:bg-card rounded-lg text-xs font-semibold flex items-center justify-center gap-1 border border-line transition-colors cursor-pointer"
                          title="Unduh PDF"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>PDF</span>
                        </button>
                      )}
                      <button
                        onClick={() =>
                          setSelectedVisitForRevision({
                            visitId: r.visit_id,
                            name: r.patient_name,
                            nik: r.patient_nik,
                            phase: r.phase,
                          })
                        }
                        disabled={isPendingRev}
                        className="py-2 px-3 bg-muted text-caption hover:text-heading hover:bg-card rounded-lg text-xs font-semibold flex items-center justify-center gap-1 border border-line transition-colors cursor-pointer disabled:opacity-40"
                      >
                        <FileEdit className="w-3.5 h-3.5" />
                        <span>Revisi</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 2: RIWAYAT PENGAJUAN REVISI KADER */}
      {activeTab === "revisi" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-dim absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Cari pasien atau alasan pengajuan revisi..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 h-10 bg-card border border-line rounded-xl text-sm text-heading placeholder:text-dim focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500 transition-all"
              />
            </div>

            <div className="relative min-w-[220px] w-full sm:w-auto">
              <select
                value={revisionFilter}
                onChange={(e) => setRevisionFilter(e.target.value)}
                className="w-full h-10 has-custom-chevron appearance-none pl-3.5 pr-11 bg-card border border-line rounded-xl text-xs sm:text-sm font-medium text-heading focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500 transition-all cursor-pointer"
              >
                <option value="">Semua Status Validasi</option>
                <option value="PENDING">Menunggu Validasi Admin</option>
                <option value="APPROVED">Disetujui Admin</option>
                <option value="REJECTED">Ditolak Admin</option>
              </select>
              <ChevronDown className="w-4 h-4 text-dim absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          <div className="bg-card rounded-2xl border border-line shadow-card overflow-hidden">
            {revisionsLoading ? (
              <div className="py-16 text-center space-y-3">
                <RefreshCw className="w-8 h-8 animate-spin text-sky-600 mx-auto" />
                <p className="text-sm text-caption">Memuat riwayat pengajuan revisi Anda...</p>
              </div>
            ) : filteredRevisions.length === 0 ? (
              <div className="py-16 text-center space-y-2">
                <History className="w-10 h-10 text-dim mx-auto" />
                <h3 className="text-sm font-bold text-heading">Belum Ada Pengajuan Revisi</h3>
                <p className="text-xs text-caption max-w-sm mx-auto">
                  Jika ada kesalahan pencatatan data saat posyandu, Anda dapat menekan tombol 'Revisi' pada tab Daftar Laporan untuk mengajukan perbaikan ke Admin Puskesmas.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-line bg-muted text-caption font-semibold uppercase tracking-wider">
                      <th className="px-4 py-3.5">ID & Tanggal</th>
                      <th className="px-4 py-3.5">Nama Pasien & NIK</th>
                      <th className="px-4 py-3.5">Fase & Tgl Kunjungan</th>
                      <th className="px-4 py-3.5">Alasan Pengajuan Revisi</th>
                      <th className="px-4 py-3.5 text-center">Status Admin</th>
                      <th className="px-4 py-3.5">Catatan Admin Puskesmas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-light">
                    {filteredRevisions.map((rev) => (
                      <tr key={rev.id} className="hover:bg-muted/50 transition-colors duration-150">
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span className="font-semibold text-sm text-heading">#{rev.id}</span>
                          <p className="text-xs text-caption mt-0.5">
                            {rev.created_at ? new Date(rev.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "-"}
                          </p>
                        </td>

                        <td className="px-4 py-3.5">
                          <p className="font-semibold text-sm text-heading">{rev.patient_name || "Pasien"}</p>
                          <p className="text-xs text-caption font-mono mt-0.5">NIK: {rev.patient_nik || "-"}</p>
                        </td>

                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-muted text-heading border border-line">
                            {rev.phase ? rev.phase.replace("_", " ") : "KIA"}
                          </span>
                          <p className="text-xs text-caption mt-1 flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            <span>{rev.visit_date || "-"}</span>
                          </p>
                        </td>

                        <td className="px-4 py-3.5 max-w-xs">
                          <p className="text-xs sm:text-sm text-body leading-relaxed">{rev.reason}</p>
                        </td>

                        <td className="px-4 py-3.5 text-center whitespace-nowrap">
                          {rev.status === "PENDING" ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40">
                              <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                              Menunggu
                            </span>
                          ) : rev.status === "APPROVED" ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                              Disetujui
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/40">
                              <XCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                              Ditolak
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3.5 max-w-xs text-caption">
                          {rev.admin_notes ? (
                            <p className="text-xs italic text-heading bg-muted p-2 rounded-lg border border-line-light">
                              "{rev.admin_notes}"
                            </p>
                          ) : (
                            <span className="text-xs text-dim italic">Belum ada catatan</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Revision Request Modal */}
      {selectedVisitForRevision && (
        <RevisionRequestModal
          isOpen={Boolean(selectedVisitForRevision)}
          visitId={selectedVisitForRevision.visitId}
          patientInfo={selectedVisitForRevision}
          onClose={() => setSelectedVisitForRevision(null)}
          onSuccess={() => {
            fetchReports();
            fetchRevisions();
          }}
        />
      )}
    </div>
  );
};

export default ArsipLaporan;
