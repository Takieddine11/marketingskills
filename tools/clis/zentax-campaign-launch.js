#!/usr/bin/env node
/**
 * Zentax Campaign Launcher
 * JSON-config driven Meta Ads campaign creator.
 * Creates campaigns, ad sets, and individual ads from a config file,
 * each with its own copy (primary_text, headline, description, CTA).
 *
 * Usage (PowerShell):
 *   $env:META_ACCESS_TOKEN  = Get-Content "$env:USERPROFILE\meta_token.txt"
 *   $env:META_AD_ACCOUNT_ID = "2189765574795573"
 *
 *   # Dry run — safe preview, no API calls:
 *   node zentax-campaign-launch.js --config campaign.json --fr-dir "C:\Users\takie\Downloads\Creatives" --dry-run
 *
 *   # Launch all campaigns from config:
 *   node zentax-campaign-launch.js --config campaign.json --fr-dir "C:\Users\takie\Downloads\Creatives" --retarget-audience-id 123456789
 *
 * Options:
 *   --config <path>               JSON campaign config file (required)
 *   --fr-dir <path>               Folder containing all creative files (required)
 *   --retarget-dir <path>         Separate folder for retargeting creatives (defaults to --fr-dir)
 *   --retarget-audience-id <id>   Meta custom audience ID for RETARGETING campaign ad sets
 *   --status <status>             PAUSED or ACTIVE (default: PAUSED)
 *   --rewarded-video <path>       9:16 video for Audience Network rewarded video placement
 *                                 Without this, that placement is excluded automatically.
 *   --dry-run                     Preview all API calls without sending anything
 *   --find-targeting              Query Meta API for Quebec region key + French locale ID
 */

const fs = require('fs')
const path = require('path')

const TOKEN = process.env.META_ACCESS_TOKEN
const RAW_ACCOUNT_ID = process.env.META_AD_ACCOUNT_ID || ''
const ACCOUNT_ID = RAW_ACCOUNT_ID.replace(/^act_/, '') || '2189765574795573'
const BASE_URL = 'https://graph.facebook.com/v18.0'
const PAGE_ID = '676813882182100'
const INSTAGRAM_ACTOR_ID = '9623717551054024'

// ─── Targeting ────────────────────────────────────────────────────────────────

// Quebec (region key 3870), French speakers, age 25-55
const BASE_GEO = {
  geo_locations: { regions: [{ key: '3870' }] },
  locales: [12],
  age_min: 25,
  age_max: 55,
}

const TARGETING_BROAD = { ...BASE_GEO }

function targetingRetarget(audienceId) {
  return { ...BASE_GEO, custom_audiences: [{ id: audienceId }] }
}

// ─── Objective / optimization mapping ────────────────────────────────────────

const OBJECTIVE_MAP = {
  LEAD_GENERATION:   'OUTCOME_LEADS',
  OUTCOME_LEADS:     'OUTCOME_LEADS',
  TRAFFIC:           'OUTCOME_TRAFFIC',
  OUTCOME_TRAFFIC:   'OUTCOME_TRAFFIC',
  CONVERSIONS:       'OUTCOME_SALES',
  OUTCOME_SALES:     'OUTCOME_SALES',
  BRAND_AWARENESS:   'OUTCOME_AWARENESS',
  OUTCOME_AWARENESS: 'OUTCOME_AWARENESS',
}

