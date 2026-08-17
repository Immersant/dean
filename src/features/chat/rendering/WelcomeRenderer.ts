const WELCOME_BRAND_NAME = 'Dean';

export function renderWelcomeContent(
  welcomeEl: HTMLElement,
  greeting?: string,
): void {
  welcomeEl.empty();
  welcomeEl.createDiv({
    cls: 'dean-welcome-brand dean-welcome-text',
    text: WELCOME_BRAND_NAME,
  });

  if (greeting) {
    welcomeEl.createDiv({
      cls: 'dean-welcome-greeting dean-welcome-text',
      text: greeting,
    });
  }
}

export function createWelcomeElement(
  parentEl: HTMLElement,
  greeting?: string,
): HTMLElement {
  const welcomeEl = parentEl.createDiv({ cls: 'dean-welcome' });
  renderWelcomeContent(welcomeEl, greeting);
  return welcomeEl;
}
