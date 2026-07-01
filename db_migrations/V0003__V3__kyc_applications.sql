CREATE TABLE IF NOT EXISTS kyc_applications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),
    company_name    TEXT NOT NULL,
    inn             TEXT NOT NULL,
    legal_address   TEXT NOT NULL,
    ceo_name        TEXT NOT NULL,
    phone           TEXT NOT NULL,
    website         TEXT,
    business_type   TEXT NOT NULL,
    monthly_volume  TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending_review',
    doc_charter_url     TEXT,
    doc_ceo_id_url      TEXT,
    doc_extract_url     TEXT,
    reviewed_by     UUID REFERENCES users(id),
    reviewed_at     TIMESTAMPTZ,
    reject_reason   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kyc_user_id ON kyc_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_kyc_status  ON kyc_applications(status);
CREATE INDEX IF NOT EXISTS idx_kyc_created ON kyc_applications(created_at DESC);
