export const frameSize = 128;
export const frameCount = 8;
export const motions = Object.freeze({
  idle: { row: 0, fps: 6, loop: true },
  walk: { row: 1, fps: 9, loop: true },
  run: { row: 2, fps: 15, loop: true },
  block: { row: 3, fps: 10, loop: false },
  punch: { row: 4, fps: 13, loop: false },
  jump: { row: 5, fps: 12, loop: false },
  die: { row: 6, fps: 12, loop: false },
});

export function motionFrame(action, elapsed) {
  const { fps, loop } = motions[action];
  const step = Math.floor(Math.max(0, elapsed) * fps / 1000);
  return loop ? step % frameCount : Math.min(step, frameCount - 1);
}

export function drawMotion(canvas, image, action, frame, flip = false, x = 0) {
  const context = canvas.getContext('2d');
  const size = canvas.height;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.save();
  context.imageSmoothingEnabled = false;
  context.translate(canvas.width / 2 + x, canvas.height);
  context.scale(flip ? -1 : 1, 1);
  context.drawImage(image, frame * frameSize, motions[action].row * frameSize,
    frameSize, frameSize, -size / 2, -size, size, size);
  context.restore();
}
