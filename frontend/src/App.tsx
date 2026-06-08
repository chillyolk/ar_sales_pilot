import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { detectFrame } from './api/cvClient'
import { askGuide } from './api/chatClient'
import { captureVideoFrame } from './ar/frameCapture'
import { smoothDetection } from './ar/smoothing'
import AROverlay from './components/AROverlay'
import ChatPanel from './components/ChatPanel'
import OfferPanel from './components/OfferPanel'
import VideoPlayer from './components/VideoPlayer'
import VoicePanel from './components/VoicePanel'
import type { ChatMessage, DetectResponse, Offer, PartDetection, VehicleDetection, VehicleProfile } from './types'

const DEFAULT_VIDEO = '/videos/demo-car.mp4'

const VEHICLE_PROFILES: VehicleProfile[] = [
  { brand: 'Tesla', model: 'Model Y', label: 'Tesla Model Y' },
  { brand: '小米汽车', model: 'SU7', label: '小米 SU7' },
  { brand: '演示品牌', model: '演示车型', label: '通用演示车型' },
]

type RecognitionConstructor = new () => SpeechRecognition

type SpeechRecognition = {
  lang: string
  interimResults: boolean
  continuous: boolean
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
  start: () => void
}

type SpeechRecognitionEvent = {
  results: ArrayLike<ArrayLike<{ transcript: string }>>
}

function speak(text: string) {
  if (!('speechSynthesis' in window)) {
    return
  }
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'zh-CN'
  utterance.rate = 1
  window.speechSynthesis.speak(utterance)
}

function getRecognition(): RecognitionConstructor | undefined {
  const scope = window as typeof window & {
    SpeechRecognition?: RecognitionConstructor
    webkitSpeechRecognition?: RecognitionConstructor
  }
  return scope.SpeechRecognition || scope.webkitSpeechRecognition
}

