import { addIcon, Modal, Notice, normalizePath, Plugin, TFile, WorkspaceLeaf } from "obsidian";
import { DEFAULT_SETTINGS, PWorkbenchSettingTab, PWorkbenchSettings } from "./settings";
import { P_WORKBENCH_VIEW_TYPE, PWorkbenchView } from "./views/workbenchView";
import { createGoalFileOnly } from "./services/goals";
import type { GoalRecord } from "./types";

const SEEDLING_ICON_ID = "pwb-seedling";

const SEEDLING_SVG =
	'<path d="M12 20v-4"/><path d="M7 20h10"/><path d="M12 16c0-3.5 2-6.5 5-8-0.3 3.5-1.8 6.3-5 8Z"/><path d="M12 16c0-3-2-5.3-5-6 0.2 2.8 1.5 5.1 5 6Z"/><path d="M12 12c0-2.7 1.7-4.8 4.3-5.7-0.2 2.4-1.2 4.3-4.3 5.7Z"/>';

export default class PWorkbenchPlugin extends Plugin {
	settings: PWorkbenchSettings;

	async onload(): Promise<void> {
		await this.loadSettings();
		addIcon(SEEDLING_ICON_ID, SEEDLING_SVG);

		this.registerView(P_WORKBENCH_VIEW_TYPE, (leaf) => new PWorkbenchView(leaf, this));
		// 左侧栏快捷图标：点击直接打开 P人工作台
		this.addRibbonIcon("leaf", "打开P人工作台", () => {
			void this.activateWorkbench();
		});
		this.addRibbonIcon("dice", "P人工作台：随便选一个", () => {
			new RandomPickModal(this).open();
		});
		this.addCommand({
			id: "open-p-workbench",
			name: "打开P人工作台",
			callback: () => {
				void this.activateWorkbench();
			},
		});
		this.addCommand({
			id: "random-pick-goal",
			name: "P人工作台：随便选一个",
			callback: () => {
				new RandomPickModal(this).open();
			},
		});
		this.addCommand({
			id: "create-goal-file",
			name: "新建目标",
			callback: () => {
				new NewGoalModal(this, async (name) => {
					const goalName = name.trim();
					if (!goalName) {
						new Notice("目标名称不能为空。");
						return;
					}
					try {
						const file = await createGoalFileOnly(this, goalName);
						await this.app.workspace.getLeaf(true).openFile(file);
						new Notice(`已创建目标：${goalName}`);
					} catch (error) {
						console.error("[P人工作台] 新建目标失败", error);
						new Notice("新建目标失败。");
					}
				}).open();
			},
		});
		this.addCommand({
			id: "reselect-today-goals",
			name: "重新选择",
			callback: () => {
				new ReselectGoalsModal(this).open();
			},
		});

		this.addSettingTab(new PWorkbenchSettingTab(this.app, this));
		this.registerEvent(
			this.app.metadataCache.on("changed", (file) => {
				const goalsFolder = normalizePath(this.settings.goalsFolder);
				if (file.path.startsWith(`${goalsFolder}/`)) {
					this.requestRefresh();
				}
			})
		);
	}

	onunload(): void {
		this.app.workspace.getLeavesOfType(P_WORKBENCH_VIEW_TYPE).forEach((leaf) => {
			void leaf.setViewState({ type: "empty" });
		});
	}

	async activateWorkbench(): Promise<void> {
		let leaf: WorkspaceLeaf | null = this.app.workspace.getLeavesOfType(P_WORKBENCH_VIEW_TYPE)[0] ?? null;
		if (!leaf) {
			leaf = this.app.workspace.getRightLeaf(false);
			if (!leaf) {
				return;
			}
			await leaf.setViewState({ type: P_WORKBENCH_VIEW_TYPE, active: true });
		}
		this.app.workspace.revealLeaf(leaf);
		const view = leaf.view;
		if (view instanceof PWorkbenchView) {
			await view.reload();
		}
	}

	requestRefresh(): void {
		this.app.workspace.getLeavesOfType(P_WORKBENCH_VIEW_TYPE).forEach((leaf) => {
			const view = leaf.view;
			if (view instanceof PWorkbenchView) {
				void view.reload();
			}
		});
	}

	applyTodaySelection(goals: GoalRecord[]): GoalRecord[] {
		const selectedPaths = this.settings.todayGoalPaths ?? [];
		if (selectedPaths.length === 0) {
			return goals;
		}
		const map = new Map(goals.map((g) => [g.file.path, g]));
		const selected: GoalRecord[] = [];
		for (const path of selectedPaths) {
			const hit = map.get(path);
			if (hit) {
				selected.push(hit);
			}
		}
		return selected.length > 0 ? selected : goals;
	}

	async updateTodayGoalPaths(paths: string[]): Promise<void> {
		this.settings.todayGoalPaths = paths.slice(0, this.settings.maxActiveGoals);
		await this.saveSettings();
		this.requestRefresh();
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, (await this.loadData()) as Partial<PWorkbenchSettings>);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}

