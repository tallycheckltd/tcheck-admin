<#
.SYNOPSIS
  Installs (or upgrades, or removes) the Tcheck BioStar connector on Windows as a background service.

.DESCRIPTION
  Run it on the BioStar 2 server itself, in PowerShell opened "as Administrator":

    powershell -ExecutionPolicy Bypass -File .\Install-TcheckConnector.ps1

  It will:
    1. install Node.js 22 LTS if needed (official installer, SHA-256 checked against nodejs.org);
    2. download the connector from Tcheck and check its SHA-256;
    3. ask for the connector key (from Tcheck: Visitors > Flap barriers, step 1), a BioStar operator
       login and its password. Typed secrets are never shown and never written to the console history;
    4. read BioStar's own certificate and PIN it, so the connector talks only to this BioStar;
    5. test every link (--check) before installing anything that runs;
    6. register the connector as a Windows task that starts with Windows, runs as the low-privilege
       LOCAL SERVICE account and restarts by itself if it ever stops.

  Security, in short:
    - Outbound only: the connector calls Tcheck (HTTPS 443) and BioStar. Nothing listens; no firewall
      port is opened.
    - Tcheck's certificate is always checked normally. BioStar's self-signed certificate is trusted by
      its exact SHA-256 fingerprint only, checked before any password or session is sent.
    - Settings, including the key and the BioStar password, live in
      C:\ProgramData\Tcheck\BioStar Connector\connector.conf, readable only by SYSTEM, Administrators
      and LOCAL SERVICE. Logs never contain secrets.
    - The connector key can be revoked at any time in Tcheck (step 1: Create a new key).

  Other uses:
    .\Install-TcheckConnector.ps1                 # first install, or upgrade (keeps the settings)
    .\Install-TcheckConnector.ps1 -Reconfigure    # enter the key, login or password again
    .\Install-TcheckConnector.ps1 -Uninstall      # remove the service, files and settings
    .\Install-TcheckConnector.ps1 -FromFolder D:\tcheck   # no internet on this server: use files copied here

.NOTES
  Tcheck BioStar connector installer 1.0.0 (2026-11-22). PowerShell 5.1+, Windows Server 2016+ or Windows 10+.
#>
[CmdletBinding()]
param(
  [string]$TcheckUrl = 'https://tcheck-backend-production-3127.up.railway.app/api',
  [string]$DownloadBase = 'https://tcheck-dashboard.vercel.app/downloads',
  [string]$BioStarUrl = '',
  [string]$BioStarLogin = '',
  # Automation only (they end up in command history): prefer the prompts.
  [string]$ConnectorKey = '',
  [string]$BioStarPassword = '',
  # Pin a fingerprint you already know instead of accepting the one BioStar presents now.
  [string]$CertSha256 = '',
  # Accept BioStar's certificate and keep current settings without asking.
  [switch]$Yes,
  [switch]$Reconfigure,
  [switch]$Uninstall,
  # Install even if the check fails (not recommended).
  [switch]$Force,
  # Offline install: a folder holding tcheck-biostar-connector.mjs and tcheck-biostar-connector.mjs.sha256
  # (both downloaded from the Tcheck setup page on another computer).
  [string]$FromFolder = ''
)

Set-StrictMode -Version 2
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$NodeVersion   = '22.21.1'
$InstallDir    = Join-Path $env:ProgramFiles 'Tcheck\BioStar Connector'
$DataDir       = Join-Path $env:ProgramData 'Tcheck\BioStar Connector'
$LogDir        = Join-Path $DataDir 'logs'
$LogFile       = Join-Path $LogDir 'connector.log'
$ConfFile      = Join-Path $DataDir 'connector.conf'
$ConnectorFile = Join-Path $InstallDir 'tcheck-biostar-connector.mjs'
$TaskPath      = '\Tcheck\'
$TaskName      = 'BioStar Connector'
# Well-known SIDs (language-independent): SYSTEM, Administrators, LOCAL SERVICE.
$SidSystem = '*S-1-5-18'; $SidAdmins = '*S-1-5-32-544'; $SidLocalService = '*S-1-5-19'

