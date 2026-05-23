import { getScoreRingColor } from "@/lib/format";

interface ScoreRingProps {
	score: number;
	level: number;
	levelName: string;
	size?: number;
}

export function ScoreRing({ score, level, levelName, size = 160 }: ScoreRingProps) {
	const strokeWidth = 10;
	const radius = (size - strokeWidth) / 2;
	const circumference = 2 * Math.PI * radius;
	const offset = circumference - (score / 100) * circumference;
	const color = getScoreRingColor(score);
	const center = size / 2;

	return (
		<div
			className="relative inline-flex items-center justify-center"
			aria-label={`Beacon-Score ${score} von 100, Stufe ${level}: ${levelName}`}
			role="img"
		>
			<svg width={size} height={size} className="-rotate-90" aria-hidden="true">
				{/* Background ring */}
				<circle
					cx={center}
					cy={center}
					r={radius}
					fill="none"
					stroke="currentColor"
					strokeWidth={strokeWidth}
					className="text-border"
				/>
				{/* Score ring */}
				<circle
					cx={center}
					cy={center}
					r={radius}
					fill="none"
					stroke={color}
					strokeWidth={strokeWidth}
					strokeDasharray={circumference}
					strokeDashoffset={offset}
					strokeLinecap="round"
					className="transition-[stroke-dashoffset] duration-1000 ease-out"
				/>
			</svg>
			<div className="absolute inset-0 flex flex-col items-center justify-center">
				<span className="text-4xl font-bold text-text">{score}</span>
				<span className="text-xs text-text-muted">von 100</span>
			</div>
		</div>
	);
}
