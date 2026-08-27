import axios from 'axios'
import brand from '../branding/brand'

const getDefaultApiBaseUrl = () => {
  return brand.apiBaseUrl
}

const apiBaseURL =
  (process.env.NODE_ENV === 'production'
    ? brand.apiBaseUrl
    : process.env.REACT_APP_API_BASE_URL || getDefaultApiBaseUrl()
  ).replace(/\/+$/, '')

const api = axios.create({
  baseURL: apiBaseURL,
  withCredentials: true, // only if using cookies
})

let refreshPromise = null
const AUTH_BYPASS_PATHS = ['/auth/admin/login', '/auth/refresh-token', '/auth/logout']

const matchesBypassPath = (url = '') => AUTH_BYPASS_PATHS.some((path) => String(url).includes(path))

// Request interceptor: attach access token
api.interceptors.request.use((config) => {
  if (matchesBypassPath(config.url)) {
    if (config.headers?.Authorization) {
      delete config.headers.Authorization
    }
    return config
  }

  const token = localStorage.getItem('accessToken')
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Response interceptor: auto-refresh token on 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    // Prevent infinite loops
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      localStorage.getItem('refreshToken') &&
      !matchesBypassPath(originalRequest?.url)
    ) {
      originalRequest._retry = true

      try {
        const refreshToken = localStorage.getItem('refreshToken')
        if (!refreshPromise) {
          refreshPromise = axios
            .post(
              `${apiBaseURL}/auth/refresh-token`,
              { refreshToken },
              {
                headers: {
                  'x-refresh-token': refreshToken, // ✅ Send in header for better security
                },
              },
            )
            .finally(() => {
              refreshPromise = null
            })
        }
        const res = await refreshPromise

        const newAccessToken = res.data.accessToken
        const newRefreshToken = res.data.refreshToken

        // Save tokens
        localStorage.setItem('accessToken', newAccessToken)
        localStorage.setItem('refreshToken', newRefreshToken)

        // Update Zustand store - import it dynamically to avoid circular dependencies
        import('../store/useAuthStore').then(({ useAuthStore }) => {
          const userId = localStorage.getItem('userId')
          useAuthStore.getState().login(newAccessToken, userId, newRefreshToken)
        })

        // Retry original request with new access token
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`
        return api(originalRequest)
      } catch (refreshErr) {
        console.error('❌ Refresh token failed:', refreshErr)
        localStorage.removeItem('accessToken')
        localStorage.removeItem('refreshToken')
        localStorage.removeItem('userId')

        // Update Zustand store
        import('../store/useAuthStore').then(({ useAuthStore }) => {
          useAuthStore.getState().logout()
        })

        window.location.href = '/auth/signin' // Force logout
      }
    }

    // Reject if not handled
    return Promise.reject(error)
  },
)

export default api
