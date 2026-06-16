/**
 * Worker thread — scores pre-gathered candidate lists (no DR index required).
 */
import { parentPort, workerData } from 'worker_threads';
import { scoreProductCandidates } from './matchScoring.js';

const { jobs, matchOptions } = workerData;

try {
  const results = jobs.map(({ rms, rmsParsed, candidates }) =>
    scoreProductCandidates(rms, rmsParsed, candidates, matchOptions)
  );
  parentPort.postMessage({ results });
} catch (err) {
  parentPort.postMessage({ error: err.message });
}
