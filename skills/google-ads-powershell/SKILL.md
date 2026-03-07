---
name: google-ads-powershell
description: "When the user wants to launch, create, or manage Google Ads campaigns directly from PowerShell or the command line. Use when the user says 'launch a Google ad from PowerShell,' 'create a Google Ads campaign via CLI,' 'high quality score ad,' 'Google Ads automation,' 'launch ad from terminal,' or 'Google Ads PowerShell script.' Optimizes for maximum Quality Score (10/10) by applying best-practice RSA structure, keyword insertion, and landing page alignment. For campaign strategy guidance, see paid-ads. For ad copy generation, see ad-creative."
metadata:
  version: 1.0.0
---

# Google Ads PowerShell Launch

You are a Google Ads automation expert. Your goal is to help the user launch high-quality Google Ads campaigns directly from PowerShell — with Quality Scores optimized from day one.

## Before Starting

**Check for product marketing context first:**
If `.agents/product-marketing-context.md` exists, read it before asking questions.

Gather this context (ask if not provided):

1. **Google Ads credentials** — OAuth token, developer token, customer ID
2. **Campaign goal** — conversions, traffic, leads
3. **Daily budget** — in dollars
4. **Target keywords** — 5–15 exact/phrase match keywords
5. **Final URL** — the landing page the ad points to
6. **Product/offer** — what you're promoting and key benefits
7. **Brand name** — for headlines and display path

---

## Quality Score: What Drives a 10/10

Google's Quality Score (1–10) determines your ad rank and CPC. Three components:

| Component | Weight | How to Win |
|-----------|--------|------------|
| **Expected CTR** | ~40% | Include keyword in headlines 1–2; use numbers, urgency, benefits |
| **Ad Relevance** | ~40% | Match headline themes to keyword intent; use keyword in display path |
| **Landing Page Experience** | ~20% | Keyword on page title/H1; fast load (<2s); mobile-friendly |

**Golden rules for 10/10 QS:**
- Pin your exact keyword (or close variant) as Headline 1
- Use the keyword in at least one display path field
- Write at least 8–10 unique headlines covering: feature, benefit, social proof, urgency, CTA
- Write 3–4 descriptions covering: value prop, differentiators, CTA
- Ensure the landing page repeats the keyword in `<title>`, `<h1>`, and body copy

---

## Setup: PowerShell Environment

```powershell
# Set credentials (run once per session or add to your $PROFILE)
$env:GOOGLE_ADS_TOKEN          = "ya29.your-oauth-token"
$env:GOOGLE_ADS_DEVELOPER_TOKEN = "your-developer-token"
$env:GOOGLE_ADS_CUSTOMER_ID    = "1234567890"  # no dashes

# Verify connection
node tools/clis/google-ads.js account info
```

---

## Full Launch Workflow

### Step 1 — Create a Campaign Budget

```powershell
$budget = node tools/clis/google-ads.js budgets create `
  --name "My Campaign Budget" `
  --amount 50 | ConvertFrom-Json

$budgetId = $budget.results[0].resourceName -replace ".*/"
Write-Host "Budget ID: $budgetId"
```

### Step 2 — Create a Search Campaign

```powershell
$campaign = node tools/clis/google-ads.js campaigns create `
  --name "Brand - Search - Exact" `
  --budget-id $budgetId `
  --status PAUSED | ConvertFrom-Json

$campaignId = $campaign.results[0].resourceName -replace ".*/"
Write-Host "Campaign ID: $campaignId"
```

### Step 3 — Create an Ad Group

```powershell
$adgroup = node tools/clis/google-ads.js adgroups create `
  --campaign-id $campaignId `
  --name "Core Keywords" `
  --cpc 2.00 | ConvertFrom-Json

$adGroupId = $adgroup.results[0].resourceName -replace ".*/"
Write-Host "Ad Group ID: $adGroupId"
```

### Step 4 — Add High-Intent Keywords

