# 朗读器 - Edge TTS 高质量语音

基于 Electron + Edge TTS 的本地文字朗读桌面应用，支持高质量中文语音。

## 功能特点

- ✅ 支持 Markdown 输入，实时预览（保留原有格式）
- ✅ Edge TTS 高质量语音（晓晓、云希、云扬等）
- ✅ 逐句高亮，同步朗读
- ✅ 语速调节（0.5x ~ 3x）
- ✅ 音量调节
- ✅ 语音选择（30+ 中文语音）
- ✅ 剪贴板一键粘贴
- ✅ 音频缓存（相同内容不重复生成）
- ✅ 可打包成 macOS .app 双击启动

## 快速开始

### 方式一：直接运行应用（推荐）

1. 从 [Releases](https://github.com/macrochen/tts-reader/releases) 下载 `朗读器-x.x.x-arm64.dmg`
2. 双击 DMG 文件，将「朗读器」拖到 Applications 文件夹
3. 在启动台找到「朗读器」，双击启动

### 方式二：命令行启动

```bash
# 克隆项目
git clone https://github.com/macrochen/tts-reader.git
cd tts-reader

# 安装依赖
npm install

# 安装 edge-tts
pip3 install edge-tts

# 启动应用
npm start
```

### 方式三：自己打包

```bash
# 克隆并安装
git clone https://github.com/macrochen/tts-reader.git
cd tts-reader
npm install
pip3 install edge-tts

# 打包成 macOS 应用
npm run build

# 应用在 dist/ 目录
open dist/mac-arm64/朗读器.app
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
