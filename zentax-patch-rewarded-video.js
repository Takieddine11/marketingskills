#!/usr/bin/env node
/**
 * zentax-patch-rewarded-video.js
 * Adds a 9:16 rewarded-video ad to every ad set in the 3 Zentax campaigns.
 *
 * Usage:
 *   node zentax-patch-rewarded-video.js --rewarded-video "C:\path\to\video.mp4"
 *   node zentax-patch-rewarded-video.js --rewarded-video "C:\path\to\video.mp4" --thumbnail "C:\path\to\thumb.jpg"
 *   node zentax-patch-rewarded-video.js --rewarded-video "C:\path\to\video.mp4" --dry-run
 *
 * Required env vars:
 *   META_ACCESS_TOKEN
 *   META_AD_ACCOUNT_ID  (optional, falls back to hard-coded value)
 */

const fs   = require('fs')
const path = require('path')

const TOKEN      = process.env.META_ACCESS_TOKEN
const RAW_ACCT   = process.env.META_AD_ACCOUNT_ID || ''
const ACCOUNT_ID = RAW_ACCT.replace(/^act_/, '') || '2189765574795573'
const BASE_URL   = 'https://graph.facebook.com/v22.0'
const PAGE_ID    = '676813882182100'
const INSTAGRAM_ACTOR_ID = '17841474054838963'

// The 3 campaigns to patch (matched by name)
const CAMPAIGN_NAMES = [
  'Zentax - Trafic QC FR',
  'Zentax - Retargeting QC FR',
  'Zentax - Funnel Complet QC FR',
]

// Copy per campaign (headline + body + link)
const COPY_BY_CAMPAIGN = {
  'Zentax - Trafic QC FR': {
    headline: 'Ne voudriez-vous pas récupérer 10 heures par mois?',
    body: `Si vous êtes entrepreneur ou propriétaire d'une petite entreprise, vous faites peut-être face à un problème.\nVos livres sont en désordre et vous passez trop de temps à essayer de les gérer.\nRéservez dès maintenant une consultation stratégique gratuite de 30 minutes — sans engagement.\n👉 zentax.pro/funnel-2`,
    link_url: 'https://zentax.pro/funnel-2',
  },
  'Zentax - Retargeting QC FR': {
    headline: 'Encore là? Votre consultation gratuite vous attend.',
    body: `Vous avez visité zentax.pro récemment.\n\nNos CPA ont déjà aidé des dizaines de PME québécoises à reprendre le contrôle — rapidement, sans casse-tête.\n\nRéservez votre consultation stratégique gratuite de 30 minutes. Sans engagement.\n\n👉 zentax.pro/funnel-2`,
    link_url: 'https://zentax.pro/funnel-2',
  },
  'Zentax - Funnel Complet QC FR': {
    headline: '30 minutes avec un CPA peut changer votre entreprise',
    body: `Vous gérez une PME au Québec?\n\nZentax offre la Fondation à 3 Piliers : un système simple et complet, conçu pour les entrepreneurs comme vous.\n\nConsultez un expert gratuitement. 30 minutes. Zéro engagement.\n\n👉 zentax.pro/funnel-2`,
    link_url: 'https://zentax.pro/funnel-2',
  },
}

// ─── Arg parsing ────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const result = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg.startsWith('--')) {
      const key  = arg.slice(2)
      const next = argv[i + 1]
      if (next && !next.startsWith('--')) { result[key] = next; i++ }
      else result[key] = true
    } else result._.push(arg)
  }
  return result
}
const args    = parseArgs(process.argv.slice(2))
const DRY_RUN = !!args['dry-run']
function log(msg) { console.log(msg) }

// ─── Meta API ────────────────────────────────────────────────────────────────
async function api(method, endpoint, body) {
  const url = `${BASE_URL}${endpoint}`
  if (DRY_RUN) {
    log(`[DRY-RUN] ${method} ${url}`)
    if (body) log('  ' + JSON.stringify(body, null, 2).split('\n').join('\n  '))
    return { id: `DRY_${Math.random().toString(36).slice(2, 7).toUpperCase()}`, data: [] }
  }
  const params = new URLSearchParams()
  params.append('access_token', TOKEN)
  if (body) {
    for (const [k, v] of Object.entries(body)) {
      if (Array.isArray(v) || (typeof v === 'object' && v !== null))
        params.append(k, JSON.stringify(v))
      else
        params.append(k, String(v))
    }
  }
  const res  = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })
  const data = await res.json()
  if (data.error) throw new Error(`Meta API: ${JSON.stringify(data.error)}`)
  return data
}

async function apiGet(endpoint) {
  if (DRY_RUN) {
    log(`[DRY-RUN] GET ${BASE_URL}${endpoint}`)
    return { data: [] }
  }
  const sep = endpoint.includes('?') ? '&' : '?'
  const res  = await fetch(`${BASE_URL}${endpoint}${sep}access_token=${TOKEN}`)
  const data = await res.json()
  if (data.error) throw new Error(`Meta API: ${JSON.stringify(data.error)}`)
  return data
}

