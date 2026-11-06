/**
 * ==============================================================================
 * HỆ THỐNG CẢNH BÁO NGẬP LỤT THỜI GIAN THỰC (AQUA-GUARD HUD)
 * APP.JS - QUẢN LÝ STREAM, WEBSOCKET, CANVAS OVERLAY, TELEMETRY & ALERTS
 * ==============================================================================
 */

(function () {
  'use strict';

  // Cấu hình mặc định
  const DEFAULT_CONFIG = {
    wsUrl: window.location.protocol === 'https:'
      ? `wss://${window.location.host}/ws/flood-detection`
      : (window.location.host
          ? `ws://${window.location.host}/ws/flood-detection`
          : 'ws://localhost:8000/ws/flood-detection'),
    apiUrl: window.location.origin && window.location.origin !== 'null'
      ? window.location.origin
      : 'http://localhost:8000',
    fpsLimit: 15,
    confidenceThreshold: 0.45,
    soundAlert: true,
    soundVolume: 0.7,
    showBbox: true,
    showLabels: true,
    showCrosshair: true,
    autoReconnect: true
  };

  // State quản lý toàn bộ ứng dụng
  const state = {
    // Kết nối
    ws: null,
    wsConnected: false,
    wsConnecting: false,
    reconnectTimer: null,
    serverHealth: {
      online: false,
      modelLoaded: false,
      providers: []
    },

    // Chế độ nguồn dữ liệu: 'camera' | 'video' | 'image' | 'samples'
    activeTab: 'camera',

    // Camera Stream
    cameraStream: null,
    availableCameras: [],
    selectedCameraId: '',
    isStreaming: false,

    // Video File
    videoFile: null,
    isVideoPlaying: false,
    videoDuration: 0,
    videoCurrentTime: 0,
    videoLoop: true,
    videoSpeed: 1.0,

    // Static Image & Sample
    activeImageSrc: '',
    activeImageName: '',
    imageLoading: false,

    // Suy luận & Trực quan hoá
    lastDetectionResult: null,
    floodDetected: false,
    floodStatus: 'khong_ngap_lut',
    detections: [],
    currentLatency: 0,
    currentFps: 0,
    clientFps: 0,
    latencyHistory: [], // 30 frame gần nhất
    totalFramesProcessed: 0,
    floodFramesCount: 0,

    // Cảnh báo âm thanh
    audioCtx: null,
    lastAlertSoundTime: 0,

    // Nhật ký sự cố
    incidents: [],
    lastIncidentTime: 0,

    // Modal
    settingsModalOpen: false,
    snapshotModalOpen: false,
    currentSnapshotData: null,

    // Config người dùng
    config: { ...DEFAULT_CONFIG }
  };

  // Lưu frame loop timer
  let streamInterval = null;
  let isSendingFrame = false;
  let clientFpsCounter = 0;
  let lastClientFpsCheck = performance.now();

  // DOM Elements cache
  const el = {};

  function initElements() {
    // Header status
    el.statusPill = document.getElementById('statusPill');
    el.statusDot = document.getElementById('statusDot');
    el.statusText = document.getElementById('statusText');
    el.modelStatusBadge = document.getElementById('modelStatusBadge');
    el.btnToggleConnect = document.getElementById('btnToggleConnect');
    el.btnOpenSettings = document.getElementById('btnOpenSettings');

    // Tabs
    el.sourceTabs = document.querySelectorAll('.source-tab');

    // Viewport & Canvas
    el.viewportCard = document.getElementById('viewportCard');
    el.viewportStage = document.getElementById('viewportStage');
    el.videoElement = document.getElementById('videoElement');
    el.previewImage = document.getElementById('previewImage');
    el.hudCanvas = document.getElementById('hudCanvas');
    el.emptyPlaceholder = document.getElementById('emptyPlaceholder');
    el.hudLiveTag = document.getElementById('hudLiveTag');
    el.hudWatermark = document.getElementById('hudWatermark');

    // Alert Banner
    el.alertBanner = document.getElementById('alertBanner');
    el.alertBannerTitle = document.getElementById('alertBannerTitle');
    el.alertBannerSubtitle = document.getElementById('alertBannerSubtitle');
    el.alertBannerIcon = document.getElementById('alertBannerIcon');

    // Controls
    el.cameraControls = document.getElementById('cameraControls');
    el.videoControls = document.getElementById('videoControls');
    el.imageControls = document.getElementById('imageControls');
    el.sampleControls = document.getElementById('sampleControls');

    el.cameraSelect = document.getElementById('cameraSelect');
    el.btnStartCamera = document.getElementById('btnStartCamera');
    el.btnStopCamera = document.getElementById('btnStopCamera');

    el.videoFileInput = document.getElementById('videoFileInput');
    el.btnSelectVideo = document.getElementById('btnSelectVideo');
    el.btnPlayPauseVideo = document.getElementById('btnPlayPauseVideo');
    el.videoScrubber = document.getElementById('videoScrubber');
    el.videoTimeDisplay = document.getElementById('videoTimeDisplay');
    el.videoSpeedSelect = document.getElementById('videoSpeedSelect');
    el.videoLoopToggle = document.getElementById('videoLoopToggle');

    el.imageFileInput = document.getElementById('imageFileInput');
    el.btnSelectImage = document.getElementById('btnSelectImage');
    el.btnAnalyzeImage = document.getElementById('btnAnalyzeImage');

    el.sampleGrid = document.getElementById('sampleGrid');

    el.btnCaptureSnapshot = document.getElementById('btnCaptureSnapshot');
    el.btnToggleSound = document.getElementById('btnToggleSound');
    el.soundIcon = document.getElementById('soundIcon');

    // Telemetry
    el.telemetryFps = document.getElementById('telemetryFps');
    el.telemetryLatency = document.getElementById('telemetryLatency');
    el.telemetryCount = document.getElementById('telemetryCount');
    el.telemetryRatio = document.getElementById('telemetryRatio');
    el.telemetryMaxConf = document.getElementById('telemetryMaxConf');
    el.sparklineCanvas = document.getElementById('sparklineCanvas');

    // Incident Log
    el.incidentList = document.getElementById('incidentList');
    el.btnClearLogs = document.getElementById('btnClearLogs');
    el.btnExportLogs = document.getElementById('btnExportLogs');

    // Modals
    el.settingsModal = document.getElementById('settingsModal');
    el.btnCloseSettings = document.getElementById('btnCloseSettings');
    el.btnSaveSettings = document.getElementById('btnSaveSettings');
    el.inputWsUrl = document.getElementById('inputWsUrl');
    el.inputFps = document.getElementById('inputFps');
    el.inputConfidence = document.getElementById('inputConfidence');
    el.valConfidence = document.getElementById('valConfidence');
    el.checkSound = document.getElementById('checkSound');
    el.checkShowBbox = document.getElementById('checkShowBbox');
    el.checkShowLabels = document.getElementById('checkShowLabels');

    el.snapshotModal = document.getElementById('snapshotModal');
    el.btnCloseSnapshot = document.getElementById('btnCloseSnapshot');
    el.snapshotModalImg = document.getElementById('snapshotModalImg');
    el.snapshotModalMeta = document.getElementById('snapshotModalMeta');
    el.btnDownloadSnapshot = document.getElementById('btnDownloadSnapshot');
  }

  // ==============================================================================
  // AUDIO SYNTHESIZER (WEB AUDIO API CẢNH BÁO KHÔNG CẦN FILE NGOÀI)
  // ==============================================================================
  function playAlertSound() {
    if (!state.config.soundAlert) return;
    const now = performance.now();
    // Giới hạn tần suất phát âm thanh (tối thiểu cách nhau 1.8 giây để tránh chói tai)
    if (now - state.lastAlertSoundTime < 1800) return;
    state.lastAlertSoundTime = now;

    try {
      if (!state.audioCtx) {
        const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtxClass) return;
        state.audioCtx = new AudioCtxClass();
      }
      if (state.audioCtx.state === 'suspended') {
        state.audioCtx.resume();
      }

      const ctx = state.audioCtx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      // Hiệu ứng còi báo động khẩn cấp (880Hz xuống 550Hz)
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(550, ctx.currentTime + 0.35);

      gain.gain.setValueAtTime(state.config.soundVolume * 0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } catch (err) {
      console.warn('Audio playback error:', err);
    }
  }

  // ==============================================================================
  // WEBSOCKET & HEALTH MANAGEMENT
  // ==============================================================================
  function connectWebSocket() {
    if (state.wsConnected || state.wsConnecting) return;

    state.wsConnecting = true;
    updateStatusUI();

    try {
      const url = state.config.wsUrl;
      console.log('Connecting to WebSocket:', url);
      state.ws = new WebSocket(url);
      state.ws.binaryType = 'arraybuffer';

      state.ws.onopen = () => {
        state.wsConnected = true;
        state.wsConnecting = false;
        console.log('✅ WebSocket Connected Successfully');
        updateStatusUI();
        checkServerHealth();
      };

      state.ws.onmessage = (event) => {
        handleServerMessage(event.data);
      };

      state.ws.onerror = (err) => {
        console.warn('⚠️ WebSocket Error:', err);
      };

      state.ws.onclose = () => {
        state.wsConnected = false;
        state.wsConnecting = false;
        isSendingFrame = false;
        updateStatusUI();
        console.log('🔌 WebSocket Disconnected');

        if (state.config.autoReconnect) {
          clearTimeout(state.reconnectTimer);
          state.reconnectTimer = setTimeout(connectWebSocket, 3000);
        }
      };
    } catch (err) {
      state.wsConnected = false;
      state.wsConnecting = false;
      updateStatusUI();
      console.error('WebSocket connection failed:', err);
    }
  }

  function disconnectWebSocket() {
    clearTimeout(state.reconnectTimer);
    if (state.ws) {
      state.ws.close();
      state.ws = null;
    }
    state.wsConnected = false;
    state.wsConnecting = false;
    updateStatusUI();
  }

  async function checkServerHealth() {
    try {
      const res = await fetch(`${state.config.apiUrl}/health`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        state.serverHealth.online = true;
        state.serverHealth.modelLoaded = data.model_loaded;
        state.serverHealth.providers = data.providers || [];
        updateStatusUI();
      }
    } catch (e) {
      state.serverHealth.online = false;
      state.serverHealth.modelLoaded = false;
      updateStatusUI();
    }
  }

  // ==============================================================================
  // XỬ LÝ DỮ LIỆU PHẢN HỒI TỪ SERVER
  // ==============================================================================
  function handleServerMessage(data) {
    try {
      const payload = typeof data === 'string' ? JSON.parse(data) : JSON.parse(new TextDecoder().decode(data));

      if (payload.status === 'error') {
        console.error('Server error message:', payload.message);
        return;
      }

      state.totalFramesProcessed++;
      state.currentLatency = payload.latency_ms || 0;
      state.currentFps = payload.fps || 0;

      // Cập nhật mảng lịch sử latency cho biểu đồ
      state.latencyHistory.push(state.currentLatency);
      if (state.latencyHistory.length > 30) state.latencyHistory.shift();

      // Lọc detections theo ngưỡng confidence tùy chỉnh của người dùng
      const rawDetections = payload.detections || [];
      const filteredDetections = rawDetections.filter(
        d => (d.confidence || 0) >= state.config.confidenceThreshold
      );

      state.detections = filteredDetections;
      state.floodDetected = filteredDetections.length > 0;
      state.floodStatus = state.floodDetected ? 'ngap_lut' : 'khong_ngap_lut';
      state.lastDetectionResult = payload;

      if (state.floodDetected) {
        state.floodFramesCount++;
        playAlertSound();
        recordIncidentSnapshot(payload);
      }

      // Render lại giao diện & HUD
      renderHUD(payload.metadata);
      updateTelemetryUI();
      updateBannerUI();
      drawSparkline();
    } catch (err) {
      console.error('Failed to parse server message:', err);
    } finally {
      isSendingFrame = false; // Cho phép gửi frame tiếp theo
    }
  }

  // ==============================================================================
  // GỬI KHUNG HÌNH (FRAME CAPTURE & DISPATCH TO WEBSOCKET)
  // ==============================================================================
  const offscreenCanvas = document.createElement('canvas');
  const offscreenCtx = offscreenCanvas.getContext('2d');

  function sendCurrentFrame() {
    if (!state.ws || state.ws.readyState !== WebSocket.OPEN) return;
    if (isSendingFrame) return; // Backpressure: đợi server trả frame trước

    let sourceEl = null;
    let srcW = 0, srcH = 0;

    if (state.activeTab === 'camera' || state.activeTab === 'video') {
      sourceEl = el.videoElement;
      srcW = sourceEl.videoWidth;
      srcH = sourceEl.videoHeight;
      if (!srcW || !srcH || sourceEl.paused || sourceEl.ended) return;
    } else if (state.activeTab === 'image' || state.activeTab === 'samples') {
      sourceEl = el.previewImage;
      srcW = sourceEl.naturalWidth;
      srcH = sourceEl.naturalHeight;
      if (!srcW || !srcH) return;
    }

    if (!sourceEl || srcW === 0 || srcH === 0) return;

    // Giữ nguyên độ phân giải hoặc downscale vừa phải (max 1280px) để tối ưu băng thông
    const maxDimension = 1280;
    let targetW = srcW;
    let targetH = srcH;
    if (targetW > maxDimension || targetH > maxDimension) {
      const scale = Math.min(maxDimension / targetW, maxDimension / targetH);
      targetW = Math.round(targetW * scale);
      targetH = Math.round(targetH * scale);
    }

    offscreenCanvas.width = targetW;
    offscreenCanvas.height = targetH;
    offscreenCtx.drawImage(sourceEl, 0, 0, targetW, targetH);

    isSendingFrame = true;

    // Nén JPEG 0.78 chất lượng cao, gửi dạng Binary ArrayBuffer / Blob
    offscreenCanvas.toBlob((blob) => {
      if (!blob) {
        isSendingFrame = false;
        return;
      }
      try {
        state.ws.send(blob);
      } catch (err) {
        console.warn('Failed to send frame blob:', err);
        isSendingFrame = false;
      }
    }, 'image/jpeg', 0.78);

    // Tính client render FPS
    clientFpsCounter++;
    const now = performance.now();
    if (now - lastClientFpsCheck >= 1000) {
      state.clientFps = clientFpsCounter;
      clientFpsCounter = 0;
      lastClientFpsCheck = now;
    }
  }

  function startFrameLoop() {
    stopFrameLoop();
    const intervalMs = Math.round(1000 / state.config.fpsLimit);
    streamInterval = setInterval(() => {
      sendCurrentFrame();
    }, intervalMs);
  }

  function stopFrameLoop() {
    if (streamInterval) {
      clearInterval(streamInterval);
      streamInterval = null;
    }
    isSendingFrame = false;
  }

  // ==============================================================================
  // VẼ HUD OVERLAY & BOUNDING BOX TRÊN CANVAS
  // ==============================================================================
  function renderHUD(metadata) {
    const canvas = el.hudCanvas;
    const ctx = canvas.getContext('2d');

    // Đồng bộ kích thước canvas với viewport stage
    const rect = el.viewportStage.getBoundingClientRect();
    if (canvas.width !== rect.width || canvas.height !== rect.height) {
      canvas.width = rect.width;
      canvas.height = rect.height;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let srcW = 0, srcH = 0;
    if (state.activeTab === 'camera' || state.activeTab === 'video') {
      srcW = el.videoElement.videoWidth;
      srcH = el.videoElement.videoHeight;
    } else {
      srcW = el.previewImage.naturalWidth;
      srcH = el.previewImage.naturalHeight;
    }

    if (!srcW || !srcH) return;

    // Tính toán kích thước hiển thị thực tế (object-fit: contain)
    const containerAspect = canvas.width / canvas.height;
    const mediaAspect = srcW / srcH;
    let renderW = canvas.width;
    let renderH = canvas.height;
    let offsetX = 0;
    let offsetY = 0;

    if (containerAspect > mediaAspect) {
      renderW = canvas.height * mediaAspect;
      renderH = canvas.height;
      offsetX = (canvas.width - renderW) / 2;
    } else {
      renderW = canvas.width;
      renderH = canvas.width / mediaAspect;
      offsetY = (canvas.height - renderH) / 2;
    }

    const scaleX = renderW / srcW;
    const scaleY = renderH / srcH;

    // Vẽ tâm ngắm công nghệ cao (Crosshairs) nếu bật
    if (state.config.showCrosshair && state.floodDetected) {
      ctx.save();
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.3)';
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 6]);
      // Trục ngang và dọc tâm màn hình
      const centerX = offsetX + renderW / 2;
      const centerY = offsetY + renderH / 2;
      ctx.beginPath();
      ctx.moveTo(offsetX, centerY);
      ctx.lineTo(offsetX + renderW, centerY);
      ctx.moveTo(centerX, offsetY);
      ctx.lineTo(centerX, offsetY + renderH);
      ctx.stroke();
      ctx.restore();
    }

    // Vẽ từng Bounding Box
    if (state.config.showBbox && state.detections.length > 0) {
      state.detections.forEach((det, idx) => {
        const bbox = det.bbox;
        const x1 = Math.round(bbox.x_min * scaleX + offsetX);
        const y1 = Math.round(bbox.y_min * scaleY + offsetY);
        const x2 = Math.round(bbox.x_max * scaleX + offsetX);
        const y2 = Math.round(bbox.y_max * scaleY + offsetY);

        const width = x2 - x1;
        const height = y2 - y1;
        if (width <= 0 || height <= 0) return;

        // Vùng phủ bán trong suốt màu đỏ cảnh báo ngập
        ctx.fillStyle = 'rgba(239, 68, 68, 0.22)';
        ctx.fillRect(x1, y1, width, height);

        // Viền chính
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2;
        ctx.shadowColor = 'rgba(239, 68, 68, 0.8)';
        ctx.shadowBlur = 10;
        ctx.strokeRect(x1, y1, width, height);
        ctx.shadowBlur = 0; // reset shadow

        // 4 góc viền dày phong cách quân sự HUD (Bracket Corners)
        const cornerLen = Math.min(20, width / 4, height / 4);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        // Góc trên-trái
        ctx.moveTo(x1, y1 + cornerLen); ctx.lineTo(x1, y1); ctx.lineTo(x1 + cornerLen, y1);
        // Góc trên-phải
        ctx.moveTo(x2 - cornerLen, y1); ctx.lineTo(x2, y1); ctx.lineTo(x2, y1 + cornerLen);
        // Góc dưới-trái
        ctx.moveTo(x1, y2 - cornerLen); ctx.lineTo(x1, y2); ctx.lineTo(x1 + cornerLen, y2);
        // Góc dưới-phải
        ctx.moveTo(x2 - cornerLen, y2); ctx.lineTo(x2, y2); ctx.lineTo(x2, y2 - cornerLen);
        ctx.stroke();

        // Nhãn phân loại & Confidence
        if (state.config.showLabels) {
          const confPercent = Math.round((det.confidence || 0) * 100);
          const labelText = `NGẬP LỤT #${idx + 1} • ${confPercent}%`;

          ctx.font = 'bold 12px "JetBrains Mono", Consolas, sans-serif';
          const textMetrics = ctx.measureText(labelText);
          const textW = textMetrics.width + 16;
          const textH = 22;

          let labelY = y1 - textH - 4;
          if (labelY < offsetY) labelY = y1 + 4;

          // Nền nhãn đỏ nổi bật
          ctx.fillStyle = '#ef4444';
          ctx.beginPath();
          ctx.roundRect(x1, labelY, textW, textH, 4);
          ctx.fill();

          // Chữ nhãn
          ctx.fillStyle = '#ffffff';
          ctx.textBaseline = 'middle';
          ctx.fillText(labelText, x1 + 8, labelY + textH / 2);
        }
      });
    }
  }

  // ==============================================================================
  // THU NHẬP ẢNH SNAPSHOT LỊCH SỬ SỰ CỐ (INCIDENT LOG)
  // ==============================================================================
  function recordIncidentSnapshot(payload) {
    const now = Date.now();
    // Giới hạn ghi lại sự cố: cách nhau ít nhất 3.5 giây để tránh spam
    if (now - state.lastIncidentTime < 3500) return;
    state.lastIncidentTime = now;

    // Chụp lại khung hình canvas hiện tại kèm bounding box
    const thumbCanvas = document.createElement('canvas');
    const thumbCtx = thumbCanvas.getContext('2d');
    thumbCanvas.width = 320;
    thumbCanvas.height = 180;

    let sourceEl = null;
    if (state.activeTab === 'camera' || state.activeTab === 'video') {
      sourceEl = el.videoElement;
    } else {
      sourceEl = el.previewImage;
    }

    if (sourceEl) {
      thumbCtx.drawImage(sourceEl, 0, 0, thumbCanvas.width, thumbCanvas.height);
      // Vẽ HUD canvas đè lên thumbnail
      thumbCtx.drawImage(el.hudCanvas, 0, 0, thumbCanvas.width, thumbCanvas.height);
    }

    const dataUrl = thumbCanvas.toDataURL('image/jpeg', 0.7);

    const maxConfidence = Math.max(...state.detections.map(d => d.confidence || 0));
    const incident = {
      id: `INC-${Date.now().toString().slice(-6)}`,
      timestamp: new Date().toLocaleTimeString('vi-VN'),
      date: new Date().toLocaleDateString('vi-VN'),
      count: state.detections.length,
      maxConf: Math.round(maxConfidence * 100),
      latency: state.currentLatency,
      thumb: dataUrl,
      source: state.activeTab.toUpperCase()
    };

    state.incidents.unshift(incident);
    if (state.incidents.length > 25) state.incidents.pop(); // Giữ tối đa 25 sự cố gần nhất
    renderIncidentList();
  }

  function renderIncidentList() {
    if (!el.incidentList) return;
    if (state.incidents.length === 0) {
      el.incidentList.innerHTML = `<div class="empty-log">Chưa ghi nhận sự cố ngập lụt nào trong phiên này.</div>`;
      return;
    }

    el.incidentList.innerHTML = state.incidents.map(inc => `
      <div class="incident-item" data-id="${inc.id}">
        <img src="${inc.thumb}" alt="Snapshot" class="incident-thumb" />
        <div class="incident-details">
          <div class="incident-title">🚨 ${inc.id} (${inc.count} vùng ngập)</div>
          <div class="incident-meta">
            <span>🕒 ${inc.timestamp}</span>
            <span>🎯 ${inc.maxConf}%</span>
            <span>⚡ ${inc.latency}ms</span>
          </div>
        </div>
      </div>
    `).join('');

    // Gắn sự kiện click xem snapshot phóng to
    el.incidentList.querySelectorAll('.incident-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = item.getAttribute('data-id');
        const inc = state.incidents.find(x => x.id === id);
        if (inc) openSnapshotModal(inc);
      });
    });
  }

  function openSnapshotModal(incident) {
    state.currentSnapshotData = incident;
    el.snapshotModalImg.src = incident.thumb;
    el.snapshotModalMeta.innerHTML = `
      <strong>Mã sự cố:</strong> ${incident.id} | 
      <strong>Thời gian:</strong> ${incident.timestamp} ${incident.date} | 
      <strong>Số vùng ngập:</strong> ${incident.count} | 
      <strong>Độ tin cậy cao nhất:</strong> ${incident.maxConf}% | 
      <strong>Nguồn:</strong> ${incident.source}
    `;
    el.snapshotModal.classList.add('open');
  }

  // ==============================================================================
  // VẼ BIỂU ĐỒ MINI SPARKLINE CHO LATENCY
  // ==============================================================================
  function drawSparkline() {
    const canvas = el.sparklineCanvas;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    const data = state.latencyHistory;
    if (data.length < 2) return;

    const maxVal = Math.max(...data, 80); // Tối thiểu scale 80ms
    const minVal = 0;
    const stepX = width / (data.length - 1);

    // Vẽ đường line
    ctx.beginPath();
    data.forEach((val, i) => {
      const x = i * stepX;
      const y = height - ((val - minVal) / (maxVal - minVal)) * (height - 10) - 5;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });

    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Tô gradient dưới đường biểu đồ
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, 'rgba(6, 182, 212, 0.35)');
    grad.addColorStop(1, 'rgba(6, 182, 212, 0.0)');
    ctx.fillStyle = grad;
    ctx.fill();
  }

  // ==============================================================================
  // CẬP NHẬT GIAO DIỆN CHỈ SỐ & TRẠNG THÁI (UI UPDATE)
  // ==============================================================================
  function updateStatusUI() {
    if (state.wsConnected) {
      el.statusDot.className = 'status-dot online';
      el.statusText.textContent = 'Server Online (Real-time)';
      el.btnToggleConnect.innerHTML = `<span>Ngắt kết nối</span>`;
      el.btnToggleConnect.className = 'btn btn-secondary';
    } else if (state.wsConnecting) {
      el.statusDot.className = 'status-dot connecting';
      el.statusText.textContent = 'Đang kết nối WebSocket...';
      el.btnToggleConnect.innerHTML = `<span>Đang kết nối...</span>`;
      el.btnToggleConnect.className = 'btn btn-secondary';
    } else {
      el.statusDot.className = 'status-dot offline';
      el.statusText.textContent = 'Server Offline (Mất kết nối)';
      el.btnToggleConnect.innerHTML = `<span>Kết nối lại</span>`;
      el.btnToggleConnect.className = 'btn btn-primary';
    }

    if (state.serverHealth.modelLoaded) {
      const provider = state.serverHealth.providers.includes('CUDAExecutionProvider') ? 'GPU (CUDA)' : 'CPU';
      el.modelStatusBadge.textContent = `RT-DETR • ${provider}`;
      el.modelStatusBadge.className = 'badge-tech text-cyan';
    } else {
      el.modelStatusBadge.textContent = `Chờ nạp Model .ONNX`;
      el.modelStatusBadge.className = 'badge-tech text-warning';
    }
  }

  function updateBannerUI() {
    if (!state.isStreaming && state.activeTab === 'camera') {
      el.alertBanner.className = 'alert-banner idle';
      el.alertBannerTitle.textContent = 'HỆ THỐNG ĐANG CHỜ KHỞI CHẠY';
      el.alertBannerSubtitle.textContent = 'Nhấn "Bật Camera" hoặc chọn Video/Ảnh để bắt đầu giám sát thời gian thực.';
      el.viewportCard.classList.remove('alert-mode');
      return;
    }

    if (state.floodDetected) {
      el.alertBanner.className = 'alert-banner danger';
      el.alertBannerTitle.textContent = `⚠️ CẢNH BÁO: PHÁT HIỆN ${state.detections.length} VÙNG NGẬP LỤT NGUY HIỂM!`;
      el.alertBannerSubtitle.textContent = `Mặt đường có dấu hiệu ngập sâu, phương tiện di chuyển có nguy cơ chết máy hoặc tai nạn.`;
      el.viewportCard.classList.add('alert-mode');
    } else {
      el.alertBanner.className = 'alert-banner safe';
      el.alertBannerTitle.textContent = '🛡️ MẶT ĐƯỜNG AN TOÀN - KHÔNG PHÁT HIỆN NGẬP';
      el.alertBannerSubtitle.textContent = 'Tuyến đường khô ráo hoặc ướt mưa nhẹ, giao thông lưu thông bình thường.';
      el.viewportCard.classList.remove('alert-mode');
    }
  }

  function updateTelemetryUI() {
    el.telemetryFps.textContent = `${state.clientFps || state.currentFps} FPS`;
    el.telemetryLatency.textContent = `${state.currentLatency} ms`;
    el.telemetryCount.textContent = state.detections.length;

    if (state.detections.length > 0) {
      const maxConf = Math.round(Math.max(...state.detections.map(d => d.confidence || 0)) * 100);
      el.telemetryMaxConf.textContent = `${maxConf}%`;

      // Ước lượng tỷ lệ diện tích ngập
      let totalBboxArea = 0;
      let totalImgArea = (state.lastDetectionResult?.metadata?.frame_width || 640) *
                         (state.lastDetectionResult?.metadata?.frame_height || 640);

      state.detections.forEach(d => {
        const w = (d.bbox.x_max - d.bbox.x_min);
        const h = (d.bbox.y_max - d.bbox.y_min);
        totalBboxArea += Math.max(0, w * h);
      });

      const coverageRatio = Math.min(100, Math.round((totalBboxArea / totalImgArea) * 100));
      el.telemetryRatio.textContent = `${coverageRatio}%`;
    } else {
      el.telemetryMaxConf.textContent = '0%';
      el.telemetryRatio.textContent = '0%';
    }
  }

  // ==============================================================================
  // QUẢN LÝ NGUỒN DỮ LIỆU (CAMERA, VIDEO, IMAGE, SAMPLES)
  // ==============================================================================
  async function setupCameraList() {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(d => d.kind === 'videoinput');
      state.availableCameras = videoDevices;

      el.cameraSelect.innerHTML = videoDevices.map((d, i) => `
        <option value="${d.deviceId}">${d.label || `Camera ${i + 1}`}</option>
      `).join('');

      if (videoDevices.length > 0) {
        state.selectedCameraId = videoDevices[0].deviceId;
      }
    } catch (err) {
      console.warn('Cannot enumerate camera devices:', err);
    }
  }

  async function startCamera() {
    try {
      stopCamera();
      const constraints = {
        video: {
          deviceId: state.selectedCameraId ? { exact: state.selectedCameraId } : undefined,
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      state.cameraStream = stream;
      el.videoElement.srcObject = stream;
      el.videoElement.style.display = 'block';
      el.previewImage.style.display = 'none';
      el.emptyPlaceholder.style.display = 'none';
      el.hudLiveTag.style.display = 'inline-flex';

      await el.videoElement.play();
      state.isStreaming = true;

      el.btnStartCamera.style.display = 'none';
      el.btnStopCamera.style.display = 'inline-flex';

      startFrameLoop();
      updateBannerUI();
    } catch (err) {
      console.error('Cannot access camera:', err);
      alert('Không thể mở Camera. Vui lòng cấp quyền truy cập camera trên trình duyệt của bạn!');
    }
  }

  function stopCamera() {
    stopFrameLoop();
    if (state.cameraStream) {
      state.cameraStream.getTracks().forEach(t => t.stop());
      state.cameraStream = null;
    }
    if (el.videoElement) {
      el.videoElement.srcObject = null;
    }
    state.isStreaming = false;
    el.btnStartCamera.style.display = 'inline-flex';
    el.btnStopCamera.style.display = 'none';
    el.hudLiveTag.style.display = 'none';

    // Clear canvas
    const ctx = el.hudCanvas.getContext('2d');
    ctx.clearRect(0, 0, el.hudCanvas.width, el.hudCanvas.height);
    updateBannerUI();
  }

  function handleVideoFileUpload(file) {
    if (!file) return;
    stopCamera();
    stopFrameLoop();

    state.videoFile = file;
    const url = URL.createObjectURL(file);
    el.videoElement.srcObject = null;
    el.videoElement.src = url;
    el.videoElement.style.display = 'block';
    el.previewImage.style.display = 'none';
    el.emptyPlaceholder.style.display = 'none';
    el.hudLiveTag.style.display = 'inline-flex';

    el.videoElement.onloadedmetadata = () => {
      state.videoDuration = el.videoElement.duration;
      el.videoScrubber.max = Math.floor(state.videoDuration);
      el.videoScrubber.value = 0;
      updateVideoTimeDisplay();
      playVideo();
    };

    el.videoElement.ontimeupdate = () => {
      state.videoCurrentTime = el.videoElement.currentTime;
      el.videoScrubber.value = Math.floor(state.videoCurrentTime);
      updateVideoTimeDisplay();
    };

    el.videoElement.onended = () => {
      if (state.videoLoop) {
        el.videoElement.currentTime = 0;
        el.videoElement.play();
      } else {
        pauseVideo();
      }
    };
  }

  function playVideo() {
    el.videoElement.play();
    state.isVideoPlaying = true;
    el.btnPlayPauseVideo.innerHTML = `<span>Tạm dừng</span>`;
    startFrameLoop();
  }

  function pauseVideo() {
    el.videoElement.pause();
    state.isVideoPlaying = false;
    el.btnPlayPauseVideo.innerHTML = `<span>Phát Video</span>`;
    stopFrameLoop();
  }

  function updateVideoTimeDisplay() {
    const cur = formatTime(el.videoElement.currentTime);
    const dur = formatTime(state.videoDuration || 0);
    el.videoTimeDisplay.textContent = `${cur} / ${dur}`;
  }

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  function handleImageUpload(file) {
    if (!file) return;
    stopCamera();
    stopFrameLoop();

    const reader = new FileReader();
    reader.onload = (e) => {
      loadImageForAnalysis(e.target.result, file.name);
    };
    reader.readAsDataURL(file);
  }

  function loadImageForAnalysis(src, name = 'Image') {
    state.activeImageSrc = src;
    state.activeImageName = name;

    el.videoElement.style.display = 'none';
    el.previewImage.src = src;
    el.previewImage.style.display = 'block';
    el.emptyPlaceholder.style.display = 'none';
    el.hudLiveTag.style.display = 'none';

    el.previewImage.onload = () => {
      // Tự động phân tích ảnh sau khi nạp
      sendCurrentFrame();
    };
  }

  function setupSampleDataset() {
    const samples = window.SAMPLE_DATASETS || [];
    el.sampleGrid.innerHTML = samples.map((s, idx) => `
      <div class="sample-card ${idx === 0 ? 'active' : ''}" data-idx="${idx}">
        <img src="${s.image}" alt="${s.title}" />
        <div class="sample-label">${s.title}</div>
      </div>
    `).join('');

    el.sampleGrid.querySelectorAll('.sample-card').forEach(card => {
      card.addEventListener('click', () => {
        el.sampleGrid.querySelectorAll('.sample-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');

        const idx = parseInt(card.getAttribute('data-idx'), 10);
        const item = samples[idx];
        if (item) {
          loadImageForAnalysis(item.image, item.title);
        }
      });
    });
  }

  // ==============================================================================
  // TAB SWITCHING
  // ==============================================================================
  function switchTab(tabId) {
    state.activeTab = tabId;
    el.sourceTabs.forEach(t => {
      if (t.getAttribute('data-tab') === tabId) t.classList.add('active');
      else t.classList.remove('active');
    });

    // Ẩn toàn bộ controls phụ
    el.cameraControls.style.display = 'none';
    el.videoControls.style.display = 'none';
    el.imageControls.style.display = 'none';
    el.sampleControls.style.display = 'none';

    stopCamera();
    pauseVideo();
    stopFrameLoop();

    if (tabId === 'camera') {
      el.cameraControls.style.display = 'flex';
      el.emptyPlaceholder.style.display = 'flex';
      el.videoElement.style.display = 'none';
      el.previewImage.style.display = 'none';
      setupCameraList();
    } else if (tabId === 'video') {
      el.videoControls.style.display = 'flex';
      if (state.videoFile) {
        el.videoElement.style.display = 'block';
        el.emptyPlaceholder.style.display = 'none';
      } else {
        el.emptyPlaceholder.style.display = 'flex';
        el.videoElement.style.display = 'none';
      }
    } else if (tabId === 'image') {
      el.imageControls.style.display = 'flex';
      if (state.activeImageSrc) {
        el.previewImage.style.display = 'block';
        el.emptyPlaceholder.style.display = 'none';
      } else {
        el.emptyPlaceholder.style.display = 'flex';
        el.previewImage.style.display = 'none';
      }
    } else if (tabId === 'samples') {
      el.sampleControls.style.display = 'block';
      setupSampleDataset();
      const firstSample = (window.SAMPLE_DATASETS || [])[0];
      if (firstSample) {
        loadImageForAnalysis(firstSample.image, firstSample.title);
      }
    }
  }

  // ==============================================================================
  // EXPORT INCIDENT LOGS TO CSV
  // ==============================================================================
  function exportLogsToCSV() {
    if (state.incidents.length === 0) {
      alert('Không có dữ liệu nhật ký sự cố để xuất file!');
      return;
    }

    const headers = ['Mã Sự Cố', 'Ngày', 'Giờ', 'Số Vùng Ngập', 'Độ Tin Cậy Tối Đa (%)', 'Độ Trễ (ms)', 'Nguồn'];
    const rows = state.incidents.map(inc => [
      inc.id,
      inc.date,
      inc.timestamp,
      inc.count,
      `${inc.maxConf}%`,
      `${inc.latency}ms`,
      inc.source
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map(e => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `aqua_guard_incidents_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // ==============================================================================
  // EVENT LISTENERS & KHỞI TẠO
  // ==============================================================================
  function bindEvents() {
    // Header
    el.btnToggleConnect.addEventListener('click', () => {
      if (state.wsConnected || state.wsConnecting) disconnectWebSocket();
      else connectWebSocket();
    });

    el.btnOpenSettings.addEventListener('click', () => {
      el.inputWsUrl.value = state.config.wsUrl;
      el.inputFps.value = state.config.fpsLimit;
      el.inputConfidence.value = state.config.confidenceThreshold;
      el.valConfidence.textContent = `${Math.round(state.config.confidenceThreshold * 100)}%`;
      el.checkSound.checked = state.config.soundAlert;
      el.checkShowBbox.checked = state.config.showBbox;
      el.checkShowLabels.checked = state.config.showLabels;
      el.settingsModal.classList.add('open');
    });

    el.btnCloseSettings.addEventListener('click', () => {
      el.settingsModal.classList.remove('open');
    });

    el.btnSaveSettings.addEventListener('click', () => {
      const oldWsUrl = state.config.wsUrl;
      state.config.wsUrl = el.inputWsUrl.value.trim();
      state.config.fpsLimit = parseInt(el.inputFps.value, 10) || 15;
      state.config.confidenceThreshold = parseFloat(el.inputConfidence.value) || 0.45;
      state.config.soundAlert = el.checkSound.checked;
      state.config.showBbox = el.checkShowBbox.checked;
      state.config.showLabels = el.checkShowLabels.checked;

      el.settingsModal.classList.remove('open');

      // Nếu đổi WebSocket URL thì kết nối lại
      if (oldWsUrl !== state.config.wsUrl) {
        disconnectWebSocket();
        connectWebSocket();
      }

      // Cập nhật lại chu kỳ gửi frame
      if (streamInterval) startFrameLoop();
    });

    el.inputConfidence.addEventListener('input', (e) => {
      el.valConfidence.textContent = `${Math.round(parseFloat(e.target.value) * 100)}%`;
    });

    // Sound toggle
    el.btnToggleSound.addEventListener('click', () => {
      state.config.soundAlert = !state.config.soundAlert;
      el.soundIcon.textContent = state.config.soundAlert ? '🔊' : '🔇';
      el.btnToggleSound.classList.toggle('active', state.config.soundAlert);
    });

    // Tabs
    el.sourceTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const tabId = tab.getAttribute('data-tab');
        switchTab(tabId);
      });
    });

    // Camera
    el.btnStartCamera.addEventListener('click', startCamera);
    el.btnStopCamera.addEventListener('click', stopCamera);
    el.cameraSelect.addEventListener('change', (e) => {
      state.selectedCameraId = e.target.value;
      if (state.isStreaming) startCamera();
    });

    // Video
    el.btnSelectVideo.addEventListener('click', () => el.videoFileInput.click());
    el.videoFileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        handleVideoFileUpload(e.target.files[0]);
      }
    });

    el.btnPlayPauseVideo.addEventListener('click', () => {
      if (state.isVideoPlaying) pauseVideo();
      else playVideo();
    });

    el.videoScrubber.addEventListener('input', (e) => {
      el.videoElement.currentTime = e.target.value;
    });

    el.videoSpeedSelect.addEventListener('change', (e) => {
      el.videoElement.playbackRate = parseFloat(e.target.value);
    });

    el.videoLoopToggle.addEventListener('change', (e) => {
      state.videoLoop = e.target.checked;
    });

    // Image
    el.btnSelectImage.addEventListener('click', () => el.imageFileInput.click());
    el.imageFileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        handleImageUpload(e.target.files[0]);
      }
    });

    el.btnAnalyzeImage.addEventListener('click', () => {
      sendCurrentFrame();
    });

    // Snapshot Capture
    el.btnCaptureSnapshot.addEventListener('click', () => {
      recordIncidentSnapshot(state.lastDetectionResult || {});
      const latest = state.incidents[0];
      if (latest) openSnapshotModal(latest);
    });

    // Snapshot Modal
    el.btnCloseSnapshot.addEventListener('click', () => {
      el.snapshotModal.classList.remove('open');
    });

    el.btnDownloadSnapshot.addEventListener('click', () => {
      if (!state.currentSnapshotData) return;
      const link = document.createElement('a');
      link.download = `flood_snapshot_${state.currentSnapshotData.id}.jpg`;
      link.href = state.currentSnapshotData.thumb;
      link.click();
    });

    // Log Controls
    el.btnClearLogs.addEventListener('click', () => {
      state.incidents = [];
      renderIncidentList();
    });

    el.btnExportLogs.addEventListener('click', exportLogsToCSV);

    // Kéo thả file ảnh hoặc video vào viewport
    el.viewportStage.addEventListener('dragover', (e) => {
      e.preventDefault();
      el.viewportStage.style.borderColor = '#06b6d4';
    });
    el.viewportStage.addEventListener('dragleave', () => {
      el.viewportStage.style.borderColor = '';
    });
    el.viewportStage.addEventListener('drop', (e) => {
      e.preventDefault();
      el.viewportStage.style.borderColor = '';
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        if (file.type.startsWith('video/')) {
          switchTab('video');
          handleVideoFileUpload(file);
        } else if (file.type.startsWith('image/')) {
          switchTab('image');
          handleImageUpload(file);
        }
      }
    });

    // Window Resize -> căn chỉnh canvas
    window.addEventListener('resize', () => {
      renderHUD(state.lastDetectionResult?.metadata);
    });
  }

  // Khởi chạy ứng dụng
  document.addEventListener('DOMContentLoaded', () => {
    initElements();
    bindEvents();
    renderIncidentList();
    connectWebSocket();
    setupCameraList();

    // Định kỳ ping health check server mỗi 6 giây
    setInterval(checkServerHealth, 6000);
  });

})();
