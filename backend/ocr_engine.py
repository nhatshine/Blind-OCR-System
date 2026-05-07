import cv2
import numpy as np
from PIL import Image
from paddleocr import PaddleOCR
from vietocr.tool.predictor import Predictor
from vietocr.tool.config import Cfg

# ==========================================
# 1. KHỞI TẠO PADDLE OCR (TÌM KHUNG CHỮ)
# ==========================================
try:
    print("Đang tải mô hình PaddleOCR...")
    # use_angle_cls=True để nó tự lật lại ảnh nếu lỡ chụp ngược
    # Thuật toán tìm khung sẽ tự chạy, ta không cần truyền tham số rec vào đây nữa
    det_model = PaddleOCR(use_angle_cls=True, lang="vi")
except Exception as e:
    print("Lỗi khởi tạo PaddleOCR:", e)
    det_model = None

# ==========================================
# 2. KHỞI TẠO VIETOCR (ĐỌC CHỮ TIẾNG VIỆT)
# ==========================================
try:
    print("Đang tải mô hình VietOCR...")
    config = Cfg.load_config_from_name('vgg_transformer')
    
    # ⚠️ RẤT QUAN TRỌNG: 
    # Nếu máy bạn (như con RTX 3050) đã cài CUDA đầy đủ, hãy đổi thành 'cuda:0' để nó chạy nhanh gấp 10 lần.
    # Trong môi trường chưa chắc chắn, cứ để 'cpu' để đảm bảo không bị sập.
    config['device'] = 'cpu'
    
    # Mặc định VietOCR sẽ tự lên mạng tải file weights vgg_transformer.pth về máy nếu chưa có.
    detector = Predictor(config)
except Exception as e:
    print("Lỗi khởi tạo VietOCR:", e)
    detector = None

# ==========================================
# HÀM XỬ LÝ CHÍNH
# ==========================================
def process_image(img_path: str) -> str:
    """
    Nhận vào đường dẫn file ảnh, trả về chuỗi văn bản tiếng Việt siêu chuẩn.
    """
    if det_model is None or detector is None:
        return "Lỗi: Hệ thống AI chưa tải xong. Vui lòng kiểm tra màn hình Terminal."

    # Đọc ảnh bằng thư viện OpenCV
    img = cv2.imread(img_path)
    if img is None:
        return "Lỗi: Không thể đọc được file ảnh."

    # Bước 1: Cho ảnh vào PaddleOCR để lấy Tọa độ các dòng chữ
    print("AI bắt đầu quét tìm chữ trên ảnh...")
    result = det_model.ocr(img_path, cls=True, rec=False)
    
    # Nếu ảnh trắng bóc, không có chữ
    if not result or result[0] is None:
        print("Không tìm thấy dòng chữ nào trên ảnh.")
        return ""
        
    boxes = result[0]
    print(f"Đã tìm thấy {len(boxes)} dòng chữ. Bắt đầu đọc từng dòng...")
    
    # Bước 2: Sắp xếp các đoạn văn bản cho đúng trật tự từ Trên xuống Dưới, Trái qua Phải
    boxes.sort(key=lambda x: (x[0][1], x[0][0]))
    
    full_text = []
    
    # Bước 3: Cắt từng bức ảnh nhỏ và đưa cho VietOCR đọc tiếng Việt
    for i, box in enumerate(boxes):
        pts = np.array(box, dtype=np.int32)
        
        # Tìm giới hạn khung hình chữ nhật bé nhất bao quanh dòng chữ
        x_min = max(0, np.min(pts[:, 0]))
        x_max = min(img.shape[1], np.max(pts[:, 0]))
        y_min = max(0, np.min(pts[:, 1]))
        y_max = min(img.shape[0], np.max(pts[:, 1]))
        
        if x_max <= x_min or y_max <= y_min:
            continue
            
        # Cắt ảnh (Crop)
        crop_img = img[y_min:y_max, x_min:x_max]
        
        # VietOCR đòi hỏi định dạng ảnh PIL (RGB), trong khi OpenCV là BGR
        try:
            crop_rgb = cv2.cvtColor(crop_img, cv2.COLOR_BGR2RGB)
            pil_img = Image.fromarray(crop_rgb)
            
            # Quăng ảnh vào VietOCR nhận diện chữ
            text = detector.predict(pil_img)
            if text.strip():
                print(f"- Dòng {i+1}/{len(boxes)}: {text.strip()}")
                full_text.append(text.strip())
        except Exception as e:
            print(f"Lỗi khi đọc 1 dòng chữ nhỏ: {e}")
            continue
            
    # Nối tất cả các dòng chữ lại với nhau, cách nhau 1 dấu cách
    final_result = " ".join(full_text)
    print(f"==> HOÀN THÀNH. Nội dung đọc được: {final_result}")
    return final_result
