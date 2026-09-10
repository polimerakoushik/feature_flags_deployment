from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel

from backend.database import get_db
from backend.crud.cleanup import scan_cleanup_candidates, list_cleanup_candidates, mark_candidate_reviewed, get_threshold_days
from backend.models import CleanupCandidate, Flag
from backend.utils.deps import get_current_user


router = APIRouter(tags=["Cleanup"])


class ScanResponse(BaseModel):
    total_candidates: int
    scanned_at: str


@router.post("/cleanup/scan")
def manual_scan(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    """Manual trigger to run the cleanup scanner. Requires authentication."""
    count, candidates = scan_cleanup_candidates(db, owner_user_id=getattr(current_user, "id", None))
    return {"total_candidates": count}


class SuggestionSummary(BaseModel):
    id: int
    flag_id: int
    candidate_type: str
    eligible_since: str
    reviewed: bool


@router.get("/cleanup/suggestions")
def get_suggestions(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=200),
                    search: Optional[str] = None, candidate_type: Optional[str] = None,
                    reviewed: Optional[bool] = None, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    total, items = list_cleanup_candidates(db, page=page, size=size, search=search, candidate_type=candidate_type, reviewed=reviewed, owner_user_id=getattr(current_user, "id", None))
    results = []
    for c in items:
        flag = db.query(Flag).filter(Flag.id == c.flag_id).first()
        results.append({
            "id": c.id,
            "flag_id": c.flag_id,
            "flag_key": flag.key if flag else None,
            "flag_type": flag.type if flag else None,
            "description": flag.description if flag else None,
            "owner_team": flag.owner_team if flag else None,
            "enabled": bool(flag.enabled) if flag else False,
            "rollout_percentage": getattr(flag, "rollout_percentage", None) if flag else None,
            "last_updated": flag.updated_at.isoformat() if flag and flag.updated_at else None,
            "candidate_type": c.candidate_type,
            "eligible_since": c.eligible_since.isoformat() if c.eligible_since else None,
            "reviewed": bool(c.reviewed),
            "reviewed_at": c.reviewed_at.isoformat() if c.reviewed_at else None,
        })
    return {"total": total, "items": results}


class ReviewRequest(BaseModel):
    note: Optional[str] = None


@router.patch("/cleanup/suggestions/{flag_id}/review")
def review_candidate(flag_id: int, body: ReviewRequest, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    reviewer_id = getattr(current_user, "id", None)
    if reviewer_id is None:
        raise HTTPException(status_code=401, detail="Authentication required to review")
    cand = mark_candidate_reviewed(db, flag_id=flag_id, reviewer_user_id=reviewer_id, note=body.note)
    if not cand:
        raise HTTPException(status_code=404, detail="Cleanup candidate for the flag not found")
    return {"status": "ok", "flag_id": flag_id, "reviewed_at": cand.reviewed_at.isoformat()}
