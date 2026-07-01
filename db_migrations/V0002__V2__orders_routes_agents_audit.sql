CREATE TABLE IF NOT EXISTS payment_orders (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id),
    from_currency       TEXT NOT NULL,
    to_currency         TEXT NOT NULL,
    amount              NUMERIC(28,8) NOT NULL,
    destination_country TEXT,
    destination_address TEXT NOT NULL,
    status              TEXT NOT NULL DEFAULT 'processing',
    risk_score          INTEGER NOT NULL DEFAULT 0,
    approved_by         UUID REFERENCES users(id),
    approved_at         TIMESTAMPTZ,
    reject_reason       TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS swarm_routes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id        UUID NOT NULL REFERENCES payment_orders(id),
    total_parts     INTEGER NOT NULL DEFAULT 0,
    completed_parts INTEGER NOT NULL DEFAULT 0,
    strategy        JSONB NOT NULL DEFAULT '{}',
    status          TEXT NOT NULL DEFAULT 'pending',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS swarm_agents (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route_id     UUID NOT NULL REFERENCES swarm_routes(id),
    agent_name   TEXT NOT NULL,
    network      TEXT NOT NULL,
    from_address TEXT NOT NULL,
    to_address   TEXT NOT NULL,
    amount       NUMERIC(28,8) NOT NULL,
    status       TEXT NOT NULL DEFAULT 'idle',
    tx_hash      TEXT,
    attempts     INTEGER NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id         BIGSERIAL PRIMARY KEY,
    user_id    UUID REFERENCES users(id),
    action     TEXT NOT NULL,
    details    JSONB NOT NULL DEFAULT '{}',
    ip_address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_orders_user_id ON payment_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_orders_status  ON payment_orders(status);
CREATE INDEX IF NOT EXISTS idx_payment_orders_created ON payment_orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_swarm_routes_order_id  ON swarm_routes(order_id);
CREATE INDEX IF NOT EXISTS idx_swarm_routes_status    ON swarm_routes(status);
CREATE INDEX IF NOT EXISTS idx_swarm_agents_route_id  ON swarm_agents(route_id);
CREATE INDEX IF NOT EXISTS idx_swarm_agents_status    ON swarm_agents(status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id     ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created     ON audit_logs(created_at DESC);
