import { describe, expect, it } from "vitest";
import { driverJobsForWindow, jobsForPacificDay } from "./job-dates";
import type { Job } from "./types";
const job=(id:string,scheduledFor:string,status:Job["status"]="pending"):Job=>({id,reference:`#${id}`,customerId:"c",address:"a",phone:"",serviceType:"Delivery",dumpsterSize:"10 Yard",assignedDriverId:"d",assignedTruckId:null,assignedDumpsterId:null,scheduledFor,status,notes:"",photos:[],timeline:[]});
describe("Pacific job windows",()=>{
  it("uses the business day at UTC boundaries",()=>expect(jobsForPacificDay([job("1","2026-08-07T06:30:00Z")],"2026-08-06T20:00:00-07:00")).toHaveLength(1));
  it("separates upcoming and excludes cancelled",()=>expect(driverJobsForWindow([job("1","2026-08-06T18:00:00Z"),job("2","2026-08-07T18:00:00Z"),job("3","2026-08-08T18:00:00Z","cancelled")],"d","upcoming","2026-08-06T12:00:00-07:00").map(j=>j.id)).toEqual(["2"]));
});
