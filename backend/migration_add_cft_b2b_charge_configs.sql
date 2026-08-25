ALTER TABLE IF EXISTS shiplifi_b2b_additional_charges
  ADD COLUMN IF NOT EXISTS oda_config jsonb,
  ADD COLUMN IF NOT EXISTS handling_slabs jsonb,
  ADD COLUMN IF NOT EXISTS fuel_hike_config jsonb,
  ADD COLUMN IF NOT EXISTS service_charges_config jsonb,
  ADD COLUMN IF NOT EXISTS billing_config jsonb;
