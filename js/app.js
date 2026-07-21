import * as Ring from './ring-render.js?v=2';

/* ---------------- static config (ported from the design) ---------------- */

const STEP_META = [
  { n: 1, label: 'Upload' },
  { n: 2, label: 'Crop' },
  { n: 3, label: 'Ring' },
  { n: 4, label: 'Done' },
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

// Hero images. Each slot uses the real design photo when present in assets/,
// and falls back to a generated on-brand ring avatar if the file is missing.
const HERO_ROW1 = [
  { size: 240, img: 'assets/hero-kamya-praying2.png', preset: 'classic', bg: '#FFF3EA', fg: '#DCB492', bust: 0 },
  { size: 270, img: 'assets/hero-kamya-yoga.png', preset: 'bold', bg: '#BFF6EC', fg: '#1E8057', bust: 1 },
];
const HERO_ROW2 = [
  { size: 170, img: 'assets/hero-man-blue.png', preset: 'bold', bg: '#EAF1FF', fg: '#6E86C4', bust: 1 },
  { size: 190, img: 'assets/hero-man-green-cutout.png', preset: 'classic', bg: '#FFEBDB', fg: '#2A9D6E', bust: 0 },
  { size: 170, img: 'assets/hero-woman-orange.png', preset: 'bold', bg: '#FAEBEC', fg: '#E2929A', bust: 2 },
];

const HOW_ICONS = {
  upload: '<path d="M12 16V4M12 4l-5 5M12 4l5 5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
  ring: '<circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="1.7"/>',
  share: '<path d="M4 12v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 6l-4-4-4 4M12 2v13" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
};

const DEFAULT_PRESET = 'classic';

/* ---------------- component ---------------- */

class Creator {
  constructor(root) {
    this.root = root;
    this.state = {
      isCreatorOpen: false,
      step: 1,
      uploadedSrc: null,
      crop: { x: 0, y: 0, scale: 1 },
      isDraggingFile: false,
      croppedReady: false,
      preset: DEFAULT_PRESET,
      errorMsg: null,
    };
    // non-render refs / images
    this.uploadedImgEl = null;
    this.croppedImgEl = null;
    this.previewCanvasEl = null;
    this.fileInputEl = null;
    this.cropImgEl = null;
    this.panStart = null;
    this.touchState = null;
    this._justOpened = false;

    this.onWindowMouseMove = this.onWindowMouseMove.bind(this);
    this.onWindowMouseUp = this.onWindowMouseUp.bind(this);
    window.addEventListener('mousemove', this.onWindowMouseMove);
    window.addEventListener('mouseup', this.onWindowMouseUp);
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
    this.croppedImgEl = null;
    this.setState({ isCreatorOpen: false, step: 1, uploadedSrc: null, croppedReady: false, crop: { x: 0, y: 0, scale: 1 }, errorMsg: null });
  };
  goNext = () => this.setState((s) => ({ step: Math.min(4, s.step + 1) }));
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
        this.uploadedImgEl = img;
        this.setState({ uploadedSrc: src, errorMsg: null, crop: { x: 0, y: 0, scale: 1 } });
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
  clearUpload = () => { this.uploadedImgEl = null; this.setState({ uploadedSrc: null, errorMsg: null }); };

  /* --- crop --- */
  onCropPointerDown = (e) => { this.panStart = { x: e.clientX, y: e.clientY, cx: this.state.crop.x, cy: this.state.crop.y }; };
  applyCropTransform() {
    if (!this.cropImgEl) return;
    const { x, y, scale } = this.state.crop;
    this.cropImgEl.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
  }
  onWindowMouseMove(e) {
    if (!this.panStart) return;
    const dx = e.clientX - this.panStart.x, dy = e.clientY - this.panStart.y;
    this.state.crop = { ...this.state.crop, x: this.panStart.cx + dx, y: this.panStart.cy + dy };
    this.applyCropTransform();
  }
  onWindowMouseUp() { this.panStart = null; }
  resetCrop = () => { this.state.crop = { x: 0, y: 0, scale: 1 }; this.applyCropTransform(); };
  onCropWheel = (e) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.0015;
    this.state.crop = { ...this.state.crop, scale: Math.min(3, Math.max(1, this.state.crop.scale + delta)) };
    this.applyCropTransform();
  };
  touchDist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  onCropTouchStart = (e) => {
    if (e.touches.length === 2) this.touchState = { mode: 'pinch', dist: this.touchDist(e.touches), scale: this.state.crop.scale };
    else if (e.touches.length === 1) { const t = e.touches[0]; this.touchState = { mode: 'pan', x: t.clientX, y: t.clientY, cx: this.state.crop.x, cy: this.state.crop.y }; }
  };
  onCropTouchMove = (e) => {
    e.preventDefault();
    if (!this.touchState) return;
    if (this.touchState.mode === 'pinch' && e.touches.length === 2) {
      const factor = this.touchDist(e.touches) / this.touchState.dist;
      const newScale = Math.min(3, Math.max(1, this.touchState.scale * factor));
      this.state.crop = { ...this.state.crop, scale: newScale };
      this.applyCropTransform();
    } else if (this.touchState.mode === 'pan' && e.touches.length === 1) {
      const t = e.touches[0];
      const dx = t.clientX - this.touchState.x, dy = t.clientY - this.touchState.y;
      this.state.crop = { ...this.state.crop, x: this.touchState.cx + dx, y: this.touchState.cy + dy };
      this.applyCropTransform();
    }
  };
  onCropTouchEnd = () => { this.touchState = null; };
  confirmCrop = () => {
    if (!this.uploadedImgEl) return;
    const SIZE = 800, VIEW = 270, ratio = SIZE / VIEW;
    const canvas = document.createElement('canvas');
    canvas.width = SIZE; canvas.height = SIZE;
    const ctx = canvas.getContext('2d');
    const { x, y, scale } = this.state.crop;
    ctx.save();
    ctx.translate(SIZE / 2, SIZE / 2);
    ctx.translate(x * ratio, y * ratio);
    ctx.scale(scale, scale);
    const iw = this.uploadedImgEl.naturalWidth, ih = this.uploadedImgEl.naturalHeight;
    let dw, dh;
    if (iw / ih > 1) { dh = SIZE; dw = (dh * iw) / ih; } else { dw = SIZE; dh = (dw * ih) / iw; }
    ctx.drawImage(this.uploadedImgEl, -dw / 2, -dh / 2, dw, dh);
    ctx.restore();
    const dataUrl = canvas.toDataURL('image/png');
    const img = new Image();
    img.onload = () => { this.croppedImgEl = img; this.setState({ croppedReady: true, step: 3 }); };
    img.src = dataUrl;
  };

  /* --- ring choice --- */
  selectPreset = (key) => this.setState({ preset: key });

  renderPreviewCanvas = () => {
    if (!this.previewCanvasEl) return;
    Ring.renderKamyaRing(this.previewCanvasEl, {
      size: 1024,
      styleKey: this.state.preset,
      img: this.croppedImgEl || null,
      silhouette: { bg: '#F3E7DD', fg: '#DCB492', bust: 1 },
    });
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
    this.croppedImgEl = null;
    this.setState({ step: 1, uploadedSrc: null, croppedReady: false, crop: { x: 0, y: 0, scale: 1 }, errorMsg: null, preset: DEFAULT_PRESET });
  };

  /* ---------------- render ---------------- */
  render() {
    const s = this.state;
    if (!s.isCreatorOpen) { this.root.innerHTML = ''; return; }

    const activeStepLabel = (STEP_META.find((m) => m.n === s.step) || {}).label || '';
    const progressPct = Math.round((s.step / STEP_META.length) * 100);
    const cropTransform = `translate(${s.crop.x}px, ${s.crop.y}px) scale(${s.crop.scale})`;
    const dropBorder = s.isDraggingFile ? 'var(--border-brand)' : 'var(--border-default)';
    const dropBg = s.isDraggingFile ? 'var(--caramel-50)' : 'var(--cream-100)';

    const cardOpen = `<div style="background:var(--surface-card);border-radius:var(--radius-lg);box-shadow:var(--shadow-card);padding:44px 36px;display:flex;flex-direction:column;align-items:center">`;

    let stepHtml = '';
    if (s.step === 1) {
      stepHtml = `
        <div style="width:100%;text-align:center">
          <h2 style="font-family:var(--font-display);font-weight:700;font-size:24px;color:var(--text-heading);margin:0 0 8px">Upload your photo</h2>
          <p style="font-family:var(--font-body);font-size:15px;color:var(--text-muted);margin:0 0 32px">A clear, front-facing photo works best.</p>
          ${s.uploadedSrc ? `
            <div style="display:flex;flex-direction:column;align-items:center;gap:24px">
              <div style="width:160px;height:160px;border-radius:50%;overflow:hidden;box-shadow:var(--shadow-sm);border:1px solid var(--border-subtle)">
                <img src="${s.uploadedSrc}" style="width:100%;height:100%;object-fit:cover;display:block" alt="Your upload">
              </div>
              <button class="btn btn--primary btn--lg btn--full" data-act="goNext">Continue</button>
              <button data-act="clearUpload" style="background:none;border:none;color:var(--text-muted);font-family:var(--font-body);font-size:13px;font-weight:600;cursor:pointer;padding:0;text-decoration:underline">Choose a different photo</button>
            </div>
          ` : `
            <div data-dropzone style="padding:48px 32px;border-radius:var(--radius-lg);border:2px dashed ${dropBorder};background:${dropBg};display:flex;flex-direction:column;align-items:center;gap:14px;transition:border-color .15s ease, background .15s ease">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" style="color:var(--brand)"><path d="M12 16V4M12 4l-5 5M12 4l5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path><path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path></svg>
              <div style="font-family:var(--font-body);font-weight:700;font-size:15px;color:var(--text-strong)">Drag &amp; drop your photo here</div>
              <div style="font-family:var(--font-body);font-size:13px;color:var(--text-muted)">or</div>
              <button class="btn btn--secondary btn--md" data-act="triggerFilePicker">Choose a Photo</button>
            </div>
          `}
          <input type="file" accept="image/*" data-file-input style="display:none">
          ${s.errorMsg ? `<p style="font-family:var(--font-body);font-size:13px;color:var(--text-error);margin:16px 0 0">${s.errorMsg}</p>` : ''}
        </div>`;
    } else if (s.step === 2) {
      stepHtml = `
        <div style="width:100%;text-align:center">
          <h2 style="font-family:var(--font-display);font-weight:700;font-size:24px;color:var(--text-heading);margin:0 0 8px">Frame your photo</h2>
          <p style="font-family:var(--font-body);font-size:14px;color:var(--text-muted);margin:0 0 28px">Drag to reposition. Scroll or pinch to zoom.</p>
          <div style="display:flex;flex-direction:column;align-items:center;gap:20px">
            <div data-crop-box style="width:260px;height:260px;background:var(--cream-200);border-radius:var(--radius-lg);display:flex;align-items:center;justify-content:center;cursor:grab;touch-action:none">
              <div style="width:230px;height:230px;border-radius:50%;overflow:hidden;position:relative;border:2px solid var(--border-default);box-shadow:var(--shadow-sm)">
                <img src="${s.uploadedSrc || ''}" draggable="false" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transform:${cropTransform};transform-origin:center;pointer-events:none;user-select:none" alt="Crop preview">
              </div>
            </div>
            <button class="btn btn--primary btn--lg btn--full" data-act="confirmCrop">Continue</button>
            <button data-act="resetCrop" style="background:none;border:none;color:var(--text-muted);font-family:var(--font-body);font-size:13px;font-weight:600;cursor:pointer;padding:0;text-decoration:underline">Reset position</button>
          </div>
        </div>`;
    } else if (s.step === 3) {
      const swatches = STYLE_ORDER.map((p) => {
        const selected = p.key === s.preset;
        const borderColor = selected ? 'var(--border-brand)' : 'var(--border-subtle)';
        const bgColor = selected ? 'var(--caramel-50)' : '#FFFFFF';
        return `
          <button data-preset="${p.key}" style="display:flex;flex-direction:column;align-items:center;gap:10px;padding:16px 10px;border-radius:var(--radius-md);border:2px solid ${borderColor};background:${bgColor};cursor:pointer">
            <canvas data-swatch="${p.key}" width="120" height="120" style="width:56px;height:56px;display:block"></canvas>
            <span style="font-family:var(--font-body);font-size:13px;font-weight:600;color:var(--text-strong)">${p.label}</span>
          </button>`;
      }).join('');
      stepHtml = `
        <div style="width:100%;text-align:center">
          <h2 style="font-family:var(--font-display);font-weight:700;font-size:24px;color:var(--text-heading);margin:0 0 8px">Choose your ring</h2>
          <p style="font-family:var(--font-body);font-size:14px;color:var(--text-muted);margin:0 0 28px">Pick a ring style.</p>
          <div style="background:var(--cream-100);border-radius:var(--radius-lg);padding:20px;margin-bottom:24px;display:inline-flex">
            <canvas data-preview width="1024" height="1024" style="display:block;width:220px;height:220px"></canvas>
          </div>
          <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:14px;margin-bottom:28px">${swatches}</div>
          <button class="btn btn--primary btn--lg btn--full" data-act="goNext">Continue</button>
        </div>`;
    } else if (s.step === 4) {
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
            <span style="font-family:var(--font-body);font-size:13px;font-weight:600;color:var(--text-muted)">Step ${s.step} of 4 · ${activeStepLabel}</span>
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
      confirmCrop: this.confirmCrop, resetCrop: this.resetCrop,
      shareOnWhatsApp: this.shareOnWhatsApp, downloadPng: this.downloadPng, resetCreator: this.resetCreator,
    };
    this.root.querySelectorAll('[data-act]').forEach((el) => {
      const fn = actions[el.getAttribute('data-act')];
      if (fn) el.addEventListener('click', fn);
    });

    // file input + dropzone
    this.fileInputEl = this.root.querySelector('[data-file-input]');
    if (this.fileInputEl) this.fileInputEl.addEventListener('change', this.onFileSelected);
    const dz = this.root.querySelector('[data-dropzone]');
    if (dz) {
      dz.addEventListener('drop', this.onDrop);
      dz.addEventListener('dragover', this.onDragOver);
      dz.addEventListener('dragleave', this.onDragLeave);
    }

    // crop interactions
    const cropBox = this.root.querySelector('[data-crop-box]');
    this.cropImgEl = cropBox ? cropBox.querySelector('img') : null;
    if (cropBox) {
      cropBox.addEventListener('mousedown', this.onCropPointerDown);
      cropBox.addEventListener('wheel', this.onCropWheel, { passive: false });
      cropBox.addEventListener('touchstart', this.onCropTouchStart, { passive: false });
      cropBox.addEventListener('touchmove', this.onCropTouchMove, { passive: false });
      cropBox.addEventListener('touchend', this.onCropTouchEnd);
    }

    // preset swatches
    this.root.querySelectorAll('[data-preset]').forEach((el) => {
      el.addEventListener('click', () => this.selectPreset(el.getAttribute('data-preset')));
    });
    this.root.querySelectorAll('[data-swatch]').forEach((el) => {
      Ring.renderKamyaRing(el, { size: 120, styleKey: el.getAttribute('data-swatch'), img: null, silhouette: { bg: '#F3E7DD', fg: '#DCB492', bust: 1 } });
    });

    // preview canvas
    this.previewCanvasEl = this.root.querySelector('[data-preview]');
    this.renderPreviewCanvas();
  }
}

