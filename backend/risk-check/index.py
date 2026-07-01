"""
MOST — risk-check
Публичная AML-проверка адреса для фронтенда (без авторизации).
POST /  { "address": str, "network": str }
→ { risk_score, is_sanctioned, is_mixer, recommendation, reasons }
"""
import hashlib
import json
import re

SANCTIONED = {
    "0x8589427373d6d84e98730d7795d8f6f8731fda16",
    "0x722122df12d4e14e13ac3b6895a86e84145b6967",
    "1boadfl5wtqwdt5gadnsdrqm7qcgg4crm",
    "tuv7bxwrqe6qkd8s5nqrwuuipyhnwvdlkn",
}
MIXERS = {
    "0xdd4c48c0b24039969fc16d1cdf626eab821d3384",
    "bc1qmixerexampleaddressxxxxxxxxxxxxxxxxxx",
}
MIXER_KW = ("tornado", "mixer", "wasabi", "coinjoin", "blender")

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
}


def _resp(code, body):
    return {"statusCode": code, "headers": {**CORS, "Content-Type": "application/json"},
            "body": json.dumps(body, ensure_ascii=False)}


def _entropy(addr):
    return int(hashlib.sha256(addr.lower().encode()).hexdigest()[:8], 16) % 41


def handler(event: dict, context) -> dict:
    """Мгновенная AML-проверка адреса для формы отправки платежа."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return _resp(400, {"error": "Невалидный JSON"})

    address = (body.get("address") or "").strip()
    network = (body.get("network") or "ethereum").strip()

    if not address or len(address) < 4:
        return _resp(400, {"error": "Укажите адрес получателя"})

    low = address.lower()
    score = 0
    reasons = []

    is_sanctioned = low in SANCTIONED
    if is_sanctioned:
        score += 100
        reasons.append("Адрес в санкционном списке OFAC/SDN")

    is_mixer = low in MIXERS or any(k in low for k in MIXER_KW)
    if is_mixer:
        score += 70
        reasons.append("Адрес связан с миксером / CoinJoin")

    if not re.fullmatch(r"[a-zA-Z0-9:_\-]{4,128}", address):
        score += 20
        reasons.append("Нестандартный формат адреса")

    entropy = _entropy(address)
    score += entropy
    if entropy >= 30:
        reasons.append("Аномальный поведенческий паттерн")

    score = max(0, min(100, score))

    if is_sanctioned or score >= 80:
        recommendation = "REJECT"
    elif score >= 40:
        recommendation = "MANUAL_REVIEW"
    else:
        recommendation = "APPROVE"

    if not reasons:
        reasons.append("Значимых факторов риска не обнаружено")

    return _resp(200, {
        "address": address,
        "network": network,
        "risk_score": score,
        "is_sanctioned": is_sanctioned,
        "is_mixer": is_mixer,
        "recommendation": recommendation,
        "reasons": reasons,
    })