function Say([string]$text, [string]$color = 'Gray') { Write-Host $text -ForegroundColor $color }
function Step([string]$text) { Write-Host ''; Write-Host "== $text" -ForegroundColor Cyan }
function Fail([string]$text) { Write-Host ''; Write-Host "STOPPED: $text" -ForegroundColor Red; exit 1 }

function Assert-Admin {
  $p = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
  if (-not $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Fail 'Open PowerShell with "Run as administrator", then run this script again.'
  }
}

function Get-Sha256([string]$path) { (Get-FileHash -Path $path -Algorithm SHA256).Hash.ToLowerInvariant() }

function Get-Download([string]$url, [string]$out) {
  try { Invoke-WebRequest -Uri $url -OutFile $out -UseBasicParsing } catch { Fail "Could not download $url ($($_.Exception.Message)). Check this computer can reach the internet over HTTPS." }
}

function Read-Secret([string]$prompt) {
  $s = Read-Host -Prompt $prompt -AsSecureString
  $b = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($s)
  try { [Runtime.InteropServices.Marshal]::PtrToStringBSTR($b) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b) }
}

function Get-NodePath {
  $candidates = @((Join-Path $env:ProgramFiles 'nodejs\node.exe'))
  $cmd = Get-Command node.exe -ErrorAction SilentlyContinue
  if ($cmd) { $candidates += $cmd.Source }
  foreach ($c in $candidates) {
    if ($c -and (Test-Path $c)) {
      $v = (& $c -v) -replace '^v', ''
      if ([int]($v.Split('.')[0]) -ge 22) { return $c }
    }
  }
  return $null
}

