'use strict';
const $ = id => document.getElementById(id);
const canvas = $('preview'), ctx = canvas.getContext('2d');
const frame = document.createElement('canvas');
frame.width = 1080; frame.height = 720;
const frameCtx = frame.getContext('2d');
let template, photo, zoom = 1, positionX = .5, positionY = .5, loadVersion = 0, drag, toastTimer;
// LCD opening, measured in the original 1080 × 720 template.
// Keep the surrounding glass lip and bezel above the replacement photograph.
const screen = {left:276, top:243, right:660, bottom:499, radius:2.5};
const cameraOverlay = document.createElement('canvas');
cameraOverlay.width = 2160; cameraOverlay.height = 1440;
function screenPath(context) {
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
const background = document.createElement('canvas');
background.width = 1080; background.height = 720;
const backgroundCtx = background.getContext('2d');
function prepareCameraOverlay() {
  const overlay = cameraOverlay.getContext('2d');
  overlay.clearRect(0,0,cameraOverlay.width,cameraOverlay.height);
  overlay.save(); overlay.scale(2,2);
  cameraPath(overlay); overlay.clip();
  overlay.drawImage(template,0,0,1080,720);
  overlay.globalCompositeOperation = 'destination-out';
  screenPath(overlay); overlay.fill(); overlay.restore();
}
function notify(message) { $('status').textContent = message; clearTimeout(toastTimer); toastTimer = setTimeout(() => $('status').textContent = '', 4500); }
function loadImage(src) { return new Promise((resolve,reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error('无法读取图片，请换用 JPG、PNG 或 WebP 图片。')); img.src = src; }); }
function cropRect() {
  const ratio = Math.max(1080 / photo.naturalWidth, 720 / photo.naturalHeight) * zoom;
  const width = 1080 / ratio, height = 720 / ratio;
  return {x:(photo.naturalWidth-width)*positionX,y:(photo.naturalHeight-height)*positionY,width,height};
}
function render(target = ctx, scale = 1) {
  if (!photo || !template) return;
  const crop = cropRect();
  frameCtx.drawImage(photo,crop.x,crop.y,crop.width,crop.height,0,0,1080,720);
  target.save(); target.scale(scale,scale); target.imageSmoothingEnabled = true; target.imageSmoothingQuality = 'high';
  // Blur at a fixed resolution so preview and both export sizes match.
  backgroundCtx.save();
  backgroundCtx.filter = 'blur(32px)';
  backgroundCtx.drawImage(frame,-108,-72,1296,864);
  backgroundCtx.restore();
  target.drawImage(background,0,0,1080,720);
  target.fillStyle = 'rgba(0,0,0,.12)'; target.fillRect(0,0,1080,720);
  target.save();
  target.shadowColor = 'rgba(0,0,0,.38)'; target.shadowBlur = 22*scale;
  target.shadowOffsetY = 14*scale;
  target.fillStyle = '#171916'; cameraPath(target); target.fill();
  target.restore();
  const {left,top,right,bottom} = screen;
  // Extend behind the bezel so antialiased edges cannot expose the old photo.
  target.drawImage(frame,left-1,top-1,right-left+2,bottom-top+2);
  target.save(); screenPath(target); target.clip();
  // A narrow inset shadow seats the picture behind the physical screen rim.
  const topShade = target.createLinearGradient(0,top,0,top+4);
  topShade.addColorStop(0,'rgba(0,0,0,.30)'); topShade.addColorStop(1,'rgba(0,0,0,0)');
  target.fillStyle = topShade; target.fillRect(left,top,right-left,4);
  const bottomShade = target.createLinearGradient(0,bottom-3,0,bottom);
  bottomShade.addColorStop(0,'rgba(0,0,0,0)'); bottomShade.addColorStop(1,'rgba(0,0,0,.22)');
  target.fillStyle = bottomShade; target.fillRect(left,bottom-3,right-left,3);
  target.restore();
  target.drawImage(cameraOverlay,0,0,1080,720);
  target.drawImage(frame,0,720); target.restore();
}
function sync() {
  $('zoom').value = zoom; $('zoom-value').textContent = `${Math.round(zoom*100)}%`;
  $('horizontal').value = positionX*100; $('vertical').value = positionY*100; render();
}
function reset() { zoom = 1; positionX = positionY = .5; sync(); }
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
$('horizontal').addEventListener('input',e => {positionX = Number(e.target.value)/100;sync();});
$('vertical').addEventListener('input',e => {positionY = Number(e.target.value)/100;sync();});
$('reset').addEventListener('click',reset);
$('sample').addEventListener('click', async () => {
  const version = ++loadVersion;
  const image = await loadImage(window.TEMPLATE_ASSETS.sample);
  if (version !== loadVersion) return;
  photo = image; $('filename').textContent = '南瓜与午后阳光 · 示例照片'; reset();
});
canvas.addEventListener('pointerdown',e => {
  if (!photo) return;
  const bounds = canvas.getBoundingClientRect();
  if ((e.clientY-bounds.top)/bounds.height < .5) return;
  const crop = cropRect();
  drag = {x:e.clientX,y:e.clientY,px:positionX,py:positionY,crop,displayScale:bounds.width/1080};
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove',e => {
  if (!drag) return;
  const ratio = 1080/drag.crop.width*drag.displayScale;
  const freeX = photo.naturalWidth-drag.crop.width, freeY = photo.naturalHeight-drag.crop.height;
  const clamp = x => Math.min(1,Math.max(0,x));
  if (freeX > .001) positionX = clamp(drag.px-(e.clientX-drag.x)/ratio/freeX);
  if (freeY > .001) positionY = clamp(drag.py-(e.clientY-drag.y)/ratio/freeY);
  sync();
});
['pointerup','pointercancel','lostpointercapture'].forEach(type => canvas.addEventListener(type,() => {drag = null;}));
$('download').addEventListener('click',() => {
  if (!photo || !template) return;
  const output = document.createElement('canvas'); output.width = Number($('size').value); output.height = output.width*4/3;
  const type = $('format').value;
  $('download').disabled = true;
  try {
    render(output.getContext('2d'),output.width/1080);
    output.toBlob(blob => {
      $('download').disabled = false;
      if (!blob) {notify('导出失败，请重试。');return;}
      const url = URL.createObjectURL(blob), a = document.createElement('a');
      a.href = url; a.download = `frame-lab-${Date.now()}.${type === 'image/png' ? 'png' : 'jpg'}`;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url),60000);
      notify('拼图已生成，下载已开始。');
    },type,.95);
  } catch (error) { $('download').disabled = false; notify(`导出失败：${error.message}`); }
});
(async () => {
  $('download').disabled = true;
  try { [template,photo] = await Promise.all([loadImage(window.TEMPLATE_ASSETS.template),loadImage(window.TEMPLATE_ASSETS.sample)]);prepareCameraOverlay();render();$('download').disabled = false; }
  catch(error) {notify(error.message);}
})();