class NewGoalModal extends Modal {
	private onSubmit: (name: string) => Promise<void>;

	constructor(plugin: PWorkbenchPlugin, onSubmit: (name: string) => Promise<void>) {
		super(plugin.app);
		this.onSubmit = onSubmit;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h3", { text: "新建目标" });
		const input = contentEl.createEl("input", {
			type: "text",
			placeholder: "输入目标名称",
		});
		input.style.width = "100%";
		input.style.marginBottom = "12px";
		input.focus();
		const button = contentEl.createEl("button", { text: "创建" });
		const submit = async () => {
			button.disabled = true;
			try {
				await this.onSubmit(input.value);
				this.close();
			} finally {
				button.disabled = false;
			}
		};
		button.onclick = () => {
			void submit();
		};
		input.addEventListener("keydown", (evt) => {
			if (evt.key === "Enter") {
				evt.preventDefault();
				void submit();
			}
		});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

class ReselectGoalsModal extends Modal {
	private plugin: PWorkbenchPlugin;
	private selectedPaths = new Set<string>();
	private candidates: Array<{ path: string; name: string; status: string }> = [];
	private listContainer: HTMLDivElement | null = null;

	constructor(plugin: PWorkbenchPlugin) {
		super(plugin.app);
		this.plugin = plugin;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h3", { text: "重新选择今天任务" });
		contentEl.createEl("p", { text: `最多选择 ${this.plugin.settings.maxActiveGoals} 个。` });
		this.selectedPaths = new Set(this.plugin.settings.todayGoalPaths ?? []);

		const folder = normalizePath(this.plugin.settings.goalsFolder);
		const files = this.plugin.app.vault.getFiles().filter((f) => f.path.startsWith(`${folder}/`));
		this.candidates = [];
		for (const file of files) {
			const cache = this.plugin.app.metadataCache.getFileCache(file);
			const fm = cache?.frontmatter as Record<string, unknown> | undefined;
			const status = String(fm?.status ?? "active");
			// 仅显示 active / dormant
			if (status !== "active" && status !== "dormant") {
				continue;
			}
			this.candidates.push({ path: file.path, name: file.basename, status });
		}
		this.candidates.sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));

		const searchInput = contentEl.createEl("input", {
			type: "text",
			placeholder: "搜索目标名称...",
		});
		searchInput.style.width = "100%";
		searchInput.style.marginBottom = "10px";

		this.listContainer = contentEl.createDiv();
		this.listContainer.style.maxHeight = "280px";
		this.listContainer.style.overflowY = "auto";
		this.listContainer.style.paddingRight = "4px";
		this.renderList("");

		searchInput.addEventListener("input", (evt) => {
			const keyword = (evt.currentTarget as HTMLInputElement).value.trim().toLowerCase();
			this.renderList(keyword);
		});

		const button = contentEl.createEl("button", { text: "应用选择" });
		button.style.marginTop = "10px";
		button.onclick = () => {
			void this.submit();
		};
	}

	private renderList(keyword: string): void {
		if (!this.listContainer) {
			return;
		}
		this.listContainer.empty();
		const filtered = keyword
			? this.candidates.filter((item) => item.name.toLowerCase().includes(keyword))
			: this.candidates;
		if (filtered.length === 0) {
			this.listContainer.createEl("div", { text: "未找到匹配目标。" });
			return;
		}

		for (const item of filtered) {
			const row = this.listContainer.createEl("label");
			row.style.display = "flex";
			row.style.gap = "8px";
			row.style.alignItems = "center";
			row.style.marginBottom = "6px";
			const checkbox = row.createEl("input", { type: "checkbox" });
			checkbox.checked = this.selectedPaths.has(item.path);
			checkbox.addEventListener("change", () => {
				if (checkbox.checked) {
					this.selectedPaths.add(item.path);
				} else {
					this.selectedPaths.delete(item.path);
				}
			});
			row.createSpan({ text: item.status === "dormant" ? `${item.name} 💤` : item.name });
		}
	}

	private async submit(): Promise<void> {
		const selected = Array.from(this.selectedPaths);
		if (selected.length > this.plugin.settings.maxActiveGoals) {
			new Notice(`最多只能选择 ${this.plugin.settings.maxActiveGoals} 个任务。`);
			return;
		}
		// 若选中了休眠任务，应用时自动唤醒为 active
		for (const path of selected) {
			const candidate = this.candidates.find((item) => item.path === path);
			if (candidate?.status !== "dormant") {
				continue;
			}
			const file = this.plugin.app.vault.getAbstractFileByPath(path);
			if (!(file instanceof TFile)) {
				continue;
			}
			await this.plugin.app.fileManager.processFrontMatter(file, (fm) => {
				const row = fm as Record<string, unknown>;
				row.status = "active";
				row.dormant_until = null;
			});
		}
		await this.plugin.updateTodayGoalPaths(selected);
		new Notice(`已更新今天任务：${selected.length} 个`);
		this.close();
	}

