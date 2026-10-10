const https = require('https');
const fs = require('fs');
const path = require('path');

// Change this to your deployed Pages URL if needed (e.g., https://aaru-gallery.pages.dev)
const PAGES_DOMAIN = process.argv[2] || 'https://aaru-gallery.pages.dev';
const url = `${PAGES_DOMAIN}/api/selections`;

function fetchPicks(u) {
  console.log(`Connecting to Cloudflare KV at: ${u}...`);
  https.get(u, (res) => {
    if (res.headers.location) {
      return fetchPicks(res.headers.location);
    }
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        const json = JSON.parse(data);
        const picks = json.picks || [];
        
        console.log(`\n========================================`);
        console.log(`   AARU'S CLOUDFLARE KV PICKS REPORT    `);
        console.log(`========================================`);
        console.log(`Total Swiped / Processed: ${picks.length}`);

        const superLoved = picks.filter(p => p.status === 'super' || p.status === 'super_loved');
        const loved = picks.filter(p => p.status === 'loved');
        const passed = picks.filter(p => p.status === 'passed');

        console.log(`⭐ Super Loved: ${superLoved.length}`);
        console.log(`❤️ Loved:       ${loved.length}`);
        console.log(`❌ Passed:      ${passed.length}`);
        console.log(`========================================\n`);

        if (superLoved.length > 0) {
          console.log(`--- ⭐ SUPER LOVED (${superLoved.length}) ---`);
          superLoved.forEach((p, idx) => {
            console.log(`${idx + 1}. Photo #${p.displayNumber || p.number} [${p.name}] ${p.note ? '📝 Note: "' + p.note + '"' : ''}`);
          });
          console.log('');
        }

        if (loved.length > 0) {
          console.log(`--- ❤️ LOVED (${loved.length}) ---`);
          loved.forEach((p, idx) => {
            console.log(`${idx + 1}. Photo #${p.displayNumber || p.number} [${p.name}] ${p.note ? '📝 Note: "' + p.note + '"' : ''}`);
          });
          console.log('');
        }

        if (passed.length > 0) {
          console.log(`--- ❌ PASSED (${passed.length}) ---`);
          passed.forEach((p, idx) => {
            console.log(`${idx + 1}. Photo #${p.displayNumber || p.number} [${p.name}]`);
          });
          console.log('');
        }

        // Save local copy for offline viewing
        const outputPath = path.join(__dirname, 'her_current_picks.json');
        fs.writeFileSync(outputPath, JSON.stringify(picks, null, 2));
        console.log(`[Saved latest picks to: her_current_picks.json]`);

      } catch (err) {
        console.error('Failed to parse response:', err.message, data.slice(0, 300));
      }
    });
  }).on('error', err => console.error('Fetch error:', err.message));
}

fetchPicks(url);
