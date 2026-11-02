import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger.js';
import { ScrollSmoother } from 'gsap/ScrollSmoother.js';

gsap.registerPlugin(ScrollTrigger, ScrollSmoother);

export function setupSmoothScroll() {
  const tracker = document.getElementById('trackerpage');
  const login = document.getElementById('loginpage');
  const sidebar = document.querySelector('.study-sidebar');
  const wrapper = document.createElement('div');
  const content = document.createElement('div');
  wrapper.id = 'smooth-wrapper';
  content.id = 'smooth-content';
  tracker.before(wrapper);
  wrapper.append(content);
  content.append(login, tracker);
  // Fixed navigation must remain outside the transformed scrolling content.
  document.body.append(sidebar);
  const syncSidebar = () => { sidebar.hidden = tracker.hidden; };
  syncSidebar();
  const visibility = new MutationObserver(syncSidebar);
  visibility.observe(tracker, { attributes: true, attributeFilter: ['hidden'] });

  let smoother;
  const media = gsap.matchMedia();
  media.add('(prefers-reduced-motion: no-preference)', () => {
    smoother = ScrollSmoother.create({
      wrapper,
      content,
      smooth: 0.8,
      smoothTouch: false,
      effects: false,
      normalizeScroll: false
    });
    return () => { smoother?.kill(); smoother = null; };
  });

  let frame;
  let lastHeight = -1;
  const resize = new ResizeObserver(([entry]) => {
    const height = entry.contentRect.height;
    if (height === lastHeight) return;
    lastHeight = height;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => { if (smoother) ScrollTrigger.refresh(); });
  });
  resize.observe(content);

  if (import.meta.hot) import.meta.hot.dispose(() => {
    cancelAnimationFrame(frame);
    resize.disconnect();
    visibility.disconnect();
    media.revert();
    tracker.prepend(sidebar);
    sidebar.hidden = false;
    wrapper.before(login, tracker);
    wrapper.remove();
  });
}
