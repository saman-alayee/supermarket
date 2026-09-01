/**
 * Horizontal scroll: touch/mouse drag (lazy threshold), wheel on desktop, programmatic scroll.
 */
export function useHorizontalDragScroll(containerRef: Ref<HTMLElement | null>) {
  const isDragging = ref(false);

  let startX = 0;
  let startScrollLeft = 0;
  let activePointerId: number | null = null;
  let pendingPointer = false;
  let didDrag = false;

  const DRAG_THRESHOLD_MOUSE = 10;
  const DRAG_THRESHOLD_TOUCH = 6;

  function dragThreshold(pointerType: string) {
    return pointerType === 'mouse' ? DRAG_THRESHOLD_MOUSE : DRAG_THRESHOLD_TOUCH;
  }

  function shouldIgnoreDragStart(target: EventTarget | null) {
    if (!(target instanceof Element)) return false;
    return Boolean(target.closest('button, input, textarea, select, label, [role="button"]'));
  }

  function onPointerDown(event: PointerEvent) {
    const el = containerRef.value;
    if (!el || event.button !== 0 || shouldIgnoreDragStart(event.target)) return;

    pendingPointer = true;
    isDragging.value = false;
    didDrag = false;
    activePointerId = event.pointerId;
    startX = event.clientX;
    startScrollLeft = el.scrollLeft;
  }

  function onPointerMove(event: PointerEvent) {
    const el = containerRef.value;
    if (!el || activePointerId !== event.pointerId || !pendingPointer) return;

    const delta = event.clientX - startX;

    if (!isDragging.value) {
      if (Math.abs(delta) <= dragThreshold(event.pointerType)) return;
      isDragging.value = true;
      didDrag = true;
      el.setPointerCapture(event.pointerId);
      el.classList.add('is-dragging');
    }

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
    if (el && activePointerId != null && isDragging.value) {
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

    pendingPointer = false;
    isDragging.value = false;
    activePointerId = null;
  }

  function onWheel(event: WheelEvent) {
    const el = containerRef.value;
    if (!el || !import.meta.client) return;
    if (!window.matchMedia('(min-width: 768px)').matches) return;

    const delta =
      Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (Math.abs(delta) < 2) return;

    const before = el.scrollLeft;
    el.scrollLeft += delta;
    if (el.scrollLeft !== before) {
      event.preventDefault();
    }
  }

  function scrollByPage(direction: -1 | 1) {
    const el = containerRef.value;
    if (!el) return;
    el.scrollBy({ left: direction * Math.round(el.clientWidth * 0.75), behavior: 'smooth' });
  }

  function bind() {
    const el = containerRef.value;
    if (!el) return;
    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', onPointerUp);
    el.addEventListener('pointercancel', onPointerCancel);
    el.addEventListener('wheel', onWheel, { passive: false });
  }

  function unbind() {
    const el = containerRef.value;
    if (!el) return;
    el.removeEventListener('pointerdown', onPointerDown);
    el.removeEventListener('pointermove', onPointerMove);
    el.removeEventListener('pointerup', onPointerUp);
    el.removeEventListener('pointercancel', onPointerCancel);
    el.removeEventListener('wheel', onWheel);
  }

  onMounted(() => nextTick(bind));
  onUnmounted(unbind);

  return { isDragging, scrollByPage };
}
