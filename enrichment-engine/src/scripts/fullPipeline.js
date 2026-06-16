/**
 * fullPipeline.js
 * Runs the complete enrichment pipeline end-to-end (MySQL + inline images).
 * Prefer: npm run enrich:production
 */
import 'dotenv/config';
import { fork } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import logger from '../logger/index.js';
import { query, batchInsert, closePool } from '../db/pool.js';
import { v4 as uuid } from 'uuid';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function step(name, scriptPath, args = []) {
  const jobId = uuid();
  logger.info(`▶ Step: ${name}`, { jobId });
  const start = Date.now();

  await batchInsert('job_logs', ['job_id', 'job_type', 'status'], [[jobId, name, 'running']], { ignore: true });

  try {
    await new Promise((resolvePromise, reject) => {
      const child = fork(scriptPath, args, {
        stdio: 'inherit',
        env: { ...process.env, NODE_OPTIONS: process.env.NODE_OPTIONS || '--max-old-space-size=8192' },
      });
      child.on('exit', code => {
        if (code === 0) resolvePromise();
        else reject(new Error(`${name} exited with code ${code}`));
      });
      child.on('error', reject);
    });

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    await query(
      `UPDATE job_logs SET status='completed', finished_at=NOW(), meta=? WHERE job_id=?`,
      [JSON.stringify({ elapsed }), jobId]
    );
    logger.info(`✓ Step complete: ${name}`, { elapsed: `${elapsed}s` });
    return elapsed;
  } catch (err) {
    await query(
      `UPDATE job_logs SET status='failed', finished_at=NOW(), meta=? WHERE job_id=?`,
      [JSON.stringify({ err: err.message }), jobId]
    );
    throw err;
  }
}

async function run() {
  const start = Date.now();
  logger.info('========================================');
  logger.info('  PHARMACY ENRICHMENT PIPELINE START');
  logger.info('========================================');

  try {
    await step('import_files', resolve(__dirname, 'importFiles.js'));
    await step('run_matching', resolve(__dirname, 'runMatching.js'));
    await step('run_enrichment', resolve(__dirname, 'runEnrichment.js'), ['--inline']);
    await step('generate_reports', resolve(__dirname, 'generateReports.js'));

    const elapsed = ((Date.now() - start) / 1000).toFixed(0);
    logger.info('========================================');
    logger.info(`  PIPELINE COMPLETE in ${elapsed}s`);
    logger.info('  Reports: data/output/');
    logger.info('  MySQL:   product_enrichment + product_match_mapping');
    logger.info('========================================');
  } catch (err) {
    logger.error('Pipeline failed', { err: err.message, stack: err.stack });
    process.exit(1);
  } finally {
    await closePool();
  }
}

run();
