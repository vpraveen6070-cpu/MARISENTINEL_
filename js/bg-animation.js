/**
 * MARISENTINEL — High Performance Canvas Background Frame Loop Animation
 * Loops through 240 sequence frames smoothly at 24fps in full clarity without white overlay
 */

(function () {
  const TOTAL_FRAMES = 240;
  const FPS = 24;
  const FRAME_INTERVAL = 1000 / FPS;
  const FRAME_PATH = (i) => `public/bg-frames/ezgif-frame-${String(i).padStart(3, "0")}.jpg`;

  function initBackgroundAnimation() {
    // Remove any existing scrim overlays
    const oldScrim = document.getElementById("bg-scrim");
    if (oldScrim) oldScrim.remove();

    let canvas = document.getElementById("bg-canvas");
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.id = "bg-canvas";
      canvas.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        z-index: 0;
        pointer-events: none;
        object-fit: cover;
      `;
      document.body.insertBefore(canvas, document.body.firstChild);
    }

    const ctx = canvas.getContext("2d");
    const images = new Array(TOTAL_FRAMES);
    let currentFrame = 1;
    let lastTime = 0;
    let isRunning = true;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      drawFrame(currentFrame);
    }

    window.addEventListener("resize", resize);
    resize();

    // Preload strategy: Load immediate initial batch, then stream the rest
    function loadFrame(index) {
      if (images[index - 1]) return images[index - 1];
      const img = new Image();
      img.src = FRAME_PATH(index);
      img.onload = () => {
        if (index === 1 && currentFrame === 1) {
          drawFrame(1);
        }
      };
      images[index - 1] = img;
      return img;
    }

    // Preload first 30 frames immediately
    for (let i = 1; i <= Math.min(30, TOTAL_FRAMES); i++) {
      loadFrame(i);
    }

    // Stream preload the rest in background chunks
    let streamIndex = 31;
    function streamNextChunk() {
      const end = Math.min(streamIndex + 15, TOTAL_FRAMES);
      for (; streamIndex <= end; streamIndex++) {
        loadFrame(streamIndex);
      }
      if (streamIndex < TOTAL_FRAMES) {
        setTimeout(streamNextChunk, 80);
      }
    }
    setTimeout(streamNextChunk, 150);

    function drawFrame(frameNumber) {
      const img = images[frameNumber - 1] || loadFrame(frameNumber);
      if (!img || !img.complete || img.naturalWidth === 0) return;

      const cw = canvas.width;
      const ch = canvas.height;
      const iw = img.naturalWidth;
      const ih = img.naturalHeight;

      // Cover scaling math
      const scale = Math.max(cw / iw, ch / ih);
      const nw = iw * scale;
      const nh = ih * scale;
      const nx = (cw - nw) / 2;
      const ny = (ch - nh) / 2;

      ctx.clearRect(0, 0, cw, ch);
      ctx.drawImage(img, nx, ny, nw, nh);
    }

    function loop(timestamp) {
      if (!isRunning) return;

      if (!lastTime) lastTime = timestamp;
      const elapsed = timestamp - lastTime;

      if (elapsed >= FRAME_INTERVAL) {
        lastTime = timestamp - (elapsed % FRAME_INTERVAL);
        currentFrame = (currentFrame % TOTAL_FRAMES) + 1;
        drawFrame(currentFrame);
      }

      requestAnimationFrame(loop);
    }

    requestAnimationFrame(loop);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initBackgroundAnimation);
  } else {
    initBackgroundAnimation();
  }
})();
