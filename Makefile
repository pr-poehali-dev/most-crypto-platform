.PHONY: up down logs demo clean build test migrate ps shell-orchestrator shell-db

# ─── Переменные ───────────────────────────────────────────────────────────────
COMPOSE       = docker compose
PROJECT       = most
NAMESPACE     = most
API_BASE     ?= http://localhost:8000
REGULATOR_KEY?= dev-regulator-key-change-me

# ─── Запуск ───────────────────────────────────────────────────────────────────
up:
	@echo "🚀 Запускаем MOST..."
	$(COMPOSE) up -d --build
	@echo ""
	@echo "✓ Сервисы запущены:"
	@echo "  Frontend:    http://localhost:3000"
	@echo "  Orchestrator: http://localhost:8000"
	@echo "  Coordinator:  http://localhost:8001"
	@echo "  Risk Engine:  http://localhost:8002"
	@echo "  Regulator:    http://localhost:8003"
	@echo "  Grafana:      http://localhost:3001  (admin/admin)"
	@echo "  Prometheus:   http://localhost:9090"

up-infra:
	@echo "🔧 Запускаем только инфраструктуру (DB + Redis)..."
	$(COMPOSE) up -d postgres redis

up-dev:
	@echo "🛠  Dev-режим (с hot-reload)..."
	$(COMPOSE) up -d postgres redis
	$(COMPOSE) up orchestrator risk-engine swarm-coordinator

# ─── Остановка ────────────────────────────────────────────────────────────────
down:
	@echo "⏹  Останавливаем MOST..."
	$(COMPOSE) down

down-volumes:
	@echo "⚠️  Останавливаем и удаляем volumes..."
	$(COMPOSE) down -v

# ─── Логи ────────────────────────────────────────────────────────────────────
logs:
	$(COMPOSE) logs -f --tail=100

logs-orchestrator:
	$(COMPOSE) logs -f --tail=100 orchestrator

logs-agents:
	$(COMPOSE) logs -f --tail=100 swarm-agent

logs-risk:
	$(COMPOSE) logs -f --tail=100 risk-engine

logs-coordinator:
	$(COMPOSE) logs -f --tail=100 swarm-coordinator

# ─── Статус ───────────────────────────────────────────────────────────────────
ps:
	$(COMPOSE) ps

health:
	@echo "=== Health checks ==="
	@curl -sf $(API_BASE)/health              && echo "✓ Orchestrator" || echo "✗ Orchestrator"
	@curl -sf http://localhost:8001/health    && echo "✓ Coordinator"  || echo "✗ Coordinator"
	@curl -sf http://localhost:8002/health    && echo "✓ Risk Engine"  || echo "✗ Risk Engine"
	@curl -sf http://localhost:8003/health    && echo "✓ Regulator"    || echo "✗ Regulator"

# ─── Сборка ───────────────────────────────────────────────────────────────────
build:
	@echo "🔨 Собираем образы..."
	$(COMPOSE) build --parallel

build-push:
	@echo "📦 Собираем и пушим в registry..."
	$(COMPOSE) build --parallel
	$(COMPOSE) push

# ─── Тесты ───────────────────────────────────────────────────────────────────
test:
	@echo "🧪 Запускаем тесты..."
	pip install pytest pytest-asyncio httpx -q
	pytest services/ -v --tb=short

test-risk:
	@echo "🧪 Тесты Risk Engine..."
	python -c "from services.risk_engine.main import RiskEngine; e=RiskEngine(); \
		r=e.check_address('0x8589427373d6d84e98730d7795d8f6f8731fda16','eth'); \
		assert r['is_sanctioned'], 'FAIL'; print('✓ Sanction check OK')"

lint:
	ruff check services/ libs/ --ignore E501

# ─── Миграции ─────────────────────────────────────────────────────────────────
migrate:
	@echo "🗄  Применяем миграции..."
	$(COMPOSE) exec orchestrator python -c " \
		import psycopg2, os, glob; \
		conn=psycopg2.connect(os.environ['DATABASE_URL']); \
		cur=conn.cursor(); \
		[cur.execute(open(f).read()) or conn.commit() or print('✓',f) \
		 for f in sorted(glob.glob('db_migrations/V*.sql'))]; \
		conn.close()"

