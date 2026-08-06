import { MobileHeader } from "@/components/driver/MobileHeader";
import { ComingSoon } from "@/components/system/ComingSoon";
import { futureFeatures } from "@/lib/features";
export default function Page(){return <><MobileHeader title="Messages" menu/><ComingSoon feature={futureFeatures.messages} icon="messages"/></>}
