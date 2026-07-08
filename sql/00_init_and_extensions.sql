-- =============================================================================
-- Phase 0: Clean Slate & Extensions
-- =============================================================================

-- Drop schema to start fresh (Run with caution!)
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Define Enums for data integrity
CREATE TYPE user_role_enum AS ENUM ('client', 'lawyer', 'admin');
CREATE TYPE appointment_status_enum AS ENUM ('pending', 'confirmed', 'completed', 'cancelled', 'no_show');
CREATE TYPE case_status_enum AS ENUM ('active', 'on_hold', 'closed', 'archived');
CREATE TYPE verification_status_enum AS ENUM ('pending', 'under_review', 'verified', 'rejected');
CREATE TYPE subscription_plan_enum AS ENUM ('free', 'basic', 'professional', 'enterprise');
CREATE TYPE job_status_enum AS ENUM ('open', 'in_progress', 'completed', 'cancelled');
CREATE TYPE proposal_status_enum AS ENUM ('pending', 'accepted', 'rejected', 'withdrawn');
CREATE TYPE contract_status_enum AS ENUM ('active', 'completed', 'disputed', 'cancelled');
CREATE TYPE milestone_status_enum AS ENUM ('pending', 'in_progress', 'completed', 'blocked');
CREATE TYPE payment_status_enum AS ENUM ('pending', 'held_in_escrow', 'released', 'refunded', 'failed');
CREATE TYPE dispute_status_enum AS ENUM ('open', 'investigating', 'resolved', 'closed');
