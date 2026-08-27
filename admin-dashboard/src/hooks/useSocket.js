import { useEffect } from 'react'
import { io } from 'socket.io-client'
import { useAuthStore } from 'store/useAuthStore'
import { useNotificationsStore } from 'store/useNotificationsStore'
import brand from '../branding/brand'

export const useSocket = () => {
  const { userId } = useAuthStore()
  const { addNotification } = useNotificationsStore()

  useEffect(() => {
    if (!userId) return

    const socket = io(
      process.env.NODE_ENV === 'production'
        ? brand.socketUrl
        : process.env.REACT_APP_SOCKET_URL || brand.socketUrl,
    )

    socket.emit('register', userId)

    socket.on('new_notification', (notification) => {
      addNotification(notification)
    })

    return () => {
      socket.disconnect()
    }
  }, [userId])
}
