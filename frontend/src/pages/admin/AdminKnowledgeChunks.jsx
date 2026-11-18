import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import { Search, RefreshCw, X } from "lucide-react";

const PHASE_LABELS = {
  IBU_HAMIL: "Ibu Hamil",
  BAYI_BARU_LAHIR: "Bayi Baru Lahir",
  BADUTA: "Baduta (1-24 Bulan)",
};

const AdminKnowledgeChunks = () => {
  const [reportGroups, setReportGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [selectedReportModal, setSelectedReportModal] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    fetchReportChunks();
  }, []);

  const fetchReportChunks = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await api.get("/admin/report-citations", {
        params: { limit: 300 },
      });
      const data = res.data || {};

      if (Array.isArray(data.reports_grouped) && data.reports_grouped.length > 0) {
        setReportGroups(data.reports_grouped);
      } else if (Array.isArray(data.citations)) {
        const map = new Map();
        data.citations.forEach((cit) => {
          const repId = cit.report_id;
          if (!repId) return;
          if (!map.has(repId)) {
            map.set(repId, {
              report_id: repId,
              visit_id: cit.visit_id,
              patient_id: cit.patient_id,
              patient_name: cit.patient_name || "Pasien KIA",
              nik: cit.nik || "-",
              village_name: cit.village_name || "Airmadidi",
              posyandu_name: cit.posyandu_name || "Posyandu Airmadidi",
              visit_date: cit.visit_date || "-",
              phase: cit.phase || "-",
              overall_status: cit.overall_status || "KONDISI_BAIK",
              sources: [],
              pages: [],
              chunk_ids: [],
              items: [],
            });
          }
          const grp = map.get(repId);
          grp.items.push(cit);

          if (cit.citation_source && !grp.sources.includes(cit.citation_source)) {
            grp.sources.push(cit.citation_source);
          }
          const pagesList =
            Array.isArray(cit.additional_pages) && cit.additional_pages.length > 0
              ? cit.additional_pages
              : cit.citation_page && cit.citation_page !== "-"
              ? [String(cit.citation_page)]
              : [];
          pagesList.forEach((p) => {
            if (p && !grp.pages.includes(String(p))) grp.pages.push(String(p));
          });

          const cids =
            Array.isArray(cit.supporting_chunk_ids) && cit.supporting_chunk_ids.length > 0
              ? cit.supporting_chunk_ids
              : cit.chunk_id
              ? [String(cit.chunk_id)]
              : [];
          cids.forEach((cid) => {
            if (cid && !grp.chunk_ids.includes(String(cid))) grp.chunk_ids.push(String(cid));
          });
        });

        const grouped = Array.from(map.values()).map((g) => ({
          ...g,
          chunks_count: Math.max(g.chunk_ids.length, g.items.length),
          recommendations_count: g.items.length,
        }));
        setReportGroups(grouped);
      } else {
        setReportGroups([]);
      }
    } catch {
      setErrorMsg("Gagal memuat daftar chunk rujukan per laporan.");
    } finally {
      setLoading(false);
    }
  };

  const filteredGroups = useMemo(() => {
    return reportGroups.filter((grp) => {
      if (sourceFilter) {
        const sfLower = sourceFilter.toLowerCase();
        const hasSource =
          (grp.sources || []).some((s) => (s || "").toLowerCase().includes(sfLower)) ||
          (grp.items || []).some((it) =>
            (it.citation_source || "").toLowerCase().includes(sfLower)
          );
        if (!hasSource) return false;
      }

      const q = searchQuery.trim().toLowerCase();
      if (q) {
        const matchId = String(grp.report_id).includes(q);
        const matchName = (grp.patient_name || "").toLowerCase().includes(q);
        const matchNik = (grp.nik || "").toLowerCase().includes(q);
        const matchPosyandu = (grp.posyandu_name || "").toLowerCase().includes(q);
        const matchVillage = (grp.village_name || "").toLowerCase().includes(q);
        const matchItems = (grp.items || []).some(
          (it) =>
            (it.recommendation_title || "").toLowerCase().includes(q) ||
            (it.evidence_quote || "").toLowerCase().includes(q) ||
            (it.citation_section || "").toLowerCase().includes(q)
        );
        if (
          !matchId &&
          !matchName &&
          !matchNik &&
          !matchPosyandu &&
          !matchVillage &&
          !matchItems
        ) {
          return false;
        }
      }

      return true;
    });
  }, [reportGroups, sourceFilter, searchQuery]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-line-light">
        <div>
          <h1 className="text-2xl font-bold text-heading">
            Koleksi Chunk & Rujukan
          </h1>
          <p className="text-sm text-caption mt-1">
            Daftar rujukan pedoman klinis dan potongan teks chunk untuk setiap laporan kunjungan pasien.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchReportChunks}
          disabled={loading}
          className="btn-interactive flex items-center gap-2 px-3.5 py-2 bg-card hover:bg-muted border border-line rounded-lg text-xs font-semibold text-heading transition-colors cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          <span>Muat Ulang</span>
        </button>
      </div>

      {errorMsg && (
        <div className="p-3.5 rounded-lg bg-accent-red border border-red-300 dark:border-red-800/50 text-xs font-semibold text-red-700 dark:text-red-300">
          {errorMsg}
        </div>
      )}

      {/* Pencarian & Filter */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-dim absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nomor laporan, nama pasien, NIK, atau posyandu..."
            aria-label="Cari chunk rujukan"
            className="w-full h-10 pl-10 pr-9 bg-card border border-line rounded-lg text-sm text-heading placeholder:text-dim focus:outline-none focus:ring-2 focus:ring-sky-500/40"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              aria-label="Bersihkan pencarian"
              className="!min-h-0 p-1 text-dim hover:text-heading absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          aria-label="Filter dokumen pedoman"
          className="h-10 px-3.5 bg-card border border-line rounded-lg text-xs sm:text-sm font-medium text-heading focus:outline-none focus:ring-2 focus:ring-sky-500/40 cursor-pointer"
        >
          <option value="">Semua Dokumen ({reportGroups.length} Laporan)</option>
          <option value="Buku KIA">Buku KIA 2024</option>
          <option value="Pedoman Nasional">PNPK Stunting 2022</option>
          <option value="Ringkasan Terkurasi">Ringkasan Terkurasi</option>
        </select>
      </div>

      {/* Tabel Utama: 1 Baris per Laporan */}
      <div className="bg-card rounded-xl border border-line overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-muted border-b border-line text-xs font-semibold text-caption">
                <th className="py-3.5 px-5">No. Laporan</th>
                <th className="py-3.5 px-5">Pasien & Posyandu</th>
                <th className="py-3.5 px-5">Dokumen & Halaman Rujukan</th>
                <th className="py-3.5 px-5">Jumlah Chunk</th>
                <th className="py-3.5 px-5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-light">
              {loading ? (
                <tr>
                  <td colSpan="5" className="py-12 text-center text-sm text-caption">
                    Memuat data rujukan chunk...
                  </td>
                </tr>
              ) : filteredGroups.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-12 text-center text-sm text-caption">
                    Tidak ada laporan yang cocok dengan filter pencarian.
                  </td>
                </tr>
              ) : (
                filteredGroups.map((grp) => {
                  const cleanSources = Array.from(
                    new Set(
                      (grp.sources || [])
                        .filter(Boolean)
                        .map((s) => s.replace(/\.md$/i, ""))
                    )
                  );
                  const pagesList = grp.pages || [];

                  return (
                    <tr
                      key={grp.report_id}
                      className="hover:bg-muted/40 transition-colors"
                    >
                      <td className="py-4 px-5 whitespace-nowrap">
                        <Link
                          to={`/kader/validasi-laporan/${grp.report_id}`}
                          className="font-semibold text-heading hover:underline block"
                        >
                          Laporan #{grp.report_id}
                        </Link>
                        <span className="text-xs text-caption block mt-0.5">
                          {grp.visit_date}
                        </span>
                      </td>

                      <td className="py-4 px-5">
                        <p className="font-semibold text-heading">{grp.patient_name}</p>
                        <p className="text-xs text-caption mt-0.5">
                          {grp.posyandu_name} &bull; {PHASE_LABELS[grp.phase] || grp.phase}
                        </p>
                      </td>

                      <td className="py-4 px-5 text-xs text-body">
                        <p className="font-medium text-heading">
                          {cleanSources.length > 0
                            ? cleanSources.join(", ")
                            : "Pedoman Standar KIA"}
                        </p>
                        <p className="text-caption mt-0.5">
                          {pagesList.length > 0
                            ? `Halaman ${pagesList.join(", ")}`
                            : "Aturan Baku Sistem"}
                        </p>
                      </td>

                      <td className="py-4 px-5 whitespace-nowrap text-xs text-body">
                        {grp.recommendations_count || grp.items.length} rekomendasi &bull;{" "}
                        {grp.chunks_count || grp.items.length} chunk
                      </td>

                      <td className="py-4 px-5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setSelectedReportModal(grp)}
                          className="!min-h-0 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-subtle hover:bg-muted text-heading border border-line transition-colors cursor-pointer"
                        >
                          Lihat Chunk
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pop-up Modal Rincian Chunk per Laporan */}
      {selectedReportModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 sm:p-6 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedReportModal(null);
          }}
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-card border border-line rounded-xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-xl overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-subtle border-b border-line flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-heading">
                  Rincian Chunk & Rujukan Laporan #{selectedReportModal.report_id} — {selectedReportModal.patient_name}
                </h3>
                <p className="text-xs text-caption mt-1">
                  NIK: {selectedReportModal.nik} &bull; {selectedReportModal.posyandu_name} &bull;{" "}
                  Kunjungan {selectedReportModal.visit_date}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedReportModal(null)}
                aria-label="Tutup modal chunk"
                className="!min-h-0 p-1.5 rounded-lg text-dim hover:text-heading hover:bg-muted cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1 bg-page">
              {(selectedReportModal.items || []).map((item, idx) => {
                const pagesDisplay =
                  Array.isArray(item.additional_pages) && item.additional_pages.length > 0
                    ? item.additional_pages.join(", ")
                    : item.citation_page || "-";
                const sectionsDisplay =
                  Array.isArray(item.additional_sections) && item.additional_sections.length > 0
                    ? item.additional_sections.join("; ")
                    : item.citation_section || "-";
                const chunkIdsList =
                  Array.isArray(item.supporting_chunk_ids) && item.supporting_chunk_ids.length > 0
                    ? item.supporting_chunk_ids.join(", ")
                    : item.chunk_id || "-";
                const supportingChunks = Array.isArray(item.supporting_chunks)
                  ? item.supporting_chunks
                  : [];

                return (
                  <div
                    key={idx}
                    className="bg-card border border-line rounded-xl p-5 space-y-3 text-xs"
                  >
                    <div className="pb-2.5 border-b border-line">
                      <h4 className="text-sm font-bold text-heading">
                        {idx + 1}. {item.recommendation_title}
                      </h4>
                      <p className="text-caption mt-1">
                        Dokumen:{" "}
                        <strong className="text-body">
                          {item.citation_source
                            ? item.citation_source.replace(/\.md$/i, "")
                            : "Pedoman Standar KIA"}
                        </strong>
                        {" • "}Halaman: <strong className="text-body">{pagesDisplay}</strong>
                        {" • "}Bagian: <strong className="text-body">{sectionsDisplay}</strong>
                        {chunkIdsList !== "-" && (
                          <>
                            {" • "}ID Chunk: <strong className="text-body">{chunkIdsList}</strong>
                          </>
                        )}
                      </p>
                    </div>

                    {item.evidence_quote && item.evidence_status !== "TANPA_KUTIPAN" && (
                      <div className="space-y-1">
                        <p className="text-caption font-medium">Kutipan Dokumen:</p>
                        <p className="text-body italic leading-relaxed">
                          &ldquo;{item.evidence_quote}&rdquo;
                        </p>
                      </div>
                    )}

                    {supportingChunks.length > 0 && (
                      <div className="space-y-2 pt-2 border-t border-line-light">
                        <p className="text-caption font-medium">
                          Isi Chunk Pendukung ({supportingChunks.length}):
                        </p>
                        <div className="divide-y divide-line border border-line rounded-lg overflow-hidden">
                          {supportingChunks.map((sc, sIdx) => (
                            <div
                              key={sIdx}
                              className="p-3.5 bg-subtle/40 space-y-1"
                            >
                              <p className="font-semibold text-heading">
                                {sc.chunk_id || `Chunk #${sIdx + 1}`} —{" "}
                                {(sc.doc_name || item.citation_source || "").replace(/\.md$/i, "")} (Hal. {sc.page || "-"}, {sc.section || "-"})
                              </p>
                              <p className="text-body leading-relaxed whitespace-pre-wrap">
                                {sc.full_text || sc.excerpt || "-"}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 bg-subtle border-t border-line flex items-center justify-between">
              <Link
                to={`/kader/validasi-laporan/${selectedReportModal.report_id}`}
                className="text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline"
              >
                Buka Lembar Laporan #{selectedReportModal.report_id}
              </Link>
              <button
                type="button"
                onClick={() => setSelectedReportModal(null)}
                className="!min-h-0 px-4 py-1.5 bg-card hover:bg-muted text-heading border border-line rounded-lg text-xs font-semibold cursor-pointer"
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
