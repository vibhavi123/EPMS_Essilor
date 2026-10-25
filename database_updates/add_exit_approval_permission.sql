-- Add the Exit Approval access-control flag to existing installations.
SET @column_exists := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'UserPermissions'
      AND COLUMN_NAME = 'ExitApproval'
);

SET @sql := IF(
    @column_exists = 0,
    'ALTER TABLE UserPermissions ADD COLUMN ExitApproval TINYINT(1) NOT NULL DEFAULT 0',
    'SELECT 1'
);

PREPARE add_exit_approval_permission FROM @sql;
EXECUTE add_exit_approval_permission;
DEALLOCATE PREPARE add_exit_approval_permission;
