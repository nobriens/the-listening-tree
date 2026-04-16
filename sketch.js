// The Listening Tree
let rootBranch;

// This is the starting position for the tree
let startx, starty;

// ground and tree visuals
let groundLayer;
let treeFrames = [];
let groundPetals = [];
let fallingLeaves = [];

// start screen with instructions
let started = false;
let startScale = 0.9;

let bgImage;

// audio analyser
let fft;
let spectrum = [];

// timed text settings 
let textSequenceInterval = 60000;
let phraseDuration = 2600;
let phraseGap = 350;
let textFadeTime = 500;

let petalColors = [
  [157, 40, 73],
  [251, 180, 210]
];

// tree depth and cached frame count. The cache of the tree grwoth is created on page load
let maxDepth = 12;
let cachedFrameCount = 28;

// Here is the growth
let voiceOn = false;
let growth = 0.12;
let targetGrowth = 0.12;
let prevVoiceOn = false;

let mic;
let micReady = false;
let micLevel = 0;
let micThreshold = 0.03;

function preload() {
  bgImage = loadImage("bg.png");
}

// setup
function setup() {
  createCanvas(windowWidth, windowHeight);
  pixelDensity(1);

  // Position of tree
  startx = width / 2;
  starty = height - 100;

  makeGroundPetals();
  buildGroundLayer();

  // Creates tree structure
  randomSeed(1000);
  noiseSeed(1000);
  rootBranch = new Branch(startx, starty, 100, 20, 0, TWO_PI * (3 / 4));

  buildTreeFrames();
}

function draw() {
  if (!started) {
    drawStartScreen();
    return;
  }

  background(245, 239, 244);

  if (bgImage) {
    image(bgImage, 0, 0, width, height);
  }

  image(groundLayer, 0, 0);

  // keepsn the previous voice state for detecting transitions
  prevVoiceOn = voiceOn;

  //Spacebar also acts as backup tree groiwth control
  let keyboardVoice = keyIsDown(32);
  if (micReady) {
    let raw = mic.getLevel();
    micLevel = lerp(micLevel, raw, 0.2);
    voiceOn = micLevel > micThreshold || keyboardVoice;
  } else {
    voiceOn = keyboardVoice;
  }

  // Grows when voice is on, decays when theres no noise
  targetGrowth = voiceOn ? 1 : 0;
  growth = lerp(growth, targetGrowth, voiceOn ? 0.03 : 0.006);
  growth = constrain(growth, 0, 1);

  //audio spectrum data for moon visualisation
  if (micReady && fft) {
    spectrum = fft.analyze();
  } else {
    spectrum = [];
  }

  let idx = floor(map(growth, 0, 1, 0, cachedFrameCount - 1));
  idx = constrain(idx, 0, cachedFrameCount - 1);

  if (treeFrames[idx]) {
    image(treeFrames[idx], 0, 0);
  }

  // add falling leaves when tree decays
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

  // clears the fallen leaves once the tree is bare
  if (!treeHasLeavesLeft() && !voiceOn && fallingLeaves.length > 0) {
    let allLow = true;

    for (let i = 0; i < fallingLeaves.length; i++) {
      if (fallingLeaves[i].pos.y < height - 20) {
        allLow = false;
        break;
      }
    }

    if (allLow) {
      fallingLeaves = [];
    }
  }

  // draws the moon visualizer and the timed phrases
  drawMoonWaveform();
  drawTimedPhrases();
}

//start screen shown before interaction
function drawStartScreen() {
  background(0);
  startScale = lerp(startScale, 1, 0.03);

  push();
  translate(width / 2, height / 2);
  scale(startScale);

  textAlign(CENTER, CENTER);
  textStyle(BOLD);
  noStroke();

  textSize(110);
  fill(0, 100);
  text("PRESS SPACE", 4, 4);

  fill(255);
  text("PRESS SPACE", 0, 0);
  textSize(30);
  fill(255, 160);
  text("let it hear you", 0, 90);

  pop();
}

function treeHasLeavesLeft() {
  return growth > 0.03;
}

