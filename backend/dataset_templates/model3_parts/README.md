# Model3 车辆部件分割数据集模板

本目录只提交数据集模板，不提交真实图片、标注或训练输出。

推荐类别：

```yaml
0: windshield
1: hood
2: wheel
3: side_window
4: headlight
```

真实数据目录应放在：

```text
backend/datasets/model3_parts/
  frames/
  annotations/
  images/train/
  images/val/
  labels/train/
  labels/val/
  data.yaml
```

真实数据目录已被 `.gitignore` 忽略。
