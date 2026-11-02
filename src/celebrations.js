const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let lastTrail = 0;

function particle(symbol, x, y, burst) {
  if (document.querySelectorAll('.love-particle').length >= 60) return;
  const node = document.createElement('span');
  node.className = 'love-particle';
  node.textContent = symbol;
  node.setAttribute('aria-hidden', 'true');
  node.style.left = `${x}px`;
  node.style.top = `${y}px`;
  document.body.append(node);
  const dx = (Math.random() - .5) * (burst ? 340 : 45);
  const dy = burst ? -70 - Math.random() * 220 : 55;
  const animation = node.animate([
    { transform: 'translate(-50%, -50%) scale(.6)', opacity: 1 },
    { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(${dx / 2}deg) scale(${burst ? 1.3 : .5})`, opacity: 0 }
  ], { duration: burst ? 1250 : 700, easing: 'ease-out' });
  animation.onfinish = () => node.remove();
  animation.oncancel = () => node.remove();
}

export function celebrateCompletion(event) {
  if (reducedMotion()) return;
  const rect = event?.target?.getBoundingClientRect();
  const x = event?.clientX || (rect ? rect.left + rect.width / 2 : innerWidth / 2);
  const y = event?.clientY || (rect ? rect.top + rect.height / 2 : innerHeight / 2);
  for (let i = 0; i < 20; i++) particle(['💕', '💋', '💖', '😘'][i % 4], x, y, true);
}

document.addEventListener('pointermove', event => {
  if (event.pointerType !== 'mouse' || reducedMotion() || performance.now() - lastTrail < 90) return;
  lastTrail = performance.now();
  particle('💋', event.clientX, event.clientY, false);
}, { passive: true });
