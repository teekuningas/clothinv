.PHONY: help shell init-db-datasette start-backend-datasette init-db-postgres start-backend-postgres watch-frontend start-backend-postgres-api

# --- Configuration ---
SCHEMA_SQLITE_FILE := db/schema_sqlite.sql
SCHEMA_POSTGRES_FILE := db/schema_postgres.sql

# Datasette / SQLite
DATASATTE_DB_DIR := db/datasette
DATASATTE_DB_FILE := $(DATASATTE_DB_DIR)/inventory.db

# PostgreSQL / Docker
POSTGRES_DB := inventory_db
POSTGRES_USER := inventory_user
POSTGRES_PASSWORD := supersecretpassword
POSTGRES_CONTAINER_NAME := inventory-postgres-dev
POSTGRES_PORT := 5432

shell:
	nix develop

init-db-datasette:
	@echo "Initializing Datasette database $(DATASATTE_DB_FILE) from $(SCHEMA_SQLITE_FILE)..."
	@mkdir -p $(DATASATTE_DB_DIR)
	@sqlite3 $(DATASATTE_DB_FILE) < $(SCHEMA_SQLITE_FILE)
	@echo "Database initialized."

start-backend-datasette:
	@echo "Starting Datasette server on http://127.0.0.1:8001 for $(DATASATTE_DB_FILE)..."
	@datasette serve $(DATASATTE_DB_FILE) --port 8001 --cors --root

init-db-postgres:
	@echo "Initializing PostgreSQL database '$(POSTGRES_DB)' using schema $(SCHEMA_POSTGRES_FILE)..."
	@echo "NOTE: Requires the PostgreSQL container to be running (make start-backend-postgres)."
	@cat $(SCHEMA_POSTGRES_FILE) | sudo docker exec -i $(POSTGRES_CONTAINER_NAME) psql -U $(POSTGRES_USER) -d $(POSTGRES_DB)
	@echo "PostgreSQL database schema applied."
	@echo "Connection URL: postgresql://$(POSTGRES_USER):$(POSTGRES_PASSWORD)@localhost:$(POSTGRES_PORT)/$(POSTGRES_DB)"

start-backend-postgres:
	@echo "Starting PostgreSQL container '$(POSTGRES_CONTAINER_NAME)' in the foreground on port $(POSTGRES_PORT)... (Press Ctrl+C to stop)"
	@echo "Using bind mount './db/postgres' for data persistence."
	@echo "DB: $(POSTGRES_DB), User: $(POSTGRES_USER)"
	@mkdir -p db/postgres # Ensure the host directory exists
	@sudo docker run --name $(POSTGRES_CONTAINER_NAME) \
		-e POSTGRES_DB=$(POSTGRES_DB) \
		-e POSTGRES_USER=$(POSTGRES_USER) \
		-e POSTGRES_PASSWORD=$(POSTGRES_PASSWORD) \
		-p $(POSTGRES_PORT):5432 \
		-v $(shell pwd)/db/postgres:/var/lib/postgresql/data \
		--rm \
		postgres:15
	@echo "Use 'make init-db-postgres' to apply the schema if this is the first run."

start-backend-postgres-api:
	@echo "Starting PostgREST container 'inventory-postgrest-dev' in the foreground on port 4000..."
	@echo "Connecting to PostgreSQL at localhost:$(POSTGRES_PORT) as user $(POSTGRES_USER)"
	@echo ">>> JWT Authentication Required <<<"
	@sudo docker run --name inventory-postgrest-dev \
		-e PGRST_DB_URI="postgresql://$(POSTGRES_USER):$(POSTGRES_PASSWORD)@127.0.0.1:$(POSTGRES_PORT)/$(POSTGRES_DB)" \
		-e PGRST_DB_SCHEMA="public" \
		-e PGRST_DB_ANON_ROLE="anon_role" \
		-e PGRST_JWT_SECRET="KJhgfdsAPoiuytrewqLKJHGFDSAmnbvcxzPOIUYTREWQ1234567890" \
		-e PGRST_SERVER_PORT="4000" \
		-e PGRST_OPENAPI_SERVER_PROXY_URI="http://localhost:4000" \
		--rm \
		--network host \
		postgrest/postgrest
	@echo "PostgREST container stopped."

watch-frontend:
	@echo "Starting frontend development server..."
	@cd frontend && npm install && npm run dev

