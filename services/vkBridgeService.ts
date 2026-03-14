// VK Bridge is loaded via CDN and available as a global
declare const vkBridge: {
  send(method: string, params?: Record<string, unknown>): Promise<Record<string, unknown>>;
};

let _initialized = false;

export async function initVKBridge(): Promise<boolean> {
  if (_initialized) return true;
  try {
    if (typeof vkBridge === 'undefined') return false;
    const data = await vkBridge.send('VKWebAppInit') as { result: boolean };
    _initialized = !!data.result;
    return _initialized;
  } catch (e) {
    console.error('Failed to init VK Bridge:', e);
    return false;
  }
}

export function isVKBridgeReady(): boolean {
  return _initialized;
}

export async function storageGet(keys: string[]): Promise<Record<string, string>> {
  try {
    const data = await vkBridge.send('VKWebAppStorageGet', { keys }) as {
      keys: Array<{ key: string; value: string }>;
    };
    const result: Record<string, string> = {};
    if (data.keys) {
      for (const entry of data.keys) {
        result[entry.key] = entry.value;
      }
    }
    return result;
  } catch (e) {
    console.error('VK storage get failed:', JSON.stringify(e));
    return {};
  }
}

export async function storageSet(key: string, value: string): Promise<void> {
  try {
    await vkBridge.send('VKWebAppStorageSet', { key, value });
  } catch (e) {
    console.error(`VK storage set failed for key "${key}":`, JSON.stringify(e));
  }
}

export async function showInterstitialAd(): Promise<void> {
  try {
    const check = await vkBridge.send('VKWebAppCheckNativeAds', { ad_format: 'interstitial' }) as { result: boolean };
    if (!check.result) return;
    await vkBridge.send('VKWebAppShowNativeAds', { ad_format: 'interstitial' });
  } catch (e) {
    console.log('VK interstitial ad not shown:', JSON.stringify(e));
  }
}
