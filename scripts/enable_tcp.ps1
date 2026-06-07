# Enable TCP/IP for SQLEXPRESS
Set-ItemProperty -Path 'HKLM:\SOFTWARE\Microsoft\Microsoft SQL Server\MSSQL17.SQLEXPRESS\MSSQLServer\SuperSocketNetLib\Tcp' -Name Enabled -Value 1

# Set standard port 1433
Set-ItemProperty -Path 'HKLM:\SOFTWARE\Microsoft\Microsoft SQL Server\MSSQL17.SQLEXPRESS\MSSQLServer\SuperSocketNetLib\Tcp\IPAll' -Name TcpPort -Value '1433'
Set-ItemProperty -Path 'HKLM:\SOFTWARE\Microsoft\Microsoft SQL Server\MSSQL17.SQLEXPRESS\MSSQLServer\SuperSocketNetLib\Tcp\IPAll' -Name TcpDynamicPorts -Value ''

# Restart the SQL Server service to apply changes
Restart-Service -Name "MSSQL`$SQLEXPRESS" -Force

Write-Output "TCP/IP enabled and SQL Server restarted on port 1433 successfully."
Start-Sleep -Seconds 3
