// Authentic 1996 Road Rash Cockpit HUD Renderer (matching hud.cpp::compose)
// Supports both 4:3 OG (640x480) and 16:9 Widescreen (854x480) without stretching gauges!
// Renders BIGMETER.RRI behind the cockpit cutouts, blits DASH_RAT / DASH_SPORT / DASH_SUPER,
// draws perspective elliptical needles, RRBadloc LCD odometer/place/names,
// unlocked OG Weapon indicator ([Q/E/1-4]), Nitro Boost, and Police Interceptor Radar!

import { OG_WEAPONS } from './raceSimulation.js';

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
    const viewW = ctx.canvas?.width || 640;
    const dashX = Math.floor((viewW - 640) * 0.5);

    ctx.save();

    this.drawRaceBanners(ctx, sim, viewW);

    if (this.mode === 2) {
      ctx.restore();
      return;
    }

    const p = sim.player;
    const speedMph = Math.round(p.speedMph);

    if (this.mode === 1) {
      this.drawBadlocBox(ctx, `${speedMph} MPH`, 18, 436, 180, 36, 28, '#ffffff', 'left');
      const rightLabel = sim.isPoliceMode
        ? `LEFT: ${sim.outlawsRemaining}/14`
        : `#${sim.playerPlace}/15`;
      this.drawBadlocBox(ctx, rightLabel, viewW - 220, 436, 202, 36, 28, '#ffff00', 'right');
      ctx.restore();
      return;
    }

    const bm = this.assets.bigMeterOpaque || this.assets.bigMeter;
    const bmNitro = this.assets.bigMeterNitro || this.assets.bigMeter;
    const opp = sim.nearestRival;

    // 1. Draw the 3 meters BEHIND the dashboard cutouts (hud.cpp:284-332, exact layout_ offsets 40, 45, 50)
    if (bm) {
      const stamVal = Math.max(0, Math.min(31, Math.round((p.stamina / p.maxStamina) * 31)));
      const condVal = Math.max(0, Math.min(31, Math.round((p.bikeCond / p.maxBikeCond) * 31)));
      const oppVal = opp
        ? Math.max(0, Math.min(31, Math.round((opp.stamina / opp.maxStamina) * 31)))
        : 0;

      // Vertical Player Stamina at (dashX + 134, 424)
      ctx.drawImage(bm, 11, 0, 51, 31, dashX + 134, 424, 51, 31);
      if (31 - stamVal > 0) {
        ctx.drawImage(bm, 11, 32, 51, 31 - stamVal, dashX + 134, 424, 51, 31 - stamVal);
      }

      // Horizontal Bike Condition at (dashX + 292, 380)
      ctx.drawImage(bm, 62, 16, 64, 18, dashX + 292, 380, 64, 18);
      if (condVal > 0) {
        ctx.drawImage(bm, 62, 0, condVal * 2, 16, dashX + 293, 381, condVal * 2, 16);
      }

      // Vertical Nearest-Opponent Stamina at (dashX + 456, 424)
      ctx.drawImage(bm, 11, 0, 51, 31, dashX + 456, 424, 51, 31);
      if (31 - oppVal > 0) {
        ctx.drawImage(bm, 11, 32, 51, 31 - oppVal, dashX + 456, 424, 51, 31 - oppVal);
      }
    }

    // 2. Blit authentic 640x119/121 dashboard PNG over the meter cutouts
    // (In 16:9 widescreen, outer road wings stay open & unobstructed per race_caches.hpp!)
    if (dashImg) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(dashImg, dashX, 480 - dashImg.height);
    }

    // 2b. Authentic 10-bulb Nitro LED Strip inside Superbike / Police Interceptor recessed bay
    // (bigmeter.png bulbs at x=62..172, y=44..64 with pure-blue (0,0,255) surround keyed out!)
    const isSuperDash = sim.isPoliceMode || p.stats?.cls === 'super';
    if (bmNitro && isSuperDash) {
      const maxBulbs = 10;
      const litBulbs = Math.max(
        0,
        Math.min(
          maxBulbs,
          Math.round((p.nitroCharges / Math.max(1, p.maxNitroCharges || 10)) * maxBulbs)
        )
      );
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(bmNitro, 62, 54, 110, 10, dashX + 271, 369, 110, 10);
      const showLit = p.nitroTicks > 0 ? ((sim.ticks >> 2) & 1 ? maxBulbs : litBulbs) : litBulbs;
      if (showLit > 0) {
        ctx.drawImage(bmNitro, 62, 44, showLit * 11, 10, dashX + 271, 369, showLit * 11, 10);
      }
    }

    // 3. Exact hud.cpp elliptical perspective gauge needles:
    // 0 MPH / 0 RPM = -90 deg (-PI/2), 100 MPH / 6k RPM = 0 deg (12 o'clock), 200 MPH / 12k RPM = +90 deg (+PI/2)
    const speedFrac = Math.max(0, Math.min(1.06, speedMph / 200));
    const speedAngle = -Math.PI * 0.5 + speedFrac * Math.PI;
    this.drawNeedle(ctx, dashX + 250, 449, 44, 28, speedAngle);

    const rpmFrac = Math.max(0.05, Math.min(1.04, p.rpmNorm));
    const rpmAngle = -Math.PI * 0.5 + rpmFrac * Math.PI;
    this.drawNeedle(ctx, dashX + 388, 441, 28, 20, rpmAngle);

    // 4. Authentic Badloc LCD & name readouts matching ROADRASH.EXE hudLayout
    const displayName = sim.isPoliceMode ? `OFC ${sim.config.playerName}` : sim.config.playerName;
    this.drawBadlocBox(
      ctx,
      displayName,
      dashX + 4,
      446,
      132,
      30,
      20,
      sim.isPoliceMode ? '#66e6ff' : '#ffff00',
      'right'
    );
    const centerLcd = sim.isPoliceMode ? String(sim.outlawsRemaining) : String(sim.playerPlace);
    this.drawBadlocBox(ctx, centerLcd, dashX + 307, 403, 39, 24, 24, '#ffffff', 'center');

    // Odometer Distance (tenths of a mile: 33 samples = 0.1 mi, matching hud.cpp!)
    const tenths = Math.max(0, Math.floor((p.sample - sim.startSample) / 33));
    const distStr = `${String(Math.floor(tenths / 10)).padStart(2, '0')}.${tenths % 10}`;
    this.drawBadlocBox(ctx, distStr, dashX + 292, 452, 54, 24, 22, '#ffffff', 'center');

    // Nearest / Focused Opponent Name + Gap + Up/Down Arrow
    if (opp) {
      this.drawBadlocBox(ctx, opp.name, dashX + 498, 446, 138, 30, 21, '#ffffff', 'left');
      const dSamples = opp.sample - p.sample;
      const ahead = dSamples >= 0;
      const gapMiles = Math.min(9.999, Math.abs(dSamples) / 330);
      const gapStr = gapMiles.toFixed(3);
      const gapColor = ahead ? '#e71000' : '#28a31c';
      this.drawBadlocBox(ctx, gapStr, dashX + 436, 394, 196, 28, 22, gapColor, 'left');
      this.drawGapArrow(ctx, dashX + 422, ahead ? 401 : 403, ahead);
    }

    // 5. Top-left status badges (Miles Left, Gear, Unlocked OG Weapon Switcher [Q])
    const milesLeft = Math.max(0, (sim.finishSample - p.sample) / 330).toFixed(1);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.66)';
    ctx.fillRect(8, 8, 176, 24);
    this.drawSmallText(ctx, `LEFT: ${milesLeft} MI • GEAR ${p.gear}`, 14, 12, '#defff0');

    const wDef = OG_WEAPONS[p.weapon] || OG_WEAPONS[0];
    ctx.fillStyle = p.weapon === 3 ? 'rgba(28, 92, 200, 0.88)' : p.weapon > 0 ? 'rgba(185, 62, 16, 0.88)' : 'rgba(52, 56, 62, 0.85)';
    ctx.fillRect(8, 36, 152, 22);
    this.drawSmallText(ctx, `WPN [Q]: ${wDef.key}`, 14, 39, '#ffff60');

    // 6. Top-right Police Mode Radar OR Cop Pursuit + Nitro Status
    if (sim.isPoliceMode) {
      const flash = Math.floor(sim.ticks / 7) % 2 === 0;
      ctx.fillStyle = flash ? 'rgba(205, 22, 28, 0.88)' : 'rgba(20, 82, 215, 0.88)';
      ctx.fillRect(viewW - 214, 8, 206, 24);
      this.drawSmallText(
        ctx,
        `OUTLAWS LEFT: ${sim.outlawsRemaining} / ${sim.totalOutlaws}`,
        viewW - 206,
        12,
        '#ffffff'
      );

      if (sim.leadOutlaw) {
        const leadMiles = Math.max(0, (sim.finishSample - sim.leadOutlaw.sample) / 330);
        const urgent = leadMiles < 0.85;
        ctx.fillStyle = urgent && flash ? 'rgba(220, 20, 20, 0.92)' : 'rgba(10, 18, 32, 0.84)';
        ctx.fillRect(viewW - 214, 35, 206, 22);
        this.drawSmallText(
          ctx,
          `#1 ${sim.leadOutlaw.name.toUpperCase()}: ${leadMiles.toFixed(1)} MI LEFT`,
          viewW - 206,
          38,
          urgent ? '#ffff55' : '#99eeff'
        );
      }

      if (p.nitroCharges > 0 || p.nitroTicks > 0) {
        ctx.fillStyle = p.nitroTicks > 0 ? 'rgba(30, 160, 255, 0.90)' : 'rgba(15, 50, 100, 0.82)';
        ctx.fillRect(viewW - 128, 60, 120, 22);
        this.drawSmallText(
          ctx,
          p.nitroTicks > 0 ? `BOOST! (${p.nitroCharges})` : `NITRO [N]: ${p.nitroCharges}`,
          viewW - 121,
          63,
          p.nitroTicks > 0 ? '#ffffff' : '#99eeff'
        );
      }
    } else {
      if (p.nitroCharges > 0 || p.nitroTicks > 0) {
        ctx.fillStyle = p.nitroTicks > 0 ? 'rgba(30, 160, 255, 0.90)' : 'rgba(15, 50, 100, 0.80)';
        ctx.fillRect(viewW - 124, 36, 116, 22);
        this.drawSmallText(
          ctx,
          p.nitroTicks > 0 ? `BOOST! (${p.nitroCharges})` : `NITRO [N]: ${p.nitroCharges}`,
          viewW - 117,
          39,
          p.nitroTicks > 0 ? '#ffffff' : '#99eeff'
        );
      }

      if (sim.activeCop && sim.activeCop.chasing) {
        const flash = Math.floor(sim.ticks / 6) % 2 === 0;
        ctx.fillStyle = flash ? 'rgba(205, 22, 22, 0.86)' : 'rgba(22, 75, 215, 0.86)';
        ctx.fillRect(viewW - 132, 8, 124, 24);
        this.drawSmallText(ctx, `COP: ${sim.activeCop.name.toUpperCase()}`, viewW - 124, 12, '#ffffff');
      }
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
    ctx.textBaseline = 'middle';
    ctx.textAlign = align;
    const tx = align === 'center' ? x + w * 0.5 : align === 'right' ? x + w : x;
    const ty = y + h * 0.5;
    ctx.fillStyle = '#000000';
    ctx.fillText(text, tx + 2, ty + 2);
    ctx.fillStyle = color;
    ctx.fillText(text, tx, ty);
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

  drawRaceBanners(ctx, sim, viewW = 640) {
    if (sim.countdownTicks > 0) {
      const sec = Math.ceil(sim.countdownTicks / 60);
      const label = sec >= 1 ? String(sec) : 'GO!';
      this.drawBadlocBox(ctx, label, 0, 120, viewW, 80, 68, '#ff6432', 'center');
      if (sim.isPoliceMode) {
        this.drawBadlocBox(
          ctx,
          'BUST ALL 14 RACERS BEFORE ANYONE WINS!',
          0,
          194,
          viewW,
          40,
          24,
          '#66e6ff',
          'center'
        );
      }
    } else if (sim.goBannerTicks > 0) {
      this.drawBadlocBox(
        ctx,
        sim.isPoliceMode ? 'PURSUIT ON!' : 'RASH ON!',
        0,
        118,
        viewW,
        80,
        56,
        sim.isPoliceMode ? '#66e6ff' : '#ffff40',
        'center'
      );
    }

    if (sim.bannerText && sim.bannerTicks > 0) {
      this.drawBadlocBox(
        ctx,
        sim.bannerText,
        0,
        66,
        viewW,
        50,
        32,
        sim.bannerColor || '#ffff40',
        'center'
      );
    }

    if (sim.player.state === 'running') {
      const bx = Math.floor((viewW - 350) * 0.5);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
      ctx.fillRect(bx, 38, 350, 26);
      this.drawSmallText(ctx, 'SPRINTING BACK TO YOUR DOWNED BIKE!', bx + 30, 44, '#ffff55');
    }

    if (sim.paused) {
      const bx = Math.floor((viewW - 260) * 0.5);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.68)';
      ctx.fillRect(0, 0, viewW, 480);
      this.drawBadlocBox(ctx, 'RACE PAUSED', 0, 118, viewW, 64, 52, '#ff6432', 'center');

      const opts = ['Resume Race (ESC)', 'Restart Race (R)', 'Quit to Menu (Q)'];
      for (let i = 0; i < opts.length; i++) {
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
