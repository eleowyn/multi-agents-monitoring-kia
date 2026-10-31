import os
import re
from jinja2 import Environment, FileSystemLoader
from typing import Dict, Any, Optional

TEMPLATES_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "templates")
)
OUTPUT_PDF_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "generated_reports")
)
os.makedirs(OUTPUT_PDF_DIR, exist_ok=True)

PHASE_LABELS = {
    "IBU_HAMIL": "Ibu Hamil",
    "BAYI_BARU_LAHIR": "Bayi Baru Lahir (0 - 28 Hari)",
    "BADUTA": "Baduta (1 - 24 Bulan)",
}

RISK_LABELS = {
    "RISIKO_KEHAMILAN_SANGAT_TINGGI_KRST": "Kehamilan Risiko Sangat Tinggi (KRST)",
    "RISIKO_KEHAMILAN_TINGGI_KRT": "Kehamilan Risiko Tinggi (KRT)",
    "KEHAMILAN_RISIKO_RENDAH_KRR": "Kehamilan Risiko Rendah (KRR)",
    "STUNTING_SEVERELY_STUNTED": "Sangat Pendek / Severely Stunted (PB/U < -3 SD)",
    "STUNTING_STUNTED": "Pendek / Stunted (PB/U -3 SD s.d. < -2 SD)",
    "RISIKO_STUNTING_BERAT": "Sangat Pendek / Severely Stunted (PB/U < -3 SD)",
    "RISIKO_STUNTING": "Pendek / Stunted (PB/U -3 SD s.d. < -2 SD)",
    "GIZI_BURUK_SEVERELY_UNDERWEIGHT": "Berat Badan Sangat Kurang (BB/U < -3 SD)",
    "GIZI_KURANG_UNDERWEIGHT": "Berat Badan Kurang / Underweight (BB/U -3 s.d. < -2 SD)",
    "RISIKO_GIZI_BURUK": "Gizi Buruk / Severely Wasted (BB/PB < -3 SD)",
    "RISIKO_GIZI_KURANG": "Gizi Kurang / Wasted (BB/PB -3 s.d. < -2 SD)",
    "WASTING_SEVERELY_WASTED": "Gizi Buruk / Severely Wasted (BB/PB < -3 SD)",
    "WASTING_WASTED": "Gizi Kurang / Wasted (BB/PB -3 s.d. < -2 SD)",
    "ANEMIA_BERAT": "Anemia Berat (Hb < 8.0 g/dL)",
    "ANEMIA_SEDANG": "Anemia Sedang (Hb 8.0 - 9.9 g/dL)",
    "ANEMIA_RINGAN": "Anemia Ringan (Hb 10.0 - 10.9 g/dL)",
    "RISIKO_ANEMIA_BERAT": "Anemia Berat Maternal",
    "RISIKO_ANEMIA_SEDANG": "Anemia Sedang Maternal",
    "RISIKO_ANEMIA_RINGAN": "Anemia Ringan Maternal",
    "RISIKO_KEK": "Kurang Energi Kronis / KEK (LiLA < 23.5 cm)",
    "RISIKO_KEK_MATERNAL": "Kurang Energi Kronis / KEK (LiLA < 23.5 cm)",
    "BBLR": "Berat Bayi Lahir Rendah (< 2.500 g)",
    "RISIKO_BBLR": "Berat Bayi Lahir Rendah (< 2.500 g)",
    "BBLSR": "Berat Bayi Lahir Sangat Rendah (< 1.500 g)",
    "PREMATUR": "Kelahiran Prematur (< 37 Minggu)",
    "RISIKO_PREMATUR": "Kelahiran Prematur (< 37 Minggu)",
    "BB_TIDAK_NAIK_KMS": "Berat Badan Tidak Naik (KMS)",
    "BB_TIDAK_NAIK_2T": "Berat Badan Tidak Naik 2x Berturut-turut (2T)",
    "BB_IBU_HAMIL_TURUN": "Penurunan Berat Badan Ibu Hamil Antar Kunjungan",
    "RIWAYAT_IBU_KEK": "Riwayat Maternal Ibu KEK Saat Hamil",
    "RIWAYAT_IBU_ANEMIA": "Riwayat Maternal Ibu Anemia Saat Hamil",
    "RIWAYAT_KEHAMILAN_RISIKO_TINGGI": "Riwayat Obstetri Kehamilan Risiko Tinggi (KSPR)",
    "RIWAYAT_BBLR_ANAK": "Riwayat Kelahiran Anak BBLR (< 2.500 g)",
    "MIKROSEFALI": "Mikrosefali (< -2 SD Lingkar Kepala)",
    "MAKROSEFALI": "Makrosefali (> +2 SD Lingkar Kepala)",
}

