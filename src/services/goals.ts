import { Notice, TFile, normalizePath } from "obsidian";
import type PWorkbenchPlugin from "../main";
import type { GoalRecord, GoalStep } from "../types";

function todayDate(): string {
	return new Date().toISOString().slice(0, 10);
}

function addDays(base: Date, days: number): Date {
	const next = new Date(base.getTime());
	next.setDate(next.getDate() + days);
	return next;
}

function nowDisplayTime(): string {
	const d = new Date();
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function slugify(text: string): string {
	return text
		.trim()
		.replace(/[\\/:*?"<>|]/g, " ")
		.replace(/\s+/g, "-")
		.slice(0, 60)
		.toLowerCase();
}

async function ensureFolder(plugin: PWorkbenchPlugin, folder: string): Promise<void> {
	const normalized = normalizePath(folder);
	if (!plugin.app.vault.getAbstractFileByPath(normalized)) {
		await plugin.app.vault.createFolder(normalized);
	}
}

async function updateFrontmatter(plugin: PWorkbenchPlugin, file: TFile, updater: (fm: Record<string, unknown>) => void): Promise<void> {
	await plugin.app.fileManager.processFrontMatter(file, (fm) => {
		updater(fm as Record<string, unknown>);
	});
}

function makeInspirationName(stepText: string): string {
	const base = slugify(stepText || "灵感");
	const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 12);
	return `灵感-${base}-${stamp}.md`;
}

const AI_SECTION_TITLE = "## 🧩 子任务";

function normalizeId(id: string): string {
	return id.replace(/^\^+/, "").trim();
}

function extractCurrentStepId(frontmatterText: string): string {
	const m = frontmatterText.match(/^\s*current_step_id:\s*(.+)\s*$/m);
	if (!m) {
		return "";
	}
	const raw = (m[1] ?? "").trim();
	if (!raw) {
		return "";
	}
	const stripped = raw.replace(/^["']|["']$/g, "");
	return normalizeId(stripped);
}

function getNextStepId(steps: GoalStep[]): string {
	let max = 0;
	for (const step of steps) {
		const m = normalizeId(step.id).match(/(\d+)/);
		if (m?.[1]) {
			max = Math.max(max, Number(m[1]));
		}
	}
	return `step_${max + 1}`;
}

async function getGoalContent(plugin: PWorkbenchPlugin, file: TFile): Promise<{ frontmatter: string; body: string }> {
	const content = await plugin.app.vault.read(file);
	const match = content.match(/^---\r?\n[\s\S]*?\r?\n---/);
	if (!match) return { frontmatter: "", body: content };
	return {
		frontmatter: match[0],
		body: content.slice(match[0].length),
	};
}

function buildGoalTemplate(goalName: string): string {
	return `---
type: goal
status: active
created: ${todayDate()}
completed_date:
dormant_until:
tags: []
step_count: 0
done_count: 0
current_step_id:
---
# ${goalName.trim()}

> 任务概述：

${AI_SECTION_TITLE}
`;
}

async function findGoalFileByName(plugin: PWorkbenchPlugin, goalName: string): Promise<TFile | null> {
	const folder = normalizePath(plugin.settings.goalsFolder);
	const files = plugin.app.vault.getFiles().filter((file) => file.path.startsWith(`${folder}/`));
	const found = files.find((file) => file.basename === goalName.trim());
	return found ?? null;
}

function getGoalStatus(plugin: PWorkbenchPlugin, file: TFile): string {
	const cache = plugin.app.metadataCache.getFileCache(file);
	const fm = cache?.frontmatter as Record<string, unknown> | undefined;
	return String(fm?.status ?? "active");
}

function getDormantUntil(plugin: PWorkbenchPlugin, file: TFile): string {
	const cache = plugin.app.metadataCache.getFileCache(file);
	const fm = cache?.frontmatter as Record<string, unknown> | undefined;
	return String(fm?.dormant_until ?? "");
}

function updateStepsInSection(body: string, steps: GoalStep[]): string {
	const lines = body.split("\n");
	const sectionIndex = lines.findIndex((l) => l.trim() === AI_SECTION_TITLE);

	const rendered = steps.map((s) => {
		const checkbox = s.status === "done" ? "[x]" : "[ ]";
		const note = s.note ? ` ${s.note}` : "";
		const doneAt = s.status === "done" && s.completed_at ? ` ⏱${s.completed_at}` : "";
		return `- ${checkbox} ${s.description}${note}${doneAt} ^${normalizeId(s.id)}`;
	});

	if (sectionIndex < 0) {
		const head = body.trimEnd();
		return `${head}\n\n${AI_SECTION_TITLE}\n\n${rendered.join("\n")}\n`;
	}

	let nextHeaderIndex = lines.findIndex((l, i) => i > sectionIndex && /^#{1,6}\s+/.test(l));
	if (nextHeaderIndex < 0) {
		nextHeaderIndex = lines.length;
	}

	const before = lines.slice(0, sectionIndex + 1);
	const after = lines.slice(nextHeaderIndex);
	return [...before, "", ...rendered, ...after].join("\n");
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
	for (const line of sectionLines) {
		const m = line.match(/^\s*-\s+\[( |x|X)\]\s+(.+)$/);
		if (!m) {
			continue;
		}
		const checked = (m[1] ?? " ").toLowerCase();
		const done = checked === "x";
		const raw = (m[2] ?? "").trim();
		const idMatch = raw.match(/\^([A-Za-z0-9_-]+)/);
		const id = idMatch?.[1] ? normalizeId(idMatch[1]) : getNextStepId(steps);
		const withoutId = raw.replace(/\s*\^[A-Za-z0-9_-]+/g, " ").replace(/\s+/g, " ").trim();
		const doneAtMatch = withoutId.match(/\s+⏱(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})\s*$/);
		const completed_at = doneAtMatch?.[1];
		const withoutDoneAt = withoutId.replace(/\s+⏱\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}\s*$/, "").trim();
		const noteMatch = withoutDoneAt.match(/\[\[[^\]]+\]\]/);
		const note = noteMatch?.[0];
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
			note,
			completed_at,
		});
	}
	return steps;
}

