/* (C) Copyright 2026, by Ross Richardson
 * Dispatch local simulation batches to reusable workers and release the pool on exit.
 * @author ross richardson
 */

/**
 * The caller supplies an already-created pool and one array per batch. Count
 * workers still processing work, rather than incrementing for every new batch.
 * Workers are terminated after success, worker errors or callback exceptions.
 */
export async function processWorkerBatches(pool, batches, onProgress, total) {
  const allMetrics = [];
  let runsProcessed = 0;
  try {
    await new Promise((resolve, reject) => {
      let batchIndex = 0;
      let active = pool.length;
      let settled = false;

      function fail(error) {
        if (settled) return;
        settled = true;
        reject(error);
      }

      function assignNext(worker) {
        if (settled) return;
        if (batchIndex >= batches.length) {
          active--;
          if (active === 0) {
            settled = true;
            resolve();
          }
          return;
        }
        const batch = batches[batchIndex++];
        worker.onmessage = ({ data }) => {
          if (settled) return;
          try {
            if (data.error) throw new Error(data.error);
            allMetrics.push(...data.metrics);
            runsProcessed = Math.min(runsProcessed + batch.length, total);
            onProgress(`Aggregating… ${runsProcessed}/${total} runs`);
            assignNext(worker);
          } catch (error) {
            fail(error);
          }
        };
        worker.onerror = (event) => fail(new Error(event.message || "A worker failed while processing a run."));
        worker.postMessage({ runs: batch });
      }

      if (!active) {
        if (batches.length) reject(new Error("No workers available to process runs."));
        else resolve();
      } else {
        pool.forEach(worker => assignNext(worker));
      }
    });
    return allMetrics;
  } finally {
    pool.forEach(worker => {
      worker.onmessage = null;
      worker.onerror = null;
      worker.terminate();
    });
  }
}
