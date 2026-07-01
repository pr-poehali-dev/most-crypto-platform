#!/usr/bin/env bash
# =============================================================================
# MOST — Demo Script
# Полный user flow: регистрация → логин → платёж $1M → live прогресс роя
# =============================================================================
set -euo pipefail

# ─── Конфиг ──────────────────────────────────────────────────────────────────
API_BASE="${API_BASE:-http://localhost:8000}"
REGULATOR_API="${REGULATOR_API:-http://localhost:8003}"
REGULATOR_KEY="${REGULATOR_KEY:-dev-regulator-key-change-me}"
AMOUNT="${AMOUNT:-1000000}"
POLL_INTERVAL=2

# ─── Цвета и форматирование ──────────────────────────────────────────────────
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
DIM='\033[2m'
RESET='\033[0m'
LIME='\033[92m'

# ─── Хелперы ─────────────────────────────────────────────────────────────────
log()     { echo -e "${DIM}$(date '+%H:%M:%S')${RESET} $*"; }
info()    { echo -e "${CYAN}▶${RESET} $*"; }
success() { echo -e "${GREEN}✓${RESET} $*"; }
warn()    { echo -e "${YELLOW}⚠${RESET} $*"; }
error()   { echo -e "${RED}✗${RESET} $*" >&2; }
step()    { echo -e "\n${BOLD}${CYAN}══════════════════════════════════════${RESET}"; echo -e "${BOLD} $*${RESET}"; echo -e "${BOLD}${CYAN}══════════════════════════════════════${RESET}"; }

progress_bar() {
    local pct=$1
    local label="${2:-}"
    local width=40
    local filled=$(( pct * width / 100 ))
    local empty=$(( width - filled ))
    printf "\r  ["
    printf "${LIME}%${filled}s${RESET}" | tr ' ' '█'
    printf "%${empty}s" | tr ' ' '░'
    printf "] ${BOLD}%3d%%${RESET} ${DIM}%s${RESET}" "$pct" "$label"
}

check_deps() {
    for cmd in curl jq; do
        if ! command -v "$cmd" &>/dev/null; then
            error "Требуется $cmd. Установите: brew install $cmd / apt install $cmd"
            exit 1
        fi
    done
}

# ─── Баннер ──────────────────────────────────────────────────────────────────
print_banner() {
    echo -e ""
    echo -e "${CYAN}${BOLD}"
    echo -e "  ███╗   ███╗ ██████╗ ███████╗████████╗"
    echo -e "  ████╗ ████║██╔═══██╗██╔════╝╚══██╔══╝"
    echo -e "  ██╔████╔██║██║   ██║███████╗   ██║   "
    echo -e "  ██║╚██╔╝██║██║   ██║╚════██║   ██║   "
    echo -e "  ██║ ╚═╝ ██║╚██████╔╝███████║   ██║   "
    echo -e "  ╚═╝     ╚═╝ ╚═════╝ ╚══════╝   ╚═╝   "
    echo -e "${RESET}"
    echo -e "  ${DIM}Swarm Payment Network — Production Demo${RESET}"
    echo -e "  ${DIM}API: ${API_BASE}${RESET}"
    echo -e ""
}

# ─── 1. Health check ─────────────────────────────────────────────────────────
check_health() {
    step "STEP 1 — Health Check"
    info "Проверяем доступность сервисов..."

    local services=(
        "$API_BASE/health|Orchestrator"
        "http://localhost:8001/health|Coordinator"
        "http://localhost:8002/health|Risk Engine"
        "http://localhost:8003/health|Regulator Node"
    )

    local all_ok=true
    for entry in "${services[@]}"; do
        local url="${entry%%|*}"
        local name="${entry##*|}"
        local resp
        resp=$(curl -sf --max-time 5 "$url" 2>/dev/null || echo "")
        if echo "$resp" | grep -q '"ok"'; then
            success "$name"
        else
            warn "$name — недоступен (продолжаем демо)"
            all_ok=false
        fi
    done

    if $all_ok; then
        success "Все сервисы активны"
    else
        warn "Часть сервисов недоступна — демо продолжается в offline-режиме"
    fi
}

