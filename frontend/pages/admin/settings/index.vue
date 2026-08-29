<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' });

const api = useApi();
const toast = useToast();

type SettingsTab = 'new-order-sms';

interface NewOrderSmsSettings {
  enabled: boolean;
  phones: string[];
  includePanelStaff: boolean;
  messageTemplate: string;
}

const tabs: Array<{ id: SettingsTab; label: string; icon: string }> = [
  { id: 'new-order-sms', label: 'پیامک نوتیف سفارش', icon: 'lucide:message-square-text' },
];

const activeTab = ref<SettingsTab>('new-order-sms');
const loading = ref(true);
const saving = ref(false);
const testing = ref(false);
const showGuide = ref(true);
const testPhone = ref('');

const form = reactive({
  enabled: true,
  phonesText: '',
  includePanelStaff: false,
  messageTemplate: '',
});

const previewText = computed(() =>
  form.messageTemplate
    .split('{orderNumber}')
    .join('KK-1403-001')
    .split('{customerName}')
    .join('علی رضایی')
);

const phoneCount = computed(() =>
  form.phonesText
    .split(/[\n,،]+/)
    .map((p) => p.trim())
    .filter(Boolean).length
);

onMounted(loadSettings);

async function loadSettings() {
  loading.value = true;
  try {
    const { data } = await api.get<NewOrderSmsSettings>('/admin/settings/new-order-sms');
    form.enabled = data.enabled;
    form.phonesText = data.phones.join('\n');
    form.includePanelStaff = data.includePanelStaff;
    form.messageTemplate = data.messageTemplate;
    if (!testPhone.value && data.phones.length) {
      testPhone.value = data.phones[0];
    }
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : 'خطا در بارگذاری تنظیمات');
  } finally {
    loading.value = false;
  }
}

function parsePhones(text: string): string[] {
  return text
    .split(/[\n,،]+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function insertPlaceholder(key: '{orderNumber}' | '{customerName}') {
  form.messageTemplate = `${form.messageTemplate}${form.messageTemplate ? ' ' : ''}${key}`;
}

async function sendTestSms() {
  const phone = testPhone.value.trim();
  if (!phone) {
    toast.error('شماره موبایل برای تست وارد کنید');
    return;
  }
  if (!form.messageTemplate.trim()) {
    toast.error('متن پیامک خالی است');
    return;
  }

  testing.value = true;
  try {
    const res = await api.post<{ phone: string; preview: string; stub: boolean }>(
      '/admin/settings/new-order-sms/test',
      {
        phone,
        messageTemplate: form.messageTemplate.trim(),
      }
    );
    const msg = res.message || 'پیامک تست ارسال شد';
    toast.success(res.data.stub ? `${msg} — ${res.data.preview}` : msg);
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : 'خطا در ارسال پیامک تست');
  } finally {
    testing.value = false;
  }
}

async function saveSettings() {
  saving.value = true;
  try {
    const { data } = await api.put<NewOrderSmsSettings>('/admin/settings/new-order-sms', {
      enabled: form.enabled,
      phones: parsePhones(form.phonesText),
      includePanelStaff: form.includePanelStaff,
      messageTemplate: form.messageTemplate.trim(),
    });
    form.enabled = data.enabled;
    form.phonesText = data.phones.join('\n');
    form.includePanelStaff = data.includePanelStaff;
    form.messageTemplate = data.messageTemplate;
    toast.success('تنظیمات ذخیره شد');
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : 'خطا در ذخیره');
  } finally {
    saving.value = false;
  }
}

useHead({ title: 'تنظیمات - پنل مدیریت' });
</script>

