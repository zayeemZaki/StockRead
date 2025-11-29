'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { MousePointerClick } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { TUTORIAL_STEPS } from '@/lib/tutorial-config';
import { calculateHighlightPosition, type HighlightPosition } from '@/lib/tutorial-positioning';
import { TUTORIAL } from '@/lib/constants';


export function OnboardingTutorial() {
  const [currentStep, setCurrentStep] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null);
  const [highlightPosition, setHighlightPosition] = useState<HighlightPosition | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isInitialMount, setIsInitialMount] = useState(true);
  const cleanupRef = useRef<(() => void) | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setMounted(true);
    
    // Check localStorage only on client side
    if (typeof window !== 'undefined') {
      try {
        // Allow forcing tutorial to show via URL parameter (useful for testing/debugging)
        const urlParams = new URLSearchParams(window.location.search);
        const forceShow = urlParams.get('showTutorial') === 'true';
        
        const hasCompleted = localStorage.getItem(TUTORIAL.STORAGE_KEY) === 'true';
        
        if (forceShow || !hasCompleted) {
          // If forcing, clear the completion flag
          if (forceShow) {
            localStorage.removeItem(TUTORIAL.STORAGE_KEY);
          }
          
          const timer = setTimeout(() => {
            setIsOpen(true);
            setTimeout(() => setIsInitialMount(false), TUTORIAL.TRANSITION_DURATION_MS);
          }, TUTORIAL.INITIAL_DELAY_MS);
          return () => clearTimeout(timer);
        }
      } catch (error) {
        // localStorage might be disabled or unavailable
        // Show tutorial anyway if we can't check
        const timer = setTimeout(() => {
          setIsOpen(true);
          setTimeout(() => setIsInitialMount(false), TUTORIAL.TRANSITION_DURATION_MS);
        }, TUTORIAL.INITIAL_DELAY_MS);
        return () => clearTimeout(timer);
      }
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isOpen]);

  const updateHighlightPosition = useCallback((element: HTMLElement) => {
    const position = calculateHighlightPosition(element);
    setHighlightPosition(position);
  }, []);

  const handleComplete = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(TUTORIAL.STORAGE_KEY, 'true');
    }
    setIsOpen(false);
    
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }
    
    document.querySelectorAll('.tutorial-highlight-pulse').forEach(el => {
      el.classList.remove('tutorial-highlight-pulse');
      (el as HTMLElement).style.cursor = '';
    });
    
    setTargetElement(null);
    setHighlightPosition(null);
  }, []);

  const handleNext = useCallback(() => {
    if (currentStep < TUTORIAL_STEPS.length - 1) {
      setIsTransitioning(true);
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
      
      setTimeout(() => {
        setCurrentStep(prev => prev + 1);
        setIsTransitioning(false);
      }, TUTORIAL.TRANSITION_DURATION_MS);
    } else {
      handleComplete();
    }
  }, [currentStep, handleComplete]);

  const handleSkip = useCallback(() => {
    handleComplete();
  }, [handleComplete]);

  // Get dynamic description based on screen size for market sidebar step
  // Must be defined before early return to maintain hooks order
  const getStepDescription = useCallback(() => {
    if (currentStep === TUTORIAL_STEPS.length - 1) { // Market sidebar step
      if (typeof window !== 'undefined') {
        const isMobile = window.innerWidth < 768;
        return isMobile
          ? 'Tap the Market tab at the bottom to view live prices and trending news. You can also access it from the markets page.'
          : 'Check out the market sidebar for live prices and trending news. Click on any stock to see detailed analysis.';
      }
    }
    return TUTORIAL_STEPS[currentStep]?.description || '';
  }, [currentStep]);

  // Setup element highlighting and interaction
  useEffect(() => {
    if (!isOpen || currentStep >= TUTORIAL_STEPS.length || isTransitioning) {
      return;
    }

    const step = TUTORIAL_STEPS[currentStep];
    let element: HTMLElement | null = null;
    let retryCount = 0;
    const maxRetries = 15;

    const findAndSetupElement = () => {
      // Clear any existing retry timeout
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }

      // Try to find the element - prioritize visible elements, especially on mobile
      const allMatches = document.querySelectorAll(step.targetSelector);
      element = null;
      const isMobile = window.innerWidth < 768;
      const isMarketSidebarStep = step.targetSelector === '[data-tutorial="market-sidebar"]';
      
      // For market sidebar on mobile, prioritize the bottom tab bar link
      if (isMarketSidebarStep && isMobile) {
        // Look for the Market tab in bottom navigation first
        for (const match of Array.from(allMatches)) {
          const htmlMatch = match as HTMLElement;
          // Check if it's in the bottom navigation (has "Market" text or is positioned at bottom)
          const rect = htmlMatch.getBoundingClientRect();
          const isBottomNav = rect.bottom > window.innerHeight - 100 || // Near bottom of screen
                             htmlMatch.textContent?.includes('Market') ||
                             htmlMatch.closest('[class*="bottom"]') ||
                             htmlMatch.closest('.md\\:hidden'); // Mobile-only container
          
          if (isBottomNav) {
            const computedStyle = window.getComputedStyle(htmlMatch);
            const isVisible = htmlMatch.offsetParent !== null && 
                             computedStyle.display !== 'none' && 
                             computedStyle.visibility !== 'hidden' &&
                             rect.width > 0 && 
                             rect.height > 0;
            if (isVisible) {
              element = htmlMatch;
              break; // Found the bottom nav link, use it
            }
          }
        }
      }
      
      // If not found or not mobile market step, check all matches
      if (!element) {
        // Check all matches and find the one that's actually visible
        // On mobile, prioritize elements that are in the viewport
        for (const match of Array.from(allMatches)) {
          const htmlMatch = match as HTMLElement;
          const rect = htmlMatch.getBoundingClientRect();
          const computedStyle = window.getComputedStyle(htmlMatch);
          
          // Check if element is visible
          const isNotHidden = computedStyle.display !== 'none' && 
                             computedStyle.visibility !== 'hidden' &&
                             computedStyle.opacity !== '0';
          const hasDimensions = rect.width > 0 && rect.height > 0;
          const isInViewport = rect.top >= -50 && 
                              rect.left >= -50 &&
                              rect.top <= window.innerHeight + 50 &&
                              rect.left <= window.innerWidth + 50;
          const isVisible = htmlMatch.offsetParent !== null && 
                           isNotHidden &&
                           hasDimensions &&
                           (isMobile ? isInViewport : true); // Stricter on mobile
          
          if (isVisible) {
            element = htmlMatch;
            // On mobile, prefer elements that are currently in viewport
            if (isMobile && isInViewport && rect.top >= 0 && rect.left >= 0) {
              break; // Found a good match, use it
            }
          }
        }
      }
      
      // Fallback to first match if no visible element found
      if (!element && allMatches.length > 0) {
        element = allMatches[0] as HTMLElement;
      }
      
      // Log for debugging (can be removed later)
      if (!element && allMatches.length > 0) {
        console.warn(`Tutorial: Found ${allMatches.length} matches for ${step.targetSelector} but none are visible`);
      }

      // Special handling for body element (first step)
      const isBodyElement = element === document.body;
      const isVisible = isBodyElement || (element && element.offsetParent !== null);

      if (element && isVisible) {
        // Element exists and is visible
        setTargetElement(element);
        
        if (isBodyElement) {
          // For body, set full viewport dimensions immediately
          setHighlightPosition({
            top: 0,
            left: 0,
            width: window.innerWidth,
            height: window.innerHeight,
          });
        } else {
          // Wait a bit for element to fully render, especially for async-loaded components
          setTimeout(() => {
            if (element && element.offsetParent !== null) {
              updateHighlightPosition(element);
            }
          }, 200);
          
          // Also update immediately
          updateHighlightPosition(element);
          
          // For market sidebar specifically, wait a bit longer for content to load
          const isMarketSidebar = element.getAttribute('data-tutorial') === 'market-sidebar';
          if (isMarketSidebar) {
            // Wait for content to load (stocks and news) and update multiple times
            const updateInterval = setInterval(() => {
              if (element && element.offsetParent !== null) {
                updateHighlightPosition(element);
              }
            }, 200);
            
            // Clear interval after content should be loaded
            setTimeout(() => {
              clearInterval(updateInterval);
              if (element && element.offsetParent !== null) {
                updateHighlightPosition(element);
              }
            }, 1000);
          }
          
          // Smooth scroll to element (with delay for better UX)
          setTimeout(() => {
            element?.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'center',
              inline: 'nearest'
            });
            // Update position again after scroll completes
            setTimeout(() => {
              if (element && element.offsetParent !== null) {
                updateHighlightPosition(element);
              }
            }, 600);
          }, 100);
        }

        // Setup click listener if action is required
        if (step.waitForAction && step.action === 'click') {
          const handleClick = (e: Event) => {
            e.stopPropagation();
            e.preventDefault();
            handleNext();
          };
          
          // For mobile, also listen on touch events
          const handleTouchEnd = (e: TouchEvent) => {
            e.stopPropagation();
            e.preventDefault();
            handleNext();
          };
          
          // Use capture phase to ensure we catch the click
          element.addEventListener('click', handleClick, { once: true, capture: true });
          element.addEventListener('touchend', handleTouchEnd, { once: true, capture: true });
          element.style.cursor = 'pointer';
          element.style.touchAction = 'manipulation'; // Improve touch responsiveness
          element.style.transition = 'transform 0.2s ease, box-shadow 0.2s ease';
          element.classList.add('tutorial-highlight-pulse');
          
          // Add hover effect
          const handleMouseEnter = () => {
            element?.style.setProperty('transform', 'scale(1.02)');
          };
          const handleMouseLeave = () => {
            element?.style.setProperty('transform', 'scale(1)');
          };
          
          element.addEventListener('mouseenter', handleMouseEnter);
          element.addEventListener('mouseleave', handleMouseLeave);

          cleanupRef.current = () => {
            element?.removeEventListener('click', handleClick, { capture: true });
            element?.removeEventListener('touchend', handleTouchEnd, { capture: true });
            element?.removeEventListener('mouseenter', handleMouseEnter);
            element?.removeEventListener('mouseleave', handleMouseLeave);
            if (element) {
              element.style.cursor = '';
              element.style.touchAction = '';
              element.style.transform = '';
              element.classList.remove('tutorial-highlight-pulse');
            }
          };
        } else {
          // For non-interactive steps (like welcome), don't auto-advance
          // User must click "Next" button manually
          cleanupRef.current = () => {
            // No cleanup needed for non-interactive steps
          };
        }
      } else if (retryCount < maxRetries) {
        // Element not found or not visible, retry
        retryCount++;
        retryTimeoutRef.current = setTimeout(findAndSetupElement, 400);
      } else {
        // Element not found after retries
        console.warn(`Tutorial element not found: ${step.targetSelector}`);
        // Auto-advance if it's a non-interactive step
        if (!step.waitForAction) {
          const stepIndex = currentStep;
          setTimeout(() => {
            if (stepIndex === currentStep) {
              handleNext();
            }
          }, 2000);
        }
      }
    };

    findAndSetupElement();

    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [currentStep, isOpen, isTransitioning, updateHighlightPosition, handleNext]);

  // Update position on scroll/resize with throttling
  useEffect(() => {
    if (!targetElement || isTransitioning) return;

    let rafId: number;
    let intervalId: NodeJS.Timeout | null = null;
    
    const updatePosition = () => {
      if (targetElement && targetElement.offsetParent !== null) {
        updateHighlightPosition(targetElement);
      }
    };

    const throttledUpdate = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(updatePosition);
    };

    // For market sidebar, also update continuously to catch content loading
    const isMarketSidebar = targetElement?.getAttribute('data-tutorial') === 'market-sidebar';
    if (isMarketSidebar) {
      intervalId = setInterval(updatePosition, 300);
    }

    window.addEventListener('scroll', throttledUpdate, { passive: true });
    window.addEventListener('resize', throttledUpdate, { passive: true });

    return () => {
      window.removeEventListener('scroll', throttledUpdate);
      window.removeEventListener('resize', throttledUpdate);
      if (rafId) cancelAnimationFrame(rafId);
      if (intervalId) clearInterval(intervalId);
    };
  }, [targetElement, isTransitioning, updateHighlightPosition]);

  // Only render after client-side mount to avoid hydration issues
  if (!mounted) {
    return null;
  }

  // Don't render if tutorial is not open (either completed or not started yet)
  if (!isOpen) {
    return null;
  }

  const progress = ((currentStep + 1) / TUTORIAL_STEPS.length) * 100;
  const currentStepData = TUTORIAL_STEPS[currentStep];
  const isLastStep = currentStep === TUTORIAL_STEPS.length - 1;
  const requiresInteraction = currentStepData.waitForAction && currentStepData.action === 'click';

  // Helper function to check if tooltip overlaps with highlighted element
  const checkOverlap = (
    tooltipTop: number,
    tooltipLeft: number,
    tooltipWidth: number,
    tooltipHeight: number
  ): boolean => {
    if (!highlightPosition) return false;
    
    const tooltipRight = tooltipLeft + tooltipWidth;
    const tooltipBottom = tooltipTop + tooltipHeight;
    const elementRight = highlightPosition.left + highlightPosition.width;
    const elementBottom = highlightPosition.top + highlightPosition.height;
    
    // Strict overlap check with larger buffer (60px minimum gap)
    const buffer = 60;
    return !(
      tooltipRight < highlightPosition.left - buffer ||
      tooltipLeft > elementRight + buffer ||
      tooltipBottom < highlightPosition.top - buffer ||
      tooltipTop > elementBottom + buffer
    );
  };

  // Calculate tooltip position with viewport bounds checking and overlap prevention
  const getTooltipPosition = () => {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const isMobile = viewportWidth < 768;
    // For mobile, use a percentage-based width that's wider, for desktop use fixed width
    const tooltipWidth = isMobile ? Math.min(viewportWidth - 24, 400) : 380;
    const tooltipHeight = 280;
    
    // For first step (welcome) or when no highlight position, center the tooltip
    if (!highlightPosition || currentStep === 0) {
      return { 
        position: 'fixed' as const,
        top: '50%', 
        left: '50%', 
        transform: 'translate(-50%, -50%)',
        maxWidth: isMobile ? 'calc(100vw - 24px)' : `${Math.min(tooltipWidth, viewportWidth - 40)}px`,
        width: isMobile ? 'calc(100vw - 24px)' : 'auto',
        zIndex: 10000,
        margin: '0 auto',
      };
    }

    const step = TUTORIAL_STEPS[currentStep];
    const minSpacing = 80; // Increased minimum spacing to prevent overlap
    
    // Account for fixed elements with extra padding
    const navbarHeight = 56; // h-14 = 56px
    const mobileBottomBarHeight = 64; // h-16 = 64px
    const safeTop = isMobile ? 24 : navbarHeight + 120; // Increased top padding even more
    const safeBottom = isMobile ? mobileBottomBarHeight + 24 : 40;
    const safeLeft = 24;
    const safeRight = 24;

    // Mobile: always center bottom, above mobile nav bar with proper spacing
    // For market sidebar on mobile, position it above the bottom tab bar
    if (isMobile) {
      const isMarketSidebar = currentStep === TUTORIAL_STEPS.length - 1;
      if (isMarketSidebar && highlightPosition) {
        return {
          position: 'fixed' as const,
          top: 'auto',
          bottom: `${mobileBottomBarHeight + 20}px`,
          left: '50%',
          right: 'auto',
          transform: 'translateX(-50%)',
          maxWidth: 'calc(100vw - 24px)',
          width: 'calc(100vw - 24px)',
          zIndex: 10000,
          margin: '0 auto',
        };
      }
      return {
        position: 'fixed' as const,
        top: 'auto',
        bottom: `${mobileBottomBarHeight + 24}px`,
        left: '50%',
        right: 'auto',
        transform: 'translateX(-50%)',
        maxWidth: 'calc(100vw - 24px)',
        width: 'calc(100vw - 24px)',
        zIndex: 10000,
        margin: '0 auto',
      };
    }

    // Desktop positioning with strict collision detection
    const centerX = highlightPosition.left + highlightPosition.width / 2;
    const centerY = highlightPosition.top + highlightPosition.height / 2;
    const elementTop = highlightPosition.top;
    const elementBottom = highlightPosition.top + highlightPosition.height;
    const elementLeft = highlightPosition.left;
    const elementRight = highlightPosition.left + highlightPosition.width;
    const elementHeight = highlightPosition.height;

    // Calculate available space in each direction
    const spaceAbove = elementTop - safeTop;
    const spaceBelow = viewportHeight - safeBottom - elementBottom;
    const spaceLeft = elementLeft - safeLeft;
    const spaceRight = viewportWidth - safeRight - elementRight;

    // Try positions in order of preference, prioritizing non-overlapping positions
    const positionsToTry: Array<{ top: number; left: number; transform?: string; priority: number }> = [];

    // For "bottom" position, try: above element, right side, left side, top of screen
    if (step.position === 'bottom') {
      if (spaceAbove >= tooltipHeight + minSpacing) {
        positionsToTry.push({ 
          top: elementTop - tooltipHeight - minSpacing, 
          left: centerX - tooltipWidth / 2,
          priority: 1
        });
      }
      if (spaceRight >= tooltipWidth + minSpacing) {
        positionsToTry.push({ 
          top: centerY - tooltipHeight / 2, 
          left: elementRight + minSpacing,
          transform: 'translateY(-50%)',
          priority: 2
        });
      }
      if (spaceLeft >= tooltipWidth + minSpacing) {
        positionsToTry.push({ 
          top: centerY - tooltipHeight / 2, 
          left: elementLeft - tooltipWidth - minSpacing,
          transform: 'translateY(-50%)',
          priority: 3
        });
      }
      // Position at top of viewport if element is in lower half
      if (elementTop > viewportHeight / 2) {
        positionsToTry.push({ 
          top: safeTop, 
          left: Math.max(safeLeft, Math.min(centerX - tooltipWidth / 2, viewportWidth - tooltipWidth - safeRight)),
          priority: 4
        });
      }
    }
    // For "top" position, try: below element, right side, left side, bottom of screen
    else if (step.position === 'top') {
      if (spaceBelow >= tooltipHeight + minSpacing) {
        positionsToTry.push({ 
          top: elementBottom + minSpacing, 
          left: centerX - tooltipWidth / 2,
          priority: 1
        });
      }
      if (spaceRight >= tooltipWidth + minSpacing) {
        positionsToTry.push({ 
          top: centerY - tooltipHeight / 2, 
          left: elementRight + minSpacing,
          transform: 'translateY(-50%)',
          priority: 2
        });
      }
      if (spaceLeft >= tooltipWidth + minSpacing) {
        positionsToTry.push({ 
          top: centerY - tooltipHeight / 2, 
          left: elementLeft - tooltipWidth - minSpacing,
          transform: 'translateY(-50%)',
          priority: 3
        });
      }
      // Position at bottom of viewport if element is in upper half
      if (elementBottom < viewportHeight / 2) {
        positionsToTry.push({ 
          top: viewportHeight - tooltipHeight - safeBottom, 
          left: Math.max(safeLeft, Math.min(centerX - tooltipWidth / 2, viewportWidth - tooltipWidth - safeRight)),
          priority: 4
        });
      }
    }
    // For "left" position (Market Watch step)
    else if (step.position === 'left') {
      // For market watch, position to the left of element with extra left offset
      const leftOffset = -120; // Move further left for market watch
      if (spaceLeft >= tooltipWidth + minSpacing) {
        positionsToTry.push({ 
          top: centerY - tooltipHeight / 2, 
          left: elementLeft - tooltipWidth - minSpacing + leftOffset,
          transform: 'translateY(-50%)',
          priority: 1
        });
      }
      if (spaceRight >= tooltipWidth + minSpacing) {
        positionsToTry.push({ 
          top: centerY - tooltipHeight / 2, 
          left: elementRight + minSpacing,
          transform: 'translateY(-50%)',
          priority: 2
        });
      }
      if (spaceBelow >= tooltipHeight + minSpacing) {
        positionsToTry.push({ 
          top: elementBottom + minSpacing, 
          left: centerX - tooltipWidth / 2 + leftOffset,
          priority: 3
        });
      }
      if (spaceAbove >= tooltipHeight + minSpacing) {
        positionsToTry.push({ 
          top: elementTop - tooltipHeight - minSpacing, 
          left: centerX - tooltipWidth / 2 + leftOffset,
          priority: 4
        });
      }
    }
    // For "right" position
    else if (step.position === 'right') {
      if (spaceLeft >= tooltipWidth + minSpacing) {
        positionsToTry.push({ 
          top: centerY - tooltipHeight / 2, 
          left: elementLeft - tooltipWidth - minSpacing,
          transform: 'translateY(-50%)',
          priority: 1
        });
      }
      if (spaceBelow >= tooltipHeight + minSpacing) {
        positionsToTry.push({ 
          top: elementBottom + minSpacing, 
          left: centerX - tooltipWidth / 2,
          priority: 2
        });
      }
      if (spaceAbove >= tooltipHeight + minSpacing) {
        positionsToTry.push({ 
          top: elementTop - tooltipHeight - minSpacing, 
          left: centerX - tooltipWidth / 2,
          priority: 3
        });
      }
    }

    // Sort by priority
    positionsToTry.sort((a, b) => a.priority - b.priority);

    // Find the first position that doesn't overlap and fits in viewport
    for (const pos of positionsToTry) {
      let finalTop = Math.max(safeTop, Math.min(pos.top, viewportHeight - tooltipHeight - safeBottom));
      const finalLeft = step.position === 'left' 
        ? Math.max(safeLeft - 40, Math.min(pos.left, viewportWidth - tooltipWidth - safeRight))
        : Math.max(safeLeft, Math.min(pos.left, viewportWidth - tooltipWidth - safeRight));
      
      // Adjust if using transform
      if (pos.transform?.includes('translateY')) {
        finalTop = Math.max(safeTop, Math.min(pos.top, viewportHeight - tooltipHeight - safeBottom));
      }
      
      // Check if this position overlaps with the element (strict check)
      if (!checkOverlap(finalTop, finalLeft, tooltipWidth, tooltipHeight)) {
        return {
          position: 'fixed' as const,
          top: `${finalTop}px`,
          left: isMobile ? '50%' : `${finalLeft}px`,
          transform: isMobile ? 'translateX(-50%)' : (pos.transform || 'none'),
          maxWidth: isMobile ? 'calc(100vw - 24px)' : `${tooltipWidth}px`,
          width: isMobile ? 'calc(100vw - 24px)' : 'auto',
          zIndex: 10000,
        };
      }
    }

    // Last resort: position at top or bottom of screen, away from element
    const elementCenterY = elementTop + elementHeight / 2;
    if (elementCenterY < viewportHeight / 2) {
      // Element is in upper half, position tooltip at bottom
      return {
        position: 'fixed' as const,
        top: `${viewportHeight - tooltipHeight - safeBottom}px`,
        left: isMobile ? '50%' : `${Math.max(safeLeft, Math.min(centerX - tooltipWidth / 2, viewportWidth - tooltipWidth - safeRight))}px`,
        transform: isMobile ? 'translateX(-50%)' : 'none',
        maxWidth: isMobile ? 'calc(100vw - 24px)' : `${tooltipWidth}px`,
        width: isMobile ? 'calc(100vw - 24px)' : 'auto',
        zIndex: 10000,
      };
    } else {
      // Element is in lower half, position tooltip at top
      return {
        position: 'fixed' as const,
        top: `${safeTop}px`,
        left: isMobile ? '50%' : `${Math.max(safeLeft, Math.min(centerX - tooltipWidth / 2, viewportWidth - tooltipWidth - safeRight))}px`,
        transform: isMobile ? 'translateX(-50%)' : 'none',
        maxWidth: isMobile ? 'calc(100vw - 24px)' : `${tooltipWidth}px`,
        width: isMobile ? 'calc(100vw - 24px)' : 'auto',
        zIndex: 10000,
      };
    }
  };

  // Calculate spotlight gradient
  const getSpotlightGradient = () => {
    // For first step (welcome), use full dark overlay
    if (!highlightPosition || currentStep === 0) {
      return 'rgba(0, 0, 0, 0.85)';
    }

    const centerX = highlightPosition.left + highlightPosition.width / 2;
    const centerY = highlightPosition.top + highlightPosition.height / 2;
    const radius = Math.max(highlightPosition.width, highlightPosition.height) + 60;
    
    return `radial-gradient(ellipse ${radius}px ${radius}px at ${centerX}px ${centerY}px, transparent 35%, rgba(0, 0, 0, 0.4) 50%, rgba(0, 0, 0, 0.85) 75%)`;
  };

  return (
    <>
      {/* Overlay with smooth spotlight effect */}
      <div
        className="fixed inset-0 z-[9998] pointer-events-none transition-opacity duration-300"
        style={{
          background: getSpotlightGradient(),
          opacity: isTransitioning || isInitialMount ? 0 : 1,
        }}
      />

      {/* Tooltip with smooth transitions - Always show if tutorial is open */}
      {isOpen && (
        <div
          className="fixed pointer-events-auto transition-all duration-300 isolate"
          style={{
            ...getTooltipPosition(),
            opacity: isTransitioning || isInitialMount ? 0 : 1,
            transform: isTransitioning || isInitialMount
              ? `${getTooltipPosition().transform || 'translate(-50%, -50%)'} scale(0.95)`
              : `${getTooltipPosition().transform || 'translate(-50%, -50%)'} scale(1)`,
            zIndex: 10000,
            isolation: 'isolate',
          }}
        >
          <div className="bg-card border-2 border-primary rounded-xl shadow-2xl p-4 md:p-5 backdrop-blur-sm relative">
            <div className="flex items-start gap-2 mb-3">
              <div className="flex-shrink-0 mt-0.5">
                {currentStepData.icon}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base md:text-lg font-bold text-foreground mb-1">
                  {currentStepData.title}
                </h3>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    Step {currentStep + 1} of {TUTORIAL_STEPS.length}
                  </span>
                  <Progress value={progress} className="flex-1 h-1.5 min-w-0" />
                </div>
              </div>
            </div>

            <p className="text-xs md:text-sm text-muted-foreground mb-4 leading-relaxed">
              {getStepDescription()}
            </p>

            {requiresInteraction ? (
              <div className="flex items-center gap-2 text-primary text-sm font-medium bg-primary/10 rounded-lg p-3">
                <MousePointerClick className="w-4 h-4 animate-pulse flex-shrink-0" />
                <span>Click the highlighted element to continue</span>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <Button
                  variant="outline"
                  onClick={handleSkip}
                  className="flex-1"
                >
                  Skip
                </Button>
                <Button
                  onClick={handleNext}
                  className="flex-1"
                >
                  {isLastStep ? 'Get Started' : 'Next'}
                </Button>
              </div>
            )}

            {/* Step indicators */}
            <div className="flex items-center justify-center gap-2 mt-5 pt-4 border-t border-border">
              {TUTORIAL_STEPS.map((_, index) => (
                <div
                  key={index}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    index === currentStep
                      ? 'w-8 bg-primary'
                      : index < currentStep
                      ? 'w-1.5 bg-primary/50'
                      : 'w-1.5 bg-muted'
                  }`}
                  aria-label={`Step ${index + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Highlight border with smooth animation - Don't show for first step */}
      {highlightPosition && targetElement && !isTransitioning && !isInitialMount && currentStep > 0 && (
        <div
          className="fixed z-[9997] pointer-events-none border-4 border-primary rounded-lg transition-all duration-300"
          style={{
            // For the highlight border to align with the element's outer edge, we need to adjust for our 4px border
            // BUT the element's rect.top already includes any margins/borders
            // So we just subtract our border width to align perfectly
            // HOWEVER, if the highlight appears too low, we need more offset
            top: `${highlightPosition.top - (targetElement.getAttribute('data-tutorial') === 'market-sidebar' && typeof window !== 'undefined' && window.innerWidth >= 768 ? 100 : 4)}px`,
            left: `${highlightPosition.left - 4}px`,
            width: `${Math.max(
              highlightPosition.width + 8, 
              targetElement.offsetWidth + 8,
              targetElement.clientWidth + 8,
              targetElement.scrollWidth + 8
            )}px`,
            height: `${Math.max(
              highlightPosition.height + 8, 
              targetElement.offsetHeight + 8,
              targetElement.clientHeight + 8,
              targetElement.scrollHeight + 8
            )}px`,
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.25), 0 0 0 4px hsl(var(--primary)), 0 0 24px hsl(var(--primary) / 0.4)',
            animation: 'tutorial-border-pulse 2s ease-in-out infinite',
          }}
        />
      )}

      <style jsx global>{`
        .tutorial-highlight-pulse {
          animation: tutorial-pulse 2s ease-in-out infinite;
          position: relative;
          z-index: 101 !important;
        }

        @keyframes tutorial-pulse {
          0%, 100% {
            box-shadow: 0 0 0 0 hsl(var(--primary) / 0.6);
          }
          50% {
            box-shadow: 0 0 0 10px hsl(var(--primary) / 0);
          }
        }

        @keyframes tutorial-border-pulse {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.8;
            transform: scale(1.01);
          }
        }
      `}</style>
    </>
  );
}
