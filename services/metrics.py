"""
MOST — Общий модуль Prometheus-метрик.
Подключается в каждый FastAPI-сервис.

Использование:
    from metrics import setup_metrics, payment_requests_total, ...
    setup_metrics(app, service_name="orchestrator")
"""
from prometheus_client import (
    Counter,
    Gauge,
    Histogram,
    make_asgi_app,
    start_http_server,
)
from fastapi import FastAPI

# ── Метрики платёжного оркестратора ─────────────────────────────────────────
payment_requests_total = Counter(
    "payment_requests_total",
    "Общее количество платёжных запросов",
    ["status", "from_currency", "to_currency"],
)

payment_duration_seconds = Histogram(
    "payment_duration_seconds",
    "Время обработки платёжного запроса (от создания до статуса completed/rejected)",
    ["status"],
    buckets=[0.1, 0.5, 1, 2, 5, 10, 30, 60, 120, 300],
)

payment_amount_usd = Histogram(
    "payment_amount_usd",
    "Распределение суммы платежей в USD",
    buckets=[100, 1000, 10_000, 100_000, 500_000, 1_000_000, 5_000_000],
)

payments_active = Gauge(
    "payments_active",
    "Количество платежей в статусе processing прямо сейчас",
)

payments_aml_pending = Gauge(
    "payments_aml_pending",
    "Количество платежей ожидающих AML-проверки",
)

# ── Метрики агентов роя ──────────────────────────────────────────────────────
tasks_completed_total = Counter(
    "tasks_completed_total",
    "Количество успешно выполненных задач агентами",
    ["network", "agent_name"],
)

tasks_failed_total = Counter(
    "tasks_failed_total",
    "Количество провалившихся задач агентов (все ретраи исчерпаны)",
    ["network", "agent_name", "reason"],
)

task_duration_seconds = Histogram(
    "task_duration_seconds",
    "Время выполнения одной задачи агентом",
    ["network"],
    buckets=[0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10, 30],
)

agents_active = Gauge(
    "agents_active",
    "Количество агентов, активно выполняющих задачи прямо сейчас",
    ["network"],
)

swarm_queue_length = Gauge(
    "swarm_queue_length",
    "Длина очереди задач в Redis Stream (pending entries)",
)

swarm_routes_active = Gauge(
    "swarm_routes_active",
    "Количество активных swarm-маршрутов",
)

# ── Метрики Risk Engine ──────────────────────────────────────────────────────
risk_checks_total = Counter(
    "risk_checks_total",
    "Количество AML-проверок",
    ["recommendation"],
)

risk_score_histogram = Histogram(
    "risk_score",
    "Распределение риск-скоров",
    buckets=[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
)

# ── HTTP-метрики (latency, requests) ────────────────────────────────────────
http_requests_total = Counter(
    "http_requests_total",
    "Количество HTTP-запросов",
    ["service", "method", "path", "status_code"],
)

http_request_duration_seconds = Histogram(
    "http_request_duration_seconds",
    "Latency HTTP-запросов",
    ["service", "method", "path"],
    buckets=[0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5],
)


# ── Middleware для FastAPI ────────────────────────────────────────────────────
def setup_metrics(app: FastAPI, service_name: str, port: int = 9090):
    """
    Монтирует /metrics эндпоинт в FastAPI-приложение и
    добавляет middleware для автоматического трекинга HTTP-метрик.
    """
    import time
    from starlette.middleware.base import BaseHTTPMiddleware
    from starlette.requests import Request
    from starlette.responses import Response

    class MetricsMiddleware(BaseHTTPMiddleware):
        async def dispatch(self, request: Request, call_next):
            start = time.perf_counter()
            response: Response = await call_next(request)
            duration = time.perf_counter() - start

            path = request.url.path
            # Не трекаем сам /metrics чтобы не создавать шум
            if path != "/metrics":
                http_requests_total.labels(
                    service=service_name,
                    method=request.method,
                    path=path,
                    status_code=response.status_code,
                ).inc()
                http_request_duration_seconds.labels(
                    service=service_name,
                    method=request.method,
                    path=path,
                ).observe(duration)

            return response

    app.add_middleware(MetricsMiddleware)

    # Монтируем ASGI-приложение Prometheus на /metrics
    metrics_app = make_asgi_app()
    app.mount("/metrics", metrics_app)
