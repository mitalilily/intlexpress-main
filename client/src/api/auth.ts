import axiosInstance from "./axiosInstance";
import { getAuthTokens } from "./tokenVault";

export interface RequestOtpResponse {
  message: string;
  deliveryMode?: "console" | "email";
  otp?: string;
}

export const requestOtpApi = async (email: string) => {
  // SMTP delivery can take longer than the normal API timeout. Keep the
  // request open long enough for the backend to finish sending the OTP;
  // otherwise the email arrives while the UI incorrectly shows an error.
  const { data } = await axiosInstance.post("/auth/request-otp", { email }, { timeout: 30000 });
  return data as RequestOtpResponse;
};

export const verifyOtpApi = async (email: string, otp: string) => {
  const { data } = await axiosInstance.post("/auth/verify-otp", {
    email,
    otp,
  });
  return data;
};

export const requestPasswordLoginApi = async (
  email: string,
  password?: string
) => {
  const { data } = await axiosInstance.post("/auth/request-password-login", {
    email,
    password,
  });
  return data;
};

export const verifyEmailOtpApi = async (
  email: string,
  otp: string,
  password: string
) => {
  const { data } = await axiosInstance.post("/auth/verify-user-email", {
    email,
    token: otp,
    password,
  });
  return data;
};

export const googleLoginApi = async (code: string) => {
  const { data } = await axiosInstance.post("/auth/signin-with-google", {
    code,
  });
  return data;
};

export const logoutApi = async () => {
  const { refreshToken } = getAuthTokens();
  if (!refreshToken) return;

  await axiosInstance.post(
    "/auth/logout",
    {},
    {
      headers: { "x-refresh-token": refreshToken },
    }
  );
};

/** Payload accepted by the backend */
export interface ChangePasswordPayload {
  newPassword: string;
  currentPassword?: string; // optional when the user has no existing password
}

/**
 * PATCH /api/account/password
 * (Auth cookie / bearer handled by interceptors)
 */
export const changePassword = (data: ChangePasswordPayload) =>
  axiosInstance.patch("/profile/profile-password", data);