// ─── File helpers ────────────────────────────────────────────────────────────
function buildMultipart(fields, fileField, filename, mimeType, fileBuffer) {
  const boundary = `----FormBoundary${Math.random().toString(36).slice(2)}`
  const CRLF     = '\r\n'
  const parts    = []
  for (const [name, value] of Object.entries(fields)) {
    parts.push(Buffer.from(`--${boundary}${CRLF}Content-Disposition: form-data; name="${name}"${CRLF}${CRLF}${value}${CRLF}`))
  }
  parts.push(Buffer.from(`--${boundary}${CRLF}Content-Disposition: form-data; name="${fileField}"; filename="${filename}"${CRLF}Content-Type: ${mimeType}${CRLF}${CRLF}`))
  parts.push(fileBuffer)
  parts.push(Buffer.from(`${CRLF}--${boundary}--${CRLF}`))
  return { body: Buffer.concat(parts), boundary }
}

async function uploadImage(imagePath) {
  const filename = path.basename(imagePath)
  if (DRY_RUN) { log(`[DRY-RUN] Upload image: ${filename}`); return `DRY_HASH_${Math.random().toString(36).slice(2, 10).toUpperCase()}` }
  const { body, boundary } = buildMultipart({ access_token: TOKEN }, 'filename', filename, 'image/jpeg', fs.readFileSync(imagePath))
  const res  = await fetch(`${BASE_URL}/act_${ACCOUNT_ID}/adimages`, { method: 'POST', headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` }, body })
  const data = await res.json()
  if (data.error) throw new Error(`Image upload (${filename}): ${data.error.message}`)
  const key  = Object.keys(data.images)[0]
  return data.images[key].hash
}

async function uploadVideo(videoPath) {
  const filename = path.basename(videoPath)
  if (DRY_RUN) { log(`[DRY-RUN] Upload video: ${filename}`); return `DRY_VIDEO_ID_${Math.random().toString(36).slice(2, 10).toUpperCase()}` }
  const mime = /\.mov$/i.test(videoPath) ? 'video/quicktime' : 'video/mp4'
  const { body, boundary } = buildMultipart({ access_token: TOKEN, title: filename }, 'source', filename, mime, fs.readFileSync(videoPath))
  const res  = await fetch(`${BASE_URL}/act_${ACCOUNT_ID}/advideos`, { method: 'POST', headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` }, body })
  const data = await res.json()
  if (data.error) throw new Error(`Video upload (${filename}): ${data.error.message}`)
  return data.id
}

