#!/usr/bin/env node
/**
 * Zentax Campaign Launcher
 * Creates three French (Quebec) Meta Ads campaigns:
 *   1. Traffic      — cold Quebec/French audience
 *   2. Retargeting  — website visitors (requires --retarget-audience-id)
 *   3. Full Funnel  — conversion-focused, broader targeting
 *
 * Usage (PowerShell):
 *   $env:META_ACCESS_TOKEN = "your_token"
 *   $env:META_AD_ACCOUNT_ID = "2189765574795573"
 *
 *   # Dry run — safe preview, no API calls:
 *   node zentax-campaign-launch.js --dry-run --fr-dir "C:\Users\takie\Downloads\Creatives"
 *
 *   # Launch all three campaigns:
 *   node zentax-campaign-launch.js --fr-dir "C:\Users\takie\Downloads\Creatives" --daily-budget 65 --retarget-audience-id 123456789
 *
 * Options:
 *   --fr-dir <path>               Folder of Traffic + Full Funnel creatives (.jpg/.png/.mp4/.mov)
 *   --retarget-dir <path>         Folder of Retargeting creatives (defaults to --fr-dir if omitted)
 *   --daily-budget <num>          Daily budget in CAD per ad set (default: 100)
 *   --status <status>             PAUSED or ACTIVE (default: PAUSED)
 *   --retarget-audience-id <id>   Meta custom audience ID for website visitors
 *   --skip-traffic                Skip the Traffic campaign (useful if it already exists)
 *   --skip-retarget               Skip the Retargeting campaign
 *   --skip-funnel                 Skip the Full Funnel campaign
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

// ─── Ad Copy ──────────────────────────────────────────────────────────────────

// 1. Traffic (cold audience)
const COPY_TRAFFIC = {
  headline: 'Ne voudriez-vous pas récupérer 10 heures par mois?',
  body: `Si vous êtes entrepreneur ou propriétaire d'une petite entreprise, vous faites peut-être face à un problème.

Vos livres sont en désordre et vous passez trop de temps à essayer de les gérer.

Vous manquez peut-être des délais de production, vous ignorez vos marges bénéficiaires et vous vivez avec la crainte de faire des erreurs menant à des vérifications et pénalités gouvernementales.

Saviez-vous que de nombreuses entreprises échouent à cause d'une mauvaise gestion financière?

Ce n'est pas juste une question de chiffres — c'est le stress, l'inquiétude et l'incertitude sur la situation financière réelle de votre entreprise.

Imaginez un propriétaire comme vous : une belle opération, mais toujours en retard sur sa comptabilité. Des échéances fiscales manquées, des marges inconnues. Un stress constant.

Vous pensez peut-être qu'engager un comptable à temps plein est la solution. Mais c'est coûteux et pas toujours adapté aux PME.

Il semble parfois qu'il n'y ait pas de bonne solution. Comme si vous étiez pris dans un cycle de confusion financière.

Mais ce n'est pas le cas.

Voici la Fondation à 3 Piliers — un système conçu pour les petites entreprises.

Il vous offre de la visibilité, assure votre conformité et vous remet aux commandes de vos finances. Et le meilleur? C'est fait pour vous.

Avec notre système, vous pouvez :
- Maintenir des livres propres et organisés
- Respecter chaque échéance
- Savoir exactement où se situe votre entreprise financièrement
- Être soutenu par une équipe de CPA de confiance

Réservez dès maintenant une consultation stratégique gratuite de 30 minutes — sans engagement.

👉 zentax.pro/funnel-2

Si ce n'est pas pour vous, pas de problème. Mais si vous ne faites rien, la confusion financière continue.

Votre entreprise le mérite. Agissez maintenant.

👉 zentax.pro/funnel-2`,
  link_url: 'https://zentax.pro/funnel-2',
  campaign_name: 'Zentax - Trafic QC FR',
  adset_name: 'Entrepreneurs QC FR - Trafic',
}

// 2. Retargeting (warm — website visitors)
const COPY_RETARGET = {
  headline: 'Encore là? Votre consultation gratuite vous attend.',
  body: `Vous avez visité zentax.pro récemment.

Si vous avez hésité, c'est correct. Mais la confusion financière ne se règle pas toute seule.

Des livres en retard. Des échéances fiscales qui approchent. Des marges que vous n'arrivez pas à calculer.

Nos CPA ont déjà aidé des dizaines de PME québécoises à reprendre le contrôle — rapidement, sans casse-tête.

Réservez votre consultation stratégique gratuite de 30 minutes. Sans engagement. Sans pression.

👉 zentax.pro/funnel-2`,
  link_url: 'https://zentax.pro/funnel-2',
  campaign_name: 'Zentax - Retargeting QC FR',
  adset_name: 'Visiteurs Web QC FR - Retargeting',
}

// 3. Full Funnel (conversion-focused, broader targeting)
const COPY_FUNNEL = {
  headline: '30 minutes avec un CPA peut changer votre entreprise',
  body: `Vous gérez une PME au Québec?

Si vos livres ne sont pas à jour, si vous ignorez vos marges réelles, si les échéances fiscales vous stressent — vous n'êtes pas seul.

La plupart des PME perdent des milliers de dollars chaque année à cause d'une mauvaise gestion comptable. Ce n'est pas de la négligence — c'est un manque de système.

Zentax offre la Fondation à 3 Piliers : un système simple et complet, conçu pour les entrepreneurs comme vous.

✅ Livres propres et à jour
✅ Conformité garantie
✅ Visibilité totale sur vos finances
✅ Équipe de CPA dédiée

Consultez un expert gratuitement. 30 minutes. Zéro engagement.

👉 zentax.pro/funnel-2

Agissez avant que les délais fiscaux ne vous rattrapent.`,
  link_url: 'https://zentax.pro/funnel-2',
  campaign_name: 'Zentax - Funnel Complet QC FR',
  adset_name: 'Entrepreneurs QC FR - Funnel',
}

// ─── Targeting ────────────────────────────────────────────────────────────────

const BASE_GEO = { geo_locations: { regions: [{ key: '3870' }] }, locales: [12], age_min: 25, age_max: 65 }

// Cold audience
const TARGETING_TRAFFIC = { ...BASE_GEO }

// Website visitors custom audience (ID passed via CLI)
function targetingRetarget(audienceId) {
  return { ...BASE_GEO, custom_audiences: [{ id: audienceId }] }
}

// Full funnel — broadest, let Meta optimize (Advantage+ style)
const TARGETING_FUNNEL = { ...BASE_GEO, age_min: 24, age_max: 66 }

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

function findThumbnail(videoPath) {
  const base = videoPath.replace(/\.(mp4|mov)$/i, '')
  for (const ext of ['.jpg', '.jpeg', '.png']) {
    if (fs.existsSync(base + ext)) return base + ext
    if (fs.existsSync(base + ext.toUpperCase())) return base + ext.toUpperCase()
  }
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

function getCreatives(dir) {
  if (!fs.existsSync(dir)) throw new Error(`Directory not found: ${dir}`)
  return fs.readdirSync(dir)
    .filter(f => /\.(jpe?g|png|mp4|mov)$/i.test(f))
    .map(f => path.join(dir, f))
    .sort()
}

// ─── Run one campaign ──────────────────────────────────────────────────────────

async function runCampaign({ copy, targeting, objective, optimizationGoal = 'LANDING_PAGE_VIEWS', creatives, status, dailyBudgetCents, label }) {
  const ADS_PER_ADSET = 50
  const chunks = []
  for (let i = 0; i < creatives.length; i += ADS_PER_ADSET) chunks.push(creatives.slice(i, i + ADS_PER_ADSET))
  const totalAdsets = chunks.length

  log(`\n${'─'.repeat(51)}`)
  log(`  ${label}`)
  log(`${'─'.repeat(51)}`)

  const campaign = await api('POST', `/act_${ACCOUNT_ID}/campaigns`, {
    name: copy.campaign_name,
    objective,
    status,
    special_ad_categories: '[]',
    is_adset_budget_sharing_enabled: false,
  })
  log(`  ✓ Campaign: ${campaign.id}  "${copy.campaign_name}"`)

  const adsetIds = []
  const adResults = []

  for (let chunkIdx = 0; chunkIdx < chunks.length; chunkIdx++) {
    const chunk = chunks[chunkIdx]
    const adsetName = totalAdsets > 1
      ? `${copy.adset_name} - Part ${chunkIdx + 1}`
      : copy.adset_name

    const adset = await api('POST', `/act_${ACCOUNT_ID}/adsets`, {
      name: adsetName,
      campaign_id: campaign.id,
      billing_event: 'IMPRESSIONS',
      optimization_goal: optimizationGoal,
      daily_budget: dailyBudgetCents,
      bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
      targeting,
      status,
    })
    log(`  ✓ Ad Set:  ${adset.id}  "${adsetName}"`)
    adsetIds.push(adset.id)

    for (let j = 0; j < chunk.length; j++) {
      const filePath = chunk[j]
      const globalIdx = chunkIdx * ADS_PER_ADSET + j + 1
      const adLabel = `${copy.campaign_name} - Creative ${globalIdx}`
      const fileType = isVideo(filePath) ? 'video' : 'image'
      log(`\n    [${globalIdx}/${creatives.length}] ${path.basename(filePath)} (${fileType})`)

      let storySpec
      if (isVideo(filePath)) {
        const thumbPath = findThumbnail(filePath)
        if (!thumbPath) {
          throw new Error(
            `No thumbnail found for ${path.basename(filePath)}.\n` +
            `  Create: ${path.basename(filePath).replace(/\.(mp4|mov)$/i, '')}.jpg`
          )
        }
        const videoId = await uploadVideo(filePath)
        log(`      ✓ video_id  : ${videoId}`)
        const thumbHash = await uploadImage(thumbPath)
        log(`      ✓ thumbnail : ${thumbHash} (${path.basename(thumbPath)})`)
        storySpec = {
          page_id: PAGE_ID,
          video_data: {
            video_id: videoId,
            image_hash: thumbHash,
            message: copy.body,
            title: copy.headline,
            call_to_action: { type: 'LEARN_MORE', value: { link: copy.link_url } },
          },
        }
      } else {
        const imageHash = await uploadImage(filePath)
        log(`      ✓ image_hash: ${imageHash}`)
        storySpec = {
          page_id: PAGE_ID,
          link_data: {
            image_hash: imageHash,
            link: copy.link_url,
            message: copy.body,
            name: copy.headline,
            call_to_action: { type: 'LEARN_MORE', value: { link: copy.link_url } },
          },
        }
      }

      const creative = await api('POST', `/act_${ACCOUNT_ID}/adcreatives`, {
        name: `${adLabel} Creative`,
        object_story_spec: storySpec,
      })
      log(`      ✓ creative  : ${creative.id}`)

      const ad = await api('POST', `/act_${ACCOUNT_ID}/ads`, {
        name: adLabel,
        adset_id: adset.id,
        creative: { creative_id: creative.id },
        status,
      })
      log(`      ✓ ad        : ${ad.id}`)

      adResults.push({ file: path.basename(filePath), type: fileType, adset_id: adset.id, creative_id: creative.id, ad_id: ad.id })
    }
  }

  return { campaign, adsetIds, adResults }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!TOKEN && !DRY_RUN) {
    console.error('Error: META_ACCESS_TOKEN is not set.\n  $env:META_ACCESS_TOKEN = "your_token"')
    process.exit(1)
  }

  const frDir = args['fr-dir']
  if (!frDir) {
    console.error('Error: --fr-dir is required.\n  --fr-dir "C:\\Users\\takie\\Downloads\\Creatives"')
    process.exit(1)
  }

  const creatives = getCreatives(frDir)
  if (creatives.length === 0) {
    console.error(`No .jpg/.jpeg/.png/.mp4/.mov files found in: ${frDir}`)
    process.exit(1)
  }

  const retargetDir = args['retarget-dir'] || frDir
  const retargetCreatives = getCreatives(retargetDir)
  if (retargetCreatives.length === 0) {
    console.error(`No .jpg/.jpeg/.png/.mp4/.mov files found in retarget-dir: ${retargetDir}`)
    process.exit(1)
  }

  const dailyBudget = parseFloat(args['daily-budget'] || '100')
  const dailyBudgetCents = Math.round(dailyBudget * 100)
  const status = args.status || 'PAUSED'
  const retargetAudienceId = args['retarget-audience-id']
  const skipTraffic  = !!args['skip-traffic']
  const skipRetarget = !!args['skip-retarget']
  const skipFunnel   = !!args['skip-funnel']

  const imgCount = creatives.filter(f => !isVideo(f)).length
  const vidCount = creatives.filter(f => isVideo(f)).length
  const rImgCount = retargetCreatives.filter(f => !isVideo(f)).length
  const rVidCount = retargetCreatives.filter(f => isVideo(f)).length
  const planned = [
    !skipTraffic  && 'Traffic',
    !skipRetarget && retargetAudienceId && 'Retargeting',
    !skipFunnel   && 'Full Funnel',
  ].filter(Boolean)

  log(`\n${'═'.repeat(51)}`)
  log(`  Zentax Campaign Launcher${DRY_RUN ? ' [DRY RUN]' : ''}`)
  log(`${'═'.repeat(51)}`)
  log(`  Account    : act_${ACCOUNT_ID}`)
  log(`  Budget     : $${dailyBudget} CAD/day per ad set`)
  log(`  Status     : ${status}`)
  log(`  Traffic/Funnel creatives : ${creatives.length} (${imgCount} img, ${vidCount} vid) — ${frDir}`)
  log(`  Retargeting creatives    : ${retargetCreatives.length} (${rImgCount} img, ${rVidCount} vid) — ${retargetDir}`)
  log(`  Campaigns  : ${planned.join(' + ') || '(none selected)'}`)
  log(`${'═'.repeat(51)}`)

  const allResults = []
  let step = 1
  const total = planned.length

  // ── 1. Traffic (cold) ──
  if (!skipTraffic) {
    const traffic = await runCampaign({
      label: `${step++}/${total}  TRAFFIC — Cold Quebec/French audience`,
      copy: COPY_TRAFFIC,
      targeting: TARGETING_TRAFFIC,
      objective: 'OUTCOME_TRAFFIC',
      creatives,
      status,
      dailyBudgetCents,
    })
    allResults.push({ name: 'Traffic', ...traffic })
  } else {
    log(`\n  ↷  Skipping Traffic campaign (--skip-traffic)`)
  }

  // ── 2. Retargeting ──
  if (!skipRetarget) {
    if (retargetAudienceId) {
      const retarget = await runCampaign({
        label: `${step++}/${total}  RETARGETING — Website visitors`,
        copy: COPY_RETARGET,
        targeting: targetingRetarget(retargetAudienceId),
        objective: 'OUTCOME_LEADS',
        optimizationGoal: 'QUALITY_LEAD',
        creatives: retargetCreatives,
        status,
        dailyBudgetCents,
      })
      allResults.push({ name: 'Retargeting', ...retarget })
    } else {
      log(`\n  ⚠  Skipping Retargeting — pass --retarget-audience-id <id> to enable it.`)
    }
  } else {
    log(`\n  ↷  Skipping Retargeting campaign (--skip-retarget)`)
  }

  // ── 3. Full Funnel ──
  if (!skipFunnel) {
    const funnel = await runCampaign({
      label: `${step++}/${total}  FULL FUNNEL — Conversion-focused, broader targeting`,
      copy: COPY_FUNNEL,
      targeting: TARGETING_FUNNEL,
      objective: 'OUTCOME_LEADS',
      optimizationGoal: 'QUALITY_LEAD',
      creatives,
      status,
      dailyBudgetCents,
    })
    allResults.push({ name: 'Full Funnel', ...funnel })
  } else {
    log(`\n  ↷  Skipping Full Funnel campaign (--skip-funnel)`)
  }

  // ── Summary ──
  log(`\n${'═'.repeat(51)}`)
  log(`  All done!`)
  log(`${'═'.repeat(51)}`)
  for (const r of allResults) {
    log(`\n  [${r.name}] Campaign ID: ${r.campaign.id}`)
    log(`    Ad sets (${r.adsetIds.length}): ${r.adsetIds.join(', ')}`)
    log(`    Ads created: ${r.adResults.length}`)
  }
  log(`\n  All ads are ${status}. Review in Meta Ads Manager,`)
  log(`  then activate when ready.`)
  log(`  https://adsmanager.facebook.com/`)
  log(`${'═'.repeat(51)}\n`)
}

async function findTargeting() {
  if (!TOKEN) {
    console.error('Error: META_ACCESS_TOKEN is not set.')
    process.exit(1)
  }
  console.log('\n Looking up correct targeting keys from Meta API...\n')

  // Quebec region key
  const geoUrl = `${BASE_URL}/search?type=adgeolocation&q=Quebec&location_types=%5B%22region%22%5D&country_code=CA&access_token=${TOKEN}`
  const geoRes = await fetch(geoUrl)
  const geoData = await geoRes.json()
  console.log('=== Quebec region results ===')
  if (geoData.data && geoData.data.length > 0) {
    geoData.data.forEach(r => console.log(`  key: "${r.key}"  name: "${r.name}"  country: "${r.country_code || r.country}"`))
  } else {
    console.log('  No results or error:', JSON.stringify(geoData))
  }

  // French locale ID
  const localeUrl = `${BASE_URL}/search?type=adlocale&q=French&access_token=${TOKEN}`
  const localeRes = await fetch(localeUrl)
  const localeData = await localeRes.json()
  console.log('\n=== French locale results ===')
  if (localeData.data && localeData.data.length > 0) {
    localeData.data.forEach(r => console.log(`  key: ${r.key}  name: "${r.name}"`))
  } else {
    console.log('  No results or error:', JSON.stringify(localeData))
  }
  console.log('\nUpdate TARGETING_FR in the script with the correct key values above.\n')
}

if (args['find-targeting']) {
  findTargeting().catch(err => { console.error(err.message); process.exit(1) })
} else {
  main().catch(err => {
    console.error('\nFatal error:', err.message)
    process.exit(1)
  })
}
