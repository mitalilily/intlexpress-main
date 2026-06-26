// notificationSocket.js
import { io } from 'socket.io-client'
import brand from '../branding/brand'
const URL = process.env.REACT_APP_SOCKET_URL || brand.socketUrl
export const socket = io(URL) // Your backend URL

export function registerUser(userId) {
  socket.emit('register', userId)
}
