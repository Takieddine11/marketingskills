#!/usr/bin/env node
/**
 * Zentax Campaign Launcher
 * Launches the full ACQUISITION + RETARGETING campaign structure for Zentax.
 * All campaign copy, budgets, targeting, and IDs are embedded.
 * The retargeting audience is auto-discovered from Meta's API.
 *
 * Usage (PowerShell):
 *   $env:META_ACCESS_TOKEN  = Get-Content "$env:USERPROFILE\meta_token.txt"
 *   $env:META_AD_ACCOUNT_ID = "2189765574795573"
 *
 *   # Dry run — safe preview, no API calls:
 *   node zentax-campaign-launch.js --fr-dir "C:\Users\takie\Downloads\Creatives" --dry-run
 *
 *   # Launch for real:
 *   node zentax-campaign-launch.js --fr-dir "C:\Users\takie\Downloads\Creatives"
 *
 * Options:
 *   --fr-dir <path>               Folder containing all creative files (required)
 *   --retarget-audience-id <id>   Override retargeting audience (auto-detected if omitted)
 *   --status <status>             PAUSED or ACTIVE (default: PAUSED)
 *   --rewarded-video <path>       9:16 video for Audience Network rewarded video placement
 *   --dry-run                     Preview all API calls without sending anything
 *   --find-targeting              Query Meta API for Quebec region key + French locale ID
 *   --list-audiences              List all custom audiences on the account
 */

'use strict'
const fs   = require('fs')
const path = require('path')

// ─── Zentax Account Constants ─────────────────────────────────────────────────

const TOKEN        = process.env.META_ACCESS_TOKEN
const ACCOUNT_ID   = (process.env.META_AD_ACCOUNT_ID || '2189765574795573').replace(/^act_/, '')
const BASE_URL     = 'https://graph.facebook.com/v18.0'
const PAGE_ID      = '676813882182100'
const IG_ACTOR_ID  = '9623717551054024'
const PIXEL_ID     = '1173962951224451'   // Zentax Cabinet Comptable
const RTG_AUDIENCE = '120242292904720693' // WCA-30D + Video Viewers 75%

// ─── Embedded Campaign Config ─────────────────────────────────────────────────

