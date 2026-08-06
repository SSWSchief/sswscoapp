import { Topbar } from "@/components/dispatcher/Topbar";
import { ComingSoon } from "@/components/system/ComingSoon";
import { futureFeatures } from "@/lib/features";
export default function Page(){return <><Topbar title="Invoices"/><ComingSoon feature={futureFeatures.invoices} icon="invoice"/></>}
