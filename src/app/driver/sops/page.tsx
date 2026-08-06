import { MobileHeader } from "@/components/driver/MobileHeader";
import { ComingSoon } from "@/components/system/ComingSoon";
import { futureFeatures } from "@/lib/features";
export default function Page(){return <><MobileHeader title="SOPs" menu/><ComingSoon feature={futureFeatures.sops} icon="jobs"/></>}
