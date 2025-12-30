const https = require('https');
const fs = require('fs');
const path = require('path');

// Create directories if they don't exist
const manifestsDir = path.join(__dirname, 'manifests');
const changelogsDir = path.join(__dirname, 'changelogs');

if (!fs.existsSync(manifestsDir)) {
  fs.mkdirSync(manifestsDir, { recursive: true });
}

if (!fs.existsSync(changelogsDir)) {
  fs.mkdirSync(changelogsDir, { recursive: true });
}

// Helper function to make HTTPS requests
function fetchData(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Failed to parse JSON from ${url}: ${e.message}`));
        }
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

// Helper function to wait
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper function to save JSON to file
function saveToFile(directory, filename, data) {
  const filepath = path.join(directory, filename);
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
  console.log(`Saved: ${filepath}`);
}

// Main function
async function fetchAllApps() {
  let offset = 0;
  const limit = 12;
  let totalApps = 0;
  let fetchedApps = 0;

  try {
    while (true) {
      const browseUrl = `https://apps-api.athom.com/api/v1/app/browse?query=&language=nl&platform%5B%5D=local&limit=${limit}&offset=${offset}`;
      console.log(`\nFetching apps list (offset: ${offset})...`);
      
      const browseData = await fetchData(browseUrl);
      
      if (totalApps === 0) {
        totalApps = browseData.total;
        console.log(`Total apps to fetch: ${totalApps}`);
      }
      
      const apps = browseData.items;
      
      if (!apps || apps.length === 0) {
        console.log('No more apps to fetch.');
        break;
      }
      
      console.log(`Retrieved ${apps.length} apps`);
      
      // Process each app
      for (const app of apps) {
        const appId = app.id;
        console.log(`\nProcessing app: ${app.name} (${appId})`);
        
        // Fetch app manifest
        try {
          await wait(500);
          const manifestUrl = `https://apps-api.athom.com/api/v1/app/${appId}`;
          console.log(`  Fetching manifest...`);
          const manifest = await fetchData(manifestUrl);
          saveToFile(manifestsDir, `${appId}.json`, manifest);
        } catch (err) {
          console.error(`  Error fetching manifest for ${appId}:`, err.message);
        }
        
        // Fetch app changelog
        try {
          await wait(500);
          const changelogUrl = `https://apps-api.athom.com/api/v1/app/${appId}/changelog`;
          console.log(`  Fetching changelog...`);
          const changelog = await fetchData(changelogUrl);
          saveToFile(changelogsDir, `${appId}.json`, changelog);
        } catch (err) {
          console.error(`  Error fetching changelog for ${appId}:`, err.message);
        }
        
        fetchedApps++;
      }
      
      // Move to next page
      offset += limit;
      
      // Check if we've fetched all apps
      if (fetchedApps >= totalApps) {
        console.log('\nAll apps fetched!');
        break;
      }
      
      // Wait before fetching next batch
      await wait(500);
    }
    
    console.log(`\n=== Summary ===`);
    console.log(`Total apps processed: ${fetchedApps}`);
    console.log(`Manifests saved to: ${manifestsDir}`);
    console.log(`Changelogs saved to: ${changelogsDir}`);
    
  } catch (err) {
    console.error('Fatal error:', err);
    process.exit(1);
  }
}

// Run the script
console.log('Starting Athom Apps Fetcher...');
fetchAllApps();