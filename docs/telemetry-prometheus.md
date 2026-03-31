# Telemetry & Prometheus Integration

## Overview

The VS Code extension sends lightweight telemetry events to the ABAPer API backend. The backend aggregates these into Prometheus metrics, which are scraped into the existing Prometheus/Grafana stack.

## Architecture

```
VS Code Extension                    Backend                         Prometheus
┌──────────────┐    POST /v1/telemetry    ┌──────────────┐    GET /metrics    ┌────────────┐
│ TelemetryClient│ ──────────────────────> │ abaper-ts or │ <──────────────── │ Prometheus │
│              │                          │ abaper-bff   │                    │            │
└──────────────┘                          └──────────────┘                    └────────────┘
                                                │                                   │
                                                │ increments counters                │
                                                │ & histograms                       ▼
                                                │                            ┌────────────┐
                                                └───────────────────────────>│  Grafana   │
                                                                             └────────────┘
```

## Events Tracked

| Event | When | Properties |
|-------|------|------------|
| `extension_activated` | Extension starts | platform, locale, version |
| `login_started` | User runs Login command | — |
| `login_completed` | Login flow finishes | `success: bool` |
| `logout` | User logs out | — |
| `signup_opened` | User runs Sign Up command | — |
| `chat_opened` | User opens chat panel | — |

## Payload Format

```json
{
  "event": "login_completed",
  "properties": {
    "success": true,
    "extension_version": "1.0.0",
    "vscode_version": "1.96.0",
    "platform": "darwin",
    "locale": "en"
  }
}
```

- **Authenticated users**: Bearer token is included, so the backend can resolve user identity.
- **Unauthenticated users**: Events like `extension_activated` and `signup_opened` are sent without a token. The backend can still extract IP-based geo and assign an anonymous session.

## Backend: Suggested Prometheus Metrics

### Counters

```
# Total events by type
abaper_vscode_events_total{event="extension_activated", platform="darwin", locale="en"}

# Login funnel
abaper_vscode_logins_total{status="started"}
abaper_vscode_logins_total{status="success"}
abaper_vscode_logins_total{status="failure"}

# Signups opened from extension
abaper_vscode_signups_total
```

### Endpoint Implementation (Express example)

```typescript
import { Counter } from 'prom-client';

const vscodeEvents = new Counter({
  name: 'abaper_vscode_events_total',
  help: 'VS Code extension telemetry events',
  labelNames: ['event', 'platform', 'locale'],
});

app.post('/v1/telemetry', (req, res) => {
  const { event, properties } = req.body;
  vscodeEvents.inc({
    event,
    platform: properties?.platform ?? 'unknown',
    locale: properties?.locale ?? 'unknown',
  });
  res.status(204).end();
});
```

## Metrics & Questions Answered

| Question | Metric / Source |
|----------|----------------|
| Who installed the extension? | `extension_activated` events + VS Code Marketplace dashboard |
| Did they face issues? | `login_completed{status="failure"}` + future error events |
| Geo locations? | IP-based geo resolved server-side on `/v1/telemetry`, or `locale` property |
| Did installs convert to logins? | Funnel: `extension_activated` → `login_started` → `login_completed{status="success"}` |
| Signup conversions from extension? | `signup_opened` event + GA on bluefunda.com/signup filtered by `utm_source=vscode-extension` |

## Grafana Dashboard Ideas

1. **Install → Login Funnel**: Bar chart of `extension_activated` vs `login_started` vs `login_completed{success=true}`
2. **Daily Active Extensions**: Time series of `extension_activated` per day
3. **Platform Distribution**: Pie chart by `platform` label
4. **Login Failure Rate**: `login_completed{success=false}` / `login_completed` total
5. **Geo Heatmap**: If IP-based geo is resolved server-side

## UTM Tracking (Google Analytics)

Login and signup commands include UTM parameters:

- **Login**: `https://bluefunda.com/login?redirect_uri=...&utm_source=vscode-extension&utm_medium=command&utm_campaign=login`
- **Signup**: `https://bluefunda.com/signup?utm_source=vscode-extension&utm_medium=command&utm_campaign=signup`

These allow GA to attribute pageviews and conversions to the VS Code extension specifically.
