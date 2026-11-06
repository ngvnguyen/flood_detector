<template>
  <div class="app-container">
    <!-- Header -->
    <header class="header">
      <div class="brand-section">
        <div class="brand-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="7"></circle>
            <path d="M12 2v2M12 20v2M2 12h2M20 12h2"></path>
          </svg>
        </div>
        <div class="brand-info">
          <h1>
            AQUA-GUARD // HỆ THỐNG CẢNH BÁO NGẬP LỤT
            <span class="badge-tech">{{ modelStatusText }}</span>
          </h1>
          <p>Giám sát thời gian thực từ Camera giao thông & Suy luận biên độ trễ thấp</p>
        </div>
      </div>

      <div class="header-status-group">
        <div class="status-pill">
          <div class="status-dot" :class="connectionStatusClass"></div>
          <span>{{ connectionStatusText }}</span>
        </div>

        <button class="btn btn-secondary" @click="toggleConnection">
          <span>{{ wsConnected ? 'Ngắt kết nối' : 'Kết nối lại' }}</span>
        </button>

        <button class="btn btn-secondary btn-icon" @click="soundAlert = !soundAlert" :title="soundAlert ? 'Tắt âm thanh' : 'Bật âm thanh'">
          <span>{{ soundAlert ? '🔊' : '🔇' }}</span>
        </button>

        <button class="btn btn-secondary btn-icon" @click="showSettings = true" title="Cấu hình hệ thống">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
        </button>
      </div>
    </header>

    <!-- Main Workspace -->
    <main class="main-content">
      <!-- Left: Viewport & Stream -->
      <section class="stream-panel">
        <nav class="source-selector">
          <button class="source-tab" :class="{ active: activeTab === 'camera' }" @click="activeTab = 'camera'">
            <span>Camera Trực Tiếp</span>
          </button>
          <button class="source-tab" :class="{ active: activeTab === 'video' }" @click="activeTab = 'video'">
            <span>Tệp Video</span>
          </button>
          <button class="source-tab" :class="{ active: activeTab === 'image' }" @click="activeTab = 'image'">
            <span>Ảnh Đơn</span>
          </button>
        </nav>

        <div class="viewport-card" :class="{ 'alert-mode': isFloodAlert }">
          <div class="viewport-stage" ref="stageRef">
            <video ref="videoRef" playsinline muted autoplay style="width: 100%; height: 100%; object-fit: contain;"></video>
            <canvas ref="hudCanvasRef" class="hud-canvas"></canvas>
            <div class="scanline-effect"></div>
          </div>

          <!-- Alert Banner -->
          <div class="alert-banner" :class="alertBannerClass">
            <div class="alert-banner-content">
              <div class="alert-banner-icon">🚨</div>
              <div class="alert-banner-text">
                <h3>{{ isFloodAlert ? `CẢNH BÁO: PHÁT HIỆN ${detections.length} VÙNG NGẬP LỤT!` : 'MẶT ĐƯỜNG AN TOÀN - KHÔNG PHÁT HIỆN NGẬP' }}</h3>
                <p>{{ isFloodAlert ? 'Mặt đường có dấu hiệu ngập sâu, phương tiện di chuyển có nguy cơ chết máy.' : 'Tuyến đường khô ráo hoặc ướt mưa nhẹ, giao thông lưu thông bình thường.' }}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Right: Telemetry -->
      <aside class="metrics-panel">
        <div class="panel-card">
          <div class="card-header">
            <h2>Chỉ Số Thời Gian Thực</h2>
            <span class="badge-tech text-cyan">METRICS</span>
          </div>
          <div class="telemetry-grid">
            <div class="telemetry-item">
              <span class="telemetry-label">Tốc độ khung hình</span>
              <div class="telemetry-value">{{ fps }} FPS</div>
            </div>
            <div class="telemetry-item">
              <span class="telemetry-label">Độ trễ suy luận</span>
              <div class="telemetry-value">{{ latency }} ms</div>
            </div>
            <div class="telemetry-item">
              <span class="telemetry-label">Số vùng ngập</span>
              <div class="telemetry-value danger">{{ detections.length }}</div>
            </div>
            <div class="telemetry-item">
              <span class="telemetry-label">Độ tin cậy tối đa</span>
              <div class="telemetry-value">{{ maxConfidence }}%</div>
            </div>
          </div>
        </div>
      </aside>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';

const wsConnected = ref(false);
const activeTab = ref('camera');
const fps = ref(0);
const latency = ref(0);
const detections = ref([]);
const soundAlert = ref(true);
const showSettings = ref(false);

const isFloodAlert = computed(() => detections.value.length > 0);
const alertBannerClass = computed(() => isFloodAlert.value ? 'danger' : 'safe');
const connectionStatusClass = computed(() => wsConnected.value ? 'online' : 'offline');
const connectionStatusText = computed(() => wsConnected.value ? 'Server Online' : 'Server Offline');
const modelStatusText = ref('RT-DETR • ONNX');

const maxConfidence = computed(() => {
  if (detections.value.length === 0) return 0;
  return Math.round(Math.max(...detections.value.map(d => d.confidence || 0)) * 100);
});

function toggleConnection() {
  // Toggle WebSocket connection
}

onMounted(() => {
  // Khởi tạo kết nối và stream
});
</script>
