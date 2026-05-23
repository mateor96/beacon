import { createHash } from "node:crypto";

export function hashIp(ip: string): string {
	const salt = process.env.IP_HASH_SALT ?? "beacon-default-salt";
	return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}