const OPTIMIZATION_GOAL_MAP = {
  OUTCOME_LEADS:     'QUALITY_LEAD',
  OUTCOME_TRAFFIC:   'LANDING_PAGE_VIEWS',
  OUTCOME_SALES:     'OFFSITE_CONVERSIONS',
  OUTCOME_AWARENESS: 'REACH',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const result = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg.startsWith('--')) {
      const key = arg.slice(2)
      const next = argv[i + 1]
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
const DRY_RUN = !!args['dry-run']

function log(msg) { console.log(msg) }

async function api(method, endpoint, body) {
  const url = `${BASE_URL}${endpoint}`
  if (DRY_RUN) {
    log(`[DRY-RUN] ${method} ${url}`)
    if (body) log('  ' + JSON.stringify(body, null, 2).split('\n').join('\n  '))
    return { id: `DRY_${Math.random().toString(36).slice(2, 7).toUpperCase()}` }
  }
  const params = new URLSearchParams()
  params.append('access_token', TOKEN)
  if (body) {
    for (const [k, v] of Object.entries(body)) {
      if (Array.isArray(v) || (typeof v === 'object' && v !== null)) {
        params.append(k, JSON.stringify(v))
      } else {
        params.append(k, String(v))
      }
    }
  }
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })
  const data = await res.json()
  if (data.error) throw new Error(`Meta API: ${JSON.stringify(data.error)}`)
  return data
}

function isVideo(filePath) {
  return /\.(mp4|mov)$/i.test(filePath)
}

function findCreativeFile(filename, dirs) {
  for (const dir of dirs) {
    if (!dir) continue
    const full = path.join(dir, filename)
    if (fs.existsSync(full)) return full
  }
  return null
}

function findThumbnail(videoPath, fallbackDir, globalThumbnail) {
  // 1. Exact name match: video.mp4 → video.jpg
  const base = videoPath.replace(/\.(mp4|mov)$/i, '')
  for (const ext of ['.jpg', '.jpeg', '.png']) {
    if (fs.existsSync(base + ext)) return base + ext
    if (fs.existsSync(base + ext.toUpperCase())) return base + ext.toUpperCase()
  }
  // 2. Any image in the same folder
  const sameDir = path.dirname(videoPath)
  const anyInSame = fs.readdirSync(sameDir).find(f => /\.(jpe?g|png)$/i.test(f))
  if (anyInSame) return path.join(sameDir, anyInSame)
  // 3. Any image in fallbackDir
  if (fallbackDir && fallbackDir !== sameDir) {
    const anyInFallback = fs.readdirSync(fallbackDir).find(f => /\.(jpe?g|png)$/i.test(f))
    if (anyInFallback) return path.join(fallbackDir, anyInFallback)
  }
  // 4. Explicit --thumbnail flag
  if (globalThumbnail) return globalThumbnail
  return null
}

function buildMultipart(fields, fileField, filename, mimeType, fileBuffer) {
  const boundary = `----FormBoundary${Math.random().toString(36).slice(2)}`
  const CRLF = '\r\n'
  const parts = []

  for (const [name, value] of Object.entries(fields)) {
    parts.push(Buffer.from(
      `--${boundary}${CRLF}` +
      `Content-Disposition: form-data; name="${name}"${CRLF}${CRLF}` +
      `${value}${CRLF}`
    ))
  }

  parts.push(Buffer.from(
    `--${boundary}${CRLF}` +
    `Content-Disposition: form-data; name="${fileField}"; filename="${filename}"${CRLF}` +
    `Content-Type: ${mimeType}${CRLF}${CRLF}`
  ))
  parts.push(fileBuffer)
  parts.push(Buffer.from(`${CRLF}--${boundary}--${CRLF}`))

  return { body: Buffer.concat(parts), boundary }
}

