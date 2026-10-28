import React, { useState, useEffect, useRef } from "react";
import api, { getErrorMessage } from "../../services/api";
import { X, AlertCircle, Send, CheckCircle2, RefreshCw, FileEdit, Clock, Trash2 } from "lucide-react";

const KSPR_OPTIONS = [
  { key: "muda_hamil_1", label: "Terlalu muda, hamil I umur <= 16 tahun (Skor 4)" },
  { key: "tua_hamil_1", label: "Terlalu tua, hamil I umur >= 35 tahun (Skor 4)" },
  { key: "lambat_hamil_1", label: "Terlalu lambat hamil I, kawin >= 4 tahun (Skor 4)" },
  { key: "tua_hamil_lanjut", label: "Terlalu tua, umur >= 35 tahun (Skor 4)" },
  { key: "cepat_hamil_lagi", label: "Terlalu cepat hamil lagi < 2 tahun (Skor 4)" },
  { key: "banyak_anak", label: "Terlalu banyak anak, 4 atau lebih (Skor 4)" },
  { key: "tinggi_badan_rendah", label: "Terlalu pendek, tinggi <= 145 cm (Skor 4)" },
  { key: "riwayat_keguguran", label: "Pernah gagal kehamilan / keguguran (Skor 4)" },
  { key: "riwayat_operasi_sesar", label: "Pernah melahirkan secara sesar / SC (Skor 8)" },
  { key: "penyakit_anemia", label: "Kurang darah / Anemia (Skor 4)" },
  { key: "preeklampsia_bengkak_tensi", label: "Bengkak muka/kaki & Tekanan Darah Tinggi (Skor 4)" },
  { key: "hamil_kembar", label: "Hamil Kembar / Gemelli (Skor 4)" },
];

