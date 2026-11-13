"""
Satu sumber hitungan untuk semua dashboard (admin, tren bulanan, kader, Pusat Monitoring).

Aturan hitung:
- Stunting dihitung hanya dari pasien ANAK dengan flag RISIKO_STUNTING / RISIKO_STUNTING_BERAT.
- KEK / Anemia dihitung hanya dari pasien IBU dengan flag RISIKO_KEK_MATERNAL / RISIKO_ANEMIA_*,
  dan hanya bila ibu masih dalam masa kehamilan (belum melahirkan setelah kunjungan tersebut).
  Flag turunan pada anak (RIWAYAT_IBU_KEK, dsb.) tidak ikut dihitung.
- Prevalensi memakai laporan APPROVED terakhir per pasien (sudah divalidasi kader).
- Nama desa dicocokkan persis setelah normalisasi; desa tidak dikenali masuk "Lainnya".
"""
import re
from datetime import date
from typing import Any, Dict, Iterable, List, Optional

from app.models.patient import Patient, PatientType
from app.models.report import Report, ReportStatus

AIRMADIDI_VILLAGES = [
    "Airmadidi Atas", "Airmadidi Bawah", "Sarongsong Satu", "Sarongsong Dua",
    "Sukur", "Rap-Rap", "Sawangan", "Sampiri", "Tanggari",
]
OTHER_VILLAGE = "Lainnya"

STUNTING_FLAGS = {"RISIKO_STUNTING", "RISIKO_STUNTING_BERAT"}
KEK_FLAGS = {"RISIKO_KEK_MATERNAL"}
ANEMIA_FLAGS = {"RISIKO_ANEMIA_RINGAN", "RISIKO_ANEMIA_SEDANG", "RISIKO_ANEMIA_BERAT"}
ATTENTION_STATUSES = {"RISIKO_TINGGI", "PERLU_PERHATIAN"}


def _norm(name: Optional[str]) -> str:
    v = (name or "").lower()
    v = re.sub(r"\b(desa|kelurahan|kel\.|posyandu)\b", " ", v)
    v = v.replace("-", " ").replace("1", " satu ").replace("2", " dua ")
    return re.sub(r"\s+", " ", v).strip()


_CANONICAL = {_norm(v): v for v in AIRMADIDI_VILLAGES}


def canonical_village(name: Optional[str]) -> Optional[str]:
    """Nama desa baku bila cocok persis setelah normalisasi; None bila tidak dikenali."""
    return _CANONICAL.get(_norm(name))


def same_village(a: Optional[str], b: Optional[str]) -> bool:
    """Pencocokan wilayah persis (setelah normalisasi), bukan pencocokan substring."""
    if not a or not b:
        return False
    ca, cb = canonical_village(a), canonical_village(b)
    if ca and cb:
        return ca == cb
    return _norm(a) == _norm(b)


def village_bucket(patient: Patient) -> str:
    return canonical_village(patient.village_name) or OTHER_VILLAGE


def _flag_names(report: Optional[Report]) -> set:
    if not report:
        return set()
    return {f.get("flag") for f in (report.risk_flags or []) if isinstance(f, dict) and f.get("flag")}


def _ptype(patient: Patient) -> str:
    return patient.patient_type.value if hasattr(patient.patient_type, "value") else str(patient.patient_type)


def latest_report(reports: Iterable[Report], approved_only: bool = True) -> Optional[Report]:
    candidates = [
        r for r in reports
        if (r.status == ReportStatus.APPROVED) or (not approved_only and r.status == ReportStatus.DRAFT)
    ]
    return max(candidates, key=lambda r: r.id) if candidates else None


def delivered_after(mother: Patient, on: Optional[date], children_by_mother: Dict[int, List[Patient]]) -> bool:
    """True bila ibu punya anak yang lahir pada/ setelah tanggal tersebut (kehamilan sudah selesai)."""
    if on is None:
        return False
    return any(c.birth_date and c.birth_date >= on for c in children_by_mother.get(mother.id, []))


def classify_patient(
    patient: Patient,
    report: Optional[Report],
    children_by_mother: Dict[int, List[Patient]],
    check_delivery: bool = True,
) -> Dict[str, bool]:
    """Kategori risiko satu pasien berdasarkan satu laporan."""
    flags = _flag_names(report)
    p_type = _ptype(patient)
    visit_date = report.visit.visit_date if (report and report.visit) else None
    still_pregnant = not (check_delivery and delivered_after(patient, visit_date, children_by_mother))
    is_mother = p_type == PatientType.MOTHER.value
    return {
        "stunting": p_type == PatientType.CHILD.value and bool(flags & STUNTING_FLAGS),
        "kek": is_mother and still_pregnant and bool(flags & KEK_FLAGS),
        "anemia": is_mother and still_pregnant and bool(flags & ANEMIA_FLAGS),
        "high_risk": bool(report and report.overall_status == "RISIKO_TINGGI"),
    }


