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
const BASE_URL     = 'https://graph.facebook.com/v22.0'
const PAGE_ID      = '676813882182100'
const IG_ACTOR_ID  = '9623717551054024'
const PIXEL_ID     = '1173962951224451'   // Zentax Cabinet Comptable
const RTG_AUDIENCE = '120242292904720693' // WCA-30D + Video Viewers 75%

// ─── Embedded Campaign Config ─────────────────────────────────────────────────

const CAMPAIGN_CONFIG = {
  destination_url: 'https://www.zentax.ca',
  campaigns: {
    VIDEO_ACQ: {
      campaign_name: 'ZTX | ACQ | Video | Acquisition Entrepreneurs CA',
      objective: 'OUTCOME_LEADS',
      cbo: true,
      budget_daily: 50,
      ad_sets: [
        {
          ad_set_name: 'ZTX | ACQ | Video | Entrepreneurs FR | Canada',
          ads: [
            {
              filename: 'Videos/ZTX_ACQ_PRICE_price-angle.mp4',
              ad_name: 'ZTX | ACQ | Video | Price Angle',
              primary_text: 'Vos impôts, vos livres, vos déclarations T2/CO-17 — gérés chaque mois par des experts. Sans surprise, sans mauvaises nouvelles en fin d\'année.\n\nComptabilité mensuelle complète pour entrepreneurs canadiens. 292$/mois tout inclus.',
              headline: 'Comptabilité complète à 292$/mois — Tout inclus.',
              description: 'Réservez votre appel gratuit. Zéro engagement.',
              cta_button: 'CONTACT_US',
            },
            {
              filename: 'Videos/ZTX_ACQ_SUIVI_rigueur-mensuel.mp4',
              ad_name: 'ZTX | ACQ | Video | Suivi Mensuel Rigueur',
              primary_text: 'Votre comptabilité ne devrait jamais être en retard. Chez Zentax, on gère vos livres, vos rapports financiers et vos déclarations fiscales — chaque mois, sans exception.\n\nDès 292$/mois. QuickBooks inclus.',
              headline: 'Un suivi mensuel rigoureux. Sans retard, sans stress.',
              description: 'Comptabilité, rapports financiers, T2/CO-17. Tout inclus à 292$/mois.',
              cta_button: 'CONTACT_US',
            },
            {
              filename: 'Videos/ZTX_ACQ_SUIVI_suivi-mensuel.mp4',
              ad_name: 'ZTX | ACQ | Video | Suivi Mensuel',
              primary_text: 'Fini les nuits à courir après vos chiffres. Fini le stress avant les deadlines de l\'ARC.\n\nZentax gère votre comptabilité mensuelle complète pendant que vous vous concentrez sur votre business. Installation QuickBooks gratuite incluse.\n\nÀ partir de 292$/mois.',
              headline: 'Votre comptabilité, on s\'en occupe. Chaque mois.',
              description: 'Tenue de livres + Déclarations fiscales + Rapports. 292$/mois.',
              cta_button: 'CONTACT_US',
            },
            {
              filename: 'Videos/ZTX_ACQ_UGC_barber-gestion-inc.mp4',
              ad_name: 'ZTX | ACQ | Video | UGC Barber Gestion Inc',
              primary_text: 'Lui aussi pensait que ça prenait un comptable traditionnel pour gérer son entreprise correctement.\n\nAujourd\'hui, sa comptabilité est à jour chaque mois — et il ne stresse plus jamais avant les déclarations fiscales.\n\n292$/mois. Tout inclus. Essayez Zentax.',
              headline: 'Il a arrêté de stresser pour sa comptabilité. Vous aussi pouvez.',
              description: 'Comptabilité intelligente pour entrepreneurs canadiens. Dès 292$/mois.',
              cta_button: 'LEARN_MORE',
            },
          ],
        },
      ],
    },

    IMAGE_ACQ: {
      campaign_name: 'ZTX | ACQ | Image | Acquisition Entrepreneurs CA',
      objective: 'OUTCOME_LEADS',
      cbo: true,
      budget_daily: 50,
      ad_sets: [
        {
          ad_set_name: 'ZTX | ACQ | Image | Entrepreneurs FR | Canada',
          ads: [
            {
              filename: 'Creative Final/ZTX_ACQ_COMP_500-vs-zentax-illus.jpeg',
              ad_name: 'ZTX | ACQ | Image | Comparison Illustration',
              primary_text: 'Votre comptable à 500$ vous semble économique. Mais les déductions manquées et la mauvaise structure vous coûtent des milliers chaque année.\n\nGarder votre argent est plus simple que d\'en gagner davantage.\n\nZentax : comptabilité intelligente, structure optimisée. 292$/mois.',
              headline: 'Votre comptable à 500$ vous coûte des milliers en déductions.',
              description: 'Zentax vs le comptable classique — la différence se voit dans vos profits.',
              cta_button: 'CONTACT_US',
            },
            {
              filename: 'Creative Final/ZTX_ACQ_COMP_500-vs-zentax-photo.jpeg',
              ad_name: 'ZTX | ACQ | Image | Comparison Photo',
              primary_text: 'Un comptable pas cher à 500$ vous coûte des milliers en déductions manquées.\n\nEt une mauvaise structure fiscale peut vous coûter encore plus. Garder votre argent, c\'est plus facile que d\'en gagner davantage.\n\nZentax Smart Accounting — 292$/mois. Comptabilité complète pour entrepreneurs canadiens.',
              headline: 'Le comptable pas cher vous coûte plus cher qu\'il n\'en a l\'air.',
              description: 'Zentax : comptabilité intelligente à 292$/mois. Réservez un appel gratuit.',
              cta_button: 'CONTACT_US',
            },
            {
              filename: 'Creative Final/ZTX_ACQ_FEAR_2h30-penalite.png',
              ad_name: 'ZTX | ACQ | Image | Fear 2h30 Pénalité',
              primary_text: 'Il est 2h30 du matin et vous êtes encore en train de stresser à cause de votre comptabilité ?\n\nVotre comptable est *encore* en retard. Et les pénalités, elles, n\'attendent pas.\n\nArrêtez de stresser. Zentax gère votre comptabilité et vos impôts chaque mois — à temps, sans exception. 292$/mois tout inclus.',
              headline: 'Votre comptable est encore en retard ? Les pénalités, elles, sont à l\'heure.',
              description: 'Comptabilité et impôts complets pour 292$/mois. Réservez maintenant.',
              cta_button: 'CONTACT_US',
            },
            {
              filename: 'Creative Final/ZTX_ACQ_FEAR_comptable-en-retard.png',
              ad_name: 'ZTX | ACQ | Image | Fear Comptable En Retard ARC',
              primary_text: 'L\'ARC et Revenu Québec n\'attendent pas. Pendant que votre comptable prend du retard, les amendes, elles, sont déjà en route.\n\nNe risquez plus jamais d\'amendes coûteuses. Zentax gère votre comptabilité et vos impôts d\'entreprise à temps, chaque mois.\n\nDès 292$/mois.',
              headline: 'Pénalités imminentes. Votre comptable est toujours en retard.',
              description: 'Zentax : comptabilité et impôts gérés à temps, chaque mois. 292$/mois.',
              cta_button: 'CONTACT_US',
            },
            {
              filename: 'Creative Final/ZTX_ACQ_IDENTITY_entrepreneur-pas-comptable.jpeg',
              ad_name: 'ZTX | ACQ | Image | Identity Entrepreneur Pas Comptable',
              primary_text: 'Vous avez lancé votre entreprise pour bâtir quelque chose de grand — pas pour passer vos soirées sur des chiffres.\n\nVous êtes entrepreneur. Pas comptable.\n\nZentax gère vos livres, vos impôts et vos finances. Pendant que vous, vous gérez votre business.\n\n✅ Installation QuickBooks GRATUITE incluse\n✅ À partir de 292$/mois',
              headline: 'Vous êtes entrepreneur. Pas comptable.',
              description: 'Zentax gère vos livres, impôts et finances. QuickBooks inclus. 292$/mois.',
              cta_button: 'LEARN_MORE',
            },
            {
              filename: 'Creative Final/ZTX_ACQ_PRICE_stamp-292-tout-inclus.jpeg',
              ad_name: 'ZTX | ACQ | Image | Price 292 Tout Inclus',
              primary_text: 'Vous pensez que la comptabilité d\'entreprise c\'est « trop cher » ou « trop compliqué » ?\n\nZentax : Tout inclus. Zéro stress. 292$/mois.\n\nComptabilité, tenue de livres, impôts sociétés — pour entrepreneurs canadiens. Un prix fixe, zéro mauvaise surprise.',
              headline: 'Tout inclus. Zéro stress. 292$/mois.',
              description: 'Comptabilité complète pour entrepreneurs canadiens. Réservez un appel gratuit.',
              cta_button: 'CONTACT_US',
            },
          ],
        },
      ],
    },

    RETARGETING: {
      campaign_name: 'ZTX | RTG | Visiteurs Site Web | Conversion',
      objective: 'OUTCOME_LEADS',
      cbo: true,
      budget_daily: 30,
      ad_sets: [
        {
          ad_set_name: 'ZTX | RTG | Visiteurs Site Web 30 jours',
          ads: [
            {
              filename: 'Retargeting/ZTX_RTG_ALMOST_vous-y-etes-presque.jpeg',
              ad_name: 'ZTX | RTG | Image | Vous y êtes presque (FOMO)',
              primary_text: 'Vous y êtes presque. Ne laissez pas la paperasse vous freiner encore.\n\n« Zentax a simplifié notre comptabilité et nous a fait gagner des heures chaque mois. » — Ali Mounir, Entrepreneur en construction\n\n✅ Tenue de livres\n✅ Rapports financiers\n✅ Déclarations fiscales (T2/CO-17)\n\n292$/mois. Un appel suffit pour tout mettre en place.',
              headline: 'Vous y êtes presque. Ne laissez pas la paperasse vous freiner.',
              description: 'Comptabilité mensuelle complète à 292$/mois. Réservez maintenant.',
              cta_button: 'CONTACT_US',
            },
            {
              filename: 'Retargeting/ZTX_RTG_CLICK_vous-avez-clique.jpeg',
              ad_name: 'ZTX | RTG | Image | Vous avez cliqué (Urgence douce)',
              primary_text: 'Vous avez cliqué — c\'est souvent le signe qu\'il est temps d\'agir.\n\nNe laissez pas vos finances en suspens plus longtemps.\n\nZentax Smart Accounting : comptabilité et impôts sans stress pour entrepreneurs canadiens.\n\n✔ Tenue de livres ✔ T2/CO-17 ✔ Rapports financiers\n\nSeulement 292$/mois. Rejoignez des centaines d\'entrepreneurs qui ont franchi le pas.',
              headline: 'Vous avez cliqué. Ne laissez pas vos finances en suspens !',
              description: '292$/mois tout inclus — Tenue de livres, T2/CO-17, rapports.',
              cta_button: 'CONTACT_US',
            },
            {
              filename: 'Retargeting/ZTX_RTG_ENCORE_vous-y-pensez-encore.jpeg',
              ad_name: 'ZTX | RTG | Image | Vous y pensez encore (Rumination)',
              primary_text: 'Vous y pensez encore. C\'est normal — changer de comptable ou en prendre un pour la première fois, ça mérite réflexion.\n\nMais pendant ce temps, vos livres s\'accumulent.\n\n« Zentax a simplifié notre comptabilité et nous a fait gagner des heures chaque mois. » — Ali Mounir, Entrepreneur en construction\n\nComptabilité et impôts gérés pour 292$/mois. Prenez rendez-vous — c\'est gratuit et sans engagement.',
              headline: 'Vous y pensez encore ? Libérez-vous de la paperasse.',
              description: 'Un appel gratuit, sans engagement. On répond à toutes vos questions.',
              cta_button: 'CONTACT_US',
            },
            {
              filename: 'Retargeting/ZTX_RTG_OBJECTION_vous-hesitez.jpeg',
              ad_name: 'ZTX | RTG | Image | Vous hésitez (Objection Handler)',
              primary_text: 'Vous avez vu notre offre. Vous hésitez encore. Voici pourquoi nos clients ne regrettent jamais :\n\n✅ Prix fixe — 292$/mois, aucune surprise\n✅ Tout inclus — tenue de livres, déclarations T2/CO-17, rapports\n✅ Réactifs — votre dossier est traité à temps, chaque mois\n✅ QuickBooks inclus — installation gratuite\n\n« Zentax a simplifié notre comptabilité et nous a fait gagner des heures chaque mois. » — Ali Mounir\n\nNe laissez pas la paperasse ralentir votre croissance.',
              headline: 'Vous hésitez encore ? On répond à toutes vos questions.',
              description: 'Comptabilité claire et sans stress à 292$/mois. Réservez un appel gratuit.',
              cta_button: 'CONTACT_US',
            },
            {
              filename: 'Retargeting/ZTX_RTG_SEEN_vous-avez-vu-zentax.jpeg',
              ad_name: 'ZTX | RTG | Image | Vous avez vu Zentax (Rappel de marque)',
              primary_text: 'Vous avez déjà vu Zentax. Voici pourquoi des centaines d\'entrepreneurs canadiens nous ont choisi :\n\n→ Simplifiez vos finances\n→ Évitez les erreurs fiscales\n→ Gagnez des heures chaque mois\n\n« Zentax a simplifié notre comptabilité et nous a fait gagner des heures chaque mois. » — Ali Mounir, Entrepreneur en construction\n\nÀ partir de 292$/mois. Ne laissez plus votre comptabilité vous ralentir.',
              headline: 'Vous avez vu Zentax. Ne laissez pas votre comptabilité vous ralentir.',
              description: 'À partir de 292$/mois. Réservez votre appel gratuit maintenant.',
              cta_button: 'CONTACT_US',
            },
            {
              filename: 'Retargeting/ZTX_RTG_TESTI_mohamed-halaimia.jpeg',
              ad_name: 'ZTX | RTG | Image | Testimonial Mohamed Halaimia (TI)',
              primary_text: 'Vous avez déjà fait le premier pas. Il est temps de le franchir.\n\n« Zentax a simplifié notre tenue de livres et nous a fait gagner des heures chaque mois. »\n— Mohamed Halaimia, Entrepreneur en TI\n\nComptabilité mensuelle tout-en-un pour entrepreneurs. 292$/mois.\n\nArrêtez de perdre du temps sur votre comptabilité.',
              headline: 'Arrêtez de perdre du temps sur votre comptabilité.',
              description: 'Rejoignez Mohamed et des centaines d\'entrepreneurs. 292$/mois.',
              cta_button: 'CONTACT_US',
            },
            {
              filename: 'Retargeting/ZTX_RTG_TESTI_video-testimonials.mp4',
              ad_name: 'ZTX | RTG | Video | Testimonial Vidéo Multi-Clients',
              primary_text: 'Vous avez visité Zentax. Voici ce que pensent nos clients — en leurs propres mots.\n\nDes entrepreneurs canadiens comme vous ont confié leur comptabilité à Zentax et ne regardent plus jamais en arrière.\n\n292$/mois tout inclus — comptabilité, impôts, rapports.\n\nVotre tour ?',
              headline: 'Ils ont fait confiance à Zentax. Voici ce qu\'ils en pensent.',
              description: '292$/mois tout inclus. Réservez votre appel gratuit — sans engagement.',
              cta_button: 'CONTACT_US',
            },
          ],
        },
      ],
    },
  },
}

