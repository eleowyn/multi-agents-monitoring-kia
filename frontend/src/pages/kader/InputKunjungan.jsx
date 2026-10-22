import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api, { getErrorMessage } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import {
  Baby,
  HeartPulse,
  Sparkles,
  Search,
  PlusCircle,
  AlertTriangle,
  Info,
  X,
  Users,
} from "lucide-react";

const KSPR_OPTIONS = [
  {
    key: "muda_hamil_1",
    label: "Terlalu muda, hamil I umur <= 16 tahun (Skor 4)",
  },
  {
    key: "tua_hamil_1",
    label: "Terlalu tua, hamil I umur >= 35 tahun (Skor 4)",
  },
  {
    key: "lambat_hamil_1",
    label: "Terlalu lambat hamil I, kawin >= 4 tahun (Skor 4)",
  },
  { key: "tua_hamil_lanjut", label: "Terlalu tua, umur >= 35 tahun (Skor 4)" },
  {
    key: "cepat_hamil_lagi",
    label: "Terlalu cepat hamil lagi < 2 tahun (Skor 4)",
  },
  { key: "banyak_anak", label: "Terlalu banyak anak, 4 atau lebih (Skor 4)" },
  {
    key: "tinggi_badan_rendah",
    label: "Terlalu pendek, tinggi <= 145 cm (Skor 4)",
  },
  {
    key: "riwayat_keguguran",
    label: "Pernah gagal kehamilan / keguguran (Skor 4)",
  },
  {
    key: "riwayat_operasi_sesar",
    label: "Pernah melahirkan secara sesar / SC (Skor 8)",
  },
  { key: "penyakit_anemia", label: "Kurang darah / Anemia (Skor 4)" },
  {
    key: "preeklampsia_bengkak_tensi",
    label: "Bengkak muka/kaki & Tekanan Darah Tinggi (Skor 4)",
  },
  { key: "hamil_kembar", label: "Hamil Kembar / Gemelli (Skor 4)" },
];

/* ─── Skeleton Card for Patient List ─── */
const PatientSkeleton = () => (
  <div className="p-3.5 rounded-xl border border-line bg-card/50 space-y-2">
    <div className="flex justify-between">
      <div className="skeleton skeleton-text w-32" />
      <div className="skeleton w-10 h-5 rounded-full" />
    </div>
    <div className="skeleton skeleton-text short w-28" />
    <div className="skeleton skeleton-text short w-24" />
  </div>
);

/* ─── Reusable Form Field ─── */
const FormField = ({ id, label, hint, children }) => (
  <div>
    <label
      htmlFor={id}
      className="block text-sm font-semibold text-label mb-1.5"
    >
      {label}
      {hint && (
        <span className="text-red-500 dark:text-red-400 font-bold text-xs ml-1">{hint}</span>
      )}
    </label>
    {children}
  </div>
);

const INPUT_CLASS =
  "w-full px-3.5 py-3 bg-subtle border border-line rounded-xl text-sm text-heading placeholder:text-dim focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500 focus:bg-card transition-all duration-200";

