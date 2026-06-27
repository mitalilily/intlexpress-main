CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "googleId" varchar(64),
  ADD COLUMN IF NOT EXISTS "pendingEmail" varchar(100),
  ADD COLUMN IF NOT EXISTS "pendingPhone" varchar(20),
  ADD COLUMN IF NOT EXISTS "passwordHash" varchar(200),
  ADD COLUMN IF NOT EXISTS "refreshToken" varchar(500),
  ADD COLUMN IF NOT EXISTS "refreshTokenExpiresAt" timestamp,
  ADD COLUMN IF NOT EXISTS "previousRefreshToken" varchar(500),
  ADD COLUMN IF NOT EXISTS "previousRefreshTokenExpiresAt" timestamp,
  ADD COLUMN IF NOT EXISTS "accountVerified" boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS "profilePicture" varchar(512),
  ADD COLUMN IF NOT EXISTS "otp" varchar(6),
  ADD COLUMN IF NOT EXISTS "otpExpiresAt" timestamptz,
  ADD COLUMN IF NOT EXISTS "emailVerificationToken" varchar(8),
  ADD COLUMN IF NOT EXISTS "emailVerificationTokenExpiresAt" timestamptz,
  ADD COLUMN IF NOT EXISTS "createdAt" timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS "updatedAt" timestamptz DEFAULT now();

UPDATE "users" SET "emailVerified" = false WHERE "emailVerified" IS NULL;
UPDATE "users" SET "phoneVerified" = false WHERE "phoneVerified" IS NULL;
UPDATE "users" SET "accountVerified" = false WHERE "accountVerified" IS NULL;
UPDATE "users" SET "role" = 'customer' WHERE "role" IS NULL;
UPDATE "users" SET "createdAt" = now() WHERE "createdAt" IS NULL;
UPDATE "users" SET "updatedAt" = now() WHERE "updatedAt" IS NULL;

ALTER TABLE "users" ALTER COLUMN "emailVerified" SET DEFAULT false;
ALTER TABLE "users" ALTER COLUMN "phoneVerified" SET DEFAULT false;
ALTER TABLE "users" ALTER COLUMN "accountVerified" SET DEFAULT false;
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'customer';
ALTER TABLE "users" ALTER COLUMN "createdAt" SET DEFAULT now();
ALTER TABLE "users" ALTER COLUMN "updatedAt" SET DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invoice_status') THEN
    CREATE TYPE "invoice_status" AS ENUM ('pending', 'paid');
  END IF;
END $$;

ALTER TYPE "invoice_status" ADD VALUE IF NOT EXISTS 'disputed';
ALTER TYPE "invoice_status" ADD VALUE IF NOT EXISTS 'overdue';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'billingInvoiceTypeEnum') THEN
    CREATE TYPE "billingInvoiceTypeEnum" AS ENUM (
      'weekly',
      'monthly_summary',
      'manual'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "billingInvoices" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "invoice_no" varchar(50) NOT NULL UNIQUE,
  "seller_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "billing_start" date NOT NULL,
  "billing_end" date NOT NULL,
  "taxable_value" numeric(12, 2) DEFAULT '0',
  "cgst" numeric(12, 2) DEFAULT '0',
  "sgst" numeric(12, 2) DEFAULT '0',
  "igst" numeric(12, 2) DEFAULT '0',
  "total_amount" numeric(12, 2) DEFAULT '0',
  "gst_rate" integer DEFAULT 18,
  "status" "invoice_status" NOT NULL DEFAULT 'pending',
  "type" "billingInvoiceTypeEnum" NOT NULL DEFAULT 'weekly',
  "pdf_url" text NOT NULL DEFAULT '',
  "csv_url" text NOT NULL DEFAULT '',
  "order_numbers" jsonb,
  "is_disputed" boolean DEFAULT false,
  "remarks" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now()
);

ALTER TABLE "billingInvoices" ADD COLUMN IF NOT EXISTS "invoice_no" varchar(50);
ALTER TABLE "billingInvoices" ADD COLUMN IF NOT EXISTS "seller_id" uuid;
ALTER TABLE "billingInvoices" ADD COLUMN IF NOT EXISTS "billing_start" date;
ALTER TABLE "billingInvoices" ADD COLUMN IF NOT EXISTS "billing_end" date;
ALTER TABLE "billingInvoices" ADD COLUMN IF NOT EXISTS "taxable_value" numeric(12, 2) DEFAULT '0';
ALTER TABLE "billingInvoices" ADD COLUMN IF NOT EXISTS "cgst" numeric(12, 2) DEFAULT '0';
ALTER TABLE "billingInvoices" ADD COLUMN IF NOT EXISTS "sgst" numeric(12, 2) DEFAULT '0';
ALTER TABLE "billingInvoices" ADD COLUMN IF NOT EXISTS "igst" numeric(12, 2) DEFAULT '0';
ALTER TABLE "billingInvoices" ADD COLUMN IF NOT EXISTS "total_amount" numeric(12, 2) DEFAULT '0';
ALTER TABLE "billingInvoices" ADD COLUMN IF NOT EXISTS "gst_rate" integer DEFAULT 18;
ALTER TABLE "billingInvoices" ADD COLUMN IF NOT EXISTS "status" "invoice_status" DEFAULT 'pending';
ALTER TABLE "billingInvoices" ADD COLUMN IF NOT EXISTS "type" "billingInvoiceTypeEnum" DEFAULT 'weekly';
ALTER TABLE "billingInvoices" ADD COLUMN IF NOT EXISTS "pdf_url" text DEFAULT '';
ALTER TABLE "billingInvoices" ADD COLUMN IF NOT EXISTS "csv_url" text DEFAULT '';
ALTER TABLE "billingInvoices" ADD COLUMN IF NOT EXISTS "order_numbers" jsonb;
ALTER TABLE "billingInvoices" ADD COLUMN IF NOT EXISTS "is_disputed" boolean DEFAULT false;
ALTER TABLE "billingInvoices" ADD COLUMN IF NOT EXISTS "remarks" text;
ALTER TABLE "billingInvoices" ADD COLUMN IF NOT EXISTS "created_at" timestamptz DEFAULT now();
ALTER TABLE "billingInvoices" ADD COLUMN IF NOT EXISTS "updated_at" timestamptz DEFAULT now();

UPDATE "billingInvoices" SET "pdf_url" = '' WHERE "pdf_url" IS NULL;
UPDATE "billingInvoices" SET "csv_url" = '' WHERE "csv_url" IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'billingInvoices_seller_id_users_id_fk'
  ) THEN
    ALTER TABLE "billingInvoices"
    ADD CONSTRAINT "billingInvoices_seller_id_users_id_fk"
    FOREIGN KEY ("seller_id")
    REFERENCES "users"("id")
    ON DELETE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "invoice_sequences" (
  "user_id" uuid NOT NULL,
  "last_sequence" bigint NOT NULL DEFAULT 0,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'invoice_sequences_pkey'
  ) THEN
    ALTER TABLE "invoice_sequences"
    ADD CONSTRAINT "invoice_sequences_pkey" PRIMARY KEY ("user_id");
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'invoice_sequences_user_id_users_id_fk'
  ) THEN
    ALTER TABLE "invoice_sequences"
    ADD CONSTRAINT "invoice_sequences_user_id_users_id_fk"
    FOREIGN KEY ("user_id")
    REFERENCES "users"("id")
    ON DELETE CASCADE;
  END IF;
END $$;
