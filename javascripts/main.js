main();

var fractal;
var composer;
var overlay;
var synth;

function main() {
  const canvas = document.querySelector('#glcanvas');
  const placeholder = document.querySelector('#placeholder');
  const lineCanvas = document.querySelector('#lineCanvas');

  const resolution = [placeholder.getBoundingClientRect().width, placeholder.getBoundingClientRect().height];
  canvas.width = resolution[0];
  canvas.height = resolution[1];
  lineCanvas.width = resolution[0];
  lineCanvas.height = resolution[1];

  synth = new Synthesizer();

  fractal = new Fractal(canvas);
  overlay = new Overlay(lineCanvas, fractal);
  composer = new Composer(document.querySelector('#composerCanvas'), synth, fractal, overlay);

  setupEventHandlers();
  synth.play();
}

var resumed = false;
var orbit_x, orbit_y;
var paused = true;

function setupEventHandlers() {
  var leftPressed = false;
  var dragging = false;
  var curDrag;
  var prevDrag;

  document.addEventListener("wheel", e => {
    e.preventDefault();
    composer.zoom = -Math.sign(e.deltaY);
  }, { passive: false });

  document.addEventListener("mousedown", event => {
    var e = window.event;
    prevDrag = [e.offsetX, e.offsetY];
    dragging = (e.button == 1 || (e.altKey && e.button == 0));

    var coord = fractal.screenToPt(e.offsetX, e.offsetY);
    // orbit_x = coord[0];
    // orbit_y = coord[1];
    if (e.button == 2) {
      composer.handleClick(coord[0], coord[1], true);
    }
    if (!dragging && e.button == 0) {
      if (!resumed) {
        synth.resume();
      }
      leftPressed = true;
      composer.handleClick(coord[0], coord[1], false);
    }
  });

  // Disable context menu for right click.
  if (document.addEventListener) {
      document.addEventListener('contextmenu', function (e) {
          e.preventDefault();
      }, false);
  } else {
      document.attachEvent('oncontextmenu', function () {
          window.event.returnValue = false;
      });
  }

  window.addEventListener('mousemove', e => {
    if (dragging === true) {
      curDrag = [e.offsetX, e.offsetY];
      composer.drag = [curDrag[0] - prevDrag[0], curDrag[1] - prevDrag[1]];
      prevDrag = curDrag;
    }

    var coord = fractal.screenToPt(e.offsetX, e.offsetY);
    composer.handleDrag(coord[0], coord[1], !leftPressed);
  });

  window.addEventListener('mouseup', e => {
    dragging = false;
    leftPressed = false;
  });

  var gestureStartRotation;

  window.addEventListener("gesturestart", function (e) {
    e.preventDefault();

    prevDrag = [e.pageX, e.pageY];
  });

  window.addEventListener("gesturechange", function (e) {
    e.preventDefault();

    // rotation = gestureStartRotation + e.rotation;
    composer.zoom = e.scale - 1.0;

    curDrag = [e.pageX, e.pageY];
    composer.drag = [curDrag[0] - prevDrag[0], curDrag[1] - prevDrag[1]];
    prevDrag = curDrag;
  })

  window.addEventListener("gestureend", function (e) {
    e.preventDefault();
  });

  document.addEventListener('keyup', event => {
    if (event.code === 'Space') {
      composer.handleClick(undefined, undefined, true);
    }
  })

  var volume = document.querySelector('#volume');
  volume.addEventListener('input', function() {
    document.getElementById("volumeLabel").innerHTML = "Volume: " + this.value + "%";
    synth.feeder.volume = this.value / 100;
  });

  var maxFreq = document.querySelector('#maxFreq');
  maxFreq.addEventListener('input', function() {
    document.getElementById("tuneLabel").innerHTML = "Tune: " + this.value + "Hz";
    synth.maxFreq = this.value;
  });
  var maxFreq = document.querySelector('#bpm');
  maxFreq.addEventListener('input', function() {
    document.getElementById("bpmLabel").innerHTML = "BPM: " + this.value;
    composer.bpm = this.value;
  });
  var maxFreq = document.querySelector('#sustain');
  maxFreq.addEventListener('input', function() {
    synth.sustain = this.checked;
  });
  var maxFreq = document.querySelector('#colors');
  maxFreq.addEventListener('input', function() {
    fractal.enableColor = this.checked;
  });
  var maxFreq = document.querySelector('#playing');
  maxFreq.addEventListener('input', function() {
    composer.playing = this.checked;
  });
  var fpsContainer = document.querySelector('#fpsContainer');
  fpsContainer.addEventListener("mousedown", function(e){
      e.stopPropagation();
  });
  var fpsContainer = document.querySelector('#recordingControls');
  fpsContainer.addEventListener("mousedown", function(e){
      e.stopPropagation();
  });

  const composerElement = document.querySelector('#composer');
  const recordingControls = document.querySelector('#recordingControls');
  document.querySelector('#composerShow').addEventListener('click', function(e){
    e.preventDefault();
  if (!composer.shown) {
    requestAnimationFrame(function () {
    composerElement.style.height = '30%';
    recordingControls.style.bottom = composerElement.clientHeight - 5;
   });
   composer.shown = true;
   composer.draw();
    // this.animate({
    //   height : '40%'
    // }, 500);
    // this.classList.remove('open');
  } else {
    requestAnimationFrame(function () {
    composerElement.style.height = '0%';
    recordingControls.style.bottom = 5;
   });
   composer.shown = false;
   composer.canvas.height = 0;
    // this.animate({
    //   height : '20%'
    // }, 500);
    // this.classList.add('open');
  }

  if (this.classList.contains('show')) {
		this.classList.remove('show');
		this.classList.add('hide');
	} else {
		this.classList.remove('hide');
		this.classList.add('show');
	}
});

document.querySelector('#playing').addEventListener('click', function(e){
	e.preventDefault();
	if (this.classList.contains('play')) {
    composer.playing = true;
		this.classList.remove('play');
		this.classList.add('pause');
	} else {
    composer.playing = false;
		this.classList.remove('pause');
		this.classList.add('play');
	}
});

document.querySelector('#recording').addEventListener('click', function(e){
	e.preventDefault();
	if (this.classList.contains('record')) {
    composer.recording = true;
		this.classList.remove('record');
		this.classList.add('stopRecord');
	} else {
    composer.recording = false;
		this.classList.remove('stopRecord');
		this.classList.add('record');
	}
});

  setupButtons();
}

var g_setSettingsElements;
function setSetting(elem, id) {
  composer.fractalType = id;
  for (var ii = 0; ii < g_setSettingsElements.length; ++ii) {
    g_setSettingsElements[ii].style.color = "gray"
  }
  elem.style.color = "red"
}

function setupButtons() {
  g_setSettingsElements = [];
  for (var ii = 0; ii < 100; ++ii) {
    var elem = document.getElementById("setSetting" + ii);
    if (!elem) {
      break;
    }
    g_setSettingsElements.push(elem);
    elem.onclick = function(elem, id) {
      return function () {
        setSetting(elem, id);
      }}(elem, ii);
  }
}
