/*
  Modification 01 — Informational price for building materials (مواد البناء)

  Target   : database AlShaibHousingDB, table dbo.InventoryItems
  Change   : add nullable column Price decimal(14,2) — informational only
  Safety   : idempotent (safe to run more than once), additive only,
             no data is modified, no backfill, no table is dropped/recreated.
             Existing materials keep Price = NULL.

  Why a manual script: the API creates its schema with EnsureCreated(), which
  never alters an existing database. This column must be added BEFORE the new
  API version starts, otherwise reads of InventoryItems fail with
  "Invalid column name 'Price'".

  Run order: 1) full database backup  2) this script  3) deploy new API + web
  Rollback (only if the release is rolled back and the column must go):
      ALTER TABLE dbo.InventoryItems DROP COLUMN Price;
  (The previous API version ignores the extra column, so dropping is optional.)
*/

SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF OBJECT_ID(N'dbo.InventoryItems', N'U') IS NULL
    THROW 50001, 'Table dbo.InventoryItems not found - wrong database?', 1;

IF COL_LENGTH(N'dbo.InventoryItems', N'Price') IS NULL
BEGIN
    ALTER TABLE dbo.InventoryItems ADD Price decimal(14,2) NULL;
    PRINT 'Added column dbo.InventoryItems.Price decimal(14,2) NULL';
END
ELSE
    PRINT 'Column dbo.InventoryItems.Price already exists - nothing to do';

COMMIT TRANSACTION;

-- Verification
SELECT COLUMN_NAME, DATA_TYPE, NUMERIC_PRECISION, NUMERIC_SCALE, IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = N'dbo' AND TABLE_NAME = N'InventoryItems' AND COLUMN_NAME = N'Price';