async function uploadImage(imagePath) {
  const filename = path.basename(imagePath)
  if (DRY_RUN) {
    log(`[DRY-RUN] Upload image: ${filename}`)
    return `DRY_HASH_${Math.random().toString(36).slice(2, 10).toUpperCase()}`
  }
  const { body, boundary } = buildMultipart(
    { access_token: TOKEN },
    'filename', filename, 'image/jpeg',
    fs.readFileSync(imagePath)
  )
  const res = await fetch(`${BASE_URL}/act_${ACCOUNT_ID}/adimages`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}`, 'Content-Length': body.length },
    body,
  })
  const data = await res.json()
  if (data.error) throw new Error(`Image upload (${filename}): ${data.error.message}`)
  const key = Object.keys(data.images)[0]
  return data.images[key].hash
}

async function uploadVideo(videoPath) {
  const filename = path.basename(videoPath)
  if (DRY_RUN) {
    log(`[DRY-RUN] Upload video: ${filename}`)
    return `DRY_VIDEO_ID_${Math.random().toString(36).slice(2, 10).toUpperCase()}`
  }
  const mime = /\.mov$/i.test(videoPath) ? 'video/quicktime' : 'video/mp4'
  const { body, boundary } = buildMultipart(
    { access_token: TOKEN, title: filename },
    'source', filename, mime,
    fs.readFileSync(videoPath)
  )
  const res = await fetch(`${BASE_URL}/act_${ACCOUNT_ID}/advideos`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}`, 'Content-Length': body.length },
    body,
  })
  const data = await res.json()
  if (data.error) throw new Error(`Video upload (${filename}): ${data.error.message}`)
  return data.id
}

