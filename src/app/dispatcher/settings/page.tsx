import { Topbar } from "@/components/dispatcher/Topbar";
import { ComingSoon } from "@/components/system/ComingSoon";
import { futureFeatures } from "@/lib/features";
export default function Page(){return <><Topbar title="Settings"/><ComingSoon feature={futureFeatures.company_settings} icon="settings"/></>}
