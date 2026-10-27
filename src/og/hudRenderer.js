// Authentic 1996 Road Rash Cockpit HUD Renderer (matching hud.cpp::compose)
// Renders BIGMETER.RRI behind the cockpit cutouts (134,424 / 292,380 / 456,424),
// blits DASH_RAT / DASH_SPORT / DASH_SUPER over top, draws perspective elliptical needles,
// RRBadloc LCD odometer/place/names, and equipped weapon / gear / nitro / cop status!

export class HudRenderer {
  constructor(assets) {
    this.assets = assets;
    this.mode = 0; // 0 = Full Cockpit, 1 = Mini Speedo, 2 = Off (F10 / H cycles)
  }

  cycleMode() {
    this.mode = (this.mode + 1) % 3;
    return this.mode;
  }

  render(ctx, sim, dashImg) {
    ctx.save();

    this.drawRaceBanners(ctx, sim);

    if (this.mode === 2) {
      ctx.restore();
      return;
    }

    const p = sim.player;
    const speedMph = Math.round(p.speedMph);

    if (this.mode === 1) {
      this.drawBadlocBox(ctx, `${speedMph} MPH`, 18, 436, 180, 36, 28, '#ffffff', 'left');
      this.drawBadlocBox(ctx, `#${sim.playerPlace}/15`, 520, 436, 102, 36, 28, '#ffff00', 'right');
      ctx.restore();
      return;
    }

    const bm = this.assets.bigMeterOpaque || this.assets.bigMeter;
    const opp = sim.nearestRival;

    // 1. Draw the 3 meters BEHIND the dashboard cutouts (hud.cpp lines 284-305)
    if (bm) {
      const stamVal = Math.max(0, Math.min(31, Math.round((p.stamina / p.maxStamina) * 31)));
      const condVal = Math.max(0, Math.min(31, Math.round((p.bikeCond / p.maxBikeCond) * 31)));
      const oppVal = opp
        ? Math.max(0, Math.min(31, Math.round((opp.stamina / opp.maxStamina) * 31)))
        : 0;

      // Vertical Player Stamina at (134, 424)
      ctx.drawImage(bm, 11, 0, 51, 31, 134, 424, 51, 31);
      if (31 - stamVal > 0) {
        ctx.drawImage(bm, 11, 32, 51, 31 - stamVal, 134, 424, 51, 31 - stamVal);
      }

      // Horizontal Bike Condition at (292, 380)
      ctx.drawImage(bm, 62, 16, 64, 18, 292, 380, 64, 18);
      if (condVal > 0) {
        ctx.drawImage(bm, 62, 0, condVal * 2, 16, 293, 381, condVal * 2, 16);
      }

      // Vertical Nearest-Opponent Stamina at (456, 424)
      ctx.drawImage(bm, 11, 0, 51, 31, 456, 424, 51, 31);
      if (31 - oppVal > 0) {
        ctx.drawImage(bm, 11, 32, 51, 31 - oppVal, 456, 424, 51, 31 - oppVal);
      }
    }

    // 2. Blit authentic 640x119/122 dashboard PNG over the meter cutouts
    if (dashImg) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(dashImg, 0, 480 - dashImg.height);
    }

    // 3. Elliptical perspective gauge needles (Speedo @ 250,449; 6-Speed Tach @ 388,441)
    const speedFrac = Math.max(0, Math.min(1.08, speedMph / 185));
    const speedAngle = -2.28 + speedFrac * 4.56;
    this.drawNeedle(ctx, 250, 449, 44, 28, speedAngle);

    const rpmFrac = Math.max(0.05, Math.min(1.05, p.rpmNorm));
    const rpmAngle = -2.28 + rpmFrac * 4.48;
    this.drawNeedle(ctx, 388, 441, 28, 20, rpmAngle);

    // 4. Authentic Badloc LCD & name readouts matching hudLayout
    this.drawBadlocBox(ctx, sim.config.playerName, 4, 447, 164, 30, 24, '#ffff00', 'right');
    this.drawBadlocBox(ctx, String(sim.playerPlace), 16, 399, 624, 30, 25, '#ffffff', 'center');

    // Odometer Distance (tenths of a mile: 33 samples = 0.1 mi, matching hud.cpp!)
    const tenths = Math.max(0, Math.floor((p.sample - sim.startSample) / 33));
    const distStr = `${String(Math.floor(tenths / 10)).padStart(2, '0')}.${tenths % 10}`;
    this.drawBadlocBox(ctx, distStr, 0, 452, 345, 28, 22, '#ffffff', 'right');

    // Nearest / Focused Opponent Name + Gap + Up/Down Arrow
    if (opp) {
      this.drawBadlocBox(ctx, opp.name, 472, 447, 164, 30, 24, '#ffffff', 'left');
      const dSamples = opp.sample - p.sample;
      const ahead = dSamples >= 0;
      const gapMiles = Math.min(9.999, Math.abs(dSamples) / 330);
      const gapStr = gapMiles.toFixed(3);
      const gapColor = ahead ? '#e71000' : '#28a31c';
      this.drawBadlocBox(ctx, gapStr, 436, 394, 196, 28, 22, gapColor, 'left');
      this.drawGapArrow(ctx, 420, ahead ? 401 : 403, ahead);
    }

