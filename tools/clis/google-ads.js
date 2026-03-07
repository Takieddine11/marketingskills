#!/usr/bin/env node

const TOKEN = process.env.GOOGLE_ADS_TOKEN
const DEV_TOKEN = process.env.GOOGLE_ADS_DEVELOPER_TOKEN
const CUSTOMER_ID = process.env.GOOGLE_ADS_CUSTOMER_ID
const BASE_URL = 'https://googleads.googleapis.com/v14'

if (!TOKEN || !DEV_TOKEN || !CUSTOMER_ID) {
  console.error(JSON.stringify({ error: 'GOOGLE_ADS_TOKEN, GOOGLE_ADS_DEVELOPER_TOKEN, and GOOGLE_ADS_CUSTOMER_ID environment variables required' }))
  process.exit(1)
}

async function api(method, path, body) {
  if (args['dry-run']) {
    return { _dry_run: true, method, url: `${BASE_URL}${path}`, headers: { Authorization: '***', 'developer-token': '***', 'Content-Type': 'application/json' }, body: body || undefined }
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'developer-token': DEV_TOKEN,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    return { status: res.status, body: text }
  }
}

async function gaql(query) {
  return api('POST', `/customers/${CUSTOMER_ID}/googleAds:searchStream`, { query })
}

function parseArgs(args) {
  const result = { _: [] }
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg.startsWith('--')) {
      const key = arg.slice(2)
      const next = args[i + 1]
      if (next && !next.startsWith('--')) {
        result[key] = next
        i++
      } else {
        result[key] = true
      }
    } else {
      result._.push(arg)
    }
  }
  return result
}

const args = parseArgs(process.argv.slice(2))
const [cmd, sub, ...rest] = args._

function daysToDateRange(days) {
  const d = parseInt(days) || 30
  if (d === 7) return 'LAST_7_DAYS'
  if (d === 14) return 'LAST_14_DAYS'
  if (d === 30) return 'LAST_30_DAYS'
  if (d === 90) return 'LAST_90_DAYS'
  return `LAST_${d}_DAYS`
}

