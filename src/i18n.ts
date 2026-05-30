import { PWorkbenchSettings } from "./types";

export type Language = "en" | "zh";

const en = {
	// Sidebar & Ribbon
	"Open workbench": "Open workbench",
	"Pick one for today": "Pick one for today",

	// Commands
	"Bujuan: Open workbench": "Bujuan: Open workbench",
	"Bujuan: Pick one for today": "Bujuan: Pick one for today",
	"Bujuan: Create new goal": "Bujuan: Create new goal",
	"Bujuan: Reselect today's goals": "Bujuan: Reselect today's goals",

	// Dashboard
	"Today": "Today",
	"Breathe": "Breathe",
	"Daily streak": "Daily streak",
	"Check-in successful": "Check-in successful! Continuous streak: {{days}} days",
	"Enter goal name": "Enter goal name...",
	"Add goal": "Add goal",
	"Add goal: enter name to match/create": "Add goal: enter name to match/create...",
	"Checked in for": "Checked in for",
	"days": "days",
	"Focus on {{count}} more things": "Focus on {{count}} more things",
	"No matching goals": "No matching goals found.",
	"Goal name empty": "Goal name cannot be empty.",
	"Goal not active": "This goal is completed or archived and cannot be added to today directly.",
	"Goal dormant": "This goal is currently dormant. Please manually set its status to active before adding.",
	"Failed to add goal": "Failed to add goal.",

	// GoalCard
	"Last progress": "Last progress",
	"Current": "Current",
	"Choose or type the current step": "Choose or type the current step",
	"Step {{index}}": "Step {{index}}",
	"Confirm this step": "Confirm this step",
	"Select": "Select",
	"Ai suggestions": "Ai suggestions",
	"Next step": "Next step",
	"Record": "Record",
	"Previous": "Previous",
	"Collapse": "Collapse",
	"See all": "See all",
	"Sleep": "Sleep",
	"Sleeping...": "Sleeping...",
	"Archive": "Archive",
	"Finish": "Finish",
	"No history": "No progress history yet.",
	"Input unconfirmed": "Input unconfirmed",
	"Today_LastDone": "Today",
	"{{days}}d ago": "{{days}}d ago",

	// Modals
	"Create new goal": "Create new goal",
	"Goal name": "Goal name",
	"Create": "Create",
	"Reselect today's goals": "Reselect today's goals",
	"Select up to {{max}} goals": "Select up to {{max}} goals.",
	"Search goal name": "Search goal name...",
	"Apply selection": "Apply selection",
	"No available goals": "No available goals",
	"How about this one today?": "🎲 How about this one today?",
	"Pick this one": "Pick this one",
	"Reroll": "Reroll",
	"Goal limit reached": "You have enough goals for today. Please reselect or increase the limit (limit: {{max}}).",
	"Updated today's goals": "Updated today's goals: {{count}}",

	// Settings
	"General": "General",
	"Language": "Language",
	"Select your language": "Select your language.",
	"Max active goals": "Max active goals",
	"Number of active goals to display": "Number of active goals to display on the workbench (1-5).",
	"Default task": "Default task",
	"Name of the buffer task": "Name of the buffer task at the bottom. Defaults to \"Breathe\".",
	"Dormant days": "Dormant days",
	"Number of days before dormant returns": "Number of days before a sleeping goal returns to active.",
	"Ai api key": "Ai api key",
	"Ai suggest": "Ai suggest",
	"Used for next step Ai breakdown": "Used for next step Ai breakdown requests",
	"Ai base url": "Ai base url",
	"Ai model": "Ai model",
	"Ai model name": "Ai model name",
	"Ai prompt template": "Ai prompt template",
	"Enter api key": "Enter api key",
	"Enter base url": "Enter base url",
	"Editable template": "Editable template. Supports: {{title}} {{overview}} {{done}} {{inspirations}} {{chosen}}",
	"Goals folder": "Goals folder",
	"Default directory for goals": "Default directory for creating goal files",
	"Inspiration folder": "Inspiration folder",
	"Directory for inspirations": "Directory for creating inspiration notes",
	"Compatible api endpoint address": "Compatible api endpoint address",

	// Dataview
	"Dataview not detected": "Dataview not detected. Please install and enable dataview first",
	"Failed to load workbench": "Failed to load workbench. Please check goal frontmatter",
	"Waiting for Ai...": "Waiting for Ai...",
	"Note not found: {{target}}": "Note not found: {{target}}",
	"Sleep failed": "Sleep failed, please try again",
};

