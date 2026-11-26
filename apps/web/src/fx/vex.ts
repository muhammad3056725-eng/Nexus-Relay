/**
 * VEX-09 — the friendly host robot, as inline SVG (crisp at any size,
 * no image requests). Moods swap face parts via CSS ([data-mood]);
 * idle float / blink / antenna glow are CSS animations (disabled under
 * reduced motion).
 */
export type Mood = "idle" | "think" | "happy" | "wow" | "sad" | "wink";

let uid = 0;

export function vexSvg(size = 120): string {
  const id = `vx${uid++}`;
  return `<svg class="vex-svg" viewBox="60 20 360 440" width="${size}" height="${Math.round(size * 1.22)}" aria-hidden="true" focusable="false">
  <defs>
    <linearGradient id="${id}s" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e0f2fe"/><stop offset=".5" stop-color="#7dd3fc"/><stop offset="1" stop-color="#6366f1"/></linearGradient>
    <linearGradient id="${id}v" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#164e63"/><stop offset=".55" stop-color="#082f49"/><stop offset="1" stop-color="#0f172a"/></linearGradient>
    <linearGradient id="${id}b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1e3a5f"/><stop offset="1" stop-color="#0b1226"/></linearGradient>
    <radialGradient id="${id}h" cx=".5" cy=".45" r=".6"><stop offset="0" stop-color="#22d3ee" stop-opacity=".45"/><stop offset="1" stop-color="#22d3ee" stop-opacity="0"/></radialGradient>
  </defs>
  <circle class="vex-halo" cx="240" cy="235" r="185" fill="url(#${id}h)"/>
  <g class="vex-body">
    <path d="M240 118 V64" stroke="#7dd3fc" stroke-width="9" stroke-linecap="round"/>
    <circle class="vex-tip" cx="240" cy="52" r="17" fill="#22d3ee"/>
    <circle cx="234" cy="46" r="5" fill="#fff" opacity=".9"/>
    <rect x="86" y="196" width="30" height="74" rx="15" fill="url(#${id}s)"/>
    <rect x="364" y="196" width="30" height="74" rx="15" fill="url(#${id}s)"/>
    <rect x="108" y="112" width="264" height="196" rx="58" fill="url(#${id}s)"/>
    <rect x="126" y="130" width="228" height="160" rx="46" fill="url(#${id}v)"/>
    <path d="M150 148 Q240 122 330 148" stroke="#bae6fd" stroke-width="7" stroke-linecap="round" fill="none" opacity=".5"/>
    <g class="vex-face">
      <g class="f f-idle f-think"><g class="eyes"><circle cx="192" cy="205" r="14" fill="#67e8f9"/><circle cx="288" cy="205" r="14" fill="#67e8f9"/><circle cx="187" cy="199" r="5" fill="#fff"/><circle cx="283" cy="199" r="5" fill="#fff"/></g></g>
      <g class="f f-wow"><circle cx="192" cy="203" r="21" fill="#67e8f9"/><circle cx="288" cy="203" r="21" fill="#67e8f9"/><circle cx="185" cy="195" r="7" fill="#fff"/><circle cx="281" cy="195" r="7" fill="#fff"/><ellipse cx="240" cy="258" rx="14" ry="16" fill="#67e8f9"/></g>
      <g class="f f-happy"><path d="M172 212 Q192 186 212 212 M268 212 Q288 186 308 212" stroke="#67e8f9" stroke-width="11" stroke-linecap="round" fill="none"/><path d="M196 246 Q240 290 284 246" stroke="#67e8f9" stroke-width="10" stroke-linecap="round" fill="none"/></g>
      <g class="f f-wink"><circle cx="192" cy="205" r="14" fill="#67e8f9"/><path d="M270 208 Q288 196 306 208" stroke="#67e8f9" stroke-width="10" stroke-linecap="round" fill="none"/><path d="M205 248 Q240 274 275 248" stroke="#67e8f9" stroke-width="9" stroke-linecap="round" fill="none"/></g>
      <g class="f f-sad"><circle cx="192" cy="212" r="12" fill="#67e8f9"/><circle cx="288" cy="212" r="12" fill="#67e8f9"/><path d="M170 186 L210 196 M310 186 L270 196" stroke="#67e8f9" stroke-width="7" stroke-linecap="round"/><path d="M208 266 Q240 246 272 266" stroke="#67e8f9" stroke-width="9" stroke-linecap="round" fill="none"/></g>
      <g class="f f-idle f-think mouth"><path d="M205 248 Q240 272 275 248" stroke="#67e8f9" stroke-width="9" stroke-linecap="round" fill="none"/></g>
      <g class="f f-think dots"><circle cx="330" cy="120" r="7" fill="#f472b6"/><circle cx="352" cy="96" r="10" fill="#f472b6"/><circle cx="380" cy="66" r="13" fill="#f472b6"/></g>
    </g>
    <rect x="218" y="304" width="44" height="26" rx="10" fill="#334155"/>
    <path d="M150 356 Q150 330 182 330 H298 Q330 330 330 356 V404 Q330 432 302 432 H178 Q150 432 150 404 Z" fill="url(#${id}b)" stroke="#38bdf8" stroke-width="3"/>
    <path class="arm-l" d="M152 348 Q104 372 112 414" stroke="#38bdf8" stroke-width="20" stroke-linecap="round" fill="none"/>
    <path class="arm-r" d="M328 348 Q376 372 368 414" stroke="#38bdf8" stroke-width="20" stroke-linecap="round" fill="none"/>
    <circle cx="240" cy="382" r="24" fill="#082f49" stroke="#22d3ee" stroke-width="3"/>
    <path class="vex-heart" d="M222 382 h12 l6 -12 9 22 6 -10 h13" stroke="#2dd4bf" stroke-width="4.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>`;
}

export class Vex {
  readonly el: HTMLElement;
  private revert: number | null = null;

  constructor(el: HTMLElement, size = 120) {
    this.el = el;
    el.classList.add("vex");
    el.innerHTML = vexSvg(size);
    el.dataset.mood = "idle";
  }

  set(mood: Mood, revertMs?: number): void {
    this.el.dataset.mood = mood;
    // restart the one-shot reaction animation
    this.el.classList.remove("react");
    void this.el.offsetWidth;
    this.el.classList.add("react");
    if (this.revert) window.clearTimeout(this.revert);
    this.revert = null;
    if (revertMs) {
      this.revert = window.setTimeout(() => {
        this.el.dataset.mood = "idle";
      }, revertMs);
    }
  }
}
