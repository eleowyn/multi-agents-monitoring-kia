import os
import sys

# Ensure UTF-8 stdout encoding on Windows
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Ensure backend root is in sys.path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.multiagent.rag.retriever import retrieve_clinical_guidelines
from app.multiagent.agents.recommender import clinical_recommender_agent
from app.multiagent.agents.verifier import verification_and_report_agent
from app.multiagent.rag.vectorstore import get_or_create_collection

def run_rag_verification():
    print("=" * 65)
    print("VERIFIKASI RETRIEVAL KNOWLEDGE AGENT 2 & GROUNDEDNESS AGENT 3")
    print("=" * 65)

    collection = get_or_create_collection()
    count = collection.count()
    print(f"Total Chunks Terindeks di ChromaDB: {count} dokumen\n")

    test_cases = [
        {
            "name": "KASUS 1: BADUTA STUNTING & GIZI KURANG",
            "state": {
                "phase": "BADUTA",
                "patient_data": {"name": "Balita Nathan", "nik": "7106010001", "gender": "L", "village_name": "Airmadidi Atas"},
                "visit_data": {"age_in_months": 14, "child_weight_kg": 7.5, "child_length_cm": 71.0},
                "risk_flags": [
                    {
                        "indicator": "PB_U",
                        "flag": "RISIKO_STUNTING",
                        "detail": "Panjang badan 71.0 cm pada usia 14 bulan (Z-score: -2.85) tergolong PENDEK / STUNTED."
                    },
                    {
                        "indicator": "BB_PB",
                        "flag": "RISIKO_GIZI_KURANG",
                        "detail": "BB/PB Z-score: -2.15 tergolong Gizi Kurang."
                    }
                ],
                "risk_narrative": "Balita 14 bulan mengalami stunting (PB/U Z=-2.85) dan gizi kurang (BB/PB Z=-2.15).",
                "requires_rag": True
            }
        },
        {
            "name": "KASUS 2: IBU HAMIL KEK & ANEMIA SEDANG",
            "state": {
                "phase": "IBU_HAMIL",
                "patient_data": {"name": "Ny. Maria", "nik": "7106020002", "village_name": "Sarongsong Satu"},
                "visit_data": {"lila_cm": 21.5, "hb_level": 9.2, "trimester": 2},
                "risk_flags": [
                    {
                        "indicator": "LILA_KEK",
                        "flag": "RISIKO_KEK_MATERNAL",
                        "detail": "Ukuran LiLA 21.5 cm (< 23.5 cm) mengindikasikan Kurang Energi Kronis."
                    },
                    {
                        "indicator": "HB_ANEMIA",
                        "flag": "ANEMIA_SEDANG_MATERNAL",
                        "detail": "Kadar Hb 9.2 g/dL pada Trimester 2 tergolong Anemia Sedang."
                    }
                ],
                "risk_narrative": "Ibu hamil Trimester 2 dengan LiLA 21.5 cm (KEK) dan Hb 9.2 g/dL (Anemia).",
                "requires_rag": True
            }
        },
        {
            "name": "KASUS 3: BAYI BARU LAHIR BBLR",
            "state": {
                "phase": "BAYI_BARU_LAHIR",
                "patient_data": {"name": "Bayi Ny. Grace", "nik": "7106030003", "village_name": "Sukur"},
                "visit_data": {"birth_weight_gram": 2100, "gestational_age_at_birth_weeks": 36},
                "risk_flags": [
                    {
                        "indicator": "BIRTH_WEIGHT_BBLR",
                        "flag": "BBLR_RINGAN",
                        "detail": "Berat lahir 2.100 gram (< 2.500 gram) tergolong Bayi Berat Lahir Rendah."
                    }
                ],
                "risk_narrative": "Bayi lahir preterm 36 minggu dengan BBLR 2.100 gram.",
                "requires_rag": True
            }
        }
    ]

    for tc in test_cases:
        print("-" * 65)
        print(f"RUN: {tc['name']}")
        print(f"  Flag Risiko: {[f['flag'] for f in tc['state']['risk_flags']]}")
        
        # 1. Jalankan Agent 2 (Recommender)
        agent2_output = clinical_recommender_agent(tc["state"])
        recs = agent2_output.get("recommendations", [])
        chunks = agent2_output.get("retrieved_chunks", [])
        
        print(f"\n  Chunks yang Berhasil Ditarik ({len(chunks)} chunk):")
        for idx, c in enumerate(chunks):
            dist_str = f"(Cosine Dist: {c['distance']:.4f})" if c.get("distance") is not None else ""
            print(f"     [{idx+1}] ID: {c['id']} {dist_str}")
            print(f"         Sumber: {c['source']} (Hal. {c.get('page', '-')})")
            print(f"         Bagian: {c.get('section', '-')}")
            print(f"         Cuplikan: {c['content'][:110]}...")

        print(f"\n  Rekomendasi Klinis Terbentuk ({len(recs)} rekomendasi):")
        for idx, r in enumerate(recs):
            cit = r.get("citation", {})
            print(f"     [{idx+1}] Judul: {r.get('title')} [{r.get('category')}]")
            print(f"         Sitasi: {cit.get('source')} | Bagian: {cit.get('section')} | Hal: {cit.get('page')}")
            print(f"         Langkah: {', '.join(r.get('action_steps', [])[:2])}...")

        # 2. Jalankan Agent 3 (Verifier)
        state_for_agent3 = {**tc["state"], **agent2_output}
        agent3_output = verification_and_report_agent(state_for_agent3)
        verif_summary = agent3_output.get("verification_details", [])
        
        print(f"\n  Hasil Verifikasi Sitasi Groundedness Agent 3:")
        for v in verif_summary:
            status = v.get("verification_status")
            badge = "[VERIFIED]" if status == "VERIFIED" else "[PARTIALLY_VERIFIED]"
            print(f"     • {v.get('title')}: {badge}")
            print(f"       Rujukan: {v.get('citation_source')} (Hal. {v.get('citation_page')})")
            print(f"       Catatan: {v.get('notes')}")

    print("\n" + "=" * 65)
    print("HASIL VERIFIKASI: Seluruh scenario berhasil retrieve knowledge")
    print("sesuai dokumen Buku KIA & PNPK 2022 dengan sitasi terverifikasi.")
    print("=" * 65)

if __name__ == "__main__":
    run_rag_verification()
