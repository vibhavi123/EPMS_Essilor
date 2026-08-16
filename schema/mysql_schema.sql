
-- =============================================================================

-- 1. CREATE & USE DATABASE
-- -----------------------------------------------------------------------------
CREATE DATABASE IF NOT EXISTS GuardSystemDB
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE GuardSystemDB;

-- =============================================================================
-- 2. USERS TABLE-ok
-- =============================================================================
CREATE TABLE IF NOT EXISTS Users (
    Id           INT            NOT NULL AUTO_INCREMENT PRIMARY KEY,
    AccessId     VARCHAR(50)    NOT NULL,
    Username     VARCHAR(100)   NOT NULL,
    PasswordHash VARCHAR(255)   NOT NULL,
    FullName     VARCHAR(150)   NOT NULL,
    Role         VARCHAR(50)    NOT NULL DEFAULT 'guard',
    Department   VARCHAR(100)   NULL,
    Company      VARCHAR(150)   NULL,
    IsActive     TINYINT(1)     NOT NULL DEFAULT 1,
    CreatedAt    DATETIME(6)    NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    UpdatedAt    DATETIME(6)    NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    CONSTRAINT UQ_Users_AccessId  UNIQUE (AccessId),
    CONSTRAINT UQ_Users_Username  UNIQUE (Username),
    CONSTRAINT CHK_Users_Role     CHECK (Role IN ('Employee', 'admin', 'guard', 'superAdmin'))
);

CREATE INDEX IX_Users_Username ON Users (Username);

-- =============================================================================
-- 3. INCOMING PACKAGES-ok
-- =============================================================================
CREATE TABLE IF NOT EXISTS IncomingPackages (
    Id                      INT             NOT NULL AUTO_INCREMENT PRIMARY KEY,

    TrackingNumber          VARCHAR(100)    NOT NULL,
    ReferenceNumber         VARCHAR(100)    NULL,

    `Mode`                  VARCHAR(20)     NOT NULL DEFAULT 'single',

    CustomerName            VARCHAR(150)    NOT NULL,
    `Time`                  VARCHAR(50)     NOT NULL,
    `Date`                  VARCHAR(50)     NOT NULL,

    EmployeeId              VARCHAR(50)     NULL,
    EmployeeName            VARCHAR(150)    NULL,
    EmployeeCompany         VARCHAR(150)    NULL,
    Department              VARCHAR(100)    NULL,
    EmployeeVerifiedId      VARCHAR(100)    NULL,

    DeliveryCompany         VARCHAR(150)    NOT NULL,
    DeliveryPersonName      VARCHAR(150)    NOT NULL,

    VehicleNumber           VARCHAR(50)     NOT NULL,
    VehicleType             VARCHAR(100)    NOT NULL,

    Remark                  VARCHAR(1000)   NULL,

    VerificationStatus      VARCHAR(50)     NOT NULL DEFAULT 'verified',

    HoldingState            TINYINT(1)      NOT NULL DEFAULT 0,
    HoldingReason           VARCHAR(500)    NULL,

    GuardVerificationStatus VARCHAR(50)     NOT NULL DEFAULT 'pending',
    GuardId                 VARCHAR(100)    NULL,
    HandOverGuardId         VARCHAR(100)    NULL,
    GuardVerifiedAt         DATETIME(6)     NULL,

    VerifiedAt              DATETIME(6)     NULL,

    CreatedAt               DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    UpdatedAt               DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    CONSTRAINT UQ_Incoming_TrackingNumber        UNIQUE (TrackingNumber),
    CONSTRAINT CHK_Incoming_Mode                 CHECK (`Mode` IN ('single', 'batch')),
    CONSTRAINT CHK_Incoming_VerificationStatus   CHECK (VerificationStatus IN ('holding', 'verified', 'completed', 'Cancelled')),
    CONSTRAINT CHK_Incoming_GuardStatus          CHECK (GuardVerificationStatus IN ('pending', 'verified'))
);

CREATE INDEX IX_Incoming_TrackingNumber      ON IncomingPackages (TrackingNumber);
CREATE INDEX IX_Incoming_ReferenceNumber     ON IncomingPackages (ReferenceNumber);
CREATE INDEX IX_Incoming_CustomerName        ON IncomingPackages (CustomerName);
CREATE INDEX IX_Incoming_VerificationStatus  ON IncomingPackages (VerificationStatus);

-- Trigger: auto-update UpdatedAt (MySQL handles this via ON UPDATE above, but explicit trigger for parity)
-- Note: The ON UPDATE CURRENT_TIMESTAMP(6) on UpdatedAt column already handles this automatically in MySQL.

