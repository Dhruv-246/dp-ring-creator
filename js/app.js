import * as Ring from './ring-render.js?v=6';

/* ---------------- static config (ported from the design) ---------------- */

const STEP_META = [
  { n: 1, label: 'Upload' },
  { n: 2, label: 'Style' },
  { n: 3, label: 'Done' },
];

const HOW_IT_WORKS = [
  { title: 'Upload a photo', desc: 'Any clear, front-facing photo works.', icon: 'upload', img: 'assets/how-it-works-1-upload.jpeg' },
  { title: 'Pick your ring', desc: 'Choose a color and set the thickness.', icon: 'ring', img: 'assets/how-it-works-2-ring.jpeg' },
  { title: 'Share it everywhere', desc: 'Download and set it as your profile picture.', icon: 'share', img: 'assets/how-it-works-3-share.png' },
];

const STYLE_ORDER = [
  { key: 'classic', label: 'Classic' },
  { key: 'bold', label: 'Bold' },
];

const HOW_ICONS = {
  upload: '<path d="M12 16V4M12 4l-5 5M12 4l5 5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
  ring: '<circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="1.7"/>',
  share: '<path d="M4 12v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 6l-4-4-4 4M12 2v13" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
};

const DEFAULT_PRESET = 'bold';

/* ---------------- component ---------------- */

class Creator {
  constructor(root) {
    this.root = root;
    this.state = {
      isCreatorOpen: false,
      step: 1,
      uploadedSrc: null,
      adjust: { ox: 0, oy: 0, scale: 1, rot: 0 },
      isDraggingFile: false,
      preset: DEFAULT_PRESET,
      errorMsg: null,
      cameraOpen: false,
      cameraError: null,
      facingMode: 'user',
    };
    // non-render refs / images
    this.uploadedImgEl = null;
    this.originalImgEl = null;
    this.croppedImgEl = null;
    this.previewCanvasEl = null;
    this.fileInputEl = null;
    this.cropImgEl = null;
    this.stream = null;
    this.videoEl = null;
    this.panStart = null;
    this.touchState = null;
    this._justOpened = false;
    // step-1 crop tool state
    this.crop = { rot90: 0, freeRot: 0, box: null };
    this.cropDrag = null;
    this.cropTwo = null;

    this.onWindowMouseMove = this.onWindowMouseMove.bind(this);
    this.onWindowMouseUp = this.onWindowMouseUp.bind(this);
    this.onCropDocMove = this.onCropDocMove.bind(this);
    this.onCropDocUp = this.onCropDocUp.bind(this);
    window.addEventListener('mousemove', this.onWindowMouseMove);
    window.addEventListener('mouseup', this.onWindowMouseUp);
    window.addEventListener('pointermove', this.onCropDocMove);
    window.addEventListener('pointerup', this.onCropDocUp);
  }

  setState(patch) {
    const next = typeof patch === 'function' ? patch(this.state) : patch;
    this.state = { ...this.state, ...next };
    this.render();
  }

  /* --- flow --- */
  open = () => { document.body.style.overflow = 'hidden'; this._justOpened = true; this.setState({ isCreatorOpen: true, step: 1 }); };
  close = () => {
    document.body.style.overflow = '';
    this.uploadedImgEl = null;
    this.originalImgEl = null;
    this.croppedImgEl = null;
    this.crop = { rot90: 0, freeRot: 0, box: null };
    this.stopCameraStream();
    this.setState({ isCreatorOpen: false, step: 1, uploadedSrc: null, croppedReady: false, adjust: { ox: 0, oy: 0, scale: 1, rot: 0 }, errorMsg: null, cameraOpen: false, cameraError: null });
  };
  goNext = () => this.setState((s) => ({ step: Math.min(3, s.step + 1) }));
  goBack = () => this.setState((s) => ({ step: Math.max(1, s.step - 1) }));

  /* --- upload --- */
  handleFile = (file) => {
    if (!file) return;
    if (!file.type || !file.type.startsWith('image/')) {
      this.setState({ errorMsg: "That doesn't look like an image — try a JPG or PNG." });
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      this.setState({ errorMsg: 'That photo is a little too large — try one under 12MB.' });
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target.result;
      const img = new Image();
      img.onload = () => {
        this.originalImgEl = img;                          // kept intact for re-cropping on "Back"
        this.uploadedImgEl = img;
        this.crop = { rot90: 0, freeRot: 0, box: null };   // fresh crop for the new photo
        this.setState({ uploadedSrc: src, errorMsg: null, adjust: { ox: 0, oy: 0, scale: 1, rot: 0 } });
      };
      img.onerror = () => this.setState({ errorMsg: "We couldn't read that photo — please try another." });
      img.src = src;
    };
    reader.onerror = () => this.setState({ errorMsg: "We couldn't read that photo — please try another." });
    reader.readAsDataURL(file);
  };
  onFileSelected = (e) => { const f = e.target.files && e.target.files[0]; this.handleFile(f); e.target.value = ''; };
  onDrop = (e) => { e.preventDefault(); this.setState({ isDraggingFile: false }); const f = e.dataTransfer.files && e.dataTransfer.files[0]; this.handleFile(f); };
  onDragOver = (e) => { e.preventDefault(); if (!this.state.isDraggingFile) this.setState({ isDraggingFile: true }); };
  onDragLeave = (e) => { e.preventDefault(); this.setState({ isDraggingFile: false }); };
  triggerFilePicker = () => { if (this.fileInputEl) this.fileInputEl.click(); };
  clearUpload = () => { this.uploadedImgEl = null; this.originalImgEl = null; this.crop = { rot90: 0, freeRot: 0, box: null }; this.setState({ uploadedSrc: null, errorMsg: null }); };