```powershell
# Add each keyword (exact match = highest QS potential)
$keywords = @(
  "[your main keyword]",
  "[keyword variant 1]",
  "[keyword variant 2]"
)

foreach ($kw in $keywords) {
  node tools/clis/google-ads.js keywords add `
    --adgroup-id $adGroupId `
    --keyword $kw `
    --match exact
}
```

### Step 5 — Create Responsive Search Ad (RSA)

```powershell
# Headlines: 8–15, pin Headline 1 to keyword, H2 to benefit
# Descriptions: 3–4, cover value prop + CTA
node tools/clis/google-ads.js ads create-rsa `
  --adgroup-id $adGroupId `
  --url "https://yoursite.com/landing-page" `
  --path1 "keyword" `
  --path2 "free-trial" `
  --headlines "Your Keyword Here|Get [Benefit] Fast|Trusted by 10,000+ Teams|Start Free Trial Today|No Setup Fees|[Feature] Built In|Award-Winning [Product]|Results in 24 Hours|See Why Teams Choose Us" `
  --descriptions "Get [core benefit] without [common pain point]. Trusted by [X] companies worldwide.|Start your free trial in 60 seconds. No credit card required. Cancel anytime.|[Key differentiator] that helps [target persona] achieve [outcome]. Try it free today."
```

### Step 6 — Enable the Campaign

```powershell
node tools/clis/google-ads.js campaigns enable --id $campaignId
Write-Host "Campaign is LIVE"
```

---

## One-Shot Launch Script

Save as `launch-google-ad.ps1` and run with your parameters:

```powershell
param(
  [string]$CampaignName   = "Search Campaign",
  [decimal]$DailyBudget   = 50,
  [string]$FinalUrl       = "https://example.com",
  [string]$Path1          = "get-started",
  [string]$Path2          = "free-trial",
  [string[]]$Keywords     = @("[your keyword]"),
  [string[]]$Headlines    = @(
    "Your Keyword Here",
    "Get Results in 24 Hours",
    "Trusted by 10,000+ Teams",
    "Start Free — No Credit Card",
    "Built for [Persona]",
    "Award-Winning Platform",
    "#1 Rated [Category] Tool",
    "See Live Demo Today",
    "Cancel Anytime"
  ),
  [string[]]$Descriptions = @(
    "Get [benefit] without [pain]. Trusted by thousands. Start your free trial today.",
    "No setup fees. No contracts. Just results. Join [X] teams already using [Product].",
    "[Key differentiator] designed for [persona]. Try free for 14 days."
  )
)

$ErrorActionPreference = "Stop"

Write-Host "`n==> Creating budget ($DailyBudget/day)..."
$budget     = node tools/clis/google-ads.js budgets create --name "$CampaignName Budget" --amount $DailyBudget | ConvertFrom-Json
$budgetId   = $budget.results[0].resourceName -replace ".*/"

Write-Host "==> Creating campaign..."
$camp       = node tools/clis/google-ads.js campaigns create --name $CampaignName --budget-id $budgetId --status PAUSED | ConvertFrom-Json
$campaignId = $camp.results[0].resourceName -replace ".*/"

Write-Host "==> Creating ad group..."
$ag         = node tools/clis/google-ads.js adgroups create --campaign-id $campaignId --name "Main" --cpc 2.00 | ConvertFrom-Json
$adGroupId  = $ag.results[0].resourceName -replace ".*/"

Write-Host "==> Adding $($Keywords.Count) keywords..."
foreach ($kw in $Keywords) {
  node tools/clis/google-ads.js keywords add --adgroup-id $adGroupId --keyword $kw --match exact | Out-Null
}

Write-Host "==> Creating Responsive Search Ad..."
$headlineStr     = $Headlines -join "|"
$descriptionStr  = $Descriptions -join "|"
node tools/clis/google-ads.js ads create-rsa `
  --adgroup-id $adGroupId `
  --url $FinalUrl `
  --path1 $Path1 `
  --path2 $Path2 `
  --headlines $headlineStr `
  --descriptions $descriptionStr | Out-Null

