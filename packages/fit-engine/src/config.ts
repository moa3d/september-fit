import type { CategoryRuleSet, FitPreference, MetricRule, ScoreRange, StretchLevel } from "./types.js";
const range=(optimalMin:number,optimalMax:number,hardMin:number,hardMax:number):ScoreRange=>({optimalMin,optimalMax,hardMin,hardMax});

const upperChest:Record<FitPreference,ScoreRange>={
  SLIM:range(4,8,-1,14), REGULAR:range(8,14,2,22), LOOSE:range(14,24,6,34)
};
const upperShoulder:Record<FitPreference,ScoreRange>={
  SLIM:range(0,1.5,-1.5,3), REGULAR:range(1,3.5,-0.5,5.5), LOOSE:range(3,6,0,9)
};
const sleeve:Record<FitPreference,ScoreRange>={
  SLIM:range(-0.5,1.5,-3,4), REGULAR:range(0,2.5,-2.5,5), LOOSE:range(0.5,4,-2,7)
};
const waist:Record<FitPreference,ScoreRange>={
  SLIM:range(-1,2,-5,6), REGULAR:range(1,5,-3,10), LOOSE:range(4,9,0,15)
};
const hips:Record<FitPreference,ScoreRange>={
  SLIM:range(1,5,-3,9), REGULAR:range(4,9,0,14), LOOSE:range(8,14,3,20)
};
const thigh:Record<FitPreference,ScoreRange>={
  SLIM:range(1,4,-2,8), REGULAR:range(3,7,-1,12), LOOSE:range(6,12,1,18)
};
const inseam:Record<FitPreference,ScoreRange>={
  SLIM:range(-1,1,-4,4), REGULAR:range(-1,1.5,-4,4.5), LOOSE:range(-1.5,2,-5,5)
};

const upperMetrics=(chestWeight:number,shoulderWeight:number,sleeveWeight:number):MetricRule[]=>[
  {key:"chestEase",weight:chestWeight,source:"CIRCUMFERENCE",profileField:"chestCm",garmentField:"chestWidthCm",ranges:upperChest,required:true},
  {key:"shoulderDelta",weight:shoulderWeight,source:"LINEAR",profileField:"shoulderCm",garmentField:"shoulderWidthCm",ranges:upperShoulder},
  {key:"sleeveDelta",weight:sleeveWeight,source:"LINEAR",profileField:"sleeveCm",garmentField:"sleeveLengthCm",ranges:sleeve},
];

export const CATEGORY_RULES:Record<string,CategoryRuleSet>={
  JACKET:{category:"JACKET",coreMetric:"chestEase",metrics:upperMetrics(0.45,0.30,0.25)},
  HOODIE:{category:"HOODIE",coreMetric:"chestEase",metrics:upperMetrics(0.50,0.25,0.25)},
  SHIRT:{category:"SHIRT",coreMetric:"chestEase",metrics:upperMetrics(0.45,0.35,0.20)},
  TSHIRT:{category:"TSHIRT",coreMetric:"chestEase",metrics:upperMetrics(0.60,0.40,0).filter(m=>m.weight>0)},
  PANTS:{category:"PANTS",coreMetric:"waistEase",metrics:[
    {key:"waistEase",weight:0.40,source:"CIRCUMFERENCE",profileField:"waistCm",garmentField:"waistWidthCm",ranges:waist,required:true},
    {key:"hipEase",weight:0.25,source:"CIRCUMFERENCE",profileField:"hipsCm",garmentField:"hipWidthCm",ranges:hips},
    {key:"thighEase",weight:0.15,source:"CIRCUMFERENCE",profileField:"thighCm",garmentField:"thighWidthCm",ranges:thigh},
    {key:"inseamDelta",weight:0.20,source:"LINEAR",profileField:"inseamCm",garmentField:"inseamCm",ranges:inseam},
  ]},
  JEANS:{category:"JEANS",coreMetric:"waistEase",metrics:[
    {key:"waistEase",weight:0.40,source:"CIRCUMFERENCE",profileField:"waistCm",garmentField:"waistWidthCm",ranges:waist,required:true},
    {key:"hipEase",weight:0.25,source:"CIRCUMFERENCE",profileField:"hipsCm",garmentField:"hipWidthCm",ranges:hips},
    {key:"thighEase",weight:0.15,source:"CIRCUMFERENCE",profileField:"thighCm",garmentField:"thighWidthCm",ranges:thigh},
    {key:"inseamDelta",weight:0.20,source:"LINEAR",profileField:"inseamCm",garmentField:"inseamCm",ranges:inseam},
  ]},
};

export const STRETCH_ALLOWANCE_CM:Record<StretchLevel,number>={NONE:0,LOW:1,MEDIUM:2.5,HIGH:4.5};
export const QUALITY_FACTOR={BASIC:0.55,STANDARD:0.80,VERIFIED:1.0} as const;