  /* --- camera capture --- */
  attachStream() {
    if (this.videoEl && this.stream) {
      this.videoEl.srcObject = this.stream;
      this.videoEl.play().catch(() => {});
    }
  }
  stopCameraStream() {
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    if (this.videoEl) this.videoEl.srcObject = null;
  }
  openCamera = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.setState({ cameraError: 'Camera isn’t available on this device or browser. Try “Choose a Photo” instead.' });
      return;
    }
    this.stopCameraStream();
    this.setState({ cameraError: null, cameraOpen: true, errorMsg: null });
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: this.state.facingMode }, audio: false });
      if (!this.state.cameraOpen) { stream.getTracks().forEach((t) => t.stop()); return; } // cancelled while awaiting
      this.stream = stream;
      this.attachStream();
    } catch (e) {
      const denied = e && (e.name === 'NotAllowedError' || e.name === 'SecurityError');
      this.setState({
        cameraOpen: false,
        cameraError: denied
          ? 'Camera access was blocked. Allow camera permission, or use “Choose a Photo”.'
          : 'We couldn’t start the camera. Use “Choose a Photo” instead.',
      });
    }
  };
  stopCamera = () => { this.stopCameraStream(); this.setState({ cameraOpen: false, cameraError: null }); };
  flipCamera = () => {
    const next = this.state.facingMode === 'user' ? 'environment' : 'user';
    this.state.facingMode = next;
    this.openCamera();
  };
  capturePhoto = () => {
    const v = this.videoEl;
    if (!v || !v.videoWidth || !v.videoHeight) return;
    const w = v.videoWidth, h = v.videoHeight;
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    // Mirror the front-camera capture so the saved photo matches the on-screen preview.
    if (this.state.facingMode === 'user') { ctx.translate(w, 0); ctx.scale(-1, 1); }
    ctx.drawImage(v, 0, 0, w, h);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], 'camera-photo.png', { type: 'image/png' });
      this.stopCameraStream();
      this.state.cameraOpen = false; // handleFile will trigger the re-render with the preview
      this.handleFile(file);
    }, 'image/png');
  };

  /* --- live adjust inside the ring: pan / pinch-zoom / two-finger rotate --- */
  clampScale = (s) => Math.min(4, Math.max(1, s));
  dispW = () => (this.adjustCanvasEl ? this.adjustCanvasEl.getBoundingClientRect().width : 320);

  // Step-2 ring preview live re-render (step 1 uses the crop tool instead).
  adjustRender() {
    if (this.state.step !== 1) this.renderPreviewCanvas();
  }

  // Mouse (desktop): drag to pan, wheel to zoom.
  onCropPointerDown = (e) => { this.panStart = { x: e.clientX, y: e.clientY, ox: this.state.adjust.ox, oy: this.state.adjust.oy }; };
  onWindowMouseMove(e) {
    if (!this.panStart) return;
    const w = this.dispW();
    this.state.adjust.ox = this.panStart.ox + (e.clientX - this.panStart.x) / w;
    this.state.adjust.oy = this.panStart.oy + (e.clientY - this.panStart.y) / w;
    this.adjustRender();
  }
  onWindowMouseUp() { this.panStart = null; }
  onCropWheel = (e) => {
    e.preventDefault();
    this.state.adjust.scale = this.clampScale(this.state.adjust.scale - e.deltaY * 0.0015);
    this.adjustRender();
  };
  resetCrop = () => {
    if (this.state.step === 1) {
      this.crop.rot90 = 0; this.crop.freeRot = 0;
      this.computeImgFit(); this.resetCropBox(); this.drawCropStage(); this.positionCropBox();
    } else {
      this.state.adjust = { ox: 0, oy: 0, scale: 1, rot: 0 }; this.adjustRender();
    }
  };

  // Touch: 1 finger pans, 2 fingers pinch-zoom AND twist-rotate together.
  touchDist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  touchAngle = (t) => Math.atan2(t[1].clientY - t[0].clientY, t[1].clientX - t[0].clientX);
  onCropTouchStart = (e) => {
    const a = this.state.adjust;
    if (e.touches.length >= 2) this.touchState = { mode: 'multi', dist: this.touchDist(e.touches), ang: this.touchAngle(e.touches), scale: a.scale, rot: a.rot };
    else if (e.touches.length === 1) { const t = e.touches[0]; this.touchState = { mode: 'pan', x: t.clientX, y: t.clientY, ox: a.ox, oy: a.oy }; }
  };
  onCropTouchMove = (e) => {
    e.preventDefault();
    if (!this.touchState) return;
    const a = this.state.adjust;
    if (this.touchState.mode === 'multi' && e.touches.length >= 2) {
      a.scale = this.clampScale(this.touchState.scale * (this.touchDist(e.touches) / this.touchState.dist));
      a.rot = this.touchState.rot + (this.touchAngle(e.touches) - this.touchState.ang);
      this.adjustRender();
    } else if (this.touchState.mode === 'pan' && e.touches.length === 1) {
      const t = e.touches[0], w = this.dispW();
      a.ox = this.touchState.ox + (t.clientX - this.touchState.x) / w;
      a.oy = this.touchState.oy + (t.clientY - this.touchState.y) / w;
      this.adjustRender();
    }
  };
  onCropTouchEnd = (e) => {
    // One finger lifted mid-gesture → continue panning with the finger that remains.
    if (e.touches && e.touches.length === 1) {
      const t = e.touches[0], a = this.state.adjust;
      this.touchState = { mode: 'pan', x: t.clientX, y: t.clientY, ox: a.ox, oy: a.oy };
    } else {
      this.touchState = null;
    }
  };

  /* --- ring choice --- */
  selectPreset = (key) => this.setState({ preset: key });

  renderPreviewCanvas = () => {
    if (!this.previewCanvasEl) return;
    Ring.renderKamyaRing(this.previewCanvasEl, {
      size: 1024,
      styleKey: this.state.preset,
      img: this.uploadedImgEl || null,
      transform: this.state.adjust,
      silhouette: { bg: '#F3E7DD', fg: '#DCB492', bust: 1 },
    });
  };

  /* ============ step 1: adjustable square crop frame ============
     Full image on a dark stage; a movable + resizable square selection with
     corner handles and a rule-of-thirds grid. 90° button + two-finger rotate. */
  stageCoords(clientX, clientY) {
    const r = this.cropStageEl.getBoundingClientRect();
    return { x: clientX - r.left, y: clientY - r.top };
  }
  computeImgFit() {
    const img = this.originalImgEl, c = this.crop;
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
    const th = c.rot90 * Math.PI / 2 + c.freeRot;
    const cos = Math.abs(Math.cos(th)), sin = Math.abs(Math.sin(th));
    const bw = iw * cos + ih * sin, bh = iw * sin + ih * cos; // rotated bounding box
    c.fit = Math.min(c.vw / bw, c.vh / bh);                   // contain (whole image visible)
    c.imgBoxW = bw * c.fit;
    c.imgBoxH = bh * c.fit;
  }
  cropBounds() {
    const c = this.crop;
    const axMin = Math.max(0, (c.vw - c.imgBoxW) / 2), axMax = Math.min(c.vw, (c.vw + c.imgBoxW) / 2);
    const ayMin = Math.max(0, (c.vh - c.imgBoxH) / 2), ayMax = Math.min(c.vh, (c.vh + c.imgBoxH) / 2);
    return { axMin, axMax, ayMin, ayMax, maxS: Math.max(56, Math.min(axMax - axMin, ayMax - ayMin)) };
  }
  clampCropBox() {
    const c = this.crop, b = this.cropBounds();
    c.box.s = Math.max(56, Math.min(c.box.s, b.maxS));
    c.box.x = Math.max(b.axMin, Math.min(c.box.x, b.axMax - c.box.s));
    c.box.y = Math.max(b.ayMin, Math.min(c.box.y, b.ayMax - c.box.s));
  }
  resetCropBox() {
    const c = this.crop, b = this.cropBounds();
    const s = b.maxS * 0.9;
    c.box = { s, x: (c.vw - s) / 2, y: (c.vh - s) / 2 };
    this.clampCropBox();
  }
  // Coalesce move/resize/rotate redraws to one per animation frame.
  scheduleCropDraw() {
    if (this._cropRaf) return;
    this._cropRaf = requestAnimationFrame(() => { this._cropRaf = null; this.drawCropStage(); this.positionCropBox(); });
  }
  drawCropStage() {
    const cv = this.cropCanvasEl, c = this.crop, img = this.originalImgEl;
    if (!cv || !img) return;
    const ctx = cv.getContext('2d');
    const dpr = cv.width / c.vw || 2;             // backing store sized once in setupCropper
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, c.vw, c.vh);
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
    ctx.save();
    ctx.translate(c.vw / 2, c.vh / 2);
    ctx.rotate(c.rot90 * Math.PI / 2 + c.freeRot);
    ctx.scale(c.fit, c.fit);
    ctx.drawImage(img, -iw / 2, -ih / 2, iw, ih);
    ctx.restore();
    // Dim everything outside the crop box (drawn on canvas — cheap, avoids a
    // giant animated box-shadow that repaints the whole stage every frame).
    const b = c.box;
    if (b) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, c.vw, b.y);
      ctx.fillRect(0, b.y + b.s, c.vw, c.vh - (b.y + b.s));
      ctx.fillRect(0, b.y, b.x, b.s);
      ctx.fillRect(b.x + b.s, b.y, c.vw - (b.x + b.s), b.s);
    }
  }
  positionCropBox() {
    const b = this.cropBoxEl, c = this.crop;
    if (!b) return;
    b.style.left = c.box.x + 'px'; b.style.top = c.box.y + 'px';
    b.style.width = c.box.s + 'px'; b.style.height = c.box.s + 'px';
  }
  setupCropper() {
    const stage = this.root.querySelector('[data-cropper]');
    if (!stage || !this.originalImgEl) return;
    this.cropStageEl = stage;
    this.cropCanvasEl = stage.querySelector('[data-crop-canvas]');
    this.cropBoxEl = stage.querySelector('[data-crop-box]');
    const r = stage.getBoundingClientRect();
    this.crop.vw = r.width; this.crop.vh = r.height;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.cropCanvasEl.width = Math.round(r.width * dpr);   // size backing store ONCE
    this.cropCanvasEl.height = Math.round(r.height * dpr);
    this.computeImgFit();
    if (!this.crop.box) this.resetCropBox(); else this.clampCropBox();
    this.drawCropStage();
    this.positionCropBox();
    this.cropBoxEl.addEventListener('pointerdown', this.onCropBoxDown);
    this.cropBoxEl.querySelectorAll('[data-h]').forEach((h) => h.addEventListener('pointerdown', this.onCropHandleDown));
    stage.addEventListener('touchstart', this.onCropTwoStart, { passive: false });
    stage.addEventListener('touchmove', this.onCropTwoMove, { passive: false });
    stage.addEventListener('touchend', this.onCropTwoEnd);
    stage.addEventListener('touchcancel', this.onCropTwoEnd);
  }
  onCropBoxDown = (e) => {
    if (e.target.hasAttribute('data-h') || this.cropTwo) return;
    e.preventDefault();
    this.cropDrag = { mode: 'move', px: e.clientX, py: e.clientY, x: this.crop.box.x, y: this.crop.box.y };
  };
  onCropHandleDown = (e) => {
    if (this.cropTwo) return;
    e.preventDefault(); e.stopPropagation();
    this.cropDrag = { mode: 'resize', h: e.target.getAttribute('data-h'), box: { ...this.crop.box } };
  };
  onCropDocMove(e) {
    if (!this.cropDrag || this.cropTwo || this.state.step !== 1) return;
    const c = this.crop, d = this.cropDrag, b = this.cropBounds();
    if (d.mode === 'move') {
      c.box.x = Math.max(b.axMin, Math.min(d.x + (e.clientX - d.px), b.axMax - c.box.s));
      c.box.y = Math.max(b.ayMin, Math.min(d.y + (e.clientY - d.py), b.ayMax - c.box.s));
    } else {
      const p = this.stageCoords(e.clientX, e.clientY), o = d.box;
      let x = o.x, y = o.y, s = o.s;
      if (d.h === 'br') { s = Math.min(Math.max(p.x - o.x, p.y - o.y), b.axMax - o.x, b.ayMax - o.y); }
      else if (d.h === 'tl') { const ax = o.x + o.s, ay = o.y + o.s; s = Math.min(Math.max(ax - p.x, ay - p.y), ax - b.axMin, ay - b.ayMin); x = ax - s; y = ay - s; }
      else if (d.h === 'tr') { const ay = o.y + o.s; s = Math.min(Math.max(p.x - o.x, ay - p.y), b.axMax - o.x, ay - b.ayMin); y = ay - s; }
      else if (d.h === 'bl') { const ax = o.x + o.s; s = Math.min(Math.max(ax - p.x, p.y - o.y), ax - b.axMin, b.ayMax - o.y); x = ax - s; }
      s = Math.max(56, s);
      c.box = { x, y, s };
    }
    this.scheduleCropDraw();
  }
  onCropDocUp() { this.cropDrag = null; }
  rotate90 = () => {
    this.crop.rot90 = (this.crop.rot90 + 1) % 4;
    this.computeImgFit(); this.clampCropBox(); this.scheduleCropDraw();
  };
  onCropTwoStart = (e) => {
    if (e.touches.length < 2) return;
    e.preventDefault();
    this.cropDrag = null;
    this.cropTwo = { ang: Math.atan2(e.touches[1].clientY - e.touches[0].clientY, e.touches[1].clientX - e.touches[0].clientX), rot: this.crop.freeRot };
  };
  onCropTwoMove = (e) => {
    if (!this.cropTwo || e.touches.length < 2) return;
    e.preventDefault();
    const a = Math.atan2(e.touches[1].clientY - e.touches[0].clientY, e.touches[1].clientX - e.touches[0].clientX);
    this.crop.freeRot = this.cropTwo.rot + (a - this.cropTwo.ang);
    this.computeImgFit(); this.clampCropBox(); this.scheduleCropDraw();
  };
  onCropTwoEnd = (e) => { if (!e.touches || e.touches.length < 2) this.cropTwo = null; };
  // Bake the selected square region into the working image → step 2 (ring).
  confirmSquareCrop = () => {
    const c = this.crop, img = this.originalImgEl;   // bake from the ORIGINAL; keep it for "Back"
    if (!c.box || !img) { this.setState({ step: 2 }); return; }
    const S = 1024;
    const out = document.createElement('canvas'); out.width = S; out.height = S;
    const ctx = out.getContext('2d');
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, S, S);
    ctx.scale(S / c.box.s, S / c.box.s);   // crop box → full output
    ctx.translate(-c.box.x, -c.box.y);
    ctx.translate(c.vw / 2, c.vh / 2);     // replicate the stage's image transform
    ctx.rotate(c.rot90 * Math.PI / 2 + c.freeRot);
    ctx.scale(c.fit, c.fit);
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
    ctx.drawImage(img, -iw / 2, -ih / 2, iw, ih);
    const cropped = new Image();
    cropped.onload = () => {
      this.uploadedImgEl = cropped;                        // step 2 frames this square in the ring
      this.state.adjust = { ox: 0, oy: 0, scale: 1, rot: 0 };
      this.setState({ step: 2 });
    };
    cropped.src = out.toDataURL('image/png');
  };

  /* --- share / download --- */
  downloadPng = () => {
    if (!this.previewCanvasEl) return;
    this.previewCanvasEl.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'kamya-dp-ring.png';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    }, 'image/png');
  };
  shareOnWhatsApp = () => {
    if (!this.previewCanvasEl) return;
    this.previewCanvasEl.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], 'kamya-dp-ring.png', { type: 'image/png' });
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], text: 'Keep Breathing. Keep Smiling.' }).catch(() => {});
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'kamya-dp-ring.png';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      window.open('https://wa.me/?text=' + encodeURIComponent('Keep Breathing. Keep Smiling. (attach the photo just downloaded)'), '_blank');
    }, 'image/png');
  };
  resetCreator = () => {
    this.uploadedImgEl = null;
    this.originalImgEl = null;
    this.crop = { rot90: 0, freeRot: 0, box: null };
    this.setState({ step: 1, uploadedSrc: null, adjust: { ox: 0, oy: 0, scale: 1, rot: 0 }, errorMsg: null, preset: DEFAULT_PRESET });
  };

  /* ---------------- render ---------------- */
  render() {
    const s = this.state;
    if (!s.isCreatorOpen) { this.root.innerHTML = ''; return; }

    const activeStepLabel = (STEP_META.find((m) => m.n === s.step) || {}).label || '';
    const progressPct = Math.round((s.step / STEP_META.length) * 100);
    const dropBorder = s.isDraggingFile ? 'var(--border-brand)' : 'var(--border-default)';
    const dropBg = s.isDraggingFile ? 'var(--caramel-50)' : 'var(--cream-100)';

    const cardOpen = `<div style="background:var(--surface-card);border-radius:var(--radius-lg);box-shadow:var(--shadow-card);padding:44px 36px;display:flex;flex-direction:column;align-items:center">`;

    let stepHtml = '';
    if (s.step === 1) {
      stepHtml = `
        <div style="width:100%;text-align:center">
          <h2 style="font-family:var(--font-display);font-weight:700;font-size:24px;color:var(--text-heading);margin:0 0 8px">${(s.uploadedSrc && !s.cameraOpen) ? 'Crop your photo' : 'Upload your photo'}</h2>
          <p style="font-family:var(--font-body);font-size:15px;color:var(--text-muted);margin:0 0 ${(s.uploadedSrc && !s.cameraOpen) ? '18px' : '32px'}">${(s.uploadedSrc && !s.cameraOpen) ? 'Drag &amp; resize the frame · two fingers to rotate' : 'A clear, front-facing photo works best.'}</p>
          ${s.cameraOpen ? `
            <div style="display:flex;flex-direction:column;align-items:center;gap:18px">
              <div style="position:relative;width:100%;max-width:320px;aspect-ratio:1/1;border-radius:var(--radius-lg);overflow:hidden;background:#111">
                <video data-camera autoplay playsinline muted style="width:100%;height:100%;object-fit:cover;transform:scaleX(${s.facingMode === 'user' ? -1 : 1})"></video>
              </div>
              <div style="display:flex;gap:10px;width:100%;max-width:320px">
                <button class="btn btn--secondary btn--md" data-act="flipCamera" aria-label="Flip camera" style="flex:0 0 auto">Flip</button>
                <button class="btn btn--primary btn--lg" data-act="capturePhoto" style="flex:1">Capture</button>
              </div>
              <button data-act="stopCamera" style="background:none;border:none;color:var(--text-muted);font-family:var(--font-body);font-size:13px;font-weight:600;cursor:pointer;padding:0;text-decoration:underline">Cancel</button>
            </div>
          ` : s.uploadedSrc ? `
            <div style="width:100%">
              <div data-cropper style="position:relative;width:100%;max-width:320px;height:360px;margin:0 auto 14px;background:#141414;border-radius:14px;overflow:hidden;touch-action:none;user-select:none">
                <canvas data-crop-canvas style="position:absolute;inset:0;width:100%;height:100%;display:block"></canvas>
                <div data-crop-box style="position:absolute;box-sizing:border-box;border:2px solid #fff;cursor:move;touch-action:none">
                  <div style="position:absolute;inset:0;pointer-events:none">
                    <div style="position:absolute;top:0;bottom:0;left:33.33%;width:1px;background:rgba(255,255,255,0.45)"></div>
                    <div style="position:absolute;top:0;bottom:0;left:66.66%;width:1px;background:rgba(255,255,255,0.45)"></div>
                    <div style="position:absolute;left:0;right:0;top:33.33%;height:1px;background:rgba(255,255,255,0.45)"></div>
                    <div style="position:absolute;left:0;right:0;top:66.66%;height:1px;background:rgba(255,255,255,0.45)"></div>
                  </div>
                  <span data-h="tl" style="position:absolute;left:-3px;top:-3px;width:22px;height:22px;border-left:3px solid #fff;border-top:3px solid #fff;border-top-left-radius:4px;cursor:nwse-resize;touch-action:none"></span>
                  <span data-h="tr" style="position:absolute;right:-3px;top:-3px;width:22px;height:22px;border-right:3px solid #fff;border-top:3px solid #fff;border-top-right-radius:4px;cursor:nesw-resize;touch-action:none"></span>
                  <span data-h="bl" style="position:absolute;left:-3px;bottom:-3px;width:22px;height:22px;border-left:3px solid #fff;border-bottom:3px solid #fff;border-bottom-left-radius:4px;cursor:nesw-resize;touch-action:none"></span>
                  <span data-h="br" style="position:absolute;right:-3px;bottom:-3px;width:22px;height:22px;border-right:3px solid #fff;border-bottom:3px solid #fff;border-bottom-right-radius:4px;cursor:nwse-resize;touch-action:none"></span>
                </div>
              </div>
              <div style="display:flex;justify-content:center;margin-bottom:16px">
                <button data-act="rotate90" class="btn btn--secondary btn--md" aria-label="Rotate 90 degrees" style="display:inline-flex;align-items:center;gap:8px">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M20 11a8 8 0 1 0-2.3 5.6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M21 5v5h-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
                  Rotate
                </button>
              </div>
              <button class="btn btn--primary btn--lg btn--full" data-act="confirmSquareCrop">Continue</button>
              <div style="display:flex;justify-content:center;gap:22px;margin-top:14px">
                <button data-act="resetCrop" style="background:none;border:none;color:var(--text-muted);font-family:var(--font-body);font-size:13px;font-weight:600;cursor:pointer;padding:0;text-decoration:underline">Reset</button>
                <button data-act="clearUpload" style="background:none;border:none;color:var(--text-muted);font-family:var(--font-body);font-size:13px;font-weight:600;cursor:pointer;padding:0;text-decoration:underline">Choose a different photo</button>
              </div>
            </div>
          ` : `
            <div data-dropzone style="padding:44px 28px;border-radius:var(--radius-lg);border:2px dashed ${dropBorder};background:${dropBg};display:flex;flex-direction:column;align-items:center;gap:14px;transition:border-color .15s ease, background .15s ease">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" style="color:var(--brand)"><path d="M12 16V4M12 4l-5 5M12 4l5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path><path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path></svg>
              <div style="font-family:var(--font-body);font-weight:700;font-size:15px;color:var(--text-strong)">Drag &amp; drop your photo here</div>
              <div style="font-family:var(--font-body);font-size:13px;color:var(--text-muted)">or</div>
              <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center">
                <button class="btn btn--secondary btn--md" data-act="triggerFilePicker">Choose a Photo</button>
                <button class="btn btn--primary btn--md" data-act="openCamera" style="display:inline-flex;align-items:center;gap:7px">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h2l1-1.6A1 1 0 0 1 8.3 5h7.4a1 1 0 0 1 .8.4L17.5 7h2A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5v-9Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><circle cx="12" cy="13" r="3.2" stroke="currentColor" stroke-width="1.7"/></svg>
                  Take a Photo
                </button>
              </div>
            </div>
          `}
          ${s.cameraError ? `<p style="font-family:var(--font-body);font-size:13px;color:var(--text-error);margin:16px 0 0">${s.cameraError}</p>` : ''}
          <input type="file" accept="image/*" data-file-input style="display:none">
          ${s.errorMsg ? `<p style="font-family:var(--font-body);font-size:13px;color:var(--text-error);margin:16px 0 0">${s.errorMsg}</p>` : ''}
        </div>`;
    } else if (s.step === 2) {
      const swatches = STYLE_ORDER.map((p) => {
        const selected = p.key === s.preset;
        const borderColor = selected ? 'var(--border-brand)' : 'var(--border-subtle)';
        const bgColor = selected ? 'var(--caramel-50)' : '#FFFFFF';
        return `
          <button data-preset="${p.key}" style="display:flex;flex-direction:column;align-items:center;gap:8px;padding:12px 10px;border-radius:var(--radius-md);border:2px solid ${borderColor};background:${bgColor};cursor:pointer">
            <canvas data-swatch="${p.key}" width="120" height="120" style="width:50px;height:50px;display:block"></canvas>
            <span style="font-family:var(--font-body);font-size:13px;font-weight:600;color:var(--text-strong)">${p.label}</span>
          </button>`;
      }).join('');
      stepHtml = `
        <div style="width:100%;text-align:center">
          <h2 style="font-family:var(--font-display);font-weight:700;font-size:24px;color:var(--text-heading);margin:0 0 8px">Frame your photo</h2>
          <p style="font-family:var(--font-body);font-size:14px;color:var(--text-muted);margin:0 0 20px">Drag to move · pinch to zoom &amp; rotate</p>
          <div style="background:var(--cream-100);border-radius:var(--radius-lg);padding:14px;margin:0 auto 14px;max-width:320px">
            <canvas data-preview data-adjust width="1024" height="1024" style="display:block;width:100%;height:auto;aspect-ratio:1/1;border-radius:12px;touch-action:none;cursor:grab"></canvas>
          </div>
          <button data-act="resetCrop" style="display:block;margin:0 auto 22px;background:none;border:none;color:var(--text-muted);font-family:var(--font-body);font-size:13px;font-weight:600;cursor:pointer;padding:0;text-decoration:underline">Reset</button>
          <div style="font-family:var(--font-body);font-size:13px;font-weight:700;color:var(--text-strong);margin:0 0 12px">Choose your ring</div>
          <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:24px">${swatches}</div>
          <button class="btn btn--primary btn--lg btn--full" data-act="goNext">Continue</button>
        </div>`;
    } else if (s.step === 3) {
      stepHtml = `
        <div style="width:100%;text-align:center">
          <div style="width:56px;height:56px;border-radius:50%;background:var(--green-100);display:flex;align-items:center;justify-content:center;margin:0 auto 16px">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="var(--green-600)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"></path></svg>
          </div>
          <h2 style="font-family:var(--font-display);font-weight:700;font-size:24px;color:var(--text-heading);margin:0 0 6px">You're all set!</h2>
          <p style="font-family:var(--font-body);font-size:14px;color:var(--text-muted);margin:0 0 24px">Your ring is ready to share.</p>
          <div style="background:var(--cream-100);border-radius:var(--radius-lg);padding:16px;margin-bottom:28px;display:inline-flex">
            <canvas data-preview width="1024" height="1024" style="display:block;width:180px;height:180px"></canvas>
          </div>
          <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:20px">
            <button data-act="shareOnWhatsApp" style="display:flex;align-items:center;justify-content:center;gap:10px;height:52px;padding:0 24px;border-radius:8px;border:none;background:#25D366;color:#FFFFFF;font-family:var(--font-body);font-weight:700;font-size:15px;cursor:pointer">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.85.5 3.58 1.44 5.09L2 22l5.25-1.38a9.83 9.83 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.86 9.86 0 0 0 12.04 2zm0 1.67c2.19 0 4.25.85 5.79 2.4a8.17 8.17 0 0 1 2.4 5.84c0 4.53-3.69 8.22-8.22 8.22a8.2 8.2 0 0 1-4.17-1.14l-.3-.17-3.12.82.83-3.04-.19-.31a8.14 8.14 0 0 1-1.25-4.38c0-4.53 3.7-8.24 8.23-8.24zm-4.42 4.67c-.15 0-.4.06-.58.27-.19.22-.72.7-.72 1.72s.74 1.99.84 2.13c.11.15 1.51 2.36 3.75 3.2 2.24.85 2.24.57 2.65.53.41-.04 1.32-.53 1.51-1.05.19-.52.19-.96.13-1.05-.06-.09-.24-.15-.5-.28-.26-.13-1.52-.75-1.75-.83-.24-.09-.41-.13-.58.13-.17.26-.66.83-.81.99-.15.17-.3.19-.55.06-.26-.13-1.08-.4-2.05-1.27-.76-.68-1.27-1.51-1.42-1.77-.15-.26-.02-.4.11-.53.13-.13.28-.34.41-.51.13-.17.17-.3.26-.5.09-.19.04-.36-.02-.5-.06-.13-.55-1.32-.76-1.81-.17-.4-.34-.35-.5-.36l-.42-.01z"></path></svg>
              Share on WhatsApp
            </button>
            <button class="btn btn--secondary btn--lg btn--full" data-act="downloadPng">Download PNG</button>
          </div>
          <button data-act="resetCreator" style="background:none;border:none;color:var(--text-muted);font-family:var(--font-body);font-size:13px;font-weight:600;cursor:pointer;padding:0;text-decoration:underline">Create Another</button>
        </div>`;
    }

    const fadeCss = this._justOpened ? 'animation:dcFadeIn .22s ease;' : '';
    this._justOpened = false;
    this.root.innerHTML = `
      <div style="position:fixed;inset:0;background:var(--cream-100);z-index:1000;overflow-y:auto;overscroll-behavior:contain;${fadeCss}">
        <div style="max-width:640px;margin:0 auto;padding:28px 24px 80px;min-height:100%;display:flex;flex-direction:column">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
            ${s.step !== 1
              ? `<button data-act="goBack" style="display:inline-flex;align-items:center;gap:6px;background:none;border:none;color:var(--text-muted);font-family:var(--font-body);font-size:14px;font-weight:600;cursor:pointer;padding:8px 0">← Back</button>`
              : `<div></div>`}
            <span style="font-family:var(--font-body);font-size:13px;font-weight:600;color:var(--text-muted)">Step ${s.step} of ${STEP_META.length} · ${activeStepLabel}</span>
            <button aria-label="Close" data-act="close" style="width:36px;height:36px;border-radius:50%;border:none;background:var(--surface-card);display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--text-strong);font-size:15px;line-height:1;padding:0;box-shadow:var(--shadow-sm)">✕</button>
          </div>
          <div style="height:4px;background:var(--cream-200);border-radius:999px;overflow:hidden;margin-bottom:32px">
            <div style="height:100%;background:var(--brand);border-radius:999px;width:${progressPct}%;transition:width .3s ease"></div>
          </div>
          <div style="flex:1;display:flex;flex-direction:column">
            ${cardOpen}${stepHtml}</div>
          </div>
        </div>
      </div>`;

    this.wire();
  }

  wire() {
    const actions = {
      close: this.close, goBack: this.goBack, goNext: this.goNext,
      clearUpload: this.clearUpload, triggerFilePicker: this.triggerFilePicker,
      resetCrop: this.resetCrop, confirmSquareCrop: this.confirmSquareCrop, rotate90: this.rotate90,
      shareOnWhatsApp: this.shareOnWhatsApp, downloadPng: this.downloadPng, resetCreator: this.resetCreator,
      openCamera: this.openCamera, stopCamera: this.stopCamera, capturePhoto: this.capturePhoto, flipCamera: this.flipCamera,
    };
    this.root.querySelectorAll('[data-act]').forEach((el) => {
      const fn = actions[el.getAttribute('data-act')];
      if (fn) el.addEventListener('click', fn);
    });

    // camera preview — reconnect the live stream after this re-render
    this.videoEl = this.root.querySelector('[data-camera]');
    if (this.state.cameraOpen && this.stream) this.attachStream();

    // file input + dropzone
    this.fileInputEl = this.root.querySelector('[data-file-input]');
    if (this.fileInputEl) this.fileInputEl.addEventListener('change', this.onFileSelected);
    const dz = this.root.querySelector('[data-dropzone]');
    if (dz) {
      dz.addEventListener('drop', this.onDrop);
      dz.addEventListener('dragover', this.onDragOver);
      dz.addEventListener('dragleave', this.onDragLeave);
    }

    // live preview canvas (also the adjust surface on step 2)
    this.previewCanvasEl = this.root.querySelector('[data-preview]');

    // adjust interactions: drag/pan, wheel-zoom (desktop) + 1-finger pan,
    // 2-finger pinch-zoom & twist-rotate (touch)
    const adjustEl = this.root.querySelector('[data-adjust]');
    this.adjustCanvasEl = adjustEl;
    if (adjustEl) {
      adjustEl.addEventListener('mousedown', this.onCropPointerDown);
      adjustEl.addEventListener('wheel', this.onCropWheel, { passive: false });
      adjustEl.addEventListener('touchstart', this.onCropTouchStart, { passive: false });
      adjustEl.addEventListener('touchmove', this.onCropTouchMove, { passive: false });
      adjustEl.addEventListener('touchend', this.onCropTouchEnd);
      adjustEl.addEventListener('touchcancel', this.onCropTouchEnd);
    }

    // preset swatches
    this.root.querySelectorAll('[data-preset]').forEach((el) => {
      el.addEventListener('click', () => this.selectPreset(el.getAttribute('data-preset')));
    });
    this.root.querySelectorAll('[data-swatch]').forEach((el) => {
      Ring.renderKamyaRing(el, { size: 120, styleKey: el.getAttribute('data-swatch'), img: null, silhouette: { bg: '#F3E7DD', fg: '#DCB492', bust: 1 } });
    });

    if (this.state.step === 1 && this.state.uploadedSrc && !this.state.cameraOpen) this.setupCropper();
    else this.adjustRender();
  }
}

