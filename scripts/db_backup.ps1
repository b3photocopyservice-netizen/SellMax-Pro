# ============================================================================
# SellMax Pro - SQL Server Database Backup Script
# ============================================================================
# Description: Performs a FULL database backup of the SQL Server database.
# Usage: Can be configured as a Windows Task Scheduler action.
# ============================================================================

# Configuration Variables
$DatabaseName = "SellMaxPro"
$BackupDir = "E:\Backup\SellMaxPro"    # Target folder on the Local Storage
$ServerName = "localhost"              # Target SQL Server instance
$UserName = "sa"                       # SQL authentication user
$Password = "your_strong_password"     # SQL authentication password
$RetentionDays = 14                    # Rotate backups older than 14 days

# 1. Ensure the backup directory exists
if (!(Test-Path -Path $BackupDir)) {
    try {
        New-Item -ItemType Directory -Force -Path $BackupDir -ErrorAction Stop | Out-Null
        Write-Host "Created backup directory: $BackupDir"
    } catch {
        Write-Error "Failed to create directory $BackupDir. Details: $_"
        Exit 1
    }
}

# 2. Set up filename with timestamp
$Timestamp = Get-Date -Format "yyyy_MM_dd_HHmmss"
$BackupFileName = "${DatabaseName}_Full_${Timestamp}.bak"
$BackupFilePath = Join-Path -Path $BackupDir -ChildPath $BackupFileName

# 3. Create SQL Command for Full Backup
$SQLQuery = "BACKUP DATABASE [$DatabaseName] TO DISK = N'$BackupFilePath' WITH NOFORMAT, NOINIT, NAME = N'$DatabaseName-Full Database Backup', SKIP, NOREWIND, NOUNLOAD, STATS = 10"

Write-Host "Initiating SQL Server database backup..."
Write-Host "Database: $DatabaseName"
Write-Host "Destination: $BackupFilePath"

# 4. Execute sqlcmd
# Note: To use Windows Authentication on VPS (IIS ApplicationPool Identity / SYSTEM),
# replace -U $UserName -P $Password arguments with -E
$sqlcmdArgs = @("-S", $ServerName, "-U", $UserName, "-P", $Password, "-Q", $SQLQuery)

try {
    $process = Start-Process -FilePath "sqlcmd" -ArgumentList $sqlcmdArgs -Wait -NoNewWindow -PassThru -ErrorAction Stop
    
    if ($process.ExitCode -eq 0) {
        Write-Host "SUCCESS: Database backup completed successfully."
        
        # 5. Rotate old backups (Maintenance policy)
        Write-Host "Running backup rotation policy..."
        $LimitDate = (Get-Date).AddDays(-$RetentionDays)
        $OldBackups = Get-ChildItem -Path $BackupDir -Filter "*.bak" | Where-Object { $_.LastWriteTime -lt $LimitDate }
        
        if ($OldBackups) {
            foreach ($file in $OldBackups) {
                Remove-Item -Path $file.FullName -Force -Confirm:$false
                Write-Host "Removed expired backup file: $($file.Name)"
            }
            Write-Host "Backup rotation completed successfully."
        } else {
            Write-Host "No expired backup files found to clean."
        }
    } else {
        Write-Error "ERROR: sqlcmd returned exit code $($process.ExitCode). Backup failed."
        Exit 1
    }
} catch {
    Write-Error "ERROR: Failed to run sqlcmd. Ensure Microsoft Command Line Utilities for SQL Server are installed. Details: $_"
    Exit 1
}
