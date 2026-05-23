import { type Job, type JobsOptions, Queue } from "bullmq";
import { QUEUE_CONFIG, QUEUE_NAMES, QUEUE_PREFIX } from "./config.js";
import { getConnectionOptions } from "./connection.js";
import type { JobDataMap, JobResultMap, QueueName } from "./types.js";

const globalForQueues = globalThis as unknown as {
	__awrQueueMap?: Map<QueueName, Queue>;
};

function getQueueMap(): Map<QueueName, Queue> {
	if (!globalForQueues.__awrQueueMap) {
		globalForQueues.__awrQueueMap = new Map();
	}
	return globalForQueues.__awrQueueMap;
}

function getQueue(name: QueueName): Queue {
	const map = getQueueMap();
	let queue = map.get(name);
	if (!queue) {
		const cfg = QUEUE_CONFIG[name];
		queue = new Queue(name, {
			connection: getConnectionOptions(),
			prefix: QUEUE_PREFIX,
			defaultJobOptions: cfg.defaultJobOptions,
		});
		map.set(name, queue);
	}
	return queue;
}

export async function addJob<T extends QueueName>(
	queueName: T,
	data: JobDataMap[T],
	opts?: JobsOptions,
): Promise<Job<JobDataMap[T], JobResultMap[T], T>> {
	const queue = getQueue(queueName);
	const job = await queue.add(queueName, data, opts);
	return job as Job<JobDataMap[T], JobResultMap[T], T>;
}

export function getQueues(): Record<QueueName, Queue> {
	for (const name of QUEUE_NAMES) {
		getQueue(name);
	}
	return Object.fromEntries(getQueueMap()) as Record<QueueName, Queue>;
}

export async function closeAllQueues(): Promise<void> {
	const map = globalForQueues.__awrQueueMap;
	if (!map) return;
	await Promise.all([...map.values()].map((q) => q.close()));
	map.clear();
	globalForQueues.__awrQueueMap = undefined;
}