const RevisionRequestModal = ({ isOpen, onClose, visitId, patientInfo, onSuccess }) => {
  const [requestType, setRequestType] = useState("MODIFY"); // "MODIFY" | "DELETE"
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [reason, setReason] = useState("");
  const [formData, setFormData] = useState({});
  const modalRef = useRef(null);

  useEffect(() => {
    if (isOpen && visitId) {
      fetchVisitData();
    }
  }, [isOpen, visitId]);

  const fetchVisitData = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await api.get(`/visits/${visitId}`);
      const v = res.data;
      setFormData({
        visit_date: v.visit_date ? String(v.visit_date).split("T")[0] : "",
        phase: v.phase,
        // Ibu Hamil
        gestational_age_weeks: v.gestational_age_weeks ?? "",
        trimester: v.trimester ?? 1,
        maternal_weight_kg: v.maternal_weight_kg ?? "",
        maternal_height_cm: v.maternal_height_cm ?? "",
        lila_cm: v.lila_cm ?? "",
        hb_level: v.hb_level ?? "",
        systolic_bp: v.systolic_bp ?? "",
        diastolic_bp: v.diastolic_bp ?? "",
        fundal_height_cm: v.fundal_height_cm ?? "",
        kspr_answers: v.kspr_answers || [],
        // Bayi Baru Lahir
        birth_weight_gram: v.birth_weight_gram ?? "",
        birth_length_cm: v.birth_length_cm ?? "",
        head_circumference_cm: v.head_circumference_cm ?? "",
        gestational_age_at_birth_weeks: v.gestational_age_at_birth_weeks ?? "",
        early_initiation_breastfeeding: v.early_initiation_breastfeeding || "Ya",
        // Baduta
        age_in_months: v.age_in_months ?? "",
        child_weight_kg: v.child_weight_kg ?? "",
        child_length_cm: v.child_length_cm ?? "",
        child_head_circumference_cm: v.child_head_circumference_cm ?? "",
        weight_trend_kms: v.weight_trend_kms || "NAIK",
        feeding_status: v.feeding_status || "MP_ASI",
        vitamin_a: v.vitamin_a || "Ya",
        immunization_status: v.immunization_status || "",
        clinical_notes: v.clinical_notes || "",
      });
      setReason("");
    } catch (err) {
      console.error(err);
      setError("Gagal mengambil data kunjungan untuk direvisi.");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const toggleKspr = (key) => {
    const current = formData.kspr_answers || [];
    if (current.includes(key)) {
      handleChange("kspr_answers", current.filter((k) => k !== key));
    } else {
      handleChange("kspr_answers", [...current, key]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason.trim()) {
      alert("Harap jelaskan alasan pengajuan revisi atau penghapusan data ini.");
      return;
    }

    let proposed = {};
    if (requestType === "DELETE") {
      proposed = {
        _action: "DELETE",
        visit_date: formData.visit_date,
        phase: formData.phase,
      };
    } else {
      proposed = {
        _action: "MODIFY",
        visit_date: formData.visit_date,
        phase: formData.phase,
      };

      if (formData.phase === "IBU_HAMIL") {
        proposed.gestational_age_weeks = formData.gestational_age_weeks ? parseInt(formData.gestational_age_weeks) : null;
        proposed.trimester = formData.trimester ? parseInt(formData.trimester) : null;
        proposed.maternal_weight_kg = formData.maternal_weight_kg ? parseFloat(formData.maternal_weight_kg) : null;
        proposed.maternal_height_cm = formData.maternal_height_cm ? parseFloat(formData.maternal_height_cm) : null;
        proposed.lila_cm = formData.lila_cm ? parseFloat(formData.lila_cm) : null;
        proposed.hb_level = formData.hb_level ? parseFloat(formData.hb_level) : null;
        proposed.systolic_bp = formData.systolic_bp ? parseInt(formData.systolic_bp) : null;
        proposed.diastolic_bp = formData.diastolic_bp ? parseInt(formData.diastolic_bp) : null;
        proposed.fundal_height_cm = formData.fundal_height_cm ? parseFloat(formData.fundal_height_cm) : null;
        proposed.kspr_answers = formData.kspr_answers || [];
      } else if (formData.phase === "BAYI_BARU_LAHIR") {
        proposed.birth_weight_gram = formData.birth_weight_gram ? parseFloat(formData.birth_weight_gram) : null;
        proposed.birth_length_cm = formData.birth_length_cm ? parseFloat(formData.birth_length_cm) : null;
        proposed.head_circumference_cm = formData.head_circumference_cm ? parseFloat(formData.head_circumference_cm) : null;
        proposed.gestational_age_at_birth_weeks = formData.gestational_age_at_birth_weeks ? parseInt(formData.gestational_age_at_birth_weeks) : null;
        proposed.early_initiation_breastfeeding = formData.early_initiation_breastfeeding;
      } else if (formData.phase === "BADUTA") {
        proposed.age_in_months = formData.age_in_months ? parseInt(formData.age_in_months) : null;
        proposed.child_weight_kg = formData.child_weight_kg ? parseFloat(formData.child_weight_kg) : null;
        proposed.child_length_cm = formData.child_length_cm ? parseFloat(formData.child_length_cm) : null;
        proposed.child_head_circumference_cm = formData.child_head_circumference_cm ? parseFloat(formData.child_head_circumference_cm) : null;
        proposed.weight_trend_kms = formData.weight_trend_kms;
        proposed.feeding_status = formData.feeding_status;
        proposed.vitamin_a = formData.vitamin_a;
        proposed.immunization_status = formData.immunization_status;
        proposed.clinical_notes = formData.clinical_notes;
      }
    }

    try {
      setSubmitting(true);
      setError("");
      await api.post("/revisions/", {
        visit_id: visitId,
        reason: reason.trim(),
        proposed_data: proposed,
      });
      alert(
        requestType === "DELETE"
          ? "Permohonan penghapusan rekam kunjungan berhasil dikirim! Menunggu validasi Administrator Puskesmas."
          : "Pengajuan revisi data kunjungan berhasil dikirim! Menunggu validasi Administrator Puskesmas."
      );
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, "Gagal mengirim pengajuan revisi."));
    } finally {
      setSubmitting(false);
    }
  };


  if (!isOpen) return null;

  const inputClass =
    "w-full px-3.5 py-2.5 bg-subtle border border-line rounded-xl text-sm text-heading placeholder:text-dim focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500 focus:bg-card transition-all";

  return (
    <div
      className="fixed inset-0 bg-overlay flex items-center justify-center p-4 z-50 overflow-y-auto animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="revision-modal-title"
    >
      <div
        ref={modalRef}
        className="bg-card w-full max-w-2xl rounded-2xl border border-line shadow-prominent overflow-hidden my-8 max-h-[90vh] flex flex-col animate-slide-up"
      >
        {/* Header */}
        <div className="p-5 border-b border-line bg-subtle flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
              <FileEdit className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h2 id="revision-modal-title" className="text-base font-bold text-heading">
                Ajukan Revisi Data Kunjungan
              </h2>
              <p className="text-xs text-caption">
                {patientInfo?.name ? `${patientInfo.name} (${patientInfo.nik})` : `Kunjungan ID #${visitId}`} &bull; Fase:{" "}
                <span className="font-semibold text-body">{formData.phase || patientInfo?.phase || "Fase KIA"}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-dim hover:text-heading hover:bg-muted rounded-xl transition-colors cursor-pointer"
            aria-label="Tutup modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {loading ? (
            <div className="py-16 text-center space-y-3">
              <RefreshCw className="w-8 h-8 animate-spin text-sky-600 mx-auto" />
              <p className="text-sm text-caption">Memuat data kunjungan lama...</p>
            </div>
          ) : error && !formData.phase ? (
            <div className="p-4 bg-accent-red border border-red-300 rounded-xl text-sm text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : (
            <form id="revision-form" onSubmit={handleSubmit} className="space-y-5">
              {/* Request Type Toggle (Bab 4 Tabel 16) */}
              <div className="flex p-1 bg-subtle border border-line rounded-xl">
                <button
                  type="button"
                  onClick={() => setRequestType("MODIFY")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    requestType === "MODIFY"
                      ? "bg-card text-heading shadow-xs border border-line"
                      : "text-caption hover:text-heading"
                  }`}
                >
                  <FileEdit className="w-3.5 h-3.5 text-amber-600" />
                  <span>Koreksi Nilai Data</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRequestType("DELETE")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    requestType === "DELETE"
                      ? "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 shadow-xs border border-rose-300 dark:border-rose-800"
                      : "text-caption hover:text-rose-600"
                  }`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Pengajuan Hapus Kunjungan</span>
                </button>
              </div>

              {/* Note / Alert Info */}
              {requestType === "MODIFY" ? (
                <div className="p-3.5 bg-accent-amber border border-amber-300 dark:border-amber-800/50 rounded-xl text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
                  <Clock className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Prosedur Integritas Rekam Medis (Bab 4 Proposal)</p>
                    <p className="mt-0.5 leading-relaxed">
                      Data kunjungan yang telah tersimpan tidak dapat diubah langsung. Usulan perubahan Anda akan ditinjau oleh <strong>Admin Puskesmas</strong>. Jika disetujui, sistem AI akan otomatis mengevaluasi ulang laporan klinis.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 rounded-xl text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                  <div>
                    <p className="font-bold">Peringatan Penghapusan Rekam Medis (Use Case 8)</p>
                    <p className="mt-0.5 leading-relaxed">
                      Anda mengajukan agar rekam kunjungan tanggal <strong>{formData.visit_date}</strong> milik pasien <strong>{patientInfo?.name || "ini"}</strong> dihapus. Pengajuan ini wajib disetujui Administrator Puskesmas. Mohon jelaskan alasan (misal: data duplikat atau salah pasien).
                    </p>
                  </div>
                </div>
              )}

              {error && (
                <div className="p-3.5 bg-accent-red border border-red-300 rounded-xl text-xs text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {requestType === "MODIFY" && (
                <>
                  {/* Tanggal Kunjungan */}
                  <div>
                    <label className="block text-xs font-semibold text-label mb-1">
                      Tanggal Kunjungan Posyandu
                    </label>
                    <input
                      type="date"
                      value={formData.visit_date || ""}
                      onChange={(e) => handleChange("visit_date", e.target.value)}
                      className={inputClass}
                      required
                    />
                  </div>


              {/* Form Sesuai Fase: IBU_HAMIL */}
              {formData.phase === "IBU_HAMIL" && (
                <div className="space-y-4 pt-2 border-t border-line-light">
                  <h3 className="text-xs font-bold text-heading uppercase tracking-wider text-pink-700 dark:text-pink-300">
                    Parameter Pemeriksaan Ibu Hamil
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-xs font-semibold text-label mb-1">Trimester</label>
                      <select
                        value={formData.trimester}
                        onChange={(e) => handleChange("trimester", e.target.value)}
                        className={inputClass}
                      >
                        <option value={1}>Trimester 1 (1-12 Minggu)</option>
                        <option value={2}>Trimester 2 (13-27 Minggu)</option>
                        <option value={3}>Trimester 3 (28-40 Minggu)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-label mb-1">Usia Kehamilan (Minggu)</label>
                      <input
                        type="number"
                        min="1"
                        max="45"
                        value={formData.gestational_age_weeks}
                        onChange={(e) => handleChange("gestational_age_weeks", e.target.value)}
                        className={inputClass}
                        placeholder="Contoh: 16"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-label mb-1">Berat Badan Ibu (kg)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={formData.maternal_weight_kg}
                        onChange={(e) => handleChange("maternal_weight_kg", e.target.value)}
                        className={inputClass}
                        placeholder="Contoh: 54.5"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-label mb-1">Tinggi Badan Ibu (cm)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={formData.maternal_height_cm}
                        onChange={(e) => handleChange("maternal_height_cm", e.target.value)}
                        className={inputClass}
                        placeholder="Contoh: 155.0"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-label mb-1">LiLA (cm)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={formData.lila_cm}
                        onChange={(e) => handleChange("lila_cm", e.target.value)}
                        className={inputClass}
                        placeholder="Batas KEK: 23.5 cm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-label mb-1">Hemoglobin / Hb (g/dL)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={formData.hb_level}
                        onChange={(e) => handleChange("hb_level", e.target.value)}
                        className={inputClass}
                        placeholder="Contoh: 11.2"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-label mb-1">Tensi Sistolik (mmHg)</label>
                      <input
                        type="number"
                        value={formData.systolic_bp}
                        onChange={(e) => handleChange("systolic_bp", e.target.value)}
                        className={inputClass}
                        placeholder="Contoh: 120"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-label mb-1">Tensi Diastolik (mmHg)</label>
                      <input
                        type="number"
                        value={formData.diastolic_bp}
                        onChange={(e) => handleChange("diastolic_bp", e.target.value)}
                        className={inputClass}
                        placeholder="Contoh: 80"
                      />
                    </div>
                  </div>

                  {/* KSPR Checkbox */}
                  <div className="pt-2">
                    <label className="block text-xs font-semibold text-label mb-2">
                      Faktor Risiko KSPR (Poedji Rochjati)
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 bg-subtle rounded-xl border border-line max-h-44 overflow-y-auto">
                      {KSPR_OPTIONS.map((opt) => (
                        <label
                          key={opt.key}
                          className="flex items-start gap-2 text-xs text-body hover:text-heading cursor-pointer p-1 rounded hover:bg-card"
                        >
                          <input
                            type="checkbox"
                            checked={(formData.kspr_answers || []).includes(opt.key)}
                            onChange={() => toggleKspr(opt.key)}
                            className="mt-0.5 rounded text-pink-600 focus:ring-pink-500"
                          />
                          <span>{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Form Sesuai Fase: BAYI_BARU_LAHIR */}
              {formData.phase === "BAYI_BARU_LAHIR" && (
                <div className="space-y-4 pt-2 border-t border-line-light">
                  <h3 className="text-xs font-bold text-heading uppercase tracking-wider text-amber-700 dark:text-amber-300">
                    Parameter Pemeriksaan Bayi Baru Lahir (0 - 28 Hari)
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-xs font-semibold text-label mb-1">Berat Lahir (Gram)</label>
                      <input
                        type="number"
                        value={formData.birth_weight_gram}
                        onChange={(e) => handleChange("birth_weight_gram", e.target.value)}
                        className={inputClass}
                        placeholder="Batas BBLR: < 2500 gram"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-label mb-1">Panjang Lahir (cm)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={formData.birth_length_cm}
                        onChange={(e) => handleChange("birth_length_cm", e.target.value)}
                        className={inputClass}
                        placeholder="Contoh: 49.0"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-label mb-1">Lingkar Kepala (cm)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={formData.head_circumference_cm}
                        onChange={(e) => handleChange("head_circumference_cm", e.target.value)}
                        className={inputClass}
                        placeholder="Contoh: 34.0"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-label mb-1">Usia Gestasi Lahir (Minggu)</label>
                      <input
                        type="number"
                        value={formData.gestational_age_at_birth_weeks}
                        onChange={(e) => handleChange("gestational_age_at_birth_weeks", e.target.value)}
                        className={inputClass}
                        placeholder="Prematur jika < 37"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-label mb-1">Inisiasi Menyusu Dini (IMD)</label>
                      <select
                        value={formData.early_initiation_breastfeeding}
                        onChange={(e) => handleChange("early_initiation_breastfeeding", e.target.value)}
                        className={inputClass}
                      >
                        <option value="Ya">Ya (Dilakukan)</option>
                        <option value="Tidak">Tidak</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Form Sesuai Fase: BADUTA */}
              {formData.phase === "BADUTA" && (
                <div className="space-y-4 pt-2 border-t border-line-light">
                  <h3 className="text-xs font-bold text-heading uppercase tracking-wider text-sky-700 dark:text-sky-300">
                    Parameter Pemeriksaan Baduta (6 - 24 Bulan)
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-xs font-semibold text-label mb-1">Usia Anak (Bulan)</label>
                      <input
                        type="number"
                        min="0"
                        max="60"
                        value={formData.age_in_months}
                        onChange={(e) => handleChange("age_in_months", e.target.value)}
                        className={inputClass}
                        placeholder="Contoh: 14"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-label mb-1">Berat Badan Anak (kg)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.child_weight_kg}
                        onChange={(e) => handleChange("child_weight_kg", e.target.value)}
                        className={inputClass}
                        placeholder="Contoh: 9.2"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-label mb-1">Panjang / Tinggi Badan (cm)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={formData.child_length_cm}
                        onChange={(e) => handleChange("child_length_cm", e.target.value)}
                        className={inputClass}
                        placeholder="Contoh: 76.5"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-label mb-1">Lingkar Kepala (cm)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={formData.child_head_circumference_cm}
                        onChange={(e) => handleChange("child_head_circumference_cm", e.target.value)}
                        className={inputClass}
                        placeholder="Contoh: 46.0"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-label mb-1">Tren Berat Badan (KMS)</label>
                      <select
                        value={formData.weight_trend_kms}
                        onChange={(e) => handleChange("weight_trend_kms", e.target.value)}
                        className={inputClass}
                      >
                        <option value="NAIK">Naik (N) Mengikuti Pita</option>
                        <option value="TIDAK_NAIK">Tidak Naik (T) / Mendatar</option>
                        <option value="BARU">Baru Pertama Kali Timbang</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-label mb-1">Status Pemberian Makan</label>
                      <select
                        value={formData.feeding_status}
                        onChange={(e) => handleChange("feeding_status", e.target.value)}
                        className={inputClass}
                      >
                        <option value="MP_ASI">MP-ASI + ASI</option>
                        <option value="ASI_EKSKLUSIF">ASI Eksklusif</option>
                        <option value="SUSU_FORMULA">Susu Formula / Pengganti</option>
                        <option value="MAKANAN_KELUARGA">Makanan Keluarga Penuh</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-label mb-1">Kapsul Vitamin A</label>
                      <select
                        value={formData.vitamin_a}
                        onChange={(e) => handleChange("vitamin_a", e.target.value)}
                        className={inputClass}
                      >
                        <option value="Ya">Sudah Diberikan</option>
                        <option value="Tidak">Belum Diberikan</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-label mb-1">Imunisasi Terakhir</label>
                      <input
                        type="text"
                        value={formData.immunization_status}
                        onChange={(e) => handleChange("immunization_status", e.target.value)}
                        className={inputClass}
                        placeholder="Contoh: DPT-HB-Hib 3"
                      />
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

              {/* Alasan Pengajuan Revisi (Required) */}
              <div className="pt-2 border-t border-line-light">
                <label className="block text-xs font-bold text-label mb-1">
                  Alasan Pengajuan Revisi <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Contoh: Salah input berat badan saat penimbangan di meja 2 (seharusnya 8.5 kg, tertulis 5.8 kg)..."
                  className={inputClass}
                  required
                />
                <p className="text-xs text-caption mt-1">
                  Catatan ini akan ditelaah oleh Administrator Puskesmas sebelum usulan perubahan diterapkan ke basis data resmi.
                </p>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-line bg-subtle flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 border border-line rounded-xl text-xs font-semibold text-label hover:bg-muted transition-colors cursor-pointer"
          >
            Batal
          </button>
          <button
            type="submit"
            form="revision-form"
            disabled={submitting || loading || !formData.phase}
            className={`btn-interactive flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white shadow-sm transition-all cursor-pointer disabled:opacity-50 ${
              requestType === "DELETE"
                ? "bg-rose-600 hover:bg-rose-700 active:bg-rose-800"
                : "bg-amber-600 hover:bg-amber-700 active:bg-amber-800"
            }`}
          >
            {submitting ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Mengirim...</span>
              </>
            ) : requestType === "DELETE" ? (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                <span>Kirim Permohonan Hapus</span>
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                <span>Kirim Pengajuan Revisi</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RevisionRequestModal;
