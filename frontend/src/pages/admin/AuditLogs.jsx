import React, { useState, useEffect } from "react";
import api from "../../services/api";
import { ShieldAlert, CheckCircle, XCircle, RefreshCw, AlertTriangle } from "lucide-react";

const AuditLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await api.get("/admin/audit-logs");
      setLogs(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-heading">
            Audit Log Evaluator AI Independen
          </h2>
          <p className="text-xs text-caption mt-0.5">
            Log evaluasi kepatuhan biner (Ya/Tidak) terhadap output
            masing-masing agent secara paralel
          </p>
        </div>
        <button
          onClick={fetchLogs}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-card border border-line hover:bg-muted text-label hover:text-heading rounded-xl text-xs font-semibold transition-colors duration-200"
        >
          <RefreshCw className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
          Segarkan
        </button>
      </div>

      <div className="bg-card rounded-2xl border border-line shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-muted text-label border-b border-line">
              <tr>
                <th className="p-3.5">ID & Waktu</th>
                <th className="p-3.5">Nama Agent</th>
                <th className="p-3.5">Instruksi Awal</th>
                <th className="p-3.5">Kepatuhan LLM (Biner)</th>
                <th className="p-3.5">Catatan Evaluasi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-light">
              {logs.length === 0 ? (
                <tr>
                  <td
                    colSpan="5"
                    className="p-8 text-center text-dim italic"
                  >
                    Belum ada log evaluasi audit tersimpan.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-accent-sky transition-colors duration-150">
                    <td className="p-3.5 text-caption">
                      <p className="font-bold text-heading">#{log.id}</p>
                      <p className="text-[10px] text-dim">
                        {log.created_at}
                      </p>
                    </td>
                    <td className="p-3.5 font-semibold text-heading">
                      {log.agent_name}
                    </td>
                    <td
                      className="p-3.5 text-body max-w-xs truncate"
                      title={log.input_instruction}
                    >
                      {log.input_instruction}
                    </td>
                    <td className="p-3.5">
                      {log.is_compliant === true ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-accent-emerald text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50 rounded-lg text-[10px] font-bold">
                          <CheckCircle className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                          Ya (Patuh)
                        </span>
                      ) : log.is_compliant === false ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-accent-rose text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800/50 rounded-lg text-[10px] font-bold">
                          <XCircle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                          Tidak (Deviasi)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50 rounded-lg text-[10px] font-bold">
                          <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                          Gagal / Offline
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 text-caption text-[11px] max-w-sm">
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
