export type FutureFeatureKey = "invoices"|"reports"|"map"|"management"|"messages"|"pre_trip"|"sops"|"company_settings";
export interface FeatureDefinition { enabled:boolean; phase:"future"; title:string; description:string }

export const futureFeatures: Record<FutureFeatureKey, FeatureDefinition> = {
  invoices: { enabled:false, phase:"future", title:"Invoices & Payments", description:"Billing, payment links, and processor integrations are planned for a later phase." },
  reports: { enabled:false, phase:"future", title:"Reports & Analytics", description:"Operational and financial reporting will be introduced after Phase 1 data has been validated." },
  map: { enabled:false, phase:"future", title:"Fleet Map", description:"Live GPS and map-based fleet tracking are outside the Phase 1 pilot." },
  management: { enabled:false, phase:"future", title:"Management Portal", description:"A dedicated partner and leadership portal is planned for a later release." },
  messages: { enabled:false, phase:"future", title:"Internal Messages", description:"Realtime operational messaging will be added after the core dispatch workflow is proven." },
  pre_trip: { enabled:false, phase:"future", title:"Electronic Pre-Trip", description:"Electronic inspection forms require the client-approved checklist before implementation." },
  sops: { enabled:false, phase:"future", title:"SOP Library", description:"Managed procedures and acknowledgement tracking are planned for a later phase." },
  company_settings: { enabled:false, phase:"future", title:"Company Settings", description:"Editable organization settings will be enabled after configuration ownership is approved." },
};
