const trackLength = 32;

class Track {
  constructor() {
    this.singleNote = undefined;
    this.notes = [];
    this.bpm = 120;
    this.play_cx = 0.0;
    this.playing = false;
    this.tick = -1;
  }


}

class Note {
  constructor(x, y, fractalType, maxFreq, color) {
    this.x = x;
    this.y = y;
    this.color = color;
    this.maxFreq = maxFreq;
    this.fractalType = fractalType;
    this.sustain = false;

    this.midi = new Array(trackLength);
  }

  slideTo(x, y) {
    if (!this.slide) {
      this.slide = []
    }

    const newNote = new Note(x, y, this.fractalType, this.maxFreq, this.color);
    this.slide.push(newNote);

    return newNote;
  }
}