const zh: typeof en = {
	// Sidebar & Ribbon
	"Open workbench": "打开工作台",
	"Pick one for today": "随便选一个",

	// Commands
	"Bujuan: Open workbench": "Bujuan: 打开工作台",
	"Bujuan: Pick one for today": "Bujuan: 随便选一个",
	"Bujuan: Create new goal": "Bujuan: 新建目标",
	"Bujuan: Reselect today's goals": "Bujuan: 重新选择今天目标",

	// Dashboard
	"Today": "今天",
	"Breathe": "呼吸一下",
	"Daily streak": "连续打卡",
	"Check-in successful": "今日打卡成功！已连续打卡 {{days}} 天",
	"Enter goal name": "输入目标名称...",
	"Add goal": "添加目标",
	"Add goal: enter name to match/create": "添加目标：输入名称自动匹配/新建...",
	"Checked in for": "已坚持打卡",
	"days": "天",
	"Focus on {{count}} more things": "今天还能专注 {{count}} 件事",
	"No matching goals": "未找到匹配目标。",
	"Goal name empty": "目标名称不能为空。",
	"Goal not active": "该目标已完成或已归档，不能直接添加到今天。请新建目标。",
	"Goal dormant": "该目标当前处于休眠中，请手动修改状态为 active 后再添加。",
	"Failed to add goal": "添加目标失败。",

	// GoalCard
	"Last progress": "上次进行",
	"Current": "当前",
	"Choose or type the current step": "选择或输入当前步骤",
	"Step {{index}}": "第{{index}}项",
	"Confirm this step": "确认此步骤",
	"Select": "选中",
	"Ai suggestions": "AI 建议",
	"Next step": "下一步",
	"Record": "记录",
	"Previous": "上一步",
	"Collapse": "收起",
	"See all": "查看全部",
	"Sleep": "休眠",
	"Sleeping...": "休眠中...",
	"Archive": "归档",
	"Finish": "完成",
	"No history": "暂无历史记录。",
	"Input unconfirmed": "输入框中有未确认文本",
	"Today_LastDone": "今天",
	"{{days}}d ago": "{{days}}天前",

	// Modals
	"Create new goal": "新建目标",
	"Goal name": "目标名称",
	"Create": "创建",
	"Reselect today's goals": "重新选择今天目标",
	"Select up to {{max}} goals": "最多选择 {{max}} 个目标。",
	"Search goal name": "搜索目标名称...",
	"Apply selection": "应用选择",
	"No available goals": "暂无可选目标",
	"How about this one today?": "🎲 今天试试这个吧：",
	"Pick this one": "就它了",
	"Reroll": "换一个",
	"Goal limit reached": "不要贪多噢，今日可选目标已满（上限 {{max}} 个）。",
	"Updated today's goals": "已更新今天目标：{{count}} 个",

	// Settings
	"General": "通用设置",
	"Language": "语言",
	"Select your language": "选择插件界面语言。",
	"Max active goals": "每日活跃目标上限",
	"Number of active goals to display": "控制工作台当天展示的活跃目标数量（1-5）。",
	"Default task": "默认缓冲任务",
	"Name of the buffer task": "工作台底部缓冲项的名字。留空时使用“呼吸一下”。",
	"Dormant days": "休眠天数",
	"Number of days before dormant returns": "点击“休眠”后，目标在该天数后自动恢复为活跃状态。",
	"Ai api key": "Ai api 密钥",
	"Ai suggest": "Ai 建议",
	"Used for next step Ai breakdown": "用于下一步 Ai 拆解建议",
	"Ai base url": "Ai 接口地址",
	"Ai model": "Ai 模型",
	"Ai model name": "Ai 模型名称",
	"Ai prompt template": "Ai 提示词模板",
	"Enter api key": "输入 API 密钥",
	"Enter base url": "输入接口地址",
	"Editable template": "可编辑模板。支持变量：{{title}} {{overview}} {{done}} {{inspirations}} {{chosen}}",
	"Goals folder": "目标文件夹",
	"Default directory for goals": "存储目标笔记的目录。",
	"Inspiration folder": "灵感笔记文件夹",
	"Directory for inspirations": "灵感笔记的存放目录。",
	"Compatible api endpoint address": "兼容的 API 端点地址",

	// Dataview
	"Dataview not detected": "未检测到 Dataview，请先安装并启用 dataview 插件",
	"Failed to load workbench": "加载工作台失败，请检查目标文件的 Frontmatter",
	"Waiting for Ai...": "等待 Ai 生成...",
	"Note not found: {{target}}": "未找到笔记：{{target}}",
	"Sleep failed": "休眠失败，请重试",
};

const translations: Record<Language, typeof en> = { en, zh };

export function t(key: keyof typeof en, settings?: PWorkbenchSettings): string {
	const lang = settings?.language || "en";
	const dict = translations[lang] || en;
	return dict[key] || en[key] || key;
}

export function tp(key: keyof typeof en, settings: PWorkbenchSettings | undefined, params: Record<string, string | number>): string {
	let text = t(key, settings);
	for (const [k, v] of Object.entries(params)) {
		text = text.replace(`{{${k}}}`, String(v));
	}
	return text;
}