const CAMPAIGN_CONFIG = {
  destination_url: 'https://www.zentax.pro/funnel-2',
  campaigns: {
    ACQUISITION: {
      campaign_name: 'ZTX | ACQ | QC-FR | 2026-03-10',
      objective: 'LEAD_GENERATION',
      budget_daily: 120,
      ad_sets: [
        {
          ad_set_name: 'ZTX | ACQ | STATIC | BROAD-QC-FR',
          budget_daily: 60,
          ads: [
            {
              filename: 'ZTX_ACQ_FEAR_2h30-penalite.png',
              ad_name: 'ZTX | FEAR | IMG | 2h30-penalite',
              angle: 'FEAR',
              format: 'IMAGE',
              primary_text: 'Il est 2h30 du matin. Vous venez de recevoir un avis de pénalité du Revenu Québec.\n\nVotre comptable ne vous a pas prévenu. Les échéances sont passées. Les frais s\'accumulent.\n\nChez Zentax, votre équipe CPA surveille TOUTES vos échéances gouvernementales chaque mois — TPS/TVQ, impôt corporatif, Revenu Québec, ARC. Jamais en retard. Jamais de surprise.\n\nRéservez votre diagnostic comptable gratuit. Premier mois remboursé si vous n\'êtes pas satisfait.',
              headline: 'Zéro pénalité. Zéro surprise en avril.',
              description: 'Solution comptable complète à partir de 292$/mois.',
              cta_button: 'LEARN_MORE',
            },
            {
              filename: 'ZTX_ACQ_FEAR_comptable-en-retard.png',
              ad_name: 'ZTX | FEAR | IMG | comptable-en-retard',
              angle: 'FEAR',
              format: 'IMAGE',
              primary_text: 'Votre comptable est encore en retard. Les pénalités, elles, n\'attendent pas.\n\nChaque mois sans suivi comptable, c\'est des déductions manquées, des échéances oubliées et des surprises en avril que vous n\'aviez pas planifiées.\n\nZentax gère votre comptabilité complète chaque mois. TPS/TVQ. Tenue de livres. Impôt corporatif. QuickBooks inclus. Pour 292$/mois.\n\nRéservez votre diagnostic comptable gratuit.',
              headline: 'Votre comptable en retard vous coûte cher.',
              description: 'Comptabilité mensuelle complète. 292$/mois.',
              cta_button: 'LEARN_MORE',
            },
            {
              filename: 'ZTX_ACQ_PRICE_stamp-292-tout-inclus.jpeg',
              ad_name: 'ZTX | PRICE | IMG | stamp-292',
              angle: 'PRICE',
              format: 'IMAGE',
              primary_text: 'Trop cher. Trop compliqué. Trop de tracas.\n\nC\'est ce que la majorité des entrepreneurs québécois ressentent avec leur comptabilité.\n\nZentax change ça. Tout inclus pour 292$/mois : tenue de livres mensuelle, TPS/TVQ, impôt corporatif, QuickBooks gratuit, rapports financiers et accès direct à votre CPA.\n\nZéro stress. Zéro surprise. Premier mois remboursé si vous n\'êtes pas satisfait.',
              headline: 'Tout inclus. Zéro stress. 292$/mois.',
              description: 'QuickBooks gratuit + comptabilité complète.',
              cta_button: 'LEARN_MORE',
            },
            {
              filename: 'ZTX_ACQ_IDENTITY_entrepreneur-pas-comptable.jpeg',
              ad_name: 'ZTX | IDENTITY | IMG | entrepreneur-pas-comptable',
              angle: 'IDENTITY',
              format: 'IMAGE',
              primary_text: 'Vous avez lancé votre entreprise pour bâtir quelque chose. Pas pour passer vos soirées dans Excel.\n\nZentax installe QuickBooks gratuitement et gère votre comptabilité complète chaque mois. Tenue de livres. Déclarations fiscales. Rapports financiers.\n\nVous vous concentrez sur votre business. On s\'occupe des chiffres.\n\n292$/mois. Tout inclus.',
              headline: 'Vous êtes entrepreneur. Pas comptable.',
              description: 'QuickBooks installé gratuitement. 292$/mois.',
              cta_button: 'LEARN_MORE',
            },
            {
              filename: 'ZTX_ACQ_COMP_500-vs-zentax-photo.jpeg',
              ad_name: 'ZTX | COMP | IMG | 500-photo',
              angle: 'COMPARISON',
              format: 'IMAGE',
              primary_text: 'Votre comptable à 500$/an fait votre T2. C\'est tout.\n\nIl ne regarde pas vos livres chaque mois. Il ne repère pas les déductions manquées. Il ne vous prévient pas avant les échéances de Revenu Québec.\n\nRésultat : vous payez des milliers d\'impôts de trop et vous l\'apprenez en avril — quand il est trop tard.\n\nZentax gère tout, chaque mois. Proactivement. Pour 292$/mois.',
              headline: 'Votre comptable à 500$/an vous coûte des milliers.',
              description: 'Comptabilité mensuelle proactive. 292$/mois.',
              cta_button: 'LEARN_MORE',
            },
            {
              filename: 'ZTX_ACQ_COMP_500-vs-zentax-illus.jpeg',
              ad_name: 'ZTX | COMP | IMG | 500-illus',
              angle: 'COMPARISON',
              format: 'IMAGE',
              primary_text: 'Un comptable à 500$/an, ça semble économique. Jusqu\'à ce que vous réalisiez ce qu\'il ne fait pas.\n\nPas de suivi mensuel. Pas d\'optimisation fiscale. Pas de QuickBooks. Pas de rapport financier. Juste un T2 en avril — avec des milliers en déductions manquées.\n\nGarder votre argent est plus facile que d\'en gagner plus. Zentax s\'en charge. 292$/mois. Tout inclus.',
              headline: 'Le comptable pas cher vous coûte des milliers.',
              description: 'Solution proactive complète. 292$/mois.',
              cta_button: 'LEARN_MORE',
            },
          ],
        },
        {
          ad_set_name: 'ZTX | ACQ | VIDEO | BROAD-QC-FR',
          budget_daily: 60,
          ads: [
            {
              filename: 'ZTX_ACQ_PRICE_price-angle.mp4',
              ad_name: 'ZTX | PRICE | VID | price-angle',
              angle: 'PRICE',
              format: 'VIDEO',
              primary_text: 'Combien payez-vous vraiment pour votre comptabilité? Regardez ça.',
              headline: '292$/mois. Tout inclus.',
              description: 'Tenue de livres + taxes + QuickBooks gratuit.',
              cta_button: 'LEARN_MORE',
            },
            {
              filename: 'ZTX_ACQ_SUIVI_suivi-mensuel.mp4',
              ad_name: 'ZTX | SUIVI | VID | suivi-mensuel',
              angle: 'PROCESS',
              format: 'VIDEO',
              primary_text: 'Voici exactement ce qu\'on fait pour votre entreprise chaque mois. Tenue de livres, TPS/TVQ, rapport financier — tout est bouclé avant le 15. Vous recevez un résumé clair. Vous savez exactement où en sont vos finances.',
              headline: 'Votre comptabilité faite. Chaque mois.',
              description: 'Zéro retard. Zéro pénalité. 292$/mois.',
              cta_button: 'LEARN_MORE',
            },
            {
              filename: 'ZTX_ACQ_SUIVI_rigueur-mensuel.mp4',
              ad_name: 'ZTX | RIGUEUR | VID | rigueur-mensuel',
              angle: 'PROCESS',
              format: 'VIDEO',
              primary_text: 'La rigueur comptable qui protège votre entreprise — expliquée en 60 secondes. C\'est comme ça que Zentax s\'assure que vous ne payez jamais une pénalité inutile.',
              headline: 'Rigueur et suivi. Mois après mois.',
              description: 'Solution CPA complète. 292$/mois.',
              cta_button: 'LEARN_MORE',
            },
            {
              filename: 'ZTX_ACQ_UGC_barber-gestion-inc.mp4',
              ad_name: 'ZTX | UGC | VID | barber',
              angle: 'UGC',
              format: 'VIDEO',
              primary_text: 'Un entrepreneur québécois explique comment Zentax a changé la gestion de son INC. En vrai. Sans script.',
              headline: 'Fini les tracas. Focus sur le business.',
              description: 'Gestion complète de votre INC. 292$/mois.',
              cta_button: 'LEARN_MORE',
            },
          ],
        },
      ],
    },

    RETARGETING: {
      campaign_name: 'ZTX | RTG | QC-FR | 2026-03-10',
      objective: 'LEAD_GENERATION',
      budget_daily: 40,
      ad_sets: [
        {
          ad_set_name: 'ZTX | RTG | ALL | WCA-30D+VV75',
          budget_daily: 40,
          ads: [
            {
              filename: 'ZTX_RTG_OBJECTION_vous-hesitez.jpeg',
              ad_name: 'ZTX | RTG | IMG | vous-hesitez',
              angle: 'OBJECTION',
              format: 'IMAGE',
              primary_text: 'Vous avez vu notre offre. Vous hésitez encore.\n\nVoici la vraie question : combien vous coûte chaque mois de plus sans comptabilité propre?\n\nDéductions manquées. Échéances ratées. Surprises en avril. Heures perdues à gérer vos livres.\n\nZentax règle tout ça. 292$/mois. Premier mois remboursé si vous n\'êtes pas satisfait.',
              headline: 'Vous hésitez encore? Voici pourquoi agir maintenant.',
              description: 'Premier mois remboursé si vous n\'êtes pas satisfait.',
              cta_button: 'SIGN_UP',
            },
            {
              filename: 'ZTX_RTG_ENCORE_vous-y-pensez-encore.jpeg',
              ad_name: 'ZTX | RTG | IMG | vous-y-pensez-encore',
              angle: 'URGENCY',
              format: 'IMAGE',
              primary_text: 'Vous y pensez encore. C\'est bon signe — ça veut dire que vous savez que votre comptabilité a besoin d\'attention.\n\nNe laissez pas la prochaine échéance de Revenu Québec vous rappeler pourquoi vous y pensiez.\n\nRéservez votre diagnostic maintenant. 15 minutes suffisent.',
              headline: 'Vous y pensez encore? Agissez avant avril.',
              description: 'Libérez-vous de la paperasse. 292$/mois.',
              cta_button: 'SIGN_UP',
            },
            {
              filename: 'ZTX_RTG_CLICK_vous-avez-clique.jpeg',
              ad_name: 'ZTX | RTG | IMG | vous-avez-clique',
              angle: 'URGENCY',
              format: 'IMAGE',
              primary_text: 'Vous avez cliqué sur notre annonce. Vous avez vu l\'offre. Quelque chose vous a parlé.\n\nNe laissez pas vos finances en suspens plus longtemps.\n\nVos concurrents qui ont déjà mis leur comptabilité en ordre ont un avantage sur vous chaque mois. Chaque mois d\'attente, c\'est des déductions qui disparaissent.',
              headline: 'Vous avez cliqué. Ne laissez pas ça en suspens.',
              description: 'Diagnostic comptable gratuit. 292$/mois.',
              cta_button: 'SIGN_UP',
            },
            {
              filename: 'ZTX_RTG_ALMOST_vous-y-etes-presque.jpeg',
              ad_name: 'ZTX | RTG | IMG | vous-y-etes-presque',
              angle: 'CLOSE',
              format: 'IMAGE',
              primary_text: 'Vous êtes à deux clics d\'une comptabilité enfin réglée.\n\n✓ Tenue de livres mensuelle\n✓ TPS/TVQ\n✓ Impôt corporatif\n✓ QuickBooks gratuit\n✓ Rapports financiers\n\nTout ça pour 292$/mois. Réservez votre diagnostic gratuit — 30 minutes pour clarifier votre situation financière.',
              headline: 'Vous y êtes presque. Plus qu\'un appel.',
              description: 'Diagnostic comptable gratuit. Pas d\'engagement.',
              cta_button: 'SIGN_UP',
            },
            {
              filename: 'ZTX_RTG_SEEN_vous-avez-vu-zentax.jpeg',
              ad_name: 'ZTX | RTG | IMG | vous-avez-vu-zentax',
              angle: 'REMINDER',
              format: 'IMAGE',
              primary_text: 'Vous avez déjà vu Zentax. Vous savez ce qu\'on offre.\n\nChaque semaine d\'attente, c\'est une semaine de plus avec des livres en désordre et des risques de pénalités inutiles.\n\nNos clients disent que leur seul regret, c\'est de ne pas avoir fait le changement plus tôt.',
              headline: 'Ne laissez pas votre comptabilité vous ralentir.',
              description: '292$/mois. Premier mois remboursé.',
              cta_button: 'SIGN_UP',
            },
            {
              filename: 'ZTX_RTG_TESTI_mohamed-halaimia.jpeg',
              ad_name: 'ZTX | RTG | IMG | testi-mohamed',
              angle: 'TESTIMONIAL',
              format: 'IMAGE',
              primary_text: 'Mohamed Halaimia a fait confiance à Zentax pour la comptabilité mensuelle de son entreprise.\n\nRésultat : des livres propres, des chiffres clairs, et plus jamais de surprises fiscales.\n\nDes centaines d\'entrepreneurs québécois ont fait le même choix. C\'est votre tour.',
              headline: 'Ils ont sauté le pas. Vous aussi?',
              description: '4.9 ⭐ sur Google. 292$/mois. Tout inclus.',
              cta_button: 'SIGN_UP',
            },
            {
              filename: 'ZTX_RTG_TESTI_video-testimonials.mp4',
              ad_name: 'ZTX | RTG | VID | testimonials',
              angle: 'TESTIMONIAL',
              format: 'VIDEO',
              primary_text: 'Voici ce que nos clients disent après quelques mois avec Zentax. En vrai.',
              headline: 'Ils ont arrêté de stresser. Vous le méritez aussi.',
              description: 'Diagnostic comptable gratuit. 292$/mois.',
              cta_button: 'SIGN_UP',
            },
          ],
        },
      ],
    },
  },
}

