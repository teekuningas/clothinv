#!/usr/bin/env python3
import os
import sqlite3
import sys

def main():
    db_path = os.environ.get("DB_PATH")
    schema_path = os.environ.get("SCHEMA_PATH")

    if not db_path:
        print("Error: DB_PATH environment variable not set.", file=sys.stderr)
        sys.exit(1)
    if not schema_path:
        print("Error: SCHEMA_PATH environment variable not set.", file=sys.stderr)
        sys.exit(1)

    if os.path.exists(db_path):
        print(f"Database file already exists at {db_path}. Skipping initialization.")
        sys.exit(0)

    print(f"Database file not found at {db_path}. Initializing...")

    # Ensure the directory exists
    db_dir = os.path.dirname(db_path)
    if db_dir: # Only create if db_path includes a directory part
        try:
            os.makedirs(db_dir, exist_ok=True)
            print(f"Ensured directory {db_dir} exists.")
        except OSError as e:
            print(f"Error creating directory {db_dir}: {e}", file=sys.stderr)
            sys.exit(1)

    conn = None
    try:
        print(f"Reading schema from {schema_path}...")
        with open(schema_path, 'r') as f:
            schema_sql = f.read()

        print(f"Connecting to and creating database at {db_path}...")
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        print("Executing schema script...")
        cursor.executescript(schema_sql)

        print("Committing changes...")
        conn.commit()
        print("Database initialized successfully.")

    except sqlite3.Error as e:
        print(f"SQLite error during initialization: {e}", file=sys.stderr)
        # Attempt to clean up the potentially incomplete database file
        if conn:
            conn.close() # Close connection first
        if os.path.exists(db_path):
            try:
                os.remove(db_path)
                print(f"Removed partially created database file {db_path}.", file=sys.stderr)
            except OSError as rm_e:
                print(f"Error removing partially created database file {db_path}: {rm_e}", file=sys.stderr)
        sys.exit(1)
    except IOError as e:
        print(f"File error: {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"An unexpected error occurred: {e}", file=sys.stderr)
        # Attempt cleanup as above
        if conn:
            conn.close()
        if os.path.exists(db_path):
             try:
                 os.remove(db_path)
                 print(f"Removed potentially corrupted database file {db_path}.", file=sys.stderr)
             except OSError as rm_e:
                 print(f"Error removing potentially corrupted database file {db_path}: {rm_e}", file=sys.stderr)
        sys.exit(1)
    finally:
        if conn:
            conn.close()
            print("Database connection closed.")

if __name__ == "__main__":
    main()
