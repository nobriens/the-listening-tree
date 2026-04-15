let rootBranch;
let startx, starty;

let bgLayer;
let groundLayer;
let treeFrames = [];
let groundPetals = [];
let fallingLeaves = [];

let bgImage;

let fft;
let waveform = [];

let petalColors = [
  [157, 40, 73],
  [251, 180, 210]
];

let maxDepth = 12;
let cachedFrameCount = 28;

let voiceOn = false;
let growth = 0.12;
let targetGrowth = 0.12;
let prevVoiceOn = false;

let mic;
let micReady = false;
let micLevel = 0;
let micThreshold = 0.03;

function setup() {
  createCanvas(windowWidth, windowHeight);
  pixelDensity(1);

  startx = width / 2;
  starty = height - 100;

  makeBackground();
  makeGroundPetals();
  buildGroundLayer();

  randomSeed(1000);
  noiseSeed(1000);
  rootBranch = new Branch(startx, starty, 100, 20, 0, TWO_PI * (3 / 4));

  buildTreeFrames();
}

function preload() {
  bgImage = loadImage("bg.png");
}

function makeBackground() {
  bgLayer = createGraphics(width, height);
  bgLayer.pixelDensity(1);

  bgLayer.background(245, 239, 244);
  bgLayer.noStroke();

  for (let i = 0; i < width; i += 6) {
    for (let j = 0; j < height; j += 6) {
      bgLayer.fill(
        random(236, 248),
        random(230, 240),
        random(236, 246),
        55
      );
      bgLayer.rect(i, j, 6, 6);
    }
  }
}
function draw() {
  image(bgImage, 0, 0, width, height);
  image(groundLayer, 0, 0);

  prevVoiceOn = voiceOn;

  let keyboardVoice = keyIsDown(32);

  if (micReady) {
    let raw = mic.getLevel();
    micLevel = lerp(micLevel, raw, 0.2);
    voiceOn = micLevel > micThreshold || keyboardVoice;
  } else {
    voiceOn = keyboardVoice;
  }

  targetGrowth = voiceOn ? 1 : 0;

  growth = lerp(growth, targetGrowth, voiceOn ? 0.03 : 0.006);
  growth = constrain(growth, 0, 1);

  if (micReady && fft) {
  waveform = fft.waveform();
}

  let idx = floor(map(growth, 0, 1, 0, cachedFrameCount - 1));
  idx = constrain(idx, 0, cachedFrameCount - 1);
  image(treeFrames[idx], 0, 0);

  spawnFallingLeaves();

  for (let i = fallingLeaves.length - 1; i >= 0; i--) {
    fallingLeaves[i].applyForce(createVector(0, 0.005));
    fallingLeaves[i].applyForce(createVector(0.00035, 0));
    fallingLeaves[i].update();
    fallingLeaves[i].display();

    if (fallingLeaves[i].dead) {
      fallingLeaves.splice(i, 1);
    }
  }

  drawHint();
}

function startMic() {
  if (micReady) return;

  userStartAudio();

  mic = new p5.AudioIn();
  mic.start(
    () => {
      micReady = true;
      fft = new p5.FFT(0.8, 256);
      fft.setInput(mic);
    },
    (err) => {
      console.error("Mic start failed:", err);
    }
  );
}

function mousePressed() {
  startMic();
}

function makeBackground() {
  bgLayer = createGraphics(width, height);
  bgLayer.pixelDensity(1);
  bgLayer.background(220);
  bgLayer.noStroke();

  for (let i = 0; i < width; i += 2) {
    for (let j = 0; j < height; j += 2) {
      bgLayer.fill(random(210, 235), 150);
      bgLayer.rect(i, j, 5, 5);
    }
  }
}

function makeGroundPetals() {
  groundPetals = [];
  for (let i = 0; i < 260; i++) {
    groundPetals.push({
      x: random(startx - 380, startx + 380),
      y: random(starty - 5, starty + 40),
      w: random(7, 11),
      h: random(4, 7),
      c: random(petalColors)
    });
  }
}

