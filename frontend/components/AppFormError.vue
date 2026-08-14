<script setup lang="ts">
defineProps<{
  message?: string;
}>();
</script>

<template>
  <p v-if="message" class="text-xs text-red-600 mt-1.5 leading-relaxed" role="alert">
    {{ message }}
  </p>
</template>
