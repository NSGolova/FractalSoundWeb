main();

var zoom;
var zoomDestination = zoom;
var camera;
var cameraFp;
var resolution;
var flags;
var time;
var iterations;
var julia;
var type;
var programInfo;

function main() {
  const canvas = document.querySelector('#glcanvas');
  const placeholder = document.querySelector('#placeholder');
  const lineCanvas = document.querySelector('#lineCanvas');

  zoom = 100.;
  camera = [0.0, 0.0];
  cameraFp = [0, 0];
  flags = 0;
  time = 0;
  iterations = 1200;
  julia = [1e8, 1e8];
  type = 0;
  resolution = [placeholder.getBoundingClientRect().width, placeholder.getBoundingClientRect().height];
  canvas.width = resolution[0];
  canvas.height = resolution[1];
  lineCanvas.width = resolution[0];
  lineCanvas.height = resolution[1];

  const gl = canvas.getContext('webgl2');

  if (!gl) {
    alert('Unable to initialize WebGL. Your browser or machine may not support it.');
    return;
  }

  // Vertex shader program

  const vsSource = `#version 300 es
    in vec4 aVertexPosition;
    uniform vec2 iResolution;

    uniform mat4 uModelViewMatrix;
    uniform mat4 uProjectionMatrix;

    void main() {
      vec2 pos = (aVertexPosition.xy / iResolution) * 2.0 - vec2(1.0, 1.0);
      gl_Position = aVertexPosition;
    }
  `;

  // Fragment shader program

  const fsSource = `#version 300 es
  #define FLOAT float
  #define VEC2 vec2
  #define VEC3 vec3
  #define AA_LEVEL 1
  #define ESCAPE 1000.0
  #define PI 3.141592653

  #define FLAG_DRAW_MSET ((iFlags & 0x01) == 0x01)
  #define FLAG_DRAW_JSET ((iFlags & 0x02) == 0x02)
  #define FLAG_USE_COLOR ((iFlags & 0x04) == 0x04)

  precision highp float;

  uniform vec2 iResolution;
  uniform vec2 iCam;
  uniform vec2 iJulia;
  uniform float iZoom;
  uniform int iType;
  uniform int iIters;
  uniform int iFlags;
  uniform int iTime;

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

  #if 1
  #define DO_LOOP(name) \
    for (i = 0; i < iIters; ++i) { \
      VEC2 ppz = pz; \
      pz = z; \
      z = name(z, c); \
      if (dot(z, z) > ESCAPE) { break; } \
      sumz.x += dot(z - pz, pz - ppz); \
      sumz.y += dot(z - pz, z - pz); \
      sumz.z += dot(z - ppz, z - ppz); \
    }
  #else
  #define DO_LOOP(name) \
    for (i = 0; i < iIters; ++i) { \
      z = name(z, c); \
      if (dot(z, z) > ESCAPE) { break; } \
    }
  #endif

  vec3 fractal(VEC2 z, VEC2 c) {
    VEC2 pz = z;
    VEC3 sumz = VEC3(0.0, 0.0, 0.0);
    int i;
    switch (iType) {
      case 0: DO_LOOP(mandelbrot); break;
      case 1: DO_LOOP(burning_ship); break;
      case 2: DO_LOOP(feather); break;
      case 3: DO_LOOP(sfx); break;
      case 4: DO_LOOP(henon); break;
      case 5: DO_LOOP(duffing); break;
      case 6: DO_LOOP(ikeda); break;
      case 7: DO_LOOP(chirikov); break;
    }

    if (i != iIters) {
      float n1 = sin(float(i) * 0.1) * 0.5 + 0.5;
      float n2 = cos(float(i) * 0.1) * 0.5 + 0.5;
      return vec3(n1, n2, 1.0) * (1.0 - float(FLAG_USE_COLOR)*0.85);
    } else if (FLAG_USE_COLOR) {
      sumz = abs(sumz) / float(iIters);
      vec3 n1 = sin(abs(sumz * 5.0)) * 0.45 + 0.5;
      return n1;
    } else {
      return vec3(0.0, 0.0, 0.0);
    }
  }

  float rand(float s) {
    return fract(sin(s*12.9898) * 43758.5453);
  }
  out vec4 fragColor;
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
    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0 / (float(iTime) + 1.0));
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
      iterations: gl.getUniformLocation(shaderProgram, "iIters"),
      resolution: gl.getUniformLocation(shaderProgram, "iResolution"),
      julia: gl.getUniformLocation(shaderProgram, "iJulia"),
      time: gl.getUniformLocation(shaderProgram, "iTime"),
      flags: gl.getUniformLocation(shaderProgram, "iFlags"),
      camera: gl.getUniformLocation(shaderProgram, "iCam"),
      type: gl.getUniformLocation(shaderProgram, "iType"),
    },
  };

  drawScene(programInfo);
  setupEventHandlers();
  programInfo.synth.play();
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
    gl.uniform1i(programInfo.uniformLocations.iterations, iterations);
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

var resumed = false;
var orbit_x, orbit_y;
var paused = true;

function setupEventHandlers() {

  var px, py;
  var leftPressed = false;
  var dragging = false;
  var juliaDrag = false;
  var takeScreenshot = false;
  var showHelpMenu = false;
  var curDrag;
  var prevDrag;

  window.addEventListener("wheel", e => {
    const delta = Math.sign(e.deltaY)
    cameraFp = [e.offsetX, e.offsetY];
    applyZoom(programInfo, delta);
  });

  window.addEventListener("mousedown", event => {
    var rightclick;
    var e = window.event;
    prevDrag = [e.offsetX, e.offsetY];
      dragging = (e.button == 1);
      if (e.button == 2) {
        rightclick = true;
        paused = true;
        programInfo.synth.stop();
        clearOrbit();
      }
      if (e.button == 0) {
        leftPressed = true;
        paused = false;
        if (!resumed) {
          programInfo.synth.feeder._backend._context.resume();
        }

        var coord = ScreenToPt(e.offsetX, e.offsetY);
        orbit_x = coord[0];
        orbit_y = coord[1];
        drawOrbit(programInfo, orbit_x, orbit_y);
        programInfo.synth.setPoint(coord[0], coord[1]);
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
      camera[0] += (curDrag[0] - prevDrag[0]) / zoom;
      camera[1] += (curDrag[1] - prevDrag[1]) / zoom;
      prevDrag = curDrag;

      drawScene(programInfo);
      if (!paused) {
        drawOrbit(programInfo, orbit_x, orbit_y);
      }
    }
    if (leftPressed === true) {
      var coord = ScreenToPt(e.offsetX, e.offsetY);
      orbit_x = coord[0];
      orbit_y = coord[1];
      drawOrbit(programInfo, orbit_x, orbit_y);
      programInfo.synth.setPoint(coord[0], coord[1]);
    }
  });

  window.addEventListener('mouseup', e => {
    dragging = false;
    leftPressed = false;
  });

  var volume = document.querySelector('#volume');
  volume.addEventListener('input', function() {
    document.getElementById("volumeLabel").innerHTML = "Volume: " + this.value + "%";
    programInfo.synth.feeder.volume = this.value / 100;
  });

  var maxFreq = document.querySelector('#maxFreq');
  maxFreq.addEventListener('input', function() {
    document.getElementById("tuneLabel").innerHTML = "Tune: " + this.value + "Hz";
    programInfo.synth.maxFreq = this.value;
  });
  var maxFreq = document.querySelector('#sustain');
  maxFreq.addEventListener('input', function() {
    programInfo.synth.sustain = this.checked;
  });
  var maxFreq = document.querySelector('#colors');
  maxFreq.addEventListener('input', function() {
    enableColor(this.checked);
  });
  var fpsContainer = document.querySelector('#fpsContainer');
  fpsContainer.addEventListener("mousedown", function(e){
      e.stopPropagation();
  });

  setupButtons();
}

var g_setSettingsElements;
function setSetting(elem, id) {
  selectFractal(id);
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

function clearOrbit() {
  const c = document.querySelector('#lineCanvas');
  var ctx = c.getContext("2d");
  ctx.clearRect(0, 0, c.width, c.height);
}

function drawOrbit(programInfo, orbit_x, orbit_y) {

  const c = document.querySelector('#lineCanvas');
  var ctx = c.getContext("2d");
  ctx.clearRect(0, 0, c.width, c.height);
  var x = orbit_x;
  var y = orbit_y;
  const cx = x;
  const cy = y;
  ctx.beginPath();
      var normalized = PtToScreen(x, y);
      ctx.moveTo(normalized[0], normalized[1]);
      // double cx = (hasJulia ? jx : px);
      // double cy = (hasJulia ? jy : py);
      for (var i = 0; i < 200; ++i) {
        const fr = all_fractals[programInfo.synth.fractalType](x, y, cx, cy);
        normalized = PtToScreen(fr.x, fr.y);
        ctx.lineTo(normalized[0], normalized[1]);
        x = fr.x;
        y = fr.y;
        if (x*x + y*y > 1000) {
          break;
        } else if (i < programInfo.synth.maxFreq / 60) {
          orbit_x = x;
          orbit_y = y;
        }
      }
      ctx.strokeStyle = "#FF0000";
      ctx.stroke();
}

function applyZoom(programInfo, amount) {
  zoom += amount * (zoom / 20.0);

  drawScene(programInfo);
  if (!paused) {
    drawOrbit(programInfo, orbit_x, orbit_y);
  }
}

function selectFractal(typeID) {
  programInfo.synth.fractalType = typeID;
  type = typeID;

  drawScene(programInfo);
  if (!paused) {
    drawOrbit(programInfo, orbit_x, orbit_y);
    programInfo.synth.setPoint(orbit_x, orbit_y);
  }
}

function enableColor(shouldEnable) {
  flags = (shouldEnable ? 0x04 : 0);
  drawScene(programInfo);
}
