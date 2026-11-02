import io
from datetime import datetime
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

from app.models.visit import Visit, PhaseEnum
from app.models.patient import Patient, PatientType
from app.models.report import Report, ReportStatus


# ─────────────────────────────────────────────────────────────────────────────
# STYLING DEFINITIONS (Standar Kemenkes RI / Puskesmas Airmadidi)
# ─────────────────────────────────────────────────────────────────────────────
FONT_KOP_MAIN = Font(name="Calibri", size=13, bold=True, color="0F172A")
FONT_KOP_SUB = Font(name="Calibri", size=10, bold=True, color="334155")
FONT_KOP_META = Font(name="Calibri", size=9, italic=True, color="64748B")

BORDER_THIN = Border(
    left=Side(style="thin", color="CBD5E1"),
    right=Side(style="thin", color="CBD5E1"),
    top=Side(style="thin", color="CBD5E1"),
    bottom=Side(style="thin", color="CBD5E1")
)

FILL_ZEBRA = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")


def _human_pbu(cat: Optional[str]) -> str:
    if not cat:
        return "Normal"
    map_pbu = {
        "SANGAT_PENDEK": "Sangat Pendek (Severely Stunted)",
        "PENDEK": "Pendek (Stunted)",
        "NORMAL": "Normal",
        "TINGGI": "Tinggi",
    }
    return map_pbu.get(cat.upper(), cat)


def _human_bbu(cat: Optional[str]) -> str:
    if not cat:
        return "Normal"
    map_bbu = {
        "BB_SANGAT_KURANG": "Berat Badan Sangat Kurang",
        "BB_KURANG": "Berat Badan Kurang",
        "BB_NORMAL": "Normal",
        "RISIKO_BB_LEBIH": "Risiko Berat Badan Lebih",
    }
    return map_bbu.get(cat.upper(), cat)


def _human_bbpb(cat: Optional[str]) -> str:
    if not cat:
        return "Gizi Baik"
    map_bbpb = {
        "GIZI_BURUK": "Gizi Buruk (Severely Wasted)",
        "GIZI_KURANG": "Gizi Kurang (Wasted)",
        "GIZI_BAIK": "Gizi Baik (Normal)",
        "BERISIKO_GIZI_LEBIH": "Berisiko Gizi Lebih",
        "GIZI_LEBIH": "Gizi Lebih (Overweight)",
        "OBESITAS": "Obesitas",
    }
    return map_bbpb.get(cat.upper(), cat)


def _human_feeding(status: Optional[str]) -> str:
    if not status:
        return "-"
    map_feed = {
        "ASI_EKSKLUSIF": "ASI Eksklusif (0-6 Bulan)",
        "MP_ASI": "ASI + MP-ASI Adekuat",
        "MAKANAN_KELUARGA": "Makanan Keluarga Seimbang + ASI Lanjutan",
        "TIDAK_ADEKUAT": "MP-ASI Kurang Adekuat / Kurang Protein Hewani",
        "FORMULA_PKMK": "Formula Khusus / PKMK Medis",
    }
    return map_feed.get(status.upper(), status.replace("_", " "))


def _create_sheet_header(ws, title_sheet: str, posyandu_filter: str, start_row: int = 1):
    """Menuliskan kop instansi Puskesmas Airmadidi di bagian atas setiap lembar."""
    ws.row_dimensions[start_row].height = 20
    ws.row_dimensions[start_row + 1].height = 22
    ws.row_dimensions[start_row + 2].height = 18
    ws.row_dimensions[start_row + 3].height = 16

    c1 = ws.cell(row=start_row, column=1, value="PEMERINTAH KABUPATEN MINAHASA UTARA - DINAS KESEHATAN")
    c1.font = FONT_KOP_SUB

    c2 = ws.cell(row=start_row + 1, column=1, value="UPTD PUSKESMAS KECAMATAN AIRMADIDI")
    c2.font = FONT_KOP_MAIN

    c3 = ws.cell(row=start_row + 2, column=1, value=title_sheet)
    c3.font = Font(name="Calibri", size=11, bold=True, color="0284C7")

    now_str = datetime.now().strftime("%d-%m-%Y %H:%M")
    pos_label = posyandu_filter if (posyandu_filter and posyandu_filter != "Semua Posyandu") else "Seluruh Posyandu (9 Desa/Kelurahan)"
    c4 = ws.cell(row=start_row + 3, column=1, value=f"Wilayah Pelayanan: {pos_label}  |  Tanggal Unduh: {now_str} WITA  |  Sistem: Multi-Agent KIA 1.000 HPK")
    c4.font = FONT_KOP_META


