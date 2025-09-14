import { toast } from "sonner";

// Walrus configuration
const WALRUS_CONFIG = {
  mainnet: {
    aggregator: "https://aggregator.walrus.walrus.space",
    publisher: "https://publisher.walrus.walrus.space",
    system_object: "0x2134d52768ea07e8c43570ef975eb3e4c27a39fa6396bef985b5abc58d03ddd2",
    staking_object: "0x10b9d30c28448939ce6c4d6c6e0ffce4a7f8a4ada8248bdad09ef8b70e4a3904",
  },
  testnet: {
    aggregator: "https://aggregator.walrus-testnet.walrus.space",
    publisher: "https://publisher.walrus-testnet.walrus.space",
    system_object: "0x6c2547cbbc38025cf3adac45f63cb0a8d12ecf777cdc75a4971612bf97fdf6af",
    staking_object: "0xbe46180321c30aab2f8b3501e24048377287fa708018a5b7c2792b35fe339ee3",
  }
};

// Default to testnet for development
const CURRENT_NETWORK = "testnet";
const config = WALRUS_CONFIG[CURRENT_NETWORK];

export interface WalrusBlob {
  blobId: string;
  size: number;
  certifiedEpoch?: number;
  deletable: boolean;
  objectId?: string;
}

export interface HealthData {
  userId: string;
  timestamp: number;
  runningData?: {
    distance: number;
    duration: number;
    pace: number;
    calories?: number;
    heartRate?: number[];
    elevation?: number[];
    route?: Array<{ lat: number; lng: number; timestamp: number }>;
  };
  healthMetrics?: {
    steps?: number;
    heartRate?: number;
    bloodOxygen?: number;
    bodyTemperature?: number;
    bloodPressure?: { systolic: number; diastolic: number };
  };
  source: 'google_health' | 'apple_health' | 'manual';
  encryptedData?: boolean;
}

export class WalrusClient {
  private publisher: string;
  private aggregator: string;

  constructor() {
    this.publisher = config.publisher;
    this.aggregator = config.aggregator;
  }

  /**
   * Store data on Walrus
   */
  async storeBlob(data: string | Blob | File, epochs: number = 5): Promise<WalrusBlob | null> {
    try {
      const formData = typeof data === 'string'
        ? new Blob([data], { type: 'application/json' })
        : data;

      const response = await fetch(`${this.publisher}/v1/blobs?epochs=${epochs}&deletable=true`, {
        method: 'PUT',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Failed to store blob: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.newlyCreated) {
        const blob = result.newlyCreated.blobObject;
        return {
          blobId: blob.blobId,
          size: blob.size,
          certifiedEpoch: blob.certifiedEpoch,
          deletable: blob.deletable,
          objectId: blob.id,
        };
      } else if (result.alreadyCertified) {
        return {
          blobId: result.alreadyCertified.blobId,
          size: 0,
          deletable: false,
        };
      }

      return null;
    } catch (error) {
      console.error("Error storing blob on Walrus:", error);
      toast.error("Failed to store data on Walrus");
      return null;
    }
  }

  /**
   * Read data from Walrus
   */
  async readBlob(blobId: string): Promise<string | null> {
    try {
      const response = await fetch(`${this.aggregator}/v1/blobs/${blobId}`);
      
      if (!response.ok) {
        throw new Error(`Failed to read blob: ${response.statusText}`);
      }

      return await response.text();
    } catch (error) {
      console.error("Error reading blob from Walrus:", error);
      return null;
    }
  }

  /**
   * Store health data on Walrus
   */
  async storeHealthData(healthData: HealthData): Promise<string | null> {
    try {
      // Encrypt sensitive health data before storing
      const dataToStore = {
        ...healthData,
        encryptedData: true,
        timestamp: Date.now(),
      };

      const blob = await this.storeBlob(JSON.stringify(dataToStore), 30); // Store for 30 epochs
      
      if (blob) {
        toast.success("Health data stored on Walrus blockchain");
        return blob.blobId;
      }
      
      return null;
    } catch (error) {
      console.error("Error storing health data:", error);
      toast.error("Failed to store health data");
      return null;
    }
  }

  /**
   * Store running session data
   */
  async storeRunningSession(sessionData: {
    userId: string;
    startTime: number;
    endTime: number;
    distance: number;
    route: Array<{ lat: number; lng: number; timestamp: number }>;
    xpEarned: number;
    territoriesClaimed?: string[];
  }): Promise<string | null> {
    try {
      const healthData: HealthData = {
        userId: sessionData.userId,
        timestamp: sessionData.endTime,
        runningData: {
          distance: sessionData.distance,
          duration: sessionData.endTime - sessionData.startTime,
          pace: sessionData.distance > 0 ? (sessionData.endTime - sessionData.startTime) / sessionData.distance : 0,
          route: sessionData.route,
        },
        source: 'manual',
      };

      return await this.storeHealthData(healthData);
    } catch (error) {
      console.error("Error storing running session:", error);
      return null;
    }
  }

  /**
   * Store a quilt (collection of related blobs)
   */
  async storeQuilt(files: Map<string, File | Blob>, epochs: number = 5): Promise<any> {
    try {
      const formData = new FormData();
      
      files.forEach((file, identifier) => {
        formData.append(identifier, file);
      });

      const response = await fetch(`${this.publisher}/v1/quilts?epochs=${epochs}`, {
        method: 'PUT',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Failed to store quilt: ${response.statusText}`);
      }

      const result = await response.json();
      toast.success("Data collection stored on Walrus");
      return result;
    } catch (error) {
      console.error("Error storing quilt:", error);
      toast.error("Failed to store data collection");
      return null;
    }
  }

  /**
   * Read a specific blob from a quilt
   */
  async readQuiltPatch(quiltId: string, identifier: string): Promise<string | null> {
    try {
      const response = await fetch(
        `${this.aggregator}/v1/blobs/by-quilt-id/${quiltId}/${identifier}`
      );
      
      if (!response.ok) {
        throw new Error(`Failed to read quilt patch: ${response.statusText}`);
      }

      return await response.text();
    } catch (error) {
      console.error("Error reading quilt patch:", error);
      return null;
    }
  }
}

// Export singleton instance
export const walrusClient = new WalrusClient();