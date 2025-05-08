# Clothinv

Clothinv is a minimalist application for clothing inventory management. It allows cataloging and browsing your wardrobe. By default, Clothinv operates entirely within your browser, using private, configuration-free local storage.

## Core Features

*   Catalog clothing items with images and essential metadata (e.g., owner, category, location).
*   Interface for browsing and searching your inventory.
*   Responsive design for desktop and mobile screen sizes.
*   Data export and import functionality (as a ZIP file) for backup and migration.
*   Data storage options:
    *   Browser-local IndexedDB (default, zero-configuration).
    *   Self-hosted Datasette backend.
    *   Self-hosted PostgREST backend (with PostgreSQL).
    *   Modular data provider architecture supporting different backend systems.

## Getting Started

There are several ways to use Clothinv:

### 1. Online Version (Recommended)

Clothinv can be used via the publicly hosted version:

**[https://teekuningas.github.io/clothinv](https://teekuningas.github.io/clothinv)**

No setup is required. All data is stored locally in your web browser's IndexedDB and localStorage. This provides a private and client-side solution.

### 2. Self-Hosting with Docker (Static Files)

For users who prefer to host their own instance, Clothinv is available as a Docker image. This image serves the static application files using Nginx.

1.  **Pull the Docker image:**
    *   The official image is hosted on GitHub Container Registry (ghcr.io). You can use the `latest` tag for the most recent version or a specific version tag.
    *   Example: `docker pull ghcr.io/teekuningas/clothinv:latest`

2.  **Run the container:**
    *   Example: `docker run -d -p 8080:80 ghcr.io/teekuningas/clothinv:latest`
    *   Access Clothinv at `http://localhost:8080`.

By default, this self-hosted version also uses browser-local storage (IndexedDB). For advanced local development or building the image yourself, refer to the `Makefile`.

### 3. Connecting to a Persistent Backend (Advanced)

Clothinv can connect to external database backends via Datasette or PostgREST. This enables persistent storage beyond a single browser session and allows for data sharing across multiple devices or users. Configure the connection details in the application's "Settings" page.

**a. Datasette Backend**

Datasette provides a web interface and API for SQLite databases.

*   **Important:** Clothinv requires **Datasette version 1.0-alpha or newer**. Earlier versions (0.x) have a JSON API incompatible with Clothinv's requirements. The `Makefile` uses `1.0a19` by default.
*   To run a local Datasette instance for development or personal use (refer to the `Makefile` for full command details and configuration):
    ```bash
    make start-backend-datasette ENV=dev
    ```
*   This command will set up a Datasette instance using a SQLite database (`inventory.db` by default), initialize the schema, and output the Datasette URL and an API token.
*   Enter the provided Datasette Base URL and API Token into Clothinv's settings page under the "Datasette" provider.

**b. PostgreSQL + PostgREST Backend**

PostgREST serves a RESTful API directly from a PostgreSQL database.

*   To run local PostgreSQL and PostgREST instances for development or personal use (refer to the `Makefile` for full command details and configuration):
    ```bash
    make start-backend-postgrest ENV=dev
    ```
*   This command performs the following:
    1.  Starts a PostgreSQL Docker container.
    2.  Initializes the database (e.g., `inventory_db_dev`) with the required schema from `backend/schema_postgres.sql`. This schema defines tables for items, locations, categories, owners, and images.
    3.  Starts a PostgREST Docker container connected to the PostgreSQL database.
    4.  Outputs the PostgREST API URL (e.g., `http://localhost:4000`) and a JWT token for authentication.
*   Enter the provided PostgREST API URL and JWT Token into Clothinv's settings page under the "PostgREST" provider.
*   The `Makefile` uses default credentials (e.g., user `inventory_user_dev`, password `supersecretpassword`). For any deployment beyond local testing, ensure you use strong, unique credentials and manage your PostgreSQL instance securely. The schema (`backend/schema_postgres.sql`) is designed for a dedicated user (e.g., `inventory_user_dev`) who owns the tables.

## Data Management

### Export and Import

Clothinv allows you to export your entire inventory (metadata and images) as a single `.zip` file. This file can be used for:

*   Backing up your data.
*   Migrating your inventory to another Clothinv instance or a different backend.

The import function allows restoring data from such a `.zip` file. This feature is available regardless of the chosen storage backend.

### Sharing Configuration (with a Persistent Backend)

When Clothinv is configured to use a persistent backend (Datasette or PostgREST), you can share access to your inventory:

1.  Set up Clothinv with your chosen persistent backend.
2.  Navigate to the "Settings" page.
3.  Under the "Share Configuration" section, a shareable URL can be generated.
4.  Copy this URL and open it on another device, or share it with others.

Opening this URL will pre-configure their Clothinv instance to connect to the same backend, enabling shared access to the inventory data.

**Note:** Clothinv does not implement user accounts, fine-grained permissions, or user groups. All users accessing a shared backend via the configuration URL will have the same level of access to the data.