migrate-status:
	@echo "📋 Список применённых миграций:"
	@ls -1 db_migrations/V*.sql 2>/dev/null || echo "Миграций нет"

# ─── Shells ───────────────────────────────────────────────────────────────────
shell-orchestrator:
	$(COMPOSE) exec orchestrator /bin/bash

shell-db:
	$(COMPOSE) exec postgres psql -U most_user -d most_db

shell-redis:
	$(COMPOSE) exec redis redis-cli

# ─── Мониторинг ───────────────────────────────────────────────────────────────
grafana:
	@echo "📊 Открываем Grafana..."
	@open http://localhost:3001 || xdg-open http://localhost:3001 || echo "http://localhost:3001"

prometheus:
	@open http://localhost:9090 || xdg-open http://localhost:9090 || echo "http://localhost:9090"

# ─── Демо ────────────────────────────────────────────────────────────────────
demo:
	@echo "🎬 Запускаем MOST Demo..."
	@bash scripts/demo.sh

demo-million:
	@echo "💰 Демо: отправка $1M..."
	@AMOUNT=1000000 bash scripts/demo.sh

demo-regulator:
	@echo "👁  Демо: вид регулятора..."
	@curl -s http://localhost:8003/api/v1/regulator/dashboard \
		-H "X-API-Key: $(REGULATOR_KEY)" | python3 -m json.tool

# ─── Очистка ─────────────────────────────────────────────────────────────────
clean:
	@echo "🧹 Очищаем..."
	$(COMPOSE) down -v --remove-orphans
	docker system prune -f
	find . -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null || true
	find . -name "*.pyc" -delete 2>/dev/null || true
	@echo "✓ Готово"

clean-images:
	@echo "🗑  Удаляем образы MOST..."
	docker images | grep "most" | awk '{print $$3}' | xargs docker rmi -f 2>/dev/null || true

# ─── k8s ─────────────────────────────────────────────────────────────────────
k8s-deploy:
	@echo "☸️  Деплоим в Kubernetes..."
	kubectl apply -f k8s/configmap.yaml
	kubectl apply -f k8s/secret.yaml
	kubectl apply -f k8s/service.yaml
	kubectl apply -f k8s/deployment-orchestrator.yaml
	kubectl apply -f k8s/deployment-coordinator.yaml
	kubectl apply -f k8s/statefulset-agents.yaml
	kubectl apply -f k8s/ingress.yaml
	@echo "✓ Деплой отправлен"

k8s-status:
	kubectl get pods -n $(NAMESPACE)
	kubectl get services -n $(NAMESPACE)
	kubectl get ingress -n $(NAMESPACE)

k8s-logs:
	kubectl logs -n $(NAMESPACE) -l app=orchestrator -f --tail=50

k8s-rollback:
	kubectl rollout undo deployment/orchestrator -n $(NAMESPACE)
	kubectl rollout undo deployment/swarm-coordinator -n $(NAMESPACE)

# ─── Помощь ──────────────────────────────────────────────────────────────────
help:
	@echo ""
	@echo "MOST — Swarm Payment Network"
	@echo "============================"
	@echo ""
	@echo "Основные команды:"
	@echo "  make up            — запустить всё"
	@echo "  make down          — остановить"
	@echo "  make logs          — все логи"
	@echo "  make demo          — запустить демо-скрипт"
	@echo "  make health        — проверить все сервисы"
	@echo "  make clean         — полная очистка"
	@echo ""
	@echo "Разработка:"
	@echo "  make up-dev        — только инфра + сервисы"
	@echo "  make test          — тесты"
	@echo "  make lint          — линтер"
	@echo "  make migrate       — применить миграции"
	@echo "  make shell-db      — psql"
	@echo ""
	@echo "Мониторинг:"
	@echo "  make grafana       — открыть Grafana"
	@echo "  make prometheus    — открыть Prometheus"
	@echo ""
	@echo "Kubernetes:"
	@echo "  make k8s-deploy    — деплой в k8s"
	@echo "  make k8s-status    — статус подов"
	@echo "  make k8s-rollback  — откат"
	@echo ""
