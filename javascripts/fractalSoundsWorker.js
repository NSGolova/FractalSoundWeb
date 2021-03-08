var window = self;
importScripts('/javascripts/fractalSoundsUtils.js');
self.addEventListener('message', function(e) {
  const synth = new Synthesizer();
  const coord = e.data;
    synth.setPoint(coord[0], coord[1]);
}, false);
