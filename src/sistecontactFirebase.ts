import { initializeApp, getApps, type FirebaseApp } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'
import { sistecontactFirebaseConfig } from './config'

let sistecontactApp: FirebaseApp | null = null
let sistecontactAuth: Auth | null = null

export function getSistecontactAuth(): Auth {
  if (!sistecontactApp) {
    sistecontactApp =
      getApps().find((app) => app.name === 'sistecontact') ??
      initializeApp(sistecontactFirebaseConfig, 'sistecontact')
    sistecontactAuth = getAuth(sistecontactApp)
  }

  return sistecontactAuth!
}
