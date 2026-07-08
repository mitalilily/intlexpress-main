const courierProfiles = [
  { name: "Intlexpress Priority", multiplier: 1.18, eta: "1-2 days" },
  { name: "Blue Dart Express", multiplier: 1.3, eta: "1-2 days" },
  { name: "Delhivery Surface", multiplier: 1.04, eta: "3-5 days" },
  { name: "Xpressbees Smart", multiplier: 0.97, eta: "3-4 days" },
];

function toNumber(value) {
  const parsed = Number.parseFloat(String(value ?? "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

export function isValidPincode(value) {
  return /^\d{6}$/.test(String(value ?? "").trim());
}

export function getZone(originPincode, destinationPincode) {
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

export function calculateVolumetricWeight(length, breadth, height, divisor = 5000) {
  return Number(((toNumber(length) * toNumber(breadth) * toNumber(height)) / divisor).toFixed(2));
}

export function buildRateSummary(payload) {
  const actualWeight = Number(toNumber(payload.weight).toFixed(2));
  const volumetricWeight = calculateVolumetricWeight(payload.length, payload.breadth, payload.height);
  const billableWeight = Number(Math.max(actualWeight, volumetricWeight).toFixed(2));
  const zone = getZone(payload.originPincode, payload.destinationPincode);
  const paymentSurcharge = payload.paymentType === "COD" ? 32 : 0;

  return {
    actualWeight,
    volumetricWeight,
    billableWeight,
    paymentSurcharge,
    valid:
      billableWeight > 0 &&
      isValidPincode(payload.originPincode) &&
      isValidPincode(payload.destinationPincode),
    zone,
  };
}

export function generateRateOptions(payload) {
  const summary = buildRateSummary(payload);

  if (!summary.valid) {
    return { summary, options: [] };
  }

  const dimensionalFee = Math.max(summary.billableWeight - 0.5, 0) * 18;
  const fuelFee = summary.zone.label === "National" ? 26 : 12;

  return {
    summary,
    options: courierProfiles.map((courier, index) => ({
      id: courier.name.toLowerCase().replace(/\s+/g, "-"),
      name: courier.name,
      eta: courier.eta,
      zone: summary.zone.label,
      billableWeight: summary.billableWeight,
      serviceScore: 92 - index * 3,
      price: Math.round(
        (summary.zone.baseRate + dimensionalFee + fuelFee + summary.paymentSurcharge) * courier.multiplier
      ),
    })),
  };
}
