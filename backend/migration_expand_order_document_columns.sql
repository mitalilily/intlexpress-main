ALTER TABLE b2c_orders
  ALTER COLUMN label TYPE varchar(512),
  ALTER COLUMN manifest TYPE varchar(512),
  ALTER COLUMN pickup_error TYPE text,
  ALTER COLUMN manifest_error TYPE text;

ALTER TABLE b2b_orders
  ALTER COLUMN label TYPE varchar(512),
  ALTER COLUMN manifest TYPE varchar(512);
