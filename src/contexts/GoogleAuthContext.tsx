import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Capacitor } from '@capacitor/core';
import { SocialLogin, GoogleLoginResponseOnline } from '@capgo/capacitor-social-login';

const GOOGLE_WEB_CLIENT_ID = '52777395492-vnlk2hkr3pv15dtpgp2m51p7418vll90.apps.googleusercontent.com';

const SCOPES = ['profile', 'email', 'https://www.googleapis.com/auth/drive.appdata'];

export interface GoogleUser {
  id: string;
  email: string;
  name: string;
  givenName?: string;
  familyName?: string;
  imageUrl?: string;
  authentication: {
    accessToken: string;
    idToken?: string;
    refreshToken?: string;
  };
}

interface GoogleAuthContextType {
  user: GoogleUser | null;
  isLoading: boolean;
  isSignedIn: boolean;
  signIn: () => Promise<GoogleUser | null>;
  signOut: () => Promise<void>;
  refreshToken: () => Promise<string | null>;
  getAccessToken: () => string | null;
}

const GoogleAuthContext = createContext<GoogleAuthContextType | undefined>(undefined);

export const useGoogleAuth = () => {
  const context = useContext(GoogleAuthContext);
  if (!context) {
    throw new Error('useGoogleAuth must be used within a GoogleAuthProvider');
  }
  return context;
};

interface GoogleAuthProviderProps {
  children: ReactNode;
}

// Google Identity Services types
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: any) => void;
          prompt: (callback?: (notification: any) => void) => void;
          renderButton: (element: HTMLElement, config: any) => void;
          disableAutoSelect: () => void;
          revoke: (hint: string, callback: () => void) => void;
        };
        oauth2: {
          initTokenClient: (config: any) => any;
        };
      };
    };
  }
}

