-- ============================================================================
-- SellMax Pro Migration - Enable Login with PIN
-- ============================================================================

-- 1. Add PINHash column to Users table if not exists
IF COL_LENGTH('dbo.Users', 'PINHash') IS NULL
BEGIN
    ALTER TABLE dbo.Users ADD PINHash NVARCHAR(255) NULL;
    PRINT 'Added column PINHash to dbo.Users table.';
END
ELSE
BEGIN
    PRINT 'Column PINHash already exists in dbo.Users table.';
END
GO

-- 2. Seed Default PINs for Active Administrative and Staff Users
-- Pre-calculated bcrypt hashes:
-- '1111' -> $2b$10$iGKpJm8XrRxpqqJVCwnskuoYkw0zY2AcBKgRQJGLiz8olGS0ctk/C
-- '2222' -> $2b$10$.EAhFT65ZmNt1En8WbDtI.msyG/9J0rJIjyhrfAfGuKgbTp9Mz60C
-- '3333' -> $2b$10$D8eT3V2uXooTNZsIP6DYOuEmXbnkL.QZHb8gnyzoNQCxiWu7fu/6q
-- '4444' -> $2b$10$OB9ryi7RkFexIv6AmMWjT.YM8bPztKidce31RTYR1oLRLRV.Pnh86

PRINT 'Seeding default PIN hashes...';

UPDATE dbo.Users 
SET PINHash = '$2b$10$iGKpJm8XrRxpqqJVCwnskuoYkw0zY2AcBKgRQJGLiz8olGS0ctk/C' 
WHERE Username = 'superadmin';

UPDATE dbo.Users 
SET PINHash = '$2b$10$.EAhFT65ZmNt1En8WbDtI.msyG/9J0rJIjyhrfAfGuKgbTp9Mz60C' 
WHERE Username = 'admin';

UPDATE dbo.Users 
SET PINHash = '$2b$10$D8eT3V2uXooTNZsIP6DYOuEmXbnkL.QZHb8gnyzoNQCxiWu7fu/6q' 
WHERE Username = 'manager';

UPDATE dbo.Users 
SET PINHash = '$2b$10$OB9ryi7RkFexIv6AmMWjT.YM8bPztKidce31RTYR1oLRLRV.Pnh86' 
WHERE Username = 'cashier';

PRINT 'PIN seeding completed successfully.';
GO
