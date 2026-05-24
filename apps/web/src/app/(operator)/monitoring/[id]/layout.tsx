import { DeleteProjectButton } from "@/components/monitoring/delete-project-button";
import { ProjectTabs } from "@/components/monitoring/project-tabs";
import { db, monitoringQueries } from "@beacon/db";
import { UuidSchema } from "@beacon/shared";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

interface Props {
	children: React.ReactNode;
	params: Promise<{ id: string }>;
}

/**
 * Shared chrome for a monitoring project: back-link, header (name, URL,
 * delete) and the tab strip. Individual tabs render as child pages.
 */
export default async function MonitoringProjectLayout({ children, params }: Props) {
	const { id } = await params;
	if (!UuidSchema.safeParse(id).success) notFound();

	const project = await monitoringQueries.getProjectById(db, id);
	if (!project) notFound();

	return (
		<main className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
			<div className="mb-2">
				<Link href="/monitoring" className="text-sm text-primary hover:underline">
					&larr; Alle Projekte
				</Link>
			</div>

			<div className="mb-6 flex flex-wrap items-start justify-between gap-3">
				<div>
					<h1 className="text-3xl font-bold text-text">{project.name}</h1>
					<a
						href={project.websiteUrl}
						target="_blank"
						rel="noopener noreferrer"
						className="text-text-muted hover:text-primary"
					>
						{project.websiteUrl}
					</a>
				</div>
				<DeleteProjectButton id={project.id} name={project.name} />
			</div>

			<ProjectTabs projectId={id} />

			{children}
		</main>
	);
}
