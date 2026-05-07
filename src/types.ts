import type { TFile } from "obsidian";

export type GoalStatus = "active" | "completed" | "archived" | "dormant";
export type StepStatus = "pending_ai" | "ready" | "chosen" | "done";

export interface GoalStep {
	id: string; // block id like ^step_1
	description: string;
	status: "done" | "chosen" | "ready";
	note?: string;
	completed_at?: string; // Optional for history display
}

export interface GoalFrontmatter {
	type: "goal";
	status: "active" | "completed" | "archived" | "dormant";
	created: string;
	completed_date: string | null;
	dormant_until?: string | null;
	tags: string[];
	step_count?: number;
	done_count?: number;
	current_step_id?: string | null;
	steps?: GoalStep[]; // Runtime only, not persisted in YAML
}

export interface GoalRecord {
	file: TFile;
	title: string;
	frontmatter: GoalFrontmatter;
}

export interface DataviewPageLike {
	file?: {
		path?: string;
		name?: string;
		basename?: string;
	};
	[key: string]: unknown;
}
