import React, { useState, useEffect } from "react";
import api, { getErrorMessage } from "../../services/api";
import {
  ShieldAlert,
  CheckCircle,
  XCircle,
  RefreshCw,
  AlertTriangle,
  Trash2,
} from "lucide-react";

const AuditLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState([]);
  const [deletingBulk, setDeletingBulk] = useState(false);
  const [clearingAll, setClearingAll] = useState(false);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await api.get("/admin/audit-logs");
      setLogs(res.data);
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

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-line-light">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-heading tracking-tight">
            Audit Log Evaluator AI Independen
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {logs.length > 0 && (
            <button
              onClick={handleClearAll}
              disabled={clearingAll}
              className="btn-interactive flex items-center gap-1.5 px-3.5 py-2 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 hover:bg-rose-100 rounded-xl text-xs font-semibold transition-colors duration-200 disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
              {clearingAll ? "Membersihkan..." : "Bersihkan Seluruh Log"}
            </button>
          )}
          <button
            onClick={fetchLogs}
            className="btn-interactive flex items-center gap-1.5 px-3.5 py-2 bg-card border border-line hover:bg-muted text-label hover:text-heading rounded-xl text-xs font-semibold transition-colors duration-200"
          >
            <RefreshCw className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
            Segarkan
          </button>
        </div>
      </div>

      {selectedIds.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 rounded-2xl animate-fade-in shadow-sm">
          <div className="flex items-center gap-2.5 text-xs font-semibold text-sky-800 dark:text-sky-200">
            <span className="px-2.5 py-1 bg-sky-600 text-white rounded-lg text-xs font-bold shadow-sm">
              {selectedIds.length}
            </span>
            <span>Log audit terpilih untuk dihapus</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="btn-interactive px-3.5 py-1.5 rounded-xl text-xs font-medium text-caption hover:bg-muted hover:text-heading transition-colors cursor-pointer"
            >
              Batal Pilihan
            </button>
            <button
              type="button"
              onClick={handleBulkDelete}
              disabled={deletingBulk}
              className="btn-interactive flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {deletingBulk ? "Menghapus..." : `Hapus ${selectedIds.length} Log Terpilih`}
            </button>
          </div>
        </div>
      )}

      <div className="bg-card rounded-2xl border border-line shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-muted text-label border-b border-line">
              <tr>
                <th className="p-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={logs.length > 0 && selectedIds.length === logs.length}
                    onChange={handleToggleAll}
                    className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-line cursor-pointer"
                    aria-label="Pilih semua log"
                  />
                </th>
                <th className="p-3">ID & Waktu</th>
                <th className="p-3">Nama Agent</th>
                <th className="p-3">Instruksi Awal</th>
                <th className="p-3">Kepatuhan Output (Biner)</th>
                <th className="p-3">Catatan Evaluasi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-light">
              {loading ? (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-dim">
                    Memuat catatan log audit...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td
                    colSpan="6"
                    className="p-8 text-center text-dim italic"
                  >
                    Belum ada log evaluasi audit tersimpan.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr
                    key={log.id}
                    className={`table-row-interactive hover:bg-accent-sky transition-colors duration-150 ${
                      selectedIds.includes(log.id) ? "bg-sky-50/60 dark:bg-sky-950/20" : ""
                    }`}
                  >
                    <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(log.id)}
                        onChange={() => handleToggleRow(log.id)}
                        className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-line cursor-pointer"
                        aria-label={`Pilih log audit #${log.id}`}
                      />
                    </td>
                    <td className="p-3 text-caption">
                      <p className="font-bold text-heading">#{log.id}</p>
                      <p className="text-[10px] text-dim">
                        {log.created_at}
                      </p>
                    </td>
                    <td className="p-3 font-semibold text-heading">
                      {log.agent_name}
                    </td>
                    <td
                      className="p-3 text-body max-w-xs truncate"
                      title={log.input_instruction}
                    >
                      {log.input_instruction}
                    </td>
                    <td className="p-3">
                      {log.is_compliant === true ? (
                        <span 
                          title="Agen selesai berjalan dan diverifikasi patuh terhadap pedoman klinis."
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-accent-emerald text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50 rounded-lg text-[10px] font-bold cursor-help"
                        >
                          <CheckCircle className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                          Patuh (Valid)
                        </span>
                      ) : log.is_compliant === false ? (
                        <span 
                          title="Agen selesai berjalan dan menghasilkan output, namun LLM Evaluator mencatat adanya catatan deviasi logika/sitasi."
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-accent-rose text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800/50 rounded-lg text-[10px] font-bold cursor-help"
                        >
                          <XCircle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                          Ada Deviasi
                        </span>
                      ) : (
                        <span 
                          title="Evaluasi belum selesai atau API evaluator offline."
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50 rounded-lg text-[10px] font-bold"
                        >
                          <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                          Belum Dievaluasi
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-caption text-[11px] max-w-sm">
                      {log.evaluation_notes}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AuditLogs;