// ─── Targeting (Quebec, French, 25-55) ───────────────────────────────────────

const TARGETING_BROAD = {
  geo_locations: { regions: [{ key: '3870' }] },
  locales: [12],
  age_min: 25,
  age_max: 55,
}

function targetingRetarget(audienceId) {
  return {
    geo_locations: { regions: [{ key: '3870' }] },
    locales: [12],
    age_min: 25,
    age_max: 55,
    custom_audiences: [{ id: audienceId }],
  }
}

// ─── Objective / optimization mapping ────────────────────────────────────────

const OBJECTIVE_MAP = {
  LEAD_GENERATION: 'OUTCOME_LEADS',
  OUTCOME_LEADS:   'OUTCOME_LEADS',
  TRAFFIC:         'OUTCOME_TRAFFIC',
  OUTCOME_TRAFFIC: 'OUTCOME_TRAFFIC',
}

const OPTIM_GOAL_MAP = {
  OUTCOME_LEADS:   'QUALITY_LEAD',
  OUTCOME_TRAFFIC: 'LANDING_PAGE_VIEWS',
}

// ─── Arg parsing ──────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const result = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg.startsWith('--')) {
      const key  = arg.slice(2)
      const next = argv[i + 1]
      if (next && !next.startsWith('--')) { result[key] = next; i++ }
      else result[key] = true
    } else {
      result._.push(arg)
    }
  }
  return result
}

