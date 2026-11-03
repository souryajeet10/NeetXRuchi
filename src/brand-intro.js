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
  timeline.fromTo(logo,
    {opacity:0, scale:.86, y:28, filter:'blur(8px)'},
    {opacity:1, scale:1, y:0, filter:'blur(0px)', duration:.95, ease:'power3.out', clearProps:'filter,transform'}, 0)
    .from(copy, {opacity:0, y:10, duration:.35}, .55);

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
