-- CFT_Final_Updated.xlsx Sheet 1 additional-charge configuration.
-- The zone-to-zone rate matrix is intentionally not touched here; all values
-- remain editable through the Delhivery B2B Additional Charges panel.
BEGIN;

-- Create the courier-scoped record if this B2B courier has not been
-- configured yet, while leaving the Household account untouched.
INSERT INTO shiplifi_b2b_additional_charges (
  courier_id, service_provider, plan_id, awb_charges, cft_factor,
  minimum_chargeable_amount, minimum_chargeable_weight, minimum_chargeable_method,
  free_storage_days, demurrage_per_awb_day, demurrage_per_kg_day, demurrage_method,
  public_holiday_pickup_charge, fuel_surcharge_percentage, green_tax, oda_config,
  handling_slabs, fuel_hike_config, service_charges_config, billing_config,
  oda_charges, oda_per_kg_charge, oda_method, csd_delivery_charge,
  time_specific_per_kg, time_specific_per_awb, time_specific_method,
  mall_delivery_per_kg, mall_delivery_per_awb, mall_delivery_method,
  delivery_reattempt_per_kg, delivery_reattempt_per_awb, delivery_reattempt_method,
  handling_single_piece, handling_below_100_kg, handling_100_to_200_kg,
  handling_above_200_kg, insurance_charge, cod_fixed_amount, cod_percentage,
  cod_method, rov_fixed_amount, rov_percentage, rov_method, liability_limit,
  liability_method, custom_fields, field_definitions
)
SELECT
  target.id, 'delhivery', h.plan_id, h.awb_charges, h.cft_factor,
  h.minimum_chargeable_amount, h.minimum_chargeable_weight, h.minimum_chargeable_method,
  h.free_storage_days, h.demurrage_per_awb_day, h.demurrage_per_kg_day, h.demurrage_method,
  h.public_holiday_pickup_charge, h.fuel_surcharge_percentage, h.green_tax, h.oda_config,
  h.handling_slabs, h.fuel_hike_config, h.service_charges_config, h.billing_config,
  h.oda_charges, h.oda_per_kg_charge, h.oda_method, h.csd_delivery_charge,
  h.time_specific_per_kg, h.time_specific_per_awb, h.time_specific_method,
  h.mall_delivery_per_kg, h.mall_delivery_per_awb, h.mall_delivery_method,
  h.delivery_reattempt_per_kg, h.delivery_reattempt_per_awb, h.delivery_reattempt_method,
  h.handling_single_piece, h.handling_below_100_kg, h.handling_100_to_200_kg,
  h.handling_above_200_kg, h.insurance_charge, h.cod_fixed_amount, h.cod_percentage,
  h.cod_method, h.rov_fixed_amount, h.rov_percentage, h.rov_method, h.liability_limit,
  h.liability_method, h.custom_fields, h.field_definitions
FROM couriers target
LEFT JOIN shiplifi_b2b_additional_charges existing ON existing.courier_id = target.id
LEFT JOIN LATERAL (
  SELECT * FROM shiplifi_b2b_additional_charges
  WHERE courier_id = (SELECT id FROM couriers WHERE name = 'Delhivery - Household' LIMIT 1)
  LIMIT 1
) h ON true
WHERE target.name = 'Delhivery - B2B'
  AND target."serviceProvider" = 'delhivery'
  AND existing.id IS NULL
  AND h.id IS NOT NULL;

