import { describe, expect, it } from "vitest";
import { FitEngineError, calculateFit, type FitProfile, type GarmentMeasurements } from "../src/index.js";

describe("September Fit Engine V1",()=>{
  it("scores a well-fitting regular jacket highly",()=>{
    const profile:FitProfile={preferredFit:"REGULAR",chestCm:98,shoulderCm:44,sleeveCm:62};
    const garment:GarmentMeasurements={category:"JACKET",quality:"VERIFIED",stretchLevel:"NONE",chestWidthCm:54,shoulderWidthCm:46,sleeveLengthCm:64};
    const result=calculateFit(profile,garment);
    expect(result.fitScore).toBeGreaterThanOrEqual(90);
    expect(result.label).toBe("EXCELLENT");
    expect(result.confidence).toBe("HIGH");
    expect(result.predictedFit).toBe("REGULAR");
  });

  it("returns a low score when a jacket chest is too tight",()=>{
    const profile:FitProfile={preferredFit:"REGULAR",chestCm:104,shoulderCm:46,sleeveCm:64};
    const garment:GarmentMeasurements={category:"JACKET",quality:"VERIFIED",stretchLevel:"NONE",chestWidthCm:50,shoulderWidthCm:46,sleeveLengthCm:64};
    const result=calculateFit(profile,garment);
    expect(result.metrics.chestEase?.score).toBe(0);
    expect(result.fitScore).toBeLessThan(70);
  });

  it("scores well-fitted pants and returns medium confidence for STANDARD garment measurements",()=>{
    const profile:FitProfile={preferredFit:"REGULAR",waistCm:82,hipsCm:96,thighCm:56,inseamCm:80};
    const garment:GarmentMeasurements={category:"PANTS",quality:"STANDARD",stretchLevel:"LOW",waistWidthCm:42,hipWidthCm:51,thighWidthCm:30,inseamCm:81};
    const result=calculateFit(profile,garment);
    expect(result.fitScore).toBeGreaterThanOrEqual(85);
    expect(result.confidence).toBe("MEDIUM");
  });

  it("fails when the required core body measurement is missing",()=>{
    const profile:FitProfile={preferredFit:"REGULAR",heightCm:178,weightKg:68};
    const garment:GarmentMeasurements={category:"JACKET",quality:"VERIFIED",stretchLevel:"NONE",chestWidthCm:54};
    expect(()=>calculateFit(profile,garment)).toThrow(FitEngineError);
    try{calculateFit(profile,garment);}catch(error){expect((error as FitEngineError).code).toBe("PROFILE_INCOMPLETE");}
  });

  it("adds a conservative effective allowance for stretch",()=>{
    const profile:FitProfile={preferredFit:"REGULAR",waistCm:84};
    const a=calculateFit(profile,{category:"JEANS",quality:"VERIFIED",stretchLevel:"NONE",waistWidthCm:41});
    const b=calculateFit(profile,{category:"JEANS",quality:"VERIFIED",stretchLevel:"HIGH",waistWidthCm:41});
    expect(b.metrics.waistEase!.observed).toBeGreaterThan(a.metrics.waistEase!.observed);
  });
});
