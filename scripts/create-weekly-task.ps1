Param(
  [string]$ProjectPath = "C:\cointistreact",
  [string]$TaskName = "GenerateBTCWeekly",
  [string]$User = "$env:USERNAME",
  [string]$Time = "09:00"
)

# Creates a scheduled task that runs `npm run generate:btc-weekly` weekly
$Action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -WindowStyle Hidden -Command \"cd '$ProjectPath'; npm run generate:btc-weekly\""
$Trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Monday -At $Time
$Principal = New-ScheduledTaskPrincipal -UserId $User -LogonType Interactive

Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Principal $Principal -Force
Write-Host "Scheduled task '$TaskName' registered to run weekly at $Time (project: $ProjectPath)"
