export interface RateLimitOptions {
    interval: number;
    uniqueTokenPerInterval: number;
}

export function rateLimit(options: RateLimitOptions) {
    const tokens = new Map<string, number[]>();

    return {
        check: (limit: number, token: string) => {
            const now = Date.now();
            const windowStart = now - options.interval;

            if (!tokens.has(token)) {
                tokens.set(token, []);
            }

            const tokenTimestamps = tokens.get(token)!;

            // Remove timestamps outside the current window
            const validTimestamps = tokenTimestamps.filter(ts => ts > windowStart);
            tokens.set(token, validTimestamps);

            if (validTimestamps.length >= limit) {
                return true; // Rate limited
            }

            validTimestamps.push(now);
            return false; // Not rate limited
        }
    };
}