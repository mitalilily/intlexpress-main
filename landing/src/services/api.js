import {
  mockCalculateRates,
  mockLogin,
  mockSubmitContact,
  mockTrackShipment,
} from "./mockApi";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.trim();

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "Request failed.");
  }

  return data;
}

export async function loginUser(credentials) {
  if (!API_BASE_URL) {
    return mockLogin(credentials);
  }

  return request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(credentials),
  });
}

export async function searchTracking(trackingId) {
  if (!API_BASE_URL) {
    return mockTrackShipment(trackingId);
  }

  return request(`/api/shipments/tracking/${trackingId}`);
}

export async function requestRateQuote(formValues) {
  if (!API_BASE_URL) {
    return mockCalculateRates(formValues);
  }

  return request("/api/rates/calculate", {
    method: "POST",
    body: JSON.stringify(formValues),
  });
}

export async function submitContact(payload) {
  if (!API_BASE_URL) {
    return mockSubmitContact(payload);
  }

  return request("/api/contacts", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
