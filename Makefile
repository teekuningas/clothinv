.PHONY: help shell init_db start-backend watch-frontend clean

DB_FILE := db/inventory.db
SCHEMA_FILE := db/schema.sql

help:
	@echo "Available targets:"
	@echo "  shell          - Enter the development environment"
	@echo "  init_db        - Initialize the SQLite database from schema"
	@echo "  start-backend  - Start the Datasette server"
	@echo "  watch-frontend - Start the frontend development server (Vite)"
	@echo "  clean          - Remove the database file and frontend build artifacts"

shell:
	nix develop

init_db:
	@echo "Initializing database $(DB_FILE) from $(SCHEMA_FILE)..."
	@mkdir -p db
	@sqlite3 $(DB_FILE) < $(SCHEMA_FILE)
	@echo "Database initialized."

start-backend:
	@echo "Starting Datasette server on http://127.0.0.1:8001 for $(DB_FILE)..."
	@datasette serve $(DB_FILE) --port 8001

watch-frontend:
	@echo "Starting frontend development server..."
	@cd frontend && npm install && npm run dev

# Default target
default: help
