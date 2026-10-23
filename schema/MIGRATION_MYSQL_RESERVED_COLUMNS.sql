

USE GuardSystemDB;

-- IncomingPackages
ALTER TABLE IncomingPackages
  CHANGE COLUMN Mode `Mode` VARCHAR(20) NOT NULL DEFAULT 'single',
  CHANGE COLUMN Time `Time` VARCHAR(50) NOT NULL,
  CHANGE COLUMN Date `Date` VARCHAR(50) NOT NULL;

-- OutgoingPackages
ALTER TABLE OutgoingPackages
  CHANGE COLUMN Mode `Mode` VARCHAR(20) NOT NULL DEFAULT 'single',
  CHANGE COLUMN Time `Time` VARCHAR(50) NOT NULL,
  CHANGE COLUMN Date `Date` VARCHAR(50) NOT NULL;

-- GateRecords
ALTER TABLE GateRecords
  CHANGE COLUMN Date `Date` VARCHAR(50) NULL;
