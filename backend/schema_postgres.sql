-- PostgreSQL schema for the inventory management system

-- Function to update the updated_at column automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = CURRENT_TIMESTAMP;
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Table for storage locations
CREATE TABLE IF NOT EXISTS locations (
    location_id SERIAL PRIMARY KEY,
    uuid UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ -- Trigger will handle updates
);

-- Trigger for locations updated_at
CREATE TRIGGER update_locations_updated_at
BEFORE UPDATE ON locations
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Table for item categories
CREATE TABLE IF NOT EXISTS categories (
    category_id SERIAL PRIMARY KEY,
    uuid UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ -- Trigger will handle updates
);

-- Trigger for categories updated_at
CREATE TRIGGER update_categories_updated_at
BEFORE UPDATE ON categories
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Table for storing image data
CREATE TABLE IF NOT EXISTS images (
    image_id SERIAL PRIMARY KEY,
    uuid UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
    image_data TEXT NOT NULL, -- Changed from BYTEA to TEXT
    image_mimetype TEXT NOT NULL,
    image_filename TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    -- No updated_at needed for images typically
);

-- Table for item owners
CREATE TABLE IF NOT EXISTS owners (
    owner_id SERIAL PRIMARY KEY,
    uuid UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ -- Trigger will handle updates
);

-- Trigger for owners updated_at
CREATE TRIGGER update_owners_updated_at
BEFORE UPDATE ON owners
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Table for inventory items
CREATE TABLE IF NOT EXISTS items (
    item_id SERIAL PRIMARY KEY,
    uuid UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    location_id INTEGER,
    category_id INTEGER,
    image_id INTEGER, -- Foreign key to images.image_id
    image_uuid UUID, -- The UUID of the linked image
    owner_id INTEGER,
    price NUMERIC(10,2), -- nullable, two-decimal float
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ, -- Trigger will handle updates
    FOREIGN KEY (location_id) REFERENCES locations(location_id) ON DELETE SET NULL,
    FOREIGN KEY (category_id) REFERENCES categories(category_id) ON DELETE SET NULL,
    FOREIGN KEY (image_id) REFERENCES images(image_id) ON DELETE SET NULL,
    FOREIGN KEY (image_uuid) REFERENCES images(uuid) ON DELETE SET NULL,
    FOREIGN KEY (owner_id) REFERENCES owners(owner_id) ON DELETE SET NULL
);

-- Trigger for items updated_at
CREATE TRIGGER update_items_updated_at
BEFORE UPDATE ON items
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Schema versioning table
CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER NOT NULL
);
INSERT INTO schema_version(version)
  SELECT 3
  WHERE NOT EXISTS (SELECT 1 FROM schema_version);
