import { request } from 'undici';
import { config } from '../config.js';
import { logger } from './logger.js';

export interface PredictRequest {
  centerId: string;
  vehicleType: string;
  arrivalTime: string; // ISO
  laneCount: number;
  capacityPerHour: number;
  queueLength: number;
  activeLanes: number;
}

export interface PredictResponse {
  predictedWaitMinutes: number;
  lowerBoundMinutes: number;
  upperBoundMinutes: number;
  confidence: number;
  modelVersion: string;
}

// Heuristic fallback used when predictor service is unreachable.
// Based on observed patterns: Monday and end-of-month spikes,
// after-Tet (Feb) backlog, late afternoon dip.
function heuristicPredict(input: PredictRequest): PredictResponse {
  const t = new Date(input.arrivalTime);
  const hour = t.getHours();
  const dow = t.getDay(); // 0=Sun
  const dom = t.getDate();
  const month = t.getMonth() + 1;

  let base = 45; // baseline minutes

  // Hour effect: 8-10am peaks, 12-1pm dip, 3-5pm secondary peak
  if (hour >= 8 && hour < 10) base += 60;
  else if (hour >= 10 && hour < 12) base += 30;
  else if (hour >= 12 && hour < 13) base -= 15;
  else if (hour >= 13 && hour < 16) base += 20;
  else if (hour >= 16) base += 35;

  // Day of week: Mon worst, Fri next, weekends closed mostly
  if (dow === 1) base += 35;
  else if (dow === 5) base += 20;
  else if (dow === 0 || dow === 6) base = Math.max(15, base - 20);

  // End of month
  if (dom >= 25) base += 30;

  // Post-Tet backlog (mid-Feb to mid-Mar typical)
  if (month === 2 || month === 3) base += 25;

  // Queue effect
  const perCarMinutes = 60 / Math.max(1, input.capacityPerHour);
  base += input.queueLength * perCarMinutes * 0.6;

  // Active lanes adjustment
  if (input.activeLanes > 0 && input.activeLanes < input.laneCount) {
    base *= input.laneCount / input.activeLanes;
  }

  const predicted = Math.max(10, Math.round(base));
  const spread = Math.max(15, Math.round(predicted * 0.35));
  return {
    predictedWaitMinutes: predicted,
    lowerBoundMinutes: Math.max(5, predicted - spread),
    upperBoundMinutes: predicted + spread,
    confidence: 0.55,
    modelVersion: 'heuristic-v1',
  };
}

export async function predictWaitTime(input: PredictRequest): Promise<PredictResponse> {
  try {
    const res = await request(`${config.PREDICTOR_URL}/predict`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
      bodyTimeout: config.PREDICTOR_TIMEOUT_MS,
      headersTimeout: config.PREDICTOR_TIMEOUT_MS,
    });
    if (res.statusCode >= 400) {
      throw new Error(`Predictor returned ${res.statusCode}`);
    }
    return (await res.body.json()) as PredictResponse;
  } catch (err) {
    logger.warn({ err }, 'Predictor service unavailable; falling back to heuristic');
    return heuristicPredict(input);
  }
}
