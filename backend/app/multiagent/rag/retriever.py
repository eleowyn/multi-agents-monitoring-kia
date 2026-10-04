from typing import List, Dict, Any, Optional
from app.multiagent.rag.vectorstore import get_or_create_collection


def retrieve_clinical_guidelines(
    query: str,
    n_results: int = 3,
    category_filter: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Melakukan semantic retrieval terhadap dokumen rujukan KIA & PNPK
    di ChromaDB berdasarkan kemiripan kosinus.
    """
    collection = get_or_create_collection()
    
    # Cek jika collection masih kosong, lakukan auto-ingest
    if collection.count() == 0:
        from app.multiagent.rag.ingest import ingest_knowledge_base
        ingest_knowledge_base()

    where_clause = {"category": category_filter} if category_filter else None
    
    query_args = {
        "query_texts": [query],
        "n_results": n_results
    }
    if where_clause:
        query_args["where"] = where_clause

    results = collection.query(**query_args)
    
    chunks = []
    if results and "documents" in results and results["documents"]:
        docs = results["documents"][0]
        metas = results["metadatas"][0] if "metadatas" in results else [{}] * len(docs)
        ids = results["ids"][0] if "ids" in results else [""] * len(docs)
        distances = results["distances"][0] if "distances" in results else [0.0] * len(docs)
        
        for i in range(len(docs)):
            chunks.append({
                "id": ids[i],
                "content": docs[i],
                "source": metas[i].get("source", "Buku KIA / PNPK"),
                "section": metas[i].get("section", "Umum"),
                "page": metas[i].get("page", "-"),
                "category": metas[i].get("category", "KIA"),
                "distance": distances[i] if i < len(distances) else None
            })
            
    return chunks


# Alias untuk kompatibilitas
retrieve_kia_guidelines = retrieve_clinical_guidelines
