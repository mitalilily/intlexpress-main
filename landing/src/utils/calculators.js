const PINCODE_REGEX = /^\d{6}$/;

const courierProfiles = [
  { name: "Intlexpress Priority", multiplier: 1.18, eta: "1-2 days", accent: "Best for urgent orders" },
  { name: "Blue Dart Express", multiplier: 1.3, eta: "1-2 days", accent: "Premium network reach" },
  { name: "Delhivery Surface", multiplier: 1.04, eta: "3-5 days", accent: "Balanced cost and coverage" },
  { name: "Xpressbees Smart", multiplier: 0.97, eta: "3-4 days", accent: "Strong D2C economics" },
];

function toNumber(value) {
  const parsed = Number.parseFloat(String(value ?? "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

export function isValidPincode(value) {
  return PINCODE_REGEX.test(String(value ?? "").trim());
}

export function calculateVolumetricWeight(length, breadth, height, divisor = 5000) {
  const l = toNumber(length);
  const b = toNumber(breadth);
  const h = toNumber(height);

  if (l <= 0 || b <= 0 || h <= 0) {
    return 0;
  }

  return Number(((l * b * h) / divisor).toFixed(2));
}

export function getBillableWeight(actualWeight, volumetricWeight) {
  return Number(Math.max(toNumber(actualWeight), toNumber(volumetricWeight)).toFixed(2));
}

export function resolveZone(originPincode, destinationPincode) {
  if (!isValidPincode(originPincode) || !isValidPincode(destinationPincode)) {
    return { label: "Unknown", baseRate: 0, sla: "--" };
  }

  if (originPincode.slice(0, 3) === destinationPincode.slice(0, 3)) {
    return { label: "Local", baseRate: 56, sla: "Same or next day" };
  }

  if (originPincode[0] === destinationPincode[0]) {
    return { label: "Regional", baseRate: 82, sla: "2-3 days" };
  }

  return { label: "National", baseRate: 128, sla: "3-5 days" };
}

export function buildRateSummary(formValues) {
  const volumetricWeight = calculateVolumetricWeight(
    formValues.length,
    formValues.breadth,
    formValues.height
  );
  const actualWeight = Number(toNumber(formValues.weight).toFixed(2));
  const billableWeight = getBillableWeight(actualWeight, volumetricWeight);
  const zone = resolveZone(formValues.originPincode, formValues.destinationPincode);
  const paymentSurcharge = formValues.paymentType === "COD" ? 32 : 0;

  const valid =
    billableWeight > 0 &&
    isValidPincode(formValues.originPincode) &&
    isValidPincode(formValues.destinationPincode);

  return {
    valid,
    zone,
    actualWeight,
    volumetricWeight,
    billableWeight,
    paymentSurcharge,
  };
}

export function generateCourierQuotes(formValues) {
  const summary = buildRateSummary(formValues);

  if (!summary.valid) {
    return [];
  }

  const dimensionalFee = Math.max(summary.billableWeight - 0.5, 0) * 18;
  const fuelFee = summary.zone.label === "National" ? 26 : 12;

  return courierProfiles.map((courier, index) => {
    const amount = Math.round(
      (summary.zone.baseRate + dimensionalFee + fuelFee + summary.paymentSurcharge) * courier.multiplier
    );

    return {
      id: courier.name.toLowerCase().replace(/\s+/g, "-"),
      name: courier.name,
      accent: courier.accent,
      eta: courier.eta,
      serviceScore: 92 - index * 3,
      price: amount,
      zone: summary.zone.label,
      billableWeight: summary.billableWeight,
      badges: [
        summary.paymentSurcharge ? "COD enabled" : "Prepaid lane",
        summary.zone.sla,
      ],
    };
  });
}

export function formatCurrency(value) {
  if (!Number.isFinite(value)) {
    return "--";
  }

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatWeight(value) {
  if (!Number.isFinite(value)) {
    return "--";
  }

  return `${Number(value).toFixed(2)} kg`;
}
