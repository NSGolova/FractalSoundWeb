main();

var zoom;
var camera;
var cameraDest;
var resolution;
var flags;
var time;
var julia;
var type;
var programInfo;
var paused;
var resumed = false;
var orbit_x, orbit_y;
var animated;
var curDrag;
var prevDrag;

function main() {
  const canvas = document.querySelector('#glcanvas');
  const placeholder = document.querySelector('#placeholder');
  const lineCanvas = document.querySelector('#lineCanvas');

  zoom = 100.;
  camera = [0.0, 0.0];
  cameraDest = [0.0, 0.0];
  flags = 0;
  time = 0;
  iterations = 1200;
  julia = [1e8, 1e8];
  type = 0;
  paused = true;
  animated = true;
  resolution = [placeholder.getBoundingClientRect().width, placeholder.getBoundingClientRect().height];
  canvas.width = resolution[0];
  canvas.height = resolution[1];
  lineCanvas.width = resolution[0];
  lineCanvas.height = resolution[1];

  var gl2Available = false;
  var gl = canvas.getContext('webgl2');
  if (gl) {
    gl2Available = true;
  } else {
    gl = canvas.getContext('webgl');
  }

  if (!gl) {
    const text = `
    Unable to initialize WebGL. Your browser or machine may not support it.
    Use Google Chrome for the best experience.
    Check out https://discussions.apple.com/thread/8655829 for Safari.
    `;
    alert(text);
    return;
  }

  // Vertex shader program

  const vsSource = `${gl2Available ? '#version 300 es' : ''}
    #ifdef GL_ES
      #ifdef GL_FRAGMENT_PRECISION_HIGH
        precision highp float;
      # else
        precision mediump float;
      # endif
    #endif
    ${gl2Available ? 'in' : 'attribute'} vec4 aVertexPosition;
    uniform vec2 iResolution;

    uniform mat4 uModelViewMatrix;
    uniform mat4 uProjectionMatrix;

    void main() {
      vec2 pos = (aVertexPosition.xy / iResolution) * 2.0 - vec2(1.0, 1.0);
      gl_Position = aVertexPosition;
    }
  `;

  // Fragment shader program

  const fsSource = `${gl2Available ? '#version 300 es' : ''}
  #ifdef GL_ES
    #ifdef GL_FRAGMENT_PRECISION_HIGH
      precision highp float;
    # else
      precision mediump float;
    # endif
  #endif
  #define FLOAT float
  #define VEC2 vec2
  #define VEC3 vec3
  #define AA_LEVEL 1
  #define ESCAPE 1000.0
  #define PI 3.141592653
  #define IT_LIMIT 1000000

  #define FLAG_DRAW_MSET false
  #define FLAG_DRAW_JSET false
  #define FLAG_USE_COLOR (iFlags == 0x04)

  uniform vec2 iResolution;
  uniform vec2 iCam;
  uniform vec2 iJulia;
  uniform float iZoom;
  uniform int iType;
  uniform int iFlags;
  uniform int iTime;

  int it_count() {
    return int(2.0 * sqrt(10.0 * iZoom));
  }

  ${gl2Available ? '' : `

  float sinh(float x) {
    return (exp(x) - exp(-x)) / 2.0;
  }

  float cosh(float x) {
    return (exp(x) + exp(-x)) / 2.0;
  }
  `
  }

  #define cx_one VEC2(1.0, 0.0)
  VEC2 cx_mul(VEC2 a, VEC2 b) {
    return VEC2(a.x*b.x - a.y*b.y, a.x*b.y + a.y*b.x);
  }
  VEC2 cx_sqr(VEC2 a) {
    FLOAT x2 = a.x*a.x;
    FLOAT y2 = a.y*a.y;
    FLOAT xy = a.x*a.y;
    return VEC2(x2 - y2, xy + xy);
  }
  VEC2 cx_cube(VEC2 a) {
    FLOAT x2 = a.x*a.x;
    FLOAT y2 = a.y*a.y;
    FLOAT d = x2 - y2;
    return VEC2(a.x*(d - y2 - y2), a.y*(x2 + x2 + d));
  }
  VEC2 cx_div(VEC2 a, VEC2 b) {
    FLOAT denom = 1.0 / (b.x*b.x + b.y*b.y);
    return VEC2(a.x*b.x + a.y*b.y, a.y*b.x - a.x*b.y) * denom;
  }
  VEC2 cx_sin(VEC2 a) {
    return VEC2(sin(a.x) * cosh(a.y), cos(a.x) * sinh(a.y));
  }
  VEC2 cx_cos(VEC2 a) {
    return VEC2(cos(a.x) * cosh(a.y), -sin(a.x) * sinh(a.y));
  }
  VEC2 cx_exp(VEC2 a) {
    return exp(a.x) * VEC2(cos(a.y), sin(a.y));
  }

  //Fractal equations
  VEC2 mandelbrot(VEC2 z, VEC2 c) {
    return cx_sqr(z) + c;
  }
  VEC2 burning_ship(VEC2 z, VEC2 c) {
    return VEC2(z.x*z.x - z.y*z.y, 2.0*abs(z.x * z.y)) + c;
  }
  VEC2 feather(VEC2 z, VEC2 c) {
    return cx_div(cx_cube(z), cx_one + z*z) + c;
  }
  VEC2 sfx(VEC2 z, VEC2 c) {
    return z * dot(z,z) - cx_mul(z, c*c);
  }
  VEC2 henon(VEC2 z, VEC2 c) {
    return VEC2(1.0 - c.x*z.x*z.x + z.y, c.y * z.x);
  }
  VEC2 duffing(VEC2 z, VEC2 c) {
    return VEC2(z.y, -c.y*z.x + c.x*z.y - z.y*z.y*z.y);
  }
  VEC2 ikeda(VEC2 z, VEC2 c) {
    FLOAT t = 0.4 - 6.0/(1.0 + dot(z,z));
    FLOAT st = sin(t);
    FLOAT ct = cos(t);
    return VEC2(1.0 + c.x*(z.x*ct - z.y*st), c.y*(z.x*st + z.y*ct));
  }
  VEC2 chirikov(VEC2 z, VEC2 c) {
    z.y += c.y*sin(z.x);
    z.x += c.x*z.y;
    return z;
  }

  int it = 0;

  VEC3 loop(VEC2 z1, VEC2 c) {
    VEC2 pz = z1;
    VEC3 sumz = VEC3(0.0, 0.0, 0.0);
    VEC2 z = z1;
    int itCount = it_count();

    ${gl2Available ? 'for (int i = 0; i < itCount; i++) {' :
    `
    for (int i = 0; i < IT_LIMIT; i++) {
      if (i == itCount) { break; }
    `}

      VEC2 ppz = pz;

      pz = z;
      if (iType == 0) {
        z = mandelbrot(z, c);
      } else if (iType == 1) {
        z = burning_ship(z, c);
      } else if (iType == 2) {
        z = feather(z, c);
      } else if (iType == 3) {
        z = sfx(z, c);
      } else if (iType == 4) {
        z = henon(z, c);
      } else if (iType == 5) {
        z = duffing(z, c);
      } else if (iType == 6) {
        z = ikeda(z, c);
      } else if (iType == 7) {
        z = chirikov(z, c);
      }
      it++;
      if (dot(z, z) > ESCAPE) { break; }
      sumz.x += dot(z - pz, pz - ppz);
      sumz.y += dot(z - pz, z - pz);
      sumz.z += dot(z - ppz, z - ppz);
    }

    return sumz;
  }

  vec3 fractal(VEC2 z, VEC2 c) {

    it = 0;
    VEC3 sumz = loop(z, c);
    int itCount = it_count();

    if (it != itCount) {
      float n1 = sin(float(it) * 0.1) * 0.5 + 0.5;
      float n2 = cos(float(it) * 0.1) * 0.5 + 0.5;
      return vec3(n1, n2, 1.0) * (1.0 - float(FLAG_USE_COLOR)*0.85);
    } else if (FLAG_USE_COLOR) {
      sumz = abs(sumz) / float(itCount);
      vec3 n1 = sin(abs(sumz * 5.0)) * 0.45 + 0.5;
      return n1;
    } else {
      return vec3(0.0, 0.0, 0.0);
    }
  }

  float rand(float s) {
    return fract(sin(s*12.9898) * 43758.5453);
  }

  ${gl2Available ? 'out vec4 fragColor;' : ''}

  void main() {
  	//Get normalized screen coordinate
  	vec2 screen_pos = gl_FragCoord.xy - (iResolution.xy * 0.5);

    vec3 col = vec3(0.0, 0.0, 0.0);
    for (int i = 0; i < AA_LEVEL; ++i) {
      vec2 dxy = vec2(rand(float(i)*0.54321 + float(iTime)), rand(float(i)*0.12345 + float(iTime)));
      VEC2 c = VEC2((screen_pos + dxy) * vec2(1.0, -1.0) / iZoom - iCam);

      //if (FLAG_DRAW_MSET) {
        col += fractal(c, c);
      // }
      // if (FLAG_DRAW_JSET) {
      //   col += fractal(c, iJulia);
      // }
    }

    col = col / float(AA_LEVEL);
    if (FLAG_DRAW_MSET && FLAG_DRAW_JSET) {
      col *= 0.5;
    }
    ${gl2Available ? 'fragColor' : 'gl_FragColor'} = vec4(clamp(col, 0.0, 1.0), 1.0 / (float(iTime) + 1.0));
  }
  `;

  // Initialize a shader program; this is where all the lighting
  // for the vertices and so forth is established.
  const shaderProgram = initShaderProgram(gl, vsSource, fsSource);

  // Collect all the info needed to use the shader program.
  // Look up which attribute our shader program is using
  // for aVertexPosition and look up uniform locations.
  programInfo = {
    program: shaderProgram,
    gl: gl,
    synth: new Synthesizer(),
    attribLocations: {
      vertexPosition: gl.getAttribLocation(shaderProgram, 'aVertexPosition'),
    },
    uniformLocations: {
      projectionMatrix: gl.getUniformLocation(shaderProgram, 'uProjectionMatrix'),
      modelViewMatrix: gl.getUniformLocation(shaderProgram, 'uModelViewMatrix'),
      zoom: gl.getUniformLocation(shaderProgram, "iZoom"),
      resolution: gl.getUniformLocation(shaderProgram, "iResolution"),
      julia: gl.getUniformLocation(shaderProgram, "iJulia"),
      time: gl.getUniformLocation(shaderProgram, "iTime"),
      flags: gl.getUniformLocation(shaderProgram, "iFlags"),
      camera: gl.getUniformLocation(shaderProgram, "iCam"),
      type: gl.getUniformLocation(shaderProgram, "iType"),
    },
  };

  drawScene(programInfo);
  programInfo.synth.play();

setupButtons();
  parseArguments(programInfo);
  setupEventHandlers();

}

function parseArguments(programInfo) {
  const queryString = window.location.search;
  const urlParams = new URLSearchParams(queryString);
  const urlX = parseFloat(urlParams.get('x'));
  const urlY = parseFloat(urlParams.get('y'));
  const fractalType = parseInt(urlParams.get('fr'));
  if (!Number.isNaN(urlX) & !Number.isNaN(urlY) & !Number.isNaN(fractalType)) {
    paused = false;
    if (!resumed) {
      programInfo.synth.feeder._backend._context.resume();
    }
    selectFractal(fractalType);

    // var coord = ScreenToPt(urlX, urlY);
    orbit_x = urlX;
    orbit_y = urlY;
    drawOrbit(programInfo);
    programInfo.synth.setPoint(urlX, urlY);
  }

    const sustain = urlParams.get('sus');
    if (sustain != null) {
      programInfo.synth.sustain = sustain == "true";
    }
    const volume = parseFloat(urlParams.get('vm'));
    if (!Number.isNaN(volume)) {
      programInfo.synth.feeder.volume = volume;
    }
}

//
// initBuffers
//
// Initialize the buffers we'll need. For this demo, we just
// have one object -- a simple two-dimensional square.
//
function initBuffers(gl) {

  // Create a buffer for the square's positions.

  const positionBuffer = gl.createBuffer();

  // Select the positionBuffer as the one to apply buffer
  // operations to from here out.

  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

  // Now create an array of positions for the square.

  const positions = [
     1.0,  1.0,
    -1.0,  1.0,
     1.0, -1.0,
    -1.0, -1.0,
  ];

  // Now pass the list of positions into WebGL to build the
  // shape. We do this by creating a Float32Array from the
  // JavaScript array, then use it to fill the current buffer.

  gl.bufferData(gl.ARRAY_BUFFER,
                new Float32Array(positions),
                gl.STATIC_DRAW);

  return {
    position: positionBuffer,
  };
}

//
// Draw the scene.
//
function drawScene(programInfo) {
  const gl = programInfo.gl;
  const buffers = initBuffers(gl);

  gl.clearColor(0.0, 0.0, 0.0, 1.0);  // Clear to black, fully opaque
  gl.clearDepth(1.0);                 // Clear everything
  gl.enable(gl.DEPTH_TEST);           // Enable depth testing
  gl.depthFunc(gl.LEQUAL);            // Near things obscure far things

  // Clear the canvas before we start drawing on it.

  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  {
    const numComponents = 2;
    const type = gl.FLOAT;
    const normalize = false;
    const stride = 0;
    const offset = 0;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
    gl.vertexAttribPointer(
        programInfo.attribLocations.vertexPosition,
        numComponents,
        type,
        normalize,
        stride,
        offset);
    gl.enableVertexAttribArray(
        programInfo.attribLocations.vertexPosition);
  }

  gl.useProgram(programInfo.program);

  gl.uniform1i(programInfo.uniformLocations.flags, flags);
  gl.uniform2f(programInfo.uniformLocations.camera, camera[0], camera[1]);
  gl.uniform1i(programInfo.uniformLocations.time, time);
  gl.uniform1i(programInfo.uniformLocations.type, type);

    gl.uniform1f(programInfo.uniformLocations.zoom, zoom);
    gl.uniform2f(programInfo.uniformLocations.resolution, resolution[0], resolution[1]);
    gl.uniform2f(programInfo.uniformLocations.julia, julia[0], julia[1]);

  {
    const offset = 0;
    const vertexCount = 4;
    gl.drawArrays(gl.TRIANGLE_STRIP, offset, vertexCount);
  }
}

//
// Initialize a shader program, so WebGL knows how to draw our data
//
function initShaderProgram(gl, vsSource, fsSource) {
  const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
  const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);

  // Create the shader program

  const shaderProgram = gl.createProgram();
  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  gl.linkProgram(shaderProgram);

  // If creating the shader program failed, alert

  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    alert('Unable to initialize the shader program: ' + gl.getProgramInfoLog(shaderProgram));
    return null;
  }

  return shaderProgram;
}