export default function App() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const inFlightRef = useRef(false)
  const frameIdRef = useRef(0)
  const lastDetectionRef = useRef<DetectResponse | null>(null)
  const objectUrlRef = useRef<string | null>(null)
  const [videoSrc, setVideoSrc] = useState(DEFAULT_VIDEO)
  const [videoName, setVideoName] = useState('默认演示视频')
  const [vehicleProfile, setVehicleProfile] = useState<VehicleProfile>(VEHICLE_PROFILES[0])
  const [detection, setDetection] = useState<DetectResponse | null>(null)
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleDetection | undefined>()
  const [selectedPart, setSelectedPart] = useState<PartDetection | undefined>()
  const [question, setQuestion] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [offers, setOffers] = useState<Offer[]>([])
  const [loading, setLoading] = useState(false)
  const [listening, setListening] = useState(false)
  const [autoSpeak, setAutoSpeak] = useState(true)
  const recognitionCtor = useMemo(() => getRecognition(), [])

  const resetDetectionState = useCallback(() => {
    frameIdRef.current = 0
    lastDetectionRef.current = null
    setDetection(null)
    setSelectedVehicle(undefined)
    setSelectedPart(undefined)
  }, [])

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
      }
    }
  }, [])

  useEffect(() => {
    const timer = window.setInterval(async () => {
      const video = videoRef.current
      if (!video || video.paused || video.ended || inFlightRef.current) {
        return
      }
      const blob = await captureVideoFrame(video)
      if (!blob) {
        return
      }
      inFlightRef.current = true
      const frameId = ++frameIdRef.current
      try {
        const result = await detectFrame({
          frame: blob,
          frameId,
          videoTime: video.currentTime,
          width: video.videoWidth,
          height: video.videoHeight,
          brand: vehicleProfile.brand,
          model: vehicleProfile.model,
        })
        const smoothed = smoothDetection(lastDetectionRef.current, result)
        lastDetectionRef.current = smoothed
        setDetection(smoothed)
        if (!selectedVehicle && smoothed.vehicles[0]) {
          setSelectedVehicle(smoothed.vehicles[0])
          setSelectedPart(smoothed.vehicles[0].parts[0])
        }
      } catch (error) {
        console.warn(error)
      } finally {
        inFlightRef.current = false
      }
    }, 250)
    return () => window.clearInterval(timer)
  }, [selectedVehicle, vehicleProfile])

  const handleSelectPart = useCallback((vehicle: VehicleDetection, part: PartDetection) => {
    setSelectedVehicle(vehicle)
    setSelectedPart(part)
    if (autoSpeak) {
      speak(`当前画面聚焦到${vehicle.brand}${vehicle.model}的${part.name}区域。${part.physical_info.description}`)
    }
  }, [autoSpeak])

  const handleVideoFile = useCallback((file: File) => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
    }
    const url = URL.createObjectURL(file)
    objectUrlRef.current = url
    setVideoSrc(url)
    setVideoName(file.name)
    resetDetectionState()
  }, [resetDetectionState])

  const restoreDefaultVideo = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
    setVideoSrc(DEFAULT_VIDEO)
    setVideoName('默认演示视频')
    resetDetectionState()
  }, [resetDetectionState])

  const submitQuestion = useCallback(async (text = question) => {
    const content = text.trim()
    if (!content || loading) {
      return
    }
    setLoading(true)
    setMessages((items) => [...items, { role: 'user', content }])
    setQuestion('')
    try {
      const response = await askGuide({
        question: content,
        vehicle: selectedVehicle,
        part: selectedPart,
        city: '北京',
      })
      setOffers(response.related_offers)
      setMessages((items) => [...items, { role: 'assistant', content: response.answer }])
      if (autoSpeak) {
        speak(response.answer)
      }
    } catch (error) {
      const message = '问答服务暂时不可用，请确认后端服务已启动。'
      setMessages((items) => [...items, { role: 'assistant', content: message }])
      speak(message)
    } finally {
      setLoading(false)
    }
  }, [autoSpeak, loading, question, selectedPart, selectedVehicle])

  const startListen = useCallback(() => {
    if (!recognitionCtor) {
      return
    }
    const recognition = new recognitionCtor()
    recognition.lang = 'zh-CN'
    recognition.interimResults = false
    recognition.continuous = false
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript ?? ''
      setQuestion(transcript)
      void submitQuestion(transcript)
    }
    recognition.onend = () => setListening(false)
    recognition.onerror = () => setListening(false)
    setListening(true)
    recognition.start()
  }, [recognitionCtor, submitQuestion])

  return (
    <main className="app">
      <header className="hero">
        <div>
          <p className="eyebrow">Realtime Frame Detection · Web AR Mock</p>
          <h1>AR 眼镜 + AI 汽车导购 Demo</h1>
          <p>基于当前视频帧实时识别车辆位置，叠加车身部位信息，并支持语音问答和本地优惠查询。</p>
        </div>
      </header>

      <section className="workspace">
        <div className="ar-stage">
          <VideoPlayer ref={videoRef} src={videoSrc} />
          <AROverlay detection={detection} selectedPart={selectedPart} onSelectPart={handleSelectPart} />
        </div>

        <aside className="side-panel">
          <div className="panel-card">
            <h2>视频源</h2>
            <p>当前：{videoName}</p>
            <label className="side-file-picker">
              选择本地汽车视频
              <input
                type="file"
                accept="video/*"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) {
                    handleVideoFile(file)
                  }
                }}
              />
            </label>
            <button onClick={restoreDefaultVideo} type="button">恢复默认视频</button>
          </div>

          <div className="panel-card">
            <h2>车型选择</h2>
            <select
              className="vehicle-select"
              value={`${vehicleProfile.brand}|${vehicleProfile.model}`}
              onChange={(event) => {
                const [brand, model] = event.target.value.split('|')
                const next = VEHICLE_PROFILES.find((item) => item.brand === brand && item.model === model)
                if (next) {
                  setVehicleProfile(next)
                  resetDetectionState()
                }
              }}
            >
              {VEHICLE_PROFILES.map((profile) => (
                <option key={`${profile.brand}-${profile.model}`} value={`${profile.brand}|${profile.model}`}>
                  {profile.label}
                </option>
              ))}
            </select>
            <p className="hint">当前阶段为手动车型选择，不代表已接入视觉车型识别模型。</p>
          </div>

          <div className="panel-card">
            <h2>当前聚焦</h2>
            <p>品牌：{selectedVehicle?.brand ?? vehicleProfile.brand}</p>
            <p>车型：{selectedVehicle?.model ?? vehicleProfile.model}</p>
            <p>部位：{selectedPart?.name ?? '等待选择'}</p>
            <p>说明：{selectedPart?.physical_info.description ?? '播放视频后系统会实时检测车辆。'}</p>
          </div>
          <div className="panel-card">
            <h2>语音控制</h2>
            <VoicePanel
              listening={listening}
              speechSupported={Boolean(recognitionCtor)}
              autoSpeak={autoSpeak}
              onStartListen={startListen}
              onStopSpeak={() => window.speechSynthesis?.cancel()}
              onToggleAutoSpeak={() => setAutoSpeak((value) => !value)}
            />
          </div>
          <div className="panel-card">
            <h2>AI 导购问答</h2>
            <ChatPanel
              messages={messages}
              question={question}
              loading={loading}
              onQuestionChange={setQuestion}
              onSubmit={() => void submitQuestion()}
            />
          </div>
          <div className="panel-card">
            <h2>本地门店优惠</h2>
            <OfferPanel offers={offers} />
          </div>
        </aside>
      </section>
    </main>
  )
}
