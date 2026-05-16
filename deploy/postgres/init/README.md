# Postgres init scripts are applied in lexical order on first start of an empty volume.
#
#  00-schema.sql         — schema-only dump of Cloud (CI artifact from release-onprem.yml).
#                          Fetched by install.sh / update.sh and placed here BEFORE
#                          `docker compose up postgres`. Contains all tables, functions,
#                          triggers, RLS for public+auth+storage schemas. No data.
#
#  01-roles.sql          — legacy: creates anon/authenticated roles for PostgREST.
#                          Kept for compatibility with older schema dumps that don't
#                          define them.
#
#  02-sync-outbox.sql    — legacy: sync_outbox table + applying-GUC trigger.
#                          Becomes a no-op once 00-schema.sql owns it (uses IF NOT EXISTS).
#
#  10-bootstrap-admin.sql — seeds admin@local / Welcome6407! as super_admin.
#
# After first start, all of these are ignored — Postgres only runs initdb scripts
# on an empty data volume. To re-bootstrap, wipe the postgres_data volume.
