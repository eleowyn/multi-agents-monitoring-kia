import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";
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
} from "lucide-react";

const ArsipLaporan = () => {
  const [reports, setReports] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [riskFilter, setRiskFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    fetchReports();
  }, [statusFilter, riskFilter]);

  const fetchReports = async () => {
    try {
      setLoading(true);
      setError("");
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (riskFilter) params.overall_status = riskFilter;
      if (search) params.search = search;

      const res = await api.get("/reports/", { params });
      setReports(res.data);
    } catch (e) {
      console.error(e);
      setError("Gagal memuat arsip laporan KIA. Silakan periksa koneksi backend.");
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchReports();
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

  const getRiskBadge = (risk) => {
    switch (risk) {
      case "RISIKO_TINGGI":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-accent-rose text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800/50">
            <AlertTriangle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
            Risiko Tinggi
          </span>
        );
      case "PERLU_PERHATIAN":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-accent-amber text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50">
            <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
            Perlu Perhatian
          </span>
        );
      case "KONDISI_BAIK":
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-accent-emerald text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50">
            <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
            Kondisi Baik
          </span>
        );
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "APPROVED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40">
            <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
            Disahkan
          </span>
        );
      case "REJECTED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800/40">
            <XCircle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
            Ditolak
          </span>
        );
      case "DRAFT":
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40">
            <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
            Draft (Review)
          </span>
        );
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-line-light">
        <div>
          <h2 className="text-xl font-bold text-heading">Arsip Laporan KIA</h2>
          <p className="text-xs text-caption mt-0.5">
            Direktori rekapitulasi analisis multi-agent AI, status validasi kader, dan arsip rujukan resmi
          </p>
        </div>
        <button
          onClick={fetchReports}
          disabled={loading}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-card border border-line hover:bg-muted text-label hover:text-heading rounded-xl text-xs font-semibold transition-colors duration-200 cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-sky-600 dark:text-sky-400 ${loading ? "animate-spin" : ""}`} />
          Segarkan
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
            onClick={fetchReports}
            className="px-3 py-1 bg-red-100 dark:bg-red-900/40 hover:bg-red-200 text-red-700 dark:text-red-300 rounded-lg text-xs font-semibold"
          >
            Coba Lagi
          </button>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        <form onSubmit={handleSearchSubmit} className="relative flex-1" role="search">
          <input
            type="text"
            placeholder="Cari nama atau NIK pasien..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-card border border-line rounded-xl text-xs text-heading placeholder:text-dim focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500 transition-all duration-200"
          />
          <Search className="w-4 h-4 text-dim absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </form>

        <select
          value={riskFilter}
          onChange={(e) => setRiskFilter(e.target.value)}
          className="px-3 py-2 bg-card border border-line rounded-xl text-xs font-medium text-body focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500 transition-all duration-200"
        >
          <option value="">-- Semua Status Risiko --</option>
          <option value="KONDISI_BAIK">Kondisi Baik</option>
          <option value="PERLU_PERHATIAN">Perlu Perhatian</option>
          <option value="RISIKO_TINGGI">Risiko Tinggi</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-card border border-line rounded-xl text-xs font-medium text-body focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500 transition-all duration-200"
        >
          <option value="">-- Semua Status Validasi --</option>
          <option value="DRAFT">DRAFT (Perlu Validasi)</option>
          <option value="APPROVED">APPROVED (Disahkan)</option>
          <option value="REJECTED">REJECTED (Ditolak/Direvisi)</option>
        </select>
      </div>

      {!loading && (
        <p className="text-xs text-dim font-medium">
          Menampilkan {filteredReports.length} laporan pemeriksaan
        </p>
      )}

      {/* Desktop Table */}
      <div className="hidden md:block bg-card rounded-2xl border border-line shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-muted text-label border-b border-line">
              <tr>
                <th className="p-3">ID & Tanggal</th>
                <th className="p-3">Nama & NIK Pasien</th>
                <th className="p-3">Fase & Wilayah</th>
                <th className="p-3">Status Risiko AI</th>
                <th className="p-3">Status Validasi</th>
                <th className="p-3 text-center w-44">Aksi Laporan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-light">
              {loading ? (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-dim">
                    Memuat daftar arsip laporan...
                  </td>
                </tr>
              ) : filteredReports.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-12 text-center text-dim italic">
                    <FileSearch className="w-10 h-10 text-dim mx-auto mb-2 opacity-50" />
                    Belum ada arsip laporan yang sesuai kriteria pencarian.
                  </td>
                </tr>
              ) : (
                filteredReports.map((r) => (
                  <tr key={r.id} className="hover:bg-accent-sky transition-colors duration-150">
                    <td className="p-3 text-caption">
                      <p className="font-bold text-heading">#{r.id}</p>
                      <p className="text-[10px] text-dim">{r.visit_date || "-"}</p>
                    </td>
                    <td className="p-3">
                      <p className="font-bold text-heading">{r.patient_name || "Pasien"}</p>
                      <p className="text-[10px] text-dim">NIK: {r.patient_nik || "-"}</p>
                    </td>
                    <td className="p-3 text-body">
                      <p className="font-semibold text-heading">{r.phase || "-"}</p>
                      <p className="text-[10px] text-caption">{r.village_name || "Airmadidi"}</p>
                    </td>
                    <td className="p-3">
                      {getRiskBadge(r.overall_status)}
                      {r.risk_count > 0 && (
                        <p className="text-[10px] text-dim mt-0.5">{r.risk_count} indikator risiko</p>
                      )}
                    </td>
                    <td className="p-3">
                      {getStatusBadge(r.status)}
                      {r.revision_count > 0 && (
                        <p className="text-[10px] text-dim mt-0.5">Revisi ke-{r.revision_count}</p>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1.5 w-[142px] mx-auto">
                        <button
                          onClick={() => navigate(`/kader/validasi-laporan/${r.visit_id}`)}
                          className="w-[74px] inline-flex items-center justify-center gap-1 py-1 bg-accent-sky hover:bg-sky-100 dark:hover:bg-sky-900/50 text-sky-700 dark:text-sky-300 rounded-lg font-semibold text-xs transition-colors border border-sky-200 dark:border-sky-800/50 cursor-pointer"
                          title="Buka Lembar Validasi Laporan"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Rincian</span>
                        </button>
                        {r.has_pdf ? (
                          <button
                            onClick={() => handleDownloadPdf(r.id, r.patient_name, r.visit_date)}
                            className="w-[62px] inline-flex items-center justify-center gap-1 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 rounded-lg font-semibold text-xs transition-colors border border-emerald-200 dark:border-emerald-800/50 cursor-pointer"
                            title="Unduh Dokumen PDF Resmi"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>PDF</span>
                          </button>
                        ) : (
                          <span className="w-[62px] inline-block" aria-hidden="true" />
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <div className="p-6 text-center text-dim bg-card rounded-xl border border-line">
            Memuat arsip laporan...
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="p-8 text-center text-dim bg-card rounded-xl border border-line italic">
            Belum ada arsip laporan yang ditemukan.
          </div>
        ) : (
          filteredReports.map((r) => (
            <div
              key={r.id}
              className="p-3.5 bg-card rounded-xl border border-line shadow-card space-y-2.5"
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-bold text-heading text-sm">{r.patient_name || "Pasien"}</p>
                  <p className="text-[11px] text-dim">NIK: {r.patient_nik || "-"} &bull; {r.phase}</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-dim font-bold">#{r.id}</span>
                  <p className="text-[10px] text-caption">{r.visit_date}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {getRiskBadge(r.overall_status)}
                {getStatusBadge(r.status)}
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-line-light">
                <button
                  onClick={() => navigate(`/kader/validasi-laporan/${r.visit_id}`)}
                  className="flex-1 py-1.5 bg-accent-sky text-sky-700 dark:text-sky-300 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 border border-sky-200 dark:border-sky-800/50"
                >
                  <ExternalLink className="w-3 h-3" />
                  Buka Laporan
                </button>
                {r.has_pdf && (
                  <button
                    onClick={() => handleDownloadPdf(r.id, r.patient_name, r.visit_date)}
                    className="flex-1 py-1.5 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 border border-emerald-200 dark:border-emerald-800/50"
                  >
                    <Download className="w-3 h-3" />
                    Unduh PDF
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ArsipLaporan;