Write-Host "==> Enabling campaign..."
node tools/clis/google-ads.js campaigns enable --id $campaignId | Out-Null

Write-Host "`n[OK] Campaign '$CampaignName' is LIVE (ID: $campaignId)"
Write-Host "     Review at: https://ads.google.com"
```

**Run it:**
```powershell
.\launch-google-ad.ps1 `
  -CampaignName "SaaS Tool - Search - Exact" `
  -DailyBudget 75 `
  -FinalUrl "https://yoursite.com/free-trial" `
  -Path1 "saas-tool" `
  -Path2 "free-trial" `
  -Keywords @("[saas project management]", "[project management software]") `
  -Headlines @("Best SaaS Project Tool","Manage Projects in One Place","Free Trial - No Card Needed","Used by 50,000+ Teams","Ship Projects 2x Faster","Integrate with Slack & Jira","All-In-One PM Platform","Get Started in 60 Seconds","Cancel Anytime")
```

---

## Dry-Run Mode (Preview Without Sending)

Test your commands without making live API calls:

```powershell
node tools/clis/google-ads.js budgets create --name "Test" --amount 50 --dry-run
node tools/clis/google-ads.js campaigns create --name "Test" --budget-id 123 --dry-run
node tools/clis/google-ads.js ads create-rsa --adgroup-id 456 --url "https://..." --headlines "H1|H2" --descriptions "D1" --dry-run
```

---

## Quality Score Optimization Checklist

After launching, verify these to push toward 10/10:

### Ad Structure
- [ ] Headline 1 contains your exact keyword (or pinned variant)
- [ ] At least 8 unique headlines (15 = maximum coverage)
- [ ] Headlines cover: features, benefits, social proof, urgency, CTA
- [ ] Display path 1 or 2 includes the keyword
- [ ] 3–4 unique descriptions with different messages
- [ ] No duplicate or redundant headlines

### Keywords
- [ ] Keywords grouped tightly (single theme per ad group)
- [ ] Exact match keywords for highest relevance
- [ ] Negative keywords added (brand exclusions, irrelevant terms)
- [ ] Keyword appears in the ad

### Landing Page
- [ ] Keyword in `<title>` tag
- [ ] Keyword in `<h1>` heading
- [ ] Page loads in < 2 seconds (test: PageSpeed Insights)
- [ ] Mobile-friendly layout
- [ ] Clear CTA matches ad promise
- [ ] No pop-ups that block content immediately

---

## Common Issues

| Problem | Cause | Fix |
|---------|-------|-----|
| Low ad relevance | Keyword not in headlines | Add keyword to Headline 1 (pin it) |
| Poor landing page score | Mismatch between ad + page | Add keyword to page title and H1 |
| Low expected CTR | Weak value proposition | Test benefit-led and urgency headlines |
| Ad not serving | Campaign paused or budget too low | Run `campaigns enable --id <id>`; raise budget |
| 401 auth error | Expired OAuth token | Refresh token via Google OAuth flow |

---

## Tool Integration

Uses `tools/clis/google-ads.js`. See [google-ads.md](../../tools/integrations/google-ads.md) for full API reference.

**Environment variables required:**
| Variable | Description |
|----------|-------------|
| `GOOGLE_ADS_TOKEN` | OAuth 2.0 Bearer token |
| `GOOGLE_ADS_DEVELOPER_TOKEN` | From Google Ads API Center |
| `GOOGLE_ADS_CUSTOMER_ID` | 10-digit account ID (no dashes) |

---

## Related Skills

- **paid-ads**: Campaign strategy, targeting, and bidding guidance
- **ad-creative**: Generate and iterate RSA headlines and descriptions at scale
- **analytics-tracking**: Set up conversion tracking before launch
- **page-cro**: Optimize the landing page to improve Quality Score
