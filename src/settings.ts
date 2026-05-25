import { App, PluginSettingTab, Setting } from "obsidian";
import PWorkbenchPlugin from "./main";

export interface PWorkbenchSettings {
	maxActiveGoals: number;
	dormantDays: number;
	bufferTaskName: string;
	aiApiKey: string;
	aiBaseUrl: string;
	aiModel: string;
	aiPromptTemplate: string;
	goalsFolder: string;
	inboxFolder: string;
	todayGoalPaths: string[];
	dailyRecords: Record<string, DailyRecord>;
}

export interface DailyRecord {
	date: string;
	checkedIn: boolean;
	primaryEntry?: DailyRecordEntry;
	activities: DailyRecordEntry[];
}

export interface DailyRecordEntry {
	type: "step" | "buffer" | "timer";
	label: string;
	goalPath?: string;
	durationMs?: number;
	finishedAt: string;
}

export const DEFAULT_AI_PROMPT_TEMPLATE = [
	"You are a task decomposition assistant designed for Perceiving (P) personality types.",
	"Goal title: {{title}}",
	"Goal overview: {{overview}}",
	"Completed steps: {{done}}",
	"Inspiration notes excerpt: {{inspirations}}",
	"Current task: {{chosen}}",
	"Based on current progress, provide 3 minimal, specific, and immediately actionable next steps.",
	"Requirements:",
	"1. Each step must be strictly under 15 words.",
	"2. Steps must be tiny to reduce friction.",
	"3. Return ONLY JSON format:",
	'{"options": ["Step 1", "Step 2", "Step 3"]}',
].join("\n");

export const DEFAULT_SETTINGS: PWorkbenchSettings = {
	maxActiveGoals: 3,
	dormantDays: 7,
	bufferTaskName: "Breathe",
	aiApiKey: "",
	aiBaseUrl: "https://api.openai.com/v1/chat/completions",
	aiModel: "",
	aiPromptTemplate: DEFAULT_AI_PROMPT_TEMPLATE,
	goalsFolder: "Goals",
	inboxFolder: "Inbox",
	todayGoalPaths: [],
	dailyRecords: {},
};

export class PWorkbenchSettingTab extends PluginSettingTab {
	plugin: PWorkbenchPlugin;

	constructor(app: App, plugin: PWorkbenchPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		;

		new Setting(containerEl)
			.setName("Max active goals")
			.setDesc("Number of active goals to display on the workbench (1-5).")
			.addSlider((slider) =>
				slider
					.setLimits(1, 5, 1)
					.setValue(this.plugin.settings.maxActiveGoals)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.maxActiveGoals = Math.max(1, Math.min(5, value));
						await this.plugin.saveSettings();
						this.plugin.requestRefresh();
					})
			);

		new Setting(containerEl)
			.setName("Default task")
			.setDesc("Name of the buffer task at the bottom. Defaults to \"breathe\"")
			.addText((text) =>
				text
					.setPlaceholder("Breathe")
					.setValue(this.plugin.settings.bufferTaskName)
					.onChange(async (value) => {
						this.plugin.settings.bufferTaskName = value.trim();
						await this.plugin.saveSettings();
						this.plugin.requestRefresh();
					})
			);

		new Setting(containerEl)
			.setName("Dormant days")
			.setDesc("Number of days before a sleeping goal returns to active")
			.addSlider((slider) =>
				slider
					.setLimits(1, 30, 1)
					.setValue(this.plugin.settings.dormantDays)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.dormantDays = Math.max(1, Math.min(30, value));
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("API key")
			.setDesc("Used for next step AI breakdown requests")
			.addText((text) =>
				text
					.setPlaceholder("Enter API key")
					.setValue(this.plugin.settings.aiApiKey)
					.onChange(async (value) => {
						this.plugin.settings.aiApiKey = value.trim();
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Base URL")
			.setDesc("Compatible API endpoint address")
			.addText((text) =>
				text
					.setPlaceholder("Enter base URL")
					.setValue(this.plugin.settings.aiBaseUrl)
					.onChange(async (value) => {
						this.plugin.settings.aiBaseUrl = value.trim() || DEFAULT_SETTINGS.aiBaseUrl;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Model")
			.setDesc("Model name (e.g., deepseek-chat, gpt-4o-mini)")
			.addText((text) =>
				text
					.setPlaceholder("Deepseek-chat")
					.setValue(this.plugin.settings.aiModel)
					.onChange(async (value) => {
						this.plugin.settings.aiModel = value.trim();
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("AI prompt template")
			.setDesc("Editable template. Supports: {{title}} {{overview}} {{done}} {{inspirations}} {{chosen}}")
			.addTextArea((text) =>
				text
					.setPlaceholder(DEFAULT_AI_PROMPT_TEMPLATE)
					.setValue(this.plugin.settings.aiPromptTemplate)
					.onChange(async (value) => {
						this.plugin.settings.aiPromptTemplate = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Goals folder")
			.setDesc("Default directory for creating goal files.")
			.addText((text) =>
				text
					.setPlaceholder("Goals")
					.setValue(this.plugin.settings.goalsFolder)
					.onChange(async (value) => {
						this.plugin.settings.goalsFolder = value.trim() || "Goals";
						await this.plugin.saveSettings();
						this.plugin.requestRefresh();
					})
			);

		new Setting(containerEl)
			.setName("Inspiration folder")
			.setDesc("Directory for creating inspiration notes.")
			.addText((text) =>
				text
					.setPlaceholder("Inbox")
					.setValue(this.plugin.settings.inboxFolder)
					.onChange(async (value) => {
						this.plugin.settings.inboxFolder = value.trim() || "Inbox";
						await this.plugin.saveSettings();
					})
			);
	}
}