function drawTimedPhrases() {
  let cycle = millis() % textSequenceInterval;

  let firstStart = 0;
  let firstEnd = firstStart + phraseDuration;

  let secondStart = firstEnd + phraseGap;
  let secondEnd = secondStart + phraseDuration;

  let phrase = null;
  let phraseTime = 0;

  if (cycle >= firstStart && cycle < firstEnd) {
    phrase = "SPEAKING\nGROWS";
    phraseTime = cycle - firstStart;
  } else if (cycle >= secondStart && cycle < secondEnd) {
    phrase = "SILENCE\nKILLS";
    phraseTime = cycle - secondStart;
  } else {
    return;
  }

  // Fades the text in and out
  let alpha = 255;

  if (phraseTime < textFadeTime) {
    alpha = map(phraseTime, 0, textFadeTime, 0, 255);
  } else if (phraseTime > phraseDuration - textFadeTime) {
    alpha = map(phraseTime, phraseDuration - textFadeTime, phraseDuration, 255, 0);
  }

  // Slight scale expansion while phrase is on screen
  let expandProgress = constrain(phraseTime / phraseDuration, 0, 1);
  let scaleAmt = lerp(0.9, 1.08, expandProgress);

  push();
  translate(width / 2, height / 2 + 10);
  scale(scaleAmt);

  textAlign(CENTER, CENTER);
  textStyle(BOLD);
  noStroke();

  textSize(150);
  fill(170, 255, 255, alpha * 0.18);
  text(phrase, 3, 3);

  fill(245, 245, 245, alpha);
  text(phrase, 0, 0);

  pop();
}

// start microphone and FFT analysis
function startMic() {
  if (micReady) return;

  userStartAudio();

  mic = new p5.AudioIn();
  mic.start(
    () => {
      micReady = true;
      fft = new p5.FFT(0.9, 256);
      fft.setInput(mic);
    },
    (err) => {
      console.error("Mic start failed:", err);
    }
  );
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

// pre render tree frames for different growth states
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

  pg.pop();
}

// spawns falling leaves when the tree starts decaying
function spawnFallingLeaves() {
  if (!treeHasLeavesLeft()) return;

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

// draws the circular moon audio visualiser
function drawMoonWaveform() {
  let cx = width - 220;
  let cy = 180;

  let moonR = 100;
  let minBar = 16;
  let maxBar = 45;
  let count = 128;

  push();
  translate(cx, cy);

  // sligh glow behind moon
  noStroke();
  fill(245, 245, 245, 18);
  ellipse(0, 0, (moonR + maxBar + 10) * 2);

  fill(245, 245, 245, 180);
  ellipse(0, 0, moonR * 2);

  // audio bars
  stroke(255, 245, 245, 235);
  strokeWeight(2);
  strokeCap(ROUND);

  for (let i = 0; i < count; i++) {
    let angle = map(i, 0, count, -HALF_PI, TWO_PI - HALF_PI);

    let barLen = minBar;

    if (micReady && spectrum.length > 0) {
      let specIndex = floor(map(i, 0, count - 1, 0, spectrum.length * 0.45));
      specIndex = constrain(specIndex, 0, spectrum.length - 1);

      let energy = spectrum[specIndex] / 255.0;
      barLen = minBar + energy * maxBar;
    }

    let x1 = cos(angle) * moonR;
    let y1 = sin(angle) * moonR;
    let x2 = cos(angle) * (moonR + barLen);
    let y2 = sin(angle) * (moonR + barLen);

    line(x1, y1, x2, y2);
  }

  pop();
}

// branch class for recursive tree drawing
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

  // builds the branch shape using noise
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

  // makes blossoms at the ends of branches
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

  // creates child branches recursively
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
      pg.stroke(233, 76, 137, alpha);
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
            pg.stroke(251, 180, 210, alpha);
          } else {
            pg.stroke(157, 40, 73, alpha);
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

  // Draws leaves
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

// starts interactive piece on first space press
function keyPressed() {
  if (key === ' ') {
    if (!started) {
      started = true;
      startMic();
      return;
    }
  }
}

// rebuilds th visuals if window size changes
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);

  startx = width / 2;
  starty = height - 100;

  makeGroundPetals();
  buildGroundLayer();

  randomSeed(1000);
  noiseSeed(1000);
  rootBranch = new Branch(startx, starty, 100, 20, 0, TWO_PI * (3 / 4));

  buildTreeFrames();
}
