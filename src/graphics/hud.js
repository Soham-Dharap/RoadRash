// Exact 1996 Windows PC Road Rash Sculpted Fairing Dashboard HUD Renderer
// Matches Screenshots 2, 3, and 5 down to the V-notch cowling, analog dials, curved stamina arcs & digital slots!

export class DashboardHUD {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.baseCanvas = document.createElement('canvas');
    this.baseDirty = true;
    this.lastW = 0;
    this.lastH = 0;
  }

  resize(w, h) {
    if (w === this.lastW && h === this.lastH) return;
    this.canvas.width = w;
    this.canvas.height = h;
    this.lastW = w;
    this.lastH = h;
    this.baseDirty = true;
  }

  buildCowlingBase(w, h) {
    this.baseCanvas.width = w;
    this.baseCanvas.height = h;
    const ctx = this.baseCanvas.getContext('2d');
    ctx.clearRect(0, 0, w, h);

    const dashW = Math.min(w * 0.92, h * 1.48);
    const dashH = Math.round(h * 0.245);
    const cx = w * 0.5;
    const topY = h - dashH;

    this.metrics = { dashW, dashH, cx, topY };

    // Outer sculpted dark motorcycle fairing cowl with center split V-notch! (Screenshot 2!)
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx - dashW * 0.5, h);
    ctx.quadraticCurveTo(cx - dashW * 0.42, topY + dashH * 0.25, cx - dashW * 0.16, topY + dashH * 0.06);
    ctx.lineTo(cx - dashW * 0.025, topY + dashH * 0.02);
    ctx.lineTo(cx, topY + dashH * 0.14); // Iconic V-split notch in center of windscreen!
    ctx.lineTo(cx + dashW * 0.025, topY + dashH * 0.02);
    ctx.lineTo(cx + dashW * 0.16, topY + dashH * 0.06);
    ctx.quadraticCurveTo(cx + dashW * 0.42, topY + dashH * 0.25, cx + dashW * 0.5, h);
    ctx.closePath();

    const cowlGrad = ctx.createLinearGradient(0, topY, 0, h);
    cowlGrad.addColorStop(0, '#36393f');
    cowlGrad.addColorStop(0.18, '#1e2026');
    cowlGrad.addColorStop(0.65, '#13151a');
    cowlGrad.addColorStop(1, '#090a0d');
    ctx.fillStyle = cowlGrad;
    ctx.fill();

    // Sculpted metallic top rim highlight
    ctx.lineWidth = Math.max(2, h * 0.005);
    ctx.strokeStyle = '#575c66';
    ctx.stroke();

    // Inner recessed instrument cluster housing
    ctx.beginPath();
    ctx.moveTo(cx - dashW * 0.43, h);
    ctx.quadraticCurveTo(cx - dashW * 0.35, topY + dashH * 0.36, cx - dashW * 0.14, topY + dashH * 0.18);
    ctx.lineTo(cx + dashW * 0.14, topY + dashH * 0.18);
    ctx.quadraticCurveTo(cx + dashW * 0.35, topY + dashH * 0.36, cx + dashW * 0.43, h);
    ctx.closePath();
    ctx.fillStyle = '#0d0f13';
    ctx.fill();
    ctx.strokeStyle = '#2b2f38';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Pre-draw Speedometer (Left) & Tachometer (Right) static cream/silver dial faces!
    const dialR = dashH * 0.31;
    const speedX = cx - dashW * 0.118;
    const speedY = topY + dashH * 0.65;
    const tachX = cx + dashW * 0.118;
    const tachY = topY + dashH * 0.65;

    this.metrics.dialR = dialR;
    this.metrics.speedX = speedX;
    this.metrics.speedY = speedY;
    this.metrics.tachX = tachX;
    this.metrics.tachY = tachY;

    this.drawStaticDial(ctx, speedX, speedY, dialR, [0, 80, 160, 240, 320], 'km/h', '#ebe6d5');
    this.drawStaticDial(ctx, tachX, tachY, dialR * 0.94, [0, 3, 6, 9, 12], 'RPM x 1000', '#ddd8c7', true);

    ctx.restore();
    this.baseDirty = false;
  }

  drawStaticDial(ctx, x, y, r, labels, unitText, faceColor, redline = false) {
    // Bezel ring
    ctx.save();
    const bezel = ctx.createRadialGradient(x - r * 0.2, y - r * 0.2, r * 0.5, x, y, r * 1.12);
    bezel.addColorStop(0, '#6b7280');
    bezel.addColorStop(0.7, '#27272a');
    bezel.addColorStop(1, '#09090b');
    ctx.fillStyle = bezel;
    ctx.beginPath();
    ctx.arc(x, y, r * 1.1, 0, Math.PI * 2);
    ctx.fill();

    // Cream analog face (exact match to Screenshot 2!)
    const face = ctx.createRadialGradient(x, y - r * 0.25, r * 0.1, x, y, r);
    face.addColorStop(0, '#f7f4e8');
    face.addColorStop(0.78, faceColor);
    face.addColorStop(1, '#a8a290');
    ctx.fillStyle = face;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    const startAng = Math.PI * 0.82;
    const endAng = Math.PI * 2.18;

    // Redline arc on tachometer (9.5k -> 12k)
    if (redline) {
      ctx.strokeStyle = '#dc2626';
      ctx.lineWidth = Math.max(2, r * 0.08);
      ctx.beginPath();
      ctx.arc(x, y, r * 0.86, startAng + (endAng - startAng) * 0.78, endAng);
      ctx.stroke();
    }

    // Tick marks & numbers
    const steps = 16;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const a = startAng + t * (endAng - startAng);
      const major = i % 4 === 0;
      ctx.strokeStyle = '#18181b';
      ctx.lineWidth = major ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * r * (major ? 0.74 : 0.83), y + Math.sin(a) * r * (major ? 0.74 : 0.83));
      ctx.lineTo(x + Math.cos(a) * r * 0.94, y + Math.sin(a) * r * 0.94);
      ctx.stroke();
    }

    ctx.fillStyle = '#111827';
    ctx.font = `bold ${Math.max(8, Math.round(r * 0.23))}px "Arial Narrow", Impact, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    labels.forEach((num, idx) => {
      const t = idx / (labels.length - 1);
      const a = startAng + t * (endAng - startAng);
      ctx.fillText(String(num), x + Math.cos(a) * r * 0.54, y + Math.sin(a) * r * 0.54);
    });

    ctx.font = `bold ${Math.max(7, Math.round(r * 0.17))}px sans-serif`;
    ctx.fillText(unitText, x, y + r * 0.58);
    ctx.restore();
  }

  drawNeedle(ctx, x, y, r, ratio) {
    const clamped = Math.max(0, Math.min(1.03, ratio));
    const startAng = Math.PI * 0.82;
    const endAng = Math.PI * 2.18;
    const ang = startAng + clamped * (endAng - startAng);

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    // Needle shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(-r * 0.16, 1, r * 0.98, 3);
    // Crisp red 1996 needle
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.moveTo(-r * 0.16, -2.2);
    ctx.lineTo(r * 0.84, -0.8);
    ctx.lineTo(r * 0.84, 0.8);
    ctx.lineTo(-r * 0.16, 2.2);
    ctx.closePath();
    ctx.fill();
    // Center cap
    ctx.fillStyle = '#27272a';
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(3, r * 0.12), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /**
   * Curved Far-Left & Far-Right Stamina Bars (Exact green->yellow->red angled bars in Screenshot 2!)
   */
  drawCurvedStamina(ctx, x, y, w, h, ratio, isRight, nameText, weaponLabel = '') {
    ctx.save();
    const tilt = isRight ? 0.34 : -0.34;
    ctx.translate(x, y);

    // Dark recessed curved slot
    ctx.save();
    ctx.transform(1, 0, tilt, 1, 0, 0);
    ctx.fillStyle = '#07080b';
    ctx.strokeStyle = '#3f4451';
    ctx.lineWidth = 2;
    ctx.fillRect(-w * 0.5 - 2, -h - 2, w + 4, h + 4);
    ctx.strokeRect(-w * 0.5 - 2, -h - 2, w + 4, h + 4);

    const pct = Math.max(0, Math.min(1, ratio));
    const fillH = h * pct;
    const grad = ctx.createLinearGradient(0, 0, 0, -h);
    grad.addColorStop(0, '#ef4444');
    grad.addColorStop(0.42, '#eab308');
    grad.addColorStop(1, '#22c55e');
    ctx.fillStyle = grad;
    ctx.fillRect(-w * 0.5, -fillH, w, fillH);
    ctx.restore();

    // Crisp condensed white rider name right below gauge (Mike / Charley / Mr. Moby / Sam!)
    ctx.font = `bold ${Math.max(13, Math.round(h * 0.44))}px "Arial Narrow", Impact, sans-serif`;
    ctx.textAlign = 'center';
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#000000';
    ctx.strokeText(nameText, tilt * -h * 0.25, h * 0.34);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(nameText, tilt * -h * 0.25, h * 0.34);

    if (weaponLabel && weaponLabel !== 'fist') {
      ctx.font = `bold ${Math.max(9, Math.round(h * 0.23))}px monospace`;
      ctx.fillStyle = '#facc15';
      ctx.strokeText(`[${weaponLabel.toUpperCase()}]`, tilt * -h * 0.25, h * 0.64);
      ctx.fillText(`[${weaponLabel.toUpperCase()}]`, tilt * -h * 0.25, h * 0.64);
    }
    ctx.restore();
  }

  render(state) {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, w, h);
    if (!state) return;

    if (this.baseDirty) this.buildCowlingBase(w, h);

    // 1. Optional Top Rearview Mirror (shows approaching rivals & flashing police cruisers behind!)
    if (state.mirrorOn) {
      this.drawRearMirror(ctx, w, h, state);
    }

    // 2. Cop Siren Strobe Vignette at top corners if cop is actively chasing close!
    if (state.copWarning > 0) {
      const flash = Math.sin(performance.now() * 0.022) > 0;
      ctx.fillStyle = flash ? 'rgba(239,68,68,0.22)' : 'rgba(59,130,246,0.22)';
      ctx.fillRect(0, 0, w, 6);
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = flash ? '#fca5a5' : '#93c5fd';
      ctx.fillText('★ POLICE PURSUIT IN MIRROR ★', w * 0.5, 22);
    }

    // 3. Action Callout Toast (Kick into car, Ramp Jump, Weapon Snatched, Pedestrian Hit!)
    if (state.callout && state.calloutTimer > 0) {
      const alpha = Math.min(1, state.calloutTimer * 1.6);
      ctx.save();
      ctx.globalAlpha = alpha;
      const cy = state.mirrorOn ? 78 : 42;
      ctx.font = `900 ${Math.max(16, Math.round(h * 0.036))}px Impact, "Arial Black", sans-serif`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#000000';
      ctx.strokeText(state.callout, w * 0.5, cy);
      ctx.fillStyle = state.calloutColor || '#facc15';
      ctx.fillText(state.callout, w * 0.5, cy);
      ctx.restore();
    }

    // 4. Countdown Banner ("3", "2", "1", "RASH IT!")
    if (state.countdownText) {
      ctx.save();
      ctx.font = `900 ${Math.round(h * 0.13)}px Impact, "Arial Black", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 7;
      ctx.strokeStyle = '#09090b';
      ctx.strokeText(state.countdownText, w * 0.5, h * 0.36);
      ctx.fillStyle = state.countdownText === 'RASH!' ? '#22c55e' : '#facc15';
      ctx.fillText(state.countdownText, w * 0.5, h * 0.36);
      ctx.restore();
    }

    // 5. Clean Widescreen Chase Cam Mode (Screenshot 1 & 4 style!) vs Full Cockpit Dashboard (Screenshot 2, 3, 5!)
    if (state.cameraMode === 1) {
      this.drawMinimalChaseHUD(ctx, w, h, state);
      return;
    }

    // Draw pre-baked 1996 Cockpit Fairing Cowling
    ctx.drawImage(this.baseCanvas, 0, 0);

    const { dashW, dashH, cx, topY, dialR, speedX, speedY, tachX, tachY } = this.metrics;

    // Top-center Horizontal Bike Condition / Damage Bar (Screenshot 2: [RED|YELLOW|GREEN])
    const dmgW = dashW * 0.145;
    const dmgH = Math.max(8, dashH * 0.075);
    const dmgX = cx - dmgW * 0.5;
    const dmgY = topY + dashH * 0.16;
    ctx.fillStyle = '#050608';
    ctx.strokeStyle = '#4b5563';
    ctx.lineWidth = 2;
    ctx.fillRect(dmgX - 2, dmgY - 2, dmgW + 4, dmgH + 4);
    ctx.strokeRect(dmgX - 2, dmgY - 2, dmgW + 4, dmgH + 4);

    const bikePct = Math.max(0, Math.min(1, state.bikeHealth / state.bikeMaxHealth));
    const dmgGrad = ctx.createLinearGradient(dmgX, 0, dmgX + dmgW, 0);
    dmgGrad.addColorStop(0, '#ef4444');
    dmgGrad.addColorStop(0.45, '#eab308');
    dmgGrad.addColorStop(1, '#22c55e');
    ctx.fillStyle = dmgGrad;
    ctx.fillRect(dmgX, dmgY, dmgW * bikePct, dmgH);

    // Center-Top Race Position Digital Slot ("14" / "1")
    const posBoxW = dashW * 0.085;
    const posBoxH = dashH * 0.19;
    ctx.fillStyle = '#06070a';
    ctx.strokeStyle = '#374151';
    ctx.beginPath();
    ctx.roundRect(cx - posBoxW * 0.5, topY + dashH * 0.28, posBoxW, posBoxH, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.round(posBoxH * 0.78)}px "Arial Narrow", Impact, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(state.position), cx, topY + dashH * 0.28 + posBoxH * 0.54);

    // Bottom-Center Distance Remaining Digital Slot ("05.5")
    const distBoxW = dashW * 0.105;
    const distBoxH = dashH * 0.19;
    const distY = h - distBoxH - dashH * 0.04;
    ctx.fillStyle = '#06070a';
    ctx.strokeStyle = '#374151';
    ctx.fillRect(cx - distBoxW * 0.5, distY, distBoxW, distBoxH);
    ctx.strokeRect(cx - distBoxW * 0.5, distY, distBoxW, distBoxH);

    const remKm = Math.max(0, state.remainingKm);
    const distStr = remKm.toFixed(1).padStart(4, '0');
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.round(distBoxH * 0.76)}px "Arial Narrow", Impact, sans-serif`;
    ctx.fillText(distStr, cx, distY + distBoxH * 0.54);

    // Upper-Right Red Gap Readout ("↑ 0.225") + Nitro Charges
    const splitX = tachX + dialR * 0.92;
    const splitY = topY + dashH * 0.34;
    ctx.font = `bold ${Math.max(12, Math.round(dashH * 0.135))}px "Arial Narrow", monospace`;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(state.gapAhead >= 0 ? '↑' : '↓', splitX - 14, splitY);
    ctx.fillStyle = '#ef4444';
    ctx.fillText(Math.abs(state.gapAhead).toFixed(3), splitX, splitY);

    // Nitro Pips (if bike has N2O)
    if (state.maxNitro > 0) {
      const pipY = topY + dashH * 0.18;
      ctx.font = `bold ${Math.max(9, Math.round(dashH * 0.08))}px monospace`;
      ctx.fillStyle = state.nitroActive ? '#38bdf8' : '#94a3b8';
      ctx.fillText('N2O', cx - dashW * 0.23, pipY + 4);
      for (let i = 0; i < state.maxNitro; i++) {
        ctx.fillStyle = i < state.nitroCharges ? '#38bdf8' : '#1e293b';
        ctx.fillRect(cx - dashW * 0.18 + i * 7, pipY - 3, 5, 8);
      }
    }

    // Speedometer & Tachometer Needles
    this.drawNeedle(ctx, speedX, speedY, dialR, state.speedKmh / 320);
    this.drawNeedle(ctx, tachX, tachY, dialR * 0.94, state.rpm / 12000);

    // Far-Left Player Stamina Gauge + Name & Far-Right Nearest Opponent Stamina Gauge + Name
    const stamH = dashH * 0.38;
    const stamW = Math.max(14, dashW * 0.032);
    this.drawCurvedStamina(
      ctx,
      cx - dashW * 0.295,
      topY + dashH * 0.78,
      stamW,
      stamH,
      state.playerStamina / 100,
      false,
      state.playerName,
      state.playerWeapon
    );

    if (state.nearestRival) {
      this.drawCurvedStamina(
        ctx,
        cx + dashW * 0.295,
        topY + dashH * 0.78,
        stamW,
        stamH,
        state.nearestRival.stamina / 100,
        true,
        state.nearestRival.name,
        state.nearestRival.weapon
      );
    } else {
      this.drawCurvedStamina(ctx, cx + dashW * 0.295, topY + dashH * 0.78, stamW, stamH, 0, true, '---', '');
    }

    // On-Foot Sprint Prompt if knocked off bike!
    if (state.playerState === 'running' || state.playerState === 'tumbling') {
      ctx.save();
      ctx.font = `bold ${Math.max(14, Math.round(h * 0.03))}px monospace`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fef08a';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 4;
      const msg =
        state.playerState === 'running'
          ? 'SPRINTING BACK TO YOUR BIKE! STEER [A/D] TO DODGE TRAFFIC & RASHERS!'
          : 'ROAD RASH WIPEOUT!';
      ctx.strokeText(msg, cx, topY - 16);
      ctx.fillText(msg, cx, topY - 16);
      ctx.restore();
    }
  }

  drawMinimalChaseHUD(ctx, w, h, state) {
    ctx.save();
    ctx.fillStyle = 'rgba(10,12,18,0.76)';
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2;
    ctx.fillRect(16, h - 72, 240, 56);
    ctx.strokeRect(16, h - 72, 240, 56);

    ctx.fillStyle = '#facc15';
    ctx.font = 'bold 24px Impact, sans-serif';
    ctx.fillText(`${Math.round(state.speedKmh)} KM/H`, 28, h - 42);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px monospace';
    ctx.fillText(`POS ${state.position}/15  •  ${state.remainingKm.toFixed(1)} KM`, 28, h - 22);

    if (state.nearestRival) {
      ctx.fillStyle = 'rgba(10,12,18,0.76)';
      ctx.fillRect(w - 226, h - 72, 210, 56);
      ctx.strokeRect(w - 226, h - 72, 210, 56);
      ctx.fillStyle = '#f8fafc';
      ctx.fillText(state.nearestRival.name, w - 214, h - 48);
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(w - 214, h - 34, 180 * Math.max(0, state.nearestRival.stamina / 100), 12);
    }
    ctx.restore();
  }

  drawRearMirror(ctx, w, h, state) {
    const mw = Math.min(230, w * 0.28);
    const mh = 44;
    const mx = (w - mw) * 0.5;
    const my = 10;

    ctx.save();
    ctx.fillStyle = '#6882d6';
    ctx.fillRect(mx, my, mw, mh * 0.5);
    ctx.fillStyle = '#52525b';
    ctx.fillRect(mx, my + mh * 0.5, mw, mh * 0.5);

    // Center dashed yellow in mirror
    ctx.fillStyle = '#eab308';
    ctx.fillRect(mx + mw * 0.49, my + mh * 0.5, 3, mh * 0.5);

    // Blips of riders / cops behind player (within 70m behind)
    if (state.behindBlips) {
      for (const blip of state.behindBlips) {
        const bx = mx + mw * (0.5 - (blip.x / 10) * 0.44);
        const scale = Math.max(0.28, 1 - blip.dist / 70);
        const bw = 10 * scale;
        const bh = 16 * scale;
        ctx.fillStyle = blip.isCop ? (Math.sin(performance.now() * 0.03) > 0 ? '#ef4444' : '#3b82f6') : blip.color;
        ctx.fillRect(bx - bw * 0.5, my + mh * 0.58 - bh * 0.4, bw, bh);
      }
    }

    ctx.strokeStyle = '#18181b';
    ctx.lineWidth = 3;
    ctx.strokeRect(mx, my, mw, mh);
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1;
    ctx.strokeRect(mx - 1, my - 1, mw + 2, mh + 2);
    ctx.restore();
  }
}