const args   = parseArgs(process.argv.slice(2))
const DRY_RUN = !!args['dry-run']

function log(msg) { console.log(msg) }

// ─── Meta API ─────────────────────────────────────────────────────────────────

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
      params.append(k, (Array.isArray(v) || typeof v === 'object') ? JSON.stringify(v) : String(v))
    }
  }
  const res  = await fetch(url, { method, headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params.toString() })
  const data = await res.json()
  if (data.error) throw new Error(`Meta API: ${JSON.stringify(data.error)}`)
  return data
}

// ─── Auto-discover retargeting audience ───────────────────────────────────────

async function findRetargetingAudience() {
  if (DRY_RUN) {
    log(`[DRY-RUN] Would query custom audiences — using placeholder ID`)
    return { id: 'DRY_AUDIENCE_ID', name: '(dry-run placeholder)' }
  }
  const res = await fetch(
    `${BASE_URL}/act_${ACCOUNT_ID}/customaudiences?fields=id,name,approximate_count&limit=100&access_token=${TOKEN}`
  )
  const data = await res.json()
  if (data.error) throw new Error(`Custom audiences fetch: ${JSON.stringify(data.error)}`)

  const audiences = data.data || []
  if (!audiences.length) return null

  // Priority: match WCA / website / 30d / retarget / visiteur patterns
  const PRIORITY = [/WCA/i, /website/i, /visiteur/i, /30d/i, /30j/i, /retarget/i, /VV/i]
  for (const pattern of PRIORITY) {
    const match = audiences.find(a => pattern.test(a.name))
    if (match) return match
  }

  // Fallback: first audience
  return audiences[0]
}

