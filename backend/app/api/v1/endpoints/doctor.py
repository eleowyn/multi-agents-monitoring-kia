import os
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.user import User, UserRole
from app.models.patient import Patient
from app.models.visit import Visit
from app.models.report import Report
from app.models.revision import RevisionRequest, RevisionStatus
from app.api.v1.endpoints.auth import get_current_user
from app.multiagent.rag.ingest import get_all_knowledge_chunks
from app.services.export_service import generate_puskesmas_excel_report
from app.services.pdf_service import generate_lb3_kia_pdf

router = APIRouter()


def _require_doctor_or_admin(user: User = Depends(get_current_user)) -> User:
    if user.role not in (UserRole.DOKTER, UserRole.ADMIN):
        raise HTTPException(
            status_code=403,
            detail="Akses dibatasi khusus Dokter Puskesmas atau Administrator."
        )
    return user


@router.get("/monitoring-summary")
def get_doctor_monitoring_summary(
    posyandu: Optional[str] = Query(None),
    posyandu_name: Optional[str] = Query(None),
    village_name: Optional[str] = Query(None),
    month: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_doctor_or_admin),
):
    """
    Menampilkan ringkasan monitoring klinis Dokter Puskesmas Airmadidi:
    - Agregat prevalensi kasus stunting, wasting, KEK, anemia, KSPR tinggi.
    - Jumlah permohonan revisi laporan kader yang menunggu persetujuan dokter.
    - Daftar rekam pasien risiko tinggi untuk tindak lanjut rujukan.
    """
    from app.services import aggregates as agg

    all_patients = db.query(Patient).all()
    target_pos = posyandu or posyandu_name
    if target_pos and target_pos not in ("Semua Posyandu", "Semua", "", "None"):
        # Opsi berbentuk "Posyandu Mawar (Airmadidi Atas)": cocokkan desa persis atau nama posyandu persis
        clean_key = target_pos.split("(")[0].strip()
        sub_key = target_pos.split("(")[1].replace(")", "").strip() if "(" in target_pos else clean_key
        patients = [
            p for p in all_patients
            if agg.same_village(p.village_name, sub_key)
            or ((p.posyandu_name or "").strip().lower() in (clean_key.lower(), target_pos.strip().lower()))
        ]
    else:
        patients = all_patients
    if village_name and village_name not in ("Semua Desa", "Semua", "", "None"):
        patients = [p for p in patients if agg.same_village(p.village_name, village_name)]
    pids = {p.id for p in patients}

    total_patients = len(patients)
    total_visits = db.query(Visit).filter(Visit.patient_id.in_(pids)).count() if pids else 0
    reports = [r for r in db.query(Report).all() if r.patient_id in pids]
    reports_by_pid = agg.index_by_patient(reports)
    children_by_mother = agg.children_index(all_patients)

    # Hitungan per pasien dari laporan terakhir (bukan per laporan), sama dengan dashboard admin
    severe_stunting = stunting = wasting = underweight = kek = anemia = kek_or_anemia = high_kspr = 0
    risky_patient_cases = []
    for p in patients:
        r = agg.latest_report(reports_by_pid.get(p.id, []), approved_only=False)
        if not r:
            continue
        flags = [f.get("flag", "") for f in (r.risk_flags or []) if isinstance(f, dict)]
        flag_set = set(flags)
        cls = agg.classify_patient(p, r, children_by_mother)
        severe_stunting += int("RISIKO_STUNTING_BERAT" in flag_set)
        stunting += int("RISIKO_STUNTING" in flag_set)
        wasting += int(bool(flag_set & {"RISIKO_GIZI_KURANG", "RISIKO_GIZI_BURUK"}))
        underweight += int(bool(flag_set & {"RISIKO_UNDERWEIGHT", "RISIKO_UNDERWEIGHT_BERAT"}))
        kek += int(cls["kek"])
        anemia += int(cls["anemia"])
        kek_or_anemia += int(cls["kek"] or cls["anemia"])
        high_kspr += int(bool(flag_set & {"RISIKO_KEHAMILAN_TINGGI_KRT", "RISIKO_KEHAMILAN_SANGAT_TINGGI_KRST"}))

        if r.overall_status != "KONDISI_BAIK" or flags:
            v = r.visit
            conf = (r.final_report_json or {}).get("confidence", {})
            risky_patient_cases.append({
                "report_id": r.id,
                "visit_id": r.visit_id,
                "patient_id": r.patient_id,
                "patient_name": p.name,
                "nik": p.nik,
                "gender": (p.gender.value if hasattr(p.gender, "value") else str(p.gender)) if p.gender else "-",
                "phase": v.phase.value if (v and hasattr(v.phase, "value")) else str(v.phase if v else "-"),
                "visit_date": str(v.visit_date) if v else "-",
                "village_name": p.village_name or "-",
                "posyandu_name": p.posyandu_name or p.village_name or "-",
                "overall_status": r.overall_status,
                "risk_flags": flags,
                "confidence_score": conf.get("confidence_score"),
                "status": r.status.value if hasattr(r.status, "value") else str(r.status),
            })
    risky_patient_cases.sort(key=lambda x: x["report_id"], reverse=True)

    pending_revs_count = (
        db.query(RevisionRequest)
        .filter(RevisionRequest.status == RevisionStatus.PENDING)
        .count()
    )

    posyandu_db = [r[0] for r in db.query(Patient.posyandu_name).filter(Patient.posyandu_name.isnot(None)).distinct().all() if r[0]]
    all_9_posyandus = [
        "Posyandu Mawar (Airmadidi Atas)",
        "Posyandu Melati (Airmadidi Bawah)",
        "Posyandu Anggrek (Sarongsong Satu)",
        "Posyandu Cempaka (Sarongsong Dua)",
        "Posyandu Flamboyan (Sukur)",
        "Posyandu Teratai (Rap-Rap)",
        "Posyandu Dahlia (Sawangan)",
        "Posyandu Bougenville (Sampiri)",
        "Posyandu Kenanga (Tanggari)",
    ]
    # Gabungkan distinct posyandu DB dan daftar 9 posyandu baku
    posyandu_list = sorted(list(set(posyandu_db + all_9_posyandus)))

    stats_dict = {
        "total_patients": total_patients,
        "total_visits": total_visits,
        "at_risk_count": len(risky_patient_cases),
        "total_risky_reports": len(risky_patient_cases),
        "stunting_severe_count": severe_stunting,
        "severe_stunting_count": severe_stunting,
        "stunting_count": stunting,
        "wasting_count": wasting,
        "underweight_count": underweight,
        "kek_count": kek,
        "anemia_count": anemia,
        "kek_or_anemia_count": kek_or_anemia,
        "kspr_high_risk_count": high_kspr,
        "high_kspr_count": high_kspr,
        "pending_revisions_count": pending_revs_count,
    }

    return {
        "summary_stats": stats_dict,
        "metrics": stats_dict,
        "risky_reports": risky_patient_cases[:100],
        "risky_patients": risky_patient_cases[:100],
        "posyandu_list": posyandu_list,
    }


