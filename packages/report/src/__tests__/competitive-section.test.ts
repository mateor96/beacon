import { describe, expect, it } from "vitest";
import { renderCompetitiveSection } from "../competitive-section.js";

describe("renderCompetitiveSection", () => {
	it("returns empty string when no competitors", () => {
		expect(
			renderCompetitiveSection({
				clientDomain: "x.com",
				clientScore: 80,
				clientHistory: [70, 75, 80],
				competitors: [],
			}),
		).toBe("");
	});

	it("renders heading + bar chart + ranking table", () => {
		const html = renderCompetitiveSection({
			clientDomain: "my.co",
			clientScore: 80,
			clientHistory: [60, 70, 80],
			competitors: [
				{
					domain: "rival.co",
					score: 65,
					trend: "declining",
					history: [70, 68, 65],
					gapToClient: -15,
				},
			],
		});
		expect(html).toContain("Wettbewerbsanalyse");
		expect(html).toContain("my.co");
		expect(html).toContain("rival.co");
		expect(html).toContain("↓"); // trend arrow for declining
		expect(html).toContain("-15"); // gap
		expect(html).toContain("<svg");
	});

	it("applies primary color from branding", () => {
		const html = renderCompetitiveSection({
			clientDomain: "my.co",
			clientScore: 80,
			clientHistory: [],
			competitors: [
				{ domain: "r.co", score: 50, trend: "stable", history: [50], gapToClient: -30 },
			],
			primaryColor: "#ff00aa",
		});
		expect(html).toContain("#ff00aa");
	});
});
