import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { nodefexFirebaseConfig } from './config'

const app = initializeApp(nodefexFirebaseConfig)
export const auth = getAuth(app)