UPDATE shiplifi_b2b_additional_charges AS c
SET
  awb_charges = 200,
  cft_factor = 4500,
  minimum_chargeable_amount = 200,
  minimum_chargeable_weight = 30,
  minimum_chargeable_method = 'whichever_is_higher',
  free_storage_days = 4,
  demurrage_per_kg_day = 1,
  demurrage_method = 'per_kg_day',
  fuel_surcharge_percentage = 20,
  green_tax = 0.5,
  oda_config = jsonb_build_object(
    'mode', 'delivery',
    'pickupExemptions', '[]'::jsonb,
    'deliveryExemptions', '[]'::jsonb,
    'slabs', jsonb_build_array(
      jsonb_build_object('lowerKg', 0, 'upperKg', 200, 'perKg', 4, 'minCharge', 750),
      jsonb_build_object('lowerKg', 200, 'upperKg', NULL, 'perKg', 4, 'minCharge', 750)
    )
  ),
  handling_slabs = jsonb_build_array(
    jsonb_build_object('lowerKg', 100, 'upperKg', 250, 'charge', 0, 'chargeType', 'per_kg'),
    jsonb_build_object('lowerKg', 250, 'upperKg', 400, 'charge', 0, 'chargeType', 'per_kg'),
    jsonb_build_object('lowerKg', 400, 'upperKg', NULL, 'charge', 3, 'chargeType', 'per_kg')
  ),
  fuel_hike_config = jsonb_build_object(
    'baseRate', 92.72, 'threshold', 0, 'thresholdType', 'amount',
    'duration', 'current_billing_month', 'changeInFuelRate', 3,
    'changeInFreight', 2, 'changeInFreightType', 'percent',
    'locationIds', jsonb_build_array('1','2','3','4'),
    'application', 'base_freight', 'allowNegative', false
  ),
  service_charges_config = COALESCE(c.service_charges_config, '{}'::jsonb) || jsonb_build_object(
    'greenTax', jsonb_build_object('enabled', true, 'type', 'per_kg', 'rate', 0.5, 'minCharge', 100),
    'demurrage', jsonb_build_object('enabled', true, 'type', 'per_kg_day', 'rate', 1, 'minCharge', 100),
    'floorDelivery', jsonb_build_object('enabled', true, 'type', 'per_kg', 'rate', 0),
    'mallDelivery', jsonb_build_object('enabled', true, 'type', 'per_kg', 'rate', 4, 'minCharge', 750),
    'appointmentHandling', jsonb_build_object('enabled', true, 'type', 'per_kg', 'rate', 4, 'minCharge', 750),
    'fmCost', jsonb_build_object('enabled', true, 'type', 'per_kg', 'rate', 0.8, 'minCharge', 100),
    'lmCost', jsonb_build_object('enabled', true, 'type', 'per_kg', 'rate', 0),
    'toPay', jsonb_build_object('enabled', true, 'type', 'flat', 'rate', 0),
    'chequeHandling', jsonb_build_object('enabled', true, 'type', 'flat', 'rate', 300),
    'cashHandling', jsonb_build_object('enabled', true, 'type', 'percent', 'rate', 0.5, 'minCharge', 300),
    'podCharges', jsonb_build_object('enabled', false, 'type', 'flat', 'rate', 0, 'option', 'pod_link'),
    'sunHolidayDelivery', jsonb_build_object('enabled', false, 'type', 'flat', 'rate', 0),
    'rovOwner', jsonb_build_object('minCharge', 150, 'percent', 10, 'method', 'whichever_is_higher'),
    'rovCarrier', jsonb_build_object('minCharge', 200, 'percent', 40, 'method', 'whichever_is_higher'),
    'processing', jsonb_build_object('enabled', true, 'type', 'flat', 'rate', 200)
  ),
  oda_charges = 0,
  oda_per_kg_charge = 0,
  csd_delivery_charge = 4,
  time_specific_per_kg = 4,
  time_specific_per_awb = 750,
  time_specific_method = 'whichever_is_higher',
  mall_delivery_per_kg = 4,
  mall_delivery_per_awb = 750,
  mall_delivery_method = 'whichever_is_higher',
  delivery_reattempt_per_kg = 0,
  delivery_reattempt_per_awb = 0,
  delivery_reattempt_method = 'whichever_is_higher',
  handling_single_piece = 0,
  handling_below_100_kg = 0,
  handling_100_to_200_kg = 0,
  handling_above_200_kg = 3,
  cod_fixed_amount = 0,
  cod_percentage = 0,
  rov_fixed_amount = 150,
  rov_percentage = 10,
  rov_method = 'whichever_is_higher',
  custom_fields = COALESCE(c.custom_fields, '{}'::jsonb) || jsonb_build_object(
    'source', 'CFT_Final_Updated.xlsx', 'invoiceType', 'delivery', 'billingCycle', 'bi-monthly',
    'roundOff', true, 'weightSlabBasedBilling', false, 'billingStartDate', 1,
    'publicHolidayPickupCharge', 0, 'podOption', 'pod_link', 'podCharge', 0,
    'reAttemptFreeAttempts', 2, 'maxDeadWeightPerPackage', 0, 'intraCityRate', 0
  )
WHERE c.courier_id = (SELECT id FROM couriers WHERE name = 'Delhivery - B2B' AND "serviceProvider" = 'delhivery' LIMIT 1)
  AND c.service_provider = 'delhivery';

COMMIT;
