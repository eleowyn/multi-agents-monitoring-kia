import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api, { getErrorMessage } from "../../services/api";
import {
  FileText,
  Search,
  BookOpen,
  Filter,
  ExternalLink,
  ChevronRight,
  Database,
  Layers,
  Info,
  X,
  FileCheck2,
} from "lucide-react";

const AdminKnowledgeChunks = () => {
  const [activeTab, setActiveTab] = useState("citations"); // 'citations' | 'library'
  
  // Tab 1: Citations in Reports state
  const [citations, setCitations] = useState([]);
  const [citationsLoading, setCitationsLoading] = useState(true);
  const [citationSearch, setCitationSearch] = useState("");
  const [citationSourceFilter, setCitationSourceFilter] = useState("");

  // Tab 2: Raw Chunks Library state
  const [chunks, setChunks] = useState([]);
  const [chunksTotal, setChunksTotal] = useState(0);
  const [chunksLoading, setChunksLoading] = useState(false);
  const [chunkSearch, setChunkSearch] = useState("");
  const [chunkSource, setChunkSource] = useState("");
  const [selectedChunk, setSelectedChunk] = useState(null);

  // Error state
  const [error, setError] = useState("");

  useEffect(() => {
    fetchCitations();
  }, []);

  useEffect(() => {
    if (activeTab === "library" && chunks.length === 0) {
      fetchChunks();
    }
  }, [activeTab]);

  const fetchCitations = async () => {
    try {
      setCitationsLoading(true);
      setError("");
      const params = {};
      if (citationSearch.trim()) params.search = citationSearch.trim();
      const res = await api.get("/doctor/report-citations", { params });
      setCitations(res.data?.citations || []);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setCitationsLoading(false);
    }
  };

  const fetchChunks = async () => {
    try {
      setChunksLoading(true);
      setError("");
      const params = { limit: 50 };
      if (chunkSearch.trim()) params.search = chunkSearch.trim();
      if (chunkSource) params.source = chunkSource;
      const res = await api.get("/doctor/knowledge-chunks", { params });
      setChunks(res.data?.chunks || []);
      setChunksTotal(res.data?.total || 0);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setChunksLoading(false);
    }
  };

  // Filter citations client-side by source if selected
  const filteredCitations = citations.filter((item) => {
    if (!citationSourceFilter) return true;
    return (item.citation_source || "").toLowerCase().includes(citationSourceFilter.toLowerCase());
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* ─── Page Header ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-line">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-heading">
              Koleksi Rujukan & Chunks RAG
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-caption">
            Transparansi rujukan klinis AI: potongan pedoman resmi Buku KIA & PNPK Stunting yang digunakan pada laporan pasien.
          </p>
        </div>

        {/* Tab Switcher: Simple text-underline style, non-slop */}
        <div className="inline-flex rounded-lg border border-line bg-subtle p-1 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab("citations")}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "citations"
                ? "bg-card text-heading shadow-2xs font-bold"
                : "text-dim hover:text-heading"
            }`}
          >
            Kutipan pada Laporan Pasien ({filteredCitations.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("library")}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "library"
                ? "bg-card text-heading shadow-2xs font-bold"
                : "text-dim hover:text-heading"
            }`}
          >
            Pustaka Dokumen Pedoman
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-lg text-xs text-rose-700 dark:text-rose-300">
          {error}
        </div>
      )}

      {/* ════════════ TAB 1: KUTIPAN PADA LAPORAN PASIEN ════════════ */}
      {activeTab === "citations" && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            <div className="flex-1 relative">
              <input
                type="text"
                value={citationSearch}
                onChange={(e) => setCitationSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchCitations()}
                placeholder="Cari nomor laporan, nama pasien, NIK, atau teks rekomendasi..."
                className="w-full h-9 pl-9 pr-3 bg-card border border-line rounded-lg text-xs text-heading placeholder:text-dim focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
              <Search className="w-4 h-4 text-dim absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={citationSourceFilter}
                onChange={(e) => setCitationSourceFilter(e.target.value)}
                className="h-9 px-3 bg-card border border-line rounded-lg text-xs font-medium text-heading focus:outline-none focus:ring-1 focus:ring-sky-500 cursor-pointer"
              >
                <option value="">Semua Dokumen Pedoman</option>
                <option value="Buku_KIA">Buku KIA 2024</option>
                <option value="PNPK">PNPK Stunting 2022</option>
              </select>

              <button
                type="button"
                onClick={fetchCitations}
                className="h-9 px-3.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                Cari
              </button>
            </div>
          </div>

          {/* Table of Report Citations */}
          <div className="bg-card border border-line rounded-xl overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-line bg-subtle text-caption font-semibold">
                    <th className="py-2.5 px-3 w-16">No. Lap</th>
                    <th className="py-2.5 px-3 min-w-[180px]">Pasien & Posyandu</th>
                    <th className="py-2.5 px-3 min-w-[200px]">Rekomendasi Klinis AI</th>
                    <th className="py-2.5 px-3 min-w-[160px]">Rujukan Pedoman</th>
                    <th className="py-2.5 px-3 min-w-[260px]">Potongan Teks Rujukan (Chunk)</th>
                    <th className="py-2.5 px-3 w-24 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60">
                  {citationsLoading ? (
                    <tr>
                      <td colSpan="6" className="py-10 text-center text-caption">
                        Memuat data rujukan laporan...
                      </td>
                    </tr>
                  ) : filteredCitations.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="py-10 text-center text-caption">
                        Belum ada kutipan rujukan pada laporan pasien yang cocok.
                      </td>
                    </tr>
                  ) : (
                    filteredCitations.map((item, idx) => (
                      <tr key={`${item.report_id}-${idx}`} className="hover:bg-muted/30 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-bold text-sky-700 dark:text-sky-400">
                          #{item.report_id}
                        </td>
                        <td className="py-2.5 px-3 space-y-0.5">
                          <p className="font-semibold text-heading">{item.patient_name}</p>
                          <p className="text-[11px] text-caption font-mono">NIK: {item.nik}</p>
                          <p className="text-[11px] text-dim truncate">
                            {item.posyandu_name} • {item.visit_date}
                          </p>
                        </td>
                        <td className="py-2.5 px-3 space-y-0.5">
                          <p className="font-medium text-heading leading-snug">{item.recommendation_title}</p>
                          <span className="text-[10px] text-caption uppercase font-semibold">
                            {item.category || "EDUKASI"}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 space-y-0.5">
                          <p className="font-semibold text-heading truncate">
                            {item.citation_source ? item.citation_source.replace(/\.md$/, "") : "Buku KIA 2024"}
                          </p>
                          <p className="text-[11px] text-caption truncate">{item.citation_section}</p>
                          {item.citation_page && (
                            <p className="text-[10px] text-dim">Halaman/Bab {item.citation_page}</p>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          <p className="text-[11px] text-body leading-relaxed bg-subtle p-2 rounded border border-line line-clamp-3">
                            "{item.evidence_quote}"
                          </p>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <Link
                            to={`/kader/validasi-laporan/${item.report_id}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-sky-700 dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-sky-950/40 rounded border border-sky-300 dark:border-sky-800 transition-colors"
                            title="Buka Lembar Verifikasi Laporan"
                          >
                            <span>Buka</span>
                            <ExternalLink className="w-3 h-3" />
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

      {/* ════════════ TAB 2: PUSTAKA SELURUH DOKUMEN RAG ════════════ */}
      {activeTab === "library" && (
        <div className="space-y-4">
          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            <div className="flex-1 relative">
              <input
                type="text"
                value={chunkSearch}
                onChange={(e) => setChunkSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchChunks()}
                placeholder="Cari kata kunci (stunting, LiLA, tablet tambah darah, MP-ASI, Z-score, F100)..."
                className="w-full h-9 pl-9 pr-3 bg-card border border-line rounded-lg text-xs text-heading placeholder:text-dim focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
              <Search className="w-4 h-4 text-dim absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={chunkSource}
                onChange={(e) => setChunkSource(e.target.value)}
                className="h-9 px-3 bg-card border border-line rounded-lg text-xs font-medium text-heading focus:outline-none focus:ring-1 focus:ring-sky-500 cursor-pointer"
              >
                <option value="">Semua Dokumen Pedoman</option>
                <option value="Buku_KIA_2024">Buku KIA 2024 (Kemenkes RI)</option>
                <option value="PNPK 2022">PNPK Stunting 2022</option>
              </select>

              <button
                type="button"
                onClick={fetchChunks}
                className="h-9 px-3.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                Cari Chunks
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-caption">
            <span>Menampilkan {chunks.length} potongan pengetahuan {chunksTotal > 0 && `dari total ${chunksTotal}`}</span>
          </div>

          {/* Chunks Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {chunksLoading ? (
              <div className="col-span-2 py-12 text-center text-caption bg-card rounded-xl border border-line">
                Memuat potongan pengetahuan medis...
              </div>
            ) : chunks.length === 0 ? (
              <div className="col-span-2 py-12 text-center text-caption bg-card rounded-xl border border-line">
                Tidak ditemukan potongan pengetahuan dengan kata kunci tersebut.
              </div>
            ) : (
              chunks.map((chunk) => (
                <div
                  key={chunk.id}
                  onClick={() => setSelectedChunk(chunk)}
                  className="cursor-pointer p-4 bg-card border border-line rounded-xl space-y-2 hover:border-sky-500/50 transition-colors shadow-2xs"
                >
                  <div className="flex items-center justify-between gap-2 border-b border-line/60 pb-1.5">
                    <span className="text-[11px] font-bold text-sky-700 dark:text-sky-300">
                      {chunk.source ? chunk.source.replace(/\.md$/, "") : "Dokumen"}
                    </span>
                    <span className="text-[11px] text-dim font-mono">
                      Hal. {chunk.page || "-"}
                    </span>
                  </div>

                  <h3 className="text-xs font-bold text-heading truncate">
                    {chunk.chapter || "Pedoman Klinis"}
                  </h3>

                  <p className="text-xs text-body leading-relaxed line-clamp-3 bg-subtle p-2.5 rounded border border-line">
                    "{chunk.snippet || chunk.text}"
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ─── Modal Baca Chunk Lengkap ─── */}
      {selectedChunk && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-fade-in"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-card border border-line rounded-xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-xl">
            <div className="flex items-center justify-between p-4 border-b border-line">
              <div>
                <p className="text-xs text-caption font-semibold">
                  {selectedChunk.source} • Halaman/Bab {selectedChunk.page || "-"}
                </p>
                <h3 className="text-sm sm:text-base font-bold text-heading">
                  {selectedChunk.chapter || "Rincian Potongan Dokumen"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedChunk(null)}
                className="p-1 rounded-md text-dim hover:text-heading hover:bg-muted"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-3 flex-1 text-xs sm:text-sm text-body leading-relaxed whitespace-pre-wrap font-sans bg-subtle/50">
              {selectedChunk.text || selectedChunk.snippet}
            </div>

            <div className="p-3 border-t border-line flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedChunk(null)}
                className="px-4 py-1.5 bg-subtle border border-line rounded-lg text-xs font-semibold text-heading hover:bg-muted"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminKnowledgeChunks;

