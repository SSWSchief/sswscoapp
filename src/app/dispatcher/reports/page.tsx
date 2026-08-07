"use client";
import * as React from "react";
import { Topbar } from "@/components/dispatcher/Topbar";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Field";
import { useOperations } from "@/components/system/OperationsProvider";
import { useExpandedOperations } from "@/components/system/ExpandedOperationsProvider";
import { pacificDate } from "@/lib/time-clock";

export default function Page(){
 const {jobs,trucks,dumpsters}=useOperations();const {invoices}=useExpandedOperations();
 const [from,setFrom]=React.useState(()=>pacificDate(new Date(Date.now()-6*86400000)));const [to,setTo]=React.useState(()=>pacificDate(new Date()));
 const selected=jobs.filter(j=>{const d=pacificDate(j.scheduledFor);return d>=from&&d<=to});const revenue=invoices.filter(i=>i.dueDate>=from&&i.dueDate<=to).reduce((n,i)=>n+i.amountCents,0);
 const href=(type:string)=>`/api/exports/${type}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
 return <><Topbar title="Reports"/><div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5"><Card className="grid gap-4 p-4 sm:grid-cols-2"><label className="text-sm">From<Input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label className="text-sm">Through<Input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label></Card><div className="grid grid-cols-2 gap-4 lg:grid-cols-4"><Metric label="Jobs" value={selected.length}/><Metric label="Completed" value={selected.filter(j=>j.status==="complete").length}/><Metric label="Recorded Receivables" value={new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(revenue/100)}/><Metric label="Assets" value={trucks.length+dumpsters.length}/></div><div className="grid gap-4 md:grid-cols-2">{[["Operations","Date-filtered jobs, status, assignment, and service data.","jobs"],["Employee Time","Exact time events without payroll rounding.","time"],["Asset Utilization","Truck, dumpster, location, status, and AirTag records.","assets"],["Invoice Records","Manual invoice lifecycle and receivable records.","invoices"]].map(([title,description,type])=><Card key={type} className="p-5"><h2 className="font-semibold">{title} Export</h2><p className="mt-1 text-sm text-brand-steel">{description}</p><a className="mt-4 inline-flex min-h-11 items-center rounded bg-brand-blue px-4 font-semibold text-white" href={href(type)}>Download CSV</a></Card>)}</div></div></>;
}
function Metric({label,value}:{label:string;value:React.ReactNode}){return <Card className="p-5"><div className="font-heading text-3xl font-bold">{value}</div><div className="text-sm uppercase text-brand-steel">{label}</div></Card>}
