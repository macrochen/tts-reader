# 朗读器 - Edge TTS 高质量语音

基于 Electron + Edge TTS 的本地文字朗读桌面应用，支持高质量中文语音。

## 功能特点

- ✅ 支持 Markdown 输入，实时预览
- ✅ Edge TTS 高质量语音（晓晓、云希、云扬等）
- ✅ 逐句高亮，同步朗读
- ✅ 语速调节（-50% ~ +100%）
- ✅ 音量调节
- ✅ 语音选择（30+ 中文语音）
- ✅ 剪贴板一键粘贴
- ✅ 进度显示

## 安装要求

1. **Node.js** - https://nodejs.org/
2. **Python 3** - 系统自带或 https://www.python.org/
3. **edge-tts** - 自动安装（首次运行需要网络）

## 快速开始

```bash
# 克隆或下载项目
cd tts-reader-electron

# 安装依赖
npm install

# 启动应用
npm start
```

## 使用方法

1. 在左侧输入或粘贴文字（支持 Markdown）
2. 选择语音（默认推荐「晓晓」）
3. 调整语速和音量
4. 点击「播放」开始朗读
5. 高亮会跟随朗读进度自动滚动

## 语音推荐

| 语音 | 特点 |
|------|------|
| 晓晓 (XiaoxiaoNeural) | 女声，最受欢迎，自然流畅 |
| 云希 (YunxiNeural) | 男声，年轻有活力 |
| 云扬 (YunyangNeural) | 男声，专业播音风格 |
| 晓艺 (XiaoyiNeural) | 女声，温柔甜美 |
| 晓北 (XiaobeiNeural) | 女声，东北口音 |

## 打包应用

```bash
# 仅打包（不压缩）
npm run pack

# 构建 DMG 安装包
npm run build
```

打包后的文件在 `dist/` 目录。

## 键盘快捷键

- `空格` - 播放/暂停
- `ESC` - 停止
- `Ctrl + ↑` - 加速
- `Ctrl + ↓` - 减速

## 技术栈

- **Electron** - 桌面应用框架
- **Edge TTS** - 微软高质量语音合成
- **Marked.js** - Markdown 解析
- **Web Audio API** - 音频播放

## 注意事项

1. 首次使用需要网络连接（下载语音模型）
2. 语音生成需要几秒钟时间
3. 长文本建议分段朗读

## 许可证

MIT
