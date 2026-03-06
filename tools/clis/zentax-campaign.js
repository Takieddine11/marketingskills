#!/usr/bin/env node
/**
 * zentax-campaign.js — Full funnel Meta Ads launcher for Zentax Cabinet Comptable
 *
 * Pixel:      1173962951224451 (Zentax Cabinet Comptable)
 * Account:    Set META_AD_ACCOUNT_ID env var (e.g. act_XXXXXXXXXX)
 * Target:     Quebec business owners, French language
 *
 * Commands:
 *   audiences setup       — Create MOFU + BOFU custom retargeting audiences from pixel
 *   audiences list        — List existing custom audiences
 *   funnel launch-all     — Create all 3 campaigns (TOFU + MOFU + BOFU) in PAUSED state
 *   funnel launch-tofu    — Create TOFU awareness campaign only
 *   funnel launch-mofu    — Create MOFU retargeting lead campaign only
 *   funnel launch-bofu    — Create BOFU hot retargeting campaign only
 *   funnel activate       — Set all Zentax campaigns to ACTIVE
 *   funnel pause          — Pause all Zentax campaigns
 *   status                — Show all Zentax campaigns + performance
 *   pixel events          — Show recent pixel events (last 7d)
 *
 * Usage:
 *   META_ACCESS_TOKEN=xxx META_AD_ACCOUNT_ID=xxxxxxx node zentax-campaign.js <cmd> [--dry-run]
 */

const TOKEN = process.env.META_ACCESS_TOKEN
const DEFAULT_ACCOUNT_ID = process.env.META_AD_ACCOUNT_ID
const BASE_URL = 'https://graph.facebook.com/v20.0'

// ─── Zentax Constants ──────────────────────────────────────────────────────────
const ZENTAX = {
  pixel_id: '1173962951224451',
  brand: 'Zentax',
  landing_page: 'zentax.pro/funnel-2',
  // Quebec region key in Meta Ads targeting (Canada → Quebec province)
  // Verified via: GET /search?type=adgeolocation&q=Quebec&location_types=["region"]
  quebec_region_key: '3848',
  // French Canadian locale ID in Meta Ads
  // 12 = Français (fr_FR), use both for maximum QC French reach
  locales: [12, 3015], // Français + Français (Canada)
  daily_budgets: {
    tofu: 2000,   // $20.00 CAD in cents
    mofu: 3000,   // $30.00 CAD in cents
    bofu: 1500,   // $15.00 CAD in cents
  },
  // Business owner interest IDs (Meta)
  interests: [
    { id: '6003139266461', name: 'Marketing' },
    { id: '6003424026508', name: 'Small business' },
    { id: '6003348604981', name: 'Entrepreneurship' },
    { id: '6003014985781', name: 'Business' },
    { id: '6004090272379', name: 'Accounting' },
    { id: '6003022678279', name: 'Finance' },
  ],
  // Small business owner behavior (Meta behavior ID)
  behaviors: [
    { id: '6002714895372', name: 'Small business owners' },
  ],
}

// Quebec geo targeting spec
const QC_TARGETING = {
  geo_locations: {
    regions: [{ key: ZENTAX.quebec_region_key, country: 'CA' }],
  },
  locales: ZENTAX.locales,
  age_min: 28,
  age_max: 60,
}

// ─── API helpers ───────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const result = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg.startsWith('--')) {
      const key = arg.slice(2)
      const next = argv[i + 1]
      if (next && !next.startsWith('--')) { result[key] = next; i++ }
      else result[key] = true
    } else {
      result._.push(arg)
    }
  }
  return result
}

const args = parseArgs(process.argv.slice(2))
const [cmd, sub] = args._

function accountId() {
  const id = args['account-id'] || DEFAULT_ACCOUNT_ID
  if (!id) { console.error(JSON.stringify({ error: '--account-id or META_AD_ACCOUNT_ID required' })); process.exit(1) }
  return id
}

async function api(method, path, body) {
  if (!TOKEN) { console.error(JSON.stringify({ error: 'META_ACCESS_TOKEN env var required' })); process.exit(1) }
  const url = `${BASE_URL}${path}`
  const opts = { method, headers: { Authorization: `Bearer ${TOKEN}` } }
  if (body) {
    opts.headers['Content-Type'] = 'application/json'
    opts.body = JSON.stringify(body)
  }
  if (args['dry-run']) {
    return { _dry_run: true, method, url, body: body || undefined, note: 'No request sent. Remove --dry-run to execute.' }
  }
  const res = await fetch(url, opts)
  const text = await res.text()
  try { return JSON.parse(text) } catch { return { status: res.status, body: text } }
}

// ─── Audience helpers ─────────────────────────────────────────────────────────

/**
 * Create a pixel-based website custom audience.
 * rule: pixel event filter (e.g. all visitors, or specific URL visitors)
 */