-- =============================================================================
-- 4. OUTGOING PACKAGES-ok
-- =============================================================================
CREATE TABLE IF NOT EXISTS OutgoingPackages (
    Id                      INT             NOT NULL AUTO_INCREMENT PRIMARY KEY,

    TrackingNumber          VARCHAR(100)    NOT NULL,
    ReferenceNumber         VARCHAR(100)    NULL,

    `Mode`                  VARCHAR(20)     NOT NULL DEFAULT 'single',
    CustomerName            VARCHAR(150)    NULL,

    DeliveryPersonName      VARCHAR(150)    NULL,
    PackageDescription      VARCHAR(500)    NOT NULL,

    `Time`                  VARCHAR(50)     NOT NULL,
    `Date`                  VARCHAR(50)     NOT NULL,

    EmployeeId              VARCHAR(50)     NULL,
    EmployeeName            VARCHAR(150)    NULL,
    EmployeeCompany         VARCHAR(150)    NULL,
    Department              VARCHAR(100)    NULL,

    DeliveryCompany         VARCHAR(150)    NOT NULL,

    VehicleNumber           VARCHAR(50)     NULL,
    VehicleType             VARCHAR(100)    NULL,

    Remark                  VARCHAR(1000)   NULL,

    VerificationStatus      VARCHAR(50)     NOT NULL DEFAULT 'verified',

    HoldingState            TINYINT(1)      NOT NULL DEFAULT 0,
    HoldingReason           VARCHAR(500)    NULL,

    GuardVerificationStatus VARCHAR(50)     NOT NULL DEFAULT 'pending',
    EmployeeVerifiedId      VARCHAR(100)    NULL,

    HandOverGuardId         VARCHAR(100)    NULL,
    GuardVerifiedAt         DATETIME(6)     NULL,

    VerifiedAt              DATETIME(6)     NULL,

    CreatedAt               DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    UpdatedAt               DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    CONSTRAINT UQ_Outgoing_TrackingNumber        UNIQUE (TrackingNumber),
    CONSTRAINT CHK_Outgoing_Mode                 CHECK (`Mode` IN ('single', 'batch')),
    CONSTRAINT CHK_Outgoing_VerificationStatus   CHECK (VerificationStatus IN ('holding', 'verified', 'completed', 'Cancelled')),
    CONSTRAINT CHK_Outgoing_GuardStatus          CHECK (GuardVerificationStatus IN ('pending', 'verified'))
);

CREATE INDEX IX_Outgoing_ReferenceNumber     ON OutgoingPackages (ReferenceNumber);
CREATE INDEX IX_Outgoing_VerificationStatus  ON OutgoingPackages (VerificationStatus);

-- =============================================================================
-- 5. GATE RECORDS-ok
-- =============================================================================
CREATE TABLE IF NOT EXISTS GateRecords (
    Id                    INT           NOT NULL AUTO_INCREMENT PRIMARY KEY,

    PersonnelId           VARCHAR(100)  NOT NULL,
    Name                  VARCHAR(150)  NULL,
    VisitorReason         VARCHAR(500)  NULL,
    Type                  VARCHAR(50)   NOT NULL,
    EntryTime             VARCHAR(50)   NULL,
    ExitTime              VARCHAR(50)   NULL,

    DriverName            VARCHAR(150)  NULL,
    VehicleType           VARCHAR(50)   NULL,
    PlateNumber           VARCHAR(50)   NULL,

    VehicleArrivalReason  VARCHAR(500)  NULL,
    EmployeeExitReason    VARCHAR(500)  NULL,

    EmployeeCompany       VARCHAR(150)  NULL,
    EmployeeDepartment    VARCHAR(100)  NULL,

    `Date`                VARCHAR(50)   NULL,

    GuardId               VARCHAR(100)  NULL,
    GuardVerifiedAt       DATETIME(6)   NULL,

    CreatedAt             DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    UpdatedAt             DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    CONSTRAINT CHK_GateRecords_Type CHECK (Type IN ('employee', 'visitor', 'vehicle'))
);

CREATE INDEX IX_GateRecords_PersonnelId ON GateRecords (PersonnelId);
CREATE INDEX IX_GateRecords_Date        ON GateRecords (`Date`);
CREATE INDEX IX_GateRecords_Type        ON GateRecords (Type);
CREATE INDEX IX_GateRecords_PlateNumber ON GateRecords (PlateNumber);
CREATE INDEX IX_GateRecords_GuardId     ON GateRecords (GuardId);

