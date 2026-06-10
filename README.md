# AR 眼镜 + AI 汽车导购 Demo

这是一个用 Web 页面模拟 AR 眼镜视野的汽车销售导购 Demo。项目目标是验证：用户观看真实汽车视频时，系统能基于当前视频帧识别车辆和车辆部件，在实体附近叠加车辆信息，并支持语音播报、语音提问、车型优惠查询和 AI 导购问答。

当前最新版本已从早期的“整车框 + 几何规则估算部位”升级为“整车检测 + YOLOv8 segmentation 车辆部件分割”的架构。正式 AR 叠加只展示 segmentation / tracking 来源的部件，避免几何估算点偏移导致误导。

## 1. 核心能力

- 播放默认汽车视频或选择本地汽车视频。
- 前端从视频中实时抽帧，发送到后端。
- 后端使用 YOLOv8 检测主车辆。
- 后端可加载训练好的 YOLOv8n-seg 车辆部件分割模型。
- 支持识别并返回部件 polygon、bbox、anchor：
  - `windshield` 前挡风玻璃
  - `hood` 引擎盖
  - `wheel` 轮毂/车轮
  - `side_window` 侧窗
  - `headlight` 前大灯
- 前端只展示 `segmentation-*` 或 `tracking-*` 来源的部件。
- 前端可绘制部件半透明 polygon、实体圆点、指示线和信息卡片。
- 支持语音播报。
- 支持语音输入和文本问答。
- 支持本地门店优惠库查询。
- 支持 LLM 问答；没有 API Key 时使用本地规则兜底。
- 支持手动车型选择和 brand/model 上下文。

## 2. 技术架构

```text
浏览器视频播放
  -> 前端 canvas 抽帧
  -> POST /api/detect-frame
  -> 后端 YOLOv8 检测主车辆
  -> 后端 YOLOv8n-seg 分割车辆部件
  -> 返回 vehicle + parts + polygon + anchor
  -> 前端 AR Overlay 绘制 polygon、圆点、指示线、信息卡片
  -> 用户点击/语音提问
  -> POST /api/chat
  -> 本地知识库 / 优惠库 / LLM 生成导购回答
```

## 3. 项目结构

```text
ar_sale_pilot/
├── backend/
│   ├── main.py
│   ├── requirements.txt
│   ├── .env.example
│   ├── app/
│   │   ├── api/
│   │   │   ├── detect.py
│   │   │   ├── chat.py
│   │   │   └── offers.py
│   │   ├── cv/
│   │   │   ├── frame_utils.py
│   │   │   ├── vehicle_detector.py
│   │   │   ├── vehicle_tracker.py
│   │   │   ├── part_estimator.py
│   │   │   └── part_segmenter.py
│   │   ├── data/
│   │   │   ├── offers.json
│   │   │   └── vehicle_knowledge.json
│   │   ├── llm/
│   │   │   └── qa_service.py
│   │   └── schemas.py
│   ├── dataset_templates/
│   │   └── model3_parts/
│   │       ├── README.md
│   │       └── data.yaml.example
│   └── scripts/
│       ├── extract_model3_frames.py
│       ├── convert_annotations_to_yolo_seg.py
│       ├── train_part_seg.py
│       └── validate_part_seg.py
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   └── src/
│       ├── App.tsx
│       ├── api/
│       ├── ar/
│       ├── components/
│       ├── styles.css
│       └── types.ts
├── docs/
│   └── validation.md
├── STARTUP.md
├── package.json
└── README.md
```

## 4. 环境要求

### 后端

- Python 3.9+
- FastAPI
- OpenCV
- Ultralytics YOLOv8

依赖文件：

```text
backend/requirements.txt
```

主要依赖：

```text
fastapi==0.115.6
uvicorn[standard]==0.34.0
opencv-python==4.10.0.84
ultralytics==8.3.49
numpy==1.26.4
requests==2.32.3
python-dotenv==1.0.1
```

### 前端

- Node.js
- npm
- Vite
- React
- TypeScript

前端依赖文件：

```text
frontend/package.json
```

## 5. 本地启动

### 5.1 启动后端

打开一个终端：