@router.get("/reports/export-excel")
@router.get("/reports/export-asik-excel")
def export_puskesmas_excel(
    posyandu: Optional[str] = Query(None),
    posyandu_name: Optional[str] = Query(None),
    village_name: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_doctor_or_admin),
):
    """
    Mengunduh berkas Excel resmi 3 Sheet Puskesmas Airmadidi:
    - Sheet 1: Balita_ePPGBM_ASIK
    - Sheet 2: Bumil_ANC_ASIK
    - Sheet 3: Rujukan_SIMPUS_SATUSEHAT
    """
    effective_posyandu = posyandu_name or posyandu
    stream = generate_puskesmas_excel_report(
        db=db,
        posyandu_name=effective_posyandu,
        village_name=village_name,
        start_date=start_date,
        end_date=end_date,
    )
    timestamp_str = datetime.now().strftime("%Y%m%d_%H%M")
    pos_slug = (effective_posyandu or "Semua_Posyandu").replace(" ", "_")
    filename = f"Laporan_KIA_Puskesmas_Airmadidi_{pos_slug}_{timestamp_str}.xlsx"

    return StreamingResponse(
        stream,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/reports/print-lb3-pdf")
def print_lb3_kia_pdf(
    posyandu: Optional[str] = Query(None),
    posyandu_name: Optional[str] = Query(None),
    village_name: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_doctor_or_admin),
):
    """
    Menghasilkan dokumen PDF Rekapitulasi LB3-KIA Bulanan Puskesmas Airmadidi
    lengkap dengan Kop Surat resmi dan kolom tanda tangan Dokter.
    """
    effective_posyandu = posyandu_name or posyandu
    summary = get_doctor_monitoring_summary(
        posyandu_name=effective_posyandu,
        village_name=village_name,
        db=db,
        current_user=current_user,
    )
    metrics = summary["metrics"]
    tot_p = max(1, metrics["total_patients"])

    # Transform risky cases into formatted rows for PDF
    formatted_cases = []
    for c in summary["risky_patients"][:25]:
        flags = c.get("risk_flags", [])
        icd_codes = []
        if any("STUNTING" in fl for fl in flags):
            icd_codes.append("E44.0 (Stunting)")
        if any("KEK" in fl for fl in flags):
            icd_codes.append("E46 (KEK Maternal)")
        if any("ANEMIA" in fl for fl in flags):
            icd_codes.append("O99.0 (Anemia)")
        if any("KSPR" in fl for fl in flags):
            icd_codes.append("Z35.8 (KRT)")
        if not icd_codes:
            icd_codes.append("Z71.3 (Dietary Counsel)")

        formatted_cases.append({
            "patient_name": c["patient_name"],
            "nik": c["nik"],
            "phase": c["phase"],
            "posyandu": c["posyandu_name"],
            "village": c["village_name"],
            "findings": ", ".join(flags),
            "icd_codes": "; ".join(icd_codes),
            "action_plan": "Rujuk ke Poli KIA / Gizi Puskesmas Airmadidi",
        })

    pos_label = effective_posyandu if (effective_posyandu and effective_posyandu != "Semua Posyandu") else "Seluruh Posyandu Wilayah Kerja"
    now_dt = datetime.now()

    context = {
        "posyandu_label": pos_label,
        "period_label": now_dt.strftime("%B %Y"),
        "total_patients": metrics["total_patients"],
        "total_visits": metrics["total_visits"],
        "printed_at": now_dt.strftime("%d/%m/%Y %H:%M WITA"),
        "printed_date": now_dt.strftime("%d %B %Y"),
        "doctor_name": (current_user.full_name or "Penanggung Jawab KIA").replace("dr. ", "").replace("dr.", "").strip(),
        "severe_stunting_count": metrics["severe_stunting_count"],
        "severe_stunting_pct": round((metrics["severe_stunting_count"] / tot_p) * 100.0, 1),
        "stunting_count": metrics["stunting_count"],
        "stunting_pct": round((metrics["stunting_count"] / tot_p) * 100.0, 1),
        "wasting_count": metrics["wasting_count"],
        "wasting_pct": round((metrics["wasting_count"] / tot_p) * 100.0, 1),
        "kek_count": metrics["kek_count"],
        "kek_pct": round((metrics["kek_count"] / tot_p) * 100.0, 1),
        "anemia_count": metrics["anemia_count"],
        "anemia_pct": round((metrics["anemia_count"] / tot_p) * 100.0, 1),
        "high_kspr_count": metrics["high_kspr_count"],
        "high_kspr_pct": round((metrics["high_kspr_count"] / tot_p) * 100.0, 1),
        "risky_cases": formatted_cases,
    }

    filename = f"Laporan_LB3_KIA_{(effective_posyandu or 'Semua').replace(' ', '_')}_{now_dt.strftime('%Y%m%d')}.pdf"
    file_path = generate_lb3_kia_pdf(context, filename=filename)

    if not os.path.exists(file_path):
        raise HTTPException(status_code=500, detail="Gagal mencetak dokumen PDF LB3-KIA.")

    is_pdf = file_path.lower().endswith(".pdf")
    m_type = "application/pdf" if is_pdf else "text/html; charset=utf-8"
    return FileResponse(file_path, media_type=m_type, filename=os.path.basename(file_path))