// ─── Targeting (Quebec, French, 25-55) ───────────────────────────────────────

const TARGETING_BROAD = {
  geo_locations: { countries: ['CA'] },
  locales: [12],
  age_min: 25,
  age_max: 55,
  targeting_automation: { advantage_audience: 1 },
}

function targetingRetarget(audienceId) {
  return {
    geo_locations: { countries: ['CA'] },
    age_min: 25,
    age_max: 55,
    custom_audiences: [{ id: audienceId }],
    targeting_automation: { advantage_audience: 0 },
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
  OUTCOME_LEADS:   'OFFSITE_CONVERSIONS', // pixel-based website funnel (not Meta Lead Ads forms)
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

  // ── Folder structure ─────────────────────────────────────────────────────────
  // Searches all three subfolders automatically — filenames in config are unique
  const dirFinal   = path.join(frDir, 'Creative Final')
  const dirRtg     = path.join(frDir, 'Retargeting')
  const dirVideos  = path.join(frDir, 'Videos')
  const searchDirs = [frDir, dirFinal, dirRtg, dirVideos].filter(d => fs.existsSync(d))

  if (searchDirs.length === 1) {
    log(`\n  ⚠  Only root folder found. Expected subfolders:`)
    log(`       ${dirFinal}`)
    log(`       ${dirRtg}`)
    log(`       ${dirVideos}`)
    log(`     Files will be searched in root only.\n`)
  }

  // ── Retargeting audience (hardcoded default, overridable via flag) ───────────
  const retargetAudienceId = args['retarget-audience-id'] || RTG_AUDIENCE

  // ── Print header ─────────────────────────────────────────────────────────────
  log(`\n${'═'.repeat(60)}`)
  log(`  Zentax Campaign Launcher${DRY_RUN ? ' [DRY RUN]' : ''}`)
  log(`${'═'.repeat(60)}`)
  log(`  Account    : act_${ACCOUNT_ID}`)
  log(`  Pixel      : ${PIXEL_ID}  (Zentax Cabinet Comptable)`)
  log(`  Status     : ${status}`)
  log(`  Creatives  : ${frDir}`)
  log(`    ├ images : ${fs.existsSync(dirFinal)  ? '✓' : '✗'} Creative Final/`)
  log(`    ├ retarget: ${fs.existsSync(dirRtg)   ? '✓' : '✗'} Retargeting/`)
  log(`    └ videos : ${fs.existsSync(dirVideos) ? '✓' : '✗'} Videos/`)
  log(`  Destination: ${destUrl}`)
  log(`  RTG Audience: ${retargetAudienceId}  (WCA-30D+VV75%)`)
  log(`  Campaigns  : ${campKeys.join(', ')}`)
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

    const campaignBody = {
      name:                  campDef.campaign_name,
      objective:             metaObjective,
      status,
      special_ad_categories: '[]',
    }
    if (campDef.cbo) {
      campaignBody.daily_budget  = Math.round(campDef.budget_daily * 100)
      campaignBody.bid_strategy  = 'LOWEST_COST_WITHOUT_CAP'
    }
    const campaign = await api('POST', `/act_${ACCOUNT_ID}/campaigns`, campaignBody)
    log(`  ✓ Campaign: ${campaign.id}  "${campDef.campaign_name}"`)

    const adSetResults = []

    for (const adSetDef of campDef.ad_sets) {
      const targeting = (isRetargeting && retargetAudienceId)
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
        bid_strategy:      'LOWEST_COST_WITHOUT_CAP',
        targeting,
        status,
      }
      // CBO campaigns manage budget at the campaign level — no adset budget needed
      if (!campDef.cbo && adSetDef.budget_daily) {
        adSetBody.daily_budget = Math.round(adSetDef.budget_daily * 100)
      }
      if (promotedObject) adSetBody.promoted_object = promotedObject

      const adset = await api('POST', `/act_${ACCOUNT_ID}/adsets`, adSetBody)
      const budgetLabel = campDef.cbo ? 'CBO' : `$${adSetDef.budget_daily}/day`
      log(`\n  ✓ Ad Set: ${adset.id}  "${adSetDef.ad_set_name}"  (${budgetLabel})`)

      if (isRetargeting && !retargetAudienceId) {
        log(`    ⚠  Using broad targeting (no custom audience found)`)
      }

      // Upload 9:16 rewarded video once per ad set
      let rwVideoId = null, rwThumbHash = null
      if (rewardedVidPath) {
        log(`    Uploading rewarded video: ${path.basename(rewardedVidPath)}`)
        rwVideoId = await uploadVideo(rewardedVidPath)
        log(`      ✓ rewarded video_id: ${rwVideoId}`)
        const rwThumb = findThumbnail(rewardedVidPath, dirFinal, globalThumb)
        if (rwThumb) { rwThumbHash = await uploadImage(rwThumb); log(`      ✓ rewarded thumb  : ${rwThumbHash}`) }
      }

      const adResults = []

      for (const adDef of adSetDef.ads) {
        const filePath = findCreativeFile(adDef.filename, searchDirs)
        if (!filePath) {
          if (DRY_RUN) { log(`\n    [DRY-RUN] ⚠  File not found: ${adDef.filename} — skipping`); continue }
          throw new Error(`Creative file not found: ${adDef.filename}\n  Searched in: ${frDir}`)
        }

        const fileType = isVideo(filePath) ? 'video' : 'image'
        log(`\n    [${adDef.ad_name}]  ${adDef.filename} (${fileType})`)

        let creativePayload

        if (isVideo(filePath)) {
          const thumbPath = findThumbnail(filePath, dirFinal, globalThumb)
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
