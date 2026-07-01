"""
MOST — Risk Engine
Сервис оценки рисков крипто-адресов: санкции, миксеры, скоринг.
Порт: 8002
"""
import hashlib
import re
from typing import List

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(title="MOST Risk Engine", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Наборы известных «плохих» сущностей (в проде — внешние фиды: TRM, Chainalysis)
# ---------------------------------------------------------------------------
SANCTIONED_ADDRESSES = {
    "0x8589427373d6d84e98730d7795d8f6f8731fda16",
    "0x722122df12d4e14e13ac3b6895a86e84145b6967",
    "1boadfl5wtqwdt5gadnsdrqm7qcgg4crm",
    "tuv7bxwrqe6qkd8s5nqrwuuipyhnwvdlkn",
}

MIXER_ADDRESSES = {
    "0xdd4c48c0b24039969fc16d1cdf626eab821d3384",
    "bc1qmixerexampleaddressxxxxxxxxxxxxxxxxxx",
}

MIXER_KEYWORDS = ("tornado", "mixer", "wasabi", "coinjoin", "blender")


# ---------------------------------------------------------------------------
# Схемы
# ---------------------------------------------------------------------------
class RiskCheckRequest(BaseModel):
    address: str = Field(..., min_length=4, max_length=128)
    network: str = Field(default="ethereum")


class RiskCheckResponse(BaseModel):
    address: str
    risk_score: int
    is_sanctioned: bool
    is_mixer: bool
    recommendation: str


class BatchItemResult(BaseModel):
    address: str
    risk_score: int
    safe: bool


class BatchCheckResponse(BaseModel):
    results: List[BatchItemResult]


# ---------------------------------------------------------------------------
# Ядро скоринга
# ---------------------------------------------------------------------------
class RiskEngine:
    RISK_THRESHOLD = 80

    def _entropy(self, address: str) -> int:
        """Детерминированный поведенческий компонент 0..40."""
        digest = hashlib.sha256(address.lower().encode()).hexdigest()
        return int(digest[:8], 16) % 41

    def _looks_like_mixer(self, address: str) -> bool:
        low = address.lower()
        if low in MIXER_ADDRESSES:
            return True
        return any(kw in low for kw in MIXER_KEYWORDS)

    def check_address(self, address: str, network: str) -> dict:
        addr = address.strip()
        low = addr.lower()
        score = 0

        is_sanctioned = low in SANCTIONED_ADDRESSES
        if is_sanctioned:
            score += 100

        is_mixer = self._looks_like_mixer(addr)
        if is_mixer:
            score += 70

        if not re.fullmatch(r"[a-zA-Z0-9:_\-]{4,128}", addr):
            score += 25

        score += self._entropy(addr)
        score = max(0, min(100, score))

        data = {
            "address": addr,
            "network": network,
            "risk_score": score,
            "is_sanctioned": is_sanctioned,
            "is_mixer": is_mixer,
        }
        data["recommendation"] = self.get_recommendation(data)
        return data

    def get_recommendation(self, data: dict) -> str:
        if data["is_sanctioned"] or data["risk_score"] >= self.RISK_THRESHOLD:
            return "REJECT"
        if data["risk_score"] >= 40:
            return "MANUAL_REVIEW"
        return "APPROVE"


engine = RiskEngine()


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@app.get("/health")
async def health():
    return {"status": "ok", "service": "risk-engine"}


@app.post("/api/v1/risk/check", response_model=RiskCheckResponse)
async def risk_check(req: RiskCheckRequest):
    data = engine.check_address(req.address, req.network)
    return RiskCheckResponse(**data)


@app.post("/api/v1/risk/batch-check", response_model=BatchCheckResponse)
async def risk_batch_check(items: List[RiskCheckRequest]):
    results: List[BatchItemResult] = []
    for item in items:
        data = engine.check_address(item.address, item.network)
        results.append(BatchItemResult(
            address=data["address"],
            risk_score=data["risk_score"],
            safe=data["risk_score"] < engine.RISK_THRESHOLD and not data["is_sanctioned"],
        ))
    return BatchCheckResponse(results=results)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8002, reload=True)
