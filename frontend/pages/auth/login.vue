<script setup lang="ts">
import { normalizeDigits, normalizePhoneInput } from '~/utils/normalize';

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
const loginError = computed(() => route.query.error as string);

async function afterLogin() {
  await authStore.fetchProfile().catch(() => undefined);
  await nextTick();

  if (redirect.value?.startsWith('/admin') && !authStore.isAdmin) {
    error.value = 'این حساب دسترسی ادمین ندارد';
    authStore.logout();
    return;
  }

  const target = redirect.value || (authStore.isAdmin ? '/admin' : '/profile');
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

useHead({ title: 'ورود - هایپرمارکت' });
definePageMeta({ layout: false });
</script>

<template>
  <div class="min-h-screen flex items-center justify-center px-4 bg-gray-50">
    <div class="w-full max-w-sm">
      <div class="flex justify-center mb-8">
        <AppLogo size="lg" />
      </div>

      <div class="card p-6">
        <h1 class="text-lg font-bold text-gray-800 mb-1">ورود / ثبت‌نام</h1>
        <p class="text-sm text-gray-500 mb-4">یکی از روش‌های ورود را انتخاب کنید</p>

        <div
          v-if="loginError === 'not-admin'"
          class="bg-red-50 text-red-600 text-sm p-3 rounded-xl mb-4"
        >
          حساب شما دسترسی پنل ادمین ندارد. فقط با شماره ادمین وارد شوید.
        </div>

        <!-- Mode tabs -->
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
            ورود با رمز ثابت
          </button>
        </div>

        <!-- OTP mode -->
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
              کد تأیید به {{ normalizePhoneInput(phone) }} ارسال شد
              <button type="button" class="text-primary-600 mr-1" @click="step = 'phone'">تغییر</button>
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

        <!-- Password mode -->
        <form v-else @submit.prevent="loginWithPassword">
          <label class="block text-sm font-medium text-gray-700 mb-1">شماره موبایل</label>
          <input
            v-model="phone"
            type="tel"
            required
            class="input-field mb-4"
            placeholder="09120000000"
            dir="ltr"
          />
          <label class="block text-sm font-medium text-gray-700 mb-1">رمز عبور</label>
          <input
            v-model="password"
            type="password"
            required
            minlength="4"
            class="input-field mb-4"
            placeholder="رمز عبور"
            dir="ltr"
          />
          <p class="text-xs text-gray-400 mb-4">
            ادمین: شماره <span dir="ltr">09120000000</span> — OTP: <span dir="ltr">123456</span> — رمز: <span dir="ltr">admin1234</span>
          </p>
          <div v-if="error" class="bg-red-50 text-red-600 text-sm p-3 rounded-xl mb-4">{{ error }}</div>
          <button type="submit" class="btn-primary w-full" :disabled="authStore.loading">
            {{ authStore.loading ? 'در حال ورود...' : 'ورود' }}
          </button>
        </form>
      </div>

      <p class="text-center text-sm text-gray-400 mt-4">
        <NuxtLink to="/" class="hover:text-primary-600">بازگشت به فروشگاه</NuxtLink>
      </p>
    </div>
  </div>
</template>