```bash
cd /Users/bytedance/ar_sale_pilot/backend
source .venv/bin/activate
uvicorn main:app --reload --host 0.0.0.0 --port 8010
```

后端健康检查：

```bash
curl http://localhost:8010/api/health
```

正常返回：

```json
{"status":"ok"}
```

### 5.2 启动前端

打开另一个终端：

```bash
cd /Users/bytedance/ar_sale_pilot/frontend
npm run dev
```

浏览器访问：

```text
http://localhost:5173
```

建议使用 Chrome。

## 6. 视频文件说明

视频文件较大，不提交到 GitHub。

当前 `.gitignore` 已忽略：

```text
*.mp4
*.mov
*.avi
*.mkv
```

如果需要默认视频，请将视频放到：

```text
frontend/public/videos/demo-car.mp4
```

页面默认读取：

```text
/videos/demo-car.mp4
```

也可以在页面右侧“视频源”区域选择本地视频，例如：

```text
/Users/bytedance/ar_sale_pilot/Model3.mp4
```

## 7. YOLOv8n-seg 车辆部件分割流程

当前最新版本推荐使用 segmentation 模型作为 AR 实体圆点来源。旧的 `part_estimator.py` 只作为 fallback/debug，不作为正式展示主方案。

### 7.1 抽取 Model3 视频帧

```bash
cd /Users/bytedance/ar_sale_pilot/backend
source .venv/bin/activate
python scripts/extract_model3_frames.py \
  --video /Users/bytedance/ar_sale_pilot/Model3.mp4 \
  --max-frames 80
```

输出目录：

```text
backend/datasets/model3_parts/frames/
```

### 7.2 用 Label Studio / CVAT 标注

推荐类别：

```yaml
0: windshield
1: hood
2: wheel
3: side_window
4: headlight
```

标注要求：

- 使用 polygon 标注。
- 只标可见区域，不脑补遮挡区域。
- 多个轮子、大灯需要分别标注实例。
- 不确定的部件宁可不标，不要错标。

### 7.3 COCO 导出转 YOLO segmentation

如果从 Label Studio 导出 COCO zip，例如：

```text
/Users/bytedance/ar_sale_pilot/Model3_marks.zip
```

转换：

```bash
cd /Users/bytedance/ar_sale_pilot/backend
source .venv/bin/activate
python scripts/convert_annotations_to_yolo_seg.py \
  --coco-zip /Users/bytedance/ar_sale_pilot/Model3_marks.zip \
  --frames-dir /Users/bytedance/ar_sale_pilot/backend/datasets/model3_parts/frames \
  --out-dir /Users/bytedance/ar_sale_pilot/backend/datasets/model3_parts
```

转换后目录：

```text
backend/datasets/model3_parts/
  data.yaml
  images/train/
  images/val/
  labels/train/
  labels/val/
```

当前数据集示例验证结果：

```text
images/train 26
labels/train 26
images/val 7
labels/val 7
annotations 130
```

### 7.4 data.yaml 示例

```yaml
path: /Users/bytedance/ar_sale_pilot/backend/datasets/model3_parts
train: images/train
val: images/val

names:
  0: windshield
  1: hood
  2: wheel
  3: side_window
  4: headlight
```

注意：转换脚本会按类别名称重新映射，不直接沿用 COCO 的 category id。

### 7.5 训练 YOLOv8n-seg

```bash
cd /Users/bytedance/ar_sale_pilot/backend
source .venv/bin/activate
python scripts/train_part_seg.py \
  --data /Users/bytedance/ar_sale_pilot/backend/datasets/model3_parts/data.yaml \
  --epochs 100 \
  --imgsz 640 \
  --batch 4
```

训练输出通常在：

```text
backend/runs/part_seg/model3_parts_yolov8n_seg/weights/
```

将最佳权重复制到默认路径：

```bash
mkdir -p /Users/bytedance/ar_sale_pilot/backend/models/parts
cp /Users/bytedance/ar_sale_pilot/backend/runs/part_seg/model3_parts_yolov8n_seg/weights/best.pt \
   /Users/bytedance/ar_sale_pilot/backend/models/parts/model3_parts_yolov8n_seg.pt
```

