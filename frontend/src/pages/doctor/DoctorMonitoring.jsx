import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api, { getErrorMessage } from "../../services/api";
import {
  HeartPulse,
  Users,
  AlertTriangle,
  FileCheck2,
  FileSpreadsheet,
  Printer,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  BookOpen,
  Database,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Star,
  Layers,
  ChevronDown,
  X,
} from "lucide-react";

const DoctorMonitoring = () => {
  const [activeTab, setActiveTab] = useState("overview"); // "overview" | "revisions" | "chunks"
  const [loading, setLoading] = useState(true);
  const [selectedPosyandu, setSelectedPosyandu] = useState("");
  const [summaryData, setSummaryData] = useState(null);
  const [revisions, setRevisions] = useState([]);
  const [revLoading, setRevLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Review modal state
  const [reviewModal, setReviewModal] = useState(null); // { revision, action: "approve" | "reject" }
  const [doctorNotes, setDoctorNotes] = useState("");

  // RAG Knowledge Chunks state
  const [chunkSearch, setChunkSearch] = useState("");
  const [chunkSource, setChunkSource] = useState("");
  const [chunkCategory, setChunkCategory] = useState("");
  const [chunksData, setChunksData] = useState(null);
  const [chunkLoading, setChunkLoading] = useState(false);
  const [selectedChunk, setSelectedChunk] = useState(null);

  // Export / Print loading
  const [exportingExcel, setExportingExcel] = useState(false);
  const [printingPdf, setPrintingPdf] = useState(false);

  useEffect(() => {
    fetchMonitoringSummary();
  }, [selectedPosyandu]);

  useEffect(() => {
    if (activeTab === "revisions") {
      fetchRevisions();
    } else if (activeTab === "chunks") {
      fetchChunks();
    }
  }, [activeTab]);

  const fetchMonitoringSummary = async () => {
    try {
      setLoading(true);
      const params = {};
      if (selectedPosyandu) params.posyandu = selectedPosyandu;
      const res = await api.get("/doctor/monitoring-summary", { params });
      setSummaryData(res.data);
    } catch (err) {
      console.error("Gagal memuat ringkasan monitoring:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRevisions = async () => {
    try {
      setRevLoading(true);
      const res = await api.get("/revisions/", { params: { status: "PENDING" } });
      setRevisions(res.data || []);
    } catch (err) {
      console.error("Gagal memuat daftar revisi:", err);
    } finally {
      setRevLoading(false);
    }
  };

  const fetchChunks = async () => {
    try {
      setChunkLoading(true);
      const params = { limit: 20 };
      if (chunkSearch) params.search = chunkSearch;
      if (chunkSource) params.source = chunkSource;
      if (chunkCategory) params.category = chunkCategory;
      const res = await api.get("/doctor/knowledge-chunks", { params });
      setChunksData(res.data);
    } catch (err) {
      console.error("Gagal memuat koleksi chunk:", err);
    } finally {
      setChunkLoading(false);
    }
  };

  const handleExportExcel = async () => {
    try {
      setExportingExcel(true);
      const params = {};
      if (selectedPosyandu) params.posyandu = selectedPosyandu;
      const res = await api.get("/doctor/reports/export-excel", {
        params,
        responseType: "blob",
      });
      const blob = new Blob([res.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      const cleanName = selectedPosyandu
        ? selectedPosyandu.replace(/\s+/g, "_")
        : "Seluruh_Posyandu";
      link.href = url;
      link.download = `Laporan_ASIK_SIMPUS_${cleanName}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => window.URL.revokeObjectURL(url), 1000);
    } catch (err) {
      alert(getErrorMessage(err, "Gagal mengunduh berkas Excel."));
    } finally {
      setExportingExcel(false);
    }
  };

  const handlePrintPdf = async () => {
    try {
      setPrintingPdf(true);
      const params = {};
      if (selectedPosyandu) params.posyandu = selectedPosyandu;
      const res = await api.get("/doctor/reports/print-lb3-pdf", {
        params,
        responseType: "blob",
      });
      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      const cleanName = selectedPosyandu
        ? selectedPosyandu.replace(/\s+/g, "_")
        : "Seluruh_Posyandu";
      link.href = url;
      link.download = `Laporan_LB3_KIA_${cleanName}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => window.URL.revokeObjectURL(url), 1000);
    } catch (err) {
      alert(getErrorMessage(err, "Gagal mencetak dokumen PDF LB3-KIA."));
    } finally {
      setPrintingPdf(false);
    }
  };

  const handleProcessRevision = async () => {
    if (!reviewModal) return;
    try {
      setActionLoading(true);
      const endpoint =
        reviewModal.action === "approve"
          ? `/revisions/${reviewModal.revision.id}/approve`
          : `/revisions/${reviewModal.revision.id}/reject`;

      await api.post(endpoint, { notes: doctorNotes });
      setReviewModal(null);
      setDoctorNotes("");
      fetchRevisions();
      fetchMonitoringSummary();
    } catch (err) {
      alert(getErrorMessage(err, "Gagal memproses persetujuan revisi."));
    } finally {
      setActionLoading(false);
    }
  };

  const stats = summaryData?.summary_stats || {
    total_patients: 0,
    at_risk_count: 0,
    stunting_severe_count: 0,
    kek_count: 0,
    anemia_count: 0,
    kspr_high_risk_count: 0,
    pending_revisions_count: 0,
    average_kader_rating: 0,
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1440px] mx-auto space-y-6 animate-fade-in">
      {/* ─── Header & Action Bar ─── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-line">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-sky-600/10 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 flex items-center justify-center">
              <HeartPulse className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-heading tracking-tight">
                Portal Supervisi & Validasi Dokter KIA
              </h1>
              <p className="text-xs sm:text-sm text-caption">
                UPTD Puskesmas Airmadidi &bull; dr. Penanggung Jawab KIA & Pelayanan 1.000 HPK
              </p>
            </div>
          </div>
        </div>

        {/* Filter Posyandu & Export Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative min-w-[200px]">
            <select
              value={selectedPosyandu}
              onChange={(e) => setSelectedPosyandu(e.target.value)}
              className="w-full pl-3.5 pr-8 py-2 bg-card border border-line rounded-xl text-xs sm:text-sm font-semibold text-heading focus:outline-none focus:ring-2 focus:ring-sky-500/40 cursor-pointer appearance-none"
            >
              <option value="">Semua Posyandu (Agregat)</option>
              {(summaryData?.posyandu_list || []).map((pos) => (
                <option key={pos} value={pos}>
                  {pos}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-dim absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          <button
            type="button"
            onClick={handleExportExcel}
            disabled={exportingExcel}
            className="btn-interactive inline-flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-xs transition-all cursor-pointer disabled:opacity-50"
            title="Unduh format tabel e-PPGBM/ASIK & Rujukan SIMPUS"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>{exportingExcel ? "Mengunduh..." : "Unduh Excel ASIK"}</span>
          </button>

          <button
            type="button"
            onClick={handlePrintPdf}
            disabled={printingPdf}
            className="btn-interactive inline-flex items-center gap-2 px-3.5 py-2 bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-xs transition-all cursor-pointer disabled:opacity-50"
            title="Cetak format rekapitulasi resmi bulanan LB3-KIA bertanda tangan dokter"
          >
            <Printer className="w-4 h-4" />
            <span>{printingPdf ? "Mencetak..." : "Cetak Rekap LB3-KIA"}</span>
          </button>
        </div>
      </div>

      {/* ─── Metric Stat Cards Strip ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <div className="p-4 bg-card border border-line rounded-2xl space-y-1">
          <p className="text-xs text-caption font-medium">Total Pasien</p>
          <p className="text-2xl font-bold text-heading">{stats.total_patients}</p>
          <p className="text-xs text-dim">Dipantau 1.000 HPK</p>
        </div>

        <div className="p-4 bg-card border border-line rounded-2xl space-y-1">
          <p className="text-xs text-caption font-medium">Kasus Berisiko</p>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.at_risk_count}</p>
          <p className="text-xs text-dim">Perlu Intervensi</p>
        </div>

        <div className="p-4 bg-card border border-line rounded-2xl space-y-1">
          <p className="text-xs text-caption font-medium">Stunting / PB/U Rendah</p>
          <p className="text-2xl font-bold text-rose-600 dark:text-rose-400">{stats.stunting_severe_count}</p>
          <p className="text-xs text-dim">PB/U &lt; -2 SD</p>
        </div>

        <div className="p-4 bg-card border border-line rounded-2xl space-y-1">
          <p className="text-xs text-caption font-medium">Ibu Hamil KEK & Anemia</p>
          <p className="text-2xl font-bold text-heading">{stats.kek_count + stats.anemia_count}</p>
          <p className="text-xs text-dim">LiLA &lt; 23.5 / Hb &lt; 11</p>
        </div>

        <div className="p-4 bg-card border border-line rounded-2xl space-y-1">
          <p className="text-xs text-caption font-medium">Revisi Menunggu</p>
          <p className="text-2xl font-bold text-heading">{stats.pending_revisions_count}</p>
          <p className="text-xs text-dim">Butuh Persetujuan</p>
        </div>

        <div className="p-4 bg-card border border-line rounded-2xl space-y-1">
          <p className="text-xs text-caption font-medium">Kepuasan Kader AI</p>
          <div className="flex items-center gap-1.5">
            <p className="text-2xl font-bold text-heading">
              {stats.average_kader_rating ? stats.average_kader_rating.toFixed(1) : "-"}
            </p>
            <Star className="w-4 h-4 text-amber-500 fill-current" />
          </div>
          <p className="text-xs text-dim">Skala 1.0 - 5.0 (CSAT)</p>
        </div>
      </div>

      {/* ─── Tabs Navigation ─── */}
      <div className="flex items-center gap-2 border-b border-line">
        <button
          type="button"
          onClick={() => setActiveTab("overview")}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === "overview"
              ? "border-sky-600 text-sky-600 dark:text-sky-400"
              : "border-transparent text-label hover:text-heading"
          }`}
        >
          Pasien Berisiko & Pemantauan ({stats.at_risk_count})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("revisions")}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === "revisions"
              ? "border-sky-600 text-sky-600 dark:text-sky-400"
              : "border-transparent text-label hover:text-heading"
          }`}
        >
          <span>Persetujuan Revisi Data</span>
          {stats.pending_revisions_count > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500 text-white">
              {stats.pending_revisions_count}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("chunks")}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === "chunks"
              ? "border-sky-600 text-sky-600 dark:text-sky-400"
              : "border-transparent text-label hover:text-heading"
          }`}
        >
          <Database className="w-4 h-4 text-sky-500" />
          <span>Koleksi Pengetahuan RAG (Buku KIA & PNPK)</span>
        </button>
      </div>

      {/* ─── TAB 1: Overview & Risky Patients ─── */}
      {activeTab === "overview" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-heading">
                Daftar Kasus Berisiko Aktif
              </h3>
              <p className="text-xs text-caption">
                Pasien yang memerlukan evaluasi klinis dokter, resep PKMK, atau rujukan ke poli Puskesmas.
              </p>
            </div>
            <button
              onClick={fetchMonitoringSummary}
              className="p-2 border border-line bg-card hover:bg-subtle text-caption hover:text-heading rounded-xl transition-colors cursor-pointer self-start sm:self-auto"
              title="Perbarui data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>

          <div className="border border-line rounded-2xl overflow-hidden bg-card shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-subtle text-caption text-xs font-semibold border-b border-line uppercase tracking-wider">
                  <tr>
                    <th className="p-3.5">Nama Pasien</th>
                    <th className="p-3.5">Fase & Posyandu</th>
                    <th className="p-3.5">Status Klinis</th>
                    <th className="p-3.5">Indikator Risiko</th>
                    <th className="p-3.5 text-center">Confidence AI</th>
                    <th className="p-3.5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-caption">
                        Memuat data pemantauan...
                      </td>
                    </tr>
                  ) : (summaryData?.risky_reports || []).length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-caption">
                        Tidak ditemukan kasus berisiko aktif pada filter Posyandu ini. Seluruh pasien berada dalam rentang tumbuh kembang aman.
                      </td>
                    </tr>
                  ) : (
                    summaryData.risky_reports.map((item) => (
                      <tr key={item.report_id} className="hover:bg-subtle/50 transition-colors">
                        <td className="p-3.5 font-bold text-heading">
                          {item.patient_name}
                          <span className="block text-xs font-mono text-dim mt-0.5">
                            ID #{item.patient_id} &bull; Lap #{item.report_id}
                          </span>
                        </td>
                        <td className="p-3.5 text-caption">
                          <span className="font-semibold text-heading block">
                            {item.phase ? item.phase.replace(/_/g, " ") : "-"}
                          </span>
                          <span className="text-xs text-dim">{item.posyandu_name}</span>
                        </td>
                        <td className="p-3.5">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold border ${
                              item.overall_status === "RISIKO_TINGGI"
                                ? "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800"
                                : item.overall_status === "PERLU_PERHATIAN"
                                ? "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800"
                                : "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
                            }`}
                          >
                            {item.overall_status ? item.overall_status.replace(/_/g, " ") : "-"}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {(item.risk_flags || []).map((flag, fIdx) => (
                              <span
                                key={fIdx}
                                className="px-2 py-0.5 rounded text-[11px] font-medium bg-subtle text-heading border border-line"
                              >
                                {flag.replace(/_/g, " ")}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="p-3.5 text-center">
                          {item.confidence_score ? (
                            <span className="inline-block px-2.5 py-1 rounded-md text-xs font-bold bg-subtle border border-line">
                              {item.confidence_score}%
                            </span>
                          ) : (
                            <span className="text-xs text-dim">-</span>
                          )}
                        </td>
                        <td className="p-3.5 text-right">
                          <Link
                            to={`/kader/validasi-laporan/${item.report_id}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-sky-600 hover:bg-sky-700 text-white transition-colors"
                          >
                            <span>Evaluasi Lembar KIA</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 2: Persetujuan Revisi Data Posyandu ─── */}
      {activeTab === "revisions" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-heading">
                Permohonan Revisi Menunggu Keputusan Dokter
              </h3>
              <p className="text-xs text-caption">
                Kader Posyandu mengajukan koreksi antropometri atau parameter kunjungan. Dokter berwenang menyetujui agar graf AI berjalan ulang atau menolaknya.
              </p>
            </div>
            <button
              onClick={fetchRevisions}
              className="p-2 border border-line bg-card hover:bg-subtle text-caption hover:text-heading rounded-xl transition-colors cursor-pointer self-start sm:self-auto"
              title="Perbarui daftar revisi"
            >
              <RefreshCw className={`w-4 h-4 ${revLoading ? "animate-spin" : ""}`} />
            </button>
          </div>

          <div className="border border-line rounded-2xl overflow-hidden bg-card shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-subtle text-caption text-xs font-semibold border-b border-line uppercase tracking-wider">
                  <tr>
                    <th className="p-3.5">ID & Waktu Pengajuan</th>
                    <th className="p-3.5">Pasien & Posyandu</th>
                    <th className="p-3.5">Alasan Revisi Kader</th>
                    <th className="p-3.5">Koreksi Data</th>
                    <th className="p-3.5 text-center">Status</th>
                    <th className="p-3.5 text-right">Keputusan Dokter</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {revLoading ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-caption">
                        Memuat data permohonan revisi...
                      </td>
                    </tr>
                  ) : revisions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-caption">
                        Tidak ada permohonan revisi yang berstatus PENDING. Seluruh data posyandu telah divalidasi.
                      </td>
                    </tr>
                  ) : (
                    revisions.map((rev) => (
                      <tr key={rev.id} className="hover:bg-subtle/50 transition-colors">
                        <td className="p-3.5 font-mono text-xs">
                          <span className="font-bold text-heading block">#{rev.id}</span>
                          <span className="text-dim">
                            {rev.created_at ? new Date(rev.created_at).toLocaleDateString("id-ID") : "-"}
                          </span>
                        </td>
                        <td className="p-3.5 text-caption">
                          <span className="font-semibold text-heading block">
                            Laporan #{rev.report_id}
                          </span>
                          <span className="text-xs text-dim">Oleh: {rev.requested_by_username || "Kader"}</span>
                        </td>
                        <td className="p-3.5 text-body max-w-xs">
                          <p className="text-xs sm:text-sm italic">"{rev.reason}"</p>
                        </td>
                        <td className="p-3.5 text-xs font-mono text-caption max-w-xs truncate">
                          {rev.proposed_changes ? JSON.stringify(rev.proposed_changes) : "-"}
                        </td>
                        <td className="p-3.5 text-center">
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                            PENDING
                          </span>
                        </td>
                        <td className="p-3.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setReviewModal({ revision: rev, action: "reject" });
                                setDoctorNotes("");
                              }}
                              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                            >
                              Tolak
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setReviewModal({ revision: rev, action: "approve" });
                                setDoctorNotes("");
                              }}
                              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer"
                            >
                              Setujui
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 3: Koleksi Pengetahuan RAG (Buku KIA & PNPK) ─── */}
      {activeTab === "chunks" && (
        <div className="space-y-4">
          <div className="p-5 bg-card border border-line rounded-2xl space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <h3 className="text-base font-bold text-heading flex items-center gap-2">
                  <Database className="w-5 h-5 text-sky-500" />
                  <span>Transparansi Arsitektur RAG & Potongan Pengetahuan (Chunks)</span>
                </h3>
                <p className="text-xs text-caption leading-relaxed">
                  Semua pedoman klinis diurai menjadi potongan terstruktur (chunks) dari dokumen Markdown resmi Buku KIA 2024 dan PNPK Tata Laksana Stunting 2022. Agen 2 (Recommender) dan Agen 3 (Verifier) mengambil referensi mutlak dari koleksi ini.
                </p>
              </div>
              <button
                onClick={fetchChunks}
                className="p-2 border border-line bg-card hover:bg-subtle text-caption hover:text-heading rounded-xl transition-colors cursor-pointer self-start sm:self-auto shrink-0"
                title="Muat ulang koleksi"
              >
                <RefreshCw className={`w-4 h-4 ${chunkLoading ? "animate-spin" : ""}`} />
              </button>
            </div>

            {/* Storage Technical Metadata */}
            {chunksData?.storage_info && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-line text-xs font-mono">
                <div className="p-3 bg-subtle rounded-xl border border-line space-y-1">
                  <p className="text-caption font-sans font-medium">Penyimpanan Vektor</p>
                  <p className="font-bold text-heading">{chunksData.storage_info.chromadb_path}</p>
                  <p className="text-dim">Format SQLite ChromaDB</p>
                </div>
                <div className="p-3 bg-subtle rounded-xl border border-line space-y-1">
                  <p className="text-caption font-sans font-medium">Model Embedding</p>
                  <p className="font-bold text-heading truncate" title={chunksData.storage_info.embedding_model}>
                    {chunksData.storage_info.embedding_model}
                  </p>
                  <p className="text-dim">768 Dimensi Vektor</p>
                </div>
                <div className="p-3 bg-subtle rounded-xl border border-line space-y-1">
                  <p className="text-caption font-sans font-medium">Total Chunks Terindeks</p>
                  <p className="font-bold text-heading">{chunksData.total_chunks} Chunks</p>
                  <p className="text-dim">Heading-based Parser</p>
                </div>
                <div className="p-3 bg-subtle rounded-xl border border-line space-y-1">
                  <p className="text-caption font-sans font-medium">Mekanisme Re-Run</p>
                  <p className="font-bold text-emerald-600 dark:text-emerald-400">Persistent Indexed</p>
                  <p className="text-dim">Hanya dieksekusi 1x saat build</p>
                </div>
              </div>
            )}

            {/* Search & Filter Toolbar */}
            <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-2">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 text-dim absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={chunkSearch}
                  onChange={(e) => setChunkSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && fetchChunks()}
                  placeholder="Cari kata kunci (cth: stunting, formula F100, PMT, anemia, KEK, porsi MP-ASI)..."
                  className="w-full pl-10 pr-4 py-2 bg-subtle border border-line rounded-xl text-xs sm:text-sm text-heading placeholder:text-dim focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                />
              </div>

              <select
                value={chunkSource}
                onChange={(e) => setChunkSource(e.target.value)}
                className="w-full sm:w-auto px-3.5 py-2 bg-subtle border border-line rounded-xl text-xs sm:text-sm font-medium text-heading focus:outline-none focus:ring-2 focus:ring-sky-500/40 cursor-pointer"
              >
                <option value="">Semua Dokumen Rujukan</option>
                <option value="Buku_KIA_2024">Buku KIA 2024</option>
                <option value="PNPK 2022">PNPK Stunting 2022</option>
              </select>

              <button
                type="button"
                onClick={fetchChunks}
                className="w-full sm:w-auto px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
              >
                Cari Chunks
              </button>
            </div>
          </div>

          {/* Chunks Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {chunkLoading ? (
              <div className="col-span-2 p-12 text-center text-caption bg-card rounded-2xl border border-line">
                Memuat potongan pengetahuan medis...
              </div>
            ) : (chunksData?.chunks || []).length === 0 ? (
              <div className="col-span-2 p-12 text-center text-caption bg-card rounded-2xl border border-line">
                Tidak ditemukan potongan pengetahuan dengan kata kunci tersebut.
              </div>
            ) : (
              (chunksData.chunks || []).map((chunk) => (
                <div
                  key={chunk.id}
                  onClick={() => setSelectedChunk(chunk)}
                  className="card-interactive group cursor-pointer p-5 bg-card border border-line rounded-2xl flex flex-col justify-between gap-3 shadow-xs hover:border-sky-500/40"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border border-sky-300 dark:border-sky-800 uppercase">
                        {chunk.source ? chunk.source.replace(/\.md$/, "") : "Dokumen"}
                      </span>
                      <span className="text-xs font-mono text-dim">
                        Hal. {chunk.page || "-"}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-heading group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors line-clamp-1">
                      {chunk.chapter || "Pedoman Klinis"}
                    </h4>

                    <p className="text-xs text-body leading-relaxed line-clamp-3 font-mono bg-subtle p-2.5 rounded-xl border border-line">
                      "{chunk.snippet || chunk.text}"
                    </p>
                  </div>

                  <div className="pt-2.5 border-t border-line flex items-center justify-between text-xs font-semibold text-label">
                    <span className="text-caption truncate max-w-[200px]">
                      Kategori: {chunk.category || "Umum"}
                    </span>
                    <span className="flex items-center gap-1 group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                      <span>Buka Teks Lengkap</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ─── Modal Review Revisi (Dokter Approve / Reject) ─── */}
      {reviewModal && (
        <div
          className="fixed inset-0 bg-overlay backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setReviewModal(null);
          }}
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-card rounded-2xl max-w-lg w-full border border-line shadow-prominent overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-heading flex items-center gap-2">
                {reviewModal.action === "approve" ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                ) : (
                  <XCircle className="w-5 h-5 text-rose-500" />
                )}
                <span>
                  {reviewModal.action === "approve"
                    ? "Persetujuan Koreksi Revisi Data"
                    : "Penolakan Permohonan Revisi"}
                </span>
              </h3>
              <button
                type="button"
                onClick={() => setReviewModal(null)}
                className="p-1.5 text-dim hover:text-heading rounded-lg hover:bg-subtle cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 bg-subtle rounded-xl border border-line space-y-1 text-xs">
              <p className="font-semibold text-heading">
                Revisi ID #{reviewModal.revision.id} &bull; Laporan #{reviewModal.revision.report_id}
              </p>
              <p className="text-caption">
                Alasan Pengajuan Kader: <span className="text-body italic">"{reviewModal.revision.reason}"</span>
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-body mb-1.5">
                Catatan Supervisi Dokter (Opsional):
              </label>
              <textarea
                rows={3}
                value={doctorNotes}
                onChange={(e) => setDoctorNotes(e.target.value)}
                placeholder="Masukkan catatan klinis dokter untuk kader posyandu..."
                className="w-full p-3 bg-subtle border border-line rounded-xl text-xs sm:text-sm text-heading placeholder:text-dim focus:outline-none focus:ring-2 focus:ring-sky-500/40"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setReviewModal(null)}
                className="px-4 py-2 border border-line rounded-xl text-xs font-semibold text-label hover:bg-muted cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleProcessRevision}
                disabled={actionLoading}
                className={`px-4 py-2 text-white rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer ${
                  reviewModal.action === "approve"
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "bg-rose-600 hover:bg-rose-700"
                }`}
              >
                {actionLoading
                  ? "Memproses..."
                  : reviewModal.action === "approve"
                  ? "Konfirmasi & Setujui"
                  : "Konfirmasi Penolakan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal Detail Chunk (Pangkalan Data) ─── */}
      {selectedChunk && (
        <div
          className="fixed inset-0 bg-overlay backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedChunk(null);
          }}
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-card rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col border border-line shadow-prominent overflow-hidden">
            <div className="p-5 border-b border-line flex items-start justify-between gap-4">
              <div>
                <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border border-sky-300 dark:border-sky-800 uppercase">
                  {selectedChunk.source} &bull; Halaman {selectedChunk.page || "-"}
                </span>
                <h3 className="text-base font-bold text-heading mt-1">
                  {selectedChunk.chapter}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedChunk(null)}
                className="p-1.5 text-dim hover:text-heading rounded-lg hover:bg-subtle cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-3 font-mono text-xs sm:text-sm text-body leading-relaxed">
              <div className="p-4 bg-subtle rounded-xl border border-line whitespace-pre-wrap">
                {selectedChunk.text}
              </div>
            </div>

            <div className="p-4 border-t border-line bg-subtle flex items-center justify-between text-xs text-caption">
              <span>ID Chunk: {selectedChunk.id}</span>
              <span>Kategori: {selectedChunk.category}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DoctorMonitoring;

