<script setup lang="ts">
import {
  JALALI_MONTHS,
  JALALI_WEEKDAYS,
  compareGregorianIso,
  formatJalaliInputValue,
  getJalaliMonthLength,
  getJalaliWeekdayIndex,
  getTodayGregorianIso,
  getTodayJalali,
  gregorianIsoToJalali,
  jalaliToGregorianIso,
} from '~/utils/jalali';

const props = withDefaults(
  defineProps<{
    modelValue: string | null;
    placeholder?: string;
    disabled?: boolean;
    clearable?: boolean;
    min?: string | null;
    max?: string | null;
  }>(),
  {
    placeholder: 'انتخاب تاریخ',
    disabled: false,
    clearable: true,
    min: null,
    max: null,
  }
);

const emit = defineEmits<{
  'update:modelValue': [value: string | null];
}>();

const open = ref(false);
const triggerRef = ref<HTMLElement | null>(null);
const menuStyle = ref({ top: '0px', left: '0px', width: '0px' });

const todayJalali = getTodayJalali();
const viewYear = ref(todayJalali.year);
const viewMonth = ref(todayJalali.month);

const displayValue = computed(() =>
  props.modelValue ? formatJalaliInputValue(props.modelValue) : ''
);

const monthLabel = computed(
  () => `${JALALI_MONTHS[viewMonth.value - 1]} ${toPersianDigits(viewYear.value)}`
);

const calendarDays = computed(() => {
  const monthLength = getJalaliMonthLength(viewYear.value, viewMonth.value);
  const firstWeekday = getJalaliWeekdayIndex(viewYear.value, viewMonth.value, 1);
  const cells: Array<{ day: number | null; iso: string | null; disabled: boolean; isToday: boolean; isSelected: boolean }> = [];

  for (let i = 0; i < firstWeekday; i += 1) {
    cells.push({ day: null, iso: null, disabled: true, isToday: false, isSelected: false });
  }

  for (let day = 1; day <= monthLength; day += 1) {
    const iso = jalaliToGregorianIso(viewYear.value, viewMonth.value, day);
    cells.push({
      day,
      iso,
      disabled: isOutOfRange(iso),
      isToday: iso === getTodayGregorianIso(),
      isSelected: props.modelValue?.slice(0, 10) === iso,
    });
  }

  return cells;
});

function toPersianDigits(value: number | string): string {
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return String(value).replace(/\d/g, (d) => persianDigits[parseInt(d, 10)]);
}

function isOutOfRange(iso: string): boolean {
  if (props.min && compareGregorianIso(iso, props.min.slice(0, 10)) < 0) return true;
  if (props.max && compareGregorianIso(iso, props.max.slice(0, 10)) > 0) return true;
  return false;
}

function syncViewWithValue() {
  if (!props.modelValue) {
    const today = getTodayJalali();
    viewYear.value = today.year;
    viewMonth.value = today.month;
    return;
  }

  const jalali = gregorianIsoToJalali(props.modelValue.slice(0, 10));
  viewYear.value = jalali.year;
  viewMonth.value = jalali.month;
}

function updateMenuPosition() {
  if (!triggerRef.value) return;
  const rect = triggerRef.value.getBoundingClientRect();
  menuStyle.value = {
    top: `${rect.bottom + 6}px`,
    left: `${rect.left}px`,
    width: `${Math.max(rect.width, 300)}px`,
  };
}

function toggle() {
  if (props.disabled) return;
  open.value = !open.value;
  if (open.value) {
    syncViewWithValue();
    nextTick(updateMenuPosition);
  }
}

function selectDate(iso: string | null) {
  if (!iso || isOutOfRange(iso)) return;
  emit('update:modelValue', iso);
  open.value = false;
}

function clearDate() {
  emit('update:modelValue', null);
  open.value = false;
}

function selectToday() {
  selectDate(getTodayGregorianIso());
}

function prevMonth() {
  if (viewMonth.value === 1) {
    viewMonth.value = 12;
    viewYear.value -= 1;
  } else {
    viewMonth.value -= 1;
  }
}

function nextMonth() {
  if (viewMonth.value === 12) {
    viewMonth.value = 1;
    viewYear.value += 1;
  } else {
    viewMonth.value += 1;
  }
}

function onDocumentClick(event: MouseEvent) {
  if (!open.value) return;
  const target = event.target as Node;
  if (triggerRef.value?.contains(target)) return;
  const menu = document.getElementById(menuId);
  if (menu?.contains(target)) return;
  open.value = false;
}

const menuId = `app-date-picker-${Math.random().toString(36).slice(2, 9)}`;

