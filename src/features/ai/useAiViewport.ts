import { useLayoutEffect, type RefObject } from 'react';

/** The visual viewport shrinks with the soft keyboard, unlike 100dvh in many WebViews. */
export function visibleAiHeight(viewportHeight: number, offsetTop: number, shellTop: number): number {
  return Math.max(0, Math.floor(viewportHeight + offsetTop - Math.max(0, shellTop)));
}

export function useAiViewport(ref: RefObject<HTMLDivElement>) {
  useLayoutEffect(() => {
    const shell = ref.current;
    if (!shell) return;
    const viewport = window.visualViewport;
    const visibleHeight = () => viewport?.height ?? window.innerHeight;
    let restingHeight = visibleHeight();
    let width = window.innerWidth;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (viewport && viewport.scale !== 1) { shell.style.removeProperty('--ai-viewport-height'); return; }
        const currentHeight = visibleHeight();
        const editing = shell.querySelector('.ai-composer textarea') === document.activeElement;
        if (width !== window.innerWidth || !editing) {
          restingHeight = currentHeight;
          width = window.innerWidth;
        }
        // adjustResize shrinks the entire WebView; other browsers shrink only visualViewport.
        const keyboardOpen = editing && Math.max(restingHeight, window.innerHeight) - currentHeight > 80;
        shell.toggleAttribute('data-keyboard-open', keyboardOpen);
        const height = visibleAiHeight(viewport?.height ?? window.innerHeight, viewport?.offsetTop ?? 0, shell.getBoundingClientRect().top);
        if (height > 0) shell.style.setProperty('--ai-viewport-height', `${height}px`);
      });
    };
    update();
    shell.addEventListener('focusin', update);
    shell.addEventListener('focusout', update);
    window.addEventListener('resize', update);
    viewport?.addEventListener('resize', update);
    viewport?.addEventListener('scroll', update);
    return () => {
      cancelAnimationFrame(frame);
      shell.removeEventListener('focusin', update);
      shell.removeEventListener('focusout', update);
      window.removeEventListener('resize', update);
      viewport?.removeEventListener('resize', update);
      viewport?.removeEventListener('scroll', update);
      shell.removeAttribute('data-keyboard-open');
      shell.style.removeProperty('--ai-viewport-height');
    };
  }, [ref]);
}