/* ---------------- landing bootstrap ---------------- */

function buildHowItWorks() {
  const grid = document.querySelector('[data-how-grid]');
  grid.innerHTML = HOW_IT_WORKS.map((it, i) => `
    <div style="text-align:center;background:var(--surface-card);border-radius:var(--radius-lg);padding:32px 24px;box-shadow:var(--shadow-card)">
      <div style="position:relative;width:104px;height:104px;margin:0 auto 20px">
        <span style="position:absolute;top:-6px;left:50%;transform:translateX(-50%);z-index:2;width:26px;height:26px;border-radius:50%;background:var(--brand);color:#fff;font-family:var(--font-ui);font-weight:700;font-size:13px;display:flex;align-items:center;justify-content:center;box-shadow:var(--shadow-sm)">${i + 1}</span>
        <div class="how-icon" style="width:104px;height:104px;border-radius:50%;overflow:hidden;background:var(--caramel-50);box-shadow:var(--shadow-sm);color:var(--brand);display:flex;align-items:center;justify-content:center">
          <img src="${it.img}" alt="${it.title}" style="width:100%;height:100%;object-fit:cover;display:block"
               onerror="this.style.display='none';this.insertAdjacentHTML('afterend','<svg width=&quot;40&quot; height=&quot;40&quot; viewBox=&quot;0 0 24 24&quot; fill=&quot;none&quot;>${HOW_ICONS[it.icon].replace(/"/g, '&quot;')}</svg>')">
        </div>
      </div>
      <h3 style="font-family:var(--font-display);font-weight:700;font-size:18px;color:var(--text-heading);margin:0 0 8px">${it.title}</h3>
      <p style="font-family:var(--font-body);font-size:14px;color:var(--text-body);margin:0;line-height:1.5">${it.desc}</p>
    </div>`).join('');
}

function init() {
  buildHowItWorks();
  const creator = new Creator(document.querySelector('[data-creator-root]'));
  document.querySelectorAll('[data-open-creator]').forEach((b) => b.addEventListener('click', creator.open));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && creator.state.isCreatorOpen) creator.close(); });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
