<script setup lang="ts">
import type { AddressFieldErrors } from '~/composables/useAddressFields';

defineProps<{
  errors?: AddressFieldErrors;
  streetLabel?: string;
  showHints?: boolean;
}>();

const street = defineModel<string>('street', { default: '' });
const plaque = defineModel<string>('plaque', { default: '' });
const unit = defineModel<string>('unit', { default: '' });
</script>

<template>
  <div class="space-y-4">
    <div>
      <label class="block text-sm font-medium text-gray-700 mb-1">{{ streetLabel || 'خیابان و محله *' }}</label>
      <textarea
        v-model="street"
        required
        rows="3"
        class="input-field resize-none"
        :class="{ 'border-red-400 ring-1 ring-red-200': errors?.street }"
        placeholder="شهر، محله، خیابان..."
      />
      <AppFormError :message="errors?.street" />
      <p v-if="showHints !== false" class="text-xs text-gray-400 mt-1">نام شهر، محله و خیابان را بنویسید</p>
    </div>

    <div class="grid grid-cols-2 gap-3">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">پلاک *</label>
        <input
          v-model="plaque"
          type="text"
          required
          inputmode="numeric"
          class="input-field min-h-[48px]"
          :class="{ 'border-red-400 ring-1 ring-red-200': errors?.plaque }"
          placeholder="مثلاً ۱۲"
          dir="ltr"
        />
        <AppFormError :message="errors?.plaque" />
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">واحد *</label>
        <input
          v-model="unit"
          type="text"
          required
          class="input-field min-h-[48px]"
          :class="{ 'border-red-400 ring-1 ring-red-200': errors?.unit }"
          placeholder="مثلاً ۳"
          dir="ltr"
        />
        <AppFormError :message="errors?.unit" />
      </div>
    </div>
  </div>
</template>
