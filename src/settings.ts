import { App, PluginSettingTab, Setting } from "obsidian";
import type PWorkbenchPlugin from "./main";
import { t } from "./i18n";
import { PWorkbenchSettings } from "./types";
import { DEFAULT_AI_PROMPT_TEMPLATE, DEFAULT_SETTINGS } from "./constants";

export class PWorkbenchSettingTab extends PluginSettingTab {
	plugin: PWorkbenchPlugin;

	constructor(app: App, plugin: PWorkbenchPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl).setName(t("General", this.plugin.settings)).setHeading();

		new Setting(containerEl)
			.setName(t("Language", this.plugin.settings))
			.setDesc(t("Select your language", this.plugin.settings))
			.addDropdown((dropdown) =>
				dropdown
					.addOption("en", "English")
					.addOption("zh", "简体中文")
					.setValue(this.plugin.settings.language)
					.onChange(async (value: "en" | "zh") => {
						this.plugin.settings.language = value;
						await this.plugin.saveSettings();
						this.display(); // 刷新设置页面以应用新语言
						this.plugin.requestRefresh();
					})
			);

		new Setting(containerEl)
			.setName(t("Max active goals", this.plugin.settings))
			.setDesc(t("Number of active goals to display", this.plugin.settings))
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
			.setName(t("Default task", this.plugin.settings))
			.setDesc(t("Name of the buffer task", this.plugin.settings))
			.addText((text) =>
				text
					.setPlaceholder(t("Breathe", this.plugin.settings))
					.setValue(this.plugin.settings.bufferTaskName)
					.onChange(async (value) => {
						this.plugin.settings.bufferTaskName = value.trim();
						await this.plugin.saveSettings();
						this.plugin.requestRefresh();
					})
			);

		new Setting(containerEl)
			.setName(t("Dormant days", this.plugin.settings))
			.setDesc(t("Number of days before dormant returns", this.plugin.settings))
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

		new Setting(containerEl).setName(t("Ai suggest", this.plugin.settings)).setHeading();

		new Setting(containerEl)
			.setName(t("Ai api key", this.plugin.settings))
			.setDesc(t("Used for next step Ai breakdown", this.plugin.settings))
			.addText((text) => {
				text.inputEl.type = "password";
				text
					.setPlaceholder(t("Enter api key", this.plugin.settings))
					.setValue(this.plugin.settings.aiApiKey)
					.onChange(async (value) => {
						this.plugin.settings.aiApiKey = value.trim();
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName(t("Ai base url", this.plugin.settings))
			.setDesc(t("Compatible api endpoint address", this.plugin.settings))
			.addText((text) =>
				text
					.setPlaceholder(t("Enter base url", this.plugin.settings))
					.setValue(this.plugin.settings.aiBaseUrl)
					.onChange(async (value) => {
						this.plugin.settings.aiBaseUrl = value.trim() || DEFAULT_SETTINGS.aiBaseUrl;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName(t("Ai model", this.plugin.settings))
			.setDesc(t("Ai model name", this.plugin.settings))
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
			.setName(t("Ai prompt template", this.plugin.settings))
			.setDesc(t("Editable template", this.plugin.settings))
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
			.setName(t("Goals folder", this.plugin.settings))
			.setDesc(t("Default directory for goals", this.plugin.settings))
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
			.setName(t("Inspiration folder", this.plugin.settings))
			.setDesc(t("Directory for inspirations", this.plugin.settings))
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