function Install-Node {
  $tmp = Join-Path $env:TEMP "tcheck-node-$NodeVersion"
  New-Item -ItemType Directory -Force -Path $tmp | Out-Null
  $msi = "node-v$NodeVersion-x64.msi"
  Say "Downloading Node.js $NodeVersion (official installer from nodejs.org)..."
  Get-Download "https://nodejs.org/dist/v$NodeVersion/$msi" (Join-Path $tmp $msi)
  Get-Download "https://nodejs.org/dist/v$NodeVersion/SHASUMS256.txt" (Join-Path $tmp 'SHASUMS256.txt')
  $line = Select-String -Path (Join-Path $tmp 'SHASUMS256.txt') -Pattern ([regex]::Escape($msi)) | Select-Object -First 1
  if (-not $line) { Fail "nodejs.org did not list a checksum for $msi." }
  $expected = ($line.Line -split '\s+')[0].ToLowerInvariant()
  if ((Get-Sha256 (Join-Path $tmp $msi)) -ne $expected) { Fail 'The Node.js installer does not match the checksum published by nodejs.org. Nothing was installed.' }
  Say 'Checksum matches nodejs.org. Installing Node.js silently...'
  $p = Start-Process msiexec.exe -ArgumentList "/i `"$(Join-Path $tmp $msi)`" /qn /norestart" -Wait -PassThru
  if ($p.ExitCode -ne 0 -and $p.ExitCode -ne 3010) { Fail "Node.js installer exited with code $($p.ExitCode)." }
  Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
}

function Set-PrivateFolder([string]$path, [bool]$serviceCanWrite) {
  New-Item -ItemType Directory -Force -Path $path | Out-Null
  $grant = if ($serviceCanWrite) { "${SidLocalService}:(OI)(CI)M" } else { "${SidLocalService}:(OI)(CI)RX" }
  & icacls.exe $path /inheritance:r /grant:r "${SidSystem}:(OI)(CI)F" "${SidAdmins}:(OI)(CI)F" $grant | Out-Null
  if ($LASTEXITCODE -ne 0) { Fail "Could not set permissions on $path." }
}

function Read-Conf {
  $h = @{}
  if (Test-Path $ConfFile) {
    foreach ($l in Get-Content -Path $ConfFile) { if ($l -match '^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*)$') { $h[$Matches[1]] = $Matches[2] } }
  }
  return $h
}

function Write-Conf([hashtable]$c) {
  $lines = @(
    '# Tcheck BioStar connector settings. Readable only by SYSTEM, Administrators and LOCAL SERVICE.',
    "# Written by Install-TcheckConnector.ps1 on $(Get-Date -Format 'yyyy-MM-dd HH:mm'). Re-run it with -Reconfigure to change.",
    "TCHECK_URL=$($c.TCHECK_URL)",
    "TCHECK_TOKEN=$($c.TCHECK_TOKEN)",
    "BIOSTAR_URL=$($c.BIOSTAR_URL)",
    "BIOSTAR_LOGIN_ID=$($c.BIOSTAR_LOGIN_ID)",
    "BIOSTAR_PASSWORD=$($c.BIOSTAR_PASSWORD)",
    "BIOSTAR_CERT_SHA256=$($c.BIOSTAR_CERT_SHA256)",
    "LOG_FILE=$LogFile"
  )
  [IO.File]::WriteAllText($ConfFile, (($lines -join "`r`n") + "`r`n"), (New-Object Text.UTF8Encoding($false)))
}

function Invoke-Connector([string]$node, [string[]]$arguments, [hashtable]$extraEnv = @{}) {
  # Windows PowerShell 5.1 turns a program's stderr into errors; with 'Stop' that would end the script.
  $ErrorActionPreference = 'Continue'
  $saved = @{}
  foreach ($k in $extraEnv.Keys) { $saved[$k] = [Environment]::GetEnvironmentVariable($k, 'Process'); [Environment]::SetEnvironmentVariable($k, $extraEnv[$k], 'Process') }
  try {
    $out = & $node $ConnectorFile @arguments 2>&1 | ForEach-Object { "$_" }
    return @{ Code = $LASTEXITCODE; Output = ($out -join "`n") }
  } finally {
    foreach ($k in $extraEnv.Keys) { [Environment]::SetEnvironmentVariable($k, $saved[$k], 'Process') }
  }
}

function Remove-Task {
  $t = Get-ScheduledTask -TaskPath $TaskPath -TaskName $TaskName -ErrorAction SilentlyContinue
  if ($t) {
    Stop-ScheduledTask -TaskPath $TaskPath -TaskName $TaskName -ErrorAction SilentlyContinue
    Unregister-ScheduledTask -TaskPath $TaskPath -TaskName $TaskName -Confirm:$false
  }
  # A running node.exe started by the task is ended by Stop-ScheduledTask; make sure.
  Get-CimInstance Win32_Process -Filter "name='node.exe'" | Where-Object { $_.CommandLine -like "*$ConnectorFile*" } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
}

# ------------------------------------------------------------------------------------------------
Say 'Tcheck BioStar connector installer 1.0.0' 'White'
Assert-Admin

if ($Uninstall) {
  Step 'Removing the Tcheck BioStar connector'
  Remove-Task
  if (Test-Path $InstallDir) { Remove-Item -Recurse -Force $InstallDir }
  if (Test-Path $DataDir) { Remove-Item -Recurse -Force $DataDir }   # holds the key and password
  Say 'Removed the service, the connector and its settings (including the stored key and password).' 'Green'
  Say 'Node.js was left installed. In Tcheck, create a new connector key so the old one stops working.'
  exit 0
}

Step '1/6  Node.js'
$node = Get-NodePath
if (-not $node) { Install-Node; $node = Get-NodePath; if (-not $node) { Fail 'Node.js 22 could not be found after installing it.' } }
Say "Using $node ($(& $node -v))." 'Green'