//
// creates a shader of the given type, uploads the source and
// compiles it.
//
function loadShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    alert('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

function setupEventHandlers() {

  var leftPressed = false;
  var dragging = false;
  // The two touches that make up a pinch-to-zoom gesture.
  // Updated every time one of them changes.
  var gestureTouches;
  // How zoomed in the image was when the gesture began.
  var gestureStartZoom;
  // The distance there was between the two touches when the gesture began.
  var gestureStartDist;
  // The points on the complex plane each touch started at.
  // We use this to apply the necessary translations to make the touches
  // stay as close as possible to their original positions on the image.
  var gestureStartPoints;
  // The position the camera was at when the gesture started.
  var gestureStartCamera;
  // Whether a gesture is currently running.
  var gesturing = false;

  function touchDistance(touchA, touchB) {
    return Math.sqrt(
      (touchA.pageX - touchB.pageX) ** 2 + (touchA.pageY - touchB.pageY) ** 2,
    );
  }

  const canvas = document.querySelector("#lineCanvas");

  // Define these on the canvas so that we don't override events for the controls.
  canvas.addEventListener("touchstart", function (e) {
    if (e.targetTouches.length === 2 && !gesturing) {
      e.preventDefault();

      const touchA = e.targetTouches[0];
      const touchB = e.targetTouches[1];

      gesturing = true;
      gestureStartZoom = zoom;
      gestureStartDist = touchDistance(touchA, touchB);
      gestureStartPoints = [
        ScreenToPt(touchA.pageX, touchA.pageY),
        ScreenToPt(touchB.pageX, touchB.pageY),
      ];
      gestureStartCamera = camera;
      gestureTouches = [touchA, touchB];
    } else if (e.targetTouches.length === 1 && !gesturing) {
      leftPressed = true;
      paused = false;
      if (!resumed) {
        programInfo.synth.feeder._backend._context.resume();
      }

      var coord = ScreenToPt(e.pageX, e.pageY);
      orbit_x = coord[0];
      orbit_y = coord[1];
      drawOrbit(programInfo);
      programInfo.synth.setPoint(coord[0], coord[1]);
      e.preventDefault();
    }
  });

  canvas.addEventListener("touchmove", function (e) {
    if (!gesturing) {
      if (leftPressed === true) {
        var coord = ScreenToPt(e.pageX, e.pageY);
        orbit_x = coord[0];
        orbit_y = coord[1];
        drawOrbit(programInfo);
        programInfo.synth.setPoint(coord[0], coord[1]);
        e.preventDefault();
      }
    }

    let changed = false;
    for (const touch of e.changedTouches) {
      if (touch.identifier === gestureTouches[0].identifier) {
        changed = true;
        gestureTouches[0] = touch;
      }

      if (touch.identifier === gestureTouches[1].identifier) {
        changed = true;
        gestureTouches[1] = touch;
      }
    }

    if (!changed) {
      return;
    }

    e.preventDefault();

    // First, handle zooming.
    // Calculate the ratio of the distance between the new touch points
    // to the distance between them when the gesture started.
    const newDist = touchDistance(...gestureTouches);
    const scale = newDist / gestureStartDist;

    // Multiply that by the zoom we had when the gesture started to get the new zoom.
    zoom = scale * gestureStartZoom;

    // Now handle translating.
    // Figure out the points these touches map to on the fractal.
    const ptA = ScreenToPt(gestureTouches[0].pageX, gestureTouches[0].pageY);
    const ptB = ScreenToPt(gestureTouches[1].pageX, gestureTouches[1].pageY);

    // Figure out how fare the points are from where they should be.
    const xDistA = ptA[0] - gestureStartPoints[0][0];
    const xDistB = ptB[0] - gestureStartPoints[1][0];
    const yDistA = ptA[1] - gestureStartPoints[0][1];
    const yDistB = ptB[1] - gestureStartPoints[1][1];

    // Figure out how far they are from where they should be on average.
    const xDist = (xDistA + xDistB) / 2;
    const yDist = (yDistA + yDistB) / 2;

    // Move the camera.
    camera[0] = gestureStartCamera[0] + xDist;
    camera[1] = gestureStartCamera[1] + yDist;

    drawScene(programInfo);
    if (!paused) {
      drawOrbit(programInfo, true);
    }
  });

  function onTouchEnd(e) {
    for (const touch of e.changedTouches) {
      if (
        touch.identifier === gestureTouches[0].identifier ||
        touch.identifier === gestureTouches[1].identifier
      ) {
        e.preventDefault();
        gesturing = false;
        break;
      }
    }
  }

  canvas.addEventListener("touchend", onTouchEnd);
  canvas.addEventListener("touchcancel", onTouchEnd);

  window.addEventListener('keyup', event => {
    if (event.code === 'Space') {
      paused = true;
      programInfo.synth.stop();
      clearOrbit();
    }
  })

  canvas.addEventListener("wheel", e => {
    e.preventDefault();

    const cameraFp = ScreenToPt(e.pageX, e.pageY);
    const zoomAmount = -Math.sign(e.deltaY);

    zoom += zoomAmount * (zoom / 20.0);
    const cameraFpNew = ScreenToPt(e.pageX, e.pageY);
    const fpXDelta = cameraFpNew[0] - cameraFp[0];
    const fpYDelta = cameraFpNew[1] - cameraFp[1];

    cameraDest[0] += fpXDelta;
    cameraDest[1] += fpYDelta;

    camera[0] = (camera[0] + fpXDelta) * 0.8 + cameraDest[0] * 0.2;
    camera[1] = (camera[1] + fpYDelta) * 0.8 + cameraDest[1] * 0.2;

    drawScene(programInfo);
    if (!paused) {
      drawOrbit(programInfo, true);
    }
  }, { passive: false });

  canvas.addEventListener("pointerdown", e => {
    if (gesturing) {
      return;
    }
    var rightclick;
    prevDrag = [e.offsetX, e.offsetY];
      dragging = (e.button == 1 || (e.altKey && e.button == 0));
      if (e.button == 2) {
        rightclick = true;
        paused = true;
        programInfo.synth.stop();
        clearOrbit();
      }
      if (!dragging && e.button == 0) {
        leftPressed = true;
        paused = false;
        if (!resumed) {
          programInfo.synth.feeder._backend._context.resume();
        }

        var coord = ScreenToPt(e.offsetX, e.offsetY);
        orbit_x = coord[0];
        orbit_y = coord[1];
        drawOrbit(programInfo);
        programInfo.synth.setPoint(coord[0], coord[1]);
      }
  });

  // Disable context menu for right click.
  if (canvas.addEventListener) {
      canvas.addEventListener('contextmenu', function (e) {
          e.preventDefault();
      }, false);
  } else {
      canvas.attachEvent('oncontextmenu', function () {
          window.event.returnValue = false;
      });
  }

  canvas.addEventListener('pointermove', e => {
    if (gesturing) {
      return;
    }
    if (dragging === true) {
      curDrag = [e.offsetX, e.offsetY];
      applyDrag(programInfo);
    }
    if (leftPressed === true) {
      var coord = ScreenToPt(e.offsetX, e.offsetY);
      orbit_x = coord[0];
      orbit_y = coord[1];
      drawOrbit(programInfo);
      programInfo.synth.setPoint(coord[0], coord[1]);
    }
  });

  canvas.addEventListener('pointerup', e => {
    dragging = false;
    leftPressed = false;
  });

  var volume = document.querySelector('#volume');
  volume.addEventListener('input', function() {
    document.getElementById("volumeLabel").innerHTML = "Volume: " + this.value + "%";
    programInfo.synth.feeder.volume = this.value / 100;
  });
  volume.value = programInfo.synth.feeder.volume * 100;
  document.getElementById("volumeLabel").innerHTML = "Volume: " + volume.value + "%";

  var maxFreq = document.querySelector('#maxFreq');
  maxFreq.addEventListener('input', function() {
    document.getElementById("tuneLabel").innerHTML = "Tune: " + this.value + "Hz";
    programInfo.synth.maxFreq = this.value;
  });
  var sustainButton = document.querySelector('#sustain');
  sustainButton.addEventListener('input', function() {
    programInfo.synth.sustain = this.checked;
  });
  sustainButton.checked = programInfo.synth.sustain;

  var maxFreq = document.querySelector('#colors');
  maxFreq.addEventListener('input', function() {
    enableColor(this.checked);
  });
  var maxFreq = document.querySelector('#animations');
  maxFreq.addEventListener('input', function() {
    if (!paused) {
      if (animated && !this.checked) {
        orbit_x = orbit_px;
        orbit_y = orbit_py;
      }
      animated = this.checked;
      if (timer) {
        clearInterval(timer);
      }
      drawOrbit(programInfo);
    } else {
      animated = this.checked;
    }
  });

  var shareUrl = document.querySelector('#shareUrl');
  var shareButton = document.querySelector('#share');
  function onShare() {
    shareUrl.style.height = "20px";
    shareUrl.style.visibility = "visible";
    const url = generateUrl();
    shareUrl.value = url;
    copyTextToClipboard(shareUrl);
  }
  shareButton.addEventListener('pointerdown', onShare);
  shareButton.addEventListener('touchstart', onShare);
  shareUrl.addEventListener('input', function() {
  });

  var uiContainer = document.querySelector('#uiContainer');
  var hideUIButton = document.querySelector('#hideUI');
  function onUIHide() {
    if (uiContainer.style.display == "none") {
      uiContainer.style.display = "block"
      hideUIButton.innerHTML = "Hide UI"
    } else {
      uiContainer.style.display = "none"
      hideUIButton.innerHTML = "Show UI"
    }
  }
  hideUIButton.addEventListener('pointerdown', onUIHide);
  hideUIButton.addEventListener('touchstart', onUIHide);
}

var g_setSettingsElements;
function setSetting(elem, id) {
  selectFractal(id);
}

function generateUrl() {
  const base = "https://www.golova.dev/experiments/fractalSounds";
  if (paused) {
    return base;
  } else {
    return base + "?x=" + orbit_px
                + "&y=" + orbit_py
                + "&fr=" + programInfo.synth.fractalType
                + "&sus=" + programInfo.synth.sustain
                + "&vm=" + programInfo.synth.feeder.volume;
  }
}

var popupTimer;
function delayPopup(popup) {
    popupTimer = setTimeout(function() {
      popup.style.height = "0px";
      popup.style.visibility = "hidden";
    }, 4200);
}

function copyTextToClipboard(input) {
  clearTimeout(popupTimer);
  input.select();
  document.execCommand("copy");

  const copied = document.querySelector('#copiedLabel');;
  copied.style.height = "20px";
  copied.style.visibility = "visible";

  delayPopup(copied);
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

function ScreenToPt(x, y) {
  const px = (x - resolution[0] / 2) / zoom - camera[0];
  const py = (y - resolution[1] / 2) / zoom - camera[1];

  return [px, py];
}
function PtToScreen(px, py) {
  x = (zoom * (px + camera[0])) + resolution[0] / 2;
  y = (zoom * (py + camera[1])) + resolution[1] / 2;

  return [x, y];
}

var px, py, orbit_px, orbit_py, timer;

function clearOrbit() {
  const c = document.querySelector('#lineCanvas');
  var ctx = c.getContext("2d");
  ctx.clearRect(0, 0, c.width, c.height);
  if (timer) {
    clearInterval(timer);
  }
}

function drawOrbit(programInfo, repeat) {
  var x = orbit_x;
  var y = orbit_y;
  const cx = animated & repeat ? px : x;
  const cy = animated & repeat ? py : y;
  const fractalFunction = all_fractals[programInfo.synth.fractalType];

  if (animated && !repeat) {
    px = x;
    py = y;
    orbit_px = orbit_x;
    orbit_py = orbit_y;
    if (timer) {
      clearInterval(timer);
    }
    timer = setInterval(function() {
      drawOrbit(programInfo, true);
    }, 20);
  }

  const c = document.querySelector('#lineCanvas');
  var ctx = c.getContext("2d");
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.beginPath();
  var normalized = PtToScreen(x, y);
  ctx.moveTo(normalized[0], normalized[1]);
  // double cx = (hasJulia ? jx : px);
  // double cy = (hasJulia ? jy : py);
  for (var i = 0; i < 200; ++i) {
    const fr = fractalFunction(x, y, cx, cy);
    normalized = PtToScreen(fr.x, fr.y);
    ctx.lineTo(normalized[0], normalized[1]);
    x = fr.x;
    y = fr.y;
    if (x*x + y*y > 1000) {
      break;
    } else if (animated && i < programInfo.synth.maxFreq / 60) {
      orbit_x = x;
      orbit_y = y;
    }
  }
  ctx.strokeStyle = "#FF0000";
  ctx.stroke();
}

function applyDrag(programInfo) {
  camera[0] += (curDrag[0] - prevDrag[0]) / zoom;
  camera[1] += (curDrag[1] - prevDrag[1]) / zoom;
  cameraDest[0] += (curDrag[0] - prevDrag[0]) / zoom;
  cameraDest[1] += (curDrag[1] - prevDrag[1]) / zoom;
  prevDrag = curDrag;

  drawScene(programInfo);
  if (!paused) {
    drawOrbit(programInfo, true);
  }
}

function selectFractal(typeID) {
  for (var i = 0; i < g_setSettingsElements.length; ++i) {
    g_setSettingsElements[i].style.color = i == typeID ? "red" : "gray"
  }

  programInfo.synth.fractalType = typeID;
  type = typeID;

  drawScene(programInfo);
  if (!paused) {
    orbit_x = orbit_px;
    orbit_y = orbit_py;
    drawOrbit(programInfo);
    programInfo.synth.setPoint(orbit_x, orbit_y);
  }
}

function enableColor(shouldEnable) {
  flags = (shouldEnable ? 0x04 : 0);
  drawScene(programInfo);
}
