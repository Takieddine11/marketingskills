#!/usr/bin/env node
const fs = require('fs')
const path = require('path')
const TOKEN = process.env.META_ACCESS_TOKEN
const RAW_ACCOUNT_ID = process.env.META_AD_ACCOUNT_ID || ''
const ACCOUNT_ID = RAW_ACCOUNT_ID.replace(/^act_/, '') || '2189765574795573'
const BASE_URL = 'https://graph.facebook.com/v22.0'
const PAGE_ID = '676813882182100'
const INSTAGRAM_ACTOR_ID = '9623717551054024'
const PIXEL_ID = '1173962951224451'
const COPY_TRAFFIC = {
  headline: 'Ne voudriez-vous pas récupérer 10 heures par mois?',
  body: `Si vous êtes entrepreneur ou propriétaire d'une petite entreprise, vous faites peut-être face à un problème.\nVos livres sont en désordre et vous passez trop de temps à essayer de les gérer.\nVous manquez peut-être des délais de production, vous ignorez vos marges bénéficiaires et vous vivez avec la crainte de faire des erreurs menant à des vérifications et pénalités gouvernementales.\nSaviez-vous que de nombreuses entreprises échouent à cause d'une mauvaise gestion financière?\nCe n'est pas juste une question de chiffres — c'est le stress, l'inquiétude et l'incertitude sur la situation financière réelle de votre entreprise.\nImaginez un propriétaire comme vous : une belle opération, mais toujours en retard sur sa comptabilité. Des échéances fiscales manquées, des marges inconnues. Un stress constant.\nVous pensez peut-être qu'engager un comptable à temps plein est la solution. Mais c'est coûteux et pas toujours adapté aux PME.\nIl semble parfois qu'il n'y ait pas de bonne solution. Comme si vous étiez pris dans un cycle de confusion financière.\nMais ce n'est pas le cas.\nVoici la Fondation à 3 Piliers — un système conçu pour les petites entreprises.\nIl vous offre de la visibilité, assure votre conformité et vous remet aux commandes de vos finances. Et le meilleur? C'est fait pour vous.\nAvec notre système, vous pouvez :\n- Maintenir des livres propres et organisés\n- Respecter chaque échéance\n- Savoir exactement où se situe votre entreprise financièrement\n- Être soutenu par une équipe de CPA de confiance\nRéservez dès maintenant une consultation stratégique gratuite de 30 minutes — sans engagement.\n👉 zentax.pro/funnel-2\nSi ce n'est pas pour vous, pas de problème. Mais si vous ne faites rien, la confusion financière continue.\nVotre entreprise le mérite. Agissez maintenant.\n👉 zentax.pro/funnel-2`,
  link_url: 'https://zentax.pro/funnel-2',
  campaign_name: 'Zentax - Trafic QC FR',
  adset_name: 'Entrepreneurs QC FR - Trafic',
}
const COPY_RETARGET = {
  headline: 'Encore là? Votre consultation gratuite vous attend.',
  body: `Vous avez visité zentax.pro récemment.\n\nSi vous avez hésité, c'est correct. Mais la confusion financière ne se règle pas toute seule.\n\nDes livres en retard. Des échéances fiscales qui approchent. Des marges que vous n'arrivez pas à calculer.\n\nNos CPA ont déjà aidé des dizaines de PME québécoises à reprendre le contrôle — rapidement, sans casse-tête.\n\nRéservez votre consultation stratégique gratuite de 30 minutes. Sans engagement. Sans pression.\n\n👉 zentax.pro/funnel-2`,
  link_url: 'https://zentax.pro/funnel-2',
  campaign_name: 'Zentax - Retargeting QC FR',
  adset_name: 'Visiteurs Web QC FR - Retargeting',
}
const COPY_FUNNEL = {
  headline: '30 minutes avec un CPA peut changer votre entreprise',
  body: `Vous gérez une PME au Québec?\n\nSi vos livres ne sont pas à jour, si vous ignorez vos marges réelles, si les échéances fiscales vous stressent — vous n'êtes pas seul.\n\nLa plupart des PME perdent des milliers de dollars chaque année à cause d'une mauvaise gestion comptable. Ce n'est pas de la négligence — c'est un manque de système.\n\nZentax offre la Fondation à 3 Piliers : un système simple et complet, conçu pour les entrepreneurs comme vous.\n\n✅ Livres propres et à jour\n✅ Conformité garantie\n✅ Visibilité totale sur vos finances\n✅ Équipe de CPA dédiée\n\nConsultez un expert gratuitement. 30 minutes. Zéro engagement.\n\n👉 zentax.pro/funnel-2\n\nAgissez avant que les délais fiscaux ne vous rattrapent.`,
  link_url: 'https://zentax.pro/funnel-2',
  campaign_name: 'Zentax - Funnel Complet QC FR',
  adset_name: 'Entrepreneurs QC FR - Funnel',
}
const BASE_GEO = { geo_locations: { regions: [{ key: '535' }] }, locales: [44], age_min: 25 }
const TARGETING_TRAFFIC = { ...BASE_GEO }
function targetingRetarget(audienceId) {
  return { ...BASE_GEO, custom_audiences: [{ id: audienceId }] }
}
const TARGETING_FUNNEL = { ...BASE_GEO, age_min: 24 }
function parseArgs(argv) {
  const result = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg.startsWith('--')) {
      const key = arg.slice(2)
      const next = argv[i + 1]
      if (next && !next.startsWith('--')) { result[key] = next; i++ }
      else result[key] = true
    } else result._.push(arg)
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
      if (Array.isArray(v) || (typeof v === 'object' && v !== null)) params.append(k, JSON.stringify(v))
      else params.append(k, String(v))
    }
  }
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params.toString() })
  const data = await res.json()
  if (data.error) throw new Error(`Meta API: ${JSON.stringify(data.error)}`)
  return data
}
function isVideo(filePath) { return /\.(mp4|mov)$/i.test(filePath) }
function findThumbnail(videoPath, fallbackDir, globalThumbnail) {
  const base = videoPath.replace(/\.(mp4|mov)$/i, '')
  for (const ext of ['.jpg', '.jpeg', '.png']) {
    if (fs.existsSync(base + ext)) return base + ext
  }
  const sameDir = path.dirname(videoPath)
  const anyInSame = fs.readdirSync(sameDir).find(f => /\.(jpe?g|png)$/i.test(f))
  if (anyInSame) return path.join(sameDir, anyInSame)
  if (fallbackDir && fallbackDir !== sameDir) {
    const anyInFallback = fs.readdirSync(fallbackDir).find(f => /\.(jpe?g|png)$/i.test(f))
    if (anyInFallback) return path.join(fallbackDir, anyInFallback)
  }
  if (globalThumbnail) return globalThumbnail
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
  const res = await fetch(`${BASE_URL}/act_${ACCOUNT_ID}/adimages`, { method: 'POST', headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` }, body })
  const data = await res.json()
  if (data.error) throw new Error(`Image upload (${filename}): ${data.error.message}`)
  const key = Object.keys(data.images)[0]
  return data.images[key].hash
}
async function uploadVideo(videoPath) {
  const filename = path.basename(videoPath)
  if (DRY_RUN) { log(`[DRY-RUN] Upload video: ${filename}`); return `DRY_VIDEO_ID_${Math.random().toString(36).slice(2, 10).toUpperCase()}` }
  const mime = /\.mov$/i.test(videoPath) ? 'video/quicktime' : 'video/mp4'
  const { body, boundary } = buildMultipart({ access_token: TOKEN, title: filename }, 'source', filename, mime, fs.readFileSync(videoPath))
  const res = await fetch(`${BASE_URL}/act_${ACCOUNT_ID}/advideos`, { method: 'POST', headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` }, body })
  const data = await res.json()
  if (data.error) throw new Error(`Video upload (${filename}): ${data.error.message}`)
  return data.id
}
function getCreatives(dir) {
  if (!fs.existsSync(dir)) throw new Error(`Directory not found: ${dir}`)
  const allFiles = fs.readdirSync(dir).filter(f => /\.(jpe?g|png|mp4|mov)$/i.test(f))
  const videoBasenames = new Set(allFiles.filter(f => /\.(mp4|mov)$/i.test(f)).map(f => f.replace(/\.(mp4|mov)$/i, '').toLowerCase()))
  return allFiles.filter(f => {
    if (/\.(jpe?g|png)$/i.test(f)) {
      const base = f.replace(/\.(jpe?g|png)$/i, '').toLowerCase()
      if (videoBasenames.has(base)) return false
    }
    return true
  }).map(f => path.join(dir, f)).sort()
}
async function runCampaign({ copy, targeting, objective, optimizationGoal, pixelId, creatives, status, dailyBudgetCents, label, thumbnailFallbackDir, globalThumbnail }) {
  const ADS_PER_ADSET = 50
  const chunks = []
  for (let i = 0; i < creatives.length; i += ADS_PER_ADSET) chunks.push(creatives.slice(i, i + ADS_PER_ADSET))
  log(`\n${'─'.repeat(51)}\n  ${label}\n${'─'.repeat(51)}`)
  const campaign = await api('POST', `/act_${ACCOUNT_ID}/campaigns`, {
    name: copy.campaign_name,
    objective,
    status,
    special_ad_categories: [],
    is_adset_budget_sharing_enabled: false,
  })
  log(`  ✓ Campaign: ${campaign.id}  "${copy.campaign_name}"`)
  const adsetIds = []
  const adResults = []
  for (let chunkIdx = 0; chunkIdx < chunks.length; chunkIdx++) {
    const chunk = chunks[chunkIdx]
    const adsetName = chunks.length > 1 ? `${copy.adset_name} - Part ${chunkIdx + 1}` : copy.adset_name
    const adsetBody = {
      name: adsetName,
      campaign_id: campaign.id,
      billing_event: 'IMPRESSIONS',
      optimization_goal: optimizationGoal,
      daily_budget: dailyBudgetCents,
      bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
      targeting,
      status,
    }
    if (pixelId) {
      adsetBody.promoted_object = { pixel_id: pixelId, custom_event_type: 'LEAD' }
    }
    const adset = await api('POST', `/act_${ACCOUNT_ID}/adsets`, adsetBody)
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
        const thumbPath = findThumbnail(filePath, thumbnailFallbackDir, globalThumbnail)
        if (!thumbPath) throw new Error(`No thumbnail found for ${path.basename(filePath)}.`)
        const videoId = await uploadVideo(filePath)
        log(`      ✓ video_id  : ${videoId}`)
        const thumbHash = await uploadImage(thumbPath)
        log(`      ✓ thumbnail : ${thumbHash} (${path.basename(thumbPath)})`)
        storySpec = { page_id: PAGE_ID, instagram_actor_id: INSTAGRAM_ACTOR_ID, video_data: { video_id: videoId, image_hash: thumbHash, message: copy.body, title: copy.headline, call_to_action: { type: 'LEARN_MORE', value: { link: copy.link_url } } } }
      } else {
        const imageHash = await uploadImage(filePath)
        log(`      ✓ image_hash: ${imageHash}`)
        storySpec = { page_id: PAGE_ID, instagram_actor_id: INSTAGRAM_ACTOR_ID, link_data: { image_hash: imageHash, link: copy.link_url, message: copy.body, name: copy.headline, call_to_action: { type: 'LEARN_MORE', value: { link: copy.link_url } } } }
      }
      const creative = await api('POST', `/act_${ACCOUNT_ID}/adcreatives`, { name: `${adLabel} Creative`, object_story_spec: storySpec })
      log(`      ✓ creative  : ${creative.id}`)
      const ad = await api('POST', `/act_${ACCOUNT_ID}/ads`, { name: adLabel, adset_id: adset.id, creative: { creative_id: creative.id }, status })
      log(`      ✓ ad        : ${ad.id}`)
      adResults.push({ file: path.basename(filePath), adset_id: adset.id, creative_id: creative.id, ad_id: ad.id })
    }
  }
  return { campaign, adsetIds, adResults }
}
async function main() {
  if (!TOKEN && !DRY_RUN) { console.error('Error: META_ACCESS_TOKEN is not set.'); process.exit(1) }
  const frDir = args['fr-dir']
  if (!frDir) { console.error('Error: --fr-dir is required.'); process.exit(1) }
  const creatives = getCreatives(frDir)
  if (creatives.length === 0) { console.error(`No creatives found in: ${frDir}`); process.exit(1) }
  const retargetDir = args['retarget-dir'] || frDir
  const retargetCreatives = getCreatives(retargetDir)
  const dailyBudget = parseFloat(args['daily-budget'] || '100')
  const dailyBudgetCents = Math.round(dailyBudget * 100)
  const status = args.status || 'PAUSED'
  const retargetAudienceId = args['retarget-audience-id']
  const skipTraffic  = !!args['skip-traffic']
  const skipRetarget = !!args['skip-retarget']
  const skipFunnel   = !!args['skip-funnel']
  const globalThumbnail = args['thumbnail'] || null
  const planned = [!skipTraffic && 'Traffic', !skipRetarget && retargetAudienceId && 'Retargeting', !skipFunnel && 'Full Funnel'].filter(Boolean)
  log(`\n${'═'.repeat(51)}\n  Zentax Campaign Launcher${DRY_RUN ? ' [DRY RUN]' : ''}\n${'═'.repeat(51)}`)
  log(`  Account    : act_${ACCOUNT_ID}\n  Budget     : $${dailyBudget} CAD/day per ad set\n  Status     : ${status}`)
  log(`  Traffic/Funnel creatives : ${creatives.length} — ${frDir}`)
  log(`  Retargeting creatives    : ${retargetCreatives.length} — ${retargetDir}`)
  log(`  Campaigns  : ${planned.join(' + ') || '(none selected)'}\n${'═'.repeat(51)}`)
  const allResults = []
  let step = 1
  const total = planned.length
  if (!skipTraffic) {
    allResults.push({ name: 'Traffic', ...await runCampaign({ label: `${step++}/${total}  TRAFFIC — Cold Quebec/French audience`, copy: COPY_TRAFFIC, targeting: TARGETING_TRAFFIC, objective: 'OUTCOME_TRAFFIC', optimizationGoal: 'LANDING_PAGE_VIEWS', creatives, status, dailyBudgetCents, thumbnailFallbackDir: retargetDir, globalThumbnail }) })
  } else log(`\n  ↷  Skipping Traffic campaign (--skip-traffic)`)
  if (!skipRetarget) {
    if (retargetAudienceId) {
      allResults.push({ name: 'Retargeting', ...await runCampaign({ label: `${step++}/${total}  RETARGETING — Website visitors`, copy: COPY_RETARGET, targeting: targetingRetarget(retargetAudienceId), objective: 'OUTCOME_LEADS', optimizationGoal: 'OFFSITE_CONVERSIONS', pixelId: PIXEL_ID, creatives: retargetCreatives, status, dailyBudgetCents, thumbnailFallbackDir: retargetDir, globalThumbnail }) })
    } else log(`\n  ⚠   Skipping Retargeting — pass --retarget-audience-id <id> to enable it.`)
  } else log(`\n  ↷  Skipping Retargeting campaign (--skip-retarget)`)
  if (!skipFunnel) {
    allResults.push({ name: 'Full Funnel', ...await runCampaign({ label: `${step++}/${total}  FULL FUNNEL — Conversion-focused, broader targeting`, copy: COPY_FUNNEL, targeting: TARGETING_FUNNEL, objective: 'OUTCOME_LEADS', optimizationGoal: 'OFFSITE_CONVERSIONS', pixelId: PIXEL_ID, creatives, status, dailyBudgetCents, thumbnailFallbackDir: retargetDir, globalThumbnail }) })
  } else log(`\n  ↷  Skipping Full Funnel campaign (--skip-funnel)`)
  log(`\n${'═'.repeat(51)}\n  All done!\n${'═'.repeat(51)}`)
  for (const r of allResults) {
    log(`\n  [${r.name}] Campaign ID: ${r.campaign.id}`)
    log(`    Ad sets (${r.adsetIds.length}): ${r.adsetIds.join(', ')}`)
    log(`    Ads created: ${r.adResults.length}`)
  }
  log(`\n  All ads are ${status}. Review in Meta Ads Manager,\n  then activate when ready.\n  https://adsmanager.facebook.com/\n${'═'.repeat(51)}\n`)
}
async function findTargeting() {
  if (!TOKEN) { console.error('Error: META_ACCESS_TOKEN is not set.'); process.exit(1) }
  console.log('\n Looking up correct targeting keys from Meta API...\n')
  const geoRes = await fetch(`${BASE_URL}/search?type=adgeolocation&q=Quebec&location_types=%5B%22region%22%5D&country_code=CA&access_token=${TOKEN}`)
  const geoData = await geoRes.json()
  console.log('=== Quebec region results ===')
  if (geoData.data && geoData.data.length > 0) geoData.data.forEach(r => console.log(`  key: "${r.key}"  name: "${r.name}"  country: "${r.country_code || r.country}"`))
  else console.log('  No results or error:', JSON.stringify(geoData))
  const localeRes = await fetch(`${BASE_URL}/search?type=adlocale&q=French&access_token=${TOKEN}`)
  const localeData = await localeRes.json()
  console.log('\n=== French locale results ===')
  if (localeData.data && localeData.data.length > 0) localeData.data.forEach(r => console.log(`  key: ${r.key}  name: "${r.name}"`))
  else console.log('  No results or error:', JSON.stringify(localeData))
  console.log('\nDone.\n')
}
if (args['find-targeting']) findTargeting().catch(err => { console.error(err.message); process.exit(1) })
else main().catch(err => { console.error('\nFatal error:', err.message); process.exit(1) })
