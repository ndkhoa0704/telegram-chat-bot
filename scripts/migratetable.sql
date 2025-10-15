CREATE TABLE IF NOT EXISTS document (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    embeding vector(1536) NOT NULL,
    content text,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
)

CREATE INDEX IF NOT EXISTS idx_document_embeding ON document USING ivfflat (embeding vector_l2_ops)