// ─── Upload helpers ───────────────────────────────────────────────────────────

function isVideo(filePath) { return /\.(mp4|mov)$/i.test(filePath) }

function findCreativeFile(filename, dirs) {
  for (const dir of dirs) {
    if (!dir) continue
    const full = path.join(dir, filename)
    if (fs.existsSync(full)) return full
  }
  return null
}

function findThumbnail(videoPath, fallbackDir, globalThumb) {
  const base = videoPath.replace(/\.(mp4|mov)$/i, '')
  for (const ext of ['.jpg', '.jpeg', '.png']) {
    if (fs.existsSync(base + ext)) return base + ext
    if (fs.existsSync(base + ext.toUpperCase())) return base + ext.toUpperCase()
  }
  const sameDir    = path.dirname(videoPath)
  const anyInSame  = fs.readdirSync(sameDir).find(f => /\.(jpe?g|png)$/i.test(f))
  if (anyInSame) return path.join(sameDir, anyInSame)
  if (fallbackDir && fallbackDir !== sameDir) {
    const anyInFb = fs.readdirSync(fallbackDir).find(f => /\.(jpe?g|png)$/i.test(f))
    if (anyInFb) return path.join(fallbackDir, anyInFb)
  }
  if (globalThumb) return globalThumb
  return null
}

function buildMultipart(fields, fileField, filename, mimeType, fileBuffer) {
  const boundary = `----FormBoundary${Math.random().toString(36).slice(2)}`
  const CRLF = '\r\n'
  const parts = []
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
  const res  = await fetch(`${BASE_URL}/act_${ACCOUNT_ID}/adimages`, { method: 'POST', headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}`, 'Content-Length': body.length }, body })
  const data = await res.json()
  if (data.error) throw new Error(`Image upload (${filename}): ${data.error.message}`)
  return data.images[Object.keys(data.images)[0]].hash
}

async function uploadVideo(videoPath) {
  const filename = path.basename(videoPath)
  if (DRY_RUN) { log(`[DRY-RUN] Upload video: ${filename}`); return `DRY_VID_${Math.random().toString(36).slice(2, 10).toUpperCase()}` }
  const mime = /\.mov$/i.test(videoPath) ? 'video/quicktime' : 'video/mp4'
  const { body, boundary } = buildMultipart({ access_token: TOKEN, title: filename }, 'source', filename, mime, fs.readFileSync(videoPath))
  const res  = await fetch(`${BASE_URL}/act_${ACCOUNT_ID}/advideos`, { method: 'POST', headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}`, 'Content-Length': body.length }, body })
  const data = await res.json()
  if (data.error) throw new Error(`Video upload (${filename}): ${data.error.message}`)
  return data.id
}

