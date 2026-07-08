function isValidPincode(value) {
  return /^\d{6}$/.test(String(value).trim());
}

function toNumber(value) {
  const parsed = Number.parseFloat(String(value).trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

function resolveZone(pickupPincode, deliveryPincode) {
  const pickup = String(pickupPincode);
  const delivery = String(deliveryPincode);

  if (pickup.slice(0, 3) === delivery.slice(0, 3)) {
    return { label: "Local", surcharge: 18, eta: "1-2 days" };
  }

  if (pickup.slice(0, 1) === delivery.slice(0, 1)) {
    return { label: "Regional", surcharge: 34, eta: "2-4 days" };
  }

  return { label: "National", surcharge: 56, eta: "4-6 days" };
}

export function calculateShippingEstimate({
  packageWeight,
  pickupPincode,
  deliveryPincode,
  packageLength,
  packageWidth,
  packageHeight,
}) {
  const actualWeight = toNumber(packageWeight);
  const packageLengthValue = toNumber(packageLength);
  const packageWidthValue = toNumber(packageWidth);
  const packageHeightValue = toNumber(packageHeight);

  if (
    actualWeight <= 0 ||
    packageLengthValue <= 0 ||
    packageWidthValue <= 0 ||
    packageHeightValue <= 0 ||
    !isValidPincode(pickupPincode) ||
    !isValidPincode(deliveryPincode)
  ) {
    return {
      estimatedCost: 0,
      zoneLabel: "--",
      eta: "--",
      actualWeight: 0,
      volumetricWeight: 0,
      billableWeight: 0,
    };
  }

  const zone = resolveZone(pickupPincode, deliveryPincode);
  const volumetricWeight = (packageLengthValue * packageWidthValue * packageHeightValue) / 5000;
  const billableWeight = Math.max(actualWeight, volumetricWeight);
  const baseCharge = 42;
  const weightCharge = billableWeight <= 0.5 ? 0 : Math.ceil((billableWeight - 0.5) * 2) * 12;

  return {
    estimatedCost: Number((baseCharge + zone.surcharge + weightCharge).toFixed(2)),
    zoneLabel: zone.label,
    eta: zone.eta,
    actualWeight: Number(actualWeight.toFixed(2)),
    volumetricWeight: Number(volumetricWeight.toFixed(2)),
    billableWeight: Number(billableWeight.toFixed(2)),
  };
}
