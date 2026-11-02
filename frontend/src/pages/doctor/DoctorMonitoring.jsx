import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api, { getErrorMessage } from "../../services/api";
import {
  HeartPulse,
  FileSpreadsheet,
  Printer,
  RefreshCw,
  ChevronRight,
  Star,
} from "lucide-react";

/* ─── Helper Penerjemah Label Indikator Medis ─── */
const humanRiskName = (flag) => {
  if (!flag) return "";
  const map = {
    RISIKO_KEHAMILAN_SANGAT_TINGGI_KRST: "Kehamilan Risiko Sangat Tinggi (KRST)",
    RISIKO_KEHAMILAN_TINGGI_KRT: "Kehamilan Risiko Tinggi (KRT)",
    KEHAMILAN_RISIKO_RENDAH_KRR: "Kehamilan Risiko Rendah (KRR)",
    STUNTING_SEVERELY_STUNTED: "Sangat Pendek / Severely Stunted",
    STUNTING_STUNTED: "Pendek / Stunted",
    RISIKO_STUNTING_BERAT: "Sangat Pendek (PB/U < -3 SD)",
    RISIKO_STUNTING: "Pendek (PB/U < -2 SD)",
    GIZI_BURUK_SEVERELY_UNDERWEIGHT: "BB Sangat Kurang",
    GIZI_KURANG_UNDERWEIGHT: "BB Kurang / Underweight",
    RISIKO_GIZI_BURUK: "Gizi Buruk / Severely Wasted",
    RISIKO_GIZI_KURANG: "Gizi Kurang / Wasted",
    WASTING_SEVERELY_WASTED: "Gizi Buruk (BB/PB < -3 SD)",
    WASTING_WASTED: "Gizi Kurang (BB/PB < -2 SD)",
    ANEMIA_BERAT: "Anemia Berat (Hb < 8.0 g/dL)",
    ANEMIA_SEDANG: "Anemia Sedang (Hb 8.0 - 9.9 g/dL)",
    ANEMIA_RINGAN: "Anemia Ringan (Hb 10.0 - 10.9 g/dL)",
    RISIKO_ANEMIA_BERAT: "Anemia Berat Maternal",
    RISIKO_ANEMIA_SEDANG: "Anemia Sedang Maternal",
    RISIKO_ANEMIA_RINGAN: "Anemia Ringan Maternal",
    RISIKO_KEK: "KEK (LiLA < 23.5 cm)",
    RISIKO_KEK_MATERNAL: "KEK Maternal (LiLA < 23.5 cm)",
    BBLR: "Berat Bayi Lahir Rendah (< 2.500 g)",
    RISIKO_BBLR: "Berat Bayi Lahir Rendah (< 2.500 g)",
    PREMATUR: "Kelahiran Prematur (< 37 Minggu)",
    RISIKO_PREMATUR: "Kelahiran Prematur (< 37 Minggu)",
    BB_TIDAK_NAIK_KMS: "BB Tidak Naik (KMS)",
    BB_TIDAK_NAIK_2T: "BB Tidak Naik 2x Berturut (2T)",
    BB_IBU_HAMIL_TURUN: "Penurunan BB Ibu Hamil",
    RIWAYAT_IBU_KEK: "Riwayat Ibu KEK Saat Hamil",
    RIWAYAT_IBU_ANEMIA: "Riwayat Ibu Anemia Saat Hamil",
    RIWAYAT_KEHAMILAN_RISIKO_TINGGI: "Riwayat Risiko Obstetri (KSPR)",
    LONGITUDINAL_MATERNAL_KEK: "Riwayat Ibu KEK Saat Hamil",
    LONGITUDINAL_MATERNAL_ANEMIA: "Riwayat Ibu Anemia Saat Hamil",
    LONGITUDINAL_MATERNAL_KSPR: "Riwayat Risiko Obstetri (KSPR)",
    MIKROSEFALI: "Mikrosefali (< 33 cm Lingkar Kepala)",
    MAKROSEFALI: "Makrosefali (> 37 cm Lingkar Kepala)",
    MPASI_KURANG_ADEKUAT: "MP-ASI Kurang Adekuat",
  };
  return map[flag] || flag.replace(/_/g, " ");
};

