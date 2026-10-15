# September Fit Engine V1

Deterministic and explainable sizing engine for the first September Fit release.

## V1 principle

V1 is a **rules engine**, not machine learning. The ranges in `src/config.ts` are initial product heuristics, not universal clothing standards. They are explicit and versioned so they can be calibrated later from real customer feedback.

Do not market a result such as `91/100` as "91% accuracy". It is a Fit Score.

## Supported categories

- JACKET
- HOODIE
- SHIRT
- TSHIRT
- PANTS
- JEANS

## Core measurements

V1 deliberately does **not** pretend that height + weight alone can reliably determine fit.

- Upper body: `chestCm` is required.
- Pants / jeans: `waistCm` is required.
- Other measurements improve coverage and confidence.

## Formula

Flat garment widths are converted to circumference:

```text
garment circumference = flat width × 2

effective ease =
  garment circumference
  - body circumference
  + stretch allowance
```

Linear measurements use:

```text
delta = garment measurement - body measurement
```

Each metric is scored against four boundaries:

```text
hardMin → optimalMin → optimalMax → hardMax
   0         100           100         0
```

Inside the optimal range the metric scores 100. Outside it the score decreases linearly to 0 at the hard boundary.

## Category weights

Example jacket:

```text
Chest    45%
Shoulder 30%
Sleeve   25%
```

If an optional metric is missing, the visible Fit Score is normalized across available metrics, while missing data reduces Confidence.

## Labels

```text
90–100 EXCELLENT
80–89  GOOD
70–79  POSSIBLE
60–69  NOT_IDEAL
<60    NOT_RECOMMENDED
```

## Confidence

Confidence is separate from Fit Score.

Garment quality factors:

```text
BASIC     0.55
STANDARD  0.80
VERIFIED  1.00
```

So a result may legitimately be:

```text
Fit Score: 95
Confidence: LOW
```

## Stretch V1

Conservative circumference allowance:

```text
NONE     0 cm
LOW      1 cm
MEDIUM   2.5 cm
HIGH     4.5 cm
```

This is a tuning parameter, not a universal fabric law. Later it should use measured fabric stretch, composition, category, brand and actual feedback.

## Engine version

Current:

```text
rules-1.0.0
```

Any scoring-behavior change must produce a new engine version.

## Example

```ts
import { calculateFit } from "@september-fit/fit-engine";

const result = calculateFit(
  {
    preferredFit: "REGULAR",
    chestCm: 98,
    shoulderCm: 44,
    sleeveCm: 62,
  },
  {
    category: "JACKET",
    quality: "VERIFIED",
    stretchLevel: "NONE",
    chestWidthCm: 54,
    shoulderWidthCm: 46,
    sleeveLengthCm: 64,
  }
);
```

## Calibration plan

Once real orders generate feedback, compare:

```text
profile
+ garment measurements
+ engine result
+ TOO_SMALL / PERFECT / TOO_LARGE
+ problem areas
```

Tune one category at a time instead of applying a global change to every garment type.

## Run

```bash
npm install
npm run build
npm test
```

## Next step

Integrate `calculateFit()` into the NestJS endpoint:

```text
POST /v1/fit/calculate
```

and persist:
- engineVersion
- inputSnapshot
- fitScore
- confidence
- metric details
