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

  z = z.multiply(z).multiply(z).divide(one.add(z2).add(c));
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
  return {x: cy*Math.sin(x), y: cx*y};
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
	this.real += real;
	this.imag += imag;

	return this;
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
	this.real -= real;
	this.imag -= imag;

	return this;
};
Complex.prototype.multiply = function(operand) {
	var real, imag, tmp;

	if (operand instanceof Complex) {
		real = operand.real;
		imag = operand.imag;
	} else {
		real = Number(operand);
		imag = 0;
	}

	tmp = this.real * real - this.imag * imag;
	this.imag = this.real * imag + this.imag * real;
	this.real = tmp;

	return this;
};

Complex.prototype.divide = function(operand) {
	var real, imag, denom, tmp;

	if (operand instanceof Complex) {
		real = operand.real;
		imag = operand.imag;
	} else {
		real = Number(operand);
		imag = 0;
	}

	denom = real * real + imag * imag;
	tmp = (this.real * real + this.imag * imag) / denom;
	this.imag = (this.imag * real - this.real * imag) / denom;
	this.real = tmp;

	return this;
};

const AUDIO_BUFF_SIZE = 40960;
function getScriptPath(foo){ return window.URL.createObjectURL(new Blob([foo.toString().match(/^\s*function\s*\(\s*\)\s*\{(([\s\S](?!\}$))*[\s\S])/)[1]],{type:'text/javascript'})); }

class Synthesizer {
  constructor() {
    this.audio_reset = true;
    this.audio_pause = false;
    this.volume = 8000.0;
    this.play_x = 0.0;
    this.play_y = 0.0;
    this.play_cx = 0.0;
    this.play_cy = 0.0;
    this.play_nx = 0.0;
    this.play_ny = 0.0;
    this.play_px = 0.0;
    this.play_py = 0.0;
    this.jx = 1e8;
    this.jy = 1e8;

    this.fractalType = 0;
    this.context = new (window.AudioContext || window.webkitAudioContext)();
    this.source = this.context.createBufferSource();
  }
  // Getter
  setPoint(x, y) {
    this.play_nx = x;
    this.play_ny = y;
    this.audio_reset = true;
    this.audio_pause = false;

    var context = this.context;
    var source = this.source;

    source.stop();
    var myArrayBuffer = context.createBuffer(2, AUDIO_BUFF_SIZE, context.sampleRate);
    this.audioData(myArrayBuffer);

    this.source = this.context.createBufferSource();
    var source = this.source;
    source.buffer = myArrayBuffer;
    source.connect(context.destination);
    source.start();
  }

  // set fractal(number) {
  //   this.fractal = all_fractals[number];
  // }

  play() {
    var context = this.context;
    var source = this.source;
    source.connect(context.destination);
    source.start();

  }

  stop() {
    this.source.stop();
  }

  // Method
  audioData(buffer) {
    if (this.audio_reset) {
      this.m_audio_time = 0;
      this.play_cx = (jx < 1e8 ? jx : this.play_nx);
      this.play_cy = (jy < 1e8 ? jy : this.play_ny);
      this.play_x = this.play_nx;
      this.play_y = this.play_ny;
      this.play_px = this.play_nx;
      this.play_py = this.play_ny;
      this.mean_x = this.play_nx;
      this.mean_y = this.play_ny;
      this.volume = 8000.0;
      this.audio_reset = false;
    }

    var mean_x;
    var mean_y;
    var dx;
    var dy;
    var dpx;
    var dpy;

    var m_samples = new Array(AUDIO_BUFF_SIZE);
    var m_audio_time = 0;
    var audio_reset = this.audio_reset;
    var audio_pause = this.audio_pause;
    var volume = this.volume;
    var play_x = this.play_x;
    var play_y = this.play_y;
    var play_cx = this.play_cx;
    var play_cy = this.play_cy;
    var play_nx = this.play_nx;
    var play_ny = this.play_ny;
    var play_px = this.play_px;
    var play_py = this.play_py;
    var jx = this.jx;
    var jy = this.jy;
    var normalized = true;

    //Generate the tones
    const steps = Math.trunc(48000 / 4000)
    for (var i = 0; i < AUDIO_BUFF_SIZE; i+=1) {
      const j = Math.trunc(m_audio_time % steps);
      if (j == 0) {
        play_px = play_x;
        play_py = play_y;
        const fr = all_fractals[this.fractalType](play_x, play_y, play_cx, play_cy);
        play_x = fr.x;
        play_y = fr.y;
        if (play_x*play_x + play_y*play_y > 1000.0) {
          this.audio_pause = true;
          return;
        }

        if (normalized) {
          dpx = play_px - play_cx;
          dpy = play_py - play_cy;
          dx = play_x - play_cx;
          dy = play_y - play_cy;
          if (dx != 0.0 || dy != 0.0) {
            var dpmag = 1.0 / Math.sqrt(1e-12 + dpx*dpx + dpy*dpy);
            var dmag = 1.0 / Math.sqrt(1e-12 + dx*dx + dy*dy);
            dpx *= dpmag;
            dpy *= dpmag;
            dx *= dmag;
            dy *= dmag;
          }
        } else {
          //Point is relative to mean
          dx = play_x - mean_x;
          dy = play_y - mean_y;
          dpx = play_px - mean_x;
          dpy = play_py - mean_y;
        }

        //Update mean
        mean_x = mean_x*0.99 + play_x*0.01;
        mean_y = mean_y*0.99 + play_y*0.01;

        //Don't let the volume go to infinity, clamp.
        var m = dx*dx + dy*dy;
        if (m > 2.0) {
          dx *= 2.0 / m;
          dy *= 2.0 / m;
        }
        m = dpx*dpx + dpy*dpy;
        if (m > 2.0) {
          dpx *= 2.0 / m;
          dpy *= 2.0 / m;
        }

        //Lose volume over time unless in sustain mode
        // if (!sustain) {
        //   volume *= 0.9992;
        // }
      }

      //Cosine interpolation
      var t = j.toFixed(2) / steps.toFixed(2);
      t = 0.5 - 0.5*Math.cos(t * 3.14159);
      var wx = t*dx + (1.0 - t)*dpx;
      var wy = t*dy + (1.0 - t)*dpy;

      //Save the audio to the 2 channels
      // console.log(wx);
      buffer.getChannelData(0)[i] = Math.min(Math.max(wx, -1.0), 1.0);
      buffer.getChannelData(1)[i] = Math.min(Math.max(wy, -1.0), 1.0);
      m_audio_time += 1;
    }

    this.audio_reset = audio_reset;
    this.audio_pause = audio_pause;
    this.volume = volume;
    this.play_x = play_x;
    this.play_y = play_y;
    this.play_cx = play_cx;
    this.play_cy = play_cy;
    this.play_nx = play_nx;
    this.play_ny = play_ny;
    this.play_px = play_px;
    this.play_py = play_py;
    this.m_samples = m_samples;
    this.m_audio_time = m_audio_time;

    //Return the sound clip
    return !audio_reset;
  }
}