// Builds an asset_feed_spec that routes rwVideoId to Audience Network rewarded
// video and uses the per-ad copy for every other placement.
function buildFeedSpec({ adDef, destinationUrl, videoId, thumbHash, imageHash, rwVideoId, rwThumbHash }) {
  const main     = { name: 'main' }
  const rewarded = { name: 'rewarded' }
  const spec = {
    bodies:               [{ text: adDef.primary_text, adlabels: [main] }],
    titles:               [{ text: adDef.headline,     adlabels: [main] }],
    link_urls:            [{ website_url: destinationUrl, adlabels: [main] }],
    call_to_action_types: [adDef.cta_button],
    videos: [{ video_id: rwVideoId, thumbnail_hash: rwThumbHash, adlabels: [rewarded] }],
    asset_customization_rules: [{
      customization_spec: {
        publisher_platforms:        ['audience_network'],
        audience_network_positions: ['rewarded_video'],
      },
      video_label:    rewarded,
      title_label:    main,
      body_label:     main,
      link_url_label: main,
    }],
  }
  if (videoId) {
    spec.videos.unshift({ video_id: videoId, thumbnail_hash: thumbHash, adlabels: [main] })
  } else {
    spec.images = [{ hash: imageHash, adlabels: [main] }]
  }
  return spec
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!TOKEN && !DRY_RUN) {
    console.error('Error: META_ACCESS_TOKEN is not set.\n  $env:META_ACCESS_TOKEN = "your_token"')
    process.exit(1)
  }

  const configPath = args['config']
  if (!configPath) {
    console.error([
      'Error: --config is required.',
      '  --config "C:\\Users\\takie\\Downloads\\campaign.json"',
      '',
      'The config JSON must follow this structure:',
      '  {',
      '    "destination_url": "https://zentax.pro/funnel-2",',
      '    "campaigns": {',
      '      "ACQUISITION": {',
      '        "campaign_name": "ZTX | ACQ | QC-FR | 2026-03-10",',
      '        "objective": "LEAD_GENERATION",',
      '        "budget_daily": 120,',
      '        "ad_sets": [',
      '          {',
      '            "ad_set_name": "ZTX | ACQ | STATIC | BROAD-QC-FR",',
      '            "budget_daily": 60,',
      '            "ads": [',
      '              {',
      '                "filename": "my-creative.png",',
      '                "ad_name": "ZTX | FEAR | IMG | example",',
      '                "format": "IMAGE",',
      '                "primary_text": "...",',
      '                "headline": "...",',
      '                "description": "...",',
      '                "cta_button": "LEARN_MORE"',
      '              }',
      '            ]',
      '          }',
      '        ]',
      '      }',
      '    }',
      '  }',
    ].join('\n'))
    process.exit(1)
  }

  if (!fs.existsSync(configPath)) {
    console.error(`Error: Config file not found: ${configPath}`)
    process.exit(1)
  }

  let config
  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
  } catch (e) {
    console.error(`Error: Invalid JSON in config file: ${e.message}`)
    process.exit(1)
  }

  const destinationUrl = config.destination_url
  if (!destinationUrl) {
    console.error('Error: Config missing "destination_url"')
    process.exit(1)
  }

  const frDir = args['fr-dir']
  if (!frDir) {
    console.error('Error: --fr-dir is required.\n  --fr-dir "C:\\Users\\takie\\Downloads\\Creatives"')
    process.exit(1)
  }
  if (!fs.existsSync(frDir)) {
    console.error(`Error: --fr-dir not found: ${frDir}`)
    process.exit(1)
  }

  const retargetDir      = args['retarget-dir'] || frDir
  const status           = args.status || 'PAUSED'
  const retargetAudienceId = args['retarget-audience-id']
  const globalThumbnail  = args['thumbnail'] || null
  const rewardedVideoPath = args['rewarded-video'] || null

  if (rewardedVideoPath && !fs.existsSync(rewardedVideoPath)) {
    console.error(`Error: --rewarded-video file not found: ${rewardedVideoPath}`)
    process.exit(1)
  }

  const campaignKeys = Object.keys(config.campaigns)

  log(`\n${'═'.repeat(57)}`)
  log(`  Zentax Campaign Launcher${DRY_RUN ? ' [DRY RUN]' : ''}`)
  log(`${'═'.repeat(57)}`)
  log(`  Account    : act_${ACCOUNT_ID}`)
  log(`  Status     : ${status}`)
  log(`  Config     : ${path.basename(configPath)}`)
  log(`  Creatives  : ${frDir}`)
  log(`  Campaigns  : ${campaignKeys.join(', ')}`)
  log(`  Rewarded   : ${rewardedVideoPath ? path.basename(rewardedVideoPath) : '(none — placement excluded)'}`)
  log(`${'═'.repeat(57)}`)

  const allResults = []

  for (const campaignKey of campaignKeys) {
    const campaignDef  = config.campaigns[campaignKey]
    const isRetargeting = /RETARGET|RTG/i.test(campaignKey)
    const metaObjective = OBJECTIVE_MAP[campaignDef.objective] || campaignDef.objective
    const optimGoal     = OPTIMIZATION_GOAL_MAP[metaObjective] || 'QUALITY_LEAD'

    log(`\n${'─'.repeat(57)}`)
    log(`  [${campaignKey}] ${campaignDef.campaign_name}`)
    log(`  Objective: ${metaObjective}  Optimization: ${optimGoal}`)
    log(`${'─'.repeat(57)}`)

    const campaign = await api('POST', `/act_${ACCOUNT_ID}/campaigns`, {
      name:                            campaignDef.campaign_name,
      objective:                       metaObjective,
      status,
      special_ad_categories:           '[]',
      is_adset_budget_sharing_enabled: false,
    })
    log(`  ✓ Campaign: ${campaign.id}  "${campaignDef.campaign_name}"`)

    const adSetResults = []

    for (const adSetDef of campaignDef.ad_sets) {
      const adSetBudgetCents = Math.round(adSetDef.budget_daily * 100)

      const targeting = (isRetargeting && retargetAudienceId)
        ? targetingRetarget(retargetAudienceId)
        : TARGETING_BROAD

      if (isRetargeting && !retargetAudienceId) {
        log(`\n  ⚠  "${adSetDef.ad_set_name}" is a RETARGETING ad set.`)
        log(`     Pass --retarget-audience-id <id> to use a custom audience.`)
        log(`     Launching with broad targeting as fallback.`)
      }

      const adset = await api('POST', `/act_${ACCOUNT_ID}/adsets`, {
        name:              adSetDef.ad_set_name,
        campaign_id:       campaign.id,
        billing_event:     'IMPRESSIONS',
        optimization_goal: optimGoal,
        daily_budget:      adSetBudgetCents,
        bid_strategy:      'LOWEST_COST_WITHOUT_CAP',
        targeting,
        status,
      })
      log(`\n  ✓ Ad Set: ${adset.id}  "${adSetDef.ad_set_name}"`)
      log(`    Budget: $${adSetDef.budget_daily} CAD/day`)

      // Upload the 9:16 rewarded video once per ad set (shared across all ads in this set)
      let rwVideoId   = null
      let rwThumbHash = null
      if (rewardedVideoPath) {
        log(`\n    Uploading rewarded video (9:16): ${path.basename(rewardedVideoPath)}`)
        rwVideoId = await uploadVideo(rewardedVideoPath)
        log(`      ✓ rewarded video_id: ${rwVideoId}`)
        const rwThumbPath = findThumbnail(rewardedVideoPath, retargetDir, globalThumbnail)
        if (rwThumbPath) {
          rwThumbHash = await uploadImage(rwThumbPath)
          log(`      ✓ rewarded thumb   : ${rwThumbHash} (${path.basename(rwThumbPath)})`)
        }
      }

      const adResults = []
      const creativeDirs = isRetargeting ? [retargetDir, frDir] : [frDir, retargetDir]

      for (const adDef of adSetDef.ads) {
        const filePath = findCreativeFile(adDef.filename, creativeDirs)
        if (!filePath) {
          if (DRY_RUN) {
            log(`\n    [DRY-RUN] ⚠  File not found: ${adDef.filename} — skipping`)
            continue
          }
          throw new Error(
            `Creative file not found: ${adDef.filename}\n` +
            `  Searched in: ${creativeDirs.join(', ')}`
          )
        }

        const fileType = isVideo(filePath) ? 'video' : 'image'
        log(`\n    [${adDef.ad_name}]`)
        log(`      File  : ${adDef.filename} (${fileType})`)
        log(`      Angle : ${adDef.angle || '—'}`)

        let creativePayload

        if (isVideo(filePath)) {
          // ── Video creative ──────────────────────────────────────────────────
          const thumbPath = findThumbnail(filePath, retargetDir, globalThumbnail)
          if (!thumbPath && !DRY_RUN) {
            throw new Error(
              `No thumbnail found for ${adDef.filename}.\n` +
              `  Create: ${adDef.filename.replace(/\.(mp4|mov)$/i, '')}.jpg next to the video.`
            )
          }
          const videoId  = await uploadVideo(filePath)
          log(`      ✓ video_id  : ${videoId}`)
          const thumbHash = thumbPath ? await uploadImage(thumbPath) : null
          if (thumbPath) log(`      ✓ thumbnail : ${thumbHash} (${path.basename(thumbPath)})`)

          if (rwVideoId) {
            creativePayload = {
              name:            `${adDef.ad_name} Creative`,
              page_id:         PAGE_ID,
              instagram_actor_id: INSTAGRAM_ACTOR_ID,
              asset_feed_spec: buildFeedSpec({
                adDef, destinationUrl,
                videoId, thumbHash: thumbHash || rwThumbHash,
                rwVideoId, rwThumbHash: rwThumbHash || thumbHash,
              }),
            }
          } else {
            creativePayload = {
              name: `${adDef.ad_name} Creative`,
              object_story_spec: {
                page_id:            PAGE_ID,
                instagram_actor_id: INSTAGRAM_ACTOR_ID,
                video_data: {
                  video_id:   videoId,
                  image_hash: thumbHash,
                  message:    adDef.primary_text,
                  title:      adDef.headline,
                  call_to_action: { type: adDef.cta_button, value: { link: destinationUrl } },
                },
              },
            }
          }

        } else {
          // ── Image creative ──────────────────────────────────────────────────
          const imageHash = await uploadImage(filePath)
          log(`      ✓ image_hash: ${imageHash}`)

          if (rwVideoId) {
            creativePayload = {
              name:            `${adDef.ad_name} Creative`,
              page_id:         PAGE_ID,
              instagram_actor_id: INSTAGRAM_ACTOR_ID,
              asset_feed_spec: buildFeedSpec({
                adDef, destinationUrl,
                imageHash, rwVideoId, rwThumbHash,
              }),
            }
          } else {
            creativePayload = {
              name: `${adDef.ad_name} Creative`,
              object_story_spec: {
                page_id:            PAGE_ID,
                instagram_actor_id: INSTAGRAM_ACTOR_ID,
                link_data: {
                  image_hash:  imageHash,
                  link:        destinationUrl,
                  message:     adDef.primary_text,
                  name:        adDef.headline,
                  description: adDef.description,
                  call_to_action: { type: adDef.cta_button, value: { link: destinationUrl } },
                },
              },
            }
          }
        }

        const creative = await api('POST', `/act_${ACCOUNT_ID}/adcreatives`, creativePayload)
        log(`      ✓ creative  : ${creative.id}`)

        const ad = await api('POST', `/act_${ACCOUNT_ID}/ads`, {
          name:      adDef.ad_name,
          adset_id:  adset.id,
          creative:  { creative_id: creative.id },
          status,
        })
        log(`      ✓ ad        : ${ad.id}`)

        adResults.push({
          ad_name:    adDef.ad_name,
          file:       adDef.filename,
          type:       fileType,
          ad_id:      ad.id,
          creative_id: creative.id,
        })
      }

      adSetResults.push({
        ad_set_name: adSetDef.ad_set_name,
        adset_id:    adset.id,
        ads:         adResults,
      })
    }

    allResults.push({
      campaign_key:  campaignKey,
      campaign_name: campaignDef.campaign_name,
      campaign_id:   campaign.id,
      ad_sets:       adSetResults,
    })
  }

  // ── Summary ──
  log(`\n${'═'.repeat(57)}`)
  log(`  All done!`)
  log(`${'═'.repeat(57)}`)

  let totalAds = 0
  for (const r of allResults) {
    log(`\n  [${r.campaign_key}] ${r.campaign_name}`)
    log(`    Campaign ID : ${r.campaign_id}`)
    for (const s of r.ad_sets) {
      log(`    Ad Set: "${s.ad_set_name}"  (${s.ads.length} ads)  ID: ${s.adset_id}`)
      totalAds += s.ads.length
    }
  }

  log(`\n  Total ads created: ${totalAds}`)
  log(`  All ads are ${status}. Review in Meta Ads Manager,`)
  log(`  then activate when ready.`)
  log(`  https://adsmanager.facebook.com/`)
  log(`${'═'.repeat(57)}\n`)
}