function buildGroundLayer() {
  groundLayer = createGraphics(width, height);
  groundLayer.pixelDensity(1);
  groundLayer.clear();

  groundLayer.noStroke();
  for (let p of groundPetals) {
    groundLayer.fill(p.c[0], p.c[1], p.c[2], 170);
    groundLayer.ellipse(p.x, p.y, p.w, p.h);
  }
}

function buildTreeFrames() {
  treeFrames = [];

  for (let i = 0; i < cachedFrameCount; i++) {
    let g = i / (cachedFrameCount - 1);
    let pg = createGraphics(width, height);
    pg.pixelDensity(1);
    pg.clear();

    rootBranch.draw(pg, g);
    drawCanopyOverlay(pg, g);

    treeFrames.push(pg);
  }
}

function drawCanopyOverlay(pg, g) {
  pg.push();
  pg.translate(startx, starty);
  pg.noStroke();

  let topCount = floor(lerp(0, 340, g));
  let bottomCount = 0;

  randomSeed(5000);

  for (let i = 0; i < topCount; i++) {
    let c = lerpColor(
      color(143, 43, 70),
      color(255, 215, 228),
      random()
    );

    pg.fill(red(c), green(c), blue(c), 120);

    let x = random(-220, 220);
    let y = random(-500, -140);

    if ((x * x) / (230 * 230) + ((y + 300) * (y + 300)) / (210 * 210) < 1.12) {
      pg.ellipse(x, y, random(7, 11), random(4, 7));
    }
  }

  for (let i = 0; i < bottomCount; i++) {
  let c = random() < 0.82 ? petalColors[1] : petalColors[0];
  pg.fill(c[0], c[1], c[2], 85);

  let x = random(-260, 260);
  let y = random(-250, -120);

  if ((x * x) / (260 * 260) + ((y + 185) * (y + 185)) / (70 * 70) < 1.0) {
    pg.ellipse(x, y, random(7, 11), random(4, 7));
  }
}

  pg.pop();
}

function spawnFallingLeaves() {
  if (!voiceOn && prevVoiceOn !== voiceOn) {
    for (let i = 0; i < 70; i++) {
      fallingLeaves.push(
        new Leaf(
          startx + random(-220, 220),
          starty + random(-520, -140),
          true
        )
      );
    }
  }

  if (!voiceOn) {
    let spawnChance = map(growth, 0, 1, 0.08, 0.025);

    if (random() < spawnChance) {
      let count = floor(random(3, 6));
      for (let i = 0; i < count; i++) {
        fallingLeaves.push(
          new Leaf(
            startx + random(-220, 220),
            starty + random(-520, -140),
            true
          )
        );
      }
    }
  }
}

function drawHint() {
  let panelX = 20;
  let panelY = 20;
  let panelW = 330;
  let panelH = 110;

  noStroke();
  fill(30, 30, 30, 95);
  rect(panelX, panelY, panelW, panelH, 12);

  stroke(255, 255, 255, 30);
  noFill();
  rect(panelX, panelY, panelW, panelH, 12);

  noStroke();
  fill(255);
  textSize(16);
  text("Speak to grow, silence to decay", panelX + 14, panelY + 24);

  textSize(11);
  fill(255, 210);
  textAlign(RIGHT, CENTER);
  text(voiceOn ? "LISTENING" : "QUIET", panelX + panelW - 14, panelY + 16);
  textAlign(LEFT, BASELINE);

  fill(255, 210);
  textSize(12);
  text("Mic level: " + nf(micLevel, 1, 3), panelX + 14, panelY + 44);

  let waveX = panelX + 14;
  let waveY = panelY + 68;
  let waveW = panelW - 28;
  let waveH = 24;

  noFill();
  stroke(255, 35);
  rect(waveX, waveY - waveH / 2, waveW, waveH, 6);

  if (micReady && waveform.length > 0) {
    noFill();
    stroke(255, 194, 245);
    strokeWeight(1.5);
    beginShape();
    for (let i = 0; i < waveform.length; i++) {
      let x = map(i, 0, waveform.length - 1, waveX + 4, waveX + waveW - 4);
      let y = map(waveform[i], -1, 1, waveY + waveH / 2 - 3, waveY - waveH / 2 + 3);
      vertex(x, y);
    }
    endShape();
  } else {
    stroke(255, 90);
    line(waveX + 4, waveY, waveX + waveW - 4, waveY);
  }

  let barX = panelX + 14;
  let barY = panelY + 92;
  let barW = panelW - 28;
  let barH = 8;

  noStroke();
  fill(255, 35);
  rect(barX, barY, barW, barH, 10);

  fill(255, 194, 245, 220);
  rect(barX, barY, barW * growth, barH, 10);

  let thresholdX = map(micThreshold, 0, 0.1, barX, barX + barW);
  stroke(255, 120);
  line(thresholdX, barY - 3, thresholdX, barY + barH + 3);
}

