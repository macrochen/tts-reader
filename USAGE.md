# 朗读器 - Electron + Edge TTS

## 项目结构

```
tts-reader-electron/
├── main.js           # Electron 主进程
├── index.html        # 应用界面
├── package.json      # 项目配置
├── start.sh          # 快速启动脚本
├── test-edge-tts.py  # edge-tts 测试脚本
└── README.md         # 说明文档
```

## 快速开始

### 1. 安装依赖

```bash
# 安装 Node.js 依赖
npm install

# 安装 Python edge-tts
pip3 install edge-tts
```

### 2. 启动应用

```bash
# 方式一：使用 npm
npm start

# 方式二：使用启动脚本
./start.sh
```

### 3. 测试 edge-tts

```bash
python3 test-edge-tts.py
```

## 使用方法

1. **输入文字**：在左侧输入或粘贴文字（支持 Markdown）
2. **选择语音**：默认使用「晓晓」（最受欢迎的中文语音）
3. **调整语速**：拖动语速滑块（-50% ~ +100%）
4. **开始播放**：点击「播放」按钮
5. **高亮同步**：文字会根据朗读进度自动高亮

## 语音推荐

| 语音 | 名称 | 特点 |
|------|------|------|
| 晓晓 | XiaoxiaoNeural | 女声，自然流畅，最推荐 |
| 云希 | YunxiNeural | 男声，年轻活力 |
| 云扬 | YunyangNeural | 男声，专业播音 |
| 晓艺 | XiaoyiNeural | 女声，温柔甜美 |
| 晓北 | XiaobeiNeural | 女声，东北口音 |

## 打包应用

```bash
# 打包为 macOS 应用
npm run build

# 输出目录：dist/
```

## 键盘快捷键

- `空格`：播放/暂停
- `ESC`：停止
- `Ctrl + ↑`：加速
- `Ctrl + ↓`：减速

## 技术栈

- **Electron**：桌面应用框架
- **Edge TTS**：微软高质量语音合成
- **Marked.js**：Markdown 解析
- **Web Audio API**：音频播放

## 注意事项

1. 首次使用需要网络连接（edge-tts 需要联网生成语音）
2. 语音生成需要几秒钟时间
3. 长文本建议分段朗读
4. 临时文件会自动清理

## 常见问题

### Q: 语音生成失败？
A: 检查网络连接，确保 edge-tts 已安装：`pip3 install edge-tts`

### Q: 高亮不同步？
A: edge-tts 生成的字幕时间戳是近似值，可能有轻微偏差

### Q: 如何添加新语音？
A: 运行 `edge-tts --list-voices` 查看所有可用语音

## 许可证

MIT
