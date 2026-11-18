import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import { RefreshCw, FileDown, Search, X } from "lucide-react";

const PHASE_LABELS = {
  IBU_HAMIL: "Ibu Hamil",
  BAYI_BARU_LAHIR: "Bayi Baru Lahir",
  BADUTA: "Baduta (1-24 Bulan)",
};

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [selectedReportGroup, setSelectedReportGroup] = useState(null);
  const [complianceFilter, setComplianceFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const response = await api.get("/admin/audit-logs", {
        params: { limit: 300 },
      });
      setLogs(response.data || []);
    } catch {
      setErrorMsg("Gagal memuat log audit sistem.");
    } finally {
      setLoading(false);
    }
  };

  const handleExportCsv = async () => {
    setExportingCsv(true);
    try {
      const res = await api.get("/admin/audit-logs/export-csv", {
        responseType: "blob",
      });
      const blob = new Blob([res.data], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "Log_Audit_Sistem_MultiAgent_KIA.csv");
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch {
      setErrorMsg("Gagal mengekspor berkas CSV log audit.");
    } finally {
      setExportingCsv(false);
    }
  };

  const getLogDurationMs = (log) => {
    if (!log) return 0;
    if (log.lifetime_ms != null) return Number(log.lifetime_ms) || 0;
    if (log.duration_ms != null) return Number(log.duration_ms) || 0;
    return 0;
  };

  const getLogTokens = (log) => {
    if (!log) return { input: 0, output: 0, total: 0 };
    const tu = log.token_usage || {};
    const input = Number(tu.input_tokens ?? log.input_tokens ?? 0) || 0;
    const output = Number(tu.output_tokens ?? log.output_tokens ?? 0) || 0;
    const total = Number(tu.total_tokens ?? log.total_tokens ?? input + output) || 0;
    return { input, output, total };
  };

  const identifyAgentSlot = (log) => {
    if (!log) return "other";
    const order = Number(log.execution_order);
    if (order === 1) return "agent1";
    if (order === 2) return "agent2";
    if (order === 3) return "agent3";

    const nameUpper = (log.agent_name || "").toUpperCase();
    if (
      nameUpper.includes("AGENT 1") ||
      nameUpper.includes("AGENT_1") ||
      nameUpper.includes("DETEKSI") ||
      nameUpper.includes("RISK")
    ) {
      return "agent1";
    }
    if (
      nameUpper.includes("AGENT 2") ||
      nameUpper.includes("AGENT_2") ||
      nameUpper.includes("REKOMENDASI") ||
      nameUpper.includes("RECOMMENDER")
    ) {
      return "agent2";
    }
    if (
      nameUpper.includes("AGENT 3") ||
      nameUpper.includes("AGENT_3") ||
      nameUpper.includes("VERIFIKASI") ||
      nameUpper.includes("VERIFIER") ||
      nameUpper.includes("GROUND")
    ) {
      return "agent3";
    }
    return "other";
  };

  const parseRawOutputFallback = (log) => {
    if (!log || !log.agent_output) return null;
    try {
      return JSON.parse(log.agent_output);
    } catch {
      return null;
    }
  };

  const groupedReports = useMemo(() => {
    const map = new Map();

    logs.forEach((log) => {
      const repId = log.report_id || `log-${log.id}`;
      if (!map.has(repId)) {
        map.set(repId, {
          report_id: log.report_id,
          patient_name: log.patient_name || "Pasien KIA",
          patient_nik: log.patient_nik || "-",
          village_name: log.village_name || "Airmadidi",
          phase: log.phase || "-",
          overall_status: log.overall_status || "KONDISI_BAIK",
          created_at: log.created_at,
          agent1: null,
          agent2: null,
          agent3: null,
          all_logs: [],
        });
      }

      const group = map.get(repId);
      group.all_logs.push(log);

      if (log.patient_name && group.patient_name === "Pasien KIA") {
        group.patient_name = log.patient_name;
      }
      if (log.patient_nik && group.patient_nik === "-") {
        group.patient_nik = log.patient_nik;
      }
      if (log.village_name && group.village_name === "Airmadidi") {
        group.village_name = log.village_name;
      }
      if (log.phase && group.phase === "-") {
        group.phase = log.phase;
      }
      if (log.overall_status) {
        group.overall_status = log.overall_status;
      }

      const slot = identifyAgentSlot(log);
      if (slot === "agent1") group.agent1 = log;
      else if (slot === "agent2") group.agent2 = log;
      else if (slot === "agent3") group.agent3 = log;
    });

    const list = Array.from(map.values()).map((grp) => {
      const sortedLogs = [...grp.all_logs].sort((a, b) => a.id - b.id);
      if (!grp.agent1 && sortedLogs[0]) grp.agent1 = sortedLogs[0];
      if (!grp.agent2 && sortedLogs[1]) grp.agent2 = sortedLogs[1];
      if (!grp.agent3 && sortedLogs[2]) grp.agent3 = sortedLogs[2];

      const totalDurationMs = Math.round(
        grp.all_logs.reduce((sum, l) => sum + getLogDurationMs(l), 0)
      );
      const tokenTotals = grp.all_logs.reduce(
        (acc, l) => {
          const t = getLogTokens(l);
          return {
            input: acc.input + t.input,
            output: acc.output + t.output,
            total: acc.total + t.total,
          };
        },
        { input: 0, output: 0, total: 0 }
      );
      const hasDeviation = grp.all_logs.some((l) => l.is_compliant === false);
      const hasUnevaluated = grp.all_logs.some((l) => l.is_compliant === null || l.is_compliant === undefined);

      return {
        ...grp,
        totalDurationMs,
        totalTokens: tokenTotals.total,
        totalInputTokens: tokenTotals.input,
        totalOutputTokens: tokenTotals.output,
        isCompliant: !hasDeviation && !hasUnevaluated,
        hasDeviation,
        hasUnevaluated,
      };
    });

    return list.sort((a, b) => Number(b.report_id || 0) - Number(a.report_id || 0));
  }, [logs]);

  const filteredGroups = useMemo(() => {
    return groupedReports.filter((grp) => {
      if (complianceFilter === "COMPLIANT" && !grp.isCompliant) return false;
      if (complianceFilter === "DEVIATION" && grp.isCompliant) return false;

      const q = searchQuery.trim().toLowerCase();
      if (q) {
        const matchId = String(grp.report_id || "").includes(q);
        const matchName = (grp.patient_name || "").toLowerCase().includes(q);
        const matchNik = (grp.patient_nik || "").toLowerCase().includes(q);
        const matchVillage = (grp.village_name || "").toLowerCase().includes(q);
        if (!matchId && !matchName && !matchNik && !matchVillage) return false;
      }
      return true;
    });
  }, [groupedReports, complianceFilter, searchQuery]);

  const cleanAuditNote = (note) =>
    (note || "Fungsi dieksekusi sesuai SOP.")
      .replace(/\[PARALLEL EVALUATOR[^\]]*\]/gi, "")
      .replace(/\[AUDIT PARALEL[^\]]*\]/gi, "")
      .replace(/Evaluator AI/gi, "Sistem Audit")
      .trim();

  const renderAgent1Section = (log) => {
    if (!log) return null;
    const detail = log.agent_work_detail || {};
    const rawFallback = parseRawOutputFallback(log) || {};
    const flags =
      detail.active_risk_flags ||
      rawFallback.risk_flags ||
      [];
    const narrative =
      detail.risk_narrative ||
      rawFallback.narrative ||
      "-";
    const tools =
      Array.isArray(log.tools_invoked) && log.tools_invoked.length > 0
        ? log.tools_invoked
        : ["validate_input_plausibility", "calculate_1000_hpk_status", "kalkulator_klinis_deterministik"];
    const who = detail.who_zscore || {};
    const dur = Math.round(getLogDurationMs(log));
    const tok = getLogTokens(log);

    return (
      <div className="bg-card border border-line rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-line">
          <div>
            <h4 className="text-base font-bold text-heading">
              1. Agent 1 — Analisis Risiko & Kalkulator Klinis
            </h4>
            <p className="text-xs text-caption mt-0.5">
              Pemeriksaan kewajaran input, status 1.000 HPK, dan perhitungan parameter antropometri/klinis
            </p>
          </div>
          <div className="text-xs text-caption sm:text-right">
            <span
              className={`font-semibold ${
                log.is_compliant === false
                  ? "text-rose-600 dark:text-rose-400"
                  : log.is_compliant === true
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-amber-600 dark:text-amber-400"
              }`}
            >
              {log.is_compliant === false
                ? "Deviasi SOP"
                : log.is_compliant === true
                ? "Memenuhi SOP"
                : "Tidak dievaluasi"}
            </span>
            <span> &bull; {dur} ms &bull; {tok.total} token</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div>
            <p className="text-caption font-medium">Validasi Input</p>
            <p className="text-heading font-semibold mt-0.5">
              {detail.plausibility?.is_plausible !== false
                ? "Lolos Pemeriksaan (Data Valid)"
                : "Ditemukan Anomali Input"}
            </p>
          </div>
          <div>
            <p className="text-caption font-medium">Fungsi yang Dijalankan</p>
            <p className="text-heading font-semibold mt-0.5">
              {tools.join(", ")}
            </p>
          </div>
          <div>
            <p className="text-caption font-medium">Temuan Risiko Klinis</p>
            <p className="text-heading font-semibold mt-0.5">
              {flags.length > 0 ? flags.join(", ") : "Tidak ada tanda bahaya (Kondisi Baik)"}
            </p>
          </div>
        </div>

        {(who.length_for_age || who.weight_for_age || who.weight_for_length || detail.kspr || detail.maternal_nutrition) && (
          <div className="pt-2 border-t border-line-light text-xs space-y-1">
            <p className="text-caption font-medium">Rincian Perhitungan Kalkulator:</p>
            <div className="text-body space-y-0.5">
              {who.length_for_age && (
                <p>
                  PB/U (TB/U): Z-Score {who.length_for_age.zscore ?? "-"} ({who.length_for_age.category || "-"})
                </p>
              )}
              {who.weight_for_age && (
                <p>
                  BB/U: Z-Score {who.weight_for_age.zscore ?? "-"} ({who.weight_for_age.category || "-"})
                </p>
              )}
              {who.weight_for_length && (
                <p>
                  BB/PB: Z-Score {who.weight_for_length.zscore ?? "-"} ({who.weight_for_length.category || "-"})
                </p>
              )}
              {detail.kspr && (
                <p>
                  Skor KSPR: {detail.kspr.total_score ?? "-"} ({detail.kspr.risk_category || "-"})
                </p>
              )}
              {detail.maternal_nutrition && (
                <p>
                  Gizi Ibu: LiLA ({detail.maternal_nutrition.lila_status || "-"}), Hb ({detail.maternal_nutrition.hb_status || "-"})
                </p>
              )}
            </div>
          </div>
        )}

        <div className="pt-2 border-t border-line-light text-xs space-y-1">
          <p className="text-caption font-medium">Ringkasan Analisis Agent 1:</p>
          <p className="text-body leading-relaxed">{narrative}</p>
        </div>

        <div className="pt-2 border-t border-line-light text-xs space-y-1">
          <p className="text-caption font-medium">Catatan Audit SOP:</p>
          <p className="text-body leading-relaxed">{cleanAuditNote(log.evaluation_notes)}</p>
        </div>
      </div>
    );
  };

  const renderAgent2Section = (log) => {
    if (!log) return null;
    const detail = log.agent_work_detail || {};
    const rawFallback = parseRawOutputFallback(log);
    const recsTrace =
      Array.isArray(detail.recommendations_trace) && detail.recommendations_trace.length > 0
        ? detail.recommendations_trace
        : Array.isArray(rawFallback)
        ? rawFallback
        : [];
    const dur = Math.round(getLogDurationMs(log));
    const tok = getLogTokens(log);

    return (
      <div className="bg-card border border-line rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-line">
          <div>
            <h4 className="text-base font-bold text-heading">
              2. Agent 2 — Rekomendasi Gizi & Rujukan Pedoman (RAG)
            </h4>
            <p className="text-xs text-caption mt-0.5">
              Pencarian dokumen pedoman (Buku KIA 2024 & PNPK Stunting) dan penyusunan rekomendasi intervensi
            </p>
          </div>
          <div className="text-xs text-caption sm:text-right">
            <span
              className={`font-semibold ${
                log.is_compliant === false
                  ? "text-rose-600 dark:text-rose-400"
                  : log.is_compliant === true
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-amber-600 dark:text-amber-400"
              }`}
            >
              {log.is_compliant === false
                ? "Deviasi SOP"
                : log.is_compliant === true
                ? "Memenuhi SOP"
                : "Tidak dievaluasi"}
            </span>
            <span> &bull; {dur} ms &bull; {tok.total} token</span>
          </div>
        </div>

        {recsTrace.length === 0 ? (
          <p className="text-xs text-body">
            Pasien dalam kondisi baik tanpa flag risiko tinggi (jalur cepat tanpa pencarian RAG tambahan).
          </p>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-caption font-medium">
              Daftar Rekomendasi & Bukti Rujukan ({recsTrace.length} butir):
            </p>
            <div className="divide-y divide-line border border-line rounded-lg overflow-hidden">
              {recsTrace.map((rec, i) => {
                const cit = rec.citation || {};
                const src = rec.source || cit.source || "Pedoman Standar KIA";
                const pages =
                  Array.isArray(rec.additional_pages) && rec.additional_pages.length > 0
                    ? rec.additional_pages.join(", ")
                    : Array.isArray(cit.additional_pages) && cit.additional_pages.length > 0
                    ? cit.additional_pages.join(", ")
                    : rec.page || cit.page || "-";
                const sections =
                  Array.isArray(rec.additional_sections) && rec.additional_sections.length > 0
                    ? rec.additional_sections.join("; ")
                    : Array.isArray(cit.additional_sections) && cit.additional_sections.length > 0
                    ? cit.additional_sections.join("; ")
                    : rec.section || cit.section || "-";
                const chunkIds =
                  Array.isArray(rec.supporting_chunk_ids) && rec.supporting_chunk_ids.length > 0
                    ? rec.supporting_chunk_ids.join(", ")
                    : Array.isArray(cit.supporting_chunk_ids) && cit.supporting_chunk_ids.length > 0
                    ? cit.supporting_chunk_ids.join(", ")
                    : rec.chunk_id || cit.chunk_id || "-";
                const evStatus = rec.evidence_status || (chunkIds !== "-" ? "CHUNK_DOKUMEN" : rec.reasoning_mode === "ATURAN_SISTEM" ? "ATURAN_SISTEM" : "TANPA_KUTIPAN");
                const evLabel =
                  evStatus === "ATURAN_SISTEM"
                    ? "Aturan sistem (ATURAN_SISTEM)"
                    : evStatus === "CHUNK_DOKUMEN" || evStatus === "RINGKASAN_TERKURASI"
                    ? `Butir dari rujukan (${evStatus})`
                    : `Tanpa kutipan (${evStatus})`;
                const aiDet = rec.ai_insight_details;

                return (
                  <div key={i} className="p-3.5 bg-subtle/40 space-y-2 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-heading">
                        {i + 1}. {rec.title || "Rekomendasi Tindak Lanjut"}
                      </p>
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                          evStatus === "ATURAN_SISTEM"
                            ? "bg-card text-caption border-line"
                            : chunkIds !== "-"
                            ? "bg-sky-50 dark:bg-sky-950/30 text-sky-800 dark:text-sky-300 border-sky-200 dark:border-sky-800"
                            : "bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                        }`}
                      >
                        {evLabel}
                      </span>
                    </div>
                    <p className="text-caption">
                      Sumber: <strong className="text-body">{String(src).replace(/\.(pdf|md)$/i, "")}</strong>
                      {" • "}Halaman: <strong className="text-body">{pages}</strong>
                      {" • "}Bagian: <strong className="text-body">{sections}</strong>
                      {chunkIds !== "-" && (
                        <>
                          {" • "}ID Chunk: <strong className="text-body font-mono">{chunkIds}</strong>
                        </>
                      )}
                    </p>
                    {rec.evidence_quote && (
                      <p className="text-body italic pt-0.5">
                        Kutipan rujukan: &ldquo;{rec.evidence_quote}&rdquo;
                      </p>
                    )}
                    {(aiDet || rec.ai_insight) && (
                      <div className="p-2.5 rounded-md bg-card border border-line space-y-1">
                        <p className="font-semibold text-amber-800 dark:text-amber-300">
                          Tambahan Analisis AI{aiDet?.chunk_id ? ` • Chunk ${aiDet.chunk_id}` : ""}
                        </p>
                        {aiDet?.source && (
                          <p className="text-caption">
                            Basis Pedoman AI: <strong className="text-body">{String(aiDet.source).replace(/\.(pdf|md)$/i, "")}</strong>
                            {aiDet.section ? ` • Bagian ${aiDet.section}` : ""}
                            {aiDet.page ? ` • Hal. ${aiDet.page}` : ""}
                          </p>
                        )}
                        <p className="text-body">
                          {aiDet?.condition_explanation || rec.ai_insight}
                        </p>
                        {aiDet?.supporting_sentence && (
                          <p className="text-caption italic">
                            Kutipan dasar AI: &ldquo;{aiDet.supporting_sentence}&rdquo;
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="pt-2 border-t border-line-light text-xs space-y-1">
          <p className="text-caption font-medium">Catatan Audit SOP:</p>
          <p className="text-body leading-relaxed">{cleanAuditNote(log.evaluation_notes)}</p>
        </div>
      </div>
    );
  };

  const renderAgent3Section = (log) => {
    if (!log) return null;
    const detail = log.agent_work_detail || {};
    const rawFallback = parseRawOutputFallback(log) || {};
    const verifs =
      Array.isArray(detail.verification_details) && detail.verification_details.length > 0
        ? detail.verification_details
        : Array.isArray(rawFallback.verification)
        ? rawFallback.verification
        : [];
    const groundingPct = detail.grounding_rate_percent ?? 100;
    const dur = Math.round(getLogDurationMs(log));
    const tok = getLogTokens(log);

    return (
      <div className="bg-card border border-line rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-line">
          <div>
            <h4 className="text-base font-bold text-heading">
              3. Agent 3 — Verifikasi Keterlacakan Rujukan (Grounding)
            </h4>
            <p className="text-xs text-caption mt-0.5">
              Pemeriksaan kesesuaian setiap rekomendasi terhadap isi chunk dokumen sumber dan penyusunan laporan akhir
            </p>
          </div>
          <div className="text-xs text-caption sm:text-right">
            <span
              className={`font-semibold ${
                log.is_compliant === false
                  ? "text-rose-600 dark:text-rose-400"
                  : log.is_compliant === true
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-amber-600 dark:text-amber-400"
              }`}
            >
              {log.is_compliant === false
                ? "Deviasi SOP"
                : log.is_compliant === true
                ? "Memenuhi SOP"
                : "Tidak dievaluasi"}
            </span>
            <span> &bull; Skor Grounding: {groundingPct}% &bull; {dur} ms &bull; {tok.total} token</span>
          </div>
        </div>

        {verifs.length === 0 ? (
          <p className="text-xs text-body">
            Integrasi langsung laporan akhir (kondisi baik tanpa temuan risiko klinis).
          </p>
        ) : (
          <div className="divide-y divide-line border border-line rounded-lg overflow-hidden text-xs">
            {verifs.map((v, i) => {
              const cit = v.citation_checked || {};
              const title = v.recommendation_title || v.title || `Rekomendasi #${i + 1}`;
              const isVerified =
                typeof v.is_verified === "boolean"
                  ? v.is_verified
                  : v.verification_status === "VERIFIED" ||
                    v.verification_status === "AUTO_GROUNDED_SECONDARY";
              const scorePct = Math.round((Number(v.grounding_score) || (isVerified ? 1 : 0)) * 100);
              const src = v.source || cit.source || "-";
              const page =
                Array.isArray(v.additional_pages) && v.additional_pages.length > 0
                  ? v.additional_pages.join(", ")
                  : v.page || cit.page || "-";
              const note = v.verification_note || v.reasoning;

              return (
                <div key={i} className="p-3.5 bg-subtle/40 space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-heading">
                      {i + 1}. {title}
                    </span>
                    <span
                      className={`font-semibold ${
                        isVerified
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-amber-600 dark:text-amber-400"
                      }`}
                    >
                      {isVerified ? "Terverifikasi" : "Perlu Tinjauan"} ({scorePct}%)
                    </span>
                  </div>
                  <p className="text-caption">
                    Rujukan: {String(src).replace(/\.md$/i, "")} (Halaman {page})
                  </p>
                  {note && <p className="text-body">{note}</p>}
                </div>
              );
            })}
          </div>
        )}

        <div className="pt-2 border-t border-line-light text-xs space-y-1">
          <p className="text-caption font-medium">Catatan Audit SOP:</p>
          <p className="text-body leading-relaxed">{cleanAuditNote(log.evaluation_notes)}</p>
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-line-light">
        <div>
          <h1 className="text-2xl font-bold text-heading">
            Log Audit Sistem
          </h1>
          <p className="text-sm text-caption mt-1">
            Catatan pemeriksaan kerja Agent 1, Agent 2, dan Agent 3 untuk setiap laporan kunjungan pasien.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={exportingCsv || logs.length === 0}
            className="btn-interactive flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
          >
            <FileDown className="w-4 h-4" />
            <span>{exportingCsv ? "Mengekspor..." : "Ekspor CSV"}</span>
          </button>

          <button
            type="button"
            onClick={fetchLogs}
            disabled={loading}
            className="btn-interactive flex items-center gap-2 px-3.5 py-2 bg-card hover:bg-muted text-heading border border-line rounded-lg text-xs font-semibold transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            <span>Muat Ulang</span>
          </button>
        </div>
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
            placeholder="Cari nomor laporan, nama pasien, NIK, atau desa..."
            aria-label="Cari log audit"
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
          value={complianceFilter}
          onChange={(e) => setComplianceFilter(e.target.value)}
          aria-label="Filter status SOP"
          className="h-10 px-3.5 bg-card border border-line rounded-lg text-xs sm:text-sm font-medium text-heading focus:outline-none focus:ring-2 focus:ring-sky-500/40 cursor-pointer"
        >
          <option value="ALL">Semua Status ({groupedReports.length})</option>
          <option value="COMPLIANT">
            Memenuhi SOP ({groupedReports.filter((g) => g.isCompliant).length})
          </option>
          <option value="DEVIATION">
            Deviasi SOP ({groupedReports.filter((g) => !g.isCompliant).length})
          </option>
        </select>
      </div>

      {/* Tabel Utama yang Bersih & Sederhana */}
      <div className="bg-card rounded-xl border border-line overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-muted border-b border-line text-xs font-semibold text-caption">
                <th className="py-3.5 px-5">No. Laporan</th>
                <th className="py-3.5 px-5">Pasien & Wilayah</th>
                <th className="py-3.5 px-5">Ringkasan Kerja Agent</th>
                <th className="py-3.5 px-5">Durasi & Token</th>
                <th className="py-3.5 px-5">Status SOP</th>
                <th className="py-3.5 px-5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-light">
              {loading ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-sm text-caption">
                    Memuat data log audit...
                  </td>
                </tr>
              ) : filteredGroups.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-sm text-caption">
                    Tidak ada data log audit yang cocok.
                  </td>
                </tr>
              ) : (
                filteredGroups.map((grp) => {
                  const a1Detail = grp.agent1?.agent_work_detail || {};
                  const a2Detail = grp.agent2?.agent_work_detail || {};
                  const a3Detail = grp.agent3?.agent_work_detail || {};
                  const flags = Array.isArray(a1Detail.active_risk_flags)
                    ? a1Detail.active_risk_flags
                    : [];
                  const recs = Array.isArray(a2Detail.recommendations_trace)
                    ? a2Detail.recommendations_trace
                    : [];
                  const groundingPct = a3Detail.grounding_rate_percent ?? 100;

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
                          {grp.created_at
                            ? new Date(grp.created_at).toLocaleDateString("id-ID", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })
                            : "-"}
                        </span>
                      </td>

                      <td className="py-4 px-5">
                        <p className="font-semibold text-heading">{grp.patient_name}</p>
                        <p className="text-xs text-caption mt-0.5">
                          Desa {grp.village_name} &bull; {PHASE_LABELS[grp.phase] || grp.phase}
                        </p>
                      </td>

                      <td className="py-4 px-5 text-xs text-body">
                        <p>
                          Agent 1: {flags.length > 0 ? `${flags.length} temuan risiko` : "Kondisi baik"}
                          {" • "}Agent 2: {recs.length} rekomendasi
                          {" • "}Agent 3: Grounding {groundingPct}%
                        </p>
                      </td>

                      <td className="py-4 px-5 whitespace-nowrap text-xs text-body">
                        {grp.totalDurationMs.toLocaleString("id-ID")} ms &bull;{" "}
                        {grp.totalTokens.toLocaleString("id-ID")} token
                      </td>

                      <td className="py-4 px-5 whitespace-nowrap text-xs font-semibold">
                        {grp.hasDeviation ? (
                          <span className="text-rose-600 dark:text-rose-400">
                            Deviasi SOP
                          </span>
                        ) : grp.hasUnevaluated ? (
                          <span className="text-amber-600 dark:text-amber-400">
                            Tidak dievaluasi
                          </span>
                        ) : (
                          <span className="text-emerald-600 dark:text-emerald-400">
                            Memenuhi SOP
                          </span>
                        )}
                      </td>

                      <td className="py-4 px-5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setSelectedReportGroup(grp)}
                          className="!min-h-0 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-subtle hover:bg-muted text-heading border border-line transition-colors cursor-pointer"
                        >
                          Detail Audit
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

      {/* Pop-up Modal Detail Audit per Agent */}
      {selectedReportGroup && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 sm:p-6 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedReportGroup(null);
          }}
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-card border border-line rounded-xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-xl overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-subtle border-b border-line flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-heading">
                  Detail Audit Laporan #{selectedReportGroup.report_id} — {selectedReportGroup.patient_name}
                </h3>
                <p className="text-xs text-caption mt-1">
                  NIK: {selectedReportGroup.patient_nik} &bull; Desa {selectedReportGroup.village_name} &bull;{" "}
                  {PHASE_LABELS[selectedReportGroup.phase] || selectedReportGroup.phase} &bull; Total Waktu:{" "}
                  {selectedReportGroup.totalDurationMs.toLocaleString("id-ID")} ms ({selectedReportGroup.totalTokens.toLocaleString("id-ID")} token)
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedReportGroup(null)}
                aria-label="Tutup detail audit"
                className="!min-h-0 p-1.5 rounded-lg text-dim hover:text-heading hover:bg-muted cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: Detail Agent 1, Agent 2, Agent 3 */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1 bg-page">
              {renderAgent1Section(selectedReportGroup.agent1)}
              {renderAgent2Section(selectedReportGroup.agent2)}
              {renderAgent3Section(selectedReportGroup.agent3)}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 bg-subtle border-t border-line flex items-center justify-between">
              <Link
                to={`/kader/validasi-laporan/${selectedReportGroup.report_id}`}
                className="text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline"
              >
                Buka Lembar Laporan #{selectedReportGroup.report_id}
              </Link>
              <button
                type="button"
                onClick={() => setSelectedReportGroup(null)}
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
}
