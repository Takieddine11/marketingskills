#!/usr/bin/env node
/**
 * Zentax Campaign Launcher
 * Creates two Meta Ads campaigns:
 *   - French (Quebec): zentax.pro/funnel-2
 *   - English (Canada): zentax.pro/en/funnel-2
 *
 * Usage:
 *   export META_ACCESS_TOKEN=your_token
 *   export META_AD_ACCOUNT_ID=2189765574795573   # without "act_" prefix
 *
 *   # Dry run (no API calls):
 *   node zentax-campaign-launch.js --dry-run
 *
 *   # Launch both campaigns (images uploaded from local files):
 *   node zentax-campaign-launch.js \
 *     --fr-image ./creative-fr.jpg \
 *     --en-image ./creative-en.jpg \
 *     --daily-budget 100 \
 *     --status PAUSED
 *
 *   # Launch only one language:
 *   node zentax-campaign-launch.js --lang fr --fr-image ./creative-fr.jpg
 *
 * Options:
 *   --fr-image <path>       Local path to French creative image
 *   --en-image <path>       Local path to English creative image
 *   --lang <fr|en|both>     Which campaign to create (default: both)
 *   --daily-budget <num>    Daily budget in CAD (default: 100)
 *   --status <status>       PAUSED or ACTIVE (default: PAUSED)
 *   --dry-run               Preview API calls without sending
 */

const fs = require('fs')
const path = require('path')

const TOKEN = process.env.META_ACCESS_TOKEN
const RAW_ACCOUNT_ID = process.env.META_AD_ACCOUNT_ID || ''
const ACCOUNT_ID = RAW_ACCOUNT_ID.replace(/^act_/, '')
const BASE_URL = 'https://graph.facebook.com/v18.0'

// ─── Ad Copy ─────────────────────────────────────────────────────────────────

const COPY = {
  fr: {
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
    ad_name: 'Zentax - 3 Piliers FR',
  },
  en: {
    headline: "Wouldn't You Just Love To Gain 10 Hours Back Per Month?",
    body: `If you're an entrepreneur or small business owner, you might be facing a problem.

Your books are messy, and you're spending too much time trying to manage them.

You might be missing filing deadlines, unsure of your profit margins, and living with the fear of making mistakes that could lead to government audits and penalties.

Did you know that many businesses struggle because of poor financial management?

It's not just about numbers — it's about the stress, the worry, and not knowing where your business stands financially.

Consider a business owner like you. They run a successful operation, but they're always behind on their bookkeeping. They miss tax deadlines and are unsure of their profit margins. It's a constant source of stress.

You might think hiring a full-time accountant is the answer. But that's a costly option and not always the best fit for small businesses.

It might seem like there's no good solution. Like you're stuck in a cycle of financial confusion.

But that's not the case.

Introducing the 3-Pillar Foundation — a system designed for small businesses.

It provides visibility, ensures compliance, and puts you in control of your finances. And the best part? It's done-for-you.

With our system, you can:
- Maintain clean, organized books
- Meet every deadline
- Understand exactly where your business stands financially
- Feel supported by a CPA team you can trust

Book a free 30-minute strategy consultation right now — no strings attached.

👉 zentax.pro/en/funnel-2

If it's not a fit, that's okay. But if you do nothing, the financial confusion continues.

Your business deserves it. Take action now.

👉 zentax.pro/en/funnel-2`,
    link_url: 'https://zentax.pro/en/funnel-2',
    campaign_name: 'Zentax - Traffic CA EN',
    adset_name: 'Entrepreneurs CA EN - Traffic',
    ad_name: 'Zentax - 3 Pillars EN',
  },
}

// ─── Targeting ────────────────────────────────────────────────────────────────

