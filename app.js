'use strict';
const $ = id => document.getElementById(id);
const canvas = $('preview'), ctx = canvas.getContext('2d');
const frame = document.createElement('canvas');
frame.width = 1080; frame.height = 720;
const frameCtx = frame.getContext('2d');
const background = document.createElement('canvas');
const backgroundCtx = background.getContext('2d');
const cameraOverlay = document.createElement('canvas');
cameraOverlay.width = 2160; cameraOverlay.height = 1440;
let template, photo, zoom = 1, focusX = .5, focusY = .5, loadVersion = 0, drag, toastTimer;
// LCD opening, measured in the original 1080 × 720 template.
const screen = {left:276, top:243, right:660, bottom:499, radius:2.5};
// Camera body spans rows 200-524; keep a little air around it when panels get short.
const CAMERA_BAND = 380;
function notify(message) { $('status').textContent = message; clearTimeout(toastTimer); toastTimer = setTimeout(() => $('status').textContent = '', 4500); }
function loadImage(src) { return new Promise((resolve,reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error('无法读取图片，请换用 JPG、PNG 或 WebP 图片。')); img.src = src; }); }
// Cover crop of the photo for any target aspect, honoring zoom and focus.
// The screen and the lower panel share zoom and focus, so they stay in step.
function cropFor(image, aspectWidth, aspectHeight) {
  const iw = image.naturalWidth, ih = image.naturalHeight, aspect = aspectWidth/aspectHeight;
  let width = Math.min(iw, ih*aspect), height = width/aspect;
  width /= zoom; height /= zoom;
  return {x:(iw-width)*focusX, y:(ih-height)*focusY, width, height};
}
function roundedScreenPath(context) {
  const {left:l,top:t,right:r,bottom:b,radius:d} = screen;
  context.beginPath(); context.moveTo(l+d,t);
  context.lineTo(r-d,t); context.quadraticCurveTo(r,t,r,t+d);
  context.lineTo(r,b-d); context.quadraticCurveTo(r,b,r-d,b);
  context.lineTo(l+d,b); context.quadraticCurveTo(l,b,l,b-d);
  context.lineTo(l,t+d); context.quadraticCurveTo(l,t,l+d,t); context.closePath();
}
// Trace the body only; the beige tabletop and original cast shadow are excluded.
function cameraPath(context) {
  context.beginPath(); context.moveTo(259,495);
  context.lineTo(263,239); context.quadraticCurveTo(264,210,285,208);
  context.lineTo(414,209); context.quadraticCurveTo(415,204,422,204);
  context.lineTo(514,204); context.quadraticCurveTo(520,204,522,210);
  context.lineTo(738,208); context.quadraticCurveTo(775,200,803,207);
  context.quadraticCurveTo(810,210,809,231);
  context.quadraticCurveTo(818,233,819,254); context.lineTo(822,496);
  context.quadraticCurveTo(823,519,804,524); context.lineTo(280,521);
  context.quadraticCurveTo(258,520,259,495); context.closePath();
}
function prepareCameraOverlay() {
  const overlay = cameraOverlay.getContext('2d');
  overlay.clearRect(0,0,cameraOverlay.width,cameraOverlay.height);
  overlay.save(); overlay.scale(2,2);
  cameraPath(overlay); overlay.clip();
  overlay.drawImage(template,0,0,1080,720);
  overlay.globalCompositeOperation = 'destination-out';
  roundedScreenPath(overlay); overlay.fill(); overlay.restore();
}
function render(target, W, H) {
  if (!photo || !template) return;
  target.imageSmoothingEnabled = true; target.imageSmoothingQuality = 'high';
  const topHeight = Math.round(H/2), bottomHeight = H-topHeight;
  const screenCrop = cropFor(photo, 1080, 720);
  frameCtx.clearRect(0,0,1080,720);
  frameCtx.drawImage(photo,screenCrop.x,screenCrop.y,screenCrop.width,screenCrop.height,0,0,1080,720);
  // Blurred backdrop, computed at fixed resolution so every export matches.
  if (background.width !== W || background.height !== topHeight) { background.width = W; background.height = topHeight; }
  const bgCrop = cropFor(photo, W, topHeight);
  backgroundCtx.save();
  backgroundCtx.filter = `blur(${28*W/1080}px)`;
  backgroundCtx.drawImage(photo,bgCrop.x,bgCrop.y,bgCrop.width,bgCrop.height,-W*.09,-topHeight*.09,W*1.18,topHeight*1.18);
  backgroundCtx.restore();
  target.drawImage(background,0,0);
  target.fillStyle = 'rgba(0,0,0,.12)'; target.fillRect(0,0,W,topHeight);
  // Fixed width unless the panel is too short to keep the whole camera body.
  const s = Math.min(W/1080, topHeight/CAMERA_BAND);
  const srcHeight = Math.min(720, topHeight/s);
  const srcY = Math.max(0, Math.min(720-srcHeight, 362-srcHeight/2));
  const ox = (W-1080*s)/2, oy = (topHeight-srcHeight*s)/2;
  target.save();
  target.shadowColor = 'rgba(0,0,0,.38)'; target.shadowBlur = 22*s; target.shadowOffsetY = 14*s;
  target.setTransform(s,0,0,s, ox, oy-srcY*s);
  target.fillStyle = '#171916'; cameraPath(target); target.fill();
  target.restore();
  const {left,top,right,bottom} = screen;
  target.save();
  target.setTransform(s,0,0,s, ox, oy-srcY*s);
  target.save(); roundedScreenPath(target); target.clip();
  target.drawImage(frame,left,top,right-left,bottom-top);
  // A narrow inset shadow seats the picture behind the physical screen rim.
  const topShade = target.createLinearGradient(0,top,0,top+4);
  topShade.addColorStop(0,'rgba(0,0,0,.30)'); topShade.addColorStop(1,'rgba(0,0,0,0)');
  target.fillStyle = topShade; target.fillRect(left,top,right-left,4);
  const bottomShade = target.createLinearGradient(0,bottom-3,0,bottom);
  bottomShade.addColorStop(0,'rgba(0,0,0,0)'); bottomShade.addColorStop(1,'rgba(0,0,0,.22)');
  target.fillStyle = bottomShade; target.fillRect(left,bottom-3,right-left,3);
  target.restore(); target.restore();
  target.drawImage(cameraOverlay,0,srcY*2,2160,srcHeight*2,ox,oy,1080*s,srcHeight*s);
  // Lower panel: the same photo, cover-cropped to this panel's aspect.
  const crop = cropFor(photo, W, bottomHeight);
  target.drawImage(photo,crop.x,crop.y,crop.width,crop.height,0,topHeight,W,bottomHeight);
}
function setPreviewSize() {
  const [w,h] = $('size').value.split('x').map(Number);
  const k = Math.min(1, 1440/Math.max(w,h));
  canvas.width = Math.round(w*k); canvas.height = Math.round(h*k);
  const gcd = (a,b) => b ? gcd(b,a%b) : a;
  const divisor = gcd(w,h);
  $('ratio-label').textContent = `成品比例 / ${w/divisor}:${h/divisor}`;
}
function sync() {
  $('zoom').value = zoom; $('zoom-value').textContent = `${Math.round(zoom*100)}%`;
  $('horizontal').value = focusX*100; $('vertical').value = focusY*100;
  render(ctx, canvas.width, canvas.height);
}
function reset() { zoom = 1; focusX = focusY = .5; sync(); }
async function selectFile(file) {
  if (!file) return;
  const version = ++loadVersion;
  const url = URL.createObjectURL(file);
  try {
    const image = await loadImage(url);
    if (version !== loadVersion) return;
    photo = image; $('filename').textContent = `${file.name} · ${image.naturalWidth} × ${image.naturalHeight}`; reset();
  } catch(error) { if (version === loadVersion) notify(error.message); }
  finally { URL.revokeObjectURL(url); $('file').value = ''; }
}
$('file').addEventListener('change',e => selectFile(e.target.files[0]));
const dropzone = $('dropzone');
['dragenter','dragover'].forEach(type => dropzone.addEventListener(type,e => {e.preventDefault();dropzone.classList.add('dragging');}));
['dragleave','drop'].forEach(type => dropzone.addEventListener(type,e => {e.preventDefault();dropzone.classList.remove('dragging');}));
dropzone.addEventListener('drop',e => selectFile(e.dataTransfer.files[0]));
window.addEventListener('dragover',e => e.preventDefault());
window.addEventListener('drop',e => e.preventDefault());
$('zoom').addEventListener('input',e => {zoom = Number(e.target.value);sync();});
$('horizontal').addEventListener('input',e => {focusX = Number(e.target.value)/100;sync();});
$('vertical').addEventListener('input',e => {focusY = Number(e.target.value)/100;sync();});
$('reset').addEventListener('click',reset);
$('size').addEventListener('change',() => {setPreviewSize();sync();});
$('sample').addEventListener('click', async () => {
  const version = ++loadVersion;
  const image = await loadImage(window.TEMPLATE_ASSETS.sample);
  if (version !== loadVersion) return;
  photo = image; $('filename').textContent = '月牙与夜航 · 示例照片'; reset();
});
canvas.addEventListener('pointerdown',e => {
  if (!photo) return;
  const bounds = canvas.getBoundingClientRect();
  if ((e.clientY-bounds.top)/bounds.height < .5) return;
  const crop = cropFor(photo, canvas.width, canvas.height-Math.round(canvas.height/2));
  drag = {x:e.clientX,y:e.clientY,px:focusX,py:focusY,crop,displayScale:bounds.width/canvas.width};
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove',e => {
  if (!drag) return;
  const imagePerClient = drag.crop.width/(drag.displayScale*canvas.width);
  const freeX = photo.naturalWidth-drag.crop.width, freeY = photo.naturalHeight-drag.crop.height;
  const clamp = x => Math.min(1,Math.max(0,x));
  if (freeX > .001) focusX = clamp(drag.px-(e.clientX-drag.x)*imagePerClient/freeX);
  if (freeY > .001) focusY = clamp(drag.py-(e.clientY-drag.y)*imagePerClient/freeY);
  sync();
});
['pointerup','pointercancel','lostpointercapture'].forEach(type => canvas.addEventListener(type,() => {drag = null;}));
$('download').addEventListener('click',() => {
  if (!photo || !template) return;
  const [w,h] = $('size').value.split('x').map(Number);
  const output = document.createElement('canvas'); output.width = w; output.height = h;
  const type = $('format').value;
  $('download').disabled = true;
  try {
    render(output.getContext('2d'),w,h);
    output.toBlob(blob => {
      $('download').disabled = false;
      if (!blob) {notify('导出失败，请重试。');return;}
      const url = URL.createObjectURL(blob), a = document.createElement('a');
      a.href = url; a.download = `frame-lab-${w}x${h}-${Date.now()}.${type === 'image/png' ? 'png' : 'jpg'}`;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url),60000);
      notify(`已生成 ${w} × ${h} 拼图，下载已开始。`);
    },type,.95);
  } catch (error) { $('download').disabled = false; notify(`导出失败：${error.message}`); }
});
(async () => {
  $('download').disabled = true;
  try { [template,photo] = await Promise.all([loadImage(window.TEMPLATE_ASSETS.template),loadImage(window.TEMPLATE_ASSETS.sample)]);prepareCameraOverlay();setPreviewSize();sync();$('download').disabled = false; }
  catch(error) {notify(error.message);}
})();
