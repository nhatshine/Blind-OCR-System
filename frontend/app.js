const videoElement = document.getElementById('webcam');
const canvasElement = document.getElementById('snapshot-canvas');
const cameraContainer = document.getElementById('camera-container');
const statusReader = document.getElementById('status-reader');

let stream = null;
let isCameraOn = false;

// ĐỊA CHỈ API CỦA BACKEND (Sẽ thay đổi nếu chạy qua Ngrok trên điện thoại)
const BACKEND_API_URL = "http://127.0.0.1:8000/upload";

// Hàm phát giọng nói (Text-to-Speech có sẵn của trình duyệt)
function speak(text) {
    statusReader.innerText = text; // Cập nhật chữ cho NVDA đọc
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "vi-VN";
    window.speechSynthesis.speak(utterance);
}

// Bắt sự kiện bàn phím (Phím C)
document.addEventListener('keydown', async (event) => {
    if (event.key.toLowerCase() === 'c') {
        if (!isCameraOn) {
            await startCameraAndCapture();
        }
    }
});

// Bắt sự kiện chạm màn hình (Cho điện thoại)
document.body.addEventListener('click', async () => {
    if (!isCameraOn) {
        await startCameraAndCapture();
    }
});

async function startCameraAndCapture() {
    try {
        speak("Đã bật Camera. Vui lòng giữ im tài liệu trước máy ảnh trong 3 giây.");
        
        // Mở Camera (Bắt buộc dùng Camera sau trên điện thoại nhờ facingMode: environment)
        stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment" },
            audio: false
        });
        
        videoElement.srcObject = stream;
        cameraContainer.style.display = 'block';
        isCameraOn = true;

        // Bắt đầu đếm ngược 3 giây
        let countdown = 3;
        const interval = setInterval(() => {
            if (countdown > 0) {
                speak("Bíp");
                countdown--;
            } else {
                clearInterval(interval);
                takeSnapshot();
            }
        }, 1000);

    } catch (err) {
        speak("Lỗi không thể mở Camera. Vui lòng kiểm tra lại quyền truy cập Camera của trình duyệt.");
        console.error("Camera error:", err);
    }
}

function takeSnapshot() {
    // Kêu tiếng Tách!
    speak("Tách! Đã chụp xong, đang gửi ảnh lên Server để phân tích. Vui lòng chờ...");
    
    // Đưa ảnh từ video vào canvas
    canvasElement.width = videoElement.videoWidth;
    canvasElement.height = videoElement.videoHeight;
    const ctx = canvasElement.getContext('2d');
    ctx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);
    
    // Tắt Camera ngay lập tức để tiết kiệm pin
    stream.getTracks().forEach(track => track.stop());
    cameraContainer.style.display = 'none';
    isCameraOn = false;

    // Chuyển canvas thành file ảnh blob và gửi lên server
    canvasElement.toBlob(blob => {
        sendToBackend(blob);
    }, 'image/jpeg', 0.9);
}

async function sendToBackend(imageBlob) {
    const formData = new FormData();
    // Gắn cái ảnh vừa chụp vào một biến tên là "file" (Giống như khi đính kèm file trong HTML)
    formData.append("file", imageBlob, `snapshot_${Date.now()}.jpg`);

    try {
        const response = await fetch(BACKEND_API_URL, {
            method: "POST",
            body: formData
        });
        
        const result = await response.json();
        
        if (result.status === "success") {
            // Đọc nội dung AI (hiện tại là AI giả) trả về
            speak(`Xử lý thành công. Trí tuệ nhân tạo đọc được như sau: ${result.text}`);
        } else {
            speak("Có lỗi xảy ra bên trong Server.");
        }
    } catch (error) {
        speak("Lỗi kết nối mạng. Không thể gửi ảnh lên Server.");
        console.error("API error:", error);
    }
}

// Chào mừng ngay khi trang Web được tải xong
window.onload = () => {
    // Cần 1 khoảng delay ngắn để trình duyệt cho phép phát giọng nói
    setTimeout(() => {
        speak("Hệ thống đã sẵn sàng. Gõ phím C hoặc chạm vào màn hình để bắt đầu quét văn bản.");
    }, 1000);
};
