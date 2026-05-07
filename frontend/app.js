const videoElement = document.getElementById('webcam');
const canvasElement = document.getElementById('snapshot-canvas');
const cameraContainer = document.getElementById('camera-container');
const statusReader = document.getElementById('status-reader');

let stream = null;
let isCameraOn = false;
let isFlat = true; // Trạng thái thăng bằng của điện thoại
let isWarningOrientation = false; // Cờ chống đọc cảnh báo liên tục

// ĐỊA CHỈ API CỦA BACKEND (Sẽ thay đổi nếu chạy qua Ngrok trên điện thoại)
const BACKEND_API_URL = "http://127.0.0.1:8000/upload";

// Bắt buộc trình duyệt tải trước danh sách giọng nói để tránh lỗi không tìm thấy giọng
let voices = [];
window.speechSynthesis.onvoiceschanged = () => {
    voices = window.speechSynthesis.getVoices();
};

// Hàm phát giọng nói (Text-to-Speech có sẵn của trình duyệt)
function speak(text) {
    statusReader.innerText = text; // Cập nhật chữ cho NVDA đọc
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "vi-VN"; // Gắn cờ tiếng Việt
    
    // Ép trình duyệt tìm đúng giọng Tiếng Việt (Microsoft An hoặc Google Tiếng Việt)
    if (voices.length === 0) voices = window.speechSynthesis.getVoices();
    const viVoice = voices.find(voice => voice.lang.includes('vi') || voice.lang.includes('VN'));
    if (viVoice) {
        utterance.voice = viVoice;
    }
    
    window.speechSynthesis.speak(utterance);
}

// Hàm đọc và phân tích cảm biến thăng bằng Gyroscope
function handleOrientation(event) {
    let beta = event.beta;   // Góc nghiêng trước/sau [-180,180]
    let gamma = event.gamma; // Góc nghiêng trái/phải [-90,90]
    
    if (beta === null || gamma === null) {
        isFlat = true; // Thiết bị không hỗ trợ, mặc định cho qua
        return;
    }

    // ĐT nằm song song với mặt bàn nếu beta và gamma gần bằng 0
    // Cho phép dung sai 15 độ
    if (Math.abs(beta) < 15 && Math.abs(gamma) < 15) {
        isFlat = true;
    } else {
        isFlat = false;
    }
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
        // Xin quyền Gyroscope trên iOS 13+
        if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
            try {
                const permissionState = await DeviceOrientationEvent.requestPermission();
                if (permissionState === 'granted') {
                    window.addEventListener('deviceorientation', handleOrientation);
                }
            } catch (error) {
                console.error("Gyroscope permission error:", error);
            }
        } else {
            // Android hoặc các trình duyệt khác
            window.addEventListener('deviceorientation', handleOrientation);
        }

        speak("Đã bật Camera. Vui lòng giữ máy thẳng song song với tài liệu.");
        
        // Mở Camera (Bắt buộc dùng Camera sau trên điện thoại nhờ facingMode: environment)
        stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment" },
            audio: false
        });
        
        videoElement.srcObject = stream;
        cameraContainer.style.display = 'block';
        isCameraOn = true;

        // Bắt đầu đếm ngược 3 giây nhưng có kiểm tra cảm biến nghiêng
        let countdown = 3;
        const interval = setInterval(() => {
            if (!isFlat) {
                if (!isWarningOrientation) {
                    speak("Điện thoại đang bị nghiêng, vui lòng giữ máy thẳng song song với mặt bàn");
                    isWarningOrientation = true;
                    setTimeout(() => isWarningOrientation = false, 4000); // Tránh cảnh báo liên tục gây ồn
                }
                return; // Tạm dừng đếm ngược nếu bị nghiêng
            }

            if (countdown > 0) {
                speak(countdown.toString());
                countdown--;
            } else {
                clearInterval(interval);
                window.removeEventListener('deviceorientation', handleOrientation);
                takeSnapshot();
            }
        }, 1200);

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
            if (result.audio_url) {
                // Tắt giọng báo cáo mặc định để chuẩn bị bật nhạc
                speak("Đã xử lý xong, bắt đầu đọc văn bản.");
                
                // Mở file mp3 do gTTS (Backend) tạo ra
                // Lấy IP hiện tại (vd: http://127.0.0.1:8000) ghép với /audio/file.mp3
                const baseUrl = BACKEND_API_URL.replace("/upload", "");
                const audioPlayer = new Audio(baseUrl + result.audio_url);
                audioPlayer.play();
            } else {
                // Đọc nội dung AI trả về nếu không có file âm thanh
                speak(`Xử lý thành công. Trí tuệ nhân tạo đọc được như sau: ${result.text}`);
            }
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