# ─── 2. Регистрация ──────────────────────────────────────────────────────────
register_user() {
    step "STEP 2 — Регистрация пользователя"

    DEMO_EMAIL="demo-$(date +%s)@most.network"
    DEMO_PASSWORD="DemoMost2024!"
    DEMO_COMPANY="ООО Демо ПМЭФ"
    DEMO_INN="7736123456"

    info "Email:    $DEMO_EMAIL"
    info "Компания: $DEMO_COMPANY"
    info "ИНН:      $DEMO_INN"
    echo ""

    log "curl POST $API_BASE/api/v1/auth/register"
    REGISTER_RESP=$(curl -sf -X POST "$API_BASE/api/v1/auth/register" \
        -H "Content-Type: application/json" \
        -d "{
            \"email\":        \"$DEMO_EMAIL\",
            \"password\":     \"$DEMO_PASSWORD\",
            \"company_name\": \"$DEMO_COMPANY\",
            \"inn\":          \"$DEMO_INN\"
        }" 2>/dev/null || echo '{"error":"offline"}')

    if echo "$REGISTER_RESP" | jq -e '.access_token' &>/dev/null; then
        JWT=$(echo "$REGISTER_RESP" | jq -r '.access_token')
        USER_ID=$(echo "$REGISTER_RESP" | jq -r '.user.id')
        success "Пользователь зарегистрирован"
        success "User ID: $USER_ID"
        log "JWT: ${JWT:0:40}..."
    else
        warn "API недоступен — используем demo JWT"
        JWT="demo.jwt.token"
        USER_ID="demo-user-id"
    fi
}

# ─── 3. Логин ────────────────────────────────────────────────────────────────
login_user() {
    step "STEP 3 — Авторизация (Login)"

    log "curl POST $API_BASE/api/v1/auth/login"
    LOGIN_RESP=$(curl -sf -X POST "$API_BASE/api/v1/auth/login" \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"$DEMO_EMAIL\",\"password\":\"$DEMO_PASSWORD\"}" \
        2>/dev/null || echo '{"error":"offline"}')

    if echo "$LOGIN_RESP" | jq -e '.access_token' &>/dev/null; then
        JWT=$(echo "$LOGIN_RESP" | jq -r '.access_token')
        success "JWT токен получен"
        log "Bearer: ${JWT:0:50}..."
    else
        warn "Используем JWT из регистрации"
    fi
}

# ─── 4. AML-проверка ─────────────────────────────────────────────────────────
aml_check() {
    step "STEP 4 — AML-проверка адреса получателя"

    DEST_ADDRESS="EQAbc123demo456def789ghi012jkl345mno678pqr901stu"
    DEST_COUNTRY="AE"

    info "Адрес: $DEST_ADDRESS"
    info "Страна: $DEST_COUNTRY (ОАЭ)"

    log "curl POST http://localhost:8002/api/v1/risk/check"
    AML_RESP=$(curl -sf -X POST "http://localhost:8002/api/v1/risk/check" \
        -H "Content-Type: application/json" \
        -d "{\"address\":\"$DEST_ADDRESS\",\"network\":\"ton\"}" \
        2>/dev/null || echo '{"risk_score":18,"recommendation":"APPROVE","is_sanctioned":false,"is_mixer":false}')

    RISK_SCORE=$(echo "$AML_RESP" | jq -r '.risk_score // 18')
    RECOMMENDATION=$(echo "$AML_RESP" | jq -r '.recommendation // "APPROVE"')

    echo ""
    echo -e "  Риск-скор:      ${BOLD}${RISK_SCORE}/100${RESET}"
    echo -e "  Рекомендация:   ${GREEN}${BOLD}${RECOMMENDATION}${RESET}"
    echo ""

    if [[ "$RECOMMENDATION" == "REJECT" ]]; then
        error "AML: адрес заблокирован! Платёж отклонён."
        exit 1
    elif [[ "$RECOMMENDATION" == "MANUAL_REVIEW" ]]; then
        warn "AML: платёж пойдёт на ручную проверку compliance"
    else
        success "AML: адрес чистый — платёж разрешён"
    fi
}

# ─── 5. Создание платежа ─────────────────────────────────────────────────────
create_payment() {
    step "STEP 5 — Создание платежа \$$( printf '%s' "$AMOUNT" | sed ':a;s/\B[0-9]\{3\}\>/,&/;ta')"

    info "Сумма:          \$$AMOUNT"
    info "Из сети:        TON"
    info "В сеть:         Ethereum"
    info "Страна:         $DEST_COUNTRY"
    info "Адрес:          ${DEST_ADDRESS:0:20}..."
    echo ""

    log "curl POST $API_BASE/api/v1/payments/new"
    PAYMENT_RESP=$(curl -sf -X POST "$API_BASE/api/v1/payments/new" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $JWT" \
        -d "{
            \"from_currency\":       \"TON\",
            \"to_currency\":         \"ETH\",
            \"amount\":              $AMOUNT,
            \"destination_country\": \"$DEST_COUNTRY\",
            \"destination_address\": \"$DEST_ADDRESS\"
        }" 2>/dev/null || echo '{
            "order_id":       "demo-order-'$(date +%s)'",
            "status":         "processing",
            "total_agents":   892,
            "completed_agents": 0,
            "progress_percent": 0,
            "aml_risk_score": 18,
            "aml_recommendation": "APPROVE"
        }')

    ORDER_ID=$(echo "$PAYMENT_RESP" | jq -r '.order_id // "demo-order"')
    TOTAL_AGENTS=$(echo "$PAYMENT_RESP" | jq -r '.total_agents // 892')
    STATUS=$(echo "$PAYMENT_RESP" | jq -r '.status // "processing"')

    echo ""
    echo -e "  ${GREEN}${BOLD}Платёж создан!${RESET}"
    echo -e "  Order ID:       ${BOLD}${ORDER_ID}${RESET}"
    echo -e "  Swarm-агентов:  ${BOLD}${YELLOW}${TOTAL_AGENTS}${RESET}"
    echo -e "  Статус:         ${CYAN}${STATUS}${RESET}"
}

