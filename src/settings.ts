import { App, PluginSettingTab, Setting } from "obsidian";
import PWorkbenchPlugin from "./main";

export interface PWorkbenchSettings {
	maxActiveGoals: number;
	dormantDays: number;
	aiApiKey: string;
	aiBaseUrl: string;
	aiModel: string;
	aiPromptTemplate: string;
	goalsFolder: string;
	inboxFolder: string;
	todayGoalPaths: string[];
}

export const DEFAULT_AI_PROMPT_TEMPLATE = [
	"你是一个目标拆解助手，专门为 P 人（Perceiving，灵活型人格）设计。",
	"目标标题：{{title}}",
	"任务概述：{{overview}}",
	"已完成步骤：{{done}}",
	"相关灵感笔记摘要：{{inspirations}}",
	"当前执行的动作：{{chosen}}",
	"请根据当前进展，提供 3 个极简、具体、可立即执行的“下一步动作”建议。",
	"要求：",
	"1. 每个建议字数严格控制在 15 个汉字以内。",
	"2. 动作要极其微小，减少启动阻力。",
	"3. 仅返回 JSON 格式数据：",
	'{"options": ["建议1", "建议2", "建议3"]}',
].join("\n");

export const DEFAULT_SETTINGS: PWorkbenchSettings = {
	maxActiveGoals: 3,
	dormantDays: 7,
	aiApiKey: "",
	aiBaseUrl: "https://api.openai.com/v1/chat/completions",
	aiModel: "",
	aiPromptTemplate: DEFAULT_AI_PROMPT_TEMPLATE,
	goalsFolder: "Goals",
	inboxFolder: "Inbox",
	todayGoalPaths: [],
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

		containerEl.createEl("h2", { text: "P人工作台设置" });

		new Setting(containerEl)
			.setName("每日活跃目标上限")
			.setDesc("控制工作台当天展示的活跃目标数量（1-5）。")
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
			.setName("休眠天数")
			.setDesc("点击“休眠”后，目标在该天数后自动恢复为 active。")
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
			.setName("AI API Key")
			.setDesc("用于“下一步”AI拆解请求。")
			.addText((text) =>
				text
					.setPlaceholder("sk-...")
					.setValue(this.plugin.settings.aiApiKey)
					.onChange(async (value) => {
						this.plugin.settings.aiApiKey = value.trim();
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("AI Base URL")
			.setDesc("OpenAI兼容接口地址。")
			.addText((text) =>
				text
					.setPlaceholder("https://api.openai.com/v1/chat/completions")
					.setValue(this.plugin.settings.aiBaseUrl)
					.onChange(async (value) => {
						this.plugin.settings.aiBaseUrl = value.trim() || DEFAULT_SETTINGS.aiBaseUrl;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("AI Model")
			.setDesc("模型名（如 deepseek-chat、gpt-4o-mini）。留空将按服务商自动推断。")
			.addText((text) =>
				text
					.setPlaceholder("deepseek-chat")
					.setValue(this.plugin.settings.aiModel)
					.onChange(async (value) => {
						this.plugin.settings.aiModel = value.trim();
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("AI Prompt 模板")
			.setDesc("可编辑模板。支持变量：{{title}} {{overview}} {{done}} {{inspirations}} {{chosen}}")
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
			.setName("目标文件夹")
			.setDesc("目标文件默认创建目录。")
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
			.setName("灵感笔记文件夹")
			.setDesc("记录按钮创建灵感笔记时使用。")
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
