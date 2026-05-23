export function requireFirstRow<T>(rows: T[], queryName: string): T {
	const row = rows[0];

	if (row === undefined) {
		throw new Error(`${queryName} did not return a row`);
	}

	return row;
}
