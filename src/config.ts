/**
 * Config pública del frontend (va al bundle; no son secretos).
 * Las apiKey de Firebase Web son identificadores públicos de la app.
 */

/** Producción en Render; en `npm run dev` apunta al backend local. */
export const API_URL = import.meta.env.DEV
  ? 'http://localhost:3001'
  : 'https://nodefex.onrender.com'

export const nodefexFirebaseConfig = {
  apiKey: 'AIzaSyBXKcJQ-UJcEJWQBRazC2rk86clCaN8UGs',
  authDomain: 'nodefex-41d50.firebaseapp.com',
  projectId: 'nodefex-41d50',
  storageBucket: 'nodefex-41d50.firebasestorage.app',
  messagingSenderId: '132414502302',
  appId: '1:132414502302:web:a13ef55123f8adb02b528f',
} as const

export const velixFirebaseConfig = {
  apiKey: 'AIzaSyArsC96AXJWbMrKCk3eBTTa6YzFnTXTD34',
  authDomain: 'velix-b0ce3.firebaseapp.com',
  projectId: 'velix-b0ce3',
  storageBucket: 'velix-b0ce3.firebasestorage.app',
  messagingSenderId: '315553847152',
  appId: '1:315553847152:web:f815138ac293f87e8061b5',
} as const
