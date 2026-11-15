import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  const profile = process.env.EAS_BUILD_PROFILE || process.env.APP_ENV || 'development';
  const isDev = profile === 'development' || !profile;

  const appIdentifier = process.env.APP_IDENTIFIER || (isDev ? 'com.publishiq.mobile.dev' : undefined);
  if (!appIdentifier) {
    throw new Error(
      `[Config Error] APP_IDENTIFIER environment variable is required for '${profile}' builds.`
    );
  }

  const rawApiBaseUrl = process.env.API_BASE_URL;
  if (!rawApiBaseUrl) {
    if (!isDev) {
      throw new Error(`[Config Error] API_BASE_URL is required for non-development builds.`);
    }
  } else if (!isDev && !rawApiBaseUrl.startsWith('https://')) {
    throw new Error(`[Config Error] API_BASE_URL must use https:// in non-development builds. Received: ${rawApiBaseUrl}`);
  }

  const apiBaseUrl = rawApiBaseUrl || 'http://localhost:4000/api/v1';

  return {
    ...config,
    name: 'PublishIQ',
    slug: 'publishiq',
    version: '1.0.0',
    scheme: 'publishiq',
    orientation: 'portrait',
    userInterfaceStyle: 'dark',
    icon: './assets/images/icon.png',
    ios: {
      bundleIdentifier: appIdentifier,
      supportsTablet: false,
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      package: appIdentifier,
      allowBackup: false,
      adaptiveIcon: {
        backgroundColor: '#0a0a0c',
        foregroundImage: './assets/images/android-icon-foreground.png',
        backgroundImage: './assets/images/android-icon-background.png',
      },
    },
    plugins: [
      'expo-router',
      'expo-secure-store',
      'expo-web-browser',
      'expo-font',
      'expo-image-picker',
      'expo-video',
      [
        'expo-splash-screen',
        {
          backgroundColor: '#0a0a0c',
          image: './assets/images/splash-icon.png',
          imageWidth: 80,
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      apiBaseUrl,
      eas: {
        projectId: process.env.EAS_PROJECT_ID,
      },
    },
  };
};
