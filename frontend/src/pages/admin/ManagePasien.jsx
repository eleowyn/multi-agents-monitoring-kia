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
  const [newVillage, setNewVillage] = useState("Airmadidi Atas");
  const [newPosyandu, setNewPosyandu] = useState("");

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
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (
      !window.confirm(
        `Apakah Anda yakin ingin menghapus ${selectedIds.length} data pasien terpilih beserta seluruh rekam kunjungannya? Tindakan ini permanen dan tidak dapat dibatalkan.`
      )
    ) {
      return;
    }
    try {
      setDeletingBulk(true);
      const res = await api.post("/patients/bulk-delete", { ids: selectedIds });
      alert(res.data.message || `${selectedIds.length} pasien berhasil dihapus.`);
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
        village_name: newVillage,
        posyandu_name: newPosyandu,
      };
      await api.post("/patients/", payload);
      alert("Pasien baru berhasil didaftarkan!");
      setShowCreateModal(false);
      setNewName("");
      setNewNik("");
      setNewBirthDate("");
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
    "w-full px-3.5 py-2.5 bg-subtle border border-line rounded-xl text-xs text-heading placeholder:text-dim focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500 focus:bg-card transition-all duration-200";

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-line-light">
        <div>
          <h2 className="text-xl font-bold text-heading">
            Kelola Data Pasien (Admin Puskesmas)
          </h2>
          <p className="text-xs text-caption mt-0.5">
            Otoritas penuh CRUD data induk pasien ibu dan anak di 9 Desa Wilayah
            Kerja Puskesmas Airmadidi
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white rounded-xl text-xs font-bold shadow-sm hover:shadow-md transition-all duration-200"
        >
          <Plus className="w-4 h-4" />
          Tambah Pasien Baru
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Cari nama atau NIK pasien..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-card border border-line rounded-xl text-xs text-heading placeholder:text-dim focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500 transition-all duration-200"
          />
          <Search className="w-4 h-4 text-dim absolute left-3 top-3" />
        </div>

        <select
          value={villageFilter}
          onChange={(e) => setVillageFilter(e.target.value)}
          className="px-3.5 py-2.5 bg-card border border-line rounded-xl text-xs font-medium text-body focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500 transition-all duration-200"
        >
          <option value="">-- Semua Desa (9 Desa) --</option>
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

      {selectedIds.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 rounded-2xl animate-fade-in shadow-sm">
          <div className="flex items-center gap-2.5 text-xs font-semibold text-sky-800 dark:text-sky-200">
            <span className="px-2.5 py-1 bg-sky-600 text-white rounded-lg text-xs font-bold shadow-sm">
              {selectedIds.length}
            </span>
            <span>Pasien terpilih untuk dihapus</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="px-3.5 py-1.5 rounded-xl text-xs font-medium text-caption hover:bg-muted hover:text-heading transition-colors"
            >
              Batal Pilihan
            </button>
            <button
              type="button"
              onClick={handleBulkDelete}
              disabled={deletingBulk}
              className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {deletingBulk ? "Menghapus..." : `Hapus ${selectedIds.length} Pasien Terpilih`}
            </button>
          </div>
        </div>
      )}

      <div className="bg-card rounded-2xl border border-line shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-muted text-label border-b border-line">
              <tr>
                <th className="p-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={filtered.length > 0 && selectedIds.length === filtered.length}
                    onChange={handleToggleAll}
                    className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-line cursor-pointer"
                    aria-label="Pilih semua pasien"
                  />
                </th>
                <th className="p-3">ID</th>
                <th className="p-3">Nama & NIK</th>
                <th className="p-3">Tipe</th>
                <th className="p-3">Tanggal Lahir</th>
                <th className="p-3">Desa / Posyandu</th>
                <th className="p-3 text-center">Aksi Administrator</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-light">
              {loading ? (
                <tr>
                  <td colSpan="7" className="p-6 text-center text-dim">
                    Memuat data pasien...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan="7"
                    className="p-6 text-center text-dim italic"
                  >
                    Tidak ada data pasien yang ditemukan.
                  </td>
                </tr>
              ) : (
                filtered.map((p) => (
                  <tr
                    key={p.id}
                    className={`hover:bg-accent-sky transition-colors duration-150 ${
                      selectedIds.includes(p.id) ? "bg-sky-50/60 dark:bg-sky-950/20" : ""
                    }`}
                  >
                    <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(p.id)}
                        onChange={() => handleToggleRow(p.id)}
                        className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-line cursor-pointer"
                        aria-label={`Pilih pasien ${p.name}`}
                      />
                    </td>
                    <td className="p-3 text-dim font-bold">#{p.id}</td>
                    <td className="p-3">
                      <p className="font-bold text-heading">{p.name}</p>
                      <p className="text-[11px] text-dim">NIK: {p.nik}</p>
                    </td>
                    <td className="p-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          p.patient_type === "MOTHER"
                            ? "bg-accent-pink text-pink-700 dark:text-pink-300 border-pink-200 dark:border-pink-800/50"
                            : "bg-accent-blue text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/50"
                        }`}
                      >
                        {p.patient_type === "MOTHER"
                          ? "Ibu Hamil"
                          : `Anak (${p.gender || "-"})`}
                      </span>
                    </td>
                    <td className="p-3 text-body">{p.birth_date}</td>
                    <td className="p-3 text-body">
                      <p className="font-semibold text-heading">
                        {p.village_name || "-"}
                      </p>
                      <p className="text-[11px] text-caption">
                        {p.posyandu_name || "-"}
                      </p>
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(p)}
                          className="p-1.5 text-sky-600 dark:text-sky-400 hover:bg-accent-sky rounded-lg transition-colors duration-150"
                          title="Edit Data Pasien"
                          aria-label={`Edit data ${p.name}`}
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(p.id, p.name)}
                          className="p-1.5 text-rose-600 dark:text-rose-400 hover:bg-accent-red rounded-lg transition-colors duration-150"
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
              <h3 className="text-base font-bold text-heading flex items-center gap-2">
                <Edit className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                Edit Data Pasien: {editingPatient.name}
              </h3>
              <button
                onClick={() => setEditingPatient(null)}
                className="p-1 text-dim hover:text-heading hover:bg-muted rounded-xl transition-colors duration-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-label mb-1">
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
                  <label className="block font-semibold text-label mb-1">
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
                  <label className="block font-semibold text-label mb-1">
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
                    <label className="block font-semibold text-label mb-1">
                      Jenis Kelamin
                    </label>
                    <select
                      value={editGender}
                      onChange={(e) => setEditGender(e.target.value)}
                      className={INPUT_CLASS}
                    >
                      <option value="L">Laki-laki (L)</option>
                      <option value="P">Perempuan (P)</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-label mb-1">
                    Desa / Kelurahan
                  </label>
                  <select
                    value={editVillage}
                    onChange={(e) => setEditVillage(e.target.value)}
                    className={INPUT_CLASS}
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
                </div>
                <div>
                  <label className="block font-semibold text-label mb-1">Posyandu</label>
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
                  className="px-4 py-2 border border-line rounded-xl text-caption hover:bg-muted hover:text-heading transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white rounded-xl font-bold transition-colors"
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
              <h3 className="text-base font-bold text-heading flex items-center gap-2">
                <Plus className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                Registrasi Pasien Baru (Admin)
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 text-dim hover:text-heading hover:bg-muted rounded-xl transition-colors duration-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePatient} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-label mb-1">
                    Tipe Pasien
                  </label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value)}
                    className={INPUT_CLASS}
                  >
                    <option value="CHILD">Anak / Bayi</option>
                    <option value="MOTHER">Ibu Hamil</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-label mb-1">
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
                  <label className="block font-semibold text-label mb-1">NIK</label>
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
                  <label className="block font-semibold text-label mb-1">
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-label mb-1">
                    Desa / Kelurahan
                  </label>
                  <select
                    value={newVillage}
                    onChange={(e) => setNewVillage(e.target.value)}
                    className={INPUT_CLASS}
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
                </div>
                <div>
                  <label className="block font-semibold text-label mb-1">Posyandu</label>
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
                  className="px-4 py-2 border border-line rounded-xl text-caption hover:bg-muted hover:text-heading transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white rounded-xl font-bold transition-colors"
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
