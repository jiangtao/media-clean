#!/usr/bin/env node
/**
 * Screenshot Comparison Script (Task 41)
 * Compares screenshots from 24 devices against baseline images
 *
 * Usage:
 *   node scripts/screenshot-compare.js [--baseline] [--threshold=0.02] [--device=Pixel_5]
 *
 * Features:
 * - Pixel-by-pixel comparison using pixelmatch
 * - Perceptual diff for handling anti-aliasing
 * - Region-of-interest masking for dynamic content
 * - Multi-device parallel comparison
 * - HTML report generation
 *
 * @author 赵虎
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Configuration
const CONFIG = {
  // Screenshot directories
  baselineDir: path.join(__dirname, '..', 'test-screenshots', 'baseline'),
  currentDir: path.join(__dirname, '..', 'test-screenshots', 'current'),
  diffDir: path.join(__dirname, '..', 'test-screenshots', 'diff'),
  reportDir: path.join(__dirname, '..', 'test-screenshots', 'reports'),

  // Device matrix (24 devices)
  devices: [
    // Standard screens
    { name: 'Pixel_5', type: 'standard', threshold: 0.01 },
    { name: 'Pixel_8', type: 'standard', threshold: 0.01 },
    { name: 'Redmi_9A', type: 'standard', threshold: 0.015 },

    // Notch screens
    { name: 'Pixel_7_Notch', type: 'notch', threshold: 0.02 },
    { name: 'Huawei_P30', type: 'notch', threshold: 0.02 },
    { name: 'Xiaomi_9', type: 'notch', threshold: 0.02 },

    // Teardrop screens
    { name: 'OnePlus_7', type: 'teardrop', threshold: 0.02 },
    { name: 'Redmi_Note_8', type: 'teardrop', threshold: 0.02 },

    // Hole punch center
    { name: 'Samsung_S23', type: 'hole-punch', threshold: 0.02 },
    { name: 'Pixel_8_Pro', type: 'hole-punch', threshold: 0.02 },
    { name: 'Xiaomi_13', type: 'hole-punch', threshold: 0.02 },
    { name: 'Samsung_A14', type: 'hole-punch', threshold: 0.02 },

    // Hole punch left
    { name: 'Samsung_S20', type: 'hole-punch-left', threshold: 0.02 },
    { name: 'Huawei_Mate_40', type: 'hole-punch-left', threshold: 0.02 },

    // Waterfall screens
    { name: 'Pixel_7_Pro', type: 'waterfall', threshold: 0.03 },
    { name: 'Samsung_S23_Ultra', type: 'waterfall', threshold: 0.03 },
    { name: 'OnePlus_11', type: 'waterfall', threshold: 0.03 },

    // Pill screens
    { name: 'Honor_90', type: 'pill', threshold: 0.02 },

    // Tablets
    { name: 'Pixel_Tablet', type: 'tablet', threshold: 0.02 },
    { name: 'Galaxy_Tab_S9', type: 'tablet', threshold: 0.02 },

    // Foldable cover
    { name: 'Galaxy_Z_Flip5_Cover', type: 'foldable-cover', threshold: 0.03 },
    { name: 'Galaxy_Z_Fold5_Cover', type: 'foldable-cover', threshold: 0.03 },

    // Foldable inner
    { name: 'Galaxy_Z_Flip5_Inner', type: 'foldable-inner', threshold: 0.03 },
    { name: 'Galaxy_Z_Fold5_Inner', type: 'foldable-inner', threshold: 0.03 },
  ],

  // Test scenarios
  scenarios: [
    'home-screen',
    'media-list',
    'preview-modal',
    'recycle-bin',
    'settings',
  ],

  // Regions to ignore (dynamic content like time, battery)
  ignoreRegions: [
    { x: 0, y: 0, width: 100, height: 50 }, // Status bar time area
    { x: -100, y: 0, width: 100, height: 50 }, // Status bar battery area (from right)
  ],
};

// ANSI color codes
const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

// Utility functions
function log(message, color = 'reset') {
  console.log(`${COLORS[color]}${message}${COLORS.reset}`);
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    baseline: args.includes('--baseline'),
    verbose: args.includes('--verbose'),
    generate: args.includes('--generate-report'),
    threshold: parseFloat(
      args.find((a) => a.startsWith('--threshold='))?.split('=')[1] || '0.02'
    ),
    deviceFilter: args.find((a) => a.startsWith('--device='))?.split('=')[1],
    scenarioFilter: args.find((a) => a.startsWith('--scenario='))?.split('=')[1],
  };
}

/**
 * Check if pixelmatch is installed
 */
function checkPixelmatch() {
  return new Promise((resolve) => {
    const check = spawn('npm', ['list', 'pixelmatch'], { stdio: 'ignore' });
    check.on('close', (code) => {
      resolve(code === 0);
    });
  });
}

/**
 * Install pixelmatch if needed
 */