-- =============================================================================
-- 6. ACCESS IDS-ok
-- =============================================================================
CREATE TABLE IF NOT EXISTS AccessIds (
    Id        INT           NOT NULL AUTO_INCREMENT PRIMARY KEY,
    AccessId  VARCHAR(50)   NOT NULL,
    Name      VARCHAR(150)  NULL,
    Username  VARCHAR(100)  NOT NULL,
    Type      VARCHAR(50)   NULL,
    IsActive  TINYINT(1)    NOT NULL DEFAULT 1,
    IssuedAt  DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    RevokedAt DATETIME(6)   NULL,

    CONSTRAINT UQ_AccessIds_AccessId  UNIQUE (AccessId),
    CONSTRAINT UQ_AccessIds_Username  UNIQUE (Username),
    CONSTRAINT CHK_AccessIds_Type     CHECK (Type IN ('user', 'admin', 'guard', 'supervisor'))
);

CREATE INDEX IX_AccessIds_AccessId ON AccessIds (AccessId);
CREATE INDEX IX_AccessIds_Username ON AccessIds (Username);

-- =============================================================================
-- 6.1 ID COUNTERS-ok
-- =============================================================================
CREATE TABLE IF NOT EXISTS IdCounters (
    CounterName  VARCHAR(100)  NOT NULL PRIMARY KEY,
    CounterValue INT           NOT NULL DEFAULT 0,
    UpdatedAt    DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
);

-- ==================================================
-- 7. EMPLOYEES-ok
-- ==================================================
CREATE TABLE IF NOT EXISTS Employees (
    Id              INT           NOT NULL AUTO_INCREMENT PRIMARY KEY,
    EmployeeId      VARCHAR(50)   NOT NULL,
    EmployeeName    VARCHAR(150)  NOT NULL,
    EmployeeCompany VARCHAR(150)  NULL,
    Department      VARCHAR(100)  NULL,
    IsActive        TINYINT(1)    NOT NULL DEFAULT 1,
    CreatedAt       DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    UpdatedAt       DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    CONSTRAINT UQ_Employees_EmployeeId UNIQUE (EmployeeId)
);

CREATE INDEX IDX_Employees_EmployeeId  ON Employees (EmployeeId);
CREATE INDEX IDX_Employees_EmployeeName ON Employees (EmployeeName);
CREATE INDEX IDX_Employees_IsActive     ON Employees (IsActive);


-- =============================================================================
-- 8. DELIVERY PERSONS
-- =============================================================================
CREATE TABLE IF NOT EXISTS DeliveryPersons (
    Id                  INT           NOT NULL AUTO_INCREMENT PRIMARY KEY,
    DeliveryPersonNIC   VARCHAR(100)  NOT NULL,
    DeliveryPersonName  VARCHAR(150)  NOT NULL,
    DeliveryCompany     VARCHAR(150)  NOT NULL,
    IsActive            TINYINT(1)    NOT NULL DEFAULT 1,
    CreatedAt           DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    CONSTRAINT UQ_DeliveryPersons_NIC UNIQUE (DeliveryPersonNIC)
);

CREATE INDEX IX_DeliveryPersons_NIC ON DeliveryPersons (DeliveryPersonNIC);

-- =============================================================================
-- 9. CUSTOMERS-ok
-- =============================================================================
CREATE TABLE IF NOT EXISTS Customers (
    Id           INT           NOT NULL AUTO_INCREMENT PRIMARY KEY,
    CustomerName VARCHAR(150)  NOT NULL,
    CreatedAt    DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
);

CREATE INDEX IX_Customers_CustomerName ON Customers (CustomerName);

-- =============================================================================
-- 10. PACKAGE DESCRIPTIONS-0k
-- =============================================================================
CREATE TABLE IF NOT EXISTS PackageDescriptions (
    Id                 INT           NOT NULL AUTO_INCREMENT PRIMARY KEY,
    PackageDescription VARCHAR(225)  NOT NULL,
    CreatedAt          DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
);

CREATE INDEX IX_PackageDescriptions_Description ON PackageDescriptions (PackageDescription);

-- =============================================================================
-- 11. DELIVERY COMPANIES-ok
-- =============================================================================
CREATE TABLE IF NOT EXISTS DeliveryCompanies (
    Id                  INT           NOT NULL AUTO_INCREMENT PRIMARY KEY,
    DeliveryCompanyName VARCHAR(150)  NOT NULL,
    CreatedAt           DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
);

CREATE INDEX IX_DeliveryCompanies_CompanyName ON DeliveryCompanies (DeliveryCompanyName);

