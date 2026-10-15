import { CATEGORY_RULES, QUALITY_FACTOR, STRETCH_ALLOWANCE_CM } from "./config.js";
import { ENGINE_VERSION, FitEngineError, type FitConfidence, type FitLabel, type FitMetricResult, type FitPreference, type FitProfile, type FitResult, type GarmentMeasurements, type MetricRule, type ScoreRange } from "./types.js";

const round=(n:number,digits=1)=>{const p=10**digits;return Math.round(n*p)/p};
const isFinitePositive=(value:unknown):value is number=>typeof value==="number"&&Number.isFinite(value)&&value>0;

function assertSaneInput(profile:FitProfile,garment:GarmentMeasurements){
  const values=[profile.heightCm,profile.weightKg,profile.chestCm,profile.waistCm,profile.hipsCm,profile.shoulderCm,profile.sleeveCm,profile.inseamCm,profile.thighCm,garment.chestWidthCm,garment.shoulderWidthCm,garment.sleeveLengthCm,garment.garmentLengthCm,garment.waistWidthCm,garment.hipWidthCm,garment.thighWidthCm,garment.inseamCm].filter((v):v is number=>v!==null&&v!==undefined);
  if(values.some(v=>!Number.isFinite(v)||v<=0||v>400)) throw new FitEngineError("INVALID_INPUT","Measurements must be finite positive centimeter values within a sane range.");
}

function scoreAgainstRange(value:number,r:ScoreRange):number{
  if(value>=r.optimalMin&&value<=r.optimalMax)return 100;
  if(value<=r.hardMin||value>=r.hardMax)return 0;
  if(value<r.optimalMin)return Math.max(0,Math.min(100,((value-r.hardMin)/(r.optimalMin-r.hardMin))*100));
  return Math.max(0,Math.min(100,((r.hardMax-value)/(r.hardMax-r.optimalMax))*100));
}
function metricStatus(score:number):FitMetricResult["status"]{if(score>=90)return"EXCELLENT";if(score>=80)return"GOOD";if(score>=65)return"BORDERLINE";return"POOR";}
function fitLabel(score:number):FitLabel{if(score>=90)return"EXCELLENT";if(score>=80)return"GOOD";if(score>=70)return"POSSIBLE";if(score>=60)return"NOT_IDEAL";return"NOT_RECOMMENDED";}

function explainMetric(rule:MetricRule,observed:number,score:number,preferredFit:FitPreference):string{
  const r=rule.ranges[preferredFit];
  if(score>=90)return `${rule.key}: ${round(observed)} cm داخل النطاق المثالي ${r.optimalMin}–${r.optimalMax}.`;
  if(observed<r.optimalMin)return `${rule.key}: ${round(observed)} cm أقل من نطاق ${preferredFit} المثالي ${r.optimalMin}–${r.optimalMax}.`;
  return `${rule.key}: ${round(observed)} cm أعلى من نطاق ${preferredFit} المثالي ${r.optimalMin}–${r.optimalMax}.`;
}

function getObserved(profile:FitProfile,garment:GarmentMeasurements,rule:MetricRule):number|null{
  const body=profile[rule.profileField];
  const gv=garment[rule.garmentField];
  if(!isFinitePositive(body)||!isFinitePositive(gv))return null;
  if(rule.source==="CIRCUMFERENCE"){
    const garmentCircumference=gv*2;
    const stretch=STRETCH_ALLOWANCE_CM[garment.stretchLevel]??0;
    return garmentCircumference-body+stretch;
  }
  return gv-body;
}

function nearestFitPreference(observed:number,rule:MetricRule):FitPreference{
  const prefs:FitPreference[]=["SLIM","REGULAR","LOOSE"];
  let best:FitPreference="REGULAR",bestDistance=Infinity;
  for(const pref of prefs){const r=rule.ranges[pref];const midpoint=(r.optimalMin+r.optimalMax)/2;const distance=(observed>=r.optimalMin&&observed<=r.optimalMax)?0:Math.abs(observed-midpoint);if(distance<bestDistance){bestDistance=distance;best=pref;}}
  return best;
}
function confidenceFrom(coverage:number,qualityFactor:number):{confidence:FitConfidence;score:number}{
  const score=round(Math.max(0,Math.min(1,coverage*qualityFactor))*100,0);
  if(coverage>=0.85&&qualityFactor>=0.95)return{confidence:"HIGH",score};
  if(coverage>=0.60&&qualityFactor>=0.75)return{confidence:"MEDIUM",score};
  return{confidence:"LOW",score};
}

export function calculateFit(profile:FitProfile,garment:GarmentMeasurements):FitResult{
  assertSaneInput(profile,garment);
  const ruleSet=CATEGORY_RULES[garment.category];
  if(!ruleSet)throw new FitEngineError("UNSUPPORTED_CATEGORY",`Category ${garment.category} is not supported by ${ENGINE_VERSION}.`);
  const coreRule=ruleSet.metrics.find(m=>m.key===ruleSet.coreMetric);
  if(!coreRule)throw new FitEngineError("INVALID_INPUT",`Configuration error: missing core rule ${ruleSet.coreMetric}.`);
  const coreObserved=getObserved(profile,garment,coreRule);
  if(coreObserved===null)throw new FitEngineError("PROFILE_INCOMPLETE",`The core body measurement ${coreRule.profileField} and garment measurement ${coreRule.garmentField} are required.`,{requiredProfileField:coreRule.profileField,requiredGarmentField:coreRule.garmentField});

  const metrics:FitResult["metrics"]={};
  let weightedScore=0,availableWeight=0;
  for(const rule of ruleSet.metrics){
    const observed=getObserved(profile,garment,rule); if(observed===null)continue;
    const r=rule.ranges[profile.preferredFit]; const score=round(scoreAgainstRange(observed,r),0);
    metrics[rule.key]={metric:rule.key,observed:round(observed),score,status:metricStatus(score),weight:rule.weight,expectedRange:{...r},explanation:explainMetric(rule,observed,score,profile.preferredFit)};
    weightedScore+=score*rule.weight; availableWeight+=rule.weight;
  }
  if(availableWeight<=0)throw new FitEngineError("GARMENT_MEASUREMENTS_INCOMPLETE","No comparable garment/body measurements were available.");
  const overall=round(weightedScore/availableWeight,0); const coverage=round(availableWeight,2); const q=QUALITY_FACTOR[garment.quality]; const c=confidenceFrom(coverage,q);
  const warnings:string[]=[];
  if(coverage<0.6)warnings.push("التوصية مبنية على جزء محدود من القياسات؛ أضف قياسات أكثر لرفع الثقة.");
  if(garment.quality==="BASIC")warnings.push("جودة قياسات القطعة BASIC؛ يفضل STANDARD أو VERIFIED قبل الاعتماد التجاري.");
  if(c.confidence==="LOW")warnings.push("مستوى الثقة منخفض؛ لا تعرض النتيجة كضمان للمقاس.");
  return{engineVersion:ENGINE_VERSION,fitScore:overall,label:fitLabel(overall),confidence:c.confidence,confidenceScore:c.score,preferredFit:profile.preferredFit,predictedFit:nearestFitPreference(coreObserved,coreRule),category:garment.category,coverage,metrics,warnings,inputSnapshot:{profile:structuredClone(profile),garment:structuredClone(garment)}};
}