class Branch {
  constructor(x, y, len, thickness, depth, dir) {
    this.x = x;
    this.y = y;
    this.len = len;
    this.thickness = thickness;
    this.depth = depth;
    this.dir = dir;

    this.points = [];
    this.children = [];
    this.preBlossoms = [];
    this.tipBlossoms = [];

    this.buildPoints();
    this.endLocal = this.points[this.points.length - 1].copy();

    if (this.depth > 5 && random(1) < 0.8) {
      this.makePreBlossoms();
    }

    if (this.depth > maxDepth) {
      this.makeTipBlossoms();
    } else {
      this.makeChildren();
    }
  }

  buildPoints() {
    for (let i = 0; i < this.len; i++) {
      this.points.push(createVector(i, noise(this.depth * 100 + i * 0.05) * 5));
    }
  }

  makePreBlossoms() {
    let count = 20;
    for (let i = 0; i < count; i++) {
      this.preBlossoms.push({
        x1: 0,
        y1: 0,
        x2: random(-5, 5),
        y2: random(-5, 5),
        appearAt: random(0.18, 0.95)
      });
    }
  }

  makeTipBlossoms() {
    let isLight = random(1) < 0.9;

    let lineCount = 24;
    for (let i = 0; i < lineCount; i++) {
      this.tipBlossoms.push({
        type: "line",
        light: isLight,
        x1: 0,
        y1: 0,
        x2: random(-6, 6),
        y2: random(-6, 6),
        appearAt: random(0.02, 0.95)
      });
    }

    if (isLight && random(1) < 0.35) {
      let dotCount = 18;
      for (let i = 0; i < dotCount; i++) {
        this.tipBlossoms.push({
          type: "dot",
          light: true,
          x: random(-6, 6),
          y: random(-6, 6),
          w: random(1.5, 3.5),
          h: random(1.5, 3.5),
          appearAt: random(0.08, 0.95)
        });
      }
    }
  }

  makeChildren() {
    let ang;
    if (this.depth > 0) {
      ang = map(this.depth, 0, 10, 0.1, 0.5);
    } else {
      ang = random(0.9, 1.1) * 0.3;
    }

    let len1 = random(0.8, 1.1) * (50 - this.depth);
    let len2 = random(0.8, 1.1) * (50 - this.depth);

    this.children.push(
      new Branch(0, 0, len1, this.thickness * 0.8, this.depth + 1, -1 * random(0.8, 1.1) * ang)
    );

    this.children.push(
      new Branch(0, 0, len2, this.thickness * 0.8, this.depth + 1, 1 * random(0.8, 1.1) * ang)
    );
  }