STATUS_LABELS = {
    "KONDISI_BAIK": "Kondisi Baik / Normal",
    "PERLU_PERHATIAN": "Perlu Perhatian / Intervensi",
    "RISIKO_TINGGI": "Risiko Tinggi / Rujuk Segera",
}


def human_phase(val: Optional[str]) -> str:
    if not val:
        return "-"
    return PHASE_LABELS.get(str(val), str(val).replace("_", " ").title())


def human_risk(val: Optional[str]) -> str:
    if not val:
        return "-"
    return RISK_LABELS.get(str(val), str(val).replace("_", " ").title())


def human_status(val: Optional[str]) -> str:
    if not val:
        return "-"
    return STATUS_LABELS.get(str(val), str(val).replace("_", " ").title())


def clean_citation(val: Optional[str]) -> str:
    if not val:
        return "Buku KIA Kemenkes RI"
    s = str(val)
    if "Buku_KIA" in s or "buku_kia" in s.lower():
        return "Buku KIA 2024 (Kemenkes RI)"
    if "Stunting" in s or "stunting" in s.lower():
        return "Pedoman Tata Laksana Gizi Buruk & Stunting Kemenkes RI"
    if "Posyandu" in s or "posyandu" in s.lower():
        return "Petunjuk Teknis Posyandu Integrasi Layanan Primer (ILP)"
    cleaned = re.sub(r"\.pdf$", "", s, flags=re.IGNORECASE)
    cleaned = re.sub(r"[\(_\)]", " ", cleaned).strip()
    return cleaned.title()


class PdfEngineUnavailable(RuntimeError):
    """WeasyPrint tidak dapat dimuat (runtime Pango/GTK belum terpasang)."""


def _configure_weasyprint_dlls() -> None:
    """
    WeasyPrint membaca env var WEASYPRINT_DLL_DIRECTORIES saat di-import.
    pydantic-settings tidak menulis nilai .env ke os.environ, jadi kita set manual.
    """
    try:
        from app.core.config import settings
        dll_dirs = settings.WEASYPRINT_DLL_DIRECTORIES
    except Exception:
        dll_dirs = None

    if not dll_dirs:
        default_msys = r"C:\msys64\mingw64\bin"
        if os.name == "nt" and os.path.isdir(default_msys):
            dll_dirs = default_msys

    if dll_dirs:
        os.environ.setdefault("WEASYPRINT_DLL_DIRECTORIES", dll_dirs)


_configure_weasyprint_dlls()


def _load_weasyprint_html():
    try:
        from weasyprint import HTML
        return HTML
    except Exception as e:  # OSError (DLL hilang) atau ImportError
        raise PdfEngineUnavailable(
            "WeasyPrint tidak dapat dimuat. Pastikan MSYS2 + Pango terpasang "
            "(pacman -S mingw-w64-x86_64-pango) dan WEASYPRINT_DLL_DIRECTORIES "
            f"di backend/.env menunjuk ke C:\\msys64\\mingw64\\bin. Detail: {e}"
        ) from e


def _load_logo_data_uri(filename: str) -> str:
    """Membaca file gambar logo di templates/assets dan mengubahnya menjadi data URI base64."""
    import base64

    logo_path = os.path.join(TEMPLATES_DIR, "assets", filename)
    if not os.path.exists(logo_path):
        return ""
    try:
        with open(logo_path, "rb") as f:
            b64 = base64.b64encode(f.read()).decode("ascii")
        return f"data:image/png;base64,{b64}"
    except Exception:
        return ""