async function createPixelAudience({ acctId, name, description, retentionDays, urlFilter }) {
  let rule
  if (urlFilter) {
    // Visitors of a specific URL pattern
    rule = JSON.stringify({
      inclusions: {
        operator: 'or',
        rules: [{
          event_sources: [{ id: ZENTAX.pixel_id, type: 'pixel' }],
          retention_seconds: retentionDays * 86400,
          filter: {
            operator: 'and',
            filters: [{
              field: 'url',
              operator: 'i_contains',
              value: urlFilter,
            }],
          },
        }],
      },
    })
  } else {
    // All website visitors
    rule = JSON.stringify({
      inclusions: {
        operator: 'or',
        rules: [{
          event_sources: [{ id: ZENTAX.pixel_id, type: 'pixel' }],
          retention_seconds: retentionDays * 86400,
          filter: { operator: 'and', filters: [] },
        }],
      },
    })
  }

  return api('POST', `/act_${acctId}/customaudiences`, {
    name,
    description,
    subtype: 'WEBSITE',
    pixel_id: ZENTAX.pixel_id,
    rule,
  })
}

// ─── Campaign builders ────────────────────────────────────────────────────────

async function buildTOFU(acctId) {
  const campaign = await api('POST', `/act_${acctId}/campaigns`, {
    name: `[ZENTAX] TOFU — Notoriété QC FR`,
    objective: 'OUTCOME_AWARENESS',
    status: 'PAUSED',
    special_ad_categories: [],
  })
  if (campaign.error || args['dry-run']) return { stage: 'TOFU', campaign }

  const adset = await api('POST', `/act_${acctId}/adsets`, {
    name: `[ZENTAX] TOFU — Entrepreneurs QC Froid`,
    campaign_id: campaign.id,
    optimization_goal: 'REACH',
    billing_event: 'IMPRESSIONS',
    daily_budget: ZENTAX.daily_budgets.tofu,
    status: 'PAUSED',
    targeting: {
      ...QC_TARGETING,
      interests: ZENTAX.interests,
      behaviors: ZENTAX.behaviors,
    },
    promoted_object: { pixel_id: ZENTAX.pixel_id },
  })

  return { stage: 'TOFU', campaign, adset }
}

async function buildMOFU(acctId, mofuAudienceId) {
  const campaign = await api('POST', `/act_${acctId}/campaigns`, {
    name: `[ZENTAX] MOFU — Retargeting Chaud`,
    objective: 'OUTCOME_LEADS',
    status: 'PAUSED',
    special_ad_categories: [],
  })
  if (campaign.error || args['dry-run']) return { stage: 'MOFU', campaign }

  const targeting = { ...QC_TARGETING }
  if (mofuAudienceId) {
    targeting.custom_audiences = [{ id: mofuAudienceId }]
    // Remove broad interest targeting — we only want retargeted audience
    delete targeting.interests
    delete targeting.behaviors
  } else {
    // Fallback if no custom audience yet: use interest targeting + pixel
    targeting.interests = ZENTAX.interests
    targeting.behaviors = ZENTAX.behaviors
  }

  const adset = await api('POST', `/act_${acctId}/adsets`, {
    name: `[ZENTAX] MOFU — Visiteurs 30j + Engagés`,
    campaign_id: campaign.id,
    optimization_goal: 'LEAD_GENERATION',
    billing_event: 'IMPRESSIONS',
    daily_budget: ZENTAX.daily_budgets.mofu,
    status: 'PAUSED',
    targeting,
    promoted_object: {
      pixel_id: ZENTAX.pixel_id,
      custom_event_type: 'LEAD',
    },
  })

  return { stage: 'MOFU', campaign, adset }
}

