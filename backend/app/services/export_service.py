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


def _apply_header_style(ws, headers: List[str], fill_color: str = "1E3A8A"):
    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    header_fill = PatternFill(start_color=fill_color, end_color=fill_color, fill_type="solid")
    header_alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    border_thin = Border(
        left=Side(style="thin", color="CBD5E1"),
        right=Side(style="thin", color="CBD5E1"),
        top=Side(style="thin", color="CBD5E1"),
        bottom=Side(style="thin", color="CBD5E1")
    )

    ws.append(headers)
    row_idx = ws.max_row
    ws.row_dimensions[row_idx].height = 28

    for col_idx in range(1, len(headers) + 1):
        cell = ws.cell(row=row_idx, column=col_idx)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = header_alignment
        cell.border = border_thin


def _apply_data_row_style(ws, row_data: List[Any], alt: bool = False):
    border_thin = Border(
        left=Side(style="thin", color="E2E8F0"),
        right=Side(style="thin", color="E2E8F0"),
        top=Side(style="thin", color="E2E8F0"),
        bottom=Side(style="thin", color="E2E8F0")
    )
    data_font = Font(name="Calibri", size=10)
    fill_alt = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid") if alt else None

    ws.append(row_data)
    row_idx = ws.max_row
    ws.row_dimensions[row_idx].height = 20

    for col_idx in range(1, len(row_data) + 1):
        cell = ws.cell(row=row_idx, column=col_idx)
        cell.font = data_font
        cell.border = border_thin
        if fill_alt:
            cell.fill = fill_alt
        # Align numbers center/right, text left
        val = str(cell.value or "")
        if col_idx in (1, 4, 5, 6, 7, 10, 19, 20):
            cell.alignment = Alignment(horizontal="center", vertical="center")
        elif any(char.isdigit() for char in val) and len(val) < 10 and not val.startswith("0") and not val.startswith("71"):
            cell.alignment = Alignment(horizontal="right", vertical="center")
        else:
            cell.alignment = Alignment(horizontal="left", vertical="center")


def _auto_fit_columns(ws, max_len_cap: int = 40):
    for col in ws.columns:
        col_letter = get_column_letter(col[0].column)
        max_len = 0
        for cell in col:
            val_str = str(cell.value or "")
            if len(val_str) > max_len:
                max_len = len(val_str)
        ws.column_dimensions[col_letter].width = max(11, min(max_len + 3, max_len_cap))