function autoFindThumbnail(videoPath) {
  const base = videoPath.replace(/\.(mp4|mov)$/i, '')
  for (const ext of ['.jpg', '.jpeg', '.png']) {
    if (fs.existsSync(base + ext)) return base + ext
  }
  // Look in same directory
  const dir   = path.dirname(videoPath)
  const found = fs.readdirSync(dir).find(f => /\.(jpe?g|png)$/i.test(f))
  if (found) return path.join(dir, found)
  return null
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  if (!TOKEN && !DRY_RUN) { console.error('Error: META_ACCESS_TOKEN is not set.'); process.exit(1) }

  const videoPath = args['rewarded-video']
  if (!videoPath) {
    console.error([
      '',
      '  Usage:',
      '    node zentax-patch-rewarded-video.js --rewarded-video "C:\\path\\to\\video.mp4"',
      '',
      '  Options:',
      '    --rewarded-video <path>   9:16 video file to add as rewarded video ad (required)',
      '    --thumbnail <path>        Thumbnail image (auto-detected if omitted)',
      '    --status <PAUSED|ACTIVE>  Ad status (default: PAUSED)',
      '    --dry-run                 Preview without making API calls',
      '',
    ].join('\n'))
    process.exit(1)
  }

  if (!fs.existsSync(videoPath)) { console.error(`Error: video not found: ${videoPath}`); process.exit(1) }

  const thumbnailPath = args['thumbnail'] || autoFindThumbnail(videoPath)
  if (!thumbnailPath) {
    console.error(`Error: no thumbnail found next to ${path.basename(videoPath)}. Pass --thumbnail "C:\\path\\to\\thumb.jpg"`)
    process.exit(1)
  }
  if (!fs.existsSync(thumbnailPath)) { console.error(`Error: thumbnail not found: ${thumbnailPath}`); process.exit(1) }

  const adStatus = args['status'] || 'PAUSED'

  log(`\n${'═'.repeat(55)}`)
  log(`  Zentax — Patch: Add Rewarded Video${DRY_RUN ? ' [DRY RUN]' : ''}`)
  log(`${'═'.repeat(55)}`)
  log(`  Account   : act_${ACCOUNT_ID}`)
  log(`  Video     : ${path.basename(videoPath)}`)
  log(`  Thumbnail : ${path.basename(thumbnailPath)}`)
  log(`  Ad status : ${adStatus}`)
  log(`  Campaigns : ${CAMPAIGN_NAMES.length}`)
  log(`${'═'.repeat(55)}`)

  // 1. Upload video + thumbnail once (shared across all campaigns)
  log(`\n  Uploading assets...`)
  const videoId   = await uploadVideo(videoPath)
  log(`  ✓ video_id  : ${videoId}`)
  const thumbHash = await uploadImage(thumbnailPath)
  log(`  ✓ thumbnail : ${thumbHash}`)

  // 2. Fetch campaigns by name
  log(`\n  Looking up campaigns...`)
  const filterJson = JSON.stringify([{ field: 'name', operator: 'IN', value: CAMPAIGN_NAMES }])
  const campRes    = await apiGet(
    `/act_${ACCOUNT_ID}/campaigns?fields=id,name&filtering=${encodeURIComponent(filterJson)}&limit=10`
  )

  let campaigns = campRes.data || []
  if (DRY_RUN) {
    // Simulate found campaigns
    campaigns = CAMPAIGN_NAMES.map((name, i) => ({ id: `DRY_CAMP_${i + 1}`, name }))
  }

  if (campaigns.length === 0) {
    console.error('  Error: no campaigns found. Are the campaign names correct?')
    process.exit(1)
  }

  log(`  Found ${campaigns.length} campaign(s):`)
  campaigns.forEach(c => log(`    • ${c.name}  (${c.id})`))

  const summary = []

  // 3. For each campaign → fetch ad sets → create rewarded video ad
  for (const campaign of campaigns) {
    log(`\n${'─'.repeat(55)}`)
    log(`  Campaign: "${campaign.name}"  (${campaign.id})`)
    log(`${'─'.repeat(55)}`)

    const copy = COPY_BY_CAMPAIGN[campaign.name]
    if (!copy) {
      log(`  ⚠  No copy defined for "${campaign.name}" — skipping`)
      continue
    }

    // Fetch ad sets
    const adsetRes = await apiGet(`/${campaign.id}/adsets?fields=id,name&limit=50`)
    let adsets     = adsetRes.data || []
    if (DRY_RUN) adsets = [{ id: `DRY_ADSET_1`, name: 'Simulated Ad Set' }]

    if (adsets.length === 0) {
      log(`  ⚠  No ad sets found — skipping`)
      continue
    }

    log(`  Ad sets (${adsets.length}):`)
    adsets.forEach(a => log(`    • ${a.name}  (${a.id})`))

    for (const adset of adsets) {
      log(`\n    Adding rewarded video ad to: "${adset.name}"`)

      // Build creative
      const storySpec = {
        page_id: PAGE_ID,
        instagram_user_id: INSTAGRAM_ACTOR_ID,
        video_data: {
          video_id:  videoId,
          image_hash: thumbHash,
          message:   copy.body,
          title:     copy.headline,
          call_to_action: {
            type:  'LEARN_MORE',
            value: { link: copy.link_url },
          },
        },
      }

      const creativeName = `${campaign.name} - Rewarded Video Patch`
      const creative     = await api('POST', `/act_${ACCOUNT_ID}/adcreatives`, {
        name:               creativeName,
        object_story_spec:  storySpec,
      })
      log(`      ✓ creative : ${creative.id}`)

      // Create ad
      const adName = `${campaign.name} - Rewarded Video`
      const ad     = await api('POST', `/act_${ACCOUNT_ID}/ads`, {
        name:      adName,
        adset_id:  adset.id,
        creative:  { creative_id: creative.id },
        status:    adStatus,
      })
      log(`      ✓ ad       : ${ad.id}  "${adName}"`)

      summary.push({
        campaign: campaign.name,
        adset:    adset.name,
        creative_id: creative.id,
        ad_id:       ad.id,
      })
    }
  }

  // 4. Summary
  log(`\n${'═'.repeat(55)}`)
  log(`  Done! Rewarded video ads added: ${summary.length}`)
  log(`${'═'.repeat(55)}`)
  for (const s of summary) {
    log(`\n  [${s.campaign}]`)
    log(`    Ad Set    : ${s.adset}`)
    log(`    Creative  : ${s.creative_id}`)
    log(`    Ad        : ${s.ad_id}`)
  }
  log(`\n  All new ads are ${adStatus}.`)
  log(`  Review in Meta Ads Manager, then activate when ready.`)
  log(`  https://adsmanager.facebook.com/\n${'═'.repeat(55)}\n`)
}

main().catch(err => { console.error('\nFatal error:', err.message); process.exit(1) })
