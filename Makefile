.PHONY: help shell init-db-datasette start-backend-datasette init-db-postgres start-backend-postgres watch-frontend

# --- Configuration ---
SCHEMA_SQLITE_FILE := db/schema_sqlite.sql
SCHEMA_POSTGRES_FILE := db/schema_postgres.sql

# Datasette / SQLite
DATASATTE_DB_DIR := db/datasette
DATASATTE_DB_FILE := $(DATASATTE_DB_DIR)/inventory.db

# PostgreSQL / Docker
POSTGRES_DB := inventory_db
POSTGRES_USER := inventory_user
POSTGRES_PASSWORD := supersecretpassword # Change this in production!
POSTGRES_CONTAINER_NAME := inventory-postgres-dev
POSTGRES_PORT := 5432
# Use a Docker volume for persistent data during development
POSTGRES_VOLUME_NAME := inventory-postgres-data

help:
	@echo "Available targets:"
	@echo "  shell                 - Enter the development environment"
	@echo "  init-db-datasette     - Initialize the SQLite database ($(DATASATTE_DB_FILE)) from $(SCHEMA_SQLITE_FILE)"
	@echo "  start-backend-datasette - Start the Datasette server for SQLite"
	@echo "  init-db-postgres      - Initialize the PostgreSQL database from $(SCHEMA_POSTGRES_FILE) (requires running 'start-backend-postgres' first)"
	@echo "  start-backend-postgres - Start the PostgreSQL server in a Docker container (Ctrl+C to stop)"
	@echo "  watch-frontend        - Start the frontend development server (Vite)"

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
	@echo "Using volume '$(POSTGRES_VOLUME_NAME)' for data persistence."
	@echo "DB: $(POSTGRES_DB), User: $(POSTGRES_USER)"
	@sudo docker run --name $(POSTGRES_CONTAINER_NAME) \
		-e POSTGRES_DB=$(POSTGRES_DB) \
		-e POSTGRES_USER=$(POSTGRES_USER) \
		-e POSTGRES_PASSWORD=$(POSTGRES_PASSWORD) \
		-p $(POSTGRES_PORT):5432 \
		-v $(POSTGRES_VOLUME_NAME):/var/lib/postgresql/data \
		--rm \
		postgres:15 # Use a specific version, e.g., postgres:15
	@echo "Use 'make init-db-postgres' to apply the schema if this is the first run."

watch-frontend:
	@echo "Starting frontend development server..."
	@cd frontend && npm install && npm run dev

# Default target
default: help
