-- Treat each Delhivery B2B credential account as its own courier.
-- Idempotent: safe to run on every VPS release.

begin;

with delhivery_b2b_account_couriers(id, name) as (
  values
    (21002, 'Delhivery B2B Account 1'),
    (21003, 'Delhivery B2B Account 2')
),
updated_existing as (
  update couriers c
  set
    name = v.name,
    "isEnabled" = true,
    business_type = '["b2b"]'::jsonb,
    updated_at = now()
  from delhivery_b2b_account_couriers v
  where c.id = v.id
    and lower(c."serviceProvider") = 'delhivery'
  returning c.id
)
insert into couriers (
  id,
  name,
  "serviceProvider",
  "isEnabled",
  business_type,
  created_at,
  updated_at
)
select
  v.id,
  v.name,
  'delhivery',
  true,
  '["b2b"]'::jsonb,
  now(),
  now()
from delhivery_b2b_account_couriers v
where not exists (
  select 1
  from couriers c
  where c.id = v.id
    and lower(c."serviceProvider") = 'delhivery'
);

-- Generic Delhivery Air/Surface rows remain B2C-only. B2B must use the
-- account-specific courier rows above so rates and extra charges can diverge.
update couriers
set
  business_type = '["b2c"]'::jsonb,
  updated_at = now()
where id in (99, 100)
  and lower("serviceProvider") = 'delhivery';

-- Move legacy/generic Delhivery B2B commercial configuration to Account 1.
-- Account 2 intentionally starts independently; admins can assign its own card.
update shipping_rates
set
  courier_id = 21002,
  courier_name = 'Delhivery B2B Account 1',
  service_provider = 'delhivery',
  mode = 'Surface',
  last_updated = now()
where lower(business_type) = 'b2b'
  and (
    lower(coalesce(service_provider, '')) = 'delhivery'
    or lower(coalesce(courier_name, '')) like '%delhivery%'
    or courier_id in (99, 100, 1, 92, 93)
  )
  and (courier_id is null or courier_id <> 21003);

update shiplifi_b2b_zone_to_zone_rates
set
  courier_id = 21002,
  service_provider = 'delhivery',
  updated_at = now()
where (
    lower(coalesce(service_provider, '')) = 'delhivery'
    or courier_id in (99, 100, 1, 92, 93)
  )
  and (courier_id is null or courier_id <> 21003);

update shiplifi_b2b_additional_charges
set
  courier_id = 21002,
  service_provider = 'delhivery',
  updated_at = now()
where (
    lower(coalesce(service_provider, '')) = 'delhivery'
    or courier_id in (99, 100, 1, 92, 93)
  )
  and (courier_id is null or courier_id <> 21003);

update shiplifi_b2b_overhead_rules
set
  courier_id = 21002,
  service_provider = 'delhivery',
  updated_at = now()
where (
    lower(coalesce(service_provider, '')) = 'delhivery'
    or courier_id in (99, 100, 1, 92, 93)
  )
  and (courier_id is null or courier_id <> 21003);

update shiplifi_b2b_pincodes
set
  courier_id = 21002,
  service_provider = 'delhivery',
  updated_at = now()
where (
    lower(coalesce(service_provider, '')) = 'delhivery'
    or courier_id in (99, 100, 1, 92, 93)
  )
  and (courier_id is null or courier_id <> 21003);

update shiplifi_b2b_zone_states
set
  courier_id = 21002,
  service_provider = 'delhivery',
  updated_at = now()
where (
    lower(coalesce(service_provider, '')) = 'delhivery'
    or courier_id in (99, 100, 1, 92, 93)
  )
  and (courier_id is null or courier_id <> 21003);

update shiplifi_b2b_zone_regions
set
  courier_id = 21002,
  service_provider = 'delhivery'
where (
    lower(coalesce(service_provider, '')) = 'delhivery'
    or courier_id in (99, 100, 1, 92, 93)
  )
  and (courier_id is null or courier_id <> 21003);

commit;
