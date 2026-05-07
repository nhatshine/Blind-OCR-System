from gtts import gTTS
import os
import time

AUDIO_DIR = "temp_audio"
os.makedirs(AUDIO_DIR, exist_ok=True)

def text_to_speech(text: str) -> str:
    """
    Chuyển văn bản thành file âm thanh .mp3 sử dụng Google TTS.
    Trả về đường dẫn tới file âm thanh.
    """
    try:
        # Nếu bức ảnh bị nhòe, AI không đọc được chữ nào
        if not text or text.strip() == "":
            text = "Xin lỗi, tôi không thể đọc được chữ nào trong bức ảnh. Có thể do ảnh quá mờ hoặc bị mất góc, bạn vui lòng thử chụp lại nhé."
            
        tts = gTTS(text=text, lang='vi', slow=False)
        
        # Đặt tên file duy nhất theo thời gian thực (tránh trùng lặp)
        filename = f"audio_{int(time.time())}.mp3"
        filepath = os.path.join(AUDIO_DIR, filename)
        
        tts.save(filepath)
        return filepath
    except Exception as e:
        print(f"Lỗi TTS: {e}")
        return None
