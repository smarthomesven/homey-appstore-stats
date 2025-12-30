const fs = require('fs');
const path = require('path');

const manifestsDir = path.join(__dirname, 'manifests');
const changelogsDir = path.join(__dirname, 'changelogs');
const outputFile = path.join(__dirname, 'stats.json');

function getManifestFiles() {
  return fs.readdirSync(manifestsDir).filter(f => f.endsWith('.json'));
}

function getChangelogFiles() {
  return fs.readdirSync(changelogsDir).filter(f => f.endsWith('.json'));
}

function readJSON(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    console.error(`Error reading ${filePath}:`, e.message);
    return null;
  }
}

function countVersions(changelog) {
  if (!changelog) return 0;
  return Object.keys(changelog).length;
}

function calculateAverageTimeBetweenUpdates(changelog) {
  if (!changelog) return null;
  
  const versions = Object.values(changelog)
    .filter(v => v.createdAt)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  
  if (versions.length < 2) return null;
  
  let totalDays = 0;
  for (let i = 1; i < versions.length; i++) {
    const diff = new Date(versions[i].createdAt) - new Date(versions[i - 1].createdAt);
    totalDays += diff / (1000 * 60 * 60 * 24);
  }
  
  return totalDays / (versions.length - 1);
}

function extractConnectivity(drivers) {
  const connectivity = new Set();
  
  if (!drivers) return connectivity;
  
  drivers.forEach(driver => {
    if (driver.connectivity) {
      driver.connectivity.forEach(c => connectivity.add(c));
    }
  });
  
  return connectivity;
}

function extractCapabilities(drivers) {
  const capabilities = [];
  
  if (!drivers) return capabilities;
  
  drivers.forEach(driver => {
    if (driver.capabilities) {
      capabilities.push(...driver.capabilities);
    }
  });
  
  return capabilities;
}

function isIn2025(dateString) {
  if (!dateString) return false;
  const date = new Date(dateString);
  return date.getFullYear() === 2025;
}

