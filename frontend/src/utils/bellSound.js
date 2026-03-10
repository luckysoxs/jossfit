/**
 * Boxing bell sound — synthesized with Web Audio API.
 * 3 metallic strikes like a round bell.
 * AudioContext is closed after playback to not interfere with background music.
 */
export function playBoxingBell(strikes) {
  if (strikes === undefined) strikes = 3
  try {
    var ctx = new (window.AudioContext || window.webkitAudioContext)()
    var now = ctx.currentTime

    for (var i = 0; i < strikes; i++) {
      var t = now + i * 0.38

      // Fundamental — warm bell tone
      var osc1 = ctx.createOscillator()
      var g1 = ctx.createGain()
      osc1.type = 'sine'
      osc1.frequency.value = 830
      g1.gain.setValueAtTime(0.35, t)
      g1.gain.exponentialRampToValueAtTime(0.001, t + 0.7)
      osc1.connect(g1)
      g1.connect(ctx.destination)
      osc1.start(t)
      osc1.stop(t + 0.7)

      // 2nd harmonic — metallic ring
      var osc2 = ctx.createOscillator()
      var g2 = ctx.createGain()
      osc2.type = 'sine'
      osc2.frequency.value = 1680
      g2.gain.setValueAtTime(0.18, t)
      g2.gain.exponentialRampToValueAtTime(0.001, t + 0.45)
      osc2.connect(g2)
      g2.connect(ctx.destination)
      osc2.start(t)
      osc2.stop(t + 0.45)

      // 3rd harmonic — brightness/attack
      var osc3 = ctx.createOscillator()
      var g3 = ctx.createGain()
      osc3.type = 'sine'
      osc3.frequency.value = 2520
      g3.gain.setValueAtTime(0.07, t)
      g3.gain.exponentialRampToValueAtTime(0.001, t + 0.25)
      osc3.connect(g3)
      g3.connect(ctx.destination)
      osc3.start(t)
      osc3.stop(t + 0.25)

      // Inharmonic partial — gives it that "clang" character
      var osc4 = ctx.createOscillator()
      var g4 = ctx.createGain()
      osc4.type = 'sine'
      osc4.frequency.value = 3410
      g4.gain.setValueAtTime(0.04, t)
      g4.gain.exponentialRampToValueAtTime(0.001, t + 0.15)
      osc4.connect(g4)
      g4.connect(ctx.destination)
      osc4.start(t)
      osc4.stop(t + 0.15)
    }

    // Close AudioContext after all strikes to release audio session
    var totalMs = ((strikes - 1) * 0.38 + 0.9) * 1000
    setTimeout(function() { ctx.close().catch(function() {}) }, totalMs)
  } catch (e) {}
}