async function main() {
  let result

  switch (cmd) {
    case 'account':
      switch (sub) {
        case 'info':
        default:
          result = await gaql('SELECT customer.id, customer.descriptive_name FROM customer')
      }
      break

    case 'budgets':
      switch (sub) {
        case 'create': {
          if (!args.amount) { result = { error: '--amount required' }; break }
          const name = args.name || 'Campaign Budget'
          const amountMicros = String(Math.round(parseFloat(args.amount) * 1000000))
          result = await api('POST', `/customers/${CUSTOMER_ID}/campaignBudgets:mutate`, {
            operations: [{
              create: {
                name,
                amountMicros,
                deliveryMethod: 'STANDARD',
              },
            }],
          })
          break
        }
        case 'update': {
          if (!args.id || !args.amount) { result = { error: '--id and --amount required' }; break }
          const amountMicros = String(Math.round(parseFloat(args.amount) * 1000000))
          result = await api('POST', `/customers/${CUSTOMER_ID}/campaignBudgets:mutate`, {
            operations: [{
              update: {
                resourceName: `customers/${CUSTOMER_ID}/campaignBudgets/${args.id}`,
                amount_micros: amountMicros,
              },
              updateMask: 'amount_micros',
            }],
          })
          break
        }
        default:
          result = { error: 'Unknown budgets subcommand. Use: create, update' }
      }
      break

    case 'campaigns':
      switch (sub) {
        case 'list':
          result = await gaql('SELECT campaign.id, campaign.name, campaign.status, campaign_budget.amount_micros FROM campaign ORDER BY campaign.id')
          break
        case 'performance': {
          const dateRange = daysToDateRange(args.days)
          result = await gaql(`SELECT campaign.name, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions FROM campaign WHERE segments.date DURING ${dateRange}`)
          break
        }
        case 'create': {
          if (!args['budget-id']) { result = { error: '--budget-id required' }; break }
          const name = args.name || 'New Campaign'
          const status = args.status || 'PAUSED'
          result = await api('POST', `/customers/${CUSTOMER_ID}/campaigns:mutate`, {
            operations: [{
              create: {
                name,
                status,
                campaignBudget: `customers/${CUSTOMER_ID}/campaignBudgets/${args['budget-id']}`,
                advertisingChannelType: 'SEARCH',
                targetGoogleSearch: {},
                networkSettings: {
                  targetGoogleSearch: true,
                  targetSearchNetwork: true,
                  targetContentNetwork: false,
                },
                biddingStrategyType: 'MANUAL_CPC',
                manualCpc: { enhancedCpcEnabled: false },
              },
            }],
          })
          break
        }
        case 'pause': {
          if (!args.id) { result = { error: '--id required' }; break }
          result = await api('POST', `/customers/${CUSTOMER_ID}/campaigns:mutate`, {
            operations: [{
              update: {
                resourceName: `customers/${CUSTOMER_ID}/campaigns/${args.id}`,
                status: 'PAUSED',
              },
              updateMask: 'status',
            }],
          })
          break
        }
        case 'enable': {
          if (!args.id) { result = { error: '--id required' }; break }
          result = await api('POST', `/customers/${CUSTOMER_ID}/campaigns:mutate`, {
            operations: [{
              update: {
                resourceName: `customers/${CUSTOMER_ID}/campaigns/${args.id}`,
                status: 'ENABLED',
              },
              updateMask: 'status',
            }],
          })
          break
        }
        default:
          result = { error: 'Unknown campaigns subcommand. Use: list, performance, create, pause, enable' }
      }
      break

    case 'adgroups':
      switch (sub) {
        case 'create': {
          if (!args['campaign-id']) { result = { error: '--campaign-id required' }; break }
          const name = args.name || 'Ad Group'
          const cpcMicros = String(Math.round(parseFloat(args.cpc || '1') * 1000000))
          result = await api('POST', `/customers/${CUSTOMER_ID}/adGroups:mutate`, {
            operations: [{
              create: {
                campaign: `customers/${CUSTOMER_ID}/campaigns/${args['campaign-id']}`,
                name,
                status: 'ENABLED',
                type: 'SEARCH_STANDARD',
                cpcBidMicros: cpcMicros,
              },
            }],
          })
          break
        }
        case 'performance': {
          const dateRange = daysToDateRange(args.days)
          const limit = args.limit ? ` LIMIT ${args.limit}` : ''
          result = await gaql(`SELECT ad_group.name, metrics.impressions, metrics.clicks, metrics.conversions FROM ad_group WHERE segments.date DURING ${dateRange}${limit}`)
          break
        }
        default:
          result = { error: 'Unknown adgroups subcommand. Use: create, performance' }
      }
      break

    case 'keywords':
      switch (sub) {
        case 'add': {
          if (!args['adgroup-id'] || !args.keyword) { result = { error: '--adgroup-id and --keyword required' }; break }
          const matchTypeMap = { exact: 'EXACT', phrase: 'PHRASE', broad: 'BROAD' }
          const matchType = matchTypeMap[(args.match || 'exact').toLowerCase()] || 'EXACT'
          result = await api('POST', `/customers/${CUSTOMER_ID}/adGroupCriteria:mutate`, {
            operations: [{
              create: {
                adGroup: `customers/${CUSTOMER_ID}/adGroups/${args['adgroup-id']}`,
                status: 'ENABLED',
                keyword: {
                  text: args.keyword,
                  matchType,
                },
              },
            }],
          })
          break
        }
        case 'performance': {
          const dateRange = daysToDateRange(args.days)
          const limit = args.limit || '50'
          result = await gaql(`SELECT ad_group_criterion.keyword.text, metrics.impressions, metrics.clicks, metrics.average_cpc FROM keyword_view WHERE segments.date DURING ${dateRange} ORDER BY metrics.clicks DESC LIMIT ${limit}`)
          break
        }
        default:
          result = { error: 'Unknown keywords subcommand. Use: add, performance' }
      }
      break

    case 'ads':
      switch (sub) {
        case 'create-rsa': {
          if (!args['adgroup-id'] || !args.url || !args.headlines || !args.descriptions) {
            result = { error: '--adgroup-id, --url, --headlines, and --descriptions required' }
            break
          }
          const headlines = args.headlines.split('|').map((text, i) => {
            const asset = { text: text.trim() }
            if (i === 0) asset.pinnedField = 'HEADLINE_1'
            return asset
          })
          const descriptions = args.descriptions.split('|').map(text => ({ text: text.trim() }))
          const adObj = {
            adGroup: `customers/${CUSTOMER_ID}/adGroups/${args['adgroup-id']}`,
            status: 'ENABLED',
            ad: {
              finalUrls: [args.url],
              responsiveSearchAd: {
                headlines,
                descriptions,
              },
            },
          }
          if (args.path1) adObj.ad.responsiveSearchAd.path1 = args.path1
          if (args.path2) adObj.ad.responsiveSearchAd.path2 = args.path2
          result = await api('POST', `/customers/${CUSTOMER_ID}/adGroupAds:mutate`, {
            operations: [{ create: adObj }],
          })
          break
        }
        default:
          result = { error: 'Unknown ads subcommand. Use: create-rsa' }
      }
      break

    default:
      result = {
        error: 'Unknown command',
        usage: {
          account: 'account [info]',
          campaigns: 'campaigns [list|performance|create|pause|enable] [--days 30] [--id <id>] [--name <name>] [--budget-id <id>] [--status PAUSED]',
          adgroups: 'adgroups [create|performance] [--campaign-id <id>] [--name <name>] [--cpc <dollars>] [--days 30]',
          keywords: 'keywords [add|performance] [--adgroup-id <id>] [--keyword <text>] [--match exact|phrase|broad] [--days 30]',
          budgets: 'budgets [create|update] [--name <name>] --amount <dollars> [--id <budget_id>]',
          ads: 'ads [create-rsa] --adgroup-id <id> --url <url> --headlines "H1|H2|H3" --descriptions "D1|D2" [--path1 p1] [--path2 p2]',
        },
      }
  }

  console.log(JSON.stringify(result, null, 2))
}

main().catch(err => {
  console.error(JSON.stringify({ error: err.message }))
  process.exit(1)
})
