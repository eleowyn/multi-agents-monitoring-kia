import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api, { getErrorMessage } from "../../services/api";
import {
  CheckCircle,
  XCircle,
  RefreshCw,
  AlertTriangle,
  Trash2,
  Cpu,
  ChevronRight,
  X,
  ExternalLink,
} from "lucide-react";

const AuditLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState([]);
  const [deletingBulk, setDeletingBulk] = useState(false);
  const [clearingAll, setClearingAll] = useState(false);
  const [selectedLogModal, setSelectedLogModal] = useState(null);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await api.get("/admin/audit-logs");
      setLogs(res.data || []);
      setSelectedIds([]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAll = () => {
    if (selectedIds.length === logs.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(logs.map((l) => l.id));
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
        `Apakah Anda yakin ingin menghapus ${selectedIds.length} catatan log audit terpilih? Tindakan ini tidak dapat dibatalkan.`
      )
    ) {
      return;
    }
    try {
      setDeletingBulk(true);
      const res = await api.post("/admin/audit-logs/bulk-delete", {
        ids: selectedIds,
      });
      alert(res.data.message || `${selectedIds.length} log audit berhasil dihapus.`);
      fetchLogs();
    } catch (err) {
      alert(getErrorMessage(err, "Gagal menghapus log audit terpilih."));
    } finally {
      setDeletingBulk(false);
    }
  };

  const handleClearAll = async () => {
    if (logs.length === 0) return;
    if (
      !window.confirm(
        "PERINGATAN: Apakah Anda yakin ingin membersihkan SELURUH riwayat log audit evaluator AI? Tindakan ini permanen."
      )
    ) {
      return;
    }
    try {
      setClearingAll(true);
      const res = await api.delete("/admin/audit-logs/clear-all");
      alert(res.data.message || "Seluruh log audit berhasil dibersihkan.");
      fetchLogs();
    } catch (err) {
      alert(getErrorMessage(err, "Gagal membersihkan seluruh log audit."));
    } finally {
      setClearingAll(false);
    }
  };

  // Hitung rekapitulasi token dan durasi dari daftar log
  const totalTokensAll = logs.reduce(
    (acc, l) => acc + Number(l.token_usage?.total_tokens || 0),
    0
  );
  const totalInputTokensAll = logs.reduce(
    (acc, l) => acc + Number(l.token_usage?.input_tokens || 0),
    0
  );
  const totalOutputTokensAll = logs.reduce(
    (acc, l) => acc + Number(l.token_usage?.output_tokens || 0),
    0
  );
  const avgLifetimeMs =
    logs.length > 0
      ? Math.round(
          logs.reduce((acc, l) => acc + Number(l.lifetime_ms || 0), 0) / logs.length
        )
      : 0;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1440px] mx-auto space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-line">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-heading tracking-tight">
            Audit Log
          </h1>
        </div>
        <div className="flex items-center gap-2.5">
          {logs.length > 0 && (
            <button
              onClick={handleClearAll}
              disabled={clearingAll}
              className="btn-interactive flex items-center gap-1.5 px-3 py-1.5 bg-card border border-line text-caption hover:text-rose-500 hover:bg-subtle rounded-xl text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-500" />
              <span>{clearingAll ? "Membersihkan..." : "Bersihkan Seluruh Log"}</span>
            </button>
          )}
          <button
            onClick={fetchLogs}
            className="btn-interactive flex items-center gap-1.5 px-3 py-1.5 bg-card border border-line hover:bg-subtle text-caption hover:text-heading rounded-xl text-xs font-medium transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 text-sky-500" />
            <span>Segarkan</span>
          </button>
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-subtle border border-line rounded-xl animate-fade-in text-xs">
          <div className="flex items-center gap-2 text-heading font-medium">
            <span className="px-2 py-0.5 bg-card border border-line rounded font-mono font-bold">
              {selectedIds.length}
            </span>
            <span>log audit dipilih</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="px-3 py-1 text-caption hover:text-heading transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleBulkDelete}
              disabled={deletingBulk}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{deletingBulk ? "Menghapus..." : `Hapus ${selectedIds.length} Log`}</span>
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-card rounded-2xl border border-line shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-subtle text-caption text-xs font-medium uppercase tracking-wider border-b border-line">
              <tr>
                <th className="p-3.5 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={logs.length > 0 && selectedIds.length === logs.length}
                    onChange={handleToggleAll}
                    className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-line cursor-pointer"
                    aria-label="Pilih semua log"
                  />
                </th>
                <th className="p-3.5 font-medium">Log</th>
                <th className="p-3.5 font-medium">Agent</th>
                <th className="p-3.5 font-medium">Durasi</th>
                <th className="p-3.5 font-medium">Token</th>
                <th className="p-3.5 font-medium">Status</th>
                <th className="p-3.5 text-right font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-light">
              {loading ? (
                <tr>
                  <td colSpan="7" className="p-8 text-center text-dim text-sm">
                    Memuat catatan log audit...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan="7" className="p-8 text-center text-dim italic text-sm">
                    Belum ada log audit tersimpan.
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const tok = log.token_usage || {};
                  return (
                    <tr
                      key={log.id}
                      onClick={() => setSelectedLogModal(log)}
                      className={`cursor-pointer hover:bg-subtle/60 transition-colors ${
                        selectedIds.includes(log.id) ? "bg-subtle" : ""
                      }`}
                    >
                      <td className="p-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(log.id)}
                          onChange={() => handleToggleRow(log.id)}
                          className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-line cursor-pointer"
                          aria-label={`Pilih log audit #${log.id}`}
                        />
                      </td>

                      <td className="p-3.5">
                        <p className="font-semibold text-heading font-mono text-xs">#{log.id}</p>
                        {log.report_id && (
                          <Link
                            to={`/kader/validasi/${log.report_id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-xs text-caption hover:text-sky-600 dark:hover:text-sky-400 mt-0.5"
                          >
                            <span>Laporan #{log.report_id}</span>
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        )}
                      </td>

                      <td className="p-3.5">
                        <p className="font-semibold text-heading text-xs sm:text-sm">{log.agent_name}</p>
                        <p className="text-xs text-caption mt-0.5">
                          Step #{log.execution_order || 1} &bull; {log.parallel_worker || "ParallelEval"}
                        </p>
                      </td>

                      <td className="p-3.5 font-mono text-xs">
                        <p className="text-heading font-medium">
                          {log.lifetime_ms ?? 0} ms
                        </p>
                        <p className="text-caption text-xs truncate max-w-[180px]" title={`${log.spawned_at} -> ${log.terminated_at}`}>
                          {log.spawned_at ? log.spawned_at.slice(11, 19) : "-"}
                        </p>
                      </td>

                      <td className="p-3.5 font-mono text-xs">
                        <p className="text-heading font-medium">
                          {(tok.total_tokens ?? 0).toLocaleString("id-ID")}
                        </p>
                        <p className="text-caption text-xs">
                          In: {tok.input_tokens ?? 0} &bull; Out: {tok.output_tokens ?? 0}
                        </p>
                      </td>

                      <td className="p-3.5">
                        {log.is_compliant === true ? (
                          <span className="inline-flex items-center gap-1.5 text-xs text-body">
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                            <span>Patuh</span>
                          </span>
                        ) : log.is_compliant === false ? (
                          <span className="inline-flex items-center gap-1.5 text-xs text-body">
                            <XCircle className="w-3.5 h-3.5 text-rose-500" />
                            <span>Deviasi</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs text-body">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                            <span>Menunggu</span>
                          </span>
                        )}
                      </td>

                      <td className="p-3.5 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLogModal(log);
                          }}
                          className="inline-flex items-center gap-1 text-xs text-caption hover:text-heading cursor-pointer transition-colors"
                        >
                          <span>Detail</span>
                          <ChevronRight className="w-3.5 h-3.5" />
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

      {/* ─── Total Konsumsi Token (Paling Bawah) ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-card rounded-2xl border border-line text-xs">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-caption" />
          <span className="text-caption font-medium">Total Konsumsi Token:</span>
          <span className="font-mono font-bold text-heading text-sm">
            {totalTokensAll.toLocaleString("id-ID")}
          </span>
          <span className="text-caption">token</span>
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:gap-5 text-caption font-mono text-xs">
          <span>Input: <strong className="text-heading font-medium">{totalInputTokensAll.toLocaleString("id-ID")}</strong></span>
          <span className="text-line hidden sm:inline">&bull;</span>
          <span>Output: <strong className="text-heading font-medium">{totalOutputTokensAll.toLocaleString("id-ID")}</strong></span>
          <span className="text-line hidden sm:inline">&bull;</span>
          <span>Rata-rata Durasi: <strong className="text-heading font-medium">{avgLifetimeMs} ms</strong></span>
        </div>
      </div>

      {/* ═══ Clean Minimalist Detail Modal Pop-up ═══ */}
      {selectedLogModal && (
        <div
          className="fixed inset-0 bg-overlay backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 z-50 animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedLogModal(null);
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="audit-log-modal-title"
        >
          <div className="bg-card rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col border border-line shadow-prominent overflow-hidden animate-scale-in">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-line flex items-start justify-between gap-4">
              <div className="space-y-1">
                <span className="inline-block px-2.5 py-0.5 rounded-md text-xs font-medium bg-subtle text-caption border border-line">
                  Log Audit #{selectedLogModal.id} &bull; Step #{selectedLogModal.execution_order || 1} &bull;{" "}
                  {selectedLogModal.parallel_worker || "ParallelEval"}
                </span>
                <h3 id="audit-log-modal-title" className="text-lg sm:text-xl font-bold text-heading">
                  {selectedLogModal.agent_name}
                </h3>
              </div>
              <button
                onClick={() => setSelectedLogModal(null)}
                aria-label="Tutup modal log"
                className="p-2 text-dim hover:text-heading hover:bg-subtle rounded-xl transition-colors cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-4">
              {/* Klasifikasi Kompleksitas & Kepentingan */}
              <div className="p-4 bg-subtle rounded-xl border border-line space-y-1.5">
                <p className="text-xs font-bold uppercase tracking-wider text-caption">
                  Peran & Tingkat Kesulitan/Kepentingan
                </p>
                <p className="text-sm font-bold text-heading">{selectedLogModal.complexity_rank}</p>
                <p className="text-sm text-body leading-relaxed">{selectedLogModal.complexity_reason}</p>
              </div>

              {/* Lifetime & Token */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="p-4 bg-subtle rounded-xl border border-line space-y-1.5 text-xs">
                  <p className="font-bold uppercase tracking-wider text-caption">
                    Durasi & Waktu Eksekusi
                  </p>
                  <p className="font-mono text-heading">
                    Spawn: <strong>{selectedLogModal.spawned_at || "-"}</strong>
                  </p>
                  <p className="font-mono text-heading">
                    Terminated: <strong>{selectedLogModal.terminated_at || "-"}</strong>
                  </p>
                  <p className="text-body">
                    Durasi: <strong className="text-heading">{selectedLogModal.lifetime_ms ?? 0} ms</strong> (Ephemeral)
                  </p>
                </div>

                <div className="p-4 bg-subtle rounded-xl border border-line space-y-1.5 text-xs">
                  <p className="font-bold uppercase tracking-wider text-caption">
                    Konsumsi Token
                  </p>
                  <p className="font-mono text-heading">
                    Input Prompt: <strong>{selectedLogModal.token_usage?.input_tokens ?? 0} token</strong>
                  </p>
                  <p className="font-mono text-heading">
                    Output: <strong>{selectedLogModal.token_usage?.output_tokens ?? 0} token</strong>
                  </p>
                  <p className="font-mono text-heading">
                    Total: <strong>{selectedLogModal.token_usage?.total_tokens ?? 0} token</strong>
                  </p>
                </div>
              </div>

              {/* Tools Invoked */}
              {Array.isArray(selectedLogModal.tools_invoked) && selectedLogModal.tools_invoked.length > 0 && (
                <div className="p-4 bg-subtle rounded-xl border border-line space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-caption">
                    Tools yang Digunakan
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedLogModal.tools_invoked.map((tl, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 rounded-md text-xs font-mono bg-card text-heading border border-line"
                      >
                        {tl}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Instruksi Tugas Awal */}
              <div className="p-4 bg-subtle rounded-xl border border-line space-y-1.5">
                <p className="text-xs font-bold uppercase tracking-wider text-caption">
                  Instruksi Input Context
                </p>
                <p className="text-sm text-body leading-relaxed">{selectedLogModal.input_instruction}</p>
              </div>

              {/* Output yang Dihasilkan Agent */}
              <div className="p-4 bg-subtle rounded-xl border border-line space-y-1.5">
                <p className="text-xs font-bold uppercase tracking-wider text-caption">
                  Output Hasil Agent
                </p>
                <pre className="p-3 bg-card rounded-lg border border-line text-xs font-mono text-body overflow-x-auto whitespace-pre-wrap max-h-48">
                  {selectedLogModal.agent_output}
                </pre>
              </div>

              {/* Catatan Evaluator Paralel */}
              <div className="p-4 bg-subtle rounded-xl border border-line space-y-1.5">
                <p className="text-xs font-bold uppercase tracking-wider text-caption">
                  Catatan Evaluator Paralel
                </p>
                <p className="text-sm text-body leading-relaxed">{selectedLogModal.evaluation_notes}</p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-5 border-t border-line bg-subtle flex items-center justify-between gap-3">
              {selectedLogModal.report_id ? (
                <Link
                  to={`/kader/validasi/${selectedLogModal.report_id}`}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline"
                >
                  <span>Buka Lembar Laporan #{selectedLogModal.report_id}</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              ) : (
                <span />
              )}
              <button
                type="button"
                onClick={() => setSelectedLogModal(null)}
                className="px-4 py-2 bg-card hover:bg-muted text-heading border border-line rounded-xl text-sm font-semibold cursor-pointer transition-colors"
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

export default AuditLogs;
