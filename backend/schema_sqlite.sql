-- Initial schema for the inventory management system

PRAGMA foreign_keys = ON;

-- Table for storage locations
CREATE TABLE IF NOT EXISTS locations (
    location_id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT UNIQUE NOT NULL, -- UUID provided by application or import
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
);

-- Table for item categories
CREATE TABLE IF NOT EXISTS categories (
    category_id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT UNIQUE NOT NULL, -- UUID provided by application or import
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
);

-- Table for storing image data
CREATE TABLE IF NOT EXISTS images (
    image_id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT UNIQUE NOT NULL, -- UUID provided by application or import
    image_data BLOB NOT NULL,
    image_mimetype TEXT NOT NULL,
    image_filename TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    -- No updated_at needed for images typically
);

-- Table for item owners
CREATE TABLE IF NOT EXISTS owners (
    owner_id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT UNIQUE NOT NULL, -- UUID provided by application or import
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
);

-- Table for inventory items
CREATE TABLE IF NOT EXISTS items (
    item_id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT UNIQUE NOT NULL, -- UUID provided by application or import
    name TEXT NOT NULL,
    description TEXT,
    location_id INTEGER,
    category_id INTEGER,
    image_id INTEGER,
    image_uuid TEXT, -- Added column to store the UUID of the linked image
    owner_id INTEGER,
    price REAL, -- nullable, two-decimal float
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    FOREIGN KEY (location_id) REFERENCES locations(location_id) ON DELETE SET NULL,
    FOREIGN KEY (category_id) REFERENCES categories(category_id) ON DELETE SET NULL,
    FOREIGN KEY (image_id) REFERENCES images(image_id) ON DELETE SET NULL,
    FOREIGN KEY (image_uuid) REFERENCES images(uuid) ON DELETE SET NULL, -- Added FK constraint for image UUID
    FOREIGN KEY (owner_id) REFERENCES owners(owner_id) ON DELETE SET NULL
);

-- Schema versioning table
CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER NOT NULL
);
INSERT OR IGNORE INTO schema_version(version) VALUES(3);
