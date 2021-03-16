class Composer {
  constructor(canvas, synth, fractal, overlay) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.track = new Track();
    this.fractal = fractal;
    this.overlay = overlay;
    this.paused = true;
    this.synth = synth;
    this._recording = false;
    this.shown = false;

    overlay.track = this.track;

    const elemLeft = canvas.offsetLeft + canvas.clientLeft;
    const elemTop = canvas.offsetTop + canvas.clientTop;

    const composer = this;
    canvas.addEventListener('mousedown', function(event) {
      var x = event.offsetX,
          y = event.offsetY;

      const titleWidth = 50, barHeight = canvas.clientHeight / composer.track.notes.length, barWidth = canvas.clientWidth / trackLength;
      const i = Math.trunc(y / barHeight), j = Math.trunc((x - titleWidth - 1) / barWidth);
      composer.track.notes[i].midi[j] = !composer.track.notes[i].midi[j];
      composer.draw();

      event.stopPropagation();
    }, false);

    canvas.addEventListener('mousemove', function(event) {
      var x = event.offsetX,
          y = event.offsetY;

      const titleWidth = 50, barHeight = canvas.clientHeight / composer.track.notes.length, barWidth = canvas.clientWidth / trackLength;
      composer.track.notes.forEach((note, i) => {
        note.hovered = Math.trunc(y / barHeight) == i;
      });

      composer.draw();
      overlay.draw();
    }, false);
  }

  play() {
    this.paused = false;

    const overlay = this.overlay;
    overlay.paused = false;
    overlay.draw();
  }

  stop() {
    this.paused = true;
    this.synth.stop();

    const overlay = this.overlay;
    overlay.paused = true;
    overlay.draw();
  }

  handleClick(x, y, right) {
    const color = this.fractal.colorAt(x, y);
    if (right) {
      if (this._recording) {

      }
      this.track.singleNote = undefined;
      this.stop();
    } else {
      if (this._recording) {

        var note = new Note(x, y, this.fractal.type, this.fractal.maxFreq, 'rgb(' + color[0] + ', ' + color[1] + ', ' + color[2] + ', 1)');
        note.midi[this.track.notes.length] = true;
        this.track.notes.push(note);
      }
      this.track.singleNote = new Note(x, y, this.fractal.type, this.fractal.maxFreq, 'rgb(' + color[0] + ', ' + color[1] + ', ' + color[2] + ', 1)');
      overlay.draw();
      this.synth.setPoint(x, y);
    }
    this.draw();
  }

  handleDrag(x, y, right) {
    if (this._recording) {
      if (right) {

      } else {
        const notes = this.track.notes;
        this.track.singleNote = notes[notes.length - 1].slideTo(x, y);
        overlay.draw();
        this.synth.setPoint(x, y);
      }

    } else {
      if (right) {

      } else {
        this.handleClick(x, y, right);
      }
    }
  }

  draw() {
    if (!this.shown) { return; }

    var ctx = this.ctx;
    var c = this.canvas;

    const track = this.track;
    const notesCount = track.notes.length ? track.notes.length : 8;

    c.width = this.fractal.canvas.width;
    c.height = notesCount * 80;

    ctx.clearRect(0, 0, c.width, c.height);

    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.lineWidth = 1;

    const titleWidth = 50, barHeight = 80, barWidth = c.width / trackLength;
    for (var i = 0; i < notesCount; i++) {
      const note = track.notes[i];
      for (var j = 0; j < trackLength; j++) {
        ctx.strokeStyle = "blue";
        ctx.strokeRect(titleWidth + j * barWidth + 1, i * barHeight, barWidth, barHeight);
        if (note && note.midi[j]) {
          ctx.fillStyle = note.color;
          ctx.fillRect(titleWidth + j * barWidth + 1, i * barHeight, barWidth, barHeight);
        }
      }
    }
  }

  set fractalType(typeID) {
    this.synth.fractalType = typeID;
    this.fractal.type = typeID;

    this.fractal.draw();

    if (this.track.singleNote) {
      const singleNote = this.track.singleNote;
      this.overlay.draw();
      this.synth.setPoint(singleNote.x, singleNote.y);
    }
  }

  set recording(newRecording) {
    this._recording = newRecording;

    const overlay = this.overlay;
    overlay.recording = newRecording;
    this.draw();
  }

  set playing(newPlaying) {
    if (newPlaying) {
      this.play();
    } else {
      this.stop();
    }
  }

  set zoom(newValue) {
    this.fractal.applyZoom(newValue);
    this.overlay.draw();
  }
}

class Player {
  play(track) {
    this.track = track;
    this.synths = new Array(track.notes.length);
    for (var i = 0; i<track.notes.length; i++) {
      const newSynth = new Synthesizer();
      this.synths[i] = newSynth;
      newSynth.play();
    }


  }
  stop() {

  }

  tick() {
    this.track.tick++;


  }
}
