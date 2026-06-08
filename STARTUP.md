# 项目启动说明

本文档说明如何在本地启动 AR 眼镜 + AI 汽车导购 Demo。

## 1. 项目目录

项目路径：

```bash
/Users/bytedance/ar_sale_pilot
```

进入项目目录：

```bash
cd /Users/bytedance/ar_sale_pilot
```

## 2. 启动后端服务

后端负责：

- 接收前端上传的视频帧
- 检测车辆位置
- 估算车身、车窗、轮毂、车灯、车头等部位
- 查询本地优惠库
- 调用 LLM 或使用本地规则回答问题

打开一个终端窗口，执行：

```bash
cd /Users/bytedance/ar_sale_pilot/backend
source .venv/bin/activate
DISABLE_YOLO=1 uvicorn main:app --reload --host 0.0.0.0 --port 8010
```

看到类似输出说明后端启动成功：

```text
Uvicorn running on http://0.0.0.0:8010
```

这个终端窗口不要关闭。

### 后端端口

默认端口：

```text
8010
```

健康检查地址：

```text
http://localhost:8010/api/health
```

正常返回：

```json
{"status":"ok"}
```

## 3. 启动前端页面

前端负责：

- 播放汽车视频
- 实时抽取视频帧并发送给后端
- 根据后端返回的检测结果绘制 AR 信息浮层
- 支持语音播报、语音输入和文本问答

重新打开一个新的终端窗口，执行：

```bash
cd /Users/bytedance/ar_sale_pilot/frontend
npm run dev
```

看到类似输出说明前端启动成功：

```text
Local: http://localhost:5173/
```

## 4. 打开页面

推荐使用 Chrome 浏览器访问：

```text
http://localhost:5173
```

进入页面后点击视频播放按钮。

## 5. 验证是否启动成功

视频播放后，页面右上角应该能看到类似信息：

```text
Detection: YOLOv8n
Frame ID: 1
Latency: xxms
Vehicles: 1
Parts: geometry estimated
Mode: realtime frame detection
```

如果视频画面上出现车辆框、轮毂、车窗、车身等 AR 信息浮层，说明实时识别链路已经跑通。

## 6. 常见问题

### 6.1 前端启动时报 EACCES 权限错误

如果出现类似错误：

```text
EACCES: permission denied, rmdir '.../frontend/node_modules/.vite/deps'
```

说明 `node_modules` 或 Vite 缓存目录权限不正确。

执行：

```bash
sudo chown -R $(whoami):staff /Users/bytedance/ar_sale_pilot
```

然后重新启动前端：

```bash
cd /Users/bytedance/ar_sale_pilot/frontend
npm run dev
```

### 6.2 后端端口被占用

本项目默认后端端口是 `8010`。

如果提示端口被占用，可以查看占用进程：

```bash
lsof -iTCP:8010 -sTCP:LISTEN -n -P
```

如果确认是无关进程，可以停止该进程后重新启动后端。

### 6.3 YOLO 模型下载失败

当前启动命令使用了：

```bash
DISABLE_YOLO=1
```

这会启用 fallback 检测模式，避免首次启动时因为模型下载失败阻塞 demo。

如果后续希望启用真实 YOLOv8 检测，可以去掉 `DISABLE_YOLO=1`：

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8010
```

首次运行时可能会下载 `yolov8n.pt`。

## 7. 一键复制版

终端 1：

```bash
cd /Users/bytedance/ar_sale_pilot/backend
source .venv/bin/activate
DISABLE_YOLO=1 uvicorn main:app --reload --host 0.0.0.0 --port 8010
```

终端 2：

```bash
cd /Users/bytedance/ar_sale_pilot/frontend
npm run dev
```

浏览器访问：

```text
http://localhost:5173
```
