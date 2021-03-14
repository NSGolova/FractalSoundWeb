function mandelbrot(x, y, cx, cy) {
  return {x: x*x - y*y + cx, y: 2.0*x*y + cy};
}

function burning_ship(x, y, cx, cy) {
  return {x: x*x - y*y + cx, y: 2.0*Math.abs(x*y) + cy};
}

function feather(x, y, cx, cy) {
  var z = new Complex(x, y);
  var z2 = new Complex(x*x, y*y);
  var c = new Complex(cx, cy);
  var one = new Complex(1.0, 0.0);

  z = z.multiply(z).multiply(z).divide(one.add(z2)).add(c);
  return {x: z.real, y: z.imag};
}

function sfx(x, y, cx, cy) {
  var z = new Complex(x, y);
  var c2 = new Complex(cx*cx, cy*cy);
  z = z.multiply(x*x + y*y).subtract(z.multiply(c2));
  return {x: z.real, y: z.imag};
}

function henon(x, y, cx, cy) {
  return {x: 1.0 - cx*x*x + y, y: cy*x};
}

function duffing(x, y, cx, cy) {
  const nx = y;
  const ny = -cy*x + cx*y - y*y*y;
  return {x: nx, y: ny};
}

function ikeda(x, y, cx, cy) {
  const t = 0.4 - 6.0 / (1.0 + x*x + y*y);
  const st = Math.sin(t);
  const ct = Math.cos(t);
  const nx = 1.0 + cx*(x*ct - y*st);
  const ny = cy*(x*st + y*ct);
  return {x: nx, y: ny};
}

function chirikov(x, y, cx, cy) {
  const ny = y + cy*Math.sin(x);
  return {x: x + cx*ny, y: ny};
}

//List of fractal equations
const all_fractals = [
  mandelbrot,
  burning_ship,
  feather,
  sfx,
  henon,
  duffing,
  ikeda,
  chirikov,
];

var Complex = function(real, imag) {
	if (!(this instanceof Complex)) {
		return new Complex (real, imag);
	}

	if (typeof real === "string" && imag == null) {
		return Complex.parse (real);
	}

	this.real = Number(real) || 0;
	this.imag = Number(imag) || 0;
};

Complex.parse = function(string) {
	var real, imag, regex, match, a, b, c;

	// TODO: Make this work better-er
	regex = /^([-+]?(?:\d+|\d*\.\d+))?[-+]?(\d+|\d*\.\d+)?[ij]$/i;
	string = String(string).replace (/\s+/g, '');

	match = string.match (regex);
	if (!match) {
		throw new Error("Invalid input to Complex.parse, expecting a + bi format");
	}

	a = match[1];
	b = match[2];
	c = match[3];

	real = a != null ? parseFloat (a) : 0;
	imag = parseFloat ((b || "+") + (c || "1"));

	return new Complex(real, imag);
};

Complex.prototype.copy = function() {
	return new Complex (this.real, this.imag);
};

Complex.prototype.add = function(operand) {
	var real, imag;

	if (operand instanceof Complex) {
		real = operand.real;
		imag = operand.imag;
	} else {
		real = Number(operand);
		imag = 0;
	}

	return new Complex (this.real + real, this.imag + imag);
};

Complex.prototype.subtract = function(operand) {
	var real, imag;

	if (operand instanceof Complex) {
		real = operand.real;
		imag = operand.imag;
	} else {
		real = Number(operand);
		imag = 0;
	}

	return new Complex (this.real - real, this.imag - imag);
};

Complex.prototype.multiply = function(operand) {
	var real, imag;

	if (operand instanceof Complex) {
		real = operand.real;
		imag = operand.imag;
	} else {
		real = Number(operand);
		imag = 0;
	}

	return new Complex (this.real * real - this.imag * imag, this.real * imag + this.imag * real);
};

Complex.prototype.divide = function(operand) {
	var real, imag, denom;

	if (operand instanceof Complex) {
		real = operand.real;
		imag = operand.imag;
	} else {
		real = Number(operand);
		imag = 0;
	}

	denom = real * real + imag * imag;

	return new Complex ((this.real * real + this.imag * imag) / denom, (this.imag * real - this.real * imag) / denom);
};

const AUDIO_BUFF_SIZE = 4000;
var sampleRate = 40000;

