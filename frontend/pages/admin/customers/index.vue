<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' });
await navigateTo('/admin/users', { replace: true });
</script>
