import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import HpkTimelineStepper from "../../components/kader/HpkTimelineStepper";
import KmsDigitalChart from "../../components/kader/KmsDigitalChart";
import {
  HeartPulse,
  Users,
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

  // Primary Tab State: "agregat" | "personal"
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "agregat");

  // State Monitoring Agregat
  const [aggregates, setAggregates] = useState(null);
  const [loadingAggregates, setLoadingAggregates] = useState(true);
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

  // 1. Ambil data agregat saat mount
  useEffect(() => {
    fetchPosyanduAggregates();
  }, []);

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

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* ═══ Header Pusat Monitoring KIA ═══ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-line-light">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="p-2 bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 rounded-xl border border-sky-200 dark:border-sky-800/50">
              <HeartPulse className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-heading tracking-tight">
              Pusat Monitoring KIA 1.000 HPK
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Monitoring Aktif
            </span>
          </div>
          <p className="text-xs sm:text-sm text-caption mt-1">
            Pemantauan agregat posyandu se-Kecamatan Airmadidi &amp; rekam jejak longitudinal 1.000 HPK
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => {
              if (activeTab === "agregat") fetchPosyanduAggregates(true);
              else if (selectedPatientId) fetchPatientLongitudinal(selectedPatientId, true);
            }}
            disabled={loadingAggregates || loadingLongitudinal || refreshing}
            className="btn-interactive flex items-center gap-1.5 px-3.5 py-2 bg-card border border-line hover:bg-muted text-label hover:text-heading rounded-xl text-xs font-semibold transition-colors duration-200 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-sky-600 dark:text-sky-400 ${refreshing ? "animate-spin" : ""}`} />
            <span>{refreshing ? "Menyegarkan..." : "Segarkan"}</span>
          </button>

          {isKader && (
            <button
              onClick={() => navigate("/kader/input-kunjungan")}
              className="btn-interactive flex items-center gap-1.5 px-3.5 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-semibold transition-colors duration-200 cursor-pointer shadow-xs"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Input Kunjungan</span>
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

      {/* ═══ TAB SWITCHER: Agregat Posyandu vs Personal Pasien ═══ */}
      <div className="flex items-center justify-between gap-3 p-1.5 bg-subtle border border-line rounded-2xl">
        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          <button
            onClick={() => setActiveTab("agregat")}
            className={`flex-1 sm:flex-initial px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "agregat"
                ? "bg-sky-600 text-white shadow-sm"
                : "text-caption hover:text-heading hover:bg-card/60"
            }`}
          >
            <span>Agregat Posyandu &amp; Wilayah Kerja</span>
          </button>

          <button
            onClick={() => setActiveTab("personal")}
            className={`flex-1 sm:flex-initial px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "personal"
                ? "bg-sky-600 text-white shadow-sm"
                : "text-caption hover:text-heading hover:bg-card/60"
            }`}
          >
            <span>Monitoring Personal Pasien (KMS &amp; 1.000 HPK)</span>
          </button>
        </div>

        {activeTab === "agregat" && (
          <div className="hidden lg:flex items-center gap-2 text-xs text-caption px-2 font-medium">
            <span>UPTD Puskesmas Airmadidi &bull; 9 Kelurahan/Desa Binaan</span>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          TAB 1: MONITORING AGREGAT POSYANDU & WILAYAH
          ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "agregat" && (
        <div className="space-y-6 animate-fade-in">
          {/* Filter Bar Wilayah Posyandu */}
          <div className="bg-card rounded-2xl border border-line shadow-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Filter className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
              <div>
                <label htmlFor="village-filter" className="text-xs font-bold text-caption uppercase tracking-wider block">
                  Pilih Wilayah Kerja Posyandu:
                </label>
                <select
                  id="village-filter"
                  value={selectedVillageFilter}
                  onChange={(e) => setSelectedVillageFilter(e.target.value)}
                  className="mt-1 px-3 py-1.5 bg-subtle border border-line rounded-xl text-xs font-semibold text-heading focus:outline-none focus:ring-2 focus:ring-sky-500/40 cursor-pointer min-w-[220px]"
                >
                  <option value="ALL">Semua Wilayah Kerja (9 Kelurahan/Desa)</option>
                  {AIRMADIDI_VILLAGES_FALLBACK.map((v) => (
                    <option key={v} value={v}>
                      Posyandu {v}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Context Badge Role */}
            <div className="flex items-center gap-2 self-start sm:self-auto">
              {isKader ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold bg-sky-50 dark:bg-sky-950/40 text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-800/50">
                  <span className="w-2 h-2 rounded-full bg-sky-500" />
                  <span>Posyandu Anda: <strong>{user?.village_name || "Airmadidi Atas"}</strong></span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold bg-subtle border border-line text-caption">
                  <span>Mode Admin: <strong>9 Desa Binaan Puskesmas Airmadidi</strong></span>
                </span>
              )}
            </div>
          </div>

          {/* 4 Ringkasan KPI Agregat 1.000 HPK */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Total Sasaran 1.000 HPK */}
            <div className="bg-card p-5 rounded-2xl border border-line shadow-card space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-caption uppercase tracking-wider">
                  Total Sasaran 1.000 HPK
                </p>
                <div className="w-9 h-9 rounded-xl bg-sky-50 dark:bg-sky-950/30 text-sky-600 dark:text-sky-400 flex items-center justify-center border border-sky-100 dark:border-sky-900/30">
                  <Users className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-heading tabular-nums">
                {loadingAggregates ? "..." : (summary?.total_target_all || 0)}
              </p>
              <p className="text-xs text-caption">
                {summary?.total_mothers_all || 0} Ibu Hamil &bull; {summary?.total_children_all || 0} Anak Baduta
              </p>
            </div>

            {/* Card 2: Tren Pertumbuhan KMS (N vs T) */}
            <div className="bg-card p-5 rounded-2xl border border-line shadow-card space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-caption uppercase tracking-wider">
                  Rasio Pertumbuhan KMS (N)
                </p>
                <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-100 dark:border-emerald-900/30">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-heading tabular-nums">
                {loadingAggregates ? "..." : `${summary?.kms_naik_percent || 0}%`}
              </p>
              <div className="w-full bg-subtle rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, summary?.kms_naik_percent || 0)}%` }}
                />
              </div>
              <p className="text-xs text-caption">
                {summary?.total_kms_naik || 0} Naik (N) &bull; {summary?.total_kms_tidak_naik || 0} Tidak Naik (T)
              </p>
            </div>

            {/* Card 3: Kelulusan 1.000 HPK (Usia 24 Bulan) */}
            <div className="bg-card p-5 rounded-2xl border border-line shadow-card space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-caption uppercase tracking-wider">
                  Kelulusan 1.000 HPK
                </p>
                <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-100 dark:border-amber-900/30">
                  <GraduationCap className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-heading tabular-nums">
                {loadingAggregates ? "..." : `${summary?.graduation_rate || 100}%`}
              </p>
              <p className="text-xs text-caption">
                {summary?.total_graduated_optimal || 0} Lulus Optimal &bull; {summary?.total_graduated_evaluasi || 0} Perhatian Khusus
              </p>
            </div>

            {/* Card 4: Deteksi Kasus Berisiko */}
            <div className="bg-card p-5 rounded-2xl border border-line shadow-card space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-caption uppercase tracking-wider">
                  Kasus Berisiko 1.000 HPK
                </p>
                <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-100 dark:border-rose-900/30">
                  <ShieldAlert className="w-4 h-4" />
                </div>
              </div>
              <p className={`text-2xl sm:text-3xl font-bold tabular-nums ${(summary?.total_stunting_all || 0) > 0 ? "text-rose-600 dark:text-rose-400" : "text-heading"}`}>
                {loadingAggregates ? "..." : `${summary?.total_stunting_all || 0} Stunting`}
              </p>
              <p className="text-xs text-caption">
                {summary?.total_kek_all || 0} Ibu KEK &bull; {summary?.total_anemia_all || 0} Anemia
              </p>
            </div>
          </div>

          {/* Tabel Komparasi Seluruh Posyandu di Kecamatan Airmadidi */}
          <div className="bg-card rounded-2xl border border-line shadow-card overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-line flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/30">
              <div>
                <h2 className="text-sm sm:text-base font-bold text-heading">
                  Status &amp; Kinerja Monitoring Tiap Posyandu (Kecamatan Airmadidi)
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
                    <th className="p-3.5">Posyandu &amp; Desa</th>
                    <th className="p-3.5 text-center">Sasaran (Ibu/Anak)</th>
                    <th className="p-3.5 text-center">Tren KMS (N / T)</th>
                    <th className="p-3.5 text-center">Stunting (PB/U)</th>
                    <th className="p-3.5 text-center">KEK / Anemia</th>
                    <th className="p-3.5 text-center">Risiko Tinggi</th>
                    <th className="p-3.5 text-center">Status Wilayah</th>
                    <th className="p-3.5 text-right pr-5">Aksi Drill-Down</th>
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
                          <td className="p-3.5">
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full ${isMyVillage ? "bg-sky-500 animate-pulse" : "bg-zinc-400"}`} />
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

                          <td className="p-3.5 text-center tabular-nums">
                            <span className="font-bold text-heading">{v.total_patients}</span>
                            <span className="text-caption block text-xs">
                              {v.total_mothers} Ibu &bull; {v.total_children} Anak
                            </span>
                          </td>

                          <td className="p-3.5 text-center tabular-nums">
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold">{v.kms_naik_count} N</span>
                            <span className="text-dim mx-1">/</span>
                            <span className="text-amber-600 dark:text-amber-400 font-bold">{v.kms_tidak_naik_count} T</span>
                          </td>

                          <td className="p-3.5 text-center tabular-nums">
                            {v.stunting_count > 0 ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                                {v.stunting_count} Kasus
                              </span>
                            ) : (
                              <span className="text-dim">0</span>
                            )}
                          </td>

                          <td className="p-3.5 text-center tabular-nums">
                            {v.kek_count + v.anemia_count > 0 ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                {v.kek_count} KEK &bull; {v.anemia_count} Anemia
                              </span>
                            ) : (
                              <span className="text-dim">0</span>
                            )}
                          </td>

                          <td className="p-3.5 text-center tabular-nums">
                            {v.high_risk_count > 0 ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-200">
                                {v.high_risk_count} Kasus
                              </span>
                            ) : (
                              <span className="text-dim">0</span>
                            )}
                          </td>

                          <td className="p-3.5 text-center">
                            {v.status_color === "rose" ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                Prioritas
                              </span>
                            ) : v.status_color === "amber" ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200">
                                Waspada
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                                Aman
                              </span>
                            )}
                          </td>

                          <td className="p-3.5 text-right pr-5">
                            <button
                              onClick={() => handleDrillDownToVillage(v.village_name)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/50 border border-transparent hover:border-sky-200 transition-colors cursor-pointer"
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
          ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "personal" && (
        <div className="space-y-6 animate-fade-in">
          {/* Bilah Pemilih Pasien Cepat (Quick Patient Selector) */}
          <div className="bg-card rounded-2xl border border-line shadow-card p-4 space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              {/* Kolom Pencarian */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-caption absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari pasien berdasarkan nama, NIK, atau Desa/Posyandu..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-subtle border border-line rounded-xl text-xs text-heading placeholder:text-dim focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500"
                />
              </div>

              {/* Filter Jenis Pasien */}
              <div className="inline-flex rounded-xl border border-line p-0.5 bg-subtle shrink-0">
                <button
                  onClick={() => setFilterType("")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${filterType === "" ? "bg-sky-600 text-white" : "text-caption hover:text-heading"}`}
                >
                  Semua ({patients.length})
                </button>
                <button
                  onClick={() => setFilterType("CHILD")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${filterType === "CHILD" ? "bg-sky-600 text-white" : "text-caption hover:text-heading"}`}
                >
                  Baduta (Anak)
                </button>
                <button
                  onClick={() => setFilterType("MOTHER")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${filterType === "MOTHER" ? "bg-pink-600 text-white" : "text-caption hover:text-heading"}`}
                >
                  Ibu Hamil
                </button>
              </div>
            </div>

            {/* Pemilih Pasien Dropdown */}
            <div>
              <label htmlFor="patient-select-input" className="text-xs font-bold text-caption uppercase tracking-wider block mb-1">
                Pilih Sasaran Pasien yang Dipantau:
              </label>
              <select
                id="patient-select-input"
                value={selectedPatientId}
                onChange={(e) => setSelectedPatientId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-card border border-line rounded-xl text-xs font-semibold text-heading focus:outline-none focus:ring-2 focus:ring-sky-500/40 cursor-pointer"
              >
                {filteredPatients.length === 0 ? (
                  <option value="">Tidak ada pasien yang sesuai filter</option>
                ) : (
                  filteredPatients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.patient_type === "CHILD" ? "Anak / Baduta" : "Ibu Hamil"}) &bull; NIK: {p.nik} &bull; {p.village_name || "Airmadidi"}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          {/* Kartu Profil Pasien Terpilih */}
          {selectedPatient && (
            <div className="bg-card rounded-2xl border border-line shadow-card p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 animate-fade-in">
              <div className="flex items-center gap-3.5">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${isChild ? "bg-sky-50 dark:bg-sky-950/40 text-sky-600 border-sky-200 dark:border-sky-800" : "bg-pink-50 dark:pink-950/40 text-pink-600 border-pink-200 dark:border-pink-800"}`}>
                  {isChild ? <Baby className="w-6 h-6" /> : <Heart className="w-6 h-6" />}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base sm:text-lg font-bold text-heading">
                      {selectedPatient.name}
                    </h2>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${isChild ? "bg-sky-100 text-sky-800 border-sky-200" : "bg-pink-100 text-pink-800 border-pink-200"}`}>
                      {isChild ? "Fase 3: Baduta (1-24 Bln)" : "Fase 1: Ibu Hamil"}
                    </span>
                    {hpkStatus?.is_graduation_milestone && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                        🎓 Lulus 1.000 HPK
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-caption mt-0.5 flex items-center gap-2 flex-wrap">
                    <span>NIK: <strong>{selectedPatient.nik}</strong></span>
                    <span>&bull;</span>
                    <span>Desa: <strong>{selectedPatient.village_name || "Airmadidi"}</strong></span>
                    <span>&bull;</span>
                    <span>Jumlah Kunjungan: <strong>{visits.length} Kali</strong></span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start md:self-auto">
                {isKader && (
                  <button
                    onClick={() => navigate(`/kader/data-pasien`)}
                    className="btn-interactive inline-flex items-center gap-1.5 px-3 py-2 bg-subtle border border-line rounded-xl text-xs font-semibold text-caption hover:text-heading transition-colors cursor-pointer"
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>Buka Profil Penuh</span>
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
        </div>
      )}
    </div>
  );
};

export default MonitoringKia;
