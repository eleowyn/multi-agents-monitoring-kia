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
  Trash2,
  Filter,
  Calendar,
  MapPin,
  ShieldCheck,
  Eye,
  X,
  Printer,
  User,
  Sparkles,
  BookOpen,
} from "lucide-react";

const AIRMADIDI_VILLAGES = [
  "Airmadidi Atas",
  "Airmadidi Bawah",
  "Sarongsong Satu",
  "Sarongsong Dua",
  "Sukur",
  "Rap-Rap",
  "Sawangan",
  "Sampiri",
  "Tanggari",
];

const ManageReports = () => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [riskFilter, setRiskFilter] = useState("");
  const [villageFilter, setVillageFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [deletingBulk, setDeletingBulk] = useState(false);
  const [error, setError] = useState("");
  const [previewReport, setPreviewReport] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewLoadingId, setPreviewLoadingId] = useState(null);

  const navigate = useNavigate();

  useEffect(() => {
    fetchReports();
  }, [statusFilter, riskFilter, villageFilter, startDate, endDate]);

  const handleOpenPreview = async (reportId) => {
    try {
      setPreviewLoading(true);
      setPreviewLoadingId(reportId);
      const res = await api.get(`/reports/${reportId}`);
      setPreviewReport(res.data);
    } catch (err) {
      alert(getErrorMessage(err, "Gagal memuat pratinjau laporan."));
    } finally {
      setPreviewLoading(false);
      setPreviewLoadingId(null);
    }
  };

  const fetchReports = async () => {
    try {
      setLoading(true);
      setError("");
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (riskFilter) params.overall_status = riskFilter;
      if (villageFilter) params.village_name = villageFilter;
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;
      if (search) params.search = search;

      const res = await api.get("/reports/", { params });
      setReports(res.data || []);
      setSelectedIds([]);
    } catch (err) {
      console.error(err);
      setError("Gagal memuat daftar laporan kunjungan lintas posyandu.");
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchReports();
  };

  const handleResetFilters = () => {
    setSearch("");
    setStatusFilter("");
    setRiskFilter("");
    setVillageFilter("");
    setStartDate("");
    setEndDate("");
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

  const handleDeleteSingle = async (reportId, patientName) => {
    if (
      !window.confirm(
        `Apakah Anda yakin ingin menghapus laporan #${reportId} milik pasien ${patientName || "ini"}? Tindakan ini tidak dapat dibatalkan.`
      )
    ) {
      return;
    }

    try {
      await api.delete(`/reports/${reportId}`);
      alert("Laporan berhasil dihapus.");
      fetchReports();
    } catch (err) {
      alert(getErrorMessage(err, "Gagal menghapus laporan."));
    }
  };

  const handleToggleAll = () => {
    if (selectedIds.length === filteredReports.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredReports.map((r) => r.id));
    }
  };

  const handleToggleRow = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (
      !window.confirm(
        `Apakah Anda yakin ingin menghapus ${selectedIds.length} laporan terpilih? Seluruh berkas PDF dan audit log terkait akan dibersihkan.`
      )
    ) {
      return;
    }

    try {
      setDeletingBulk(true);
      await api.post("/reports/bulk-delete", { ids: selectedIds });
      alert(`${selectedIds.length} laporan berhasil dihapus.`);
      setSelectedIds([]);
      fetchReports();
    } catch (err) {
      alert(getErrorMessage(err, "Gagal menghapus laporan secara massal."));
    } finally {
      setDeletingBulk(false);
    }
  };

  const filteredReports = reports.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (r.patient_name && r.patient_name.toLowerCase().includes(q)) ||
      (r.patient_nik && r.patient_nik.includes(q))
    );
  });

  const getRiskBadge = (risk) => {
    switch (risk) {
      case "RISIKO_TINGGI":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-accent-rose text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800/50">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
            Risiko Tinggi
          </span>
        );
      case "PERLU_PERHATIAN":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-accent-amber text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            Perlu Perhatian
          </span>
        );
      case "KONDISI_BAIK":
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-accent-emerald text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50">
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
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            Disahkan
          </span>
        );
      case "REJECTED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800/40">
            <XCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
            Ditolak
          </span>
        );
      case "DRAFT":
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40">
            <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            Draft (Review)
          </span>
        );
    }
  };

  const totalApproved = reports.filter((r) => r.status === "APPROVED").length;
  const totalDraft = reports.filter((r) => r.status === "DRAFT").length;
  const totalHighRisk = reports.filter((r) => r.overall_status === "RISIKO_TINGGI").length;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-line-light">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-heading tracking-tight">
            Kelola Laporan Kunjungan Posyandu
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {selectedIds.length > 0 && (
            <button
              onClick={handleBulkDelete}
              disabled={deletingBulk}
              className="btn-interactive flex items-center gap-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Hapus Terpilih ({selectedIds.length})</span>
            </button>
          )}

          <button
            onClick={fetchReports}
            disabled={loading}
            className="btn-interactive flex items-center gap-1.5 px-3.5 py-2 border border-line bg-card hover:bg-muted text-label hover:text-heading rounded-xl text-xs font-semibold cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Segarkan</span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-card p-4 rounded-2xl border border-line shadow-card flex items-center justify-between">
          <div>
            <p className="text-xs text-caption font-medium">Total Laporan Kunjungan</p>
            <p className="text-2xl font-bold text-heading mt-1">{reports.length}</p>
          </div>
          <div className="p-3 bg-sky-100 dark:bg-sky-900/40 text-sky-600 dark:text-sky-400 rounded-xl">
            <FileText className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-card p-4 rounded-2xl border border-line shadow-card flex items-center justify-between">
          <div>
            <p className="text-xs text-caption font-medium">Laporan Tersahkan</p>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{totalApproved}</p>
          </div>
          <div className="p-3 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-xl">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-card p-4 rounded-2xl border border-line shadow-card flex items-center justify-between">
          <div>
            <p className="text-xs text-caption font-medium">Draf / Menunggu Review</p>
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">{totalDraft}</p>
          </div>
          <div className="p-3 bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 rounded-xl">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-card p-4 rounded-2xl border border-line shadow-card flex items-center justify-between">
          <div>
            <p className="text-xs text-caption font-medium">Kasus Risiko Tinggi</p>
            <p className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">{totalHighRisk}</p>
          </div>
          <div className="p-3 bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 rounded-xl">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-card p-4 rounded-2xl border border-line shadow-card space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-center">
          {/* Search */}
          <div className="relative h-10">
            <Search className="w-4 h-4 text-dim absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Cari nama atau NIK..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-10 pl-9 pr-8 bg-subtle border border-line rounded-xl text-xs sm:text-sm text-heading placeholder:text-dim focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500 transition-all"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-dim hover:text-heading p-0.5 rounded-md cursor-pointer"
                title="Hapus pencarian"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Desa */}
          <div className="h-10">
            <select
              value={villageFilter}
              onChange={(e) => setVillageFilter(e.target.value)}
              className="w-full h-10 px-3 bg-subtle border border-line rounded-xl text-xs sm:text-sm text-heading focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500 transition-all cursor-pointer"
            >
              <option value="">Semua Wilayah Desa</option>
              {AIRMADIDI_VILLAGES.map((v) => (
                <option key={v} value={v}>
                  Desa {v}
                </option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div className="h-10">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full h-10 px-3 bg-subtle border border-line rounded-xl text-xs sm:text-sm text-heading focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500 transition-all cursor-pointer"
            >
              <option value="">Semua Status</option>
              <option value="APPROVED">Disahkan</option>
              <option value="DRAFT">Draft (Menunggu)</option>
              <option value="REJECTED">Ditolak</option>
            </select>
          </div>

          {/* Tanggal Mulai */}
          <div className="flex items-center h-10 px-3 bg-subtle border border-line rounded-xl focus-within:ring-2 focus-within:ring-sky-500/40 focus-within:border-sky-500 transition-all">
            <span className="text-xs text-caption shrink-0 mr-1.5 font-medium">Mulai:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-transparent text-xs sm:text-sm text-heading focus:outline-none cursor-pointer"
              title="Tanggal Mulai"
            />
          </div>

          {/* Tanggal Akhir */}
          <div className="flex items-center h-10 px-3 bg-subtle border border-line rounded-xl focus-within:ring-2 focus-within:ring-sky-500/40 focus-within:border-sky-500 transition-all">
            <span className="text-xs text-caption shrink-0 mr-1.5 font-medium">Sampai:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-transparent text-xs sm:text-sm text-heading focus:outline-none cursor-pointer"
              title="Tanggal Akhir"
            />
          </div>
        </div>

        {(statusFilter || riskFilter || villageFilter || startDate || endDate || search) && (
          <div className="flex justify-end pt-2 border-t border-line-light">
            <button
              onClick={handleResetFilters}
              className="text-xs text-sky-600 dark:text-sky-400 hover:underline cursor-pointer font-medium"
            >
              Reset Filter
            </button>
          </div>
        )}
      </div>

      {/* Main Table */}
      <div className="bg-card rounded-2xl border border-line shadow-card overflow-hidden">
        {loading ? (
          <div className="py-20 text-center space-y-3">
            <RefreshCw className="w-8 h-8 animate-spin text-sky-600 mx-auto" />
            <p className="text-sm text-caption">Memuat data laporan kunjungan lintas posyandu...</p>
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <FileSearch className="w-10 h-10 text-dim mx-auto" />
            <h3 className="text-sm font-bold text-heading">Tidak Ada Laporan yang Ditemukan</h3>
            <p className="text-xs text-caption max-w-sm mx-auto">
              Cobalah ubah filter rentang tanggal, wilayah desa, atau kata kunci pencarian pasien.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-line bg-subtle text-caption font-semibold uppercase tracking-wider text-xs">
                  <th className="py-3.5 px-4 w-12 text-center">
                    <input
                      type="checkbox"
                      checked={
                        filteredReports.length > 0 &&
                        selectedIds.length === filteredReports.length
                      }
                      onChange={handleToggleAll}
                      className="rounded text-sky-600 focus:ring-sky-500 cursor-pointer w-4 h-4"
                      aria-label="Pilih semua laporan"
                    />
                  </th>
                  <th className="py-3.5 px-4">Pasien &amp; Fase KIA</th>
                  <th className="py-3.5 px-4">Tanggal &amp; Lokasi</th>
                  <th className="py-3.5 px-4">Status Risiko AI</th>
                  <th className="py-3.5 px-4 text-center">Status Validasi</th>
                  <th className="py-3.5 px-4 text-center w-24">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-light">
                {filteredReports.map((r) => {
                  const isChecked = selectedIds.includes(r.id);
                  const isLoadingThis = previewLoadingId === r.id;

                  return (
                    <tr
                      key={r.id}
                      onClick={() => handleOpenPreview(r.id)}
                      title="Klik untuk membuka pratinjau laporan"
                      className={`group cursor-pointer hover:bg-muted/50 transition-colors duration-150 ${
                        isChecked ? "bg-muted/80" : ""
                      }`}
                    >
                      {/* Checkbox */}
                      <td
                        className="py-3.5 px-4 text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleRow(r.id)}
                          className="rounded text-sky-600 focus:ring-sky-500 cursor-pointer w-4 h-4"
                          aria-label={`Pilih laporan pasien ${r.patient_name || ""}`}
                        />
                      </td>

                      {/* Pasien & Fase KIA */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-heading text-sm">
                            {r.patient_name || "Pasien"}
                          </span>
                          <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-subtle text-caption border border-line shrink-0">
                            {r.phase || "KIA"}
                          </span>
                          {isLoadingThis && (
                            <RefreshCw className="w-3.5 h-3.5 text-caption animate-spin" />
                          )}
                        </div>
                        <p className="text-caption font-mono text-xs mt-1">
                          NIK: {r.patient_nik || "-"}
                          <span className="text-dim font-sans ml-2 text-xs">#{r.id}</span>
                        </p>
                      </td>

                      {/* Tanggal & Lokasi */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 font-medium text-heading text-sm">
                          <Calendar className="w-4 h-4 text-dim shrink-0" />
                          <span>{r.visit_date || "-"}</span>
                        </div>
                        <p className="text-caption text-xs mt-1 flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-dim shrink-0" />
                          <span>{r.village_name || "Airmadidi"}</span>
                          {r.posyandu_name && <span className="text-dim">&bull; {r.posyandu_name}</span>}
                        </p>
                      </td>

                      {/* Status Risiko AI */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {getRiskBadge(r.overall_status)}
                          {r.risk_count > 0 && (
                            <span className="text-xs text-dim font-medium">
                              ({r.risk_count} risiko)
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Status Validasi */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        {getStatusBadge(r.status)}
                        {r.revision_count > 0 && (
                          <p className="text-xs text-dim mt-1">Revisi ke-{r.revision_count}</p>
                        )}
                      </td>

                      {/* Aksi */}
                      <td
                        className="py-3.5 px-4 text-center whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-center gap-1">
                          {r.has_pdf && (
                            <button
                              onClick={() => handleDownloadPdf(r.id, r.patient_name, r.visit_date)}
                              className="p-1.5 text-caption hover:text-heading hover:bg-muted rounded-lg transition-colors cursor-pointer"
                              title="Unduh Dokumen Cetak / PDF"
                              aria-label="Unduh PDF"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                          )}

                          <button
                            onClick={() => handleDeleteSingle(r.id, r.patient_name)}
                            className="p-1.5 text-dim hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                            title="Hapus laporan ini"
                            aria-label="Hapus laporan"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Table Footer Helper */}
            <div className="px-4 py-3 border-t border-line bg-subtle flex items-center justify-between text-xs text-caption">
              <span>
                Menampilkan <strong className="text-heading">{filteredReports.length}</strong> dari <strong className="text-heading">{reports.length}</strong> laporan kunjungan
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ═══ Quick View Modal ═══ */}
      {previewReport && (
        <div
          className="fixed inset-0 bg-overlay flex items-center justify-center p-4 z-50 overflow-y-auto animate-fade-in"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-card w-full max-w-3xl rounded-2xl border border-line shadow-prominent overflow-hidden my-6 max-h-[90vh] flex flex-col animate-slide-up">
            {/* Modal Header */}
            <div className="p-5 border-b border-line bg-subtle flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 flex items-center justify-center font-bold">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-heading">
                      {previewReport.final_report_json?.metadata?.patient_name || "Pasien KIA"}
                    </h2>
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-accent-sky text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-800/50">
                      {previewReport.final_report_json?.metadata?.phase || previewReport.visit_data?.phase || "KIA"}
                    </span>
                  </div>
                  <p className="text-xs text-caption mt-0.5">
                    NIK: <span className="font-mono">{previewReport.final_report_json?.metadata?.patient_nik || "-"}</span> &bull; Desa: {previewReport.final_report_json?.metadata?.village_name || "-"} &bull; Tanggal: {previewReport.visit_data?.visit_date || "-"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {getRiskBadge(previewReport.overall_status)}
                <button
                  onClick={() => setPreviewReport(null)}
                  className="p-1.5 text-dim hover:text-heading hover:bg-muted rounded-xl transition-colors cursor-pointer"
                  aria-label="Tutup pratinjau"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1 text-xs">
              {/* Executive Summary */}
              <div className="p-3.5 bg-accent-sky border border-sky-200 dark:border-sky-800/50 rounded-xl space-y-1">
                <p className="font-bold text-sky-800 dark:text-sky-300 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-sky-600" />
                  Ringkasan Analisis AI
                </p>
                <p className="text-sky-950 dark:text-sky-100 leading-relaxed text-justify">
                  {previewReport.final_report_json?.executive_summary}
                </p>
              </div>

              {/* Physical Visit Parameters */}
              {previewReport.visit_data && (
                <div className="p-3.5 bg-subtle border border-line rounded-xl space-y-2">
                  <p className="font-bold text-heading uppercase tracking-wider text-xs">
                    Hasil Pengukuran Fisik Kunjungan
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-caption">
                    {previewReport.visit_data.gestational_age_weeks && (
                      <div>Usia Kehamilan: <strong className="text-body font-mono">{previewReport.visit_data.gestational_age_weeks} mg</strong></div>
                    )}
                    {previewReport.visit_data.maternal_weight_kg && (
                      <div>BB Ibu: <strong className="text-body font-mono">{previewReport.visit_data.maternal_weight_kg} kg</strong></div>
                    )}
                    {previewReport.visit_data.lila_cm && (
                      <div>LiLA: <strong className="text-body font-mono">{previewReport.visit_data.lila_cm} cm</strong></div>
                    )}
                    {previewReport.visit_data.hb_level && (
                      <div>Hb: <strong className="text-body font-mono">{previewReport.visit_data.hb_level} g/dL</strong></div>
                    )}
                    {previewReport.visit_data.child_weight_kg && (
                      <div>BB Anak: <strong className="text-body font-mono">{previewReport.visit_data.child_weight_kg} kg</strong></div>
                    )}
                    {previewReport.visit_data.child_length_cm && (
                      <div>PB/TB Anak: <strong className="text-body font-mono">{previewReport.visit_data.child_length_cm} cm</strong></div>
                    )}
                    {previewReport.visit_data.weight_trend_kms && (
                      <div>Tren KMS: <strong className="text-body font-mono">{previewReport.visit_data.weight_trend_kms}</strong></div>
                    )}
                    {previewReport.visit_data.birth_weight_gram && (
                      <div>BB Lahir: <strong className="text-body font-mono">{previewReport.visit_data.birth_weight_gram} g</strong></div>
                    )}
                  </div>
                </div>
              )}

              {/* Active Risk Flags */}
              <div className="space-y-2">
                <p className="font-bold text-heading uppercase tracking-wider text-xs">
                  Indikator Risiko Terdeteksi ({previewReport.risk_flags?.length || 0})
                </p>
                {previewReport.risk_flags && previewReport.risk_flags.length > 0 ? (
                  <div className="space-y-2">
                    {previewReport.risk_flags.map((flag, idx) => (
                      <div key={idx} className="p-3 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 rounded-xl space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-amber-950 dark:text-amber-200">{flag.indicator}</span>
                          <span className="text-xs bg-amber-200 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 px-2 py-0.5 rounded-full font-bold">
                            {flag.flag}
                          </span>
                        </div>
                        <p className="text-amber-800 dark:text-amber-300 leading-relaxed">{flag.detail}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800">
                    ✓ Tidak ditemukan indikator risiko kritis.
                  </p>
                )}
              </div>

              {/* Recommendations */}
              <div className="space-y-2">
                <p className="font-bold text-heading uppercase tracking-wider text-xs">
                  Rekomendasi Tindakan Klinis Kader
                </p>
                {previewReport.recommendations?.map((rec, idx) => (
                  <div key={idx} className="p-3 bg-card border border-line rounded-xl space-y-1.5 shadow-xs">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-sky-800 dark:text-sky-300">{idx + 1}. {rec.title}</span>
                      <span className="text-xs bg-accent-sky text-sky-800 dark:text-sky-300 px-2 py-0.5 rounded-full font-semibold">
                        {rec.category}
                      </span>
                    </div>
                    <p className="text-body leading-relaxed">{rec.recommendation_text}</p>
                    {rec.citation && (
                      <p className="text-xs text-dim flex items-center gap-1 pt-1 border-t border-line-light">
                        <BookOpen className="w-3 h-3 text-sky-600" />
                        <span>Rujukan: {rec.citation.source} (Hal. {rec.citation.page})</span>
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-line bg-subtle flex items-center justify-between">
              <span className="text-xs text-caption">
                Status: <strong>{previewReport.status}</strong> &bull; Revisi ke-{previewReport.revision_count}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPreviewReport(null)}
                  className="px-3.5 py-1.5 border border-line rounded-xl text-xs font-semibold text-label hover:bg-muted transition-colors cursor-pointer"
                >
                  Tutup
                </button>
                <button
                  onClick={() => {
                    const vId = previewReport.visit_id || previewReport.id;
                    setPreviewReport(null);
                    navigate(`/kader/validasi-laporan/${vId}`);
                  }}
                  className="btn-interactive inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-accent-sky hover:bg-sky-100 dark:hover:bg-sky-900/50 text-sky-700 dark:text-sky-300 rounded-xl text-xs font-semibold border border-sky-200 dark:border-sky-800/50 cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Buka Lembar Penuh</span>
                </button>
                {previewReport.pdf_path && (
                  <button
                    onClick={() => handleDownloadPdf(previewReport.id, previewReport.final_report_json?.metadata?.patient_name, previewReport.visit_data?.visit_date)}
                    className="btn-interactive inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Unduh PDF</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageReports;
