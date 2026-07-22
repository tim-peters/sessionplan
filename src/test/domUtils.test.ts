import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  scrollToLastBlock,
  focusLastBlockTitleInput,
  focusBlockTitleInput,
  focusSessionInput,
  focusSessionElement,
} from '@/lib/domUtils';

const setTouchDevice = (touch: boolean) => {
  // jsdom always has `ontouchstart` in window, so we have to remove the property
  // entirely (not just set it to undefined) to make the in-check return false.
  if (touch) {
    Object.defineProperty(window, 'ontouchstart', {
      configurable: true,
      value: () => {},
    });
  } else {
    // @ts-expect-error — delete the property so the `in` check returns false
    delete window.ontouchstart;
  }
  Object.defineProperty(navigator, 'maxTouchPoints', {
    configurable: true,
    value: touch ? 5 : 0,
  });
  Object.defineProperty(navigator, 'msMaxTouchPoints', {
    configurable: true,
    value: touch ? 5 : 0,
  });
};

describe('domUtils — touch device guard', () => {
  beforeEach(() => {
    setTouchDevice(false);
  });
  afterEach(() => {
    setTouchDevice(false);
  });

  describe('scrollToLastBlock', () => {
    it('does nothing on a desktop device (no scrollIntoView is called)', () => {
      // jsdom doesn't implement scrollIntoView, so we install a spy on the prototype.
      const scrollSpy = vi.fn();
      // @ts-expect-error — install spy on prototype for the duration of this test
      HTMLElement.prototype.scrollIntoView = scrollSpy;

      const div = document.createElement('div');
      div.setAttribute('data-block-title-input', '');
      document.body.append(div);

      scrollToLastBlock(0);
      // Wait for the internal setTimeout(..., 150) to flush.
      return new Promise<void>((r) => setTimeout(r, 200)).then(() => {
        expect(scrollSpy).not.toHaveBeenCalled();
      });
    });

    it('scrolls the last input into view on a touch device', async () => {
      setTouchDevice(true);
      const spy = vi.fn();
      const inputs = document.createElement('div');
      inputs.setAttribute('data-block-title-input', '');
      // Override scrollIntoView on this element so the spy receives the call.
      (inputs as unknown as { scrollIntoView: typeof spy }).scrollIntoView = spy;
      document.body.appendChild(inputs);

      scrollToLastBlock(0);
      await new Promise((r) => setTimeout(r, 200));
      expect(spy).toHaveBeenCalled();
    });
  });

  describe('focusLastBlockTitleInput', () => {
    it('focuses the last [data-block-title-input] on a desktop device', async () => {
      const input1 = document.createElement('input');
      input1.setAttribute('data-block-title-input', '');
      const input2 = document.createElement('input');
      input2.setAttribute('data-block-title-input', '');
      document.body.append(input1, input2);

      const focusSpy = vi.spyOn(input2, 'focus');
      const selectSpy = vi.spyOn(input2, 'select');
      focusLastBlockTitleInput(0);
      await new Promise((r) => setTimeout(r, 150));
      expect(focusSpy).toHaveBeenCalled();
      expect(selectSpy).toHaveBeenCalled();
    });

    it('is a no-op on a touch device', async () => {
      setTouchDevice(true);
      const input = document.createElement('input');
      input.setAttribute('data-block-title-input', '');
      document.body.append(input);
      const focusSpy = vi.spyOn(input, 'focus');
      focusLastBlockTitleInput(0);
      await new Promise((r) => setTimeout(r, 150));
      expect(focusSpy).not.toHaveBeenCalled();
    });
  });

  describe('focusBlockTitleInput', () => {
    it('focuses the input with the matching data-block-id', async () => {
      const input = document.createElement('input');
      input.setAttribute('data-block-title-input', '');
      input.setAttribute('data-block-id', 'item-7');
      document.body.append(input);
      const focusSpy = vi.spyOn(input, 'focus');
      focusBlockTitleInput('item-7', 0);
      await new Promise((r) => setTimeout(r, 150));
      expect(focusSpy).toHaveBeenCalled();
    });

    it('is a no-op when no matching input exists', async () => {
      focusBlockTitleInput('missing', 0);
      await new Promise((r) => setTimeout(r, 150));
      // No exception = success
    });
  });

  describe('focusSessionInput', () => {
    it('focuses the first element matching the given data-attribute', async () => {
      const el = document.createElement('input');
      el.setAttribute('data-session-title-input', '');
      document.body.append(el);
      const focusSpy = vi.spyOn(el, 'focus');
      focusSessionInput('data-session-title-input', 0);
      await new Promise((r) => setTimeout(r, 50));
      expect(focusSpy).toHaveBeenCalled();
    });
  });

  describe('focusSessionElement', () => {
    it('focuses an input element directly', () => {
      const input = document.createElement('input');
      input.setAttribute('data-test', '');
      document.body.append(input);
      const focusSpy = vi.spyOn(input, 'focus');
      focusSessionElement('data-test');
      expect(focusSpy).toHaveBeenCalled();
    });

    it('focuses a textarea element directly', () => {
      const ta = document.createElement('textarea');
      ta.setAttribute('data-desc', '');
      document.body.append(ta);
      const focusSpy = vi.spyOn(ta, 'focus');
      focusSessionElement('data-desc');
      expect(focusSpy).toHaveBeenCalled();
    });

    it('clicks a non-input element when the attribute is present', () => {
      const btn = document.createElement('button');
      btn.setAttribute('data-open-desc', '');
      document.body.append(btn);
      const clickSpy = vi.spyOn(btn, 'click');
      focusSessionElement('data-open-desc');
      expect(clickSpy).toHaveBeenCalled();
    });

    it('is a no-op when the attribute matches nothing', () => {
      focusSessionElement('data-not-there');
    });
  });
});