默认后端会尝试加载：

```text
backend/models/parts/model3_parts_yolov8n_seg.pt
```

### 7.6 验证训练模型

```bash
cd /Users/bytedance/ar_sale_pilot/backend
source .venv/bin/activate
python scripts/validate_part_seg.py \
  --weights /Users/bytedance/ar_sale_pilot/backend/models/parts/model3_parts_yolov8n_seg.pt \
  --source /Users/bytedance/ar_sale_pilot/backend/datasets/model3_parts/images/val
```

输出目录：

```text
backend/outputs/part_seg_preview/predict/
```

打开查看：

```bash
open /Users/bytedance/ar_sale_pilot/backend/outputs/part_seg_preview/predict
```

## 8. 分割模型运行时配置

### 默认模型路径

```text
backend/models/parts/model3_parts_yolov8n_seg.pt
```

### 指定模型路径

```bash
PART_SEG_MODEL=/absolute/path/to/best.pt uvicorn main:app --reload --host 0.0.0.0 --port 8010
```

### 禁用分割模型

```bash
DISABLE_PART_SEG=1 uvicorn main:app --reload --host 0.0.0.0 --port 8010
```

### 启用旧规则 fallback

默认不启用旧规则。只有调试时才建议使用：

```bash
USE_LEGACY_PART_ESTIMATOR=1 uvicorn main:app --reload --host 0.0.0.0 --port 8010
```

## 9. API 说明

### 9.1 健康检查

```http
GET /api/health
```

响应：

```json
{"status":"ok"}
```

### 9.2 视频帧检测

```http
POST /api/detect-frame
Content-Type: multipart/form-data
```

字段：

```text
frame: image/jpeg
frame_id: number
video_time: number
width: number
height: number
brand: string
model: string
```

返回示例：

```json
{
  "frame_id": 1,
  "width": 1280,
  "height": 720,
  "latency_ms": 120,
  "detector": "YOLOv8n",
  "mode": "realtime frame detection",
  "vehicles": [
    {
      "track_id": 1,
      "class_name": "car",
      "confidence": 0.91,
      "bbox": [328, 84, 958, 554],
      "brand": "Tesla",
      "model": "Model 3",
      "parts": [
        {
          "part_id": "windshield",
          "name": "前挡风玻璃",
          "confidence": 0.97,
          "method": "segmentation-yolov8n-seg",
          "bbox": [375, 41, 879, 182],
          "anchor": [625, 113],
          "polygon": [[372, 44], [882, 44], [879, 176], [375, 182]],
          "physical_info": {
            "title": "前挡风玻璃",
            "description": "...",
            "selling_points": []
          }
        }
      ]
    }
  ]
}
```

### 9.3 AI 问答

```http
POST /api/chat
Content-Type: application/json
```

用于用户语音/文本提问，后端结合当前车型、当前部件、本地优惠和 LLM 生成回答。

## 10. 前端 AR 展示逻辑

前端只展示：

```text
method startsWith "segmentation"
method startsWith "tracking"
```

默认不展示：

```text
geometry
visual-dark-region
visual-circle
```

原因：旧规则/传统 CV 点位容易偏移，不适合作为正式 AR 叠加依据。

前端展示内容：

- 部件 polygon 半透明覆盖。
- 部件圆点 marker。
- 指示线 connector。
- 信息卡片 info card。
- 点击部件可播报部件说明。

## 11. LLM 配置

后端从环境变量读取：

```text
LLM_API_KEY
LLM_BASE_URL
LLM_MODEL
```

示例：

```bash
cd /Users/bytedance/ar_sale_pilot/backend
cp .env.example .env
```

编辑 `.env`：

```text
LLM_API_KEY=your_key
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o-mini
```

如果没有 LLM Key，系统会使用本地规则兜底回答。

## 12. 本地数据

### 12.1 本地车型/部件知识

```text
backend/app/data/vehicle_knowledge.json
```

用于部件说明、卖点描述。

### 12.2 门店优惠数据

```text
backend/app/data/offers.json
```

用于回答：

```text
这个车型有什么优惠么？
```

## 13. 验证命令

### 前端构建

```bash
npm --prefix /Users/bytedance/ar_sale_pilot/frontend run build
```

