-- ========================================
-- Add LoginMonitor Permission to UserPermissions Table
-- ========================================

-- Step 1: Add LoginMonitor column to UserPermissions table
-- This adds a BIT column to store the login monitor permission
ALTER TABLE UserPermissions 
ADD LoginMonitor BIT NULL;

-- Step 2: Update existing records to have default value (0 = false)
-- This ensures all existing users have the permission set to false by default
UPDATE UserPermissions 
SET LoginMonitor = 0 
WHERE LoginMonitor IS NULL;

-- Step 3: Make the column NOT NULL with default value
-- This ensures future records will always have a value
ALTER TABLE UserPermissions 
ALTER COLUMN LoginMonitor BIT NOT NULL DEFAULT 0;

-- Step 4: Verify the changes
-- This query shows the structure of the updated table
SELECT 
    COLUMN_NAME,
    DATA_TYPE,
    IS_NULLABLE,
    COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'UserPermissions' 
    AND COLUMN_NAME = 'LoginMonitor';

-- Step 5: Test query to verify data
-- This shows a sample of records with the new column
SELECT TOP 5 
    AccessId,
    LoginMonitor,
    UpdatedAt
FROM UserPermissions 
ORDER BY UpdatedAt DESC;

-- ========================================
-- Rollback Script (if needed)
-- ========================================
-- Uncomment the following lines to rollback changes:

-- ALTER TABLE UserPermissions DROP COLUMN LoginMonitor;

-- ========================================
-- Notes
-- ========================================
-- 1. The LoginMonitor column controls access to the Login Monitor page
-- 2. Value 0 = No Access, 1 = Has Access
-- 3. Existing users are set to 0 (no access) by default for security
-- 4. New users will default to 0 (no access)
-- 5. The AccessControlModal UI will manage this permission
-- 6. The Login Monitor page is protected by PermissionGuard with this permission
