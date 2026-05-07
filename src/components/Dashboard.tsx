import { h } from "preact";
import { useEffect, useMemo, useState } from "preact/hooks";
import { Notice } from "obsidian";
import type PWorkbenchPlugin from "../main";
import type { GoalRecord } from "../types";
import { GoalCard } from "./GoalCard";
import {
	addGoalToToday,
	archiveGoal,
	applyNextStepResult,
	buildAiContextWithInspiration,
	collectGoalNameCandidates,
	createOrOpenInspiration,
	finishGoal,
	sleepGoal,
	updateChosenStepText,
	getCurrentChosen,
} from "../services/goals";
import { requestNextStepOptions } from "../services/ai";

interface DashboardProps {
	plugin: PWorkbenchPlugin;
	goals: GoalRecord[];
	onRefresh: () => Promise<void>;
}

export function Dashboard(props: DashboardProps) {
	const [goalName, setGoalName] = useState("");
	const [busy, setBusy] = useState(false);
	const [aiOptionsByGoal, setAiOptionsByGoal] = useState<Record<string, string[]>>({});
	const [sleepingPaths, setSleepingPaths] = useState<Set<string>>(new Set());
	const suggestions = useMemo(() => collectGoalNameCandidates(props.plugin, goalName), [props.plugin, goalName, props.goals]);
	const effectiveGoals = useMemo(
		() => props.goals.filter((goal) => !sleepingPaths.has(goal.file.path)),
		[props.goals, sleepingPaths]
	);
	const visibleGoals = effectiveGoals.slice(0, props.plugin.settings.maxActiveGoals);
	const left = Math.max(0, props.plugin.settings.maxActiveGoals - visibleGoals.length);
	const today = new Date().toLocaleDateString();

	useEffect(() => {
		// 当外部 goals 刷新后，清理已不在列表中的临时休眠路径
		setSleepingPaths((prev) => {
			if (prev.size === 0) {
				return prev;
			}
			const next = new Set<string>();
			const activePaths = new Set(props.goals.map((g) => g.file.path));
			for (const path of prev) {
				if (activePaths.has(path)) {
					next.add(path);
				}
			}
			return next;
		});
	}, [props.goals]);

	const createGoal = async () => {
		if (!goalName.trim()) {
			new Notice("请输入目标名称。");
			return;
		}
		setBusy(true);
		try {
			const file = await addGoalToToday(props.plugin, goalName);
			const prev = props.plugin.settings.todayGoalPaths ?? [];
			const dedup = [file.path, ...prev.filter((p) => p !== file.path)];
			props.plugin.settings.todayGoalPaths = dedup.slice(0, props.plugin.settings.maxActiveGoals);
			await props.plugin.saveSettings();
			setGoalName("");
			await props.onRefresh();
		} catch (error) {
			const code = (error as Error).message;
			if (code === "goal-not-active") {
				new Notice("该目标已完成或已归档，不能直接添加到今天。请新建目标。");
			} else if (code === "goal-dormant") {
				new Notice("该目标当前处于休眠中，请手动修改状态为 active 后再添加。");
			} else {
				new Notice("添加目标失败。");
			}
		} finally {
			setBusy(false);
		}
	};

	return (
		<div className="pwb-dashboard">
			<header className="pwb-top">
				<div className="pwb-date">{today}</div>
				<div className="pwb-focus-count">今天还能专注 {left} 件事</div>
			</header>

			<div className="pwb-add-row">
				<input
					list="pwb-goal-suggest"
					value={goalName}
					onInput={(evt) => setGoalName((evt.currentTarget as HTMLInputElement).value)}
					placeholder="添加目标：输入名称自动匹配/新建"
				/>
				<datalist id="pwb-goal-suggest">
					{suggestions.map((name) => (
						<option key={name} value={name} />
					))}
				</datalist>
				<button disabled={busy || left <= 0} onClick={() => void createGoal()}>
					添加目标
				</button>
			</div>

			<div className="pwb-card-list">
				{visibleGoals.map((goal) => (
					<GoalCard
						key={goal.file.path}
						goal={goal}
						readyOptions={aiOptionsByGoal[goal.file.path]}
						onReadyTextChange={async (item, index, text) => {
							setAiOptionsByGoal((prev) => {
								const current = [...(prev[item.file.path] ?? ["", "", ""])];
								current[index] = text;
								return { ...prev, [item.file.path]: current.slice(0, 3) };
							});
						}}
						onChosenTextChange={async (item, text) => {
							await updateChosenStepText(props.plugin, item, text);
							setAiOptionsByGoal((prev) => ({ ...prev, [item.file.path]: [] }));
							// 立即触发刷新并再补一次微延时刷新，确保 metadataCache 完成同步
							await props.onRefresh();
							await new Promise((resolve) => window.setTimeout(resolve, 80));
							await props.onRefresh();
						}}
						onGenerateAi={async (item, currentText) => {
							setBusy(true);
							try {
								const context = await buildAiContextWithInspiration(props.plugin, item);
								if (currentText.trim()) {
									context.chosen = currentText.trim();
								}
								let options: string[] = [];
								try {
									options = await requestNextStepOptions(props.plugin, context);
								} catch (error) {
									const code = (error as Error).message;
									if (code === "missing-ai-config") {
										new Notice("AI 未配置，请先填写 API 配置。");
									} else if (code.startsWith("ai-http-error:")) {
										new Notice(`AI 接口错误：${code.replace("ai-http-error:", "")}`);
									} else if (code === "ai-format-error") {
										new Notice("AI 返回格式不符合要求。");
									} else {
										new Notice("AI 生成失败。");
									}
								}
								setAiOptionsByGoal((prev) => ({ ...prev, [item.file.path]: options.slice(0, 3) }));
							} finally {
								setBusy(false);
							}
						}}
						onNextStep={async (item, currentText, confirmedInUi) => {
							setBusy(true);
							try {
								const currentChosen = getCurrentChosen(item);
								if (currentText.trim() && !confirmedInUi && (!currentChosen || currentText.trim() !== currentChosen.description)) {
									new Notice("输入框中有未选中的文本");
									return false;
								}
								if (!currentChosen) {
									if (currentText.trim() && confirmedInUi) {
										await updateChosenStepText(props.plugin, item, currentText.trim());
									} else {
									new Notice("请先点击“选中”确认当前任务，再执行下一步。");
									return false;
									}
								}
								const completed = await applyNextStepResult(props.plugin, item);
								await props.onRefresh();
								await new Promise((resolve) => window.setTimeout(resolve, 80));
								await props.onRefresh();
								if (!completed) {
									setAiOptionsByGoal((prev) => ({ ...prev, [item.file.path]: [] }));
									return false;
								}
								setAiOptionsByGoal((prev) => ({ ...prev, [item.file.path]: [] }));
								return true;
							} finally {
								setBusy(false);
							}
						}}
						onRecord={async (item) => {
							await createOrOpenInspiration(props.plugin, item);
							await props.onRefresh();
						}}
						onOpenHistoryNote={async (item, linkText) => {
							const target = linkText.trim();
							if (!target) {
								return;
							}
							const file = props.plugin.app.metadataCache.getFirstLinkpathDest(target, item.file.path);
							if (!file) {
								new Notice(`未找到笔记：${target}`);
								return;
							}
							await props.plugin.app.workspace.getLeaf(true).openFile(file);
						}}
						onSleep={async (item) => {
							setSleepingPaths((prev) => {
								const next = new Set(prev);
								next.add(item.file.path);
								return next;
							});
							try {
								await sleepGoal(props.plugin, item);
								await props.onRefresh();
								await new Promise((resolve) => window.setTimeout(resolve, 80));
								await props.onRefresh();
								return true;
							} catch (_error) {
								// 失败时回滚 UI
								setSleepingPaths((prev) => {
									const next = new Set(prev);
									next.delete(item.file.path);
									return next;
								});
								new Notice("休眠失败，请重试。");
								return false;
							}
						}}
						onArchive={async (item) => {
							await archiveGoal(props.plugin, item);
							await props.onRefresh();
						}}
						onFinish={async (item) => {
							await finishGoal(props.plugin, item);
							await props.onRefresh();
						}}
					/>
				))}
			</div>
		</div>
	);
}