export async function createOrOpenGoal(plugin: PWorkbenchPlugin, goalName: string): Promise<void> {
	const folder = plugin.settings.goalsFolder;
	await ensureFolder(plugin, folder);

	const existed = await findGoalFileByName(plugin, goalName);
	if (existed) {
		await plugin.app.workspace.getLeaf(true).openFile(existed);
		return;
	}

	const safeName = goalName.trim().replace(/[\\/:*?"<>|]/g, "_") || "新目标";
	let path = normalizePath(`${folder}/${safeName}.md`);
	let suffix = 1;
	while (plugin.app.vault.getAbstractFileByPath(path)) {
		path = normalizePath(`${folder}/${safeName}-${suffix}.md`);
		suffix += 1;
	}

	const content = buildGoalTemplate(goalName);

	const file = await plugin.app.vault.create(path, content);
	await plugin.app.workspace.getLeaf(true).openFile(file);
}

export async function createGoalFileOnly(plugin: PWorkbenchPlugin, goalName: string): Promise<TFile> {
	const name = goalName.trim();
	if (!name) {
		throw new Error("empty-goal-name");
	}
	const folder = plugin.settings.goalsFolder;
	await ensureFolder(plugin, folder);
	const existed = await findGoalFileByName(plugin, name);
	if (existed) {
		return existed;
	}

	const safeName = name.replace(/[\\/:*?"<>|]/g, "_") || "新目标";
	let path = normalizePath(`${folder}/${safeName}.md`);
	let suffix = 1;
	while (plugin.app.vault.getAbstractFileByPath(path)) {
		path = normalizePath(`${folder}/${safeName}-${suffix}.md`);
		suffix += 1;
	}
	return plugin.app.vault.create(path, buildGoalTemplate(name));
}

export async function addGoalToToday(plugin: PWorkbenchPlugin, goalName: string): Promise<TFile> {
	const file = await createGoalFileOnly(plugin, goalName);
	const status = getGoalStatus(plugin, file);
	if (status === "completed" || status === "archived") {
		throw new Error("goal-not-active");
	}
	if (status === "dormant") {
		throw new Error("goal-dormant");
	}
	await updateFrontmatter(plugin, file, (fm) => {
		fm.type = "goal";
		// 这里只允许加入本就 active 的目标，避免误把已完成/归档改回 active
		fm.status = "active";
		if (!fm.created) {
			fm.created = todayDate();
		}
		if (fm.completed_date) {
			fm.completed_date = null;
		}
		if (!fm.step_count) {
			fm.step_count = 0;
		}
		if (!fm.done_count) {
			fm.done_count = 0;
		}
		if (fm.current_step_id === undefined) {
			fm.current_step_id = null;
		}
		if (fm.dormant_until !== undefined) {
			fm.dormant_until = null;
		}
	});
	return file;
}

export async function sleepGoal(plugin: PWorkbenchPlugin, goal: GoalRecord): Promise<void> {
	const days = Math.max(1, plugin.settings.dormantDays || 7);
	const until = addDays(new Date(), days).toISOString().slice(0, 10);
	await updateFrontmatter(plugin, goal.file, (fm) => {
		fm.status = "dormant";
		fm.dormant_until = until;
	});
}

export async function wakeDueDormantGoals(plugin: PWorkbenchPlugin): Promise<void> {
	const folder = normalizePath(plugin.settings.goalsFolder);
	const files = plugin.app.vault.getFiles().filter((file) => file.path.startsWith(`${folder}/`));
	const today = todayDate();
	for (const file of files) {
		const status = getGoalStatus(plugin, file);
		if (status !== "dormant") {
			continue;
		}
		const until = getDormantUntil(plugin, file);
		if (!until || until <= today) {
			await updateFrontmatter(plugin, file, (fm) => {
				fm.status = "active";
				fm.dormant_until = null;
			});
		}
	}
}

export async function chooseReadyStep(plugin: PWorkbenchPlugin, goal: GoalRecord, stepIndex: number, editedDescription?: string): Promise<void> {
	const { frontmatter, body } = await getGoalContent(plugin, goal.file);
	const currentId = extractCurrentStepId(frontmatter);
	const steps = parseStepsFromBody(body, currentId);
	const readySteps = steps.filter((s) => s.status === "ready");
	const target = readySteps[stepIndex];
	if (!target) return;

	const newDescription = (editedDescription ?? target.description).trim() || target.description;

	await updateFrontmatter(plugin, goal.file, (fm) => {
		fm.current_step_id = target.id;
	});

	const updatedSteps = steps.map((s) => (s.id === target.id ? { ...s, description: newDescription } : s));
	const newBody = updateStepsInSection(body, updatedSteps);
	await plugin.app.vault.modify(goal.file, frontmatter + newBody);
}

export async function updateReadyStepText(plugin: PWorkbenchPlugin, goal: GoalRecord, stepIndex: number, text: string): Promise<void> {
	const { frontmatter, body } = await getGoalContent(plugin, goal.file);
	const currentId = extractCurrentStepId(frontmatter);
	const steps = parseStepsFromBody(body, currentId);
	const readySteps = steps.filter((s) => s.status === "ready");
	const target = readySteps[stepIndex];
	if (!target) return;

	const updatedSteps = steps.map((s) => (s.id === target.id ? { ...s, description: text.trim() || s.description } : s));
	const newBody = updateStepsInSection(body, updatedSteps);
	await plugin.app.vault.modify(goal.file, frontmatter + newBody);
}

export async function updateChosenStepText(plugin: PWorkbenchPlugin, goal: GoalRecord, text: string): Promise<void> {
	const { frontmatter, body } = await getGoalContent(plugin, goal.file);
	const currentId = extractCurrentStepId(frontmatter);
	const steps = parseStepsFromBody(body, currentId);
	const chosen = steps.find((s: GoalStep) => normalizeId(s.id) === currentId);
	const normalizedText = text.trim();
	if (!normalizedText) {
		new Notice("请先输入或选择一个任务。");
		return;
	}

	if (chosen) {
		const updatedSteps = steps.map((s: GoalStep) => (s.id === chosen.id ? { ...s, description: normalizedText } : s));
		const newBody = updateStepsInSection(body, updatedSteps);
		await plugin.app.vault.modify(goal.file, frontmatter + newBody);
	} else {
		// 优先复用“最后一个未完成任务”（和输入文案完全一致），避免重复新增 step
		const matchCandidates = steps
			.map((s, idx) => ({ s, idx }))
			.filter(({ s }) => s.status === "ready" && s.description === normalizedText);
		const matched = matchCandidates.at(-1)?.s ?? null;
		let updatedSteps: GoalStep[];
		let selectedId: string;
		if (matched) {
			updatedSteps = steps;
			selectedId = matched.id;
		} else {
			const newId = getNextStepId(steps);
			const newStep: GoalStep = { id: newId, description: normalizedText, status: "chosen" };
			updatedSteps = [...steps, newStep];
			selectedId = newId;
		}
		const newBody = updateStepsInSection(body, updatedSteps);
		await plugin.app.vault.modify(goal.file, frontmatter + newBody);
		await updateFrontmatter(plugin, goal.file, (fm) => {
			fm.current_step_id = selectedId;
			fm.step_count = updatedSteps.length;
		});
	}
}

export async function createOrOpenInspiration(plugin: PWorkbenchPlugin, goal: GoalRecord): Promise<void> {
	const { frontmatter, body } = await getGoalContent(plugin, goal.file);
	const currentId = extractCurrentStepId(frontmatter);
	const steps = parseStepsFromBody(body, currentId);
	const chosen = steps.find((s: GoalStep) => normalizeId(s.id) === currentId);
	if (!chosen) {
		new Notice("请先选择“当前进行”的步骤。");
		return;
	}

	const existingLink = chosen.note?.match(/\[\[(.+?)\]\]/)?.[0];
	if (existingLink) {
		const file = plugin.app.metadataCache.getFirstLinkpathDest(existingLink.replace(/[\[\]]/g, ""), goal.file.path);
		if (file instanceof TFile) {
			await plugin.app.workspace.getLeaf(true).openFile(file);
			return;
		}
	}

	await ensureFolder(plugin, plugin.settings.inboxFolder);
	const noteName = makeInspirationName(chosen.description);
	const notePath = normalizePath(`${plugin.settings.inboxFolder}/${noteName}`);
	const goalLink = `[[${goal.file.basename}]]`;
	const content = `---
type: inspiration
source_goal: "${goalLink}"
step: "${chosen.description.replace(/"/g, '\\"')}"
tags: []
created: ${todayDate()}
---
`;
	const noteFile = await plugin.app.vault.create(notePath, content);
	const noteLink = `[[${noteFile.basename}]]`;

	// 更新正文中的 note 链接
	const updatedSteps = steps.map((s: GoalStep) => (s.id === chosen.id ? { ...s, note: noteLink } : s));
	const newBody = updateStepsInSection(body, updatedSteps);
	await plugin.app.vault.modify(goal.file, frontmatter + newBody);

	await plugin.app.workspace.getLeaf(true).openFile(noteFile);
}

export async function applyNextStepResult(plugin: PWorkbenchPlugin, goal: GoalRecord): Promise<boolean> {
	const { frontmatter, body } = await getGoalContent(plugin, goal.file);
	const currentId = extractCurrentStepId(frontmatter);
	const steps = parseStepsFromBody(body, currentId);
	const effectiveChosen = steps.find((s: GoalStep) => normalizeId(s.id) === currentId);

	if (!effectiveChosen) {
		new Notice("当前没有可完结的“当前进行”步骤。");
		return false;
	}

	// 1. 将 chosen 设为 done
	const updatedSteps = steps.map((s: GoalStep) => {
		if (effectiveChosen && s.id === effectiveChosen.id) {
			return { ...s, status: "done" as const, completed_at: nowDisplayTime() };
		}
		return s;
	});

	// 2. 清理旧的 ready 步骤（AI 选项改为仅在 UI 暂存）
	const finalSteps = updatedSteps.filter((s: GoalStep) => s.status !== "ready");

	// 3. 更新正文
	const newBody = updateStepsInSection(body, finalSteps);
	await plugin.app.vault.modify(goal.file, frontmatter + newBody);

	// 4. 更新 Frontmatter
	await updateFrontmatter(plugin, goal.file, (newFm) => {
		newFm.current_step_id = null;
		newFm.step_count = finalSteps.length;
		newFm.done_count = finalSteps.filter((s: GoalStep) => s.status === "done").length;
	});
	return true;
}

export async function archiveGoal(plugin: PWorkbenchPlugin, goal: GoalRecord): Promise<void> {
	await updateFrontmatter(plugin, goal.file, (fm) => {
		fm.status = "archived";
	});
}

export async function finishGoal(plugin: PWorkbenchPlugin, goal: GoalRecord): Promise<void> {
	await updateFrontmatter(plugin, goal.file, (fm) => {
		fm.status = "completed";
		fm.completed_date = todayDate();
	});
}

export function buildAiContext(goal: GoalRecord): { title: string; done: string[]; chosen: string; ready: string[] } {
	const steps = goal.frontmatter.steps ?? [];
	const currentId = goal.frontmatter.current_step_id ? normalizeId(goal.frontmatter.current_step_id) : "";
	const chosen = steps.find((s: GoalStep) => normalizeId(s.id) === currentId)?.description ?? "";
	const done = steps.filter((s: GoalStep) => s.status === "done").map((s: GoalStep) => s.description);
	const ready = steps
		.filter((s: GoalStep) => s.status === "ready" && normalizeId(s.id) !== currentId)
		.map((s: GoalStep) => s.description);
	return {
		title: goal.title,
		done,
		chosen,
		ready,
	};
}

function stripFrontmatter(content: string): string {
	return content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
}

function toExcerpt(content: string, maxLen = 140): string {
	const text = stripFrontmatter(content).replace(/\r?\n+/g, " ").replace(/\s+/g, " ").trim();
	return text.length > maxLen ? `${text.slice(0, maxLen)}...` : text;
}

function parseLinkTarget(link: string): string {
	const inner = link.replace(/^\[\[|\]\]$/g, "");
	return inner.split("|")[0]?.trim() ?? "";
}

function extractGoalOverview(content: string): string {
	const body = stripFrontmatter(content);
	const lines = body.split("\n");
	const collected: string[] = [];
	let started = false;
	for (const line of lines) {
		const m = line.match(/^\s*>\s*(.+)\s*$/);
		if (m?.[1]) {
			started = true;
			collected.push(m[1].trim());
			continue;
		}
		if (started) {
			break;
		}
	}
	return collected.join(" ").trim();
}

export async function buildAiContextWithInspiration(
	plugin: PWorkbenchPlugin,
	goal: GoalRecord
): Promise<{ title: string; overview: string; done: string[]; chosen: string; ready: string[]; inspirations: string[] }> {
	const base = buildAiContext(goal);
	let overview = "";
	try {
		const goalContent = await plugin.app.vault.cachedRead(goal.file);
		overview = extractGoalOverview(goalContent);
	} catch (_error) {
		overview = "";
	}
	const doneSteps = (goal.frontmatter.steps ?? []).filter((s: GoalStep) => s.status === "done");
	const inspirations: string[] = [];

	for (const step of doneSteps) {
		if (!step.note) {
			continue;
		}
		const target = parseLinkTarget(step.note);
		if (!target) {
			continue;
		}
		const noteFile = plugin.app.metadataCache.getFirstLinkpathDest(target, goal.file.path);
		if (!noteFile) {
			continue;
		}
		try {
			const noteContent = await plugin.app.vault.cachedRead(noteFile);
			const excerpt = toExcerpt(noteContent);
			if (excerpt) {
				inspirations.push(`${step.description}｜${excerpt}`);
			}
		} catch (_error) {
			// ignore single note read failure
		}
	}

	return {
		...base,
		overview,
		inspirations,
	};
}

export function collectGoalNameCandidates(plugin: PWorkbenchPlugin, input: string): string[] {
	const folder = normalizePath(plugin.settings.goalsFolder);
	const all = plugin.app.vault
		.getFiles()
		.filter((file) => file.path.startsWith(`${folder}/`))
		.filter((file) => {
			const status = getGoalStatus(plugin, file);
			return status !== "completed" && status !== "archived" && status !== "dormant";
		})
		.map((file) => file.basename);
	const keyword = input.trim().toLowerCase();
	if (!keyword) {
		return all.slice(0, 8);
	}
	return all.filter((name) => name.toLowerCase().includes(keyword)).slice(0, 8);
}

export function readHistory(goal: GoalRecord): GoalStep[] {
	const steps = goal.frontmatter.steps ?? [];
	// 正文中任务通常是按顺序排列的，历史记录倒序显示
	return [...steps]
		.filter((step: GoalStep) => step.status === "done")
		.reverse();
}

export function getCurrentChosen(goal: GoalRecord): GoalStep | undefined {
	const currentId = goal.frontmatter.current_step_id ? normalizeId(goal.frontmatter.current_step_id) : "";
	return (goal.frontmatter.steps ?? []).find((s: GoalStep) => normalizeId(s.id) === currentId);
}

export function getReadySteps(goal: GoalRecord): GoalStep[] {
	return (goal.frontmatter.steps ?? []).filter((s: GoalStep) => s.status === "ready").slice(0, 3);
}

export function lastDoneAt(goal: GoalRecord): string {
	const history = readHistory(goal);
	return history.length > 0 ? "已更新" : "暂无";
}

export function getRelatedNotes(goal: GoalRecord): string[] {
	const steps = goal.frontmatter.steps ?? [];
	return steps.filter((s: GoalStep) => s.note).map((s: GoalStep) => s.note!) || [];
}