  draw(pg, growthAmount) {
    pg.push();
    pg.translate(this.x, this.y);
    pg.rotate(this.dir);

    pg.stroke(47, 25, 8);
    pg.strokeWeight(this.thickness);
    pg.noFill();
    pg.beginShape();
    for (let pt of this.points) {
      pg.vertex(pt.x, pt.y);
    }
    pg.endShape();

    pg.translate(this.endLocal.x, this.endLocal.y);

    for (let b of this.preBlossoms) {
      if (growthAmount < b.appearAt) continue;
      let alpha = map(growthAmount, b.appearAt, 1, 0, 160);
      alpha = constrain(alpha, 0, 160);
      pg.stroke(233,76,137, alpha);
      pg.strokeWeight(2);
      pg.line(b.x1, b.y1, b.x2, b.y2);
    }

    if (this.depth > maxDepth) {
      for (let b of this.tipBlossoms) {
        if (growthAmount < b.appearAt) continue;

        if (b.type === "line") {
          let alpha = map(growthAmount, b.appearAt, 1, 0, b.light ? 210 : 190);
          alpha = constrain(alpha, 0, b.light ? 210 : 190);
          if (b.light) {
          pg.stroke(157, 40, 73, alpha);
          pg.stroke(251, 180, 210, alpha);
          }
          pg.strokeWeight(2);
          pg.line(b.x1, b.y1, b.x2, b.y2);
        } else {
          let alpha = map(growthAmount, b.appearAt, 1, 0, 180);
          alpha = constrain(alpha, 0, 180);
          pg.noStroke();
          pg.fill(255, 194, 245, alpha);
          pg.ellipse(b.x, b.y, b.w, b.h);
        }
      }
    } else {
      for (let child of this.children) {
        child.draw(pg, growthAmount);
      }
    }

    pg.pop();
  }
}

class Leaf {
  constructor(x, y, fastFall = false) {
    this.pos = createVector(x, y);

    if (fastFall) {
      this.vel = createVector(random(-0.16, 0.16), random(0.22, 0.5));
      this.rotSpeed = random(0.35, 0.8);
      this.w = random(8, 12);
      this.h = random(5, 8);
    } else {
      this.vel = createVector(random(-0.08, 0.08), random(0.14, 0.35));
      this.rotSpeed = random(0.15, 0.45);
      this.w = random(7, 11);
      this.h = random(4, 7);
    }

    this.accel = createVector(0, 0);
    this.rotation = random(-40, 40);
    this.rotDir = random() < 0.5 ? -1 : 1;
    this.swingSeed = random(1000);
    this.dead = false;
    this.c = random(petalColors);
    this.alpha = random(170, 230);
    this.fastFall = fastFall;
  }

  applyForce(force) {
    this.accel.add(force);
  }

  update() {
    this.rotation += this.rotDir * random(0.08, this.rotSpeed);

    if (this.rotation > 90 || this.rotation < -90) {
      this.rotDir *= -1;
    }

    let driftX = this.fastFall
      ? map(noise(this.swingSeed, frameCount * 0.008), 0, 1, -0.04, 0.04)
      : map(noise(this.swingSeed, frameCount * 0.006), 0, 1, -0.022, 0.022);

    let driftY = this.fastFall
      ? map(noise(this.swingSeed + 500, frameCount * 0.008), 0, 1, -0.003, 0.012)
      : map(noise(this.swingSeed + 500, frameCount * 0.006), 0, 1, -0.002, 0.007);

    this.vel.x += driftX;
    this.vel.y += driftY;

    this.vel.add(this.accel);
    this.pos.add(this.vel);
    this.accel.mult(0);

    if (this.pos.x < -120 || this.pos.x > width + 120 || this.pos.y > height + 20) {
      this.dead = true;
    }
  }

  display() {
    push();
    translate(this.pos.x, this.pos.y);
    rotate(radians(this.rotation));
    noStroke();
    fill(this.c[0], this.c[1], this.c[2], this.alpha);
    ellipse(0, 0, this.w, this.h);
    pop();
  }
}

function keyPressed() {
  if (key === ' ') {
    voiceOn = true;
    startMic();
  }

  if (key === 'r' || key === 'R') {
    fallingLeaves = [];
    buildTreeFrames();
  }

  if (key === 's' || key === 'S') {
    save('tree_voice_growth.png');
  }
}

function keyReleased() {
  if (key === ' ') {
    voiceOn = false;
  }
}