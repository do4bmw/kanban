-- CreateTable
CREATE TABLE "LabelTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "LabelTemplate_pkey" PRIMARY KEY ("id")
);

-- Seed default labels
INSERT INTO "LabelTemplate" ("id", "name", "color", "order") VALUES
  (gen_random_uuid()::text, 'Erledigt',       '#22c55e', 0),
  (gen_random_uuid()::text, 'In Bearbeitung', '#f97316', 1),
  (gen_random_uuid()::text, 'Blockiert',      '#ef4444', 2),
  (gen_random_uuid()::text, 'Zur Prüfung',    '#3b82f6', 3),
  (gen_random_uuid()::text, 'Wartet',         '#eab308', 4),
  (gen_random_uuid()::text, 'Priorität',      '#a855f7', 5);
