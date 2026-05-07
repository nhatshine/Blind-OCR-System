from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
import time

# Import 2 cỗ máy AI vừa chế tạo
from ocr_engine import process_image
from tts_engine import text_to_speech, AUDIO_DIR

app = FastAPI(title="Blind OCR API", description="Mock API cho hệ thống đọc báo")

# BẬT CORS để cho phép Điện thoại truy cập qua Ngrok gọi API vào máy tính
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Trong Hackathon có thể để * cho nhanh
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

TEMP_DIR = "temp_images"
os.makedirs(TEMP_DIR, exist_ok=True)

# Để trình duyệt tải và nghe được file mp3, ta phải "mở cửa" thư mục temp_audio ra mạng
app.mount("/audio", StaticFiles(directory=AUDIO_DIR), name="audio")

@app.post("/upload")
async def upload_image(file: UploadFile = File(...)):
    """
    API Nhận file ảnh từ Frontend, chuyển cho AI phân tích, và trả về link file âm thanh.
    """
    try:
        # 1. LƯU ẢNH: Nhận từ điện thoại và lưu tạm vào Laptop
        file_path = os.path.join(TEMP_DIR, file.filename)
        with open(file_path, "wb") as f:
            content = await file.read()
            f.write(content)
            
        # 2. ĐỘNG CƠ AI SỐ 1: Bọc PaddleOCR và VietOCR đọc chữ
        text_ket_qua = process_image(file_path)
        
        # 3. ĐỘNG CƠ AI SỐ 2: Gọi gTTS biến chữ thành file MP3
        mp3_filepath = text_to_speech(text_ket_qua)
        
        # Tạo đường link tĩnh cho frontend. 
        # Ví dụ mp3_filepath = "temp_audio/abc.mp3" -> url = "/audio/abc.mp3"
        audio_url = f"/audio/{os.path.basename(mp3_filepath)}" if mp3_filepath else ""
        
        # 4. GỬI KẾT QUẢ VỀ CHO ĐIỆN THOẠI
        return {
            "status": "success",
            "message": "Phân tích ảnh thành công!",
            "text": text_ket_qua,
            "audio_url": audio_url
        }
        
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get("/")
def read_root():
    return {"message": "Server FastAPI đang chạy ngon lành!"}
