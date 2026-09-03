import type { SessionSectionPresentation } from '../../core/session-sections';

/**
 * Apply author cssClass/style from a fence. Classes and CSS properties are open;
 * validation already rejected unsafe values.
 */
export function applySessionSectionPresentation(
  el: HTMLElement,
  presentation: SessionSectionPresentation | undefined,
): void {
  if (!presentation) {
    return;
  }
  if (presentation.cssClass) {
    for (const token of presentation.cssClass.split(/\s+/).filter(Boolean)) {
      el.addClass(token);
    }
  }
  if (!presentation.style) {
    return;
  }
  const style = el.style as CSSStyleDeclaration & Record<string, string>;
  for (const [property, value] of Object.entries(presentation.style)) {
    if (typeof style.setProperty === 'function') {
      style.setProperty(property, value);
    } else {
      style[property] = value;
    }
  }
}