/* ---------------- landing bootstrap ---------------- */

function buildHeroAvatars() {
  const r1 = document.querySelector('[data-hero-row1]');
  const r2 = document.querySelector('[data-hero-row2]');
  const all = [];
  const shadow = 'drop-shadow(0 14px 24px rgba(107,61,5,0.14))';

  const generatedCanvas = (cfg) => {
    const c = document.createElement('canvas');
    c.dataset.baseSize = cfg.size;
    c.style.filter = shadow;
    c.style.display = 'block';
    Ring.renderKamyaRing(c, { size: 540, styleKey: cfg.preset, img: null, silhouette: { bg: cfg.bg, fg: cfg.fg, bust: cfg.bust } });
    return c;
  };

  const mk = (cfg, row) => {
    if (cfg.img) {
      // Try the real design photo first; fall back to a generated avatar on error.
      // Circular cover-crop centers each example on its ring and hides the
      // varied source backgrounds (some framed, some transparent cut-outs).
      const img = new Image();
      img.alt = 'Kamya member wearing the ring';
      img.dataset.baseSize = cfg.size;
      img.style.cssText = `object-fit:cover;border-radius:50%;background:var(--cream-100);display:block;filter:${shadow}`;
      img.onerror = () => {
        const c = generatedCanvas(cfg);
        img.replaceWith(c);
        all[all.indexOf(img)] = c;
        sizeHero();
      };
      img.src = cfg.img;
      all.push(img);
      row.appendChild(img);
    } else {
      const c = generatedCanvas(cfg);
      all.push(c);
      row.appendChild(c);
    }
  };

  HERO_ROW1.forEach((cfg) => mk(cfg, r1));
  HERO_ROW2.forEach((cfg) => mk(cfg, r2));

  function sizeHero() {
    // Scale both rows by a single factor so the widest row always fits the
    // available column width (row 2 with three rings is the widest).
    const row1W = 240 + 270 + 24;              // 534
    const row2W = 170 + 190 + 170 + 22 * 2;    // 574
    const natural = Math.max(row1W, row2W);
    const container = r1.parentElement;
    const avail = Math.min(
      container.clientWidth || 560,
      document.documentElement.clientWidth - 48
    );
    const scale = Math.min(1, avail / natural);
    all.forEach((el) => {
      const px = Math.round(Number(el.dataset.baseSize) * scale);
      el.style.width = px + 'px';
      el.style.height = px + 'px';
    });
  }
  sizeHero();
  window.addEventListener('resize', sizeHero);
}

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