Step '2/6  Connector'
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
$tmpFile = Join-Path $env:TEMP 'tcheck-biostar-connector.mjs'
$tmpSum = Join-Path $env:TEMP 'tcheck-biostar-connector.mjs.sha256'
if ($FromFolder) {
  foreach ($f in 'tcheck-biostar-connector.mjs', 'tcheck-biostar-connector.mjs.sha256') { if (-not (Test-Path (Join-Path $FromFolder $f))) { Fail "$f is not in $FromFolder." } }
  Copy-Item (Join-Path $FromFolder 'tcheck-biostar-connector.mjs') $tmpFile -Force
  Copy-Item (Join-Path $FromFolder 'tcheck-biostar-connector.mjs.sha256') $tmpSum -Force
} else {
  Get-Download "$DownloadBase/tcheck-biostar-connector.mjs" $tmpFile
  Get-Download "$DownloadBase/tcheck-biostar-connector.mjs.sha256" $tmpSum
}
$expected = ((Get-Content $tmpSum -Raw).Trim() -split '\s+')[0].ToLowerInvariant()
if ((Get-Sha256 $tmpFile) -ne $expected) { Remove-Item $tmpFile, $tmpSum -Force; Fail 'The downloaded connector does not match its published SHA-256. Nothing was changed.' }
$wasRunning = $null -ne (Get-ScheduledTask -TaskPath $TaskPath -TaskName $TaskName -ErrorAction SilentlyContinue)
if ($wasRunning) { Stop-ScheduledTask -TaskPath $TaskPath -TaskName $TaskName -ErrorAction SilentlyContinue; Start-Sleep 2 }
Copy-Item $tmpFile $ConnectorFile -Force
Remove-Item $tmpFile, $tmpSum -Force
$version = ((Select-String -Path $ConnectorFile -Pattern "const VERSION = '([0-9.]+)'").Matches[0].Groups[1].Value)
Say "Connector $version installed in $InstallDir (SHA-256 checked)." 'Green'

Step '3/6  Settings'
Set-PrivateFolder $DataDir $false
Set-PrivateFolder $LogDir $true
$conf = Read-Conf
$keep = ($conf.Count -gt 0) -and -not $Reconfigure
if ($keep -and -not $Yes) {
  $a = Read-Host 'Settings from an earlier install were found. Keep them? [Y/n]'
  if ($a -match '^[nN]') { $keep = $false }
}
if (-not $keep) {
  $conf['TCHECK_URL'] = $TcheckUrl.TrimEnd('/')
  if ($BioStarUrl) { $conf['BIOSTAR_URL'] = $BioStarUrl.TrimEnd('/') }
  elseif (Test-NetConnection -ComputerName 127.0.0.1 -Port 443 -InformationLevel Quiet -WarningAction SilentlyContinue) {
    $conf['BIOSTAR_URL'] = 'https://127.0.0.1'; Say 'BioStar found on this computer (https://127.0.0.1).'
  } else { $conf['BIOSTAR_URL'] = (Read-Host 'BioStar server address (for example https://10.0.0.20)').TrimEnd('/') }
  $key = if ($ConnectorKey) { $ConnectorKey } else { Read-Secret 'Connector key from Tcheck (starts with tcbs_; paste, then Enter)' }
  if ($key -notmatch '^tcbs_[A-Za-z0-9_-]{20,}$') { Fail 'That does not look like a Tcheck connector key (it starts with tcbs_). Copy it again from Tcheck, step 1.' }
  $conf['TCHECK_TOKEN'] = $key
  $conf['BIOSTAR_LOGIN_ID'] = if ($BioStarLogin) { $BioStarLogin } else { Read-Host 'BioStar operator login (an account with user, card and access-group rights)' }
  $conf['BIOSTAR_PASSWORD'] = if ($BioStarPassword) { $BioStarPassword } else { Read-Secret 'BioStar operator password' }
  if ($ConnectorKey -or $BioStarPassword) { Say 'Note: secrets given as parameters can stay in PowerShell history. Prefer the prompts next time.' 'Yellow' }
}

