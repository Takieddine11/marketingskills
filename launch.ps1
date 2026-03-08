# ═══════════════════════════════════════════════════════════
#  ZENTAX CAMPAIGN LAUNCHER
#  Edit the CONFIG block below, then just run:  .\launch.ps1
# ═══════════════════════════════════════════════════════════

# ── CONFIG (edit these paths once) ──────────────────────────
$TOKEN_FILE    = "$env:USERPROFILE\meta_token.txt"          # File containing your Meta access token
$SCRIPT        = "$env:USERPROFILE\Downloads\zentax-campaign-launch.js"  # Path to the JS script
$CREATIVES_DIR = "$env:USERPROFILE\Downloads\Creatives"     # Folder with Creative Final\ Retargeting\ Videos\
$STATUS        = "PAUSED"                                    # PAUSED or ACTIVE
$DRY_RUN       = $false                                      # Set to $true to preview without spending
# ────────────────────────────────────────────────────────────

# Load token
if (-not (Test-Path $TOKEN_FILE)) {
    Write-Host "ERROR: Token file not found at $TOKEN_FILE" -ForegroundColor Red
    Write-Host "Save your Meta access token as plain text in that file." -ForegroundColor Yellow
    exit 1
}
$env:META_ACCESS_TOKEN  = (Get-Content $TOKEN_FILE).Trim()
$env:META_AD_ACCOUNT_ID = "2189765574795573"

# Validate paths
if (-not (Test-Path $SCRIPT)) {
    Write-Host "ERROR: Script not found at $SCRIPT" -ForegroundColor Red
    exit 1
}
if (-not (Test-Path $CREATIVES_DIR)) {
    Write-Host "ERROR: Creatives folder not found at $CREATIVES_DIR" -ForegroundColor Red
    exit 1
}

# Build args
$nodeArgs = @(
    "`"$SCRIPT`""
    "--fr-dir", "`"$CREATIVES_DIR`""
    "--status", $STATUS
)
if ($DRY_RUN) { $nodeArgs += "--dry-run" }

# Run
Write-Host ""
Write-Host "  Script   : $SCRIPT"      -ForegroundColor Cyan
Write-Host "  Creatives: $CREATIVES_DIR" -ForegroundColor Cyan
Write-Host "  Status   : $STATUS"      -ForegroundColor Cyan
Write-Host "  Dry run  : $DRY_RUN"     -ForegroundColor Cyan
Write-Host ""

node @nodeArgs
