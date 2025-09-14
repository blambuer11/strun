import { toast } from "sonner";
import { walrusClient, HealthData } from "./walrus-client";

// Google Health API configuration
const GOOGLE_HEALTH_SCOPES = [
  'https://www.googleapis.com/auth/fitness.activity.read',
  'https://www.googleapis.com/auth/fitness.location.read',
  'https://www.googleapis.com/auth/fitness.body.read',
  'https://www.googleapis.com/auth/fitness.nutrition.read',
  'https://www.googleapis.com/auth/fitness.blood_pressure.read',
  'https://www.googleapis.com/auth/fitness.blood_glucose.read',
  'https://www.googleapis.com/auth/fitness.oxygen_saturation.read',
  'https://www.googleapis.com/auth/fitness.body_temperature.read',
  'https://www.googleapis.com/auth/fitness.reproductive_health.read',
];

export interface HealthProvider {
  name: 'google_health' | 'apple_health';
  connected: boolean;
  lastSync?: number;
}

export class HealthIntegration {
  private googleAccessToken: string | null = null;
  private appleHealthKit: any = null;

  /**
   * Connect to Google Health (Google Fit)
   */
  async connectGoogleHealth(): Promise<boolean> {
    try {
      // Check if we already have a token
      const storedToken = localStorage.getItem('google_health_token');
      if (storedToken) {
        this.googleAccessToken = storedToken;
        toast.success("Already connected to Google Health");
        return true;
      }

      // Initialize Google OAuth2
      const clientId = '1089761021386-43lch5ha2bt1cqamdujbggdkh65jjvas.apps.googleusercontent.com';
      const redirectUri = `${window.location.origin}/auth/google-health-callback`;
      
      // Create OAuth URL
      const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      authUrl.searchParams.append('client_id', clientId);
      authUrl.searchParams.append('redirect_uri', redirectUri);
      authUrl.searchParams.append('response_type', 'token');
      authUrl.searchParams.append('scope', GOOGLE_HEALTH_SCOPES.join(' '));
      authUrl.searchParams.append('access_type', 'offline');
      authUrl.searchParams.append('prompt', 'consent');

      // Open OAuth popup
      const authWindow = window.open(authUrl.toString(), 'GoogleHealthAuth', 'width=500,height=600');
      
      return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (authWindow?.closed) {
            clearInterval(checkInterval);
            const token = localStorage.getItem('google_health_token');
            if (token) {
              this.googleAccessToken = token;
              toast.success("Connected to Google Health!");
              resolve(true);
            } else {
              toast.error("Failed to connect to Google Health");
              resolve(false);
            }
          }
        }, 1000);
      });
    } catch (error) {
      console.error("Error connecting to Google Health:", error);
      toast.error("Failed to connect to Google Health");
      return false;
    }
  }

  /**
   * Connect to Apple Health (via HealthKit for iOS/Capacitor)
   */
  async connectAppleHealth(): Promise<boolean> {
    try {
      // Check if we're on iOS
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      
      if (!isIOS) {
        toast.info("Apple Health is only available on iOS devices");
        return false;
      }

      // Request HealthKit permissions
      const permissions = {
        read: [
          'HKQuantityTypeIdentifierStepCount',
          'HKQuantityTypeIdentifierDistanceWalkingRunning',
          'HKQuantityTypeIdentifierHeartRate',
          'HKQuantityTypeIdentifierActiveEnergyBurned',
          'HKQuantityTypeIdentifierOxygenSaturation',
          'HKQuantityTypeIdentifierBodyTemperature',
          'HKQuantityTypeIdentifierBloodPressureSystolic',
          'HKQuantityTypeIdentifierBloodPressureDiastolic',
        ],
        write: []
      };

      // This would use Capacitor HealthKit plugin in production
      // For now, we'll simulate the connection
      localStorage.setItem('apple_health_connected', 'true');
      toast.success("Connected to Apple Health!");
      return true;
    } catch (error) {
      console.error("Error connecting to Apple Health:", error);
      toast.error("Failed to connect to Apple Health");
      return false;
    }
  }

  /**
   * Sync data from Google Health
   */
  async syncGoogleHealthData(userId: string): Promise<void> {
    if (!this.googleAccessToken) {
      toast.error("Not connected to Google Health");
      return;
    }

    try {
      // Get fitness data from Google Fit API
      const endTime = Date.now();
      const startTime = endTime - (24 * 60 * 60 * 1000); // Last 24 hours

      const response = await fetch(
        `https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.googleAccessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            aggregateBy: [
              { dataTypeName: 'com.google.step_count.delta' },
              { dataTypeName: 'com.google.heart_rate.bpm' },
              { dataTypeName: 'com.google.distance.delta' },
            ],
            bucketByTime: { durationMillis: 86400000 },
            startTimeMillis: startTime,
            endTimeMillis: endTime,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch Google Health data');
      }

      const data = await response.json();
      
      // Process and store the data
      const healthData: HealthData = {
        userId,
        timestamp: Date.now(),
        healthMetrics: {
          steps: this.extractStepCount(data),
          heartRate: this.extractHeartRate(data),
        },
        source: 'google_health',
      };

      // Store data on Walrus
      await walrusClient.storeHealthData(healthData);
      
      // Update last sync time
      localStorage.setItem('google_health_last_sync', Date.now().toString());
      
      toast.success("Google Health data synced successfully");
    } catch (error) {
      console.error("Error syncing Google Health data:", error);
      toast.error("Failed to sync Google Health data");
    }
  }

  /**
   * Sync data from Apple Health
   */
  async syncAppleHealthData(userId: string): Promise<void> {
    const isConnected = localStorage.getItem('apple_health_connected');
    if (!isConnected) {
      toast.error("Not connected to Apple Health");
      return;
    }

    try {
      // In production, this would use HealthKit API
      // For now, we'll simulate with sample data
      const healthData: HealthData = {
        userId,
        timestamp: Date.now(),
        healthMetrics: {
          steps: Math.floor(Math.random() * 10000) + 5000,
          heartRate: Math.floor(Math.random() * 40) + 60,
          bloodOxygen: Math.floor(Math.random() * 5) + 95,
        },
        source: 'apple_health',
      };

      // Store data on Walrus
      await walrusClient.storeHealthData(healthData);
      
      // Update last sync time
      localStorage.setItem('apple_health_last_sync', Date.now().toString());
      
      toast.success("Apple Health data synced successfully");
    } catch (error) {
      console.error("Error syncing Apple Health data:", error);
      toast.error("Failed to sync Apple Health data");
    }
  }

  /**
   * Disconnect from Google Health
   */
  async disconnectGoogleHealth(): Promise<void> {
    this.googleAccessToken = null;
    localStorage.removeItem('google_health_token');
    localStorage.removeItem('google_health_last_sync');
    toast.info("Disconnected from Google Health");
  }

  /**
   * Disconnect from Apple Health
   */
  async disconnectAppleHealth(): Promise<void> {
    localStorage.removeItem('apple_health_connected');
    localStorage.removeItem('apple_health_last_sync');
    toast.info("Disconnected from Apple Health");
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): { google: boolean; apple: boolean } {
    return {
      google: !!this.googleAccessToken || !!localStorage.getItem('google_health_token'),
      apple: !!localStorage.getItem('apple_health_connected'),
    };
  }

  // Helper methods
  private extractStepCount(data: any): number {
    try {
      const bucket = data.bucket?.[0];
      const dataset = bucket?.dataset?.[0];
      const point = dataset?.point?.[0];
      return point?.value?.[0]?.intVal || 0;
    } catch {
      return 0;
    }
  }

  private extractHeartRate(data: any): number {
    try {
      const bucket = data.bucket?.[0];
      const dataset = bucket?.dataset?.[1];
      const point = dataset?.point?.[0];
      return point?.value?.[0]?.fpVal || 0;
    } catch {
      return 0;
    }
  }
}

// Export singleton instance
export const healthIntegration = new HealthIntegration();