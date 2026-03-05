#!/usr/bin/env node
/**
 * Meta Ads Audit & Optimization Script
 * Pulls campaign data and identifies optimization opportunities.
 *
 * Usage:
 *   node meta-ads-audit.js --token=YOUR_TOKEN --account=act_XXXX
 *   node meta-ads-audit.js --token=YOUR_TOKEN --account=act_XXXX --days=30
 */

const https = require("https");

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v];
  })
);

const TOKEN = args.token;
const ACCOUNT = args.account;
const DAYS = parseInt(args.days || "30", 10);
const API_VERSION = "v18.0";
const BASE = `https://graph.facebook.com/${API_VERSION}`;

if (!TOKEN || !ACCOUNT) {
  console.log(`
Meta Ads Audit & Optimization
==============================
Usage:
  node meta-ads-audit.js --token=YOUR_ACCESS_TOKEN --account=act_XXXX [--days=30]

Options:
  --token    Meta access token (required)
  --account  Ad account ID with act_ prefix (required)
  --days     Lookback window in days (default: 30)
`);
  process.exit(0);
}

function fetch(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error(`JSON parse error: ${data.slice(0, 200)}`));
          }
        });
      })
      .on("error", reject);
  });
}

async function fetchAll(url) {
  const results = [];
  let nextUrl = url;
  while (nextUrl) {
    const resp = await fetch(nextUrl);
    if (resp.error) throw new Error(`API Error: ${resp.error.message}`);
    if (resp.data) results.push(...resp.data);
    nextUrl = resp.paging?.next || null;
  }
  return results;
}

function fmt(n, decimals = 2) {
  if (n == null || isNaN(n)) return "-";
  return Number(n).toFixed(decimals);
}

function fmtMoney(n) {
  if (n == null || isNaN(n)) return "-";
  return "$" + Number(n).toFixed(2);
}

function getActionValue(actions, type) {
  if (!actions) return null;
  const a = actions.find((x) => x.action_type === type);
  return a ? parseFloat(a.value) : null;
}

