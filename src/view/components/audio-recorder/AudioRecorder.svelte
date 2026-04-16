<script lang="ts">
	import * as Tooltip from '@/view/primitives/tooltip';
	import { Mic, Square } from 'lucide-svelte';

	interface Props {
		onRecorded: (audio: { blob: Blob; mimeType: string; durationMs: number }) => void;
		disabled?: boolean;
	}

	let { onRecorded: _onRecorded, disabled = false }: Props = $props();

	let recording = $state(false);
	let mediaRecorder: MediaRecorder | null = $state(null);
	let _startTime = $state(0);

	async function startRecording() {
		// TODO: re-enable microphone access once the audio pipeline is wired up end-to-end.
		// const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
		// const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
		// 	? 'audio/webm;codecs=opus'
		// 	: 'audio/webm';
		// const recorder = new MediaRecorder(stream, { mimeType: mime });
		// const chunks: Blob[] = [];
		//
		// recorder.ondataavailable = (e) => {
		// 	if (e.data.size > 0) chunks.push(e.data);
		// };
		//
		// recorder.onstop = () => {
		// 	stream.getTracks().forEach((t) => t.stop());
		// 	const blob = new Blob(chunks, { type: mime });
		// 	const durationMs = Date.now() - startTime;
		// 	onRecorded({ blob, mimeType: mime, durationMs });
		// };
		//
		// mediaRecorder = recorder;
		// startTime = Date.now();
		// recorder.start();
		// recording = true;
	}

	function stopRecording() {
		mediaRecorder?.stop();
		mediaRecorder = null;
		recording = false;
	}

	function toggle() {
		if (recording) {
			stopRecording();
		} else {
			startRecording();
		}
	}
</script>

<Tooltip.Root>
	<Tooltip.Trigger>
		{#snippet child({ props })}
			<button
				{...props}
				class="audio-recorder-btn"
				class:audio-recorder-btn-active={recording}
				type="button"
				onclick={toggle}
				{disabled}
				aria-label={recording ? 'Stop recording' : 'Record audio'}
			>
				{#if recording}
					<Square size={14} fill="currentColor" />
				{:else}
					<Mic size={20} />
				{/if}
			</button>
		{/snippet}
	</Tooltip.Trigger>
	<Tooltip.Content side="top">{recording ? 'Stop recording' : 'Record audio'}</Tooltip.Content>
</Tooltip.Root>

<style>
	.audio-recorder-btn {
		display: flex;
		height: 2.25rem;
		width: 2.25rem;
		flex-shrink: 0;
		cursor: pointer;
		align-items: center;
		justify-content: center;
		border-radius: var(--radius-control);
		border: 1px solid var(--control-surface-border);
		background: var(--control-surface-bg);
		color: var(--control-surface-muted);
	}

	.audio-recorder-btn:hover {
		background: var(--control-surface-bg-hover);
		color: var(--control-surface-foreground);
	}

	.audio-recorder-btn:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.audio-recorder-btn-active {
		border-color: hsl(0 72% 51%);
		color: hsl(0 72% 51%);
		animation: pulse-recording 1.5s ease-in-out infinite;
	}

	.audio-recorder-btn-active:hover {
		color: hsl(0 72% 41%);
	}

	@keyframes pulse-recording {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.6;
		}
	}
</style>