const DoctorMonitoring = () => {
  const [loading, setLoading] = useState(true);
  const [selectedPosyandu, setSelectedPosyandu] = useState("");
  const [summaryData, setSummaryData] = useState(null);

  // Export / Print loading
  const [exportingExcel, setExportingExcel] = useState(false);
  const [printingPdf, setPrintingPdf] = useState(false);

  useEffect(() => {
    fetchMonitoringSummary();
  }, [selectedPosyandu]);

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

  const handleExportExcel = async () => {
    try {
      setExportingExcel(true);
      const params = {};
      if (selectedPosyandu) params.posyandu = selectedPosyandu;
      const res = await api.get("/doctor/reports/export-asik-excel", {
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

  const stats = summaryData?.summary_stats || summaryData?.metrics || {
    total_patients: 0,
    at_risk_count: summaryData?.metrics?.total_risky_reports || 0,
    stunting_severe_count: summaryData?.metrics?.severe_stunting_count || 0,
    kek_count: summaryData?.metrics?.kek_count || 0,
    anemia_count: summaryData?.metrics?.anemia_count || 0,
    kspr_high_risk_count: summaryData?.metrics?.high_kspr_count || 0,
    pending_revisions_count: summaryData?.metrics?.pending_revisions || 0,
    average_kader_rating: null,
  };

  const riskyPatients = summaryData?.risky_patients || [];
  const posyanduOptions = summaryData?.posyandu_list || [];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* ─── Header & Supervision Controls (Clean & Aligned) ─── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-line">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-sky-50 dark:bg-sky-950/50 text-sky-600 border border-sky-200 dark:border-sky-800">
              <HeartPulse className="w-5 h-5" />
            </span>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-heading tracking-tight">
                Portal Supervisi Klinis KIA
              </h1>
              <p className="text-xs text-caption">
                Puskesmas Kecamatan Airmadidi &bull; Supervisi Kasus Berisiko & Intervensi Medis
              </p>
            </div>
          </div>
        </div>

        {/* Filter Posyandu & Export Actions Aligned */}
        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          {/* Select Posyandu Native Form */}
          <select
            value={selectedPosyandu}
            onChange={(e) => setSelectedPosyandu(e.target.value)}
            className="h-9 px-3 bg-card border border-line rounded-lg text-xs font-semibold text-heading focus:outline-none focus:ring-2 focus:ring-sky-500/40 cursor-pointer shadow-2xs"
          >
            <option value="">Semua Posyandu (9 Desa)</option>
            {posyanduOptions.map((pos) => (
              <option key={pos} value={pos}>
                {pos}
              </option>
            ))}
          </select>

          {/* Tombol Ekspor ASIK Excel */}
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={exportingExcel}
            className="h-9 inline-flex items-center gap-1.5 px-3 rounded-lg border border-line bg-card hover:bg-subtle text-heading text-xs font-semibold shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
            title="Unduh Rekap Format Standar Kemenkes (ASIK / SIMPUS)"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>{exportingExcel ? "Mengunduh..." : "Ekspor Excel"}</span>
          </button>

          {/* Tombol Cetak Dokumen LB3 PDF */}
          <button
            type="button"
            onClick={handlePrintPdf}
            disabled={printingPdf}
            className="h-9 inline-flex items-center gap-1.5 px-3 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
            title="Cetak format laporan resmi KIA Puskesmas Airmadidi"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>{printingPdf ? "Mencetak..." : "Cetak LB-3"}</span>
          </button>
        </div>
      </div>

      {/* ─── 6 Stat Metric Cards ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-4 bg-card border border-line rounded-2xl flex flex-col justify-between space-y-1 shadow-2xs">
          <p className="text-xs text-caption font-medium min-h-[1.5rem] flex items-center">Total Pasien Terdata</p>
          <p className="text-2xl font-bold text-heading">{stats.total_patients}</p>
          <p className="text-xs text-dim">Lintas Wilayah</p>
        </div>

        <div className="p-4 bg-card border border-line rounded-2xl flex flex-col justify-between space-y-1 shadow-2xs">
          <p className="text-xs text-caption font-medium min-h-[1.5rem] flex items-center">Kasus Berisiko</p>
          <p className="text-2xl font-bold text-rose-600 dark:text-rose-400">{stats.at_risk_count}</p>
          <p className="text-xs text-dim">Membutuhkan Atensi</p>
        </div>

        <div className="p-4 bg-card border border-line rounded-2xl flex flex-col justify-between space-y-1 shadow-2xs">
          <p className="text-xs text-caption font-medium min-h-[1.5rem] flex items-center">Stunting Berat</p>
          <p className="text-2xl font-bold text-heading">{stats.stunting_severe_count}</p>
          <p className="text-xs text-dim">Z-Score &lt; -3 SD</p>
        </div>

        <div className="p-4 bg-card border border-line rounded-2xl flex flex-col justify-between space-y-1 shadow-2xs">
          <p className="text-xs text-caption font-medium min-h-[1.5rem] flex items-center">Bumil KEK / Anemia</p>
          <p className="text-2xl font-bold text-heading">{stats.kek_count + stats.anemia_count}</p>
          <p className="text-xs text-dim">LiLA &lt; 23.5 / Hb &lt; 11</p>
        </div>

        <div className="p-4 bg-card border border-line rounded-2xl flex flex-col justify-between space-y-1 shadow-2xs">
          <p className="text-xs text-caption font-medium min-h-[1.5rem] flex items-center">Revisi Menunggu</p>
          <p className="text-2xl font-bold text-heading">{stats.pending_revisions_count}</p>
          <p className="text-xs text-dim">
            <Link to="/doctor/revisions" className="text-sky-600 hover:underline">
              Buka Antrean &rarr;
            </Link>
          </p>
        </div>

        <div className="p-4 bg-card border border-line rounded-2xl flex flex-col justify-between space-y-1 shadow-2xs">
          <p className="text-xs text-caption font-medium min-h-[1.5rem] flex items-center">Kepuasan Kader AI</p>
          <div className="flex items-center gap-1.5">
            <p className="text-2xl font-bold text-heading">
              {stats.average_kader_rating ? Number(stats.average_kader_rating).toFixed(1) : "-"}
            </p>
            {stats.average_kader_rating ? (
              <Star className="w-4 h-4 text-amber-500 fill-current" />
            ) : null}
          </div>
          <p className="text-xs text-dim">
            {stats.average_kader_rating ? "Skala 1.0 - 5.0 (CSAT)" : "Belum ada penilaian"}
          </p>
        </div>
      </div>

      {/* ─── Daftar Kasus Berisiko Aktif ─── */}
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
                  <th className="p-3.5 text-center">Keyakinan AI</th>
                  <th className="p-3.5 text-right">Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-caption">
                      Memuat data kasus berisiko...
                    </td>
                  </tr>
                ) : riskyPatients.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-caption">
                      Tidak ada kasus berisiko aktif pada filter wilayah yang dipilih.
                    </td>
                  </tr>
                ) : (
                  riskyPatients.map((item, idx) => (
                    <tr
                      key={idx}
                      className="hover:bg-subtle/50 transition-colors"
                    >
                      <td className="p-3.5">
                        <p className="font-bold text-heading">{item.patient_name}</p>
                        <p className="text-xs text-dim">NIK: {item.patient_nik}</p>
                      </td>
                      <td className="p-3.5">
                        <p className="font-semibold text-heading text-xs">
                          {item.phase ? item.phase.replace(/_/g, " ") : "KIA"}
                        </p>
                        <p className="text-xs text-caption">
                          {item.posyandu_name || "Posyandu Airmadidi"} &bull; {item.village_name || "-"}
                        </p>
                      </td>
                      <td className="p-3.5">
                        <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                          {item.overall_status === "RISIKO_TINGGI"
                            ? "Risiko Tinggi"
                            : item.overall_status === "PERLU_PERHATIAN"
                            ? "Perlu Perhatian"
                            : item.overall_status || "Risiko"}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <div className="space-y-0.5 text-xs">
                          {(item.active_risk_flags || []).map((flag, fIdx) => (
                            <p key={fIdx} className="text-body flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                              <span>{humanRiskName(flag)}</span>
                            </p>
                          ))}
                        </div>
                      </td>
                      <td className="p-3.5 text-center">
                        {item.confidence_score ? (
                          <span className="text-xs font-semibold text-heading">
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
    </div>
  );
};

export default DoctorMonitoring;
