interface StepInputProps {
	value: string;
	checked: boolean;
	onChange: (value: string) => void;
	onChoose: () => void;
}

export function StepInput(props: StepInputProps) {
	return (
		<div className={`pwb-step-card ${props.checked ? "is-selected" : ""}`} onClick={() => props.onChoose()}>
			<div className="pwb-step-card-text">{props.value || "等待AI生成..."}</div>
		</div>
	);
}