def index_by_patient(reports: Iterable[Report]) -> Dict[int, List[Report]]:
    out: Dict[int, List[Report]] = {}
    for r in reports:
        out.setdefault(r.patient_id, []).append(r)
    return out


def children_index(patients: Iterable[Patient]) -> Dict[int, List[Patient]]:
    out: Dict[int, List[Patient]] = {}
    for p in patients:
        if p.mother_id:
            out.setdefault(p.mother_id, []).append(p)
    return out


def summarize(patients: List[Patient], reports: List[Report], children_by_mother: Dict[int, List[Patient]]) -> Dict[str, int]:
    """Total stunting/KEK/anemia/risiko tinggi dari laporan APPROVED terakhir tiap pasien."""
    by_pid = index_by_patient(reports)
    totals = {"stunting": 0, "kek": 0, "anemia": 0, "high_risk": 0}
    for p in patients:
        cls = classify_patient(p, latest_report(by_pid.get(p.id, [])), children_by_mother)
        for k in totals:
            totals[k] += int(cls[k])
    return totals


def last_n_months(n: int = 6, today: Optional[date] = None) -> List[tuple]:
    today = today or date.today()
    months = []
    y, m = today.year, today.month
    for _ in range(n):
        months.insert(0, (y, m))
        m -= 1
        if m == 0:
            m, y = 12, y - 1
    return months


BULAN_ID = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"]


def monthly_trend(patients: List[Patient], reports: List[Report], months: List[tuple]) -> List[Dict[str, Any]]:
    """
    Pasien unik per bulan kunjungan dengan stunting/KEK/anemia, dari laporan APPROVED.
    Status kehamilan dinilai pada saat kunjungan itu (tanpa cek persalinan sesudahnya).
    """
    patient_by_id = {p.id: p for p in patients}
    buckets = {ym: {"stunting": set(), "kek": set(), "anemia": set()} for ym in months}
    for r in reports:
        if r.status != ReportStatus.APPROVED or not r.visit or not r.visit.visit_date:
            continue
        key = (r.visit.visit_date.year, r.visit.visit_date.month)
        p = patient_by_id.get(r.patient_id)
        if key not in buckets or not p:
            continue
        cls = classify_patient(p, r, {}, check_delivery=False)
        for k in ("stunting", "kek", "anemia"):
            if cls[k]:
                buckets[key][k].add(r.patient_id)
    return [
        {
            "month": f"{yy}-{mm:02d}",
            "label": f"{BULAN_ID[mm - 1]} {str(yy)[2:]}",
            "stunting": len(buckets[(yy, mm)]["stunting"]),
            "kek": len(buckets[(yy, mm)]["kek"]),
            "anemia": len(buckets[(yy, mm)]["anemia"]),
        }
        for (yy, mm) in months
    ]


def grounding_rate(reports: List[Report]) -> Dict[str, Any]:
    """VERIFIED + AUTO_GROUNDED_SECONDARY dari laporan terakhir tiap kunjungan (laporan lama tidak dihitung)."""
    latest_by_visit: Dict[int, Report] = {}
    for r in reports:
        if r.visit_id not in latest_by_visit or r.id > latest_by_visit[r.visit_id].id:
            latest_by_visit[r.visit_id] = r
    total = verified = 0
    sources = set()
    for r in latest_by_visit.values():
        for v in (r.verification_summary or []):
            total += 1
            if v.get("verification_status") in ("VERIFIED", "AUTO_GROUNDED_SECONDARY"):
                verified += 1
        for rec in (r.recommendations or []):
            src = (rec.get("citation") or {}).get("source") if isinstance(rec, dict) else None
            if src:
                sources.add(src)
    return {
        "total": total,
        "verified": verified,
        "rate": round(verified / total * 100, 1) if total else None,
        "sources": sorted(sources),
    }


def in_kader_scope(patient: Patient, user) -> bool:
    """
    Kader hanya melihat pasien di desa/kelurahan miliknya (cocok persis), atau posyandu
    yang sama bila desa pasien kosong. Admin/Dokter tidak dibatasi.
    """
    from app.models.user import UserRole
    if user.role != UserRole.KADER:
        return True
    if user.village_name and patient.village_name:
        return same_village(patient.village_name, user.village_name)
    if user.posyandu_name and patient.posyandu_name:
        return _norm(patient.posyandu_name) == _norm(user.posyandu_name)
    return False


def scoped_patient_ids(db, user) -> Optional[set]:
    """ID pasien dalam wilayah kader; None bila pengguna tidak dibatasi wilayah."""
    from app.models.user import UserRole
    if user.role != UserRole.KADER:
        return None
    return {p.id for p in db.query(Patient).all() if in_kader_scope(p, user)}
