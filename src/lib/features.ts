export type FutureFeatureKey = "invoices"|"reports"|"map"|"management"|"messages"|"pre_trip"|"sops"|"company_settings";
export interface FeatureDefinition { enabled:boolean; phase:"active"; title:string; description:string }

export const futureFeatures: Record<FutureFeatureKey, FeatureDefinition> = {
  invoices: { enabled:true, phase:"active", title:"Invoice Records", description:"Manual invoice lifecycle records and exports." },
  reports: { enabled:true, phase:"active", title:"Reports & Analytics", description:"Operational dashboards and formula-safe CSV exports." },
  map: { enabled:true, phase:"active", title:"Locations & AirTags", description:"Operational and manually confirmed asset locations." },
  management: { enabled:true, phase:"active", title:"Management Portal", description:"Administrator operational and financial oversight." },
  messages: { enabled:true, phase:"active", title:"Internal Messages", description:"Realtime channels, announcements, and read state." },
  pre_trip: { enabled:true, phase:"active", title:"Electronic Pre-Trip", description:"Versioned inspection checklists and failure alerts." },
  sops: { enabled:true, phase:"active", title:"SOP Library", description:"Versioned procedures and acknowledgements." },
  company_settings: { enabled:true, phase:"active", title:"Company Settings", description:"Audited organization and workflow configuration." },
};
