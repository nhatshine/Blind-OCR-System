from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
import os
import time

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

@app.post("/upload")
async def upload_image(file: UploadFile = File(...)):
    """
    API Giả (Mock). Nhận file ảnh từ Frontend, lưu tạm, rồi trả về Data giả.
    """
    try:
        # 1. Lưu file nhận được (Để nhóm xem thử ảnh chụp từ điện thoại nét không)
        file_path = os.path.join(TEMP_DIR, file.filename)
        with open(file_path, "wb") as f:
            content = await file.read()
            f.write(content)
            
        # --- Ở BƯỚC NÀY SAU NÀY SẼ THAY BẰNG CODE AI THẬT ---
        # text_ket_qua = ocr_engine.process_image(file_path)
        # mp3_link = text_to_speech(text_ket_qua)
        # ---------------------------------------------------
        
        # Giả lập thời gian AI chạy mất 3 giây
        time.sleep(3)
        
        # 3. Trả về DATA GIẢ để Frontend test ngay lập tức
        return {
            "status": "success",
            "message": "Đã nhận được ảnh thành công!",
            "filename": file.filename,
            "text": "Xin chào, hệ thống nhận diện giọng nói đang hoạt động tốt. Đây là nội dung giả lập báo chí. Chúc bạn một ngày tốt lành.",
            "audio_url": "" # Tạm thời để trống
        }
        
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get("/")
def read_root():
    return {"message": "Server FastAPI đang chạy ngon lành!"}
