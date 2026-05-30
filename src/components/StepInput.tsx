import { t } from "../i18n";
import { PWorkbenchSettings } from "../types";

interface StepInputProps {
	settings: PWorkbenchSettings;
	value: string;
	checked: boolean;
	onChange: (value: string) => void;
	onChoose: () => void;
}

export function StepInput(props: StepInputProps) {
	return (
		<div className={`pwb-step-card ${props.checked ? "is-selected" : ""}`} onClick={() => props.onChoose()}>
			<div className="pwb-step-card-text">{props.value || t("Waiting for Ai...", props.settings)}</div>
		</div>
	);
}

