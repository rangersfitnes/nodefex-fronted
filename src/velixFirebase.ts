import { FirebaseError, initializeApp, getApps, type FirebaseApp } from 'firebase/app'
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type Auth,
  type User,
} from 'firebase/auth'
import { velixFirebaseConfig } from './config'

let velixApp: FirebaseApp | null = null
let velixAuth: Auth | null = null

function getVelixAuth() {
  if (!velixApp) {
    velixApp =
      getApps().find((app) => app.name === 'velix') ??
      initializeApp(velixFirebaseConfig, 'velix')
    velixAuth = getAuth(velixApp)
  }

  return velixAuth!
}

export async function registroVelixClient(email: string, password: string) {
  const credential = await createUserWithEmailAndPassword(getVelixAuth(), email, password)
  return credential.user
}

export async function loginVelixClient(email: string, password: string) {
  const credential = await signInWithEmailAndPassword(getVelixAuth(), email, password)
  return credential.user
}

export async function logoutVelixClient() {
  const auth = getVelixAuth()
  if (auth.currentUser) {
    await signOut(auth)
  }
}

export async function getVelixIdToken(forceRefresh = false) {
  const user = getVelixAuth().currentUser
  if (!user) return null
  return user.getIdToken(forceRefresh)
}

export function subscribeVelixAuth(callback: (user: User | null) => void) {
  return onAuthStateChanged(getVelixAuth(), callback)
}

export function mapVelixAuthError(error: unknown): string {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case 'auth/email-already-in-use':
        return 'Ya existe una cuenta con ese correo'
      case 'auth/invalid-email':
        return 'El correo no es válido'
      case 'auth/weak-password':
        return 'La contraseña debe tener al menos 6 caracteres'
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        return 'Correo o contraseña incorrectos'
      case 'auth/operation-not-allowed':
        return 'Activa Email/Password en Authentication del proyecto Velix'
      default:
        return error.message
    }
  }
  if (error instanceof Error) return error.message
  return 'No se pudo autenticar'
}
