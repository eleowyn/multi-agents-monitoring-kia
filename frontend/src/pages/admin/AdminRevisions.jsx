import React, { useState, useEffect, useRef } from "react";
import api, { getErrorMessage } from "../../services/api";
import {
  FileEdit,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Filter,
  RefreshCw,
  AlertTriangle,
  ChevronRight,
  ArrowRight,
  User,
  MapPin,
  Calendar,
  X,
  Sparkles,
  Trash2,
} from "lucide-react";

// Human-friendly field labels
const FIELD_LABELS = {
  visit_date: "Tanggal Kunjungan",
  phase: "Fase KIA",
  // Ibu Hamil
  trimester: "Trimester",
  gestational_age_weeks: "Usia Kehamilan (Minggu)",
  maternal_weight_kg: "Berat Badan Ibu (kg)",
  maternal_height_cm: "Tinggi Badan Ibu (cm)",
  lila_cm: "LiLA (cm)",
  hb_level: "Hemoglobin (g/dL)",
  systolic_bp: "Tensi Sistolik (mmHg)",
  diastolic_bp: "Tensi Diastolik (mmHg)",
  fundal_height_cm: "Tinggi Fundus Uteri (cm)",
  kspr_answers: "Skrining KSPR",
  // Bayi Baru Lahir
  birth_weight_gram: "Berat Lahir (Gram)",
  birth_length_cm: "Panjang Lahir (cm)",
  head_circumference_cm: "Lingkar Kepala (cm)",
  gestational_age_at_birth_weeks: "Usia Gestasi Lahir (Minggu)",
  early_initiation_breastfeeding: "Inisiasi Menyusu Dini (IMD)",
  // Baduta
  age_in_months: "Usia Anak (Bulan)",
  child_weight_kg: "Berat Badan Anak (kg)",
  child_length_cm: "Panjang/Tinggi Badan (cm)",
  child_head_circumference_cm: "Lingkar Kepala (cm)",
  weight_trend_kms: "Tren Berat Badan (KMS)",
  feeding_status: "Status Pemberian Makan",
  vitamin_a: "Kapsul Vitamin A",
  immunization_status: "Status Imunisasi",
  clinical_notes: "Catatan Keluhan Klinis",
};

const formatValue = (key, val) => {
  if (val === null || val === undefined || val === "") return "-";
  if (key === "kspr_answers" && Array.isArray(val)) {
    return val.length > 0 ? `${val.length} faktor risiko dipilih` : "0 faktor risiko (KRR)";
  }
  return String(val);
};

