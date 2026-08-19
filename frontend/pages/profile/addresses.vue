<script setup lang="ts">
import type { Address } from '~/types';

definePageMeta({ layout: 'profile' });

const api = useApi();
const toast = useToast();
const { mapsLink } = useGeocoding();
const addressFields = useAddressFields();
const { street, plaque, unit, errors, reset, loadFromAddress, validate, payload } = addressFields;

const addresses = ref<Address[]>([]);
const loading = ref(true);
const showForm = ref(false);
const editingId = ref<string | null>(null);
const saving = ref(false);
const formError = ref('');
const mapRef = ref<{ invalidateSize: () => void } | null>(null);
const errorBannerRef = ref<HTMLElement | null>(null);

const form = reactive({
  title: '',
  latitude: null as number | null,
  longitude: null as number | null,
  isDefault: false,
});

onMounted(loadAddresses);

watch(showForm, (open) => {
  if (open) {
    nextTick(() => {
      setTimeout(() => mapRef.value?.invalidateSize(), 250);
      setTimeout(() => mapRef.value?.invalidateSize(), 800);
    });
  }
});

async function loadAddresses() {
  loading.value = true;
  try {
    const { data } = await api.get<Address[]>('/addresses');
    addresses.value = data;
  } finally {
    loading.value = false;
  }
}

function openForm(address?: Address) {
  if (address) {
    editingId.value = address.id;
    form.title = address.title || '';
    form.latitude = address.latitude;
    form.longitude = address.longitude;
    form.isDefault = address.isDefault;
    loadFromAddress(address);
  } else {
    editingId.value = null;
    form.title = '';
    form.latitude = null;
    form.longitude = null;
    form.isDefault = addresses.value.length === 0;
    reset();
  }
  formError.value = '';
  showForm.value = true;
}

