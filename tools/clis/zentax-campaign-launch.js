#!/usr/bin/env node
/**
 * Zentax Campaign Launcher
 * Creates a French (Quebec) Meta Ads campaign with one ad per creative image.
 * Meta automatically optimizes toward the best-performing creative.
 *
 * Usage (PowerShell):
 *   $env:META_ACCESS_TOKEN = "your_token"
 *   $env:META_AD_ACCOUNT_ID = "2189765574795573"
 *
 *   # Dry run — safe preview, no API calls:
 *   node zentax-campaign-launch.js --dry-run --fr-dir "C:\Users\takie\Downloads\Creatives"
 *
 *   # Launch for real (starts PAUSED for review):
 *   node zentax-campaign-launch.js --fr-dir "C:\Users\takie\Downloads\Creatives" --daily-budget 100
 *
 * Options:
 *   --fr-dir <path>         Folder of French creative images (all .jpg/.jpeg/.png)
 *   --daily-budget <num>    Daily budget in CAD for the ad set (default: 100)
 *   --status <status>       PAUSED or ACTIVE (default: PAUSED)
 *   --dry-run               Preview all API calls without sending anything
 */

const fs = require('fs')
const path = require('path')

const TOKEN = process.env.META_ACCESS_TOKEN
const RAW_ACCOUNT_ID = process.env.META_AD_ACCOUNT_ID || ''
const ACCOUNT_ID = RAW_ACCOUNT_ID.replace(/^act_/, '')
const BASE_URL = 'https://graph.facebook.com/v18.0'
const PAGE_ID = '676813882182100'

// ─── Ad Copy (French) ─────────────────────────────────────────────────────────