### 后端语法

```bash
python3 -m compileall /Users/bytedance/ar_sale_pilot/backend/app /Users/bytedance/ar_sale_pilot/backend/scripts
```

### 脚本帮助

```bash
python3 /Users/bytedance/ar_sale_pilot/backend/scripts/extract_model3_frames.py --help
python3 /Users/bytedance/ar_sale_pilot/backend/scripts/convert_annotations_to_yolo_seg.py --help
python3 /Users/bytedance/ar_sale_pilot/backend/scripts/train_part_seg.py --help
python3 /Users/bytedance/ar_sale_pilot/backend/scripts/validate_part_seg.py --help
```

### 无模型降级验证

```bash
cd /Users/bytedance/ar_sale_pilot/backend
source .venv/bin/activate
PART_SEG_MODEL=/tmp/not_exist.pt python - <<'PY'
import cv2
from app.cv.vehicle_detector import VehicleDetector
cap = cv2.VideoCapture('/Users/bytedance/ar_sale_pilot/Model3.mp4')
ok, frame = cap.read()
vehicles = VehicleDetector().detect(frame) if ok else []
print(len(vehicles), len(vehicles[0]['parts']) if vehicles else 'n/a')
PY
```

期望：

```text
1 0
```

## 14. 常见问题

### 14.1 端口 8010 被占用

```bash
lsof -iTCP:8010 -sTCP:LISTEN -n -P
kill <PID>
```

然后重新启动后端。

### 14.2 前端启动时报 EACCES

```bash
sudo chown -R $(whoami):staff /Users/bytedance/ar_sale_pilot
```

然后重新启动前端。

### 14.3 页面没有部件叠加

检查：

1. 分割模型是否存在：

```bash
ls -lh /Users/bytedance/ar_sale_pilot/backend/models/parts/model3_parts_yolov8n_seg.pt
```

2. 后端是否在模型放入默认路径之后重新启动。

3. 是否设置了禁用变量：

```bash
unset DISABLE_PART_SEG
unset PART_SEG_MODEL
unset USE_LEGACY_PART_ESTIMATOR
```

4. 重启后端：

```bash
cd /Users/bytedance/ar_sale_pilot/backend
source .venv/bin/activate
uvicorn main:app --reload --host 0.0.0.0 --port 8010
```

### 14.4 标注类别顺序和 COCO 不一致怎么办

COCO 导出的 `category_id` 顺序可以和训练顺序不同。转换脚本按类别名称重新映射为：

```yaml
0: windshield
1: hood
2: wheel
3: side_window
4: headlight
```

因此不会把 `headlight` 误当成 `windshield`。

### 14.5 模型效果不好

当前只有几十张图，模型容易过拟合。建议继续补标：

- 多标轮毂清晰帧。
- 多标大灯近景帧。
- 多标不同角度前挡风玻璃。
- 数据扩展到 80-120 张后效果会明显改善。

## 15. Git 与大文件说明

以下内容不会提交到 Git：

```text
*.mp4
*.pt
backend/datasets/
backend/runs/
backend/outputs/
label_studio.sqlite3
labelstudio-venv/
media/
export/
project-*/
```

原因：

- 视频文件大。
- 训练数据和标注数据大。
- 模型权重文件大。
- Label Studio 本地数据库不应提交。

GitHub 上只保留代码、脚本和模板，不保留真实训练数据和权重。

## 16. 当前稳定版本

当前建议稳定版本：

```text
e2fb913 Add YOLO segmentation part pipeline
```

该版本包含：

- YOLO segmentation 训练脚手架。
- COCO 到 YOLO segmentation 转换。
- `part_segmenter.py`。
- polygon schema。
- 前端 polygon 展示。
- 大文件忽略规则。

## 17. 后续路线

建议下一步：

1. 继续补充标注数���到 80-120 张。
2. 重新训练 YOLOv8n-seg。
3. 使用 `validate_part_seg.py` 查看预测效果。
4. 将 best.pt 放到默认模型路径。
5. 启动前后端验证 AR 叠加。
6. 如性能不足，再加入 tracking，降低每帧 segmentation 推理频率。
