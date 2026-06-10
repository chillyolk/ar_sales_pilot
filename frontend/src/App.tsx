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
  { brand: 'Tesla', model: 'Model 3', label: 'Tesla Model 3' },
  { brand: 'Tesla', model: 'Model Y', label: 'Tesla Model Y' },
  { brand: '小米汽车', model: 'SU7', label: '小米 SU7' },
  { brand: '演示品牌', model: '演示车型', label: '通用演示车型' },
]

const CONFIDENCE_PARTS = [
  { id: 'windshield', name: '前挡风玻璃' },
  { id: 'hood', name: '引擎盖' },
  { id: 'wheel', name: '轮毂' },
  { id: 'side_window', name: '侧窗' },
  { id: 'headlight', name: '前大灯' },
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

function pickChineseVoice() {
  const voices = window.speechSynthesis.getVoices()
  return voices.find((voice) => /zh-CN|Chinese|Xiaoxiao|Tingting|Mei-Jia|Sinji/i.test(`${voice.lang} ${voice.name}`))
    ?? voices.find((voice) => voice.lang.startsWith('zh'))
}

function speak(text: string) {
  if (!('speechSynthesis' in window)) {
    return
  }
  window.speechSynthesis.cancel()
  const segments = text.split(/(?<=[。！？；])/).map((segment) => segment.trim()).filter(Boolean)
  const voice = pickChineseVoice()
  segments.forEach((segment) => {
    const utterance = new SpeechSynthesisUtterance(segment)
    utterance.lang = 'zh-CN'
    utterance.rate = 0.92
    utterance.pitch = 1.03
    utterance.volume = 1
    if (voice) {
      utterance.voice = voice
    }
    window.speechSynthesis.speak(utterance)
  })
}

function getRecognition(): RecognitionConstructor | undefined {
  const scope = window as typeof window & {
    SpeechRecognition?: RecognitionConstructor
    webkitSpeechRecognition?: RecognitionConstructor
  }
  return scope.SpeechRecognition || scope.webkitSpeechRecognition
}

function basePartId(partId: string) {
  return partId.replace(/_\d+$/, '')
}

function guideIntro(part: PartDetection) {
  const intros: Record<string, string> = {
    windshield: '先看前挡风玻璃，这里影响的是前方视野和座舱通透感。',
    hood: '这里是前舱区域，Model 3 的电动车布局让储物和车头结构更灵活。',
    wheel: '这里是轮毂，通常客户会关注它对能耗、外观和操控感的影响。',
    side_window: '这里是侧窗区域，影响侧向视野和后排通透感。',
    headlight: '这里是前大灯，重点是夜间识别度和前脸科技感。',
  }
  return intros[basePartId(part.part_id)] ?? `现在看到的是${part.name}。`
}

function partSpeechText(vehicle: VehicleDetection, part: PartDetection) {
  return `${guideIntro(part)}现在看到的是 ${vehicle.brand} ${vehicle.model} 的${part.name}。这个部位的重点是：${part.physical_info.description} 如果你更关注日常体验和用车价值，这一点会比较实用。`
}

export default function App() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const inFlightRef = useRef(false)
  const frameIdRef = useRef(0)
  const lastDetectionRef = useRef<DetectResponse | null>(null)
  const objectUrlRef = useRef<string | null>(null)
  const [videoSrc, setVideoSrc] = useState(DEFAULT_VIDEO)
  const [videoName, setVideoName] = useState('默认演示视频')
  const [videoAspectRatio, setVideoAspectRatio] = useState(16 / 9)
  const [isPlaying, setIsPlaying] = useState(false)
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
      speak(partSpeechText(vehicle, part))
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
    setIsPlaying(false)
    setVideoAspectRatio(16 / 9)
    resetDetectionState()
  }, [resetDetectionState])

  const restoreDefaultVideo = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
    setVideoSrc(DEFAULT_VIDEO)
    setVideoName('默认演示视频')
    setVideoAspectRatio(16 / 9)
    setIsPlaying(false)
    resetDetectionState()
  }, [resetDetectionState])

  const handleLoadedMetadata = useCallback(() => {
    const video = videoRef.current
    if (video?.videoWidth && video.videoHeight) {
      setVideoAspectRatio(video.videoWidth / video.videoHeight)
    }
  }, [])

  const handleTogglePlayback = useCallback(async () => {
    const video = videoRef.current
    if (!video) {
      return
    }
    if (video.paused) {
      await video.play()
    } else {
      video.pause()
    }
  }, [])

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

  const currentVehicle = detection?.vehicles[0]
  const confidenceRows = CONFIDENCE_PARTS.map((part) => {
    const matches = currentVehicle?.parts.filter((item) => basePartId(item.part_id) === part.id) ?? []
    const best = matches.reduce<PartDetection | undefined>((current, item) => (
      !current || item.confidence > current.confidence ? item : current
    ), undefined)
    return { ...part, confidence: best?.confidence, source: best?.method }
  })
  const recognitionSource = confidenceRows.find((row) => row.source)?.source ?? '等待识别'

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
          <div className="video-viewport" style={{ aspectRatio: videoAspectRatio }}>
            <VideoPlayer
              ref={videoRef}
              src={videoSrc}
              onClick={handleTogglePlayback}
              onLoadedMetadata={handleLoadedMetadata}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onEnded={() => setIsPlaying(false)}
            />
            <AROverlay detection={detection} selectedPart={selectedPart} onSelectPart={handleSelectPart} />
            <button className="video-toggle" onClick={handleTogglePlayback} type="button">
              {isPlaying ? '暂停' : '播放'}
            </button>
          </div>
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

          <div className="panel-card confidence-panel">
            <h2>置信度</h2>
            <p>当前识别车型：{currentVehicle ? `${currentVehicle.brand} ${currentVehicle.model}` : `${vehicleProfile.brand} ${vehicleProfile.model}`}</p>
            <p>部位识别来源：{recognitionSource}</p>
            <div className="confidence-list">
              {confidenceRows.map((row) => (
                <div className="confidence-row" key={row.id}>
                  <span>{row.name}</span>
                  <strong>{row.confidence === undefined ? '未识别' : `${Math.round(row.confidence * 100)}%`}</strong>
                </div>
              ))}
            </div>
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