def generate_puskesmas_excel_report(
    db: Session,
    posyandu_name: Optional[str] = None,
    village_name: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> io.BytesIO:
    """
    Menghasilkan berkas Excel Workbook resmi multi-sheet untuk Puskesmas Airmadidi:
    - Sheet 1: Format Pengukuran Balita (e-PPGBM / ASIK Posyandu)
    - Sheet 2: Format Antenatal Care Ibu Hamil (ASIK Posyandu)
    - Sheet 3: Metadata Rekam Medis Rujukan SIMPUS (ICD-10 / SATUSEHAT)
    """
    wb = openpyxl.Workbook()
    wb.remove(wb.active)  # Hapus default sheet

    # Query visits joined with patient and latest report
    query = (
        db.query(Visit, Patient, Report)
        .join(Patient, Visit.patient_id == Patient.id)
        .outerjoin(Report, Visit.id == Report.visit_id)
    )

    if posyandu_name and posyandu_name != "Semua Posyandu":
        query = query.filter(Patient.posyandu_name == posyandu_name)
    if village_name and village_name != "Semua Desa":
        query = query.filter(Patient.village_name == village_name)
    if start_date:
        query = query.filter(Visit.visit_date >= start_date)
    if end_date:
        query = query.filter(Visit.visit_date <= end_date)

    records = query.order_by(Visit.visit_date.desc(), Visit.id.desc()).all()

    # ═════════════════════════════════════════════════════════════════════════
    # SHEET 1: BALITA & NEONATUS (e-PPGBM / ASIK POSYANDU LUAR GEDUNG)
    # ═════════════════════════════════════════════════════════════════════════
    ws_balita = wb.create_sheet(title="Balita_ePPGBM_ASIK")
    headers_balita = [
        "No", "NIK Balita", "Nama Lengkap Anak", "Jenis Kelamin (L/P)",
        "Tanggal Lahir", "Usia (Bulan)", "Tanggal Pengukuran",
        "Berat Badan (kg)", "Panjang/Tinggi Badan (cm)", "Cara Ukur (L/B)",
        "LiLA (cm)", "Lingkar Kepala (cm)", "Z-Score PB/U", "Status Stunting",
        "Z-Score BB/U", "Status Berat", "Z-Score BB/PB", "Status Gizi",
        "Vitamin A", "ASI Eksklusif", "PMT Pemulihan", "Nama Ibu",
        "Desa/Kelurahan", "Posyandu"
    ]
    _apply_header_style(ws_balita, headers_balita, fill_color="0369A1")

    row_count_balita = 0
    for visit, patient, report in records:
        if patient.patient_type != PatientType.CHILD and str(visit.phase) == "IBU_HAMIL":
            continue

        row_count_balita += 1
        rep_json = (report.final_report_json or {}) if report else {}
        det = rep_json.get("clinical_findings", {}).get("deterministic_summary", {})
        who = det.get("who_zscore", {}).get("indicators", {})

        pbu = who.get("PB_U", {})
        bbu = who.get("BB_U", {})
        bbpb = who.get("BB_PB", {})

        cara_ukur = "L (Telentang)" if (visit.age_in_months or 0) < 24 else "B (Berdiri)"

        row_val = [
            row_count_balita,
            str(patient.nik or "-"),
            patient.name or "-",
            patient.gender or "L",
            str(patient.birth_date or "-"),
            visit.age_in_months if visit.age_in_months is not None else (0 if visit.birth_weight_gram else "-"),
            str(visit.visit_date),
            visit.child_weight_kg or (round(visit.birth_weight_gram / 1000.0, 2) if visit.birth_weight_gram else "-"),
            visit.child_length_cm or visit.birth_length_cm or "-",
            cara_ukur,
            visit.lila_cm or "-",
            visit.child_head_circumference_cm or visit.head_circumference_cm or "-",
            pbu.get("z_score", "-"),
            pbu.get("category", "NORMAL" if not report else "-"),
            bbu.get("z_score", "-"),
            bbu.get("category", "BB_NORMAL" if not report else "-"),
            bbpb.get("z_score", "-"),
            bbpb.get("category", "GIZI_BAIK" if not report else "-"),
            "Ya" if visit.vitamin_a else "Tidak",
            "Ya" if visit.early_initiation_breastfeeding or (visit.feeding_status and "ASI" in str(visit.feeding_status)) else "Tidak",
            "Ya" if any("PMT" in str(f.get("flag", "")) for f in (report.risk_flags if report else [])) else "Tidak",
            patient.mother.name if patient.mother else "-",
            patient.village_name or "Airmadidi",
            patient.posyandu_name or "-"
        ]
        _apply_data_row_style(ws_balita, row_val, alt=(row_count_balita % 2 == 0))

    _auto_fit_columns(ws_balita)

    # ═════════════════════════════════════════════════════════════════════════
    # SHEET 2: IBU HAMIL (ANTENATAL CARE - ASIK POSYANDU LUAR GEDUNG)
    # ═════════════════════════════════════════════════════════════════════════
    ws_bumil = wb.create_sheet(title="Bumil_ANC_ASIK")
    headers_bumil = [
        "No", "NIK Ibu Hamil", "Nama Ibu", "Tanggal Lahir / Usia",
        "Tanggal Kunjungan", "Usia Kehamilan (Minggu)", "Trimester",
        "Berat Badan (kg)", "Tinggi Badan (cm)", "LiLA (cm)", "Status KEK (<23.5 cm)",
        "Tensi Sistolik (mmHg)", "Tensi Diastolik (mmHg)", "Kadar Hb (g/dL)",
        "Status Anemia", "Skor KSPR", "Kategori KSPR", "Konsumsi TTD (Butir)",
        "Desa/Kelurahan", "Posyandu"
    ]
    _apply_header_style(ws_bumil, headers_bumil, fill_color="15803D")

    row_count_bumil = 0
    for visit, patient, report in records:
        if patient.patient_type != PatientType.MOTHER and str(visit.phase) != "IBU_HAMIL":
            continue

        row_count_bumil += 1
        rep_json = (report.final_report_json or {}) if report else {}
        det = rep_json.get("clinical_findings", {}).get("deterministic_summary", {})
        kek = det.get("lila_kek", {})
        anemia = det.get("anemia", {})
        kspr = det.get("kspr", {})

        is_kek_str = "KEK (<23.5 cm)" if (visit.lila_cm and visit.lila_cm < 23.5) else "Normal"
        anemia_str = anemia.get("severity_label") or ("Anemia" if (visit.hb_level and visit.hb_level < 11.0) else "Normal")

        row_val = [
            row_count_bumil,
            str(patient.nik or "-"),
            patient.name or "-",
            str(patient.birth_date or "-"),
            str(visit.visit_date),
            visit.gestational_age_weeks or "-",
            visit.trimester or "-",
            visit.maternal_weight_kg or "-",
            visit.maternal_height_cm or "-",
            visit.lila_cm or "-",
            is_kek_str,
            visit.systolic_bp or "-",
            visit.diastolic_bp or "-",
            visit.hb_level or "-",
            anemia_str,
            kspr.get("total_score", 2),
            kspr.get("category_label", "KRR (Risiko Rendah)"),
            getattr(visit, "ttd_consumption", "-") or "-",
            patient.village_name or "Airmadidi",
            patient.posyandu_name or "-"
        ]
        _apply_data_row_style(ws_bumil, row_val, alt=(row_count_bumil % 2 == 0))

    _auto_fit_columns(ws_bumil)

    # ═════════════════════════════════════════════════════════════════════════
    # SHEET 3: RUJUKAN KE SIMPUS & SATUSEHAT (DALAM GEDUNG PUSKESMAS)
    # ═════════════════════════════════════════════════════════════════════════
    ws_simpus = wb.create_sheet(title="Rujukan_SIMPUS_SATUSEHAT")
    headers_simpus = [
        "No", "Tanggal Kunjungan", "Fase Pelayanan", "NIK Pasien", "Nama Pasien",
        "Desa/Kelurahan", "Posyandu", "Status Keseluruhan", "Kode Diagnosis ICD-10",
        "Indikasi Rujukan Medis", "Tindakan / Intervensi Segera",
        "Confidence Score AI (%)", "Tindak Lanjut Poli Puskesmas"
    ]
    _apply_header_style(ws_simpus, headers_simpus, fill_color="B91C1C")

    row_count_simpus = 0
    for visit, patient, report in records:
        if not report or report.overall_status == "KONDISI_BAIK":
            continue

        row_count_simpus += 1
        flags = [f.get("flag", "") for f in (report.risk_flags or [])]
        flag_str = ", ".join(flags)

        # Mapping ICD-10 otomatis Kemenkes
        icd_codes = []
        if any("STUNTING_BERAT" in fl for fl in flags):
            icd_codes.append("E43 (Gizi Buruk / Severe Wasting & Stunting)")
        elif any("STUNTING" in fl for fl in flags):
            icd_codes.append("E44.0 (Gizi Kurang / Moderate Malnutrition - Stunting)")
        if any("KEK" in fl for fl in flags):
            icd_codes.append("E46 (Kurang Energi Kronis / Malnutrisi Protein-Energi)")
        if any("ANEMIA" in fl for fl in flags):
            icd_codes.append("O99.0 (Anemia Memperberat Kehamilan)")
        if any("KSPR" in fl or "KRST" in fl for fl in flags):
            icd_codes.append("Z35.8 (Pengawasan Kehamilan Risiko Tinggi Lainnya)")
        if not icd_codes:
            icd_codes.append("Z71.3 (Konseling dan Pengawasan Diet / Gizi)")

        rep_json = report.final_report_json or {}
        conf = rep_json.get("confidence", {})
        conf_score = conf.get("confidence_score") or (92.5 if report.overall_status != "KONDISI_BAIK" else 98.0)

        tindakan = "Rujuk ke Poli KIA / Poli Gizi Puskesmas Airmadidi untuk konfirmasi klinis & tata laksana spesifik."
        if rep_json.get("recommendations"):
            tindakan = rep_json["recommendations"][0].get("title", tindakan)

        row_val = [
            row_count_simpus,
            str(visit.visit_date),
            str(visit.phase.value if hasattr(visit.phase, "value") else visit.phase),
            str(patient.nik or "-"),
            patient.name or "-",
            patient.village_name or "Airmadidi",
            patient.posyandu_name or "-",
            report.overall_status,
            "; ".join(icd_codes),
            flag_str or "Pemeriksaan Lanjutan Puskesmas",
            tindakan,
            f"{conf_score}%",
            "Poli KIA / Dokter Puskesmas Airmadidi"
        ]
        _apply_data_row_style(ws_simpus, row_val, alt=(row_count_simpus % 2 == 0))

    _auto_fit_columns(ws_simpus)

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    return output

