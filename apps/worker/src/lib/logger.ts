interface LogContext {
	queue: string;
	jobId: string;
	scanId: string;
	correlationId?: string;
}

interface JobLogger {
	info: (message: string, data?: Record<string, unknown>) => void;
	warn: (message: string, data?: Record<string, unknown>) => void;
	error: (message: string, err?: unknown, data?: Record<string, unknown>) => void;
}

function extractError(err: unknown): { message: string; stack?: string } {
	if (err instanceof Error) {
		return { message: err.message, stack: err.stack };
	}
	return { message: String(err) };
}

interface SystemLogContext {
	service: string;
	component: string;
}

export interface SystemLogger {
	info: (message: string, data?: Record<string, unknown>) => void;
	warn: (message: string, data?: Record<string, unknown>) => void;
	error: (message: string, err?: unknown, data?: Record<string, unknown>) => void;
}

export function createSystemLogger(ctx: SystemLogContext): SystemLogger {
	const base = { service: ctx.service, component: ctx.component };

	return {
		info(message, data) {
			process.stdout.write(
				`${JSON.stringify({ level: "info", ts: Date.now(), ...base, message, ...data })}\n`,
			);
		},
		warn(message, data) {
			process.stdout.write(
				`${JSON.stringify({ level: "warn", ts: Date.now(), ...base, message, ...data })}\n`,
			);
		},
		error(message, err, data) {
			const errFields = err ? extractError(err) : undefined;
			process.stderr.write(
				`${JSON.stringify({ level: "error", ts: Date.now(), ...base, message, error: errFields?.message, stack: errFields?.stack, ...data })}\n`,
			);
		},
	};
}

export function createJobLogger(ctx: LogContext): JobLogger {
	const base = {
		queue: ctx.queue,
		jobId: ctx.jobId,
		scanId: ctx.scanId,
		...(ctx.correlationId ? { correlationId: ctx.correlationId } : {}),
	};

	return {
		info(message, data) {
			process.stdout.write(
				`${JSON.stringify({ level: "info", ts: Date.now(), ...base, message, ...data })}\n`,
			);
		},
		warn(message, data) {
			process.stdout.write(
				`${JSON.stringify({ level: "warn", ts: Date.now(), ...base, message, ...data })}\n`,
			);
		},
		error(message, err, data) {
			const errFields = err ? extractError(err) : undefined;
			process.stderr.write(
				`${JSON.stringify({ level: "error", ts: Date.now(), ...base, message, error: errFields?.message, stack: errFields?.stack, ...data })}\n`,
			);
		},
	};
}
