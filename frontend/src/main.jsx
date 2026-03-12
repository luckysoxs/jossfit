import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { UnreadProvider } from './contexts/UnreadContext'
import { RestTimerProvider } from './contexts/RestTimerContext'
import { WeightUnitProvider } from './contexts/WeightUnitContext'
import './index.css'


// Prevent PWA from pausing background music (Spotify, etc.)
// Sets the audio session to "ambient" so our app mixes with other audio
// instead of interrupting it. Only activates our audio on explicit user action.
try {
  if (navigator.audioSession) {
    navigator.audioSession.type = 'ambient'
  }
} catch {}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <UnreadProvider>
            <RestTimerProvider>
              <WeightUnitProvider>
                <App />
              </WeightUnitProvider>
            </RestTimerProvider>
          </UnreadProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
)
