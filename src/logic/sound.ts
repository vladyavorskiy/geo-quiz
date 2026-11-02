let ctx: AudioContext | undefined;

/** Короткий сигнал: два восходящих тона — верно, два нисходящих — ошибка. Без файлов, через Web Audio. */
export function beep(ok: boolean) {
  try {
    ctx ??= new AudioContext();
    const c = ctx;
    (ok ? [660, 990] : [300, 200]).forEach((freq, i) => {
      const t0 = c.currentTime + i * 0.11;
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.2, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.18);
      osc.connect(gain).connect(c.destination);
      osc.start(t0);
      osc.stop(t0 + 0.2);
    });
  } catch {
    // нет Web Audio — играем молча
  }
}
