# ClothInv

ClothInv is a minimalist application designed for straightforward clothing inventory management. It prioritizes simplicity and a focused user experience, allowing you to catalog and browse your wardrobe with ease. By default, ClothInv operates entirely within your browser, offering a private and configuration-free experience.

## Core Features

*   Catalog clothing items with images and essential metadata (e.g., owner, category, location).
*   Intuitive interface for browsing and searching your inventory.
*   Data export and import functionality (as a ZIP file) for backup and migration.
*   Flexible data storage options:
    *   Browser-local IndexedDB (default, zero-configuration).
    *   Self-hosted Datasette backend.
    *   Self-hosted PostgREST backend (with PostgreSQL).

## Getting Started

There are several ways to use ClothInv:

### 1. Online Version (Recommended)

The easiest way to use ClothInv is via the publicly hosted version:

**[https://teekuningas.github.io/clothinv](https://teekuningas.github.io/clothinv)**

No setup is required. All data is stored locally in your web browser's IndexedDB and localStorage. This is a secure, private, and entirely client-side solution, perfect for personal use.

### 2. Self-Hosting with Docker (Static Files)

For users who prefer to host their own instance, ClothInv is available as a Docker image. This image serves the static application files using Nginx.

1.  **Pull the Docker image:**
    *   The official image is hosted on GitHub Container Registry (ghcr.io). You can use the `latest` tag for the most recent version or a specific version tag.
    *   Example: `docker pull ghcr.io/teekuningas/clothinv:latest`
    *   Specific version example: `docker pull ghcr.io/teekuningas/clothinv:0.2.0` (Replace `0.2.0` with the desired version)
    *   You can find all available tags on the [GitHub Packages page of this repository](https://github.com/teekuningas/clothinv/pkgs/container/clothinv) or under the [Releases section](https://github.com/teekuningas/clothinv/releases).

2.  **Run the container:**
    *   `docker run -d -p 8080:80 ghcr.io/teekuningas/clothinv:latest`
    *   Access ClothInv at `http://localhost:8080`.

By default, this self-hosted version also uses browser-local storage (IndexedDB). For advanced local development or building the image yourself, refer to the `Makefile`.

### 3. Connecting to a Persistent Backend (Advanced)

ClothInv can connect to external database backends via Datasette or PostgREST. This enables persistent storage beyond a single browser session and allows for data sharing across multiple devices or users. Configure the connection details in the application's "Settings" page.

**a. Datasette Backend**

Datasette provides a web interface and API for SQLite databases.

*   **Important:** ClothInv requires **Datasette version 1.0-alpha or newer**. Earlier versions (0.x) have a JSON API that is not sufficient for ClothInv's needs. The `Makefile` uses `1.0a19` by default.
*   To run a local Datasette instance for development or personal use (refer to the `Makefile` for full command details and configuration):
    ```bash
    make start-backend-datasette ENV=dev
    ```
*   This command will set up a Datasette instance using a SQLite database (`inventory.db` by default), initialize the schema, and output the Datasette URL and an API token.
*   Enter the provided Datasette Base URL and API Token into ClothInv's settings page under the "Datasette" provider.

**b. PostgreSQL + PostgREST Backend**

PostgREST serves a RESTful API directly from a PostgreSQL database.

*   To run local PostgreSQL and PostgREST instances for development or personal use (refer to the `Makefile` for full command details and configuration):
    ```bash
    make start-backend-postgrest ENV=dev
    ```
*   This command performs the following:
    1.  Starts a PostgreSQL Docker container.
    2.  Initializes the database (e.g., `inventory_db_dev`) with the required schema from `backend/schema_postgres.sql`. This schema defines tables for items, locations, categories, owners, images, and image blobs.
    3.  Starts a PostgREST Docker container connected to the PostgreSQL database.
    4.  Outputs the PostgREST API URL (e.g., `http://localhost:4000`) and a JWT token for authentication.
*   Enter the provided PostgREST API URL and JWT Token into ClothInv's settings page under the "PostgREST" provider.
*   The `Makefile` uses default credentials (e.g., user `inventory_user_dev`, password `supersecretpassword`). For any deployment beyond local testing, ensure you use strong, unique credentials and manage your PostgreSQL instance securely. The schema (`backend/schema_postgres.sql`) is designed for a dedicated user (e.g., `inventory_user_dev`) who owns the tables.

## Data Management

### Export and Import

ClothInv allows you to export your entire inventory (metadata and images) as a single `.zip` file. This file can be used for:

*   Backing up your data.
*   Migrating your inventory to another ClothInv instance or a different backend.

The import function allows restoring data from such a `.zip` file. This feature is available regardless of the chosen storage backend.

### Sharing Configuration (with a Persistent Backend)

When ClothInv is configured to use a persistent backend (Datasette or PostgREST), you can easily share access to your inventory:

1.  Set up ClothInv with your chosen persistent backend.
2.  Navigate to the "Settings" page.
3.  Under the "Share Configuration" section, a shareable URL will be displayed.
4.  Copy this URL and open it on another device, or share it with others.

Opening this URL will pre-configure their ClothInv instance to connect to the same backend, enabling shared access to the inventory data.

**Note on Simplicity:** ClothInv maintains its design philosophy of simplicity by not implementing user accounts, fine-grained permissions, or user groups. All users accessing a shared backend via the configuration URL will have the same level of access to the data.