Step '4/6  BioStar certificate'
if (-not $conf.ContainsKey('BIOSTAR_CERT_SHA256') -or -not $conf['BIOSTAR_CERT_SHA256'] -or -not $keep) {
  $r = Invoke-Connector $node @('--print-cert') @{ BIOSTAR_URL = $conf['BIOSTAR_URL'] }
  if ($r.Code -ne 0) { Fail "Could not reach BioStar at $($conf['BIOSTAR_URL']): $($r.Output)" }
  $jsonStart = $r.Output.IndexOf('{')
  $cert = $r.Output.Substring($jsonStart) | ConvertFrom-Json
  Say "BioStar presents: $($cert.subject) / $($cert.organisation)  (valid to $($cert.validTo))"
  Say "SHA-256: $($cert.fingerprint256)" 'White'
  if ($CertSha256) {
    if (($CertSha256 -replace '[^0-9a-fA-F]', '').ToLowerInvariant() -ne $cert.pin) { Fail 'BioStar presents a different certificate from the fingerprint you gave. Nothing was installed.' }
    Say 'Matches the fingerprint you gave.' 'Green'
  } elseif (-not $Yes) {
    if ($conf['BIOSTAR_URL'] -notmatch '127\.0\.0\.1|localhost') { Say 'Compare it with BioStar: Settings > Server > certificate, or run this installer on the BioStar server itself.' 'Yellow' }
    $a = Read-Host 'Trust this certificate for BioStar? [Y/n]'
    if ($a -match '^[nN]') { Fail 'Certificate not trusted. Nothing was installed.' }
  }
  $conf['BIOSTAR_CERT_SHA256'] = $cert.pin
}
Write-Conf $conf
& icacls.exe $ConfFile /inheritance:r /grant:r "${SidSystem}:F" "${SidAdmins}:F" "${SidLocalService}:R" | Out-Null
Say "Settings saved to $ConfFile (SYSTEM, Administrators and LOCAL SERVICE only)." 'Green'

Step '5/6  Checking every link'
$r = Invoke-Connector $node @('--config', $ConfFile, '--check')
Say $r.Output
if ($r.Code -ne 0 -and -not $Force) { Fail 'Fix what failed above, then run this script again (your settings are kept; use -Reconfigure to re-enter them).' }

Step '6/6  Background service'
Remove-Task
$action = New-ScheduledTaskAction -Execute $node -Argument "`"$ConnectorFile`" --config `"$ConfFile`"" -WorkingDirectory $InstallDir
$trigger = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId 'NT AUTHORITY\LOCAL SERVICE' -LogonType ServiceAccount -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -MultipleInstances IgnoreNew `
  -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1)
Register-ScheduledTask -TaskPath $TaskPath -TaskName $TaskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings `
  -Description 'Tcheck BioStar connector: keeps BioStar in step with Tcheck. Outbound HTTPS only. Installed by Install-TcheckConnector.ps1.' | Out-Null
Start-ScheduledTask -TaskPath $TaskPath -TaskName $TaskName
Start-Sleep 15
$state = (Get-ScheduledTask -TaskPath $TaskPath -TaskName $TaskName).State
$tail = if (Test-Path $LogFile) { (Get-Content $LogFile -Tail 5) -join "`n" } else { '(no log yet)' }
if ($state -ne 'Running') { Say $tail; Fail "The service is $state, not Running. See $LogFile." }

Write-Host ''
Say 'Done. The Tcheck BioStar connector is running.' 'Green'
Say "  Service : Task Scheduler > Tcheck > $TaskName (LOCAL SERVICE, starts with Windows, restarts if it stops)"
Say "  Version : $version"
Say "  Settings: $ConfFile"
Say "  Log     : $LogFile"
Say '  Latest log lines:'
Say $tail
Say ''
Say 'Back in Tcheck (Visitors > Flap barriers), step 2 shows the connector online within a minute.'
