import { gsap } from 'gsap';

let timeline;
let finishing = false;
let destination;
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const elements = () => ({
  screen: document.getElementById('loadingscreen'),
  logo: document.querySelector('#intro-logo .softy-logo'),
  copy: document.querySelector('.intro-copy')
});

function reset() {
  const {screen, logo, copy} = elements();
  screen.hidden = true;
  screen.classList.remove('is-active');
  logo.classList.remove('is-assembling');
  logo.querySelectorAll('.intro-logo-piece').forEach(piece => piece.remove());
  gsap.set([screen, logo, copy, ...logo.children], {clearProps:'all'});
  if(destination)destination.style.visibility = '';
  destination = null;
  finishing = false;
  timeline = null;
}

export function showBrandIntro(title, message) {
  const {screen, logo, copy} = elements();
  document.getElementById('loadingtitle').textContent = title;
  document.getElementById('loadingstatus').textContent = message;
  if(screen.classList.contains('is-active') && !finishing) return;
  timeline?.kill();
  reset();
  screen.hidden = false;
  screen.classList.add('is-active');
  timeline = gsap.timeline();
  if(reduced()) return;
  const artwork = logo.querySelector('.softy-artwork');
  // Display regions of the supplied image so the animated lettering is identical
  // to the final logo, with no replacement font or recreated artwork.
  const regions = {
    neet:'inset(38% 50% 39% 27%)',
    x:'inset(38% 43.5% 39% 50%)',
    softy:'inset(38% 15% 39% 56.5%)',
    top:'inset(0 0 62% 0)',
    bottom:'inset(61% 0 0 0)',
    left:'inset(38% 73% 39% 0)',
    right:'inset(38% 0 39% 85%)'
  };
  const pieces = {};
  for(const [name, clip] of Object.entries(regions)) {
    const piece = document.createElement('span');
    piece.className = 'intro-logo-piece';
    piece.setAttribute('aria-hidden', 'true');
    const image = artwork.cloneNode();
    image.style.clipPath = clip;
    piece.append(image);
    logo.append(piece);
    pieces[name] = piece;
  }
  logo.classList.add('is-assembling');
  gsap.set(artwork, {opacity:0});
  timeline.from(pieces.neet, {x:-innerWidth*.65, opacity:0, duration:1, ease:'power3.out'}, 0)
    .from(pieces.x, {y:innerHeight*.6, opacity:0, duration:1, ease:'back.out(1.2)'}, .12)
    .from(pieces.softy, {x:innerWidth*.65, opacity:0, duration:1, ease:'power3.out'}, 0)
    .from([pieces.top,pieces.bottom,pieces.left,pieces.right], {opacity:0, duration:.45}, .8)
    .from(copy, {opacity:0, y:10, duration:.35}, .9)
    .set(artwork, {opacity:1}, 1.3)
    .call(() => {
      Object.values(pieces).forEach(piece => piece.remove());
      logo.classList.remove('is-assembling');
    }, [], 1.3);

}

export function finishBrandIntro(dock = false) {
  const {screen, logo, copy} = elements();
  if(!screen.classList.contains('is-active') || finishing) return;
  finishing = true;
  if(!dock || reduced()) {
    timeline?.kill();
    timeline = gsap.timeline().to(screen, {opacity:0, duration:reduced()?0:.2, onComplete:reset});
    return;
  }
  // Let the artwork finish its entrance before moving it into navigation.
  timeline = timeline || gsap.timeline();
  timeline.to({}, {duration:.25}).to(copy, {opacity:0, duration:.2}).add(() => {
    destination = document.querySelector('.sidebar-brand .softy-logo');
    const target = destination?.getBoundingClientRect();
    if(!target?.width || !target.height) {
      // The sidebar brand is intentionally hidden in the mobile bottom navigation.
      timeline = gsap.timeline().to(screen, {opacity:0, duration:.25, onComplete:reset});
      return;
    }
    const start = logo.getBoundingClientRect();
    destination.style.visibility = 'hidden';
    timeline = gsap.timeline().to(logo, {
      x:target.left-start.left, y:target.top-start.top,
      scaleX:target.width/start.width, scaleY:target.height/start.height,
      transformOrigin:'top left', duration:.85, ease:'power3.inOut'
    }).to(screen, {opacity:0, duration:.2, onComplete:reset});
  });
  timeline.play();
}

if(import.meta.hot)import.meta.hot.dispose(() => {timeline?.kill(); reset();});