const InputKunjungan = () => {
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [phase, setPhase] = useState("BADUTA");
  const [showNewPatientModal, setShowNewPatientModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [patientsLoading, setPatientsLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const modalRef = useRef(null);
  const { user, isKader } = useAuth();

  // Form State Kunjungan
  const [visitDate, setVisitDate] = useState(
    new Date().toISOString().split("T")[0],
  );

  // Fase Ibu Hamil
  const [trimester, setTrimester] = useState(1);
  const [gestationalAge, setGestationalAge] = useState("");
  const [maternalWeight, setMaternalWeight] = useState("");
  const [maternalHeight, setMaternalHeight] = useState("");
  const [lilaCm, setLilaCm] = useState("");
  const [hbLevel, setHbLevel] = useState("");
  const [systolicBp, setSystolicBp] = useState("");
  const [diastolicBp, setDiastolicBp] = useState("");
  const [ksprAnswers, setKsprAnswers] = useState([]);

  // Fase Bayi Baru Lahir
  const [birthWeight, setBirthWeight] = useState("");
  const [birthLength, setBirthLength] = useState("");
  const [headCircumference, setHeadCircumference] = useState("");
  const [gestationAtBirth, setGestationAtBirth] = useState("");
  const [imd, setImd] = useState("Ya");

  // Fase Baduta
  const [ageInMonths, setAgeInMonths] = useState("");
  const [childWeight, setChildWeight] = useState("");
  const [childLength, setChildLength] = useState("");
  const [childHeadCirc, setChildHeadCirc] = useState("");
  const [weightTrend, setWeightTrend] = useState("NAIK");
  const [feedingStatus, setFeedingStatus] = useState("MP_ASI");
  const [vitaminA, setVitaminA] = useState("Ya");
  const [clinicalNotes, setClinicalNotes] = useState("");

  // New Patient Modal State
  const [newNik, setNewNik] = useState("");
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("CHILD");
  const [newBirthDate, setNewBirthDate] = useState("");
  const [newGender, setNewGender] = useState("L");
  const [newVillage, setNewVillage] = useState(user?.village_name || "Airmadidi Atas");
  const [newMotherId, setNewMotherId] = useState("");

  useEffect(() => {
    if (user?.village_name) {
      setNewVillage(user.village_name);
    }
  }, [user]);

  useEffect(() => {
    fetchPatients();
  }, []);

  const fetchPatients = async () => {
    try {
      setPatientsLoading(true);
      const res = await api.get("/patients/");
      setPatients(res.data);
      if (res.data.length > 0 && !selectedPatient) {
        const firstChild =
          res.data.find((p) => p.patient_type === "CHILD") || res.data[0];
        setSelectedPatient(firstChild);
        setPhase(firstChild.patient_type === "MOTHER" ? "IBU_HAMIL" : "BADUTA");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setPatientsLoading(false);
    }
  };

  const handleSelectPatient = (p) => {
    setSelectedPatient(p);
    if (p.patient_type === "MOTHER") {
      setPhase("IBU_HAMIL");
    } else {
      setPhase("BADUTA");
    }
  };

  const toggleKspr = (key) => {
    if (ksprAnswers.includes(key)) {
      setKsprAnswers(ksprAnswers.filter((k) => k !== key));
    } else {
      setKsprAnswers([...ksprAnswers, key]);
    }
  };

  const handleCreatePatient = async (e) => {
    e.preventDefault();
    if (!newBirthDate) {
      alert("Harap pilih tanggal lahir pasien.");
      return;
    }

    try {
      const payload = {
        nik: newNik.trim(),
        name: newName.trim(),
        patient_type: newType,
        birth_date: newBirthDate,
        gender: newType === "CHILD" ? newGender : null,
        village_name: isKader ? (user?.village_name || newVillage) : newVillage,
        mother_id: newMotherId ? parseInt(newMotherId) : null,
      };
      const res = await api.post("/patients/", payload);
      setPatients([res.data, ...patients]);
      setSelectedPatient(res.data);
      setPhase(res.data.patient_type === "MOTHER" ? "IBU_HAMIL" : "BADUTA");
      setShowNewPatientModal(false);
      setNewNik("");
      setNewName("");
      alert("Pasien baru berhasil didaftarkan!");
    } catch (err) {
      alert(getErrorMessage(err, "Gagal mendaftarkan pasien."));
    }
  };

  const handleSubmitVisit = async (e) => {
    e.preventDefault();
    if (!selectedPatient) {
      alert("Pilih pasien terlebih dahulu dari daftar di sebelah kiri.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const payload = {
        patient_id: selectedPatient.id,
        visit_date: visitDate,
        phase: phase,
        gestational_age_weeks: gestationalAge ? parseInt(gestationalAge) : null,
        trimester: phase === "IBU_HAMIL" ? parseInt(trimester) : null,
        maternal_weight_kg: maternalWeight ? parseFloat(maternalWeight) : null,
        maternal_height_cm: maternalHeight ? parseFloat(maternalHeight) : null,
        lila_cm: lilaCm ? parseFloat(lilaCm) : null,
        hb_level: hbLevel ? parseFloat(hbLevel) : null,
        systolic_bp: systolicBp ? parseInt(systolicBp) : null,
        diastolic_bp: diastolicBp ? parseInt(diastolicBp) : null,
        kspr_answers: ksprAnswers,
        birth_weight_gram: birthWeight ? parseFloat(birthWeight) : null,
        birth_length_cm: birthLength ? parseFloat(birthLength) : null,
        head_circumference_cm: headCircumference
          ? parseFloat(headCircumference)
          : null,
        gestational_age_at_birth_weeks: gestationAtBirth
          ? parseInt(gestationAtBirth)
          : null,
        early_initiation_breastfeeding: imd,
        age_in_months: ageInMonths ? parseInt(ageInMonths) : null,
        child_weight_kg: childWeight ? parseFloat(childWeight) : null,
        child_length_cm: childLength ? parseFloat(childLength) : null,
        child_head_circumference_cm: childHeadCirc
          ? parseFloat(childHeadCirc)
          : null,
        weight_trend_kms: weightTrend,
        feeding_status: feedingStatus,
        vitamin_a: vitaminA,
        clinical_notes: clinicalNotes,
      };

      const res = await api.post("/visits/", payload);
      navigate(`/kader/validasi-laporan/${res.data.id}`);
    } catch (err) {
      setError(getErrorMessage(err, "Gagal memproses analisis kunjungan."));
    } finally {
      setLoading(false);
    }
  };

  // Modal escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape" && showNewPatientModal) {
        setShowNewPatientModal(false);
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [showNewPatientModal]);

  // Focus modal on open
  useEffect(() => {
    if (showNewPatientModal && modalRef.current) {
      modalRef.current.focus();
    }
  }, [showNewPatientModal]);

  const filteredPatients = patients.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.nik.includes(searchQuery),
  );

  const phaseTabs = [
    {
      value: "IBU_HAMIL",
      label: "1. Fase Ibu Hamil",
      icon: HeartPulse,
      activeClass: "bg-pink-600 text-white shadow-sm border-pink-600",
    },
    {
      value: "BAYI_BARU_LAHIR",
      label: "2. Bayi Baru Lahir",
      shortLabel: "2. BBL (0-28 Hari)",
      icon: Baby,
      activeClass: "bg-amber-600 text-white shadow-sm border-amber-600",
    },
    {
      value: "BADUTA",
      label: "3. Fase Baduta (6-24 Bln)",
      shortLabel: "3. Baduta",
      icon: Baby,
      activeClass: "bg-sky-600 text-white shadow-sm border-sky-600",
    },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-5 animate-fade-in">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-line-light">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-heading">
            Formulir Kunjungan Posyandu
          </h2>
          <p className="text-sm text-caption mt-1">
            Pencatatan data antropometri & deteksi risiko 1.000 HPK berbasis
            Multi-Agent AI
          </p>
        </div>
        <button
          onClick={() => setShowNewPatientModal(true)}
          aria-label="Registrasi pasien baru"
          className="flex items-center gap-2 px-4 py-3 bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white rounded-xl text-sm font-semibold shadow-sm hover:shadow-md transition-all duration-200"
        >
          <PlusCircle className="w-4 h-4" aria-hidden="true" />
          Registrasi Pasien Baru
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div
          role="alert"
          aria-live="polite"
          className="p-4 bg-accent-red border border-red-300 dark:border-red-800/50 rounded-xl text-sm text-red-700 dark:text-red-300 flex items-start gap-2.5 animate-slide-up"
        >
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-500 dark:text-red-400" aria-hidden="true" />
          <span className="flex-1">{error}</span>
          <button
            onClick={() => setError("")}
            aria-label="Tutup pesan error"
            className="p-1 text-red-400 hover:text-red-600 dark:hover:text-red-200 rounded transition-colors"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        {/* ═══ Left Col: Pilih Pasien ═══ */}
        <div className="bg-card p-5 rounded-2xl border border-line shadow-card space-y-4">
          <h3 className="text-sm font-bold text-heading flex items-center gap-2">
            <Search className="w-4 h-4 text-sky-600 dark:text-sky-400" aria-hidden="true" />
            Pilih Pasien Posyandu
          </h3>

          <div className="relative" role="search">
            <input
              type="text"
              placeholder="Cari nama / NIK..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Cari pasien berdasarkan nama atau NIK"
              className="w-full pl-10 pr-3 py-3 bg-subtle border border-line rounded-xl text-sm text-heading placeholder:text-dim focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500 focus:bg-card transition-all duration-200"
            />
            <Search
              className="w-4 h-4 text-dim absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
          </div>

          <div className="max-h-96 overflow-y-auto space-y-2 pr-1">
            {patientsLoading ? (
              [...Array(4)].map((_, i) => <PatientSkeleton key={i} />)
            ) : filteredPatients.length === 0 ? (
              <div className="text-center py-8 px-2">
                <Users
                  className="w-8 h-8 text-dim mx-auto mb-2"
                  aria-hidden="true"
                />
                <p className="text-xs text-caption font-medium">
                  {searchQuery
                    ? "Tidak ada pasien yang cocok"
                    : "Belum ada pasien terdaftar"}
                </p>
                <p className="text-xs text-dim mt-1">
                  {searchQuery
                    ? "Coba ubah kata kunci"
                    : "Klik tombol Registrasi Pasien Baru di atas"}
                </p>
              </div>
            ) : (
              filteredPatients.map((p) => {
                const isSelected = selectedPatient?.id === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelectPatient(p)}
                    aria-pressed={isSelected}
                    aria-label={`Pilih pasien ${p.name}`}
                    className={`w-full text-left p-3.5 rounded-xl border text-sm transition-all duration-200 ${
                      isSelected
                        ? "border-sky-500 bg-accent-sky text-sky-900 dark:text-sky-200 shadow-sm"
                        : "border-line hover:border-sky-300 dark:hover:border-sky-700 hover:bg-muted/50 text-body"
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <p
                        className={`font-semibold ${isSelected ? "text-sky-800 dark:text-sky-300" : "text-heading"}`}
                      >
                        {p.name}
                      </p>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                          p.patient_type === "MOTHER"
                            ? "bg-accent-pink text-pink-700 dark:text-pink-300 border border-pink-200 dark:border-pink-800/50"
                            : "bg-accent-blue text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50"
                        }`}
                      >
                        {p.patient_type === "MOTHER" ? "Ibu" : "Anak"}
                      </span>
                    </div>
                    <p className="text-xs text-caption mt-1">
                      NIK: {p.nik}
                    </p>
                    <p className="text-xs text-dim">
                      Desa: {p.village_name || "Airmadidi"}
                    </p>
                  </button>
                );
              })
            )}
          </div>

          {selectedPatient && (
            <div className="p-3.5 bg-accent-sky border border-sky-200 dark:border-sky-800/50 rounded-xl text-xs text-body">
              <p className="font-semibold text-caption">Pasien Terpilih:</p>
              <p className="text-sky-700 dark:text-sky-300 font-bold text-sm mt-0.5">
                {selectedPatient.name}
              </p>
              <p className="text-xs text-caption mt-0.5">
                Tgl Lahir: {selectedPatient.birth_date}
              </p>
            </div>
          )}
        </div>

        {/* ═══ Right Col: Tab Input 3 Fase ═══ */}
        <div className="lg:col-span-3 bg-card p-5 sm:p-6 rounded-2xl border border-line shadow-card space-y-5">
          {/* Phase Selector Tabs */}
          <div
            className="flex overflow-x-auto gap-2 pb-3 border-b border-line -mx-1 px-1 scrollbar-none"
            role="tablist"
            aria-label="Pilih fase kunjungan"
          >
            {phaseTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = phase === tab.value;
              return (
                <button
                  key={tab.value}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={`panel-${tab.value}`}
                  onClick={() => setPhase(tab.value)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 whitespace-nowrap flex-shrink-0 border ${
                    isActive
                      ? tab.activeClass
                      : "bg-muted border-line text-caption hover:text-heading hover:bg-subtle"
                  }`}
                >
                  <Icon className="w-4 h-4" aria-hidden="true" />
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="sm:hidden">
                    {tab.shortLabel || tab.label}
                  </span>
                </button>
              );
            })}
          </div>

          <form onSubmit={handleSubmitVisit} className="space-y-5">
            {/* Visit Date */}
            <FormField id="visit-date" label="Tanggal Kunjungan Posyandu">
              <input
                id="visit-date"
                type="date"
                required
                value={visitDate}
                onChange={(e) => setVisitDate(e.target.value)}
                className={`${INPUT_CLASS} sm:w-1/2`}
              />
            </FormField>

            {/* ═══ TAB 1: IBU HAMIL ═══ */}
            {phase === "IBU_HAMIL" && (
              <div
                id="panel-IBU_HAMIL"
                role="tabpanel"
                className="space-y-5 animate-slide-up"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField id="trimester" label="Trimester Kehamilan">
                    <select
                      id="trimester"
                      value={trimester}
                      onChange={(e) => setTrimester(e.target.value)}
                      className={INPUT_CLASS}
                    >
                      <option value={1}>Trimester 1 (1 - 12 Minggu)</option>
                      <option value={2}>Trimester 2 (13 - 27 Minggu)</option>
                      <option value={3}>Trimester 3 (28 - 40 Minggu)</option>
                    </select>
                  </FormField>
                  <FormField id="gest-age" label="Usia Kehamilan (Minggu)">
                    <input
                      id="gest-age"
                      type="number"
                      placeholder="Contoh: 16"
                      value={gestationalAge}
                      onChange={(e) => setGestationalAge(e.target.value)}
                      className={INPUT_CLASS}
                    />
                  </FormField>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <FormField
                    id="lila"
                    label="LiLA (cm)"
                    hint="*KEK jika < 23.5"
                  >
                    <input
                      id="lila"
                      type="number"
                      step="0.1"
                      placeholder="Contoh: 22.5"
                      value={lilaCm}
                      onChange={(e) => setLilaCm(e.target.value)}
                      className={INPUT_CLASS}
                    />
                  </FormField>
                  <FormField id="hb" label="Kadar Hb (g/dL)">
                    <input
                      id="hb"
                      type="number"
                      step="0.1"
                      placeholder="Contoh: 10.2"
                      value={hbLevel}
                      onChange={(e) => setHbLevel(e.target.value)}
                      className={INPUT_CLASS}
                    />
                  </FormField>
                  <FormField id="maternal-weight" label="Berat Badan Ibu (kg)">
                    <input
                      id="maternal-weight"
                      type="number"
                      step="0.1"
                      placeholder="Contoh: 54.0"
                      value={maternalWeight}
                      onChange={(e) => setMaternalWeight(e.target.value)}
                      className={INPUT_CLASS}
                    />
                  </FormField>
                </div>

                {/* KSPR Screening */}
                <div className="p-4 bg-subtle rounded-xl border border-line space-y-3">
                  <p className="text-sm font-bold text-heading flex items-center gap-2">
                    <Info className="w-4 h-4 text-sky-600 dark:text-sky-400" aria-hidden="true" />
                    Skrining Faktor Risiko KSPR (Poedji Rochjati)
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {KSPR_OPTIONS.map((opt) => (
                      <label
                        key={opt.key}
                        className="flex items-start gap-3 cursor-pointer p-2 rounded-lg hover:bg-card transition-colors duration-150"
                      >
                        <input
                          type="checkbox"
                          checked={ksprAnswers.includes(opt.key)}
                          onChange={() => toggleKspr(opt.key)}
                          className="mt-0.5 w-4 h-4 rounded text-sky-600 bg-card border-line focus:ring-sky-500 cursor-pointer flex-shrink-0"
                        />
                        <span className="text-xs text-body leading-relaxed">
                          {opt.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ═══ TAB 2: BAYI BARU LAHIR ═══ */}
            {phase === "BAYI_BARU_LAHIR" && (
              <div
                id="panel-BAYI_BARU_LAHIR"
                role="tabpanel"
                className="space-y-5 animate-slide-up"
              >
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <FormField
                    id="birth-weight"
                    label="Berat Lahir (Gram)"
                    hint="*BBLR < 2500g"
                  >
                    <input
                      id="birth-weight"
                      type="number"
                      placeholder="Contoh: 2300"
                      value={birthWeight}
                      onChange={(e) => setBirthWeight(e.target.value)}
                      className={INPUT_CLASS}
                    />
                  </FormField>
                  <FormField id="birth-length" label="Panjang Lahir (cm)">
                    <input
                      id="birth-length"
                      type="number"
                      step="0.1"
                      placeholder="Contoh: 48.0"
                      value={birthLength}
                      onChange={(e) => setBirthLength(e.target.value)}
                      className={INPUT_CLASS}
                    />
                  </FormField>
                  <FormField
                    id="gest-birth"
                    label="Usia Gestasi Lahir (Minggu)"
                  >
                    <input
                      id="gest-birth"
                      type="number"
                      placeholder="Contoh: 36"
                      value={gestationAtBirth}
                      onChange={(e) => setGestationAtBirth(e.target.value)}
                      className={INPUT_CLASS}
                    />
                  </FormField>
                </div>

                <FormField id="imd" label="Inisiasi Menyusu Dini (IMD)">
                  <select
                    id="imd"
                    value={imd}
                    onChange={(e) => setImd(e.target.value)}
                    className={`${INPUT_CLASS} sm:w-1/2`}
                  >
                    <option value="Ya">Ya (Dilakukan)</option>
                    <option value="Tidak">Tidak</option>
                  </select>
                </FormField>
              </div>
            )}

            {/* ═══ TAB 3: BADUTA ═══ */}
            {phase === "BADUTA" && (
              <div
                id="panel-BADUTA"
                role="tabpanel"
                className="space-y-5 animate-slide-up"
              >
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <FormField id="age-months" label="Usia Anak (Bulan)">
                    <input
                      id="age-months"
                      type="number"
                      min="0"
                      max="24"
                      required
                      placeholder="Contoh: 12"
                      value={ageInMonths}
                      onChange={(e) => setAgeInMonths(e.target.value)}
                      className={INPUT_CLASS}
                    />
                  </FormField>
                  <FormField
                    id="child-length"
                    label="Panjang/Tinggi Badan (cm)"
                  >
                    <input
                      id="child-length"
                      type="number"
                      step="0.1"
                      required
                      placeholder="Contoh: 70.5"
                      value={childLength}
                      onChange={(e) => setChildLength(e.target.value)}
                      className={INPUT_CLASS}
                    />
                  </FormField>
                  <FormField id="child-weight" label="Berat Badan (kg)">
                    <input
                      id="child-weight"
                      type="number"
                      step="0.05"
                      required
                      placeholder="Contoh: 8.2"
                      value={childWeight}
                      onChange={(e) => setChildWeight(e.target.value)}
                      className={INPUT_CLASS}
                    />
                  </FormField>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <FormField id="weight-trend" label="Tren Garis KMS">
                    <select
                      id="weight-trend"
                      value={weightTrend}
                      onChange={(e) => setWeightTrend(e.target.value)}
                      className={INPUT_CLASS}
                    >
                      <option value="NAIK">N (Naik)</option>
                      <option value="TIDAK_NAIK">
                        T (Tidak Naik / Turun)
                      </option>
                      <option value="BARU">B (Baru Pertama Kali)</option>
                    </select>
                  </FormField>
                  <FormField id="feeding" label="Pola Makan / Gizi">
                    <select
                      id="feeding"
                      value={feedingStatus}
                      onChange={(e) => setFeedingStatus(e.target.value)}
                      className={INPUT_CLASS}
                    >
                      <option value="ASI_EKSKLUSIF">
                        ASI Eksklusif (0-6 bln)
                      </option>
                      <option value="MP_ASI">ASI + MP-ASI Adekuat</option>
                      <option value="TIDAK_ADEKUAT">
                        MP-ASI Kurang Protein Hewani
                      </option>
                    </select>
                  </FormField>
                  <FormField id="vitamin-a" label="Kapsul Vitamin A">
                    <select
                      id="vitamin-a"
                      value={vitaminA}
                      onChange={(e) => setVitaminA(e.target.value)}
                      className={INPUT_CLASS}
                    >
                      <option value="Ya">Sudah Diberikan</option>
                      <option value="Tidak">Belum Diberikan</option>
                    </select>
                  </FormField>
                </div>
              </div>
            )}

            {/* Clinical Notes */}
            <FormField
              id="clinical-notes"
              label="Catatan Keluhan / Observasi Kader"
            >
              <textarea
                id="clinical-notes"
                rows="2"
                placeholder="Catatan tambahan tanda klinis atau keluhan keluarga..."
                value={clinicalNotes}
                onChange={(e) => setClinicalNotes(e.target.value)}
                className={INPUT_CLASS}
              />
            </FormField>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !selectedPatient}
              aria-label={
                loading
                  ? "Sedang menganalisis data"
                  : "Jalankan analisis multi-agent AI"
              }
              className="w-full py-3.5 bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white rounded-xl text-sm font-bold shadow-md hover:shadow-lg disabled:opacity-55 disabled:cursor-not-allowed disabled:hover:bg-sky-600 disabled:hover:shadow-md transition-all duration-200 flex items-center justify-center gap-2.5"
            >
              {loading ? (
                <>
                  <span className="spinner border-white/30 border-t-white" />
                  <span>Multi-Agent AI Sedang Menganalisis...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" aria-hidden="true" />
                  <span>Jalankan Analisis Multi-Agent AI</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* ═══ Modal Registrasi Pasien Baru ═══ */}
      {showNewPatientModal && (
        <div
          className="fixed inset-0 bg-black/60 dark:bg-black/80 flex items-center justify-center p-4 z-50 animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowNewPatientModal(false);
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-new-patient-title"
        >
          <div
            ref={modalRef}
            tabIndex={-1}
            className="bg-card rounded-2xl max-w-md w-full p-6 border border-line shadow-prominent space-y-4 max-h-[90vh] overflow-y-auto animate-scale-in"
          >
            <div className="flex justify-between items-center">
              <h3
                id="modal-new-patient-title"
                className="text-base font-bold text-heading"
              >
                Registrasi Pasien Baru
              </h3>
              <button
                onClick={() => setShowNewPatientModal(false)}
                aria-label="Tutup modal registrasi"
                className="p-2 text-dim hover:text-heading hover:bg-muted rounded-xl transition-colors duration-200"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <form
              onSubmit={handleCreatePatient}
              className="space-y-4 text-sm"
            >
              <FormField id="new-type" label="Tipe Pasien">
                <select
                  id="new-type"
                  value={newType}
                  onChange={(e) => setNewType(e.target.value)}
                  className={INPUT_CLASS}
                >
                  <option value="CHILD">Anak / Bayi</option>
                  <option value="MOTHER">Ibu Hamil</option>
                </select>
              </FormField>

              <FormField
                id="new-nik"
                label="Nomor Induk Kependudukan (NIK)"
              >
                <input
                  id="new-nik"
                  type="text"
                  maxLength="20"
                  required
                  placeholder="Masukkan NIK pasien..."
                  value={newNik}
                  onChange={(e) => setNewNik(e.target.value)}
                  className={INPUT_CLASS}
                />
              </FormField>

              <FormField id="new-name" label="Nama Lengkap">
                <input
                  id="new-name"
                  type="text"
                  required
                  placeholder="Nama pasien..."
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className={INPUT_CLASS}
                />
              </FormField>

              <div className="grid grid-cols-2 gap-3">
                <FormField id="new-birthdate" label="Tanggal Lahir">
                  <input
                    id="new-birthdate"
                    type="date"
                    required
                    value={newBirthDate}
                    onChange={(e) => setNewBirthDate(e.target.value)}
                    className={INPUT_CLASS}
                  />
                </FormField>
                {newType === "CHILD" && (
                  <FormField id="new-gender" label="Jenis Kelamin">
                    <select
                      id="new-gender"
                      value={newGender}
                      onChange={(e) => setNewGender(e.target.value)}
                      className={INPUT_CLASS}
                    >
                      <option value="L">Laki-laki (L)</option>
                      <option value="P">Perempuan (P)</option>
                    </select>
                  </FormField>
                )}
              </div>

              <FormField id="new-village" label="Desa / Kelurahan (Wilayah Posyandu)">
                <select
                  id="new-village"
                  value={newVillage}
                  onChange={(e) => setNewVillage(e.target.value)}
                  disabled={isKader}
                  className={`${INPUT_CLASS} ${isKader ? "opacity-75 cursor-not-allowed bg-subtle" : ""}`}
                >
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
                {isKader && (
                  <p className="text-[11px] text-caption mt-1">
                    * Otomatis diselaraskan dengan wilayah kerja Posyandu Anda ({user?.posyandu_name || "Posyandu"} - {user?.village_name || "Airmadidi Atas"}).
                  </p>
                )}
              </FormField>

              {newType === "CHILD" && (
                <FormField
                  id="new-mother"
                  label="ID Ibu (Untuk Riwayat Longitudinal)"
                >
                  <select
                    id="new-mother"
                    value={newMotherId}
                    onChange={(e) => setNewMotherId(e.target.value)}
                    className={INPUT_CLASS}
                  >
                    <option value="">-- Tanpa Relasi Ibu --</option>
                    {patients
                      .filter((p) => p.patient_type === "MOTHER")
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} (NIK: {m.nik})
                        </option>
                      ))}
                  </select>
                </FormField>
              )}

              <div className="flex justify-end gap-3 pt-3 border-t border-line">
                <button
                  type="button"
                  onClick={() => setShowNewPatientModal(false)}
                  className="px-4 py-2.5 border border-line rounded-xl text-sm font-medium text-caption hover:bg-muted hover:text-heading transition-all duration-200"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white rounded-xl text-sm font-bold shadow-sm hover:shadow-md transition-all duration-200"
                >
                  Simpan Pasien
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default InputKunjungan;