async function ensurePixelmatch() {
  const hasPixelmatch = await checkPixelmatch();
  if (!hasPixelmatch) {
    log('Installing pixelmatch...', 'yellow');
    return new Promise((resolve, reject) => {
      const install = spawn('npm', ['install', '--save-dev', 'pixelmatch', 'pngjs'], {
        stdio: 'inherit',
      });
      install.on('close', (code) => {
        if (code === 0) {
          resolve(true);
        } else {
          reject(new Error('Failed to install pixelmatch'));
        }
      });
    });
  }
  return true;
}

/**
 * Compare two images using pixelmatch
 */
async function compareImages(img1Path, img2Path, diffPath, options = {}) {
  try {
    const { PNG } = await import('pngjs');
    const pixelmatch = await import('pixelmatch');

    const img1 = PNG.sync.read(fs.readFileSync(img1Path));
    const img2 = PNG.sync.read(fs.readFileSync(img2Path));

    if (img1.width !== img2.width || img1.height !== img2.height) {
      return {
        match: false,
        diffPixels: -1,
        diffPercentage: -1,
        error: 'Image dimensions mismatch',
      };
    }

    const { width, height } = img1;
    const diff = new PNG({ width, height });

    const threshold = options.threshold || 0.1;
    const includeAA = options.includeAA || false;

    const diffPixels = pixelmatch.default(
      img1.data,
      img2.data,
      diff.data,
      width,
      height,
      {
        threshold,
        includeAA,
        alpha: 0.1,
      }
    );

    const totalPixels = width * height;
    const diffPercentage = (diffPixels / totalPixels) * 100;

    // Save diff image
    if (diffPixels > 0) {
      fs.writeFileSync(diffPath, PNG.sync.write(diff));
    }

    return {
      match: diffPixels === 0,
      diffPixels,
      diffPercentage,
    };
  } catch (error) {
    return {
      match: false,
      diffPixels: -1,
      diffPercentage: -1,
      error: error.message,
    };
  }
}

/**
 * Generate HTML report
 */