@router.get("/knowledge-chunks")
def list_knowledge_chunks(
    search: Optional[str] = Query(None),
    source: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(500, ge=1, le=2000),
    current_user: User = Depends(get_current_user),
):
    """
    Menampilkan seluruh chunk teks markdown (.md) resmi Buku KIA dan PNPK Stunting.
    Dapat diakses oleh Dokter, Kader, maupun Admin untuk memeriksa koleksi sumber rujukan RAG.
    """
    return get_all_knowledge_chunks(
        search=search,
        source=source,
        category=category,
        skip=skip,
        limit=limit,
    )


@router.get("/report-citations")
def get_report_rag_citations(
    search: Optional[str] = Query(None),
    report_id: Optional[int] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Menampilkan seluruh kutipan RAG yang dipakai pada laporan pemeriksaan klinis pasien.
    Menghubungkan potongan chunk pedoman (Buku KIA / PNPK) dengan Nomor Laporan & Identitas Pasien.
    """
    query = db.query(Report).join(Patient, Report.patient_id == Patient.id).order_by(Report.id.desc())
    if report_id:
        query = query.filter(Report.id == report_id)
    reports = query.limit(limit).all()

    from app.api.v1.endpoints.reports import _mark_legacy_quotes

    # Muat indeks chunk koleksi pengetahuan agar setiap laporan dapat menampilkan isi chunk secara utuh
    kb_data = get_all_knowledge_chunks(limit=2000)
    all_kb_chunks = kb_data.get("chunks", [])
    chunk_by_id = {str(c.get("id")): c for c in all_kb_chunks if c.get("id")}

    citations_list = []
    reports_grouped_map = {}

    for r in reports:
        p = r.patient
        v = r.visit
        recs = r.recommendations or []
        if isinstance(recs, dict):
            recs = recs.get("recommendations", [])
        recs = _mark_legacy_quotes(recs)

        p_name = p.name if p else "Pasien KIA"
        p_nik = p.nik if p else "-"
        p_gender = (p.gender.value if hasattr(p.gender, "value") else str(p.gender)) if p and p.gender else "-"
        p_village = p.village_name if p else "-"
        p_posyandu = (p.posyandu_name or p.village_name or "Posyandu Airmadidi") if p else "Posyandu Airmadidi"
        v_date = str(v.visit_date) if v else "-"
        v_phase = v.phase.value if (v and hasattr(v.phase, "value")) else str(v.phase if v else "-")
        r_status = r.status.value if hasattr(r.status, "value") else str(r.status)

        report_items = []
        distinct_sources = []
        distinct_pages = []
        distinct_chunk_ids = []

        for rec in recs:
            if not isinstance(rec, dict):
                continue
            cit = rec.get("citation") or {}
            if not isinstance(cit, dict):
                cit = {}

            src = cit.get("source")
            sec = cit.get("section")
            page_val = cit.get("page")
            quote = rec.get("evidence_quote")
            evidence_status = rec.get("evidence_status") or "TANPA_KUTIPAN"
            cid = cit.get("chunk_id")
            supp_ids = list(cit.get("supporting_chunk_ids") or ([] if not cid else [cid]))
            supp_chunks = list(cit.get("supporting_chunks") or [])
            add_pages = list(cit.get("additional_pages") or ([] if not page_val else [str(page_val)]))
            add_sections = list(cit.get("additional_sections") or ([] if not sec else [str(sec)]))

            # Jika laporan lama belum menyimpan detail supporting_chunks, lengkapi dari koleksi chunk
            if not supp_chunks and supp_ids:
                for sid in supp_ids:
                    kb_c = chunk_by_id.get(str(sid))
                    if kb_c:
                        supp_chunks.append({
                            "chunk_id": kb_c.get("id"),
                            "doc_name": kb_c.get("source"),
                            "section": kb_c.get("chapter"),
                            "page": kb_c.get("page"),
                            "excerpt": kb_c.get("text") or kb_c.get("snippet"),
                            "char_count": kb_c.get("char_count"),
                            "estimated_tokens": kb_c.get("estimated_tokens"),
                        })
            elif supp_chunks:
                # Lengkapi teks penuh dari koleksi chunk jika tersedia
                for sc in supp_chunks:
                    kb_c = chunk_by_id.get(str(sc.get("chunk_id")))
                    if kb_c:
                        sc.setdefault("full_text", kb_c.get("text") or kb_c.get("snippet"))
                        sc.setdefault("char_count", kb_c.get("char_count"))
                        sc.setdefault("estimated_tokens", kb_c.get("estimated_tokens"))

            # Fallback pencocokan berdasarkan halaman/bagian untuk laporan lama yang belum memiliki chunk_id
            if not supp_chunks and (src or sec or page_val):
                src_norm = (src or "").lower().replace("_", " ").replace(".md", "").strip()
                page_str = str(page_val).strip() if page_val is not None else ""
                for kb_c in all_kb_chunks:
                    kb_src = (kb_c.get("source") or "").lower().replace("_", " ").replace(".md", "").strip()
                    kb_page = str(kb_c.get("page") or "").strip()
                    if src_norm and kb_src and (src_norm in kb_src or kb_src in src_norm):
                        if page_str and page_str != "-" and page_str in kb_page.split(", "):
                            matched_id = kb_c.get("id")
                            if matched_id and matched_id not in supp_ids:
                                supp_ids.append(matched_id)
                            supp_chunks.append({
                                "chunk_id": matched_id,
                                "doc_name": kb_c.get("source"),
                                "section": kb_c.get("chapter"),
                                "page": kb_c.get("page"),
                                "excerpt": kb_c.get("text") or kb_c.get("snippet"),
                                "char_count": kb_c.get("char_count"),
                                "estimated_tokens": kb_c.get("estimated_tokens"),
                            })
                            if len(supp_chunks) >= 3:
                                break

            if search:
                s_lower = search.lower()
                blob = f"{r.id} {p_name} {p_nik} {p_posyandu} {p_village} {src or ''} {sec or ''} {quote or ''} {rec.get('title', '')}".lower()
                if s_lower not in blob:
                    continue

            if src and src not in distinct_sources:
                distinct_sources.append(src)
            for pg in add_pages:
                if pg and str(pg) != "-" and str(pg) not in distinct_pages:
                    distinct_pages.append(str(pg))
            for sid in supp_ids:
                if sid and str(sid) not in distinct_chunk_ids:
                    distinct_chunk_ids.append(str(sid))

            item_dict = {
                "report_id": r.id,
                "visit_id": r.visit_id,
                "patient_id": r.patient_id,
                "patient_name": p_name,
                "nik": p_nik,
                "gender": p_gender,
                "village_name": p_village,
                "posyandu_name": p_posyandu,
                "visit_date": v_date,
                "phase": v_phase,
                "recommendation_title": rec.get("title", "Rencana Tindak Lanjut"),
                "category": rec.get("category", "EDUKASI"),
                "evidence_quote": quote,
                "citation_source": src,
                "citation_section": sec,
                "citation_page": page_val,
                "additional_pages": add_pages,
                "additional_sections": add_sections,
                "supporting_chunk_ids": supp_ids,
                "supporting_chunks": supp_chunks,
                "chunk_id": cid or (supp_ids[0] if supp_ids else None),
                "evidence_status": evidence_status,
                "recommendation_text": rec.get("recommendation_text"),
                "overall_status": r.overall_status,
                "status": r_status,
            }
            citations_list.append(item_dict)
            report_items.append(item_dict)

        if report_items:
            reports_grouped_map[r.id] = {
                "report_id": r.id,
                "visit_id": r.visit_id,
                "patient_id": r.patient_id,
                "patient_name": p_name,
                "nik": p_nik,
                "gender": p_gender,
                "village_name": p_village,
                "posyandu_name": p_posyandu,
                "visit_date": v_date,
                "phase": v_phase,
                "overall_status": r.overall_status,
                "status": r_status,
                "sources": distinct_sources,
                "pages": distinct_pages,
                "chunk_ids": distinct_chunk_ids,
                "chunks_count": max(len(distinct_chunk_ids), len(report_items)),
                "recommendations_count": len(report_items),
                "items": report_items,
            }

    return {
        "total_citations": len(citations_list),
        "total_reports": len(reports_grouped_map),
        "citations": citations_list,
        "reports_grouped": list(reports_grouped_map.values()),
    }
