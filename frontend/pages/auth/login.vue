<script setup lang="ts">
const authStore = useAuthStore();
const route = useRoute();

const mode = ref<'otp' | 'password'>('otp');
const step = ref<'phone' | 'otp'>('phone');
const phone = ref('');
const otp = ref('');
const password = ref('');
const error = ref('');
const devCode = ref('');

const redirect = computed(() => (route.query.redirect as string) || '');

function safeRedirectTarget(raw: string) {
  // Only same-origin relative paths; reject protocol-relative //evil
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/profile';
  if (raw.startsWith('/admin')) return '/profile';
  return raw;
}

async function afterLogin() {
  await authStore.fetchProfile().catch(() => undefined);
  await nextTick();
  const target = safeRedirectTarget(redirect.value || '/profile');
  await navigateTo(target, { replace: true });
}

async function sendOtp() {
  error.value = '';
  try {
    const result = await authStore.sendOtp(phone.value);
    if (result.devCode) devCode.value = result.devCode;
    step.value = 'otp';
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'خطا در ارسال کد';
  }
}

async function verifyOtp() {
  error.value = '';
  try {
    await authStore.verifyOtp(phone.value, otp.value);
    await afterLogin();
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'کد نامعتبر است';
  }
}

async function loginWithPassword() {
  error.value = '';
  try {
    await authStore.loginWithPassword(phone.value, password.value);
    await afterLogin();
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'ورود ناموفق بود';
  }
}

function switchMode(next: 'otp' | 'password') {
  mode.value = next;
  step.value = 'phone';
  error.value = '';
  otp.value = '';
  password.value = '';
}

useHead({ title: 'ورود - KIAA KALA' });
definePageMeta({ layout: false });
</script>

<template>
  <div class="min-h-screen flex items-center justify-center px-4 bg-gray-50">
    <div class="w-full max-w-sm">
      <div class="flex justify-center mb-8">
        <AppLogo size="lg" />
      </div>

      <div class="card p-6">
        <h1 class="text-lg font-bold text-gray-800 mb-1">ورود / ثبت‌نام مشتری</h1>
        <p class="text-sm text-gray-500 mb-4">با پیامک یا رمز عبور شخصی وارد شوید</p>

        <div class="flex gap-2 mb-6 p-1 bg-gray-100 rounded-xl">
          <button
            type="button"
            :class="[
              'flex-1 py-2 text-sm font-medium rounded-lg transition-colors',
              mode === 'otp' ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500',
            ]"
            @click="switchMode('otp')"
          >
            ورود با پیامک
          </button>
          <button
            type="button"
            :class="[
              'flex-1 py-2 text-sm font-medium rounded-lg transition-colors',
              mode === 'password' ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500',
            ]"
            @click="switchMode('password')"
          >
            ورود با رمز
          </button>
        </div>

        <template v-if="mode === 'otp'">
          <form v-if="step === 'phone'" @submit.prevent="sendOtp">
            <label class="block text-sm font-medium text-gray-700 mb-1">شماره موبایل</label>
            <input
              v-model="phone"
              type="tel"
              required
              class="input-field mb-4"
              placeholder="09123456789"
              dir="ltr"
            />
            <div v-if="error" class="bg-red-50 text-red-600 text-sm p-3 rounded-xl mb-4">{{ error }}</div>
            <button type="submit" class="btn-primary w-full" :disabled="authStore.loading">
              {{ authStore.loading ? 'در حال ارسال...' : 'دریافت کد تأیید' }}
            </button>
          </form>

          <form v-else @submit.prevent="verifyOtp">
            <p class="text-sm text-gray-500 mb-4">
              کد تأیید ارسال شد
              <button type="button" class="text-primary-600 mr-1" @click="step = 'phone'">تغییر شماره</button>
            </p>
            <div v-if="devCode" class="bg-yellow-50 text-yellow-800 text-sm p-3 rounded-xl mb-4">
              کد توسعه: <strong dir="ltr">{{ devCode }}</strong>
            </div>
            <label class="block text-sm font-medium text-gray-700 mb-1">کد تأیید</label>
            <input
              v-model="otp"
              type="text"
              required
              maxlength="6"
              inputmode="numeric"
              class="input-field mb-4 text-center text-2xl tracking-widest"
              placeholder="------"
              dir="ltr"
              autofocus
            />
            <div v-if="error" class="bg-red-50 text-red-600 text-sm p-3 rounded-xl mb-4">{{ error }}</div>
            <button type="submit" class="btn-primary w-full" :disabled="authStore.loading">
              {{ authStore.loading ? 'در حال بررسی...' : 'ورود' }}
            </button>
          </form>
        </template>

        <form v-else @submit.prevent="loginWithPassword">
          <label class="block text-sm font-medium text-gray-700 mb-1">شماره موبایل</label>
          <input
            v-model="phone"
            type="tel"
            required
            class="input-field mb-4"
            placeholder="09123456789"
            dir="ltr"
          />
          <label class="block text-sm font-medium text-gray-700 mb-1">رمز عبور</label>
          <input
            v-model="password"
            type="password"
            required
            minlength="6"
            class="input-field mb-4"
            placeholder="رمز عبور شخصی"
            dir="ltr"
          />
          <p class="text-xs text-gray-400 mb-4">
            اگر هنوز رمز ندارید، با پیامک وارد شوید و از پروفایل رمز بگذارید.
          </p>
          <div v-if="error" class="bg-red-50 text-red-600 text-sm p-3 rounded-xl mb-4">{{ error }}</div>
          <button type="submit" class="btn-primary w-full" :disabled="authStore.loading">
            {{ authStore.loading ? 'در حال ورود...' : 'ورود' }}
          </button>
        </form>
      </div>

      <p class="text-center text-sm text-gray-400 mt-4 space-y-1">
        <NuxtLink to="/" class="block hover:text-primary-600">بازگشت به فروشگاه</NuxtLink>
        <NuxtLink to="/admin/login" class="block hover:text-primary-600">ورود مدیران</NuxtLink>
      </p>
    </div>
  </div>
</template>
