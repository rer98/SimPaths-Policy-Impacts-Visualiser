/* Regression tests for reusable local-data workers, completion and failure cleanup.
 */
import { processWorkerBatches } from "./processWorkerBatches.js";

function worker() {
  return { postMessage:jest.fn(), terminate:jest.fn(), onmessage:null, onerror:null };
}

function finish(target) {
  const { runs } = target.postMessage.mock.calls.at(-1)[0];
  target.onmessage({ data:{ metrics:runs.map(run => ({ runId:run.runId })) } });
}

function expectReleased(pool) {
  pool.forEach(target => {
    expect(target.terminate).toHaveBeenCalledTimes(1);
    expect(target.onmessage).toBeNull();
    expect(target.onerror).toBeNull();
  });
}

test("six runs finish when two workers reuse three batches", async () => {
  const pool = [worker(), worker()];
  const batches = [[1,2],[3,4],[5,6]].map(ids => ids.map(runId => ({ runId })));
  const progress = jest.fn();
  const result = processWorkerBatches(pool, batches, progress, 6);
  finish(pool[0]);
  finish(pool[1]);
  finish(pool[0]);
  expect((await result).map(row => row.runId).sort()).toEqual([1,2,3,4,5,6]);
  expect(pool[0].postMessage).toHaveBeenCalledTimes(2);
  expect(pool[1].postMessage).toHaveBeenCalledTimes(1);
  expect(progress).toHaveBeenLastCalledWith("Aggregating… 6/6 runs");
  expectReleased(pool);
});

test("idle workers do not prevent completion", async () => {
  const pool = [worker(), worker()];
  const result = processWorkerBatches(pool, [[{ runId:1 }]], jest.fn(), 1);
  finish(pool[0]);
  expect(await result).toEqual([{ runId:1 }]);
  expect(pool[1].postMessage).not.toHaveBeenCalled();
  expectReleased(pool);
});

test("a reported parsing error stops new batches and releases every worker", async () => {
  const pool = [worker(), worker()];
  const result = processWorkerBatches(pool, [[1],[2],[3]], jest.fn(), 3);
  pool[0].onmessage({ data:{ error:"Invalid local CSV" } });
  await expect(result).rejects.toThrow("Invalid local CSV");
  expect(pool[0].postMessage).toHaveBeenCalledTimes(1);
  expect(pool[1].postMessage).toHaveBeenCalledTimes(1);
  expectReleased(pool);
});

test("worker errors reject and release the pool", async () => {
  const pool = [worker(), worker()];
  const result = processWorkerBatches(pool, [[1],[2]], jest.fn(), 2);
  pool[1].onerror({ message:"Worker stopped" });
  await expect(result).rejects.toThrow("Worker stopped");
  expectReleased(pool);
});

test("postMessage exceptions release workers that have not received work", async () => {
  const pool = [worker(), worker()];
  pool[0].postMessage.mockImplementation(() => { throw new Error("Cannot clone handles"); });
  await expect(processWorkerBatches(pool, [[1],[2]], jest.fn(), 2)).rejects.toThrow("Cannot clone handles");
  expect(pool[1].postMessage).not.toHaveBeenCalled();
  expectReleased(pool);
});

test("progress callback exceptions reject instead of leaving processing stuck", async () => {
  const pool = [worker()];
  const result = processWorkerBatches(pool, [[{ runId:1 }]], () => { throw new Error("Progress failed"); }, 1);
  finish(pool[0]);
  await expect(result).rejects.toThrow("Progress failed");
  expectReleased(pool);
});

test("malformed worker results reject and release the pool", async () => {
  const pool = [worker()];
  const result = processWorkerBatches(pool, [[1]], jest.fn(), 1);
  pool[0].onmessage({ data:{} });
  await expect(result).rejects.toThrow();
  expectReleased(pool);
});

test("an empty job list completes without workers", async () => {
  expect(await processWorkerBatches([], [], jest.fn(), 0)).toEqual([]);
});

test("nonempty jobs without workers fail explicitly", async () => {
  await expect(processWorkerBatches([], [[1]], jest.fn(), 1)).rejects.toThrow("No workers available");
});