const TARGETING = {
  fr: {
    geo_locations: {
      regions: [{ key: '3870' }], // Quebec
    },
    locales: [12], // French
    age_min: 25,
    age_max: 65,
  },
  en: {
    geo_locations: {
      countries: ['CA'],
    },
    locales: [6], // English
    age_min: 25,
    age_max: 65,
  },
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

async function api(method, endpoint, body) {
  const url = `${BASE_URL}${endpoint}`
  if (DRY_RUN) {
    console.log(`[DRY-RUN] ${method} ${url}`)
    if (body) console.log('  body:', JSON.stringify(body, null, 4))
    return { id: `DRY_RUN_ID_${Math.random().toString(36).slice(2, 8)}` }
  }
  const opts = {
    method,
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  }
  const res = await fetch(url, opts)
  const data = await res.json()
  if (data.error) throw new Error(`Meta API error: ${JSON.stringify(data.error)}`)
  return data
}

async function uploadImage(imagePath) {
  if (DRY_RUN) {
    console.log(`[DRY-RUN] Upload image: ${imagePath}`)
    return `DRY_RUN_IMAGE_HASH_${Math.random().toString(36).slice(2, 8)}`
  }
  const { FormData, Blob } = await import('node:buffer').catch(() => {
    throw new Error('Node 18+ required for FormData')
  })

  const imageBuffer = fs.readFileSync(imagePath)
  const form = new FormData()
  form.append('access_token', TOKEN)
  form.append('filename', new Blob([imageBuffer]), path.basename(imagePath))

  const res = await fetch(`${BASE_URL}/act_${ACCOUNT_ID}/adimages`, {
    method: 'POST',
    body: form,
  })
  const data = await res.json()
  if (data.error) throw new Error(`Image upload error: ${JSON.stringify(data.error)}`)

  const images = data.images
  const key = Object.keys(images)[0]
  return images[key].hash
}

function log(msg) {
  console.log(msg)
}

// ─── Campaign Builder ─────────────────────────────────────────────────────────

async function buildCampaign(lang, imagePath, dailyBudgetCAD, status) {
  const copy = COPY[lang]
  const targeting = TARGETING[lang]
  const dailyBudgetCents = Math.round(dailyBudgetCAD * 100)

  log(`\n──────────────────────────────────────`)
  log(`Building ${lang.toUpperCase()} campaign: ${copy.campaign_name}`)
  log(`──────────────────────────────────────`)

  // 1. Create Campaign
  log('1/5 Creating campaign...')
  const campaign = await api('POST', `/act_${ACCOUNT_ID}/campaigns`, {
    name: copy.campaign_name,
    objective: 'LINK_CLICKS',
    status,
    special_ad_categories: [],
  })
  log(`    ✓ Campaign ID: ${campaign.id}`)

  // 2. Create Ad Set
  log('2/5 Creating ad set...')
  const adset = await api('POST', `/act_${ACCOUNT_ID}/adsets`, {
    name: copy.adset_name,
    campaign_id: campaign.id,
    billing_event: 'IMPRESSIONS',
    optimization_goal: 'LINK_CLICKS',
    daily_budget: dailyBudgetCents,
    bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
    targeting,
    status,
  })
  log(`    ✓ Ad Set ID: ${adset.id}`)

  // 3. Upload Image
  log('3/5 Uploading image...')
  let imageHash
  if (imagePath) {
    imageHash = await uploadImage(imagePath)
    log(`    ✓ Image hash: ${imageHash}`)
  } else {
    log('    ⚠ No image provided — skipping image upload. Creative will fail without an image.')
    imageHash = null
  }

  // 4. Create Ad Creative
  log('4/5 Creating ad creative...')
  const creative = await api('POST', `/act_${ACCOUNT_ID}/adcreatives`, {
    name: `${copy.ad_name} Creative`,
    object_story_spec: {
      page_id: args['page-id'] || process.env.META_PAGE_ID || '676813882182100',
      link_data: {
        image_hash: imageHash,
        link: copy.link_url,
        message: copy.body,
        name: copy.headline,
        call_to_action: {
          type: 'LEARN_MORE',
          value: { link: copy.link_url },
        },
      },
    },
  })
  log(`    ✓ Creative ID: ${creative.id}`)

  // 5. Create Ad
  log('5/5 Creating ad...')
  const ad = await api('POST', `/act_${ACCOUNT_ID}/ads`, {
    name: copy.ad_name,
    adset_id: adset.id,
    creative: { creative_id: creative.id },
    status,
  })
  log(`    ✓ Ad ID: ${ad.id}`)

  return { campaign_id: campaign.id, adset_id: adset.id, creative_id: creative.id, ad_id: ad.id }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!TOKEN && !DRY_RUN) {
    console.error('Error: META_ACCESS_TOKEN environment variable is required.')
    console.error('  export META_ACCESS_TOKEN=your_token')
    process.exit(1)
  }
  if (!ACCOUNT_ID && !DRY_RUN) {
    console.error('Error: META_AD_ACCOUNT_ID environment variable is required.')
    console.error('  export META_AD_ACCOUNT_ID=2189765574795573')
    process.exit(1)
  }

  const lang = args.lang || 'both'
  const dailyBudget = parseFloat(args['daily-budget'] || '100')
  const status = args.status || 'PAUSED'
  const frImage = args['fr-image'] || null
  const enImage = args['en-image'] || null

  if (lang !== 'both' && lang !== 'fr' && lang !== 'en') {
    console.error('Error: --lang must be fr, en, or both')
    process.exit(1)
  }

  log(`\n═══════════════════════════════════════════`)
  log(`  Zentax Campaign Launcher${DRY_RUN ? ' [DRY RUN]' : ''}`)
  log(`═══════════════════════════════════════════`)
  log(`  Account ID : act_${ACCOUNT_ID}`)
  log(`  Budget     : $${dailyBudget} CAD/day per campaign`)
  log(`  Status     : ${status}`)
  log(`  Language   : ${lang}`)
  log(`  FR image   : ${frImage || '(none)'}`)
  log(`  EN image   : ${enImage || '(none)'}`)
  log(`═══════════════════════════════════════════`)

  const results = {}

  if (lang === 'fr' || lang === 'both') {
    results.fr = await buildCampaign('fr', frImage, dailyBudget, status)
  }
  if (lang === 'en' || lang === 'both') {
    results.en = await buildCampaign('en', enImage, dailyBudget, status)
  }

  log('\n═══════════════════════════════════════════')
  log('  Summary')
  log('═══════════════════════════════════════════')
  for (const [l, ids] of Object.entries(results)) {
    log(`\n  [${l.toUpperCase()}]`)
    for (const [k, v] of Object.entries(ids)) {
      log(`    ${k.padEnd(14)}: ${v}`)
    }
  }
  log('\n  Campaigns created in PAUSED status.')
  log('  Review in Meta Ads Manager before activating.')
  log('═══════════════════════════════════════════\n')
}

main().catch(err => {
  console.error('\nFatal error:', err.message)
  process.exit(1)
})
