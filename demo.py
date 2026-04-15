#!/usr/bin/env python3
"""演示 edge-tts 语音效果"""

import asyncio
import edge_tts
import os
import sys

# 演示文本
DEMO_TEXTS = {
    "新闻播报": "今天是______，欢迎收看新闻联播。首先来看国内要闻。据新华社报道，我国在量子计算领域取得重大突破，成功研制出新一代量子计算机原型机。",
    
    "文学朗读": "床前明月光，疑是地上霜。举头望明月，低头思故乡。这首诗是唐代诗人李白的《静夜思》，表达了诗人在寂静的月夜思念家乡的感受。",
    
    "科技解读": "人工智能正在改变我们的生活方式。从智能手机到自动驾驶，从语音助手到智能家居，AI技术已经渗透到我们生活的方方面面。",
    
    "财经分析": "根据最新财报数据显示，该公司本季度营收同比增长百分之二十五，净利润达到十亿元人民币，超出市场预期。",
}

# 推荐语音
RECOMMENDED_VOICES = [
    ("zh-CN-XiaoxiaoNeural", "晓晓（女声）- 最受欢迎"),
    ("zh-CN-YunxiNeural", "云希（男声）- 年轻活力"),
    ("zh-CN-YunyangNeural", "云扬（男声）- 专业播音"),
    ("zh-CN-XiaoyiNeural", "晓艺（女声）- 温柔甜美"),
]

async def generate_demo():
    print("🎤 Edge TTS 语音演示")
    print("=" * 50)
    print()
    
    output_dir = os.path.expanduser("~/Downloads/edge-tts-demo")
    os.makedirs(output_dir, exist_ok=True)
    
    # 生成不同风格的示例
    for style, text in DEMO_TEXTS.items():
        print(f"📝 {style}:")
        print(f"   {text[:50]}...")
        
        output_file = os.path.join(output_dir, f"{style}.mp3")
        
        try:
            communicate = edge_tts.Communicate(text, "zh-CN-XiaoxiaoNeural")
            await communicate.save(output_file)
            print(f"   ✅ 已保存: {output_file}")
        except Exception as e:
            print(f"   ❌ 失败: {e}")
        
        print()
    
    # 生成不同语音的对比
    print("🎤 语音对比（同一段文字）")
    print("-" * 50)
    
    compare_text = "大家好，我是人工智能语音助手。我可以帮助您朗读文字、翻译语言、回答问题。"
    
    for voice, desc in RECOMMENDED_VOICES:
        print(f"🎤 {desc}")
        
        output_file = os.path.join(output_dir, f"{voice}.mp3")
        
        try:
            communicate = edge_tts.Communicate(compare_text, voice)
            await communicate.save(output_file)
            print(f"   ✅ 已保存: {output_file}")
        except Exception as e:
            print(f"   ❌ 失败: {e}")
        
        print()
    
    print("=" * 50)
    print(f"🎧 所有演示文件已保存到: {output_dir}")
    print()
    print("💡 使用建议:")
    print("   1. 用音乐播放器打开试听")
    print("   2. 比较不同风格和语音的效果")
    print("   3. 选择最适合您需求的语音")

async def main():
    try:
        await generate_demo()
        return True
    except Exception as e:
        print(f"❌ 错误: {e}")
        return False

if __name__ == "__main__":
    try:
        result = asyncio.run(main())
        sys.exit(0 if result else 1)
    except KeyboardInterrupt:
        print("\n⚠️  演示被中断")
        sys.exit(1)