    // 5. Compact top-left status badges (Miles Left, Gear, Equipped Weapon, Nitro)
    const milesLeft = Math.max(0, (sim.finishSample - p.sample) / 330).toFixed(1);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.56)';
    ctx.fillRect(8, 8, 178, 24);
    this.drawSmallText(ctx, `LEFT: ${milesLeft} MI • GEAR ${p.gear}`, 14, 12, '#defff0');

    let badgeX = 192;
    if (p.weapon > 0) {
      const wName = p.weapon === 1 ? 'CLUB' : 'CHAIN';
      ctx.fillStyle = 'rgba(185, 62, 16, 0.85)';
      ctx.fillRect(badgeX, 8, 56, 24);
      this.drawSmallText(ctx, wName, badgeX + 7, 12, '#ffff60');
      badgeX += 60;
    }
    if (p.nitroCharges > 0 || p.nitroTicks > 0) {
      ctx.fillStyle = p.nitroTicks > 0 ? 'rgba(30, 160, 255, 0.90)' : 'rgba(15, 50, 100, 0.80)';
      ctx.fillRect(516, 36, 116, 22);
      this.drawSmallText(
        ctx,
        p.nitroTicks > 0 ? `BOOST! (${p.nitroCharges})` : `NITRO [N]: ${p.nitroCharges}`,
        523,
        39,
        p.nitroTicks > 0 ? '#ffffff' : '#99eeff'
      );
    }

    // Police siren alert pill on top-right when cop is pursuing
    if (sim.activeCop && sim.activeCop.chasing) {
      const flash = Math.floor(sim.ticks / 6) % 2 === 0;
      ctx.fillStyle = flash ? 'rgba(205, 22, 22, 0.86)' : 'rgba(22, 75, 215, 0.86)';
      ctx.fillRect(508, 8, 124, 24);
      this.drawSmallText(ctx, `COP: ${sim.activeCop.name.toUpperCase()}`, 516, 12, '#ffffff');
    }

    ctx.restore();
  }

  drawNeedle(ctx, cx, cy, rx, ry, angle) {
    const ex = cx + Math.sin(angle) * rx;
    const ey = cy - Math.cos(angle) * ry;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#250402';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cx + 1, cy + 1);
    ctx.lineTo(ex + 1, ey + 1);
    ctx.stroke();

    ctx.strokeStyle = '#d42014';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(ex, ey);
    ctx.stroke();
  }

  drawGapArrow(ctx, x, y, up) {
    const drawShape = (ox, oy, color) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      if (up) {
        ctx.moveTo(ox + 6, oy);
        ctx.lineTo(ox + 12, oy + 6);
        ctx.lineTo(ox + 8, oy + 6);
        ctx.lineTo(ox + 8, oy + 12);
        ctx.lineTo(ox + 4, oy + 12);
        ctx.lineTo(ox + 4, oy + 6);
        ctx.lineTo(ox, oy + 6);
      } else {
        ctx.moveTo(ox + 4, oy);
        ctx.lineTo(ox + 8, oy);
        ctx.lineTo(ox + 8, oy + 6);
        ctx.lineTo(ox + 12, oy + 6);
        ctx.lineTo(ox + 6, oy + 12);
        ctx.lineTo(ox, oy + 6);
        ctx.lineTo(ox + 4, oy + 6);
      }
      ctx.closePath();
      ctx.fill();
    };
    drawShape(x + 2, y + 2, '#000000');
    drawShape(x, y, '#ffffff');
  }

  drawBadlocBox(ctx, text, x, y, w, h, pxSize, color, align = 'left') {
    ctx.font = `${pxSize}px RRBadloc, sans-serif`;
    ctx.textBaseline = 'top';
    ctx.textAlign = align;
    const tx = align === 'center' ? x + w * 0.5 : align === 'right' ? x + w : x;
    ctx.fillStyle = '#000000';
    ctx.fillText(text, tx + 2, y + 2);
    ctx.fillStyle = color;
    ctx.fillText(text, tx, y);
  }

  drawSmallText(ctx, text, x, y, color) {
    ctx.font = '13px RRFuturaBold, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#000000';
    ctx.fillText(text, x + 1, y + 1);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }

  drawRaceBanners(ctx, sim) {
    if (sim.countdownTicks > 0) {
      const sec = Math.ceil(sim.countdownTicks / 60);
      const label = sec >= 1 ? String(sec) : 'GO!';
      this.drawBadlocBox(ctx, label, 0, 120, 640, 80, 68, '#ff6432', 'center');
    } else if (sim.goBannerTicks > 0) {
      this.drawBadlocBox(ctx, 'RASH ON!', 0, 118, 640, 80, 56, '#ffff40', 'center');
    }

    if (sim.bannerText && sim.bannerTicks > 0) {
      this.drawBadlocBox(ctx, sim.bannerText, 0, 66, 640, 50, 34, sim.bannerColor || '#ffff40', 'center');
    }

    if (sim.player.state === 'running') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
      ctx.fillRect(145, 38, 350, 26);
      this.drawSmallText(ctx, 'SPRINTING BACK TO YOUR DOWNED BIKE!', 175, 44, '#ffff55');
    }

    if (sim.paused) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.66)';
      ctx.fillRect(0, 0, 640, 480);
      this.drawBadlocBox(ctx, 'RACE PAUSED', 0, 118, 640, 64, 52, '#ff6432', 'center');

      const opts = ['Resume Race (ESC)', 'Restart Race (R)', 'Quit to Menu (Q)'];
      for (let i = 0; i < opts.length; i++) {
        const bx = 190;
        const by = 205 + i * 44;
        ctx.fillStyle = i === sim.pauseFocus ? 'rgba(255, 100, 50, 0.35)' : 'rgba(20, 20, 20, 0.8)';
        ctx.fillRect(bx, by, 260, 34);
        ctx.strokeStyle = i === sim.pauseFocus ? '#ffff00' : '#555';
        ctx.strokeRect(bx + 0.5, by + 0.5, 259, 33);
        this.drawBadlocBox(
          ctx,
          opts[i],
          bx,
          by + 5,
          260,
          30,
          22,
          i === sim.pauseFocus ? '#ffff00' : '#defff0',
          'center'
        );
      }
    }
  }
}
