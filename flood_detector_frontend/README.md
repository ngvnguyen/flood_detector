# 🌊 AQUA-GUARD // Giao Diện Web Giám Sát & Cảnh Báo Ngập Lụt Thời Gian Thực

Giao diện Web Frontend hiệu năng cao được xây dựng phục vụ việc nhận diện và cảnh báo ngập lụt theo thời gian thực kết nối với Backend **RT-DETR + FastAPI + WebSockets**.

---

## ✨ Điểm Nổi Bật Của Giao Diện

- **HUD Giám Sát Chuyên Nghiệp (Cyberpunk & Command Center Style)**: Thiết kế tông màu tối (Dark Theme), viền kính mờ (Glassmorphism), hiệu ứng phát sáng cảnh báo (Neon Glow), đường quét HUD và tâm ngắm công nghệ cao.
- **Hỗ Trợ 4 Nguồn Dữ Liệu**:
  1. 📷 **Camera Trực Tiếp (Webcam)**: Tự động nhận diện thiết bị camera, stream trực tiếp qua WebSocket với độ trễ siêu thấp.
  2. 🎥 **Tệp Video (MP4 / WebM / OGG)**: Tải video từ máy, trình phát video tích hợp điều khiển Play/Pause/Tua (Scrubber), tốc độ (0.5x - 2.0x), chế độ lặp (Loop).
  3. 🖼️ **Ảnh Đơn (Image Upload)**: Kéo thả hoặc duyệt ảnh tĩnh kiểm tra ngay kết quả.
  4. ⚡ **Dữ Liệu Mẫu (Demo Samples)**: Tích hợp sẵn 3 ảnh ngập lụt thực tế để kiểm thử ngay lập tức chỉ với 1-click.
- **Trực Quan Hóa Bounding Box**: Vẽ khung nhận diện góc nhọn HUD màu đỏ (`#EF4444`), nhãn `NGẬP LỤT` kèm phần trăm độ tin cậy (`Confidence %`), tính toán tỷ lệ diện tích ngập trên khung hình.
- **Banner Báo Động Lớn (Emergency Alert Banner)**: Nhấp nháy màu đỏ báo động khi phát hiện ngập nguy hiểm; chuyển xanh lá khi an toàn.
- **Còi Hú Cảnh Báo Bằng Âm Thanh (Web Audio API Synthesizer)**: Tự động tổng hợp âm thanh còi báo động khẩn cấp trực tiếp trong trình duyệt, không phụ thuộc file audio ngoài, có công tắc Bật/Tắt âm lượng.
- **Chỉ Số Thời Gian Thực (Telemetry & Performance Metrics)**:
  - Tốc độ khung hình (FPS)
  - Độ trễ suy luận AI (Latency ms)
  - Số vùng ngập phát hiện (`objects_count`)
  - Tỷ lệ bao phủ ngập ước tính (%)
  - Biểu đồ Mini Sparkline hiển thị biến thiên độ trễ 30 khung hình gần nhất.
- **Nhật Ký Sự Cố (Incident History & Snapshot)**: Tự động chụp ảnh thumbnail khi phát hiện ngập, lưu lại mốc thời gian, cho phép click xem phóng to, tải ảnh snapshot JPG về máy và xuất báo cáo CSV.

---

## 🚀 3 Cách Khởi Chạy Giao Diện

### Cách 1: Chạy trực tiếp từ Máy chủ FastAPI (Khuyến nghị - Nhanh nhất)

Server FastAPI đã được tích hợp sẵn route tự động phục vụ Frontend:

```bash
# 1. Di chuyển vào thư mục server
cd flood_detector_server

# 2. Khởi động server
python main.py
```

Sau khi server khởi động, hãy mở trình duyệt và truy cập:
👉 **`http://localhost:8000/`**

Toàn bộ giao diện web sẽ xuất hiện và tự động kết nối đến WebSocket `ws://localhost:8000/ws/flood-detection`.

---

### Cách 2: Mở trực tiếp file HTML (Không cần Node.js)

Giao diện được thiết kế dạng **Standalone Single-Page Application**:

1. Mở thư mục `flood_detector_frontend/`.
2. Nhấp đúp chuột vào file **`index.html`** để mở bằng trình duyệt (Google Chrome, Microsoft Edge, Firefox, Cốc Cốc,...).
3. Đảm bảo Server FastAPI đang chạy ở cổng `8000`. Nếu chạy server trên máy khác, chỉ cần nhấn nút **Bánh răng (Cài đặt)** ở góc trên bên phải để đổi địa chỉ WebSocket (ví dụ: `ws://192.168.1.100:8000/ws/flood-detection`).

---

### Cách 3: Chạy môi trường phát triển Vite (Dành cho Lập trình viên)

Nếu bạn muốn tùy biến mã nguồn và phát triển thêm bằng hệ sinh thái Vite + Vue:

```bash
# 1. Di chuyển vào thư mục frontend
cd flood_detector_frontend

# 2. Cài đặt thư viện
npm install

# 3. Khởi chạy dev server
npm run dev
```

Trình duyệt sẽ mở tại `http://localhost:5173/`. Vite đã được cấu hình proxy tự động chuyển tiếp request `/ws` và `/api` sang server FastAPI cổng `8000`.

---

## 📁 Cấu Trúc Thư Mục Frontend

```text
flood_detector_frontend/
├── index.html              # Trang giao diện chính (Standalone SPA)
├── css/
│   └── style.css           # Bảng mã CSS Cyberpunk & Tactical Surveillance HUD
├── js/
│   ├── app.js              # Xử lý luồng Camera/Video/Image, WebSocket, Canvas HUD, Audio
│   └── samples.js          # Dữ liệu ảnh mẫu phục vụ thử nghiệm nhanh
├── samples/                # Thư mục lưu các ảnh mẫu kiểm thử ngập lụt
│   ├── sample_flood_1.jpg
│   ├── sample_flood_2.jpg
│   └── sample_flood_3.jpg
├── src/                    # Mã nguồn Vue 3 SFC (App.vue, main.js)
│   ├── App.vue
│   └── main.js
├── package.json            # Cấu hình dependency cho Vite & Vue 3
├── vite.config.js          # Cấu hình bundler Vite & Proxy
└── README.md               # Tài liệu hướng dẫn sử dụng
```

---

## ⚙️ Tùy Chỉnh Cấu Hình (Settings)

Nhấn vào biểu tượng **Bánh răng** ở thanh tiêu đề trên cùng để tùy chỉnh:
- **Địa chỉ máy chủ WebSocket**: Mặc định `ws://localhost:8000/ws/flood-detection`.
- **Giới hạn FPS (FPS Limit)**: 5, 10, 15, 20, 30 FPS (Khuyến nghị để 15 FPS để đảm bảo độ mượt mà không làm nghẽn băng thông).
- **Ngưỡng lọc độ tin cậy (Confidence Threshold)**: Thanh trượt từ 20% đến 95% (Mặc định 45%).
- **Cảnh báo âm thanh**: Bật/Tắt còi hú khi phát hiện ngập.
- **Tùy chọn hiển thị**: Bật/Tắt khung Bounding Box, nhãn tên, phần trăm độ tin cậy.