def _apply_table_header(ws, headers: List[str], header_row: int, fill_color: str):
    ws.row_dimensions[header_row].height = 26
    h_font = Font(name="Calibri", size=10, bold=True, color="FFFFFF")
    h_fill = PatternFill(start_color=fill_color, end_color=fill_color, fill_type="solid")
    h_align = Alignment(horizontal="center", vertical="center", wrap_text=True)

    for col_idx, h_text in enumerate(headers, start=1):
        cell = ws.cell(row=header_row, column=col_idx, value=h_text)
        cell.font = h_font
        cell.fill = h_fill
        cell.alignment = h_align
        cell.border = BORDER_THIN


def _auto_fit_columns(ws, min_row: int = 6, max_len_cap: int = 45):
    """Menyesuaikan lebar kolom dengan padding yang nyaman dibaca."""
    for col in ws.columns:
        col_letter = get_column_letter(col[0].column)
        max_len = 0
        for cell in col:
            if cell.row < min_row:
                continue
            val_str = str(cell.value or "")
            if len(val_str) > max_len:
                max_len = len(val_str)
        ws.column_dimensions[col_letter].width = max(11, min(max_len + 4, max_len_cap))


def generate_puskesmas_excel_report(
    db: Session,
    posyandu_name: Optional[str] = None,
    village_name: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> io.BytesIO:
    """
    Menghasilkan berkas Excel resmi multi-sheet berstandar Dinkes/Kemenkes untuk Puskesmas Airmadidi:
    - Sheet 1: Rekapitulasi Antropometri Balita (Format e-PPGBM / ASIK)
    - Sheet 2: Rekapitulasi Pelayanan ANC Ibu Hamil (Format ASIK)
    - Sheet 3: Rujukan Kasus Berisiko ke SIMPUS & SATUSEHAT (ICD-10)
    """
    wb = openpyxl.Workbook()
    wb.remove(wb.active)  # Hapus default sheet kosong

    # Query kunjungan bergabung dengan pasien dan laporan AI
    query = (
        db.query(Visit, Patient, Report)
        .join(Patient, Visit.patient_id == Patient.id)
        .outerjoin(Report, Visit.id == Report.visit_id)
    )

    if posyandu_name and posyandu_name not in ["Semua Posyandu", ""]:
        query = query.filter(Patient.posyandu_name == posyandu_name)
    if village_name and village_name not in ["Semua Desa", ""]:
        query = query.filter(Patient.village_name == village_name)
    if start_date:
        query = query.filter(Visit.visit_date >= start_date)
    if end_date:
        query = query.filter(Visit.visit_date <= end_date)

    records = query.order_by(Visit.visit_date.desc(), Visit.id.desc()).all()

    # ═════════════════════════════════════════════════════════════════════════
    # SHEET 1: BALITA & NEONATUS (e-PPGBM / ASIK POSYANDU)
    # ═════════════════════════════════════════════════════════════════════════
    ws_balita = wb.create_sheet(title="Balita_ePPGBM_ASIK")
    ws_balita.views.sheetView[0].showGridLines = True
    _create_sheet_header(ws_balita, "REKAPITULASI PEMANTAUAN ANTROPOMETRI BALITA & NEONATUS (e-PPGBM / ASIK)", posyandu_name or "")

    headers_balita = [
        "No", "NIK Balita", "Nama Lengkap Anak", "Jenis Kelamin",
        "Tanggal Lahir", "Usia (Bulan)", "Tanggal Kunjungan",
        "Berat Badan (kg)", "Panjang/Tinggi (cm)", "Cara Ukur",
        "Lingkar Kepala (cm)", "Z-Score PB/U", "Status Stunting (PB/U)",
        "Z-Score BB/U", "Status Berat (BB/U)", "Z-Score BB/PB", "Status Gizi (BB/PB)",
        "Pola Makan / MP-ASI", "Vitamin A", "Inisiasi Menyusu Dini (IMD)",
        "Nama Ibu Kandung", "Desa/Kelurahan", "Posyandu"
    ]
    HEADER_ROW_BALITA = 6
    _apply_table_header(ws_balita, headers_balita, header_row=HEADER_ROW_BALITA, fill_color="1E3A8A")

    row_idx_balita = HEADER_ROW_BALITA
    row_count_balita = 0

    for visit, patient, report in records:
        # Filter ketat: Hanya masukkan pasien anak (Child / Fase Bayi Baru Lahir / Baduta)
        phase_str = str(visit.phase.value if hasattr(visit.phase, "value") else visit.phase)
        if patient.patient_type != PatientType.CHILD and phase_str == "IBU_HAMIL":
            continue

        row_count_balita += 1
        row_idx_balita += 1
        ws_balita.row_dimensions[row_idx_balita].height = 20

        rep_json = (report.final_report_json or {}) if report else {}
        det = rep_json.get("clinical_findings", {}).get("deterministic_summary", {})
        who = det.get("who_zscore", {}).get("indicators", {})

        pbu = who.get("PB_U", {})
        bbu = who.get("BB_U", {})
        bbpb = who.get("BB_PB", {})

        pbu_z = f"{pbu['z_score']:.2f}" if (pbu.get("z_score") is not None and isinstance(pbu.get("z_score"), (int, float))) else "-"
        bbu_z = f"{bbu['z_score']:.2f}" if (bbu.get("z_score") is not None and isinstance(bbu.get("z_score"), (int, float))) else "-"
        bbpb_z = f"{bbpb['z_score']:.2f}" if (bbpb.get("z_score") is not None and isinstance(bbpb.get("z_score"), (int, float))) else "-"

        cara_ukur = "L (Telentang)" if (visit.age_in_months or 0) < 24 else "B (Berdiri)"
        jk_str = "Laki-laki (L)" if patient.gender in ["L", "MALE"] else ("Perempuan (P)" if patient.gender in ["P", "FEMALE"] else "-")

        # Berat badan & panjang badan
        bb_val = visit.child_weight_kg if visit.child_weight_kg is not None else (round(visit.birth_weight_gram / 1000.0, 2) if visit.birth_weight_gram else "-")
        pb_val = visit.child_length_cm if visit.child_length_cm is not None else (visit.birth_length_cm if visit.birth_length_cm else "-")
        lk_val = visit.child_head_circumference_cm if visit.child_head_circumference_cm is not None else (visit.head_circumference_cm if visit.head_circumference_cm else "-")

        data_cols = [
            row_count_balita,
            str(patient.nik or "-"),
            patient.name or "-",
            jk_str,
            str(patient.birth_date or "-"),
            visit.age_in_months if visit.age_in_months is not None else (0 if visit.birth_weight_gram else "-"),
            str(visit.visit_date),
            bb_val,
            pb_val,
            cara_ukur,
            lk_val,
            pbu_z,
            _human_pbu(pbu.get("category")),
            bbu_z,
            _human_bbu(bbu.get("category")),
            bbpb_z,
            _human_bbpb(bbpb.get("category")),
            _human_feeding(visit.feeding_status),
            "Ya (Diberikan)" if visit.vitamin_a in ["Ya", "YA", True] else "Tidak",
            "Ya" if visit.early_initiation_breastfeeding in ["Ya", "YA", True] else "Tidak",
            patient.mother.name if (patient.mother and hasattr(patient.mother, "name")) else (getattr(patient, "mother_name", None) or "-"),
            patient.village_name or "Airmadidi",
            patient.posyandu_name or "-"
        ]

        is_alt = (row_count_balita % 2 == 0)
        for col_idx, val in enumerate(data_cols, start=1):
            cell = ws_balita.cell(row=row_idx_balita, column=col_idx, value=val)
            cell.font = Font(name="Calibri", size=10)
            cell.border = BORDER_THIN
            if is_alt:
                cell.fill = FILL_ZEBRA

            # Explicit format for NIK (Text to prevent scientific notation)
            if col_idx == 2:
                cell.number_format = "@"
                cell.alignment = Alignment(horizontal="center", vertical="center")
            elif col_idx in (1, 4, 5, 6, 7, 10, 12, 14, 16, 19, 20):
                cell.alignment = Alignment(horizontal="center", vertical="center")
            elif col_idx in (8, 9, 11):
                cell.alignment = Alignment(horizontal="right", vertical="center")
            else:
                cell.alignment = Alignment(horizontal="left", vertical="center")

    _auto_fit_columns(ws_balita, min_row=HEADER_ROW_BALITA)

    # ═════════════════════════════════════════════════════════════════════════
    # SHEET 2: IBU HAMIL (ANTENATAL CARE - ASIK POSYANDU)
    # ═════════════════════════════════════════════════════════════════════════
    ws_bumil = wb.create_sheet(title="Bumil_ANC_ASIK")
    ws_bumil.views.sheetView[0].showGridLines = True
    _create_sheet_header(ws_bumil, "REKAPITULASI PELAYANAN ANTENATAL CARE (ANC) IBU HAMIL (ASIK POSYANDU)", posyandu_name or "")

    headers_bumil = [
        "No", "NIK Ibu Hamil", "Nama Ibu", "Tanggal Lahir",
        "Tanggal Kunjungan", "Usia Kehamilan (Minggu)", "Trimester",
        "Berat Badan (kg)", "Tinggi Badan (cm)", "LiLA (cm)", "Status KEK (<23.5 cm)",
        "Tensi Sistolik (mmHg)", "Tensi Diastolik (mmHg)", "Kadar Hb (g/dL)",
        "Status Anemia", "Skor KSPR", "Kategori Risiko Obstetri", "Konsumsi TTD",
        "Desa/Kelurahan", "Posyandu"
    ]
    HEADER_ROW_BUMIL = 6
    _apply_table_header(ws_bumil, headers_bumil, header_row=HEADER_ROW_BUMIL, fill_color="15803D")

    row_idx_bumil = HEADER_ROW_BUMIL
    row_count_bumil = 0

    for visit, patient, report in records:
        # Filter ketat: Hanya masukkan pasien Ibu Hamil
        phase_str = str(visit.phase.value if hasattr(visit.phase, "value") else visit.phase)
        if patient.patient_type != PatientType.MOTHER and phase_str != "IBU_HAMIL":
            continue

        row_count_bumil += 1
        row_idx_bumil += 1
        ws_bumil.row_dimensions[row_idx_bumil].height = 20

        rep_json = (report.final_report_json or {}) if report else {}
        det = rep_json.get("clinical_findings", {}).get("deterministic_summary", {})
        anemia = det.get("anemia", {})
        kspr = det.get("kspr", {})

        is_kek_str = "Kurang Energi Kronis (KEK)" if (visit.lila_cm and visit.lila_cm < 23.5) else "Normal (Non-KEK)"
        anemia_str = anemia.get("severity_label") or ("Anemia" if (visit.hb_level and visit.hb_level < 11.0) else "Normal (Non-Anemia)")

        kspr_cat = kspr.get("category_label")
        if not kspr_cat:
            kspr_cat = "KRR (Risiko Rendah)" if (kspr.get("total_score", 2) == 2) else "KRT (Risiko Tinggi)"

        ttd_str = "Rutin (>=90 Tablet)" if visit.ttd_consumption in ["RUTIN", "YA", "Ya"] else ("Tidak Rutin" if visit.ttd_consumption in ["TIDAK_RUTIN", "TIDAK", "Tidak"] else "-")

        data_cols = [
            row_count_bumil,
            str(patient.nik or "-"),
            patient.name or "-",
            str(patient.birth_date or "-"),
            str(visit.visit_date),
            f"{visit.gestational_age_weeks} mg" if visit.gestational_age_weeks else "-",
            f"Trimester {visit.trimester}" if visit.trimester else "-",
            visit.maternal_weight_kg if visit.maternal_weight_kg is not None else "-",
            visit.maternal_height_cm if visit.maternal_height_cm is not None else "-",
            visit.lila_cm if visit.lila_cm is not None else "-",
            is_kek_str,
            visit.systolic_bp if visit.systolic_bp is not None else "-",
            visit.diastolic_bp if visit.diastolic_bp is not None else "-",
            f"{visit.hb_level:.1f}" if (visit.hb_level is not None and isinstance(visit.hb_level, (int, float))) else "-",
            anemia_str,
            kspr.get("total_score", 2),
            kspr_cat,
            ttd_str,
            patient.village_name or "Airmadidi",
            patient.posyandu_name or "-"
        ]

        is_alt = (row_count_bumil % 2 == 0)
        for col_idx, val in enumerate(data_cols, start=1):
            cell = ws_bumil.cell(row=row_idx_bumil, column=col_idx, value=val)
            cell.font = Font(name="Calibri", size=10)
            cell.border = BORDER_THIN
            if is_alt:
                cell.fill = FILL_ZEBRA

            # Explicit format for NIK
            if col_idx == 2:
                cell.number_format = "@"
                cell.alignment = Alignment(horizontal="center", vertical="center")
            elif col_idx in (1, 4, 5, 6, 7, 10, 12, 13, 14, 16):
                cell.alignment = Alignment(horizontal="center", vertical="center")
            elif col_idx in (8, 9):
                cell.alignment = Alignment(horizontal="right", vertical="center")
            else:
                cell.alignment = Alignment(horizontal="left", vertical="center")

    _auto_fit_columns(ws_bumil, min_row=HEADER_ROW_BUMIL)

    # ═════════════════════════════════════════════════════════════════════════
    # SHEET 3: RUJUKAN KE SIMPUS & SATUSEHAT (DALAM GEDUNG PUSKESMAS)
    # ═════════════════════════════════════════════════════════════════════════
    ws_simpus = wb.create_sheet(title="Rujukan_SIMPUS_SATUSEHAT")
    ws_simpus.views.sheetView[0].showGridLines = True
    _create_sheet_header(ws_simpus, "DAFTAR KASUS BERISIKO & REKOMENDASI RUJUKAN MEDIS PUSKESMAS (SIMPUS / SATUSEHAT)", posyandu_name or "")

    headers_simpus = [
        "No", "Tanggal Kunjungan", "Fase Layanan", "NIK Pasien", "Nama Lengkap Pasien",
        "Desa/Kelurahan", "Posyandu", "Status Klinis", "Diagnosis ICD-10 Resmi",
        "Indikator Deviasi / Faktor Risiko", "Tindakan / Rencana Asuhan Segera",
        "Keyakinan AI (%)", "Poli Tujuan Rujukan"
    ]
    HEADER_ROW_SIMPUS = 6
    _apply_table_header(ws_simpus, headers_simpus, header_row=HEADER_ROW_SIMPUS, fill_color="991B1B")

    row_idx_simpus = HEADER_ROW_SIMPUS
    row_count_simpus = 0

    for visit, patient, report in records:
        if not report or report.overall_status not in ["RISIKO_TINGGI", "PERLU_PERHATIAN"]:
            continue

        row_count_simpus += 1
        row_idx_simpus += 1
        ws_simpus.row_dimensions[row_idx_simpus].height = 24

        flags = [f.get("flag", "") for f in (report.risk_flags or [])]

        # Mapping diagnosis ICD-10 resmi
        icd_codes = []
        if any("STUNTING_BERAT" in fl or "SEVERELY_STUNTED" in fl for fl in flags):
            icd_codes.append("E43 (Gizi Buruk / Severe Wasting & Stunting)")
        elif any("STUNTING" in fl for fl in flags):
            icd_codes.append("E44.0 (Gizi Kurang / Malnutrisi Sedang - Stunting)")
        if any("KEK" in fl for fl in flags):
            icd_codes.append("E46 (Kurang Energi Kronis / Malnutrisi Protein-Energi)")
        if any("ANEMIA" in fl for fl in flags):
            icd_codes.append("O99.0 (Anemia Komplikasi Kehamilan)")
        if any("KSPR" in fl or "KRST" in fl for fl in flags):
            icd_codes.append("Z35.8 (Pengawasan Kehamilan Risiko Tinggi)")
        if any("BBLR" in fl for fl in flags):
            icd_codes.append("P07.1 (Berat Bayi Lahir Rendah / BBLR)")
        if not icd_codes:
            icd_codes.append("Z71.3 (Konseling & Pengawasan Gizi/Diet)")

        # Human risk indicator text
        flag_details = []
        for f in (report.risk_flags or []):
            flag_name = f.get("flag", "")
            if "STUNTING_BERAT" in flag_name or "SEVERELY_STUNTED" in flag_name:
                flag_details.append("Sangat Pendek (PB/U < -3 SD)")
            elif "STUNTING" in flag_name:
                flag_details.append("Pendek (PB/U < -2 SD)")
            elif "KEK" in flag_name:
                flag_details.append("Ibu Hamil KEK (LiLA < 23.5 cm)")
            elif "ANEMIA" in flag_name:
                flag_details.append("Ibu Hamil Anemia (Hb < 11.0 g/dL)")
            elif "KSPR" in flag_name or "KRT" in flag_name:
                flag_details.append("Kehamilan Risiko Tinggi (KRT)")
            elif "BBLR" in flag_name:
                flag_details.append("Riwayat Lahir BBLR (< 2.500 g)")
            elif "2T" in flag_name:
                flag_details.append("BB Tidak Naik 2x Berturut (2T)")
            else:
                flag_details.append(flag_name.replace("_", " "))

        flag_str = "; ".join(flag_details[:3])

        rep_json = report.final_report_json or {}
        conf = rep_json.get("confidence", {})
        conf_score = conf.get("confidence_score") or (92.5 if report.overall_status == "RISIKO_TINGGI" else 95.0)

        tindakan = "Rujuk ke Puskesmas Airmadidi untuk konfirmasi klinis & tata laksana spesifik."
        if rep_json.get("recommendations"):
            first_rec = rep_json["recommendations"][0]
            tindakan = first_rec.get("title") or first_rec.get("recommendation_text") or tindakan

        phase_label = "Ibu Hamil" if str(visit.phase) == "IBU_HAMIL" else ("Bayi Baru Lahir" if str(visit.phase) == "BAYI_BARU_LAHIR" else "Baduta")
        status_label = "Risiko Tinggi" if report.overall_status == "RISIKO_TINGGI" else "Perlu Perhatian"

        data_cols = [
            row_count_simpus,
            str(visit.visit_date),
            phase_label,
            str(patient.nik or "-"),
            patient.name or "-",
            patient.village_name or "Airmadidi",
            patient.posyandu_name or "-",
            status_label,
            "; ".join(icd_codes),
            flag_str or "Pemeriksaan Evaluasi Lanjutan",
            tindakan,
            f"{conf_score:.1f}%",
            "Poli KIA / Poli Gizi Puskesmas Airmadidi"
        ]

        is_alt = (row_count_simpus % 2 == 0)
        for col_idx, val in enumerate(data_cols, start=1):
            cell = ws_simpus.cell(row=row_idx_simpus, column=col_idx, value=val)
            cell.font = Font(name="Calibri", size=10)
            cell.border = BORDER_THIN
            if is_alt:
                cell.fill = FILL_ZEBRA

            # Explicit format for NIK
            if col_idx == 4:
                cell.number_format = "@"
                cell.alignment = Alignment(horizontal="center", vertical="center")
            elif col_idx in (1, 2, 3, 8, 12):
                cell.alignment = Alignment(horizontal="center", vertical="center")
            else:
                cell.alignment = Alignment(horizontal="left", vertical="center")

    _auto_fit_columns(ws_simpus, min_row=HEADER_ROW_SIMPUS)

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    return output
