export interface AddressFieldErrors {
  street?: string;
  plaque?: string;
  unit?: string;
  map?: string;
}

export function composeAddress(street: string, plaque: string, unit: string): string {
  const parts = [street.trim(), `پلاک ${plaque.trim()}`, `واحد ${unit.trim()}`].filter(Boolean);
  return parts.join('، ');
}

export function useAddressFields() {
  const street = ref('');
  const plaque = ref('');
  const unit = ref('');
  const errors = reactive<AddressFieldErrors>({});

  function clearErrors() {
    errors.street = undefined;
    errors.plaque = undefined;
    errors.unit = undefined;
    errors.map = undefined;
  }

  function reset() {
    street.value = '';
    plaque.value = '';
    unit.value = '';
    clearErrors();
  }

  function loadFromAddress(address: {
    address: string;
    plaque?: string | null;
    unit?: string | null;
  }) {
    const plaqueText = address.plaque?.trim() || '';
    const unitText = address.unit?.trim() || '';
    plaque.value = plaqueText;
    unit.value = unitText;

    let streetText = address.address.trim();
    if (plaqueText && unitText) {
      const suffix = `، پلاک ${plaqueText}، واحد ${unitText}`;
      if (streetText.endsWith(suffix)) {
        streetText = streetText.slice(0, -suffix.length).trim();
      }
    }
    street.value = streetText;
    clearErrors();
  }

  function validate(options?: { requireMap?: boolean; hasMap?: boolean }): boolean {
    clearErrors();
    let valid = true;

    if (street.value.trim().length < 5) {
      errors.street = 'خیابان و محله را کامل وارد کنید';
      valid = false;
    }
    if (!plaque.value.trim()) {
      errors.plaque = 'پلاک را وارد کنید';
      valid = false;
    }
    if (!unit.value.trim()) {
      errors.unit = 'واحد را وارد کنید';
      valid = false;
    }
    if (options?.requireMap && !options.hasMap) {
      errors.map = 'موقعیت دقیق را روی نقشه مشخص کنید';
      valid = false;
    }

    return valid;
  }

  function payload(extra?: { title?: string; latitude?: number | null; longitude?: number | null; isDefault?: boolean }) {
    const streetVal = street.value.trim();
    const plaqueVal = plaque.value.trim();
    const unitVal = unit.value.trim();
    const composed = composeAddress(streetVal, plaqueVal, unitVal);

    return {
      ...extra,
      street: streetVal,
      plaque: plaqueVal,
      unit: unitVal,
      deliveryAddress: composed,
      address: composed,
    };
  }

  return {
    street,
    plaque,
    unit,
    errors,
    clearErrors,
    reset,
    loadFromAddress,
    validate,
    payload,
  };
}
