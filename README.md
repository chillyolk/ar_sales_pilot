# AR 眼镜 + AI 汽车导购 Demo

这是一个实时视频帧识别驱动的 Web AR 模拟器，用于验证“识别视频中的车辆位置，并在对应实体区域叠加汽车信息”的 demo 能力。

## 核心能力

- 播放默认汽车视频或选择本地汽车视频。
- 前端从视频中实时抽帧，发送到后端。
- 后端使用 YOLOv8 COCO 预训练模型检测车辆位置。
- 后端基于车辆 bbox 用几何规则估算车身、车窗、轮毂、车灯、车头。
- 前端根据实时检测结果绘制 AR HUD 浮层。
- 支持点击部位后语音播报。
- 支持语音输入和文本输入。
- 支持本地优惠库查询。
- 支持 LLM 问答；没有 API Key 时自动使用本地规则兜底。

## 启动后端

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
DISABLE_YOLO=1 uvicorn main:app --reload --host 0.0.0.0 --port 8010
```

如需接入 LLM：

```bash
cp .env.example .env
# 填写 LLM_API_KEY / LLM_BASE_URL / LLM_MODEL
```

## 启动前端

```bash
cd frontend
npm install
npm run dev
```

访问：`http://localhost:5173`

## 关键验证点

- 拖动视频进度后，车辆框根据当前画面重新检测。
- 选择另一段汽车视频后，仍能检测车辆并叠加信息。
- 页面右上角会显示 `Detection`、`Frame ID`、`Latency`、`Vehicles`、`Mode: realtime frame detection`。
- 代码不使用视频时间轴预设 AR 内容；`video.currentTime` 只作为检测请求的调试字段。

## 注意事项

- 本地演示视频文件较大，默认不会提交到 Git；如需默认视频，请将视频放到 `frontend/public/videos/demo-car.mp4`。
- 首次运行 YOLOv8 可能会下载 `yolov8n.pt` 权重。
- 如果无法下载或导入 YOLO，可设置 `DISABLE_YOLO=1` 使用后端轮廓 fallback，但效果仅用于链路调试。
- 语音识别建议使用 Chrome 浏览器。
- 车辆部位是 MVP 几何估算，返回中标记为 `method: geometry`，不是训练后的高精度部位识别模型。
