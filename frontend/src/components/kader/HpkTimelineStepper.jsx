import React, { useState } from "react";
import {
  Baby,
  Heart,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Sparkles,
  GraduationCap,
  ChevronRight,
  Info,
} from "lucide-react";

/**
 * HpkTimelineStepper: Visual Stepper Horizontal 1.000 HPK
 * Menampilkan perjalanan kontinu pasien dari Kehamilan (Fase 1), Neonatus (Fase 2),
 * hingga Baduta (Fase 3) dan Kelulusan Hari ke-1.000.
 */
const HpkTimelineStepper = ({
  patient,
  hpkStatus,
  childVisits = [],
  maternalVisits = [],
  maternalSummary = null,
  onSelectVisit = () => {},
}) => {
  const [activeVisitModal, setActiveVisitModal] = useState(null);

  const isChild = patient?.patient_type === "CHILD";
  const currentHpkDay = hpkStatus?.hpk_day || (isChild ? 365 : 140);
  const progressPercent = Math.min(100, Math.max(0, hpkStatus?.progress_percent || 0));
  const isGraduated = hpkStatus?.is_graduation_milestone || currentHpkDay >= 1000;

  // Filter dan normalisasi titik kunjungan
  const f1Visits = !isChild ? (maternalVisits.length > 0 ? maternalVisits : (patient?.visits || [])) : maternalVisits;
  const f3Visits = isChild ? childVisits : [];

  const getVisitRiskTone = (v) => {
    // Cek risiko stunting / KEK / anemia / BBLR
    const isHighRisk =
      (v.z_score_pbu !== null && v.z_score_pbu < -2.0) ||
      (v.lila_cm !== null && v.lila_cm < 23.5) ||
      (v.weight_trend_kms === "T" || v.weight_trend_kms === "BGM") ||
      (v.birth_weight_gram !== null && v.birth_weight_gram < 2500);

    const isWarning = v.hb_level !== null && v.hb_level < 11.0;

    if (isHighRisk) {
      return "bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-pink-700 dark:text-pink-300 hover:bg-rose-100";
    }
    if (isWarning) {
      return "bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 hover:bg-amber-100";
    }
    return "bg-card hover:bg-subtle border-line text-heading hover:border-line-hover";
  };

  const handleDotClick = (v, phaseName) => {
    setActiveVisitModal({ ...v, phaseName });
    onSelectVisit(v);
  };

  return (
    <div className="bg-card rounded-xl border border-line shadow-card p-5 sm:p-6 space-y-6">
      {/* Header Stepper */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-line">
        <div>
          <h3 className="text-base sm:text-lg font-bold text-heading">
            Garis Waktu 1.000 Hari Pertama Kehidupan (HPK)
          </h3>
          <p className="text-xs text-caption mt-0.5">
            {isGraduated
              ? "Periode emas 1.000 HPK tuntas (Usia 24 Bulan)"
              : `Posisi saat ini: Hari ke-${currentHpkDay} dari 1.000 Hari (${progressPercent}%)`}
          </p>
        </div>

        {/* Legend Warna Titik Kunjungan */}
        <div className="flex items-center gap-3 text-xs text-caption self-start sm:self-auto">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
            Normal
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
            Perhatian / Risiko
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-500 inline-block" />
            Posisi Saat Ini
          </span>
        </div>
      </div>

      {/* 3 Blok Segmentasi 1.000 HPK: Warna Tematik Kontras & Teks Mudah Dibaca */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Blok Fase 1: Kehamilan */}
        <div className={`p-4 sm:p-5 rounded-xl border transition-all ${
          currentHpkDay <= 270
            ? "bg-pink-50/70 dark:bg-pink-950/40 border-pink-400 dark:border-pink-700 shadow-xs ring-1 ring-pink-400/40"
            : "bg-card border-line hover:border-line-hover"
        }`}>
          <div className="flex items-center justify-between gap-2">
            <h4 className={`text-sm sm:text-base font-bold ${currentHpkDay <= 270 ? "text-pink-700 dark:text-pink-300" : "text-heading"}`}>
              Fase 1: Kehamilan
            </h4>
            <span className={`text-xs font-bold px-2 py-0.5 rounded border shrink-0 ${
              currentHpkDay <= 270
                ? "bg-pink-100 dark:bg-pink-900/60 text-pink-800 dark:text-pink-200 border-pink-300 dark:border-pink-700"
                : "bg-muted text-caption border-line"
            }`}>
              270 Hari
            </span>
          </div>
          <p className="text-sm text-body dark:text-slate-200 leading-relaxed mt-2.5">
            {isChild && maternalSummary?.mother_name ? (
              <span>
                Ibu: <strong className="text-heading font-bold">{maternalSummary.mother_name}</strong>{" "}
                <span className={maternalSummary.is_kek ? "text-red-600 dark:text-red-400 font-semibold" : "text-emerald-600 dark:text-emerald-400 font-semibold"}>
                  {maternalSummary.is_kek ? "(Riwayat KEK)" : "(Gizi Normal)"}
                </span>
              </span>
            ) : (
              "Pemantauan LiLA, Hb, tekanan darah, dan kepatuhan konsumsi tablet tambah darah."
            )}
          </p>
          <div className="mt-3.5 pt-2.5 border-t border-line/60 flex items-center justify-between text-xs sm:text-sm font-semibold text-heading">
            <span>Riwayat ANC</span>
            <span className="font-bold text-sky-600 dark:text-sky-400">{f1Visits.length} Kunjungan</span>
          </div>
        </div>

        {/* Blok Fase 2: Neonatus */}
        <div className={`p-4 sm:p-5 rounded-xl border transition-all ${
          currentHpkDay > 270 && currentHpkDay <= 298
            ? "bg-amber-50/70 dark:bg-amber-950/40 border-amber-400 dark:border-amber-700 shadow-xs ring-1 ring-amber-400/40"
            : "bg-card border-line hover:border-line-hover"
        }`}>
          <div className="flex items-center justify-between gap-2">
            <h4 className={`text-sm sm:text-base font-bold ${currentHpkDay > 270 && currentHpkDay <= 298 ? "text-amber-800 dark:text-amber-300" : "text-heading"}`}>
              Fase 2: Neonatus
            </h4>
            <span className={`text-xs font-bold px-2 py-0.5 rounded border shrink-0 ${
              currentHpkDay > 270 && currentHpkDay <= 298
                ? "bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-700"
                : "bg-muted text-caption border-line"
            }`}>
              28 Hari
            </span>
          </div>
          <p className="text-sm text-body dark:text-slate-200 leading-relaxed mt-2.5">
            {isChild && maternalSummary?.birth_weight_gram ? (
              <span>
                Lahir: <strong className="text-heading font-bold">{maternalSummary.birth_weight_gram} g</strong>{" "}
                <span className={maternalSummary.birth_weight_gram < 2500 ? "text-red-600 dark:text-red-400 font-semibold" : "text-emerald-600 dark:text-emerald-400 font-semibold"}>
                  {maternalSummary.birth_weight_gram < 2500 ? "(BBLR)" : "(Normal)"}
                </span>{" "}
                • IMD & KN1-KN3
              </span>
            ) : (
              "Kunjungan neonatal KN1-KN3, Inisiasi Menyusu Dini (IMD), dan pencegahan hipotermia."
            )}
          </p>
          <div className="mt-3.5 pt-2.5 border-t border-line/60 flex items-center justify-between text-xs sm:text-sm font-semibold text-heading">
            <span>Status Neonatal</span>
            <span className="font-bold text-amber-700 dark:text-amber-400">
              {isChild ? "Kelahiran Tervalidasi" : "Persiapan Kelahiran"}
            </span>
          </div>
        </div>

        {/* Blok Fase 3: Baduta */}
        <div className={`p-4 sm:p-5 rounded-xl border transition-all ${
          currentHpkDay > 298
            ? "bg-sky-50/70 dark:bg-sky-950/40 border-sky-400 dark:border-sky-700 shadow-xs ring-1 ring-sky-400/40"
            : "bg-card border-line hover:border-line-hover"
        }`}>
          <div className="flex items-center justify-between gap-2">
            <h4 className={`text-sm sm:text-base font-bold ${currentHpkDay > 298 ? "text-sky-700 dark:text-sky-300" : "text-heading"}`}>
              Fase 3: Baduta
            </h4>
            <span className={`text-xs font-bold px-2 py-0.5 rounded border shrink-0 ${
              currentHpkDay > 298
                ? "bg-sky-100 dark:bg-sky-900/60 text-sky-800 dark:text-sky-200 border-sky-300 dark:border-sky-700"
                : "bg-muted text-caption border-line"
            }`}>
              702 Hari (1-24 Bln)
            </span>
          </div>
          <p className="text-sm text-body dark:text-slate-200 leading-relaxed mt-2.5">
            Penimbangan rutin posyandu, ASI Eksklusif 6 bulan, MP-ASI bergizi seimbang, dan pemantauan PB/U.
          </p>
          <div className="mt-3.5 pt-2.5 border-t border-line/60 flex items-center justify-between text-xs sm:text-sm font-semibold text-heading">
            <span>Riwayat Posyandu</span>
            <span className="font-bold text-sky-600 dark:text-sky-400">{f3Visits.length} Kunjungan</span>
          </div>
        </div>
      </div>

      {/* Timeline Bar: Efek Pelangi Kontinu Standar Pertumbuhan 1.000 HPK */}
      <div className="pt-4 pb-2">
        <div className="relative">
          {/* Batang Background Utama dengan Segmen Fase */}
          <div className="w-full h-3 bg-muted rounded-full overflow-hidden flex border border-line/50">
            <div className="w-[27%] bg-pink-500/20 border-r border-line" title="Fase 1: Kehamilan (Hari 1-270)" />
            <div className="w-[3%] bg-amber-500/25 border-r border-line" title="Fase 2: Neonatus (Hari 271-298)" />
            <div className="w-[70%] bg-sky-500/20" title="Fase 3: Baduta (Hari 299-1000)" />
          </div>

          {/* Bar Progress Pengisian Real-time dengan Efek Pelangi (Pink -> Amber -> Sky) */}
          <div
            className="absolute top-0 left-0 h-3 rounded-full transition-all duration-500 bg-gradient-to-r from-pink-500 via-amber-400 to-sky-500 shadow-xs"
            style={{ width: `${progressPercent}%` }}
          />

          {/* Pin Posisi Saat Ini (ditampilkan jika belum mendekati akhir 990 hari untuk cegah tabrakan) */}
          {!isGraduated && currentHpkDay < 990 && (
            <div
              className="absolute -top-2.5 transform -translate-x-1/2 flex flex-col items-center pointer-events-none"
              style={{ left: `${Math.min(94, Math.max(6, progressPercent))}%` }}
            >
              <div className="w-4 h-4 rounded-full bg-card border-2 border-sky-600 shadow-xs flex items-center justify-center">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-600" />
              </div>
              <div className="mt-1 px-2 py-0.5 rounded text-xs font-semibold bg-card border border-line text-heading shadow-xs whitespace-nowrap">
                Hari ke-{currentHpkDay}
              </div>
            </div>
          )}

          {/* Pin Milestone Hari ke-1.000 */}
          <div className="absolute -top-2.5 right-0 transform translate-x-1/2 flex flex-col items-center">
            <div className={`w-4 h-4 rounded-full border-2 shadow-xs flex items-center justify-center ${
              isGraduated ? "bg-emerald-600 border-emerald-600 text-white" : "bg-card border-line text-caption"
            }`}>
              <span className="w-1.5 h-1.5 rounded-full bg-white" />
            </div>
            <span className={`mt-1 text-xs font-semibold whitespace-nowrap ${
              isGraduated ? "text-emerald-600 dark:text-emerald-400" : "text-caption"
            }`}>
              {isGraduated ? "Lulus 1.000 HPK" : "1.000 HPK"}
            </span>
          </div>
        </div>

        {/* Label Batas Milestone Bawah */}
        <div className="flex justify-between text-xs font-semibold text-body dark:text-slate-200 mt-7 px-1">
          <span>Hari 1 (Konsepsi)</span>
          <span className="text-center">Hari 270 (Lahir)</span>
          <span className="text-center">Hari 298 (Neonatus)</span>
          <span>Hari 1.000 (Usia 24 Bln)</span>
        </div>
      </div>

      {/* Titik Kunjungan Interaktif */}
      <div className="pt-2">
        <p className="text-xs font-medium text-caption mb-2">
          Pilih riwayat pemeriksaan untuk melihat rincian klinis:
        </p>

        <div className="flex flex-wrap items-center gap-2">
          {/* Kunjungan Fase 1: Kehamilan */}
          {f1Visits.map((v, idx) => (
            <button
              key={`f1-${v.id || idx}`}
              onClick={() => handleDotClick(v, "Fase 1: Kehamilan")}
              className={`btn-interactive px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 cursor-pointer shadow-xs ${getVisitRiskTone(v)}`}
              title={`Kunjungan Kehamilan Trimester ${v.trimester || "-"} (${v.visit_date})`}
            >
              <span>ANC {v.trimester ? `T${v.trimester}` : `#${idx + 1}`}</span>
              <span className="text-xs opacity-80">({new Date(v.visit_date).toLocaleDateString("id-ID", { month: "short", year: "2-digit" })})</span>
            </button>
          ))}

          {/* Kunjungan Fase 3: Baduta */}
          {f3Visits.map((v, idx) => (
            <button
              key={`f3-${v.id || idx}`}
              onClick={() => handleDotClick(v, "Fase 3: Baduta")}
              className={`btn-interactive px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 cursor-pointer shadow-xs ${getVisitRiskTone(v)}`}
              title={`Posyandu Usia ${v.age_in_months ?? idx} Bln (${v.visit_date})`}
            >
              <span>{v.age_in_months !== null && v.age_in_months !== undefined ? `${v.age_in_months} Bln` : `K${idx + 1}`}</span>
              {v.weight_trend_kms && (
                <span className={`px-1 py-0.2 rounded text-xs font-bold ${v.weight_trend_kms === "N" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                  {v.weight_trend_kms}
                </span>
              )}
            </button>
          ))}

          {f1Visits.length === 0 && f3Visits.length === 0 && (
            <span className="text-xs text-caption italic">Belum ada kunjungan terekam untuk pasien ini.</span>
          )}
        </div>
      </div>

      {/* Modal Popup Detail Kunjungan yang Diklik */}
      {activeVisitModal && (
        <div className="p-4 bg-subtle border border-sky-300 dark:border-sky-800 rounded-xl space-y-3 animate-slide-up">
          <div className="flex items-center justify-between gap-2 border-b border-line-light pb-2">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-sky-600 text-white">
                {activeVisitModal.phaseName}
              </span>
              <h4 className="text-xs sm:text-sm font-bold text-heading">
                Rincian Kunjungan Tanggal {new Date(activeVisitModal.visit_date).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
              </h4>
            </div>
            <button
              onClick={() => setActiveVisitModal(null)}
              className="text-xs text-caption hover:text-heading cursor-pointer px-2 py-0.5"
            >
              Tutup &times;
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
            {activeVisitModal.age_in_months !== undefined && activeVisitModal.age_in_months !== null && (
              <div className="p-2.5 bg-card border border-line rounded-lg">
                <span className="text-xs text-caption block">Usia Baduta</span>
                <span className="font-bold text-heading">{activeVisitModal.age_in_months} Bulan</span>
              </div>
            )}
            {activeVisitModal.child_weight_kg && (
              <div className="p-2.5 bg-card border border-line rounded-lg">
                <span className="text-xs text-caption block">Berat Badan</span>
                <span className="font-bold text-heading">{activeVisitModal.child_weight_kg} kg</span>
              </div>
            )}
            {activeVisitModal.child_length_cm && (
              <div className="p-2.5 bg-card border border-line rounded-lg">
                <span className="text-xs text-caption block">Panjang / Tinggi</span>
                <span className="font-bold text-heading">{activeVisitModal.child_length_cm} cm</span>
              </div>
            )}
            {activeVisitModal.z_score_pbu !== null && activeVisitModal.z_score_pbu !== undefined && (
              <div className="p-2.5 bg-card border border-line rounded-lg">
                <span className="text-xs text-caption block">Z-Score PB/U (Stunting)</span>
                <span className={`font-bold ${activeVisitModal.z_score_pbu < -2.0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                  {activeVisitModal.z_score_pbu.toFixed(2)} SD ({activeVisitModal.pbu_category || (activeVisitModal.z_score_pbu < -2.0 ? "Stunting" : "Normal")})
                </span>
              </div>
            )}
            {activeVisitModal.lila_cm && (
              <div className="p-2.5 bg-card border border-line rounded-lg">
                <span className="text-xs text-caption block">LiLA Ibu</span>
                <span className={`font-bold ${activeVisitModal.lila_cm < 23.5 ? "text-red-600" : "text-heading"}`}>
                  {activeVisitModal.lila_cm} cm {activeVisitModal.lila_cm < 23.5 ? "(KEK)" : ""}
                </span>
              </div>
            )}
            {activeVisitModal.hb_level && (
              <div className="p-2.5 bg-card border border-line rounded-lg">
                <span className="text-xs text-caption block">Hemoglobin</span>
                <span className={`font-bold ${activeVisitModal.hb_level < 11.0 ? "text-amber-600" : "text-heading"}`}>
                  {activeVisitModal.hb_level} g/dL {activeVisitModal.hb_level < 11.0 ? "(Anemia)" : ""}
                </span>
              </div>
            )}
            {activeVisitModal.hpk_day && (
              <div className="p-2.5 bg-card border border-line rounded-lg">
                <span className="text-xs text-caption block">Hari 1.000 HPK</span>
                <span className="font-bold text-sky-700 dark:text-sky-300">Hari ke-{activeVisitModal.hpk_day}</span>
              </div>
            )}
            {activeVisitModal.weight_trend_kms && (
              <div className="p-2.5 bg-card border border-line rounded-lg">
                <span className="text-xs text-caption block">Tren KMS</span>
                <span className={`font-bold ${activeVisitModal.weight_trend_kms === "N" ? "text-emerald-600" : "text-red-600"}`}>
                  {activeVisitModal.weight_trend_kms === "N" ? "Naik (N)" : "Tidak Naik (T)"}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default HpkTimelineStepper;
