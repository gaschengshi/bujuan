import { ItemView, Notice, WorkspaceLeaf } from "obsidian";
import { render } from "preact";
import type PWorkbenchPlugin from "../main";
import { Dashboard } from "../components/Dashboard";
import { isDataviewReady, queryActiveGoals } from "../services/dataview";
import { wakeDueDormantGoals } from "../services/goals";
import type { GoalRecord } from "../types";

export const P_WORKBENCH_VIEW_TYPE = "p-ren-workbench-view";

export class PWorkbenchView extends ItemView {
	plugin: PWorkbenchPlugin;
	private goals: GoalRecord[] = [];

	constructor(leaf: WorkspaceLeaf, plugin: PWorkbenchPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return P_WORKBENCH_VIEW_TYPE;
	}

	getDisplayText(): string {
		return "Bujuan workbench";
	}

	getIcon(): string {
		return "leaf";
	}

	async onOpen(): Promise<void> {
		this.contentEl.empty();
		this.contentEl.addClass("pwb-root");
		await this.reload();
	}

	async onClose(): Promise<void> {
		render(null, this.contentEl);
	}

	async reload(): Promise<void> {
		if (!isDataviewReady(this.app)) {
			this.contentEl.empty();
			this.contentEl.createEl("div", {
				cls: "pwb-empty",
				text: "Dataview not detected. Please install and enable dataview first",
			});
			return;
		}

		try {
			await wakeDueDormantGoals(this.plugin);
			const goals = await queryActiveGoals(this.app, this.plugin.settings.goalsFolder);
			this.goals = this.plugin.applyTodaySelection(goals);
			render(<Dashboard plugin={this.plugin} goals={this.goals} onRefresh={() => this.reload()} />, this.contentEl);
		} catch (error) {
			new Notice("Failed to load workbench. Please check goal frontmatter");
			console.error("[P人工作台] reload failed", error);
		}
	}
}