function analyzeData() {
  console.log('Starting analysis...');
  
  const manifestFiles = getManifestFiles();
  const changelogFiles = getChangelogFiles();
  
  console.log(`Found ${manifestFiles.length} manifests and ${changelogFiles.length} changelogs`);
  
  const stats = {
    totalApps: manifestFiles.length,
    totalDrivers: 0,
    authorStats: {},
    updateFrequency: [],
    connectivityProtocols: {},
    driverCounts: [],
    categoryCounts: {},
    capabilityCounts: {},
    donation: { withDonation: 0, total: 0 },
    withDrivers: 0,
    cloudAvailable: 0,
    sourceAvailable: 0,
    forumTopicSet: 0,
    issuesUrlSet: 0,
    verifiedDevelopers: 0,
    totalDevelopers: 0,
    averageTimeBetweenUpdates: [],
    
    // 2025 recap stats
    year2025: {
      newApps: 0,
      newDevelopers: new Set(),
      allDevelopers: new Set(),
      protocolCounts: {},
      categoryCounts: {},
      totalVersionsPublished: 0
    }
  };
  
  // Analyze manifests
  manifestFiles.forEach(file => {
    const manifest = readJSON(path.join(manifestsDir, file));
    if (!manifest) return;
    
    const appId = file.replace('.json', '');
    const liveBuild = manifest.liveBuild;
    
    if (!liveBuild) return;
    
    // Check if app was created in 2025
    const changelogPath = path.join(changelogsDir, file);
    let isNewIn2025 = false;
    if (fs.existsSync(changelogPath)) {
      const changelog = readJSON(changelogPath);
      if (changelog) {
        const versions = Object.values(changelog).filter(v => v.createdAt);
        if (versions.length > 0) {
          const sortedVersions = versions.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
          const firstVersion = sortedVersions[0];
          if (isIn2025(firstVersion.createdAt)) {
            isNewIn2025 = true;
            stats.year2025.newApps++;
          }
        }
        
        // Count total versions published in 2025
        versions.forEach(v => {
          if (isIn2025(v.createdAt)) {
            stats.year2025.totalVersionsPublished++;
          }
        });
      }
    }
    
    // Author statistics
    if (manifest.author && manifest.author.name) {
      const authorName = manifest.author.name;
      const authorId = manifest.author.userId;
      
      if (!stats.authorStats[authorName]) {
        stats.authorStats[authorName] = { 
          count: 0, 
          verified: manifest.author.verified || false,
          userId: authorId 
        };
      }
      stats.authorStats[authorName].count++;
      
      // Track all developers
      stats.year2025.allDevelopers.add(authorId);
      
      // Track new developers in 2025
      if (isNewIn2025) {
        stats.year2025.newDevelopers.add(authorId);
      }
    }
    
    // Verified developers
    if (manifest.author) {
      stats.totalDevelopers++;
      if (manifest.author.verified) {
        stats.verifiedDevelopers++;
      }
    }
    
    // Connectivity protocols
    if (liveBuild.drivers) {
      const connectivity = extractConnectivity(liveBuild.drivers);
      connectivity.forEach(protocol => {
        stats.connectivityProtocols[protocol] = (stats.connectivityProtocols[protocol] || 0) + 1;
        
        // Track protocols for new apps in 2025
        if (isNewIn2025) {
          stats.year2025.protocolCounts[protocol] = (stats.year2025.protocolCounts[protocol] || 0) + 1;
        }
      });
      
      // Driver count
      const driverCount = liveBuild.drivers.length;
      stats.driverCounts.push(driverCount);
      stats.totalDrivers += driverCount;
      
      if (driverCount > 0) {
        stats.withDrivers++;
      }
      
      // Capabilities
      const capabilities = extractCapabilities(liveBuild.drivers);
      capabilities.forEach(cap => {
        stats.capabilityCounts[cap] = (stats.capabilityCounts[cap] || 0) + 1;
      });
    }
    
    // Category
    if (liveBuild.category) {
      stats.categoryCounts[liveBuild.category] = (stats.categoryCounts[liveBuild.category] || 0) + 1;
      
      // Track categories for new apps in 2025
      if (isNewIn2025) {
        stats.year2025.categoryCounts[liveBuild.category] = (stats.year2025.categoryCounts[liveBuild.category] || 0) + 1;
      }
    }
    
    // Donation
    stats.donation.total++;
    if (liveBuild.contributing && liveBuild.contributing.donate) {
      stats.donation.withDonation++;
    }
    
    // Cloud availability
    if (liveBuild.platforms && liveBuild.platforms.includes('cloud')) {
      stats.cloudAvailable++;
    }
    
    // Source code
    if (liveBuild.source) {
      stats.sourceAvailable++;
    }
    
    // Forum topic
    if (liveBuild.homeyCommunityTopicId) {
      stats.forumTopicSet++;
    }
    
    // Issues URL
    if (liveBuild.bugs) {
      stats.issuesUrlSet++;
    }
    
    // Update frequency
    if (fs.existsSync(changelogPath)) {
      const changelog = readJSON(changelogPath);
      const versionCount = countVersions(changelog);
      
      if (versionCount > 0) {
        stats.updateFrequency.push({
          appId: appId,
          name: liveBuild.name?.en || appId,
          versions: versionCount
        });
        
        const avgTime = calculateAverageTimeBetweenUpdates(changelog);
        if (avgTime !== null) {
          stats.averageTimeBetweenUpdates.push(avgTime);
        }
      }
    }
  });
  
  // Get unique developer count
  const uniqueDevelopers = new Set(Object.values(stats.authorStats).map(a => a.userId).filter(id => id));
  
  // Find most popular protocol and category in 2025
  const mostPopularProtocol2025 = Object.entries(stats.year2025.protocolCounts)
    .sort((a, b) => b[1] - a[1])[0];
  
  const mostPopularCategory2025 = Object.entries(stats.year2025.categoryCounts)
    .sort((a, b) => b[1] - a[1])[0];
  
  // Calculate derived statistics
  const avgDrivers = stats.driverCounts.length > 0
    ? stats.driverCounts.reduce((a, b) => a + b, 0) / stats.driverCounts.length
    : 0;
  
  const results = {
    totalApps: stats.totalApps,
    totalDrivers: stats.totalDrivers,
    totalDevelopers: uniqueDevelopers.size,
    mostFrequentlyUpdatedApp: stats.updateFrequency.sort((a, b) => b.versions - a.versions)[0],
    topAuthors: Object.entries(stats.authorStats)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)
      .map(([name, data]) => ({ name, count: data.count, verified: data.verified })),
    authorWithMostApps: Object.entries(stats.authorStats)
      .sort((a, b) => b[1].count - a[1].count)[0],
    averageTimeBetweenUpdatesDays: stats.averageTimeBetweenUpdates.length > 0
      ? stats.averageTimeBetweenUpdates.reduce((a, b) => a + b, 0) / stats.averageTimeBetweenUpdates.length
      : 0,
    connectivityProtocols: stats.connectivityProtocols,
    averageDriversPerApp: Math.round(avgDrivers),
    averageDriversPerAppExact: avgDrivers,
    donationPercentage: (stats.donation.withDonation / stats.donation.total) * 100,
    donationCount: { withDonation: stats.donation.withDonation, total: stats.donation.total },
    appsWithDriversPercentage: (stats.withDrivers / stats.totalApps) * 100,
    appsWithDriversCount: stats.withDrivers,
    cloudAvailablePercentage: (stats.cloudAvailable / stats.totalApps) * 100,
    cloudAvailableCount: stats.cloudAvailable,
    sourceAvailablePercentage: (stats.sourceAvailable / stats.totalApps) * 100,
    sourceAvailableCount: stats.sourceAvailable,
    forumTopicPercentage: (stats.forumTopicSet / stats.totalApps) * 100,
    forumTopicCount: stats.forumTopicSet,
    issuesUrlPercentage: (stats.issuesUrlSet / stats.totalApps) * 100,
    issuesUrlCount: stats.issuesUrlSet,
    verifiedDevelopersPercentage: uniqueDevelopers.size > 0 
      ? (stats.verifiedDevelopers / uniqueDevelopers.size) * 100 
      : 0,
    verifiedDevelopersCount: { verified: stats.verifiedDevelopers, total: uniqueDevelopers.size },
    topCapabilities: Object.entries(stats.capabilityCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count })),
    categories: stats.categoryCounts,
    
    // 2025 Recap
    year2025Recap: {
      newApps: stats.year2025.newApps,
      newDevelopers: stats.year2025.newDevelopers.size,
      totalVersionsPublished: stats.year2025.totalVersionsPublished,
      mostPopularProtocol: mostPopularProtocol2025 ? {
        name: mostPopularProtocol2025[0],
        count: mostPopularProtocol2025[1]
      } : null,
      mostPopularCategory: mostPopularCategory2025 ? {
        name: mostPopularCategory2025[0],
        count: mostPopularCategory2025[1]
      } : null,
      protocolCounts: stats.year2025.protocolCounts,
      categoryCounts: stats.year2025.categoryCounts
    }
  };
  
  return results;
}

