import { TFile } from "obsidian";
import type { App } from "obsidian";
import type { GoalFrontmatter, GoalRecord, GoalStep } from "../types";

interface DataviewPageLike {
	file?: {
		path: string;
		name: string;
	};
	[key: string]: unknown;
}

interface DataviewApiLike {
	pages: (source: string) => { values?: DataviewPageLike[]; array?: () => DataviewPageLike[] };
}

function asString(value: unknown, fallback = ""): string {
	return typeof value === "string" ? value : fallback;
}

const AI_SECTION_TITLE = "## 🧩 AI 拆解区";

function normalizeId(id: string): string {
	return id.replace(/^\^+/, "").trim();
}

function parseStepsFromBody(body: string, currentStepId?: string | null): GoalStep[] {
	const lines = body.split("\n");
	const sectionIndex = lines.findIndex((l) => l.trim() === AI_SECTION_TITLE);
	if (sectionIndex < 0) {
		return [];
	}

	let nextHeaderIndex = lines.findIndex((l, i) => i > sectionIndex && /^#{1,6}\s+/.test(l));
	if (nextHeaderIndex < 0) {
		nextHeaderIndex = lines.length;
	}

	const current = currentStepId ? normalizeId(currentStepId) : "";
	const sectionLines = lines.slice(sectionIndex + 1, nextHeaderIndex);
	const steps: GoalStep[] = [];
	let fallbackIndex = 1;

	for (const line of sectionLines) {
		const m = line.match(/^\s*-\s+\[( |x|X)\]\s+(.+)$/);
		if (!m) {
			continue;
		}
		const checked = (m[1] ?? " ").toLowerCase();
		const done = checked === "x";
		const raw = (m[2] ?? "").trim();
		const idMatch = raw.match(/\^([A-Za-z0-9_-]+)/);
		const id = idMatch?.[1] ? normalizeId(idMatch[1]) : `step_${fallbackIndex++}`;
		const withoutId = raw.replace(/\s*\^[A-Za-z0-9_-]+/g, " ").replace(/\s+/g, " ").trim();
		const doneAtMatch = withoutId.match(/\s+⏱(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})\s*$/);
		const completed_at = doneAtMatch?.[1];
		const withoutDoneAt = withoutId.replace(/\s+⏱\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}\s*$/, "").trim();
		const noteMatch = withoutDoneAt.match(/\[\[[^\]]+\]\]/);
		const description = withoutDoneAt.replace(/\[\[[^\]]+\]\]/g, "").trim();

		let status: GoalStep["status"] = "ready";
		if (done) {
			status = "done";
		} else if (current && id === current) {
			status = "chosen";
		}
		steps.push({
			id,
			description,
			status,
			note: noteMatch?.[0],
			completed_at,
		});
	}
	return steps;
}

function resolvePages(pages: { values?: DataviewPageLike[]; array?: () => DataviewPageLike[] } | undefined): DataviewPageLike[] {
	if (!pages) {
		return [];
	}
	if (Array.isArray(pages.values)) {
		return pages.values;
	}
	if (typeof pages.array === "function") {
		return pages.array();
	}
	return [];
}

export function getDataviewApi(app: App): DataviewApiLike | null {
	const pluginHost = (app as unknown as { plugins?: { plugins?: Record<string, unknown> } }).plugins?.plugins ?? {};
	const dataviewPlugin = pluginHost?.dataview as { api?: DataviewApiLike } | undefined;
	return dataviewPlugin?.api ?? null;
}

export function isDataviewReady(app: App): boolean {
	return !!getDataviewApi(app);
}

export async function queryActiveGoals(app: App, goalsFolder: string): Promise<GoalRecord[]> {
	const api = getDataviewApi(app);
	if (!api) return [];

	const rows = resolvePages(api.pages(`"${goalsFolder}"`));
	const goals: GoalRecord[] = [];

	for (const row of rows) {
		const filePath = asString(row.file?.path);
		if (!filePath) continue;

		const file = app.vault.getAbstractFileByPath(filePath);
		if (!(file instanceof TFile)) continue;

		const fm = row as unknown as GoalFrontmatter;
		if (fm.status !== "active") continue;

		const title = asString(row.title, file.basename);
		const content = await app.vault.cachedRead(file);
		const fmMatch = content.match(/^---\r?\n[\s\S]*?\r?\n---/);
		const body = fmMatch ? content.slice(fmMatch[0].length) : content;
		const steps = parseStepsFromBody(body, fm.current_step_id);

		goals.push({
			file,
			title,
			frontmatter: {
				type: "goal",
				status: "active",
				created: asString(fm.created),
				completed_date: asString(fm.completed_date) || null,
				tags: Array.isArray(fm.tags) ? (fm.tags as string[]) : [],
				step_count: fm.step_count || steps.length,
				done_count: fm.done_count || steps.filter((s) => s.status === "done").length,
				current_step_id: fm.current_step_id || null,
				steps, // 注入解析出的步骤
			} as any,
		});
	}

	goals.sort((a, b) => {
		const ta = a.frontmatter.created ?? "";
		const tb = b.frontmatter.created ?? "";
		return tb.localeCompare(ta);
	});
	return goals;
}
