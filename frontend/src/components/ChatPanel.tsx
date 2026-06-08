import type { ChatMessage } from '../types'

type Props = {
  messages: ChatMessage[]
  question: string
  loading: boolean
  onQuestionChange: (value: string) => void
  onSubmit: () => void
}

export default function ChatPanel({ messages, question, loading, onQuestionChange, onSubmit }: Props) {
  return (
    <div className="chat-panel">
      <div className="messages">
        {messages.map((message, index) => (
          <div className={`message ${message.role}`} key={index}>
            {message.content}
          </div>
        ))}
      </div>
      <div className="chat-input-row">
        <input
          value={question}
          onChange={(event) => onQuestionChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              onSubmit()
            }
          }}
          placeholder="问：这个车型有什么优惠么？"
        />
        <button onClick={onSubmit} disabled={loading || !question.trim()} type="button">
          {loading ? '生成中' : '发送'}
        </button>
      </div>
    </div>
  )
}