function printSection(title) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  ${title}`);
  console.log("=".repeat(60));
}

function printTable(headers, rows) {
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => String(r[i] || "").length))
  );
  const sep = widths.map((w) => "-".repeat(w + 2)).join("+");
  const fmtRow = (r) =>
    r.map((c, i) => ` ${String(c || "").padEnd(widths[i])} `).join("|");

  console.log(fmtRow(headers));
  console.log(sep);
  rows.forEach((r) => console.log(fmtRow(r)));
}

async function run() {
  console.log(`\nMeta Ads Audit — ${ACCOUNT} — Last ${DAYS} days`);
  console.log("Fetching data...\n");

  // 1. Account info
  const acct = await fetch(
    `${BASE}/${ACCOUNT}?access_token=${TOKEN}&fields=name,account_status,currency,timezone_name,amount_spent`
  );
  if (acct.error) {
    console.error(`Error: ${acct.error.message}`);
    process.exit(1);
  }
  const statusMap = { 1: "ACTIVE", 2: "DISABLED", 3: "UNSETTLED", 7: "PENDING_REVIEW" };
  console.log(`Account: ${acct.name}`);
  console.log(`Status: ${statusMap[acct.account_status] || acct.account_status}`);
  console.log(`Currency: ${acct.currency}`);
  console.log(`Timezone: ${acct.timezone_name}`);

  // 2. Campaigns
  const campaigns = await fetchAll(
    `${BASE}/${ACCOUNT}/campaigns?access_token=${TOKEN}&fields=id,name,status,objective,daily_budget,lifetime_budget,start_time&limit=100`
  );
  console.log(`\nFound ${campaigns.length} campaigns`);

  const activeCampaigns = campaigns.filter((c) => c.status === "ACTIVE");
  const pausedCampaigns = campaigns.filter((c) => c.status === "PAUSED");
  console.log(`  Active: ${activeCampaigns.length} | Paused: ${pausedCampaigns.length} | Other: ${campaigns.length - activeCampaigns.length - pausedCampaigns.length}`);

  // 3. Campaign insights
  const datePreset = DAYS <= 7 ? "last_7d" : DAYS <= 14 ? "last_14d" : "last_30d";
  const insightsFields = "campaign_id,campaign_name,impressions,reach,clicks,spend,cpm,cpc,ctr,actions,cost_per_action_type,frequency";

  const insights = await fetchAll(
    `${BASE}/${ACCOUNT}/insights?access_token=${TOKEN}&fields=${insightsFields}&level=campaign&date_preset=${datePreset}&limit=100`
  );

  if (insights.length === 0) {
    console.log("\nNo campaign data found for this period. Try a longer --days window.");
    return;
  }

  // 4. Campaign Performance Table
  printSection("CAMPAIGN PERFORMANCE");

  const campaignRows = insights
    .map((i) => {
      const conversions = getActionValue(i.actions, "offsite_conversion") ||
        getActionValue(i.actions, "lead") ||
        getActionValue(i.actions, "purchase") ||
        getActionValue(i.actions, "complete_registration") ||
        getActionValue(i.actions, "omni_purchase") || 0;
      const cpa = conversions > 0 ? parseFloat(i.spend) / conversions : null;
      return {
        name: (i.campaign_name || "").slice(0, 35),
        spend: parseFloat(i.spend || 0),
        impressions: parseInt(i.impressions || 0),
        clicks: parseInt(i.clicks || 0),
        ctr: parseFloat(i.ctr || 0),
        cpc: parseFloat(i.cpc || 0),
        cpm: parseFloat(i.cpm || 0),
        frequency: parseFloat(i.frequency || 0),
        conversions,
        cpa,
      };
    })
    .sort((a, b) => b.spend - a.spend);

  printTable(
    ["Campaign", "Spend", "Impr", "Clicks", "CTR%", "CPC", "CPM", "Freq", "Conv", "CPA"],
    campaignRows.map((r) => [
      r.name,
      fmtMoney(r.spend),
      r.impressions.toLocaleString(),
      r.clicks.toLocaleString(),
      fmt(r.ctr),
      fmtMoney(r.cpc),
      fmtMoney(r.cpm),
      fmt(r.frequency, 1),
      r.conversions || "-",
      r.cpa ? fmtMoney(r.cpa) : "-",
    ])
  );

  // 5. Ad Set level insights
  printSection("AD SET PERFORMANCE");

  const adsetInsights = await fetchAll(
    `${BASE}/${ACCOUNT}/insights?access_token=${TOKEN}&fields=adset_id,adset_name,impressions,clicks,spend,ctr,cpc,cpm,frequency,actions,cost_per_action_type&level=adset&date_preset=${datePreset}&limit=200`
  );

  if (adsetInsights.length > 0) {
    const adsetRows = adsetInsights
      .map((i) => {
        const conversions = getActionValue(i.actions, "offsite_conversion") ||
          getActionValue(i.actions, "lead") ||
          getActionValue(i.actions, "purchase") ||
          getActionValue(i.actions, "complete_registration") || 0;
        const cpa = conversions > 0 ? parseFloat(i.spend) / conversions : null;
        return {
          name: (i.adset_name || "").slice(0, 35),
          spend: parseFloat(i.spend || 0),
          clicks: parseInt(i.clicks || 0),
          ctr: parseFloat(i.ctr || 0),
          cpc: parseFloat(i.cpc || 0),
          frequency: parseFloat(i.frequency || 0),
          conversions,
          cpa,
        };
      })
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 20);

    printTable(
      ["Ad Set", "Spend", "Clicks", "CTR%", "CPC", "Freq", "Conv", "CPA"],
      adsetRows.map((r) => [
        r.name,
        fmtMoney(r.spend),
        r.clicks.toLocaleString(),
        fmt(r.ctr),
        fmtMoney(r.cpc),
        fmt(r.frequency, 1),
        r.conversions || "-",
        r.cpa ? fmtMoney(r.cpa) : "-",
      ])
    );
  }

  // 6. Ad level insights
  printSection("TOP ADS BY SPEND");

  const adInsights = await fetchAll(
    `${BASE}/${ACCOUNT}/insights?access_token=${TOKEN}&fields=ad_id,ad_name,impressions,clicks,spend,ctr,cpc,frequency,actions&level=ad&date_preset=${datePreset}&limit=200`
  );

  if (adInsights.length > 0) {
    const adRows = adInsights
      .map((i) => {
        const conversions = getActionValue(i.actions, "offsite_conversion") ||
          getActionValue(i.actions, "lead") ||
          getActionValue(i.actions, "purchase") ||
          getActionValue(i.actions, "complete_registration") || 0;
        return {
          name: (i.ad_name || "").slice(0, 40),
          spend: parseFloat(i.spend || 0),
          clicks: parseInt(i.clicks || 0),
          ctr: parseFloat(i.ctr || 0),
          cpc: parseFloat(i.cpc || 0),
          frequency: parseFloat(i.frequency || 0),
          conversions,
        };
      })
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 15);

    printTable(
      ["Ad", "Spend", "Clicks", "CTR%", "CPC", "Freq", "Conv"],
      adRows.map((r) => [
        r.name,
        fmtMoney(r.spend),
        r.clicks.toLocaleString(),
        fmt(r.ctr),
        fmtMoney(r.cpc),
        fmt(r.frequency, 1),
        r.conversions || "-",
      ])
    );
  }

  // 7. Optimization recommendations
  printSection("OPTIMIZATION RECOMMENDATIONS");

  const totalSpend = campaignRows.reduce((s, r) => s + r.spend, 0);
  const totalConversions = campaignRows.reduce((s, r) => s + r.conversions, 0);
  const avgCtr = campaignRows.reduce((s, r) => s + r.ctr * r.spend, 0) / (totalSpend || 1);
  const blendedCpa = totalConversions > 0 ? totalSpend / totalConversions : null;

  console.log(`\nSummary: ${fmtMoney(totalSpend)} spent | ${totalConversions} conversions | Blended CPA: ${blendedCpa ? fmtMoney(blendedCpa) : "N/A"} | Avg CTR: ${fmt(avgCtr)}%\n`);

  let recNum = 1;

  // High frequency (ad fatigue)
  const fatigued = campaignRows.filter((r) => r.frequency > 3.0 && r.spend > 10);
  if (fatigued.length > 0) {
    console.log(`${recNum}. AD FATIGUE WARNING`);
    fatigued.forEach((r) => {
      console.log(`   - "${r.name}" has frequency ${fmt(r.frequency, 1)}x — audience seeing ads too often`);
      console.log(`     → Refresh creative, expand audience, or reduce budget`);
    });
    recNum++;
  }

  // Low CTR campaigns
  const lowCtr = campaignRows.filter((r) => r.ctr < 1.0 && r.spend > 10);
  if (lowCtr.length > 0) {
    console.log(`${recNum}. LOW CTR (<1%)`);
    lowCtr.forEach((r) => {
      console.log(`   - "${r.name}" CTR: ${fmt(r.ctr)}% — creative or targeting mismatch`);
      console.log(`     → Test new ad hooks/angles, tighten audience targeting`);
    });
    recNum++;
  }

  // High CPA campaigns (50%+ above average)
  if (blendedCpa) {
    const highCpa = campaignRows.filter((r) => r.cpa && r.cpa > blendedCpa * 1.5);
    if (highCpa.length > 0) {
      console.log(`${recNum}. HIGH CPA CAMPAIGNS (>50% above avg ${fmtMoney(blendedCpa)})`);
      highCpa.forEach((r) => {
        console.log(`   - "${r.name}" CPA: ${fmtMoney(r.cpa)} — ${fmt((r.cpa / blendedCpa - 1) * 100, 0)}% above average`);
        console.log(`     → Consider pausing or restructuring. Check landing page conversion rate.`);
      });
      recNum++;
    }
  }

  // Zero-conversion campaigns with spend
  const zeroCov = campaignRows.filter((r) => r.conversions === 0 && r.spend > 20);
  if (zeroCov.length > 0) {
    console.log(`${recNum}. SPENDING WITHOUT CONVERSIONS`);
    zeroCov.forEach((r) => {
      console.log(`   - "${r.name}" spent ${fmtMoney(r.spend)} with 0 conversions`);
      console.log(`     → Verify pixel/conversion tracking. If tracking is correct, pause and reallocate.`);
    });
    recNum++;
  }

  // Budget concentration
  if (campaignRows.length > 1 && totalSpend > 0) {
    const topSpender = campaignRows[0];
    const topPct = (topSpender.spend / totalSpend) * 100;
    if (topPct > 70) {
      console.log(`${recNum}. BUDGET CONCENTRATION`);
      console.log(`   - "${topSpender.name}" takes ${fmt(topPct, 0)}% of total spend`);
      console.log(`     → Diversify if this campaign has diminishing returns. Test new audiences.`);
      recNum++;
    }
  }

  // High CPM
  const highCpm = campaignRows.filter((r) => r.cpm > 30 && r.spend > 10);
  if (highCpm.length > 0) {
    console.log(`${recNum}. HIGH CPM (>$30)`);
    highCpm.forEach((r) => {
      console.log(`   - "${r.name}" CPM: ${fmtMoney(r.cpm)} — expensive impressions`);
      console.log(`     → Expand targeting, try different placements, improve ad relevance`);
    });
    recNum++;
  }

  if (recNum === 1) {
    console.log("No major issues detected. Campaigns look healthy overall.");
  }

  // 8. Quick wins
  printSection("QUICK WINS");
  console.log(`
1. Pause underperformers: Kill campaigns with high CPA and no path to improvement
2. Scale winners: Increase budget 20-30% on best CPA campaigns (wait 3-5 days between changes)
3. Refresh creative: Any ad running 2+ weeks needs new variants
4. Exclude converters: Add converted users to exclusion audiences to stop wasting spend
5. Check mobile vs desktop: Break down by placement to find hidden waste
`);

  // 9. Revoke token reminder
  console.log("=".repeat(60));
  console.log("  SECURITY REMINDER: Revoke this access token when done!");
  console.log("  Meta Business Suite → System Users → Revoke tokens");
  console.log("=".repeat(60));
}

run().catch((err) => {
  console.error(`\nError: ${err.message}`);
  process.exit(1);
});
