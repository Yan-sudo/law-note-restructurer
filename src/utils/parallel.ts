/**
 * Semaphore-based parallel map with concurrency control.
 *
 * Runs `fn` on each item with at most `concurrency` concurrent executions.
 * Results are returned in the same order as the input array.
 * Individual failures are collected; other items continue executing.
 *
 * @param minInterval - Minimum ms between starting consecutive tasks (prevents burst)
 */
export async function parallelMap<T, R>(
    items: T[],
    fn: (item: T, index: number) => Promise<R>,
    concurrency: number,
    minInterval: number = 200,
    onProgress?: (completed: number, total: number, item: T) => void,
    onError?: (index: number, item: T, error: Error) => void
): Promise<{ results: (R | undefined)[]; errors: { index: number; error: Error }[] }> {
    const results: (R | undefined)[] = new Array(items.length);
    const errors: { index: number; error: Error }[] = [];
    let completedCount = 0;

    // Create a queue of work items
    let nextIndex = 0;

    async function worker(): Promise<void> {
        while (nextIndex < items.length) {
            const idx = nextIndex++;
            try {
                results[idx] = await fn(items[idx], idx);
            } catch (err) {
                const error = err instanceof Error ? err : new Error(String(err));
                errors.push({ index: idx, error });
                results[idx] = undefined;
                onError?.(idx, items[idx], error);
            }
            completedCount++;
            onProgress?.(completedCount, items.length, items[idx]);
        }
    }

    if (items.length === 0) {
        return { results, errors };
    }

    // Stagger worker starts by minInterval to prevent burst
    const workers: Promise<void>[] = [];
    const workerCount = Math.min(concurrency, items.length);

    for (let i = 0; i < workerCount; i++) {
        if (i > 0 && minInterval > 0) {
            await sleep(minInterval);
        }
        workers.push(worker());
    }

    await Promise.all(workers);
    return { results, errors };
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
