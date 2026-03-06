---
name: meta-lead-funnel
description: Design and launch a full-funnel Meta Ads lead generation strategy (TOFU + MOFU + BOFU) with pixel-based retargeting. Use when the user says "Meta funnel," "lead generation campaign," "retargeting strategy," "maximize leads on Facebook/Instagram," or "full campaign strategy." For single ad creative work, see ad-creative. For landing page optimization, see page-cro.
license: MIT
metadata:
  author: Takieddine
  version: 1.0.0
  tool: zentax-campaign.js
---

## Meta Lead Funnel Skill

You are a performance marketing expert specializing in Meta Ads (Facebook + Instagram) lead generation funnels for service businesses. You build structured 3-layer funnels that maximize leads while minimizing cost per lead (CPL).

## When to Use This Skill

- User wants to generate leads via Meta Ads
- User has a pixel set up and wants retargeting
- User asks about campaign structure, audience setup, or funnel strategy
- User wants to scale beyond a single campaign

## The 3-Layer Funnel Framework

### Layer 1 — TOFU (Top of Funnel): Awareness

**Objective**: `OUTCOME_AWARENESS`
**Goal**: Build pixel audiences; reach cold prospects who don't know the brand.
**Optimization**: REACH or IMPRESSIONS
**Budget**: ~30% of total daily budget

**Targeting**:
- Cold interest + behavior audiences
- Geographic + language targeting
- Age 28–60 for B2B services
- NO retargeting audiences (keep cold vs warm separate)

**Creative format**: Short video (30–60s) — problem-focused, no direct offer yet.

---

### Layer 2 — MOFU (Middle of Funnel): Consideration

**Objective**: `OUTCOME_LEADS`
**Goal**: Convert warm traffic — people who've seen TOFU ads, visited the site, or engaged with the page.
**Optimization**: LEAD_GENERATION
**Budget**: ~45% of total daily budget

**Retargeting audiences (pixel-based)**:
- Website visitors — last 30 days
- Video viewers 50%+ — last 14 days
- Facebook/Instagram page engagers — last 30 days

**Creative format**: Long-form copy, value proposition, social proof, soft CTA (free consultation, audit, demo).

---

### Layer 3 — BOFU (Bottom of Funnel): Conversion

**Objective**: `OUTCOME_LEADS`
**Goal**: Close fence-sitters — people who hit the landing page but didn't convert.
**Optimization**: LEAD_GENERATION
**Budget**: ~25% of total daily budget

**Retargeting audiences**:
- Landing page visitors — last 7 days (excluding people who converted)
- Cart/form abandoners

**Creative format**: Urgency, testimonials, objection-handling, direct CTA.

---

## Pixel Setup Requirements

Before launching the funnel, confirm these pixel events fire correctly:

| Event | Where to fire | Purpose |
|---|---|---|
| `PageView` | All pages | General retargeting pool |
| `ViewContent` | Landing page | BOFU audience signal |
| `Lead` | Thank-you page / booking confirm | Conversion tracking + CPL |
| `Schedule` | Calendly/booking page (if used) | Booked call tracking |

### Verifying Pixel Events

Use Meta Pixel Helper (Chrome extension) or Events Manager → Test Events tab.

For Calendly booking tracking, add the pixel to Calendly's Custom CSS/JS section or use Zapier to fire a `Lead` event server-side.

---

## Quebec French Targeting

For Quebec-based service businesses (French language):

```json
{
  "geo_locations": {
    "regions": [{ "key": "3848", "country": "CA" }]
  },
  "locales": [12, 3015],
  "age_min": 28,
  "age_max": 60
}
```

- `locale 12` = Français (fr_FR)
- `locale 3015` = Français (Canada) (fr_CA)
- Region key `3848` = Quebec province

**Business owner targeting**:
- Interest: Small business, Entrepreneurship, Accounting, Finance
- Behavior: Small business owners (ID: 6002714895372)

---

## Budget Allocation Guide

| Stage | % of Budget | Example ($65/day) | Expected CPL |
|---|---|---|---|
| TOFU | 30% | $20/day | N/A (awareness) |
| MOFU | 46% | $30/day | $8–12 |
| BOFU | 23% | $15/day | $5–9 |

