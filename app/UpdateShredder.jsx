import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import sheet from './assets/update/0.png?inline';
import wings from './assets/update/1.png?inline';
import './UpdateShredder.css';

const spots = [
  { x: .28, y: 0, nx: 0, ny: -1, turn: 0 },
  { x: 1, y: .24, nx: 1, ny: 0, turn: 90 },
  { x: .78, y: 1, nx: 0, ny: 1, turn: 180 },
  { x: 0, y: .86, nx: -1, ny: 0, turn: -90 },
];
const between = (low, high) => low + Math.random() * (high - low);
const ease = value => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };

export default function UpdateShredder({ status }) {
  const anchor = useRef(null), sprite = useRef(null), latest = useRef(status);
  const [host, setHost] = useState(null);
  latest.current = status;
  const active = status.state === 'downloading' || status.state === 'ready' && status.action !== 'revert';
  useEffect(() => { setHost(anchor.current?.closest('.update-overlay')); }, []);
  useEffect(() => {
    const bird = sprite.current, box = anchor.current?.closest('.classic-modal-window');
    if (!active || !bird || !box) return;
    const owner = box.ownerDocument.defaultView;
    const art = new owner.Image(), flightArt = new owner.Image();
    art.src = sheet; flightArt.src = wings;
    let frame, phase = 'rest', spot, started = 0, duration = 0, reveal = 1600, peck = false;
    let next = owner.performance.now() + between(900, 1800), departed = false, point;
    const choose = now => {
      spot = spots[Math.floor(Math.random() * spots.length)];
      phase = 'peek'; started = now; duration = between(11000, 17000); peck = Math.random() < .55;
    };
    const escape = event => {
      if (phase !== 'peek') return;
      if (event.type === 'pointerdown') { event.preventDefault(); event.stopPropagation(); }
      phase = 'escape'; started = owner.performance.now();
      bird.style.pointerEvents = 'none';
    };
    bird.addEventListener('pointerenter', escape);
    bird.addEventListener('pointerdown', escape);
    const tick = now => {
      const current = latest.current;
      const finished = current.state === 'ready' || current.total > 0 && current.received / current.total >= .92;
      if (finished && !departed) {
        departed = true;
        if (!spot) choose(now);
        phase = 'fly'; started = now;
        const rect = box.getBoundingClientRect();
        point = { x: rect.left + rect.width * spot.x + spot.nx * 18, y: rect.top + rect.height * spot.y + spot.ny * 18 };
      }
      if (phase === 'rest' && !departed && now >= next && art.complete && art.naturalWidth) choose(now);
      bird.dataset.phase = phase;
      if (phase === 'rest') bird.style.visibility = 'hidden';
      else {
        const age = now - started, rect = box.getBoundingClientRect();
        let x = rect.left + rect.width * spot.x, y = rect.top + rect.height * spot.y;
        let turn = spot.turn, row = 0, column = 0, source = sheet;
        bird.style.visibility = 'visible';
        bird.style.pointerEvents = phase === 'peek' ? 'auto' : 'none';
        if (phase === 'fly') {
          if (age >= 2600) { bird.style.visibility = 'hidden'; bird.dataset.phase = 'gone'; return; }
          const t = Math.min(1, age / 2600), side = spot.nx < 0 ? -1 : 1;
          x = point.x + side * (owner.innerWidth + 180) * t * t;
          y = point.y + (spot.ny > 0 ? 1 : -1) * (owner.innerHeight + 180) * t * t;
          turn = side < 0 ? -12 : 12;
          row = Math.floor(age / 120) % 8 >= 4 ? 1 : 0;
          column = Math.floor(age / 120) % 4;
          source = wings;
          bird.style.setProperty('--mirror', side);
        } else {
          bird.style.setProperty('--mirror', 1);
          const exposure = phase === 'escape' ? 12 - 120 * ease(age / 360) :
            -82 + 94 * ease(age / reveal) * (1 - ease((age - duration + 1600) / 1600));
          x += spot.nx * exposure; y += spot.ny * exposure;
          if (phase === 'escape') {
            x += spot.ny * 35 * ease(age / 360); y -= spot.nx * 35 * ease(age / 360);
            row = spot.nx < 0 ? 2 : 1; column = Math.floor(age / 55) % 8;
          } else if (peck && age >= 7200 && age < 9300) {
            const tap = (age - 7200) % 1100;
            const dip = tap < 650 ? Math.sin(tap / 650 * Math.PI) : 0;
            row = dip > .7 ? 10 : 0; column = dip > .7 ? 0 : dip > .15 ? 3 : 0;
            turn += dip * 5;
            x -= spot.nx * dip * 4; y -= spot.ny * dip * 4;
          } else if (peck && age >= 9300 && age < 10300) {
            row = 8; column = 3;
          } else if (age >= 2600 && age < 5200) { row = 10; column = 4; }
          else if (age >= 5200 && age < 7200) { row = 9; column = 4; }
          else column = Math.floor(age / 440) % 6;
          if (phase === 'escape' && age >= 360 || phase === 'peek' && age >= duration) {
            const dodged = phase === 'escape';
            next = now + (dodged ? between(350, 700) : between(7000, 14000));
            reveal = dodged ? 1100 : 1600;
            phase = 'rest'; bird.style.visibility = 'hidden';
          }
        }
        bird.dataset.spot = String(spots.indexOf(spot));
        bird.style.transform = `translate(${x - 72}px, ${y - 78}px) rotate(${turn}deg)`;
        const picture = bird.firstElementChild;
        const flying = source === wings;
        picture.style.width = flying ? '240px' : '144px';
        picture.style.height = flying ? '240px' : '156px';
        picture.style.margin = flying ? '-42px -48px' : '0';
        picture.style.backgroundImage = `url("${source}")`;
        picture.style.backgroundSize = flying ? '400% 200%' : '800% 1100%';
        picture.style.backgroundPosition = `${column * (flying ? -240 : -144)}px ${row * (flying ? -240 : -156)}px`;
      }
      frame = owner.requestAnimationFrame(tick);
    };
    frame = owner.requestAnimationFrame(tick);
    return () => {
      owner.cancelAnimationFrame(frame);
      bird.removeEventListener('pointerenter', escape);
      bird.removeEventListener('pointerdown', escape);
    };
  }, [active, host]);
  return <><span hidden ref={anchor}/>{active && host && createPortal(
    <div className="update-shredder-layer" aria-hidden="true">
      <div className="update-shredder" ref={sprite}><div/></div>
    </div>, host
  )}</>;
}
