import React, { useState, useEffect } from "react";
import api from "../../services/api";
import {
  Users,
  AlertTriangle,
  HeartPulse,
  Baby,
  CheckCircle,
  Clock,
  MapPin,
  RefreshCw,
} from "lucide-react";

const AdminDashboard = () => {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSummary();
  }, []);

  const fetchSummary = async () => {
    try {
      setLoading(true);
      const res = await api.get("/admin/dashboard-summary");
      setSummary(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-sky-600 dark:text-sky-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Title */}
      <div>
        <h2 className="text-xl font-bold text-heading">
          Dashboard Monitoring KIA & Stunting
        </h2>
        <p className="text-xs text-caption mt-0.5">
          Puskesmas Kecamatan Airmadidi &bull; Rekapitulasi agregat pemantauan
          1.000 HPK lintas 9 Desa/Kelurahan
        </p>
      </div>

      {/* Top Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card p-5 rounded-2xl border border-line shadow-card flex items-center gap-4">
          <div className="p-3 bg-accent-sky text-sky-600 dark:text-sky-400 rounded-xl border border-sky-200 dark:border-sky-800/50">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-caption">
              Total Pasien Terdaftar
            </p>
            <p className="text-2xl font-bold text-heading mt-0.5">
              {summary?.total_patients || 0}
            </p>
          </div>
        </div>

        <div className="bg-card p-5 rounded-2xl border border-line shadow-card flex items-center gap-4">
          <div className="p-3 bg-accent-rose text-rose-600 dark:text-rose-400 rounded-xl border border-rose-200 dark:border-rose-800/50">
            <Baby className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-caption">
              Kasus Stunting Terdeteksi
            </p>
            <p className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-0.5">
              {summary?.total_stunting || 0}
            </p>
          </div>
        </div>

        <div className="bg-card p-5 rounded-2xl border border-line shadow-card flex items-center gap-4">
          <div className="p-3 bg-accent-amber text-amber-600 dark:text-amber-400 rounded-xl border border-amber-200 dark:border-amber-800/50">
            <HeartPulse className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-caption">
              Ibu Hamil KEK / Anemia
            </p>
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-0.5">
              {(summary?.total_kek || 0) + (summary?.total_anemia || 0)}
            </p>
          </div>
        </div>

        <div className="bg-card p-5 rounded-2xl border border-line shadow-card flex items-center gap-4">
          <div className="p-3 bg-accent-emerald text-emerald-600 dark:text-emerald-400 rounded-xl border border-emerald-200 dark:border-emerald-800/50">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-caption">
              Laporan Tervalidasi Kader
            </p>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
              {summary?.total_reports_approved || 0}
            </p>
          </div>
        </div>
      </div>

      {/* Village Breakdown Table */}
      <div className="bg-card rounded-2xl border border-line shadow-card overflow-hidden">
        <div className="p-5 border-b border-line flex items-center justify-between">
          <h3 className="text-sm font-bold text-heading flex items-center gap-2">
            <MapPin className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            Distribusi Kasus Risiko 1.000 HPK per Desa/Kelurahan
          </h3>
          <button
            onClick={fetchSummary}
            className="text-xs text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 font-semibold"
          >
            Muat Ulang
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-muted text-label border-b border-line">
              <tr>
                <th className="p-3.5">Desa / Kelurahan</th>
                <th className="p-3.5 text-center">Total Pasien</th>
                <th className="p-3.5 text-center text-rose-600 dark:text-rose-400">
                  Kasus Stunting
                </th>
                <th className="p-3.5 text-center text-amber-600 dark:text-amber-400">Ibu KEK</th>
                <th className="p-3.5 text-center text-amber-600 dark:text-amber-400">Ibu Anemia</th>
                <th className="p-3.5 text-center text-rose-600 dark:text-rose-400">Risiko Tinggi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-light">
              {summary?.village_breakdown?.map((v, i) => (
                <tr key={i} className="hover:bg-accent-sky transition-colors duration-150">
                  <td className="p-3.5 font-bold text-heading">
                    {v.village_name}
                  </td>
                  <td className="p-3.5 text-center text-body">
                    {v.total_patients}
                  </td>
                  <td className="p-3.5 text-center font-bold text-rose-600 dark:text-rose-400">
                    {v.stunting_count}
                  </td>
                  <td className="p-3.5 text-center font-semibold text-amber-600 dark:text-amber-400">
                    {v.kek_count}
                  </td>
                  <td className="p-3.5 text-center font-semibold text-amber-600 dark:text-amber-400">
                    {v.anemia_count}
                  </td>
                  <td className="p-3.5 text-center">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        v.high_risk_count > 0
                          ? "bg-accent-rose text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800/50"
                          : "bg-muted text-dim border-line"
                      }`}
                    >
                      {v.high_risk_count}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