const AdminRevisions = () => {
  const [revisions, setRevisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [villageFilter, setVillageFilter] = useState("");
  const [search, setSearch] = useState("");
  const [selectedRev, setSelectedRev] = useState(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const modalRef = useRef(null);

  useEffect(() => {
    fetchRevisions();
  }, [statusFilter, villageFilter]);

  const fetchRevisions = async () => {
    try {
      setLoading(true);
      setError("");
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (villageFilter) params.village_name = villageFilter;
      const res = await api.get("/revisions/", { params });
      setRevisions(res.data || []);
    } catch (err) {
      console.error(err);
      setError("Gagal memuat daftar pengajuan revisi data.");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenReview = (rev) => {
    setSelectedRev(rev);
    setAdminNotes(rev.admin_notes || "");
  };

  const handleValidate = async (status) => {
    if (!selectedRev) return;

    const isDelete = selectedRev?.proposed_data?._action === "DELETE";
    const actionText =
      status === "APPROVED"
        ? isDelete
          ? "menyetujui permohonan penghapusan rekam medis"
          : "menyetujui pengajuan revisi rekam medis"
        : "menolak pengajuan";

    if (
      !window.confirm(
        `Apakah Anda yakin ingin ${actionText} ini?${
          status === "APPROVED" && !isDelete
            ? "\n\nSistem AI akan otomatis menjalankan re-analisis LangGraph terhadap data kunjungan baru dan memperbarui dokumen laporan PDF."
            : status === "APPROVED" && isDelete
            ? "\n\nPerhatian: Rekam kunjungan dan laporan pemeriksaan ini akan dihapus secara permanen dari basis data."
            : ""
        }`
      )
    ) {
      return;
    }

    try {
      setActionLoading(true);
      await api.post(`/revisions/${selectedRev.id}/validate`, {
        status: status,
        admin_notes:
          adminNotes.trim() ||
          (status === "APPROVED"
            ? isDelete
              ? "Penghapusan kunjungan disetujui Administrator"
              : "Disetujui oleh Administrator Puskesmas"
            : "Ditolak oleh Administrator"),
      });

      alert(`Pengajuan #${selectedRev.id} berhasil ${status === "APPROVED" ? "disetujui" : "ditolak"}!`);
      setSelectedRev(null);
      fetchRevisions();
    } catch (err) {
      alert(getErrorMessage(err, "Gagal memproses validasi pengajuan revisi."));
    } finally {
      setActionLoading(false);
    }
  };

  const filtered = revisions.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (r.patient_name && r.patient_name.toLowerCase().includes(q)) ||
      (r.patient_nik && r.patient_nik.includes(q)) ||
      (r.kader_name && r.kader_name.toLowerCase().includes(q)) ||
      (r.reason && r.reason.toLowerCase().includes(q))
    );
  });

  const pendingCount = revisions.filter((r) => r.status === "PENDING").length;
  const approvedCount = revisions.filter((r) => r.status === "APPROVED").length;
  const rejectedCount = revisions.filter((r) => r.status === "REJECTED").length;

  const isDeleteRequest = selectedRev?.proposed_data?._action === "DELETE";

  // Compute diff keys for the selected revision
  const diffKeys = selectedRev
    ? Array.from(
        new Set([
          ...Object.keys(selectedRev.previous_data || {}),
          ...Object.keys(selectedRev.proposed_data || {}),
        ])
      ).filter((k) => k !== "phase" && k !== "id" && k !== "_action")
    : [];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-line-light">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-heading tracking-tight">
              Persetujuan Revisi Data Kunjungan
            </h1>
            {pendingCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-800">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                {pendingCount} Menunggu
              </span>
            )}
          </div>
        </div>
        <button
          onClick={fetchRevisions}
          disabled={loading}
          className="btn-interactive flex items-center gap-1.5 px-3.5 py-2 border border-line bg-card hover:bg-muted text-label hover:text-heading rounded-xl text-xs font-semibold self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Segarkan Data</span>
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-card p-4 rounded-2xl border border-line shadow-card flex items-center justify-between">
          <div>
            <p className="text-xs text-caption font-medium">Total Pengajuan</p>
            <p className="text-2xl font-bold text-heading mt-1">{revisions.length}</p>
          </div>
          <div className="p-3 bg-sky-100 dark:bg-sky-900/40 text-sky-600 dark:text-sky-400 rounded-xl">
            <FileEdit className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-card p-4 rounded-2xl border border-line shadow-card flex items-center justify-between">
          <div>
            <p className="text-xs text-caption font-medium">Menunggu Validasi</p>
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">{pendingCount}</p>
          </div>
          <div className="p-3 bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 rounded-xl">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-card p-4 rounded-2xl border border-line shadow-card flex items-center justify-between">
          <div>
            <p className="text-xs text-caption font-medium">Disetujui Admin</p>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{approvedCount}</p>
          </div>
          <div className="p-3 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-xl">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-card p-4 rounded-2xl border border-line shadow-card flex items-center justify-between">
          <div>
            <p className="text-xs text-caption font-medium">Ditolak</p>
            <p className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">{rejectedCount}</p>
          </div>
          <div className="p-3 bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 rounded-xl">
            <XCircle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full h-10">
          <Search className="w-4 h-4 text-dim absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Cari pasien, NIK, kader, atau alasan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-10 pr-4 bg-card border border-line rounded-xl text-xs sm:text-sm text-heading placeholder:text-dim focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500 transition-all"
          />
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 px-3 bg-card border border-line rounded-xl text-xs sm:text-sm font-medium text-heading focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500 transition-all cursor-pointer"
          >
            <option value="">Semua Status</option>
            <option value="PENDING">Menunggu Validasi</option>
            <option value="APPROVED">Disetujui</option>
            <option value="REJECTED">Ditolak</option>
          </select>

          <select
            value={villageFilter}
            onChange={(e) => setVillageFilter(e.target.value)}
            className="h-10 px-3 bg-card border border-line rounded-xl text-xs sm:text-sm font-medium text-heading focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500 transition-all cursor-pointer"
          >
            <option value="">Semua Desa</option>
            <option value="Airmadidi Atas">Airmadidi Atas</option>
            <option value="Airmadidi Bawah">Airmadidi Bawah</option>
            <option value="Sarongsong Satu">Sarongsong Satu</option>
            <option value="Sarongsong Dua">Sarongsong Dua</option>
            <option value="Sukur">Sukur</option>
            <option value="Rap-Rap">Rap-Rap</option>
            <option value="Sawangan">Sawangan</option>
            <option value="Sampiri">Sampiri</option>
            <option value="Tanggari">Tanggari</option>
          </select>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-card rounded-2xl border border-line shadow-card overflow-hidden">
        {loading ? (
          <div className="py-20 text-center space-y-3">
            <RefreshCw className="w-8 h-8 animate-spin text-sky-600 mx-auto" />
            <p className="text-sm text-caption">Memuat antrean pengajuan revisi...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <CheckCircle2 className="w-10 h-10 text-dim mx-auto" />
            <h3 className="text-sm font-bold text-heading">Tidak Ada Pengajuan Revisi</h3>
            <p className="text-xs text-caption max-w-sm mx-auto">
              {statusFilter
                ? `Tidak ada pengajuan dengan filter status '${statusFilter}'.`
                : "Belum ada tiket pengajuan revisi data kunjungan dari kader Posyandu."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-line bg-subtle text-caption text-xs font-bold uppercase tracking-wider">
                  <th className="p-4">ID & Tanggal</th>
                  <th className="p-4">Pasien & Wilayah</th>
                  <th className="p-4">Kader Pengaju</th>
                  <th className="p-4">Fase & Kunjungan</th>
                  <th className="p-4">Alasan Pengajuan</th>
                  <th className="p-4 text-center">Status</th>
                  <th className="p-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-light">
                {filtered.map((rev) => {
                  const isPending = rev.status === "PENDING";
                  return (
                    <tr
                      key={rev.id}
                      className="hover:bg-subtle transition-colors duration-150"
                    >
                      <td className="p-4 whitespace-nowrap">
                        <span className="font-bold text-heading">#{rev.id}</span>
                        <p className="text-xs text-caption mt-0.5">
                          {rev.created_at ? new Date(rev.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "-"}
                        </p>
                      </td>

                      <td className="p-4">
                        <p className="font-semibold text-heading">{rev.patient_name || "Pasien"}</p>
                        <p className="text-xs text-caption font-mono">NIK: {rev.patient_nik || "-"}</p>
                        <p className="text-xs text-dim flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3" />
                          <span>{rev.village_name || "Airmadidi"}</span>
                        </p>
                      </td>

                      <td className="p-4 whitespace-nowrap">
                        <p className="font-medium text-body">{rev.kader_name || "Kader"}</p>
                        <p className="text-xs text-caption">Kader Posyandu</p>
                      </td>

                      <td className="p-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-accent-sky text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-800/50">
                            {rev.phase || "KIA"}
                          </span>
                          {rev.proposed_data?._action === "DELETE" && (
                            <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                              HAPUS
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-caption mt-1 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          <span>{rev.visit_date || "-"}</span>
                        </p>
                      </td>

                      <td className="p-4 max-w-xs">
                        <p className="text-xs text-body line-clamp-2 leading-relaxed" title={rev.reason}>
                          {rev.reason}
                        </p>
                        {rev.admin_notes && (
                          <p className="text-xs text-caption italic mt-1 bg-subtle p-1.5 rounded border border-line-light">
                            <strong>Admin:</strong> {rev.admin_notes}
                          </p>
                        )}
                      </td>

                      <td className="p-4 text-center whitespace-nowrap">
                        {isPending ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-800">
                            <Clock className="w-3 h-3" />
                            Menunggu
                          </span>
                        ) : rev.status === "APPROVED" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800">
                            <CheckCircle2 className="w-3 h-3" />
                            Disetujui
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 dark:bg-rose-900/50 text-rose-800 dark:text-rose-200 border border-rose-300 dark:border-rose-800">
                            <XCircle className="w-3 h-3" />
                            Ditolak
                          </span>
                        )}
                      </td>

                      <td className="p-4 text-center whitespace-nowrap">
                        <button
                          onClick={() => handleOpenReview(rev)}
                          className={`btn-interactive px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            isPending
                              ? "bg-sky-600 hover:bg-sky-700 text-white shadow-xs"
                              : "border border-line hover:bg-muted text-label"
                          }`}
                        >
                          {isPending ? "Telaah & Validasi" : "Lihat Detail"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Side-by-Side Diff Modal */}
      {selectedRev && (
        <div
          className="fixed inset-0 bg-overlay flex items-center justify-center p-4 z-50 overflow-y-auto animate-fade-in"
          role="dialog"
          aria-modal="true"
        >
          <div
            ref={modalRef}
            className="bg-card w-full max-w-4xl rounded-2xl border border-line shadow-prominent overflow-hidden my-6 max-h-[92vh] flex flex-col animate-slide-up"
          >
            {/* Modal Header */}
            <div className="p-5 border-b border-line bg-subtle flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-heading">
                    {isDeleteRequest ? "Telaah Permohonan Hapus Kunjungan #" : "Telaah Usulan Perubahan Rekam Medis #"}
                    {selectedRev.id}
                  </h2>
                  {isDeleteRequest && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-200 border border-rose-300 dark:border-rose-800">
                      HAPUS KUNJUNGAN
                    </span>
                  )}
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                      selectedRev.status === "PENDING"
                        ? "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200"
                        : selectedRev.status === "APPROVED"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200"
                        : "bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-200"
                    }`}
                  >
                    {selectedRev.status}
                  </span>
                </div>
                <p className="text-xs text-caption mt-0.5">
                  Pasien: <strong>{selectedRev.patient_name}</strong> ({selectedRev.patient_nik}) &bull; Diajukan oleh Kader:{" "}
                  <strong>{selectedRev.kader_name}</strong> ({selectedRev.village_name})
                </p>
              </div>
              <button
                onClick={() => setSelectedRev(null)}
                className="p-2 text-dim hover:text-heading hover:bg-muted rounded-xl transition-colors cursor-pointer"
                aria-label="Tutup modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
              {/* Reason Card */}
              <div className="p-4 bg-accent-amber border border-amber-300 dark:border-amber-800/50 rounded-xl space-y-1">
                <p className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                  <FileEdit className="w-4 h-4 text-amber-600" />
                  Alasan Pengajuan oleh Kader:
                </p>
                <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed pl-5">
                  "{selectedRev.reason}"
                </p>
              </div>

              {/* Deletion Warning or Side-by-Side Diff Table */}
              {isDeleteRequest ? (
                <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 rounded-xl space-y-3">
                  <div className="flex items-center gap-2 text-rose-800 dark:text-rose-200 font-bold text-sm">
                    <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                    <span>Permohonan Penghapusan Rekam Medis Kunjungan (Use Case 8 & 9)</span>
                  </div>
                  <p className="text-xs text-rose-700 dark:text-rose-300 leading-relaxed">
                    Kader Posyandu mengajukan permohonan agar rekam kunjungan ini dihapus dari sistem (misal: kesalahan entri ganda atau salah pasien). Jika disetujui, rekam kunjungan dan seluruh berkas laporan pemeriksaan AI terkait akan dihapus. Riwayat pengajuan revisi ini akan tetap disimpan dalam audit trail integritas rekam medis.
                  </p>
                  <div className="mt-2 p-3 bg-card rounded-lg border border-line">
                    <p className="text-xs font-bold text-heading mb-2">Ringkasan Data Kunjungan yang Akan Dihapus:</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                      <div><span className="text-caption">Tanggal:</span> <strong className="text-body font-mono ml-1">{selectedRev.previous_data?.visit_date || selectedRev.visit_date || "-"}</strong></div>
                      <div><span className="text-caption">Fase:</span> <strong className="text-body ml-1">{selectedRev.phase || selectedRev.previous_data?.phase || "-"}</strong></div>
                      {selectedRev.previous_data?.gestational_age_weeks && <div><span className="text-caption">Usia Gestasi:</span> <strong className="text-body ml-1">{selectedRev.previous_data.gestational_age_weeks} mg</strong></div>}
                      {selectedRev.previous_data?.maternal_weight_kg && <div><span className="text-caption">BB Ibu:</span> <strong className="text-body ml-1">{selectedRev.previous_data.maternal_weight_kg} kg</strong></div>}
                      {selectedRev.previous_data?.child_weight_kg && <div><span className="text-caption">BB Anak:</span> <strong className="text-body ml-1">{selectedRev.previous_data.child_weight_kg} kg</strong></div>}
                      {selectedRev.previous_data?.birth_weight_gram && <div><span className="text-caption">BB Lahir:</span> <strong className="text-body ml-1">{selectedRev.previous_data.birth_weight_gram} gr</strong></div>}
                      {selectedRev.previous_data?.age_in_months && <div><span className="text-caption">Usia:</span> <strong className="text-body ml-1">{selectedRev.previous_data.age_in_months} bln</strong></div>}
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold text-heading uppercase tracking-wider">
                        Perbandingan Nilai Rekam Medis (Side-by-Side Diff)
                      </h3>
                      <span className="text-xs text-caption">
                        Baris berwarna menunjukkan data yang diubah
                      </span>
                    </div>

                    <div className="border border-line rounded-xl overflow-hidden">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-muted text-caption font-bold border-b border-line">
                          <tr>
                            <th className="p-3 w-1/3">Parameter Klinis</th>
                            <th className="p-3 w-1/3 bg-rose-50/50 dark:bg-rose-950/20 text-rose-800 dark:text-rose-300">
                              Data Kunjungan Lama
                            </th>
                            <th className="p-3 w-1/3 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300">
                              Usulan Data Baru
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-line-light">
                          {diffKeys.map((key) => {
                            const oldVal = selectedRev.previous_data?.[key];
                            const newVal = selectedRev.proposed_data?.[key];
                            const isChanged = JSON.stringify(oldVal) !== JSON.stringify(newVal);

                            return (
                              <tr
                                key={key}
                                className={
                                  isChanged
                                    ? "bg-amber-50/60 dark:bg-amber-950/20 font-medium"
                                    : "hover:bg-subtle"
                                }
                              >
                                <td className="p-3 text-body font-semibold">
                                  {FIELD_LABELS[key] || key}
                                  {isChanged && (
                                    <span className="ml-2 px-1.5 py-0.5 rounded text-xs bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-100 font-bold">
                                      Diubah
                                    </span>
                                  )}
                                </td>
                                <td className="p-3 text-caption font-mono">
                                  {formatValue(key, oldVal)}
                                </td>
                                <td
                                  className={`p-3 font-mono ${
                                    isChanged
                                      ? "text-emerald-700 dark:text-emerald-300 font-bold"
                                      : "text-caption"
                                  }`}
                                >
                                  {formatValue(key, newVal)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Notice AI Re-eval */}
                  <div className="p-3.5 bg-accent-sky border border-sky-200 dark:border-sky-800/50 rounded-xl text-xs text-sky-900 dark:text-sky-200 flex items-start gap-2.5">
                    <Sparkles className="w-4 h-4 shrink-0 text-sky-600 mt-0.5" />
                    <p className="leading-relaxed">
                      Jika Anda menekan tombol <strong>Setujui & Jalankan Re-analisis AI</strong>, sistem backend akan otomatis memicu kembali graf Multi-Agent LangGraph (Agent 1 $\rightarrow$ Agent 2 $\rightarrow$ Agent 3) untuk memperbarui flag risiko, narasi klinis, dan menerbitkan berkas PDF yang telah disinkronkan.
                    </p>
                  </div>
                </>
              )}

              {/* Admin Notes */}
              <div>
                <label className="block text-xs font-bold text-label mb-1">
                  Catatan / Keterangan Administrator Puskesmas:
                </label>
                <textarea
                  rows={2}
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  disabled={selectedRev.status !== "PENDING" || actionLoading}
                  placeholder="Tuliskan catatan penjelasan persetujuan atau alasan penolakan..."
                  className="w-full px-3.5 py-2.5 bg-subtle border border-line rounded-xl text-xs text-heading placeholder:text-dim focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-line bg-subtle flex items-center justify-between">
              <span className="text-xs text-caption">
                {selectedRev.resolved_at
                  ? `Selesai divalidasi pada ${new Date(selectedRev.resolved_at).toLocaleString("id-ID")}`
                  : "Menunggu keputusan Administrator"}
              </span>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setSelectedRev(null)}
                  disabled={actionLoading}
                  className="px-4 py-2 border border-line rounded-xl text-xs font-semibold text-label hover:bg-muted transition-colors cursor-pointer"
                >
                  Tutup
                </button>

                {selectedRev.status === "PENDING" && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleValidate("REJECTED")}
                      disabled={actionLoading}
                      className="btn-interactive px-4 py-2 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50"
                    >
                      {actionLoading ? "Memproses..." : "Tolak Pengajuan"}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleValidate("APPROVED")}
                      disabled={actionLoading}
                      className={`btn-interactive flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white shadow-xs transition-all cursor-pointer disabled:opacity-50 ${
                        isDeleteRequest
                          ? "bg-rose-600 hover:bg-rose-700 active:bg-rose-800"
                          : "bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800"
                      }`}
                    >
                      {actionLoading ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>{isDeleteRequest ? "Menghapus Data..." : "Mengevaluasi Ulang AI..."}</span>
                        </>
                      ) : isDeleteRequest ? (
                        <>
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Setujui & Hapus Rekam Kunjungan</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Setujui & Jalankan Re-analisis AI</span>
                        </>
                      )}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminRevisions;
