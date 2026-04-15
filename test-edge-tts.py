#!/usr/bin/env python3
"""测试 edge-tts 是否正常工作"""

import asyncio
import edge_tts
import os
import sys

async def test_edge_tts():
    print("🧪 测试 edge-tts")
    print("=" * 40)
    
    # 测试文本
    test_text = "这是一段测试文字，用于验证 edge-tts 是否正常工作。"
    
    # 测试语音
    test_voice = "zh-CN-XiaoxiaoNeural"
    
    # 输出文件
    output_file = os.path.expanduser("~/Downloads/test-edge-tts.mp3")
    
    print(f"📝 测试文本: {test_text}")
    print(f"🎤 测试语音: {test_voice}")
    print(f"📁 输出文件: {output_file}")
    print()
    
    try:
        print("⏳ 正在生成语音...")
        communicate = edge_tts.Communicate(test_text, test_voice)
        await communicate.save(output_file)
        
        if os.path.exists(output_file):
            file_size = os.path.getsize(output_file)
            print(f"✅ 生成成功!")
            print(f"   文件大小: {file_size:,} 字节")
            print(f"   文件路径: {output_file}")
            print()
            print("🎧 请用播放器打开试听")
            return True
        else:
            print("❌ 生成失败: 文件不存在")
            return False
            
    except Exception as e:
        print(f"❌ 生成失败: {e}")
        return False

async def list_voices():
    print()
    print("🎤 可用中文语音:")
    print("-" * 40)
    
    voices = await edge_tts.list_voices()
    zh_voices = [v for v in voices if v['Locale'].startswith('zh')]
    
    for i, voice in enumerate(zh_voices[:5], 1):
        print(f"{i}. {voice['ShortName']} ({voice['Gender']})")
    
    if len(zh_voices) > 5:
        print(f"   ... 还有 {len(zh_voices) - 5} 个语音")
    
    print()
    return zh_voices

async def main():
    print("🎤 Edge TTS 测试工具")
    print("=" * 40)
    print()
    
    # 列出语音
    voices = await list_voices()
    
    # 测试生成
    success = await test_edge_tts()
    
    print()
    print("=" * 40)
    if success:
        print("🎉 测试通过!")
    else:
        print("❌ 测试失败")
    
    return success

if __name__ == "__main__":
    try:
        result = asyncio.run(main())
        sys.exit(0 if result else 1)
    except KeyboardInterrupt:
        print("\n⚠️  测试被中断")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ 错误: {e}")
        sys.exit(1)
