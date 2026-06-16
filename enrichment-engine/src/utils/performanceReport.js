/**
 * Pipeline performance metrics for stage 13 reporting.
 */
import os from 'os';
import { performance } from 'perf_hooks';

export function createPerformanceTracker() {
  const start = performance.now();
  const startMem = process.memoryUsage();
  const startCpu = process.cpuUsage();

  return {
    elapsedMs() {
      return performance.now() - start;
    },
    snapshot(label, productCount = 0) {
      const elapsedSec = (performance.now() - start) / 1000;
      const mem = process.memoryUsage();
      const cpu = process.cpuUsage(startCpu);
      const cpuSec = (cpu.user + cpu.system) / 1e6;

      return {
        label,
        elapsedSec: Number(elapsedSec.toFixed(2)),
        productsPerSec: productCount && elapsedSec > 0
          ? Number((productCount / elapsedSec).toFixed(1))
          : 0,
        memoryMb: {
          heapUsed: Number((mem.heapUsed / 1024 / 1024).toFixed(1)),
          heapTotal: Number((mem.heapTotal / 1024 / 1024).toFixed(1)),
          rss: Number((mem.rss / 1024 / 1024).toFixed(1)),
          deltaHeapMb: Number(((mem.heapUsed - startMem.heapUsed) / 1024 / 1024).toFixed(1)),
        },
        cpu: {
          userSec: Number((cpu.user / 1e6).toFixed(2)),
          systemSec: Number((cpu.system / 1e6).toFixed(2)),
          totalSec: Number(cpuSec.toFixed(2)),
        },
        cpus: os.cpus().length,
        platform: `${os.platform()} ${os.arch()}`,
      };
    },
  };
}

export function formatPerformanceReport(report) {
  const lines = [
    '',
    '=== PERFORMANCE REPORT ===',
    `Total Products:     ${report.total}`,
    `Matched:            ${report.matched} (${report.matchRate})`,
    `Review:             ${report.review}`,
    `Unmatched:          ${report.unmatched}`,
    `Validation:         ${report.validationOk ? 'PASSED ✓' : 'FAILED ✗'} (${report.matched}+${report.review}+${report.unmatched}=${report.total})`,
    '',
    `Processing Time:    ${report.elapsedSec}s`,
    `Products / Second:  ${report.productsPerSec}`,
    `Cache Hits:         ${report.cacheHits ?? 0}`,
    `Workers Used:       ${report.workers ?? 1}`,
  ];

  if (report.images) {
    lines.push(
      '',
      'Images (lookup by DR Product ID after match):',
      `  With image URLs:  ${report.images.hasImages}`,
      `  No images:        ${report.images.noImages}`,
      `  Missing DR ID:    ${report.images.noProductId ?? 0}`,
    );
  }

  lines.push(
    '',
    'Memory:',
    `  Heap Used:        ${report.memoryMb.heapUsed} MB`,
    `  RSS:              ${report.memoryMb.rss} MB`,
    `  Heap Delta:       ${report.memoryMb.deltaHeapMb} MB`,
    '',
    'CPU:',
    `  User:             ${report.cpu.userSec}s`,
    `  System:           ${report.cpu.systemSec}s`,
    `  Cores Available:  ${report.cpus}`,
  );

  if (report.timing) {
    lines.push('', 'Stage Timings (seconds):');
    for (const [k, v] of Object.entries(report.timing)) {
      lines.push(`  ${k.padEnd(18)} ${v}s`);
    }
  }

  return lines.join('\n');
}
