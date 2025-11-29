/**
 * Tutorial Positioning Logic
 * Handles tooltip positioning, collision detection, and highlight calculations
 */

import { TUTORIAL, LAYOUT } from './constants';
import { TutorialStep } from './tutorial-config';

export interface HighlightPosition {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface TooltipStyle {
  position: 'fixed';
  top?: string;
  bottom?: string;
  left: string;
  right?: string;
  transform?: string;
  maxWidth: string;
  width?: string;
  zIndex: number;
  margin?: string;
}

/**
 * Calculate element's highlight position and dimensions
 */
export function calculateHighlightPosition(element: HTMLElement): HighlightPosition {
  const rect = element.getBoundingClientRect();
  const scrollX = window.scrollX || window.pageXOffset;
  const scrollY = window.scrollY || window.pageYOffset;

  const computedStyle = window.getComputedStyle(element);
  const isMarketSidebar = element.getAttribute('data-tutorial') === 'market-sidebar';

  let elementWidth = rect.width;
  let elementHeight = rect.height;

  if (isMarketSidebar) {
    elementHeight = element.offsetHeight || element.clientHeight || rect.height;
    elementWidth = element.offsetWidth || element.clientWidth || rect.width;

    const heightValue = computedStyle.height;
    if (heightValue && heightValue !== 'auto' && heightValue.includes('calc')) {
      elementHeight = element.offsetHeight || rect.height;
    }

    elementHeight = Math.max(elementHeight, rect.height);
    elementWidth = Math.max(elementWidth, rect.width);
  } else {
    elementWidth = element.scrollWidth || element.offsetWidth || element.clientWidth || rect.width;
    elementHeight = element.scrollHeight || element.offsetHeight || element.clientHeight || rect.height;
  }

  const top = rect.top + scrollY;
  const left = rect.left + scrollX;

  return { top, left, width: elementWidth, height: elementHeight };
}

/**
 * Check if tooltip overlaps with highlighted element
 */
export function checkTooltipOverlap(
  tooltipTop: number,
  tooltipLeft: number,
  tooltipWidth: number,
  tooltipHeight: number,
  highlightPosition: HighlightPosition
): boolean {
  const tooltipRight = tooltipLeft + tooltipWidth;
  const tooltipBottom = tooltipTop + tooltipHeight;

  const elementRight = highlightPosition.left + highlightPosition.width;
  const elementBottom = highlightPosition.top + highlightPosition.height;

  return !(
    tooltipRight < highlightPosition.left ||
    tooltipLeft > elementRight ||
    tooltipBottom < highlightPosition.top ||
    tooltipTop > elementBottom
  );
}

/**
 * Calculate tooltip position with collision detection
 */
export function calculateTooltipPosition(
  currentStep: TutorialStep,
  stepIndex: number,
  totalSteps: number,
  highlightPosition: HighlightPosition | null,
  isMobile: boolean
): TooltipStyle {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  const tooltipWidth = isMobile
    ? Math.min(viewportWidth - TUTORIAL.SAFE_SIDE_PADDING, TUTORIAL.TOOLTIP_WIDTH_MOBILE)
    : TUTORIAL.TOOLTIP_WIDTH_DESKTOP;
  const tooltipHeight = TUTORIAL.TOOLTIP_HEIGHT;

  // First step (welcome) or no highlight position: center the tooltip
  if (!highlightPosition || stepIndex === 0) {
    return {
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      maxWidth: isMobile ? `calc(100vw - ${TUTORIAL.SAFE_SIDE_PADDING}px)` : `${Math.min(tooltipWidth, viewportWidth - 40)}px`,
      width: isMobile ? `calc(100vw - ${TUTORIAL.SAFE_SIDE_PADDING}px)` : 'auto',
      zIndex: 10000,
      margin: '0 auto',
    };
  }

  const safeTop = isMobile
    ? TUTORIAL.SAFE_TOP_MOBILE
    : LAYOUT.NAVBAR_HEIGHT + TUTORIAL.SAFE_TOP_DESKTOP_OFFSET;
  const safeBottom = isMobile
    ? TUTORIAL.SAFE_BOTTOM_MOBILE
    : TUTORIAL.SAFE_BOTTOM_DESKTOP;

  // Mobile: always center bottom, above mobile nav bar
  if (isMobile) {
    const isMarketSidebar = stepIndex === totalSteps - 1;
    const bottomOffset = isMarketSidebar
      ? LAYOUT.MOBILE_BOTTOM_BAR_HEIGHT + 20
      : LAYOUT.MOBILE_BOTTOM_BAR_HEIGHT + 24;

    return {
      position: 'fixed',
      top: 'auto',
      bottom: `${bottomOffset}px`,
      left: '50%',
      transform: 'translateX(-50%)',
      maxWidth: `calc(100vw - ${TUTORIAL.SAFE_SIDE_PADDING}px)`,
      width: `calc(100vw - ${TUTORIAL.SAFE_SIDE_PADDING}px)`,
      zIndex: 10000,
      margin: '0 auto',
    };
  }

  // Desktop: position based on preferred direction with collision detection
  const centerX = highlightPosition.left + highlightPosition.width / 2;
  const centerY = highlightPosition.top + highlightPosition.height / 2;

  // Try preferred position first, then fallbacks
  const positionsToTry = [
    // Preferred position based on step config
    ...(currentStep.position === 'left'
      ? [{ left: highlightPosition.left - tooltipWidth - TUTORIAL.MIN_SPACING - 120, top: centerY - tooltipHeight / 2 }]
      : []),
    ...(currentStep.position === 'right'
      ? [{ left: highlightPosition.left + highlightPosition.width + TUTORIAL.MIN_SPACING, top: centerY - tooltipHeight / 2 }]
      : []),
    ...(currentStep.position === 'top'
      ? [{ left: centerX - tooltipWidth / 2, top: highlightPosition.top - tooltipHeight - TUTORIAL.MIN_SPACING }]
      : []),
    ...(currentStep.position === 'bottom'
      ? [{ left: centerX - tooltipWidth / 2, top: highlightPosition.top + highlightPosition.height + TUTORIAL.MIN_SPACING }]
      : []),
    // Fallback: center above or below based on element position
    centerY < viewportHeight / 2
      ? { left: centerX - tooltipWidth / 2, top: highlightPosition.top + highlightPosition.height + TUTORIAL.MIN_SPACING }
      : { left: centerX - tooltipWidth / 2, top: highlightPosition.top - tooltipHeight - TUTORIAL.MIN_SPACING },
  ];

  for (const pos of positionsToTry) {
    const finalTop = Math.max(safeTop, Math.min(pos.top, viewportHeight - tooltipHeight - safeBottom));
    const finalLeft = Math.max(TUTORIAL.SAFE_SIDE_PADDING, Math.min(pos.left, viewportWidth - tooltipWidth - TUTORIAL.SAFE_SIDE_PADDING));

    if (!checkTooltipOverlap(finalTop, finalLeft, tooltipWidth, tooltipHeight, highlightPosition)) {
      return {
        position: 'fixed',
        top: `${finalTop}px`,
        left: `${finalLeft}px`,
        maxWidth: `${tooltipWidth}px`,
        width: 'auto',
        zIndex: 10000,
      };
    }
  }

  // Last resort: top or bottom of screen
  const elementCenterY = highlightPosition.top + highlightPosition.height / 2;
  if (elementCenterY < viewportHeight / 2) {
    return {
      position: 'fixed',
      top: `${viewportHeight - tooltipHeight - safeBottom}px`,
      left: '50%',
      transform: 'translateX(-50%)',
      maxWidth: `calc(100vw - ${TUTORIAL.SAFE_SIDE_PADDING}px)`,
      width: 'auto',
      zIndex: 10000,
    };
  }

  return {
    position: 'fixed',
    top: `${safeTop}px`,
    left: '50%',
    transform: 'translateX(-50%)',
    maxWidth: `calc(100vw - ${TUTORIAL.SAFE_SIDE_PADDING}px)`,
    width: 'auto',
    zIndex: 10000,
  };
}

/**
 * Calculate spotlight gradient for overlay
 */
export function calculateSpotlightGradient(highlightPosition: HighlightPosition | null): string {
  if (!highlightPosition) {
    return 'rgba(0, 0, 0, 0.25)';
  }

  const centerX = highlightPosition.left + highlightPosition.width / 2;
  const centerY = highlightPosition.top + highlightPosition.height / 2;
  const radius = Math.max(highlightPosition.width, highlightPosition.height) + 60;

  return `radial-gradient(circle ${radius}px at ${centerX}px ${centerY}px, transparent 0%, rgba(0, 0, 0, 0.25) 100%)`;
}