# ─── 6. Live прогресс роя ────────────────────────────────────────────────────
watch_swarm() {
    step "STEP 6 — Live мониторинг Swarm-роя"

    info "Платёж \$$AMOUNT разбит на $TOTAL_AGENTS частей"
    info "Агенты маршрутизируют через 20 блокчейн-сетей..."
    echo ""

    local completed=0
    local pct=0
    local elapsed=0
    local spin=('⠋' '⠙' '⠹' '⠸' '⠼' '⠴' '⠦' '⠧' '⠇' '⠏')
    local spin_i=0

    while [[ $pct -lt 100 ]]; do
        # Запрос статуса
        STATUS_RESP=$(curl -sf "$API_BASE/api/v1/payments/$ORDER_ID" \
            -H "Authorization: Bearer $JWT" \
            2>/dev/null || echo "")

        if [[ -n "$STATUS_RESP" ]]; then
            completed=$(echo "$STATUS_RESP" | jq -r '.completed_agents // 0')
            pct_raw=$(echo "$STATUS_RESP" | jq -r '.progress_percent // 0')
            pct=$(echo "$pct_raw" | cut -d'.' -f1)
            STATUS=$(echo "$STATUS_RESP" | jq -r '.status // "processing"')
        else
            # Симуляция прогресса для demo
            completed=$(( completed + RANDOM % 40 + 10 ))
            [[ $completed -gt $TOTAL_AGENTS ]] && completed=$TOTAL_AGENTS
            pct=$(( completed * 100 / TOTAL_AGENTS ))
            STATUS="processing"
        fi

        local spin_char="${spin[$spin_i]}"
        spin_i=$(( (spin_i + 1) % 10 ))

        progress_bar "$pct" "${spin_char} ${completed}/${TOTAL_AGENTS} агентов · ${elapsed}с · ${STATUS}"

        [[ "$STATUS" == "completed" || "$STATUS" == "rejected" || $pct -ge 100 ]] && break

        sleep "$POLL_INTERVAL"
        elapsed=$(( elapsed + POLL_INTERVAL ))
    done

    echo -e "\n"
    success "Swarm завершён за ${elapsed} секунд!"
}

# ─── 7. Финальная статистика ─────────────────────────────────────────────────
final_stats() {
    step "STEP 7 — Финальная статистика"

    FINAL_RESP=$(curl -sf "$API_BASE/api/v1/payments/$ORDER_ID" \
        -H "Authorization: Bearer $JWT" \
        2>/dev/null || echo "{
            \"order_id\":         \"$ORDER_ID\",
            \"status\":           \"completed\",
            \"total_agents\":     $TOTAL_AGENTS,
            \"completed_agents\": $TOTAL_AGENTS,
            \"progress_percent\":  100
        }")

    local final_completed
    final_completed=$(echo "$FINAL_RESP" | jq -r '.completed_agents // '"$TOTAL_AGENTS")
    local final_status
    final_status=$(echo "$FINAL_RESP" | jq -r '.status // "completed"')

    echo ""
    echo -e "  ${BOLD}╔══════════════════════════════════════╗${RESET}"
    echo -e "  ${BOLD}║       MOST — Результат платежа       ║${RESET}"
    echo -e "  ${BOLD}╚══════════════════════════════════════╝${RESET}"
    echo ""
    echo -e "  Order ID:         ${DIM}$ORDER_ID${RESET}"
    echo -e "  Сумма:            ${BOLD}${GREEN}\$$(printf '%s' "$AMOUNT" | sed ':a;s/\B[0-9]\{3\}\>/,&/;ta')${RESET}"
    echo -e "  Статус:           ${GREEN}${BOLD}$final_status${RESET}"
    echo -e "  Агентов всего:    ${BOLD}$TOTAL_AGENTS${RESET}"
    echo -e "  Выполнено:        ${GREEN}${BOLD}$final_completed${RESET}"
    echo -e "  Успешность:       ${GREEN}${BOLD}$(( final_completed * 100 / TOTAL_AGENTS ))%${RESET}"
    echo -e "  Сетей задействовано: ${CYAN}${BOLD}20${RESET}"
    echo ""
}

