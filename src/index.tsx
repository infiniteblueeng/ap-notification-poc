import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { injectStyles } from './injectStyles';
import { hasAnyNotificationsPermission } from 'utils/permissions';
import { params } from 'utils/consts';
import { setPortalContainer } from './domScope';

declare global {
  interface Window {
    __openCommunicationsModal?: () => void;
    __closeCommunicationsModal?: () => void;
  }
}

const isDev = process.env.NODE_ENV === 'development';
const isStandalone = !!params.standaloneMode;

type ScopedMount = {
  mountNode: HTMLElement;
  portalNode: HTMLElement;
  styleTarget: ShadowRoot | null;
};

function isPhoneDevice(): boolean {
  const navigatorWithUserAgentData = navigator as Navigator & {
    userAgentData?: {
      mobile?: boolean;
    };
  };

  if (navigatorWithUserAgentData.userAgentData?.mobile === true) {
    return true;
  }

  if (/Android.*Mobile|iPhone|iPod|Mobi|Windows Phone/i.test(navigator.userAgent)) {
    return true;
  }

  const hasCoarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const shortestViewportSide = Math.min(window.innerWidth || 0, window.innerHeight || 0);

  return hasCoarsePointer && shortestViewportSide > 0 && shortestViewportSide <= 767;
}

function ensureHostContainer(): HTMLElement {
  if (isStandalone) {
    const viewRoot = document.getElementById('root-element');
    if (viewRoot) return viewRoot;

    const el = document.createElement('div');
    el.id = 'root-element';
    document.body.appendChild(el);
    return el;
  }

  const existing = document.getElementById('eb-notifications-root');
  if (existing) return existing;

  const el = document.createElement('div');
  el.id = 'eb-notifications-root';
  document.body.appendChild(el);
  return document.body;
}

function ensureReactMountNode(): ScopedMount {
  const hostParent = ensureHostContainer();

  let host = document.getElementById('eb-notifications-root');
  if (!host) {
    host = document.createElement('div');
    host.id = 'eb-notifications-root';
    hostParent.appendChild(host);
  }

  if (isDev) {
    return {
      mountNode: host,
      portalNode: host,
      styleTarget: null,
    };
  }

  const shadowRoot = host.shadowRoot ?? host.attachShadow({ mode: 'open' });

  let mountNode = shadowRoot.getElementById('eb-notifications-app-root') as HTMLDivElement | null;
  if (!mountNode) {
    mountNode = document.createElement('div');
    mountNode.id = 'eb-notifications-app-root';
    shadowRoot.appendChild(mountNode);
  }

  let portalNode = shadowRoot.getElementById('eb-notifications-portal-root') as HTMLDivElement | null;
  if (!portalNode) {
    portalNode = document.createElement('div');
    portalNode.id = 'eb-notifications-portal-root';
    shadowRoot.appendChild(portalNode);
  }

  return {
    mountNode,
    portalNode,
    styleTarget: shadowRoot,
  };
}

