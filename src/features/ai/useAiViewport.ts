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
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (viewport && viewport.scale !== 1) { shell.style.removeProperty('--ai-viewport-height'); return; }
        const height = visibleAiHeight(viewport?.height ?? window.innerHeight, viewport?.offsetTop ?? 0, shell.getBoundingClientRect().top);
        if (height > 0) shell.style.setProperty('--ai-viewport-height', `${height}px`);
      });
    };
    update();
    window.addEventListener('resize', update);
    viewport?.addEventListener('resize', update);
    viewport?.addEventListener('scroll', update);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('resize', update); viewport?.removeEventListener('resize', update); viewport?.removeEventListener('scroll', update); shell.style.removeProperty('--ai-viewport-height'); };
  }, [ref]);
}
