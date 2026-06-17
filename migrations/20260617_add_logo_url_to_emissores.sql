-- Migration: Add logo_url to emissores table
ALTER TABLE emissores ADD COLUMN IF NOT EXISTS logo_url TEXT;