	onClose(): void {
		this.contentEl.empty();
		this.selectedPaths = new Set<string>();
		this.candidates = [];
		this.listContainer = null;
	}
}

class RandomPickModal extends Modal {
	private plugin: PWorkbenchPlugin;
	private candidates: Array<{ path: string; name: string }> = [];
	private current: { path: string; name: string } | null = null;
	private headingEl: HTMLDivElement | null = null;
	private nameEl: HTMLDivElement | null = null;
	private confirmButton: HTMLButtonElement | null = null;
	private rerollButton: HTMLButtonElement | null = null;

	constructor(plugin: PWorkbenchPlugin) {
		super(plugin.app);
		this.plugin = plugin;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.style.padding = "12px 6px";

		this.headingEl = contentEl.createDiv({ text: "🎲 今天试试这个吧：" });
		this.headingEl.style.fontSize = "16px";
		this.headingEl.style.fontWeight = "600";
		this.headingEl.style.marginBottom = "10px";

		this.nameEl = contentEl.createDiv();
		this.nameEl.style.fontSize = "18px";
		this.nameEl.style.marginBottom = "14px";

		const actions = contentEl.createDiv();
		actions.style.display = "flex";
		actions.style.gap = "8px";
		actions.style.alignItems = "center";

		this.confirmButton = actions.createEl("button", { text: "就它了" });
		this.rerollButton = actions.createEl("button", { text: "换一个" });

		this.confirmButton.onclick = () => {
			void this.confirmPick();
		};
		this.rerollButton.onclick = () => {
			this.pickOne(true);
		};

		this.loadCandidates();
		this.pickOne(false);
	}

	private loadCandidates(): void {
		const folder = normalizePath(this.plugin.settings.goalsFolder);
		const files = this.plugin.app.vault.getFiles().filter((f) => f.path.startsWith(`${folder}/`));
		const next: Array<{ path: string; name: string }> = [];
		for (const file of files) {
			const cache = this.plugin.app.metadataCache.getFileCache(file);
			const fm = cache?.frontmatter as Record<string, unknown> | undefined;
			const status = String(fm?.status ?? "active");
			if (status !== "active" && status !== "dormant") {
				continue;
			}
			next.push({ path: file.path, name: file.basename });
		}
		this.candidates = next;
	}

	private pickOne(avoidCurrent: boolean): void {
		if (!this.nameEl || !this.confirmButton || !this.rerollButton) {
			return;
		}
		if (this.candidates.length === 0) {
			this.current = null;
			this.nameEl.setText("暂无可选目标");
			this.confirmButton.disabled = true;
			this.rerollButton.disabled = true;
			return;
		}
		let pool = this.candidates;
		if (avoidCurrent && this.current && this.candidates.length > 1) {
			pool = this.candidates.filter((item) => item.path !== this.current?.path);
		}
		const chosen = pool[Math.floor(Math.random() * pool.length)] ?? null;
		this.current = chosen;
		this.nameEl.setText(chosen?.name ?? "暂无可选目标");
		this.confirmButton.disabled = !chosen;
		this.rerollButton.disabled = this.candidates.length <= 1;
	}

	private async confirmPick(): Promise<void> {
		if (!this.current || !this.confirmButton || !this.rerollButton) {
			return;
		}
		this.confirmButton.disabled = true;
		this.rerollButton.disabled = true;
		try {
			const selected = this.plugin.settings.todayGoalPaths ?? [];
			const alreadySelected = selected.includes(this.current.path);
			if (!alreadySelected && selected.length >= this.plugin.settings.maxActiveGoals) {
				new Notice("不要贪多噢，今日可选目标已满，你重新选择或增加可选目标数量");
				return;
			}
			if (!alreadySelected) {
				const file = this.plugin.app.vault.getAbstractFileByPath(this.current.path);
				if (file instanceof TFile) {
					await this.plugin.app.fileManager.processFrontMatter(file, (fm) => {
						const row = fm as Record<string, unknown>;
						if (row.status === "dormant") {
							row.status = "active";
							row.dormant_until = null;
						}
					});
				}
				const next = [this.current.path, ...selected.filter((path) => path !== this.current?.path)];
				await this.plugin.updateTodayGoalPaths(next);
			}
			this.close();
			await this.plugin.activateWorkbench();
		} finally {
			if (this.confirmButton) {
				this.confirmButton.disabled = false;
			}
			if (this.rerollButton) {
				this.rerollButton.disabled = this.candidates.length <= 1;
			}
		}
	}

	onClose(): void {
		this.contentEl.empty();
		this.candidates = [];
		this.current = null;
		this.headingEl = null;
		this.nameEl = null;
		this.confirmButton = null;
		this.rerollButton = null;
	}
}
