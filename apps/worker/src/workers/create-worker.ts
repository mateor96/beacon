import { QUEUE_CONFIG, QUEUE_PREFIX, type QueueName, getConnectionOptions } from "@beacon/queue";
import { type Processor, Worker } from "bullmq";

export function createWorker<TData, TResult = void>(
	name: QueueName,
	processor: Processor<TData, TResult>,
): Worker<TData, TResult> {
	const cfg = QUEUE_CONFIG[name];
	return new Worker<TData, TResult>(name, processor, {
		connection: getConnectionOptions(),
		prefix: QUEUE_PREFIX,
		concurrency: cfg.concurrency,
		...(cfg.lockDuration && { lockDuration: cfg.lockDuration }),
		...(cfg.limiter && { limiter: cfg.limiter }),
	});
}