function scrollToErrors() {
  nextTick(() => {
    errorBannerRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

async function save() {
  formError.value = '';
  if (!validate({ requireMap: true, hasMap: form.latitude != null && form.longitude != null })) {
    formError.value = 'لطفاً فیلدهای مشخص‌شده را تکمیل کنید.';
    toast.error('لطفاً خطاهای فرم را برطرف کنید');
    scrollToErrors();
    return;
  }

  saving.value = true;
  try {
    const body = payload({
      title: form.title || undefined,
      latitude: form.latitude,
      longitude: form.longitude,
      isDefault: form.isDefault,
    });

    if (editingId.value) {
      await api.put(`/addresses/${editingId.value}`, body);
      toast.success('آدرس به‌روزرسانی شد');
    } else {
      await api.post('/addresses', body);
      toast.success('آدرس اضافه شد');
    }
    showForm.value = false;
    await loadAddresses();
  } catch (e: unknown) {
    formError.value = e instanceof Error ? e.message : 'خطا در ذخیره';
    toast.error(formError.value);
    scrollToErrors();
  } finally {
    saving.value = false;
  }
}

async function remove(id: string) {
  if (!confirm('این آدرس حذف شود؟')) return;
  try {
    await api.delete(`/addresses/${id}`);
    toast.success('آدرس حذف شد');
    await loadAddresses();
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : 'خطا در حذف');
  }
}

async function setDefault(id: string) {
  try {
    await api.put(`/addresses/${id}`, { isDefault: true });
    toast.success('آدرس پیش‌فرض تنظیم شد');
    await loadAddresses();
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : 'خطا');
  }
}

const hasFormErrors = computed(() =>
  Boolean(errors.street || errors.plaque || errors.unit || errors.map)
);

useHead({ title: 'آدرس‌ها - KIAA KALA' });
</script>

<template>
  <div>
    <ProfilePageHeader title="آدرس‌های من" subtitle="آدرس را با پلاک و واحد وارد کنید و موقعیت دقیق را روی نقشه مشخص کنید" back-to="/profile">
      <template #action>
        <button class="btn-primary text-sm py-2.5 px-4 min-h-[44px]" @click="openForm()">
          <span class="flex items-center gap-1">
            <AppIcon name="lucide:plus" size="sm" />
            جدید
          </span>
        </button>
      </template>
    </ProfilePageHeader>

    <LoadingSpinner :show="loading" />

    <div v-if="!loading && addresses.length" class="space-y-3">
      <div
        v-for="addr in addresses"
        :key="addr.id"
        :class="['card overflow-hidden transition-shadow', addr.isDefault ? 'ring-2 ring-primary-100' : '']"
      >
        <AppMapPicker
          v-if="addr.latitude != null && addr.longitude != null"
          :latitude="addr.latitude"
          :longitude="addr.longitude"
          readonly
          height="130px"
          :zoom="17"
        />

        <div class="p-4">
          <div class="flex items-start gap-3">
            <div :class="['w-11 h-11 rounded-xl flex items-center justify-center shrink-0', addr.isDefault ? 'bg-primary-50' : 'bg-gray-50']">
              <AppIcon name="lucide:map-pin" size="md" :class="addr.isDefault ? 'text-primary-600' : 'text-gray-500'" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <p v-if="addr.title" class="text-sm font-semibold text-gray-800">{{ addr.title }}</p>
                <span v-if="addr.isDefault" class="text-[10px] font-medium bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full">
                  پیش‌فرض
                </span>
              </div>
              <p class="text-sm text-gray-600 mt-1 leading-relaxed">{{ addr.address }}</p>
              <p v-if="addr.plaque || addr.unit" class="text-xs text-gray-500 mt-1">
                <span v-if="addr.plaque">پلاک {{ addr.plaque }}</span>
                <span v-if="addr.plaque && addr.unit"> • </span>
                <span v-if="addr.unit">واحد {{ addr.unit }}</span>
              </p>
              <a
                v-if="addr.latitude != null && addr.longitude != null"
                :href="mapsLink(addr.latitude, addr.longitude)"
                target="_blank"
                rel="noopener"
                class="inline-flex items-center gap-1 text-xs text-primary-600 mt-2"
              >
                <AppIcon name="lucide:external-link" size="sm" />
                مشاهده موقعیت روی نقشه
              </a>
            </div>
          </div>
          <div class="flex flex-wrap gap-3 mt-4 pt-3 border-t border-gray-50">
            <button v-if="!addr.isDefault" class="text-xs text-primary-600 font-medium min-h-[36px]" @click="setDefault(addr.id)">
              انتخاب پیش‌فرض
            </button>
            <button class="text-xs text-gray-500 min-h-[36px]" @click="openForm(addr)">ویرایش</button>
            <button class="text-xs text-red-500 ms-auto min-h-[36px]" @click="remove(addr.id)">حذف</button>
          </div>
        </div>
      </div>
    </div>

    <EmptyState v-if="!loading && !addresses.length" message="آدرسی ثبت نشده" icon="lucide:map-pin-off">
      <button class="btn-primary mt-4 text-sm min-h-[44px]" @click="openForm()">افزودن اولین آدرس</button>
    </EmptyState>

    <Teleport to="body">
      <div
        v-if="showForm"
        class="fixed inset-0 z-[110] bg-black/50 sm:flex sm:items-center sm:justify-center sm:p-4"
        @click.self="showForm = false"
      >
        <div class="bg-white h-[100dvh] sm:h-auto sm:max-h-[92vh] sm:rounded-2xl w-full sm:max-w-lg flex flex-col overflow-hidden">
          <div class="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
            <h2 class="text-lg font-bold">{{ editingId ? 'ویرایش آدرس' : 'آدرس جدید' }}</h2>
            <button class="p-2 rounded-lg hover:bg-gray-100 min-w-[44px] min-h-[44px] flex items-center justify-center" @click="showForm = false">
              <AppIcon name="lucide:x" size="md" class="text-gray-500" />
            </button>
          </div>

          <form class="flex-1 overflow-y-auto px-4 py-4 space-y-4" @submit.prevent="save">
            <div v-if="formError || hasFormErrors" ref="errorBannerRef">
              <AppAlertBanner :message="formError || 'لطفاً فیلدهای مشخص‌شده را تکمیل کنید.'" />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">عنوان (اختیاری)</label>
              <input v-model="form.title" type="text" class="input-field min-h-[48px]" placeholder="منزل، محل کار..." />
            </div>

            <AddressFields
              v-model:street="street"
              v-model:plaque="plaque"
              v-model:unit="unit"
              :errors="errors"
            />

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">موقعیت روی نقشه (برای پیک) *</label>
              <AppMapPicker
                ref="mapRef"
                v-model:latitude="form.latitude"
                v-model:longitude="form.longitude"
                :geocode="false"
                height="min(40vh, 320px)"
                :zoom="18"
              />
              <AppFormError :message="errors.map" />
            </div>

            <AppSwitch
              v-model="form.isDefault"
              label="آدرس پیش‌فرض"
              description="در checkout خودکار انتخاب می‌شود"
            />
          </form>

          <div class="shrink-0 p-4 border-t border-gray-100 bg-white pb-[calc(env(safe-area-inset-bottom)+1rem)]">
            <button type="button" class="btn-primary w-full min-h-[48px]" :disabled="saving" @click="save">
              {{ saving ? 'در حال ذخیره...' : 'ذخیره آدرس' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
