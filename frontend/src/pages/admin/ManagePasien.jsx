import React, { useState, useEffect } from "react";
import api, { getErrorMessage } from "../../services/api";
import {
  Users,
  Search,
  Plus,
  Trash2,
  Edit,
  X,
  Save,
  AlertCircle,
  ChevronDown,
  Heart,
  Baby,
  Activity,
} from "lucide-react";

const ManagePasien = () => {
  const [patients, setPatients] = useState([]);
  const [search, setSearch] = useState("");
  const [villageFilter, setVillageFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState([]);
  const [deletingBulk, setDeletingBulk] = useState(false);

  // Edit Modal State
  const [editingPatient, setEditingPatient] = useState(null);
  const [editName, setEditName] = useState("");
  const [editNik, setEditNik] = useState("");
  const [editBirthDate, setEditBirthDate] = useState("");
  const [editGender, setEditGender] = useState("L");
  const [editMotherId, setEditMotherId] = useState("");
  const [editVillage, setEditVillage] = useState("");
  const [editPosyandu, setEditPosyandu] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editPhone, setEditPhone] = useState("");

  // Create Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newNik, setNewNik] = useState("");
  const [newType, setNewType] = useState("CHILD");
  const [newBirthDate, setNewBirthDate] = useState("");
  const [newGender, setNewGender] = useState("L");
  const [newMotherId, setNewMotherId] = useState("");
  const [newVillage, setNewVillage] = useState("Airmadidi Atas");
  const [newPosyandu, setNewPosyandu] = useState("");

  const motherList = patients.filter((p) => p.patient_type === "MOTHER");

  useEffect(() => {
    fetchPatients();
  }, [villageFilter]);

  const fetchPatients = async () => {
    try {
      setLoading(true);
      const params = {};
      if (villageFilter) params.village_name = villageFilter;
      const res = await api.get("/patients/", { params });
      setPatients(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEdit = (p) => {
    setEditingPatient(p);
    setEditName(p.name);
    setEditNik(p.nik);
    setEditBirthDate(p.birth_date);
    setEditGender(p.gender || "L");
    setEditMotherId(p.mother_id ? String(p.mother_id) : "");
    setEditVillage(p.village_name || "Airmadidi Atas");
    setEditPosyandu(p.posyandu_name || "");
    setEditAddress(p.address || "");
    setEditPhone(p.phone_number || "");
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        name: editName.trim(),
        nik: editNik.trim(),
        birth_date: editBirthDate,
        gender: editingPatient.patient_type === "CHILD" ? editGender : null,
        mother_id:
          editingPatient.patient_type === "CHILD" && editMotherId
            ? parseInt(editMotherId, 10)
            : null,
        village_name: editVillage,
        posyandu_name: editPosyandu,
        address: editAddress,
        phone_number: editPhone,
      };
      await api.put(`/patients/${editingPatient.id}`, payload);
      alert("Data pasien berhasil diperbarui!");
      setEditingPatient(null);
      fetchPatients();
    } catch (err) {
      alert(getErrorMessage(err, "Gagal memperbarui data pasien."));
    }
  };

  const handleDelete = async (id, name) => {
    if (
      !window.confirm(
        `Apakah Anda yakin ingin menghapus data pasien ${name} beserta seluruh rekam kunjungannya? Tindakan ini tidak dapat dibatalkan.`,
      )
    ) {
      return;
    }
    try {
      await api.delete(`/patients/${id}`);
      alert(`Data pasien ${name} berhasil dihapus.`);
      setSelectedIds((prev) => prev.filter((item) => item !== id));
      fetchPatients();
    } catch (err) {
      alert(getErrorMessage(err, "Gagal menghapus data pasien."));
    }
  };

  const handleToggleAll = () => {
    if (selectedIds.length === filtered.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filtered.map((p) => p.id));
    }
  };

  const handleToggleRow = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (
      !window.confirm(
        `Apakah Anda yakin ingin menghapus ${selectedIds.length} data pasien terpilih beserta seluruh rekam kunjungannya? Tindakan ini permanen dan tidak dapat dibatalkan.`,
      )
    ) {
      return;
    }
    try {
      setDeletingBulk(true);
      const res = await api.post("/patients/bulk-delete", { ids: selectedIds });
      alert(
        res.data.message || `${selectedIds.length} pasien berhasil dihapus.`,
      );
      setSelectedIds([]);
      fetchPatients();
    } catch (err) {
      alert(getErrorMessage(err, "Gagal menghapus data pasien terpilih."));
    } finally {
      setDeletingBulk(false);
    }
  };

  const handleCreatePatient = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        name: newName.trim(),
        nik: newNik.trim(),
        patient_type: newType,
        birth_date: newBirthDate,
        gender: newType === "CHILD" ? newGender : null,
        mother_id:
          newType === "CHILD" && newMotherId ? parseInt(newMotherId, 10) : null,
        village_name: newVillage,
        posyandu_name: newPosyandu,
      };
      await api.post("/patients/", payload);
      alert("Pasien baru berhasil didaftarkan!");
      setShowCreateModal(false);
      setNewName("");
      setNewNik("");
      setNewBirthDate("");
      setNewMotherId("");
      fetchPatients();
    } catch (err) {
      alert(getErrorMessage(err, "Gagal menambahkan pasien."));
    }
  };

  const filtered = patients.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.nik.includes(search),
  );

  const INPUT_CLASS =
    "w-full h-11 px-3.5 bg-subtle border border-line rounded-xl text-sm text-heading placeholder:text-dim focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500 focus:bg-card transition-all duration-200";

  const SELECT_CLASS =
    "w-full h-11 pl-3.5 pr-11 bg-subtle border border-line rounded-xl text-sm text-heading focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500 focus:bg-card transition-all duration-200 has-custom-chevron appearance-none cursor-pointer";

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-line-light">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-heading tracking-tight">
            Kelola Data Pasien (Admin Puskesmas)
          </h1>
          <p className="text-sm text-caption mt-1">
            Manajemen direktori pasien, relasi Ibu-Anak lintas fase, dan progres monitoring 1.000 HPK
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-interactive flex items-center gap-2 px-4 py-2.5 bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white rounded-xl text-xs sm:text-sm font-bold shadow-sm hover:shadow-md transition-all duration-200"
        >
          <Plus className="w-4 h-4" />
          Tambah Pasien Baru
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-dim absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Cari nama atau NIK pasien..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-10 pr-4 bg-card border border-line rounded-xl text-sm text-heading placeholder:text-dim focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500 transition-all"
          />
        </div>

        <div className="relative min-w-[200px]">
          <select
            value={villageFilter}
            onChange={(e) => setVillageFilter(e.target.value)}
            className="w-full h-10 has-custom-chevron appearance-none pl-3.5 pr-11 bg-card border border-line rounded-xl text-sm font-medium text-heading focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500 transition-all cursor-pointer"
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
          <ChevronDown className="w-4 h-4 text-dim absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {selectedIds.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 rounded-2xl animate-fade-in shadow-sm">
          <div className="flex items-center gap-2.5 text-xs sm:text-sm font-semibold text-sky-800 dark:text-sky-200">
            <span className="px-2.5 py-1 bg-sky-600 text-white rounded-lg text-xs font-bold shadow-sm">
              {selectedIds.length}
            </span>
            <span>Pasien terpilih untuk dihapus</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-medium text-caption hover:bg-muted hover:text-heading transition-colors"
            >
              Batal Pilihan
            </button>
            <button
              type="button"
              onClick={handleBulkDelete}
              disabled={deletingBulk}
              className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 disabled:opacity-50 text-white rounded-xl text-xs sm:text-sm font-bold shadow-sm transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {deletingBulk
                ? "Menghapus..."
                : `Hapus ${selectedIds.length} Pasien Terpilih`}
            </button>
          </div>
        </div>
      )}

      <div className="bg-card rounded-2xl border border-line shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm text-left">
            <thead className="bg-muted text-label border-b border-line text-xs font-semibold uppercase tracking-wider">
              <tr>
                <th className="p-3.5 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={
                      filtered.length > 0 &&
                      selectedIds.length === filtered.length
                    }
                    onChange={handleToggleAll}
                    className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-line cursor-pointer"
                    aria-label="Pilih semua pasien"
                  />
                </th>
                <th className="p-3.5">ID</th>
                <th className="p-3.5">Nama & NIK</th>
                <th className="p-3.5">Tipe & Relasi Ibu-Anak</th>
                <th className="p-3.5">Progres 1.000 HPK</th>
                <th className="p-3.5">Tanggal Lahir</th>
                <th className="p-3.5">Desa / Posyandu</th>
                <th className="p-3.5 text-center">Aksi Administrator</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-light">
              {loading ? (
                <tr>
                  <td colSpan="8" className="p-6 text-center text-dim text-sm">
                    Memuat data pasien...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan="8"
                    className="p-6 text-center text-dim text-sm italic"
                  >
                    Tidak ada data pasien yang ditemukan.
                  </td>
                </tr>
              ) : (
                filtered.map((p) => (
                  <tr
                    key={p.id}
                    className={`table-row-interactive hover:bg-accent-sky transition-colors duration-150 ${
                      selectedIds.includes(p.id)
                        ? "bg-sky-50/60 dark:bg-sky-950/20"
                        : ""
                    }`}
                  >
                    <td
                      className="p-3.5 text-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(p.id)}
                        onChange={() => handleToggleRow(p.id)}
                        className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-line cursor-pointer"
                        aria-label={`Pilih pasien ${p.name}`}
                      />
                    </td>
                    <td className="p-3.5 text-dim font-bold text-xs sm:text-sm">
                      #{p.id}
                    </td>
                    <td className="p-3.5">
                      <p className="font-bold text-heading text-sm">{p.name}</p>
                      <p className="text-xs text-dim font-mono mt-0.5">
                        NIK: {p.nik}
                      </p>
                    </td>
                    <td className="p-3.5">
                      <div className="flex flex-col items-start gap-1">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                            p.patient_type === "MOTHER"
                              ? "bg-pink-50 text-pink-700 dark:bg-pink-950/60 dark:text-pink-300 border-pink-200 dark:border-pink-800"
                              : "bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border-sky-200 dark:border-sky-800"
                          }`}
                        >
                          {p.patient_type === "MOTHER"
                            ? "Ibu Hamil"
                            : `Anak (${p.gender || "-"})`}
                        </span>
                        {p.patient_type === "CHILD" && p.mother_name && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-pink-700 dark:text-pink-300">
                            <Heart className="w-3 h-3" /> Ibu: {p.mother_name}
                          </span>
                        )}
                        {p.patient_type === "MOTHER" && p.children_count > 0 && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-sky-700 dark:text-sky-300">
                            <Baby className="w-3 h-3" /> {p.children_count} Anak Terhubung
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-3.5">
                      {p.hpk_status ? (
                        <div className="min-w-[140px]">
                          <div className="flex items-center justify-between text-xs font-bold text-sky-700 dark:text-sky-300 mb-1">
                            <span>Hari ke-{p.hpk_status.hpk_day} / 1000</span>
                            <span>{p.hpk_status.progress_percent}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden border border-line-light">
                            <div
                              className="h-full bg-gradient-to-r from-pink-500 via-amber-500 to-sky-500 rounded-full"
                              style={{
                                width: `${Math.min(100, Math.max(3, p.hpk_status.progress_percent || 5))}%`,
                              }}
                            />
                          </div>
                          <p className="text-xs text-caption mt-0.5 truncate">
                            {p.hpk_status.phase_label}
                          </p>
                        </div>
                      ) : (
                        <span className="text-xs text-dim">-</span>
                      )}
                    </td>
                    <td className="p-3.5 text-body text-xs sm:text-sm">
                      {p.birth_date}
                    </td>
                    <td className="p-3.5 text-body">
                      <p className="font-semibold text-heading text-xs sm:text-sm">
                        {p.village_name || "-"}
                      </p>
                      <p className="text-xs text-caption mt-0.5">
                        {p.posyandu_name || "-"}
                      </p>
                    </td>
                    <td className="p-3.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(p)}
                          className="btn-interactive p-1.5 text-sky-600 dark:text-sky-400 hover:bg-accent-sky rounded-lg transition-colors duration-150 cursor-pointer"
                          title="Edit Data Pasien"
                          aria-label={`Edit data ${p.name}`}
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(p.id, p.name)}
                          className="btn-interactive p-1.5 text-rose-600 dark:text-rose-400 hover:bg-accent-red rounded-lg transition-colors duration-150 cursor-pointer"
                          title="Hapus Pasien"
                          aria-label={`Hapus pasien ${p.name}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL EDIT PASIEN */}
      {editingPatient && (
        <div
          className="fixed inset-0 bg-black/60 dark:bg-black/80 flex items-center justify-center p-4 z-50 animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditingPatient(null);
          }}
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-card border border-line rounded-2xl max-w-lg w-full p-6 shadow-prominent space-y-4 animate-scale-in">
            <div className="flex justify-between items-center border-b border-line pb-3">
              <h3 className="text-base font-bold text-heading">
                Edit Data Pasien: {editingPatient.name}
              </h3>
              <button
                onClick={() => setEditingPatient(null)}
                className="p-1.5 text-dim hover:text-heading hover:bg-muted rounded-xl transition-colors duration-200 cursor-pointer"
                aria-label="Tutup modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-caption mb-1.5">
                    Nama Pasien
                  </label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className={INPUT_CLASS}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-caption mb-1.5">
                    NIK (Nomor Induk)
                  </label>
                  <input
                    type="text"
                    required
                    value={editNik}
                    onChange={(e) => setEditNik(e.target.value)}
                    className={INPUT_CLASS}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-caption mb-1.5">
                    Tanggal Lahir
                  </label>
                  <input
                    type="date"
                    required
                    value={editBirthDate}
                    onChange={(e) => setEditBirthDate(e.target.value)}
                    className={INPUT_CLASS}
                  />
                </div>
                {editingPatient.patient_type === "CHILD" && (
                  <div>
                    <label className="block text-xs font-semibold text-caption mb-1.5">
                      Jenis Kelamin
                    </label>
                    <div className="relative">
                      <select
                        value={editGender}
                        onChange={(e) => setEditGender(e.target.value)}
                        className={SELECT_CLASS}
                      >
                        <option value="L">Laki-laki (L)</option>
                        <option value="P">Perempuan (P)</option>
                      </select>
                      <ChevronDown className="w-4 h-4 text-dim absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>
                )}
              </div>

              {editingPatient.patient_type === "CHILD" && (
                <div>
                  <label className="block text-xs font-semibold text-caption mb-1.5">
                    Relasi Ibu Kandung (Kontinuitas 1.000 HPK)
                  </label>
                  <div className="relative">
                    <select
                      value={editMotherId}
                      onChange={(e) => setEditMotherId(e.target.value)}
                      className={SELECT_CLASS}
                    >
                      <option value="">-- Tidak Terhubung / Pilih Ibu Kandung --</option>
                      {motherList.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} (NIK: {m.nik})
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-dim absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-caption mb-1.5">
                    Desa / Kelurahan
                  </label>
                  <div className="relative">
                    <select
                      value={editVillage}
                      onChange={(e) => setEditVillage(e.target.value)}
                      className={SELECT_CLASS}
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
                    <ChevronDown className="w-4 h-4 text-dim absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-caption mb-1.5">
                    Posyandu
                  </label>
                  <input
                    type="text"
                    placeholder="Nama Posyandu..."
                    value={editPosyandu}
                    onChange={(e) => setEditPosyandu(e.target.value)}
                    className={INPUT_CLASS}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-line">
                <button
                  type="button"
                  onClick={() => setEditingPatient(null)}
                  className="btn-interactive px-4 py-2.5 border border-line rounded-xl text-sm font-medium text-caption hover:bg-muted hover:text-heading transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn-interactive flex items-center gap-1.5 px-5 py-2.5 bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white rounded-xl text-sm font-semibold shadow-xs transition-colors cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CREATE PASIEN */}
      {showCreateModal && (
        <div
          className="fixed inset-0 bg-black/60 dark:bg-black/80 flex items-center justify-center p-4 z-50 animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowCreateModal(false);
          }}
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-card border border-line rounded-2xl max-w-lg w-full p-6 shadow-prominent space-y-4 animate-scale-in">
            <div className="flex justify-between items-center border-b border-line pb-3">
              <h3 className="text-base font-bold text-heading">
                Registrasi Pasien Baru (Admin)
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 text-dim hover:text-heading hover:bg-muted rounded-xl transition-colors duration-200 cursor-pointer"
                aria-label="Tutup modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePatient} className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-caption mb-1.5">
                    Tipe Pasien
                  </label>
                  <div className="relative">
                    <select
                      value={newType}
                      onChange={(e) => setNewType(e.target.value)}
                      className={SELECT_CLASS}
                    >
                      <option value="CHILD">Anak / Bayi</option>
                      <option value="MOTHER">Ibu Hamil</option>
                    </select>
                    <ChevronDown className="w-4 h-4 text-dim absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-caption mb-1.5">
                    Nama Pasien
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Nama lengkap..."
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className={INPUT_CLASS}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-caption mb-1.5">
                    NIK
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Nomor Induk Kependudukan..."
                    value={newNik}
                    onChange={(e) => setNewNik(e.target.value)}
                    className={INPUT_CLASS}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-caption mb-1.5">
                    Tanggal Lahir
                  </label>
                  <input
                    type="date"
                    required
                    value={newBirthDate}
                    onChange={(e) => setNewBirthDate(e.target.value)}
                    className={INPUT_CLASS}
                  />
                </div>
              </div>

              {newType === "CHILD" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-caption mb-1.5">
                      Jenis Kelamin
                    </label>
                    <div className="relative">
                      <select
                        value={newGender}
                        onChange={(e) => setNewGender(e.target.value)}
                        className={SELECT_CLASS}
                      >
                        <option value="L">Laki-laki (L)</option>
                        <option value="P">Perempuan (P)</option>
                      </select>
                      <ChevronDown className="w-4 h-4 text-dim absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-caption mb-1.5">
                      Ibu Kandung (Relasi 1.000 HPK)
                    </label>
                    <div className="relative">
                      <select
                        value={newMotherId}
                        onChange={(e) => setNewMotherId(e.target.value)}
                        className={SELECT_CLASS}
                      >
                        <option value="">-- Pilih Ibu Kandung --</option>
                        {motherList.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} ({m.nik})
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="w-4 h-4 text-dim absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-caption mb-1.5">
                    Desa / Kelurahan
                  </label>
                  <div className="relative">
                    <select
                      value={newVillage}
                      onChange={(e) => setNewVillage(e.target.value)}
                      className={SELECT_CLASS}
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
                    <ChevronDown className="w-4 h-4 text-dim absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-caption mb-1.5">
                    Posyandu
                  </label>
                  <input
                    type="text"
                    placeholder="Posyandu Mawar..."
                    value={newPosyandu}
                    onChange={(e) => setNewPosyandu(e.target.value)}
                    className={INPUT_CLASS}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-line">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn-interactive px-4 py-2.5 border border-line rounded-xl text-sm font-medium text-caption hover:bg-muted hover:text-heading transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn-interactive px-5 py-2.5 bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white rounded-xl text-sm font-semibold shadow-xs transition-colors cursor-pointer"
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

export default ManagePasien;