// Run analysis
const results = analyzeData();

// Write to file
fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));

console.log('\n=== Analysis Complete ===');
console.log(`Results saved to: ${outputFile}`);
console.log(`\nKey findings:`);
console.log(`- Total apps: ${results.totalApps}`);
console.log(`- Total drivers: ${results.totalDrivers}`);
console.log(`- Total developers: ${results.totalDevelopers}`);
console.log(`- Most frequently updated: ${results.mostFrequentlyUpdatedApp?.name} (${results.mostFrequentlyUpdatedApp?.versions} versions)`);
console.log(`- Author with most apps: ${results.authorWithMostApps?.[0]} (${results.authorWithMostApps?.[1].count} apps)`);
console.log(`- Average time between updates: ${results.averageTimeBetweenUpdatesDays.toFixed(1)} days`);
console.log(`- Average drivers per app: ${results.averageDriversPerApp}`);
console.log(`- Apps with donation option: ${results.donationPercentage.toFixed(1)}%`);
console.log(`- Apps available on Cloud: ${results.cloudAvailablePercentage.toFixed(1)}%`);
console.log(`\n=== 2025 Year Recap ===`);
console.log(`- New apps in 2025: ${results.year2025Recap.newApps}`);
console.log(`- New developers in 2025: ${results.year2025Recap.newDevelopers}`);
console.log(`- Total versions published in 2025: ${results.year2025Recap.totalVersionsPublished}`);
console.log(`- Most popular protocol in new apps: ${results.year2025Recap.mostPopularProtocol?.name} (${results.year2025Recap.mostPopularProtocol?.count} apps)`);
console.log(`- Most popular category in new apps: ${results.year2025Recap.mostPopularCategory?.name} (${results.year2025Recap.mostPopularCategory?.count} apps)`);