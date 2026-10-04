import os
from jinja2 import Environment, FileSystemLoader
from typing import Dict, Any

TEMPLATES_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "templates")
)
OUTPUT_PDF_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "generated_reports")
)
os.makedirs(OUTPUT_PDF_DIR, exist_ok=True)


def generate_visit_report_pdf(
    report_data: Dict[str, Any],
    visit_date: str,
    kader_name: str,
    validated_date: str,
    filename: str
) -> str:
    """
    Mengubah data laporan JSON menjadi dokumen PDF menggunakan template HTML & WeasyPrint.
    """
    env = Environment(loader=FileSystemLoader(TEMPLATES_DIR))
    template = env.get_template("report_kader.html")

    html_out = template.render(
        report_data=report_data,
        visit_date=visit_date,
        kader_name=kader_name,
        validated_date=validated_date
    )

    pdf_filepath = os.path.join(OUTPUT_PDF_DIR, filename)
    html_filepath = pdf_filepath.replace(".pdf", ".html")

    # Selalu simpan file HTML sebagai cadangan
    with open(html_filepath, "w", encoding="utf-8") as f:
        f.write(html_out)

    try:
        from weasyprint import HTML
        HTML(string=html_out).write_pdf(pdf_filepath)
        return pdf_filepath
    except Exception as e:
        print(f"[PDF SERVICE WARNING] WeasyPrint runtime notice: {e}. File HTML tersimpan di {html_filepath}")
        return html_filepath

