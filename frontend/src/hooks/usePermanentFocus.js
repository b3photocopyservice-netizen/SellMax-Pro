import { useEffect, useCallback } from 'react';

/**
 * usePermanentFocus
 *
 * Keeps a given input element permanently focused on a POS terminal.
 * Handles two cases:
 *   1. onBlur  → immediately refocuses unless a modal/overlay is open.
 *   2. Global click → if the user clicks on a non-interactive surface
 *      (background, product card area, labels, etc.) the focus is
 *      silently recaptured.  Clicks on real interactive elements
 *      (buttons, inputs, selects, textareas, anchors, or anything with
 *      [data-interactive] / [data-no-refocus]) are left alone so they
 *      keep working normally.
 *
 * @param {React.RefObject} inputRef  - ref attached to the <input> to guard
 * @param {boolean}         active    - pass false to suspend the hook
 *                                      (e.g. while a modal is open)
 */
export default function usePermanentFocus(inputRef, active = true) {

  /**
   * Tags that should NEVER trigger a focus-steal.
   * The hook inspects the clicked element AND walks up its ancestor
   * chain so that clicking a <span> inside a <button> still works.
   */
  const INTERACTIVE_TAGS = new Set([
    'INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A', 'LABEL',
    'SUMMARY', 'DETAILS', 'OPTION',
  ]);

  /**
   * Decide whether a DOM element (or any of its ancestors up to <body>)
   * is something the user genuinely wants to interact with.
   */
  const isInteractive = useCallback((target) => {
    let el = target;
    while (el && el !== document.body) {
      // Explicit opt-out attribute — any element can declare itself interactive
      if (el.dataset?.noRefocus !== undefined) return true;
      // Explicit opt-in override — force refocus even on normally-interactive
      if (el.dataset?.forceRefocus !== undefined) return false;

      if (INTERACTIVE_TAGS.has(el.tagName)) return true;

      // Treat elements with a tabIndex >= 0 as interactive
      if (el.tabIndex >= 0 && el.tagName !== 'DIV' && el.tagName !== 'SPAN') return true;

      // role="button" / role="menuitem" / role="option" etc.
      const role = el.getAttribute?.('role');
      if (role && ['button', 'menuitem', 'option', 'tab', 'checkbox', 'radio', 'link', 'combobox', 'listbox', 'slider', 'spinbutton', 'switch', 'textbox'].includes(role)) {
        return true;
      }

      // Any element that is itself the input we are guarding — don't steal
      if (el === inputRef.current) return true;

      el = el.parentElement;
    }
    return false;
  }, [inputRef]);

  /**
   * Refocus helper — uses requestAnimationFrame so it runs after the
   * browser's own focus routing is finished (important for click events).
   */
  const refocus = useCallback(() => {
    if (inputRef.current && document.activeElement !== inputRef.current) {
      requestAnimationFrame(() => {
        inputRef.current?.focus({ preventScroll: true });
      });
    }
  }, [inputRef]);

  // ── 1. Refocus on blur ───────────────────────────────────────────────────
  useEffect(() => {
    if (!active) return;

    const el = inputRef.current;
    if (!el) return;

    const handleBlur = () => {
      // Small delay so that focus can legitimately move to interactive elements
      // before we check whether we should steal it back.
      setTimeout(() => {
        if (!active) return;
        const focused = document.activeElement;
        // If focus moved to another input / button / select — leave it alone.
        if (focused && INTERACTIVE_TAGS.has(focused.tagName)) return;
        if (focused?.getAttribute('role') === 'dialog') return;
        refocus();
      }, 100);
    };

    el.addEventListener('blur', handleBlur);
    return () => el.removeEventListener('blur', handleBlur);
  }, [active, inputRef, refocus]);

  // ── 2. Recapture on background clicks ───────────────────────────────────
  useEffect(() => {
    if (!active) return;

    const handleDocumentClick = (e) => {
      // If the click was on/in an interactive element, do nothing.
      if (isInteractive(e.target)) return;

      // Use rAF so the click completes before we steal focus back.
      requestAnimationFrame(() => {
        refocus();
      });
    };

    // Use capture phase so we run before any component-level handlers
    document.addEventListener('mousedown', handleDocumentClick, true);
    return () => document.removeEventListener('mousedown', handleDocumentClick, true);
  }, [active, isInteractive, refocus]);

  // ── 3. Initial focus on mount ────────────────────────────────────────────
  useEffect(() => {
    if (active) {
      refocus();
    }
  }, [active]);
}
