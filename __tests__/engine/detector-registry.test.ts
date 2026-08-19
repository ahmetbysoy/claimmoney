import { describe, it, expect, beforeEach } from 'vitest';
import { DetectorRegistry, createMeanReversionDetector, createMomentumDetector } from '@/lib/engine/detector-registry';
import type { DetectorConfig, Signal } from '@/lib/engine/types';

describe('DetectorRegistry', () => {
  let registry: DetectorRegistry;

  beforeEach(() => {
    registry = new DetectorRegistry();
  });

  it('should register and run detectors', () => {
    const config: DetectorConfig = { name: 'test', version: '1.0.0', params: {}, enabled: true };
    registry.register(config, () => [{
      id: 's1', ts: 1000, detector: 'test', symbol: 'BTC', side: 'long',
      confidence: 0.8, regime: 'trending_up', metadata: {},
    } as Signal]);
    const results = registry.runAll({});
    expect(results.length).toBe(1);
    expect(results[0].signals.length).toBe(1);
    expect(results[0].detector).toBe('test');
  });

  it('should run all built-in detectors', () => {
    const mr = createMeanReversionDetector();
    registry.register(mr.config, mr.fn);
    const mom = createMomentumDetector();
    registry.register(mom.config, mom.fn);
    expect(registry.getDetectors().length).toBe(2);
  });

  it('should enable and disable detectors', () => {
    const config: DetectorConfig = { name: 'test', version: '1.0.0', params: {}, enabled: true };
    registry.register(config, () => []);
    registry.disable('test');
    expect(registry.getDetectors()[0].enabled).toBe(false);
    registry.enable('test');
    expect(registry.getDetectors()[0].enabled).toBe(true);
  });
});