function injectHeaderCommunicationsButton() {
  const BTN_ATTR = 'data-eb-notifications-header';
  const BTN_ID = 'eb-notifications-toolbar-button';
  const BOUND_ATTR = 'data-eb-notifications-bound';
  const TOOLBAR_ATTR = 'data-eb-notifications-toolbar';
  const BTN_ICON_ATTR = 'data-eb-notifications-icon';
  const REFLOW_DELAYS = [0, 100, 300, 800];
  const TOOLBAR_SELECTOR = 'div.rbs-pageheader-toolbar.k-toolbar';

  type ToolbarWidget = {
    add?: (command: Record<string, unknown>) => void;
    resize?: (force?: boolean) => void;
  };

  type KendoWindow = Window & {
    kendo?: {
      resize?: (element: Element, force?: boolean) => void;
    };
  };

  // small helper to inject one-time stylesheet for hover/focus
  const ensureButtonStyles = () => {
    if (document.getElementById('eb-communications-btn-styles')) return;
    const css = `
      [${BTN_ATTR}="1"] {
        text-decoration: none;
        background: #0042B6 !important;
        color: #fff !important;
        border: none !important;
        border-radius: 8px !important;
        box-sizing: border-box;
        display: inline-flex !important;
        align-items: center;
        gap: 2px;
        height: 32px !important;
        padding: 6px 16px !important;
        white-space: nowrap;
        font-size: 14px !important;
        font-weight: 600 !important;
        line-height: 1 !important;
      }
      [${BTN_ATTR}="1"] .k-button-icon,
      [${BTN_ATTR}="1"] .k-icon,
      [${BTN_ATTR}="1"] .fa {
        color: inherit;
        display: inline-flex;
        align-items: center;
        margin-right: 0 !important;
      }
      [${BTN_ATTR}="1"] .k-button-icon svg {
        display: block;
        flex: 0 0 auto;
      }
      [${BTN_ATTR}="1"] .k-button-text {
        color: inherit;
      }
      [${BTN_ATTR}="1"]:hover {
        filter: brightness(0.95);
      }
      [${BTN_ATTR}="1"]:focus {
        outline: none;
      }
      [${BTN_ATTR}="1"]:focus-visible {
        box-shadow: 0 0 0 4px rgba(0,90,230,0.18);
        border-radius: 8px;
      }
      [${BTN_ATTR}="1"]:active {
        transform: translateY(1px) scale(0.995);
        box-shadow: 0 1px 0 rgba(0,0,0,0.12) inset;
        filter: brightness(0.92);
      }
      [${TOOLBAR_ATTR}="1"] {
        box-sizing: border-box;
        padding-right: 18px !important;
      }
    `;
    const style = document.createElement('style');
    style.id = 'eb-communications-btn-styles';
    style.appendChild(document.createTextNode(css));
    document.head.appendChild(style);
  };

  const getToolbarWidget = (toolbar: HTMLDivElement): ToolbarWidget | null => {
    const windowWithJQuery = window as typeof window & {
      jQuery?: (node: Element) => { data?: (key: string) => ToolbarWidget | undefined };
      $?: (node: Element) => { data?: (key: string) => ToolbarWidget | undefined };
    };

    return (
      windowWithJQuery.jQuery?.(toolbar)?.data?.('kendoToolBar') ??
      windowWithJQuery.$?.(toolbar)?.data?.('kendoToolBar') ??
      null
    );
  };

  const syncHostToolbarLayout = (toolbar: HTMLDivElement) => {
    const windowWithKendo = window as KendoWindow;
    const toolbarWidget = getToolbarWidget(toolbar);
    if (typeof toolbarWidget?.resize === 'function') {
      toolbarWidget.resize(true);
    }

    if (typeof windowWithKendo.kendo?.resize === 'function') {
      windowWithKendo.kendo.resize(toolbar, true);
    }

    window.dispatchEvent(new Event('resize'));
  };

  const bindButton = (button: HTMLElement) => {
    if (button.getAttribute(BOUND_ATTR) === '1') return;

    const onActivate = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      window.__openCommunicationsModal?.();
    };

    button.addEventListener('click', onActivate, true);
    button.setAttribute(BOUND_ATTR, '1');
  };

  const createButtonIcon = () => {
    const iconWrap = document.createElement('span');
    iconWrap.className = 'k-button-icon';
    iconWrap.setAttribute(BTN_ICON_ATTR, '1');
    iconWrap.setAttribute('aria-hidden', 'true');

    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('xmlns', svgNS);
    svg.setAttribute('width', '17');
    svg.setAttribute('height', '12');
    svg.setAttribute('viewBox', '0 0 17 12');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');

    const path = document.createElementNS(svgNS, 'path');
    path.setAttribute(
      'd',
      'M16.7354 0C12.4998 0 8.55986 2.2773 6.45263 5.94384L6.45065 5.94712C6.44668 5.95369 6.40104 6.03646 6.32763 6.18359C4.76209 4.50205 2.57417 3.54436 0.264561 3.54436H0V7.13274H0.264561C2.82352 7.13274 4.90561 9.19853 4.90561 11.7373V12H8.52745L8.52216 11.732C8.52216 11.7182 8.50165 10.3651 9.09824 8.74925C10.2385 5.66271 13.3081 3.58903 16.7354 3.58903H17V0H16.7354ZM0.529121 6.61317V4.07379C2.66412 4.14604 4.66883 5.09256 6.08423 6.69987C6.06505 6.74323 6.04521 6.78789 6.0247 6.83453C5.73898 7.49466 5.32031 8.60211 5.08419 9.88166C4.36393 8.04445 2.60658 6.71761 0.529121 6.61317ZM5.4387 11.4739C5.49294 9.7273 6.07299 8.07795 6.45925 7.16295C7.40902 8.42476 7.93549 9.90793 7.98841 11.4739H5.4387ZM16.4709 3.06683C12.9297 3.17062 9.78874 5.35464 8.60153 8.5673C8.45602 8.96207 8.34556 9.3391 8.2609 9.68854C7.98907 8.64415 7.50889 7.66019 6.83228 6.78001C6.78796 6.72286 6.74563 6.66835 6.70463 6.61711C6.82368 6.36685 6.90437 6.2184 6.91297 6.20264C8.88262 2.77716 12.5269 0.621381 16.4709 0.528765V3.06683Z'
    );
    path.setAttribute('fill', 'white');

    svg.appendChild(path);
    iconWrap.appendChild(svg);
    return iconWrap;
  };

  const ensureButtonContent = (button: HTMLElement) => {
    const currentLabel = button.querySelector('.k-button-text, .k-text') as HTMLElement | null;
    const labelText = (currentLabel?.textContent ?? button.textContent ?? 'Communications').trim() || 'Communications';
    const hasExpectedIcon = !!button.querySelector(`[${BTN_ICON_ATTR}="1"]`);

    if (hasExpectedIcon && currentLabel) {
      currentLabel.textContent = labelText;
      return;
    }

    button.replaceChildren();

    const label = document.createElement('span');
    label.className = 'k-button-text';
    label.textContent = labelText;

    button.append(createButtonIcon(), label);
  };

  const styleButton = (button: HTMLElement) => {
    ensureButtonContent(button);
    button.setAttribute(BTN_ATTR, '1');
    button.id = BTN_ID;
    button.setAttribute('aria-label', 'Open Communications');
    button.setAttribute('title', 'Communications');
    button.style.visibility = 'visible';
    button.style.whiteSpace = 'nowrap';
    button.style.flex = '0 0 auto';
  };

  const positionButton = (toolbar: HTMLDivElement, button: HTMLElement) => {
    const edit = toolbar.querySelector('a.rbs-marker-button-edit, button.rbs-marker-button-edit') as HTMLElement | null;

    if (edit && edit.parentElement === toolbar) {
      toolbar.insertBefore(button, edit);
      return;
    }

    const firstAction = toolbar.querySelector('a.marker-pageToolbar-action, button.marker-pageToolbar-action') as HTMLElement | null;
    if (firstAction && firstAction.parentElement === toolbar) {
      toolbar.insertBefore(button, firstAction);
      return;
    }

    toolbar.appendChild(button);
  };

  const scheduleToolbarReflow = (toolbar: HTMLDivElement, button: HTMLElement) => {
    REFLOW_DELAYS.forEach((delay) => {
      window.setTimeout(() => {
        requestAnimationFrame(() => {
          const currentButton = findToolbarButton(toolbar) ?? button;
          styleButton(currentButton);
          bindButton(currentButton);
          positionButton(toolbar, currentButton);
          syncHostToolbarLayout(toolbar);
          requestAnimationFrame(() => {
            const liveButton = findToolbarButton(toolbar) ?? currentButton;
            styleButton(liveButton);
            bindButton(liveButton);
            positionButton(toolbar, liveButton);
          });
        });
      }, delay);
    });
  };

  const createWidgetButton = (toolbar: HTMLDivElement) => {
    const toolbarWidget = getToolbarWidget(toolbar);
    if (typeof toolbarWidget?.add !== 'function') {
      return null;
    }

    try {
      toolbarWidget.add({
        type: 'button',
        id: BTN_ID,
        text: 'Communications',
        overflow: 'never',
        attributes: {
          [BTN_ATTR]: '1',
        },
      });
    } catch {
      return null;
    }

    syncHostToolbarLayout(toolbar);
    return toolbar.querySelector(`#${BTN_ID}`) as HTMLElement | null;
  };

  const createFallbackButton = (toolbar: HTMLDivElement) => {
    const button = document.createElement('a');
    button.setAttribute('href', '');
    button.setAttribute('tabindex', '0');
    button.className = 'marker-pageToolbar-action k-button';
    button.setAttribute('role', 'button');
    button.textContent = 'Communications';
    toolbar.appendChild(button);
    return button;
  };

  const removeLegacyButtons = (toolbar: HTMLDivElement) => {
    const buttons = Array.from(document.querySelectorAll(`[${BTN_ATTR}="1"]`));
    buttons.forEach((button) => {
      if (!(button instanceof HTMLElement)) return;
      if (button.id === BTN_ID || button.id === `${BTN_ID}_overflow`) return;
      if (button.parentElement === toolbar) {
        button.remove();
      }
    });
  };

  const findToolbarButton = (toolbar: HTMLDivElement) => {
    return (
      (toolbar.querySelector(`#${BTN_ID}`) as HTMLElement | null) ??
      (toolbar.querySelector(`[${BTN_ATTR}="1"]`) as HTMLElement | null)
    );
  };

  const tryInject = () => {
    const toolbar = document.querySelector(TOOLBAR_SELECTOR) as HTMLDivElement | null;
    if (!toolbar) return false;

    ensureButtonStyles();
    toolbar.setAttribute(TOOLBAR_ATTR, '1');
    removeLegacyButtons(toolbar);

    let button = findToolbarButton(toolbar);

    if (!button) {
      button = createWidgetButton(toolbar) ?? createFallbackButton(toolbar);
    }

    styleButton(button);
    bindButton(button);
    positionButton(toolbar, button);
    scheduleToolbarReflow(toolbar, button);
    return true;
  };

  if (tryInject()) return;

  const obs = new MutationObserver(() => {
    if (tryInject()) {
      obs.disconnect();
    }
  });
  obs.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
}

// Host-only concerns
const { mountNode, portalNode, styleTarget } = ensureReactMountNode();

setPortalContainer(portalNode);

if (!isDev) {
  if (styleTarget) {
    injectStyles(styleTarget);
  }
  if (!isStandalone && !isPhoneDevice()) {
    void hasAnyNotificationsPermission()
      .then((hasPermission) => {
        if (hasPermission) {
          injectHeaderCommunicationsButton();
        }
      })
      .catch((err) => {
        console.warn('Unable to verify communications permissions for header button', err);
      });
  }
}

const root = ReactDOM.createRoot(mountNode);

root.render(<App isDev={isDev} isStandalone={isStandalone} />);
