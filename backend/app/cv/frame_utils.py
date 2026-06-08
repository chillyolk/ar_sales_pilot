import cv2
import numpy as np
from fastapi import UploadFile


async def read_image(file: UploadFile) -> np.ndarray:
    content = await file.read()
    image = cv2.imdecode(np.frombuffer(content, np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError("无法解析上传的视频帧")
    return image
