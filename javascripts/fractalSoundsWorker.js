var window = self;
importScripts('/javascripts/fractalSoundsUtils.js');

class Buffer {
  constructor() {
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
  }
  // Getter
  setPoint(x, y) {
    this.play_nx = x;
    this.play_ny = y;

    this.audio_reset = true;
    this.audio_pause = false;
  }

  // Method
  audioData() {
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

    var dx;
    var dy;
    var dpx;
    var dpy;

    var m_samples = new Array(AUDIO_BUFF_SIZE * 2);
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
    var mean_x = this.mean_x;
    var mean_y = this.mean_y;
    var normalized = this.fractalType == 0;

    //Generate the tones
    const steps = Math.trunc(sampleRate / maxFreq)
    for (var i = 0; i < AUDIO_BUFF_SIZE * 2; i+=2) {
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
      m_samples[i] = Math.min(Math.max(wx, -1.0), 1.0);
      m_samples[i+1] = Math.min(Math.max(wy, -1.0), 1.0);
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
    this.mean_x = mean_x;
    this.mean_y = mean_y;

    //Return the sound clip
    return !audio_reset;
  }
}

const buffer = new Buffer();
var nIntervId;
self.addEventListener('message', function(e) {
  const coord = e.data;
  if (coord[0] == "setPoint") {
    buffer.fractalType = coord[3];
    buffer.setPoint(coord[1], coord[2]);
  }
  calc();
  // if (!nIntervId) {
  //   var nIntervId = setInterval(calc, (sampleRate / AUDIO_BUFF_SIZE) * 1000);
  // }

}, false);

function calc() {
  buffer.audioData();
  self.postMessage([buffer.m_samples, buffer.audio_reset || buffer.audio_pause]);
}