function buildLogoMarks() {
  const svg = `<svg viewBox="0 0 32 32" width="1.15em" height="1.15em" fill="none" aria-hidden="true">
    <path d="M16 5c2.6 2.2 4 5 4 8 0 3.2-1.7 6-4 8-2.3-2-4-4.8-4-8 0-3 1.4-5.8 4-8z" fill="var(--caramel-500)"/>
    <path d="M8 12c3 .3 5.4 1.7 7 4 1.3 1.9 1.8 4.2 1.5 6.6-3-.3-5.4-1.7-7-4C8.2 16.7 7.7 14.4 8 12z" fill="var(--caramel-400)"/>
    <path d="M24 12c-3 .3-5.4 1.7-7 4-1.3 1.9-1.8 4.2-1.5 6.6 3-.3 5.4-1.7 7-4 1.3-1.9 1.8-4.2 1.5-6.6z" fill="var(--caramel-300)"/>
    <circle cx="16" cy="18" r="2.2" fill="var(--caramel-800)"/>
  </svg>`;
  document.querySelectorAll('[data-logo-mark]').forEach((el) => { el.innerHTML = svg; el.style.display = 'inline-flex'; });
}

function init() {
  buildLogoMarks();
  buildHeroAvatars();
  buildHowItWorks();
  const creator = new Creator(document.querySelector('[data-creator-root]'));
  document.querySelectorAll('[data-open-creator]').forEach((b) => b.addEventListener('click', creator.open));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && creator.state.isCreatorOpen) creator.close(); });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
