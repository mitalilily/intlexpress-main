-- CFT_Final_Updated.xlsx Sheet 1 additional-charge configuration.
-- The zone-to-zone rate matrix is intentionally not touched here; all values
-- remain editable through the Delhivery B2B Additional Charges panel.
BEGIN;

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
