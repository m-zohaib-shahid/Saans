import React, { useState } from 'react';
import { ErrorBoundary } from './ErrorBoundary';
import { SplashScreen } from './SplashScreen';
import { OnboardingModal } from './OnboardingModal';
import { AuthPage } from '../pages/AuthPage';
import { authService } from '../services/authService';
import type { Language, LocationAirSnapshot, PersonaId, UserSession } from '../types';

const ONBOARDED_KEY = 'saans_onboarded';

interface AppGateProps {
  dataReady: boolean;
  lahore: LocationAirSnapshot | null;
  language: Language;
  useUrduNumerals: boolean;
  liteMode: boolean;
  persona: PersonaId;
  session: UserSession | null;
  onSessionChange: (session: UserSession | null, persona?: PersonaId) => void;
  onSelectLanguage: (lang: Language) => void;
  onSelectPersona: (persona: PersonaId) => void;
  onEnableNotifications: () => Promise<void>;
  onOnboardingDone: () => void;
  children: React.ReactNode;
}

export const AppGate: React.FC<AppGateProps> = ({
  dataReady,
  lahore,
  language,
  useUrduNumerals,
  liteMode,
  persona,
  session,
  onSessionChange,
  onSelectLanguage,
  onSelectPersona,
  onEnableNotifications,
  onOnboardingDone,
  children,
}) => {
  const [splashDone, setSplashDone] = useState(false);
  const [onboarded, setOnboarded] = useState<boolean>(() => {
    return localStorage.getItem(ONBOARDED_KEY) === 'true';
  });

  if (!splashDone) {
    return (
      <ErrorBoundary>
        <SplashScreen
          dataReady={dataReady}
          liteMode={liteMode}
          lang={language}
          onComplete={() => setSplashDone(true)}
        />
      </ErrorBoundary>
    );
  }

  if (!session) {
    return (
      <ErrorBoundary>
        <AuthPage
          lahore={lahore}
          lang={language}
          useUrduNumerals={useUrduNumerals}
          liteMode={liteMode}
          onChangeLanguage={onSelectLanguage}
          onAuthenticated={(newSession, chosenPersona) => {
            onSessionChange(newSession, chosenPersona);
          }}
        />
      </ErrorBoundary>
    );
  }

  if (!onboarded) {
    return (
      <ErrorBoundary>
        <div className="min-h-screen bg-[#F6F8FA] dark:bg-[#0B131E]">
          <OnboardingModal
            language={language}
            persona={persona}
            onSelectLanguage={onSelectLanguage}
            onSelectPersona={(p) => {
              onSelectPersona(p);
              authService.updateProfile({ persona: p });
            }}
            onEnableNotifications={onEnableNotifications}
            onComplete={() => {
              localStorage.setItem(ONBOARDED_KEY, 'true');
              setOnboarded(true);
              onOnboardingDone();
            }}
          />
        </div>
      </ErrorBoundary>
    );
  }

  return <ErrorBoundary>{children}</ErrorBoundary>;
};
