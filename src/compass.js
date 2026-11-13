// Coordinates are relative to the upper-right corner of the field.
export function drawCompass(ctx, right, top, scale, northAngle) {
  ctx.save();
  ctx.translate(right, top);
  ctx.scale(scale, scale);
  ctx.translate(-19, 0);
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#fff';
  ctx.fillStyle = '#294531';
  ctx.strokeText('N', 0, 0);
  ctx.fillText('N', 0, 0);

  ctx.translate(0, 28);
  ctx.rotate(northAngle);
  ctx.beginPath();
  ctx.moveTo(0, -13);
  ctx.lineTo(6.5, 13);
  ctx.lineTo(0, 7);
  ctx.lineTo(-6.5, 13);
  ctx.closePath();
  ctx.stroke();
  ctx.fillStyle = '#314f3e';
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(0, -13);
  ctx.lineTo(6.5, 13);
  ctx.lineTo(0, 7);
  ctx.closePath();
  ctx.fillStyle = '#a2b59c';
  ctx.fill();
  ctx.restore();
}
