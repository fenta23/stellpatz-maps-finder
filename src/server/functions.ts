import { onRequest } from 'firebase-functions/v2/https'
import { createApp } from './index.js'

// Express-App wird einmal pro Function-Instanz erstellt (Warm-Starts wiederverwenden sie).
// In-Memory-Cache und Rate-Limiter sind pro Instanz — für verteiltes Rate-Limiting
// wäre Redis nötig, reicht aber für den aktuellen Traffic-Umfang.
const app = createApp()

// Firebase Hosting leitet /api/** hierher weiter (siehe firebase.json).
export const api = onRequest({ region: 'europe-west1' }, app)