export const GoogleAuthProvider: React.FC<GoogleAuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<GoogleUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [gisLoaded, setGisLoaded] = useState(false);
  const platform = Capacitor.getPlatform();

  // Load Google Identity Services for web
  useEffect(() => {
    if (platform !== 'web') {
      setIsLoading(false);
      return;
    }

    const loadGIS = () => {
      if (window.google?.accounts) {
        setGisLoaded(true);
        setIsLoading(false);
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        setGisLoaded(true);
        setIsLoading(false);
      };
      script.onerror = () => {
        console.error('Failed to load Google Identity Services');
        setIsLoading(false);
      };
      document.head.appendChild(script);
    };

    loadGIS();
    checkExistingSession();
  }, [platform]);

  // Initialize native plugin for mobile
  useEffect(() => {
    if (platform === 'web') return;

    const initNative = async () => {
      try {
        console.log('[GoogleAuth] Initializing native plugin...');
        console.log('[GoogleAuth] Platform:', platform);
        console.log('[GoogleAuth] Web Client ID:', GOOGLE_WEB_CLIENT_ID);
        
        await SocialLogin.initialize({
          google: {
            webClientId: GOOGLE_WEB_CLIENT_ID,
            mode: 'online',
          },
        });
        
        console.log('[GoogleAuth] Native plugin initialized successfully');
        await checkExistingSession();
      } catch (error) {
        console.error('[GoogleAuth] Failed to initialize native Google auth:', error);
        console.error('[GoogleAuth] Error details:', JSON.stringify(error, null, 2));
      } finally {
        setIsLoading(false);
      }
    };

    initNative();
  }, [platform]);

  const checkExistingSession = async () => {
    try {
      const storedUser = localStorage.getItem('google_user');
      if (storedUser) {
        const parsed = JSON.parse(storedUser) as GoogleUser;
        setUser(parsed);
      }
    } catch (error) {
      console.log('No existing Google session found');
      localStorage.removeItem('google_user');
    }
  };

  // Web sign-in using Google Identity Services OAuth2 (popup mode)
  const signInWeb = useCallback(async (): Promise<GoogleUser | null> => {
    return new Promise((resolve, reject) => {
      if (!window.google?.accounts) {
        reject(new Error('Google Identity Services not loaded'));
        return;
      }

      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_WEB_CLIENT_ID,
        scope: SCOPES.join(' '),
        callback: async (tokenResponse: any) => {
          if (tokenResponse.error) {
            reject(new Error(tokenResponse.error));
            return;
          }

          try {
            // Get user info with the access token
            const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
            });
            
            if (!userInfoResponse.ok) {
              throw new Error('Failed to fetch user info');
            }

            const userInfo = await userInfoResponse.json();
            
            const googleUser: GoogleUser = {
              id: userInfo.sub || '',
              email: userInfo.email || '',
              name: userInfo.name || '',
              givenName: userInfo.given_name,
              familyName: userInfo.family_name,
              imageUrl: userInfo.picture,
              authentication: {
                accessToken: tokenResponse.access_token,
                idToken: undefined,
                refreshToken: undefined,
              },
            };

            setUser(googleUser);
            localStorage.setItem('google_user', JSON.stringify(googleUser));
            
            window.dispatchEvent(new CustomEvent('googleAuthChanged', { 
              detail: { user: googleUser, signedIn: true } 
            }));

            resolve(googleUser);
          } catch (error) {
            reject(error);
          }
        },
        error_callback: (error: any) => {
          if (error.type === 'popup_closed') {
            resolve(null); // User closed popup
          } else {
            reject(new Error(error.message || 'OAuth error'));
          }
        },
      });

      // Request access token - this opens a popup, no redirect needed
      tokenClient.requestAccessToken({ prompt: 'select_account' });
    });
  }, []);

  // Native sign-in using Capgo plugin
  const signInNative = useCallback(async (): Promise<GoogleUser | null> => {
    console.log('[GoogleAuth] Starting native sign-in...');
    
    try {
      const response = await SocialLogin.login({
        provider: 'google',
        options: {
          scopes: SCOPES,
        },
      });

      console.log('[GoogleAuth] Login response received:', JSON.stringify(response, null, 2));

      if (!response) {
        console.error('[GoogleAuth] No response from SocialLogin.login()');
        throw new Error('Sign in failed - no response');
      }

      if (response.provider !== 'google') {
        console.error('[GoogleAuth] Wrong provider in response:', response.provider);
        throw new Error('Sign in failed - wrong provider');
      }

      const result = response.result as GoogleLoginResponseOnline;
      
      console.log('[GoogleAuth] Response type:', result?.responseType);
      console.log('[GoogleAuth] Profile:', JSON.stringify(result?.profile, null, 2));
      console.log('[GoogleAuth] Has accessToken:', !!result?.accessToken);
      console.log('[GoogleAuth] Has idToken:', !!result?.idToken);

      // Handle both online and offline response types
      if (!result || (result.responseType !== 'online' && result.responseType !== 'offline')) {
        console.error('[GoogleAuth] Unexpected response type:', result?.responseType);
        // Try to extract data anyway
      }

      const googleUser: GoogleUser = {
        id: result?.profile?.id || '',
        email: result?.profile?.email || '',
        name: result?.profile?.name || '',
        givenName: result?.profile?.givenName || undefined,
        familyName: result?.profile?.familyName || undefined,
        imageUrl: result?.profile?.imageUrl || undefined,
        authentication: {
          accessToken: result?.accessToken?.token || '',
          idToken: result?.idToken || undefined,
          refreshToken: undefined,
        },
      };

      console.log('[GoogleAuth] Created user object:', JSON.stringify(googleUser, null, 2));

      if (!googleUser.email) {
        console.error('[GoogleAuth] No email in response - sign-in may have failed');
        throw new Error('Sign in failed - no email received');
      }

      setUser(googleUser);
      localStorage.setItem('google_user', JSON.stringify(googleUser));
      
      window.dispatchEvent(new CustomEvent('googleAuthChanged', { 
        detail: { user: googleUser, signedIn: true } 
      }));

      console.log('[GoogleAuth] Sign-in successful for:', googleUser.email);
      return googleUser;
    } catch (error: any) {
      console.error('[GoogleAuth] Native sign-in error:', error);
      console.error('[GoogleAuth] Error message:', error?.message);
      console.error('[GoogleAuth] Error code:', error?.code);
      console.error('[GoogleAuth] Full error:', JSON.stringify(error, null, 2));
      throw error;
    }
  }, []);

  const signIn = useCallback(async (): Promise<GoogleUser | null> => {
    try {
      setIsLoading(true);
      console.log('[GoogleAuth] signIn called, platform:', platform);
      
      if (platform === 'web') {
        console.log('[GoogleAuth] Using web sign-in');
        return await signInWeb();
      } else {
        console.log('[GoogleAuth] Using native sign-in');
        return await signInNative();
      }
    } catch (error: any) {
      console.error('[GoogleAuth] Google sign in error:', error);
      console.error('[GoogleAuth] Error details:', JSON.stringify(error, null, 2));
      
      // Check for specific error codes
      if (error?.code === 10 || error?.message?.includes('10:')) {
        console.error('[GoogleAuth] ERROR 10: Developer console is not set up correctly!');
        console.error('[GoogleAuth] Please verify:');
        console.error('[GoogleAuth] 1. SHA-1 fingerprint from your RELEASE keystore is added to Android OAuth client');
        console.error('[GoogleAuth] 2. Package name is exactly: nota.npd.com');
        console.error('[GoogleAuth] 3. Web Client ID is correct in both capacitor.config.ts and strings.xml');
      }
      
      if (error?.code === 16 || error?.message?.includes('16:')) {
        console.error('[GoogleAuth] ERROR 16: Account reauth failed');
        console.error('[GoogleAuth] Try clearing app data or signing out of Google on device');
      }
      
      if (error?.message?.includes('canceled') || error?.message?.includes('cancelled') || error?.message?.includes('popup_closed')) {
        console.log('[GoogleAuth] User cancelled sign-in');
        return null;
      }
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [platform, signInWeb, signInNative]);

  const signOut = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      
      if (platform === 'web' && window.google?.accounts && user?.email) {
        window.google.accounts.id.disableAutoSelect();
        window.google.accounts.id.revoke(user.email, () => {
          console.log('Google session revoked');
        });
      } else if (platform !== 'web') {
        await SocialLogin.logout({ provider: 'google' });
      }
      
      setUser(null);
      localStorage.removeItem('google_user');
      
      window.dispatchEvent(new CustomEvent('googleAuthChanged', { 
        detail: { user: null, signedIn: false } 
      }));
    } catch (error) {
      console.error('Google sign out error:', error);
      setUser(null);
      localStorage.removeItem('google_user');
    } finally {
      setIsLoading(false);
    }
  }, [platform, user]);

  const refreshToken = useCallback(async (): Promise<string | null> => {
    // For web, we need to re-authenticate as GIS doesn't provide refresh tokens
    // For native, try to get a new authorization code
    if (platform !== 'web') {
      try {
        const response = await SocialLogin.getAuthorizationCode({ provider: 'google' });
        if (response?.jwt && user) {
          const updatedUser = {
            ...user,
            authentication: { ...user.authentication, accessToken: response.jwt },
          };
          setUser(updatedUser);
          localStorage.setItem('google_user', JSON.stringify(updatedUser));
          return response.jwt;
        }
      } catch (error) {
        console.error('Token refresh failed:', error);
        await signOut();
      }
    }
    return null;
  }, [platform, user, signOut]);

  const getAccessToken = useCallback((): string | null => {
    return user?.authentication?.accessToken || null;
  }, [user]);

  const value: GoogleAuthContextType = {
    user,
    isLoading,
    isSignedIn: !!user,
    signIn,
    signOut,
    refreshToken,
    getAccessToken,
  };

  return (
    <GoogleAuthContext.Provider value={value}>
      {children}
    </GoogleAuthContext.Provider>
  );
};
