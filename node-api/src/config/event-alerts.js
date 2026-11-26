// Prepara las suscripciones y la cola de correos al arrancar Node.
export async function initializeEventAlerts(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS event_alert_subscriptions (
      token UUID PRIMARY KEY,
      event_slug VARCHAR(200) NOT NULL,
      email VARCHAR(254) NOT NULL,
      requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      confirmed_at TIMESTAMPTZ,
      UNIQUE (event_slug, email)
    );

    CREATE TABLE IF NOT EXISTS event_alert_emails (
      id BIGSERIAL PRIMARY KEY,
      token UUID NOT NULL REFERENCES event_alert_subscriptions(token) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      title TEXT NOT NULL,
      next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE UNIQUE INDEX IF NOT EXISTS event_alert_one_confirmation
      ON event_alert_emails (token) WHERE kind = 'confirm';

    ALTER TABLE event_alert_subscriptions ENABLE ROW LEVEL SECURITY;
    ALTER TABLE event_alert_emails ENABLE ROW LEVEL SECURITY;

    -- Encola los avisos en la misma transacción que modifica o elimina el evento.
    CREATE OR REPLACE FUNCTION queue_agenda_event_alert() RETURNS trigger AS $$
    DECLARE notice TEXT;
    BEGIN
      IF TG_OP = 'DELETE' THEN
        notice := 'removed';
      ELSIF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('cancelled', 'deleted', 'suspended') THEN
        notice := NEW.status;
      ELSIF NEW.status IN ('published', 'rescheduled') AND
        (NEW.start_at, NEW.end_at, NEW.location, NEW.city) IS DISTINCT FROM
        (OLD.start_at, OLD.end_at, OLD.location, OLD.city) THEN
        notice := 'changed';
      -- Los cambios de una propuesta en revisión se anuncian cuando vuelve a publicarse.
      ELSIF NEW.status IN ('published', 'rescheduled') AND OLD.status IN ('pending', 'changes_requested', 'suspended', 'cancelled') THEN
        notice := 'updated';
      END IF;

      IF notice IS NOT NULL THEN
        INSERT INTO event_alert_emails (token, kind, title)
        SELECT token, notice, OLD.title
        FROM event_alert_subscriptions
        WHERE event_slug = OLD.slug AND confirmed_at IS NOT NULL;
      END IF;
      RETURN NULL;
    END;
    $$ LANGUAGE plpgsql;

    CREATE OR REPLACE TRIGGER agenda_event_alert
      AFTER UPDATE OR DELETE ON events
      FOR EACH ROW EXECUTE FUNCTION queue_agenda_event_alert();
  `)
}