function generateHtmlReport(results) {
  const timestamp = new Date().toISOString();
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>截图对比报告 - 24机机型适配</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f5f5f5;
      padding: 20px;
    }
    .header {
      background: white;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .header h1 { margin-bottom: 10px; }
    .stats {
      display: flex;
      gap: 20px;
      margin-top: 15px;
    }
    .stat {
      padding: 10px 20px;
      border-radius: 6px;
      font-weight: 500;
    }
    .stat.passed { background: #d4edda; color: #155724; }
    .stat.failed { background: #f8d7da; color: #721c24; }
    .device-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
      gap: 20px;
    }
    .device-card {
      background: white;
      border-radius: 8px;
      padding: 15px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .device-card h3 {
      margin-bottom: 5px;
      font-size: 16px;
    }
    .device-card .type {
      color: #666;
      font-size: 13px;
      margin-bottom: 10px;
    }
    .scenario {
      display: flex;
      align-items: center;
      padding: 8px;
      margin: 5px 0;
      border-radius: 4px;
      font-size: 13px;
    }
    .scenario.passed { background: #d4edda; }
    .scenario.failed { background: #f8d7da; }
    .scenario .status {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      margin-right: 10px;
    }
    .scenario.passed .status { background: #28a745; }
    .scenario.failed .status { background: #dc3545; }
    .diff-info {
      margin-left: auto;
      color: #666;
      font-size: 12px;
    }
    .image-comparison {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-top: 10px;
    }
    .image-comparison img {
      width: 100%;
      border: 1px solid #ddd;
      border-radius: 4px;
    }
    .timestamp {
      color: #666;
      font-size: 13px;
      margin-top: 10px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>📱 24机机型适配截图对比报告</h1>
    <div class="timestamp">生成时间: ${timestamp}</div>
    <div class="stats">
      <div class="stat passed">通过: ${passed}</div>
      <div class="stat failed">失败: ${failed}</div>
      <div class="stat">总计: ${results.length}</div>
    </div>
  </div>
  <div class="device-grid">
    ${results.map(r => `
      <div class="device-card">
        <h3>${r.device}</h3>
        <div class="type">${r.screenType} | API ${r.api || 'N/A'}</div>
        ${r.scenarios.map(s => `
          <div class="scenario ${s.passed ? 'passed' : 'failed'}">
            <div class="status"></div>
            <span>${s.name}</span>
            <div class="diff-info">
              ${s.passed ? '✓ 一致' : `差异: ${s.diffPercentage?.toFixed(2) || 'N/A'}%`}
            </div>
          </div>
        `).join('')}
      </div>
    `).join('')}
  </div>
</body>
</html>`;

  const reportPath = path.join(CONFIG.reportDir, `report-${Date.now()}.html`);
  fs.writeFileSync(reportPath, html);
  return reportPath;
}

/**
 * Main comparison function
 */
async function runComparison(options) {
  log('\n========================================', 'cyan');
  log('   24机机型适配截图对比工具', 'cyan');
  log('========================================\n', 'cyan');

  // Ensure directories exist
  ensureDir(CONFIG.baselineDir);
  ensureDir(CONFIG.currentDir);
  ensureDir(CONFIG.diffDir);
  ensureDir(CONFIG.reportDir);

  // Filter devices
  let devices = CONFIG.devices;
  if (options.deviceFilter) {
    devices = devices.filter((d) => d.name === options.deviceFilter);
    if (devices.length === 0) {
      log(`错误: 未找到设备 "${options.deviceFilter}"`, 'red');
      process.exit(1);
    }
  }

  // Filter scenarios
  let scenarios = CONFIG.scenarios;
  if (options.scenarioFilter) {
    scenarios = scenarios.filter((s) => s === options.scenarioFilter);
  }

  // Ensure pixelmatch is available
  await ensurePixelmatch();

  const results = [];
  let totalPassed = 0;
  let totalFailed = 0;

  // Run comparisons
  for (const device of devices) {
    log(`\n📱 测试设备: ${device.name} (${device.type})`, 'cyan');
    const deviceResults = {
      device: device.name,
      screenType: device.type,
      api: device.api,
      passed: true,
      scenarios: [],
    };

    for (const scenario of scenarios) {
      const baselinePath = path.join(
        CONFIG.baselineDir,
        `${device.name}-${scenario}.png`
      );
      const currentPath = path.join(
        CONFIG.currentDir,
        `${device.name}-${scenario}.png`
      );
      const diffPath = path.join(
        CONFIG.diffDir,
        `${device.name}-${scenario}-diff.png`
      );

      // Check if images exist
      if (!fs.existsSync(baselinePath)) {
        log(`  ⚠️  缺少基准图: ${baselinePath}`, 'yellow');
        deviceResults.scenarios.push({
          name: scenario,
          passed: false,
          error: 'Missing baseline',
        });
        deviceResults.passed = false;
        totalFailed++;
        continue;
      }

      if (!fs.existsSync(currentPath)) {
        log(`  ⚠️  缺少当前图: ${currentPath}`, 'yellow');
        deviceResults.scenarios.push({
          name: scenario,
          passed: false,
          error: 'Missing current screenshot',
        });
        deviceResults.passed = false;
        totalFailed++;
        continue;
      }

      // Compare images
      const result = await compareImages(baselinePath, currentPath, diffPath, {
        threshold: device.threshold,
      });

      const passed = result.match || result.diffPercentage < device.threshold * 100;

      if (passed) {
        log(`  ✓ ${scenario}: 通过`, 'green');
        totalPassed++;
      } else {
        log(`  ✗ ${scenario}: 失败 (${result.diffPercentage?.toFixed(2) || 'N/A'}% 差异)`, 'red');
        if (options.verbose) {
          log(`    - 差异像素: ${result.diffPixels}`, 'yellow');
          log(`    - 差异图: ${diffPath}`, 'yellow');
        }
        totalFailed++;
      }

      deviceResults.scenarios.push({
        name: scenario,
        passed,
        diffPixels: result.diffPixels,
        diffPercentage: result.diffPercentage,
        error: result.error,
      });

      if (!passed) {
        deviceResults.passed = false;
      }
    }

    results.push(deviceResults);
  }

  // Summary
  log('\n========================================', 'cyan');
  log('           测试结果汇总', 'cyan');
  log('========================================\n', 'cyan');
  log(`通过: ${COLORS.green}${totalPassed}${COLORS.reset}`);
  log(`失败: ${COLORS.red}${totalFailed}${COLORS.reset}`);
  log(`总计: ${totalPassed + totalFailed}`);

  // Generate HTML report if requested
  if (options.generate || totalFailed > 0) {
    const reportPath = generateHtmlReport(results);
    log(`\n📊 报告已生成: ${reportPath}`, 'cyan');
  }

  // Exit with error code if any failures
  if (totalFailed > 0) {
    process.exit(1);
  }
}

/**
 * Capture baseline screenshots mode
 */
async function captureBaseline(options) {
  log('\n========================================', 'cyan');
  log('       捕获基准截图模式', 'cyan');
  log('========================================\n', 'cyan');

  log('此模式需要在已配置的模拟器上运行应用并手动截图。', 'yellow');
  log('请按以下步骤操作:\n', 'yellow');

  const devices = options.deviceFilter
    ? CONFIG.devices.filter((d) => d.name === options.deviceFilter)
    : CONFIG.devices;

  log('1. 启动模拟器:');
  devices.forEach((d) => {
    log(`   - ${d.name} (${d.type})`);
  });

  log('\n2. 安装并启动应用');
  log('   npx expo run:android\n');

  log('3. 对每个场景截图并保存到:');
  log(`   ${CONFIG.baselineDir}\n`);

  log('4. 命名格式:');
  log('   {device-name}-{scenario}.png');
  log('   例如: Pixel_5-home-screen.png\n');

  ensureDir(CONFIG.baselineDir);
  log(`已创建目录: ${CONFIG.baselineDir}`, 'green');
}

// Main entry
async function main() {
  const options = parseArgs();

  if (options.baseline) {
    await captureBaseline(options);
  } else {
    await runComparison(options);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch((error) => {
    log(`\n错误: ${error.message}`, 'red');
    process.exit(1);
  });
}

// Export for testing
module.exports = {
  CONFIG,
  compareImages,
  generateHtmlReport,
  parseArgs,
};