class Synthesizer {
  constructor() {
    this.audio_pause = false;
    this.volume = 0.3;
    this.jx = 1e8;
    this.jy = 1e8;
    this.playing = false;
    this.maxFreq = 4000;
    this.fractalType = 0;
    this.sustain = true;

    var feeder = new AudioFeeder();
    feeder.init(2, sampleRate);
    this.feeder = feeder;
    var synth = this;

    // Worker will calculate sound buffers in the background.
    this.worker = new Worker("./javascripts/Worker.js");
    this.worker.addEventListener('message', function(e) {
      const message = e.data;
      if (message.shouldStop) {
        synth.stop();
      } else {
        synth.m_samples = message.samples;
      }
    }, false);
  }

  setPoint(x, y) {
    this.audio_pause = false;
    this.worker.postMessage({type: "setPoint",
                             point: {x: x, y: y},
                             fractalType: this.fractalType,
                             sustain: this.sustain,
                             maxFreq: this.maxFreq});
  }

  resume() {
    this.feeder._backend._context.resume();
  }

  play() {
    var synth = this;
    var feeder = this.feeder;
    feeder.waitUntilReady(function() {
      feeder.volume = synth.volume;
      feeder.start();

      // Callback when buffered data runs below feeder.bufferThreshold seconds:
      feeder.onbufferlow = function() {
        // Ask for more data for the same point.
        synth.worker.postMessage({type: "calc",
                                  fractalType: synth.fractalType,
                                  sustain: synth.sustain,
                                  maxFreq: synth.maxFreq});
        synth.updateBuffers();
      };

      feeder.onstarved = feeder.onbufferlow;
    });
    this.audio_pause = true;
  }

  updateBuffers() {
    var lchannel = new Float32Array(AUDIO_BUFF_SIZE);
    var rchannel = new Float32Array(AUDIO_BUFF_SIZE);

    const buffer = this.m_samples;
    if (buffer && !this.audio_pause) {
      for (var i = 0; i < AUDIO_BUFF_SIZE; i++) {
        lchannel[i] = buffer[i*2];
        rchannel[i] = buffer[i*2+1];
      }
    }
    this.feeder.bufferData([
      lchannel,
      rchannel
    ]);
  }

  stop() {
    this.audio_pause = true;
  }
}

class Overlay {
  constructor(canvas, fractal) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.fractal = fractal;
    this.recording = false;
    this.paused = true;
  }

  draw() {
    const c = this.canvas;
    this.ctx.clearRect(0, 0, c.width, c.height);

    this.drawOrbits();
    this.drawNotes();
  }

  drawOrbits() {
    const c = this.canvas;
    const ctx = this.ctx;

    if (this.recording) {
      for (var i = 0; i < this.track.length; i++) {
        this.drawRecordingPoint(this.track[i]);
      }
    }
    if (!this.paused) {
      for (var i = 0; i < this.track.length; i++) {
        this.drawNote(this.track[i]);
      }
    }
    var singleNote = this.track.singleNote;
    if (!singleNote) { return; }
    this.drawNote(singleNote);
  }

  drawNote(note) {
    const ctx = this.ctx;
    var x = note.x;
    var y = note.y;
    const cx = x;
    const cy = y;
    ctx.beginPath();
    var normalized = fractal.ptToScreen(x, y);
    ctx.moveTo(normalized[0], normalized[1]);
    // double cx = (hasJulia ? jx : px);
    // double cy = (hasJulia ? jy : py);
    for (var i = 0; i < 200; ++i) {
      const fr = all_fractals[note.fractalType](x, y, cx, cy);
      normalized = fractal.ptToScreen(fr.x, fr.y);
      ctx.lineTo(normalized[0], normalized[1]);
      x = fr.x;
      y = fr.y;
      if (x*x + y*y > 1000) {
        break;
      } else if (i < note.maxFreq / 60) {
        // orbit_x = x;
        // orbit_y = y;
      }
    }
    ctx.strokeStyle = note.color;
    ctx.stroke();
  }

  drawNotes() {
    const c = this.canvas;
    const ctx = this.ctx;

    this.track.notes.forEach((note, i) => {
      const normalized = fractal.ptToScreen(note.x, note.y);
      ctx.beginPath();
      ctx.strokeStyle = note.color;
      ctx.lineWidth = 2;

      ctx.arc(normalized[0], normalized[1], 10, 0, Math.PI * 2, true);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(normalized[0], normalized[1], 0.5, 0, Math.PI * 2, true);
      ctx.stroke();
    });


  }

  drawRecordingPoint(note) {

  }

  clearOrbit() {
    const c = this.canvas;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, c.width, c.height);
  }
}