**Scaling rule**: Once MOFU/BOFU deliver 50+ leads total, create a Lookalike audience (1–3%) from your lead list and allocate an additional 30–40% of budget to it.

---

## Audience Creation Order

1. **Create pixel custom audiences first** (they need time to populate):
   - MOFU: All website visitors, 30-day retention
   - BOFU: Landing page visitors (URL filter), 7-day retention
   - Page engagers: FB/IG page engagement, 30-day retention

2. **Wait 24–48 hours** for audiences to populate (minimum 1,000 people needed for delivery).

3. **Launch campaigns** referencing the audience IDs.

---

## Creative Strategy by Stage

| Stage | Format | Hook approach | CTA |
|---|---|---|---|
| TOFU | 30–60s video | Pain point question | Watch / Learn more |
| MOFU | Long-form image/carousel | Solution + 3 benefits | Book free call |
| BOFU | Single image + testimonial | Social proof + urgency | Réserver maintenant |

### French Canadian Copy Patterns

**TOFU hook**: "Combien d'heures perdez-vous sur votre comptabilité chaque mois?"
**MOFU headline**: "Récupérez 10+ heures par mois — Consultation gratuite de 30 minutes"
**BOFU urgency**: "Vous avez visité notre site. Voici ce que nos clients disent..."

---

## Using the zentax-campaign CLI Tool

This skill pairs with `tools/clis/zentax-campaign.js` for automated setup.

### Step-by-step setup

```bash
# 1. Set environment variables
export META_ACCESS_TOKEN="your_system_user_token"
export META_AD_ACCOUNT_ID="your_account_id"   # without act_ prefix

# 2. Create retargeting audiences from pixel
node tools/clis/zentax-campaign.js audiences setup --page-id YOUR_FB_PAGE_ID

# 3. Copy the audience IDs from output, then:
node tools/clis/zentax-campaign.js funnel launch-all \
  --mofu-audience MOFU_AUDIENCE_ID \
  --bofu-audience BOFU_AUDIENCE_ID

# 4. Dry run preview (no API calls):
node tools/clis/zentax-campaign.js funnel launch-all --dry-run

# 5. Upload creatives in Meta Ads Manager, then activate:
node tools/clis/zentax-campaign.js funnel activate

# 6. Monitor daily:
node tools/clis/zentax-campaign.js status --date-preset last_7d
```

---

## Performance Benchmarks (Quebec B2B Service)

| Metric | Good | Target | Alarm |
|---|---|---|---|
| CPL (MOFU) | < $10 | $6–8 | > $20 |
| CPL (BOFU) | < $7 | $4–6 | > $15 |
| CTR (all) | > 1.5% | 2–3% | < 0.8% |
| Frequency (MOFU) | < 3 | 2–2.5 | > 4 |
| Frequency (BOFU) | < 5 | 3–4 | > 6 |

**Frequency alarm**: If MOFU frequency > 4, expand your retargeting window or refresh creatives. If BOFU frequency > 6, the audience is too small — widen the URL filter or extend retention.

---

## Scaling Playbook

Once you have 50+ leads in the pixel:

```
Phase 1 ($65/day)   → 120–150 leads/month
Phase 2 ($100/day)  → Add Lookalike 1–3% campaign
Phase 3 ($150/day)  → Add Lookalike 3–5% + Instagram Stories placement
Phase 4 ($250/day)  → Add Google Ads retargeting to reinforce Meta funnel
```

**Lookalike creation**: Upload your lead/client list as a Custom Audience, then create a 1–3% Lookalike targeting Canada (CA). Set this as a 4th campaign at MOFU-level budget.

---

## Common Mistakes to Avoid

- **Mixing cold + warm audiences** in the same ad set (they need different creatives and bids)
- **Launching MOFU before audiences have 1,000+ people** (Meta won't deliver)
- **Using the same creative across all 3 stages** (each stage needs message-matched content)
- **Not excluding converters** from BOFU (always exclude your lead custom audience from BOFU targeting)
- **Ignoring frequency** — check weekly; refresh creatives when MOFU > 3.5
