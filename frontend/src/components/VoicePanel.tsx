type Props = {
  listening: boolean
  speechSupported: boolean
  autoSpeak: boolean
  onStartListen: () => void
  onStopSpeak: () => void
  onToggleAutoSpeak: () => void
}

export default function VoicePanel({
  listening,
  speechSupported,
  autoSpeak,
  onStartListen,
  onStopSpeak,
  onToggleAutoSpeak,
}: Props) {
  return (
    <div className="voice-panel">
      <button onClick={onStartListen} disabled={!speechSupported || listening} type="button">
        {listening ? '正在聆听...' : speechSupported ? '语音提问' : '浏览器不支持语音识别'}
      </button>
      <button onClick={onStopSpeak} type="button">停止播报</button>
      <label>
        <input type="checkbox" checked={autoSpeak} onChange={onToggleAutoSpeak} /> 自动播报
      </label>
    </div>
  )
}
