#!/bin/bash

# 朗读器启动脚本

echo "🎤 朗读器 - Edge TTS 高质量语音"
echo "================================"
echo ""

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 未找到 Node.js"
    echo "请先安装 Node.js: https://nodejs.org/"
    exit 1
fi

# 检查 Python
if ! command -v python3 &> /dev/null; then
    echo "❌ 未找到 Python 3"
    echo "请先安装 Python 3"
    exit 1
fi

# 检查 edge-tts
if ! python3 -c "import edge_tts" 2>/dev/null; then
    echo "📦 正在安装 edge-tts..."
    pip3 install edge-tts
fi

# 检查 node_modules
if [ ! -d "node_modules" ]; then
    echo "📦 正在安装依赖..."
    npm install
fi

echo ""
echo "🚀 启动朗读器..."
echo ""

npm start