// ─── Find targeting (utility) ─────────────────────────────────────────────────

async function findTargeting() {
  if (!TOKEN) {
    console.error('Error: META_ACCESS_TOKEN is not set.')
    process.exit(1)
  }
  console.log('\n Looking up correct targeting keys from Meta API...\n')

  const geoUrl = `${BASE_URL}/search?type=adgeolocation&q=Quebec&location_types=%5B%22region%22%5D&country_code=CA&access_token=${TOKEN}`
  const geoRes  = await fetch(geoUrl)
  const geoData = await geoRes.json()
  console.log('=== Quebec region results ===')
  if (geoData.data && geoData.data.length > 0) {
    geoData.data.forEach(r => console.log(`  key: "${r.key}"  name: "${r.name}"  country: "${r.country_code || r.country}"`))
  } else {
    console.log('  No results or error:', JSON.stringify(geoData))
  }

  const localeUrl  = `${BASE_URL}/search?type=adlocale&q=French&access_token=${TOKEN}`
  const localeRes  = await fetch(localeUrl)
  const localeData = await localeRes.json()
  console.log('\n=== French locale results ===')
  if (localeData.data && localeData.data.length > 0) {
    localeData.data.forEach(r => console.log(`  key: ${r.key}  name: "${r.name}"`))
  } else {
    console.log('  No results or error:', JSON.stringify(localeData))
  }
  console.log('\nUpdate BASE_GEO in the script with the correct key values above.\n')
}

if (args['find-targeting']) {
  findTargeting().catch(err => { console.error(err.message); process.exit(1) })
} else {
  main().catch(err => {
    console.error('\nFatal error:', err.message)
    process.exit(1)
  })
}
