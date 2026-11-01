import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import HpkTimelineStepper from "../../components/kader/HpkTimelineStepper";
import KmsDigitalChart from "../../components/kader/KmsDigitalChart";
import {
  HeartPulse,
  Users,
  User,
  Search,
  Filter,
  RefreshCw,
  Baby,
  Heart,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  FileText,
  PlusCircle,
  GraduationCap,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  ShieldAlert,
  TrendingUp,
  BarChart3,
  ArrowRight,
} from "lucide-react";

const AIRMADIDI_VILLAGES_FALLBACK = [
  "Airmadidi Atas", "Airmadidi Bawah", "Sarongsong Satu", "Sarongsong Dua",
  "Sukur", "Rap-Rap", "Sawangan", "Sampiri", "Tanggari"
];

const MonitoringKia = () => {
  const { user, isKader, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Primary Tab State: Kader selalu personal, Admin bisa agregat / personal
  const [activeTab, setActiveTab] = useState(
    isKader ? "personal" : (searchParams.get("tab") || "agregat")
  );

  // Sinkronisasi tab saat peran terdeteksi
  useEffect(() => {
    if (isKader) {
      setActiveTab("personal");
    }
  }, [isKader]);

  // State Monitoring Agregat
  const [aggregates, setAggregates] = useState(null);
  const [loadingAggregates, setLoadingAggregates] = useState(false);
  const [selectedVillageFilter, setSelectedVillageFilter] = useState("ALL");

  // State Monitoring Personal Pasien
  const [patients, setPatients] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState(searchParams.get("patient_id") || "");
  const [selectedLongitudinal, setSelectedLongitudinal] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState(""); // "" | "MOTHER" | "CHILD"

  // State Loading & Refreshing
  const [loadingPatients, setLoadingPatients] = useState(true);
  const [loadingLongitudinal, setLoadingLongitudinal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  // 1. Ambil data agregat hanya jika pengguna adalah Admin
  useEffect(() => {
    if (isAdmin) {
      fetchPosyanduAggregates();
    }
  }, [isAdmin]);

  const fetchPosyanduAggregates = async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      else setLoadingAggregates(true);
      setError("");
      const res = await api.get("/patients/posyandu-aggregates");
      setAggregates(res.data);
    } catch (err) {
      console.error("Gagal mengambil data agregat posyandu:", err);
    } finally {
      setLoadingAggregates(false);
      setRefreshing(false);
    }
  };

  // 2. Ambil daftar pasien saat mount / ganti filter jenis
  useEffect(() => {
    fetchPatientsList();
  }, [filterType]);

  const fetchPatientsList = async () => {
    try {
      setLoadingPatients(true);
      setError("");
      const params = {};
      if (filterType) params.patient_type = filterType;
      const res = await api.get("/patients/", { params: { limit: 250, ...params } });
      const data = res.data || [];
      setPatients(data);

      if (data.length > 0 && !selectedPatientId) {
        setSelectedPatientId(String(data[0].id));
      }
    } catch (err) {
      console.error(err);
      setError("Gagal memuat daftar pasien. Silakan periksa koneksi backend.");
    } finally {
      setLoadingPatients(false);
    }
  };

  // 3. Ambil data longitudinal ketika pasien terpilih berubah
  useEffect(() => {
    if (!selectedPatientId) return;
    fetchPatientLongitudinal(selectedPatientId);
    setSearchParams(
      { tab: activeTab, patient_id: selectedPatientId },
      { replace: true }
    );
  }, [selectedPatientId, activeTab]);

  const fetchPatientLongitudinal = async (patientId, isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      else setLoadingLongitudinal(true);
      setError("");

      const res = await api.get(`/patients/${patientId}/longitudinal`);
      setSelectedLongitudinal(res.data);
    } catch (err) {
      console.error(err);
      setError("Gagal mengambil data riwayat longitudinal pasien.");
      setSelectedLongitudinal(null);
    } finally {
      setLoadingLongitudinal(false);
      setRefreshing(false);
    }
  };

  // Interaktif Drill-Down dari tabel agregat posyandu ke personal pasien
  const handleDrillDownToVillage = (villageName) => {
    setActiveTab("personal");
    setSearchQuery(villageName);
    const targetPatient = patients.find(
      (p) => (p.village_name || "").toLowerCase() === villageName.toLowerCase()
    );
    if (targetPatient) {
      setSelectedPatientId(String(targetPatient.id));
    }
  };

  // Filter pencarian nama/NIK/Desa
  const filteredPatients = patients.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.nik.includes(searchQuery) ||
    (p.village_name && p.village_name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const selectedPatient = selectedLongitudinal?.patient || patients.find((p) => String(p.id) === String(selectedPatientId));
  const isChild = selectedPatient?.patient_type === "CHILD";
  const visits = selectedLongitudinal?.visits || (isChild ? selectedLongitudinal?.child_visits : selectedLongitudinal?.maternal_visits) || [];
  const hpkStatus = selectedLongitudinal?.hpk_status || selectedPatient?.hpk_status || null;

  // Data filter untuk tabel agregat
  const villageList = aggregates?.villages || [];
  const displayedVillages = selectedVillageFilter === "ALL"
    ? villageList
    : villageList.filter((v) => v.village_name === selectedVillageFilter);

  const summary = aggregates?.summary || {};

  // Helper format tanggal bahasa Indonesia
  const formatDateIndo = (iso) => {
    if (!iso) return "-";
    const d = new Date(iso);
    return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* ═══ Header Pusat Monitoring KIA ═══ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-line">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-heading tracking-tight">
            {isKader ? "Pemantauan Pasien KIA 1.000 HPK" : "Pusat Monitoring KIA 1.000 HPK"}
          </h1>
          <p className="text-sm text-caption mt-1">
            {isKader ? (
              <span>Posyandu {user?.village_name || "Airmadidi Atas"} • Pemantauan tumbuh kembang, grafik KMS digital & 1.000 HPK</span>
            ) : (
              <span>UPTD Puskesmas Airmadidi • Pemantauan agregat 9 wilayah kerja posyandu & rekam jejak pasien</span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => {
              if (activeTab === "agregat" && isAdmin) fetchPosyanduAggregates(true);
              else if (selectedPatientId) fetchPatientLongitudinal(selectedPatientId, true);
            }}
            disabled={loadingAggregates || loadingLongitudinal || refreshing}
            title={refreshing ? "Sedang menyegarkan data..." : "Segarkan data"}
            aria-label="Segarkan data"
            className="btn-interactive w-9 h-9 flex items-center justify-center bg-card border border-line hover:border-line-hover text-caption hover:text-heading rounded-lg transition-all duration-150 cursor-pointer shadow-xs hover:-translate-y-px"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-sky-500" : ""}`} />
          </button>

          {isKader && (
            <button
              onClick={() => navigate("/kader/input-kunjungan")}
              className="btn-interactive h-9 flex items-center gap-1.5 px-3.5 bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer shadow-xs hover:-translate-y-px"
            >
              <span>+ Input Kunjungan</span>
            </button>
          )}
        </div>
      </div>

      {/* ═══ Alert Error bila ada ═══ */}
      {error && (
        <div className="p-4 bg-accent-red border border-red-300 dark:border-red-800/50 rounded-xl text-sm text-red-700 dark:text-red-300 flex items-center justify-between gap-3 animate-slide-up">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => {
              if (activeTab === "agregat") fetchPosyanduAggregates();
              else if (selectedPatientId) fetchPatientLongitudinal(selectedPatientId);
            }}
            className="px-3 py-1 bg-red-100 dark:bg-red-900/40 hover:bg-red-200 text-red-700 dark:text-red-300 rounded-lg text-xs font-semibold"
          >
            Coba Lagi
          </button>
        </div>
      )}

      {/* ═══ TAB SWITCHER: Khusus Admin (Kader langsung ke personal pasien) ═══ */}
      {isAdmin && (
        <div className="flex items-center justify-between border-b border-line gap-4 animate-fade-in">
          <div className="flex items-center gap-6 overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab("agregat")}
              className={`pb-3 text-sm font-semibold transition-all relative whitespace-nowrap cursor-pointer ${
                activeTab === "agregat"
                  ? "text-sky-600 dark:text-sky-400 border-b-2 border-sky-600 dark:border-sky-400"
                  : "text-caption hover:text-heading border-b-2 border-transparent"
              }`}
            >
              Agregat Posyandu & Wilayah (9 Desa)
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("personal")}
              className={`pb-3 text-sm font-semibold transition-all relative whitespace-nowrap cursor-pointer ${
                activeTab === "personal"
                  ? "text-sky-600 dark:text-sky-400 border-b-2 border-sky-600 dark:border-sky-400"
                  : "text-caption hover:text-heading border-b-2 border-transparent"
              }`}
            >
              Monitoring Personal Pasien (KMS & 1.000 HPK)
            </button>
          </div>

          <div className="hidden lg:flex items-center gap-2 text-xs text-caption pb-3 font-medium">
            <span>UPTD Puskesmas Airmadidi • 9 Desa Binaan</span>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          TAB 1: MONITORING AGREGAT POSYANDU & WILAYAH (KHUSUS ADMIN)
          ═══════════════════════════════════════════════════════════════════════ */}
      {isAdmin && activeTab === "agregat" && (
        <div className="space-y-6 animate-fade-in">
          {/* Filter Bar Wilayah Posyandu */}
          <div className="bg-card rounded-xl border border-line shadow-card p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <label htmlFor="village-filter" className="text-xs font-medium text-caption shrink-0">
                Wilayah Kerja:
              </label>
              <div className="relative inline-block min-w-[250px]">
                <select
                  id="village-filter"
                  value={selectedVillageFilter}
                  onChange={(e) => setSelectedVillageFilter(e.target.value)}
                  className="has-custom-chevron w-full h-9 appearance-none pl-3.5 pr-11 bg-subtle border border-line rounded-lg text-xs font-semibold text-heading focus:outline-none focus:ring-2 focus:ring-sky-500/40 cursor-pointer"
                >
                  <option value="ALL">Semua Wilayah Kerja (9 Desa Binaan)</option>
                  {AIRMADIDI_VILLAGES_FALLBACK.map((v) => (
                    <option key={v} value={v}>
                      Posyandu {v}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-caption absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Context Badge Role */}
            <div className="flex items-center gap-2 self-start sm:self-auto">
              {isKader ? (
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg text-xs font-medium bg-subtle border border-line text-heading">
                  <span className="w-2 h-2 rounded-full bg-sky-500" />
                  <span>Posyandu Anda: <strong className="font-semibold">{user?.village_name || "Airmadidi Atas"}</strong></span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg text-xs font-medium bg-subtle border border-line text-caption">
                  <span>Mode Administrator: <strong className="text-heading font-semibold">9 Desa Binaan Puskesmas Airmadidi</strong></span>
                </div>
              )}
            </div>
          </div>

          {/* 4 Ringkasan KPI Agregat 1.000 HPK */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Total Sasaran 1.000 HPK */}
            <div className="bg-card p-5 rounded-xl border border-line shadow-card space-y-1">
              <p className="text-xs font-semibold text-caption uppercase tracking-wider">
                Total Sasaran 1.000 HPK
              </p>
              <p className="text-2xl sm:text-3xl font-bold text-heading tabular-nums">
                {loadingAggregates ? "..." : (summary?.total_target_all || 0)}
              </p>
              <p className="text-xs text-caption">
                {summary?.total_mothers_all || 0} Ibu Hamil • {summary?.total_children_all || 0} Anak Baduta
              </p>
            </div>

            {/* Card 2: Tren Pertumbuhan KMS (N vs T) */}
            <div className="bg-card p-5 rounded-xl border border-line shadow-card space-y-1">
              <p className="text-xs font-semibold text-caption uppercase tracking-wider">
                Rasio Pertumbuhan KMS (N)
              </p>
              <p className="text-2xl sm:text-3xl font-bold text-heading tabular-nums">
                {loadingAggregates ? "..." : `${summary?.kms_naik_percent || 0}%`}
              </p>
              <div className="w-full bg-subtle rounded-full h-1.5 overflow-hidden my-1">
                <div
                  className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, summary?.kms_naik_percent || 0)}%` }}
                />
              </div>
              <p className="text-xs text-caption">
                {summary?.total_kms_naik || 0} Naik (N) • {summary?.total_kms_tidak_naik || 0} Tidak Naik (T)
              </p>
            </div>

            {/* Card 3: Kelulusan 1.000 HPK (Usia 24 Bulan) */}
            <div className="bg-card p-5 rounded-xl border border-line shadow-card space-y-1">
              <p className="text-xs font-semibold text-caption uppercase tracking-wider">
                Kelulusan 1.000 HPK
              </p>
              <p className="text-2xl sm:text-3xl font-bold text-heading tabular-nums">
                {loadingAggregates ? "..." : `${summary?.graduation_rate || 100}%`}
              </p>
              <p className="text-xs text-caption">
                {summary?.total_graduated_optimal || 0} Lulus Optimal • {summary?.total_graduated_evaluasi || 0} Perhatian Khusus
              </p>
            </div>

            {/* Card 4: Deteksi Kasus Berisiko */}
            <div className="bg-card p-5 rounded-xl border border-line shadow-card space-y-1">
              <p className="text-xs font-semibold text-caption uppercase tracking-wider">
                Kasus Berisiko 1.000 HPK
              </p>
              <p className={`text-2xl sm:text-3xl font-bold tabular-nums ${(summary?.total_stunting_all || 0) > 0 ? "text-red-600 dark:text-red-400" : "text-heading"}`}>
                {loadingAggregates ? "..." : `${summary?.total_stunting_all || 0} Stunting`}
              </p>
              <p className="text-xs text-caption">
                {summary?.total_kek_all || 0} Ibu KEK • {summary?.total_anemia_all || 0} Anemia
              </p>
            </div>
          </div>

          {/* Tabel Komparasi Seluruh Posyandu di Kecamatan Airmadidi */}
          <div className="bg-card rounded-xl border border-line shadow-card overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-line flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/30">
              <div>
                <h2 className="text-sm sm:text-base font-bold text-heading">
                  Status & Kinerja Monitoring Tiap Posyandu (Kecamatan Airmadidi)
                </h2>
                <p className="text-xs text-caption mt-0.5">
                  Klik tombol "Lihat Pasien" pada baris posyandu untuk menelusuri rekam jejak personal baduta/ibu di wilayah tersebut
                </p>
              </div>
              <span className="text-xs text-caption self-start sm:self-auto font-mono">
                {displayedVillages.length} Wilayah Ditampilkan
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs sm:text-sm text-left">
                <thead className="bg-muted text-caption border-b border-line text-xs font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="p-3.5 sm:p-4">Posyandu & Desa</th>
                    <th className="p-3.5 sm:p-4 text-center">Sasaran (Ibu / Anak)</th>
                    <th className="p-3.5 sm:p-4 text-center">Tren KMS (N / T)</th>
                    <th className="p-3.5 sm:p-4 text-center">Stunting (PB/U)</th>
                    <th className="p-3.5 sm:p-4 text-center">KEK / Anemia</th>
                    <th className="p-3.5 sm:p-4 text-center">Risiko Tinggi</th>
                    <th className="p-3.5 sm:p-4 text-center">Status Wilayah</th>
                    <th className="p-3.5 sm:p-4 text-right pr-5">Aksi Drill-Down</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-light">
                  {loadingAggregates ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-caption text-xs">
                        Memuat data monitoring agregat posyandu se-Kecamatan Airmadidi...
                      </td>
                    </tr>
                  ) : displayedVillages.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-caption text-xs">
                        Tidak ada data wilayah posyandu yang cocok dengan filter.
                      </td>
                    </tr>
                  ) : (
                    displayedVillages.map((v) => {
                      const isMyVillage = v.is_user_village;
                      return (
                        <tr
                          key={v.village_name}
                          className={`hover:bg-subtle/70 transition-colors ${isMyVillage ? "bg-accent-sky/30 dark:bg-sky-950/20" : ""}`}
                        >
                          <td className="p-3.5 sm:p-4">
                            <div className="flex items-center gap-2.5">
                              <span className={`w-2 h-2 rounded-full shrink-0 ${isMyVillage ? "bg-sky-500 animate-pulse" : "bg-zinc-400"}`} />
                              <div>
                                <p className="font-bold text-heading text-xs sm:text-sm">
                                  {v.posyandu_name}
                                </p>
                                <p className="text-xs text-caption">
                                  Desa/Kel. {v.village_name} {isMyVillage && "(Wilayah Anda)"}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="p-3.5 sm:p-4 text-center tabular-nums">
                            <span className="font-bold text-heading">{v.total_patients}</span>
                            <span className="text-caption block text-xs">
                              {v.total_mothers} Ibu • {v.total_children} Anak
                            </span>
                          </td>

                          <td className="p-3.5 sm:p-4 text-center tabular-nums">
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold">{v.kms_naik_count} N</span>
                            <span className="text-dim mx-1">/</span>
                            <span className="text-amber-600 dark:text-amber-400 font-bold">{v.kms_tidak_naik_count} T</span>
                          </td>

                          <td className="p-3.5 sm:p-4 text-center tabular-nums">
                            {v.stunting_count > 0 ? (
                              <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                                {v.stunting_count} Kasus
                              </span>
                            ) : (
                              <span className="text-dim text-xs">-</span>
                            )}
                          </td>

                          <td className="p-3.5 sm:p-4 text-center tabular-nums">
                            {v.kek_count + v.anemia_count > 0 ? (
                              <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                                {v.kek_count} KEK • {v.anemia_count} Anemia
                              </span>
                            ) : (
                              <span className="text-dim text-xs">-</span>
                            )}
                          </td>

                          <td className="p-3.5 sm:p-4 text-center tabular-nums">
                            {v.high_risk_count > 0 ? (
                              <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                                {v.high_risk_count} Kasus
                              </span>
                            ) : (
                              <span className="text-dim text-xs">-</span>
                            )}
                          </td>

                          <td className="p-3.5 sm:p-4 text-center">
                            {v.status_color === "rose" ? (
                              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                                Prioritas
                              </span>
                            ) : v.status_color === "amber" ? (
                              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                                Waspada
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                                Aman
                              </span>
                            )}
                          </td>

                          <td className="p-3.5 sm:p-4 text-right pr-5">
                            <button
                              onClick={() => handleDrillDownToVillage(v.village_name)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/50 border border-line hover:border-sky-300 dark:hover:border-sky-700 transition-colors cursor-pointer"
                              title={`Buka pemantauan personal untuk pasien di ${v.posyandu_name}`}
                            >
                              <span>Lihat Pasien</span>
                              <ArrowRight className="w-3.5 h-3.5" />
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
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          TAB 2: MONITORING PERSONAL PASIEN (KMS & 1.000 HPK)
          Kader langsung melihat bagian ini, Admin melihat saat tab personal dipilih
          ═══════════════════════════════════════════════════════════════════════ */}
      {(isKader || activeTab === "personal") && (
        <div className="space-y-6 animate-slide-up">
          {/* Bilah Pemilih Pasien Cepat (Quick Patient Selector) */}
          <div className="bg-card rounded-xl border border-line dark:border-slate-800 shadow-card hover:border-line-hover transition-all duration-200 p-4 sm:p-5 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              {/* Kolom Pencarian */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-dim absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder={isKader ? "Cari nama atau NIK pasien di posyandu..." : "Cari nama, NIK, atau desa pasien..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-10 pl-9 pr-4 bg-subtle dark:bg-slate-900/60 border border-line dark:border-slate-700/80 rounded-lg text-xs font-medium text-heading placeholder:text-dim focus:outline-none focus:ring-1 focus:ring-sky-500/50 focus:border-sky-500 transition-all duration-200"
                />
              </div>

              {/* Filter Jenis Pasien (Simple, Rapi, Sesuai Standar UI) */}
              <div className="h-10 inline-flex items-center p-1 bg-subtle dark:bg-slate-900/60 border border-line dark:border-slate-700/80 rounded-lg gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setFilterType("")}
                  className={`h-8 px-3.5 inline-flex items-center justify-center rounded-md text-xs font-semibold transition-all duration-150 cursor-pointer ${
                    filterType === ""
                      ? "bg-card text-heading shadow-xs border border-line"
                      : "text-caption hover:text-heading"
                  }`}
                >
                  Semua
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType("CHILD")}
                  className={`h-8 px-3.5 inline-flex items-center justify-center rounded-md text-xs font-semibold transition-all duration-150 cursor-pointer ${
                    filterType === "CHILD"
                      ? "bg-card text-sky-600 dark:text-sky-400 shadow-xs border border-line"
                      : "text-caption hover:text-heading"
                  }`}
                >
                  Baduta (Anak)
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType("MOTHER")}
                  className={`h-8 px-3.5 inline-flex items-center justify-center rounded-md text-xs font-semibold transition-all duration-150 cursor-pointer ${
                    filterType === "MOTHER"
                      ? "bg-card text-pink-600 dark:text-pink-400 shadow-xs border border-line"
                      : "text-caption hover:text-heading"
                  }`}
                >
                  Ibu Hamil
                </button>
              </div>
            </div>

            {/* Pemilih Pasien Dropdown: Custom Chevron dengan Padding Kanan Proporsional */}
            <div className="space-y-1.5">
              <label htmlFor="patient-select-input" className="block text-xs font-medium text-heading">
                Pilih Pasien untuk Ditampilkan:
              </label>
              <div className="relative">
                <select
                  id="patient-select-input"
                  value={selectedPatientId}
                  onChange={(e) => setSelectedPatientId(e.target.value)}
                  className="has-custom-chevron w-full h-10 appearance-none pl-3.5 pr-11 bg-card dark:bg-slate-900/80 border border-line dark:border-slate-700 rounded-lg text-xs font-medium text-heading focus:outline-none focus:ring-1 focus:ring-sky-500/50 focus:border-sky-500 transition-all duration-200 cursor-pointer shadow-xs"
                >
                  {filteredPatients.length === 0 ? (
                    <option value="">Tidak ada pasien yang sesuai filter</option>
                  ) : (
                    filteredPatients.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.patient_type === "CHILD" ? "Anak / Baduta" : "Ibu Hamil"}) • NIK: {p.nik} • {p.village_name || "Airmadidi"}
                      </option>
                    ))
                  )}
                </select>
                <ChevronDown className="w-4 h-4 text-caption absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Kartu Profil Pasien Terpilih: Kontras Tinggi & Aksen Warna Tegas */}
          {selectedPatient && (
            <div className={`rounded-xl border shadow-card p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 animate-slide-up border-l-4 transition-all duration-200 ${
              isChild
                ? "bg-sky-50/40 dark:bg-sky-950/25 border-sky-200 dark:border-sky-800/80 border-l-sky-500"
                : "bg-pink-50/40 dark:bg-pink-950/25 border-pink-200 dark:border-pink-800/80 border-l-pink-500"
            }`}>
              <div className="flex items-center gap-3.5">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border shadow-xs ${
                  isChild
                    ? "bg-sky-100 dark:bg-sky-900/60 text-sky-700 dark:text-sky-300 border-sky-300 dark:border-sky-700"
                    : "bg-pink-100 dark:bg-pink-900/60 text-pink-700 dark:text-pink-300 border-pink-300 dark:border-pink-700"
                }`}>
                  {isChild ? <Baby className="w-5 h-5" /> : <Heart className="w-5 h-5" />}
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-heading">
                    {selectedPatient.name}
                  </h2>
                  <p className="text-xs text-body dark:text-slate-200 mt-1 flex items-center gap-2 flex-wrap font-medium">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold border ${
                      isChild
                        ? "bg-sky-100 dark:bg-sky-900/60 text-sky-800 dark:text-sky-200 border-sky-300 dark:border-sky-700"
                        : "bg-pink-100 dark:bg-pink-900/60 text-pink-800 dark:text-pink-200 border-pink-300 dark:border-pink-700"
                    }`}>
                      {isChild ? "Baduta (1-24 Bulan)" : "Ibu Hamil"}
                    </span>
                    <span>•</span>
                    <span>NIK: <strong className="font-mono text-heading font-bold">{selectedPatient.nik}</strong></span>
                    <span>•</span>
                    <span>Posyandu: <strong className="text-heading font-bold">{selectedPatient.village_name || "Airmadidi"}</strong></span>
                    <span>•</span>
                    <span>Total Kunjungan: <strong className="text-sky-600 dark:text-sky-400 font-bold">{visits.length} Kali</strong></span>
                    {hpkStatus?.is_graduation_milestone && (
                      <>
                        <span>•</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">Lulus 1.000 HPK</span>
                      </>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start md:self-auto">
                {isKader && (
                  <button
                    onClick={() => navigate(`/kader/data-pasien`)}
                    className="btn-interactive h-9 inline-flex items-center gap-1.5 px-3.5 bg-subtle hover:bg-muted border border-line dark:border-slate-700 rounded-lg text-xs font-semibold text-caption hover:text-heading transition-all duration-150 cursor-pointer shadow-xs hover:-translate-y-px"
                  >
                    <span>Lihat Profil Lengkap</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Komponen 1: Garis Waktu Interaktif 1.000 HPK */}
          <HpkTimelineStepper
            patient={selectedPatient}
            hpkStatus={hpkStatus}
            childVisits={selectedLongitudinal?.child_visits || (isChild ? visits : [])}
            maternalVisits={selectedLongitudinal?.maternal_visits || (!isChild ? visits : [])}
            maternalSummary={selectedLongitudinal?.maternal_summary}
            onSelectVisit={(v) => console.log("Selected visit:", v)}
          />

          {/* Komponen 2: Grafik Pertumbuhan Pita Warna KMS Digital */}
          <KmsDigitalChart
            patient={selectedPatient}
            visits={visits}
            loading={loadingLongitudinal}
          />

          {/* Komponen 3: Riwayat Kunjungan 1.000 HPK (Format Ringkas, Bebas Deadspace, Tanpa Label Menumpuk) */}
          <div className="bg-card rounded-xl border border-line shadow-card p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <div>
                <h3 className="text-base font-bold text-heading flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                  <span>Riwayat Rekam Kunjungan 1.000 HPK</span>
                </h3>
                <p className="text-xs text-caption mt-0.5">
                  Catatan kunjungan berkala Posyandu & Puskesmas ({visits.length} Kunjungan Tercatat)
                </p>
              </div>
            </div>

            {visits.length === 0 ? (
              <div className="p-6 text-center text-caption text-xs bg-subtle rounded-xl border border-dashed border-line">
                Belum ada data riwayat kunjungan tercatat untuk pasien ini.
              </div>
            ) : (
              <div className="space-y-3">
                {[...visits].reverse().map((v, idx) => {
                  const visitNumber = visits.length - idx;
                  const isLatest = idx === 0;

                  // Delta berat badan dibanding kunjungan sebelumnya
                  const originalIndex = visits.length - 1 - idx;
                  const prevVisit = originalIndex > 0 ? visits[originalIndex - 1] : null;

                  let deltaWeight = null;
                  if (isChild && v.child_weight_kg && prevVisit?.child_weight_kg) {
                    deltaWeight = +(v.child_weight_kg - prevVisit.child_weight_kg).toFixed(2);
                  } else if (!isChild && v.maternal_weight_kg && prevVisit?.maternal_weight_kg) {
                    deltaWeight = +(v.maternal_weight_kg - prevVisit.maternal_weight_kg).toFixed(2);
                  }

                  const isHighRisk = v.overall_status === "RISIKO_TINGGI";
                  const isAttention = v.overall_status === "PERLU_PERHATIAN";

                  return (
                    <div
                      key={v.id || idx}
                      className="p-3.5 bg-subtle rounded-xl border border-line space-y-2 hover:border-sky-300 dark:hover:border-sky-800 transition-colors"
                    >
                      {/* Baris Judul & Metadata */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-heading">
                            Kunjungan #{visitNumber}
                          </span>
                          <span className="text-dim">•</span>
                          <span className="text-heading font-medium">{formatDateIndo(v.visit_date)}</span>
                          <span className="text-dim">•</span>
                          <span className="text-caption">
                            {isChild
                              ? `Usia ${v.age_in_months ?? "-"} Bulan${v.phase ? ` (${v.phase.replace(/_/g, " ")})` : ""}`
                              : `Usia Kehamilan: ${v.gestational_age_weeks ? `${v.gestational_age_weeks} Mgg` : (v.trimester ? `Trimester ${v.trimester}` : "-")}`}
                          </span>
                          <span className="text-dim">•</span>
                          <span className={`font-semibold ${
                            isHighRisk
                              ? "text-rose-600 dark:text-rose-400"
                              : isAttention
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-emerald-600 dark:text-emerald-400"
                          }`}>
                            {isHighRisk ? "Risiko Tinggi" : isAttention ? "Perlu Perhatian" : "Kondisi Baik"}
                          </span>
                          {isLatest && (
                            <span className="text-sky-600 dark:text-sky-400 font-semibold">
                              (Terkini)
                            </span>
                          )}
                        </div>

                        {v.report_id && (
                          <button
                            type="button"
                            onClick={() => navigate(`/kader/validasi-laporan/${v.report_id}`)}
                            className="inline-flex items-center gap-1 font-semibold text-sky-600 dark:text-sky-400 hover:underline cursor-pointer self-start sm:self-auto shrink-0"
                          >
                            <span>Laporan #{v.report_id}</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Baris Hasil Pengukuran (Poin-Poin Ringkas) */}
                      <div className="flex items-center gap-x-4 gap-y-1 flex-wrap text-xs text-caption pt-1 border-t border-line-light">
                        {isChild ? (
                          <>
                            <div>
                              <span>BB: </span>
                              <strong className="text-heading">
                                {v.child_weight_kg ?? (v.birth_weight_gram ? `${+(v.birth_weight_gram / 1000).toFixed(2)}` : "-")} kg
                              </strong>
                              {deltaWeight !== null && (
                                <span className={`ml-1 font-medium ${deltaWeight > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                                  ({deltaWeight > 0 ? `+${deltaWeight}` : deltaWeight} kg)
                                </span>
                              )}
                            </div>
                            <span className="text-dim">•</span>
                            <div>
                              <span>PB/TB: </span>
                              <strong className="text-heading">
                                {v.child_length_cm ?? v.birth_length_cm ?? "-"} cm
                              </strong>
                            </div>
                            <span className="text-dim">•</span>
                            <div>
                              <span>Z-Score PB/U: </span>
                              <strong className={v.z_score_pbu < -2 ? "text-rose-600 dark:text-rose-400 font-bold" : "text-heading"}>
                                {v.z_score_pbu !== null && v.z_score_pbu !== undefined
                                  ? `${Number(v.z_score_pbu).toFixed(2)} SD (${v.pbu_category || (v.z_score_pbu < -2 ? "Pendek" : "Normal")})`
                                  : "-"}
                              </strong>
                            </div>
                            <span className="text-dim">•</span>
                            <div>
                              <span>KMS: </span>
                              <strong className="text-heading">
                                {v.weight_trend_kms === "N" ? "Naik (N)" : v.weight_trend_kms === "T" ? "Tidak Naik (T)" : "-"}
                              </strong>
                              {v.feeding_status && (
                                <span className="text-caption ml-1">({v.feeding_status.replace(/_/g, " ")})</span>
                              )}
                            </div>
                          </>
                        ) : (
                          <>
                            <div>
                              <span>LiLA: </span>
                              <strong className={v.lila_cm && v.lila_cm < 23.5 ? "text-rose-600 dark:text-rose-400 font-bold" : "text-heading"}>
                                {v.lila_cm ? `${v.lila_cm} cm` : "-"}
                              </strong>
                              {v.lila_cm && (
                                <span className="text-caption ml-1">
                                  ({v.lila_cm >= 23.5 ? "Normal" : "Risiko KEK"})
                                </span>
                              )}
                            </div>
                            <span className="text-dim">•</span>
                            <div>
                              <span>TD: </span>
                              <strong className="text-heading">
                                {v.systolic_bp && v.diastolic_bp ? `${v.systolic_bp}/${v.diastolic_bp} mmHg` : "-"}
                              </strong>
                            </div>
                            <span className="text-dim">•</span>
                            <div>
                              <span>TFU: </span>
                              <strong className="text-heading">
                                {v.fundal_height_cm ? `${v.fundal_height_cm} cm` : "-"}
                              </strong>
                            </div>
                            <span className="text-dim">•</span>
                            <div>
                              <span>BB Ibu: </span>
                              <strong className="text-heading">
                                {v.maternal_weight_kg ? `${v.maternal_weight_kg} kg` : "-"}
                              </strong>
                              {deltaWeight !== null && (
                                <span className="text-emerald-600 dark:text-emerald-400 font-medium ml-1">
                                  ({deltaWeight > 0 ? `+${deltaWeight}` : deltaWeight} kg)
                                </span>
                              )}
                            </div>
                          </>
                        )}
                      </div>

                      {/* Catatan Pemeriksaan (jika ada) */}
                      {v.clinical_notes && (
                        <p className="text-xs text-caption pt-1 text-dim leading-relaxed">
                          Catatan: {v.clinical_notes}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MonitoringKia;
