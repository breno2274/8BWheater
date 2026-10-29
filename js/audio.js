/**
 * 8B Wheater — Sintetizador de Áudio Chiptune 8-Bit (Web Audio API)
 * -----------------------------------------------------------------
 * Efeitos sonoros autênticos estilo Game Boy / NES sintetizados
 * inteiramente via osciladores, sem necessidade de arquivos externos.
 */

let audioCtx = null;
let somHabilitado = true;

function obterContexto() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

export const AudioFX = {
  definirAtivo(ativo) {
    somHabilitado = Boolean(ativo);
  },

  isAtivo() {
    return somHabilitado;
  },

  /**
   * Beep de navegação / hover de botão
   */
  bip() {
    if (!somHabilitado) return;
    const ctx = obterContexto();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.05);

      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    } catch (e) {
      // Ignora restrições de autoplay antes da interação
    }
  },

  /**
   * Som de clique em botão
   */
  clique() {
    if (!somHabilitado) return;
    const ctx = obterContexto();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(659.25, ctx.currentTime); // E5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.03); // A5

      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } catch (e) {}
  },

  /**
   * Jingle "Press Start" / Detalhes (Acorde clássico de videogame)
   */
  start() {
    if (!somHabilitado) return;
    const ctx = obterContexto();
    if (!ctx) return;

    try {
      const notas = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      notas.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.07);

        gain.gain.setValueAtTime(0.12, ctx.currentTime + i * 0.07);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.07 + 0.18);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime + i * 0.07);
        osc.stop(ctx.currentTime + i * 0.07 + 0.18);
      });
    } catch (e) {}
  },

  /**
   * Som de Favoritado / Sucesso (Moeda tipo Mario)
   */
  moeda() {
    if (!somHabilitado) return;
    const ctx = obterContexto();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(987.77, ctx.currentTime); // B5
      osc.frequency.setValueAtTime(1318.51, ctx.currentTime + 0.08); // E6

      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch (e) {}
  },

  /**
   * Trovão sintetizado para clima de tempestade
   */
  trovao() {
    if (!somHabilitado) return;
    const ctx = obterContexto();
    if (!ctx) return;

    try {
      // Buffer de ruído branco com filtro passa-baixa
      const bufferSize = ctx.sampleRate * 1.5;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(450, ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 1.2);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.4);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      noise.start();
    } catch (e) {}
  },

  /**
   * Fanfarra de inicialização estilo Game Boy boot
   */
  boot() {
    if (!somHabilitado) return;
    const ctx = obterContexto();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(1046.50, ctx.currentTime); // C6
      osc.frequency.setValueAtTime(2093.00, ctx.currentTime + 0.12); // C7

      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.45);
    } catch (e) {}
  }
};
