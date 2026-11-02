import { ALL, S } from './syllabus.js';

export function matchingChapters(query) {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return ALL.filter(a => words.every(word => `${a.c} ${S[a.s].n} ${a.group}`.toLowerCase().includes(word))).slice(0, 8);
}

export function setupTaskChapterSearch(root) {
  const input = root.querySelector('#taskchaptersearch');
  const value = root.querySelector('#taskchapter');
  const results = root.querySelector('#taskchaptersuggestions');
  const status = root.querySelector('#taskchapterstatus');
  input.addEventListener('input', () => {
    value.value = '';
    input.setCustomValidity('Choose a chapter from the search suggestions.');
    results.replaceChildren();
    const matches = matchingChapters(input.value);
    status.textContent = !input.value.trim() ? 'Type a chapter name or subject.' : matches.length ? `${matches.length} suggestions. Choose a chapter below.` : 'No chapters found. Try another name or subject.';
    for (const chapter of matches) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'chapter-suggestion';
      const title = document.createElement('b');
      title.textContent = chapter.c;
      const subject = document.createElement('small');
      subject.textContent = `${S[chapter.s].n} · ${chapter.group}`;
      button.append(title, subject);
      button.addEventListener('click', () => {
        value.value = chapter.id;
        input.value = chapter.c;
        input.setCustomValidity('');
        status.textContent = `Selected: ${chapter.c} · ${S[chapter.s].n}`;
        results.replaceChildren();
        input.focus();
      });
      results.append(button);
    }
  });
  root.addEventListener('keydown', event => {
    const buttons = [...results.querySelectorAll('button')];
    const index = buttons.indexOf(document.activeElement);
    if (event.key === 'ArrowDown' && buttons.length && (event.target === input || index >= 0)) {
      event.preventDefault(); buttons[(index + 1) % buttons.length].focus();
    } else if (event.key === 'ArrowUp' && index >= 0) {
      event.preventDefault(); (index ? buttons[index - 1] : input).focus();
    } else if (event.key === 'Escape' && (event.target === input || index >= 0)) {
      results.replaceChildren(); input.focus();
    }
  });
}