watch(
  () => props.modelValue,
  () => {
    if (open.value) syncViewWithValue();
  }
);

onMounted(() => {
  document.addEventListener('click', onDocumentClick);
  window.addEventListener('resize', updateMenuPosition);
  window.addEventListener('scroll', updateMenuPosition, true);
});

onUnmounted(() => {
  document.removeEventListener('click', onDocumentClick);
  window.removeEventListener('resize', updateMenuPosition);
  window.removeEventListener('scroll', updateMenuPosition, true);
});
</script>

<template>
    <div ref="triggerRef" class="relative w-full">
    <div
      :class="[
        'input-field flex items-center justify-between gap-2 text-start transition-all',
        open ? 'ring-2 ring-primary-500 border-transparent shadow-sm' : '',
        disabled ? 'opacity-50 cursor-not-allowed bg-gray-50' : '',
        !displayValue ? 'text-gray-400' : 'text-gray-800',
      ]"
    >
      <button
        type="button"
        :disabled="disabled"
        class="flex flex-1 items-center gap-2 min-w-0 truncate text-start disabled:cursor-not-allowed"
        :class="disabled ? '' : 'cursor-pointer'"
        @click.stop="toggle"
      >
        <AppIcon name="lucide:calendar-days" size="sm" class="text-gray-400 shrink-0" />
        {{ displayValue || placeholder }}
      </button>
      <span class="flex items-center gap-1 shrink-0">
        <button
          v-if="clearable && displayValue && !disabled"
          type="button"
          class="p-1 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
          @click.stop="clearDate"
        >
          <AppIcon name="lucide:x" size="sm" />
        </button>
        <button
          type="button"
          :disabled="disabled"
          class="p-1 rounded-md text-gray-400 disabled:cursor-not-allowed"
          :class="disabled ? '' : 'cursor-pointer'"
          @click.stop="toggle"
        >
          <AppIcon
            name="lucide:chevron-down"
            size="sm"
            :class="['transition-transform duration-200', open ? 'rotate-180' : '']"
          />
        </button>
      </span>
    </div>

    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-150 ease-out"
        enter-from-class="opacity-0 scale-95 -translate-y-1"
        enter-to-class="opacity-100 scale-100 translate-y-0"
        leave-active-class="transition duration-100 ease-in"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 scale-95"
      >
        <div
          v-if="open"
          :id="menuId"
          class="fixed z-[9999] rounded-xl border border-gray-100 bg-white shadow-xl p-3"
          :style="menuStyle"
          @click.stop
        >
          <div class="flex items-center justify-between mb-3">
            <button
              type="button"
              class="p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
              @click="nextMonth"
            >
              <AppIcon name="lucide:chevron-right" size="sm" />
            </button>
            <p class="text-sm font-semibold text-gray-800">{{ monthLabel }}</p>
            <button
              type="button"
              class="p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
              @click="prevMonth"
            >
              <AppIcon name="lucide:chevron-left" size="sm" />
            </button>
          </div>

          <div class="grid grid-cols-7 gap-1 mb-1">
            <span
              v-for="weekday in JALALI_WEEKDAYS"
              :key="weekday"
              class="text-center text-[11px] font-medium text-gray-400 py-1"
            >
              {{ weekday }}
            </span>
          </div>

          <div class="grid grid-cols-7 gap-1">
            <span v-for="(cell, index) in calendarDays" :key="index" class="aspect-square">
              <button
                v-if="cell.day"
                type="button"
                :disabled="cell.disabled"
                :class="[
                  'w-full h-full rounded-lg text-sm transition-colors',
                  cell.isSelected
                    ? 'bg-primary-600 text-white font-semibold shadow-sm'
                    : cell.isToday
                      ? 'bg-primary-50 text-primary-700 font-medium'
                      : 'text-gray-700 hover:bg-gray-100',
                  cell.disabled ? 'opacity-30 cursor-not-allowed hover:bg-transparent' : '',
                ]"
                @click="selectDate(cell.iso)"
              >
                {{ toPersianDigits(cell.day) }}
              </button>
            </span>
          </div>

          <div class="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-gray-100">
            <button
              type="button"
              class="text-xs font-medium text-primary-600 hover:text-primary-700 px-2 py-1 rounded-lg hover:bg-primary-50"
              @click="selectToday"
            >
              امروز
            </button>
            <button
              v-if="clearable"
              type="button"
              class="text-xs font-medium text-gray-500 hover:text-gray-700 px-2 py-1 rounded-lg hover:bg-gray-50"
              @click="clearDate"
            >
              پاک کردن
            </button>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