const COPY_FR = {
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

// ─── Targeting (Quebec, French speakers, entrepreneurs age 25-65) ─────────────

const TARGETING_FR = {
  geo_locations: {
    regions: [{ key: '3870' }], // Quebec
  },
  locales: [12], // French
  age_min: 25,
  age_max: 65,
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

async function uploadImage(imagePath) {
  const filename = path.basename(imagePath)
  if (DRY_RUN) {
    log(`[DRY-RUN] Upload image: ${filename}`)
    return `DRY_HASH_${Math.random().toString(36).slice(2, 10).toUpperCase()}`
  }
  const imageBuffer = fs.readFileSync(imagePath)
  const boundary = `----FormBoundary${Math.random().toString(36).slice(2)}`
  const CRLF = '\r\n'

  // Build multipart body manually (no external deps)
  const headerPart = Buffer.from(
    `--${boundary}${CRLF}` +
    `Content-Disposition: form-data; name="access_token"${CRLF}${CRLF}` +
    `${TOKEN}${CRLF}` +
    `--${boundary}${CRLF}` +
    `Content-Disposition: form-data; name="filename"; filename="${filename}"${CRLF}` +
    `Content-Type: image/jpeg${CRLF}${CRLF}`
  )
  const footerPart = Buffer.from(`${CRLF}--${boundary}--${CRLF}`)
  const body = Buffer.concat([headerPart, imageBuffer, footerPart])

  const res = await fetch(`${BASE_URL}/act_${ACCOUNT_ID}/adimages`, {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': body.length,
    },
    body,
  })
  const data = await res.json()
  if (data.error) throw new Error(`Image upload (${filename}): ${data.error.message}`)
  const key = Object.keys(data.images)[0]
  return data.images[key].hash
}

function getImages(dir) {
  if (!fs.existsSync(dir)) throw new Error(`Directory not found: ${dir}`)
  return fs.readdirSync(dir)
    .filter(f => /\.(jpe?g|png)$/i.test(f))
    .map(f => path.join(dir, f))
    .sort()
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!TOKEN && !DRY_RUN) {
    console.error('Error: META_ACCESS_TOKEN is not set.\n  $env:META_ACCESS_TOKEN = "your_token"')
    process.exit(1)
  }
  if (!ACCOUNT_ID && !DRY_RUN) {
    console.error('Error: META_AD_ACCOUNT_ID is not set.\n  $env:META_AD_ACCOUNT_ID = "2189765574795573"')
    process.exit(1)
  }

  const frDir = args['fr-dir']
  if (!frDir) {
    console.error('Error: --fr-dir is required.\n  --fr-dir "C:\\Users\\takie\\Downloads\\Creatives"')
    process.exit(1)
  }

  const images = getImages(frDir)
  if (images.length === 0) {
    console.error(`No .jpg/.jpeg/.png files found in: ${frDir}`)
    process.exit(1)
  }

  const dailyBudget = parseFloat(args['daily-budget'] || '100')
  const dailyBudgetCents = Math.round(dailyBudget * 100)
  const status = args.status || 'PAUSED'

  log(`\n═══════════════════════════════════════════════════`)
  log(`  Zentax Campaign Launcher${DRY_RUN ? ' [DRY RUN]' : ''}`)
  log(`═══════════════════════════════════════════════════`)
  log(`  Account    : act_${ACCOUNT_ID}`)
  log(`  Campaign   : ${COPY_FR.campaign_name}`)
  log(`  Budget     : $${dailyBudget} CAD/day`)
  log(`  Status     : ${status}`)
  log(`  Creatives  : ${images.length} images`)
  images.forEach((img, i) => log(`    [${i + 1}] ${path.basename(img)}`))
  log(`═══════════════════════════════════════════════════`)

  // Step 1: Create Campaign
  log('\n[1/3] Creating campaign...')
  const campaign = await api('POST', `/act_${ACCOUNT_ID}/campaigns`, {
    name: COPY_FR.campaign_name,
    objective: 'OUTCOME_TRAFFIC',
    status,
  })
  log(`  ✓ Campaign ID: ${campaign.id}`)

  // Step 2: Create Ad Set
  log('\n[2/3] Creating ad set...')
  const adset = await api('POST', `/act_${ACCOUNT_ID}/adsets`, {
    name: COPY_FR.adset_name,
    campaign_id: campaign.id,
    billing_event: 'IMPRESSIONS',
    optimization_goal: 'LANDING_PAGE_VIEWS',
    daily_budget: dailyBudgetCents,
    bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
    targeting: TARGETING_FR,
    status,
  })
  log(`  ✓ Ad Set ID: ${adset.id}`)

  // Step 3: Upload image + create creative + create ad — once per image
  log(`\n[3/3] Creating ${images.length} ads (one per creative)...`)
  const adResults = []

  for (let i = 0; i < images.length; i++) {
    const imgPath = images[i]
    const imgName = path.basename(imgPath, path.extname(imgPath))
    const adLabel = `Zentax FR - Creative ${i + 1}`
    log(`\n  [${i + 1}/${images.length}] ${path.basename(imgPath)}`)

    // Upload image
    const imageHash = await uploadImage(imgPath)
    log(`    ✓ Uploaded  → hash: ${imageHash}`)

    // Create creative
    const creative = await api('POST', `/act_${ACCOUNT_ID}/adcreatives`, {
      name: `${adLabel} Creative`,
      object_story_spec: {
        page_id: PAGE_ID,
        link_data: {
          image_hash: imageHash,
          link: COPY_FR.link_url,
          message: COPY_FR.body,
          name: COPY_FR.headline,
          call_to_action: {
            type: 'LEARN_MORE',
            value: { link: COPY_FR.link_url },
          },
        },
      },
    })
    log(`    ✓ Creative  → ID: ${creative.id}`)

    // Create ad
    const ad = await api('POST', `/act_${ACCOUNT_ID}/ads`, {
      name: adLabel,
      adset_id: adset.id,
      creative: { creative_id: creative.id },
      status,
    })
    log(`    ✓ Ad        → ID: ${ad.id}`)

    adResults.push({ image: path.basename(imgPath), creative_id: creative.id, ad_id: ad.id })
  }

  // Summary
  log(`\n═══════════════════════════════════════════════════`)
  log(`  Done!`)
  log(`═══════════════════════════════════════════════════`)
  log(`  Campaign ID : ${campaign.id}`)
  log(`  Ad Set ID   : ${adset.id}`)
  log(`  Ads created : ${adResults.length}`)
  adResults.forEach((r, i) => {
    log(`\n  [Ad ${i + 1}] ${r.image}`)
    log(`    creative_id : ${r.creative_id}`)
    log(`    ad_id       : ${r.ad_id}`)
  })
  log(`\n  All ads are PAUSED. Review in Meta Ads Manager,`)
  log(`  then activate the ad set when ready.`)
  log(`  https://adsmanager.facebook.com/`)
  log(`═══════════════════════════════════════════════════\n`)
}

main().catch(err => {
  console.error('\nFatal error:', err.message)
  process.exit(1)
})