async function buildBOFU(acctId, bofuAudienceId) {
  const campaign = await api('POST', `/act_${acctId}/campaigns`, {
    name: `[ZENTAX] BOFU — Retargeting Brûlant`,
    objective: 'OUTCOME_LEADS',
    status: 'PAUSED',
    special_ad_categories: [],
  })
  if (campaign.error || args['dry-run']) return { stage: 'BOFU', campaign }

  const targeting = { ...QC_TARGETING }
  if (bofuAudienceId) {
    targeting.custom_audiences = [{ id: bofuAudienceId }]
    delete targeting.interests
    delete targeting.behaviors
  } else {
    targeting.interests = ZENTAX.interests
  }

  const adset = await api('POST', `/act_${acctId}/adsets`, {
    name: `[ZENTAX] BOFU — Landing Page 7j sans conversion`,
    campaign_id: campaign.id,
    optimization_goal: 'LEAD_GENERATION',
    billing_event: 'IMPRESSIONS',
    daily_budget: ZENTAX.daily_budgets.bofu,
    status: 'PAUSED',
    targeting,
    promoted_object: {
      pixel_id: ZENTAX.pixel_id,
      custom_event_type: 'LEAD',
    },
  })

  return { stage: 'BOFU', campaign, adset }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  let result

  switch (cmd) {

    // ── audiences ──────────────────────────────────────────────────────────────
    case 'audiences': {
      const acctId = accountId()
      switch (sub) {

        case 'list':
          result = await api('GET', `/act_${acctId}/customaudiences?fields=id,name,approximate_count,description,subtype`)
          break

        case 'setup': {
          // 1) MOFU: all website visitors, last 30 days
          const mofu = await createPixelAudience({
            acctId,
            name: '[ZENTAX] MOFU — Visiteurs site 30j',
            description: 'All website visitors from Zentax pixel, last 30 days',
            retentionDays: 30,
          })

          // 2) BOFU: visitors of landing page specifically, last 7 days (didn't convert)
          const bofu = await createPixelAudience({
            acctId,
            name: '[ZENTAX] BOFU — Visiteurs funnel-2 7j',
            description: 'Visitors of zentax.pro/funnel-2, last 7 days — did not convert',
            retentionDays: 7,
            urlFilter: 'funnel-2',
          })

          // 3) Engagers: page + video engagers (Instagram/FB) — requires Page engagement audience
          const engagers = await api('POST', `/act_${acctId}/customaudiences`, {
            name: '[ZENTAX] MOFU — Engagés page FB/IG 30j',
            description: 'People who engaged with Zentax Facebook or Instagram page in last 30 days',
            subtype: 'ENGAGEMENT',
            engagement_specs: [{
              action_type: 'page',
              post: { page: { id: args['page-id'] || 'YOUR_FB_PAGE_ID' } },
            }],
            retention_seconds: 30 * 86400,
          })

          result = {
            note: args['dry-run'] ? 'DRY RUN — no audiences created' : 'Audiences created. Use IDs below in adset targeting.',
            mofu_visitors_30d: mofu,
            bofu_landing_page_7d: bofu,
            fb_page_engagers_30d: engagers,
            next_step: 'Run: node zentax-campaign.js funnel launch-all --mofu-audience <mofu_id> --bofu-audience <bofu_id>',
          }
          break
        }

        default:
          result = { error: 'Unknown audiences subcommand', usage: 'audiences [setup|list] [--dry-run] [--page-id <fb_page_id>]' }
      }
      break
    }

    // ── funnel ─────────────────────────────────────────────────────────────────
    case 'funnel': {
      const acctId = accountId()
      const mofuAudienceId = args['mofu-audience'] || null
      const bofuAudienceId = args['bofu-audience'] || null

      switch (sub) {

        case 'launch-tofu':
          result = await buildTOFU(acctId)
          break

        case 'launch-mofu':
          result = await buildMOFU(acctId, mofuAudienceId)
          break

        case 'launch-bofu':
          result = await buildBOFU(acctId, bofuAudienceId)
          break

        case 'launch-all': {
          const [tofu, mofu, bofu] = await Promise.all([
            buildTOFU(acctId),
            buildMOFU(acctId, mofuAudienceId),
            buildBOFU(acctId, bofuAudienceId),
          ])
          result = {
            note: args['dry-run']
              ? 'DRY RUN — no campaigns created'
              : 'All 3 campaigns created in PAUSED state. Review in Meta Ads Manager, then activate.',
            total_daily_budget_CAD: `$${(ZENTAX.daily_budgets.tofu + ZENTAX.daily_budgets.mofu + ZENTAX.daily_budgets.bofu) / 100}`,
            funnel: { tofu, mofu, bofu },
            next_steps: [
              '1. Upload French creatives to each ad set in Meta Ads Manager',
              '2. Verify pixel is firing Lead events on zentax.pro/funnel-2 thank-you page',
              '3. Run: node zentax-campaign.js funnel activate (when ready to go live)',
            ],
          }
          break
        }

        case 'activate':
        case 'pause': {
          const newStatus = sub === 'activate' ? 'ACTIVE' : 'PAUSED'
          // List all campaigns, find Zentax ones, update status
          const camps = await api('GET', `/act_${acctId}/campaigns?fields=id,name,status&limit=50`)
          if (camps.error) { result = camps; break }
          const zentaxCampaigns = (camps.data || []).filter(c => c.name.includes('[ZENTAX]'))
          if (!zentaxCampaigns.length) { result = { error: 'No [ZENTAX] campaigns found. Run funnel launch-all first.' }; break }

          const updates = await Promise.all(
            zentaxCampaigns.map(c => api('POST', `/${c.id}`, { status: newStatus }).then(r => ({ id: c.id, name: c.name, result: r })))
          )
          result = { action: newStatus, campaigns_updated: updates }
          break
        }

        default:
          result = {
            error: 'Unknown funnel subcommand',
            usage: 'funnel [launch-all|launch-tofu|launch-mofu|launch-bofu|activate|pause] [--mofu-audience <id>] [--bofu-audience <id>] [--dry-run]',
          }
      }
      break
    }

    // ── status ─────────────────────────────────────────────────────────────────
    case 'status': {
      const acctId = accountId()
      const datePreset = args['date-preset'] || 'last_7d'
      const camps = await api('GET', `/act_${acctId}/campaigns?fields=id,name,status,objective,daily_budget&limit=50`)
      if (camps.error) { result = camps; break }

      const zentaxCampaigns = (camps.data || []).filter(c => c.name.includes('[ZENTAX]'))
      if (!zentaxCampaigns.length) { result = { message: 'No [ZENTAX] campaigns found yet. Run: node zentax-campaign.js funnel launch-all' }; break }

      // Fetch insights for each campaign
      const withInsights = await Promise.all(
        zentaxCampaigns.map(async c => {
          const insights = await api('GET', `/${c.id}/insights?fields=impressions,clicks,spend,actions,cost_per_action_type,reach,frequency&date_preset=${datePreset}`)
          const data = insights.data && insights.data[0]
          const leadAction = data && data.actions && data.actions.find(a => a.action_type === 'lead')
          const cpl = data && data.cost_per_action_type && data.cost_per_action_type.find(a => a.action_type === 'lead')
          return {
            name: c.name,
            status: c.status,
            daily_budget: c.daily_budget ? `$${c.daily_budget / 100}` : '—',
            period: datePreset,
            spend: data ? `$${data.spend}` : '—',
            impressions: data ? data.impressions : '—',
            clicks: data ? data.clicks : '—',
            reach: data ? data.reach : '—',
            leads: leadAction ? leadAction.value : '0',
            cpl: cpl ? `$${parseFloat(cpl.value).toFixed(2)}` : '—',
          }
        })
      )
      result = { pixel_id: ZENTAX.pixel_id, campaigns: withInsights }
      break
    }

    // ── pixel events ───────────────────────────────────────────────────────────
    case 'pixel': {
      if (sub === 'events') {
        const datePreset = args['date-preset'] || 'last_7d'
        result = await api('GET', `/${ZENTAX.pixel_id}?fields=id,name,last_fired_time,stats`)
        const stats = await api('GET', `/${ZENTAX.pixel_id}/stats?aggregation=event&start_time=${Math.floor(Date.now() / 1000) - 604800}`)
        result = { pixel: result, recent_events: stats }
      } else {
        result = { error: 'Unknown pixel subcommand', usage: 'pixel [events] [--date-preset last_7d]' }
      }
      break
    }

    // ── help / default ─────────────────────────────────────────────────────────
    default:
      result = {
        tool: 'zentax-campaign.js',
        description: 'Full Meta Ads funnel launcher for Zentax Cabinet Comptable (Quebec)',
        pixel_id: ZENTAX.pixel_id,
        target: 'Quebec business owners, French language, age 28-60',
        funnel_budgets: {
          TOFU_awareness: '$20/day',
          MOFU_retargeting: '$30/day',
          BOFU_hot_retargeting: '$15/day',
          total: '$65/day',
        },
        commands: {
          'audiences setup': 'Create MOFU + BOFU pixel custom audiences [--page-id <fb_page_id>]',
          'audiences list': 'List all custom audiences',
          'funnel launch-all': 'Create all 3 campaigns (PAUSED) [--mofu-audience <id>] [--bofu-audience <id>]',
          'funnel launch-tofu': 'Create TOFU awareness campaign only',
          'funnel launch-mofu': 'Create MOFU retargeting campaign [--mofu-audience <id>]',
          'funnel launch-bofu': 'Create BOFU hot retargeting campaign [--bofu-audience <id>]',
          'funnel activate': 'Activate all [ZENTAX] campaigns',
          'funnel pause': 'Pause all [ZENTAX] campaigns',
          'status': 'Show performance of all Zentax campaigns [--date-preset last_7d|last_30d]',
          'pixel events': 'Show recent pixel activity',
        },
        setup_order: [
          '1. Set env vars: META_ACCESS_TOKEN, META_AD_ACCOUNT_ID',
          '2. node zentax-campaign.js audiences setup --page-id <your_fb_page_id>',
          '3. node zentax-campaign.js funnel launch-all --mofu-audience <id> --bofu-audience <id>',
          '4. Upload creatives in Meta Ads Manager (from C:/Users/takie/Downloads/Creatives)',
          '5. node zentax-campaign.js funnel activate',
          '6. node zentax-campaign.js status (monitor daily)',
        ],
      }
  }

  console.log(JSON.stringify(result, null, 2))
}

main().catch(err => {
  console.error(JSON.stringify({ error: err.message }))
  process.exit(1)
})