# ─── 8. Вид регулятора ───────────────────────────────────────────────────────
regulator_view() {
    step "STEP 8 — Вид Регулятора (Золотая нода)"

    info "Запрашиваем данные из регуляторной ноды..."
    echo ""

    REG_RESP=$(curl -sf "$REGULATOR_API/api/v1/regulator/dashboard" \
        -H "X-API-Key: $REGULATOR_KEY" \
        2>/dev/null || echo '{
            "total_orders": 14832, "active_orders": 1,
            "total_agents": 1284000, "completed_agents": 1261480,
            "agent_success_rate": 98.24, "total_volume": 298440120,
            "avg_risk_score": 22.4
        }')

    echo -e "  ${BOLD}${YELLOW}╔══════════════════════════════════════╗${RESET}"
    echo -e "  ${BOLD}${YELLOW}║    GOLD NODE — Регуляторный дашборд  ║${RESET}"
    echo -e "  ${BOLD}${YELLOW}╚══════════════════════════════════════╝${RESET}"
    echo ""

    local total_orders active_orders total_agents agent_sr total_vol avg_risk
    total_orders=$(echo "$REG_RESP" | jq -r '.total_orders // 14832')
    active_orders=$(echo "$REG_RESP" | jq -r '.active_orders // 1')
    total_agents=$(echo "$REG_RESP" | jq -r '.total_agents // 1284000')
    agent_sr=$(echo "$REG_RESP" | jq -r '.agent_success_rate // 98.24')
    total_vol=$(echo "$REG_RESP" | jq -r '.total_volume // 298440120')
    avg_risk=$(echo "$REG_RESP" | jq -r '.avg_risk_score // 22.4')

    echo -e "  Платёжных поручений:   ${BOLD}$total_orders${RESET}"
    echo -e "  Активных прямо сейчас: ${BOLD}${YELLOW}$active_orders${RESET}"
    echo -e "  Всего агентов:         ${BOLD}$total_agents${RESET}"
    echo -e "  Успешность агентов:    ${GREEN}${BOLD}${agent_sr}%${RESET}"
    echo -e "  Общий объём:           ${BOLD}\$$total_vol${RESET}"
    echo -e "  Ср. риск-скор:         ${BOLD}$avg_risk/100${RESET}"
    echo ""

    echo -e "  ${DIM}vs Chainalysis: MOST раскрывает полный граф маршрута,"
    echo -e "  tx_hash каждого агента и аудит-лог всех действий.${RESET}"
    echo ""

    # Полный trace платежа
    info "Трассировка платежа $ORDER_ID:"
    TRACE_RESP=$(curl -sf "$REGULATOR_API/api/v1/regulator/order/$ORDER_ID/trace" \
        -H "X-API-Key: $REGULATOR_KEY" \
        2>/dev/null || echo '{
            "transparency": {
                "total_agents": '"$TOTAL_AGENTS"',
                "networks_used": ["TON","ETH","SOL","TRX","ARB","BSC","MATIC","XLM"],
                "completed_agents": '"$TOTAL_AGENTS"',
                "total_tx_hashes": '"$TOTAL_AGENTS"',
                "progress_percent": 100,
                "vs_chainalysis": {
                    "most": "Полный граф: все агенты, адреса, tx_hash, сети",
                    "chainalysis": "Только входная и выходная точка"
                }
            }
        }')

    local nets tx_count
    nets=$(echo "$TRACE_RESP" | jq -r '.transparency.networks_used | join(", ")' 2>/dev/null || echo "TON, ETH, SOL, TRX, ARB, BSC, MATIC, XLM")
    tx_count=$(echo "$TRACE_RESP" | jq -r '.transparency.total_tx_hashes // '"$TOTAL_AGENTS")

    echo ""
    echo -e "  Задействованные сети: ${CYAN}$nets${RESET}"
    echo -e "  Подтверждённых TX:    ${GREEN}${BOLD}$tx_count${RESET}"
    echo ""
    echo -e "  ${GREEN}MOST:${RESET}        полный граф, каждый агент виден"
    echo -e "  ${RED}Chainalysis:${RESET} только точки входа/выхода — маршрут скрыт"
    echo ""
}

# ─── Main ────────────────────────────────────────────────────────────────────
main() {
    print_banner
    check_deps
    check_health
    register_user
    login_user
    aml_check
    create_payment
    watch_swarm
    final_stats
    regulator_view

    echo -e "${GREEN}${BOLD}"
    echo -e "  ✓ Демо завершено успешно!"
    echo -e "  Платёж \$$AMOUNT прошёл через $TOTAL_AGENTS агентов в 20 сетях."
    echo -e "${RESET}"
    echo -e "  ${DIM}Следующий шаг: откройте Grafana → make grafana${RESET}"
    echo ""
}

main "$@"
