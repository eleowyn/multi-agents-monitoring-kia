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
  const f1Visits = isChild ? maternalVisits : maternalVisits;
  const f3Visits = isChild ? childVisits : [];

  const getVisitRiskTone = (v) => {
    // Cek risiko stunting / KEK / anemia / BBLR
    if (v.z_score_pbu !== null && v.z_score_pbu < -2.0) return "bg-rose-500 border-rose-600 text-white";
    if (v.lila_cm !== null && v.lila_cm < 23.5) return "bg-rose-500 border-rose-600 text-white";
    if (v.hb_level !== null && v.hb_level < 11.0) return "bg-amber-500 border-amber-600 text-white";
    if (v.weight_trend_kms === "T" || v.weight_trend_kms === "BGM") return "bg-rose-500 border-rose-600 text-white";
    if (v.birth_weight_gram !== null && v.birth_weight_gram < 2500) return "bg-rose-500 border-rose-600 text-white";
    return "bg-emerald-500 border-emerald-600 text-white";
  };

  const handleDotClick = (v, phaseName) => {
    setActiveVisitModal({ ...v, phaseName });
    onSelectVisit(v);
  };

  return (
    <div className="bg-card rounded-2xl border border-line shadow-card p-5 sm:p-6 space-y-6">
      {/* ─── Header Stepper ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-line-light">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold uppercase tracking-wider text-caption flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-sky-500" />
              Kontinuitas Garis Waktu 1.000 HPK
            </span>
            {isGraduated ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300">
                <GraduationCap className="w-3.5 h-3.5" />
                Lulus Periode Emas
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-300">
                <Clock className="w-3.5 h-3.5" />
                Hari ke-{currentHpkDay} ({progressPercent}%)
              </span>
            )}
          </div>
          <h3 className="text-base sm:text-lg font-bold text-heading">
            {patient?.name || "Pasien KIA"} &bull; {isChild ? "Pemantauan Tumbuh Kembang Baduta" : "Pemantauan Kehamilan Ibu"}
          </h3>
        </div>

        {/* Legend Warna Titik Kunjungan */}
        <div className="flex items-center gap-3 text-xs text-caption self-start sm:self-auto">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
            Normal / Baik
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
            Berisiko (Stunting/KEK/2T)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-500 animate-pulse inline-block" />
            Posisi Saat Ini
          </span>
        </div>
      </div>

      {/* ─── 3 Blok Segmentasi 1.000 HPK ─── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Blok Fase 1: Kehamilan */}
        <div className={`p-3.5 rounded-xl border transition-all ${currentHpkDay <= 270 ? "bg-pink-50/70 dark:bg-pink-950/20 border-pink-300 dark:border-pink-800" : "bg-card border-line"}`}>
          <div className="flex items-center justify-between text-xs font-bold text-heading mb-1">
            <span className="flex items-center gap-1.5 text-pink-700 dark:text-pink-300">
              <Heart className="w-4 h-4 text-pink-500" />
              Fase 1: Kehamilan (270 Hari)
            </span>
            <span className="text-xs text-caption">Trimester 1–3</span>
          </div>
          <p className="text-xs text-caption leading-relaxed">
            {isChild && maternalSummary?.mother_name ? (
              <span>Ibu: <strong>{maternalSummary.mother_name}</strong> {maternalSummary.is_kek ? "(Riwayat KEK)" : "(Gizi Normal)"}</span>
            ) : (
              "Pemantauan LiLA, Hb, Tensi & KSPR Kemenkes"
            )}
          </p>
          <div className="mt-2 text-xs font-semibold text-label">
            {f1Visits.length} Kunjungan Tercatat
          </div>
        </div>

        {/* Blok Fase 2: Neonatus */}
        <div className={`p-3.5 rounded-xl border transition-all ${currentHpkDay > 270 && currentHpkDay <= 298 ? "bg-amber-50/70 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800" : "bg-card border-line"}`}>
          <div className="flex items-center justify-between text-xs font-bold text-heading mb-1">
            <span className="flex items-center gap-1.5 text-amber-700 dark:text-amber-300">
              <Baby className="w-4 h-4 text-amber-500" />
              Fase 2: Neonatus (28 Hari)
            </span>
            <span className="text-xs text-caption">0–28 Hari</span>
          </div>
          <p className="text-xs text-caption leading-relaxed">
            {isChild && maternalSummary?.birth_weight_gram ? (
              <span>Lahir: <strong>{maternalSummary.birth_weight_gram} g</strong> {maternalSummary.birth_weight_gram < 2500 ? "(BBLR)" : "(Normal)"} &bull; IMD</span>
            ) : (
              "Kunjungan KN1–KN3, IMD & Pencegahan Hipotermia"
            )}
          </p>
          <div className="mt-2 text-xs font-semibold text-label">
            {isChild ? "Status Kelahiran Tervalidasi" : "Persiapan Kelahiran & IMD"}
          </div>
        </div>

        {/* Blok Fase 3: Baduta */}
        <div className={`p-3.5 rounded-xl border transition-all ${currentHpkDay > 298 ? "bg-sky-50/70 dark:bg-sky-950/20 border-sky-300 dark:border-sky-800" : "bg-card border-line"}`}>
          <div className="flex items-center justify-between text-xs font-bold text-heading mb-1">
            <span className="flex items-center gap-1.5 text-sky-700 dark:text-sky-300">
              <Sparkles className="w-4 h-4 text-sky-500" />
              Fase 3: Baduta (702 Hari)
            </span>
            <span className="text-xs text-caption">Usia 1–24 Bulan</span>
          </div>
          <p className="text-xs text-caption leading-relaxed">
            Penimbangan bulanan posyandu, ASI Eksklusif (0–6 bln), MP-ASI lokal Minut, Z-Score WHO PB/U.
          </p>
          <div className="mt-2 text-xs font-semibold text-label">
            {f3Visits.length} Kunjungan Posyandu
          </div>
        </div>
      </div>

      {/* ─── Timeline Bar Interaktif ─── */}
      <div className="pt-4 pb-2">
        <div className="relative">
          {/* Batang Background Utama */}
          <div className="w-full h-3 bg-muted/70 rounded-full overflow-hidden flex">
            <div className="w-[27%] bg-pink-200 dark:bg-pink-900/40 border-r border-white/50" title="Fase 1: Kehamilan (270 Hari)" />
            <div className="w-[3%] bg-amber-200 dark:bg-amber-900/40 border-r border-white/50" title="Fase 2: Neonatus (28 Hari)" />
            <div className="w-[70%] bg-sky-200 dark:bg-sky-900/40" title="Fase 3: Baduta (702 Hari)" />
          </div>

          {/* Bar Progress Pengisian Real-time */}
          <div
            className="absolute top-0 left-0 h-3 bg-gradient-to-r from-pink-500 via-amber-500 to-sky-600 rounded-full transition-all duration-500 opacity-80"
            style={{ width: `${progressPercent}%` }}
          />

          {/* Pin Posisi Saat Ini */}
          <div
            className="absolute -top-3 transform -translate-x-1/2 flex flex-col items-center cursor-pointer group"
            style={{ left: `${progressPercent}%` }}
          >
            <div className="w-5 h-5 rounded-full bg-white dark:bg-zinc-900 border-2 border-sky-600 shadow-md flex items-center justify-center animate-pulse">
              <span className="w-2 h-2 rounded-full bg-sky-600" />
            </div>
            <div className="mt-1 px-2 py-0.5 rounded-md text-xs font-bold bg-sky-600 text-white shadow-xs whitespace-nowrap">
              Hari ke-{currentHpkDay}
            </div>
          </div>

          {/* Pin Kelulusan Hari ke-1000 */}
          <div className="absolute -top-3 right-0 transform translate-x-1/2 flex flex-col items-center">
            <div className={`w-5 h-5 rounded-full border-2 shadow-md flex items-center justify-center ${isGraduated ? "bg-emerald-600 border-emerald-700 text-white" : "bg-card border-line text-caption"}`}>
              <GraduationCap className="w-3 h-3" />
            </div>
            <span className="mt-1 text-xs font-bold text-caption">1.000 HPK</span>
          </div>
        </div>

        {/* Label Batas Milestone Bawah */}
        <div className="flex justify-between text-xs text-caption mt-6 px-1">
          <span>Hari 1 (Konsepsi)</span>
          <span className="text-center">Hari 270 (Lahir)</span>
          <span className="text-center">Hari 298 (Neonatus)</span>
          <span>Hari 1.000 (Usia 24 Bln)</span>
        </div>
      </div>

      {/* ─── Titik Kunjungan Interaktif (Clickable Dots) ─── */}
      <div className="pt-2">
        <p className="text-xs font-semibold text-caption mb-2.5 flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-sky-500" />
          <span>Klik salah satu titik kunjungan di bawah untuk melihat rincian klinis dan status pertumbuhan:</span>
        </p>

        <div className="flex flex-wrap items-center gap-2">
          {/* Kunjungan Fase 1: Kehamilan */}
          {f1Visits.map((v, idx) => (
            <button
              key={`f1-${v.id || idx}`}
              onClick={() => handleDotClick(v, "Fase 1: Kehamilan")}
              className={`btn-interactive px-3 py-1.5 rounded-xl text-xs font-semibold border flex items-center gap-1.5 cursor-pointer shadow-2xs ${getVisitRiskTone(v)}`}
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
              className={`btn-interactive px-3 py-1.5 rounded-xl text-xs font-semibold border flex items-center gap-1.5 cursor-pointer shadow-2xs ${getVisitRiskTone(v)}`}
              title={`Posyandu Usia ${v.age_in_months ?? idx} Bln (${v.visit_date})`}
            >
              <span>{v.age_in_months !== null && v.age_in_months !== undefined ? `${v.age_in_months} Bln` : `K${idx + 1}`}</span>
              {v.weight_trend_kms && (
                <span className={`px-1 py-0.2 rounded text-xs font-bold ${v.weight_trend_kms === "N" ? "bg-white/20 text-white" : "bg-white text-rose-700"}`}>
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

      {/* ─── Modal Popup Detail Kunjungan yang Diklik ─── */}
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
                <span className={`font-bold ${activeVisitModal.z_score_pbu < -2.0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                  {activeVisitModal.z_score_pbu.toFixed(2)} SD ({activeVisitModal.pbu_category || (activeVisitModal.z_score_pbu < -2.0 ? "Stunting" : "Normal")})
                </span>
              </div>
            )}
            {activeVisitModal.lila_cm && (
              <div className="p-2.5 bg-card border border-line rounded-lg">
                <span className="text-xs text-caption block">LiLA Ibu</span>
                <span className={`font-bold ${activeVisitModal.lila_cm < 23.5 ? "text-rose-600" : "text-heading"}`}>
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
                <span className={`font-bold ${activeVisitModal.weight_trend_kms === "N" ? "text-emerald-600" : "text-rose-600"}`}>
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