def render_report_html(
    report_data: Dict[str, Any],
    visit_date: str,
    kader_name: str,
    validated_date: str,
    visit_data: Optional[Dict[str, Any]] = None
) -> str:
    env = Environment(loader=FileSystemLoader(TEMPLATES_DIR))
    env.filters["human_phase"] = human_phase
    env.filters["human_risk"] = human_risk
    env.filters["human_status"] = human_status
    env.filters["clean_citation"] = clean_citation

    care_plan = (
        (report_data or {}).get("care_plan")
        or (visit_data or {}).get("care_plan")
        or {}
    )

    logo_minut_data_uri = _load_logo_data_uri("logo_minahasa_utara.png")
    logo_puskesmas_data_uri = _load_logo_data_uri("logo_puskesmas_airmadidi.png")

    template = env.get_template("report_kader.html")
    return template.render(
        report_data=report_data,
        visit_date=visit_date,
        kader_name=kader_name,
        validated_date=validated_date,
        visit_data=visit_data or {},
        care_plan=care_plan,
        logo_minut_data_uri=logo_minut_data_uri,
        logo_puskesmas_data_uri=logo_puskesmas_data_uri,
    )


def write_pdf_strict(html_out: str, filename: str) -> str:
    """Render HTML ke PDF dengan WeasyPrint. Raise PdfEngineUnavailable jika gagal."""
    HTML = _load_weasyprint_html()
    if not filename.lower().endswith(".pdf"):
        filename = f"{os.path.splitext(filename)[0]}.pdf"
    pdf_filepath = os.path.join(OUTPUT_PDF_DIR, filename)
    HTML(string=html_out, base_url=TEMPLATES_DIR).write_pdf(pdf_filepath)
    return pdf_filepath


def generate_visit_report_pdf(
    report_data: Dict[str, Any],
    visit_date: str,
    kader_name: str,
    validated_date: str,
    filename: str,
    visit_data: Optional[Dict[str, Any]] = None
) -> str:
    """
    Mengubah data laporan JSON menjadi dokumen PDF resmi menggunakan WeasyPrint.
    Jika runtime WeasyPrint belum tersedia, file HTML disimpan sebagai cadangan
    dan akan di-render ulang menjadi PDF otomatis saat diunduh.
    """
    html_out = render_report_html(report_data, visit_date, kader_name, validated_date, visit_data)

    pdf_filepath = os.path.join(OUTPUT_PDF_DIR, filename)
    html_filepath = os.path.splitext(pdf_filepath)[0] + ".html"

    # Selalu simpan file HTML sebagai cadangan
    with open(html_filepath, "w", encoding="utf-8") as f:
        f.write(html_out)

    try:
        return write_pdf_strict(html_out, filename)
    except Exception as e:
        print(f"[PDF SERVICE WARNING] Gagal membuat PDF: {e}. Cadangan HTML: {html_filepath}")
        return html_filepath


def generate_lb3_kia_pdf(
    report_context: Dict[str, Any],
    filename: str = "Laporan_LB3_KIA_Puskesmas_Airmadidi.pdf"
) -> str:
    """
    Menghasilkan dokumen PDF Rekapitulasi Laporan Bulanan KIA (LB3-KIA)
    standar Kemenkes RI untuk disahkan oleh Dokter Kepala Puskesmas.
    """
    env = Environment(loader=FileSystemLoader(TEMPLATES_DIR))
    logo_minut_data_uri = _load_logo_data_uri("logo_minahasa_utara.png")
    logo_puskesmas_data_uri = _load_logo_data_uri("logo_puskesmas_airmadidi.png")

    template = env.get_template("report_lb3_kia.html")
    html_out = template.render(
        **report_context,
        logo_minut_data_uri=logo_minut_data_uri,
        logo_puskesmas_data_uri=logo_puskesmas_data_uri,
    )

    if not filename.lower().endswith(".pdf"):
        filename = f"{os.path.splitext(filename)[0]}.pdf"
    pdf_filepath = os.path.join(OUTPUT_PDF_DIR, filename)
    html_filepath = os.path.splitext(pdf_filepath)[0] + ".html"

    with open(html_filepath, "w", encoding="utf-8") as f:
        f.write(html_out)

    try:
        return write_pdf_strict(html_out, filename)
    except Exception as e:
        print(f"[PDF LB3-KIA WARNING] WeasyPrint error: {e}. Menggunakan cadangan HTML: {html_filepath}")
        return html_filepath
