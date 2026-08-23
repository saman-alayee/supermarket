/**
 * Enables click-and-drag (mouse) and swipe (touch) horizontal scrolling.
 */
export function useHorizontalDragScroll(containerRef: Ref<HTMLElement | null>) {
  const isDragging = ref(false);

  let startX = 0;
  let startScrollLeft = 0;
  let activePointerId: number | null = null;
  let didDrag = false;

  function shouldIgnoreDragStart(target: EventTarget | null) {
    if (!(target instanceof Element)) return false;
    return Boolean(target.closest('button, input, textarea, select, label'));
  }

  function onPointerDown(event: PointerEvent) {
    const el = containerRef.value;
    if (!el || event.button !== 0 || shouldIgnoreDragStart(event.target)) return;

    isDragging.value = true;
    didDrag = false;
    activePointerId = event.pointerId;
    startX = event.clientX;
    startScrollLeft = el.scrollLeft;

    el.setPointerCapture(event.pointerId);
    el.classList.add('is-dragging');
  }

  function onPointerMove(event: PointerEvent) {
    const el = containerRef.value;
    if (!el || !isDragging.value || activePointerId !== event.pointerId) return;

    const delta = event.clientX - startX;
    if (Math.abs(delta) > 4) didDrag = true;
    // Natural grab-scroll: content follows the pointer in both LTR and RTL containers.
    el.scrollLeft = startScrollLeft - delta;
  }

  function onPointerUp(event: PointerEvent) {
    if (activePointerId !== event.pointerId) return;
    finishDrag();
  }

  function onPointerCancel(event: PointerEvent) {
    if (activePointerId !== event.pointerId) return;
    finishDrag();
  }

  function finishDrag() {
    const el = containerRef.value;
    if (el && activePointerId != null) {
      try {
        el.releasePointerCapture(activePointerId);
      } catch {
        // ignore
      }
      el.classList.remove('is-dragging');
    }

    if (didDrag && el) {
      const blockClick = (event: MouseEvent) => {
        event.preventDefault();
        event.stopImmediatePropagation();
      };
      el.addEventListener('click', blockClick, { capture: true, once: true });
    }

    isDragging.value = false;
    activePointerId = null;
  }

  function bind() {
    const el = containerRef.value;
    if (!el) return;
    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', onPointerUp);
    el.addEventListener('pointercancel', onPointerCancel);
  }

  function unbind() {
    const el = containerRef.value;
    if (!el) return;
    el.removeEventListener('pointerdown', onPointerDown);
    el.removeEventListener('pointermove', onPointerMove);
    el.removeEventListener('pointerup', onPointerUp);
    el.removeEventListener('pointercancel', onPointerCancel);
  }

  onMounted(() => nextTick(bind));
  onUnmounted(unbind);

  return { isDragging };
}