-- =============================================================================
-- 12. APP SETTINGS-ok
-- =============================================================================
CREATE TABLE IF NOT EXISTS AppSettings (
    `Key`   VARCHAR(100) NOT NULL PRIMARY KEY,
    `Value` VARCHAR(500) NOT NULL
);

-- =============================================================================
-- 13. LOGIN SESSIONS-ok
-- =============================================================================
CREATE TABLE IF NOT EXISTS LoginSessions (
    Id        INT           NOT NULL AUTO_INCREMENT PRIMARY KEY,
    UserId    INT           NOT NULL,
    IpAddress VARCHAR(100)  NULL,
    UserAgent VARCHAR(500)  NULL,
    LoginAt   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    LogoutAt  DATETIME      NULL,
    IsActive  TINYINT(1)    NOT NULL DEFAULT 1,
    RememberMe TINYINT(1)   NOT NULL DEFAULT 0,

    CONSTRAINT FK_LoginSessions_Users
        FOREIGN KEY (UserId) REFERENCES Users (Id)
        ON DELETE CASCADE
);

CREATE INDEX IX_LoginSessions_UserId   ON LoginSessions (UserId);
CREATE INDEX IX_LoginSessions_IsActive ON LoginSessions (IsActive);

-- =============================================================================
-- 14. USER PERMISSIONS-ok
-- =============================================================================
CREATE TABLE IF NOT EXISTS UserPermissions (
    Id                       INT           NOT NULL AUTO_INCREMENT PRIMARY KEY,
    AccessId                 VARCHAR(50)   NOT NULL,

    AddOngoingPackage        TINYINT(1)    NOT NULL DEFAULT 1,
    AddIncomePackage         TINYINT(1)    NOT NULL DEFAULT 1,
    AllPackagesView          TINYINT(1)    NOT NULL DEFAULT 1,
    AllPackagesEdit          TINYINT(1)    NOT NULL DEFAULT 0,
    AllPackagesDelete        TINYINT(1)    NOT NULL DEFAULT 0,
    OutgoingVerification     TINYINT(1)    NOT NULL DEFAULT 1,
    IncomeVerification       TINYINT(1)    NOT NULL DEFAULT 1,
    AccessManagementAdd      TINYINT(1)    NOT NULL DEFAULT 0,
    AccessManagementEdit     TINYINT(1)    NOT NULL DEFAULT 0,
    AccessManagementControl  TINYINT(1)    NOT NULL DEFAULT 0,
    LoginMonitoring          TINYINT(1)    NOT NULL DEFAULT 0,
    ReportAccess             TINYINT(1)    NOT NULL DEFAULT 0,
    EntryExitRecording       TINYINT(1)    NOT NULL DEFAULT 1,
    VerifyHoldingPackages    TINYINT(1)    NOT NULL DEFAULT 1,
    OverdueEmployeeAlert     TINYINT(1)    NOT NULL DEFAULT 0,
    GuardManagementAdd       TINYINT(1)    NOT NULL DEFAULT 0,
    GuardManagementEdit      TINYINT(1)    NOT NULL DEFAULT 0,
    GuardManagementDelete    TINYINT(1)    NOT NULL DEFAULT 0,
    GuardManagementView      TINYINT(1)    NOT NULL DEFAULT 0,
    AddPackageEmployee       TINYINT(1)    NOT NULL DEFAULT 0,
    AddPackageDescription    TINYINT(1)    NOT NULL DEFAULT 0,
    AddPackageCustomer       TINYINT(1)    NOT NULL DEFAULT 0,
    AddPackageDelivery       TINYINT(1)    NOT NULL DEFAULT 0,
    AllEntryExitRecordsExport TINYINT(1)  NOT NULL DEFAULT 0,
    EmployeeVerifiedIdView   TINYINT(1)   NOT NULL DEFAULT 0,
    GuardVerifiedIdView      TINYINT(1)   NOT NULL DEFAULT 0,

    CreatedAt  DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    UpdatedAt  DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    CONSTRAINT FK_UserPermissions_Users   FOREIGN KEY (AccessId) REFERENCES Users (AccessId) ON DELETE CASCADE,
    CONSTRAINT UQ_UserPermissions_AccessId UNIQUE (AccessId)
);

-- =============================================================================
-- 15. DEFAULT APP SETTINGS-ok
-- =============================================================================
INSERT INTO AppSettings (`Key`, `Value`)
VALUES ('OVERDUE_HOURS', '8')
ON DUPLICATE KEY UPDATE `Value` = `Value`;

-- =============================================================================
-- END OF SCHEMA
-- =============================================================================