<template>
  <div>
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">تنظیمات</h1>
        <p class="text-sm text-gray-500 mt-1">پیامک و اعلان‌های عملیاتی فروشگاه</p>
      </div>
      <button type="button" class="btn-secondary text-sm self-start" @click="showGuide = !showGuide">
        {{ showGuide ? 'بستن راهنما' : 'نمایش راهنما' }}
      </button>
    </div>

    <div class="flex flex-wrap gap-2 mb-6 border-b border-gray-200 pb-px">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        type="button"
        class="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 -mb-px transition-colors"
        :class="
          activeTab === tab.id
            ? 'border-primary-600 text-primary-700 bg-white'
            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
        "
        @click="activeTab = tab.id"
      >
        <AppIcon :name="tab.icon" size="sm" />
        {{ tab.label }}
      </button>
    </div>

    <div
      v-if="showGuide && activeTab === 'new-order-sms'"
      class="card p-4 mb-6 text-sm text-gray-700 leading-7 bg-primary-50/40 border border-primary-100 max-w-3xl"
    >
      <p class="font-bold text-gray-800 mb-2 flex items-center gap-2">
        <AppIcon name="lucide:circle-help" size="sm" class="text-primary-600" />
        راهنمای ادمین — پیامک نوتیف سفارش
      </p>
      <ul class="list-disc pr-5 space-y-1.5">
        <li>
          این پیامک جدا از <b>نوتیف صدا و بنر داخل پنل</b> است؛ آن‌ها از چک‌باکس «نوتیف سفارش» بالای صفحه کنترل می‌شوند.
        </li>
        <li>
          به محض ثبت سفارش توسط مشتری، پیامک به شماره‌هایی که اینجا می‌گذارید فرستاده می‌شود تا سریع مطلع شوید.
        </li>
        <li>
          شماره را با فرمت <span dir="ltr" class="font-mono">09xxxxxxxxx</span> وارد کنید (۱۱ رقم). هر خط یک شماره.
        </li>
        <li>
          اگر فقط چند نفر باید خبر بگیرند، همان شماره‌ها را بنویسید و «ارسال به همه پرسنل پنل» را خاموش بگذارید تا هزینه پیامک کم بماند.
        </li>
        <li>
          گزینه پرسنل پنل وقتی مفید است که همه کاربران فعال با نقش مدیر / مسئول / پرسنل هم باید پیامک بگیرند.
        </li>
        <li>
          در متن پیامک می‌توانید از
          <code class="bg-white/80 px-1 rounded text-xs">{orderNumber}</code>
          (شماره سفارش) و
          <code class="bg-white/80 px-1 rounded text-xs">{customerName}</code>
          (نام مشتری) استفاده کنید؛ موقع ارسال خودکار جایگزین می‌شوند.
        </li>
        <li>
          متن را کوتاه نگه دارید (حدود یک پیامک)؛ متن خیلی بلند ممکن است چند پیامک حساب شود.
        </li>
        <li>
          بعد از هر تغییر حتماً <b>ذخیره تنظیمات</b> را بزنید؛ تا ذخیره نشود، ارسال با تنظیم قبلی انجام می‌شود.
        </li>
      </ul>
    </div>

    <div v-if="loading" class="bg-white rounded-xl border border-gray-100 p-8 text-center text-gray-400">
      در حال بارگذاری…
    </div>

    <div
      v-else-if="activeTab === 'new-order-sms'"
      class="bg-white rounded-xl border border-gray-100 p-6 space-y-6 max-w-2xl"
    >
      <div>
        <h2 class="text-lg font-semibold text-gray-900">پیامک نوتیف ثبت سفارش</h2>
        <p class="text-sm text-gray-500 mt-1">
          وقتی مشتری سفارش جدید ثبت می‌کند، این پیامک برای شماره‌های زیر ارسال می‌شود.
        </p>
      </div>

      <label class="flex items-start gap-3 cursor-pointer rounded-lg border border-gray-100 p-3 hover:bg-gray-50/80">
        <input v-model="form.enabled" type="checkbox" class="mt-1 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
        <span>
          <span class="block text-sm font-medium text-gray-900">ارسال پیامک فعال باشد</span>
          <span class="block text-xs text-gray-500 mt-0.5 leading-relaxed">
            خاموش = هیچ پیامک نوتیفی برای سفارش جدید نمی‌رود (نوتیف داخل پنل همچنان کار می‌کند).
          </span>
        </span>
      </label>

      <div :class="{ 'opacity-50 pointer-events-none': !form.enabled }">
        <div class="flex items-center justify-between gap-2 mb-1.5">
          <label class="block text-sm font-medium text-gray-700">شماره‌های گیرنده</label>
          <span class="text-xs text-gray-400">{{ phoneCount }} شماره</span>
        </div>
        <textarea
          v-model="form.phonesText"
          rows="4"
          dir="ltr"
          class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono text-start focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          placeholder="09121234567&#10;09129876543"
        />
        <p class="text-xs text-gray-500 mt-1.5 leading-relaxed">
          هر خط یک شماره موبایل ایران. می‌توانید با ویرگول هم جدا کنید. شماره‌های تکراری خودکار حذف می‌شوند.
        </p>
      </div>

      <label
        class="flex items-start gap-3 cursor-pointer rounded-lg border border-gray-100 p-3 hover:bg-gray-50/80"
        :class="{ 'opacity-50': !form.enabled }"
      >
        <input
          v-model="form.includePanelStaff"
          type="checkbox"
          class="mt-1 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          :disabled="!form.enabled"
        />
        <span>
          <span class="block text-sm font-medium text-gray-900">ارسال به همه پرسنل پنل</span>
          <span class="block text-xs text-gray-500 mt-0.5 leading-relaxed">
            علاوه بر لیست بالا، به همه کاربران فعال با نقش مدیر، مسئول یا پرسنل هم پیامک می‌رود.
            اگر پرسنل زیاد دارید، هزینه پیامک بیشتر می‌شود.
          </span>
        </span>
      </label>

      <div :class="{ 'opacity-50 pointer-events-none': !form.enabled }">
        <label class="block text-sm font-medium text-gray-700 mb-1.5">متن پیامک</label>
        <div class="flex flex-wrap gap-2 mb-2">
          <button
            type="button"
            class="text-xs px-2.5 py-1 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200"
            @click="insertPlaceholder('{orderNumber}')"
          >
            + شماره سفارش
          </button>
          <button
            type="button"
            class="text-xs px-2.5 py-1 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200"
            @click="insertPlaceholder('{customerName}')"
          >
            + نام مشتری
          </button>
        </div>
        <textarea
          v-model="form.messageTemplate"
          rows="4"
          class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          placeholder="سفارش جدید {orderNumber}&#10;مشتری: {customerName}"
        />
        <p class="text-xs text-gray-500 mt-1.5 leading-relaxed">
          متغیرها را عین همین بنویسید (با آکولاد). دکمه‌های بالا هم می‌توانند آن‌ها را به متن اضافه کنند.
        </p>
      </div>

      <div class="rounded-lg bg-gray-50 border border-gray-100 p-4" :class="{ 'opacity-50': !form.enabled }">
        <p class="text-xs font-medium text-gray-500 mb-2">پیش‌نمایش نمونه (با داده فرضی)</p>
        <pre class="text-sm text-gray-800 whitespace-pre-wrap font-sans">{{ previewText || '—' }}</pre>
      </div>

      <div
        v-if="form.enabled && !phoneCount && !form.includePanelStaff"
        class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800"
      >
        هنوز گیرنده‌ای ندارید. حداقل یک شماره وارد کنید یا «ارسال به همه پرسنل پنل» را روشن کنید.
      </div>

      <div class="rounded-lg border border-dashed border-gray-200 p-4 space-y-3">
        <div>
          <h3 class="text-sm font-semibold text-gray-900">ارسال پیامک تست</h3>
          <p class="text-xs text-gray-500 mt-1 leading-relaxed">
            قبل از ذخیره هم می‌توانید با متن فعلی فرم، یک پیامک آزمایشی بفرستید. پیشوند
            <span dir="ltr" class="font-mono">[تست]</span>
            به ابتدای پیام اضافه می‌شود.
          </p>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1.5">شماره گیرنده تست</label>
          <input
            v-model="testPhone"
            type="tel"
            dir="ltr"
            class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono text-start focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            placeholder="09121234567"
          />
        </div>
        <button
          type="button"
          class="btn-secondary text-sm disabled:opacity-60"
          :disabled="testing || !testPhone.trim()"
          @click="sendTestSms"
        >
          {{ testing ? 'در حال ارسال…' : 'ارسال پیامک تست' }}
        </button>
      </div>

      <div class="flex justify-end pt-2">
        <button
          type="button"
          class="btn-primary px-5 py-2.5 disabled:opacity-60"
          :disabled="saving"
          @click="saveSettings"
        >
          {{ saving ? 'در حال ذخیره…' : 'ذخیره تنظیمات' }}
        </button>
      </div>
    </div>
  </div>
</template>