// Builds asset_feed_spec for Audience Network rewarded video placement
function buildFeedSpec({ adDef, destUrl, videoId, thumbHash, imageHash, rwVideoId, rwThumbHash }) {
  const main     = { name: 'main' }
  const rewarded = { name: 'rewarded' }
  const spec = {
    bodies:               [{ text: adDef.primary_text, adlabels: [main] }],
    titles:               [{ text: adDef.headline,     adlabels: [main] }],
    link_urls:            [{ website_url: destUrl,      adlabels: [main] }],
    call_to_action_types: [adDef.cta_button],
    videos: [{ video_id: rwVideoId, thumbnail_hash: rwThumbHash, adlabels: [rewarded] }],
    asset_customization_rules: [{
      customization_spec: { publisher_platforms: ['audience_network'], audience_network_positions: ['rewarded_video'] },
      video_label: rewarded, title_label: main, body_label: main, link_url_label: main,
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
    console.error('Error: META_ACCESS_TOKEN is not set.\n  $env:META_ACCESS_TOKEN = Get-Content "$env:USERPROFILE\\meta_token.txt"')
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

  const status          = args.status || 'PAUSED'
  const globalThumb     = args['thumbnail'] || null
  const rewardedVidPath = args['rewarded-video'] || null

  if (rewardedVidPath && !fs.existsSync(rewardedVidPath)) {
    console.error(`Error: --rewarded-video file not found: ${rewardedVidPath}`)
    process.exit(1)
  }

  const config     = CAMPAIGN_CONFIG
  const destUrl    = config.destination_url
  const campKeys   = Object.keys(config.campaigns)

  // ── Retargeting audience (hardcoded default, overridable via flag) ───────────
  let retargetAudienceId   = args['retarget-audience-id'] || RTG_AUDIENCE
  let retargetAudienceName = `WCA-30D + Video Viewers 75% (${retargetAudienceId})`

  // ── Print header ─────────────────────────────────────────────────────────────
  log(`\n${'═'.repeat(60)}`)
  log(`  Zentax Campaign Launcher${DRY_RUN ? ' [DRY RUN]' : ''}`)
  log(`${'═'.repeat(60)}`)
  log(`  Account    : act_${ACCOUNT_ID}`)
  log(`  Pixel      : ${PIXEL_ID}  (Zentax Cabinet Comptable)`)
  log(`  Status     : ${status}`)
  log(`  Creatives  : ${frDir}`)
  log(`  Destination: ${destUrl}`)
  log(`  Campaigns  : ${campKeys.join(', ')}`)
  if (retargetAudienceId) log(`  RTG Audience: ${retargetAudienceName} (${retargetAudienceId})`)
  log(`  Rewarded   : ${rewardedVidPath ? path.basename(rewardedVidPath) : '(none)'}`)
  log(`${'═'.repeat(60)}`)

  const allResults = []

  for (const campKey of campKeys) {
    const campDef       = config.campaigns[campKey]
    const isRetargeting = /RETARGET|RTG/i.test(campKey)
    const metaObjective = OBJECTIVE_MAP[campDef.objective] || campDef.objective
    const optimGoal     = OPTIM_GOAL_MAP[metaObjective] || 'QUALITY_LEAD'

    log(`\n${'─'.repeat(60)}`)
    log(`  [${campKey}] ${campDef.campaign_name}`)
    log(`  Objective: ${metaObjective}  |  Optimization: ${optimGoal}`)
    log(`  Total budget: $${campDef.budget_daily} CAD/day  |  Ad sets: ${campDef.ad_sets.length}`)
    log(`${'─'.repeat(60)}`)

    const campaign = await api('POST', `/act_${ACCOUNT_ID}/campaigns`, {
      name:                            campDef.campaign_name,
      objective:                       metaObjective,
      status,
      special_ad_categories:           '[]',
      is_adset_budget_sharing_enabled: false,
    })
    log(`  ✓ Campaign: ${campaign.id}  "${campDef.campaign_name}"`)

    const adSetResults = []

    for (const adSetDef of campDef.ad_sets) {
      const budgetCents = Math.round(adSetDef.budget_daily * 100)
      const targeting   = (isRetargeting && retargetAudienceId)
        ? targetingRetarget(retargetAudienceId)
        : TARGETING_BROAD

      // promoted_object required for OUTCOME_LEADS
      const promotedObject = metaObjective === 'OUTCOME_LEADS'
        ? { pixel_id: PIXEL_ID, custom_event_type: 'LEAD' }
        : undefined

      const adSetBody = {
        name:              adSetDef.ad_set_name,
        campaign_id:       campaign.id,
        billing_event:     'IMPRESSIONS',
        optimization_goal: optimGoal,
        daily_budget:      budgetCents,
        bid_strategy:      'LOWEST_COST_WITHOUT_CAP',
        targeting,
        status,
      }
      if (promotedObject) adSetBody.promoted_object = promotedObject

      const adset = await api('POST', `/act_${ACCOUNT_ID}/adsets`, adSetBody)
      log(`\n  ✓ Ad Set: ${adset.id}  "${adSetDef.ad_set_name}"  ($${adSetDef.budget_daily}/day)`)

      if (isRetargeting && !retargetAudienceId) {
        log(`    ⚠  Using broad targeting (no custom audience found)`)
      }

      // Upload 9:16 rewarded video once per ad set
      let rwVideoId = null, rwThumbHash = null
      if (rewardedVidPath) {
        log(`    Uploading rewarded video: ${path.basename(rewardedVidPath)}`)
        rwVideoId = await uploadVideo(rewardedVidPath)
        log(`      ✓ rewarded video_id: ${rwVideoId}`)
        const rwThumb = findThumbnail(rewardedVidPath, frDir, globalThumb)
        if (rwThumb) { rwThumbHash = await uploadImage(rwThumb); log(`      ✓ rewarded thumb  : ${rwThumbHash}`) }
      }

      const adResults = []

      for (const adDef of adSetDef.ads) {
        const filePath = findCreativeFile(adDef.filename, [
          frDir,
          path.join(frDir, 'Videos'),
          path.join(frDir, 'Images'),
          path.join(frDir, 'Creatives'),
        ])
        if (!filePath) {
          if (DRY_RUN) { log(`\n    [DRY-RUN] ⚠  File not found: ${adDef.filename} — skipping`); continue }
          throw new Error(`Creative file not found: ${adDef.filename}\n  Searched in: ${frDir}`)
        }

        const fileType = isVideo(filePath) ? 'video' : 'image'
        log(`\n    [${adDef.ad_name}]  ${adDef.filename} (${fileType})`)

        let creativePayload

        if (isVideo(filePath)) {
          const thumbPath = findThumbnail(filePath, frDir, globalThumb)
          if (!thumbPath && !DRY_RUN) throw new Error(`No thumbnail for ${adDef.filename} — add ${adDef.filename.replace(/\.(mp4|mov)$/i, '')}.jpg next to it`)
          const videoId   = await uploadVideo(filePath);  log(`      ✓ video_id  : ${videoId}`)
          const thumbHash = thumbPath ? await uploadImage(thumbPath) : null
          if (thumbPath) log(`      ✓ thumbnail : ${thumbHash} (${path.basename(thumbPath)})`)

          creativePayload = rwVideoId ? {
            name: `${adDef.ad_name} Creative`, page_id: PAGE_ID, instagram_actor_id: IG_ACTOR_ID,
            asset_feed_spec: buildFeedSpec({ adDef, destUrl, videoId, thumbHash: thumbHash || rwThumbHash, rwVideoId, rwThumbHash: rwThumbHash || thumbHash }),
          } : {
            name: `${adDef.ad_name} Creative`,
            object_story_spec: {
              page_id: PAGE_ID, instagram_actor_id: IG_ACTOR_ID,
              video_data: { video_id: videoId, image_hash: thumbHash, message: adDef.primary_text, title: adDef.headline, call_to_action: { type: adDef.cta_button, value: { link: destUrl } } },
            },
          }
        } else {
          const imageHash = await uploadImage(filePath);  log(`      ✓ image_hash: ${imageHash}`)

          creativePayload = rwVideoId ? {
            name: `${adDef.ad_name} Creative`, page_id: PAGE_ID, instagram_actor_id: IG_ACTOR_ID,
            asset_feed_spec: buildFeedSpec({ adDef, destUrl, imageHash, rwVideoId, rwThumbHash }),
          } : {
            name: `${adDef.ad_name} Creative`,
            object_story_spec: {
              page_id: PAGE_ID, instagram_actor_id: IG_ACTOR_ID,
              link_data: { image_hash: imageHash, link: destUrl, message: adDef.primary_text, name: adDef.headline, description: adDef.description, call_to_action: { type: adDef.cta_button, value: { link: destUrl } } },
            },
          }
        }

        const creative = await api('POST', `/act_${ACCOUNT_ID}/adcreatives`, creativePayload)
        log(`      ✓ creative  : ${creative.id}`)

        const ad = await api('POST', `/act_${ACCOUNT_ID}/ads`, { name: adDef.ad_name, adset_id: adset.id, creative: { creative_id: creative.id }, status })
        log(`      ✓ ad        : ${ad.id}`)

        adResults.push({ ad_name: adDef.ad_name, file: adDef.filename, type: fileType, ad_id: ad.id })
      }

      adSetResults.push({ ad_set_name: adSetDef.ad_set_name, adset_id: adset.id, ads: adResults })
    }

    allResults.push({ campaign_key: campKey, campaign_name: campDef.campaign_name, campaign_id: campaign.id, ad_sets: adSetResults })
  }

  // ── Summary ───────────────────────────────────────────────────────────────────
  let totalAds = 0
  log(`\n${'═'.repeat(60)}`)
  log(`  All done!`)
  log(`${'═'.repeat(60)}`)
  for (const r of allResults) {
    log(`\n  [${r.campaign_key}] Campaign ID: ${r.campaign_id}`)
    for (const s of r.ad_sets) {
      log(`    Ad Set: "${s.ad_set_name}"`)
      log(`    ID: ${s.adset_id}  |  ${s.ads.length} ads`)
      totalAds += s.ads.length
    }
  }
  log(`\n  Total ads created : ${totalAds}`)
  log(`  Total daily budget: $${Object.values(CAMPAIGN_CONFIG.campaigns).reduce((t, c) => t + c.budget_daily, 0)} CAD/day`)
  log(`  All ads are ${status}. Review in Meta Ads Manager then activate.`)
  log(`  https://adsmanager.facebook.com/`)
  log(`${'═'.repeat(60)}\n`)
}

// ─── Utility commands ─────────────────────────────────────────────────────────

async function listAudiences() {
  if (!TOKEN) { console.error('Error: META_ACCESS_TOKEN is not set.'); process.exit(1) }
  const res  = await fetch(`${BASE_URL}/act_${ACCOUNT_ID}/customaudiences?fields=id,name,approximate_count,subtype&limit=100&access_token=${TOKEN}`)
  const data = await res.json()
  if (data.error) { console.error('Error:', JSON.stringify(data.error)); process.exit(1) }
  console.log(`\nCustom Audiences on act_${ACCOUNT_ID}:\n`)
  for (const a of data.data || []) {
    console.log(`  ID: ${a.id.padEnd(20)}  Size: ${String(a.approximate_count || '?').padEnd(10)}  Type: ${(a.subtype || '').padEnd(12)}  Name: ${a.name}`)
  }
  console.log(`\nPass the ID you want with --retarget-audience-id <id>\n`)
}

async function findTargeting() {
  if (!TOKEN) { console.error('Error: META_ACCESS_TOKEN is not set.'); process.exit(1) }
  console.log('\n Looking up targeting keys from Meta API...\n')
  const geoRes  = await fetch(`${BASE_URL}/search?type=adgeolocation&q=Quebec&location_types=%5B%22region%22%5D&country_code=CA&access_token=${TOKEN}`)
  const geoData = await geoRes.json()
  console.log('=== Quebec region results ===')
  ;(geoData.data || []).forEach(r => console.log(`  key: "${r.key}"  name: "${r.name}"`))
  const locRes  = await fetch(`${BASE_URL}/search?type=adlocale&q=French&access_token=${TOKEN}`)
  const locData = await locRes.json()
  console.log('\n=== French locale results ===')
  ;(locData.data || []).forEach(r => console.log(`  key: ${r.key}  name: "${r.name}"`))
  console.log()
}

// ─── Entry point ──────────────────────────────────────────────────────────────

if (args['list-audiences']) {
  listAudiences().catch(err => { console.error(err.message); process.exit(1) })
} else if (args['find-targeting']) {
  findTargeting().catch(err => { console.error(err.message); process.exit(1) })
} else {
  main().catch(err => { console.error('\nFatal error:', err.message); process.exit(1) })
}
